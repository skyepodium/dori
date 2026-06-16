import type { AppIpcResult } from '../../shared/constants/ipc';

const DEFAULT_INVALID_IPC_RESPONSE_MESSAGE = 'Git operation returned an invalid response.';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readIpcErrorMessage = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return null;
  }

  const error = value.error;

  if (!isRecord(error) || typeof error.message !== 'string' || error.message.trim() === '') {
    return null;
  }

  return error.message;
};

export const unwrapIpcResult = async <T,>(resultPromise: Promise<AppIpcResult<T>>): Promise<T> => {
  const result: unknown = await resultPromise;

  if (isRecord(result) && result.ok === true) {
    return result.data as T;
  }

  if (isRecord(result) && result.ok === false) {
    throw new Error(readIpcErrorMessage(result) ?? DEFAULT_INVALID_IPC_RESPONSE_MESSAGE);
  }

  throw new Error(DEFAULT_INVALID_IPC_RESPONSE_MESSAGE);
};
