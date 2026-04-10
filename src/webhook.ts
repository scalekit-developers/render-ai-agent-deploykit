import "dotenv/config";
import crypto from "crypto";
import express from "express";
import { Render } from "@renderinc/sdk";
import { scalekit, getAuthLink } from "./scalekit.js";

const app = express();
const render = new Render();

const WORKFLOW_SLUG = process.env.RENDER_WORKFLOW_SLUG ?? "docfix";
const LINEAR_WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET ?? "";
const PORT = process.env.WEBHOOK_PORT ? parseInt(process.env.WEBHOOK_PORT) : 3001;
const BASE_URL = process.env.AUTH_BASE_URL ?? `http://localhost:${PORT}`;

// Raw body needed for HMAC validation on /webhook; other routes use query params only
app.use(express.raw({ type: "application/json" }));

function validateLinearSignature(rawBody: Buffer, signature: string): boolean {
  if (!LINEAR_WEBHOOK_SECRET) {
    console.warn("[WEBHOOK] LINEAR_WEBHOOK_SECRET not set — skipping signature check");
    return true;
  }
  const expected = crypto
    .createHmac("sha256", LINEAR_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

// ---- Webhook ----

app.post("/webhook", async (req, res) => {
  const signature = req.headers["linear-signature"] as string | undefined;
  const rawBody = req.body as Buffer;

  if (signature && !validateLinearSignature(rawBody, signature)) {
    console.warn("[WEBHOOK] Invalid Linear signature — rejecting request");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  if (payload.action !== "create" || payload.type !== "Issue") {
    res.status(200).json({ ignored: true });
    return;
  }

  const data = payload.data as Record<string, unknown>;
  const actor = payload.actor as Record<string, unknown>;

  const issuePayload = {
    title: data.title as string,
    body: (data.body ?? data.description ?? "") as string,
    issueId: data.id as string,
    linearUserId: actor.id as string,
  };

  console.log(`[WEBHOOK] New issue ${issuePayload.issueId} from user ${issuePayload.linearUserId}`);

  try {
    await render.workflows.startTask(`${WORKFLOW_SLUG}/processIssue`, [issuePayload]);
    console.log(`[WEBHOOK] Triggered processIssue for issue ${issuePayload.issueId}`);
  } catch (err) {
    console.error("[WEBHOOK] Failed to trigger workflow:", err);
    res.status(500).json({ error: "Failed to trigger workflow" });
    return;
  }

  res.status(200).json({ ok: true });
});

// ---- Auth Setup ----

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
      message: "Click both links to authorize Linear and GitHub access.",
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
      <p>You can close this tab. If you need to connect another service, go back and click the other link.</p>
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[SERVICE] Listening on port ${PORT}`);
  console.log(`  POST /webhook          — Linear webhook receiver`);
  console.log(`  GET  /setup?userId=    — Generate auth links for a user`);
  console.log(`  GET  /callback         — OAuth callback (Scalekit redirect)`);
  console.log(`  GET  /status?userId=   — Check connected accounts`);
});
