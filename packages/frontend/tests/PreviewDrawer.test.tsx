import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PreviewDrawer from "../src/components/PreviewDrawer";

function makeMeta(data: Record<string, unknown> = {}) {
  return { getMetadata: jest.fn().mockReturnValue(data) } as any;
}

let onClose: jest.Mock;

beforeEach(() => {
  onClose = jest.fn();
});

describe("PreviewDrawer", () => {
  test("renders the dialog with a JSON preview of the current metadata", () => {
    const meta = makeMeta({ name: "my-study" });
    render(<PreviewDrawer jsPsychMetadata={meta} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "JSON preview" })).toBeInTheDocument();
    expect(screen.getByText('"name"')).toBeInTheDocument();
    expect(screen.getByText('"my-study"')).toBeInTheDocument();
  });

  test("close button calls onClose", async () => {
    render(<PreviewDrawer jsPsychMetadata={makeMeta()} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("clicking the backdrop calls onClose", async () => {
    const { container } = render(<PreviewDrawer jsPsychMetadata={makeMeta()} onClose={onClose} />);
    await userEvent.click(container.querySelector(".backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("locks body scroll on mount and restores it on unmount", () => {
    const { unmount } = render(<PreviewDrawer jsPsychMetadata={makeMeta()} onClose={onClose} />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("snapshots metadata at mount time — getMetadata called once", () => {
    const meta = makeMeta({ name: "study" });
    render(<PreviewDrawer jsPsychMetadata={meta} onClose={onClose} />);
    expect(meta.getMetadata).toHaveBeenCalledTimes(1);
  });
});
