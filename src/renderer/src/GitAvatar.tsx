import { useEffect, useState, type ReactElement } from 'react';
import { createAuthorInitials, createGravatarAvatarUrl, normalizeAvatarEmail } from './avatar';

type GitAvatarProps = {
  authorEmail: string;
  authorName: string;
  label: string;
  primaryImageUrl?: string | null;
  size: 'compact' | 'regular';
};

const AVATAR_IMAGE_SIZE_PX: Record<GitAvatarProps['size'], number> = Object.freeze({
  compact: 40,
  regular: 64
});

const GitAvatar = ({ authorEmail, authorName, label, primaryImageUrl = null, size }: GitAvatarProps): ReactElement => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(normalizeAvatarEmail(authorEmail) === '');
  const initials = createAuthorInitials(authorName, authorEmail);
  const imageUrl = showFallback ? null : imageUrls[imageIndex] ?? null;

  useEffect(() => {
    let isMounted = true;
    const normalizedPrimaryImageUrl = primaryImageUrl?.trim() ?? '';
    const normalizedEmail = normalizeAvatarEmail(authorEmail);

    setImageUrls([]);
    setImageIndex(0);
    setShowFallback(normalizedPrimaryImageUrl === '' && normalizedEmail === '');

    if (normalizedPrimaryImageUrl === '' && normalizedEmail === '') {
      return () => {
        isMounted = false;
      };
    }

    const loadAvatarUrls = async (): Promise<string[]> => {
      const urls = normalizedPrimaryImageUrl === '' ? [] : [normalizedPrimaryImageUrl];

      if (normalizedEmail !== '') {
        urls.push(await createGravatarAvatarUrl(authorEmail, AVATAR_IMAGE_SIZE_PX[size]));
      }

      return urls;
    };

    void loadAvatarUrls()
      .then((urls) => {
        if (isMounted) {
          setImageUrls(urls);
          setShowFallback(urls.length === 0);
        }
      })
      .catch(() => {
        if (isMounted) {
          setImageUrls(normalizedPrimaryImageUrl === '' ? [] : [normalizedPrimaryImageUrl]);
          setShowFallback(normalizedPrimaryImageUrl === '');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authorEmail, primaryImageUrl, size]);

  const handleImageError = (): void => {
    setImageIndex((currentIndex) => {
      if (currentIndex + 1 < imageUrls.length) {
        return currentIndex + 1;
      }

      setShowFallback(true);
      return currentIndex;
    });
  };

  return (
    <span aria-label={label} className={`git-avatar git-avatar--${size}`} title={label}>
      {imageUrl !== null && !showFallback ? (
        <img alt="" className="git-avatar__image" onError={handleImageError} src={imageUrl} />
      ) : (
        <span className="git-avatar__fallback">{initials}</span>
      )}
    </span>
  );
};

export { GitAvatar };
