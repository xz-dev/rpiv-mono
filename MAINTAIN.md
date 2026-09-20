# Downstream Maintenance

This fork keeps upstream `main` compatible with `juicesharp/rpiv-mono` and publishes only `rpiv-ask-user-question` from a generated release branch.

## Branches

- `main`: upstream-compatible mirror; never use it as the baseline for downstream patches.
- `patch/ask-bottom-pane`: product patch in the original monorepo layout.
- `patch/ask-ctrl-c-clear`: Ctrl+C clears the focused draft (custom-answer input, notes editor) via `app.clear` instead of cancelling the questionnaire.
- `ci`: this maintenance policy and projection tooling.
- `release/ask-user-question`: generated package-root tree for Pi Git installation.

## Assembly order

1. Fetch and pin an exact upstream `main` commit.
2. Create a clean full-monorepo source candidate from that commit.
3. Apply selected upstream PR heads first, each pinned to an exact commit.
4. Apply local product patch branches in their declared order: `patch/ask-bottom-pane`, then `patch/ask-ctrl-c-clear`.
5. Run focused and full integration checks in the monorepo candidate.
6. Run `scripts/project-ask-user-question.sh SOURCE_ROOT EMPTY_OUTPUT_ROOT`.
7. Validate the projected root with at least `npm pack --dry-run`.
8. Regenerate `release/ask-user-question`; never fix product code directly there.

Upstream PRs and product patches precede projection because they target the upstream monorepo paths and may rely on its private test utilities. Directory shaping belongs only to the projection step.

## Projection contract

The script reads the source candidate and writes an empty output directory. It may reorganize the output with ordinary file operations, but it must not modify the source, fetch network state, create commits, or push. The orchestrator owns Git history and remote updates.

A normal automated run requires a clean source worktree. `ALLOW_DIRTY_SOURCE=1` exists only for local dry-runs and records `source_dirty=true` in `.downstream-source`.

## Validation

Source candidate:

```sh
npx vitest run packages/rpiv-ask-user-question
npx tsc --noEmit -p tsconfig.base.json
npx biome check packages/rpiv-ask-user-question
```

Projected package:

```sh
npm pack --dry-run --json
```

Install the pushed release ref with:

```sh
pi install git:github.com/xz-dev/rpiv-mono@release/ask-user-question
```

Pi pins Git refs. To move an installed package to a new release commit, reinstall with the desired ref or full commit ID.
