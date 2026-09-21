#!/usr/bin/env node
// The drain's inbox bookkeeping, so an agent never has to hand-edit
// inbox.md or re-implement the dedupe rule. See docs/agents/drain.md.
//
//   node scripts/inbox.js                      list captures as JSON, each
//                                              flagged duplicate or not, plus
//                                              malformed lines
//   node scripts/inbox.js skip "<line>"        strike a duplicate's line
//   node scripts/inbox.js fail "<line>" "<why>"  leave the line, note why the
//                                              fetch failed

var fs = require('fs');
var path = require('path');
var curation = require('../js/curation.js');
var lib = require('./drain-lib.js');

var ROOT = path.resolve(__dirname, '..');
var INBOX = path.join(ROOT, 'inbox.md');

function readInbox() {
  return fs.existsSync(INBOX) ? fs.readFileSync(INBOX, 'utf8') : '';
}

function main(args) {
  var command = args[0] || 'list';
  if (command === 'list') {
    var library = require(path.join(ROOT, 'data/library.js')).LIBRARY;
    process.stdout.write(JSON.stringify(lib.listInbox(readInbox(), library), null, 2) + '\n');
    return 0;
  }
  if (command === 'skip') {
    if (!args[1]) return usage();
    fs.writeFileSync(INBOX, curation.removeCaptureLine(readInbox(), args[1]));
    console.log('struck: ' + args[1]);
    return 0;
  }
  if (command === 'fail') {
    if (!args[1] || !args[2]) return usage();
    fs.writeFileSync(INBOX, lib.markFetchFailed(readInbox(), args[1], args[2]));
    console.log('kept with reason: ' + args[1]);
    return 0;
  }
  return usage();
}

function usage() {
  console.error('usage: node scripts/inbox.js [list | skip "<line>" | fail "<line>" "<reason>"]');
  return 64;
}

process.exitCode = main(process.argv.slice(2));
