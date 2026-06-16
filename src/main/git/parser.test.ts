import { describe, expect, it } from 'vitest';
import { parseBranches, parseCommitFiles, parseStatus, parseWorktreeList } from './parser';

describe('parseWorktreeList', () => {
  it('turns porcelain worktree output into workspace records', () => {
    const output = [
      'worktree /repo',
      'HEAD 1111111111111111111111111111111111111111',
      'branch refs/heads/main',
      '',
      'worktree /repo-feature',
      'HEAD 2222222222222222222222222222222222222222',
      'branch refs/heads/feature/login',
      '',
      'worktree /repo-detached',
      'HEAD 3333333333333333333333333333333333333333',
      'detached',
      'locked maintenance',
      ''
    ].join('\n');

    expect(parseWorktreeList(output)).toEqual([
      {
        id: '/repo',
        repoId: '/repo',
        path: '/repo',
        branch: 'main',
        headSha: '1111111111111111111111111111111111111111',
        isMainWorktree: true,
        hasChanges: false,
        isLocked: false
      },
      {
        id: '/repo-feature',
        repoId: '/repo',
        path: '/repo-feature',
        branch: 'feature/login',
        headSha: '2222222222222222222222222222222222222222',
        isMainWorktree: false,
        hasChanges: false,
        isLocked: false
      },
      {
        id: '/repo-detached',
        repoId: '/repo',
        path: '/repo-detached',
        branch: '(detached)',
        headSha: '3333333333333333333333333333333333333333',
        isMainWorktree: false,
        hasChanges: false,
        isLocked: true
      }
    ]);
  });
});

describe('parseStatus', () => {
  it('extracts branch, ahead/behind counts, and file groups', () => {
    const output = [
      '## feature/login...origin/feature/login [ahead 2, behind 1]',
      ' M src/app.ts',
      'A  src/new.ts',
      '?? notes.md',
      'UU src/conflict.ts'
    ].join('\n');

    expect(parseStatus(output)).toEqual({
      currentBranch: 'feature/login',
      ahead: 2,
      behind: 1,
      staged: [{ path: 'src/new.ts', status: 'A' }],
      unstaged: [{ path: 'src/app.ts', status: 'M' }],
      untracked: [{ path: 'notes.md', status: '??' }],
      conflicts: [{ path: 'src/conflict.ts', status: 'UU' }]
    });
  });
});

describe('parseCommitFiles', () => {
  it('turns diff-tree name-status output into changed file rows', () => {
    const output = [
      'A\tsrc/new.ts',
      'M\tsrc/app.ts',
      'D\tsrc/old.ts',
      'R100\tsrc/before.ts\tsrc/after.ts',
      'C75\tsrc/source.ts\tsrc/copy.ts'
    ].join('\n');

    expect(parseCommitFiles(output)).toEqual([
      { path: 'src/new.ts', status: 'A' },
      { path: 'src/app.ts', status: 'M' },
      { path: 'src/old.ts', status: 'D' },
      { path: 'src/after.ts', previousPath: 'src/before.ts', status: 'R' },
      { path: 'src/copy.ts', previousPath: 'src/source.ts', status: 'C' }
    ]);
  });

  it('ignores empty diff-tree lines', () => {
    expect(parseCommitFiles('\nA\tsrc/new.ts\n\n')).toEqual([{ path: 'src/new.ts', status: 'A' }]);
  });
});

describe('parseBranches', () => {
  it('turns formatted branch output into branch rows', () => {
    const output = ['main', 'feature/login', '', 'release/1.0'].join('\n');

    expect(parseBranches(output)).toEqual([
      { name: 'main' },
      { name: 'feature/login' },
      { name: 'release/1.0' }
    ]);
  });
});
