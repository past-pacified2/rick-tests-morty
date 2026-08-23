import * as z from 'zod';

/**
 * Zod, configured before anything builds a schema with it.
 *
 * Zod compiles a faster parser with `new Function` when it can, and decides whether it
 * can by calling `new Function("")` in a try/catch. Under the Content-Security-Policy in
 * public/_headers that probe throws, Zod swallows it and falls back — but the browser
 * still reports a violation, so the deployed site logged a refusal on every page load.
 *
 * `jitless` skips the probe rather than the fallback: the parser was already the
 * interpreted one, and this only stops it asking. The pages here parse twenty
 * characters at a time, so the compiled path was never worth a CSP exception.
 *
 * A module of its own because the call has to happen first, and "first" was previously
 * whichever data module the bundler happened to evaluate before the rest. Importing `z`
 * from here makes the order a dependency rather than a coincidence, and `no-restricted-
 * imports` fails the build for anyone who reaches for `zod` directly.
 *
 * The layer rule holds: this imports a third-party module and nothing from src/.
 */
// Stryker disable next-line all: `{}` and `jitless: false` both leave a working parser
// behind, so no jsdom test can tell them from this line — jsdom serves no CSP. The layer
// that does cover it is tests/e2e/csp.spec.ts, which Stryker does not run.
z.config({ jitless: true });

export { z };
