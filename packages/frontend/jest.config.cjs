module.exports = {
  transform: { "\\.(js|jsx|ts|tsx)$": ["@sucrase/jest-plugin", { jsxRuntime: "automatic" }] },
  testEnvironment: "jsdom",
  displayName: { name: "frontend", color: "magentaBright" },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    // CSS modules resolve to a proxy where styles.foo === "foo", so class names are assertable.
    "\\.module\\.css$": "identity-obj-proxy",
    "\\.css$": "<rootDir>/tests/__mocks__/styleMock.cjs",
    "\\.svg$": "<rootDir>/tests/__mocks__/fileMock.cjs",
    // The validator's web bundle is browser-only (and hidden behind the package's
    // exports map), so tests always run against a mock.
    "^psychds-validator/web/psychds-validator\\.js$":
      "<rootDir>/tests/__mocks__/psychds-validator-web.ts",
    "^jsonld$": "<rootDir>/tests/__mocks__/jsonld.ts",
    // Resolve the workspace library from source so tests don't require a prior build,
    // mirroring how packages/metadata's own tests import from src.
    "^@jspsych/metadata$": "<rootDir>/../metadata/src/index.ts",
    // fflate's package exports default to the browser build (requires browser Worker).
    // Redirect to the Node.js build so tests can use worker_threads instead.
    "^fflate$": "<rootDir>/../../node_modules/fflate/lib/node.cjs",
  },
};
