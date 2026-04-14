import express from "express";
import { setupGitHubAuthTask, summarizePRsTask } from "./tasks.js";
import { renderHomePage } from "./views.js";

export function startServer(): void {
  const app = express();
  const PORT = parseInt(process.env.PORT ?? "3000", 10);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.type("html").send(renderHomePage());
  });

  app.post("/api/auth", async (req, res) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    try {
      const result = await setupGitHubAuthTask(userId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/summarize", async (req, res) => {
    const { userId, owner, repo } = req.body as { userId?: string; owner?: string; repo?: string };
    if (!userId || !owner || !repo) {
      res.status(400).json({ error: "userId, owner, and repo are required" });
      return;
    }
    // summarizePRs can take up to 120s — give the request 150s before timing out
    req.setTimeout(150_000);
    res.setTimeout(150_000);
    try {
      const result = await summarizePRsTask({ userId, owner, repo });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.listen(PORT, () => {
    console.log(`[WEB] Server listening on http://localhost:${PORT}`);
  });
}
