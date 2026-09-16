import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findTrackInRecording } from "@/lib/archiveOrg";

/**
 * The Grateful Dead collection on archive.org is not uniform. Per the Archive's
 * own help page: "Audience-made Grateful Dead concert recordings are available
 * as downloads while available soundboards are accessible in streaming format
 * only" — at the band's request. Those soundboards carry
 * access-restricted-item: "true" and sit in the stream_only collection.
 *
 * We only ever stream, and MP3 derivatives are what archive.org's own player
 * streams, so restricted items still play. What must never happen is reaching
 * for the restricted lossless ORIGINAL on one: that earns a 403 (feeding the
 * 21.2% playback error rate) and would make the App Review notes' claim that
 * the band's policy is honored untrue.
 *
 * Shapes below are taken from real responses —
 * gd77-09-03.sbd.unk.276.sbefixed.shnf is a live stream_only soundboard.
 */

const MP3 = { name: "gd77-09-03d1t01.mp3", format: "VBR MP3", title: "Scarlet Begonias" };
const FLAC = { name: "gd77-09-03d1t01.flac", format: "Flac", title: "Scarlet Begonias" };
const FLAC24 = { name: "gd77-09-03d1t01.24.flac", format: "24bit Flac", title: "Scarlet Begonias" };

const metadataResponse = (files: unknown[], metadata: Record<string, unknown>) => ({
  ok: true,
  json: async () => ({ files, metadata }),
});

const RESTRICTED = {
  identifier: "gd77-09-03.sbd.unk.276.sbefixed.shnf",
  "access-restricted-item": "true",
  collection: ["GratefulDead", "etree", "stream_only"],
};
const OPEN = {
  identifier: "gd77-05-08.aud.vernon.1234.shnf",
  collection: ["GratefulDead", "etree"],
};

const url = (id: string) => `https://archive.org/details/${id}`;

describe("findTrackInRecording — stream-only items", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("plays the MP3 derivative on a restricted soundboard", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => metadataResponse([FLAC, MP3], RESTRICTED)));

    const result = await findTrackInRecording(url(RESTRICTED.identifier), "Scarlet Begonias");
    expect(result).toContain(".mp3");
    expect(result).not.toContain(".flac");
  });

  it("skips a restricted item that has no derivative rather than serving the original", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => metadataResponse([FLAC, FLAC24], RESTRICTED)));

    const result = await findTrackInRecording(url(RESTRICTED.identifier), "Scarlet Begonias");
    expect(result).toBeNull();
  });

  it("detects the restriction from access-restricted-item alone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      metadataResponse([FLAC], { identifier: "x", "access-restricted-item": "true" }),
    ));

    expect(await findTrackInRecording(url("x"), "Scarlet Begonias")).toBeNull();
  });

  it("detects the restriction when collection is a bare string, not an array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      metadataResponse([FLAC], { identifier: "x", collection: "stream_only" }),
    ));

    expect(await findTrackInRecording(url("x"), "Scarlet Begonias")).toBeNull();
  });

  it("still falls back to FLAC on an unrestricted audience tape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => metadataResponse([FLAC], OPEN)));

    const result = await findTrackInRecording(url(OPEN.identifier), "Scarlet Begonias");
    expect(result).toContain(".flac");
  });

  it("prefers MP3 over FLAC on an unrestricted tape too", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => metadataResponse([FLAC, MP3], OPEN)));

    const result = await findTrackInRecording(url(OPEN.identifier), "Scarlet Begonias");
    expect(result).toContain(".mp3");
  });

  it("passes an abort signal so a hung archive.org request cannot spin forever", async () => {
    const spy = vi.fn(async () => metadataResponse([MP3], OPEN));
    vi.stubGlobal("fetch", spy);

    await findTrackInRecording(url(OPEN.identifier), "Scarlet Begonias");
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });
});
