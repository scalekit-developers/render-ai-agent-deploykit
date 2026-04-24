import crypto from "node:crypto";
import express from "express";
import { setupGitHubAuthTask, summarizePRsTask } from "./tasks.js";
import { verifyUser } from "./scalekit.js";
import {
  assertSessionSecretConfigured,
  requireSession,
  mintIdentifier,
  setPendingState,
  consumePendingState,
  markConnected,
  isConnected,
} from "./session.js";
import { renderHomePage } from "./views.js";
import type { Request } from "express";

function summarizeIdentifier(identifier: string | undefined): string {
  if (!identifier) return "(none)";
  if (identifier.length <= 12) return identifier;
  return `${identifier.slice(0, 8)}...${identifier.slice(-4)}`;
}

function getConfiguredPublicBaseUrl(): string | null {
  const v = process.env.PUBLIC_BASE_URL;
  return v ? v.replace(/\/$/, "") : null;
}

function getRequestOrigin(req: Request): string {
  const configured = getConfiguredPublicBaseUrl();
  if (configured) return configured;

  const protoHeader = req.get("x-forwarded-proto");
  const proto = protoHeader?.split(",")[0]?.trim() || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) {
    throw new Error("Could not determine the public origin for this request");
  }
  return `${proto}://${host}`;
}

function getSingleQueryParam(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeRepoSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function parseGitHubRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const ownerRepoMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (ownerRepoMatch) {
    return {
      owner: ownerRepoMatch[1],
      repo: ownerRepoMatch[2],
    };
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      return null;
    }

    const segments = url.pathname
      .split("/")
      .map(normalizeRepoSegment)
      .filter(Boolean);

    if (segments.length < 2) return null;

    return {
      owner: segments[0],
      repo: segments[1].replace(/\.git$/, ""),
    };
  } catch {
    return null;
  }
}

function resolveRepoInput(body: {
  owner?: string;
  repo?: string;
  repository?: string;
  repoUrl?: string;
}): { owner: string; repo: string } | null {
  if (body.owner && body.repo) {
    return {
      owner: body.owner.trim(),
      repo: body.repo.trim(),
    };
  }

  const parsed = parseGitHubRepoInput(body.repository ?? body.repoUrl ?? "");
  if (!parsed) return null;
  return parsed;
}

function formatSummarizeError(owner: string, repo: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const isRepoNotFound =
    msg.includes("GitHub tool 'github_pull_requests_list' failed:") &&
    msg.includes("tool execution failed - Not Found");
  const isRepoForbidden =
    msg.includes("GitHub tool 'github_pull_requests_list' failed:") &&
    (msg.includes("[permission_denied]") || msg.toLowerCase().includes("forbidden access"));
  const isApiForbidden =
    msg.includes("GitHub request to '/repos/") &&
    (msg.includes("[permission_denied]") || msg.toLowerCase().includes("forbidden access"));

  if (isRepoNotFound) {
    return `GitHub could not find '${owner}/${repo}' for the connected account. Check the owner/repo name, or reconnect GitHub with an account that has access if the repository is private.`;
  }

  if (isRepoForbidden || isApiForbidden) {
    return `GitHub blocked this app from accessing '${owner}/${repo}'. The connected GitHub account may still be able to open the repository directly, but the OAuth app token used by this session does not currently have permission. Reconnect GitHub after confirming the app has the right scopes, and if the repository belongs to an organization, make sure an org admin has approved this OAuth app for private repository access.`;
  }

  return msg;
}

export function startServer(): void {
  assertSessionSecretConfigured();

  const app = express();
  const PORT = parseInt(process.env.PORT ?? "3000", 10);

  app.set("trust proxy", true);
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Home page — issue session cookie on first visit, render connected state.
  app.get("/", (req, res) => {
    const { entry } = requireSession(req, res);
    res.type("html").send(renderHomePage({ connected: isConnected(entry) }));
  });

  // Step 1: Generate a GitHub OAuth link for this session.
  // No user input required — the identifier is minted server-side.
  app.post("/api/auth", async (req, res) => {
    const { entry } = requireSession(req, res);
    const identifier = mintIdentifier(entry);

    // One-time CSRF state value bound to this session.
    const state = crypto.randomUUID();
    setPendingState(entry, state);

    const userVerifyUrl = `${getRequestOrigin(req)}/user/verify`;

    try {
      console.log(
        `[auth:start] identifier=${summarizeIdentifier(identifier)} origin=${getRequestOrigin(req)}`,
      );
      const result = await setupGitHubAuthTask({ identifier, state, userVerifyUrl });
      res.json({ authLink: result.authLink });
    } catch (err) {
      console.error(
        `[auth:error] identifier=${summarizeIdentifier(identifier)} message=${err instanceof Error ? err.message : String(err)}`,
      );
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // OAuth callback — Scalekit redirects here after the user completes GitHub authorization.
  // Validates the state cookie to prevent CSRF, then activates the connected account.
  app.get("/user/verify", async (req, res) => {
    const authRequestId = getSingleQueryParam(req.query.auth_request_id);
    const state = getSingleQueryParam(req.query.state);
    if (!authRequestId || !state) {
      res.status(400).send("Missing auth_request_id or state");
      return;
    }

    const { entry } = requireSession(req, res);

    // Read identity from session — never from the URL.
    if (!entry.identifier) {
      res.status(400).send("No pending authorization for this session");
      return;
    }

    if (!consumePendingState(entry, state)) {
      res.status(400).send("Invalid or expired state — authorization failed");
      return;
    }

    try {
      console.log(
        `[auth:verify:start] identifier=${summarizeIdentifier(entry.identifier)} authRequestId=${authRequestId}`,
      );
      await verifyUser({
        authRequestId,
        identifier: entry.identifier,
      });
      markConnected(entry);
      console.log(
        `[auth:verify:success] identifier=${summarizeIdentifier(entry.identifier)}`,
      );
      // Keep the browser inside the app after successful verification.
      // Scalekit may return its own hosted success page URL, but this sample
      // should land the user back on the local session-bound UI.
      res.redirect("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[auth:verify:error] identifier=${summarizeIdentifier(entry.identifier)} authRequestId=${authRequestId} message=${msg}`,
      );
      res.status(500).send(`Verification failed: ${msg}`);
    }
  });

  // Step 2: Summarize the most-discussed PRs in a repository.
  // Reads the session identifier — no userId in the request body.
  app.post("/api/summarize", async (req, res) => {
    const { entry } = requireSession(req, res);

    if (!isConnected(entry)) {
      res.status(401).json({ error: "Connect your GitHub account first (Step 1)" });
      return;
    }

    const resolved = resolveRepoInput(req.body as {
      owner?: string;
      repo?: string;
      repository?: string;
      repoUrl?: string;
    });
    if (!resolved?.owner || !resolved.repo) {
      res.status(400).json({
        error: "Provide a GitHub repository URL or owner/repo name.",
      });
      return;
    }
    const { owner, repo } = resolved;

    // summarizePRs can take up to 120s — give the request 150s before timing out
    req.setTimeout(150_000);
    res.setTimeout(150_000);

    try {
      console.log(
        `[summarize:start] identifier=${summarizeIdentifier(entry.identifier)} repo=${owner}/${repo}`,
      );
      const result = await summarizePRsTask({ identifier: entry.identifier, owner, repo });
      console.log(
        `[summarize:success] identifier=${summarizeIdentifier(entry.identifier)} repo=${owner}/${repo} prs=${result.prsAnalyzed.length}`,
      );
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[summarize:error] identifier=${summarizeIdentifier(entry.identifier)} repo=${owner}/${repo} message=${msg}`,
      );
      res.status(500).json({ error: formatSummarizeError(owner, repo, err) });
    }
  });

  app.listen(PORT, () => {
    console.log(`[WEB] Server listening on http://localhost:${PORT}`);
  });
}
