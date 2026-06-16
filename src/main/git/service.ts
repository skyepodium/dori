import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { parseBranches, parseCommitFiles, parseHistory, parseStatus, parseWorktreeList } from './parser';
import type {
  GitBranch,
  GitCommit,
  GitCommitFile,
  GitDiffScope,
  GitFileDiff,
  GitStatus,
  GitWorkingTreeDiff,
  Repository,
  Worktree
} from '../../shared/types';

export interface GitRunnerOptions {
  cwd?: string;
}

export type GitRunner = (args: string[], options?: GitRunnerOptions) => Promise<string>;

export type GitServiceErrorCode =
  | 'GIT_COMMAND_FAILED'
  | 'GIT_NOT_REPOSITORY'
  | 'INVALID_FILE_PATH'
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

const resolveWorktreeFilePath = (worktreePath: string, filePath: string): string => {
  if (isAbsolute(filePath)) {
    throw new GitServiceError({
      code: 'INVALID_FILE_PATH',
      message: 'File path must be relative to the worktree.',
      cwd: worktreePath
    });
  }

  const rootPath = resolve(worktreePath);
  const absoluteFilePath = resolve(rootPath, filePath);
  const relativeFilePath = relative(rootPath, absoluteFilePath);

  if (relativeFilePath.startsWith('..') || isAbsolute(relativeFilePath)) {
    throw new GitServiceError({
      code: 'INVALID_FILE_PATH',
      message: 'File path must stay inside the worktree.',
      cwd: worktreePath
    });
  }

  return absoluteFilePath;
};

const splitPatchLines = (content: string): { hasTrailingNewline: boolean; lines: string[] } => {
  if (content.length === 0) {
    return {
      hasTrailingNewline: true,
      lines: []
    };
  }

  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const hasTrailingNewline = normalizedContent.endsWith('\n');
  const patchContent = hasTrailingNewline ? normalizedContent.slice(0, -1) : normalizedContent;

  return {
    hasTrailingNewline,
    lines: patchContent.split('\n')
  };
};

const createUntrackedFileDiff = async (worktreePath: string, filePath: string): Promise<string> => {
  const absoluteFilePath = resolveWorktreeFilePath(worktreePath, filePath);
  const buffer = await readFile(absoluteFilePath);

  if (buffer.includes(0)) {
    return [
      `diff --git a/${filePath} b/${filePath}`,
      'new file mode 100644',
      `Binary files /dev/null and b/${filePath} differ`,
      ''
    ].join('\n');
  }

  const { hasTrailingNewline, lines } = splitPatchLines(buffer.toString('utf8'));
  const patchLines = [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`)
  ];

  if (!hasTrailingNewline) {
    patchLines.push('\\ No newline at end of file');
  }

  patchLines.push('');
  return patchLines.join('\n');
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

  public readonly getCommitFiles = async (worktreePath: string, commitSha: string): Promise<GitCommitFile[]> => {
    const output = await this.run(
      ['diff-tree', '--no-commit-id', '--name-status', '-r', '--root', '--find-renames', commitSha],
      { cwd: worktreePath }
    );
    return parseCommitFiles(output);
  };

  public readonly getCommitFileDiff = async (
    worktreePath: string,
    commitSha: string,
    filePath: string
  ): Promise<GitFileDiff> => {
    const diff = await this.run(['show', '--format=', '--find-renames', commitSha, '--', filePath], {
      cwd: worktreePath
    });

    return {
      commitSha,
      filePath,
      output: diff
    };
  };

  public readonly getChangedFileDiff = async (
    worktreePath: string,
    filePath: string,
    diffScope: GitDiffScope
  ): Promise<GitWorkingTreeDiff> => {
    if (diffScope === 'untracked') {
      return {
        diffScope,
        filePath,
        output: await createUntrackedFileDiff(worktreePath, filePath)
      };
    }

    const args = diffScope === 'staged' ? ['diff', '--cached', '--', filePath] : ['diff', '--', filePath];
    const diff = await this.run(args, { cwd: worktreePath });

    return {
      diffScope,
      filePath,
      output: diff
    };
  };

  public readonly listBranches = async (worktreePath: string): Promise<GitBranch[]> => {
    const output = await this.run(['branch', '--format=%(refname:short)'], { cwd: worktreePath });
    return parseBranches(output);
  };

  public readonly commit = async (worktreePath: string, message: string): Promise<void> => {
    await this.run(['add', '--all'], { cwd: worktreePath });
    await this.run(['commit', '-m', message], { cwd: worktreePath });
  };

  public readonly cherryPick = async (worktreePath: string, commitSha: string): Promise<void> => {
    await this.run(['cherry-pick', commitSha], { cwd: worktreePath });
  };

  public readonly abortCherryPick = async (worktreePath: string): Promise<void> => {
    await this.run(['cherry-pick', '--abort'], { cwd: worktreePath });
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
