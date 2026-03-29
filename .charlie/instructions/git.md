# Git and PR Conventions

Keep history clean and reviews fast by standardizing branches, commits, and PRs. These rules help Charlie mirror your workflow and reduce back‑and‑forth in reviews.

## Scope
All git and GitHub actions.

## Context
- We use PR‑based development with squash‑merges to the default branch.
- GitHub Actions are used for CI/CD and automated checks are required before merge.
- Linear is used for project management and automatically syncs with GitHub based on branch names, PR bodies, and commit messages.

## Rules
- [R1] Never push directly to the default branch (`dev`). Create a branch and open a PR.
- [R2] Branch names: when a Linear issue ID exists, use `<type>/<issue-id>-<short-slug>` (e.g., `fix/wha-123-add-onboarding-flow`); otherwise use a concise lowercase kebab‑case slug (e.g., `fix-typo-readme`).
- [R3] Keep branches focused: one logical change per PR. Avoid sweeping refactors and unrelated changes.
- [R4] Commit message subject is imperative, ≤72 chars, no emojis. Must follow conventional commits.
- [R5] Use a multi‑line commit body when context matters: what changed, why, and any follow‑ups. Wrap long lines (~100 chars max is fine).
- [R6] PR titles are concise (≤60 chars), no bracket tags or emojis.
  - Titles should follow Conventional Commits
  - Titles should end with the Linear issue ID when possible (e.g., `... (WHA-123)`)
- [R7] PR body includes: short Context/Motivation, Changes bullets, and Verification commands run locally.
  - The last line of the body should specify the issue ID with a keyword when applicable (e.g., `Resolves WHA-123`)
- [R8] Start PRs as Draft while WIP. Mark Ready only after local checks (lint/types/tests) pass and the description is accurate.
- [R9] Don’t rewrite public history on shared branches. Force‑push with lease is OK on your own feature branch when rebasing.
- [R10] Linear issue references: put the issue ID in the branch name when applicable and reference it in commit/PR bodies (e.g., `Refs WHA-123`, `Closes #123`).

## References
1. Conventional Commits — https://www.conventionalcommits.org/en/v1.0.0/
2. GitHub Keywords — https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/using-keywords-in-issues-and-pull-requests