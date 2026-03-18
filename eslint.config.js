import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  typescript: true,
  node: true,
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'off',
    'ts/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'style/member-delimiter-style': 'off',
  },
  ignores: ['node_modules', '.vscode'],
})
