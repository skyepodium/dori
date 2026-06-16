import { useCallback, useMemo, useState, type ReactElement } from 'react';
import type { DoriGitApi, DoriIpcResult } from '../../shared/constants/ipc';
import type { GitCommit, GitFileChange, GitStatus, Worktree } from '../../shared/types';

type ActiveTab = 'changes' | 'history';
type DialogMode = 'create' | 'remove' | null;
type OperationName = 'open' | 'refresh' | 'fetch' | 'pull' | 'push' | 'createWorktree' | 'removeWorktree';

type RepositoryViewState = {
  repositoryPath: string;
  worktrees: Worktree[];
  selectedWorktreePath: string;
  status: GitStatus | null;
  history: GitCommit[];
};

type AppState = RepositoryViewState & {
  activeTab: ActiveTab;
  dialogMode: DialogMode;
  isLoading: boolean;
  operation: OperationName | null;
  errorMessage: string | null;
  successMessage: string | null;
  createBranchName: string;
  createWorktreePath: string;
  createBaseRef: string;
  removeForce: boolean;
};

const EMPTY_STATUS: GitStatus = {
  currentBranch: '',
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  untracked: [],
  conflicts: []
};

const INITIAL_STATE: AppState = {
  repositoryPath: '',
  worktrees: [],
  selectedWorktreePath: '',
  status: null,
  history: [],
  activeTab: 'changes',
  dialogMode: null,
  isLoading: false,
  operation: null,
  errorMessage: null,
  successMessage: null,
  createBranchName: '',
  createWorktreePath: '',
  createBaseRef: 'main',
  removeForce: false
};

const HISTORY_LIMIT_COUNT = 50;
const SHORT_PATH_SEGMENT_COUNT = 2;
const OPERATION_LABELS: Record<OperationName, string> = {
  open: '저장소 열기',
  refresh: '상태 새로고침',
  fetch: 'Fetch',
  pull: 'Pull',
  push: 'Push',
  createWorktree: 'Worktree 생성',
  removeWorktree: 'Worktree 삭제'
};

const getGitApi = (): DoriGitApi | null => {
  return window.dori?.git ?? null;
};

const unwrapIpcResult = async <T,>(resultPromise: Promise<DoriIpcResult<T>>): Promise<T> => {
  const result = await resultPromise;

  if (result.ok) {
    return result.data;
  }

  throw new Error(result.error.message);
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return 'Git 명령에 실패했습니다. 저장소 경로를 확인한 뒤 다시 시도하세요.';
};

const getStatusFileCount = (status: GitStatus | null): number => {
  if (status === null) {
    return 0;
  }

  return status.staged.length + status.unstaged.length + status.untracked.length + status.conflicts.length;
};

const getShortPath = (path: string): string => {
  const segments = path.split('/').filter(Boolean);

  if (segments.length <= SHORT_PATH_SEGMENT_COUNT) {
    return path;
  }

  return `.../${segments.slice(-SHORT_PATH_SEGMENT_COUNT).join('/')}`;
};

const getSelectedWorktree = (worktrees: Worktree[], selectedWorktreePath: string): Worktree | null => {
  return worktrees.find((worktree) => worktree.path === selectedWorktreePath) ?? null;
};

const readWorktreeDetails = async (
  gitApi: DoriGitApi,
  worktreePath: string
): Promise<Pick<RepositoryViewState, 'status' | 'history'>> => {
  if (worktreePath.trim().length === 0) {
    return {
      status: null,
      history: []
    };
  }

  const [status, history] = await Promise.all([
    unwrapIpcResult(gitApi.getStatus(worktreePath)),
    unwrapIpcResult(gitApi.getHistory(worktreePath, HISTORY_LIMIT_COUNT))
  ]);

  return { status, history };
};

const readRepository = async (
  repositoryPath: string,
  fallbackSelectedPath: string
): Promise<RepositoryViewState> => {
  const gitApi = getGitApi();

  if (gitApi === null) {
    throw new Error('Preload Git API가 아직 준비되지 않았습니다.');
  }

  const repository = await unwrapIpcResult(gitApi.openRepository(repositoryPath));
  const worktrees = await unwrapIpcResult(gitApi.listWorktrees(repository.path));
  const fallbackExists = worktrees.some((worktree) => worktree.path === fallbackSelectedPath);
  const selectedWorktreePath =
    (fallbackExists ? fallbackSelectedPath : '') ||
    worktrees.find((worktree) => worktree.isMainWorktree)?.path ||
    worktrees[0]?.path ||
    '';
  const details = await readWorktreeDetails(gitApi, selectedWorktreePath);

  return {
    repositoryPath: repository.path,
    worktrees,
    selectedWorktreePath,
    ...details
  };
};

const StatusPill = ({
  label,
  tone
}: {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'locked';
}): ReactElement => {
  return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
};

const ToolbarButton = ({
  children,
  disabled,
  onClick,
  tone = 'default',
  title
}: {
  children: string;
  disabled: boolean;
  onClick: () => void;
  tone?: 'default' | 'danger';
  title: string;
}): ReactElement => {
  return (
    <button
      className={`toolbar-button toolbar-button--${tone}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
};

const FileGroup = ({
  files,
  title,
  tone
}: {
  files: GitFileChange[];
  title: string;
  tone: 'staged' | 'unstaged' | 'untracked' | 'conflicts';
}): ReactElement => {
  if (files.length === 0) {
    return (
      <section className="file-group">
        <header className="file-group__header">
          <span>{title}</span>
          <span className="file-group__count">0</span>
        </header>
        <div className="empty-inline">파일 없음</div>
      </section>
    );
  }

  return (
    <section className="file-group">
      <header className="file-group__header">
        <span>{title}</span>
        <span className="file-group__count">{files.length}</span>
      </header>
      <ul className="file-list">
        {files.map((file) => (
          <li className="file-row" key={`${tone}-${file.status}-${file.path}`}>
            <span className={`file-row__status file-row__status--${tone}`}>{file.status}</span>
            <span className="file-row__path">{file.path}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const App = (): ReactElement => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const gitApi = getGitApi();
  const selectedWorktree = useMemo(
    () => getSelectedWorktree(state.worktrees, state.selectedWorktreePath),
    [state.selectedWorktreePath, state.worktrees]
  );
  const status = state.status ?? EMPTY_STATUS;
  const hasRepository = state.repositoryPath.trim() !== '';
  const hasGitApi = gitApi !== null;
  const hasSelectedWorktree = selectedWorktree !== null;
  const dirtyFileCount = getStatusFileCount(state.status);
  const isDirty = dirtyFileCount > 0 || selectedWorktree?.hasChanges === true;
  const canRunRepositoryAction = hasGitApi && hasRepository && !state.isLoading;
  const canRunWorktreeAction = canRunRepositoryAction && hasSelectedWorktree;
  const createDisabled =
    !canRunRepositoryAction ||
    state.createBranchName.trim() === '' ||
    state.createWorktreePath.trim() === '' ||
    state.createBaseRef.trim() === '';
  const removeDisabled =
    !canRunWorktreeAction || selectedWorktree?.isMainWorktree === true || selectedWorktree?.isLocked === true;

  const setRepositoryPath = (repositoryPath: string): void => {
    setState((current) => ({
      ...current,
      repositoryPath,
      errorMessage: null,
      successMessage: null
    }));
  };

  const runOperation = useCallback(
    async (
      operation: OperationName,
      action: () => Promise<Partial<AppState>>,
      successMessage: string
    ): Promise<void> => {
      setState((current) => ({
        ...current,
        isLoading: true,
        operation,
        errorMessage: null,
        successMessage: null
      }));

      try {
        const updates = await action();
        setState((current) => ({
          ...current,
          ...updates,
          isLoading: false,
          operation: null,
          errorMessage: null,
          successMessage
        }));
      } catch (error: unknown) {
        setState((current) => ({
          ...current,
          isLoading: false,
          operation: null,
          errorMessage: getErrorMessage(error),
          successMessage: null
        }));
      }
    },
    []
  );

  const openRepository = (): void => {
    const repositoryPath = state.repositoryPath.trim();

    if (repositoryPath === '') {
      setState((current) => ({
        ...current,
        errorMessage: '저장소를 열기 전에 경로를 입력하세요.',
        successMessage: null
      }));
      return;
    }

    void runOperation('open', () => readRepository(repositoryPath, ''), '저장소를 열었습니다.');
  };

  const refreshRepository = (): void => {
    void runOperation(
      'refresh',
      () => readRepository(state.repositoryPath, state.selectedWorktreePath),
      '저장소 상태를 새로고침했습니다.'
    );
  };

  const runSyncAction = (operation: 'fetch' | 'pull' | 'push'): void => {
    void runOperation(
      operation,
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null) {
          throw new Error('Preload Git API가 아직 준비되지 않았습니다.');
        }

        if (operation === 'fetch') {
          await unwrapIpcResult(gitApiForOperation.fetch(state.repositoryPath));
        }

        if (operation === 'pull') {
          await unwrapIpcResult(gitApiForOperation.pull(state.selectedWorktreePath));
        }

        if (operation === 'push') {
          await unwrapIpcResult(gitApiForOperation.push(state.selectedWorktreePath));
        }

        return readRepository(state.repositoryPath, state.selectedWorktreePath);
      },
      `${OPERATION_LABELS[operation]} 완료.`
    );
  };

  const selectWorktree = (worktreePath: string): void => {
    void runOperation(
      'refresh',
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null) {
          throw new Error('Preload Git API가 아직 준비되지 않았습니다.');
        }

        const details = await readWorktreeDetails(gitApiForOperation, worktreePath);

        return {
          selectedWorktreePath: worktreePath,
          ...details
        };
      },
      '워크스페이스 정보를 새로고침했습니다.'
    );
  };

  const createWorktree = (): void => {
    void runOperation(
      'createWorktree',
      async () => {
        const gitApiForOperation = getGitApi();
        const createdPath = state.createWorktreePath.trim();

        if (gitApiForOperation === null) {
          throw new Error('Preload Git API가 아직 준비되지 않았습니다.');
        }

        await unwrapIpcResult(
          gitApiForOperation.createWorktree(
            state.repositoryPath,
            state.createBranchName.trim(),
            createdPath,
            state.createBaseRef.trim()
          )
        );

        return {
          ...(await readRepository(state.repositoryPath, createdPath)),
          dialogMode: null,
          createBranchName: '',
          createWorktreePath: ''
        };
      },
      'Worktree를 생성했습니다.'
    );
  };

  const removeWorktree = (): void => {
    const worktreePath = selectedWorktree?.path ?? '';

    void runOperation(
      'removeWorktree',
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null) {
          throw new Error('Preload Git API가 아직 준비되지 않았습니다.');
        }

        await unwrapIpcResult(
          gitApiForOperation.removeWorktree(state.repositoryPath, worktreePath, state.removeForce)
        );

        return {
          ...(await readRepository(state.repositoryPath, '')),
          dialogMode: null,
          removeForce: false
        };
      },
      'Worktree를 삭제했습니다.'
    );
  };

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="저장소와 worktree 탐색">
        <section className="repository-panel">
          <label className="field-label" htmlFor="repository-path">
            저장소 경로
          </label>
          <div className="path-row">
            <input
              autoComplete="off"
              className="text-input"
              disabled={state.isLoading}
              id="repository-path"
              onChange={(event) => setRepositoryPath(event.target.value)}
              placeholder="/Users/name/project"
              type="text"
              value={state.repositoryPath}
            />
            <button
              className="primary-button"
              disabled={!hasGitApi || state.isLoading}
              onClick={openRepository}
              title={hasGitApi ? '저장소 경로 열기' : 'Preload Git API 대기 중'}
              type="button"
            >
              열기
            </button>
          </div>

          {!hasGitApi ? <p className="hint-text">Git API를 준비하는 중입니다.</p> : null}
        </section>

        <section className="worktree-panel">
          <div className="section-title-row">
            <h2>워크스페이스</h2>
            <button
              className="compact-button"
              disabled={!canRunRepositoryAction}
              onClick={() =>
                setState((current) => ({
                  ...current,
                  dialogMode: 'create',
                  errorMessage: null,
                  successMessage: null
                }))
              }
              title="Worktree 생성"
              type="button"
            >
              새로 만들기
            </button>
          </div>

          {state.isLoading && state.operation === 'open' ? (
            <div className="empty-state">저장소 worktree를 불러오는 중...</div>
          ) : null}

          {!state.isLoading && hasRepository && state.worktrees.length === 0 ? (
            <div className="empty-state">이 저장소에서 worktree를 찾지 못했습니다.</div>
          ) : null}

          {!hasRepository ? (
            <div className="empty-state">워크스페이스를 보려면 저장소 경로를 여세요.</div>
          ) : null}

          {state.worktrees.length > 0 ? (
            <div aria-label="Worktree 선택" className="worktree-list" role="listbox">
              {state.worktrees.map((worktree) => {
                const isSelected = worktree.path === state.selectedWorktreePath;
                const tone = worktree.isLocked ? 'locked' : worktree.hasChanges ? 'warning' : 'neutral';

                return (
                  <button
                    aria-selected={isSelected}
                    className={`worktree-row${isSelected ? ' worktree-row--selected' : ''}`}
                    disabled={state.isLoading}
                    key={worktree.id}
                    onClick={() => selectWorktree(worktree.path)}
                    role="option"
                    type="button"
                  >
                    <span className="worktree-row__main">
                      <span className="worktree-row__branch">{worktree.branch}</span>
                      <span className="worktree-row__path">{getShortPath(worktree.path)}</span>
                    </span>
                    <span className="worktree-row__meta">
                      {worktree.isMainWorktree ? <StatusPill label="Main" tone="neutral" /> : null}
                      {worktree.hasChanges ? <StatusPill label="변경 있음" tone="warning" /> : null}
                      {worktree.isLocked ? <StatusPill label="잠김" tone={tone} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-heading">
            <p className="eyebrow">{hasRepository ? state.repositoryPath : '열린 저장소 없음'}</p>
            <h2>{selectedWorktree?.branch ?? '워크스페이스를 선택하세요'}</h2>
            <div className="workspace-meta">
              {selectedWorktree !== null ? <span>{selectedWorktree.path}</span> : null}
              {status.currentBranch !== '' ? <StatusPill label={status.currentBranch} tone="neutral" /> : null}
              {status.ahead > 0 ? <StatusPill label={`Ahead ${status.ahead}`} tone="warning" /> : null}
              {status.behind > 0 ? <StatusPill label={`Behind ${status.behind}`} tone="warning" /> : null}
              {isDirty ? <StatusPill label={`변경 ${dirtyFileCount}개`} tone="warning" /> : null}
              {selectedWorktree?.isLocked === true ? <StatusPill label="잠김" tone="locked" /> : null}
            </div>
          </div>

          <div aria-label="동기화 작업" className="toolbar">
            <ToolbarButton disabled={!canRunRepositoryAction} onClick={refreshRepository} title="저장소 상태 새로고침">
              새로고침
            </ToolbarButton>
            <ToolbarButton disabled={!canRunRepositoryAction} onClick={() => runSyncAction('fetch')} title="원격 ref Fetch">
              Fetch
            </ToolbarButton>
            <ToolbarButton
              disabled={!canRunWorktreeAction || selectedWorktree?.isLocked === true}
              onClick={() => runSyncAction('pull')}
              title="선택한 worktree로 Pull"
            >
              Pull
            </ToolbarButton>
            <ToolbarButton
              disabled={!canRunWorktreeAction || selectedWorktree?.isLocked === true}
              onClick={() => runSyncAction('push')}
              title="선택한 브랜치 Push"
            >
              Push
            </ToolbarButton>
            <ToolbarButton
              disabled={removeDisabled}
              onClick={() =>
                setState((current) => ({
                  ...current,
                  dialogMode: 'remove',
                  errorMessage: null,
                  successMessage: null
                }))
              }
              title="선택한 worktree 삭제"
              tone="danger"
            >
              삭제
            </ToolbarButton>
          </div>
        </header>

        {state.errorMessage !== null ? <div className="message message--error">{state.errorMessage}</div> : null}
        {state.successMessage !== null ? <div className="message message--success">{state.successMessage}</div> : null}
        {state.isLoading ? (
          <div className="message message--loading">{state.operation !== null ? OPERATION_LABELS[state.operation] : 'Git 작업'} 진행 중...</div>
        ) : null}

        <div aria-label="워크스페이스 보기" className="tab-bar" role="tablist">
          <button
            aria-selected={state.activeTab === 'changes'}
            className={`tab-button${state.activeTab === 'changes' ? ' tab-button--active' : ''}`}
            onClick={() => setState((current) => ({ ...current, activeTab: 'changes' }))}
            role="tab"
            type="button"
          >
            변경 사항
          </button>
          <button
            aria-selected={state.activeTab === 'history'}
            className={`tab-button${state.activeTab === 'history' ? ' tab-button--active' : ''}`}
            onClick={() => setState((current) => ({ ...current, activeTab: 'history' }))}
            role="tab"
            type="button"
          >
            히스토리
          </button>
        </div>

        {state.activeTab === 'changes' ? (
          <section className="content-panel" role="tabpanel">
            {!hasSelectedWorktree ? (
              <div className="empty-state empty-state--large">변경 사항을 보려면 워크스페이스를 선택하세요.</div>
            ) : dirtyFileCount === 0 ? (
              <div className="empty-state empty-state--large">이 워크스페이스에는 로컬 변경 사항이 없습니다.</div>
            ) : (
              <div className="changes-grid">
                <FileGroup files={status.conflicts} title="충돌" tone="conflicts" />
                <FileGroup files={status.staged} title="스테이지됨" tone="staged" />
                <FileGroup files={status.unstaged} title="스테이지 안 됨" tone="unstaged" />
                <FileGroup files={status.untracked} title="추적 안 됨" tone="untracked" />
              </div>
            )}
          </section>
        ) : null}

        {state.activeTab === 'history' ? (
          <section className="content-panel" role="tabpanel">
            {!hasSelectedWorktree ? (
              <div className="empty-state empty-state--large">커밋 히스토리를 보려면 워크스페이스를 선택하세요.</div>
            ) : state.history.length === 0 ? (
              <div className="empty-state empty-state--large">이 워크스페이스에 불러온 히스토리가 없습니다.</div>
            ) : (
              <ol className="history-list">
                {state.history.map((commit) => (
                  <li className="history-row" key={commit.sha}>
                    <span className="history-row__sha">{commit.shortSha}</span>
                    <span className="history-row__subject">{commit.subject}</span>
                    <span className="history-row__meta">
                      {commit.authorName} · {commit.authoredAt}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}
      </section>

      {state.dialogMode === 'create' ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="create-worktree-title" className="dialog" role="dialog">
            <header className="dialog__header">
              <div>
                <h2 id="create-worktree-title">Worktree 생성</h2>
                <p>기준 ref에서 새 브랜치 워크스페이스를 만듭니다.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setState((current) => ({ ...current, dialogMode: null }))}
                type="button"
              >
                닫기
              </button>
            </header>

            <label className="field-label" htmlFor="create-branch">
              브랜치 이름
            </label>
            <input
              className="text-input"
              id="create-branch"
              onChange={(event) => setState((current) => ({ ...current, createBranchName: event.target.value }))}
              placeholder="feature/worktree-ui"
              type="text"
              value={state.createBranchName}
            />

            <label className="field-label" htmlFor="create-path">
              Worktree 경로
            </label>
            <input
              className="text-input"
              id="create-path"
              onChange={(event) => setState((current) => ({ ...current, createWorktreePath: event.target.value }))}
              placeholder="/Users/name/project-feature"
              type="text"
              value={state.createWorktreePath}
            />

            <label className="field-label" htmlFor="create-base">
              기준 ref
            </label>
            <input
              className="text-input"
              id="create-base"
              onChange={(event) => setState((current) => ({ ...current, createBaseRef: event.target.value }))}
              placeholder="main"
              type="text"
              value={state.createBaseRef}
            />

            <footer className="dialog__footer">
              <button
                className="secondary-button"
                onClick={() => setState((current) => ({ ...current, dialogMode: null }))}
                type="button"
              >
                취소
              </button>
              <button className="primary-button" disabled={createDisabled} onClick={createWorktree} type="button">
                생성
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {state.dialogMode === 'remove' && selectedWorktree !== null ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="remove-worktree-title" className="dialog" role="dialog">
            <header className="dialog__header">
              <div>
                <h2 id="remove-worktree-title">Worktree 삭제</h2>
                <p>{selectedWorktree.path}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setState((current) => ({ ...current, dialogMode: null }))}
                type="button"
              >
                닫기
              </button>
            </header>

            <div className="danger-panel">
              선택한 worktree 체크아웃을 삭제합니다. 로컬 변경 사항이 있는 worktree는 삭제 전에 확인해야 합니다.
            </div>

            <label className="checkbox-row">
              <input
                checked={state.removeForce}
                onChange={(event) => setState((current) => ({ ...current, removeForce: event.target.checked }))}
                type="checkbox"
              />
              <span>Git이 로컬 변경 사항을 보고해도 강제로 삭제</span>
            </label>

            <footer className="dialog__footer">
              <button
                className="secondary-button"
                onClick={() => setState((current) => ({ ...current, dialogMode: null }))}
                type="button"
              >
                취소
              </button>
              <button className="danger-button" disabled={removeDisabled} onClick={removeWorktree} type="button">
                Worktree 삭제
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export { App };
