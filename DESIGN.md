# Design Direction

## Source Of Truth

- Status: Draft
- Last refreshed: 2026-06-17
- Scope: Electron desktop app, repository selector, worktree source list, changes view, history view, worktree management dialogs, i18n, and design-token system.
- Related contract: `/Users/skyepodium/dev/dori/AGENTS.md`

This document is the product and design-system source of truth. Update it whenever product direction, interaction rules, visual language, or design-token policy changes.

## Product Vision

Build a global-quality desktop Git client where worktrees are the default mental model for parallel development.

The app should feel native, calm, and professional: a tool developers can keep open all day while moving between branches, reviewing local changes, and managing isolated workspaces.

## Brand And Personality

- Quiet, precise, developer-native.
- Confident without being decorative.
- Local-first and trustworthy.
- Fast to scan under pressure.
- Serious enough for senior engineers and approachable enough for everyday Git users.

Avoid:

- Marketing-page hero layouts
- Decorative gradients, novelty visuals, and ornamental illustrations
- Oversized empty cards
- Single-hue visual themes that make state hard to scan
- Hidden automation that mutates Git state without clear feedback

## Product Goals

- Make worktrees visible, understandable, and easy to switch.
- Let users inspect repository state before taking Git actions.
- Support local-first Git workflows without requiring hosted provider accounts.
- Preserve trust through clear status, reversible flows where possible, and explicit destructive warnings.
- Keep the UI dense but readable, with the rhythm of a professional macOS desktop tool.

## Non-Goals For The Current Surface

- Pull request management
- Hosted Git provider API integration
- Full merge conflict editor
- Stash and rebase UI
- Advanced credential-management UI
- Marketing or onboarding pages inside the core desktop workflow

## Primary Users

- Developers who keep multiple branches active at the same time.
- Engineers reviewing local changes before committing or pushing.
- Maintainers who need to inspect history, cherry-pick commits, and manage isolated workspaces.
- Teams that want local Git clarity without provider lock-in.

## Core Jobs

- Open a local repository.
- See all worktrees and their branch, dirty, locked, and HEAD state.
- Switch to another worktree quickly.
- Create a worktree for a new task.
- Remove a worktree safely.
- Inspect staged, unstaged, untracked, and conflict files.
- View diffs before committing.
- Commit local changes.
- Fetch, pull, push, cherry-pick, and abort cherry-pick.
- Understand when there is nothing to do.

## Information Architecture

- Repository selector: filtered dropdown with recent local repositories.
- Worktree navigation: always-visible filtered source list.
- Workspace header: current repository, selected worktree, branch, sync state, dirty state, and lock state.
- Primary tabs: Worktrees, Changes, History.
- Command toolbar: refresh, fetch, pull, push, delete.
- Dialogs: create worktree and remove worktree.
- Feedback layer: success, loading, error, empty, and crash fallback states.

## Design Principles

- Worktree is a workspace. It is a primary navigation object, not a hidden branch action.
- State before action. Show branch, dirty, locked, ahead/behind, and selected target before mutation commands.
- Prefer visible structure over cleverness. Users should not need to remember where core actions live.
- Dense but calm. Use compact lists and panels, but keep enough spacing for confident scanning.
- Local trust first. Git CLI state is the source of truth; hosted collaboration features can come later.
- Empty is still a state. No operation should leave users staring at an unexplained blank canvas.
- Global from the start. UI copy must be localizable, terminology must be consistent, and docs should be written for international contributors.

## Visual Language

- App chrome: neutral, macOS-like, understated.
- Typography: Apple/system UI stack for interface chrome.
- Monospace: only for diffs, SHAs, paths where code-like alignment matters, and command output.
- Color: semantic status colors for success, warning, danger, focus, selection, dirty, and locked state.
- Shape: restrained radius, hairline borders, selected row tint, and shallow elevation for menus and dialogs.
- Motion: minimal and fast; only use motion to clarify transitions.
- Iconography: use icons when they improve scan speed for Git actions and status. Do not use icons as decoration.

## Layout

- Desktop-first Electron window.
- Sidebar owns repository and worktree navigation.
- Main workspace owns command context and the selected tab.
- Changes view keeps the file list and commit panel adjacent.
- Diff panels must avoid horizontal page scroll. Long code lines may scroll inside the diff surface only.
- Large local inventories must scroll inside their own list container, not stretch the entire sidebar.
- The app should remain useful in laptop split view without overlapping controls or clipped button labels.

## Components

Core components:

- Repository selector
- Worktree source list
- Workspace header
- Status pill
- Command toolbar
- Tab bar
- Worktree overview row
- File group
- Diff viewer
- Commit panel
- History list
- Commit file list
- Create worktree dialog
- Remove worktree dialog
- Empty state
- Error boundary fallback

Required states:

- Default
- Hover
- Focus
- Active
- Selected
- Disabled
- Loading
- Empty
- Error
- Success
- Dirty
- Locked
- Destructive

## Interaction Rules

- Loading: show the command in progress without blocking unrelated read-only navigation when safe.
- Empty: no repository, no changes, no history, and no extra worktrees need distinct messages.
- Clean working tree: after commit, the changes view must show a clear clean state with a title and supporting text.
- Selectors: repository inventory lives in a filtered dropdown with internal scrolling.
- Worktrees: active repository worktrees stay visible in a filtered source list.
- Errors: Git command failures should show command intent and user-actionable copy, not raw stack traces.
- Crash safety: renderer exceptions fall back to a localized error boundary instead of an all-white window.
- Success: mutations refresh state and use subtle confirmation.
- Disabled: disabled commands need a visible reason through label, tooltip, or nearby status.
- Commit: until explicit staging controls exist, commit stages all current worktree changes before creating the commit.
- Network: fetch, pull, and push should distinguish network or remote failures from local repository errors when possible.

## Accessibility

- Target WCAG AA contrast for text and controls.
- All toolbar actions, list rows, tabs, dialogs, and confirmations must be keyboard reachable.
- Focus state must be visible.
- Buttons, tabs, dialogs, destructive actions, and status indicators need accessible labels.
- Hover cannot be the only way to discover an action.
- Nonessential animation should respect reduced-motion preferences.

## Content And Localization

- Product and developer documentation should be written in English.
- Renderer UI supports English and Korean.
- Terminology: repository, worktree, workspace, branch, changes, history, commit, fetch, pull, push, cherry-pick.
- Microcopy should be concise, technical, and calm.
- Destructive actions must name the target path, worktree, or branch.
- Avoid vague confirmations such as “Are you sure?” without target context.
- All renderer-facing copy, including aria labels, titles, placeholders, errors, and success messages, must be served through i18n keys.
- New UI copy requires English and Korean entries and key parity tests.

## Design Token System

Token categories:

- Color
- Typography
- Spacing
- Radius
- Elevation
- Z-index
- Motion duration and easing
- Layout dimensions

Rules:

- Use primitive tokens for raw scales and semantic tokens for product meaning.
- Components should consume semantic tokens whenever possible.
- Repeated pane widths, row heights, popover heights, badge radii, and grid proportions need semantic tokens.
- Do not repeat raw color, spacing, or radius values in component CSS.
- New component variants must document token behavior for default, hover, focus, active, disabled, and error states.
- Accessibility-sensitive color tokens must have documented contrast expectations.

## Technical Constraints

- Framework: Electron, React, TypeScript.
- Styling: renderer CSS plus shared design-token constants.
- Package manager: pnpm.
- Source of Git truth: local Git CLI.
- Renderer safety: no direct Node APIs.
- IPC safety: validate inputs in main process; unwrap outputs through shared renderer utilities.
- Performance: status and history refresh should avoid blocking renderer interaction longer than necessary.
- Verification: core Git parsing, IPC behavior, worktree safety, i18n, and renderer crash prevention need automated tests.

## Quality Bar

A change is not design-complete until:

- It works for the main local Git workflow.
- It has a clear empty, loading, success, and error state.
- It does not create unexplained blank space or a blank window.
- It uses design tokens for repeated visual values.
- It keeps English and Korean UI copy in sync.
- It remains usable with many repositories and many worktrees.
- It passes the relevant verification listed in `/Users/skyepodium/dev/dori/AGENTS.md`.

## Open Decisions

- Decide whether design tokens should be authored primarily as TypeScript constants, CSS custom properties, or both.
- Define the exact minimum supported Electron window size.
- Decide when explicit staging controls should replace the current commit-all behavior.
- Decide packaging and distribution targets.
