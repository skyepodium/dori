const GRAVATAR_AVATAR_BASE_URL = 'https://www.gravatar.com/avatar';
const UNKNOWN_AUTHOR_INITIALS = '?';

const createSha256HexDigest = async (value: string): Promise<string> => {
  const encodedValue = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encodedValue);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const normalizeAvatarEmail = (email: string): string => email.trim().toLowerCase();

export const createGravatarAvatarUrl = async (email: string, sizePx: number): Promise<string> => {
  const normalizedEmail = normalizeAvatarEmail(email);

  if (normalizedEmail === '') {
    throw new Error('Email is required to create an avatar URL.');
  }

  const hash = await createSha256HexDigest(normalizedEmail);
  return `${GRAVATAR_AVATAR_BASE_URL}/${hash}?s=${sizePx}&d=404`;
};

export const createAuthorInitials = (authorName: string, authorEmail: string): string => {
  const nameParts = authorName
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (nameParts.length > 0) {
    return nameParts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  const normalizedEmail = normalizeAvatarEmail(authorEmail);

  if (normalizedEmail.length > 0) {
    return normalizedEmail[0]?.toUpperCase() ?? UNKNOWN_AUTHOR_INITIALS;
  }

  return UNKNOWN_AUTHOR_INITIALS;
};
