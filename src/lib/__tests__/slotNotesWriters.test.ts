import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { slotNotesBy, slotNotesColumns, readNotesBy } from "@/hooks/useSetlist";
import type { SetlistSlotData } from "@/components/SetlistDisplay";

/**
 * `setlist_slots.notes_by` says whose words are in `notes`, and Charlie's
 * credit is printed from it. A write that sets `notes` without it leaves the
 * last author on the row: rewrite Charlie's note, and his name stays on yours.
 * So every slot row a client or function writes sets both, either through
 * slotNotesColumns() or by naming notes_by.
 */

const ROOT = join(__dirname, "../../..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name === "__tests__" || /\.test\.tsx?$/.test(name)) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });

describe("every slot row sets notes and notes_by together", () => {
  it("has no slot row literal with notes and no author", () => {
    const offenders: string[] = [];
    for (const f of [...walk(join(ROOT, "src")), ...walk(join(ROOT, "supabase/functions"))]) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        // A slot row is the object that carries segue_to_next.
        if (!/\bsegue_to_next\s*:/.test(line)) return;
        const window = lines.slice(Math.max(0, i - 12), i + 3).join("\n");
        if (!/\bnotes\s*:/.test(window) && !/slotNotesColumns/.test(window)) return;
        if (/\bnotes_by\s*:|slotNotesColumns/.test(window)) return;
        offenders.push(`${relative(ROOT, f)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

const slot = (notes: string, notesBy?: SetlistSlotData["notesBy"]): SetlistSlotData =>
  ({ id: "s1", song: { id: "song" } as SetlistSlotData["song"], version: null, setNumber: 1, position: 0, segueToNext: false, notes, notesBy });

describe("slotNotesColumns", () => {
  it("writes the author with the notes", () => {
    expect(slotNotesColumns(slot("A patient opener.", "charlie"))).toEqual({ notes: "A patient opener.", notes_by: "charlie" });
    expect(slotNotesColumns(slot("My first show.", "member"))).toEqual({ notes: "My first show.", notes_by: "member" });
  });

  it("empty notes have no author", () => {
    expect(slotNotesBy(slot("  ", "charlie"))).toBeNull();
  });

  it("unknown stays unknown, and gets no credit", () => {
    expect(slotNotesBy(slot("Typed long ago."))).toBeNull();
  });

  it("reads only the values the rule knows", () => {
    expect(readNotesBy("charlie")).toBe("charlie");
    expect(readNotesBy("member")).toBe("member");
    expect(readNotesBy("dead_set")).toBe("dead_set");
    expect(readNotesBy("Charlie")).toBeNull();
    expect(readNotesBy(null)).toBeNull();
  });
});
