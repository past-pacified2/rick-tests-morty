import { describe, expect, it, vi } from 'vitest';

import { recoverFromStaleDeploy, type RecoveryWindow } from './staleDeploy';

/**
 * A tab's worth of state, without a browser.
 *
 * jsdom's `location.reload` and `location.replace` are unimplemented and its
 * `sessionStorage` cannot be made to refuse a write, so the two branches worth testing
 * here are the two jsdom cannot produce.
 */
function makeWindow(stored: string | null = null) {
  const storage = new Map<string, string>();
  if (stored !== null) {
    storage.set('rick-tests-morty:preload-recovery', stored);
  }

  const window: RecoveryWindow = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
    },
    location: { reload: vi.fn(), replace: vi.fn() },
  };

  return { window, storage };
}

/** Matches the module's own cooldown; the boundary cases below only mean anything against it. */
const COOLDOWN_MS = 10_000;

describe('recoverFromStaleDeploy', () => {
  it('reloads when nothing has been tried in this tab', () => {
    const { window } = makeWindow();

    expect(recoverFromStaleDeploy(window, 1_000, null)).toBe(true);
    expect(window.location.reload).toHaveBeenCalledOnce();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('replaces the pending route rather than reloading the one being left', () => {
    const { window } = makeWindow();

    expect(recoverFromStaleDeploy(window, 1_000, '/character/42?from=list')).toBe(true);
    expect(window.location.replace).toHaveBeenCalledWith('/character/42?from=list');
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('records when it went, so the next failure can tell how long ago that was', () => {
    const { window, storage } = makeWindow();

    recoverFromStaleDeploy(window, 1_234, null);

    expect(storage.get('rick-tests-morty:preload-recovery')).toBe('1234');
  });

  it('does nothing when this tab tried a moment ago', () => {
    const { window } = makeWindow('1000');

    expect(recoverFromStaleDeploy(window, 1_000 + COOLDOWN_MS - 1, null)).toBe(false);
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it('tries again once the cooldown is up', () => {
    const { window } = makeWindow('1000');

    expect(recoverFromStaleDeploy(window, 1_000 + COOLDOWN_MS, null)).toBe(true);
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it('treats an unreadable marker as no attempt at all', () => {
    const { window } = makeWindow('not a number');

    expect(recoverFromStaleDeploy(window, 1_000, null)).toBe(true);
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it('stays put when storage refuses the read, since a reload it cannot remember repeats', () => {
    const { window } = makeWindow();
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(recoverFromStaleDeploy(window, 1_000, '/character/42')).toBe(false);
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('stays put when storage refuses the write', () => {
    const { window } = makeWindow();
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });

    expect(recoverFromStaleDeploy(window, 1_000, null)).toBe(false);
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
