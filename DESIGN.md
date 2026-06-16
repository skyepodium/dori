# Design

## Source of truth

- Status: Draft
- Last refreshed: 2026-06-17
- Primary product surfaces: Electron desktop app, repository/worktree dashboard, source-list worktree navigation, changes view, history view, worktree management dialogs.
- Evidence reviewed: `/Users/skyepodium/dev/dori/AGENTS.md`, code-rule repository common rules, code-rule TypeScript rules, code-rule architecture rules, initial product plan in chat.

## Brand

- Personality: quiet, precise, work-focused, developer-native.
- Trust signals: visible Git state, reversible actions, clear destructive warnings, no hidden automation.
- Avoid: marketing-style hero layouts, decorative gradients, oversized empty cards, novelty visuals that reduce scan speed.

## Product goals

- Goals: provide a GitHub Desktop-like Git GUI with first-class worktree creation, switching, and removal.
- Non-goals: pull request management, merge conflict editor, stash/rebase UI, hosted Git provider API integration for v1.
- Success signals: users can open a repository, see all worktrees, switch workspaces, inspect changes/history, commit, fetch, pull, push, and safely manage worktrees.

## Personas and jobs

- Primary personas: developers who keep multiple branches or tasks active at the same time.
- User jobs: switch between isolated workspaces, create a task branch without disrupting current work, verify dirty state before destructive actions.
- Key contexts of use: local development on desktop, frequent branch switching, parallel feature or bugfix work.

## Information architecture

- Primary navigation: dropdown repository selector, always-visible worktree source list, changes tab, history tab, worktree manager.
- Core routes/screens: main repository view, changes view, history view, create worktree dialog, remove worktree confirmation, empty/no-repository state.
- Content hierarchy: current repository and worktree first, then sync state, then changes/history details.

## Design principles

- Worktree is a workspace: expose it as a primary navigation object, not as a hidden branch sub-action.
- Worktree switching is a frequent action: keep worktrees visible as a searchable source list; use dropdowns for repository inventory, not for the active worktree list.
- State before action: show dirty state, branch, ahead/behind, and lock status before commands that mutate Git state.
- Dense but calm: favor compact developer tooling layouts over editorial or marketing composition.
- Tradeoffs: prioritize reliable local Git workflows over provider-specific collaboration features in v1.

## Visual language

- Color: neutral macOS-like app chrome with semantic status colors for success, warning, danger, focus, and selected workspace.
- Typography: Apple/system UI font stack for app chrome; monospaced text is reserved for diff, SHA, and code-like content.
- Spacing/layout rhythm: tokenized spacing with tighter density for lists and enough separation for destructive actions.
- Shape/radius/elevation: restrained radius, hairline borders, selected row tint, focus rings, and shallow popover/dialog elevation only. Avoid decorative gradients and heavy shadows.
- Motion: minimal, fast transitions only where they clarify state changes.
- Imagery/iconography: use icons for Git actions and status where they improve scanning; avoid decorative illustration in core workflows.

## Components

- Existing components to reuse: none yet.
- New/changed components: repository picker dropdown, worktree source list, language switcher, status summary, changes list, working-copy commit panel, history list, command toolbar, worktree dialogs.
- Variants and states: default, hover, focus, active, disabled, loading, empty, error, dirty, locked, destructive.
- Token/component ownership: shared design tokens define values; components consume semantic tokens rather than raw values.

## Accessibility

- Target standard: keyboard navigable desktop app with WCAG AA contrast for text and controls.
- Keyboard/focus behavior: all toolbar actions, list rows, tabs, dialogs, and confirmations must be reachable and visibly focused.
- Contrast/readability: semantic status colors need text/icon contrast checks before adoption.
- Screen-reader semantics: buttons, tabs, dialogs, and destructive confirmations need accessible labels.
- Reduced motion and sensory considerations: nonessential animation should respect reduced-motion preferences.

## Responsive behavior

- Supported breakpoints/devices: desktop-first Electron window, usable down to a narrow laptop split-view width.
- Layout adaptations: side panels can collapse or reduce density before content overlaps.
- Touch/hover differences: hover can enhance desktop scanability but cannot be the only way to discover actions.

## Interaction states

- Loading: show repository/worktree command in progress without blocking unrelated read-only navigation when safe.
- Empty: no repository, no changes, no history, and no extra worktrees each need distinct empty states.
- Empty states must never read as a blank white canvas after an operation. After commit, the changes view shows a clear clean-working-tree state with title and supporting copy.
- Selectors: repository inventory lives inside a filtered dropdown menu with internal scrolling so large local inventories do not stretch the sidebar.
- Worktrees: active repository worktrees stay visible in a filtered source list because branch/workspace switching is the core workflow.
- Error: Git command failures should show command intent and user-actionable message, not raw stack traces.
- Crash safety: renderer exceptions should fall back to a localized error boundary instead of an all-white window.
- Success: successful mutations should refresh state and use subtle confirmation.
- Disabled: disabled commands need visible reason through label, tooltip, or nearby status text.
- Commit: changes view keeps summary, description, and commit action adjacent to the changed-file list; until explicit staging controls exist, the commit action stages all current worktree changes before creating the commit.
- Offline/slow network: fetch, pull, and push should surface network failures separately from local Git errors.

## Content voice

- Tone: concise, technical, calm.
- Terminology: use repository, worktree, workspace, branch, changes, history, commit, fetch, pull, push consistently.
- Microcopy rules: destructive actions name the exact target path or branch; avoid vague confirmations like “Are you sure?” alone.
- Localization: all renderer user-facing copy, including aria labels, titles, placeholders, errors, and success messages, must be served through i18n keys. English and Korean are required first-class locales.

## Implementation constraints

- Framework/styling system: Electron, React, TypeScript, renderer CSS.
- Design-token constraints: primitive and semantic tokens must be defined before broad UI styling; components should not repeat raw visual values.
- Layout-token constraints: repeated pane widths, list row heights, popover max heights, badge radius, and common grid proportions need semantic tokens rather than scattered px/% values.
- Performance constraints: repository status and history refresh should avoid blocking the renderer.
- Compatibility constraints: Git CLI is the source of truth for repository state.
- Test/screenshot expectations: core Git parsing and safety behavior need automated tests; UI layout changes should be smoke-tested in the Electron window when practical.

## Open questions

- [ ] Decide whether design tokens live primarily as TypeScript constants, CSS custom properties, or both / owner: design implementer / impact: styling architecture.
- [ ] Define exact minimum supported window width / owner: product/design / impact: responsive behavior.
