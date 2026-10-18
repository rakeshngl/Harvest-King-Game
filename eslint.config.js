import js from '@eslint/js'
import globals from 'globals'

const shared = {
  ...js.configs.recommended,
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module'
  }
}

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'data/**']
  },
  {
    ...shared,
    files: ['src/**/*.js', 'vite.config.js'],
    languageOptions: {
      ...shared.languageOptions,
      globals: {
        ...globals.browser
      }
    }
  },
  {
    ...shared,
    files: ['server/**/*.js', 'start.mjs', 'test/**/*.js'],
    languageOptions: {
      ...shared.languageOptions,
      globals: {
        ...globals.node
      }
    }
  }
]
