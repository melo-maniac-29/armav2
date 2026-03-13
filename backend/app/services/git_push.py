"""
Git + GitHub helpers for the auto-fix pipeline.

push_fix_branch: commit the fixed file on a new branch and push to GitHub.
create_github_pr: open a PR via the GitHub REST API.
"""
import re
import subprocess
from pathlib import Path

import httpx


# ──────────────────────────────────────────────
# Git helpers
# ──────────────────────────────────────────────

def _run_git(args: list[str], cwd: Path) -> str:
    """Run a git command synchronously. Raises on non-zero exit."""
    result = subprocess.run(
        ["git"] + args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed:\n{result.stderr.strip()}"
        )
    return result.stdout.strip()


def push_fix_branch(
    repo_dir: Path,
    branch_name: str,
    base_branch: str,
    changed_files: list[str],
    file_updates: dict[str, str] | None,
    commit_message: str,
    github_token: str,
    remote_url: str,
) -> None:
    """
    Stage the changed files, commit, and push to GitHub.

    Steps:
    1. Configure a transient committer identity (not persisted globally).
    2. Create or reset the branch.
    3. Stage changed files.
    4. Commit.
    5. Push with embedded token (never logged).
    """
    try:
        _run_git(["config", "user.email", "arma-bot@arma.dev"], repo_dir)
        _run_git(["config", "user.name", "ARMA Bot"], repo_dir)

        # Always branch from the latest remote default branch.
        _run_git(["fetch", "origin", base_branch], repo_dir)
        _run_git(["checkout", base_branch], repo_dir)
        _run_git(["reset", "--hard", f"origin/{base_branch}"], repo_dir)
        _run_git(["checkout", "-B", branch_name, f"origin/{base_branch}"], repo_dir)

        if file_updates:
            for rel_path, content in file_updates.items():
                file_abs = repo_dir / rel_path
                file_abs.parent.mkdir(parents=True, exist_ok=True)
                file_abs.write_text(content, encoding="utf-8")

        for rel_path in changed_files:
            _run_git(["add", rel_path], repo_dir)

        staged = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=str(repo_dir),
            capture_output=True,
            text=True,
        )
        if staged.returncode == 0:
            raise RuntimeError("No file changes were staged for commit.")
        if staged.returncode not in (0, 1):
            raise RuntimeError("Unable to verify staged changes before commit.")

        _run_git(["commit", "-m", commit_message], repo_dir)

        auth_url = _inject_token(remote_url, github_token)
        _run_git(["push", auth_url, f"{branch_name}:{branch_name}", "--force"], repo_dir)
    finally:
        # Restore the shared clone to the default branch for the poller.
        try:
            _run_git(["checkout", base_branch], repo_dir)
            _run_git(["reset", "--hard", f"origin/{base_branch}"], repo_dir)
        except RuntimeError:
            pass


def _inject_token(remote_url: str, token: str) -> str:
    """Insert a PAT into an HTTPS GitHub URL."""
    # https://github.com/... → https://<token>@github.com/...
    return re.sub(r"https://", f"https://{token}@", remote_url, count=1)


# ──────────────────────────────────────────────
# GitHub API helpers
# ──────────────────────────────────────────────

async def get_default_branch(token: str, full_name: str) -> str:
    """Return the default branch of a GitHub repo."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{full_name}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        return resp.json().get("default_branch", "main")


async def create_github_pr(
    token: str,
    full_name: str,
    head_branch: str,
    base_branch: str,
    title: str,
    body: str,
) -> tuple[int, str]:
    """
    Create a pull request on GitHub.

    Returns:
        (pr_number, pr_html_url)
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{full_name}/pulls",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={
                "title": title,
                "head": head_branch,
                "base": base_branch,
                "body": body,
                "draft": False,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["number"], data["html_url"]
