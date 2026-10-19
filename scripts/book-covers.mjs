// Adds a cover image to book notes in the Obsidian vault that don't have one.
//
//   node scripts/book-covers.mjs --vault "/path/to/vault/books" [--dry-run]
//
// Which notes: book notes in a year folder (books/2026/...) or published
// anywhere under the folder, with no `image:` yet. Yearly round-ups and
// unpublished notes outside year folders are left alone.
//
// Where covers come from, in order:
//   1. the Hardcover cover in src/site/_data/hardcover-books.json, if the
//      note is linked (`hardcover:`) — no API call, just the site data file
//   2. Open Library (free, no account): by `isbn:` if the note has one,
//      otherwise by searching the title and author from the note's
//      "Title, Author" title. A result only counts if the author matches.
// Tiny images (under 15KB, e.g. a 98px thumbnail) are swapped for the
// Open Library one when that's bigger.
//
// What it changes, matching how the review notes do covers: saves the image
// to the vault's attachment folder as assets/cover-<title>.<ext>, sets
// `image: "[[assets/cover-….jpg]]"` (and `imageAlt` if missing), and puts
// `![[cover-….jpg|Book cover of …|200]]` at the top of the note — filling the template's
// empty `![[|200]]` if it's there. Never replaces an existing image, never
// touches anything else. Works with or without Hardcover.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vaultArg = process.argv.indexOf('--vault');
const BOOKS_DIR = vaultArg === -1 ? null : path.resolve(process.argv[vaultArg + 1]);
const DRY_RUN = process.argv.includes('--dry-run');
const UA = { 'User-Agent': 'teresawatts.com-book-covers (saviola07 at gmail dot com)' };
const MIN_BYTES = 15000;

if (!BOOKS_DIR || !fs.existsSync(BOOKS_DIR)) { console.error('Usage: node scripts/book-covers.mjs --vault "<vault>/books" [--dry-run]'); process.exit(1); }
const VAULT_ROOT = path.dirname(BOOKS_DIR);
const ASSETS = path.join(VAULT_ROOT, 'assets'); // the vault's attachment folder

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-').slice(0, 60).replace(/-+$/, '');
const pause = () => new Promise((r) => setTimeout(r, 500));

// "Title (2016), Author & Author (book club)" -> { title, author }
function splitTitle(full) {
  const clean = String(full).replace(/\s*\([^)]*\)/g, '').trim();
  const i = clean.lastIndexOf(', ');
  return i === -1 ? { title: clean, author: '' } : { title: clean.slice(0, i), author: clean.slice(i + 2) };
}

async function download(url) {
  try {
    const res = await fetch(url, { headers: UA, redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    return { buf, ext };
  } catch { return null; }
}

async function openLibraryCover({ title, author, isbn }) {
  if (isbn) {
    const img = await download(`https://covers.openlibrary.org/b/isbn/${String(isbn).replace(/[^0-9X]/gi, '')}-L.jpg?default=false`);
    if (img) return img;
  }
  if (!title) return null;
  const q = new URLSearchParams({ title, ...(author ? { author: author.split(/ & | and /)[0] } : {}), fields: 'title,author_name,cover_i', limit: '8' });
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${q}`, { headers: UA });
    const docs = (await res.json()).docs || [];
    const surname = norm(author).split(' ').filter(Boolean).pop();
    const hit = docs.find((d) => d.cover_i && (!surname || (d.author_name || []).some((a) => norm(a).includes(surname))));
    return hit ? download(`https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`) : null;
  } catch { return null; }
}

// Edits only the given keys in a frontmatter block, keeping every other
// line exactly as written (same approach as sync-hardcover.mjs).
function setKeys(raw, updates) {
  const dump = (k, v) => matter.stringify('', { [k]: v }).split('\n').slice(1, -3);
  const lines = raw.split(/\r?\n/);
  const out = [];
  const done = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([^\s#][^:]*):/);
    const key = m && m[1].trim();
    if (key && key in updates) {
      while (i + 1 < lines.length && /^(\s|-\s)/.test(lines[i + 1])) i++; // drop the old value's extra lines
      out.push(...dump(key, updates[key]));
      done.add(key);
    } else out.push(lines[i]);
  }
  for (const [k, v] of Object.entries(updates)) if (!done.has(k)) out.push(...dump(k, v));
  return out.join('\n');
}

const hardcover = (() => {
  try { return Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/site/_data/hardcover-books.json'), 'utf8')).books.map((b) => [b.slug, b])); }
  catch { return {}; }
})();

const notes = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith('.')) walk(full); continue; }
    if (e.name.endsWith('.md')) notes.push(full);
  }
})(BOOKS_DIR);

let added = 0, missed = [];
for (const file of notes) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) continue;
  let data;
  try { data = matter(text).data; } catch { continue; }
  const rel = path.relative(BOOKS_DIR, file);
  const fullTitle = String(data.title || path.basename(file, '.md'));
  const inYearFolder = /^\d{4}[\\/]/.test(rel);
  if (data.image || data.imageUrl) continue;
  if (/^books i['’]ve read in/i.test(fullTitle)) continue;
  if (!inYearFolder && !data.publish) continue;

  const { title, author } = splitTitle(fullTitle);
  let img = null, source = '';
  const hc = data.hardcover && hardcover[String(data.hardcover)];
  if (hc && hc.cover) { img = await download(hc.cover); source = 'Hardcover'; }
  if (!img || img.buf.length < MIN_BYTES) {
    const ol = await openLibraryCover({ title, author, isbn: data.isbn });
    if (ol && (!img || ol.buf.length > img.buf.length)) { img = ol; source = 'Open Library'; }
    await pause();
  }
  if (!img) { missed.push(rel); continue; }

  const name = `cover-${slug(title)}.${img.ext}`;
  const dest = path.join(ASSETS, name);
  const updates = { image: `[[assets/${name}]]` };
  if (!data.imageAlt || /^Book cover of\s*$/.test(String(data.imageAlt))) updates.imageAlt = `Book cover of ${fullTitle}`;
  const fm = setKeys(m[1], updates);
  let body = m[2];
  const embed = `![[${name}|Book cover of ${fullTitle.replace(/[|\]]/g, '')}|200]]`;
  body = /!\[\[\s*\|200\]\]/.test(body) ? body.replace(/!\[\[\s*\|200\]\]/, embed) : `${embed}\n\n${body.replace(/^\n+/, '')}`;

  if (!DRY_RUN) {
    fs.mkdirSync(ASSETS, { recursive: true });
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, img.buf);
    fs.writeFileSync(file, `---\n${fm}\n---\n${body}`);
  }
  added++;
  console.log(`${DRY_RUN ? '[dry run] ' : ''}cover added: ${rel} (${Math.round(img.buf.length / 1024)}KB, ${source})`);
}
console.log(`${DRY_RUN ? '[dry run] ' : ''}${added} covers added${missed.length ? `; no cover found for: ${missed.join(', ')}` : ''}`);
