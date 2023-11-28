const path = require('path')

module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module'
  },
  plugins: [
    'sonarjs',
    '@typescript-eslint',
    'import',
    'import-helpers',
    '@typescript-eslint/tslint',
    'todo-plz',
    'jest',
    'fp-ts',
    'functional'
  ],
  extends: [
    'plugin:import/typescript',
    'plugin:@typescript-eslint/eslint-recommended',
    'prettier',
    'prettier/@typescript-eslint',
    'plugin:react-hooks/recommended'
  ],
  ignorePatterns: ['node_modules', '**/*.d.ts'],
  rules: {
    'fp-ts/no-redundant-flow': 'error',
    'fp-ts/prefer-traverse': 'error',
    'fp-ts/prefer-chain': 'error',
    'fp-ts/prefer-bimap': 'error',
    'functional/prefer-readonly-type': [
      'error',
      {
        allowLocalMutation: true,
        allowMutableReturnType: true,
        checkImplicit: false,
        ignoreClass: true,
        ignoreInterface: false,
        ignoreCollections: true
      }
    ],
    'sort-imports': [
      'warn',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false
      }
    ],
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/consistent-type-definitions': 'error',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/type-annotation-spacing': 'error',
    '@typescript-eslint/typedef': [
      'warn',
      {
        arrowParameter: false,
        memberVariableDeclaration: false,
        parameter: false,
        propertyDeclaration: true
      }
    ],
    'arrow-parens': ['error', 'as-needed'],
    'comma-dangle': 'error',
    'constructor-super': 'error',
    'default-case': 'error',
    'dot-notation': 'warn',
    'eol-last': 'error',
    eqeqeq: ['error', 'smart'],
    'func-style': ['warn', 'declaration', { allowArrowFunctions: true }],
    'import/no-extraneous-dependencies': [
      'warn',
      {
        devDependencies: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test|mock).[tj]s?(x)']
      }
    ],
    'import/no-unresolved': 'error',
    'no-bitwise': 'warn',
    'no-caller': 'error',
    'no-cond-assign': 'error',
    'no-console': [
      'warn',
      {
        allow: ['info', 'error']
      }
    ],
    'no-control-regex': 'error',
    'no-debugger': 'error',
    'no-duplicate-imports': 'warn',
    'no-empty': 'warn',
    'no-eval': 'error',
    'no-fallthrough': [
      'error',
      {
        commentPattern: 'TODO'
      }
    ],
    'no-invalid-regexp': 'error',
    // "no-invalid-this": "error", // TODO use it instead of tslint after https://github.com/typescript-eslint/typescript-eslint/issues/491
    'no-irregular-whitespace': [
      'error',
      {
        skipRegExps: true
      }
    ],
    'no-multiple-empty-lines': ['error', { max: 1 }],
    'no-new-wrappers': 'error',
    'no-regex-spaces': 'error',
    'no-restricted-globals': [
      'error',
      {
        name: 'FormData',
        message:
          "Consider using `import * as FormData from 'isomorphic-form-data'` or `RequestBuilder.multipartFormData` to have proper typechecking"
      }
    ],
    'no-restricted-properties': [
      2,
      {
        object: 'jest',
        property: 'setTimeout',
        message:
          "We block overriding default jest test timeout to guarantee that all long ran tests run in a separate category, which usually requires network access. \nIf you need more time for the test please try to split it into several cases, or move it into the 'integration tests' area."
      }
    ],
    'no-shadow-restricted-names': 'error',
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'error',
    'no-unused-expressions': ['error', { allowTernary: true }],
    'no-unused-labels': 'error',
    'no-var': 'error',
    'object-curly-spacing': ['error', 'always'],
    'prefer-const': 'warn',
    curly: 'error',
    radix: 'error',

    /* sonarjs from tslint*/
    'sonarjs/no-all-duplicated-branches': 'warn',
    'sonarjs/no-collection-size-mischeck': 'error',
    'sonarjs/no-duplicated-branches': 'error',
    'sonarjs/no-element-overwrite': 'warn',
    'sonarjs/no-identical-conditions': 'error',
    'sonarjs/no-identical-expressions': 'error',
    'sonarjs/no-redundant-jump': 'error',
    'sonarjs/no-unused-collection': 'error',
    /* sonarjs from tslint*/

    'spaced-comment': 'warn',
    'use-isnan': 'error',

    'todo-plz/ticket-ref': ['warn', { pattern: '[A-Z]{2}-[0-9]+', terms: ['FIXME'] }],
    'jest/no-focused-tests': 'error',

    '@typescript-eslint/tslint/config': [
      // turn it off for root eslint config, but turn it back in local config
      'off',
      {
        rulesDirectory: [
          ['@grammarly/tslint-config', 'dist/rules'],
          ['tslint-eslint-rules', 'dist/rules'],
          ['tslint-microsoft-contrib'],
          ['tslint-react', 'rules'],
          ['tslint-sonarts', 'lib/rules']
        ].map(args => getRulesDir(...args)),
        rules: {
          // check mapping of tslint to eslint rules and current status of rules migration here
          // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/ROADMAP.md

          'function-name': [
            true,
            {
              'method-regex': '^[a-z][\\w\\d]+$',
              'private-method-regex': '^__?[a-z][\\w\\d]+$',
              'static-method-regex': '^[a-z][\\w\\d]+$',
              'function-regex': '^[a-z][\\w\\d]+$'
            }
          ],

          /* region sonarts */
          // TODO sonarjs will migrate all rules once https://github.com/SonarSource/eslint-plugin-sonarjs/issues/142
          'no-accessor-field-mismatch': true,
          'no-dead-store': true,
          'no-empty-destructuring': true,
          'no-gratuitous-expressions': true,
          'no-ignored-return': true,
          'no-invalid-this': true, // TODO remove after https://github.com/typescript-eslint/typescript-eslint/issues/491
          'no-multiline-string-literals': true,
          'no-self-assignment': true,
          'no-unnecessary-local-variable': true /* microsoft-contrib*/,
          'no-unnecessary-override': true /* microsoft-contrib*/,
          'no-unthrown-error': true,
          'no-useless-increment': true,
          'no-variable-usage-before-declaration': true,
          /* endregion sonarts */

          'promise-must-complete': true /* microsoft-contrib */
        }
      }
    ]
  },
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname
  },
  rules: {
    // this rule requires type information and therefore requires tsconfig to be resolved via parserOptions
    '@typescript-eslint/no-floating-promises': [
      'warn',
      {
        ignoreVoid: true
      }
    ]
  },
  settings: {
    'import/resolver': {
      typescript: {
        directory: __dirname
      }
    }
  }
}

function getRulesDir(packageName, subDir = '') {
  return path.join(path.dirname(require.resolve(packageName)), subDir)
}
