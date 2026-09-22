// Writes a file by writing to a sibling temp file first, then renaming it
// into place. rename() is atomic on the same filesystem, so a reader (the
// app loading data/library.js, or another script's require()) never sees a
// half-written file, and a crash mid-write leaves the original untouched
// instead of a truncated one. Shared by server.js (the app's own saves) and
// commit.js (the drain's writes), which is why it lives in its own file.

var fs = require('fs');

function writeAtomic(file, text) {
  var tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

module.exports = { writeAtomic: writeAtomic };
