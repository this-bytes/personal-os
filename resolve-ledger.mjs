import fs from 'node:fs';

const path = '.factory/INTAKE.md';
const t = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const sep = t.findIndex((l) => l.startsWith('======='));
const end = t.findIndex((l) => l.startsWith('>>>>>>> '));
if (sep === -1 || end === -1) throw new Error('no conflict markers found');

// Main's side: the peer keeps WI-106 for the licence-record item, and its two
// WI-103 rows ride with it.
const theirs = t.slice(sep + 1, end);

// Our publication row, renumbered to WI-111 because the peer's WI-106 is now
// bound to a live dispatch.
const ours = t
  .find((l) => l.includes('wi-106-publish-template-contract-2026-10-22'))
  .replace(
    'wi-106-publish-template-contract-2026-10-22',
    'wi-111-publish-template-contract-2026-10-22',
  )
  .replace(
    '| WI-106 — publish what WI-097 and WI-090 actually built |',
    '| WI-111 — publish what WI-097 and WI-090 actually built |',
  )
  .replace(
    '**THE NUMBER WAS TAKEN AT 04:31 AND CARRIED ON THE REMOTE FROM 04:53**',
    '**THE NUMBER WAS TAKEN AT 04:31 AND CARRIED ON THE REMOTE FROM 04:53, AND YIELDED TO THE PEER\'S LIVE DISPATCH**',
  )
  .replace(
    "The item's file is `.factory/work/WI-106.md`",
    "The item's file is `.factory/work/WI-111.md`",
  );

const out = [...t.slice(0, sep - 2), ...theirs, ours, ...t.slice(end + 1)];
fs.writeFileSync(path, out.join('\n'));
console.log('resolved; markers left:', out.filter((l) => /^(<<<<<<<|=======|>>>>>>>|\|\|\|\|\|\|\|)/.test(l)).length);
