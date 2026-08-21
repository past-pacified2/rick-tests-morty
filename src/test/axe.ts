import { axe } from 'jest-axe';
import { expect } from 'vitest';

/**
 * axe at the component layer, the inner half of the two-layer accessibility check in
 * docs/adr/0003-testing-strategy.md. This one catches a regression in the markup a
 * component owns, at the point of change; `@axe-core/playwright` in tests/e2e/a11y.spec.ts
 * catches what only exists after composition — heading order across components,
 * landmark structure, contrast through the real cascade.
 *
 * `axe()` and a plain assertion rather than jest-axe's `toHaveNoViolations` matcher:
 * the matcher's types augment Jest's namespace, not Vitest's, so registering it leaves
 * a matcher TypeScript does not know about. Mapping the violations to their rule ids
 * gives a readable failure without that.
 */

/**
 * `color-contrast` needs layout and a paint, and jsdom has neither — it reports every
 * element as "incomplete" rather than passing or failing. Contrast is checked against
 * the real cascade in the Playwright layer, which is the only place it means anything.
 */
const JSDOM_RULES = { 'color-contrast': { enabled: false } };

/** A component fragment is not a page, so page-level rules do not apply to it. */
const PAGE_RULES = {
  region: { enabled: false },
  'page-has-heading-one': { enabled: false },
  'landmark-one-main': { enabled: false },
};

export async function expectNoViolations(container: Element): Promise<void> {
  const { violations } = await axe(container, { rules: { ...JSDOM_RULES, ...PAGE_RULES } });

  // Mapped to `id: help` rather than asserted whole: a raw violation object is several
  // hundred lines of nodes and related-node pointers, and the rule id is what names the
  // problem.
  expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}
