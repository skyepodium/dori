# Git Worktree Client - 코딩 규칙과 작업 계약

이 문서는 `/Users/skyepodium/dev/dori` 아래의 모든 파일에 적용되는 기본 규칙이다. `code-rule` 저장소의 공통, TypeScript, architecture, constants, ESLint 규칙 중 현재 Electron/React/TypeScript 앱에 맞는 항목만 선별했다.

## 우선순위

1. 현재 파일에서 가장 가까운 `AGENTS.md`
2. `/Users/skyepodium/dev/dori/AGENTS.md`
3. `/Users/skyepodium/dev/dori/DESIGN.md`
4. 사용자 또는 작업별 명시 지시
5. 일반 관행

충돌하면 더 좁은 범위의 `AGENTS.md`를 따른다. 규칙을 바꿀 때는 관련 코드, 설정, 문서도 함께 맞춘다.

## 작업 원칙

- 작업 범위와 무관한 cleanup은 섞지 않는다.
- 규칙 위반을 발견해도 현재 변경 범위에서 안전하게 고칠 수 있을 때만 함께 고친다.
- 새 의존성은 기존 코드나 플랫폼 API로 해결하기 어려울 때만 추가한다.
- 기능 변경은 가능한 한 작은 단위로 구현하고, 변경한 동작은 테스트나 명확한 수동 검증으로 확인한다.
- UI, UX, 정보 구조, 디자인 시스템 변경 전에는 `/Users/skyepodium/dev/dori/DESIGN.md`를 확인하고 필요한 결정은 먼저 갱신한다.
- 완료 보고 전 `pnpm typecheck`, `pnpm test`, 필요한 경우 `pnpm build`를 실행하고 결과를 확인한다.

## 언어와 이름

- 사용자-facing 설명, 주석, PR/이슈 본문은 한국어로 작성한다.
- 식별자, 파일명, 타입명, 함수명은 영어로 작성한다.
- 제품명, 앱 이름, 저장소 이름처럼 변경될 수 있는 고유명은 변수명, 타입명, 전역 API 이름, IPC 이름, storage key, CSS class 이름에 넣지 않는다. 예: `dori`, `DoriGitApi`, `window.dori`처럼 현재 이름에 묶이는 식별자는 금지하고, `gitClient`, `GitClientApi`, `repositoryWorkspace`처럼 역할과 책임을 드러내는 이름을 사용한다.
- 변경 가능성이 큰 도메인 단어는 상위 개념으로 추상화한다. 기능이 Git 저장소 관리라면 앱 이름이 아니라 `repository`, `worktree`, `history`, `gitClient` 같은 안정적인 역할 이름을 우선한다.
- 불필요한 약어를 피한다. 예: `cfg` 대신 `configuration`.
- 클래스, 타입, React 컴포넌트는 `PascalCase`를 사용한다.
- 함수, 메서드, 변수, 매개변수는 `camelCase`를 사용한다.
- 전역 불변 상수는 `SCREAMING_SNAKE_CASE`를 사용하고 단위가 있으면 `_PX`, `_MS`, `_RATIO`, `_COUNT`, `_BYTES`처럼 이름에 포함한다.
- 일반 TypeScript 파일은 `camelCase.ts`, React 컴포넌트 파일은 `PascalCase.tsx`를 사용한다.

## TypeScript 규칙

- `any`는 금지한다. 외부 입력은 `unknown`으로 받고 narrowing 또는 schema 검증 후 사용한다.
- public export 함수와 React 컴포넌트 props는 타입을 명시한다.
- non-null assertion인 `!`는 금지한다. guard clause, early return, 명시적 분기로 좁힌다.
- `as` 단언은 마지막 수단으로만 사용하고, 코드 구조상 안전성이 드러나야 한다.
- 함수 선언문 대신 `const functionName = (...) => {}` 형태의 화살표 함수 표현식을 사용한다.
- React 컴포넌트도 `const ComponentName = (props: Props) => {}` 형태로 작성하고 export는 하단에 둔다.
- catch 값은 `unknown`으로 취급하고 `instanceof Error` 또는 명시적 guard 후 사용한다.
- 빈 `catch`는 금지한다. 복구, 로깅, 재throw 중 하나를 명확히 한다.

## 구조와 책임 경계

- 엔트리 포인트는 bootstrap과 wiring만 담당한다.
- `/Users/skyepodium/dev/dori/src/main/index.ts`, `/Users/skyepodium/dev/dori/src/preload/index.ts`, `/Users/skyepodium/dev/dori/src/renderer/src/main.tsx`, `/Users/skyepodium/dev/dori/src/renderer/src/App.tsx`에 세부 비즈니스 로직을 직접 넣지 않는다.
- Electron main process의 Git, 파일 시스템, native bridge 접근은 service 또는 adapter 경계에 둔다.
- renderer UI는 화면 조립, 표시 상태, 사용자 입력 연결에 집중한다.
- hook은 UI 생명주기와 service 호출을 연결한다.
- side effect 없는 계산은 pure utility로 분리한다.
- 하위 레이어가 UI, router, framework entry를 import하지 않는다.
- 순환 의존성이 생기면 공통 타입이나 순수 유틸을 더 낮은 레이어로 분리한다.
- 한 파일은 한 가지 역할만 가진다. 600 LOC를 넘으면 분할을 검토한다.
- 전역 mutable singleton은 새로 만들지 않는다. 프로세스 단위 상태가 필요하면 service 경계에 lifecycle, reset, cleanup API를 둔다.

## Electron 경계

- renderer에서 `child_process`, `fs`, `path` 같은 Node API를 직접 사용하지 않는다.
- Git 명령 실행은 Electron main process의 service에서만 수행한다.
- preload는 안전한 IPC API만 노출하고, 임의 명령 실행이나 넓은 권한 객체를 노출하지 않는다.
- IPC 입력은 main process에서 검증하거나 narrowing한 뒤 도메인 타입으로 변환한다.
- UI에 표시할 에러 메시지는 raw stack 대신 사용자가 이해할 수 있는 메시지로 정리한다.

## 상수와 매직 값

- timeout, interval, animation duration, size, retry count, storage key, IPC channel, route path, event name은 호출부에 직접 쓰지 않는다.
- 상수는 도메인별로 `/Users/skyepodium/dev/dori/src/shared/constants/<domain>.ts`에 둔다.
- 서로 강하게 관련된 상수가 3개 이상이면 기능 단위 객체로 묶고 `Object.freeze` 또는 `as const`로 불변 처리한다.
- 테스트 fixture 값은 테스트 파일 안의 named constant로 둔다.
- 언어 관용에 가까운 `0`, `1`, `-1`은 제한적으로 인라인 허용한다.

## React와 스타일

- `/Users/skyepodium/dev/dori/DESIGN.md`는 제품/UX/디자인 시스템의 source of truth이다. UI 변경은 관련 섹션을 근거로 삼고, 새로운 결정이 생기면 문서를 함께 갱신한다.
- 컴포넌트는 작게 유지하고, 비즈니스 로직은 hook, service, pure utility로 분리한다.
- `/Users/skyepodium/dev/dori/src/renderer/src/App.tsx`처럼 화면 조립 파일이 600 LOC를 넘으면 새 UI 변경 전 컴포넌트, hook, i18n, utility 분리를 먼저 검토한다. 새 기능을 큰 파일에 더 쌓는 것을 기본값으로 삼지 않는다.
- 조건부 `className` 조합이 필요하면 프로젝트에 class 조합 유틸을 도입한 뒤 일관되게 사용한다.
- 정적 class 문자열은 인라인 허용한다.
- UI 텍스트가 버튼, 패널, 리스트 항목에서 넘치지 않도록 responsive constraint를 둔다.
- 카드 안에 카드를 중첩하지 않는다. 반복 항목, 모달, 도구 패널처럼 실제로 프레임이 필요한 곳에만 card 패턴을 사용한다.
- renderer의 사용자-facing 텍스트는 `/Users/skyepodium/dev/dori/src/renderer/src/i18n.ts`의 translation key로 관리한다. JSX, aria-label, title, placeholder, error/success message에 한국어 또는 영어 문장을 직접 넣지 않는다.
- 언어 추가나 문구 변경 시 모든 지원 언어의 key parity를 테스트로 확인한다.
- IPC 응답은 renderer에서 직접 구조 접근하지 않고 `/Users/skyepodium/dev/dori/src/renderer/src/ipcResult.ts` 같은 공통 unwrap/validation 유틸을 통해 처리한다. 비정상 응답도 화면을 죽이지 않고 사용자-facing 오류로 바뀌어야 한다.
- root renderer는 error boundary를 유지한다. 예외가 발생해도 Electron 창 전체가 흰 화면이 되면 안 된다.
- 저장소 선택은 많은 항목을 고려해 dropdown/filter 패턴을 쓰고, worktree 선택은 빠른 전환을 위해 source-list 패턴을 우선한다. worktree를 숨기는 UI는 명확한 보조 목적일 때만 사용한다.

## 디자인 토큰 시스템

- 색상, 타이포그래피, spacing, radius, elevation, z-index, motion duration/easing은 디자인 토큰으로 관리한다.
- 토큰의 의미와 사용 기준은 `/Users/skyepodium/dev/dori/DESIGN.md`에 기록하고, 구현 값은 `/Users/skyepodium/dev/dori/src/shared/constants/` 또는 renderer style token 파일에 둔다.
- 컴포넌트에서 raw color, raw spacing, raw radius 값을 반복하지 않는다. 기존 토큰을 재사용하거나 먼저 토큰을 추가한다.
- 반복되는 layout 치수, 목록 row 높이, popover 높이, pane width, badge radius는 raw px/%로 두지 말고 semantic token으로 승격한다.
- 토큰 이름은 용도 중심으로 짓는다. 예: `COLOR_SURFACE_PANEL`, `SPACE_STACK_GAP_PX`, `RADIUS_CONTROL_PX`.
- primitive token과 semantic token을 구분한다. 호출부는 가능한 semantic token을 사용한다.
- 새 컴포넌트 variant를 만들면 상태별 토큰 사용 기준을 함께 정한다. 최소 상태는 default, hover, focus, active, disabled, error이다.
- 접근성에 영향을 주는 색상 토큰은 대비 기준을 `/Users/skyepodium/dev/dori/DESIGN.md`에 남기고, 임의로 밝기만 바꾼 색을 추가하지 않는다.

## 경로 사용

- 문서, 작업 보고, 검증 로그, 사용자에게 전달하는 파일 위치는 저장소 루트 기준 상대경로가 아니라 `/Users/skyepodium/dev/dori/...` 형태의 절대경로로 쓴다.
- 쉘 명령은 `/Users/skyepodium/dev/dori`를 작업 디렉터리로 지정해서 실행하고, 명령 인자에서 파일을 특정해야 하면 절대경로를 우선한다.
- 런타임 파일 시스템 경로는 현재 작업 디렉터리에 의존하지 않는다. Electron main/preload처럼 번들 산출물을 찾아야 하는 코드는 `__dirname`, `import.meta.url`, `app.getPath`, 사용자 선택 경로처럼 명확한 기준점에서 `join` 또는 `resolve`로 만든 절대경로를 사용한다.
- TypeScript/JavaScript import에는 `/Users/...` 파일 시스템 절대경로를 직접 쓰지 않는다. 번들러와 테스트 이식성을 위해 같은 디렉터리 또는 가까운 하위 모듈은 상대 import를 허용하되, 깊은 `../../..` import가 반복되면 먼저 alias 설정을 추가하고 alias 기반 절대 import로 전환한다.
- storage key, IPC channel, route, CSS class 이름에는 파일 경로나 앱 이름을 섞지 않는다. 경로가 값으로 필요하면 상수로 분리한다.

## 패키지와 도구

- 현재 프로젝트는 pnpm 기반이다. `pnpm-lock.yaml`을 lockfile로 사용한다.
- `npm install`, `npm run`, `npx`, `yarn`, `bun install`을 새 작업에 사용하지 않는다.
- `package-lock.json`, `yarn.lock`, `bun.lockb`를 만들지 않는다.
- 의존성 추가는 `pnpm add <package>`, 개발 의존성 추가는 `pnpm add -D <package>`를 사용한다.
- 일회성 실행은 `pnpm exec <command>` 또는 `pnpm dlx <package>`를 사용한다.
- script 이름은 `test`, `typecheck`, `build`, 필요한 경우 `lint`, `format`을 사용한다.
- script 안에서 OS별 shell 기능에 과하게 의존하지 않는다.
- 런타임 코드에서 import되는 패키지는 `dependencies`, 빌드/테스트/타입 전용 패키지는 `devDependencies`에 둔다.

## 테스트와 검증

- Git 명령 parsing, worktree safety, IPC boundary처럼 회귀 위험이 있는 로직은 단위 테스트를 먼저 둔다.
- 외부 Git CLI 실행은 테스트에서 runner나 adapter를 주입해 검증한다.
- 실제 repository를 만드는 통합 테스트는 임시 디렉토리를 사용하고 테스트 종료 후 정리한다.
- 완료 전 기본 검증 순서:
  1. `pnpm test`
  2. `pnpm typecheck`
  3. UI나 번들 변경 시 `pnpm build`

## 제외된 code-rule 규칙

- Next.js 규칙은 이 프로젝트가 Electron 앱이므로 적용하지 않는다.
- `classnames` 강제 규칙은 해당 의존성을 아직 도입하지 않았으므로 “조건부 class 조합 유틸을 일관되게 사용”하는 규칙으로 완화한다.
