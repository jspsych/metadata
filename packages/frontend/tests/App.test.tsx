import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

// App's job is routing between Landing and the wizard — stub the wizard shell
// so this stays a unit test of that flow.
jest.mock("../src/components/AppShell", () => ({
  __esModule: true,
  default: ({ onStartOver }: { onStartOver: () => void }) => (
    <div>
      <p>app shell</p>
      <button onClick={onStartOver}>Start over</button>
    </div>
  ),
}));

describe("App", () => {
  test("shows the landing page first", () => {
    render(<App />);
    expect(screen.getByText("jsPsych Metadata Generator")).toBeInTheDocument();
    expect(screen.queryByText("app shell")).not.toBeInTheDocument();
  });

  test("starting a new project enters the wizard", async () => {
    render(<App />);
    await userEvent.click(screen.getByText("Create new project"));
    expect(screen.getByText("app shell")).toBeInTheDocument();
  });

  test("start over returns to the landing page", async () => {
    render(<App />);
    await userEvent.click(screen.getByText("Create new project"));
    await userEvent.click(screen.getByText("Start over"));
    expect(screen.getByText("jsPsych Metadata Generator")).toBeInTheDocument();
  });

  test("theme toggle switches between light and dark", async () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: /Dark/ });

    await userEvent.click(toggle);
    expect(toggle).toHaveTextContent("Light");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
