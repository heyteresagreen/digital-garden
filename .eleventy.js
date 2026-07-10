const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const slugify = require("@sindresorhus/slugify");
const { DateTime } = require("luxon");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItAttrs = require("markdown-it-attrs");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItTaskCheckbox = require("markdown-it-task-checkbox");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");

const NOTES_DIR = path.join(__dirname, "src/site/notes");
const IMG_DIR = path.join(__dirname, "src/site/img/user");
const SECTIONS = ["writing", "notes", "art", "sketching", "sketchbooks", "books", "letters", "projects"];

// Top-level pages that wiki links may point at
const BUILTIN_LINKS = {
  "home": "/",
  "about": "/about/",
  "now": "/now/",
  "posts": "/posts/",
  "writing": "/writing/",
  "art": "/art/",
  "sketching": "/sketching/",
  "sketchnotes": "/sketching/",
  "sketchbooks": "/sketchbooks/",
  "books": "/books/",
  "letters": "/letters/",
  "projects": "/projects/",
  "notes/notes": "/posts/"
};

/* ---------------------------------------------------------------
   Wiki link resolution
   Builds a map of note names/paths -> final URLs by scanning the
   notes folder once per build.
---------------------------------------------------------------- */
let linkMap = null;

function noteUrl(data, fileSlug) {
  const slug = data.slug || slugify(fileSlug);
  const section = SECTIONS.includes(data.section) ? data.section : "posts";
  return `/${section}/${slug}/`;
}

function buildLinkMap() {
  const map = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".md")) continue;
      let data;
      try { data = matter(fs.readFileSync(full, "utf8")).data; } catch { continue; }
      if (!data.publish) continue;
      const rel = path.relative(NOTES_DIR, full).replace(/\.md$/, "");
      const base = path.basename(rel);
      const url = noteUrl(data, base);
      map[rel.toLowerCase()] = url;
      if (rel.toLowerCase().startsWith("website/")) map[rel.toLowerCase().slice(8)] = url;
      map[base.toLowerCase()] = url;
      if (data.title) map[String(data.title).toLowerCase()] = url;
    }
  };
  if (fs.existsSync(NOTES_DIR)) walk(NOTES_DIR);
  return map;
}

function resolveWikiTarget(target) {
  let anchor = "";
  let name = target.trim();
  if (name.includes("#")) {
    const parts = name.split("#");
    name = parts[0].trim();
    if (parts[1]) anchor = "#" + slugify(parts[1]);
  }
  const key = name.toLowerCase();
  if (BUILTIN_LINKS[key]) return BUILTIN_LINKS[key] + anchor;
  if (linkMap[key]) return linkMap[key] + anchor;
  return null;
}

function resolveEmbedSrc(name) {
  const clean = name.trim();
  const candidates = clean.includes("/")
    ? [clean]
    : [clean, `assets/${clean}`, `assets/sketching/${clean}`];
  for (const c of candidates) {
    if (fs.existsSync(path.join(IMG_DIR, c))) {
      return "/img/user/" + c.split("/").map(encodeURIComponent).join("/");
    }
  }
  return "/img/user/" + clean.split("/").map(encodeURIComponent).join("/");
}

function replaceWikiSyntax(content) {
  // Image embeds: ![[file.jpeg|alt text]]  (pipe may be escaped as \|)
  content = content.replace(/!\[\[([^\]|\\]+?)(?:\\?\|([^\]]*))?\]\]/g, (m, target, alt) => {
    const src = resolveEmbedSrc(target);
    const altText = (alt || "").replace(/"/g, "&quot;").trim();
    return `<img src="${src}" alt="${altText}">`;
  });
  // Markdown images with vault-relative paths (Obsidian needs these relative
  // for local preview; the site needs them rooted at /img/user/)
  content = content.replace(/(!\[[^\]]*\]\()(?!\/|https?:|data:)([^)]+)(\))/g, (m, pre, src, post) => {
    return pre + resolveEmbedSrc(decodeURI(src)) + post;
  });
  // Wiki links: [[note path|alias]] / [[note]]
  content = content.replace(/\[\[([^\]|\\]+?)(?:\\?\|([^\]]*))?\]\]/g, (m, target, alias) => {
    const text = (alias || target).trim();
    const url = resolveWikiTarget(target);
    if (url) return `<a class="internal-link" href="${url}">${text}</a>`;
    return text; // unresolved: plain text, no dead link
  });
  return content;
}

/* --------------------------------------------------------------- */

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss);

  // Automatic image optimisation: every <img> in the output HTML is converted
  // to webp (max 1400px wide, original kept as fallback for the few formats
  // webp can't beat). Generated files are content-hashed, so unchanged images
  // are skipped on rebuilds.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp"],
    widths: [1400],
    urlPath: "/img/optimized/",
    outputDir: "./dist/img/optimized/",
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" }
    },
    sharpOptions: { animated: true },
    failOnError: false
  });

  // Markdown
  const md = markdownIt({ html: true, breaks: true, linkify: true })
    .use(markdownItAnchor, { slugify: (s) => slugify(s) })
    .use(markdownItAttrs)
    .use(markdownItFootnote)
    .use(markdownItTaskCheckbox);
  eleventyConfig.setLibrary("md", md);

  // Resolve Obsidian wiki links / embeds before rendering markdown
  eleventyConfig.addPreprocessor("wikilinks", "md", (data, content) => {
    if (linkMap === null) linkMap = buildLinkMap();
    return replaceWikiSyntax(content);
  });
  eleventyConfig.on("eleventy.before", () => { linkMap = null; });

  // Passthrough copy
  eleventyConfig.addPassthroughCopy("src/site/img");
  eleventyConfig.addPassthroughCopy("src/site/calendar/index.html");
  eleventyConfig.addPassthroughCopy("src/site/calendar/calendar.css");
  eleventyConfig.addPassthroughCopy("src/site/calendar/calendar-theme.css");
  eleventyConfig.addPassthroughCopy("src/site/calendar/calendar.js");

  // Collections
  const published = (api) =>
    api.getFilteredByGlob("src/site/notes/**/*.md")
      .filter((p) => p.data.publish && !p.data.standalone && !p.data.snippet)
      .sort((a, b) => (b.data.date ? b.date : 0) - (a.data.date ? a.date : 0));

  SECTIONS.forEach((section) => {
    eleventyConfig.addCollection(section, (api) =>
      published(api).filter((p) => p.data.section === section)
    );
  });

  eleventyConfig.addCollection("allPosts", (api) => published(api));

  // Content snippets: notes with `snippet: <name>` embedded into templates
  eleventyConfig.addCollection("snippets", (api) =>
    api.getFilteredByGlob("src/site/notes/**/*.md").filter((p) => p.data.publish && p.data.snippet)
  );

  eleventyConfig.addCollection("tagList", (api) => {
    const tags = new Set();
    published(api).forEach((p) => (p.data.tags || []).forEach((t) => tags.add(String(t).toLowerCase())));
    return [...tags].sort();
  });

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  // Tag images that are genuinely wider than the text column so CSS can
  // bleed them out slightly (runs after the image plugin adds width attrs)
  eleventyConfig.addTransform("wide-images", function (content) {
    if (!this.page.outputPath || !String(this.page.outputPath).endsWith(".html")) return content;
    return content.replace(/<img\b[^>]*\bwidth="(\d+)"[^>]*>/g, (tag, w) => {
      if (parseInt(w, 10) <= 800) return tag;
      if (tag.includes('class="')) return tag.replace('class="', 'class="img-wide ');
      return tag.replace("<img ", '<img class="img-wide" ');
    });
  });

  // Filters
  eleventyConfig.addFilter("dateFormat", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("d LLLL yyyy");
  });

  eleventyConfig.addFilter("dateLong", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("d LLLL, yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toISODate();
  });

  eleventyConfig.addFilter("excerpt", (content, description) => {
    if (description) return description;
    if (!content) return "";
    const text = content
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= 150) return text;
    return text.slice(0, 150).replace(/\s\S*$/, "") + "…";
  });


  // Excerpt from a collection item's raw markdown (avoids circular templateContent)
  const excerptCache = new Map();
  eleventyConfig.addFilter("postExcerpt", (post) => {
    if (post.data && post.data.description) return post.data.description;
    const inputPath = post.page ? post.page.inputPath : null;
    if (!inputPath) return "";
    if (excerptCache.has(inputPath)) return excerptCache.get(inputPath);
    let text = "";
    try { text = matter(fs.readFileSync(inputPath, "utf8")).content; } catch { /* noop */ }
    text = text
      .replace(/!\[\[[^\]]*\]\]/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[\[([^\]|\\]+?)(?:\\?\|([^\]]*))?\]\]/g, (m, t, a) => (a || t))
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_>`#|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    let out = text.length <= 150 ? text : text.slice(0, 150).replace(/\s\S*$/, "") + "\u2026";
    excerptCache.set(inputPath, out);
    return out;
  });
  eleventyConfig.on("eleventy.before", () => excerptCache.clear());


  // Card thumbnail: from imageUrl / image frontmatter only
  eleventyConfig.addFilter("cardImage", (post) => {
    if (!post || !post.data) return null;
    if (post.data.imageUrl) return { src: encodeURI(post.data.imageUrl), alt: post.data.imageAlt || "" };
    if (post.data.image && String(post.data.image).startsWith("/")) return { src: post.data.image, alt: post.data.imageAlt || "" };
    return null;
  });

  // Like cardImage, but falls back to the first image in the note body
  // (used by the Writing index)
  const bodyImageCache = new Map();
  eleventyConfig.addFilter("cardImageAny", (post) => {
    if (!post || !post.data) return null;
    if (post.data.imageUrl) return { src: encodeURI(post.data.imageUrl), alt: post.data.imageAlt || "" };
    if (post.data.image && String(post.data.image).startsWith("/")) return { src: post.data.image, alt: post.data.imageAlt || "" };
    const inputPath = post.page ? post.page.inputPath : null;
    if (!inputPath) return null;
    if (bodyImageCache.has(inputPath)) return bodyImageCache.get(inputPath);
    let out = null;
    try {
      const body = matter(fs.readFileSync(inputPath, "utf8")).content;
      let m = body.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (m) {
        let src = m[2].trim();
        if (!src.startsWith("/") && !/^https?:/.test(src)) src = resolveEmbedSrc(decodeURI(src));
        out = { src: encodeURI(decodeURI(src)), alt: (m[1].split("|").pop() || "").trim() };
      } else {
        m = body.match(/!\[\[([^\]|\\]+?)(?:\\?\|([^\]]*))?\]\]/);
        if (m) out = { src: resolveEmbedSrc(m[1]), alt: (m[2] || "").trim() };
      }
    } catch { /* noop */ }
    bodyImageCache.set(inputPath, out);
    return out;
  });
  eleventyConfig.on("eleventy.before", () => bodyImageCache.clear());

  eleventyConfig.addFilter("head", (arr, n) => (n < 0 ? arr.slice(n) : arr.slice(0, n)));

  eleventyConfig.addFilter("tagUrl", (tag) => `/tags/${slugify(String(tag))}/`);

  eleventyConfig.addFilter("withTag", (posts, tag) =>
    (posts || []).filter((p) => (p.data.tags || []).map((t) => String(t).toLowerCase()).includes(String(tag).toLowerCase()))
  );

  eleventyConfig.setServerOptions({ showAllHosts: true });

  return {
    dir: {
      input: "src/site",
      output: "dist",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
};
