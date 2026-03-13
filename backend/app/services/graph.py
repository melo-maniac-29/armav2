"""
Neo4j knowledge graph service.
Builds and queries the ARMA code knowledge graph.

Graph schema:
  (:File   {repo_id, path, language})
  (:Symbol {repo_id, file_path, name, kind})

  (:File)-[:DEFINES]->(:Symbol)
  (:File)-[:IMPORTS]->(:File)   when we can resolve the import to a known file
  (:Symbol)-[:CALLS]->(:Symbol) from call graph analysis
  (:File)-[:CO_CHANGES_WITH {weight}]->(:File)  from commit history
"""
from __future__ import annotations

from neo4j import AsyncGraphDatabase, AsyncDriver
from backend.app.config import get_settings


def _get_driver() -> AsyncDriver:
    s = get_settings()
    return AsyncGraphDatabase.driver(s.neo4j_url, auth=(s.neo4j_user, s.neo4j_password))


async def build_repo_graph(repo_id: str, symbols_data: list[dict], files_data: list[dict]) -> None:
    """
    (Re)build the knowledge graph for a single repo.
    symbols_data: list of dicts with keys: file_path, kind, name, calls, imports
    files_data:   list of dicts with keys: path, language
    """
    driver = _get_driver()
    try:
        async with driver.session() as session:
            # 1. Clear existing data for this repo
            await session.run(
                "MATCH (n {repo_id: $repo_id}) DETACH DELETE n",
                repo_id=repo_id,
            )

            # 2. Create File nodes
            await session.run(
                """
                UNWIND $files AS f
                MERGE (n:File {repo_id: $repo_id, path: f.path})
                  SET n.language = f.language
                """,
                repo_id=repo_id,
                files=files_data,
            )

            # 3. Create Symbol nodes + DEFINES edges
            if symbols_data:
                await session.run(
                    """
                    UNWIND $syms AS s
                    MERGE (sym:Symbol {repo_id: $repo_id, file_path: s.file_path, name: s.name})
                      SET sym.kind = s.kind
                    WITH sym, s
                    MATCH (f:File {repo_id: $repo_id, path: s.file_path})
                    MERGE (f)-[:DEFINES]->(sym)
                    """,
                    repo_id=repo_id,
                    syms=symbols_data,
                )

            # 4. Create CALLS edges (symbol → symbol, same repo)
            calls_pairs = [
                {"caller": s["name"], "callee": c, "file_path": s["file_path"]}
                for s in symbols_data
                for c in (s.get("calls") or [])
                if c
            ]
            if calls_pairs:
                await session.run(
                    """
                    UNWIND $pairs AS p
                    MATCH (caller:Symbol {repo_id: $repo_id, file_path: p.file_path, name: p.caller})
                    MATCH (callee:Symbol {repo_id: $repo_id, name: p.callee})
                    MERGE (caller)-[:CALLS]->(callee)
                    """,
                    repo_id=repo_id,
                    pairs=calls_pairs,
                )

            # 5. Create IMPORTS edges (file → file, resolve by path suffix match)
            file_paths = {f["path"] for f in files_data}
            import_edges = []
            for s in symbols_data:
                src_path = s["file_path"]
                for imp in s.get("imports") or []:
                    # Try to resolve: e.g. "backend.app.models.user" → "backend/app/models/user.py"
                    candidate = imp.replace(".", "/")
                    for fp in file_paths:
                        if fp.startswith(candidate) or fp.replace("/", ".").startswith(imp):
                            import_edges.append({"src": src_path, "dst": fp})
                            break

            if import_edges:
                await session.run(
                    """
                    UNWIND $edges AS e
                    MATCH (src:File {repo_id: $repo_id, path: e.src})
                    MATCH (dst:File {repo_id: $repo_id, path: e.dst})
                    MERGE (src)-[:IMPORTS]->(dst)
                    """,
                    repo_id=repo_id,
                    edges=import_edges,
                )
    finally:
        await driver.close()


async def get_related_files(repo_id: str, file_path: str, depth: int = 2) -> list[str]:
    """
    Return files related to file_path via IMPORTS and CO_CHANGES edges.
    Used by Phase 3 fix generation to gather context.
    """
    driver = _get_driver()
    try:
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (f:File {repo_id: $repo_id, path: $path})
                      -[:IMPORTS|CO_CHANGES_WITH*1..$depth]-(related:File)
                RETURN DISTINCT related.path AS path
                LIMIT 20
                """,
                repo_id=repo_id,
                path=file_path,
                depth=depth,
            )
            return [record["path"] async for record in result]
    finally:
        await driver.close()


async def build_co_change_graph(repo_id: str, db) -> None:
    """
    After commit history is stored in the DB, read all CommitFile rows and
    build CO_CHANGES_WITH edges in Neo4j for every pair of files that
    changed together in the same commit.

    Called from _full_pipeline after clone completes.
    """
    from sqlalchemy import select as sa_select
    from backend.app.models.commit import Commit, CommitFile

    # Load all commits for this repo with their files
    commits_result = await db.execute(
        sa_select(Commit.id).where(Commit.repo_id == repo_id)
    )
    commit_ids = [row[0] for row in commits_result.all()]
    if not commit_ids:
        return

    # For efficiency, load all commit_files at once and group by commit_id
    files_result = await db.execute(
        sa_select(CommitFile.commit_id, CommitFile.file_path).where(
            CommitFile.commit_id.in_(commit_ids)
        )
    )
    by_commit: dict[str, list[str]] = {}
    for commit_id, file_path in files_result.all():
        by_commit.setdefault(commit_id, []).append(file_path)

    # Build CO_CHANGES_WITH edges for each commit that touched ≥2 files
    for commit_id, file_paths in by_commit.items():
        if len(file_paths) >= 2:
            await add_co_change(repo_id, file_paths)


async def add_co_change(repo_id: str, file_paths: list[str]) -> None:
    """
    After a commit, increment CO_CHANGES_WITH weight for all pairs of files
    that changed together. Called from the webhook handler.
    """
    if len(file_paths) < 2:
        return
    driver = _get_driver()
    try:
        async with driver.session() as session:
            pairs = [
                {"a": file_paths[i], "b": file_paths[j]}
                for i in range(len(file_paths))
                for j in range(i + 1, len(file_paths))
            ]
            await session.run(
                """
                UNWIND $pairs AS p
                MATCH (a:File {repo_id: $repo_id, path: p.a})
                MATCH (b:File {repo_id: $repo_id, path: p.b})
                MERGE (a)-[r:CO_CHANGES_WITH]-(b)
                  ON CREATE SET r.weight = 1
                  ON MATCH  SET r.weight = r.weight + 1
                """,
                repo_id=repo_id,
                pairs=pairs,
            )
    finally:
        await driver.close()
