import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GitService, GitServiceError, type GitRunner } from './service';

describe('GitService', () => {
  it('opens repositories with a GitHub owner avatar from origin remote', async () => {
    const runner: GitRunner = async (args) => {
      if (args.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      if (args.join(' ') === 'branch --show-current') {
        return 'main\n';
      }

      if (args.join(' ') === 'config --get remote.origin.url') {
        return 'git@github.com:skyepodium/repo.git\n';
      }

      return '';
    };
    const service = new GitService(runner);

    await expect(service.openRepository('/repo')).resolves.toEqual({
      id: '/repo',
      path: '/repo',
      name: 'repo',
      currentBranch: 'main',
      ownerAvatarUrl: 'https://github.com/skyepodium.png?size=64'
    });
  });

  it('creates a new branch worktree from a base ref', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return '';
    };
    const service = new GitService(runner);

    await service.createWorktree('/repo', 'feature/login', '/repo-feature', 'main');

    expect(calls).toEqual([
      {
        cwd: '/repo',
        args: ['worktree', 'add', '-b', 'feature/login', '/repo-feature', 'main']
      }
    ]);
  });

  it('refuses to remove a dirty worktree without force', async () => {
    const runner: GitRunner = async (args) => {
      if (args[0] === 'status') return '## feature/login\n M src/app.ts\n';
      return '';
    };
    const service = new GitService(runner);

    await expect(service.removeWorktree('/repo', '/repo-feature')).rejects.toMatchObject({
      code: 'WORKTREE_DIRTY'
    } satisfies Partial<GitServiceError>);
  });

  it('marks listed worktrees as dirty when their status has file changes', async () => {
    const runner: GitRunner = async (args, options) => {
      if (args[0] === 'worktree') {
        return [
          'worktree /repo',
          'HEAD 1111111111111111111111111111111111111111',
          'branch refs/heads/main',
          '',
          'worktree /repo-feature',
          'HEAD 2222222222222222222222222222222222222222',
          'branch refs/heads/feature/login',
          ''
        ].join('\n');
      }

      if (args[0] === 'status' && options?.cwd === '/repo-feature') {
        return '## feature/login\n M src/app.ts\n';
      }

      return '## main\n';
    };
    const service = new GitService(runner);

    await expect(service.listWorktrees('/repo')).resolves.toMatchObject([
      { path: '/repo', hasChanges: false },
      { path: '/repo-feature', hasChanges: true }
    ]);
  });

  it('returns empty history for repositories with no commits yet', async () => {
    const runner: GitRunner = async (args) => {
      if (args[0] === 'log') {
        throw new GitServiceError({
          code: 'GIT_COMMAND_FAILED',
          message: 'fatal: your current branch main does not have any commits yet',
          stderr: 'fatal: your current branch main does not have any commits yet'
        });
      }

      return '';
    };
    const service = new GitService(runner);

    await expect(service.getHistory('/repo')).resolves.toEqual([]);
  });

  it('parses compact commit history from git log output', async () => {
    const runner: GitRunner = async (args) => {
      if (args[0] === 'log') {
        return [
          '1111111111111111111111111111111111111111\x1f1111111\x1fAda Lovelace\x1fada@example.com\x1f2026-06-17T00:00:00+09:00\x1fInitial commit',
          '2222222222222222222222222222222222222222\x1f2222222\x1fGrace Hopper\x1fgrace@example.com\x1f2026-06-17T00:01:00+09:00\x1fAdd parser'
        ].join('\n');
      }

      return '';
    };
    const service = new GitService(runner);

    await expect(service.getHistory('/repo')).resolves.toEqual([
      {
        sha: '1111111111111111111111111111111111111111',
        shortSha: '1111111',
        authorName: 'Ada Lovelace',
        authorEmail: 'ada@example.com',
        authoredAt: '2026-06-17T00:00:00+09:00',
        subject: 'Initial commit'
      },
      {
        sha: '2222222222222222222222222222222222222222',
        shortSha: '2222222',
        authorName: 'Grace Hopper',
        authorEmail: 'grace@example.com',
        authoredAt: '2026-06-17T00:01:00+09:00',
        subject: 'Add parser'
      }
    ]);
  });

  it('reads the configured Git identity for commits', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });

      if (args.join(' ') === 'config --get user.name') {
        return 'Ada Lovelace\n';
      }

      if (args.join(' ') === 'config --get user.email') {
        return 'ada@example.com\n';
      }

      return '';
    };
    const service = new GitService(runner);

    await expect(service.getIdentity('/repo')).resolves.toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com'
    });
    expect(calls).toEqual([
      { cwd: '/repo', args: ['config', '--get', 'user.name'] },
      { cwd: '/repo', args: ['config', '--get', 'user.email'] }
    ]);
  });

  it('returns changed files for a commit', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return ['A\tsrc/new.ts', 'R100\tsrc/old.ts\tsrc/current.ts'].join('\n');
    };
    const service = new GitService(runner);

    await expect(service.getCommitFiles('/repo', 'abc123')).resolves.toEqual([
      { path: 'src/new.ts', status: 'A' },
      { path: 'src/current.ts', previousPath: 'src/old.ts', status: 'R' }
    ]);
    expect(calls).toEqual([
      {
        cwd: '/repo',
        args: ['diff-tree', '--no-commit-id', '--name-status', '-r', '--root', '--find-renames', 'abc123']
      }
    ]);
  });

  it('returns a patch for one file in a commit', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return 'diff --git a/src/app.ts b/src/app.ts\n';
    };
    const service = new GitService(runner);

    await expect(service.getCommitFileDiff('/repo', 'abc123', 'src/app.ts')).resolves.toEqual({
      commitSha: 'abc123',
      filePath: 'src/app.ts',
      output: 'diff --git a/src/app.ts b/src/app.ts\n'
    });
    expect(calls).toEqual([
      {
        cwd: '/repo',
        args: ['show', '--format=', '--find-renames', 'abc123', '--', 'src/app.ts']
      }
    ]);
  });

  it('returns a staged working-tree patch for one changed file', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return 'diff --git a/src/app.ts b/src/app.ts\n';
    };
    const service = new GitService(runner);

    await expect(service.getChangedFileDiff('/repo', 'src/app.ts', 'staged')).resolves.toEqual({
      diffScope: 'staged',
      filePath: 'src/app.ts',
      output: 'diff --git a/src/app.ts b/src/app.ts\n'
    });
    expect(calls).toEqual([
      {
        cwd: '/repo',
        args: ['diff', '--cached', '--', 'src/app.ts']
      }
    ]);
  });

  it('returns an unstaged working-tree patch for one changed file', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return 'diff --git a/src/app.ts b/src/app.ts\n';
    };
    const service = new GitService(runner);

    await expect(service.getChangedFileDiff('/repo', 'src/app.ts', 'unstaged')).resolves.toMatchObject({
      diffScope: 'unstaged',
      filePath: 'src/app.ts'
    });
    expect(calls).toEqual([
      {
        cwd: '/repo',
        args: ['diff', '--', 'src/app.ts']
      }
    ]);
  });

  it('returns a conflict working-tree patch for one changed file', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return 'diff --git a/src/app.ts b/src/app.ts\n';
    };
    const service = new GitService(runner);

    await expect(service.getChangedFileDiff('/repo', 'src/app.ts', 'conflicts')).resolves.toMatchObject({
      diffScope: 'conflicts',
      filePath: 'src/app.ts'
    });
    expect(calls).toEqual([
      {
        cwd: '/repo',
        args: ['diff', '--', 'src/app.ts']
      }
    ]);
  });

  it('synthesizes a readable patch for an untracked changed file', async () => {
    const worktreePath = await mkdtemp(join(tmpdir(), 'git-service-'));
    const filePath = 'src/new.ts';
    const absoluteFilePath = join(worktreePath, filePath);
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return '';
    };
    const service = new GitService(runner);

    try {
      await mkdir(join(worktreePath, 'src'));
      await writeFile(absoluteFilePath, 'const value = 1;\nexport { value };\n');

      await expect(service.getChangedFileDiff(worktreePath, filePath, 'untracked')).resolves.toEqual({
        diffScope: 'untracked',
        filePath,
        output: [
          'diff --git a/src/new.ts b/src/new.ts',
          'new file mode 100644',
          '--- /dev/null',
          '+++ b/src/new.ts',
          '@@ -0,0 +1,2 @@',
          '+const value = 1;',
          '+export { value };',
          ''
        ].join('\n')
      });
      expect(calls).toEqual([]);
    } finally {
      await rm(worktreePath, { force: true, recursive: true });
    }
  });

  it('lists local branches', async () => {
    const runner: GitRunner = async () => ['main', 'feature/login'].join('\n');
    const service = new GitService(runner);

    await expect(service.listBranches('/repo')).resolves.toEqual([{ name: 'main' }, { name: 'feature/login' }]);
  });

  it('runs cherry-pick commands in the worktree', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return '';
    };
    const service = new GitService(runner);

    await service.cherryPick('/repo', 'abc123');
    await service.abortCherryPick('/repo');

    expect(calls).toEqual([
      { cwd: '/repo', args: ['cherry-pick', 'abc123'] },
      { cwd: '/repo', args: ['cherry-pick', '--abort'] }
    ]);
  });

  it('stages every changed file before creating a commit', async () => {
    const calls: Array<{ args: string[]; cwd?: string }> = [];
    const runner: GitRunner = async (args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return '';
    };
    const service = new GitService(runner);

    await service.commit('/repo', 'Update workspace UI');

    expect(calls).toEqual([
      { cwd: '/repo', args: ['add', '--all'] },
      { cwd: '/repo', args: ['commit', '-m', 'Update workspace UI'] }
    ]);
  });

  it('normalizes runner failures into GitServiceError', async () => {
    const runner: GitRunner = async () => {
      throw new Error('fatal: not a git repository');
    };
    const service = new GitService(runner);

    await expect(service.getStatus('/repo')).rejects.toMatchObject({
      code: 'GIT_COMMAND_FAILED',
      command: ['git', 'status', '--short', '--branch'],
      cwd: '/repo'
    } satisfies Partial<GitServiceError>);
  });
});
