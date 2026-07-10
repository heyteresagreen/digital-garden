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
