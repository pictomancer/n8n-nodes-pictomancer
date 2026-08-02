import { describe, expect, it } from "vitest";

import {
  buildOperationRequest,
  buildQualityReport,
  toDataUri,
} from "../nodes/Pictomancer/operations";

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

  it("forwards quality_target on compress", () => {
    const request = buildOperationRequest("compress", SOURCE, {
      quality_target: 0.95,
      format: "webp",
    });

    expect(request.body).toEqual({ source: SOURCE, quality_target: 0.95, format: "webp" });
  });

  it("forwards quality_target on convert", () => {
    const request = buildOperationRequest("convert", SOURCE, {
      format: "avif",
      quality_target: 0.9,
    });

    expect(request.body).toEqual({ source: SOURCE, format: "avif", quality_target: 0.9 });
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

describe("buildQualityReport", () => {
  it("maps quality headers to numeric item fields", () => {
    const headers = {
      "x-pictomancer-quality-target": "0.95",
      "x-pictomancer-quality-achieved": "0.9530",
      "x-pictomancer-quality-q-final": "62",
      "x-pictomancer-quality-encodes": "5",
    };

    const report = buildQualityReport(headers);

    expect(report).toEqual({
      quality_target: 0.95,
      quality_achieved: 0.953,
      quality_final_q: 62,
      quality_encodes: 5,
    });
  });

  it("is empty when the quality headers are absent", () => {
    const headers = { "content-type": "image/webp", "x-pig-billed": "1" };

    const report = buildQualityReport(headers);

    expect(report).toEqual({});
  });
});

describe("toDataUri", () => {
  it("builds a data uri from mime and base64", () => {
    expect(toDataUri("image/png", "aGVsbG8=")).toBe("data:image/png;base64,aGVsbG8=");
  });
});
