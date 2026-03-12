"""
AST-based code parser.
Extracts symbols (functions, classes, methods) from source files.
Supports Python (via stdlib ast) and JS/TS (via regex).
"""
import ast
import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SymbolInfo:
    kind: str           # function | class | method
    name: str
    start_line: int
    end_line: int
    signature: str | None = None
    docstring: str | None = None
    calls: list[str] = field(default_factory=list)    # names of symbols called
    imports: list[str] = field(default_factory=list)  # module paths imported


@dataclass
class ParsedFile:
    symbols: list[SymbolInfo]
    imports: list[str]  # top-level module paths imported


# ── Python ────────────────────────────────────────────────────────────────────

class _PythonVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.symbols: list[SymbolInfo] = []
        self.imports: list[str] = []
        self._class_stack: list[str] = []

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module:
            self.imports.append(node.module)
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self._class_stack.append(node.name)
        docstring = ast.get_docstring(node)
        self.symbols.append(SymbolInfo(
            kind="class",
            name=node.name,
            start_line=node.lineno,
            end_line=node.end_lineno or node.lineno,
            docstring=docstring,
        ))
        self.generic_visit(node)
        self._class_stack.pop()

    def _extract_calls(self, node: ast.AST) -> list[str]:
        calls = []
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name):
                    calls.append(child.func.id)
                elif isinstance(child.func, ast.Attribute):
                    calls.append(child.func.attr)
        return list(dict.fromkeys(calls))  # deduplicate, preserve order

    def _visit_func(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        kind = "method" if self._class_stack else "function"
        docstring = ast.get_docstring(node)
        calls = self._extract_calls(node)
        # Build signature
        try:
            args = [a.arg for a in node.args.args]
            sig = f"{node.name}({', '.join(args)})"
        except Exception:
            sig = node.name

        self.symbols.append(SymbolInfo(
            kind=kind,
            name=node.name,
            start_line=node.lineno,
            end_line=node.end_lineno or node.lineno,
            signature=sig,
            docstring=docstring,
            calls=calls,
        ))
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_func(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_func(node)


def _parse_python(source: str) -> ParsedFile:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return ParsedFile(symbols=[], imports=[])
    visitor = _PythonVisitor()
    visitor.visit(tree)
    return ParsedFile(symbols=visitor.symbols, imports=visitor.imports)


# ── JavaScript / TypeScript ────────────────────────────────────────────────────

# Patterns for JS/TS symbols
_JS_CLASS = re.compile(r"^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)", re.MULTILINE)
_JS_FUNC = re.compile(
    r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(", re.MULTILINE
)
_JS_ARROW = re.compile(
    r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(", re.MULTILINE
)
_JS_METHOD = re.compile(
    r"^\s*(?:(?:public|private|protected|static|async|override)\s+)*(\w+)\s*\(", re.MULTILINE
)
_JS_IMPORT = re.compile(r"""^\s*import\s+.*?from\s+['"]([^'"]+)['"]""", re.MULTILINE)


def _parse_js(source: str, filename: str) -> ParsedFile:
    symbols: list[SymbolInfo] = []
    imports: list[str] = []

    lines = source.splitlines()

    for m in _JS_CLASS.finditer(source):
        line_no = source[:m.start()].count("\n") + 1
        symbols.append(SymbolInfo(kind="class", name=m.group(1), start_line=line_no, end_line=line_no))

    for m in _JS_FUNC.finditer(source):
        line_no = source[:m.start()].count("\n") + 1
        symbols.append(SymbolInfo(kind="function", name=m.group(1), start_line=line_no, end_line=line_no))

    for m in _JS_ARROW.finditer(source):
        line_no = source[:m.start()].count("\n") + 1
        symbols.append(SymbolInfo(kind="function", name=m.group(1), start_line=line_no, end_line=line_no))

    for m in _JS_IMPORT.finditer(source):
        imports.append(m.group(1))

    return ParsedFile(symbols=symbols, imports=imports)


# ── Dispatch ──────────────────────────────────────────────────────────────────

def parse_file(path: Path, content: str) -> ParsedFile:
    """
    Parse a source file and return extracted symbols + imports.
    Returns an empty ParsedFile for unsupported languages.
    """
    ext = path.suffix.lower()
    if ext == ".py":
        return _parse_python(content)
    elif ext in (".js", ".jsx", ".ts", ".tsx"):
        return _parse_js(content, path.name)
    return ParsedFile(symbols=[], imports=[])
