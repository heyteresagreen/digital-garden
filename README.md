# teresawatts.com

Custom Eleventy (v3) build — replaced the Obsidian Digital Garden plugin in July 2026.

- Content: `src/site/notes/` (published from Obsidian via Enveloppe, flat — one file per note) with attachments in `src/site/img/user/`
- Templates: `src/site/_includes/` (Nunjucks). Top-level pages and section indexes: `src/site/*.njk`; the homepage is `src/site/index.njk`. Every template starts with a comment saying what it does
- Styles: `src/site/styles/` — `tw-style.scss` `@use`s `_tokens.scss` (colours, fonts, radius as CSS custom properties), `_base.scss`, `_layout.scss`, `_components.scss`, `_home.scss`
- Sections: `src/site/_data/sections.js` is the one list of sections (and of what counts as Making); nav, logo and footer links are in `src/site/_data/site.json`
- Build: `npm install` once, then `npm start` for local dev at http://localhost:8080 (Sass and Eleventy both watch and reload). Netlify runs `npm run build` on every push to `main`
- **Design system:** with `npm start` running, http://localhost:8080/dev/design-system/ shows every token, style and component, with the file it lives in and how to use it. It's in `src/site/dev/`, which is never built for the live site

URL structure: `/writing/`, `/art/`, `/sketching/`, `/sketchbooks/`, `/notes/`,
`/books/`, `/letters/`, `/projects/` section indexes; `/making/` (art,
sketching and sketchbooks together); `/posts/` everything; `/reading/`;
`/tags/tag-name/` archives; `/rss/` explains the feed at `/feed.xml`.
Old Digital Garden URLs 301-redirect via `netlify.toml`.

Day-to-day guides (posting, templates, Enveloppe, the Reading page) live in
the Obsidian vault under `projects/Website/`. `content-contract.md` here is
the frontmatter and wiki-link reference.

## Reading page data

Hardcover and Obsidian each own their own files, so they never overwrite each other:

- **Hardcover owns `src/site/_data/hardcover-books.json`**: status, rating,
  started/finished dates, authors and cover for every book, rewritten each sync.
  It drives `/reading/` (books being read now, marked with a label, then the
  latest finished) and the shelves at the top of `/books/`, the full list.
  Books marked read join the Completed list.
- **Obsidian owns the notes.** Add `hardcover: <slug>` to a note's frontmatter
  (the slug is the end of the book's Hardcover URL) and that note becomes the
  book's page, with the Hardcover details at the top. A book with no linked
  note gets a simple generated page at `/books/<slug>/`. A linked note shows up
  in Completed once Hardcover marks the book read, never twice.
- **Covers** are Hardcover's, hotlinked (not downloaded). A note that sets its
  own `image:` keeps its own cover.
- **`/books/`** is "Books I've read this year" (the `booksThisYear` collection,
  by post date or Hardcover finish date, year of the build), with links to the
  yearly round-up posts underneath. `/reading/` shows the latest across years.
- **Page intros** are snippet notes: a published note with `snippet: reading-intro`
  or `snippet: books-intro` replaces the text under that page's heading.
  Reading falls back to a default sentence; Books shows nothing.

- **Instapaper owns `src/site/_data/instapaper.json`**: the 5 articles you most
  recently liked, read from your public profile (instapaper.com/p/teresawatts)
  by `scripts/sync-instapaper.mjs`. No secret needed. It's the data Instapaper's
  own profile page uses, not an official API, so if the format changes the
  sync stops with an error and keeps the articles already there.

**Daily sync:** `.github/workflows/sync-books.yml` runs every day at 21:00 UTC
(5am Perth), or on demand (repo → Actions → "Sync reading data" → Run
workflow), and commits only if the data changed — which also triggers a
Netlify deploy. It needs a `HARDCOVER_TOKEN` repository secret.
Run the Instapaper part locally with `node scripts/sync-instapaper.mjs`.

**Run locally:** put `HARDCOVER_TOKEN=...` in `.env` (gitignored; token from
hardcover.app → Settings → API), then:

```bash
node scripts/sync-hardcover.mjs                                   # update the site data
node scripts/sync-hardcover.mjs --vault "<vault>/books" --dry-run # preview vault changes
node scripts/sync-hardcover.mjs --vault "<vault>/books"           # pull books into Obsidian
node scripts/sync-hardcover.mjs --vault "<vault>/books" --link    # …and link matching notes
```

**Books without Hardcover:** a published book note can carry its own
`status:` (reading, read, paused, dnf), `dateStarted:` and `dateFinished:`;
they win over Hardcover's when present (getShelf in `.eleventy.js`).
**Hardcover syncing is paused** (Oct 2026): the workflow's Hardcover step and
the `sync-hardcover.mjs` line in `scripts/obsidian-sync.sh` are commented out;
`hardcover-books.json` keeps its last data. **Covers:** `scripts/book-covers.mjs --vault "<vault>/books"`
adds a cover to book notes without one (Hardcover's if linked, else Open
Library), saved to the vault's `assets/` and embedded like the review notes.

**Daily on the Mac:** `scripts/obsidian-sync.sh` runs the `--vault` sync with
`--link --since <1 January this year>` every morning via a LaunchAgent
(`~/Library/LaunchAgents/com.teresawatts.obsidian-book-sync.plist`, log in
`~/Library/Logs/obsidian-book-sync.log`). `--since` limits new notes to books
being read now or finished on/after that date. See the script's comments.

The `--vault` sync gives every Hardcover book you've started a note in Obsidian. A
missing note is created as `<year>/Title, Author.md` (`publish: false`, so nothing
goes on the site until you've written it up and published it). If an unlinked note
already looks like the same book, it's left alone and the script says which line to
add; `--link` adds that `hardcover:` line for you and changes nothing else.
Want-to-read books are skipped until you start them.

Quotes and notes from your Hardcover reading journal are copied into the note's
`## Highlights` section. It's import-only: each entry is recorded in
`hardcoverImported`, so it's added once and is then yours to edit or delete. It
won't come back. Nothing is ever sent from Obsidian to Hardcover.
`HARDCOVER_FIXTURE=scripts/fixtures/hardcover-sample.json` uses sample data, no token.
