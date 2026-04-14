import "dotenv/config";

// Import tasks module to register all Render Workflow tasks
import "./tasks.js";

// Start the web server
import { startServer } from "./server.js";
startServer();
