#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROOF_FILE = ROOT / ".agents-proof"
WATCHED_FILES = [
    ROOT / "AGENTS.md",
    ROOT / "README.md",
    ROOT / "ARCHITECTURE.md",
    ROOT / "TODO.md",
    ROOT / "IDEAS.md",
]


def compute_digest() -> str:
    hasher = hashlib.sha256()
    for file_path in WATCHED_FILES:
        if not file_path.exists():
            hasher.update(f"missing::{file_path.name}".encode())
            continue
        hasher.update(file_path.name.encode())
        hasher.update(file_path.read_bytes())
    return hasher.hexdigest().upper()[:20]


def refresh_proof() -> int:
    digest = compute_digest()
    PROOF_FILE.write_text(digest + "\n", encoding="utf-8")
    print(f"AGENTS proof refreshed: {digest}")
    return 0


def check_proof() -> int:
    expected = compute_digest()
    if not PROOF_FILE.exists():
        print("AGENTS proof missing. Run: python3 scripts/agents_proof.py --refresh")
        return 1

    current = PROOF_FILE.read_text(encoding="utf-8").strip()
    if current != expected:
        print("AGENTS proof is outdated.")
        print(f"Expected: {expected}")
        print(f"Current : {current or '<empty>'}")
        print("Run: python3 scripts/agents_proof.py --refresh")
        return 1

    print(f"AGENTS proof valid: {current}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if args.refresh:
        return refresh_proof()
    if args.check:
        return check_proof()

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
