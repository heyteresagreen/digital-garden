const slugify = require("@sindresorhus/slugify");

module.exports = {
  layout: "layouts/post.njk",
  eleventyComputed: {
    permalink: (data) => {
      if (!data.publish) return false;
      if (data.permalink) return data.permalink; // pages like About/Now set their own
      const slug = data.slug || slugify(data.page.fileSlug);
      const sections = ["writing", "art", "sketching", "sketchbooks", "books", "letters", "projects"];
      const section = sections.includes(data.section) ? data.section : "posts";
      return `/${section}/${slug}/`;
    },
    eleventyExcludeFromCollections: (data) => !data.publish
  }
};
