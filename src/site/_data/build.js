// Build-time values for templates: `build.timestamp` is added to the
// stylesheet link (?v=…) so browsers fetch the new CSS after each deploy;
// `build.dev` is true under `npm start` and false in the live build (for
// dev-only extras like the design system button).
module.exports = {
  timestamp: Date.now(),
  dev: process.env.ELEVENTY_ENV !== "prod"
};
