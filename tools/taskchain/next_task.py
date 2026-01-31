#!/usr/bin/env python3
"""
next_task.py - Show runnable Taskchain tasks (Belle Pack v2.0)

Usage:
  python tools/taskchain/next_task.py
  python tools/taskchain/next_task.py --pick-first
  python tools/taskchain/next_task.py --json
"""

from __future__ import annotations

import argparse
import os
import re
import json
from datetime import datetime
from typing import Any, Dict, List, Tuple

TASK_ID_RE = re.compile(r"^T[0-9]{4}$")

# We reuse a small subset of tasklint's YAML/frontmatter parsing to avoid extra deps.
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

class ParseError(Exception):
    pass

def parse_simple_yaml(text: str) -> Any:
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
            raise ParseError(f"Invalid indentation at line {i+1}: expected {indent}, got {ind0}")
        if raw0.strip().startswith("- "):
            lst: List[Any] = []
            while True:
                i = next_nonempty(i)
                if i >= len(lines):
                    break
                raw = _strip_comments(lines[i]).rstrip("\n")
                ind = len(raw) - len(raw.lstrip(" "))
                if ind < indent:
                    break
                if ind != indent:
                    raise ParseError(f"Invalid list indentation at line {i+1}: expected {indent}, got {ind}")
                if not raw.strip().startswith("- "):
                    raise ParseError(f"Expected list item at line {i+1}")
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
                    # parse more at indent+4
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
                            raise ParseError(f"Invalid mapping indentation at line {j+1}: expected {indent+4}, got {ind2}")
                        s2 = raw2.strip()
                        if ":" not in s2:
                            raise ParseError(f"Expected key: value at line {j+1}")
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
                raise ParseError(f"Invalid mapping indentation at line {i+1}: expected {indent}, got {ind}")
            s = raw.strip()
            if ":" not in s:
                raise ParseError(f"Expected key: value at line {i+1}")
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

def parse_frontmatter(md_text: str) -> Dict[str, Any]:
    lines = md_text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ParseError("Missing frontmatter")
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        raise ParseError("Unterminated frontmatter")
    fm_text = "\n".join(lines[1:end])
    fm = parse_simple_yaml(fm_text)
    if not isinstance(fm, dict):
        raise ParseError("Frontmatter must be mapping")
    return fm

def read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def task_id_sort_key(tid: str) -> int:
    try:
        return int(tid[1:])
    except Exception:
        return 10**9

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pick-first", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    repo_root = os.getcwd()
    tasks_dir = os.path.join(repo_root, ".ai", "taskchain", "tasks")
    state_dir = os.path.join(repo_root, ".ai", "taskchain", "state")

    if not os.path.isdir(tasks_dir):
        print("No tasks directory:", tasks_dir)
        return 2

    specs: Dict[str, Dict[str, Any]] = {}
    for name in os.listdir(tasks_dir):
        if not name.endswith(".task.md"):
            continue
        tid = name.split(".")[0]
        if not TASK_ID_RE.match(tid):
            continue
        try:
            fm = parse_frontmatter(read_text(os.path.join(tasks_dir, name)))
            specs[tid] = fm
        except Exception:
            continue

    states: Dict[str, Dict[str, Any]] = {}
    if os.path.isdir(state_dir):
        for name in os.listdir(state_dir):
            if not name.endswith(".state.yml"):
                continue
            tid = name.split(".")[0]
            if not TASK_ID_RE.match(tid):
                continue
            try:
                st = parse_simple_yaml(read_text(os.path.join(state_dir, name)))
                if isinstance(st, dict):
                    states[tid] = st
            except Exception:
                continue

    def dep_done(dep: str) -> bool:
        st = states.get(dep)
        return isinstance(st, dict) and st.get("status") == "done"

    runnable: List[Dict[str, Any]] = []
    for tid, fm in specs.items():
        st = states.get(tid, {})
        status = st.get("status", "ready")
        if status != "ready":
            continue
        deps = fm.get("depends_on", [])
        ok = True
        if isinstance(deps, list):
            for d in deps:
                if isinstance(d, str) and TASK_ID_RE.match(d):
                    if not dep_done(d):
                        ok = False
                        break
        if ok:
            runnable.append({"id": tid, "title": fm.get("title", ""), "depends_on": deps})

    runnable.sort(key=lambda x: task_id_sort_key(x["id"]))

    if args.pick_first:
        if runnable:
            if args.json:
                print(json.dumps(runnable[0], indent=2))
            else:
                print(runnable[0]["id"])
            return 0
        print("No runnable tasks.")
        return 2

    if args.json:
        print(json.dumps(runnable, indent=2))
    else:
        if not runnable:
            print("No runnable tasks.")
            return 2
        print("Runnable tasks:")
        for t in runnable:
            print(f"- {t['id']}: {t.get('title','')}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
