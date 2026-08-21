import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  const refusals: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
      refusals.push(message.text());
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
  const listLoaded = page.waitForResponse((response) => response.url().includes('/api/character?'));
  const list = await page.goto('/');
  await listLoaded;

  const detailLoaded = page.waitForResponse((response) => /\/api\/character\/\d+$/.test(response.url()));
  const detail = await page.goto('/character/1');
  await detailLoaded;

  expect(refusals).toEqual([]);
  expect(list?.status()).toBe(200);
  expect(detail?.status()).toBe(200);

  // Only now that the strict check has been taken: proof the policy left a working page
  // behind rather than a blank one.
  await charactersPage.goto();
  await expect(charactersPage.listItems.first()).toBeVisible();
});
