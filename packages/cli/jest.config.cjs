module.exports = {
  transform: { "\\.(js|jsx|ts|tsx)$": "@sucrase/jest-plugin" },
  testEnvironment: "node",
  displayName: { name: "cli", color: "cyanBright" },
};
