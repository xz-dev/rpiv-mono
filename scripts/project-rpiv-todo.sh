#!/usr/bin/env bash
set -euo pipefail

usage() {
	printf 'usage: %s SOURCE_ROOT OUTPUT_ROOT\n' "${0##*/}" >&2
	exit 2
}

die() {
	printf 'project-rpiv-todo: %s\n' "$*" >&2
	exit 1
}

[[ $# -eq 2 ]] || usage
command -v realpath >/dev/null 2>&1 || die "realpath is required"
command -v git >/dev/null 2>&1 || die "git is required"

source_root=$(realpath -e -- "$1")
output_root=$(realpath -m -- "$2")
package_root="$source_root/packages/rpiv-todo"

[[ -d "$source_root/.git" || -f "$source_root/.git" ]] || die "source must be a Git worktree"
[[ -f "$package_root/package.json" ]] || die "missing packages/rpiv-todo/package.json"
[[ "$output_root" != "$source_root" ]] || die "output must differ from source"
case "$output_root/" in
	"$source_root/"*) die "output must not be inside source" ;;
esac
case "$source_root/" in
	"$output_root/"*) die "output must not contain source" ;;
esac

if [[ ${ALLOW_DIRTY_SOURCE:-0} != 1 ]] && [[ -n $(git -C "$source_root" status --porcelain) ]]; then
	die "source worktree is dirty; commit the integrated candidate or set ALLOW_DIRTY_SOURCE=1 for a local dry-run"
fi

if [[ -e "$output_root" ]] && [[ -n $(find "$output_root" -mindepth 1 -maxdepth 1 -print -quit) ]]; then
	die "output directory must be empty"
fi
mkdir -p -- "$output_root"

cp -a -- "$package_root"/. "$output_root"/

ci_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
[[ -f "$ci_root/MAINTAIN.md" ]] || die "ci branch is missing MAINTAIN.md"
cp -a -- "$ci_root/MAINTAIN.md" "$output_root/MAINTAIN.md"

readme_tmp="$output_root/README.md.downstream"
cat >"$readme_tmp" <<'EOF'
> [!IMPORTANT]
> This branch is a generated downstream Git release. Product fixes live on full-monorepo patch branches; see [MAINTAIN.md](MAINTAIN.md) for provenance and rebuild rules.

EOF
cat "$output_root/README.md" >>"$readme_tmp"
mv -- "$readme_tmp" "$output_root/README.md"

source_commit=$(git -C "$source_root" rev-parse HEAD)
upstream_commit=${UPSTREAM_COMMIT:-$(git -C "$source_root" rev-parse upstream/main)}
patch_todo_focus_window=${PATCH_TODO_FOCUS_WINDOW:-$(git -C "$source_root" rev-parse feat/rpiv-todo-focus-window)}
patch_todo_stale_completed_fade=${PATCH_TODO_STALE_COMPLETED_FADE:-$(git -C "$source_root" rev-parse feat/rpiv-todo-stale-completed-fade)}
patch_todo_active_strip=${PATCH_TODO_ACTIVE_STRIP:-$(git -C "$source_root" rev-parse feat/rpiv-todo-active-strip)}
projection_commit=$(git -C "$ci_root" rev-parse HEAD)
source_dirty=false
[[ -n $(git -C "$source_root" status --porcelain) ]] && source_dirty=true
cat >"$output_root/.downstream-source" <<EOF
upstream_repository=https://github.com/juicesharp/rpiv-mono
upstream_commit=$upstream_commit
patch_todo_focus_window=$patch_todo_focus_window
patch_todo_stale_completed_fade=$patch_todo_stale_completed_fade
patch_todo_active_strip=$patch_todo_active_strip
source_commit=$source_commit
projection_commit=$projection_commit
source_dirty=$source_dirty
source_path=packages/rpiv-todo
EOF

[[ -f "$output_root/package.json" ]] || die "projection did not produce package.json"
[[ -f "$output_root/index.ts" ]] || die "projection did not produce index.ts"
