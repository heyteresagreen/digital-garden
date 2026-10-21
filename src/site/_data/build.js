// Build-time values for templates: `build.timestamp` is added to the
// stylesheet link (?v=…) so browsers fetch the new CSS after each deploy.
module.exports = {
  timestamp: Date.now()
};
