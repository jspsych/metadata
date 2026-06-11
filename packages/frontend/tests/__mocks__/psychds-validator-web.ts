// Stands in for the browser-only `psychds-validator/web/psychds-validator.js`
// bundle (see moduleNameMapper in jest.config.cjs). Tests drive `validateWeb`
// per-case via mockResolvedValue / mockRejectedValue.
export const validateWeb = jest.fn();
