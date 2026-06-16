# Git Worktree Desktop Client - Agent Contract

This file governs every file under `/Users/skyepodium/dev/dori`. It combines the project-specific rules with the relevant parts of the shared `code-rule` repository for an Electron, React, and TypeScript desktop application.

## Priority

Follow instructions in this order:

1. The closest `AGENTS.md` to the file being changed
2. `/Users/skyepodium/dev/dori/AGENTS.md`
3. `/Users/skyepodium/dev/dori/DESIGN.md`
4. Explicit user or task instructions
5. General engineering convention

When rules conflict, the narrower scoped `AGENTS.md` wins. When changing a rule, update the affected code, tests, configuration, and documentation in the same change when practical.

## Operating Principles

- Keep changes scoped, reviewable, and reversible.
- Do not mix unrelated cleanup into feature or bugfix work.
- Prefer existing platform APIs, local utilities, and established patterns before adding dependencies.
- Add new dependencies only when the existing stack cannot reasonably solve the problem.
- Verify behavior with tests or explicit manual validation before reporting completion.
- Use `pnpm` for all package and script operations.
- Before UI, UX, information architecture, or design-system changes, read `/Users/skyepodium/dev/dori/DESIGN.md` and update it when the product decision changes.
- Before completion, run the relevant checks. Default verification is `pnpm test`, `pnpm typecheck`, and `pnpm build` for UI, Electron, or bundle changes.

## Product Naming And Language

- Write repository documentation, developer-facing rules, identifiers, filenames, types, functions, comments, and PR/issue text in English.
- Renderer UI copy is localized through `/Users/skyepodium/dev/dori/src/renderer/src/i18n.ts`. English and Korean are first-class UI languages.
- Do not embed mutable product names, app names, or repository names in variable names, type names, global APIs, IPC channels, storage keys, CSS classes, or file boundaries.
- Avoid names such as `dori`, `DoriGitApi`, or `window.dori`. Prefer stable role names such as `gitClient`, `GitClientApi`, `repositoryWorkspace`, `worktree`, `history`, and `syncAction`.
- Abstract volatile domain terms upward. The product may be renamed; concepts like repository, worktree, branch, commit, and Git client are stable.
- Avoid unnecessary abbreviations. Use `configuration` instead of `cfg`.
- Use `PascalCase` for classes, types, and React components.
- Use `camelCase` for functions, methods, variables, and parameters.
- Use `SCREAMING_SNAKE_CASE` for global immutable constants. Include units when relevant, such as `_PX`, `_MS`, `_RATIO`, `_COUNT`, and `_BYTES`.
- Use `camelCase.ts` for ordinary TypeScript files and `PascalCase.tsx` for React component files.

## TypeScript Rules

- Do not use `any`. Treat external input as `unknown`, then narrow or validate it.
- Public exported functions and React component props must have explicit types.
- Do not use non-null assertions. Use guard clauses, early returns, and explicit branches.
- Use `as` assertions only as a last resort, and only when safety is clear from surrounding code.
- Prefer `const functionName = (...) => {}` arrow function expressions over function declarations.
- Define React components as `const ComponentName = (props: Props) => {}` and export them at the bottom of the file.
- Treat `catch` values as `unknown` and narrow with `instanceof Error` or explicit guards.
- Do not leave empty `catch` blocks. Recover, log, or rethrow explicitly.

## Architecture Boundaries

- Entry points should handle bootstrap and wiring only.
- Do not place detailed business logic in `/Users/skyepodium/dev/dori/src/main/index.ts`, `/Users/skyepodium/dev/dori/src/preload/index.ts`, `/Users/skyepodium/dev/dori/src/renderer/src/main.tsx`, or `/Users/skyepodium/dev/dori/src/renderer/src/App.tsx`.
- Electron main process owns Git, filesystem, and native bridge access through services or adapters.
- Renderer code owns screen composition, presentation state, and user input wiring.
- Hooks connect UI lifecycle with service calls.
- Pure calculations belong in pure utilities.
- Lower layers must not import UI, router, or framework entry modules.
- If circular dependencies appear, move shared types or pure utilities into a lower-level module.
- A file should have one clear responsibility. Review files over 600 LOC for component, hook, service, or utility extraction before adding more behavior.
- Do not introduce global mutable singletons. If process-wide state is required, keep it behind a service lifecycle with reset and cleanup APIs.

## Electron And IPC Boundaries

- Renderer code must not directly use Node APIs such as `child_process`, `fs`, or `path`.
- Git commands run only in the Electron main process service layer.
- Preload exposes only a narrow, safe IPC API. Do not expose arbitrary command execution or broad privileged objects.
- Main process IPC handlers must validate or narrow input before converting it to domain types.
- Renderer code must not directly inspect IPC result structures. Use shared unwrap/validation utilities such as `/Users/skyepodium/dev/dori/src/renderer/src/ipcResult.ts`.
- Malformed IPC responses must become user-facing errors, not renderer crashes.
- Root renderer code must keep an error boundary. An exception must never leave the Electron window as a blank white screen.
- UI error messages should be actionable and user-readable, not raw stack traces.

## Constants And Magic Values

- Do not inline timeouts, intervals, animation durations, sizes, retry counts, storage keys, IPC channels, route paths, or event names at call sites.
- Keep constants under `/Users/skyepodium/dev/dori/src/shared/constants/<domain>.ts` when shared across processes.
- If three or more constants are strongly related, group them by feature and freeze them with `Object.freeze` or `as const`.
- Keep test fixture values as named constants inside the test file.
- Inline `0`, `1`, and `-1` only when they are idiomatic language values.

## React, UI, And Styling

- `/Users/skyepodium/dev/dori/DESIGN.md` is the source of truth for product, UX, and design-system decisions.
- Keep components small. Move business logic into hooks, services, and pure utilities.
- If `/Users/skyepodium/dev/dori/src/renderer/src/App.tsx` or another composition file is over 600 LOC, review extraction options before adding UI behavior.
- Introduce a class-name composition utility before complex conditional `className` logic becomes widespread.
- Static class strings are acceptable inline.
- Use responsive constraints so text does not overflow buttons, panels, list rows, tabs, or cards.
- Do not nest cards inside cards. Use card treatment only for repeated items, dialogs, and tool panels that need framing.
- All renderer user-facing strings, including JSX text, aria labels, titles, placeholders, errors, and success messages, must use translation keys from `/Users/skyepodium/dev/dori/src/renderer/src/i18n.ts`.
- When adding or changing copy, keep English and Korean key parity covered by tests.
- Repository selection uses a dropdown with filtering and internal scrolling for large local inventories.
- Worktree selection uses an always-visible source list because switching workspaces is a core workflow.
- Do not hide worktrees behind a dropdown unless the dropdown is secondary to an always-visible primary worktree navigation.
- Read-only refresh, worktree switching, and detail loading must preserve the existing screen structure. Avoid broad loading banners, text swaps, or global disabled states unless a mutation or destructive command is actively running.

## Design Token System

- Manage color, typography, spacing, radius, elevation, z-index, motion duration, and motion easing with design tokens.
- Document token meaning and usage in `/Users/skyepodium/dev/dori/DESIGN.md`.
- Implement token values in `/Users/skyepodium/dev/dori/src/shared/constants/` or renderer style token files.
- Do not repeat raw color, spacing, or radius values inside components. Reuse an existing token or add a token first.
- Promote repeated layout dimensions, list row heights, popover heights, pane widths, and badge radii to semantic tokens.
- Name tokens by purpose. Examples: `COLOR_SURFACE_PANEL`, `SPACE_STACK_GAP_PX`, `RADIUS_CONTROL_PX`.
- Separate primitive tokens from semantic tokens. Component call sites should prefer semantic tokens.
- New component variants must define token behavior for default, hover, focus, active, disabled, and error states.
- If a color token affects accessibility, document contrast expectations in `/Users/skyepodium/dev/dori/DESIGN.md`.

## Path Rules

- In documentation, work reports, verification logs, and user-facing file references, use absolute paths such as `/Users/skyepodium/dev/dori/...`.
- Run shell commands with `/Users/skyepodium/dev/dori` as the working directory. Prefer absolute file arguments when targeting specific files.
- Runtime filesystem paths must not depend on the current working directory. Electron main/preload code should build absolute paths from `__dirname`, `import.meta.url`, `app.getPath`, or explicit user-selected paths.
- TypeScript and JavaScript imports must not use `/Users/...` filesystem absolute paths. Relative imports are acceptable for nearby modules. If deep `../../..` imports repeat, add a project alias first and then use alias-based imports.
- Storage keys, IPC channels, routes, and CSS classes must not include filesystem paths or mutable app names.

## Package Management

- This project uses `pnpm` and `pnpm-lock.yaml`.
- Do not use `npm install`, `npm run`, `npx`, `yarn`, or `bun install` for project work.
- Do not create `package-lock.json`, `yarn.lock`, or `bun.lockb`.
- Add runtime dependencies with `pnpm add <package>`.
- Add development dependencies with `pnpm add -D <package>`.
- Use `pnpm exec <command>` or `pnpm dlx <package>` for one-off commands.
- Script names should stay conventional: `test`, `typecheck`, `build`, and when added, `lint` and `format`.
- Avoid OS-specific shell behavior in scripts.
- Packages imported by runtime code belong in `dependencies`; build, test, and type-only packages belong in `devDependencies`.

## Testing And Verification

- Add unit tests first for regression-prone logic such as Git parsing, worktree safety, IPC boundaries, and renderer crash prevention.
- Inject runners or adapters in tests instead of executing external Git commands directly.
- Integration tests that create real repositories must use temporary directories and clean up afterward.
- Default verification order before completion:
  1. `pnpm test`
  2. `pnpm typecheck`
  3. `pnpm build` when UI, Electron, preload, renderer, or bundle behavior changed
  4. `git diff --check`

## Excluded Shared Rules

- Next.js-specific rules do not apply because this is an Electron application.
- A hard `classnames` dependency is not required yet. The current rule is to use conditional class composition consistently once a helper is introduced.
