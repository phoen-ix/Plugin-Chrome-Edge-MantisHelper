import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['e2e/'] },
  js.configs.recommended,
  {
    // Classic scripts: the service worker (importScripts) and the options page
    files: ['data/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker, ...globals.webextensions },
    },
  },
  { files: ['tests/**/*.mjs'], languageOptions: { globals: globals.node } },
]
