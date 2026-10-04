import { describe, it, expect } from "vitest";
import { INVITE_COPY } from "@/lib/signInInviteCopy";

/**
 * Once the sheet offers a plain link AND an Instagram post, both free, the
 * case for signing in has to be made rather than assumed. These pin that it
 * is made concretely — three things you get, not an adjective.
 */
describe("the sign-in case", () => {
  it("names what signing in actually gives you", () => {
    expect(INVITE_COPY.share.benefits.length).toBeGreaterThanOrEqual(3);
    for (const b of INVITE_COPY.share.benefits) expect(b.length).toBeGreaterThan(10);
  });

  it("leads with credit, which is the honest reason for a public page", () => {
    expect(INVITE_COPY.share.benefits[0]).toMatch(/your name/i);
  });

  it("offers the Songbook, which is the community benefit", () => {
    expect(INVITE_COPY.share.benefits.join(" ")).toMatch(/songbook/i);
    expect(INVITE_COPY.save.benefits.join(" ")).toMatch(/songbook/i);
  });

  it("says what the plain link costs, so the choice is informed", () => {
    expect(INVITE_COPY.share.plainNote).toBeTruthy();
    expect(INVITE_COPY.share.plainNote).toMatch(/nobody's name|plain/i);
  });

  it("gives saving no free doors — a guide needs an account to exist", () => {
    expect(INVITE_COPY.save.plainLabel).toBeUndefined();
    expect(INVITE_COPY.save.instagramLabel).toBeUndefined();
  });

  it("never says the forbidden words", () => {
    for (const copy of Object.values(INVITE_COPY)) {
      const all = [copy.title, copy.body, copy.primary, ...copy.benefits].join(" ");
      expect(all).not.toMatch(/\bAI\b|algorithm|model|engine|pipeline|database|account settings/i);
    }
  });
});
