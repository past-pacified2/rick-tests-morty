import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { CHARACTER_SYSTEM_ERROR_MSG } from '@/api/characters';
import { REQUEST_FAILED, NOT_FOUND } from '@/lib/errors';
import { CHARACTERS_URL, TOTAL_PAGES, PAGE_SIZE, makeCharacterForId, makeCharacter } from '@/test/handlers';
import { renderAt } from '@/test/render';
import { server } from '@/test/server';

describe('the character route', () => {
  it('renders the character details', async () => {
    const characterResponse = makeCharacterForId(3);

    renderAt(`/character/${characterResponse.id.toString()}`);

    expect(await screen.findByRole('heading', { name: characterResponse.name })).toBeInTheDocument();

    const terms = screen.getAllByRole('term').map((el) => el.textContent ?? '');
    const values = screen.getAllByRole('definition').map((el) => el.textContent);

    expect(Object.fromEntries(terms.map((term, i) => [term, values[i]]))).toEqual({
      Status: characterResponse.status,
      Species: characterResponse.species,
      Gender: characterResponse.gender,
      Origin: characterResponse.origin.name,
      Location: characterResponse.location.name,
      Episodes: String(characterResponse.episode.length),
    });

    expect(screen.getByRole('presentation')).toHaveAttribute('src', characterResponse.image);
  });

  it('renders the character details with type', async () => {
    const characterResponse = makeCharacter({ id: 3, type: 'Parasite' });

    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        return HttpResponse.json(characterResponse);
      }),
    );

    renderAt(`/character/${characterResponse.id.toString()}`);

    expect(await screen.findByRole('heading', { name: characterResponse.name })).toBeInTheDocument();

    const terms = screen.getAllByRole('term').map((el) => el.textContent ?? '');
    const values = screen.getAllByRole('definition').map((el) => el.textContent);

    expect(Object.fromEntries(terms.map((term, i) => [term, values[i]]))).toEqual({
      Status: characterResponse.status,
      Species: characterResponse.species,
      Gender: characterResponse.gender,
      Type: characterResponse.type,
      Origin: characterResponse.origin.name,
      Location: characterResponse.location.name,
      Episodes: String(characterResponse.episode.length),
    });

    expect(screen.getByRole('presentation')).toHaveAttribute('src', characterResponse.image);
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
        return HttpResponse.json({ error: CHARACTER_SYSTEM_ERROR_MSG }, { status: 500 });
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
