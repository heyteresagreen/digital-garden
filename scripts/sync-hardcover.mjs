import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const TOKEN = (process.env.HARDCOVER_TOKEN || '').replace(/^Bearer\s+/i, '');
const OUT_DIR = process.env.BOOKS_DIR || 'Books';
const API = 'https://api.hardcover.app/v1/graphql';
const STATUS = { 1: 'want-to-read', 2: 'reading', 3: 'read', 4: 'paused', 5: 'dnf' };
const UUID_TAIL = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

if (!TOKEN) { console.error('HARDCOVER_TOKEN not set'); process.exit(1); }

const FULL = `query { me { user_books { id status_id rating date_added
  book { title slug image { url } contributions { author { name } } } } } }`;
const BASIC = `query { me { user_books { id status_id rating date_added
  book { title slug } } } }`;

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

let json = await gql(FULL);
if (json.errors) {
  console.warn('Full query failed, falling back to basic:', JSON.stringify(json.errors));
  json = await gql(BASIC);
}
if (json.errors) throw new Error(JSON.stringify(json.errors));

const books = json.data.me[0].user_books;
fs.mkdirSync(OUT_DIR, { recursive: true });
let changed = 0;

for (const ub of books) {
  const b = ub.book;
  const file = path.join(OUT_DIR, `${b.slug.replace(UUID_TAIL, '')}.md`);
  const authors = (b.contributions || []).map((c) => c.author?.name).filter(Boolean);

  const generated = {
    title: b.title,
    ...(authors.length && { authors }),
    status: STATUS[ub.status_id] || 'unknown',
    rating: ub.rating ?? null,
    dateAdded: ub.date_added,
    ...(b.image?.url && { cover: b.image.url }),
    hardcoverId: ub.id,
    hardcoverUrl: `https://hardcover.app/books/${b.slug}`,
  };

  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const existing = prev ? matter(prev) : { data: {}, content: '' };
  const out = matter.stringify(existing.content, { ...existing.data, ...generated });

  if (out !== prev) { fs.writeFileSync(file, out); changed++; }
}
console.log(`${books.length} books, ${changed} files written`);