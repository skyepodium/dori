import { describe, expect, it } from 'vitest';
import { unwrapIpcResult } from './ipcResult';

describe('unwrapIpcResult', () => {
  it('returns data for successful IPC results', async () => {
    await expect(unwrapIpcResult(Promise.resolve({ ok: true, data: 'done' }))).resolves.toBe('done');
  });

  it('throws the structured error message for failed IPC results', async () => {
    await expect(
      unwrapIpcResult(Promise.resolve({ ok: false, error: { code: 'GIT_OPERATION_FAILED', message: 'Commit failed.' } }))
    ).rejects.toThrow('Commit failed.');
  });

  it('throws a stable renderer-safe error for malformed IPC results', async () => {
    await expect(unwrapIpcResult(Promise.resolve(undefined as never))).rejects.toThrow(
      'Git operation returned an invalid response.'
    );
  });
});
