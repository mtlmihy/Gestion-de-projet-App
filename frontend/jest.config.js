export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  testMatch: ['**/__tests__/**/*.test.jsx', '**/?(*.)+(spec|test).jsx'],
  collectCoverageFrom: [
    'src/**/*.jsx',
    '!src/main.jsx',
    '!src/index.jsx',
  ],
};
