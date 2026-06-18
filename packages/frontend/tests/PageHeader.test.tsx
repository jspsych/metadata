import { render, screen } from "@testing-library/react";
import PageHeader from "../src/components/PageHeader";

describe("PageHeader", () => {
  test("renders a string title as an h2", () => {
    render(<PageHeader title="Project Info" />);
    expect(screen.getByRole("heading", { level: 2, name: "Project Info" })).toBeInTheDocument();
  });

  test("renders a JSX title", () => {
    render(<PageHeader title={<>Variables <span>3</span></>} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Variables 3");
  });

  test("renders right-slot content when provided", () => {
    render(<PageHeader title="Step" right={<button>Toggle</button>} />);
    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument();
  });

  test("renders nothing in the right slot when the prop is absent", () => {
    const { container } = render(<PageHeader title="Step" />);
    expect(container.querySelector(".right")).not.toBeInTheDocument();
  });
});
