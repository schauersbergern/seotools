export type DataForSeoTask = Record<string, unknown>;

function resolveBaseUrl() {
  if (process.env.DATAFORSEO_BASE_URL) {
    return process.env.DATAFORSEO_BASE_URL;
  }

  return process.env.DATAFORSEO_SANDBOX === "true"
    ? "https://sandbox.dataforseo.com"
    : "https://api.dataforseo.com";
}

export function hasDataForSeoCredentials() {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

export class DataForSeoClient {
  private readonly login = process.env.DATAFORSEO_LOGIN!;
  private readonly password = process.env.DATAFORSEO_PASSWORD!;
  private readonly baseUrl = resolveBaseUrl();

  async post(path: string, task: DataForSeoTask) {
    const response = await fetch(`${this.baseUrl}/v3/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.login}:${this.password}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([task]),
      cache: "no-store"
    });

    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        `DataForSEO request failed for ${path}: ${String(json.status_message ?? response.statusText)}`
      );
    }

    const tasks = json.tasks as Array<Record<string, unknown>> | undefined;
    const firstTask = tasks?.[0];
    const statusCode = Number(firstTask?.status_code ?? json.status_code ?? 0);
    if (statusCode !== 20000) {
      throw new Error(
        `DataForSEO error for ${path}: ${String(firstTask?.status_message ?? json.status_message ?? "Unknown error")}`
      );
    }

    return json;
  }
}
