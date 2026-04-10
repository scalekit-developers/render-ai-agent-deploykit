/**
 * One-time auth setup service.
 * Run this locally or as a separate Render service to let users authorize
 * their Linear and GitHub accounts via Scalekit.
 *
 * Usage:
 *   GET /setup?userId=<linearUserId>   → returns authorization links
 *   GET /callback?authRequestId=<id>&userId=<linearUserId>  → verifies auth
 */
import "dotenv/config";
import express from "express";
import { scalekit, getAuthLink } from "./scalekit.js";

const app = express();
const PORT = process.env.AUTH_PORT ? parseInt(process.env.AUTH_PORT) : 3002;
const BASE_URL = process.env.AUTH_BASE_URL ?? `http://localhost:${PORT}`;

app.get("/setup", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ error: "userId query param required (use your Linear user ID)" });
    return;
  }

  const callbackUrl = `${BASE_URL}/callback?userId=${encodeURIComponent(userId)}`;

  try {
    const [linearLink, githubLink] = await Promise.all([
      getAuthLink(userId, "linear", callbackUrl),
      getAuthLink(userId, "github", callbackUrl),
    ]);

    res.json({
      message: "Click both links to authorize Linear and GitHub access for your user ID.",
      userId,
      linearAuthUrl: linearLink,
      githubAuthUrl: githubLink,
    });
  } catch (err) {
    console.error("[AUTH] Failed to generate auth links:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/callback", async (req, res) => {
  const authRequestId = req.query.authRequestId as string | undefined;
  const userId = req.query.userId as string | undefined;

  if (!authRequestId || !userId) {
    res.status(400).json({ error: "authRequestId and userId are required" });
    return;
  }

  try {
    await scalekit.actions.verifyConnectedAccountUser({ authRequestId, identifier: userId });
    res.send(`
      <h2>Authorization successful!</h2>
      <p>Your account is connected for user ID: <code>${userId}</code></p>
      <p>You can close this tab and return to the setup page to authorize the other service.</p>
    `);
  } catch (err) {
    console.error("[AUTH] Verification failed:", err);
    res.status(500).send(`<h2>Authorization failed</h2><pre>${String(err)}</pre>`);
  }
});

app.get("/status", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }

  const accounts = await scalekit.actions.listConnectedAccounts({ identifier: userId });
  res.json({
    userId,
    connectedAccounts: accounts.connectedAccounts.map((a: Record<string, unknown>) => ({
      connector: a["connector"],
      status: a["status"],
    })),
  });
});

app.listen(PORT, () => {
  console.log(`[AUTH SETUP] Listening on http://localhost:${PORT}`);
  console.log(`  Setup URL:  http://localhost:${PORT}/setup?userId=<linearUserId>`);
  console.log(`  Status URL: http://localhost:${PORT}/status?userId=<linearUserId>`);
});
