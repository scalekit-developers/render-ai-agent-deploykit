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

function formatSummarizeError(owner: string, repo: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const isRepoNotFound =
    msg.includes("GitHub tool 'github_pull_requests_list' failed:") &&
    msg.includes("tool execution failed - Not Found");

  if (isRepoNotFound) {
    return `GitHub could not find '${owner}/${repo}' for the connected account. Check the owner/repo name, or reconnect GitHub with an account that has access if the repository is private.`;
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
      const result = await setupGitHubAuthTask({ identifier, state, userVerifyUrl });
      res.json({ authLink: result.authLink });
    } catch (err) {
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
      await verifyUser({
        authRequestId,
        identifier: entry.identifier,
      });
      markConnected(entry);
      // Keep the browser inside the app after successful verification.
      // Scalekit may return its own hosted success page URL, but this sample
      // should land the user back on the local session-bound UI.
      res.redirect("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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

    const { owner, repo } = req.body as { owner?: string; repo?: string };
    if (!owner || !repo) {
      res.status(400).json({ error: "owner and repo are required" });
      return;
    }

    // summarizePRs can take up to 120s — give the request 150s before timing out
    req.setTimeout(150_000);
    res.setTimeout(150_000);

    try {
      const result = await summarizePRsTask({ identifier: entry.identifier, owner, repo });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: formatSummarizeError(owner, repo, err) });
    }
  });

  app.listen(PORT, () => {
    console.log(`[WEB] Server listening on http://localhost:${PORT}`);
  });
}
