import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Landing from "../src/pages/Landing";

describe("Landing", () => {
  test("renders the title and both project cards", () => {
    render(<Landing onStart={jest.fn()} />);
    expect(screen.getByText("jsPsych Metadata Generator")).toBeInTheDocument();
    expect(screen.getByText("Create new project")).toBeInTheDocument();
    expect(screen.getByText("Open existing project")).toBeInTheDocument();
  });

  test("'Create new project' starts a fresh project", async () => {
    const onStart = jest.fn();
    render(<Landing onStart={onStart} />);
    await userEvent.click(screen.getByText("Create new project"));
    expect(onStart).toHaveBeenCalledWith(true);
  });

  test("uploading a dataset_description.json opens an existing project", () => {
    const onStart = jest.fn();
    const { container } = render(<Landing onStart={onStart} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{"name":"test"}'], "dataset_description.json", {
      type: "application/json",
    });

    fireEvent.change(input, { target: { files: [file] } });
    expect(onStart).toHaveBeenCalledWith(false, file);
  });

  test("does not start when the file dialog is dismissed without a file", () => {
    const onStart = jest.fn();
    const { container } = render(<Landing onStart={onStart} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });
    expect(onStart).not.toHaveBeenCalled();
  });

  test("'What is Psych-DS?' expands and collapses the explainer", async () => {
    render(<Landing onStart={jest.fn()} />);
    const toggle = screen.getByRole("button", { name: /What is Psych-DS\?/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/open standard/)).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/open standard/)).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.queryByText(/open standard/)).not.toBeInTheDocument();
  });
});
