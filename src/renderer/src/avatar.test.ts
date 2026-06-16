import { describe, expect, it } from 'vitest';
import {
  createAuthorInitials,
  createGithubAvatarUrl,
  createGravatarAvatarUrl,
  getRepositoryOwnerAvatarUrlForAuthor,
  normalizeAvatarEmail
} from './avatar';

describe('avatar helpers', () => {
  it('normalizes avatar emails before hashing', () => {
    expect(normalizeAvatarEmail('  Ada@Example.COM  ')).toBe('ada@example.com');
  });

  it('creates Gravatar URLs from SHA-256 email hashes', async () => {
    await expect(createGravatarAvatarUrl('  Ada@Example.COM  ', 40)).resolves.toBe(
      'https://www.gravatar.com/avatar/b5fc85e55755f9e0d030a10ab4429b6b2944855f9a0d60077fe832becbc41d72?s=40&d=404'
    );
  });

  it('creates GitHub avatar URLs from repository owners', () => {
    expect(createGithubAvatarUrl('skyepodium', 64)).toBe('https://github.com/skyepodium.png?size=64');
  });

  it('uses repository owner avatars for matching commit authors', () => {
    const repositoryOwnerAvatarUrl = 'https://github.com/skyepodium.png?size=64';

    expect(
      getRepositoryOwnerAvatarUrlForAuthor({
        authorEmail: 'skyepodium@gmail.com',
        authorName: 'Kim Jung yoon',
        identityEmail: 'skyepodium@gmail.com',
        repositoryOwnerAvatarUrl,
        repositoryOwnerLogin: 'skyepodium'
      })
    ).toBe(repositoryOwnerAvatarUrl);
    expect(
      getRepositoryOwnerAvatarUrlForAuthor({
        authorEmail: 'noreply@example.com',
        authorName: 'skyepodium',
        identityEmail: 'skyepodium@gmail.com',
        repositoryOwnerAvatarUrl,
        repositoryOwnerLogin: 'skyepodium'
      })
    ).toBe(repositoryOwnerAvatarUrl);
    expect(
      getRepositoryOwnerAvatarUrlForAuthor({
        authorEmail: 'ada@example.com',
        authorName: 'Ada Lovelace',
        identityEmail: 'skyepodium@gmail.com',
        repositoryOwnerAvatarUrl,
        repositoryOwnerLogin: 'skyepodium'
      })
    ).toBeNull();
  });

  it('creates stable initials from author names and email fallbacks', () => {
    expect(createAuthorInitials('Ada Lovelace', 'ada@example.com')).toBe('AL');
    expect(createAuthorInitials('', 'grace@example.com')).toBe('G');
    expect(createAuthorInitials('', '')).toBe('?');
  });
});
