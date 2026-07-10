# Enveloppe plugin setup

Install **Enveloppe** from Obsidian community plugins (replaces Digital Garden).
Setting names vary slightly between versions — the intent of each setting is
what matters. **Publish one test note first** and check the diff on GitHub
before doing anything in bulk.

## GitHub

| Setting | Value |
|---|---|
| Repository owner / name | [fill in — owner/repo-name] |
| Branch | main |
| GitHub token | fine-grained token with contents read/write on the repo |

## Upload configuration

| Setting | Value | Why |
|---|---|---|
| File to publish: share key | `publish` | Only notes with `publish: true` upload. Index notes (Posts.md etc.) keep only dataview queries — never give them this key |
| Folder behaviour | Obsidian path (mirror vault structure) | Vault paths already match the site's content folder |
| Root/default folder | `src/site/notes` | Vault root maps here |
| Attachments / images | Send embedded files, keep vault structure | |
| Attachment root folder | `src/site/img/user` | So `assets/foo.jpeg` lands at `src/site/img/user/assets/foo.jpeg`, matching `/img/user/assets/…` URLs |

## Content conversion — turn OFF

- Wikilink → markdown link conversion: **off** (the site build resolves
  `[[wiki links]]` and `![[image embeds]]` itself)
- Dataview query conversion: **off** (dataview notes aren't published)
- Frontmatter key removal: **off** (the site needs all keys)

## First-note test

1. Pick one already-published note (e.g. a letter), make a trivial edit.
2. Enveloppe: upload single note (ribbon icon or command palette).
3. On github.com, check the commit diff: file at the right path, frontmatter
   intact, no link rewriting you didn't expect.
4. Wait ~2 min for Netlify, check the page on the live site.
5. Only then use "Enveloppe: Upload all notes" if you ever need a bulk push.

## Publishing from mobile

Command palette → "Enveloppe: Upload all notes", or the ribbon icon for
individual notes.

## Note frontmatter reference

See POSTING.md. Short version: `title`, `publish: true`, `section`, `date`,
`tags`, optional `description` / `image` (wikilink, for Obsidian) /
`imageUrl` (site) / `imageAlt` / `slug`.

About.md and Now.md carry `standalone: true` + `permalink` — edit their
content freely, keep those fields.
