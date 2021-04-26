module.exports = {
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  testMatch: ['**/*.spec.ts?(x)'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.json',
      isolatedModules: true
    }
  }
}
