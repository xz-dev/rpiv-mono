# Downstream Maintenance

This fork keeps upstream `main` compatible with `juicesharp/rpiv-mono` and publishes `rpiv-ask-user-question` and `rpiv-todo` from generated release branches.

## Branches

- `main`: upstream-compatible mirror; never use it as the baseline for downstream patches.
- `patch/ask-bottom-pane`: product patch in the original monorepo layout.
- `patch/ask-ctrl-c-clear`: Ctrl+C clears the focused draft (custom-answer input, notes editor) via `app.clear` instead of cancelling the questionnaire.
- `feat/rpiv-todo-focus-window`: overflowing overlay lists render a focus window anchored at the first unfinished task, backfilling from earlier tasks, with `… N earlier` / `… N later` markers. Intended for an upstream PR.
- `feat/rpiv-todo-stale-completed-fade`: overlay keeps only the 3 most recently completed tasks (`completedSeq` stamped on completion, persisted in the snapshot); replaces turn-boundary hiding. Stacked on `feat/rpiv-todo-focus-window`. Intended for an upstream PR.
- `ci`: this maintenance policy and projection tooling.
- `release/ask-user-question`: generated package-root tree for Pi Git installation.
- `release/rpiv-todo`: generated package-root tree for Pi Git installation.

## Assembly order

1. Fetch and pin an exact upstream `main` commit.
2. Create a clean full-monorepo source candidate from that commit.
3. Apply selected upstream PR heads first, each pinned to an exact commit.
4. Apply the release's local product patch branches in their declared order:
   - `release/ask-user-question`: `patch/ask-bottom-pane`, then `patch/ask-ctrl-c-clear`.
   - `release/rpiv-todo`: `feat/rpiv-todo-focus-window`, then `feat/rpiv-todo-stale-completed-fade` (stacked).
5. Run focused and full integration checks in the monorepo candidate.
6. Run the release's projection script with `SOURCE_ROOT EMPTY_OUTPUT_ROOT`:
   - `release/ask-user-question`: `scripts/project-ask-user-question.sh`.
   - `release/rpiv-todo`: `scripts/project-rpiv-todo.sh`.
7. Validate the projected root with at least `npm pack --dry-run`.
8. Regenerate the release branch; never fix product code directly there.

Upstream PRs and product patches precede projection because they target the upstream monorepo paths and may rely on its private test utilities. Directory shaping belongs only to the projection step.

## Projection contract

The script reads the source candidate and writes an empty output directory. It may reorganize the output with ordinary file operations, but it must not modify the source, fetch network state, create commits, or push. The orchestrator owns Git history and remote updates.

A normal automated run requires a clean source worktree. `ALLOW_DIRTY_SOURCE=1` exists only for local dry-runs and records `source_dirty=true` in `.downstream-source`.

## Validation

Source candidate:

```sh
npx vitest run packages/rpiv-ask-user-question   # and/or packages/rpiv-todo
npx tsc --noEmit -p tsconfig.base.json
npx biome check --error-on-warnings packages/rpiv-ask-user-question   # and/or packages/rpiv-todo
```

Projected package:

```sh
npm pack --dry-run --json
```

Install the pushed release refs with:

```sh
pi install git:github.com/xz-dev/rpiv-mono@release/ask-user-question
pi install git:github.com/xz-dev/rpiv-mono@release/rpiv-todo
```

Pi pins Git refs. To move an installed package to a new release commit, reinstall with the desired ref or full commit ID.
