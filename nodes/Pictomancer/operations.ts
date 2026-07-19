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

/** data: URI for binary inputs so any upstream item can be a source. */
export function toDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}
