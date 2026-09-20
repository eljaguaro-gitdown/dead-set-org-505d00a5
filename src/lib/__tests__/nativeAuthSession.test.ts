import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted, because vi.mock is lifted above these declarations.
const { exchangeCodeForSession, setSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { exchangeCodeForSession, setSession } },
}));

import {
  establishSessionFromCallbackUrl,
  CALLBACK_FAILED_MESSAGE,
} from "@/lib/nativeAuthSession";

const session = (id: string) => ({ data: { session: { user: { id } } }, error: null });

describe("establishSessionFromCallbackUrl", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    setSession.mockReset();
  });

  it("exchanges a PKCE code for a session", async () => {
    exchangeCodeForSession.mockResolvedValue(session("user-1"));

    const outcome = await establishSessionFromCallbackUrl(
      "org.deadset.app://auth-callback?code=abc123",
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(outcome).toEqual({ status: "signed-in", next: "/", userId: "user-1" });
  });

  it("accepts the implicit shape, where tokens ride the fragment", async () => {
    setSession.mockResolvedValue(session("user-2"));

    const outcome = await establishSessionFromCallbackUrl(
      "org.deadset.app://auth-callback#access_token=at&refresh_token=rt",
    );

    expect(setSession).toHaveBeenCalledWith({
      access_token: "at",
      refresh_token: "rt",
    });
    expect(outcome).toEqual({ status: "signed-in", next: "/", userId: "user-2" });
  });

  it("carries ?next= through to the caller", async () => {
    exchangeCodeForSession.mockResolvedValue(session("user-3"));

    const outcome = await establishSessionFromCallbackUrl(
      "org.deadset.app://auth-callback?next=%2Fmy-setlists&code=abc123",
    );

    expect(outcome).toMatchObject({ status: "signed-in", next: "/my-setlists" });
  });

  it("surfaces the provider's own error description", async () => {
    const outcome = await establishSessionFromCallbackUrl(
      "org.deadset.app://auth-callback?error_description=Access%20denied",
    );

    expect(outcome).toEqual({ status: "error", message: "Access denied" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("reports a failed exchange without throwing", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: new Error("code expired"),
    });

    const outcome = await establishSessionFromCallbackUrl(
      "org.deadset.app://auth-callback?code=stale",
    );

    expect(outcome).toEqual({ status: "error", message: CALLBACK_FAILED_MESSAGE });
  });

  it("ignores a url for another scheme, and one carrying no session", async () => {
    expect(
      await establishSessionFromCallbackUrl("https://dead-set.org/auth?code=abc"),
    ).toEqual({ status: "ignored" });

    expect(
      await establishSessionFromCallbackUrl("org.deadset.app://auth-callback"),
    ).toEqual({ status: "ignored" });

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });
});
