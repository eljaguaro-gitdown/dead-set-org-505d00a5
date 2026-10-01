import { describe, expect, it } from "vitest";
import { isObjectionable, normalizeForFilter } from "@/lib/contentFilter";

describe("isObjectionable", () => {
  it("catches listed terms as whole words, in any case", () => {
    expect(isObjectionable("what a fucking jam")).toBe(true);
    expect(isObjectionable("FUCK this")).toBe(true);
    expect(isObjectionable("you absolute asshole")).toBe(true);
  });

  it("catches leetspeak, stretched letters and accents", () => {
    expect(isObjectionable("f*ck")).toBe(false); // not a letter swap — left to reports
    expect(isObjectionable("fuuuuck")).toBe(true);
    expect(isObjectionable("b1tch")).toBe(true);
    expect(isObjectionable("$lut")).toBe(true);
    expect(isObjectionable("fück")).toBe(true);
  });

  it("catches phrases across punctuation", () => {
    expect(isObjectionable("just kill yourself")).toBe(true);
    expect(isObjectionable("kill-yourself")).toBe(true);
    expect(isObjectionable("kys")).toBe(true);
  });

  it("lets the catalogue and the lot through", () => {
    for (const ok of [
      "Dick's Picks Vol. 8",
      "Cumberland Blues",
      "Hell in a Bucket",
      "Scarlet Begonias > Fire on the Mountain",
      "Sugar Magnolia",
      "Wharf Rat",
      "Stagger Lee",
      "Samson and Delilah",
      "Brown-Eyed Women",
      "Casey Jones",
      "The Acid Tests",
      "Barton Hall, Cornell 5/8/77",
      "Englishtown Raceway Park",
      "spicy second set",
      "a cocky Bobby",
      "Scunthorpe",
      "Niger",
      "",
    ]) {
      expect(isObjectionable(ok), ok).toBe(false);
    }
  });

  it("treats null and undefined as clean", () => {
    expect(isObjectionable(null)).toBe(false);
    expect(isObjectionable(undefined)).toBe(false);
  });
});

describe("normalizeForFilter", () => {
  it("lowercases, strips accents and undoes common substitutions", () => {
    expect(normalizeForFilter("Crème 4 $@le!")).toBe("creme a salei");
  });
});
