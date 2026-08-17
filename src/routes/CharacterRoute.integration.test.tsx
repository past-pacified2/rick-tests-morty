import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { SYSTEM_ERROR_MSG } from '@/api/characters';
import { REQUEST_FAILED, NOT_FOUND } from '@/lib/errors';
import { CHARACTERS_URL, TOTAL_PAGES, PAGE_SIZE, makeCharacterForId } from '@/test/handlers';
import { renderAt } from '@/test/render';
import { server } from '@/test/server';

describe('the character route', () => {
  it('renders the character details', async () => {
    const characterResponse = makeCharacterForId(1);

    renderAt('/character/1');

    expect(await screen.findByRole('heading', { name: characterResponse.name })).toBeInTheDocument();
  });

  it('renders 404 message for id not found', async () => {
    const outOfRangeId = TOTAL_PAGES * PAGE_SIZE + 1;

    renderAt(`/character/${outOfRangeId.toString()}`);

    expect(await screen.findByRole('heading', { name: NOT_FOUND.title })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('link', { name: /back to characters/i })).toHaveAttribute('href', '/');
  });

  it('renders 404 message for invalid id without sending request', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        requestCount++;
        return undefined;
      }),
    );

    renderAt('/character/invalid');

    expect(await screen.findByRole('heading', { name: NOT_FOUND.title })).toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('offers a retry button for failed request, and refetching recovers', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        requestCount++;
        return HttpResponse.json({ error: SYSTEM_ERROR_MSG }, { status: 500 });
      }),
    );

    const { user } = renderAt('/character/1');
    expect(await screen.findByRole('heading', { name: REQUEST_FAILED.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to characters/i })).toHaveAttribute('href', '/');

    const characterResponse = makeCharacterForId(1);
    server.resetHandlers();
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        requestCount++;
        return undefined;
      }),
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: characterResponse.name })).toBeInTheDocument();
    expect(requestCount).toBe(2);
  });
});
