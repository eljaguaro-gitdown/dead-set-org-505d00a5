import { describe, it, expect } from "vitest";
import { matchScore, findBestTrack } from "../../../supabase/functions/_shared/tapeMatch.ts";

/**
 * A word one song shares with another is not evidence of either.
 *
 * Found by the Tape Desk's catalog audit (docs/tape-desk/catalog-audit-2026-11-25.md),
 * then measured against 8,451 real Archive track titles from 118 nights on
 * Relisten, scored against all 226 catalog songs. On a tape without the song,
 * each of these let the player play a different song under its name:
 *
 *   - "Rain" (the Beatles cover, 1992-95) scored 85 for Cold Rain and Snow,
 *     Mission in the Rain, Samba in the Rain, Box of Rain and Looks Like Rain,
 *     and the other way round "Looks Like Rain" scored 90 for Rain (29 of the
 *     118 nights), with "Box of Rain", "Mystery Train" and "Glendale Train".
 *   - "U.S. Blues" lost its "U.S." to the single-letter filter, so every
 *     "... Blues" track scored 80 for it (30 nights).
 *   - "C.C. Rider" lost its "C.C." the same way and took "I Know You Rider"
 *     (20 nights).
 *   - "Around and Around" collapsed to one "around" and took "I've Been All
 *     Around This World".
 *
 * The other half matters as much: tapers really do shorten a song to one of
 * its own words, and every title below in `still matches` came off a real
 * tape. A fix that drops those is the opposite failure, a tape that carries
 * the song and is passed over.
 */

const MATCH = 60; // the threshold findBestTrack and every caller use

const mp3 = (title: string) => ({ name: `${title}.mp3`, title, format: "VBR MP3" });

describe("a shared word is not a match", () => {
  it("does not take the Beatles' Rain for a song with rain in its title", () => {
    for (const song of [
      "Cold Rain and Snow", "Mission in the Rain", "Samba in the Rain",
      "Box of Rain", "Looks Like Rain", "It Takes A Lot To Laugh, It Takes A Train To Cry",
    ]) {
      expect(matchScore("Rain", song), song).toBeLessThan(MATCH);
      expect(matchScore("11 Rain", song), song).toBeLessThan(MATCH);
    }
  });

  it("does not take a song with rain in its title for the Beatles' Rain", () => {
    for (const track of [
      "Looks Like Rain", "Box of Rain", "Cold Rain and Snow", "Mission in the Rain",
      "Samba In The Rain >", "gd76-06-29 t07 Looks Like Rain", "Early Morning Rain",
      "Mystery Train", "Glendale Train", "Rainy Day Women 12 & 35*",
    ]) {
      expect(matchScore(track, "Rain"), track).toBeLessThan(MATCH);
    }
  });

  it("does not take another blues for U.S. Blues", () => {
    for (const track of [
      "Cumberland Blues", "Mexicali Blues", "New Minglewood Blues", "Big Railroad Blues",
      "Viola Lee Blues", "Deep Elem Blues", "Blues For Allah", "Memphis Blues",
    ]) {
      expect(matchScore(track, "U.S. Blues"), track).toBeLessThan(MATCH);
    }
  });

  it("does not take I Know You Rider for C.C. Rider", () => {
    expect(matchScore("I Know You Rider", "C.C. Rider")).toBeLessThan(MATCH);
    expect(matchScore("China Cat Sunflower > I Know You Rider", "C.C. Rider")).toBeLessThan(MATCH);
    // …nor C.C. Rider for I Know You Rider, which never matched and must not start.
    expect(matchScore("C.C. Rider", "I Know You Rider")).toBeLessThan(MATCH);
  });

  it("does not take I've Been All Around This World for Around and Around", () => {
    expect(matchScore("I've Been All Around This World", "Around and Around")).toBeLessThan(MATCH);
    expect(matchScore("04 - All Around This World", "Around and Around")).toBeLessThan(MATCH);
  });

  it("passes over a tape that carries only the other song", () => {
    // findBestTrack is what the player and the tape index call.
    const night = [mp3("Rain"), mp3("Samba in the Rain"), mp3("Looks Like Rain")];
    expect(findBestTrack(night, "Mission in the Rain")).toBeNull();
    expect(findBestTrack(night, "Cold Rain and Snow")).toBeNull();
    expect(findBestTrack(night, "Rain")?.file.title).toBe("Rain");
    expect(findBestTrack(night, "Samba in the Rain")?.file.title).toBe("Samba in the Rain");

    expect(findBestTrack([mp3("Mexicali Blues"), mp3("Cumberland Blues")], "U.S. Blues")).toBeNull();
    expect(findBestTrack([mp3("China Cat Sunflower"), mp3("I Know You Rider")], "C.C. Rider")).toBeNull();
  });
});

describe("still matches", () => {
  it("every spelling of the song itself", () => {
    const forms: Array<[string, string]> = [
      ["Cold Rain & Snow", "Cold Rain and Snow"],
      ["Cold Rain", "Cold Rain and Snow"],
      ["Cold Rain And Snow (5:52)", "Cold Rain and Snow"],
      ["US Blues", "U.S. Blues"],
      ["U.S. Blues", "U.S. Blues"],
      ["U. S. Blues", "U.S. Blues"],
      ["E: U. S. Blues", "U.S. Blues"],
      ["E1: US Blues >", "U.S. Blues"],
      ["C C Rider", "C.C. Rider"],
      ["gd81-03-20 s1 t04 CC Rider", "C.C. Rider"],
      ["Around & Around", "Around and Around"],
      ["Encore - Around and Around", "Around and Around"],
      ["Around And Around (First time played)", "Around and Around"],
      ["West LA Fadeaway", "West L.A. Fadeaway"],
    ];
    for (const [track, song] of forms) expect(matchScore(track, song), `${track} | ${song}`).toBeGreaterThanOrEqual(MATCH);
  });

  it("the Beatles' Rain under the furniture tapers put in front of it", () => {
    for (const track of [
      "Rain", "Rain >", "20 Rain", "E: Rain", "Encore: Rain",
      "GD1995-03-18 17. Rain", "Disc03,Track05 Rain", "Rain (Beatles)",
    ]) {
      expect(matchScore(track, "Rain"), track).toBeGreaterThanOrEqual(MATCH);
    }
  });

  it("a song shortened to one of its own words", () => {
    // Real titles, each from a tape of a night the song was played.
    const forms: Array<[string, string]> = [
      ["Stranger", "Feel Like a Stranger"],
      ["Bucket", "Hell in a Bucket"],
      ["Roses", "It Must Have Been the Roses"],
      ["Rooster", "Little Red Rooster"],
      ["China -> Rider->", "I Know You Rider"],
      ["Lovelight", "Turn on Your Love Light"],
      ["Minglewood", "New Minglewood Blues"],
      ["Help > Slipknot > Franklin", "Franklin's Tower"],
    ];
    for (const [track, song] of forms) expect(matchScore(track, song), `${track} | ${song}`).toBeGreaterThanOrEqual(MATCH);
  });

  it("a one-word song inside a longer title, when no other song uses the word", () => {
    expect(matchScore("E1: (I Can't Get No) Satisfaction >", "Satisfaction")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Truckin' Jam", "Truckin'")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Eleven Jam", "The Eleven")).toBeGreaterThanOrEqual(MATCH);
  });

  it("the segue splits, the suite rule and a trailing arrow", () => {
    const suite = "Help > Slipknot > Franklin's Tower";
    expect(matchScore(suite, "Help on the Way")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore(suite, "Slipknot!")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore(suite, "Franklin's Tower")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Slipknot Jam >", "Slipknot!")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Terrapin Station", "Lady with a Fan")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Weather Report Suite", "Let It Grow")).toBeLessThan(MATCH);
  });

  it("the short forms that carry two words of the song", () => {
    expect(matchScore("Half Step", "Mississippi Half-Step Uptown Toodeloo")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Memphis Blues", "Stuck Inside of Mobile with the Memphis Blues Again"))
      .toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Minglewood Blues", "New Minglewood Blues")).toBeGreaterThanOrEqual(MATCH);
  });
});
