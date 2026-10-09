import { describe, expect, it, vi } from 'vitest';
import { hasTypingInProgress, isChunkLoadError, loadWithRecovery, mayReload } from './updates';

describe('isChunkLoadError', () => {
  it('recognises a vanished room file in every browser the museum targets', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Observatory-abc.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true); // Safari and iOS
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Archive-x.css'))).toBe(true);
  });

  it('leaves ordinary errors alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('mayReload', () => {
  it('allows a first reload and blocks a loop', () => {
    expect(mayReload(null, 1_000_000)).toBe(true);
    expect(mayReload(1_000_000, 1_005_000)).toBe(false);
    expect(mayReload(1_000_000, 1_040_000)).toBe(true);
    expect(mayReload(Number.NaN, 1_000_000)).toBe(true);
  });
});

describe('loadWithRecovery', () => {
  const chunkError = new TypeError('Importing a module script failed.');

  it('passes a room straight through when it loads', async () => {
    await expect(loadWithRecovery(async () => 'room')).resolves.toBe('room');
  });

  it('reloads instead of crashing when the room file vanished in a deploy', async () => {
    const reload = vi.fn(() => true);
    const pending = loadWithRecovery(() => Promise.reject(chunkError), reload);
    const outcome = await Promise.race([pending.then(() => 'settled', () => 'rejected'), new Promise((r) => setTimeout(() => r('waiting for reload'), 50))]);
    expect(outcome).toBe('waiting for reload');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('gives up and shows the error rather than looping', async () => {
    await expect(loadWithRecovery(() => Promise.reject(chunkError), () => false)).rejects.toBe(chunkError);
  });

  it('never reloads for an unrelated error', async () => {
    const reload = vi.fn(() => true);
    await expect(loadWithRecovery(() => Promise.reject(new Error('real bug')), reload)).rejects.toThrow('real bug');
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('hasTypingInProgress', () => {
  const docWith = (fields: { value: string; disabled?: boolean }[]) =>
    ({ querySelectorAll: () => fields.map((f) => ({ disabled: false, ...f })) }) as unknown as Document;

  it('protects unsaved words', () => {
    expect(hasTypingInProgress(docWith([{ value: '' }, { value: 'Learn the G chord' }]))).toBe(true);
  });
  it('lets an update through when every field is empty or disabled', () => {
    expect(hasTypingInProgress(docWith([{ value: '' }, { value: '   ' }, { value: 'x', disabled: true }]))).toBe(false);
  });
});
