import { describe, expect, it } from "vitest";

import { PictomancerApi } from "../credentials/PictomancerApi.credentials";
import { Pictomancer } from "../nodes/Pictomancer/Pictomancer.node";

const THEMED_ICON = { light: "file:pictomancer.svg", dark: "file:pictomancer-dark.svg" };

const description = new Pictomancer().description;

function findProperty(name: string) {
  const property = description.properties.find((candidate) => candidate.name === name);
  if (!property) throw new Error(`node description has no "${name}" property`);
  return property;
}

describe("PictomancerApi credential", () => {
  it("declares themed icon variants", () => {
    const credential = new PictomancerApi();

    expect(credential.icon).toEqual(THEMED_ICON);
  });
});

describe("Pictomancer node description", () => {
  it("declares themed icon variants", () => {
    expect(description.icon).toEqual(THEMED_ICON);
  });

  it("exposes an image resource", () => {
    const resource = findProperty("resource");

    expect(resource.options).toEqual([{ name: "Image", value: "image" }]);
  });

  it("groups operations under the image resource", () => {
    const operation = findProperty("operation");

    expect(operation.displayOptions).toEqual({ show: { resource: ["image"] } });
  });

  it("keeps the operation values saved workflows already reference", () => {
    const operation = findProperty("operation");

    expect(operation.options?.map((option) => (option as { value: string }).value)).toEqual([
      "analyze",
      "compress",
      "convert",
      "crop",
      "pipeline",
      "resize",
    ]);
  });
});
