import { useCallback, useMemo, useState, type ReactElement } from 'react';
import type { AppIpcResult, GitClientApi } from '../../shared/constants/ipc';
import type {
  GitChangedFile,
  GitCommit,
  GitDiffScope,
  GitFileChange,
  GitIdentity,
  GitStatus,
  Worktree
} from '../../shared/types';
import {
  DEFAULT_LANGUAGE,
  formatCommitActionLabel,
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  translate,
  type Language,
  type TranslationKey
} from './i18n';
import { GitAvatar } from './GitAvatar';
import { normalizeAvatarEmail } from './avatar';
import { unwrapIpcResult } from './ipcResult';

type ActiveTab = 'worktrees' | 'changes' | 'history';
type DialogMode = 'create' | 'remove' | null;
type OperationName =
  | 'open'
  | 'refresh'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'commit'
  | 'createWorktree'
  | 'removeWorktree'
  | 'cherryPick'
  | 'abortCherryPick';

type CommitChangedFile = GitChangedFile & {
  additions?: number;
  deletions?: number;
};

type ChangedFileSelection = {
  filePath: string;
  diffScope: GitDiffScope;
};

type WindowGitClientShape = Window & {
  gitClient?: {
    git?: GitClientApi;
  };
};

type RepositoryViewState = {
  repositoryPath: string;
  repositoryOwnerAvatarUrl: string | null;
  worktrees: Worktree[];
  selectedWorktreePath: string;
  identity: GitIdentity | null;
  status: GitStatus | null;
  selectedChangedFilePath: string;
  selectedChangedFileScope: GitDiffScope | '';
  changedFileDiff: string;
  changesDetailsMessage: string | null;
  history: GitCommit[];
  selectedCommitSha: string;
  commitFiles: CommitChangedFile[];
  selectedCommitFilePath: string;
  commitDiff: string;
  historyDetailsMessage: string | null;
};

type AppState = RepositoryViewState & {
  recentRepositories: string[];
  language: Language;
  activeTab: ActiveTab;
  dialogMode: DialogMode;
  repositoryMenuOpen: boolean;
  repositoryFilter: string;
  isLoading: boolean;
  isChangedFileDiffLoading: boolean;
  isHistoryDetailsLoading: boolean;
  operation: OperationName | null;
  errorMessage: string | null;
  successMessage: string | null;
  commitSummary: string;
  commitDescription: string;
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
  repositoryOwnerAvatarUrl: null,
  worktrees: [],
  selectedWorktreePath: '',
  identity: null,
  status: null,
  selectedChangedFilePath: '',
  selectedChangedFileScope: '',
  changedFileDiff: '',
  changesDetailsMessage: null,
  history: [],
  selectedCommitSha: '',
  commitFiles: [],
  selectedCommitFilePath: '',
  commitDiff: '',
  historyDetailsMessage: null,
  recentRepositories: [],
  language: DEFAULT_LANGUAGE,
  activeTab: 'worktrees',
  dialogMode: null,
  repositoryMenuOpen: false,
  repositoryFilter: '',
  isLoading: false,
  isChangedFileDiffLoading: false,
  isHistoryDetailsLoading: false,
  operation: null,
  errorMessage: null,
  successMessage: null,
  commitSummary: '',
  commitDescription: '',
  createBranchName: '',
  createWorktreePath: '',
  createBaseRef: 'main',
  removeForce: false
};

const HISTORY_LIMIT_COUNT = 50;
const RECENT_REPOSITORIES_LIMIT_COUNT = 12;
const RECENT_REPOSITORIES_STORAGE_KEY = 'recentRepositoryPaths';
const SHORT_PATH_SEGMENT_COUNT = 2;
const OPERATION_LABEL_KEYS: Record<OperationName, TranslationKey> = {
  open: 'operationOpen',
  refresh: 'operationRefresh',
  fetch: 'operationFetch',
  pull: 'operationPull',
  push: 'operationPush',
  commit: 'operationCommit',
  createWorktree: 'operationCreateWorktree',
  removeWorktree: 'operationRemoveWorktree',
  cherryPick: 'operationCherryPick',
  abortCherryPick: 'operationAbortCherryPick'
};

const BLOCKING_OPERATIONS = new Set<OperationName>([
  'fetch',
  'pull',
  'push',
  'commit',
  'createWorktree',
  'removeWorktree',
  'cherryPick',
  'abortCherryPick'
]);

const getGitApi = (): GitClientApi | null => {
  const gitWindow = window as WindowGitClientShape;

  return gitWindow.gitClient?.git ?? null;
};

const getRepositoryName = (repositoryPath: string): string => {
  const segments = repositoryPath.split('/').filter(Boolean);

  return segments.at(-1) ?? repositoryPath;
};

const readRecentRepositoryPaths = (): string[] => {
  try {
    const storedValue = window.localStorage.getItem(RECENT_REPOSITORIES_STORAGE_KEY);

    if (storedValue === null) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch (error: unknown) {
    return [];
  }
};

const writeRecentRepositoryPaths = (repositoryPaths: string[]): void => {
  try {
    window.localStorage.setItem(RECENT_REPOSITORIES_STORAGE_KEY, JSON.stringify(repositoryPaths));
  } catch (error: unknown) {
    return;
  }
};

const readLanguage = (): Language => {
  try {
    const storedValue = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(storedValue) ? storedValue : DEFAULT_LANGUAGE;
  } catch (error: unknown) {
    return DEFAULT_LANGUAGE;
  }
};

const writeLanguage = (language: Language): void => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error: unknown) {
    return;
  }
};

const addRecentRepositoryPath = (repositoryPaths: string[], repositoryPath: string): string[] => {
  const normalizedPath = repositoryPath.trim();

  if (normalizedPath === '') {
    return repositoryPaths;
  }

  const nextRepositoryPaths = [
    normalizedPath,
    ...repositoryPaths.filter((existingPath) => existingPath !== normalizedPath)
  ].slice(0, RECENT_REPOSITORIES_LIMIT_COUNT);

  writeRecentRepositoryPaths(nextRepositoryPaths);

  return nextRepositoryPaths;
};

const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return fallbackMessage;
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

const getSelectedCommit = (history: GitCommit[], selectedCommitSha: string): GitCommit | null => {
  return history.find((commit) => commit.sha === selectedCommitSha) ?? null;
};

const getShortSha = (sha: string): string => {
  return sha.length <= 7 ? sha : sha.slice(0, 7);
};

const getFileDisplayStatus = (file: CommitChangedFile): string => {
  if (file.previousPath !== undefined && file.previousPath !== file.path) {
    return 'R';
  }

  return file.status;
};

const getFileStatsLabel = (file: CommitChangedFile): string => {
  const additions = file.additions ?? 0;
  const deletions = file.deletions ?? 0;

  if (additions === 0 && deletions === 0) {
    return '';
  }

  return `+${additions} -${deletions}`;
};

const getDiffLineTone = (line: string): string => {
  if (
    line.startsWith('diff --git') ||
    line.startsWith('index ') ||
    line.startsWith('new file mode') ||
    line.startsWith('deleted file mode') ||
    line.startsWith('similarity index') ||
    line.startsWith('rename from') ||
    line.startsWith('rename to') ||
    line.startsWith('--- ') ||
    line.startsWith('+++ ')
  ) {
    return 'file';
  }

  if (line.startsWith('@@')) {
    return 'hunk';
  }

  if (line.startsWith('+')) {
    return 'added';
  }

  if (line.startsWith('-')) {
    return 'removed';
  }

  return 'context';
};

const getChangedFileSelectionLabel = (selection: ChangedFileSelection | null, fallbackLabel: string): string => {
  if (selection === null) {
    return fallbackLabel;
  }

  return `${selection.filePath} · ${selection.diffScope}`;
};

const getCommitPrimaryAvatarUrl = (
  commit: GitCommit,
  identity: GitIdentity | null,
  repositoryOwnerAvatarUrl: string | null
): string | null => {
  if (identity === null || repositoryOwnerAvatarUrl === null) {
    return null;
  }

  return normalizeAvatarEmail(commit.authorEmail) === normalizeAvatarEmail(identity.email) ? repositoryOwnerAvatarUrl : null;
};

const readWorktreeDetails = async (
  gitApi: GitClientApi,
  worktreePath: string,
  t: (key: TranslationKey) => string
): Promise<Pick<RepositoryViewState, 'identity' | 'status' | 'selectedChangedFilePath' | 'selectedChangedFileScope' | 'changedFileDiff' | 'changesDetailsMessage' | 'history' | 'selectedCommitSha' | 'commitFiles' | 'selectedCommitFilePath' | 'commitDiff' | 'historyDetailsMessage'>> => {
  if (worktreePath.trim().length === 0) {
    return {
      identity: null,
      status: null,
      selectedChangedFilePath: '',
      selectedChangedFileScope: '',
      changedFileDiff: '',
      changesDetailsMessage: null,
      history: [],
      selectedCommitSha: '',
      commitFiles: [],
      selectedCommitFilePath: '',
      commitDiff: '',
      historyDetailsMessage: null
    };
  }

  const [identity, status, history] = await Promise.all([
    unwrapIpcResult(gitApi.getIdentity(worktreePath)),
    unwrapIpcResult(gitApi.getStatus(worktreePath)),
    unwrapIpcResult(gitApi.getHistory(worktreePath, HISTORY_LIMIT_COUNT))
  ]);

  const selectedCommitSha = history[0]?.sha ?? '';
  const historyDetails =
    selectedCommitSha === ''
      ? {
          commitFiles: [],
          selectedCommitFilePath: '',
          commitDiff: '',
          historyDetailsMessage: null
        }
      : await readCommitDetails(gitApi, worktreePath, selectedCommitSha, '', t);

  return {
    identity,
    status,
    selectedChangedFilePath: '',
    selectedChangedFileScope: '',
    changedFileDiff: '',
    changesDetailsMessage: null,
    history,
    selectedCommitSha,
    ...historyDetails
  };
};

const readChangedFileDiff = async (
  gitApi: GitClientApi,
  worktreePath: string,
  selection: ChangedFileSelection
): Promise<Pick<RepositoryViewState, 'changedFileDiff' | 'changesDetailsMessage'>> => {
  if (worktreePath.trim() === '' || selection.filePath.trim() === '') {
    return {
      changedFileDiff: '',
      changesDetailsMessage: null
    };
  }

  const diffResult = await unwrapIpcResult(
    gitApi.getChangedFileDiff(worktreePath, selection.filePath, selection.diffScope)
  );

  return {
    changedFileDiff: diffResult.output,
    changesDetailsMessage: null
  };
};

const readCommitDetails = async (
  gitApi: GitClientApi,
  worktreePath: string,
  commitSha: string,
  preferredFilePath: string,
  t: (key: TranslationKey) => string
): Promise<Pick<RepositoryViewState, 'commitFiles' | 'selectedCommitFilePath' | 'commitDiff' | 'historyDetailsMessage'>> => {
  if (worktreePath.trim() === '' || commitSha.trim() === '') {
    return {
      commitFiles: [],
      selectedCommitFilePath: '',
      commitDiff: '',
      historyDetailsMessage: null
    };
  }

  if (typeof gitApi.getCommitFiles !== 'function' || typeof gitApi.getCommitFileDiff !== 'function') {
    return {
      commitFiles: [],
      selectedCommitFilePath: '',
      commitDiff: '',
      historyDetailsMessage: t('commitFileInfoUnavailable')
    };
  }

  const commitFiles = await unwrapIpcResult(
    gitApi.getCommitFiles(worktreePath, commitSha) as Promise<AppIpcResult<CommitChangedFile[]>>
  );
  const selectedCommitFilePath =
    commitFiles.find((file) => file.path === preferredFilePath)?.path ?? commitFiles[0]?.path ?? '';

  if (selectedCommitFilePath === '') {
    return {
      commitFiles,
      selectedCommitFilePath,
      commitDiff: '',
      historyDetailsMessage: t('commitNoFilesInCommit')
    };
  }

  const diffResult = await unwrapIpcResult(
    gitApi.getCommitFileDiff(worktreePath, commitSha, selectedCommitFilePath)
  );

  return {
    commitFiles,
    selectedCommitFilePath,
    commitDiff: diffResult.output,
    historyDetailsMessage: null
  };
};

const readRepository = async (
  repositoryPath: string,
  fallbackSelectedPath: string,
  t: (key: TranslationKey) => string
): Promise<RepositoryViewState> => {
  const gitApi = getGitApi();

  if (gitApi === null) {
    throw new Error(t('errorGitApiUnavailable'));
  }

  const repository = await unwrapIpcResult(gitApi.openRepository(repositoryPath));
  const worktrees = await unwrapIpcResult(gitApi.listWorktrees(repository.path));
  const fallbackExists = worktrees.some((worktree) => worktree.path === fallbackSelectedPath);
  const selectedWorktreePath =
    (fallbackExists ? fallbackSelectedPath : '') ||
    worktrees.find((worktree) => worktree.isMainWorktree)?.path ||
    worktrees[0]?.path ||
    '';
  const details = await readWorktreeDetails(gitApi, selectedWorktreePath, t);

  return {
    repositoryPath: repository.path,
    repositoryOwnerAvatarUrl: repository.ownerAvatarUrl,
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
  emptyLabel,
  files,
  selectedFilePath,
  selectedScope,
  onSelect,
  title,
  tone
}: {
  emptyLabel: string;
  files: GitFileChange[];
  selectedFilePath: string;
  selectedScope: GitDiffScope | '';
  onSelect: (selection: ChangedFileSelection) => void;
  title: string;
  tone: GitDiffScope;
}): ReactElement => {
  if (files.length === 0) {
    return (
      <section className="file-group">
        <header className="file-group__header">
          <span>{title}</span>
          <span className="file-group__count">0</span>
        </header>
        <div className="empty-inline">{emptyLabel}</div>
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
        {files.map((file) => {
          const isSelected = selectedFilePath === file.path && selectedScope === tone;

          return (
            <li className="file-row" key={`${tone}-${file.status}-${file.path}`}>
              <button
                aria-selected={isSelected}
                className={`file-row__button${isSelected ? ' file-row__button--selected' : ''}`}
                onClick={() => onSelect({ filePath: file.path, diffScope: tone })}
                type="button"
              >
                <span className={`file-row__status file-row__status--${tone}`}>{file.status}</span>
                <span className="file-row__path">{file.path}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const DiffText = ({ diffText, label }: { diffText: string; label: string }): ReactElement => {
  const lines = diffText.split('\n');

  return (
    <div aria-label={label} className="diff-text" role="document">
      {lines.map((line, index) => (
        <div className={`diff-line diff-line--${getDiffLineTone(line)}`} key={`${index}-${line}`}>
          <span className="diff-line__content">{line === '' ? ' ' : line}</span>
        </div>
      ))}
    </div>
  );
};

const LoadingPlaceholder = ({ label }: { label: string }): ReactElement => (
  <div aria-label={label} className="loading-placeholder" role="status" />
);

const CommitFileRow = ({
  file,
  isSelected,
  onSelect
}: {
  file: CommitChangedFile;
  isSelected: boolean;
  onSelect: () => void;
}): ReactElement => {
  const statsLabel = getFileStatsLabel(file);

  return (
    <button
      aria-selected={isSelected}
      className={`commit-file-row${isSelected ? ' commit-file-row--selected' : ''}`}
      onClick={onSelect}
      role="option"
      type="button"
    >
      <span className="commit-file-row__status">{getFileDisplayStatus(file)}</span>
      <span className="commit-file-row__main">
        <span className="commit-file-row__path">{file.path}</span>
        {file.previousPath !== undefined && file.previousPath !== file.path ? (
          <span className="commit-file-row__old-path">{file.previousPath}</span>
        ) : null}
      </span>
      {statsLabel !== '' ? <span className="commit-file-row__stats">{statsLabel}</span> : null}
    </button>
  );
};

const WorktreeOverviewRow = ({
  isRemoveDisabled,
  isSelected,
  labels,
  onRemove,
  onSelect,
  worktree
}: {
  isRemoveDisabled: boolean;
  isSelected: boolean;
  labels: {
    deleteTitle: string;
    hasChanges: string;
    locked: string;
    main: string;
    selected: string;
  };
  onRemove: () => void;
  onSelect: () => void;
  worktree: Worktree;
}): ReactElement => {
  return (
    <article className={`worktree-overview-row${isSelected ? ' worktree-overview-row--selected' : ''}`}>
      <button
        aria-label={`${worktree.branch} ${labels.selected}`}
        className="worktree-overview-row__main"
        onClick={onSelect}
        type="button"
      >
        <span className="worktree-overview-row__branch">{worktree.branch}</span>
        <span className="worktree-overview-row__path">{worktree.path}</span>
      </button>
      <span className="worktree-overview-row__sha">{getShortSha(worktree.headSha)}</span>
      <span className="worktree-overview-row__meta">
        {worktree.isMainWorktree ? <StatusPill label={labels.main} tone="neutral" /> : null}
        {worktree.hasChanges ? <StatusPill label={labels.hasChanges} tone="warning" /> : null}
        {worktree.isLocked ? <StatusPill label={labels.locked} tone="locked" /> : null}
        {isSelected ? <StatusPill label={labels.selected} tone="success" /> : null}
      </span>
      <button
        className="compact-button"
        disabled={isRemoveDisabled}
        onClick={onRemove}
        title={labels.deleteTitle}
        type="button"
      >
        {labels.deleteTitle}
      </button>
    </article>
  );
};

const App = (): ReactElement => {
  const [state, setState] = useState<AppState>(() => ({
    ...INITIAL_STATE,
    recentRepositories: readRecentRepositoryPaths(),
    language: readLanguage()
  }));

  const t = useCallback((key: TranslationKey): string => translate(state.language, key), [state.language]);
  const gitApi = getGitApi();
  const selectedWorktree = useMemo(
    () => getSelectedWorktree(state.worktrees, state.selectedWorktreePath),
    [state.selectedWorktreePath, state.worktrees]
  );
  const selectedCommit = useMemo(
    () => getSelectedCommit(state.history, state.selectedCommitSha),
    [state.history, state.selectedCommitSha]
  );
  const filteredRecentRepositories = useMemo(() => {
    const query = state.repositoryFilter.trim().toLowerCase();

    if (query === '') {
      return state.recentRepositories;
    }

    return state.recentRepositories.filter((repositoryPath) => repositoryPath.toLowerCase().includes(query));
  }, [state.recentRepositories, state.repositoryFilter]);
  const status = state.status ?? EMPTY_STATUS;
  const hasRepository = state.repositoryPath.trim() !== '';
  const hasGitApi = gitApi !== null;
  const hasSelectedWorktree = selectedWorktree !== null;
  const shouldShowSelectedWorktreePath =
    selectedWorktree !== null && selectedWorktree.path !== state.repositoryPath;
  const dirtyFileCount = getStatusFileCount(state.status);
  const isDirty = dirtyFileCount > 0 || selectedWorktree?.hasChanges === true;
  const isBlockingOperation = state.operation !== null && BLOCKING_OPERATIONS.has(state.operation);
  const isOpeningRepository = state.operation === 'open';
  const isRefreshingRepository = state.operation === 'refresh';
  const canUseRepositorySelector = hasGitApi && !isBlockingOperation;
  const canRunRepositoryAction = hasGitApi && hasRepository && !isBlockingOperation && !isOpeningRepository;
  const canRunWorktreeAction = canRunRepositoryAction && hasSelectedWorktree;
  const commitMessage = [state.commitSummary.trim(), state.commitDescription.trim()].filter(Boolean).join('\n\n');
  const commitTargetBranch = status.currentBranch || selectedWorktree?.branch || t('labelCurrentBranch');
  const commitActionLabel = formatCommitActionLabel(state.language, dirtyFileCount, commitTargetBranch);
  const commitDisabled =
    !canRunWorktreeAction ||
    selectedWorktree?.isLocked === true ||
    dirtyFileCount === 0 ||
    state.commitSummary.trim() === '' ||
    typeof gitApi?.commit !== 'function';
  const createDisabled =
    !canRunRepositoryAction ||
    state.createBranchName.trim() === '' ||
    state.createWorktreePath.trim() === '' ||
    state.createBaseRef.trim() === '';
  const removeDisabled =
    !canRunWorktreeAction || selectedWorktree?.isMainWorktree === true || selectedWorktree?.isLocked === true;
  const cherryPickDisabled =
    !canRunWorktreeAction ||
    selectedCommit === null ||
    isBlockingOperation ||
    selectedWorktree?.isLocked === true ||
    typeof gitApi?.cherryPick !== 'function';
  const abortCherryPickDisabled =
    !canRunWorktreeAction ||
    isBlockingOperation ||
    selectedWorktree?.isLocked === true ||
    typeof gitApi?.abortCherryPick !== 'function';
  const selectedChangedFile =
    state.selectedChangedFilePath === '' || state.selectedChangedFileScope === ''
      ? null
      : {
          filePath: state.selectedChangedFilePath,
          diffScope: state.selectedChangedFileScope
        };
  const shouldShowOperationMessage = isBlockingOperation && state.operation !== null;

  const setLanguage = (language: Language): void => {
    writeLanguage(language);
    setState((current) => ({
      ...current,
      language
    }));
  };

  const getOperationCompleteMessage = (operation: 'fetch' | 'pull' | 'push'): string =>
    state.language === 'ko' ? `${t(OPERATION_LABEL_KEYS[operation])} 완료.` : `${t(OPERATION_LABEL_KEYS[operation])} complete.`;

  const setRepositoryPath = (repositoryPath: string): void => {
    setState((current) => ({
      ...current,
      repositoryPath,
      repositoryMenuOpen: true,
      errorMessage: null,
      successMessage: null
    }));
  };

  const runOperation = useCallback(
    async (
      operation: OperationName,
      action: () => Promise<Partial<AppState>>,
      successMessage: string | null
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
          errorMessage: getErrorMessage(error, t('errorGitCommandFailed')),
          successMessage: null
        }));
      }
    },
    []
  );

  const openRepository = async (): Promise<void> => {
    const gitApiForOperation = getGitApi();
    let repositoryPath = state.repositoryPath.trim();

    if (gitApiForOperation === null) {
      setState((current) => ({
        ...current,
        errorMessage: t('errorGitApiUnavailable'),
        successMessage: null
      }));
      return;
    }

    if (repositoryPath === '') {
      const selection = await unwrapIpcResult(gitApiForOperation.selectRepositoryDirectory());

      if (selection.path === null) {
        return;
      }

      repositoryPath = selection.path;
      setRepositoryPath(repositoryPath);
    }

    void runOperation(
      'open',
      async () => {
        const repositoryState = await readRepository(repositoryPath, '', t);

        return {
          ...repositoryState,
          repositoryMenuOpen: false,
          recentRepositories: addRecentRepositoryPath(state.recentRepositories, repositoryState.repositoryPath)
        };
      },
      t('successOpenRepository')
    );
  };

  const switchRepository = (repositoryPath: string): void => {
    setState((current) => ({
      ...current,
      repositoryPath,
      repositoryMenuOpen: false
    }));

    void runOperation(
      'open',
      async () => {
        const repositoryState = await readRepository(repositoryPath, '', t);

        return {
          ...repositoryState,
          repositoryMenuOpen: false,
          recentRepositories: addRecentRepositoryPath(state.recentRepositories, repositoryState.repositoryPath)
        };
      },
      t('successSwitchRepository')
    );
  };

  const refreshRepository = (): void => {
    void runOperation(
      'refresh',
      () => readRepository(state.repositoryPath, state.selectedWorktreePath, t),
      null
    );
  };

  const runSyncAction = (operation: 'fetch' | 'pull' | 'push'): void => {
    void runOperation(
      operation,
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null) {
          throw new Error(t('errorGitApiUnavailable'));
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

        return readRepository(state.repositoryPath, state.selectedWorktreePath, t);
      },
      getOperationCompleteMessage(operation)
    );
  };

  const selectWorktree = (worktreePath: string): void => {
    void runOperation(
      'refresh',
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null) {
          throw new Error(t('errorGitApiUnavailable'));
        }

        const details = await readWorktreeDetails(gitApiForOperation, worktreePath, t);

        return {
          selectedWorktreePath: worktreePath,
          ...details
        };
      },
      null
    );
  };

  const selectCommit = (commitSha: string): void => {
    setState((current) => ({
      ...current,
      selectedCommitSha: commitSha,
      commitFiles: [],
      selectedCommitFilePath: '',
      commitDiff: '',
      historyDetailsMessage: null,
      isHistoryDetailsLoading: true,
      errorMessage: null,
      successMessage: null
    }));

    const gitApiForOperation = getGitApi();

    if (gitApiForOperation === null) {
      setState((current) => ({
        ...current,
        isHistoryDetailsLoading: false,
        errorMessage: t('errorGitApiUnavailable')
      }));
      return;
    }

    void readCommitDetails(gitApiForOperation, state.selectedWorktreePath, commitSha, '', t)
      .then((details) => {
        setState((current) => ({
          ...current,
          ...details,
          isHistoryDetailsLoading: false
        }));
      })
      .catch((error: unknown) => {
        setState((current) => ({
          ...current,
          isHistoryDetailsLoading: false,
          errorMessage: getErrorMessage(error, t('errorGitCommandFailed'))
        }));
      });
  };

  const selectChangedFile = (selection: ChangedFileSelection): void => {
    const gitApiForOperation = getGitApi();

    setState((current) => ({
      ...current,
      selectedChangedFilePath: selection.filePath,
      selectedChangedFileScope: selection.diffScope,
      changedFileDiff: '',
      changesDetailsMessage: null,
      isChangedFileDiffLoading: true,
      errorMessage: null,
      successMessage: null
    }));

    if (gitApiForOperation === null) {
      setState((current) => ({
        ...current,
        isChangedFileDiffLoading: false,
        errorMessage: t('errorGitApiUnavailable')
      }));
      return;
    }

    void readChangedFileDiff(gitApiForOperation, state.selectedWorktreePath, selection)
      .then((details) => {
        setState((current) => ({
          ...(current.selectedWorktreePath === state.selectedWorktreePath &&
          current.selectedChangedFilePath === selection.filePath &&
          current.selectedChangedFileScope === selection.diffScope
            ? {
                ...current,
                ...details,
                isChangedFileDiffLoading: false
              }
            : current)
        }));
      })
      .catch((error: unknown) => {
        setState((current) => ({
          ...(current.selectedWorktreePath === state.selectedWorktreePath &&
          current.selectedChangedFilePath === selection.filePath &&
          current.selectedChangedFileScope === selection.diffScope
            ? {
                ...current,
                isChangedFileDiffLoading: false,
                errorMessage: getErrorMessage(error, t('errorGitCommandFailed'))
              }
            : current)
        }));
      });
  };

  const selectCommitFile = (filePath: string): void => {
    const gitApiForOperation = getGitApi();

    setState((current) => ({
      ...current,
      selectedCommitFilePath: filePath,
      commitDiff: '',
      historyDetailsMessage: null,
      isHistoryDetailsLoading: true,
      errorMessage: null,
      successMessage: null
    }));

    if (gitApiForOperation === null) {
      setState((current) => ({
        ...current,
        isHistoryDetailsLoading: false,
        errorMessage: t('errorGitApiUnavailable')
      }));
      return;
    }

    void readCommitDetails(gitApiForOperation, state.selectedWorktreePath, state.selectedCommitSha, filePath, t)
      .then((details) => {
        setState((current) => ({
          ...current,
          ...details,
          isHistoryDetailsLoading: false
        }));
      })
      .catch((error: unknown) => {
        setState((current) => ({
          ...current,
          isHistoryDetailsLoading: false,
          errorMessage: getErrorMessage(error, t('errorGitCommandFailed'))
        }));
      });
  };

  const cherryPickCommit = (): void => {
    const commitSha = selectedCommit?.sha ?? '';

    void runOperation(
      'cherryPick',
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null || typeof gitApiForOperation.cherryPick !== 'function') {
          throw new Error(t('errorCherryPickUnavailable'));
        }

        await unwrapIpcResult(gitApiForOperation.cherryPick(state.selectedWorktreePath, commitSha));

        return readRepository(state.repositoryPath, state.selectedWorktreePath, t);
      },
      t('successCherryPick')
    );
  };

  const abortCherryPick = (): void => {
    void runOperation(
      'abortCherryPick',
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null || typeof gitApiForOperation.abortCherryPick !== 'function') {
          throw new Error(t('errorAbortCherryPickUnavailable'));
        }

        await unwrapIpcResult(gitApiForOperation.abortCherryPick(state.selectedWorktreePath));

        return readRepository(state.repositoryPath, state.selectedWorktreePath, t);
      },
      t('successAbortCherryPick')
    );
  };

  const commitChanges = (): void => {
    void runOperation(
      'commit',
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null || typeof gitApiForOperation.commit !== 'function') {
          throw new Error(t('errorCommitUnavailable'));
        }

        await unwrapIpcResult(gitApiForOperation.commit(state.selectedWorktreePath, commitMessage));

        return {
          ...(await readRepository(state.repositoryPath, state.selectedWorktreePath, t)),
          commitSummary: '',
          commitDescription: ''
        };
      },
      t('successCommit')
    );
  };

  const createWorktree = (): void => {
    void runOperation(
      'createWorktree',
      async () => {
        const gitApiForOperation = getGitApi();
        const createdPath = state.createWorktreePath.trim();

        if (gitApiForOperation === null) {
          throw new Error(t('errorGitApiUnavailable'));
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
          ...(await readRepository(state.repositoryPath, createdPath, t)),
          dialogMode: null,
          createBranchName: '',
          createWorktreePath: ''
        };
      },
      t('successCreateWorktree')
    );
  };

  const removeWorktree = (): void => {
    const worktreePath = selectedWorktree?.path ?? '';

    void runOperation(
      'removeWorktree',
      async () => {
        const gitApiForOperation = getGitApi();

        if (gitApiForOperation === null) {
          throw new Error(t('errorGitApiUnavailable'));
        }

        await unwrapIpcResult(
          gitApiForOperation.removeWorktree(state.repositoryPath, worktreePath, state.removeForce)
        );

        return {
          ...(await readRepository(state.repositoryPath, '', t)),
          dialogMode: null,
          removeForce: false
        };
      },
      t('successRemoveWorktree')
    );
  };

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label={`${t('labelRepository')} / ${t('labelWorktree')}`}>
        <section className="repository-panel">
          <div className="section-title-row">
            <h2>{t('labelRepository')}</h2>
          </div>

          <button
            aria-expanded={state.repositoryMenuOpen}
            className="selector-trigger"
            disabled={!canUseRepositorySelector}
            onClick={() =>
              setState((current) => ({
                ...current,
                repositoryMenuOpen: !current.repositoryMenuOpen,
              }))
            }
            type="button"
          >
            <span className="selector-trigger__main">
              <span className="selector-trigger__name">
                {hasRepository ? getRepositoryName(state.repositoryPath) : t('emptySelectRepository')}
              </span>
              <span className="selector-trigger__path">
                {hasRepository ? getShortPath(state.repositoryPath) : t('emptyOpenLocalRepository')}
              </span>
            </span>
            <span className="selector-trigger__chevron">{state.repositoryMenuOpen ? '▲' : '▼'}</span>
          </button>

          {state.repositoryMenuOpen ? (
            <div className="selector-menu" role="presentation">
              <label className="field-label" htmlFor="repository-path">
                {t('labelRepositoryPath')}
              </label>
              <div className="path-row">
                <input
                  autoComplete="off"
                  className="text-input"
                  disabled={!canUseRepositorySelector}
                  id="repository-path"
                  onChange={(event) => setRepositoryPath(event.target.value)}
                  placeholder={t('pathPlaceholder')}
                  type="text"
                  value={state.repositoryPath}
                />
                <button
                  className="primary-button"
                  disabled={!canUseRepositorySelector || isOpeningRepository}
                  onClick={() => {
                    void openRepository();
                  }}
                  title={t('titleOpenRepository')}
                  type="button"
                >
                  {t('actionOpen')}
                </button>
              </div>

              <input
                aria-label={t('labelRepositorySearch')}
                className="text-input"
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    repositoryFilter: event.target.value
                  }))
                }
                placeholder={t('repositoryFilterPlaceholder')}
                type="search"
                value={state.repositoryFilter}
              />

              {state.recentRepositories.length > 0 ? (
                <div aria-label={t('labelRepository')} className="repository-list" role="listbox">
                  {filteredRecentRepositories.map((repositoryPath) => {
                    const isSelected = repositoryPath === state.repositoryPath;

                    return (
                      <button
                        aria-selected={isSelected}
                        className={`repository-row${isSelected ? ' repository-row--selected' : ''}`}
                        disabled={!canUseRepositorySelector || isOpeningRepository}
                        key={repositoryPath}
                        onClick={() => switchRepository(repositoryPath)}
                        role="option"
                        title={repositoryPath}
                        type="button"
                      >
                        <span className="repository-row__name">{getRepositoryName(repositoryPath)}</span>
                        <span className="repository-row__path">{getShortPath(repositoryPath)}</span>
                      </button>
                    );
                  })}
                  {filteredRecentRepositories.length === 0 ? (
                    <div className="empty-inline">{t('emptyNoFilteredRepositories')}</div>
                  ) : null}
                </div>
              ) : (
                <div className="empty-inline">{t('emptyNoRecentRepositories')}</div>
              )}
            </div>
          ) : null}
        </section>

        <section className="worktree-panel">
          <div className="section-title-row">
            <h2>{t('labelWorktree')}</h2>
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
              title={t('titleCreateWorktree')}
              type="button"
            >
              {t('actionCreateNew')}
            </button>
          </div>

          {!hasRepository ? (
            <div className="empty-state">{t('emptyNoRepositoryForWorktrees')}</div>
          ) : null}

          {hasRepository ? (
            <div className="source-list-panel">
              <div aria-label={t('worktreeList')} className="worktree-list" role="listbox">
              {state.worktrees.map((worktree) => {
                const isSelected = worktree.path === state.selectedWorktreePath;
                const tone = worktree.isLocked ? 'locked' : worktree.hasChanges ? 'warning' : 'neutral';

                return (
                  <button
                    aria-selected={isSelected}
                    className={`worktree-row${isSelected ? ' worktree-row--selected' : ''}`}
                    disabled={isBlockingOperation || isRefreshingRepository}
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
                      {worktree.isMainWorktree ? <StatusPill label={t('labelMain')} tone="neutral" /> : null}
                      {worktree.hasChanges ? <StatusPill label={t('statusHasChanges')} tone="warning" /> : null}
                      {worktree.isLocked ? <StatusPill label={t('labelLocked')} tone={tone} /> : null}
                    </span>
                  </button>
                );
              })}
              {state.worktrees.length === 0 ? <div className="empty-inline">{t('emptyNoWorktrees')}</div> : null}
            </div>
            </div>
          ) : null}
        </section>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-heading">
            <p className="eyebrow">{hasRepository ? state.repositoryPath : t('emptyNoRepository')}</p>
            <h2>{selectedWorktree?.branch ?? t('emptySelectWorkspace')}</h2>
            <div className="workspace-meta">
              {shouldShowSelectedWorktreePath ? <span>{selectedWorktree.path}</span> : null}
              {status.currentBranch !== '' ? <StatusPill label={status.currentBranch} tone="neutral" /> : null}
              {status.ahead > 0 ? <StatusPill label={`Ahead ${status.ahead}`} tone="warning" /> : null}
              {status.behind > 0 ? <StatusPill label={`Behind ${status.behind}`} tone="warning" /> : null}
              {isDirty ? <StatusPill label={`${t('statusChanged')} ${dirtyFileCount}`} tone="warning" /> : null}
              {selectedWorktree?.isLocked === true ? <StatusPill label={t('labelLocked')} tone="locked" /> : null}
            </div>
          </div>

          <div aria-label={t('labelSyncActions')} className="toolbar">
            <div className="language-toggle" aria-label="Language">
              <button
                aria-pressed={state.language === 'ko'}
                className="language-toggle__button"
                onClick={() => setLanguage('ko')}
                type="button"
              >
                {t('languageKorean')}
              </button>
              <button
                aria-pressed={state.language === 'en'}
                className="language-toggle__button"
                onClick={() => setLanguage('en')}
                type="button"
              >
                {t('languageEnglish')}
              </button>
            </div>
            <ToolbarButton disabled={!canRunRepositoryAction} onClick={refreshRepository} title={t('titleRefresh')}>
              {t('actionRefresh')}
            </ToolbarButton>
            <ToolbarButton disabled={!canRunRepositoryAction} onClick={() => runSyncAction('fetch')} title={t('titleFetch')}>
              {t('actionFetch')}
            </ToolbarButton>
            <ToolbarButton
              disabled={!canRunWorktreeAction || selectedWorktree?.isLocked === true}
              onClick={() => runSyncAction('pull')}
              title={t('titlePull')}
            >
              {t('actionPull')}
            </ToolbarButton>
            <ToolbarButton
              disabled={!canRunWorktreeAction || selectedWorktree?.isLocked === true}
              onClick={() => runSyncAction('push')}
              title={t('titlePush')}
            >
              {t('actionPush')}
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
              title={t('actionRemoveWorktree')}
              tone="danger"
            >
              {t('actionDelete')}
            </ToolbarButton>
          </div>
        </header>

        {state.errorMessage !== null ? <div className="message message--error">{state.errorMessage}</div> : null}
        {state.successMessage !== null ? <div className="message message--success">{state.successMessage}</div> : null}
        {shouldShowOperationMessage ? (
          <div className="message message--loading">
            {state.operation !== null ? t(OPERATION_LABEL_KEYS[state.operation]) : t('operationRunningFallback')}{' '}
            {t('statusLoadingSuffix')}
          </div>
        ) : null}

        <div aria-label={t('labelWorkspaceViews')} className="tab-bar" role="tablist">
          <button
            aria-selected={state.activeTab === 'worktrees'}
            className={`tab-button${state.activeTab === 'worktrees' ? ' tab-button--active' : ''}`}
            onClick={() => setState((current) => ({ ...current, activeTab: 'worktrees' }))}
            role="tab"
            type="button"
          >
            {t('tabWorktrees')}
          </button>
          <button
            aria-selected={state.activeTab === 'changes'}
            className={`tab-button${state.activeTab === 'changes' ? ' tab-button--active' : ''}`}
            onClick={() => setState((current) => ({ ...current, activeTab: 'changes' }))}
            role="tab"
            type="button"
          >
            {t('tabChanges')}
          </button>
          <button
            aria-selected={state.activeTab === 'history'}
            className={`tab-button${state.activeTab === 'history' ? ' tab-button--active' : ''}`}
            onClick={() => setState((current) => ({ ...current, activeTab: 'history' }))}
            role="tab"
            type="button"
          >
            {t('tabHistory')}
          </button>
        </div>

        {state.activeTab === 'worktrees' ? (
          <section className="content-panel" role="tabpanel">
            {!hasRepository ? (
              <div className="empty-state empty-state--large">{t('emptyNoRepositoryForWorktrees')}</div>
            ) : state.worktrees.length === 0 ? (
              <div className="empty-state empty-state--large">{t('emptyNoWorktrees')}</div>
            ) : (
              <section className="worktree-overview" aria-label={t('worktreeOverview')}>
                <header className="worktree-overview__header">
                  <div>
                    <h2>Worktree</h2>
                    <p>
                      {state.worktrees.length} {t('worktreeCount')} · {t('worktreeCurrentSelection')}:{' '}
                      {selectedWorktree?.branch ?? t('commonNone')}
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    disabled={!canRunRepositoryAction}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        dialogMode: 'create',
                        errorMessage: null,
                        successMessage: null
                      }))
                    }
                    type="button"
                  >
                    새로 만들기
                  </button>
                </header>
                <div className="worktree-overview-list">
                  {state.worktrees.map((worktree) => {
                    const isSelected = worktree.path === state.selectedWorktreePath;
                    const rowRemoveDisabled =
                      !canRunRepositoryAction || worktree.isMainWorktree || worktree.isLocked || isBlockingOperation;

                    return (
                      <WorktreeOverviewRow
                        isRemoveDisabled={rowRemoveDisabled}
                        isSelected={isSelected}
                        key={worktree.id}
                        onRemove={() =>
                          setState((current) => ({
                            ...current,
                            selectedWorktreePath: worktree.path,
                            dialogMode: 'remove',
                            errorMessage: null,
                            successMessage: null
                          }))
                        }
                        onSelect={() => selectWorktree(worktree.path)}
                        worktree={worktree}
                        labels={{
                          deleteTitle: t('titleDeleteWorktree'),
                          hasChanges: t('statusHasChanges'),
                          locked: t('labelLocked'),
                          main: t('labelMain'),
                          selected: t('labelSelected')
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </section>
        ) : null}

        {state.activeTab === 'changes' ? (
          <section className="content-panel" role="tabpanel">
            {!hasSelectedWorktree ? (
              <div className="empty-state empty-state--large">{t('emptySelectWorkspaceForChanges')}</div>
            ) : dirtyFileCount === 0 ? (
              <div className="empty-state empty-state--large empty-state--complete">
                <span className="empty-state__title">{t('changesNoLocalChanges')}</span>
                <span className="empty-state__body">{t('changesNoLocalChangesDetail')}</span>
              </div>
            ) : (
              <div className="changes-layout">
                <div className="changes-sidebar">
                  <div className="changes-file-list" aria-label={t('changesFileList')}>
                    <FileGroup
                      files={status.conflicts}
                      emptyLabel={t('commonNoFiles')}
                      onSelect={selectChangedFile}
                      selectedFilePath={state.selectedChangedFilePath}
                      selectedScope={state.selectedChangedFileScope}
                      title={t('changesConflicts')}
                      tone="conflicts"
                    />
                    <FileGroup
                      files={status.staged}
                      emptyLabel={t('commonNoFiles')}
                      onSelect={selectChangedFile}
                      selectedFilePath={state.selectedChangedFilePath}
                      selectedScope={state.selectedChangedFileScope}
                      title={t('changesStaged')}
                      tone="staged"
                    />
                    <FileGroup
                      files={status.unstaged}
                      emptyLabel={t('commonNoFiles')}
                      onSelect={selectChangedFile}
                      selectedFilePath={state.selectedChangedFilePath}
                      selectedScope={state.selectedChangedFileScope}
                      title={t('changesUnstaged')}
                      tone="unstaged"
                    />
                    <FileGroup
                      files={status.untracked}
                      emptyLabel={t('commonNoFiles')}
                      onSelect={selectChangedFile}
                      selectedFilePath={state.selectedChangedFilePath}
                      selectedScope={state.selectedChangedFileScope}
                      title={t('changesUntracked')}
                      tone="untracked"
                    />
                  </div>

                  <form
                    className="working-copy-commit-panel"
                    onSubmit={(event) => {
                      event.preventDefault();

                      if (!commitDisabled) {
                        commitChanges();
                      }
                    }}
                  >
                    <div className="commit-author-row">
                      <GitAvatar
                        authorEmail={state.identity?.email ?? ''}
                        authorName={state.identity?.name ?? ''}
                        label={`${t('labelAuthorAvatar')}: ${state.identity?.name ?? t('commonNone')}`}
                        primaryImageUrl={state.repositoryOwnerAvatarUrl}
                        size="regular"
                      />
                      <div className="commit-author-row__text">
                        <span className="commit-author-row__name">{state.identity?.name || t('commonNone')}</span>
                        <span className="commit-author-row__email">{state.identity?.email || t('commitIdentityMissing')}</span>
                      </div>
                    </div>
                    <input
                      aria-label={t('commitSummaryLabel')}
                      className="commit-summary-input"
                      disabled={state.operation === 'commit'}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          commitSummary: event.target.value,
                          errorMessage: null,
                          successMessage: null
                        }))
                      }
                      placeholder={t('commitSummaryPlaceholder')}
                      type="text"
                      value={state.commitSummary}
                    />
                    <textarea
                      aria-label={t('commitDescriptionLabel')}
                      className="commit-description-input"
                      disabled={state.operation === 'commit'}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          commitDescription: event.target.value,
                          errorMessage: null,
                          successMessage: null
                        }))
                      }
                      placeholder={t('commitDescriptionPlaceholder')}
                      value={state.commitDescription}
                    />
                    <button className="commit-action-button" disabled={commitDisabled} type="submit">
                      {state.operation === 'commit'
                        ? t('commitWorking')
                        : commitActionLabel}
                    </button>
                  </form>
                </div>

                <section className="diff-panel changes-diff-panel" aria-label={t('changesDiffLabel')}>
                  <header className="commit-panel-header">
                    <span>{getChangedFileSelectionLabel(selectedChangedFile, t('labelDiff'))}</span>
                  </header>
                  {state.isChangedFileDiffLoading ? (
                    <LoadingPlaceholder label={t('changesDiffLoading')} />
                  ) : selectedChangedFile === null ? (
                    <div className="empty-state empty-state--large">{t('changesDiffPlaceholder')}</div>
                  ) : state.changedFileDiff.trim() === '' ? (
                    <div className="empty-inline">{state.changesDetailsMessage ?? t('changesNoDiff')}</div>
                  ) : (
                    <DiffText diffText={state.changedFileDiff} label={t('changesDiffLabel')} />
                  )}
                </section>
              </div>
            )}
          </section>
        ) : null}

        {state.activeTab === 'history' ? (
          <section className="content-panel" role="tabpanel">
            {!hasSelectedWorktree ? (
              <div className="empty-state empty-state--large">{t('emptySelectWorkspaceForHistory')}</div>
            ) : state.history.length === 0 ? (
              <div className="empty-state empty-state--large">{t('emptyNoHistory')}</div>
            ) : (
              <div className="history-layout">
                <ol aria-label={t('historyCommitList')} className="history-list">
                  {state.history.map((commit) => {
                    const isSelected = commit.sha === state.selectedCommitSha;

                    return (
                      <li className="history-list__item" key={commit.sha}>
                        <button
                          aria-selected={isSelected}
                          className={`history-row${isSelected ? ' history-row--selected' : ''}`}
                          onClick={() => selectCommit(commit.sha)}
                          type="button"
                        >
                          <GitAvatar
                            authorEmail={commit.authorEmail}
                            authorName={commit.authorName}
                            label={`${t('labelAuthorAvatar')}: ${commit.authorName}`}
                            primaryImageUrl={getCommitPrimaryAvatarUrl(
                              commit,
                              state.identity,
                              state.repositoryOwnerAvatarUrl
                            )}
                            size="compact"
                          />
                          <span className="history-row__sha">{commit.shortSha}</span>
                          <span className="history-row__subject">{commit.subject}</span>
                          <span className="history-row__meta">
                            {commit.authorName} · {commit.authoredAt}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <section className="history-detail" aria-label={t('historyChangedFilesAndDiff')}>
                  <header className="history-detail__header">
                    {selectedCommit !== null ? (
                      <GitAvatar
                        authorEmail={selectedCommit.authorEmail}
                        authorName={selectedCommit.authorName}
                        label={`${t('labelAuthorAvatar')}: ${selectedCommit.authorName}`}
                        primaryImageUrl={getCommitPrimaryAvatarUrl(
                          selectedCommit,
                          state.identity,
                          state.repositoryOwnerAvatarUrl
                        )}
                        size="regular"
                      />
                    ) : null}
                    <div className="history-detail__title">
                      <h2>{selectedCommit?.subject ?? t('commitSelectCommit')}</h2>
                      {selectedCommit !== null ? (
                        <p>
                          {selectedCommit.shortSha} · {selectedCommit.authorName} · {selectedCommit.authoredAt}
                        </p>
                      ) : null}
                    </div>
                    <div className="history-detail__actions">
                      <button
                        className="toolbar-button"
                        disabled={cherryPickDisabled}
                        onClick={cherryPickCommit}
                        title={t('actionCherryPick')}
                        type="button"
                      >
                        {t('actionCherryPick')}
                      </button>
                      <button
                        className="toolbar-button"
                        disabled={abortCherryPickDisabled}
                        onClick={abortCherryPick}
                        title={t('actionAbort')}
                        type="button"
                      >
                        {t('actionAbort')}
                      </button>
                    </div>
                  </header>

                  <div className="commit-detail-grid">
                    <section className="commit-file-panel" aria-label={t('commitChangedFiles')}>
                      <header className="commit-panel-header">
                        <span>{t('commitChangedFiles')}</span>
                        <span>{state.commitFiles.length}</span>
                      </header>
                      {state.isHistoryDetailsLoading ? (
                        <LoadingPlaceholder label={t('commitFileLoading')} />
                      ) : state.commitFiles.length === 0 ? (
                        <div className="empty-inline">{state.historyDetailsMessage ?? t('commitEmptyFile')}</div>
                      ) : (
                        <div className="commit-file-list" role="listbox">
                          {state.commitFiles.map((file) => (
                            <CommitFileRow
                              file={file}
                              isSelected={file.path === state.selectedCommitFilePath}
                              key={`${file.status}-${file.previousPath ?? ''}-${file.path}`}
                              onSelect={() => selectCommitFile(file.path)}
                            />
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="diff-panel" aria-label={t('historyFileDiff')}>
                      <header className="commit-panel-header">
                        <span>{state.selectedCommitFilePath || t('labelDiff')}</span>
                      </header>
                      {state.isHistoryDetailsLoading ? (
                        <LoadingPlaceholder label={t('changesDiffLoading')} />
                      ) : state.commitDiff.trim() === '' ? (
                        <div className="empty-inline">{state.historyDetailsMessage ?? t('commitNoFileDiff')}</div>
                      ) : (
                        <DiffText diffText={state.commitDiff} label={t('historyFileDiff')} />
                      )}
                    </section>
                  </div>
                </section>
              </div>
            )}
          </section>
        ) : null}
      </section>

      {state.dialogMode === 'create' ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="create-worktree-title" className="dialog" role="dialog">
            <header className="dialog__header">
              <div>
                <h2 id="create-worktree-title">{t('dialogCreateWorktreeTitle')}</h2>
                <p>{t('dialogCreateWorktreeDescription')}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setState((current) => ({ ...current, dialogMode: null }))}
                type="button"
              >
                {t('actionClose')}
              </button>
            </header>

            <label className="field-label" htmlFor="create-branch">
              {t('dialogBranchName')}
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
              {t('dialogWorktreePath')}
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
              {t('dialogBaseRef')}
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
                {t('actionCancel')}
              </button>
              <button className="primary-button" disabled={createDisabled} onClick={createWorktree} type="button">
                {t('actionCreate')}
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
                <h2 id="remove-worktree-title">{t('dialogRemoveWorktreeTitle')}</h2>
                <p>{selectedWorktree.path}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setState((current) => ({ ...current, dialogMode: null }))}
                type="button"
              >
                {t('actionClose')}
              </button>
            </header>

            <div className="danger-panel">
              {t('dialogRemoveWorktreeDescription')}
            </div>

            <label className="checkbox-row">
              <input
                checked={state.removeForce}
                onChange={(event) => setState((current) => ({ ...current, removeForce: event.target.checked }))}
                type="checkbox"
              />
              <span>{t('dialogForceRemove')}</span>
            </label>

            <footer className="dialog__footer">
              <button
                className="secondary-button"
                onClick={() => setState((current) => ({ ...current, dialogMode: null }))}
                type="button"
              >
                {t('actionCancel')}
              </button>
              <button className="danger-button" disabled={removeDisabled} onClick={removeWorktree} type="button">
                {t('actionRemoveWorktree')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export { App };
