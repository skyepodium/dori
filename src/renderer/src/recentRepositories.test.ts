import { describe, expect, it } from 'vitest';
import { addRecentRepositoryPath } from './recentRepositories';

describe('recent repository ordering', () => {
  it('adds a new repository to the front', () => {
    expect(addRecentRepositoryPath(['/repo/one'], '/repo/two')).toEqual(['/repo/two', '/repo/one']);
  });

  it('does not duplicate or reorder an existing repository', () => {
    const repositories = ['/repo/one', '/repo/two'];

    expect(addRecentRepositoryPath(repositories, '/repo/two')).toBe(repositories);
  });

  it('ignores empty paths', () => {
    const repositories = ['/repo/one'];

    expect(addRecentRepositoryPath(repositories, '   ')).toBe(repositories);
  });
});
