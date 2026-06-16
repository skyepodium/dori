# Git Worktree Desktop Client

An Electron, React, and TypeScript desktop client for local Git repositories with a worktree-first workflow. The app treats each worktree as a primary workspace, so developers can inspect, switch, create, and remove isolated branch workspaces without leaving the desktop UI.

The implementation uses `electron-vite` for the Electron build pipeline and `pnpm` for package management.

## Overview

This project is a local-first Git client focused on repositories that use multiple worktrees. It wraps the Git CLI in the Electron main process, exposes a narrow IPC API through preload, and renders the repository workflow in React.

The current app supports opening a repository, listing worktrees, reading status and history, viewing diffs, committing changes, synchronizing with remotes, and running selected worktree operations.

## Features

- Open a local Git repository by path or directory picker.
- List the main worktree and linked worktrees.
- Show branch, HEAD SHA, locked state, and dirty state for each worktree.
- Create a new worktree from a branch name, worktree path, and base ref.
- Remove non-main worktrees, with a dirty-worktree safety check unless force removal is selected.
- Inspect staged, unstaged, untracked, and conflict file groups.
- View working tree diffs, including generated diffs for untracked text files.
- View recent commit history and per-file commit diffs.
- Commit all current worktree changes with a summary and optional description.
- Run `fetch --all --prune`, `pull --ff-only`, and `push`.
- Cherry-pick a selected commit and abort an in-progress cherry-pick.
- Switch the renderer interface between English and Korean.
- Store recent repository paths and language preference in local browser storage.

## Requirements

- Node.js compatible with the project dependencies.
- `pnpm` 11.x. The project declares `pnpm@11.7.0` in `package.json`.
- Git installed and available on `PATH`.
- A desktop environment that can run Electron.

## Getting Started

Install dependencies:

```sh
pnpm install
```

Start the development app:

```sh
pnpm dev
```

Run tests:

```sh
pnpm test
```

Run TypeScript validation:

```sh
pnpm typecheck
```

Build the app:

```sh
pnpm build
```

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Starts the Electron app through `electron-vite dev`. |
| `pnpm test` | Runs the Vitest test suite once. |
| `pnpm typecheck` | Runs TypeScript with `--noEmit`. |
| `pnpm build` | Runs TypeScript validation, then builds main, preload, and renderer bundles with `electron-vite`. |

## Architecture Overview

The app is split across Electron process boundaries:

| Area | Responsibility |
| --- | --- |
| `src/main` | Electron main process bootstrapping, IPC handler registration, and Git service execution. |
| `src/main/git` | Git CLI adapter, command orchestration, safety checks, and parser tests. |
| `src/preload` | Safe bridge that exposes the Git client IPC surface to the renderer. |
| `src/shared` | Shared types and constants used across main, preload, and renderer code. |
| `src/renderer` | React UI, app state, worktree dashboard, changes view, history view, and styling. |

Git operations run in the main process through `execFile('git', ...)`. Renderer code does not call Node.js APIs directly; it calls the preload bridge, which invokes validated IPC handlers in the main process.

## Design and i18n Notes

- The product direction is a quiet, developer-focused desktop tool rather than a branded marketing surface.
- Worktrees are treated as first-class workspaces in navigation and status displays.
- The design source of truth is `DESIGN.md`.
- Renderer copy is managed through a lightweight local i18n module with English and Korean translations.
- User-facing renderer strings, including labels, placeholders, titles, success messages, and errors, should be added through translation keys rather than inline JSX text.
- Visual styling is implemented with renderer CSS and shared design token constants.

## Current Limitations

- The app depends on the local Git CLI and does not include hosted Git provider integrations.
- Pull request management is out of scope.
- Merge conflict resolution is limited to surfacing conflict state and diffs; there is no conflict editor.
- Stash, rebase, and advanced branch management flows are not implemented.
- Commit currently stages all worktree changes before creating the commit; there are no explicit staging controls in the UI.
- Remote synchronization uses basic Git commands and does not provide advanced authentication or credential management UI.
- Packaging and distribution scripts are not defined yet.
