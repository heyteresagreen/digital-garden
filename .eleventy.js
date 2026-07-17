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

// Top-level pages that wiki links may point at.
// Section links (writing, art, sketching, etc.) are derived from SECTIONS
// rather than hand-duplicated here — add a section to SECTIONS and its
// wiki-link target comes for free. EXTRA_LINKS holds the handful of
// top-level pages and aliases that aren't sections themselves.
const EXTRA_LINKS = {
  "home": "/",
  "about": "/about/",
  "now": "/now/",
  "posts": "/posts/",
  "sketchnotes": "/sketching/",
  "notes/notes": "/posts/"
};
const BUILTIN_LINKS = {
  ...Object.fromEntries(SECTIONS.map((section) => [section, `/${section}/`])),
  ...EXTRA_LINKS
};

/* ---------------------------------------------------------------
   Wiki link resolution
   Builds a map of note names/paths -> final URLs by scanning the
   notes folder once per build.
---------------------------------------------------------------- */
let linkMap = null;

function noteUrl(data, fileSlug) {
  const slug = data.slug || slugify(fileSlug);
  const rawSection = Array.isArray(data.section) ? data.section[0] : data.section;
  const section = SECTIONS.includes(rawSection) ? rawSection : "posts";
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

// Shared by every place that parses the pipe-separated part of a wiki embed
// that comes after the target (![[target|alt]], ![[target|alt|300]],
// ![[target|300]]). A trailing segment that's purely numeric (optionally
// WxH, e.g. 300x200) is an Obsidian sizing hint, not alt text; any
// remaining segment(s) are joined back together as the alt text. Kept as
// one function so a fix here (like the width/alt mixup this was written to
// fix) can't silently regress in one of the other call sites.
function splitEmbedAltAndSize(rest) {
  const parts = rest !== undefined && rest !== null ? String(rest).split("|") : [];
  let width = null;
  let height = null;
  if (parts.length > 0) {
    const sizeMatch = parts[parts.length - 1].trim().match(/^(\d+)(?:x(\d+))?$/i);
    if (sizeMatch) {
      width = sizeMatch[1];
      height = sizeMatch[2] || null;
      parts.pop();
    }
  }
  return { alt: parts.join("|").trim(), width, height };
}

// Parses a frontmatter `image:` field written in Obsidian's own embed
// syntax, e.g. image: "[[file.jpg|alt text]]" — returns null if `raw`
// isn't in that format (e.g. it's already a resolved /img/user/... path,
// which callers should handle separately).
function parseImageField(raw) {
  const match = String(raw).trim().match(/^!?\[\[([^\]]*)\]\]$/);
  if (!match) return null;
  const inner = match[1];
  const pipeIndex = inner.indexOf("|");
  const target = (pipeIndex === -1 ? inner : inner.slice(0, pipeIndex)).trim();
  if (!target) return null;
  const rest = pipeIndex === -1 ? undefined : inner.slice(pipeIndex + 1);
  const { alt } = splitEmbedAltAndSize(rest);
  return { src: resolveEmbedSrc(target), alt };
}

function replaceWikiSyntax(content) {
  // Image embeds: ![[file.jpeg|alt text]], ![[file.jpeg|alt text|300]], or
  // Obsidian's width-only shorthand ![[file.jpeg|300]] / ![[file.jpeg|300x200]]
  // (pipe separating the target from the rest may be escaped as \|).
  content = content.replace(/!\[\[([^\]|\\]+?)(?:\\?\|([^\]]*))?\]\]/g, (m, target, rest) => {
    const src = resolveEmbedSrc(target);
    const { alt, width, height } = splitEmbedAltAndSize(rest);
    const altText = alt.replace(/"/g, "&quot;");
    const sizeAttrs = width ? ` width="${width}"${height ? ` height="${height}"` : ""}` : "";
    return `<img src="${src}" alt="${altText}"${sizeAttrs}>`;
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

  // The calendar is a separate side project synced in via `npm run
  // sync:calendar` (see package.json) — it's not core to the blog template,
  // so these are only added if the files are actually present. A fork of
  // this repo without the calendar files still builds cleanly.
  const CALENDAR_FILES = ["index.html", "calendar.css", "calendar-theme.css", "calendar.js"];
  CALENDAR_FILES.forEach((file) => {
    const relPath = `src/site/calendar/${file}`;
    if (fs.existsSync(path.join(__dirname, relPath))) {
      eleventyConfig.addPassthroughCopy(relPath);
    }
  });

  // Collections
  const published = (api) =>
    api.getFilteredByGlob("src/site/notes/**/*.md")
      .filter((p) => p.data.publish && !p.data.standalone && !p.data.snippet)
      .sort((a, b) => (b.data.date ? b.date : 0) - (a.data.date ? a.date : 0));

  SECTIONS.forEach((section) => {
    eleventyConfig.addCollection(section, (api) =>
      published(api).filter((p) => {
        const s = p.data.section;
        return Array.isArray(s) ? s.includes(section) : s === section;
      })
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


  // Card thumbnail: from imageUrl (preferred, already a resolved path), or
  // image — either an already-resolved path, or Obsidian's own embed syntax
  // (image: "[[file.jpg|alt text]]"), parsed via parseImageField so a note
  // only needs one field, not both.
  eleventyConfig.addFilter("cardImage", (post) => {
    if (!post || !post.data) return null;
    if (post.data.imageUrl) return { src: encodeURI(post.data.imageUrl), alt: post.data.imageAlt || "" };
    if (post.data.image) {
      if (String(post.data.image).startsWith("/")) return { src: post.data.image, alt: post.data.imageAlt || "" };
      const parsed = parseImageField(post.data.image);
      // parsed.src comes from resolveEmbedSrc, which already
      // percent-encodes each path segment — wrapping it in encodeURI()
      // again would double-encode it (%20 -> %2520).
      if (parsed) return { src: parsed.src, alt: post.data.imageAlt || parsed.alt };
    }
    return null;
  });

  // Like cardImage, but falls back to the first image in the note body
  // (used by the Writing index)
  const bodyImageCache = new Map();
  eleventyConfig.addFilter("cardImageAny", (post) => {
    if (!post || !post.data) return null;
    if (post.data.imageUrl) return { src: encodeURI(post.data.imageUrl), alt: post.data.imageAlt || "" };
    if (post.data.image) {
      if (String(post.data.image).startsWith("/")) return { src: post.data.image, alt: post.data.imageAlt || "" };
      const parsed = parseImageField(post.data.image);
      // parsed.src comes from resolveEmbedSrc, which already
      // percent-encodes each path segment — wrapping it in encodeURI()
      // again would double-encode it (%20 -> %2520).
      if (parsed) return { src: parsed.src, alt: post.data.imageAlt || parsed.alt };
    }
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
        if (m) out = { src: resolveEmbedSrc(m[1]), alt: splitEmbedAltAndSize(m[2]).alt };
      }
    } catch { /* noop */ }
    bodyImageCache.set(inputPath, out);
    return out;
  });
  eleventyConfig.on("eleventy.before", () => bodyImageCache.clear());

  eleventyConfig.addFilter("head", (arr, n) => (n < 0 ? arr.slice(n) : arr.slice(0, n)));

  eleventyConfig.addFilter("tagUrl", (tag) => `/tags/${slugify(String(tag))}/`);

  // `section` in frontmatter is usually a single string, but some posts (e.g. letters/)
  // use a list to belong to multiple sections. Templates that need one canonical section
  // (URL, nav, collection lookup) should go through this filter rather than assuming a string.
  eleventyConfig.addFilter("primarySection", (section) => (Array.isArray(section) ? section[0] : section));

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
