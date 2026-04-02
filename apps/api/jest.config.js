/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.\\./)+lib/supabase$': '<rootDir>/src/__tests__/__mocks__/supabase.ts',
    '^(\\.\\./)+lib/logger$':   '<rootDir>/src/__tests__/__mocks__/logger.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true } }],
  },
  collectCoverageFrom: [
    'src/middleware/**/*.ts',
    'src/services/moneroo.ts',
    'src/services/stripe.ts',
    '!src/**/__tests__/**',
  ],
}
