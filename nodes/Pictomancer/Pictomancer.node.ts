import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

import { buildOperationRequest, toDataUri } from "./operations";

export class Pictomancer implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Pictomancer",
    name: "pictomancer",
    icon: "file:pictomancer.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "Optimize images with Pictomancer.ai",
    defaults: { name: "Pictomancer" },
    inputs: ["main" as NodeConnectionType],
    outputs: ["main" as NodeConnectionType],
    credentials: [{ name: "pictomancerApi", required: true }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "compress",
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
        displayName: "X",
        name: "x",
        type: "number",
        default: 0,
        displayOptions: { show: { operation: ["crop"] } },
      },
      {
        displayName: "Y",
        name: "y",
        type: "number",
        default: 0,
        displayOptions: { show: { operation: ["crop"] } },
      },
      {
        displayName: "Width",
        name: "width",
        type: "number",
        default: 100,
        displayOptions: { show: { operation: ["crop"] } },
      },
      {
        displayName: "Height",
        name: "height",
        type: "number",
        default: 100,
        displayOptions: { show: { operation: ["crop"] } },
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
        displayOptions: { show: { operation: ["resize", "compress", "convert"] } },
        options: [
          {
            displayName: "Effort (AVIF)",
            name: "effort",
            type: "number",
            typeOptions: { minValue: 0, maxValue: 9 },
            default: 2,
            description: "AV1 encoder CPU effort (0-9). Higher = smaller files, slower.",
          },
          {
            displayName: "Lossless",
            name: "lossless",
            type: "boolean",
            default: false,
            description: "Whether to encode losslessly (WebP and AVIF)",
          },
          {
            displayName: "Output Format",
            name: "format",
            type: "string",
            default: "",
            description: "Output format for resize/compress (jpeg, png, webp, tiff, gif, avif)",
          },
          {
            displayName: "Quality",
            name: "q",
            type: "number",
            typeOptions: { minValue: 1, maxValue: 100 },
            default: 85,
          },
          {
            displayName: "Scale X",
            name: "scale_x",
            type: "number",
            default: 0,
            description: "Horizontal scale factor (overrides Scale together with Scale Y)",
          },
          {
            displayName: "Scale Y",
            name: "scale_y",
            type: "number",
            default: 0,
            description: "Vertical scale factor (overrides Scale together with Scale X)",
          },
          {
            displayName: "Strip Metadata",
            name: "strip",
            type: "boolean",
            default: false,
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
    return {
      x: ctx.getNodeParameter("x", itemIndex),
      y: ctx.getNodeParameter("y", itemIndex),
      width: ctx.getNodeParameter("width", itemIndex),
      height: ctx.getNodeParameter("height", itemIndex),
    };
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
    // scale_x/scale_y in Options take precedence over the plain Scale knob
    if (!params.scale_x && !params.scale_y) {
      params.scale = ctx.getNodeParameter("scale", itemIndex);
    } else {
      delete params.scale;
    }
    if (!params.scale_x) delete params.scale_x;
    if (!params.scale_y) delete params.scale_y;
  }
  if (operation === "convert") {
    params.format = ctx.getNodeParameter("format", itemIndex);
  }
  return params;
}
