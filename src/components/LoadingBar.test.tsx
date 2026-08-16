import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadingBar, SHOW_DELAY_MS } from './LoadingBar';

describe('the loading bar component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appears only after the delay, and goes as soon as fetching stops', async () => {
    let settle!: () => void;
    const pending = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const queryClient = new QueryClient();
    void queryClient.prefetchQuery({ queryKey: ['probe'], queryFn: () => pending });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <LoadingBar />
      </QueryClientProvider>,
    );

    // The bar is aria-hidden, no semantic query can find it.
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS - 1);
    });

    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).not.toBeNull();

    await act(async () => {
      settle();
      await vi.runAllTimersAsync();
    });

    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });
});
