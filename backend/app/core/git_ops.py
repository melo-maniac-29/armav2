"""
Parse git commit history from a cloned repository.

Uses a single `git log --name-status` call — no per-commit subprocess,
so it stays fast even on repos with hundreds of commits.

Output is used to:
  - Populate the `commits` and `commit_files` DB tables
  - Build CO_CHANGES_WITH edges in the Neo4j knowledge graph
"""
from __future__ import annotations

import datetime
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

# Keywords in commit messages that flag a commit as a bug-fix
_BUG_KEYWORDS = frozenset({
    "fix", "bug", "patch", "issue", "error", "crash", "hotfix",
    "defect", "revert", "regression", "broken",
})


def _is_bug_fix(message: str) -> bool:
    lower = message.lower()
    return any(kw in lower for kw in _BUG_KEYWORDS)


@dataclass
class FileRecord:
    path: str
    change_type: str  # "added" | "modified" | "deleted"
    additions: int = 0
    deletions: int = 0


@dataclass
class CommitRecord:
    hash: str
    author_name: str
    author_email: str
    committed_at: datetime.datetime
    message: str
    is_bug_fix: bool = False
    files: list[FileRecord] = field(default_factory=list)

    @property
    def files_changed(self) -> int:
        return len(self.files)

    @property
    def additions(self) -> int:
        return sum(f.additions for f in self.files)

    @property
    def deletions(self) -> int:
        return sum(f.deletions for f in self.files)


def parse_git_log(repo_path: Path, max_commits: int = 500) -> list[CommitRecord]:
    """
    Run ``git log --numstat`` on a local clone and return structured
    CommitRecord objects with accurate additions/deletions counts.

    Format chosen:
      --pretty=tformat:COMMIT|%H|%an|%ae|%ct|%s
        → one line per commit
      --numstat
        → lines like: 5\t3\tpath.py   (additions, deletions, path)
        → binary files show: -\t-\tpath.bin  (treated as 0/0)
    """
    result = subprocess.run(
        [
            "git", "log", f"-{max_commits}",
            "--pretty=tformat:COMMIT|%H|%an|%ae|%ct|%s",
            "--numstat",
        ],
        capture_output=True,
        text=True,
        cwd=str(repo_path),
        timeout=120,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return []

    commits: list[CommitRecord] = []
    current: CommitRecord | None = None

    for raw_line in result.stdout.splitlines():
        line = raw_line.rstrip("\r")
        if not line:
            continue  # blank separator between commits

        if line.startswith("COMMIT|"):
            # Flush previous
            if current is not None:
                commits.append(current)

            # Split max 4 so message (which may contain |) is kept intact
            parts = line[7:].split("|", 4)
            if len(parts) < 5:
                current = None
                continue

            hash_, author_name, author_email, ts_str, message = parts
            try:
                committed_at = datetime.datetime.fromtimestamp(
                    int(ts_str), tz=datetime.timezone.utc
                )
            except (ValueError, OSError):
                committed_at = datetime.datetime.now(datetime.timezone.utc)

            current = CommitRecord(
                hash=hash_.strip(),
                author_name=author_name[:255],
                author_email=author_email[:255],
                committed_at=committed_at,
                message=message[:2000],
                is_bug_fix=_is_bug_fix(message),
            )

        elif current is not None and "\t" in line:
            # numstat format: additions\tdeletions\tfilepath
            # Binary files show: -\t-\tfilepath
            parts = line.split("\t", 2)
            if len(parts) < 3:
                continue

            add_str, del_str, fpath = parts
            fpath = fpath.strip()

            # Handle binary files (show "-") and parse counts
            try:
                additions = int(add_str) if add_str != "-" else 0
            except ValueError:
                additions = 0
            try:
                deletions = int(del_str) if del_str != "-" else 0
            except ValueError:
                deletions = 0

            # Infer change type from counts
            if additions > 0 and deletions == 0:
                change_type = "added"
            elif additions == 0 and deletions > 0:
                change_type = "deleted"
            else:
                change_type = "modified"

            if fpath:
                current.files.append(
                    FileRecord(
                        path=fpath,
                        change_type=change_type,
                        additions=additions,
                        deletions=deletions,
                    )
                )

    # Don't forget the last commit
    if current is not None:
        commits.append(current)

    return commits
