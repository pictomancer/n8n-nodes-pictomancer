import { describe, expect, it } from "vitest";

import { buildOperationRequest, toDataUri } from "../nodes/Pictomancer/operations";

const SOURCE = "https://example.com/image.jpg";

describe("buildOperationRequest", () => {
  it("maps analyze to its endpoint with source only", () => {
    const request = buildOperationRequest("analyze", SOURCE, {});

    expect(request.path).toBe("/v1/analyze");
    expect(request.body).toEqual({ source: SOURCE });
  });

  it("maps resize params into the body", () => {
    const request = buildOperationRequest("resize", SOURCE, { scale: 0.5, format: "webp" });

    expect(request.path).toBe("/v1/resize");
    expect(request.body).toEqual({ source: SOURCE, scale: 0.5, format: "webp" });
  });

  it("maps compress quality params", () => {
    const request = buildOperationRequest("compress", SOURCE, { q: 60, strip: true });

    expect(request.path).toBe("/v1/compress");
    expect(request.body).toEqual({ source: SOURCE, q: 60, strip: true });
  });

  it("maps convert format and encoder knobs", () => {
    const request = buildOperationRequest("convert", SOURCE, {
      format: "avif",
      q: 50,
      effort: 2,
    });

    expect(request.path).toBe("/v1/convert");
    expect(request.body).toEqual({ source: SOURCE, format: "avif", q: 50, effort: 2 });
  });

  it("maps crop coordinates", () => {
    const request = buildOperationRequest("crop", SOURCE, { x: 0, y: 0, width: 100, height: 50 });

    expect(request.path).toBe("/v1/crop");
    expect(request.body).toEqual({ source: SOURCE, x: 0, y: 0, width: 100, height: 50 });
  });

  it("maps pipeline operation chains", () => {
    const operations = [{ type: "resize", params: { scale: "0.5" } }];

    const request = buildOperationRequest("pipeline", SOURCE, { operations });

    expect(request.path).toBe("/v1/pipeline");
    expect(request.body).toEqual({ source: SOURCE, operations });
  });

  it("drops empty and undefined params", () => {
    const request = buildOperationRequest("compress", SOURCE, {
      format: "",
      q: 60,
      strip: undefined,
    });

    expect(request.body).toEqual({ source: SOURCE, q: 60 });
  });

  it("rejects unknown operations", () => {
    expect(() => buildOperationRequest("blur", SOURCE, {})).toThrow("unsupported operation: blur");
  });
});

describe("toDataUri", () => {
  it("builds a data uri from mime and base64", () => {
    expect(toDataUri("image/png", "aGVsbG8=")).toBe("data:image/png;base64,aGVsbG8=");
  });
});
