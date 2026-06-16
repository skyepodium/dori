# Git Worktree Desktop Client

A local-first desktop Git client for developers who work across multiple branches at the same time.

The app makes Git worktrees a first-class workflow: open a repository, see every workspace, inspect changes and history, commit safely, and switch context without losing your current branch state.

## Why This Exists

Traditional Git clients usually treat worktrees as an advanced side feature. This project treats each worktree as a primary workspace. That makes it easier to keep a main branch, feature branch, bugfix branch, and review branch active in parallel without constantly stashing, checking out, or rebuilding local state.

## Highlights

- Worktree-first repository navigation
- Local Git CLI execution through the Electron main process
- Safe preload bridge with validated IPC boundaries
- Changes view for staged, unstaged, untracked, and conflict files
- Working-tree and commit diff viewing
- Commit, fetch, pull, push, cherry-pick, and abort cherry-pick flows
- Worktree creation and removal with dirty-state safeguards
- English and Korean renderer localization
- Recent repository and language preference persistence
- Design-token driven desktop UI

## Current Capabilities

| Area | Supported |
| --- | --- |
| Repository | Open a local Git repository by path or native directory picker |
| Worktrees | List, switch, create, and remove worktrees |
| Status | Show current branch, ahead/behind state, dirty state, lock state, and file groups |
| Diffs | Show working-tree diffs and per-file commit diffs |
| History | Show recent commits and changed files per commit |
| Commit | Commit all current worktree changes with summary and optional description |
| Sync | Run `fetch --all --prune`, `pull --ff-only`, and `push` |
| Cherry-pick | Cherry-pick a selected commit and abort an in-progress cherry-pick |
| Localization | Switch renderer UI between English and Korean |

## Requirements

- Git available on `PATH`
- Node.js compatible with the project dependencies
- `pnpm` 11.x, declared as `pnpm@11.7.0` in `/Users/skyepodium/dev/dori/package.json`
- A desktop environment capable of running Electron

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

Build the application:

```sh
pnpm build
```

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Starts the Electron app through `electron-vite dev`. |
| `pnpm test` | Runs the Vitest suite once. |
| `pnpm typecheck` | Runs TypeScript with `--noEmit`. |
| `pnpm build` | Runs TypeScript validation and builds main, preload, and renderer bundles. |

## Architecture

The application is split across Electron process boundaries.

| Path | Responsibility |
| --- | --- |
| `/Users/skyepodium/dev/dori/src/main` | Electron main process bootstrapping, IPC handler registration, and native Git execution |
| `/Users/skyepodium/dev/dori/src/main/git` | Git CLI service, command orchestration, parser logic, and safety checks |
| `/Users/skyepodium/dev/dori/src/preload` | Narrow bridge exposing the Git client API to the renderer |
| `/Users/skyepodium/dev/dori/src/shared` | Cross-process types and constants |
| `/Users/skyepodium/dev/dori/src/renderer` | React UI, presentation state, i18n, worktree dashboard, changes view, history view, and styling |

Git commands run through `execFile('git', ...)` in the main process. Renderer code does not call Node APIs directly. It calls the preload bridge, which invokes validated IPC handlers.

## Design Direction

The product should feel like a serious global developer tool: quiet, precise, fast, and trustworthy. It should avoid marketing-page visual language and instead prioritize dense but readable information, clear command states, and safe local Git operations.

For design-system decisions, interaction rules, and visual constraints, see `/Users/skyepodium/dev/dori/DESIGN.md`.

## Localization

Renderer copy is managed in `/Users/skyepodium/dev/dori/src/renderer/src/i18n.ts`.

Rules:

- English and Korean are required first-class locales.
- User-facing renderer strings should not be hardcoded in JSX.
- Labels, placeholders, aria labels, titles, errors, and success messages should use translation keys.
- New or changed copy should keep locale key parity covered by tests.

## Development Standards

The project contract lives in `/Users/skyepodium/dev/dori/AGENTS.md`.

Core standards:

- Use `pnpm` only.
- Keep Git and filesystem operations in Electron main services.
- Keep renderer code free of direct Node API usage.
- Validate IPC input and unwrap IPC output through shared utilities.
- Prefer small modules with clear responsibility boundaries.
- Use design tokens for repeated visual values.
- Prevent blank renderer failure states with explicit empty states and an error boundary.

## Limitations

- Hosted Git provider integrations are not implemented.
- Pull request management is out of scope for the current product surface.
- Merge conflict resolution is limited to surfacing conflict state and diffs.
- Stash, rebase, and advanced branch management flows are not implemented yet.
- Commit currently stages all worktree changes before creating the commit; explicit staging controls are not available yet.
- Remote sync uses basic Git commands and does not include credential-management UI.
- Packaging and distribution scripts are not defined yet.

## Project Status

This is an early-stage desktop client. The current priority is to make local repository and worktree workflows reliable, polished, and understandable before adding hosted collaboration features.
