import { describe, it, expect } from "vitest";
import { describeAuthError } from "@/lib/authErrors";

describe("describeAuthError", () => {
  it("gives the breached-password rejection a way forward", () => {
    // The exact string Supabase returned on 9 of 16 signup failures.
    const { message, action } = describeAuthError(
      "Password is known to be weak and easy to guess, please choose a different one.",
    );
    expect(message).toMatch(/breach lists/);
    expect(message).toMatch(/unrelated words/);
    expect(action).toBeNull();
  });

  it("routes an existing account to sign-in instead of a dead end", () => {
    const { action } = describeAuthError("User already registered");
    expect(action).toBe("switch-to-signin");
  });

  it("points a failed sign-in at password reset", () => {
    const { message, action } = describeAuthError("Invalid login credentials");
    expect(message).toMatch(/Forgot your password/);
    expect(action).toBeNull();
  });

  it("explains an unconfirmed email now that confirmation is switched on", () => {
    expect(describeAuthError("Email not confirmed").message).toMatch(/confirmation link/);
  });

  it("keeps Supabase's own wording when unmapped", () => {
    // A vague friendly message is worse than a precise unfamiliar one.
    expect(describeAuthError("Rate limit exceeded").message).toBe("Rate limit exceeded");
  });

  it("never returns an empty message", () => {
    for (const input of [undefined, null, "", "   "]) {
      expect(describeAuthError(input).message.length).toBeGreaterThan(0);
    }
  });
});
