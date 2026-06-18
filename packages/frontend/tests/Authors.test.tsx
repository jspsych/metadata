import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Authors from "../src/pages/Authors";

type AuthorFields = {
  name: string;
  givenName?: string;
  familyName?: string;
  "@type"?: string;
  identifier?: string;
};

function makeMeta(authors: (AuthorFields | string)[] = []) {
  return {
    getAuthorList: jest.fn().mockReturnValue(authors),
    setAuthor: jest.fn(),
    deleteAuthor: jest.fn(),
  } as any;
}

/** Returns the card div for the nth author (1-based). */
function authorCard(n: number): HTMLElement {
  return screen.getByText(`Author ${n}`).closest(".card") as HTMLElement;
}

/** Finds the Name input within a card and types into it, then blurs via Tab. */
async function commitName(card: HTMLElement, name: string) {
  const input = within(card).getByLabelText(/Name/);
  await userEvent.clear(input);
  await userEvent.type(input, name);
  await userEvent.tab(); // moves DOM focus away, properly firing blur
}

/** Opens the optional-fields section on a card. */
async function openOptional(card: HTMLElement) {
  await userEvent.click(within(card).getByRole("button", { name: /Optional fields/ }));
}

let meta: ReturnType<typeof makeMeta>;
let onComplete: jest.Mock;

beforeEach(() => {
  meta = makeMeta();
  onComplete = jest.fn();
});

describe("Authors", () => {
  // ── initial render ────────────────────────────────────────────────────────

  describe("initial render", () => {
    test("starts with one empty card when no existing authors", () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(screen.getByText("Author 1")).toBeInTheDocument();
      expect(screen.queryByText("Author 2")).not.toBeInTheDocument();
    });

    test("Remove button is hidden on a single empty card", () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(within(authorCard(1)).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    });

    test("loads existing authors from getAuthorList", () => {
      meta = makeMeta([{ name: "Jane Smith" }, { name: "John Doe" }]);
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(screen.getByText("Author 1")).toBeInTheDocument();
      expect(screen.getByText("Author 2")).toBeInTheDocument();
      expect(within(authorCard(1)).getByDisplayValue("Jane Smith")).toBeInTheDocument();
      expect(within(authorCard(2)).getByDisplayValue("John Doe")).toBeInTheDocument();
    });

    test("existing authors with optional fields start with those fields expanded", () => {
      meta = makeMeta([{ name: "Jane Smith", givenName: "Jane", identifier: "https://orcid.org/0000-0001-2345-6789" }]);
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(within(authorCard(1)).getByLabelText("ORCID")).toBeInTheDocument();
    });

    test("strips the ORCID prefix when loading an existing author", () => {
      meta = makeMeta([{ name: "Jane Smith", identifier: "https://orcid.org/0000-0001-2345-6789" }]);
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(within(authorCard(1)).getByDisplayValue("0000-0001-2345-6789")).toBeInTheDocument();
    });
  });

  // ── name commit on blur ───────────────────────────────────────────────────

  describe("name commit on blur", () => {
    test("blurring a non-empty name calls setAuthor and increments saved count", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await commitName(authorCard(1), "Jane Smith");

      expect(meta.setAuthor).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Smith" }));
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("1");
    });

    test("blurring with an empty name on an uncommitted card does not call setAuthor", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      fireEvent.blur(within(authorCard(1)).getByLabelText(/Name/));
      expect(meta.setAuthor).not.toHaveBeenCalled();
    });

    test("blurring with an empty name on a committed card calls deleteAuthor", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await commitName(authorCard(1), "Jane Smith");
      meta.setAuthor.mockClear();

      const input = within(authorCard(1)).getByLabelText(/Name/);
      await userEvent.clear(input);
      await userEvent.tab();

      expect(meta.deleteAuthor).toHaveBeenCalledWith("Jane Smith");
      expect(meta.setAuthor).not.toHaveBeenCalled();
    });

    test("changing a committed name deletes the old entry and sets the new one", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await commitName(authorCard(1), "Jane Smith");
      meta.setAuthor.mockClear();

      const input = within(authorCard(1)).getByLabelText(/Name/);
      await userEvent.clear(input);
      await userEvent.type(input, "Jane Doe");
      fireEvent.blur(input);

      expect(meta.deleteAuthor).toHaveBeenCalledWith("Jane Smith");
      expect(meta.setAuthor).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Doe" }));
    });
  });

  // ── remove author ─────────────────────────────────────────────────────────

  describe("remove author", () => {
    test("Remove button appears on a committed card", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await commitName(authorCard(1), "Jane Smith");
      expect(within(authorCard(1)).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });

    test("removing a committed card calls deleteAuthor and removes the card", async () => {
      // Start with 2 authors so removing one actually removes it (removing the
      // only card replaces it with a fresh empty card instead).
      meta = makeMeta([{ name: "Jane Smith" }, { name: "John Doe" }]);
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(authorCard(1)).getByRole("button", { name: "Remove" }));

      expect(meta.deleteAuthor).toHaveBeenCalledWith("Jane Smith");
      expect(screen.queryByDisplayValue("Jane Smith")).not.toBeInTheDocument();
      expect(screen.queryByText("Author 2")).not.toBeInTheDocument();
    });

    test("removing the last card replaces it with a fresh empty card", async () => {
      meta = makeMeta([{ name: "Jane Smith" }]);
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(authorCard(1)).getByRole("button", { name: "Remove" }));

      // A new empty card appears in its place
      expect(screen.getByText("Author 1")).toBeInTheDocument();
      expect(within(authorCard(1)).getByLabelText(/Name/)).toHaveValue("");
    });

    test("Remove buttons appear on all cards when there are multiple", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await userEvent.click(screen.getByRole("button", { name: "+ Add another author" }));

      expect(within(authorCard(1)).getByRole("button", { name: "Remove" })).toBeInTheDocument();
      expect(within(authorCard(2)).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });
  });

  // ── add author ────────────────────────────────────────────────────────────

  describe("add author", () => {
    test("'+ Add another author' appends a new empty card", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await userEvent.click(screen.getByRole("button", { name: "+ Add another author" }));
      expect(screen.getByText("Author 2")).toBeInTheDocument();
    });

    test("adding a second card makes Remove visible on the first card", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(within(authorCard(1)).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "+ Add another author" }));
      expect(within(authorCard(1)).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });
  });

  // ── optional fields ───────────────────────────────────────────────────────

  describe("optional fields", () => {
    test("optional fields are hidden by default on a new card", () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(within(authorCard(1)).queryByLabelText("ORCID")).not.toBeInTheDocument();
    });

    test("toggle button expands and collapses optional fields", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      const toggle = within(authorCard(1)).getByRole("button", { name: /Optional fields/ });

      await userEvent.click(toggle);
      expect(within(authorCard(1)).getByLabelText("ORCID")).toBeInTheDocument();
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      await userEvent.click(toggle);
      expect(within(authorCard(1)).queryByLabelText("ORCID")).not.toBeInTheDocument();
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    test("given name and family name fields call setAuthor on a committed author", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      const card = authorCard(1);
      await commitName(card, "Jane Smith");
      await openOptional(card);
      meta.setAuthor.mockClear();

      await userEvent.type(within(card).getByLabelText("Given name"), "Jane");
      expect(meta.setAuthor).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Jane Smith", givenName: "Jane" }),
      );
    });

    test("@type field calls setAuthor with the typed value", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      const card = authorCard(1);
      await commitName(card, "Jane Smith");
      await openOptional(card);
      meta.setAuthor.mockClear();

      await userEvent.type(within(card).getByLabelText("@type"), "Person");
      expect(meta.setAuthor).toHaveBeenCalledWith(
        expect.objectContaining({ "@type": "Person" }),
      );
    });
  });

  // ── ORCID validation ──────────────────────────────────────────────────────

  describe("ORCID validation", () => {
    test("a valid ORCID is committed to metadata with the full URL prefix", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      const card = authorCard(1);
      await commitName(card, "Jane Smith");
      await openOptional(card);
      meta.setAuthor.mockClear();

      await userEvent.type(within(card).getByLabelText("ORCID"), "0000-0001-2345-6789");
      expect(meta.setAuthor).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: "https://orcid.org/0000-0001-2345-6789" }),
      );
    });

    test("a partial or invalid ORCID is NOT written to metadata as an identifier", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      const card = authorCard(1);
      await commitName(card, "Jane Smith");
      await openOptional(card);
      meta.setAuthor.mockClear();

      await userEvent.type(within(card).getByLabelText("ORCID"), "0000-0001");
      const calls = meta.setAuthor.mock.calls as { identifier?: string }[][];
      expect(calls.every(([fields]) => !fields.identifier)).toBe(true);
    });
  });

  // ── bulk import ───────────────────────────────────────────────────────────

  describe("bulk import", () => {
    async function openBulk() {
      await userEvent.click(screen.getByRole("button", { name: "+ Add multiple authors at once" }));
    }

    async function importLines(lines: string) {
      await openBulk();
      await userEvent.type(screen.getByPlaceholderText(/Paste author names/), lines);
      await userEvent.click(screen.getByRole("button", { name: "Import" }));
    }

    test("opens and closes the bulk import panel", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await openBulk();
      expect(screen.getByPlaceholderText(/Paste author names/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByPlaceholderText(/Paste author names/)).not.toBeInTheDocument();
    });

    test("imports names and replaces the single empty placeholder card", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await importLines("Jane Smith\nJohn Doe");

      expect(screen.getByText("Author 1")).toBeInTheDocument();
      expect(screen.getByText("Author 2")).toBeInTheDocument();
      expect(meta.setAuthor).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Smith" }));
      expect(meta.setAuthor).toHaveBeenCalledWith(expect.objectContaining({ name: "John Doe" }));
    });

    test("appends to existing committed authors instead of replacing them", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await commitName(authorCard(1), "Existing Author");
      await importLines("Jane Smith");

      expect(screen.getByText("Author 1")).toBeInTheDocument();
      expect(screen.getByText("Author 2")).toBeInTheDocument();
    });

    test("skips duplicate names (case-insensitive)", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await commitName(authorCard(1), "Jane Smith");
      meta.setAuthor.mockClear();

      await importLines("jane smith\nJohn Doe");

      expect(screen.queryByText("Author 3")).not.toBeInTheDocument();
      expect(meta.setAuthor).toHaveBeenCalledTimes(1);
      expect(meta.setAuthor).toHaveBeenCalledWith(expect.objectContaining({ name: "John Doe" }));
    });

    test("imports a valid ORCID and normalises a pasted full URL", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await importLines("Jane Smith, https://orcid.org/0000-0001-2345-6789");

      expect(meta.setAuthor).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: "https://orcid.org/0000-0001-2345-6789" }),
      );
    });

    test("imports the name but shows a warning when the ORCID is invalid", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await importLines("Jane Smith, not-an-orcid");

      expect(meta.setAuthor).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Jane Smith" }),
      );
      const call = meta.setAuthor.mock.calls[0][0] as AuthorFields;
      expect(call.identifier).toBeUndefined();
      expect(screen.getByText(/ORCID not saved for: Jane Smith/)).toBeInTheDocument();
    });

    test("warning can be dismissed", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      await importLines("Jane Smith, bad-orcid");

      await userEvent.click(screen.getByRole("button", { name: "✕" }));
      expect(screen.queryByText(/ORCID not saved for/)).not.toBeInTheDocument();
    });
  });

  // ── continue ──────────────────────────────────────────────────────────────

  describe("continue", () => {
    test("Continue flushes pending name edits and calls onComplete", async () => {
      render(<Authors jsPsychMetadata={meta} onComplete={onComplete} />);
      // Type a name but do NOT blur (so it is not yet committed)
      await userEvent.type(within(authorCard(1)).getByLabelText(/Name/), "Jane Smith");

      await userEvent.click(screen.getByRole("button", { name: "Continue →" }));

      // handleNameBlur is called for all rows before onComplete
      expect(meta.setAuthor).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Smith" }));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
