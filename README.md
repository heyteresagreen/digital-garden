# teresawatts.com

Custom Eleventy (v3) build — replaced the Obsidian Digital Garden plugin in July 2026.

- Content: `src/site/notes/` (published from Obsidian via Enveloppe — see ENVELOPPE-SETUP.md)
- Templates: `src/site/_includes/` (Nunjucks, fully owned — no plugin)
- Styles: `src/site/styles/tw-style.scss` (single file)
- Build: `npm install` once, then `npm start` for local dev at http://localhost:8080, Netlify runs `npm run build`

URL structure: `/writing/`, `/art/`, `/sketching/`, `/books/`, `/letters/`,
`/projects/` section indexes; `/posts/` mixed feed; `/tags/tag-name/` archives.
Old Digital Garden URLs 301-redirect via `netlify.toml`.

See MIGRATION-NOTES.md for the content migration log.

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

**Weekly sync:** `.github/workflows/sync-books.yml` runs Sundays 22:00 UTC (or
on demand: repo → Actions → "Sync reading data" → Run workflow) and commits
only if the data changed. It needs a `HARDCOVER_TOKEN` repository secret.
Run the Instapaper part locally with `node scripts/sync-instapaper.mjs`.

**Run locally:** put `HARDCOVER_TOKEN=...` in `.env` (gitignored; token from
hardcover.app → Settings → API), then:

```bash
node scripts/sync-hardcover.mjs                                   # update the site data
node scripts/sync-hardcover.mjs --vault "<vault>/books" --dry-run # preview vault changes
node scripts/sync-hardcover.mjs --vault "<vault>/books"           # pull books into Obsidian
node scripts/sync-hardcover.mjs --vault "<vault>/books" --link    # …and link matching notes
```

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
