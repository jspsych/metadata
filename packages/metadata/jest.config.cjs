const baseConfig = require("@jspsych/config/jest").makePackageConfig(__dirname);

module.exports = {
  ...baseConfig,
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    // csv-parse/browser/esm ships as ESM; Jest can't load it untransformed.
    // Redirect to the CJS build for tests — Vite resolves the real ESM build via package.json exports.
    "^csv-parse/browser/esm$": "<rootDir>/../../node_modules/csv-parse/dist/cjs/index.cjs",
  },
};
