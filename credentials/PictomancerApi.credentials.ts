import type {
  IAuthenticateGeneric,
  Icon,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class PictomancerApi implements ICredentialType {
  name = "pictomancerApi";

  displayName = "Pictomancer API";

  icon: Icon = { light: "file:pictomancer.svg", dark: "file:pictomancer-dark.svg" };

  documentationUrl = "https://pictomancer.ai";

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      description:
        "Bearer token from app.pictomancer.ai. Leave empty to use the free tier (50 requests per IP).",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.pictomancer.ai",
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: '={{$credentials.apiKey ? "Bearer " + $credentials.apiKey : undefined}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/v1/info",
    },
  };
}
