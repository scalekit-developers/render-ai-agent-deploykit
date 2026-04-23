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

const GITHUB_CONNECTION_NAME = (() => {
  const v = process.env.GITHUB_CONNECTION_NAME;
  if (!v) throw new Error(
    "GITHUB_CONNECTION_NAME is required. Copy the connection name from Scalekit Dashboard → Agent Auth → Connectors. Each Scalekit environment gets a unique name (e.g. github-abc12345).",
  );
  return v;
})();

/**
 * Execute a pre-built GitHub tool via Scalekit on behalf of a user.
 * Uses the configured GitHub connection name so Scalekit injects the
 * connected account's OAuth token for this identifier.
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
 * OAuth authorization link. After OAuth completes, Scalekit redirects the
 * browser to userVerifyUrl so the app can bind the token to the session
 * via verifyUser(). The state value is passed through and must be validated
 * at the callback to prevent CSRF.
 */
export async function getGitHubAuthLink(
  identifier: string,
  opts: { state: string; userVerifyUrl: string },
): Promise<string> {
  await scalekit.actions.getOrCreateConnectedAccount({
    connectionName: GITHUB_CONNECTION_NAME,
    identifier,
  });
  const res = await scalekit.actions.getAuthorizationLink({
    connectionName: GITHUB_CONNECTION_NAME,
    identifier,
    state: opts.state,
    userVerifyUrl: opts.userVerifyUrl,
  });
  return res.link ?? "";
}

/**
 * Complete the user-verification step after OAuth callback.
 * Called from GET /user/verify with the auth_request_id Scalekit sends in the redirect.
 */
export async function verifyUser(params: {
  authRequestId: string;
  identifier: string;
}): Promise<void> {
  await scalekit.actions.verifyConnectedAccountUser({
    authRequestId: params.authRequestId,
    identifier: params.identifier,
  });
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
