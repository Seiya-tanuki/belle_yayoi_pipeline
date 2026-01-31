#!/usr/bin/env python3
"""
tasklint.py - Taskchain linter (Belle Pack v2.0)

Design goals:
- Run in a plain Python 3 environment (no external deps required).
- Parse a restricted YAML subset sufficient for this pack.
- Validate:
  - required AI OS files per ai/manifest.yml
  - TaskSpec frontmatter correctness
  - TaskState correctness
  - TaskReport frontmatter correctness (if present)
  - cross-file consistency (Spec <-> State <-> Report)
  - dependency references exist (best-effort)

Usage:
  python tools/taskchain/tasklint.py --all
  python tools/taskchain/tasklint.py --id T0001
  python tools/taskchain/tasklint.py --preflight
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Tuple, Optional


TASK_ID_RE = re.compile(r"^T[0-9]{4}$")
STATUS_ENUM = {"ready", "in_progress", "blocked", "done_pending_review", "done", "cancelled", "invalid"}
REPORT_STATUS_ENUM = {"blocked", "done_pending_review", "done", "invalid"}


class LintError(Exception):
    pass


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _is_iso_datetime(s: str) -> bool:
    try:
        datetime.fromisoformat(s.replace("Z", "+00:00"))
        return True
    except Exception:
        return False


def _strip_comments(line: str) -> str:
    if "#" not in line:
        return line
    in_squote = False
    in_dquote = False
    out = []
    for ch in line:
        if ch == "'" and not in_dquote:
            in_squote = not in_squote
        elif ch == '"' and not in_squote:
            in_dquote = not in_dquote
        if ch == "#" and not in_squote and not in_dquote:
            break
        out.append(ch)
    return "".join(out)


def _parse_scalar(token: str) -> Any:
    token = token.strip()
    if token == "":
        return ""
    if token in ("null", "Null", "NULL", "~"):
        return None
    if token in ("true", "True", "TRUE"):
        return True
    if token in ("false", "False", "FALSE"):
        return False
    if (token.startswith('"') and token.endswith('"')) or (token.startswith("'") and token.endswith("'")):
        return token[1:-1]
    if token.startswith("[") and token.endswith("]"):
        inner = token[1:-1].strip()
        if inner == "":
            return []
        parts = [p.strip() for p in inner.split(",")]
        return [_parse_scalar(p) for p in parts]
    if re.fullmatch(r"-?[0-9]+", token):
        try:
            return int(token)
        except Exception:
            pass
    if re.fullmatch(r"-?[0-9]+\.[0-9]+", token):
        try:
            return float(token)
        except Exception:
            pass
    return token


def parse_simple_yaml(text: str) -> Any:
    """
    Parse a restricted YAML subset:
    - indentation-based mappings and lists
    - scalars: strings/bool/null/numbers
    - inline lists: [a, b]
    This is NOT a full YAML parser.
    """
    lines = text.splitlines()
    if lines and lines[0].startswith("\ufeff"):
        lines[0] = lines[0].lstrip("\ufeff")

    def next_nonempty(i: int) -> int:
        while i < len(lines):
            raw = _strip_comments(lines[i]).rstrip("\n")
            if raw.strip() == "":
                i += 1
                continue
            return i
        return i

    def parse_block(i: int, indent: int) -> Tuple[Any, int]:
        i = next_nonempty(i)
        if i >= len(lines):
            return {}, i

        raw0 = _strip_comments(lines[i]).rstrip("\n")
        ind0 = len(raw0) - len(raw0.lstrip(" "))
        if ind0 < indent:
            return {}, i
        if ind0 > indent:
            raise LintError(f"Invalid indentation at line {i+1}: expected indent {indent}, got {ind0}")

        if raw0.strip().startswith("- "):
            lst: List[Any] = []
            while True:
                i = next_nonempty(i)
                if i >= len(lines):
                    break
                raw = _strip_comments(lines[i]).rstrip("\n")
                if raw.strip() == "":
                    i += 1
                    continue
                ind = len(raw) - len(raw.lstrip(" "))
                if ind < indent:
                    break
                if ind != indent:
                    raise LintError(f"Invalid list indentation at line {i+1}: expected {indent}, got {ind}")
                if not raw.strip().startswith("- "):
                    raise LintError(f"Expected list item at line {i+1}")
                item_rest = raw.strip()[2:].strip()
                if item_rest == "":
                    item, i2 = parse_block(i + 1, indent + 2)
                    lst.append(item)
                    i = i2
                    continue
                if ":" in item_rest and not item_rest.startswith('"') and not item_rest.startswith("'"):
                    key, val = item_rest.split(":", 1)
                    key = key.strip()
                    val = val.strip()
                    item_map: Dict[str, Any] = {}
                    if val == "":
                        nested, i2 = parse_block(i + 1, indent + 4)
                        item_map[key] = nested
                        i = i2
                    else:
                        item_map[key] = _parse_scalar(val)
                        i += 1
                    while True:
                        j = next_nonempty(i)
                        if j >= len(lines):
                            i = j
                            break
                        raw2 = _strip_comments(lines[j]).rstrip("\n")
                        ind2 = len(raw2) - len(raw2.lstrip(" "))
                        if ind2 < indent + 4:
                            break
                        if ind2 != indent + 4:
                            raise LintError(f"Invalid mapping indentation in list item at line {j+1}: expected {indent+4}, got {ind2}")
                        s2 = raw2.strip()
                        if ":" not in s2:
                            raise LintError(f"Expected 'key: value' at line {j+1}")
                        k2, v2 = s2.split(":", 1)
                        k2 = k2.strip()
                        v2 = v2.strip()
                        if v2 == "":
                            nested2, j2 = parse_block(j + 1, indent + 6)
                            item_map[k2] = nested2
                            i = j2
                        else:
                            item_map[k2] = _parse_scalar(v2)
                            i = j + 1
                    lst.append(item_map)
                    continue
                lst.append(_parse_scalar(item_rest))
                i += 1
            return lst, i

        mp: Dict[str, Any] = {}
        while True:
            i = next_nonempty(i)
            if i >= len(lines):
                break
            raw = _strip_comments(lines[i]).rstrip("\n")
            ind = len(raw) - len(raw.lstrip(" "))
            if ind < indent:
                break
            if ind != indent:
                raise LintError(f"Invalid mapping indentation at line {i+1}: expected {indent}, got {ind}")
            s = raw.strip()
            if ":" not in s:
                raise LintError(f"Expected 'key: value' at line {i+1}")
            key, val = s.split(":", 1)
            key = key.strip()
            val = val.strip()
            if val == "":
                nested, i2 = parse_block(i + 1, indent + 2)
                mp[key] = nested
                i = i2
            else:
                mp[key] = _parse_scalar(val)
                i += 1
        return mp, i

    parsed, _ = parse_block(0, 0)
    return parsed


def parse_markdown_frontmatter(md_text: str) -> Tuple[Dict[str, Any], str]:
    lines = md_text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise LintError("Missing YAML frontmatter (expected starting --- line)")
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        raise LintError("Unterminated YAML frontmatter (missing closing ---)")
    yaml_text = "\n".join(lines[1:end])
    body = "\n".join(lines[end+1:])
    fm = parse_simple_yaml(yaml_text)
    if not isinstance(fm, dict):
        raise LintError("Frontmatter must be a mapping/object")
    return fm, body


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def try_validate_jsonschema(instance: Any, schema_path: str) -> Optional[str]:
    try:
        import jsonschema  # type: ignore
    except Exception:
        return None
    schema = load_json(schema_path)
    try:
        jsonschema.validate(instance=instance, schema=schema)
        return None
    except Exception as e:
        return str(e)


@dataclass
class LintResult:
    ok: bool
    errors: List[str]
    warnings: List[str]


def lint_manifest(repo_root: str) -> Tuple[List[str], List[str], Dict[str, Any]]:
    errors: List[str] = []
    warnings: List[str] = []
    manifest_path = os.path.join(repo_root, "ai", "manifest.yml")
    if not os.path.exists(manifest_path):
        errors.append("Missing ai/manifest.yml")
        return errors, warnings, {}
    try:
        manifest = parse_simple_yaml(_read_text(manifest_path))
    except Exception as e:
        errors.append(f"Failed to parse ai/manifest.yml: {e}")
        return errors, warnings, {}
    if not isinstance(manifest, dict):
        errors.append("ai/manifest.yml must be a mapping")
        return errors, warnings, {}
    required_files = manifest.get("required_files", [])
    required_dirs = manifest.get("required_dirs", [])
    for p in required_files:
        if not isinstance(p, str):
            errors.append(f"manifest.required_files contains non-string entry: {p!r}")
            continue
        full = os.path.join(repo_root, p)
        if not os.path.exists(full):
            errors.append(f"Missing required file: {p}")
    for d in required_dirs:
        if not isinstance(d, str):
            errors.append(f"manifest.required_dirs contains non-string entry: {d!r}")
            continue
        full = os.path.join(repo_root, d)
        if not os.path.isdir(full):
            errors.append(f"Missing required dir: {d}")
    return errors, warnings, manifest


def lint_task_spec(repo_root: str, path: str) -> LintResult:
    errors: List[str] = []
    warnings: List[str] = []

    try:
        fm, _body = parse_markdown_frontmatter(_read_text(path))
    except Exception as e:
        return LintResult(False, [f"{path}: {e}"], [])

    task_id = fm.get("id")
    if not isinstance(task_id, str) or not TASK_ID_RE.match(task_id):
        errors.append(f"{path}: frontmatter.id must match ^T[0-9]{{4}}$")
    fname = os.path.basename(path)
    if isinstance(task_id, str):
        if not fname.startswith(task_id) or not fname.endswith(".task.md"):
            errors.append(f"{path}: filename must be <ID>.task.md (got {fname})")

    required_keys = ["title", "created_at", "depends_on", "status_policy", "authority", "scope", "acceptance", "reporting"]
    for k in required_keys:
        if k not in fm:
            errors.append(f"{path}: missing required frontmatter key: {k}")

    ca = fm.get("created_at")
    if isinstance(ca, str):
        if not _is_iso_datetime(ca):
            errors.append(f"{path}: created_at is not ISO 8601: {ca}")
    elif ca is not None:
        errors.append(f"{path}: created_at must be string")

    ua = fm.get("updated_at")
    if ua is not None:
        if not isinstance(ua, str) or not _is_iso_datetime(ua):
            errors.append(f"{path}: updated_at must be ISO 8601 string")

    dep = fm.get("depends_on")
    if dep is not None:
        if not isinstance(dep, list):
            errors.append(f"{path}: depends_on must be a list")
        else:
            for d in dep:
                if not isinstance(d, str) or not TASK_ID_RE.match(d):
                    errors.append(f"{path}: depends_on contains invalid task id: {d!r}")

    sp = fm.get("status_policy")
    if isinstance(sp, dict):
        cms = sp.get("codex_max_status")
        if cms not in ("done_pending_review", "done"):
            errors.append(f"{path}: status_policy.codex_max_status must be done_pending_review|done")
    elif sp is not None:
        errors.append(f"{path}: status_policy must be an object")

    schema_path = os.path.join(repo_root, "ai", "taskchain", "schemas", "task.schema.json")
    if os.path.exists(schema_path):
        msg = try_validate_jsonschema(fm, schema_path)
        if msg:
            errors.append(f"{path}: schema validation error: {msg}")

    return LintResult(len(errors) == 0, errors, warnings)


def lint_task_state(repo_root: str, path: str) -> LintResult:
    errors: List[str] = []
    warnings: List[str] = []
    try:
        state = parse_simple_yaml(_read_text(path))
    except Exception as e:
        return LintResult(False, [f"{path}: failed to parse YAML: {e}"], [])
    if not isinstance(state, dict):
        return LintResult(False, [f"{path}: TaskState must be a mapping/object"], [])

    task_id = state.get("id")
    if not isinstance(task_id, str) or not TASK_ID_RE.match(task_id):
        errors.append(f"{path}: id must match ^T[0-9]{{4}}$")
    fname = os.path.basename(path)
    if isinstance(task_id, str):
        if not fname.startswith(task_id) or not fname.endswith(".state.yml"):
            errors.append(f"{path}: filename must be <ID>.state.yml (got {fname})")

    status = state.get("status")
    if status not in STATUS_ENUM:
        errors.append(f"{path}: status must be one of {sorted(STATUS_ENUM)}")

    ts = state.get("timestamps")
    if not isinstance(ts, dict):
        errors.append(f"{path}: timestamps must be an object")
    else:
        created_at = ts.get("created_at")
        if not isinstance(created_at, str) or not _is_iso_datetime(created_at):
            errors.append(f"{path}: timestamps.created_at must be ISO 8601 string")
        for k in ("started_at", "finished_at", "approved_at"):
            v = ts.get(k)
            if v is None:
                continue
            if not isinstance(v, str) or not _is_iso_datetime(v):
                errors.append(f"{path}: timestamps.{k} must be null or ISO 8601 string")

    schema_path = os.path.join(repo_root, "ai", "taskchain", "schemas", "task_state.schema.json")
    if os.path.exists(schema_path):
        msg = try_validate_jsonschema(state, schema_path)
        if msg:
            errors.append(f"{path}: schema validation error: {msg}")

    return LintResult(len(errors) == 0, errors, warnings)


def lint_task_report(repo_root: str, path: str) -> LintResult:
    errors: List[str] = []
    warnings: List[str] = []
    try:
        fm, _body = parse_markdown_frontmatter(_read_text(path))
    except Exception as e:
        return LintResult(False, [f"{path}: {e}"], [])
    task_id = fm.get("id")
    if not isinstance(task_id, str) or not TASK_ID_RE.match(task_id):
        errors.append(f"{path}: frontmatter.id must match ^T[0-9]{{4}}$")
    fname = os.path.basename(path)
    if isinstance(task_id, str):
        if not fname.startswith(task_id) or not fname.endswith(".report.md"):
            errors.append(f"{path}: filename must be <ID>.report.md (got {fname})")

    if fm.get("type") != "task_report":
        errors.append(f"{path}: frontmatter.type must be task_report")

    ga = fm.get("generated_at")
    if not isinstance(ga, str) or not _is_iso_datetime(ga):
        errors.append(f"{path}: generated_at must be ISO 8601 string")

    ts = fm.get("task_status")
    if ts not in REPORT_STATUS_ENUM:
        errors.append(f"{path}: task_status must be one of {sorted(REPORT_STATUS_ENUM)}")

    schema_path = os.path.join(repo_root, "ai", "taskchain", "schemas", "task_report.schema.json")
    if os.path.exists(schema_path):
        msg = try_validate_jsonschema(fm, schema_path)
        if msg:
            errors.append(f"{path}: schema validation error: {msg}")

    return LintResult(len(errors) == 0, errors, warnings)


def find_runtime_files(repo_root: str) -> Tuple[List[str], List[str], List[str]]:
    tasks_dir = os.path.join(repo_root, ".ai", "taskchain", "tasks")
    state_dir = os.path.join(repo_root, ".ai", "taskchain", "state")
    reports_dir = os.path.join(repo_root, ".ai", "taskchain", "reports")
    task_specs: List[str] = []
    task_states: List[str] = []
    task_reports: List[str] = []
    if os.path.isdir(tasks_dir):
        for name in sorted(os.listdir(tasks_dir)):
            if name.endswith(".task.md"):
                task_specs.append(os.path.join(tasks_dir, name))
    if os.path.isdir(state_dir):
        for name in sorted(os.listdir(state_dir)):
            if name.endswith(".state.yml"):
                task_states.append(os.path.join(state_dir, name))
    if os.path.isdir(reports_dir):
        for name in sorted(os.listdir(reports_dir)):
            if name.endswith(".report.md"):
                task_reports.append(os.path.join(reports_dir, name))
    return task_specs, task_states, task_reports


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="lint manifest + all tasks/states/reports")
    ap.add_argument("--preflight", action="store_true", help="lint manifest only (OS readiness)")
    ap.add_argument("--id", dest="task_id", help="lint a specific task id")
    args = ap.parse_args()

    repo_root = os.getcwd()

    errors: List[str] = []
    warnings: List[str] = []

    m_err, m_warn, _manifest = lint_manifest(repo_root)
    errors += m_err
    warnings += m_warn

    if args.preflight and not args.all and not args.task_id:
        for w in warnings:
            print("WARN:", w)
        for e in errors:
            print("ERROR:", e)
        return 0 if not errors else 1

    task_specs, task_states, task_reports = find_runtime_files(repo_root)

    specs_by_id: Dict[str, str] = {}
    states_by_id: Dict[str, str] = {}
    reports_by_id: Dict[str, str] = {}

    for p in task_specs:
        tid = os.path.basename(p).split(".")[0]
        specs_by_id[tid] = p
    for p in task_states:
        tid = os.path.basename(p).split(".")[0]
        states_by_id[tid] = p
    for p in task_reports:
        tid = os.path.basename(p).split(".")[0]
        reports_by_id[tid] = p

    def lint_one(tid: str):
        if tid in specs_by_id:
            r = lint_task_spec(repo_root, specs_by_id[tid])
            errors.extend(r.errors)
            warnings.extend(r.warnings)
        else:
            errors.append(f"Missing TaskSpec for {tid}: .ai/taskchain/tasks/{tid}.task.md")
        if tid in states_by_id:
            r = lint_task_state(repo_root, states_by_id[tid])
            errors.extend(r.errors)
            warnings.extend(r.warnings)
        else:
            errors.append(f"Missing TaskState for {tid}: .ai/taskchain/state/{tid}.state.yml")
        if tid in reports_by_id:
            r = lint_task_report(repo_root, reports_by_id[tid])
            errors.extend(r.errors)
            warnings.extend(r.warnings)

    if args.task_id:
        lint_one(args.task_id)
    else:
        all_ids = sorted(set(specs_by_id.keys()) | set(states_by_id.keys()) | set(reports_by_id.keys()))
        for tid in all_ids:
            lint_one(tid)

    # Dependency existence check (best-effort)
    for tid, spec_path in specs_by_id.items():
        if args.task_id and tid != args.task_id:
            continue
        try:
            fm, _ = parse_markdown_frontmatter(_read_text(spec_path))
            deps = fm.get("depends_on", [])
            if isinstance(deps, list):
                for d in deps:
                    if isinstance(d, str) and TASK_ID_RE.match(d):
                        if d not in specs_by_id:
                            warnings.append(f"{spec_path}: depends_on references missing TaskSpec: {d}")
                        if d not in states_by_id:
                            warnings.append(f"{spec_path}: depends_on references missing TaskState: {d}")
        except Exception:
            pass

    # Report existence heuristic
    for tid, state_path in states_by_id.items():
        if args.task_id and tid != args.task_id:
            continue
        try:
            st = parse_simple_yaml(_read_text(state_path))
            if isinstance(st, dict):
                status = st.get("status")
                if status in ("done_pending_review", "done") and tid not in reports_by_id:
                    warnings.append(f"{state_path}: status={status} but report is missing: .ai/taskchain/reports/{tid}.report.md")
        except Exception:
            pass

    for w in warnings:
        print("WARN:", w)
    for e in errors:
        print("ERROR:", e)

    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
