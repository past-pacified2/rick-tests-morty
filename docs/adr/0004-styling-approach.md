# ADR-0004: Styling Approach

## Status

Accepted — 2026-08-04

## Context

Options considered:

- **Tailwind + a component library** (shadcn/ui, MUI, Mantine)
- **TailwindCSS only** — utility classes, custom design
- **CSS Modules** — scoped styles per component
- **CSS-in-JS** (styled-components, Emotion) — rejected early: runtime cost, and poor fit with React Server Components
  should the app ever move that way

## Decision

**TailwindCSS v4, no component library.**

Tailwind v4 is used through the `@tailwindcss/vite` plugin — no `tailwind.config.js`, no content globs to configure.
`prettier-plugin-tailwindcss` enforces class ordering on save and on commit, so class lists never become a diff-noise
generator.

Base styles (reset, type scale, CSS custom properties) go in `@layer base` so utilities always win the cascade without
`!important`.

A component library was deliberately avoided: the app has two functional views and a handful of components, so a
library's cost (bundle weight, its release cycle, fighting its opinions) exceeds its benefit. Every visual choice here
should be defensible as a choice.

### Testing consequence

This is the reason the decision belongs in an ADR rather than a style guide: **the styling choice determines what is
testable.**

Utility classes carry no semantics, so `expect(el).toHaveClass('bg-red-500')` asserts nothing a user can perceive and
breaks on every redesign. Two rules follow:

1. **Never assert on Tailwind classes.** Component tests query by role, label and text —
   `getByRole('link', { name: /Rick Sanchez/ })`, not `.character-card__title`. That keeps tests coupled to the
   user-visible contract, which is the thing that must not regress.
2. **Visual correctness is therefore untestable at the unit layer**, which is precisely why visual regression tests
   exist in the pipeline ([ADR-0003](./0003-testing-strategy.md)). CSS regressions are real regressions; they simply
   need a screenshot diff rather than an assertion, because there is no assertion that would have caught them.

A component library would have shifted this balance — you inherit its a11y semantics and its visual stability, and test
less of both yourself. That tradeoff was not worth the dependency at this size, but it is the honest argument for one.

## Consequences

**Gained:**

- Full control over the visual design; no third-party release cycle in the critical path
- Zero config overhead with Tailwind v4's native Vite plugin
- Class ordering enforced automatically
- A clear, defensible rule about what component tests may assert on

**Traded off:**

- More CSS written by hand for common patterns
- No inherited accessible primitives — dialog/menu/combobox semantics would have to be built and tested manually.
  Acceptable at this scope; if a modal or combobox is ever needed, adopt Radix rather than hand-rolling ARIA
