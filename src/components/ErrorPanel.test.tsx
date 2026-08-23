import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorPanel } from '@/components/ErrorPanel';
import { NOT_FOUND, REQUEST_FAILED } from '@/lib/errors';
import { expectNoViolations } from '@/test/axe';

/**
 * The panel renders copy it is handed, so these tests assert the two decisions it makes
 * on its own: which element carries the title, and whether the retry is offered.
 *
 * Nothing asserts that a thrown message stays out of the DOM. The props carry no error
 * object, so there is no message here to leak — that guarantee is the prop type's, and
 * a test for it would pass against any implementation.
 */
describe('the error panel component', () => {
  it('carries the title in an h1 where the route has no other heading', () => {
    render(<ErrorPanel copy={NOT_FOUND} titleAs="h1" onRetry={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: NOT_FOUND.title })).toBeInTheDocument();
  });

  it('carries the title in a paragraph where the route already has an h1', () => {
    render(<ErrorPanel copy={NOT_FOUND} titleAs="p" onRetry={vi.fn()} />);

    expect(screen.getByText(NOT_FOUND.title)).toBeInTheDocument();
    // Any level, not just 1: a second heading of any rank would still be an outline
    // this route did not ask for.
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('announces itself as an alert', () => {
    render(<ErrorPanel copy={REQUEST_FAILED} titleAs="p" onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(REQUEST_FAILED.body);
  });

  it('offers a retry that calls back when the failure is worth retrying', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorPanel copy={REQUEST_FAILED} titleAs="p" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers no retry when the failure is final', () => {
    render(<ErrorPanel copy={NOT_FOUND} titleAs="p" onRetry={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('has no accessibility violations as a page heading', async () => {
    const { container } = render(<ErrorPanel copy={NOT_FOUND} titleAs="h1" onRetry={vi.fn()} />);

    await expectNoViolations(container);
  });

  it('has no accessibility violations beneath a route heading', async () => {
    const { container } = render(<ErrorPanel copy={REQUEST_FAILED} titleAs="p" onRetry={vi.fn()} />);

    await expectNoViolations(container);
  });
});
