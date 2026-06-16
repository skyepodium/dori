import type { GitCommit, GitStatus, Repository, Worktree } from '../types';

export const IPC_CHANNELS = Object.freeze({
  GIT_OPEN_REPOSITORY: 'git:open-repository',
  GIT_LIST_WORKTREES: 'git:list-worktrees',
  GIT_CREATE_WORKTREE: 'git:create-worktree',
  GIT_REMOVE_WORKTREE: 'git:remove-worktree',
  GIT_GET_STATUS: 'git:get-status',
  GIT_GET_HISTORY: 'git:get-history',
  GIT_COMMIT: 'git:commit',
  GIT_FETCH: 'git:fetch',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push'
} as const);

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type DoriIpcError = {
  code: string;
  message: string;
};

export type DoriIpcResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: DoriIpcError;
    };

export type GitCommandResult = {
  output: string;
};

export type DoriGitApi = {
  openRepository: (repositoryPath: string) => Promise<DoriIpcResult<Repository>>;
  listWorktrees: (repositoryPath: string) => Promise<DoriIpcResult<Worktree[]>>;
  createWorktree: (
    repositoryPath: string,
    branchName: string,
    worktreePath: string,
    baseRef: string
  ) => Promise<DoriIpcResult<GitCommandResult>>;
  removeWorktree: (
    repositoryPath: string,
    worktreePath: string,
    force?: boolean
  ) => Promise<DoriIpcResult<GitCommandResult>>;
  getStatus: (worktreePath: string) => Promise<DoriIpcResult<GitStatus>>;
  getHistory: (
    worktreePath: string,
    limit?: number
  ) => Promise<DoriIpcResult<GitCommit[]>>;
  commit: (worktreePath: string, message: string) => Promise<DoriIpcResult<GitCommandResult>>;
  fetch: (repositoryPath: string) => Promise<DoriIpcResult<GitCommandResult>>;
  pull: (worktreePath: string) => Promise<DoriIpcResult<GitCommandResult>>;
  push: (worktreePath: string) => Promise<DoriIpcResult<GitCommandResult>>;
};
