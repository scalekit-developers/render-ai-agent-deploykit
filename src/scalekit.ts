import "dotenv/config";
import { ScalekitClient } from "@scalekit-sdk/node";
import type { JsonObject } from "@bufbuild/protobuf";

let _scalekit: ScalekitClient | null = null;

function getScalekit(): ScalekitClient {
  if (_scalekit) return _scalekit;
  if (!process.env.SCALEKIT_ENVIRONMENT_URL || !process.env.SCALEKIT_CLIENT_ID || !process.env.SCALEKIT_CLIENT_SECRET) {
    throw new Error("Missing SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, or SCALEKIT_CLIENT_SECRET");
  }
  _scalekit = new ScalekitClient(
    process.env.SCALEKIT_ENVIRONMENT_URL,
    process.env.SCALEKIT_CLIENT_ID,
    process.env.SCALEKIT_CLIENT_SECRET,
  );
  return _scalekit;
}

export const scalekit = new Proxy({} as ScalekitClient, {
  get(_target, prop) {
    return (getScalekit() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

const GITHUB_CONNECTION_NAME = process.env.GITHUB_CONNECTION_NAME ?? "github-qkHFhMip";

/**
 * Execute a pre-built GitHub tool via Scalekit on behalf of a user.
 * Uses executeTool with connector: "github" (provider type).
 */
export async function githubTool(
  identifier: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<JsonObject> {
  try {
    const res = await scalekit.actions.executeTool({
      toolName,
      toolInput,
      connector: GITHUB_CONNECTION_NAME,
      identifier,
    });
    return res.data ?? {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw `GitHub tool '${toolName}' failed: ${msg}`;
  }
}

/**
 * Create or retrieve the connected account for a user, then return a GitHub
 * OAuth authorization link. The user must click this link to grant access.
 * After authorization Scalekit stores the token — no callback server needed.
 */
export async function getGitHubAuthLink(identifier: string): Promise<string> {
  await scalekit.actions.getOrCreateConnectedAccount({
    connectionName: GITHUB_CONNECTION_NAME,
    identifier,
  });
  const res = await scalekit.actions.getAuthorizationLink({
    connectionName: GITHUB_CONNECTION_NAME,
    identifier,
  });
  return res.link ?? "";
}

/**
 * Make a raw authenticated GitHub API call via Scalekit's tool proxy.
 * The user's OAuth token is injected from the vault automatically.
 * Works for both public and private repos if the connected token has access.
 */
export async function githubRequest(
  identifier: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, unknown>;
  } = {},
): Promise<unknown> {
  try {
    const res = await scalekit.actions.request({
      connectionName: GITHUB_CONNECTION_NAME,
      identifier,
      path,
      method: options.method ?? "GET",
      headers: options.headers,
      queryParams: options.queryParams,
    });
    return res.data;
  } catch (err) {
    console.error("[githubRequest] raw error:", err);
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null
          ? JSON.stringify(err, Object.getOwnPropertyNames(err as object))
          : String(err);
    throw new Error(`GitHub request to '${path}' failed: ${msg}`);
  }
}
