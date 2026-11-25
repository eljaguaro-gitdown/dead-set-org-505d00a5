// The tables for the catalog audit report, from catalogAudit.ts's audit.json.
//   node scripts/tape-desk/catalogAuditReport.mjs <out dir>
// Writes report-tables.md, report-stats.json, fix-A.json and fix-C1.json into <out dir>.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2];
const a = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"));
const short = (v) => (v || "").replace(/, [A-Z]{2}$/, "").replace(/, (England|Canada|Netherlands|Germany|France|Denmark|Sweden|Egypt|Spain|Luxembourg)$/, "");
const MEDLEY = new Set(["Scarlet Fire", "Scarlet Begonias > Fire on the Mountain", "Truckin > Smokestack Lightning"]);
const GENERIC = new Set(["Drums", "Space", "Jam"]);

const A = [], B = [], C1 = [], C2 = [], D = [];
for (const s of a) {
  if (!s.gd) { D.push(s); continue; }
  if (!s.catalog.first && !s.catalog.last) {
    const agree = s.rl && s.rl.first === s.gd.first && s.rl.last === s.gd.last;
    (agree && !MEDLEY.has(s.title) ? C1 : C2).push(s);
    continue;
  }
  for (const end of ["first", "last"]) {
    if (s.catalog[end] === s.gd[end]) continue;
    const row = {
      s, end, cat: s.catalog[end], jb: s.gd[end], venue: short(s.gd[end + "Venue"]), type: s.gd[end + "Type"],
      rl: s.rl ? s.rl[end] : null, catPlayed: s.gd.dates.includes(s.catalog[end]), catOnTape: s.rlDates.includes(s.catalog[end]),
      jbOnTape: s.rlDates.includes(s.gd[end]),
    };
    row.undated = end === "first" ? s.gd.undatedBefore : s.gd.undatedAfter;
    (s.rl && s.rl[end] === s.gd[end] && !MEDLEY.has(s.title) && !row.undated.length ? A : B).push(row);
  }
}

const esc = (t) => t.replace(/\|/g, "\\|");
const catNight = (r) => (r.catPlayed ? (r.catOnTape ? "played, on tape" : "played, no tape") : r.catOnTape ? "**not in JerryBase's setlist**, but on tape" : "**not played**");
let md = "";
md += `### A. Both sources agree, and the catalog doesn't (${A.length} dates, ${new Set(A.map((r) => r.s.title)).size} songs)\n\n`;
md += "| Song | | Catalog | JerryBase = Relisten | Venue | Catalog's night |\n|---|---|---|---|---|---|\n";
for (const r of A) md += `| ${esc(r.s.title)} | ${r.end} | ${r.cat} | **${r.jb}** | ${esc(r.venue)} | ${catNight(r)} |\n`;

md += `\n### B. The sources disagree, or only JerryBase knows (${B.length} dates, ${new Set(B.map((r) => r.s.title)).size} songs)\n\n`;
md += "JerryBase is the performed setlist. Relisten's first/last is the first/last night *on tape*, read from the Archive's own dating.\n\n";
md += "| Song | | Catalog | JerryBase | Venue (JerryBase) | Relisten's on tape | Catalog's night | Why it's here |\n|---|---|---|---|---|---|---|---|\n";
for (const r of B) {
  const why = [];
  if (MEDLEY.has(r.s.title)) why.push("medley row: nights where both parts were played");
  if (GENERIC.has(r.s.title)) why.push("a segment name, not a song");
  if (r.type === "Session") why.push("JerryBase's night is a TV/radio session");
  if (/^1966-01-(07|28)$/.test(r.jb)) why.push("January 1966 Matrix tapes");
  if (r.undated.length) why.push(`JerryBase also lists it on a night with no known day (${r.undated.join(", ")})`);
  if (!r.jbOnTape && !MEDLEY.has(r.s.title)) why.push("JerryBase's night isn't on any tape Relisten lists");
  else if (r.rl && r.rl !== r.jb && !MEDLEY.has(r.s.title)) why.push(`Relisten has a taped night JerryBase doesn't list (${r.rl})`);
  md += `| ${esc(r.s.title)} | ${r.end} | ${r.cat} | ${r.jb} | ${esc(r.venue)} | ${r.rl ?? "—"} | ${catNight(r)} | ${why.join("; ")} |\n`;
}

md += `\n### C. The catalog has no dates (${C1.length + C2.length} songs)\n\n`;
md += `C1, ${C1.length} songs: JerryBase and Relisten agree at both ends.\n\n| Song | First | Venue | Last | Venue | Nights (JerryBase) |\n|---|---|---|---|---|---|\n`;
for (const s of C1) md += `| ${esc(s.title)} | ${s.gd.first} | ${esc(short(s.gd.firstVenue))} | ${s.gd.last} | ${esc(short(s.gd.lastVenue))} | ${new Set(s.gd.dates).size} |\n`;
md += `\nC2, ${C2.length} songs: the sources disagree at one end, or the row is a medley.\n\n| Song | JerryBase first | Relisten first | JerryBase last | Relisten last | Note |\n|---|---|---|---|---|---|\n`;
for (const s of C2) md += `| ${esc(s.title)} | ${s.gd.first} | ${s.rl?.first ?? "—"} | ${s.gd.last} | ${s.rl?.last ?? "—"} | ${MEDLEY.has(s.title) ? "medley row" : !s.rl ? "no Relisten song" : ""} |\n`;

md += `\n### D. JerryBase has no Grateful Dead performance of it (${D.length} songs)\n\n| Song | Catalog first | Catalog last |\n|---|---|---|\n`;
for (const s of D) md += `| ${esc(s.title)} | ${s.catalog.first ?? "—"} | ${s.catalog.last ?? "—"} |\n`;

const times = a.filter((s) => s.gd && s.rl && s.catalog.times != null && new Set(s.gd.dates).size === s.rl.count && Math.abs(s.catalog.times - s.rl.count) >= 3);
const stats = { A: A.length, Afirst: A.filter((r) => r.end === "first").length, Alast: A.filter((r) => r.end === "last").length, Asongs: new Set(A.map((r) => r.s.title)).size, AnotPlayed: A.filter((r) => !r.catPlayed).length,
  B: B.length, Bfirst: B.filter((r) => r.end === "first").length, Blast: B.filter((r) => r.end === "last").length, Bsongs: new Set(B.map((r) => r.s.title)).size, BnotPlayed: B.filter((r) => !r.catPlayed).length,
  C1: C1.length, C2: C2.length, D: D.length, timesBothAgreeCatalogOff: times.length, timesExamples: times.slice(0, 5).map((s) => `${s.title} ${s.catalog.times} vs ${s.rl.count}`),
  agreeFirst: a.filter((s) => s.gd && s.catalog.first && s.catalog.first === s.gd.first).length, agreeLast: a.filter((s) => s.gd && s.catalog.last && s.catalog.last === s.gd.last).length,
  datedAudited: a.filter((s) => s.gd && s.catalog.first).length };
writeFileSync(join(dir, "report-tables.md"), md);
writeFileSync(join(dir, "report-stats.json"), JSON.stringify(stats, null, 1));
writeFileSync(join(dir, "fix-A.json"), JSON.stringify(A.map((r) => ({ id: r.s.id, title: r.s.title, end: r.end, from: r.cat, to: r.jb })), null, 1));
writeFileSync(join(dir, "fix-C1.json"), JSON.stringify(C1.map((s) => ({ id: s.id, title: s.title, first: s.gd.first, last: s.gd.last })), null, 1));
console.log(JSON.stringify(stats, null, 1));
