const slugify = require("@sindresorhus/slugify");
const sections = require("../_data/sections.js").all;

module.exports = {
  layout: "layouts/post.njk",
  eleventyComputed: {
    permalink: (data) => {
      if (!data.publish) return false;
      if (data.snippet) return false; // content snippets are embedded by templates, never standalone pages
      if (data.permalink) return data.permalink; // pages like About/Now set their own
      const slug = data.slug || slugify(data.page.fileSlug);
      const section = sections.includes(data.section) ? data.section : data.hardcover ? "books" : "posts";
      return `/${section}/${slug}/`;
    },
    eleventyExcludeFromCollections: (data) => !data.publish
  }
};
