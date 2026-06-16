import type { IpcMain } from 'electron';
import { dialog } from 'electron';
import {
  IPC_CHANNELS,
  type DirectorySelectionResult,
  type AppIpcResult,
  type GitCommandResult,
} from '../shared/constants/ipc';
import type {
  GitBranch,
  GitChangedFile,
  GitCommit,
  GitDiffScope,
  GitStatus,
  GitWorkingTreeDiff,
  Repository,
  Worktree
} from '../shared/types';

type GitServiceApi = {
  openRepository: (repositoryPath: string) => Promise<Repository>;
  listWorktrees: (repositoryPath: string) => Promise<Worktree[]>;
  createWorktree: (
    repositoryPath: string,
    branchName: string,
    worktreePath: string,
    baseRef: string
  ) => Promise<GitCommandResult | void>;
  removeWorktree: (
    repositoryPath: string,
    worktreePath: string,
    force?: boolean
  ) => Promise<GitCommandResult | void>;
  getStatus: (worktreePath: string) => Promise<GitStatus>;
  getHistory: (worktreePath: string, limit?: number) => Promise<GitCommit[]>;
  getCommitFiles: (worktreePath: string, commitSha: string) => Promise<GitChangedFile[]>;
  getCommitFileDiff: (worktreePath: string, commitSha: string, filePath: string) => Promise<GitCommandResult>;
  getChangedFileDiff: (
    worktreePath: string,
    filePath: string,
    diffScope: GitDiffScope
  ) => Promise<GitWorkingTreeDiff>;
  listBranches: (worktreePath: string) => Promise<GitBranch[]>;
  cherryPick: (worktreePath: string, commitSha: string) => Promise<GitCommandResult | void>;
  abortCherryPick: (worktreePath: string) => Promise<GitCommandResult | void>;
  commit: (worktreePath: string, message: string) => Promise<GitCommandResult | void>;
  fetch: (repositoryPath: string) => Promise<GitCommandResult | void>;
  pull: (worktreePath: string) => Promise<GitCommandResult | void>;
  push: (worktreePath: string) => Promise<GitCommandResult | void>;
};

type IpcHandler<T> = (payload: unknown) => Promise<T>;

class IpcValidationError extends Error {
  public readonly code = 'INVALID_IPC_INPUT';
}

const EMPTY_COMMAND_RESULT: GitCommandResult = Object.freeze({ output: '' });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readRequiredString = (payload: unknown, key: string): string => {
  if (!isRecord(payload)) {
    throw new IpcValidationError('IPC payload must be an object.');
  }

  const value = payload[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new IpcValidationError(`${key} must be a non-empty string.`);
  }

  return value;
};

const readOptionalBoolean = (payload: unknown, key: string): boolean | undefined => {
  if (!isRecord(payload)) {
    throw new IpcValidationError('IPC payload must be an object.');
  }

  const value = payload[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new IpcValidationError(`${key} must be a boolean.`);
  }

  return value;
};

const readOptionalPositiveInteger = (payload: unknown, key: string): number | undefined => {
  if (!isRecord(payload)) {
    throw new IpcValidationError('IPC payload must be an object.');
  }

  const value = payload[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new IpcValidationError(`${key} must be a positive integer.`);
  }

  return value;
};

const readGitDiffScope = (payload: unknown): GitDiffScope => {
  const diffScope = readRequiredString(payload, 'diffScope');

  if (
    diffScope !== 'staged' &&
    diffScope !== 'unstaged' &&
    diffScope !== 'untracked' &&
    diffScope !== 'conflicts'
  ) {
    throw new IpcValidationError('diffScope must be one of: staged, unstaged, untracked, conflicts.');
  }

  return diffScope;
};

const normalizeCommandResult = (value: GitCommandResult | void): GitCommandResult => {
  return value ?? EMPTY_COMMAND_RESULT;
};

const readErrorCode = (error: unknown): string => {
  if (error instanceof IpcValidationError) {
    return error.code;
  }

  if (isRecord(error) && typeof error.code === 'string' && error.code.trim().length > 0) {
    return error.code;
  }

  return 'GIT_OPERATION_FAILED';
};

const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Git operation failed.';
};

const toIpcResult = async <T>(handler: IpcHandler<T>, payload: unknown): Promise<AppIpcResult<T>> => {
  try {
    return {
      ok: true,
      data: await handler(payload)
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: readErrorCode(error),
        message: readErrorMessage(error)
      }
    };
  }
};

type IpcMainHandleRegistry = Pick<IpcMain, 'handle'>;

const registerHandler = <T>(ipcMain: IpcMainHandleRegistry, channel: string, handler: IpcHandler<T>): void => {
  ipcMain.handle(channel, async (_event, payload: unknown) => toIpcResult(handler, payload));
};

export const registerGitIpcHandlers = (ipcMain: IpcMainHandleRegistry, gitService: GitServiceApi): void => {
  registerHandler<DirectorySelectionResult>(ipcMain, IPC_CHANNELS.GIT_SELECT_REPOSITORY_DIRECTORY, async () => {
    const selection = await dialog.showOpenDialog({
      title: '저장소 폴더 선택',
      properties: ['openDirectory']
    });

    return {
      path: selection.canceled ? null : selection.filePaths[0] ?? null
    };
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_OPEN_REPOSITORY, async (payload) => {
    const repositoryPath = readRequiredString(payload, 'repositoryPath');
    return gitService.openRepository(repositoryPath);
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_LIST_WORKTREES, async (payload) => {
    return gitService.listWorktrees(readRequiredString(payload, 'repositoryPath'));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_CREATE_WORKTREE, async (payload) => {
    const repositoryPath = readRequiredString(payload, 'repositoryPath');
    const branchName = readRequiredString(payload, 'branchName');
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const baseRef = readRequiredString(payload, 'baseRef');

    return normalizeCommandResult(
      await gitService.createWorktree(repositoryPath, branchName, worktreePath, baseRef)
    );
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_REMOVE_WORKTREE, async (payload) => {
    const repositoryPath = readRequiredString(payload, 'repositoryPath');
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const force = readOptionalBoolean(payload, 'force');

    return normalizeCommandResult(await gitService.removeWorktree(repositoryPath, worktreePath, force));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_GET_STATUS, async (payload) => {
    return gitService.getStatus(readRequiredString(payload, 'worktreePath'));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_GET_HISTORY, async (payload) => {
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const limit = readOptionalPositiveInteger(payload, 'limit');

    return gitService.getHistory(worktreePath, limit);
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_GET_COMMIT_FILES, async (payload) => {
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const commitSha = readRequiredString(payload, 'commitSha');

    return gitService.getCommitFiles(worktreePath, commitSha);
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_GET_COMMIT_FILE_DIFF, async (payload) => {
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const commitSha = readRequiredString(payload, 'commitSha');
    const filePath = readRequiredString(payload, 'filePath');

    return gitService.getCommitFileDiff(worktreePath, commitSha, filePath);
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_GET_CHANGED_FILE_DIFF, async (payload) => {
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const filePath = readRequiredString(payload, 'filePath');
    const diffScope = readGitDiffScope(payload);

    return gitService.getChangedFileDiff(worktreePath, filePath, diffScope);
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_LIST_BRANCHES, async (payload) => {
    return gitService.listBranches(readRequiredString(payload, 'worktreePath'));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_CHERRY_PICK, async (payload) => {
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const commitSha = readRequiredString(payload, 'commitSha');

    return normalizeCommandResult(await gitService.cherryPick(worktreePath, commitSha));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_ABORT_CHERRY_PICK, async (payload) => {
    return normalizeCommandResult(await gitService.abortCherryPick(readRequiredString(payload, 'worktreePath')));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_COMMIT, async (payload) => {
    const worktreePath = readRequiredString(payload, 'worktreePath');
    const message = readRequiredString(payload, 'message');

    return normalizeCommandResult(await gitService.commit(worktreePath, message));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_FETCH, async (payload) => {
    return normalizeCommandResult(await gitService.fetch(readRequiredString(payload, 'repositoryPath')));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_PULL, async (payload) => {
    return normalizeCommandResult(await gitService.pull(readRequiredString(payload, 'worktreePath')));
  });

  registerHandler(ipcMain, IPC_CHANNELS.GIT_PUSH, async (payload) => {
    return normalizeCommandResult(await gitService.push(readRequiredString(payload, 'worktreePath')));
  });
};
