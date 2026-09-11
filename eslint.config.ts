import antfu from '@antfu/eslint-config'

export default antfu(
  {
    stylistic: {
      overrides: {
        'style/brace-style': ['error', '1tbs'],
      },
    },
  },
  {
    rules: {
      curly: ['error', 'all'],
    },
  },
)
