import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { parseHistory, parseStatus, parseWorktreeList } from './parser';
import type { GitCommit, GitStatus, Repository, Worktree } from '../../shared/types';

export interface GitRunnerOptions {
  cwd?: string;
}

export type GitRunner = (args: string[], options?: GitRunnerOptions) => Promise<string>;

export type GitServiceErrorCode =
  | 'GIT_COMMAND_FAILED'
  | 'GIT_NOT_REPOSITORY'
  | 'WORKTREE_DIRTY';

interface GitServiceErrorOptions {
  code: GitServiceErrorCode;
  message: string;
  command?: string[];
  cwd?: string;
  exitCode?: number;
  stderr?: string;
}

interface ProcessError extends Error {
  code?: number | string;
}

export class GitServiceError extends Error {
  public readonly code: GitServiceErrorCode;
  public readonly command?: string[];
  public readonly cwd?: string;
  public readonly exitCode?: number;
  public readonly stderr?: string;

  public constructor(options: GitServiceErrorOptions) {
    super(options.message);
    this.name = 'GitServiceError';
    this.code = options.code;
    this.command = options.command;
    this.cwd = options.cwd;
    this.exitCode = options.exitCode;
    this.stderr = options.stderr;
  }
}

const normalizeError = (error: unknown, args: string[], options?: GitRunnerOptions): GitServiceError => {
  if (error instanceof GitServiceError) {
    return error;
  }

  if (error instanceof Error) {
    const processError = error as ProcessError;
    const exitCode = typeof processError.code === 'number' ? processError.code : undefined;

    return new GitServiceError({
      code: 'GIT_COMMAND_FAILED',
      message: error.message,
      command: ['git', ...args],
      cwd: options?.cwd,
      exitCode
    });
  }

  return new GitServiceError({
    code: 'GIT_COMMAND_FAILED',
    message: 'Git command failed.',
    command: ['git', ...args],
    cwd: options?.cwd
  });
};

export const createChildProcessGitRunner = (): GitRunner => {
  const runner: GitRunner = async (args, options) =>
    new Promise((resolve, reject) => {
      execFile('git', args, { cwd: options?.cwd }, (error, stdout, stderr) => {
        if (error !== null) {
          const processError = error as ProcessError;
          reject(
            new GitServiceError({
              code: 'GIT_COMMAND_FAILED',
              message: stderr.trim() || error.message,
              command: ['git', ...args],
              cwd: options?.cwd,
              exitCode: typeof processError.code === 'number' ? processError.code : undefined,
              stderr: stderr.trim() || undefined
            })
          );
          return;
        }

        resolve(stdout);
      });
    });

  return runner;
};

const hasDirtyStatus = (status: GitStatus): boolean =>
  status.staged.length > 0 ||
  status.unstaged.length > 0 ||
  status.untracked.length > 0 ||
  status.conflicts.length > 0;

const isNoCommitHistoryError = (error: unknown): boolean => {
  if (!(error instanceof GitServiceError)) {
    return false;
  }

  const message = `${error.message} ${error.stderr ?? ''}`.toLowerCase();
  return message.includes('does not have any commits yet') || message.includes('your current branch') && message.includes('no commits');
};

export class GitService {
  private readonly runner: GitRunner;

  public constructor(runner: GitRunner = createChildProcessGitRunner()) {
    this.runner = runner;
  }

  private readonly run = async (args: string[], options?: GitRunnerOptions): Promise<string> => {
    try {
      return await this.runner(args, options);
    } catch (error: unknown) {
      throw normalizeError(error, args, options);
    }
  };

  public readonly openRepository = async (repositoryPath: string): Promise<Repository> => {
    const rootPath = (await this.run(['rev-parse', '--show-toplevel'], { cwd: repositoryPath })).trim();
    const currentBranch = (await this.run(['branch', '--show-current'], { cwd: rootPath })).trim();

    if (rootPath.length === 0) {
      throw new GitServiceError({
        code: 'GIT_NOT_REPOSITORY',
        message: 'Path is not a Git repository.',
        cwd: repositoryPath
      });
    }

    return {
      id: rootPath,
      path: rootPath,
      name: basename(rootPath),
      currentBranch: currentBranch.length > 0 ? currentBranch : '(detached)'
    };
  };

  public readonly listWorktrees = async (repositoryPath: string): Promise<Worktree[]> => {
    const output = await this.run(['worktree', 'list', '--porcelain'], { cwd: repositoryPath });
    const worktrees = parseWorktreeList(output);

    return Promise.all(
      worktrees.map(async (worktree) => {
        try {
          const status = await this.getStatus(worktree.path);
          return {
            ...worktree,
            hasChanges: hasDirtyStatus(status)
          };
        } catch (error: unknown) {
          return worktree;
        }
      })
    );
  };

  public readonly createWorktree = async (
    repositoryPath: string,
    branchName: string,
    worktreePath: string,
    baseRef: string
  ): Promise<void> => {
    await this.run(['worktree', 'add', '-b', branchName, worktreePath, baseRef], { cwd: repositoryPath });
  };

  public readonly removeWorktree = async (
    repositoryPath: string,
    worktreePath: string,
    force = false
  ): Promise<void> => {
    if (!force) {
      const status = await this.getStatus(worktreePath);

      if (hasDirtyStatus(status)) {
        throw new GitServiceError({
          code: 'WORKTREE_DIRTY',
          message: 'Worktree has uncommitted changes.',
          cwd: worktreePath
        });
      }
    }

    const forceArgs = force ? ['--force'] : [];
    await this.run(['worktree', 'remove', ...forceArgs, worktreePath], { cwd: repositoryPath });
  };

  public readonly getStatus = async (worktreePath: string): Promise<GitStatus> => {
    const output = await this.run(['status', '--short', '--branch'], { cwd: worktreePath });
    return parseStatus(output);
  };

  public readonly getHistory = async (worktreePath: string, limit = 50): Promise<GitCommit[]> => {
    const args = [
      'log',
      `--max-count=${limit}`,
      '--date=iso-strict',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%s'
    ];
    let output = '';

    try {
      output = await this.run(args, { cwd: worktreePath });
    } catch (error: unknown) {
      if (isNoCommitHistoryError(error)) {
        return [];
      }

      throw error;
    }

    return parseHistory(output);
  };

  public readonly commit = async (worktreePath: string, message: string): Promise<void> => {
    await this.run(['commit', '-m', message], { cwd: worktreePath });
  };

  public readonly fetch = async (repositoryPath: string): Promise<void> => {
    await this.run(['fetch', '--all', '--prune'], { cwd: repositoryPath });
  };

  public readonly pull = async (worktreePath: string): Promise<void> => {
    await this.run(['pull', '--ff-only'], { cwd: worktreePath });
  };

  public readonly push = async (worktreePath: string): Promise<void> => {
    await this.run(['push'], { cwd: worktreePath });
  };
}
