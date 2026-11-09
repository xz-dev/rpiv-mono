# Downstream Maintenance

This fork keeps upstream `main` compatible with `juicesharp/rpiv-mono` and publishes `rpiv-ask-user-question` and `rpiv-todo` from generated release branches.

## Branches

- `main`: upstream-compatible mirror; never use it as the baseline for downstream patches.
- `patch/ask-ctrl-c-clear`: Ctrl+C clears the focused draft (custom-answer input, notes editor) via `app.clear` instead of cancelling the questionnaire.
- `patch/ask-preview-scroll`: upstream PR #211 (`fix/preview-scroll` @ `3d36fcec`) merged onto current `main` — makes the preview box scrollable with PageUp/PageDown. This branch IS the resolved merge: when upstream merges #211 differently (likely squash), this branch will NOT diff to empty and must be dropped from the sync order manually rather than waiting for an auto-empty retirement.
- `patch/ask-preview-scroll-keys`: adds `previewScrollUpKey` / `previewScrollDownKey` config fields so the scroll bindings can be remapped (default `pageup`/`pagedown` remains). Stacked on `patch/ask-preview-scroll`.

Retired (covered upstream):
- ~~`patch/ask-bottom-pane`~~: upstream `a0d6714d` made `renderMode: "inline"` the default — the questionnaire already renders in Pi's bottom/editor slot so the transcript stays visible.
- ~~`patch/ask-preserve-cursor`~~: upstream `feea1626` (PR #281, our own patch) merged verbatim.
- `feat/rpiv-todo-focus-window`: overflowing overlay lists render a focus window anchored at the first unfinished task, backfilling from earlier tasks, with `… N earlier` / `… N later` markers. Intended for an upstream PR.
- `feat/rpiv-todo-stale-completed-fade`: overlay keeps only the 3 most recently completed tasks (`completedSeq` stamped on completion, persisted in the snapshot); replaces turn-boundary hiding. Stacked on `feat/rpiv-todo-focus-window`. Intended for an upstream PR.
- `feat/rpiv-todo-active-strip`: every in_progress task renders above the focus window (active strip), capped with a `… N more active` marker under the row budget; relaxes the single-in_progress guidance for parallel work. Stacked on `feat/rpiv-todo-stale-completed-fade`. Intended for an upstream PR.
- `ci`: this maintenance policy and projection tooling.
- `release/ask-user-question`: generated package-root tree for Pi Git installation.
- `release/rpiv-todo`: generated package-root tree for Pi Git installation.

## Assembly order

1. Fetch and pin an exact upstream `main` commit.
2. Create a clean full-monorepo source candidate from that commit.
3. Apply selected upstream PR heads first, each pinned to an exact commit.
4. Apply the release's local product patch branches in their declared order:
   - `release/ask-user-question`: `patch/ask-ctrl-c-clear`, then `patch/ask-preview-scroll`, then `patch/ask-preview-scroll-keys` (stacked).
   - `release/rpiv-todo`: `feat/rpiv-todo-focus-window`, then `feat/rpiv-todo-stale-completed-fade`, then `feat/rpiv-todo-active-strip` (stacked).
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

## Releasing to ourselves

**Every branch push must leave the corresponding `release/*` installable.** A patch branch that lands without a matching release-branch rebuild is a regression for whoever installs this fork — the installed package keeps the old behavior and silently ignores the new work.

After pushing patch/feat branch changes:

1. Trigger the sync workflow so the release branch re-projects with the new code:

   ```sh
   gh workflow run upstream-sync.yml --repo xz-dev/rpiv-mono --ref ci
   ```

   The cron at `2 21 * * *` also picks it up, but do not rely on it for active development — kick a manual run.

2. Watch the run to confirm `rebuild-release` (and `rebuild-rpiv-todo` when that package changed) reached the `Commit and push rebuilt release branch` step:

   ```sh
   gh run list --repo xz-dev/rpiv-mono --workflow upstream-sync.yml --limit 1
   ```

3. Reinstall the moved ref in Pi to actually pick up the new commit (Pi pins Git refs):

   ```sh
   pi install git:github.com/xz-dev/rpiv-mono@release/ask-user-question
   pi install git:github.com/xz-dev/rpiv-mono@release/rpiv-todo
   ```

If the validation step fails with a fixable error (formatter, missing test fixture, obvious type regression), fix it on the owning patch/feat branch — never only on `release/*`. If the failure is a pre-existing upstream breakage that our merge exposed (e.g. node_modules API drift, upstream test regression), document it in the commit message and consider whether the release can ship without that check; the workflow currently runs all three checks unconditionally, so a genuinely-broken-upstream build needs a manual projection per the script in `scripts/` or a workflow relaxation commit.

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
