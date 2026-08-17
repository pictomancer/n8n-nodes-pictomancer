import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

import { buildCropParams, buildOperationRequest, buildQualityReport, toDataUri } from "./operations";
import type { CropMode } from "./operations";

export class Pictomancer implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Pictomancer",
    name: "pictomancer",
    icon: { light: "file:pictomancer.svg", dark: "file:pictomancer-dark.svg" },
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Optimize images with Pictomancer.ai",
    usableAsTool: true,
    defaults: { name: "Pictomancer" },
    inputs: ["main" as NodeConnectionType],
    outputs: ["main" as NodeConnectionType],
    credentials: [{ name: "pictomancerApi", required: true }],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        default: "image",
        options: [{ name: "Image", value: "image" }],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "compress",
        displayOptions: { show: { resource: ["image"] } },
        options: [
          { name: "Analyze", value: "analyze", action: "Analyze an image" },
          { name: "Compress", value: "compress", action: "Compress an image" },
          { name: "Convert", value: "convert", action: "Convert image format" },
          { name: "Crop", value: "crop", action: "Crop an image" },
          { name: "Pipeline", value: "pipeline", action: "Run an operation pipeline" },
          { name: "Resize", value: "resize", action: "Resize an image" },
        ],
      },
      {
        displayName: "Input Type",
        name: "inputType",
        type: "options",
        noDataExpression: true,
        default: "url",
        options: [
          { name: "URL", value: "url" },
          { name: "Binary Data", value: "binary" },
        ],
      },
      {
        displayName: "Source URL",
        name: "source",
        type: "string",
        default: "",
        required: true,
        placeholder: "https://example.com/image.jpg",
        displayOptions: { show: { inputType: ["url"] } },
      },
      {
        displayName: "Input Binary Field",
        name: "binaryPropertyName",
        type: "string",
        default: "data",
        required: true,
        displayOptions: { show: { inputType: ["binary"] } },
      },
      {
        displayName: "Scale",
        name: "scale",
        type: "number",
        default: 0.5,
        description: "Uniform scale factor (e.g. 0.5 = half size)",
        displayOptions: { show: { operation: ["resize"] } },
      },
      {
        displayName: "Format",
        name: "format",
        type: "options",
        default: "webp",
        options: [
          { name: "AVIF", value: "avif" },
          { name: "GIF", value: "gif" },
          { name: "JPEG", value: "jpeg" },
          { name: "PNG", value: "png" },
          { name: "TIFF", value: "tiff" },
          { name: "WebP", value: "webp" },
        ],
        displayOptions: { show: { operation: ["convert"] } },
      },
      {
        displayName: "Crop Mode",
        name: "cropMode",
        type: "options",
        noDataExpression: true,
        default: "manual",
        options: [
          { name: "Manual", value: "manual", description: "Exact rectangle via X/Y/Width/Height" },
          { name: "Smart", value: "smart", description: "Gravity picks the window automatically" },
          { name: "Trim", value: "trim", description: "Removes a uniform background border" },
        ],
        displayOptions: { show: { operation: ["crop"] } },
      },
      {
        displayName: "X",
        name: "x",
        type: "number",
        default: 0,
        displayOptions: { show: { operation: ["crop"], cropMode: ["manual"] } },
      },
      {
        displayName: "Y",
        name: "y",
        type: "number",
        default: 0,
        displayOptions: { show: { operation: ["crop"], cropMode: ["manual"] } },
      },
      {
        displayName: "Width",
        name: "width",
        type: "number",
        default: 100,
        displayOptions: { show: { operation: ["crop"], cropMode: ["manual", "smart"] } },
      },
      {
        displayName: "Height",
        name: "height",
        type: "number",
        default: 100,
        displayOptions: { show: { operation: ["crop"], cropMode: ["manual", "smart"] } },
      },
      {
        displayName: "Gravity",
        name: "gravity",
        type: "options",
        default: "attention",
        options: [
          { name: "Attention", value: "attention" },
          { name: "Entropy", value: "entropy" },
          { name: "Centre", value: "centre" },
        ],
        displayOptions: { show: { operation: ["crop"], cropMode: ["smart"] } },
      },
      {
        displayName: "Threshold",
        name: "threshold",
        type: "number",
        default: 10,
        description: "Trim sensitivity (must be positive; default 10.0 server-side)",
        displayOptions: { show: { operation: ["crop"], cropMode: ["trim"] } },
      },
      {
        displayName: "Operations (JSON)",
        name: "pipelineOperations",
        type: "json",
        default:
          '[\n  { "type": "resize", "params": { "scale": "0.5" } },\n  { "type": "convert", "params": { "format": "webp" } }\n]',
        description: "Ordered list of pipeline steps, each {type, params}",
        displayOptions: { show: { operation: ["pipeline"] } },
      },
      {
        displayName: "Options",
        name: "options",
        type: "collection",
        placeholder: "Add option",
        default: {},
        displayOptions: { show: { operation: ["resize", "compress", "convert", "crop"] } },
        options: [
          {
            displayName: "Autorot",
            name: "autorot",
            type: "boolean",
            default: false,
            description: "Whether to apply EXIF orientation before processing",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert", "crop"] } },
          },
          {
            displayName: "Denoise",
            name: "denoise",
            type: "number",
            typeOptions: { minValue: 1, maxValue: 3 },
            default: 1,
            description:
              "Median denoise before the operation: radius 1-3 (window 3x3 to 7x7). Base price.",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert", "crop"] } },
          },
          {
            displayName: "Effort (AVIF)",
            name: "effort",
            type: "number",
            typeOptions: { minValue: 0, maxValue: 9 },
            default: 2,
            description: "AV1 encoder CPU effort (0-9). Higher = smaller files, slower.",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert"] } },
          },
          {
            displayName: "Equalize",
            name: "equalize",
            type: "boolean",
            default: false,
            description:
              "Whether to apply auto-contrast (value-channel histogram equalisation, hue and saturation preserved) before the operation",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert", "crop"] } },
          },
          {
            displayName: "Fill Height",
            name: "height",
            type: "number",
            default: 100,
            description: "Fill mode: target height in pixels. Requires Fill Width.",
            displayOptions: { show: { "/operation": ["resize"] } },
          },
          {
            displayName: "Fill Width",
            name: "width",
            type: "number",
            default: 100,
            description:
              "Fill mode: resize and smart-crop to exact dimensions in one call. Requires Fill Height; excludes Scale/Scale X/Scale Y.",
            displayOptions: { show: { "/operation": ["resize"] } },
          },
          {
            displayName: "Gravity",
            name: "gravity",
            type: "options",
            default: "attention",
            options: [
              { name: "Attention", value: "attention" },
              { name: "Entropy", value: "entropy" },
              { name: "Centre", value: "centre" },
            ],
            description: "Fill-mode smart-crop strategy. Only valid with Fill Width + Fill Height.",
            displayOptions: { show: { "/operation": ["resize"] } },
          },
          {
            displayName: "Lossless",
            name: "lossless",
            type: "boolean",
            default: false,
            description: "Whether to encode losslessly (WebP and AVIF)",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert"] } },
          },
          {
            displayName: "Output Format",
            name: "format",
            type: "string",
            default: "",
            description: "Output format for resize/compress (jpeg, png, webp, tiff, gif, avif)",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert"] } },
          },
          {
            displayName: "Quality",
            name: "q",
            type: "number",
            typeOptions: { minValue: 1, maxValue: 100 },
            default: 85,
            displayOptions: { show: { "/operation": ["resize", "compress", "convert"] } },
          },
          {
            displayName: "Quality Target (SSIM)",
            name: "quality_target",
            type: "number",
            typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
            default: 0.95,
            description:
              "Smallest file with SSIM >= target (0-1). Replaces Quality (q); jpeg, webp and avif only.",
            displayOptions: { show: { "/operation": ["compress", "convert"] } },
          },
          {
            displayName: "Scale X",
            name: "scale_x",
            type: "number",
            default: 0,
            description: "Horizontal scale factor (overrides Scale together with Scale Y)",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert"] } },
          },
          {
            displayName: "Scale Y",
            name: "scale_y",
            type: "number",
            default: 0,
            description: "Vertical scale factor (overrides Scale together with Scale X)",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert"] } },
          },
          {
            displayName: "Sharpen",
            name: "sharpen",
            type: "boolean",
            default: false,
            description: "Whether to apply an unsharp-mask sharpen after the operation",
            displayOptions: { show: { "/operation": ["resize", "compress", "convert", "crop"] } },
          },
          {
            displayName: "Strip Metadata",
            name: "strip",
            type: "boolean",
            default: false,
            displayOptions: { show: { "/operation": ["resize", "compress", "convert"] } },
          },
        ],
      },
      {
        displayName: "Output Binary Field",
        name: "outputBinaryPropertyName",
        type: "string",
        default: "data",
        displayOptions: { show: { operation: ["resize", "compress", "convert", "crop", "pipeline"] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials("pictomancerApi");
    const baseUrl = String(credentials.baseUrl ?? "https://api.pictomancer.ai").replace(/\/$/, "");

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter("operation", i) as string;
        const source = await resolveSource(this, i);
        const params = collectParams(this, operation, i);
        const { path, body } = buildOperationRequest(operation, source, params);

        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          "pictomancerApi",
          {
            method: "POST",
            url: `${baseUrl}${path}`,
            body,
            json: true,
            encoding: "arraybuffer",
            returnFullResponse: true,
          },
        );

        const contentType = String(response.headers["content-type"] ?? "");
        if (operation === "analyze" || contentType.startsWith("application/json")) {
          const text = Buffer.from(response.body as ArrayBuffer).toString("utf-8");
          returnData.push({ json: JSON.parse(text), pairedItem: { item: i } });
          continue;
        }

        const outputProperty = this.getNodeParameter("outputBinaryPropertyName", i) as string;
        const buffer = Buffer.from(response.body as ArrayBuffer);
        const binary = await this.helpers.prepareBinaryData(buffer, undefined, contentType);
        returnData.push({
          json: {
            size_bytes: buffer.length,
            mime_type: contentType,
            billed: response.headers["x-pig-billed"] === "1",
            ...buildQualityReport(response.headers as Record<string, unknown>),
          },
          binary: { [outputProperty]: binary },
          pairedItem: { item: i },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
      }
    }

    return [returnData];
  }
}

async function resolveSource(ctx: IExecuteFunctions, itemIndex: number): Promise<string> {
  const inputType = ctx.getNodeParameter("inputType", itemIndex) as string;
  if (inputType === "url") {
    return ctx.getNodeParameter("source", itemIndex) as string;
  }
  const propertyName = ctx.getNodeParameter("binaryPropertyName", itemIndex) as string;
  const binaryData = ctx.helpers.assertBinaryData(itemIndex, propertyName);
  const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, propertyName);
  return toDataUri(binaryData.mimeType ?? "application/octet-stream", buffer.toString("base64"));
}

function collectParams(
  ctx: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Record<string, unknown> {
  if (operation === "analyze") return {};

  if (operation === "crop") {
    const mode = ctx.getNodeParameter("cropMode", itemIndex) as CropMode;
    const cropParams = buildCropParams(mode, {
      x: ctx.getNodeParameter("x", itemIndex, 0) as number,
      y: ctx.getNodeParameter("y", itemIndex, 0) as number,
      width: ctx.getNodeParameter("width", itemIndex, 0) as number,
      height: ctx.getNodeParameter("height", itemIndex, 0) as number,
      gravity: ctx.getNodeParameter("gravity", itemIndex, "attention") as string,
      threshold: ctx.getNodeParameter("threshold", itemIndex, 10) as number,
    });
    return { ...cropParams, ...(ctx.getNodeParameter("options", itemIndex, {}) as Record<string, unknown>) };
  }

  if (operation === "pipeline") {
    const raw = ctx.getNodeParameter("pipelineOperations", itemIndex);
    const operations = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { operations };
  }

  const params: Record<string, unknown> = {
    ...(ctx.getNodeParameter("options", itemIndex, {}) as Record<string, unknown>),
  };
  if (operation === "resize") {
    // scale_x/scale_y or fill-mode width/height in Options take precedence over the plain Scale knob
    if (!params.scale_x && !params.scale_y && !params.width && !params.height) {
      params.scale = ctx.getNodeParameter("scale", itemIndex);
    } else {
      delete params.scale;
    }
    if (!params.scale_x) delete params.scale_x;
    if (!params.scale_y) delete params.scale_y;
    if (!params.width) delete params.width;
    if (!params.height) delete params.height;
  }
  if (operation === "convert") {
    params.format = ctx.getNodeParameter("format", itemIndex);
  }
  return params;
}
