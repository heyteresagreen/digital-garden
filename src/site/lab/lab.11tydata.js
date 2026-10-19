// Homepage layout experiments, viewable at /lab/<file>/ while running
// `npm start`. Never built in production (ELEVENTY_ENV=prod), so this
// folder can sit in the repo without anything going live.
module.exports = {
  layout: "layouts/lab.njk",
  eleventyExcludeFromCollections: true,
  eleventyImport: { collections: ["allPosts", "completedBooks", "booksThisYear", "sketchbooks"] },
  eleventyComputed: {
    permalink: (data) => (process.env.ELEVENTY_ENV === "prod" ? false : `/lab/${data.page.fileSlug}/`)
  },
  // The wireframe's nav (4 Jan 2026 sketch)
  labNav: [
    { label: "All", url: "/posts/" },
    { label: "Writing", url: "/writing/" },
    { label: "Making", url: "/making/" },
    { label: "Reading", url: "/reading/" },
    { label: "Notes", url: "/notes/" },
    { label: "Newsletter", url: "/letters/" }
  ],
  // only B3, B4 and E are still in play; the other variants' pages still
  // build at /lab/<file>/, they're just off the switcher
  labVariants: [
    { slug: "b3-separators", label: "B3" },
    { slug: "b4-half-half", label: "B4" },
    { slug: "e-magazine", label: "E · Magazine" }
  ],
  making: ["art", "sketching", "sketchbooks", "projects"]
};
