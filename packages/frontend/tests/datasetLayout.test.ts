import { DATASET_DESCRIPTION_FILENAME } from "../src/datasetLayout";

describe("DATASET_DESCRIPTION_FILENAME", () => {
  test("is the canonical Psych-DS metadata filename", () => {
    expect(DATASET_DESCRIPTION_FILENAME).toBe("dataset_description.json");
  });
});
