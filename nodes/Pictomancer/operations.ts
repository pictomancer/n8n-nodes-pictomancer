export interface OperationRequest {
  path: string;
  body: Record<string, unknown>;
}

export type OperationParams = Record<string, unknown>;

const OPERATION_PATHS: Record<string, string> = {
  analyze: "/v1/analyze",
  resize: "/v1/resize",
  compress: "/v1/compress",
  convert: "/v1/convert",
  crop: "/v1/crop",
  optimize_generated: "/v1/optimize_generated",
  pipeline: "/v1/pipeline",
};

/**
 * Map an n8n operation + collected parameters to the API request.
 * Empty strings and undefined are dropped so optional node fields
 * never reach the API as explicit values.
 */
export function buildOperationRequest(
  operation: string,
  source: string,
  params: OperationParams,
): OperationRequest {
  const path = OPERATION_PATHS[operation];
  if (path === undefined) {
    throw new Error(`unsupported operation: ${operation}`);
  }

  const body: Record<string, unknown> = { source };
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    body[key] = value;
  }
  return { path, body };
}

export type CropMode = "manual" | "smart" | "trim";

export interface CropFields {
  x: number;
  y: number;
  width: number;
  height: number;
  gravity: string;
  threshold: number;
}

/** Map the Crop Mode selector + raw field values to the API's mutually exclusive crop params. */
export function buildCropParams(mode: CropMode, fields: CropFields): Record<string, unknown> {
  if (mode === "smart") {
    return { width: fields.width, height: fields.height, gravity: fields.gravity };
  }
  if (mode === "trim") {
    return { trim: true, threshold: fields.threshold };
  }
  return { x: fields.x, y: fields.y, width: fields.width, height: fields.height };
}

/** data: URI for binary inputs so any upstream item can be a source. */
export function toDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Map the quality search outcome headers to item JSON fields.
 * Empty when the server ran no search (no quality_target, or untouched input).
 */
export function buildQualityReport(headers: Record<string, unknown>): Record<string, number> {
  const achieved = headers["x-pictomancer-quality-achieved"];
  if (achieved === undefined) return {};
  return {
    quality_target: Number(headers["x-pictomancer-quality-target"]),
    quality_achieved: Number(achieved),
    quality_final_q: Number(headers["x-pictomancer-quality-q-final"]),
    quality_encodes: Number(headers["x-pictomancer-quality-encodes"]),
  };
}
