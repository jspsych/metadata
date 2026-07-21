import { render, screen } from "@testing-library/react";
// IMPORTANT: this test uses the REAL @jspsych/metadata library (the frontend jest config resolves
// "@jspsych/metadata" to packages/metadata/src — there is no __mocks__ entry for it, so nothing to
// unmock). Other frontend tests hand PreviewDrawer a hand-rolled { getMetadata: jest.fn() } stub;
// here we drive a real JsPsychMetadata exactly the way Variables.tsx does (updateVariable with
// { default: text }) and render the real PreviewDrawer, proving a user-edited description survives
// all the way into the rendered dataset_description.json — the frontend regression this workstream fixes.
import JsPsychMetadata from "@jspsych/metadata";
import PreviewDrawer from "../src/components/PreviewDrawer";

const PLUGIN_SOURCE = `
const info = <const>{
  name: "mock-plugin",
  parameters: {},
  data: {
    /** Plugin-documented description for foo. */
    foo: { type: ParameterType.STRING },
  },
};
`;

beforeEach(() => {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(PLUGIN_SOURCE),
  });
});
afterEach(() => jest.restoreAllMocks());

describe("edited variable description survives into the preview JSON", () => {
  test("updateVariable(name,'description',{default}) appears in PreviewDrawer output even with a plugin description present", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate([{ trial_type: "mock-plugin", trial_index: 0, foo: "bar" }]);

    // Sanity: the plugin description was picked up before the user edits it.
    const generated = (meta.getMetadata() as any).variableMeasured.find((v: any) => v.name === "foo");
    expect(generated.description).toMatch(/Plugin-documented description for foo/);

    // Exactly what Variables.tsx does when the user types a description (Variables.tsx:98).
    meta.updateVariable("foo", "description", { default: "USER EDITED DESCRIPTION" });

    const { container } = render(<PreviewDrawer jsPsychMetadata={meta} onClose={() => {}} />);

    // The rendered JSON preview (the real dataset_description.json) contains the user's text.
    expect(screen.getByRole("dialog", { name: "JSON preview" })).toBeInTheDocument();
    expect(container.textContent).toContain("USER EDITED DESCRIPTION");
    // It was not spread char-by-char into an object.
    expect(container.textContent).not.toContain('"0": "U"');
  });
});
