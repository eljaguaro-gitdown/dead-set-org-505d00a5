import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import About from "@/pages/About";

/**
 * Every "*Cosmic Charlie" credit links to /about#cosmic-charlie. The section
 * has to be there, say who he is and where his facts come from, and keep the
 * house rule: none of the machinery words reach the room.
 */
describe("About: Cosmic Charlie and the liner notes", () => {
  const scrolled = vi.fn();
  beforeEach(() => {
    scrolled.mockClear();
    // jsdom has no layout, so no scrollIntoView. Record the call instead.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled(this.id);
    };
  });

  const renderAbout = () =>
    render(
      <MemoryRouter initialEntries={["/about#cosmic-charlie"]}>
        <About />
      </MemoryRouter>,
    );

  it("has the section every credit links to", () => {
    const { container } = renderAbout();
    const section = container.querySelector("#cosmic-charlie");
    expect(section).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Cosmic Charlie and the liner notes" })).toBeInTheDocument();
  });

  it("scrolls to it when a credit link lands on the page", () => {
    renderAbout();
    expect(scrolled).toHaveBeenCalledWith("cosmic-charlie");
  });

  it("says who he is, who inspired him, and credits the sources by name", () => {
    const { container } = renderAbout();
    const text = container.querySelector("#cosmic-charlie")!.textContent ?? "";
    for (const name of ["grateful_jaguaro", "David Lemieux", "Dick Latvala", "Steve Parish", "JerryBase", "Relisten", "headyversion", "setlist.fm"]) {
      expect(text, name).toContain(name);
    }
  });

  it("never names the machinery", () => {
    const { container } = renderAbout();
    const text = container.querySelector("#cosmic-charlie")!.textContent ?? "";
    expect(text).not.toMatch(/\bAI\b|algorithm|generat|model\b/i);
  });
});
