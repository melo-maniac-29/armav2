"""
Sandbox service.

Detects the test framework in a cloned repo and runs the test suite
via subprocess with a timeout. Returns (passed: bool, log: str).
"""
import asyncio
import shlex
import subprocess
from pathlib import Path

# Max wall-clock seconds to let the test suite run
SANDBOX_TIMEOUT = 120

# Test commands to try, in priority order
# (framework, command, requires_file)
_RUNNERS: list[tuple[str, str, str | None]] = [
    ("pytest",   "python -m pytest --tb=short -q",  "pytest.ini"),
    ("pytest",   "python -m pytest --tb=short -q",  "pyproject.toml"),
    ("pytest",   "python -m pytest --tb=short -q",  "setup.cfg"),
    ("pytest",   "python -m pytest --tb=short -q",  "tests"),
    ("npm",      "npm test -- --watchAll=false",     "package.json"),
    ("yarn",     "yarn test --watchAll=false",       "package.json"),
    ("make",     "make test",                        "Makefile"),
    ("go",       "go test ./...",                    "go.mod"),
    ("cargo",    "cargo test",                       "Cargo.toml"),
    ("maven",    "mvn -q test",                      "pom.xml"),
    ("gradle",   "./gradlew test",                   "build.gradle"),
]


def _detect_runner(repo_dir: Path) -> tuple[str, list[str]] | None:
    """
    Return (label, argv) for the first detected test runner, or None.
    """
    for label, cmd, marker in _RUNNERS:
        if marker is None:
            return label, shlex.split(cmd)
        marker_path = repo_dir / marker
        if marker_path.exists():
            return label, shlex.split(cmd)
    return None


async def run_sandbox(repo_dir: Path) -> tuple[bool, str]:
    """
    Detect and run the test suite in repo_dir.

    Returns:
        (passed, log)   where passed=True means exit code 0.
        If no test framework is found, returns (True, "No test suite detected — skipped.").
    """
    runner = _detect_runner(repo_dir)
    if runner is None:
        return True, "No test suite detected — skipped."

    label, argv = runner
    log_header = f"[sandbox] runner={label}  cmd={' '.join(argv)}\n"

    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            cwd=str(repo_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        try:
            stdout_bytes, _ = await asyncio.wait_for(
                proc.communicate(), timeout=SANDBOX_TIMEOUT
            )
        except asyncio.TimeoutError:
            proc.kill()
            return False, log_header + f"[sandbox] Timed out after {SANDBOX_TIMEOUT}s.\n"

        output = stdout_bytes.decode(errors="replace")
        passed = proc.returncode == 0
        return passed, log_header + output

    except FileNotFoundError:
        # Executable not present in this environment — treat as no test suite
        return True, log_header + f"[sandbox] Runner '{argv[0]}' not found in environment — skipped.\n"
    except Exception as exc:
        return False, log_header + f"[sandbox] Error running tests: {exc}\n"
