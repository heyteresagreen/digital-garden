# Content contract — what a note needs to publish correctly

_Written July 2026, as Tier 3 (option 2) of `portability-plan.md`. This is documentation only — no code changed. It exists so the frontmatter/wiki-link conventions `.eleventy.js` relies on are written down somewhere, rather than only discoverable by reading the config. Grounded in the actual code and real notes in this vault, not idealised — a few quirks are noted as quirks, not fixed._

---

## Required

**`publish: true`** — the only genuinely required field. Anything without it is invisible to the build entirely: excluded from every collection, not scanned into the wiki-link map, not copied to `dist/`.

## Common fields (used by most notes)

**`title`** — used as the page `<h1>`, the post-card title, the browser tab title, and as a lookup key in the wiki-link map (`[[Some Title]]` resolves by title if nothing else matches).

**`section`** — a string (`section: writing`) or a list (`section: [letters, writing]`) — see `Letters 13.md` for a real example of the list form, used when a note genuinely belongs in two indexes. Drives: which collection(s) the note appears in, its URL (`/​<first-section>​/<slug>/`), and — for the templates — which "back to X" link and prev/next-post pagination it gets (via the `primarySection` filter, which always takes the *first* entry if it's a list). A `section` not in the known list (currently `writing, notes, art, sketching, sketchbooks, books, letters, projects` — see `SECTIONS` in `.eleventy.js`) silently falls back to `/posts/` with no error.

**`date`** — drives sort order within collections and the displayed publish date. Notes without a date sort as oldest.

**`slug`** — optional; if omitted, the URL slug is generated from the filename via `slugify`.

**`tags`** — a list; feeds the `/tags/` archive and the tag chips on post pages. Tags aren't declared anywhere — any string you use becomes a real tag page.

**`description`** — if present, used verbatim as the meta description and the post-card excerpt, overriding the auto-generated excerpt (first ~150 characters of body text with markdown/wiki-syntax stripped).

## Thumbnail fields — a real gotcha

Three related fields, and they don't do what you'd guess from the names alone:

- **`imageUrl`** — the one that actually drives the post-card thumbnail and social-share image. Must be a site-rooted path (`/img/user/assets/...`).
- **`image`** — in the notes that have it (e.g. the sketching notes), this is typically left as the raw Obsidian embed string, e.g. `"[[ux-camp-23 - 4.jpeg|alt text]]"`. The `cardImage`/`cardImageAny` filters only use `image` when it *already* starts with `/` — so in practice, if both fields are present the way they are in your existing sketching notes, `image` is inert and `imageUrl` is doing all the work. Worth knowing so a future note doesn't rely on `image` alone and get no thumbnail.
- **`imageAlt`** — alt text paired with either of the above.

If neither field is set, the Writing index (`bodyImageFallback: true`) falls back to the first image found in the note body; other indexes just show no thumbnail.

## Special-purpose fields

**`standalone: true`** — pulls a note out of the section/pagination system entirely. Used for one-off pages like `Now.md` and `About.md`. Always paired with an explicit `permalink:` and usually `layout: layouts/page.njk` — without those, a standalone note has `publish: true` but nowhere to render.

**`snippet: <name>`** — marks a note as content to be embedded *inside* another template rather than published at its own URL (see `Books in progress.md`, pulled into the Books index by matching `snip.data.snippet == "books-in-progress"`). Excluded from the main published collection.

**`updated`** — present on some notes (e.g. `Now.md`) but not read anywhere in the build. Informational only, for your own reference.

## Section index pages (the `<section>.njk` files, not individual notes)

Each entry in `SECTIONS` needs a matching top-level template (`writing.njk`, `art.njk`, etc.) with its own frontmatter — `listClass` (which CSS list-style it uses — freely reusable; `sketchbooks` and `sketching` both already point at `art-grid`), `showImages`, `hideExcerpts`, `intro`, and a `pagination.data` pointing at `collections.<section>`. This is genuinely per-section boilerplate, not per-note — see `portability-plan.md` Tier 3 for the trade-offs of collapsing this into one config-driven template.

## Wiki-link and embed syntax

Handled by `replaceWikiSyntax()` in `.eleventy.js`, run as a preprocessor before markdown rendering:

- **`[[Note name]]`** or **`[[Note name|display text]]`** — resolves to the target note's URL by (in order) its vault-relative path, its filename, or its title, case-insensitively. Also resolves a fixed set of built-in keywords: `home`, `about`, `now`, `posts`, `sketchnotes` (alias for `/sketching/`), plus every section name. An unresolvable link renders as plain text, not a dead link — silent failure by design, worth knowing if a link ever silently stops working after a note gets renamed or unpublished.
- **`[[Note name#Heading]]`** — same resolution, with `#heading` slugified and appended.
- **`![[image.jpg]]`**, **`![[image.jpg|alt text]]`**, **`![[image.jpg|300]]`** (width only), or **`![[image.jpg|alt text|300]]`** (alt + width) — image embed. A trailing pipe segment that's purely numeric (optionally `WxH`, e.g. `300x200`) is read as a sizing hint and becomes a real `width`/`height` attribute on the `<img>`, not alt text — matching Obsidian's own embed-sizing convention. Any remaining segment(s) become the alt text. Fixed July 2026 (previously the width number was absorbed into the alt text literally, e.g. alt `"alt text|300"`) — verified against all 401 unique embeds in the vault at the time, see the `fix/embed-width-alt` commit.
- **Standard markdown images** with vault-relative paths (`![alt](assets/foo.png)`) get their path rewritten to `/img/user/assets/foo.png` automatically; already-absolute or `https:`/`data:` paths are left alone.
- **Asset lookup order** for embeds without a path (`![[foo.png]]`): tries `foo.png`, then `assets/foo.png`, then `assets/sketching/foo.png`, in that order, against `src/site/img/user/`.

---

## What this doesn't change

This is a description of the current contract, not a redesign of it. The underlying coupling to Obsidian/Enveloppe conventions is still there — see Tier 3, option 4 in `portability-plan.md` if the actual goal is ever to decouple from Obsidian entirely.
