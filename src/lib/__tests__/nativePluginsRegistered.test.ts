import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every app-embedded Capacitor plugin must be listed twice, and a green build
 * proves neither listing.
 *
 * WebAuthPlugin.swift shipped in build 23 compiling cleanly and doing nothing:
 * app-embedded plugins are not auto-discovered, so a plugin missing from
 * MainViewController.capacitorDidLoad() is simply absent at runtime, and the
 * only symptom is a toast reading `"WebAuth" plugin is not implemented on ios`
 * — on device, after an upload. The archive cannot fail on it. Nor can it fail
 * on a plugin missing from project.pbxproj: an unreferenced source file is
 * skipped silently.
 *
 * So both listings are asserted here, where the feedback costs seconds.
 */

const IOS_APP = join(process.cwd(), "ios", "App", "App");
const CONTROLLER = join(IOS_APP, "MainViewController.swift");
const PBXPROJ = join(process.cwd(), "ios", "App", "App.xcodeproj", "project.pbxproj");

/** Plugin classes declared in the app target, by their Swift class name. */
function declaredPlugins(): { className: string; file: string }[] {
  return readdirSync(IOS_APP)
    .filter((f) => f.endsWith(".swift"))
    .flatMap((file) => {
      const source = readFileSync(join(IOS_APP, file), "utf-8");
      const match = source.match(/class\s+(\w+)\s*:\s*CAPPlugin\b/);
      return match ? [{ className: match[1], file }] : [];
    });
}

describe("app-embedded iOS plugins", () => {
  it("finds the plugins it is meant to be guarding", () => {
    // Guards the guard: a regex that silently matches nothing would make
    // every assertion below vacuously true.
    expect(declaredPlugins().map((p) => p.className).sort()).toEqual([
      "DeepLinkPlugin",
      "NativeAudioPlugin",
      "WebAuthPlugin",
    ]);
  });

  it("registers every plugin on the bridge", () => {
    const controller = readFileSync(CONTROLLER, "utf-8");
    for (const { className } of declaredPlugins()) {
      expect(controller).toContain(`registerPluginInstance(${className}())`);
    }
  });

  it("compiles every plugin into the app target", () => {
    const pbxproj = readFileSync(PBXPROJ, "utf-8");
    for (const { file } of declaredPlugins()) {
      // The Sources build phase entry, not just the file reference — a file
      // can be in the project navigator and still never be compiled.
      expect(pbxproj).toMatch(
        new RegExp(`${file.replace(".", "\\.")} in Sources`),
      );
    }
  });
});
