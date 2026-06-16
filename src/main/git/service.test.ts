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
});
