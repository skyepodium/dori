import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, isLanguage, translate, type TranslationKey } from './i18n';

const TRANSLATION_KEYS: TranslationKey[] = [
  'labelRepository',
  'labelWorktree',
  'tabChanges',
  'tabHistory',
  'tabWorktrees',
  'errorGitCommandFailed',
  'successCommit'
];

describe('renderer i18n', () => {
  it('provides expected translations for supported languages', () => {
    TRANSLATION_KEYS.forEach((key) => {
      expect(translate('en', key).trim()).not.toBe('');
      expect(translate('ko', key).trim()).not.toBe('');
    });
  });

  it('guards supported language values', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('ko')).toBe(true);
    expect(isLanguage(DEFAULT_LANGUAGE)).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
