import "dotenv/config";

// Import tasks module to register all Render Workflow tasks
import "./tasks.js";

// RENDER_SDK_SOCKET_PATH is set during Render's task registration phase (PORT=9999).
// Skip Express in that context — Render's task server owns the port.
// In normal web service operation (and local dev), start Express.
if (!process.env.RENDER_SDK_SOCKET_PATH) {
  const { startServer } = await import("./server.js");
  startServer();
}
