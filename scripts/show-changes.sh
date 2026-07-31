#!/bin/sh
set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

printf 'Working tree\n'
git status --short

printf '\nUnstaged changes\n'
git diff --stat
git diff --name-status

printf '\nStaged changes\n'
git diff --cached --stat
git diff --cached --name-status

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  printf '\nLatest commit\n'
  git show --stat --oneline --decorate --no-renames HEAD
fi
