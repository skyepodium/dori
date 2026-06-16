import { describe, expect, it } from 'vitest';
import { GitService, GitServiceError, type GitRunner } from './service';

describe('GitService', () => {
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
