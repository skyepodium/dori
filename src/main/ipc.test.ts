import { describe, expect, it } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { GitServiceError } from './git/service';
import { registerGitIpcHandlers } from './ipc';
import { IPC_CHANNELS } from '../shared/constants/ipc';
import type {
  GitBranch,
  GitChangedFile,
  GitCommit,
  GitFileDiff,
  GitStatus,
  GitWorkingTreeDiff,
  Repository,
  Worktree
} from '../shared/types';

type RegisteredHandler = (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>;

type FakeIpcMain = {
  handle: (channel: string, handler: RegisteredHandler) => void;
};

const EMPTY_STATUS: GitStatus = {
  currentBranch: 'main',
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  untracked: [],
  conflicts: []
};

const createRepository = (path: string): Repository => ({
  id: path,
  path,
  name: 'repo',
  currentBranch: 'main'
});

const createWorktree = (path: string): Worktree => ({
  id: path,
  repoId: '/repo',
  path,
  branch: 'main',
  headSha: '1111111111111111111111111111111111111111',
  isMainWorktree: true,
  hasChanges: false,
  isLocked: false
});

const createGitService = () => ({
  openRepository: async (repositoryPath: string): Promise<Repository> => createRepository(repositoryPath),
  listWorktrees: async (repositoryPath: string): Promise<Worktree[]> => [createWorktree(repositoryPath)],
  createWorktree: async (): Promise<void> => undefined,
  removeWorktree: async (): Promise<void> => undefined,
  getStatus: async (): Promise<GitStatus> => EMPTY_STATUS,
  getHistory: async (): Promise<GitCommit[]> => [],
  getCommitFiles: async (): Promise<GitChangedFile[]> => [],
  getCommitFileDiff: async (): Promise<GitFileDiff> => ({
    commitSha: '1111111111111111111111111111111111111111',
    filePath: 'README.md',
    output: ''
  }),
  getChangedFileDiff: async (
    _worktreePath: string,
    filePath: string,
    diffScope: 'staged' | 'unstaged' | 'untracked' | 'conflicts'
  ): Promise<GitWorkingTreeDiff> => ({
    diffScope,
    filePath,
    output: ''
  }),
  listBranches: async (): Promise<GitBranch[]> => [],
  cherryPick: async (): Promise<void> => undefined,
  abortCherryPick: async (): Promise<void> => undefined,
  commit: async (): Promise<void> => undefined,
  fetch: async (): Promise<void> => undefined,
  pull: async (): Promise<void> => undefined,
  push: async (): Promise<void> => undefined
});

const registerHandlers = (gitService = createGitService()): Map<string, RegisteredHandler> => {
  const handlers = new Map<string, RegisteredHandler>();
  const ipcMain: FakeIpcMain = {
    handle: (channel, handler) => {
      handlers.set(channel, handler);
    }
  };

  registerGitIpcHandlers(ipcMain, gitService);
  return handlers;
};

const invoke = async (handler: RegisteredHandler, payload: unknown): Promise<unknown> => {
  const event = Object.freeze({}) as IpcMainInvokeEvent;
  return handler(event, payload);
};

describe('registerGitIpcHandlers', () => {
  it('wraps successful service results', async () => {
    const handlers = registerHandlers();
    const handler = handlers.get(IPC_CHANNELS.GIT_OPEN_REPOSITORY);

    expect(handler).toBeDefined();

    if (handler === undefined) {
      return;
    }

    await expect(invoke(handler, { repositoryPath: '/repo' })).resolves.toEqual({
      ok: true,
      data: createRepository('/repo')
    });
  });

  it('rejects invalid payloads with a structured IPC error', async () => {
    const handlers = registerHandlers();
    const handler = handlers.get(IPC_CHANNELS.GIT_OPEN_REPOSITORY);

    expect(handler).toBeDefined();

    if (handler === undefined) {
      return;
    }

    await expect(invoke(handler, { repositoryPath: '' })).resolves.toEqual({
      ok: false,
      error: {
        code: 'INVALID_IPC_INPUT',
        message: 'repositoryPath must be a non-empty string.'
      }
    });
  });

  it('preserves GitServiceError codes in structured results', async () => {
    const gitService = {
      ...createGitService(),
      removeWorktree: async (): Promise<void> => {
        throw new GitServiceError({
          code: 'WORKTREE_DIRTY',
          message: 'Worktree has uncommitted changes.'
        });
      }
    };
    const handlers = registerHandlers(gitService);
    const handler = handlers.get(IPC_CHANNELS.GIT_REMOVE_WORKTREE);

    expect(handler).toBeDefined();

    if (handler === undefined) {
      return;
    }

    await expect(
      invoke(handler, {
        repositoryPath: '/repo',
        worktreePath: '/repo-feature',
        force: false
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'WORKTREE_DIRTY',
        message: 'Worktree has uncommitted changes.'
      }
    });
  });

  it('forwards changed file diff requests with a validated scope', async () => {
    const calls: Array<{ worktreePath: string; filePath: string; diffScope: string }> = [];
    const gitService = {
      ...createGitService(),
      getChangedFileDiff: async (
        worktreePath: string,
        filePath: string,
        diffScope: 'staged' | 'unstaged' | 'untracked' | 'conflicts'
      ): Promise<GitWorkingTreeDiff> => {
        calls.push({ worktreePath, filePath, diffScope });
        return {
          diffScope,
          filePath,
          output: 'diff --git a/src/app.ts b/src/app.ts\n'
        };
      }
    };
    const handlers = registerHandlers(gitService);
    const handler = handlers.get(IPC_CHANNELS.GIT_GET_CHANGED_FILE_DIFF);

    expect(handler).toBeDefined();

    if (handler === undefined) {
      return;
    }

    await expect(
      invoke(handler, {
        worktreePath: '/repo',
        filePath: 'src/app.ts',
        diffScope: 'unstaged'
      })
    ).resolves.toEqual({
      ok: true,
      data: {
        diffScope: 'unstaged',
        filePath: 'src/app.ts',
        output: 'diff --git a/src/app.ts b/src/app.ts\n'
      }
    });
    expect(calls).toEqual([
      {
        worktreePath: '/repo',
        filePath: 'src/app.ts',
        diffScope: 'unstaged'
      }
    ]);
  });

  it('rejects changed file diff requests with an invalid scope', async () => {
    const handlers = registerHandlers();
    const handler = handlers.get(IPC_CHANNELS.GIT_GET_CHANGED_FILE_DIFF);

    expect(handler).toBeDefined();

    if (handler === undefined) {
      return;
    }

    await expect(
      invoke(handler, {
        worktreePath: '/repo',
        filePath: 'src/app.ts',
        diffScope: 'index'
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'INVALID_IPC_INPUT',
        message: 'diffScope must be one of: staged, unstaged, untracked, conflicts.'
      }
    });
  });
});
