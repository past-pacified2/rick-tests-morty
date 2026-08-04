import { useParams } from 'react-router';

/**
 * Character detail.
 *
 * Placeholder. Echoing the route param is enough to prove that dynamic segments
 * match and that the lazy chunk resolves — which is all this slice claims.
 *
 * When the fetch lands here, an id the API reports as absent must render the
 * not-found route rather than an error page. See docs/adr/0005-routing-strategy.md.
 */
export function CharacterRoute() {
  const { id } = useParams();

  return (
    <>
      <h1 className="text-2xl font-semibold">Character {id}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">Character details will render here.</p>
    </>
  );
}

export { CharacterRoute as Component };
