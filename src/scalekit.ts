import "dotenv/config";
import { ScalekitClient } from "@scalekit-sdk/node";
import type { JsonObject } from "@bufbuild/protobuf";

let _scalekit: ScalekitClient | null = null;

function getScalekit(): ScalekitClient {
  if (_scalekit) return _scalekit;
  if (!process.env.SCALEKIT_ENV_URL || !process.env.SCALEKIT_CLIENT_ID || !process.env.SCALEKIT_CLIENT_SECRET) {
    throw new Error("Missing SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, or SCALEKIT_CLIENT_SECRET");
  }
  _scalekit = new ScalekitClient(
    process.env.SCALEKIT_ENV_URL,
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

/** Call a pre-built GitHub tool via Scalekit on behalf of a user */
export async function githubTool(
  identifier: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<JsonObject> {
  const res = await scalekit.actions.executeTool({
    toolName,
    toolInput,
    connector: "github",
    identifier,
  });
  return res.data ?? {};
}

/** Call a pre-built Linear tool via Scalekit on behalf of a user */
export async function linearTool(
  identifier: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<JsonObject> {
  const res = await scalekit.actions.executeTool({
    toolName,
    toolInput,
    connector: "linear",
    identifier,
  });
  return res.data ?? {};
}

/** Get a magic link for a user to authorize a connector */
export async function getAuthLink(
  identifier: string,
  connectionName: string,
  userVerifyUrl: string,
): Promise<string> {
  const res = await scalekit.actions.getAuthorizationLink({
    connectionName,
    identifier,
    userVerifyUrl,
  });
  return res.link ?? "";
}
