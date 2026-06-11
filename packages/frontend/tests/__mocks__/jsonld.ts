// Stand-in for the `jsonld` package — validatePsychDS only assigns it to
// `window.jsonld` for the validator's browser path, so identity is all that matters.
export default { __mockJsonld: true };
