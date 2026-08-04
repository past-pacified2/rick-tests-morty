/** @type {import('prettier').Config} */
export default {
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  bracketSpacing: true,
  endOfLine: 'lf',

  // Enforces canonical Tailwind class order, so class lists stop being a source of
  // diff noise and merge conflicts. See docs/adr/0004-styling-approach.md.
  plugins: ['prettier-plugin-tailwindcss'],

  overrides: [
    {
      files: ['*.md'],
      options: { proseWrap: 'always' },
    },
  ],
};
