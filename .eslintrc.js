module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/essential'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  plugins: [
    'vue'
  ],
  rules: {
    // 性能相关规则
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': 'warn',
    'no-undef': 'error',

    // Vue特定性能规则
    'vue/no-unused-components': 'warn',
    'vue/no-unused-vars': 'warn',
    'vue/require-v-for-key': 'error',
    'vue/no-use-v-if-with-v-for': 'error',
    'vue/require-prop-types': 'warn',
    'vue/require-default-prop': 'warn',

    // 代码质量规则
    'prefer-const': 'warn',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-template': 'warn',
    'prefer-destructuring': 'warn',

    // 性能最佳实践
    'no-loop-func': 'warn',
    'no-inner-declarations': 'warn',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',

    // 内存泄漏预防
    'no-global-assign': 'error',
    'no-implicit-globals': 'error',

    // 代码风格（有助于代码可读性和维护性）
    'indent': ['warn', 2],
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'never'],
    'comma-dangle': ['warn', 'never'],
    'eol-last': 'warn',
    'no-trailing-spaces': 'warn',
    'space-before-function-paren': 'off'
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        // Vue文件特定规则
        'vue/component-name-in-template-casing': ['warn', 'PascalCase'],
        'vue/prop-name-casing': ['warn', 'camelCase'],
        'vue/component-definition-name-casing': ['warn', 'PascalCase']
      }
    }
  ]
}
