// Instapaper -> site data. Reads the articles you've liked from your public
// Instapaper profile and writes the latest 5 to src/site/_data/instapaper.json
// for the Reading page.
//
//   node scripts/sync-instapaper.mjs
//
// Source: https://www.instapaper.com/data/profile/<username> — the JSON your
// public profile page (instapaper.com/p/<username>) loads in the browser. No
// login or secret needed, but it's not a documented API, so it could change:
// if the response isn't the expected shape the script stops with an error
// and leaves the existing data alone rather than emptying the list.
//
// Env: INSTAPAPER_USER (default teresawatts), INSTAPAPER_FIXTURE=<file.json>
// to read a saved response instead (testing). Only writes when the articles
// changed, so a no-op run writes 0 files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'src/site/_data/instapaper.json');
const LIMIT = 5;
const USER = process.env.INSTAPAPER_USER || 'teresawatts';
const FIXTURE = process.env.INSTAPAPER_FIXTURE;

async function readProfile() {
  if (FIXTURE) { console.log(`Using fixture ${FIXTURE} (no network)`); return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')); }
  const res = await fetch(`https://www.instapaper.com/data/profile/${encodeURIComponent(USER)}?page=1`, {
    headers: { 'User-Agent': 'teresawatts.com-reading-sync', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Instapaper profile: HTTP ${res.status}`);
  if (!/json/.test(res.headers.get('content-type') || '')) throw new Error(`Instapaper profile for "${USER}" didn't return JSON — check the username, or the format may have changed`);
  return res.json();
}

const profile = await readProfile();
if (!profile || !Array.isArray(profile.bookmarks)) throw new Error('Instapaper profile response has no bookmarks list — the format may have changed');

const items = profile.bookmarks
  // private_source = saved from somewhere without a public link (e.g. an
  // emailed newsletter), which visitors couldn't open
  .filter((b) => b.liked && !b.private_source && /^https?:/.test(b.url || ''))
  .slice(0, LIMIT)
  .map((b) => {
    let site = '';
    try { site = new URL(b.url).hostname.replace(/^www\./, ''); } catch { /* checked above */ }
    return {
      title: (b.title || b.url).trim(),
      url: b.url,
      site, // from the URL: site_name is just "substack.com" for every Substack
      author: (b.author || '').trim(),
      date: b.time ? new Date(b.time * 1000).toISOString().slice(0, 10) : null, // when liked
      description: (b.description || '').replace(/\s+/g, ' ').trim(),
    };
  });

const text = JSON.stringify({ _generated: 'by scripts/sync-instapaper.mjs — do not edit', items }, null, 2) + '\n';
const changed = !fs.existsSync(DATA_FILE) || fs.readFileSync(DATA_FILE, 'utf8') !== text;
if (changed) fs.writeFileSync(DATA_FILE, text);
console.log(`${items.length} liked articles from instapaper.com/p/${USER}, ${changed ? 1 : 0} files written (${path.relative(ROOT, DATA_FILE)})`);
