import { DATASET_DESCRIPTION_FILENAME, dataFilePath } from "../src/datasetLayout";

describe("DATASET_DESCRIPTION_FILENAME", () => {
  test("is the canonical Psych-DS metadata filename", () => {
    expect(DATASET_DESCRIPTION_FILENAME).toBe("dataset_description.json");
  });
});

describe("dataFilePath", () => {
  test("strips the top-level export folder and nests under data/", () => {
    expect(dataFilePath("my-experiment/sub01.csv")).toBe("data/sub01.csv");
  });

  test("preserves nested subdirectories below the export folder", () => {
    expect(dataFilePath("my-experiment/session1/sub01.csv")).toBe("data/session1/sub01.csv");
  });

  test("places a bare filename directly under data/", () => {
    expect(dataFilePath("sub01.csv")).toBe("data/sub01.csv");
  });
});
