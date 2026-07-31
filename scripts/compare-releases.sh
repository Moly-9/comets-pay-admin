#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  printf 'Usage: %s OLD_RELEASE_DIR NEW_RELEASE_DIR\n' "$0" >&2
  exit 2
fi

old_release=$1
new_release=$2

for release_dir in "$old_release" "$new_release"; do
  if [ ! -d "$release_dir/deploy" ] || [ ! -d "$release_dir/dist" ]; then
    printf 'Invalid release directory: %s\n' "$release_dir" >&2
    exit 1
  fi
done

old_manifest=$(mktemp /tmp/comets-pay-old.XXXXXX)
new_manifest=$(mktemp /tmp/comets-pay-new.XXXXXX)
trap 'rm -f "$old_manifest" "$new_manifest"' EXIT

(
  cd "$old_release"
  find deploy dist -type f -exec shasum -a 256 {} + | sort
) >"$old_manifest"

(
  cd "$new_release"
  find deploy dist -type f -exec shasum -a 256 {} + | sort
) >"$new_manifest"

printf 'Changed files and hashes\n'
diff -u "$old_manifest" "$new_manifest" || true

printf '\nDirectory summary\n'
diff -rq --exclude SHA256SUMS "$old_release" "$new_release" || true
