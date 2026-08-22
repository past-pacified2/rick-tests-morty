import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { parseNameParam } from '@/lib/parseNameParam';

/** Keystrokes settle before a request goes out. */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * The list page's name filter.
 *
 * The term lives in the URL rather than in this component, so a search survives a
 * reload and a shared link. The input keeps its own state meanwhile: writing every
 * keystroke to the URL would fire a request per character.
 */
export function CharacterSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlName = parseNameParam(searchParams.get('name'));
  const [term, setTerm] = useState(urlName);

  const [syncedName, setSyncedName] = useState(urlName);

  // The URL moved under us: Back, a link, anything that was not this input.
  if (urlName !== syncedName) {
    setSyncedName(urlName);
    // ...unless it moved because of us. The debounce writes term.trim(), so an
    // equal value is our own write echoing back, and overwriting term here would
    // eat a trailing space the user is still typing.
    if (urlName !== term.trim()) setTerm(urlName);
  }

  useEffect(() => {
    // Covers mount too: nothing to write when the input already matches the URL.
    if (term.trim() === urlName) return;

    const timer = setTimeout(() => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          const trimmed = term.trim();

          if (trimmed === '') {
            next.delete('name');
          } else {
            next.set('name', trimmed);
          }

          // A new term invalidates the page number: page 4 of a 2-page result 404s.
          next.delete('page');

          return next;
        },
        // Keeps a keystroke-by-keystroke history out of the back button.
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [term, urlName, setSearchParams]);

  return (
    <div className="mt-4">
      <label htmlFor="character-search" className="sr-only">
        Search characters by name
      </label>
      <input
        id="character-search"
        type="search"
        value={term}
        placeholder="Search characters"
        onChange={(event) => {
          setTerm(event.target.value);
        }}
        className="w-full max-w-md rounded-md border-2 border-slate-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-slate-700"
      />
    </div>
  );
}
