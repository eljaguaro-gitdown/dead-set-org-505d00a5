import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CharlieCredit from "@/components/CharlieCredit";

describe("CharlieCredit", () => {
  it("names Charlie and links to the About section that explains him", () => {
    render(
      <MemoryRouter>
        <p>
          A Bertha that never lets up.
          <CharlieCredit />
        </p>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Written by Cosmic Charlie/ });
    expect(link).toHaveTextContent("*Cosmic Charlie");
    expect(link).toHaveAttribute("href", "/about#cosmic-charlie");
  });

  it("inside a card that is a button, goes to About without selecting the card", () => {
    const onCard = vi.fn();
    render(
      <MemoryRouter initialEntries={["/versions/bertha"]}>
        <Routes>
          <Route
            path="/versions/bertha"
            element={
              <button onClick={onCard}>
                1977-05-08 <CharlieCredit insideButton />
              </button>
            }
          />
          <Route path="/about" element={<h1>About</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: /Written by Cosmic Charlie/ }));
    expect(onCard).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
  });

  it("still renders, as a plain link, outside a router", () => {
    render(<CharlieCredit />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/about#cosmic-charlie");
  });
});
