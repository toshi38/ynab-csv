module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  moduleFileExtensions: ["js"],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  testPathIgnorePatterns: ["<rootDir>/e2e/"],
  collectCoverageFrom: ["src/**/*.js", "!src/**/*.min.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
