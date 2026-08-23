import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { type Route } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * The Content-Security-Policy in public/_headers, applied to a real page load.
 *
 * Cloudflare serves that file and `vite preview` ignores it, so nothing below the
 * post-deploy smoke run sees the policy at all. The risk covered here is the one smoke
 * catches too late: a policy strict enough to break the app is only visible once it is
 * already deployed.
 *
 * The policy is parsed out of the file rather than repeated here. A copy would drift,
 * and a drifted copy would pass while production broke.
 */
const HEADERS_FILE = fileURLToPath(new URL('../../public/_headers', import.meta.url));

/** Every route with no portrait to wait on, paired with the chunk Vite names after it. */
const LAZY_ROUTES = [
  { path: '/impressum', chunk: 'ImprintRoute' },
  { path: '/privacy', chunk: 'PrivacyRoute' },
  { path: '/500', chunk: 'FatalErrorRoute' },
  { path: '/no-such-page', chunk: 'NotFoundRoute' },
];

const API_REQUEST = /\/api\/character/;
const abortApi = (route: Route) => route.abort();

function policyFromHeadersFile(): string {
  const line = readFileSync(HEADERS_FILE, 'utf8')
    .split('\n')
    .find((candidate) => candidate.trim().startsWith('Content-Security-Policy:'));

  if (line === undefined) {
    throw new Error(`no Content-Security-Policy in ${HEADERS_FILE}`);
  }

  return line.slice(line.indexOf(':') + 1).trim();
}

test('the app runs under the policy public/_headers serves', async ({ page, charactersPage }) => {
  const policy = policyFromHeadersFile();

  // Collected from Node, not from inside the page. Every in-page channel needs script
  // injected to install it — addInitScript, exposeFunction, evaluate — and the policy
  // refuses those as eval, so the apparatus would end up reporting itself.
  // Matched on the vocabulary, not on one phrase. Chrome splits a violation across
  // console arguments, and the part Playwright hands over can be the tail alone —
  // "Note that 'script-src' was not explicitly set..." — which contains neither
  // "Refused to" nor "Content Security Policy". Filtering on either of those missed a
  // real violation that was firing on every page load.
  const CSP_VIOLATION = /Refused to|Content Security Policy|'default-src'|script-src/;
  const refusals: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && CSP_VIOLATION.test(message.text())) {
      refusals.push(message.text().trim());
    }
  });

  // The document only. A CSP header on a sub-resource does nothing, and re-fetching
  // every image and API call through the handler leaves requests in flight at teardown.
  await page.route('**/*', async (route, request) => {
    if (request.resourceType() !== 'document') {
      await route.fallback();
      return;
    }

    const response = await route.fetch();

    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });

  // Navigated rather than clicked, and asserted before any locator runs: Playwright
  // drives locators by evaluating script in the page, which the policy refuses like any
  // other eval. Two hard navigations load both lazy route chunks, the API and the
  // portraits without injecting anything.
  // Waiting on the API call rather than on idle: it only happens once the route's lazy
  // chunk has loaded and run, so it is the signal that the scripts the policy governs
  // actually executed. Armed before the navigation, since goto resolves on load and the
  // request goes out after that.
  // Waited on a portrait, not the API call that precedes it. A response only proves
  // bytes arrived; the portrait is requested by markup that exists because those bytes
  // were parsed and rendered — and parsing is what makes Zod probe for eval.
  const listRendered = page.waitForResponse((response) => response.url().includes('/character/avatar/'));
  const list = await page.goto('/');
  await listRendered;

  const detailRendered = page.waitForResponse((response) => response.url().includes('/character/avatar/'));
  const detail = await page.goto('/character/1');
  await detailRendered;

  // The rest of the routes, which have no portrait to wait on. Their lazy chunk is
  // named after the route component, so its response is the same signal: the scripts
  // the policy governs were fetched and are about to run.
  //
  // Here because the two routes above are the ones that parse an API response, which is
  // what made Zod probe for eval — so they are where a refusal was looked for. A
  // violation on the legal pages, the fatal-error route or an unknown URL had nothing
  // loading them under the policy at all.
  for (const { path, chunk } of LAZY_ROUTES) {
    const chunkLoaded = page.waitForResponse((response) => response.url().includes(`/assets/${chunk}-`));
    const response = await page.goto(path);
    await chunkLoaded;

    expect(response?.status()).toBe(200);
  }

  // And the state a route reaches when the API is gone, which renders markup none of the
  // paths above do. The failed request is the proof the chunk ran: nothing else asks.
  const failedRequest = page.waitForEvent('requestfailed');
  await page.route(API_REQUEST, abortApi);
  await page.goto('/');
  await failedRequest;
  await page.unroute(API_REQUEST, abortApi);

  expect(refusals).toEqual([]);
  expect(list?.status()).toBe(200);
  expect(detail?.status()).toBe(200);

  // Only now that the strict check has been taken: proof the policy left a working page
  // behind rather than a blank one.
  await charactersPage.goto();
  await expect(charactersPage.listItems.first()).toBeVisible();
});
