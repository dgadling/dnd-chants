#!/usr/bin/env bash
set -e
# Replicate GitHub CI exactly: fresh clone, frozen lockfile, CI=true
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLONE_DIR="$HOME/tmp-ci/dnd-chants-ci"
echo "=== CI Replicate: cleaning $CLONE_DIR ==="
rm -rf "$CLONE_DIR"
mkdir -p "$(dirname "$CLONE_DIR")"
echo "=== Cloning $REPO_ROOT to $CLONE_DIR ==="
git clone "$REPO_ROOT" "$CLONE_DIR" -q
cd "$CLONE_DIR"
echo "=== bun install --frozen-lockfile ==="
bun install --frozen-lockfile
echo "=== bun run lint (CI=true) ==="
CI=true bun run lint
echo "=== bun run build (CI=true) ==="
CI=true bun run build
echo "=== CI Replicate PASSED ==="
