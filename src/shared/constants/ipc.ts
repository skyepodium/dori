import type {
  GitBranch,
  GitChangedFile,
  GitCommit,
  GitDiffScope,
  GitIdentity,
  GitStatus,
  GitWorkingTreeDiff,
  Repository,
  Worktree
} from '../types';

export const IPC_CHANNELS = Object.freeze({
  GIT_SELECT_REPOSITORY_DIRECTORY: 'git:select-repository-directory',
  GIT_OPEN_REPOSITORY: 'git:open-repository',
  GIT_LIST_WORKTREES: 'git:list-worktrees',
  GIT_CREATE_WORKTREE: 'git:create-worktree',
  GIT_REMOVE_WORKTREE: 'git:remove-worktree',
  GIT_GET_STATUS: 'git:get-status',
  GIT_GET_IDENTITY: 'git:get-identity',
  GIT_GET_HISTORY: 'git:get-history',
  GIT_GET_COMMIT_FILES: 'git:get-commit-files',
  GIT_GET_COMMIT_FILE_DIFF: 'git:get-commit-file-diff',
  GIT_GET_CHANGED_FILE_DIFF: 'git:get-changed-file-diff',
  GIT_LIST_BRANCHES: 'git:list-branches',
  GIT_CHERRY_PICK: 'git:cherry-pick',
  GIT_ABORT_CHERRY_PICK: 'git:abort-cherry-pick',
  GIT_COMMIT: 'git:commit',
  GIT_FETCH: 'git:fetch',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push'
} as const);

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type AppIpcError = {
  code: string;
  message: string;
};

export type AppIpcResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: AppIpcError;
    };

export type GitCommandResult = {
  output: string;
};

export type DirectorySelectionResult = {
  path: string | null;
};

export type GitClientApi = {
  selectRepositoryDirectory: () => Promise<AppIpcResult<DirectorySelectionResult>>;
  openRepository: (repositoryPath: string) => Promise<AppIpcResult<Repository>>;
  listWorktrees: (repositoryPath: string) => Promise<AppIpcResult<Worktree[]>>;
  createWorktree: (
    repositoryPath: string,
    branchName: string,
    worktreePath: string,
    baseRef: string
  ) => Promise<AppIpcResult<GitCommandResult>>;
  removeWorktree: (
    repositoryPath: string,
    worktreePath: string,
    force?: boolean
  ) => Promise<AppIpcResult<GitCommandResult>>;
  getStatus: (worktreePath: string) => Promise<AppIpcResult<GitStatus>>;
  getIdentity: (worktreePath: string) => Promise<AppIpcResult<GitIdentity>>;
  getHistory: (
    worktreePath: string,
    limit?: number
  ) => Promise<AppIpcResult<GitCommit[]>>;
  getCommitFiles: (worktreePath: string, commitSha: string) => Promise<AppIpcResult<GitChangedFile[]>>;
  getCommitFileDiff: (
    worktreePath: string,
    commitSha: string,
    filePath: string
  ) => Promise<AppIpcResult<GitCommandResult>>;
  getChangedFileDiff: (
    worktreePath: string,
    filePath: string,
    diffScope: GitDiffScope
  ) => Promise<AppIpcResult<GitWorkingTreeDiff>>;
  listBranches: (worktreePath: string) => Promise<AppIpcResult<GitBranch[]>>;
  cherryPick: (worktreePath: string, commitSha: string) => Promise<AppIpcResult<GitCommandResult>>;
  abortCherryPick: (worktreePath: string) => Promise<AppIpcResult<GitCommandResult>>;
  commit: (worktreePath: string, message: string) => Promise<AppIpcResult<GitCommandResult>>;
  fetch: (repositoryPath: string) => Promise<AppIpcResult<GitCommandResult>>;
  pull: (worktreePath: string) => Promise<AppIpcResult<GitCommandResult>>;
  push: (worktreePath: string) => Promise<AppIpcResult<GitCommandResult>>;
};
