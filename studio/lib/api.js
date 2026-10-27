// All routes: [method, path, access, handler]. Access is "public", "auth" (signed in), or the
// minimum workspace role for /api/ws/:ws/... paths: "viewer", "editor" or "owner".
import core from "./routes/core.js";
import research from "./routes/research.js";
import content from "./routes/content.js";
import analytics from "./routes/analytics.js";
import assistant from "./routes/assistant.js";

export const routes = [...core, ...research, ...content, ...analytics, ...assistant];
