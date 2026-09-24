import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Accessibility (A11y) & WCAG Compliance Tests", () => {
  it("home page should include semantic landmark tags and ARIA labels", () => {
    const pageContent = readFileSync(join(__dirname, "../../app/page.tsx"), "utf8");

    // Landmarks
    expect(pageContent).toContain("<main");
    expect(pageContent).toContain("<nav");
    expect(pageContent).toContain("<footer");

    // Accessibility attributes
    expect(pageContent).toContain('role="status"');
    expect(pageContent).toContain("aria-live");
    expect(pageContent).toContain("aria-label");
  });

  it("document detail page should include accessible article sections and landmarks", () => {
    const detailContent = readFileSync(join(__dirname, "../../app/documents/[id]/page.tsx"), "utf8");

    expect(detailContent).toContain("<main");
    expect(detailContent).toContain("<article");
    expect(detailContent).toContain("<aside");
    expect(detailContent).toContain('role="status"');
  });

  it("styles.css should define accessible focus-visible states and contrast tokens", () => {
    const cssContent = readFileSync(join(__dirname, "../../app/styles.css"), "utf8");

    // Accessible focus indicator
    expect(cssContent).toContain(":focus-visible");

    // Accessible color definitions
    expect(cssContent).toContain("--bg");
    expect(cssContent).toContain("--text");
  });
});
