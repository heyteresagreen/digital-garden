#!/bin/zsh
# Daily Hardcover -> Obsidian sync, run by macOS (launchd) at 7am.
# Makes notes for books being read now or finished this year, links notes
# that clearly match a Hardcover book (adds only the `hardcover:` line), and
# copies new Hardcover quotes into ## Highlights, then adds covers to book
# notes that have none (scripts/book-covers.mjs). Never touches the website
# data — the daily GitHub Action does that.
#
# Schedule: ~/Library/LaunchAgents/com.teresawatts.obsidian-book-sync.plist
# Log:      ~/Library/Logs/obsidian-book-sync.log
# Run now:  zsh scripts/obsidian-sync.sh            (add --dry-run to preview)
# Stop it:  launchctl bootout gui/$(id -u)/com.teresawatts.obsidian-book-sync
#
# Needs HARDCOVER_TOKEN in the repo's .env file.

VAULT_BOOKS="$HOME/Notes/teresawatts v2/books"
SINCE="$(date +%Y)-01-01"   # books finished in earlier years don't get new notes

cd "${0:A:h}/.." || exit 1
# launchd starts with a bare PATH; add Homebrew's so `node` is found
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@18/bin:/usr/local/bin:$PATH"
echo "--- $(date '+%Y-%m-%d %H:%M')"
node scripts/sync-hardcover.mjs --vault "$VAULT_BOOKS" --link --since "$SINCE" "$@"
# Covers for book notes that don't have one (Hardcover's, or Open Library's).
# Doesn't need Hardcover — keep this line if Hardcover is ever removed.
node scripts/book-covers.mjs --vault "$VAULT_BOOKS" "$@"
