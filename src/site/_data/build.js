module.exports = {
  timestamp: Date.now(),
  // true under `npm start`, false in the production build — for dev-only
  // tools like the homepage's design options switcher
  dev: process.env.ELEVENTY_ENV !== "prod"
};
