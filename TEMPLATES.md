# Template guide

How the site's templates work and how to edit them. Assumes comfort with
HTML/SCSS; the Nunjucks bits you need are minimal and explained below.

Run `npm start` while editing — every save to `.njk`, `.md` or `.scss`
hot-reloads http://localhost:8080.

## File map

```
src/site/
├── _data/site.json               Site title, URL, author, email (used in head + footer)
├── _includes/
│   ├── layouts/
│   │   ├── base.njk              Outer HTML shell: <head>, nav, <main>, footer
│   │   ├── post.njk              Single post: section label, title, date, tags, body, prev/next
│   │   ├── page.njk              Plain page (About, Now): just title + body
│   │   └── index.njk             Shared section-index layout: heading, intro, card list, pagination
│   └── components/
│       ├── nav.njk               Top nav (logo + links, active state)
│       ├── footer.njk            Footer nav + colophon line
│       ├── post-card.njk         One card in any list (macro — see below)
│       └── pagination.njk        Newer/Older controls (macro)
├── styles/tw-style.scss          ALL styling, single file
├── index.njk                     Homepage (content written directly in this file)
├── posts.njk                     /posts/  — mixed feed
├── writing.njk … letters.njk     One file per section index
├── sketchbooks.njk, projects.njk
├── tags-index.njk                /tags/ — all tags with counts
├── tags.njk                      Generates one page per tag (/tags/<tag>/)
├── 404.njk                       Not-found page
├── feed.njk                      RSS (rarely needs touching)
└── notes/website/…               Content (mirrors the vault's website/ folder)
```

`.eleventy.js` (project root) is build config: collections, filters, wiki-link
resolution. You shouldn't need it for styling work.

## How a page is assembled

- **A post**: note markdown → rendered inside `layouts/post.njk` → which wraps
  itself in `layouts/base.njk`. So: header/nav/footer live in base; anything
  between them for a single post lives in post.njk.
- **A section index**: e.g. `art.njk` is mostly frontmatter — it picks the
  collection, page size, and options, then hands off to `layouts/index.njk`,
  which loops posts through the `post-card.njk` macro.
- **Pages** (About, Now): notes with `layout: layouts/page.njk` in frontmatter.

## Just enough Nunjucks

- `{{ variable }}` outputs a value; `{{ content | safe }}` outputs pre-rendered HTML
- `{% if %} … {% endif %}`, `{% for x in list %} … {% endfor %}`
- `{% include "components/nav.njk" %}` pastes a file in
- A **macro** is a function returning HTML. `post-card.njk` defines
  `postCard(post, opts)`; index layouts import and call it. Edit the macro
  body like normal HTML — the `opts` flags just switch bits on/off.
- The `---` block at the top of any `.njk` file is frontmatter (per-page
  settings), not output.

## Index page options (frontmatter of writing.njk, art.njk, …)

| Key | Effect |
|---|---|
| `listClass` | CSS class on the `<ul>` — this is the main styling hook per section |
| `showImages: true` | Cards get thumbnails from `image`/`imageUrl` frontmatter |
| `bodyImageFallback: true` | …also fall back to the first image in the note body (Writing uses this) |
| `showSections: true` | Cards get the small uppercase section label (Posts feed) |
| `hideExcerpts: true` | No summary text on cards |
| `intro` | The line under the index heading |
| `pagination.size` | Posts per page (12 everywhere currently) |

Current `listClass` values: `posts-mosaic` (Posts), `writing-list` (small left
thumbnails), `notes-list` (garden-style, undated), `art-grid` (Art, Sketching,
Sketchbooks), `book-list`, `letters-list`.

## Card anatomy (post-card.njk → SCSS hooks)

```html
<li class="post-card [has-thumb]">
  <a class="post-card-thumb"><img …></a>      ← only when showImages + image found
  <div class="post-card-body">
    <span class="post-card-section">art</span> ← only when showSections
    <a class="post-card-title">Title</a>
    <p class="post-card-excerpt">…</p>
    <time class="posted">1 July 2026</time>
  </div>
</li>
```

Two layouts (`posts-mosaic`, `art-grid`) reorder these visually with
`display: contents` on `.post-card-body` + `order:` on the pieces — if you
restructure a card and things stack oddly, check those rules first.

## tw-style.scss structure (in file order)

| Section | What's in it |
|---|---|
| Variables (top) | Colours, fonts, radius — change `$pink`, `$blue`, etc. here and everything follows |
| BASE | body, texture, type scale, links, blockquote, squiggle `hr` |
| LAYOUT | `nav.navbar` (logo `#logo`, links `#topnav`, `.active` state), `.wrapper`, `.content`, `footer` + `.footer-nav` |
| NOTE AND POST ELEMENTS | `article > header`, `.section-label`, `.header-tags`, `a.tag`, `.post-nav` (prev/next), wide images, `.superwide` |
| HOMEPAGE | `.homepage` block |
| FORMS | Buttondown subscribe form on Letters |
| INDEX PAGES (v2) | `.index-header`, `.post-list` base card styles, then per-section: `.writing-list`, `.letters-list`, `.art-grid`, `.book-list`, `.tag-links` (chips), `.pagination` |
| POSTS PAGE MOSAIC (v2) | `.posts-mosaic` two-column feed |
| 404 | `.page-404` |

Page-level targeting: templates set `bodyClass` (e.g. `page-home`, `page-404`)
and `contentClass` (classes on `<main>`, e.g. `homepage simple`) in their
frontmatter — add your own the same way if a page needs specific CSS.

## Common edits

**Change nav items** — edit the `navItems` list at the top of
`components/nav.njk`. Active state is automatic (`.active` class +
`aria-current`, styled in LAYOUT section).

**Change footer links** — plain HTML in `components/footer.njk`.

**Restyle one section's cards** — work under its `listClass` in the INDEX
PAGES part of the SCSS. Shared card changes go in `.post-list`.

**Change what's on a card** — edit the macro in `components/post-card.njk`
(affects every list; use the `opts` flags or `listClass` scoping to vary
per section).

**Post page layout** (title/date/tags/prev-next) — `layouts/post.njk` +
NOTE AND POST ELEMENTS styles.

**Homepage** — content is directly in `src/site/index.njk`; styles in
`.homepage`.

**Posts per page** — `pagination.size` in each section's `.njk` file.

## Don't touch (unless you mean it)

- `notes/notes.11tydata.js` — computes every post's URL from
  `section` + `slug`. Changes here move live URLs.
- `slug:` fields in note frontmatter — they preserve old-site URLs.
- `netlify.toml` redirects — they map old URLs to new.
- `.eleventy.js` collections/filters — only needed for new sections
  (add to `SECTIONS`, create a `<section>.njk` index, done).

## Gotchas

- No inline `<style>` or CSS in templates — everything in `tw-style.scss`
  (it compiles to `/styles/tw-style.css`).
- If a build error mentions "filter not found" or "premature templateContent",
  it's a template calling something at the wrong time — check the terminal,
  the error names the file.
- `sass` compiles on save in `npm start`; a SCSS syntax error shows in the
  terminal, not the browser.

## Image optimisation (added July 2026)

Every `<img>` in the built HTML is automatically converted to webp (max
1400px wide) by `@11ty/eleventy-img` — configured in `.eleventy.js`. Nothing
to do per-post; drop originals in as always. Notes:

- **First build is slow** (several minutes while ~500 images convert).
  After that, generated files are cached in `dist/img/optimized/` and
  rebuilds take seconds. Same on Netlify (cached via netlify-plugin-cache).
- Relative image paths in notes (`assets/foo.jpeg`) are rewritten to
  `/img/user/assets/foo.jpeg` at build time — write them however Obsidian
  prefers.
