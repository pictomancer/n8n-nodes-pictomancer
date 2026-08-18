import { describe, expect, it } from "vitest";

import {
  buildCropParams,
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

  it("maps resize fill mode params", () => {
    const request = buildOperationRequest("resize", SOURCE, {
      width: 200,
      height: 150,
      gravity: "entropy",
    });

    expect(request.body).toEqual({ source: SOURCE, width: 200, height: 150, gravity: "entropy" });
  });

  it("forwards autorot on every op", () => {
    const request = buildOperationRequest("compress", SOURCE, { format: "webp", autorot: true });

    expect(request.body).toEqual({ source: SOURCE, format: "webp", autorot: true });
  });

  it("forwards enhance modifiers on every op", () => {
    const request = buildOperationRequest("compress", SOURCE, {
      denoise: 2,
      equalize: true,
      sharpen: true,
    });

    expect(request.body).toEqual({ source: SOURCE, denoise: 2, equalize: true, sharpen: true });
  });

  it("maps optimize_generated format and max_dimension", () => {
    const request = buildOperationRequest("optimize_generated", SOURCE, {
      format: "avif",
      max_dimension: 1600,
    });

    expect(request.path).toBe("/v1/optimize_generated");
    expect(request.body).toEqual({ source: SOURCE, format: "avif", max_dimension: 1600 });
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

describe("buildCropParams", () => {
  const FIELDS = { x: 10, y: 20, width: 300, height: 400, gravity: "attention", threshold: 5 };

  it("manual mode sends x/y/width/height only", () => {
    expect(buildCropParams("manual", FIELDS)).toEqual({ x: 10, y: 20, width: 300, height: 400 });
  });

  it("smart mode sends gravity and dims without x/y", () => {
    expect(buildCropParams("smart", FIELDS)).toEqual({
      width: 300,
      height: 400,
      gravity: "attention",
    });
  });

  it("trim mode sends threshold without dims or gravity", () => {
    expect(buildCropParams("trim", FIELDS)).toEqual({ trim: true, threshold: 5 });
  });
});

describe("toDataUri", () => {
  it("builds a data uri from mime and base64", () => {
    expect(toDataUri("image/png", "aGVsbG8=")).toBe("data:image/png;base64,aGVsbG8=");
  });
});
