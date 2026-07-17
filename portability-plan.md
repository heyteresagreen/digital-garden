# Portability plan — de-hardcoding teresawatts.com

_Written July 2026, ahead of a possible "how I built this" blog post. Goal: figure out what it would take for someone else to fork this site (or for future-you to reskin it) without rewriting the whole pipeline._

The build has three layers, and they're portable to very different degrees:

1. **Config/data** — small hand-maintained lists (nav, taxonomy, passthrough files). Cheap to fix, and some of it is a genuine duplication bug today, not just a "nice to have."
2. **Theme** (`tw-style.scss`) — six colour/font/radius variables drive the whole look. Already close to portable; needs splitting into partials to be obviously so.
3. **Content model** (`.eleventy.js` + Obsidian/Enveloppe conventions) — the real engineering. Sections, wiki-link resolution, and per-section list layouts are all coupled to *your* specific taxonomy. Genuinely decoupling this is a real refactor, and generalising the Obsidian dependency is a different project, not a refactor.

This plan tackles Tier 1 now. Tiers 2 and 3 are scoped but deliberately not started — see "Not doing yet" below.

---

## Tier 1 — config/data fixes (doing now)

### 1. `SECTIONS` / `BUILTIN_LINKS` duplication

**Where:** `.eleventy.js` lines 16 and 19–33.

**Problem:** `SECTIONS` (the array of content types) and `BUILTIN_LINKS` (the map wiki-links resolve against) both hand-list the same section names. Add a ninth section and there are three places to remember: `SECTIONS`, `BUILTIN_LINKS`, and the `SECTIONS.forEach` collections loop already reads from `SECTIONS` correctly — it's just `BUILTIN_LINKS` duplicating it. This is a live bug risk today, independent of anyone forking the repo.

**Fix:** Build the section entries of `BUILTIN_LINKS` from `SECTIONS.map()` at module load, and keep only the genuinely-extra top-level pages (`home`, `about`, `now`, `posts`, `sketchnotes` alias, `notes/notes`) as a separate small hand-written map merged on top.

**Risk:** None — output URLs are identical, this only removes a second hand-maintained copy of the same data.

### 2. Nav items + logo hardcoded in `nav.njk`

**Where:** `src/site/_includes/components/nav.njk` — the `navItems` array and the logo `<img>` src are written directly into the template. Contrast with `site.json`, which already externalises title/url/author/description.

**Problem:** Changing a nav link today means editing a template. Everything else site-wide config lives in `_data/site.json`.

**Fix:** Add `nav` (array of `{label, url}`) and `logoSrc`/`logoAlt` to `site.json`, loop over `site.nav` in `nav.njk`.

**Risk:** None if the data matches exactly what's in the template today — verified by diffing rendered nav HTML before/after.

### 3. Calendar passthrough copies unconditional

**Where:** `.eleventy.js` lines 159–162 — four `addPassthroughCopy` calls for calendar files, unconditional.

**Problem:** Not a bug for you (the files always exist), but it bolts an unrelated side project into the core build config with no indication it's optional. Anyone forking the blog template inherits a calendar tool they didn't ask for and can't easily omit without editing core config.

**Fix:** Guard each passthrough with an `fs.existsSync` check so the build degrades gracefully if the calendar files aren't present, and add a one-line comment marking it as a bolted-on extra rather than core to the template.

**Risk:** None for your build (files exist, so behaviour is identical) — purely additive safety for a forker.

---

## Verification before merging

- `npm run build` (sass + eleventy) completes with no errors.
- Diff `dist/` output for the homepage, one writing post, one index page (e.g. `/letters/`), and the nav markup — confirm byte-identical or intentionally-changed-only output.
- Manual check of `/`, `/posts/`, `/letters/` in a local server (`npm start`) before merging to `main`.
- Changes made on branch `portability/tier1`, not directly on `main` — merge only after review.

---

## Tier 2 — theme portability (done)

`tw-style.scss` is now a thin entry file that `@use`s four partials: `_tokens.scss`, `_base.scss`, `_layout.scss`, `_components.scss` — split along the file's existing section comments.

The six tokens are CSS custom properties on `:root` rather than Sass variables, so reskinning means editing `_tokens.scss` — or, for a quick before-you-commit preview, overriding the same variable names via devtools or an inline `<style>` block, with no Sass recompile needed.

**The wrinkle, handled:** three derived colours (footer text, footer link, tag-hover border) were built with Sass's `color.mix()`/`color.adjust()`, which need a real Sass colour at compile time — they can't reference a CSS custom property. Precomputed their exact output as static hex values, with the source formula commented at each usage site and in `_tokens.scss`, so they can be recomputed by hand if `--color-text` or `--color-secondary` ever change.

**Verification:** compiled the old single-file stylesheet and the new partials-based one to expanded CSS and diffed them line-by-line. Every difference is either a literal value replaced by `var(--x)`, or the new `:root` token block — every computed value, including the three precomputed derived colours, matches exactly.

## Tier 3 — content-model decoupling

**Correction to the original framing above:** the section→CSS coupling described when this plan was first written turned out to be looser than assumed. `listClass` is just frontmatter on each `<section>.njk` index page, not derived from the section name in code — and it's already reused in practice (`sketchbooks` and `sketching` both use `art-grid`; `projects` falls back to the plain `.post-list` styling with no dedicated class at all). Adding a section costs one line in `SECTIONS` plus one index template, which can point at an existing list style. Not the hardcoding problem it looked like.

Four options were considered, narrowest to most ambitious:

1. **Do nothing further** (the default, if this were just for personal use) — the remaining coupling (one `SECTIONS` array, one template file per section) is a normal amount of structure for a static site generator.
2. **Formalise the content contract as documentation, no code changes** — ✅ **done**, see `content-contract.md`. Written from the actual frontmatter fields the code reads and real sample notes, not idealised. Documents the frontmatter schema (`publish`, `section`, `title`, `date`, `slug`, `tags`, `description`, the `image`/`imageUrl` gotcha, `standalone`, `snippet`), the section-index-page boilerplate, and the wiki-link/embed syntax including a real quirk found while writing it (Obsidian's `|300` width-hint syntax on image embeds gets swallowed into the alt text rather than interpreted as a width).
3. **Config-driven section pages** — collapse the 8 near-identical `<section>.njk` files into one Eleventy pagination template driven by a `sections.json`. Real reduction in duplication if sections get added often; trades file-per-section duplication for Eleventy pagination/`eleventyComputed` complexity, not a clear net simplification. Not started — would need its own scoping pass given Eleventy's permalink-templating quirks.
4. **Full content-source abstraction** — an adapter layer so the site could ingest content without Obsidian/Enveloppe's wiki-link conventions. A different project, not a refactor. Only worth it if the actual goal is for strangers to run this without installing Obsidian.

**Not doing 3 or 4 unless the goal changes to "open-source this as a starter kit for other people to run."** For a personal site plus a blog post about it, Tier 1 + Tier 2 + the content contract cover what a reader would actually want to copy.
