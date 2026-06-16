import { useEffect, useState, type ReactElement } from 'react';
import { createAuthorInitials, createGravatarAvatarUrl, normalizeAvatarEmail } from './avatar';

type GitAvatarProps = {
  authorEmail: string;
  authorName: string;
  label: string;
  size: 'compact' | 'regular';
};

const AVATAR_IMAGE_SIZE_PX: Record<GitAvatarProps['size'], number> = Object.freeze({
  compact: 40,
  regular: 64
});

const GitAvatar = ({ authorEmail, authorName, label, size }: GitAvatarProps): ReactElement => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(normalizeAvatarEmail(authorEmail) === '');
  const initials = createAuthorInitials(authorName, authorEmail);

  useEffect(() => {
    let isMounted = true;

    setImageUrl(null);
    setShowFallback(normalizeAvatarEmail(authorEmail) === '');

    if (normalizeAvatarEmail(authorEmail) === '') {
      return () => {
        isMounted = false;
      };
    }

    void createGravatarAvatarUrl(authorEmail, AVATAR_IMAGE_SIZE_PX[size])
      .then((url) => {
        if (isMounted) {
          setImageUrl(url);
          setShowFallback(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setShowFallback(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authorEmail, size]);

  return (
    <span aria-label={label} className={`git-avatar git-avatar--${size}`} title={label}>
      {imageUrl !== null && !showFallback ? (
        <img alt="" className="git-avatar__image" onError={() => setShowFallback(true)} src={imageUrl} />
      ) : (
        <span className="git-avatar__fallback">{initials}</span>
      )}
    </span>
  );
};

export { GitAvatar };
