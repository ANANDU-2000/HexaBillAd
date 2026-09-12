// First-time ESLint enablement for hexabill-ui.
// Unused imports and exhaustive-deps are warnings so CI can enforce real
// correctness (hooks rules, no-undef) without a cosmetic sweep of 200+ leftovers.
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'dist-electron', 'node_modules', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': 'warn',
    'no-prototype-builtins': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': 'off',
  },
  overrides: [
    {
      files: ['*.cjs', '*.config.js', 'tailwind.config.js', 'postcss.config.cjs', 'vite.config.js'],
      env: { node: true },
    },
  ],
}
