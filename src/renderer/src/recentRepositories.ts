const RECENT_REPOSITORIES_LIMIT_COUNT = 12;
export const RECENT_REPOSITORIES_STORAGE_KEY = 'recentRepositoryPaths';

export const readRecentRepositoryPaths = (storage: Storage): string[] => {
  try {
    const storedValue = storage.getItem(RECENT_REPOSITORIES_STORAGE_KEY);

    if (storedValue === null) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch (error: unknown) {
    return [];
  }
};

export const writeRecentRepositoryPaths = (storage: Storage, repositoryPaths: string[]): void => {
  try {
    storage.setItem(RECENT_REPOSITORIES_STORAGE_KEY, JSON.stringify(repositoryPaths));
  } catch (error: unknown) {
    return;
  }
};

export const addRecentRepositoryPath = (repositoryPaths: string[], repositoryPath: string): string[] => {
  const normalizedPath = repositoryPath.trim();

  if (normalizedPath === '') {
    return repositoryPaths;
  }

  if (repositoryPaths.includes(normalizedPath)) {
    return repositoryPaths;
  }

  return [
    normalizedPath,
    ...repositoryPaths
  ].slice(0, RECENT_REPOSITORIES_LIMIT_COUNT);
};
