import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JsonViewer from "../src/components/JsonViewer";

describe("JsonViewer", () => {
  // ── primitives ────────────────────────────────────────────────────────────

  describe("primitives", () => {
    test("renders null", () => {
      render(<JsonViewer data={null} />);
      expect(screen.getByText("null")).toBeInTheDocument();
    });

    test("renders true and false", () => {
      const { rerender } = render(<JsonViewer data={true} />);
      expect(screen.getByText("true")).toBeInTheDocument();
      rerender(<JsonViewer data={false} />);
      expect(screen.getByText("false")).toBeInTheDocument();
    });

    test("renders numbers", () => {
      render(<JsonViewer data={42} />);
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    test("renders strings wrapped in quotes", () => {
      render(<JsonViewer data={"hello"} />);
      expect(screen.getByText('"hello"')).toBeInTheDocument();
    });

    test("escapes double-quotes inside strings", () => {
      render(<JsonViewer data={'say "hi"'} />);
      expect(screen.getByText('"say \\"hi\\""')).toBeInTheDocument();
    });

    test("escapes backslashes inside strings", () => {
      render(<JsonViewer data={"path\\file"} />);
      expect(screen.getByText('"path\\\\file"')).toBeInTheDocument();
    });
  });

  // ── empty containers ──────────────────────────────────────────────────────

  describe("empty containers", () => {
    test("renders empty object as {}", () => {
      render(<JsonViewer data={{}} />);
      expect(screen.getByText("{}")).toBeInTheDocument();
    });

    test("renders empty array as []", () => {
      render(<JsonViewer data={[]} />);
      expect(screen.getByText("[]")).toBeInTheDocument();
    });
  });

  // ── object and array structure ────────────────────────────────────────────

  describe("objects and arrays", () => {
    test("renders object keys and string values", () => {
      render(<JsonViewer data={{ name: "test", license: "CC0" }} />);
      expect(screen.getByText('"name"')).toBeInTheDocument();
      expect(screen.getByText('"test"')).toBeInTheDocument();
      expect(screen.getByText('"license"')).toBeInTheDocument();
      expect(screen.getByText('"CC0"')).toBeInTheDocument();
    });

    test("renders array items without keys", () => {
      render(<JsonViewer data={["alpha", "beta"]} />);
      expect(screen.getByText('"alpha"')).toBeInTheDocument();
      expect(screen.getByText('"beta"')).toBeInTheDocument();
    });

    test("renders nested objects recursively", () => {
      render(<JsonViewer data={{ author: { name: "Jane" } }} />);
      expect(screen.getByText('"author"')).toBeInTheDocument();
      expect(screen.getByText('"name"')).toBeInTheDocument();
      expect(screen.getByText('"Jane"')).toBeInTheDocument();
    });

    test("adds a comma after non-last items", () => {
      const { container } = render(<JsonViewer data={{ a: 1, b: 2 }} />);
      // Only one comma expected (after "a": 1, not after "b": 2)
      const commas = container.querySelectorAll(".punct");
      expect(commas.length).toBe(1);
    });

    test("shows correct field count in object summary", async () => {
      render(<JsonViewer data={{ a: 1, b: 2, c: 3 }} />);
      await userEvent.click(screen.getByRole("button", { name: "Collapse" }));
      expect(screen.getByText("3 fields")).toBeInTheDocument();
    });

    test("shows correct item count in array summary", async () => {
      render(<JsonViewer data={["x", "y"]} />);
      await userEvent.click(screen.getByRole("button", { name: "Collapse" }));
      expect(screen.getByText("2 items")).toBeInTheDocument();
    });

    test("uses singular for 1 field / 1 item", async () => {
      const { rerender } = render(<JsonViewer data={{ a: 1 }} />);
      await userEvent.click(screen.getByRole("button", { name: "Collapse" }));
      expect(screen.getByText("1 field")).toBeInTheDocument();

      rerender(<JsonViewer data={["x"]} />);
      // toggle is now "Expand" — click to re-open then collapse again
      await userEvent.click(screen.getAllByRole("button", { name: "Expand" })[0]);
      await userEvent.click(screen.getAllByRole("button", { name: "Collapse" })[0]);
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });
  });

  // ── collapse / expand ─────────────────────────────────────────────────────

  describe("collapse / expand", () => {
    test("toggle button starts with aria-label 'Collapse' (expanded by default)", () => {
      render(<JsonViewer data={{ name: "test" }} />);
      expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    });

    test("clicking Collapse hides children and shows the summary", async () => {
      const { container } = render(<JsonViewer data={{ name: "test" }} />);
      await userEvent.click(screen.getByRole("button", { name: "Collapse" }));

      // Children wrapper gets the "hidden" class
      expect(
        container.querySelector(".children")?.parentElement,
      ).toHaveClass("hidden");

      // Summary span no longer inside a "hidden" element
      const summary = screen.getByText("1 field");
      expect(summary.closest('[class="hidden"]')).toBeNull();
    });

    test("clicking Expand again restores the children", async () => {
      const { container } = render(<JsonViewer data={{ name: "test" }} />);
      await userEvent.click(screen.getByRole("button", { name: "Collapse" }));
      await userEvent.click(screen.getByRole("button", { name: "Expand" }));

      expect(
        container.querySelector(".children")?.parentElement,
      ).not.toHaveClass("hidden");
    });

    test("each nested object has its own independent toggle", async () => {
      render(<JsonViewer data={{ outer: { inner: "val" } }} />);
      const toggles = screen.getAllByRole("button", { name: "Collapse" });
      expect(toggles.length).toBe(2); // outer + inner
      // Collapse only the inner object
      await userEvent.click(toggles[1]);
      expect(screen.getAllByRole("button", { name: "Collapse" }).length).toBe(1);
      expect(screen.getAllByRole("button", { name: "Expand" }).length).toBe(1);
    });
  });
});
