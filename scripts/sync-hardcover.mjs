// Hardcover.app sync. Two jobs, kept apart so nothing is ever owned by two
// writers:
//
// 1. Site data (default; what the daily GitHub Action runs):
//      node scripts/sync-hardcover.mjs
//    Writes src/site/_data/hardcover-books.json — status, rating, dates, authors and
//    cover for every book. Hardcover is the source of truth for these: the
//    file is regenerated from scratch on each run. It never touches a note.
//
// 2. Books into Obsidian (run locally, whenever; add --dry-run to preview):
//      node scripts/sync-hardcover.mjs --vault "/path/to/vault/books"
//    Every Hardcover book you've started gets a vault note, found by its
//    `hardcover: <slug>` frontmatter. A missing one is created in
//    <year>/"Title, Author.md" with publish: false — unless an unlinked note
//    already looks like the same book, in which case it says so and leaves
//    you to link it (--link adds the `hardcover:` key to that note for you,
//    touching nothing else). Want-to-read books are skipped until you start them.
//    --since YYYY-MM-DD limits new notes to books being read now or finished
//    on/after that date (linking and highlights still cover every book).
//    scripts/obsidian-sync.sh runs this daily on the Mac; see its comments.
//    Reading-journal quotes and notes are copied into the note's
//    "## Highlights". Import-only: each entry's id is recorded in
//    `hardcoverImported`, so it's added once and then belongs to the note —
//    edit or delete it freely, it won't come back. Obsidian is the source of
//    truth for notes and highlights; nothing is ever sent back.
//
// Env: HARDCOVER_TOKEN (required; leading "Bearer " stripped; also read from a
// gitignored .env), HARDCOVER_DATA (output path for job 1), HARDCOVER_FIXTURE
// (saved API response to use instead of the API, for testing without a token).
// Both jobs write only files whose content changed, so a no-op run writes 0.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const TOKEN = (process.env.HARDCOVER_TOKEN || '').trim().replace(/^Bearer\s+/i, '');
const DATA_FILE = path.resolve(ROOT, process.env.HARDCOVER_DATA || 'src/site/_data/hardcover-books.json');
const FIXTURE = process.env.HARDCOVER_FIXTURE;
const vaultArg = process.argv.indexOf('--vault');
const VAULT_DIR = vaultArg === -1 ? null : process.argv[vaultArg + 1];
const DRY_RUN = process.argv.includes('--dry-run');
const LINK = process.argv.includes('--link');
// --since YYYY-MM-DD: only make new notes for books being read now, or
// finished on/after that date (so past reads don't flood the vault).
// Without it, every started book gets a note.
const sinceArg = process.argv.indexOf('--since');
const SINCE = sinceArg === -1 ? null : process.argv[sinceArg + 1];
if (SINCE !== null && !/^\d{4}-\d{2}-\d{2}$/.test(SINCE || '')) { console.error('--since needs a date like 2026-10-19'); process.exit(1); }
const API = 'https://api.hardcover.app/v1/graphql';
const STATUS = { 1: 'want-to-read', 2: 'reading', 3: 'read', 4: 'paused', 5: 'dnf' };
const UUID_TAIL = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Queries, most to least detailed; each is a single `me` request against
// the rate limit. cached_contributors / cached_image are JSON columns on
// books, which keeps this inside Hardcover's depth limit
// (contributions.author.name would be two levels deeper).
const UB_BASE = 'id book_id status_id rating date_added';
const READS = 'user_book_reads(order_by: {started_at: asc}) { started_at finished_at }';
const JOURNALS = `reading_journals(where: {event: {_in: ["quote", "note"]}}, order_by: {action_at: asc}) {
  id event entry metadata action_at }`;
const BOOK = 'book { title slug cached_contributors cached_image }';
const QUERIES = [
  ['full', `query { me { user_books { ${UB_BASE} ${READS} ${VAULT_DIR ? JOURNALS : ''} ${BOOK} } } }`],
  ['basic', `query { me { user_books { ${UB_BASE} book { title slug } } } }`],
];

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

async function gql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'obsidian-books-sync',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchUserBooks() {
  if (FIXTURE) {
    console.log(`Using fixture ${FIXTURE} (no API call)`);
    return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).data.me[0].user_books;
  }
  if (!TOKEN) { console.error('HARDCOVER_TOKEN not set'); process.exit(1); }
  for (const [name, query] of QUERIES) {
    const json = await gql(query);
    if (!json.errors) {
      if (name !== 'full') console.warn(`Warning: used the "${name}" query — authors, covers, dates and highlights are missing.`);
      return json.data.me[0].user_books;
    }
    console.warn(`"${name}" query failed: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  throw new Error('All Hardcover queries failed');
}

const parseJson = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return null; } };

function writeIfChanged(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
}

function authorsOf(book) {
  // Primary authors only — skip translators, illustrators etc.
  return (parseJson(book.cached_contributors) || [])
    .filter((c) => !c.contribution || /^author$/i.test(c.contribution))
    .map((c) => c.author?.name || c.name)
    .filter(Boolean);
}

/* ---------------- 1. site data ---------------- */

function toSiteBook(ub) {
  const b = ub.book;
  const reads = ub.user_book_reads || [];
  const rating = ub.rating === null || ub.rating === undefined ? null : Number(ub.rating);
  return {
    id: ub.book_id ?? ub.id,
    slug: b.slug,
    pageSlug: b.slug.replace(UUID_TAIL, ''),
    // Hardcover's own title, without its subtitle field — subtitles are often
    // edition noise ("A Novel", "42nd Anniversary Edition"). A linked note's
    // `title:` overrides this on the site.
    title: b.title,
    authors: authorsOf(b),
    status: STATUS[ub.status_id] || 'unknown',
    rating,
    dateAdded: ub.date_added || null,
    dateStarted: reads.find((r) => r.started_at)?.started_at || null,
    dateFinished: [...reads].reverse().find((r) => r.finished_at)?.finished_at || null,
    cover: parseJson(b.cached_image)?.url || null,
    url: `https://hardcover.app/books/${b.slug}`,
  };
}

function writeSiteData(userBooks) {
  const books = userBooks.map(toSiteBook).sort((a, b) => a.id - b.id);
  const text = JSON.stringify({ _generated: 'by scripts/sync-hardcover.mjs — do not edit', books }, null, 2) + '\n';
  const changed = writeIfChanged(DATA_FILE, text);
  console.log(`${books.length} books, ${changed ? 1 : 0} files written (${path.relative(ROOT, DATA_FILE)})`);
}

/* ---------------- 2. highlights into the vault ---------------- */

// Page number isn't documented for reading journal metadata, so try the
// plausible keys and give up quietly.
function pageOf(entry) {
  const m = parseJson(entry.metadata) || {};
  const p = m.page ?? m.page_number ?? m.position?.value ?? m.position;
  return p === undefined || p === null || p === '' || typeof p === 'object' ? null : p;
}

function formatEntry(j) {
  const page = pageOf(j);
  if (j.event === 'quote') {
    const lines = j.entry.trim().split(/\r?\n/).map((l) => `> ${l}`.trimEnd());
    if (page !== null) lines.push('>', `> — p. ${page}`);
    return lines.join('\n');
  }
  return j.entry.trim() + (page !== null ? ` *(p. ${page})*` : '');
}

// Adds entries at the end of the note's "## Highlights" section (adding the
// heading at the end of the note if it's missing). Nothing else moves.
function appendToHighlights(body, entries) {
  const text = entries.map(formatEntry).join('\n\n');
  const lines = body.split('\n');
  const h = lines.findIndex((l) => /^##\s+highlights\s*$/i.test(l));
  if (h === -1) return `${body.trim() ? `${body.trimEnd()}\n\n` : '\n'}## Highlights\n\n${text}\n`;
  let end = lines.findIndex((l, i) => i > h && /^#{1,2}\s/.test(l));
  if (end === -1) end = lines.length;
  let last = end; // insert after the section's last non-blank line
  while (last > h + 1 && !lines[last - 1].trim()) last--;
  lines.splice(last, 0, '', ...text.split('\n'), ...(last === end && end < lines.length ? [''] : []));
  return lines.join('\n').replace(/\n*$/, '\n');
}

// Edits only the keys listed in `updates` in a frontmatter block, keeping
// every other key's original lines (formatting, comments, date style)
// verbatim — re-serialising the whole thing would reformat the note's keys.
function setFrontmatterKeys(raw, updates) {
  const blocks = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^\s#][^:]*):/);
    if (m || !blocks.length) blocks.push({ key: m ? m[1].trim() : null, lines: [line] });
    else blocks[blocks.length - 1].lines.push(line);
  }
  const dump = (k, v) => matter.stringify('', { [k]: v }).split('\n').slice(1, -3);
  const out = [];
  const done = new Set();
  for (const b of blocks) {
    if (!(b.key in updates)) { out.push(...b.lines); continue; }
    out.push(...dump(b.key, updates[b.key]));
    done.add(b.key);
  }
  for (const [k, v] of Object.entries(updates)) if (!done.has(k)) out.push(...dump(k, v));
  while (out.length && out[0] === '') out.shift();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

// Every book note under `dir`: its file, frontmatter and Hardcover slug.
function readVaultNotes(dir) {
  const notes = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('.')) walk(full); continue; }
      if (!e.name.endsWith('.md')) continue;
      try {
        const data = matter(fs.readFileSync(full, 'utf8')).data;
        notes.push({ file: full, title: String(data.title || path.basename(full, '.md')), slug: data.hardcover ? String(data.hardcover) : null });
      } catch { /* unparseable: not ours */ }
    }
  };
  walk(dir);
  return notes;
}

// Is this unlinked note probably about this book? Note titles follow
// "Title (year), Author (aside)" while Hardcover's include subtitles and may
// spell things differently ("Practicing" vs "Practising"), so: the note must
// mention an author's surname, and the main titles must match closely.
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function looksLikeSameBook(noteTitle, book) {
  const t = norm(noteTitle);
  const surnames = book.authors.map((a) => norm(a).split(' ').pop());
  if (!surnames.some((s) => s && t.includes(s))) return false;
  const main = (x) => norm(x.split(/[:(]|, /)[0].replace(/^the\s+/i, ''));
  const a = main(noteTitle), b = main(book.title);
  return a === b || distance(a, b) <= Math.max(1, Math.floor(b.length / 10));
}

// A new note in the shape of the existing book notes. publish: false — it
// only goes on the site once you've written something and flipped it.
function newNote(book) {
  // "Title, Author" with the short title, like the existing notes
  const short = book.title.split(':')[0].trim();
  const name = book.authors.length ? `${short}, ${book.authors.join(' & ')}` : short;
  const year = (book.dateFinished || book.dateStarted || book.dateAdded || '').slice(0, 4) || String(new Date().getFullYear());
  const fm = [
    `title: ${JSON.stringify(name)}`,
    'publish: false',
    'section: books',
    `hardcover: ${book.slug}`,
    'tags:',
    `created: ${new Date().toISOString().slice(0, 10)}`,
  ].join('\n');
  return { file: path.join(year, `${name.replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim()}.md`), fm };
}

function syncVault(userBooks) {
  const dir = path.resolve(VAULT_DIR);
  if (!fs.existsSync(dir)) { console.error(`--vault folder not found: ${dir}`); process.exit(1); }
  const notes = readVaultNotes(dir);
  const linked = new Map(notes.filter((n) => n.slug).map((n) => [n.slug, n.file]));
  const unlinked = notes.filter((n) => !n.slug);
  const say = (msg) => console.log(DRY_RUN ? `[dry run] ${msg}` : msg);
  let created = 0, updated = 0, added = 0;

  for (const ub of userBooks) {
    const book = toSiteBook(ub);
    let file = linked.get(book.slug);
    let prev = file ? fs.readFileSync(file, 'utf8') : null;
    let fm, body;

    if (!file) {
      // Want-to-read books stay on Hardcover until you start them
      if (book.status === 'want-to-read') continue;
      const match = unlinked.find((n) => looksLikeSameBook(n.title, book));
      if (match && !LINK) {
        console.warn(`"${book.title}" looks like ${path.relative(dir, match.file)} — add \`hardcover: ${book.slug}\` to that note to link it (or re-run with --link). Nothing created.`);
        continue;
      }
      if (match) {
        // --link: adopt the existing note — adds only the `hardcover:` key
        file = match.file;
        prev = fs.readFileSync(file, 'utf8');
        const m = prev.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
        fm = setFrontmatterKeys(m ? m[1] : '', { hardcover: book.slug });
        body = m ? m[2] : prev;
        unlinked.splice(unlinked.indexOf(match), 1);
      } else {
        const wanted = !SINCE || book.status === 'reading' || (book.status === 'read' && book.dateFinished && book.dateFinished >= SINCE);
        if (!wanted) continue;
        const n = newNote(book);
        file = path.join(dir, n.file);
        if (fs.existsSync(file)) {
          console.warn(`"${book.title}": ${n.file} already exists without \`hardcover: ${book.slug}\` — add it to link the note. Nothing created.`);
          continue;
        }
        fm = n.fm;
        body = '';
      }
    } else {
      const m = prev.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      fm = m ? m[1] : '';
      body = m ? m[2] : prev;
    }

    // Highlights: add Hardcover journal entries the note hasn't had before
    const journals = (ub.reading_journals || []).filter((j) => j.entry && j.entry.trim());
    const imported = new Set((matter(`---\n${fm}\n---\n`).data.hardcoverImported || []).map(String));
    const fresh = journals.filter((j) => !imported.has(String(j.id)));
    if (fresh.length) {
      fm = setFrontmatterKeys(fm, { hardcoverImported: [...imported, ...fresh.map((j) => String(j.id))].map(Number) });
      body = appendToHighlights(body, fresh);
    }

    const out = `---\n${fm}\n---\n${body}`;
    if (prev === out) continue;
    const label = `${path.relative(dir, file)}${fresh.length ? ` (+${fresh.length} highlights)` : ''}`;
    if (!DRY_RUN) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, out); }
    if (prev) updated++; else created++;
    added += fresh.length;
    say(`${prev ? (linked.has(book.slug) ? 'updated' : 'linked') : 'created'} ${label}`);
  }
  say(`${created} notes created, ${updated} updated, ${added} new highlights (${dir})`);
}

/* ------------------------------------------------------------------ */

const userBooks = await fetchUserBooks();
if (VAULT_DIR) syncVault(userBooks);
else writeSiteData(userBooks);
