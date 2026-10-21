// The one list of site sections, shared by .eleventy.js (collections,
// wiki-link targets, URLs), notes.11tydata.js (note permalinks) and
// templates (as `sections`). Add a section here + one <section>.njk index.
module.exports = {
  all: ["writing", "notes", "art", "sketching", "sketchbooks", "books", "letters", "projects"],
  // what counts as "Making": the /making/ page, the homepage's Making rows
  // and the nav's Making link. crafts has no section yet; it'll be picked
  // up once there is one
  making: ["art", "sketching", "sketchbooks", "crafts"]
};
