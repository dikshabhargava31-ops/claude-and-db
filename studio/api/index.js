// Vercel entry point: every /api, /oauth and /files request is routed here (see vercel.json);
// the pages, styles and scripts in public/ are served by Vercel directly.
export { handler as default } from "../server.js";
