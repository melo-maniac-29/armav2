import asyncio
import logging
from pathlib import Path

import httpx
from sqlalchemy import delete as sa_delete
from sqlalchemy import select

from backend.app.api.analysis import _run_analysis
from backend.app.core.git_ops import parse_git_log
from backend.app.db import AsyncSessionLocal
from backend.app.models.base import new_uuid
from backend.app.models.commit import Commit, CommitFile
from backend.app.models.feature_request import FeatureRequest
from backend.app.models.pr_job import PrJob
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt

logger = logging.getLogger(__name__)


async def _run_git(repo_dir: Path, *args: str) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        "git",
        *args,
        cwd=str(repo_dir),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode().strip(), stderr.decode().strip()


async def _check_repo_for_updates(repo: Repo) -> tuple[bool, list[str]]:
    repo_dir = Path("repos") / repo.id
    if not repo_dir.exists() or not (repo_dir / ".git").exists():
        return False, []

    try:
        code, _, err = await _run_git(repo_dir, "fetch", "origin", repo.default_branch)
        if code != 0:
            logger.warning("[poller] git fetch failed for repo %s: %s", repo.id, err)
            return False, []

        code, previous_head, err = await _run_git(repo_dir, "rev-parse", "HEAD")
        if code != 0:
            logger.warning("[poller] rev-parse HEAD failed for repo %s: %s", repo.id, err)
            return False, []

        code, current_branch, err = await _run_git(repo_dir, "branch", "--show-current")
        if code != 0:
            logger.warning("[poller] branch detection failed for repo %s: %s", repo.id, err)
            return False, []

        if current_branch != repo.default_branch:
            logger.warning(
                "[poller] repo %s was left on branch %s; switching back to %s",
                repo.id,
                current_branch,
                repo.default_branch,
            )

        code, _, err = await _run_git(repo_dir, "checkout", repo.default_branch)
        if code != 0:
            logger.warning("[poller] checkout failed for repo %s: %s", repo.id, err)
            return False, []

        code, count_str, err = await _run_git(
            repo_dir, "rev-list", f"HEAD..origin/{repo.default_branch}", "--count"
        )
        if code != 0:
            logger.warning("[poller] rev-list failed for repo %s: %s", repo.id, err)
            return False, []

        count = int(count_str) if count_str.isdigit() else 0
        if count <= 0:
            return False, []

        logger.info("[poller] Repo %s has %d new commits. Pulling..", repo.id, count)
        code, _, err = await _run_git(repo_dir, "pull", "--ff-only", "origin", repo.default_branch)
        if code != 0:
            logger.warning("[poller] git pull failed for repo %s: %s", repo.id, err)
            return False, []

        code, current_head, err = await _run_git(repo_dir, "rev-parse", "HEAD")
        if code != 0:
            logger.warning("[poller] post-pull rev-parse failed for repo %s: %s", repo.id, err)
            return False, []

        if current_head == previous_head:
            return False, []

        code, diff_output, err = await _run_git(
            repo_dir, "diff", "--name-only", previous_head, current_head
        )
        if code != 0:
            logger.warning("[poller] diff failed for repo %s: %s", repo.id, err)
            return True, []

        return True, [line for line in diff_output.splitlines() if line]
    except Exception as e:
        logger.warning("[poller] Error checking updates for repo %s: %s", repo.id, e)
        return False, []


async def repo_polling_loop():
    logger.info("[poller] Started background repo polling loop (30s interval)")
    while True:
        try:
            await asyncio.sleep(30)
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Repo).where(Repo.status == "ready"))
                repos = result.scalars().all()
                if repos:
                    logger.info(
                        "[poller] Executing background git fetch routines for %d active repositories...",
                        len(repos),
                    )
                for repo in repos:
                    updated, changed_files = await _check_repo_for_updates(repo)
                    if updated:
                        asyncio.create_task(_auto_reindex_commits(repo.id))
                    if changed_files:
                        logger.info(
                            "[poller] Triggering analysis for %d changed files on repo %s",
                            len(changed_files),
                            repo.id,
                        )
                        asyncio.create_task(_run_analysis(repo.id, repo.user_id, changed_files))

                    await _check_pr_statuses(repo, db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("[poller] Loop error: %s", e)


async def _check_pr_statuses(repo: Repo, db) -> None:
    try:
        us = (
            await db.execute(select(UserSettings).where(UserSettings.user_id == repo.user_id))
        ).scalar_one_or_none()
        if not us or not us.github_token_encrypted:
            return
        token = decrypt(us.github_token_encrypted)

        jobs = (
            await db.execute(
                select(PrJob).where(PrJob.repo_id == repo.id, PrJob.status == "pr_opened")
            )
        ).scalars().all()
        frs = (
            await db.execute(
                select(FeatureRequest).where(
                    FeatureRequest.repo_id == repo.id, FeatureRequest.status == "pr_opened"
                )
            )
        ).scalars().all()

        items = list(jobs) + list(frs)
        if not items:
            return

        async with httpx.AsyncClient(timeout=10) as client:
            for item in items:
                pr_num = item.github_pr_number
                if not pr_num:
                    continue

                try:
                    resp = await client.get(
                        f"https://api.github.com/repos/{repo.full_name}/pulls/{pr_num}",
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Accept": "application/vnd.github+json",
                            "X-GitHub-Api-Version": "2022-11-28",
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        state = data.get("state")
                        merged = data.get("merged")
                        if state == "closed":
                            if merged:
                                item.status = "merged"
                            else:
                                item.status = "failed"
                                item.error_msg = "PR was closed without merging."
                            logger.info("[poller] Updated PR %s status to %s", pr_num, item.status)
                            await db.commit()
                except Exception as e:
                    logger.warning("[poller] Error checking PR %s: %s", pr_num, e)
    except Exception as e:
        logger.warning("[poller] Outer error checking PRs: %s", e)


async def _auto_reindex_commits(repo_id: str) -> None:
    try:
        repo_dir = Path("repos") / repo_id
        if not repo_dir.exists():
            return

        commit_records = await asyncio.get_running_loop().run_in_executor(
            None, lambda: parse_git_log(repo_dir, max_commits=500)
        )

        async with AsyncSessionLocal() as db:
            await db.execute(sa_delete(Commit).where(Commit.repo_id == repo_id))
            await db.commit()

            for cr in commit_records:
                commit_row = Commit(
                    id=new_uuid(),
                    repo_id=repo_id,
                    hash=cr.hash,
                    author_name=cr.author_name,
                    author_email=cr.author_email,
                    committed_at=cr.committed_at,
                    message=cr.message,
                    is_bug_fix=cr.is_bug_fix,
                    additions=cr.additions,
                    deletions=cr.deletions,
                    files_changed=cr.files_changed,
                )
                db.add(commit_row)
                await db.flush()

                for fr in cr.files:
                    db.add(
                        CommitFile(
                            id=new_uuid(),
                            commit_id=commit_row.id,
                            file_path=fr.path,
                            change_type=fr.change_type,
                            additions=fr.additions,
                            deletions=fr.deletions,
                        )
                    )

            await db.commit()
            logger.info("[poller] Auto-reindexed %d commits for %s", len(commit_records), repo_id)
    except Exception as e:
        logger.warning("[poller] Error auto-reindexing commits for %s: %s", repo_id, e)
