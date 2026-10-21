// Dev-only pages (the design system), viewable at /dev/<file>/ while running
// `npm start`. Never built in production (ELEVENTY_ENV=prod), so nothing in
// this folder can go live.
module.exports = {
  eleventyExcludeFromCollections: true,
  eleventyComputed: {
    permalink: (data) => (process.env.ELEVENTY_ENV === "prod" ? false : `/dev/${data.page.fileSlug}/`)
  }
};
