import "dotenv/config";
import crypto from "crypto";
import express from "express";
import { Render } from "@renderinc/sdk";

const app = express();
const render = new Render();

const WORKFLOW_SLUG = process.env.RENDER_WORKFLOW_SLUG ?? "docfix";
const LINEAR_WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET ?? "";
const PORT = process.env.WEBHOOK_PORT ? parseInt(process.env.WEBHOOK_PORT) : 3001;

// Use raw body for HMAC validation
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

  // Only process newly created issues
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
    console.log(`[WEBHOOK] Triggered processIssue workflow for issue ${issuePayload.issueId}`);
  } catch (err) {
    console.error("[WEBHOOK] Failed to trigger workflow:", err);
    res.status(500).json({ error: "Failed to trigger workflow" });
    return;
  }

  res.status(200).json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[WEBHOOK] Listening on port ${PORT}`);
});
