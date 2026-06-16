# Design

## Source of truth

- Status: Draft
- Last refreshed: 2026-06-17
- Primary product surfaces: Electron desktop app, repository/worktree dashboard, changes view, history view, worktree management dialogs.
- Evidence reviewed: `AGENTS.md`, `code-rule/README.md`, `code-rule/AGENTS.md`, `code-rule/rules/typescript/AGENTS.md`, `code-rule/rules/architecture/AGENTS.md`, initial product plan in chat.

## Brand

- Personality: quiet, precise, work-focused, developer-native.
- Trust signals: visible Git state, reversible actions, clear destructive warnings, no hidden automation.
- Avoid: marketing-style hero layouts, decorative gradients, oversized empty cards, novelty visuals that reduce scan speed.

## Product goals

- Goals: provide a GitHub Desktop-like Git GUI with first-class worktree creation, switching, and removal.
- Non-goals: pull request management, merge conflict editor, stash/rebase/cherry-pick UI, hosted Git provider API integration for v1.
- Success signals: users can open a repository, see all worktrees, switch workspaces, inspect changes/history, commit, fetch, pull, push, and safely manage worktrees.

## Personas and jobs

- Primary personas: developers who keep multiple branches or tasks active at the same time.
- User jobs: switch between isolated workspaces, create a task branch without disrupting current work, verify dirty state before destructive actions.
- Key contexts of use: local development on desktop, frequent branch switching, parallel feature or bugfix work.

## Information architecture

- Primary navigation: repository selector, worktree/workspace selector, changes tab, history tab, worktree manager.
- Core routes/screens: main repository view, changes view, history view, create worktree dialog, remove worktree confirmation, empty/no-repository state.
- Content hierarchy: current repository and worktree first, then sync state, then changes/history details.

## Design principles

- Worktree is a workspace: expose it as a primary navigation object, not as a hidden branch sub-action.
- State before action: show dirty state, branch, ahead/behind, and lock status before commands that mutate Git state.
- Dense but calm: favor compact developer tooling layouts over editorial or marketing composition.
- Tradeoffs: prioritize reliable local Git workflows over provider-specific collaboration features in v1.

## Visual language

- Color: neutral app chrome with semantic status colors for success, warning, danger, focus, and selected workspace.
- Typography: system UI font stack, compact labels, clear hierarchy between workspace title, section headings, and file rows.
- Spacing/layout rhythm: tokenized spacing with tighter density for lists and enough separation for destructive actions.
- Shape/radius/elevation: restrained radius, shallow elevation only for dialogs and menus.
- Motion: minimal, fast transitions only where they clarify state changes.
- Imagery/iconography: use icons for Git actions and status where they improve scanning; avoid decorative illustration in core workflows.

## Components

- Existing components to reuse: none yet.
- New/changed components: repository picker, worktree selector, status summary, changes list, history list, command toolbar, worktree dialogs.
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
- Error: Git command failures should show command intent and user-actionable message, not raw stack traces.
- Success: successful mutations should refresh state and use subtle confirmation.
- Disabled: disabled commands need visible reason through label, tooltip, or nearby status text.
- Offline/slow network: fetch, pull, and push should surface network failures separately from local Git errors.

## Content voice

- Tone: concise, technical, calm.
- Terminology: use repository, worktree, workspace, branch, changes, history, commit, fetch, pull, push consistently.
- Microcopy rules: destructive actions name the exact target path or branch; avoid vague confirmations like “Are you sure?” alone.

## Implementation constraints

- Framework/styling system: Electron, React, TypeScript, renderer CSS.
- Design-token constraints: primitive and semantic tokens must be defined before broad UI styling; components should not repeat raw visual values.
- Performance constraints: repository status and history refresh should avoid blocking the renderer.
- Compatibility constraints: Git CLI is the source of truth for repository state.
- Test/screenshot expectations: core Git parsing and safety behavior need automated tests; UI layout changes should be smoke-tested in the Electron window when practical.

## Open questions

- [ ] Decide whether design tokens live primarily as TypeScript constants, CSS custom properties, or both / owner: design implementer / impact: styling architecture.
- [ ] Decide final icon library before building the toolbar / owner: frontend implementer / impact: bundle and visual consistency.
- [ ] Define exact minimum supported window width / owner: product/design / impact: responsive behavior.
