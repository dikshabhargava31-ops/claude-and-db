// End-to-end test in a real browser (Playwright + Chromium).
// Pass 1 runs the main flow against local mocks of YouTube, Claude and GitHub:
//   set up workspace → add channels → search → save reference → develop and shortlist a topic →
//   hooks and outline → script → pipeline → research run → assistant → analytics → Instagram hand-off.
// Pass 2 runs with no credentials and checks every page shows honest unavailable states,
// template fallbacks, CSV import and outliers from imported data.
// Usage: npm run test:e2e
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { youtubeMock, claudeMock, githubMock, listen } from "./mocks.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
let failures = 0;

async function step(name, fn) {
  try { await fn(); results.push(`  ✓ ${name}`); }
  catch (e) {
    failures++;
    results.push(`  ✗ ${name}\n      ${String(e.message).split("\n")[0]}`);
    if (globalThis.currentPage) {
      fs.mkdirSync(path.join(here, "..", "test-results"), { recursive: true });
      await globalThis.currentPage.screenshot({ path: path.join(here, "..", "test-results", `fail-${failures}.png`), fullPage: true }).catch(() => {});
    }
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function startServer(env, port) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-e2e-"));
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC_|YOUTUBE_|GOOGLE_|GITHUB_|IG_|YT_|PUBLIC_URL)/.test(k)));
  const proc = spawn(process.execPath, [path.join(here, "..", "server.js")], { env: { ...clean, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 50 && !log.includes("Creator Research Studio:"); i++) await new Promise((r) => setTimeout(r, 100));
  return { proc, url: `http://127.0.0.1:${port}`, log: () => log, dataDir };
}

function watchPage(page, errors) {
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  const answers = [];
  page.on("dialog", (d) => d.accept(answers.shift() ?? ""));
  return (a) => answers.push(a);
}

const go = async (page, base, hash) => { await page.goto(`${base}/#/${hash}`); await page.waitForSelector("#view:not(:has(.loading:only-child))"); };
const toastText = async (page) => (await page.waitForSelector(".toast", { timeout: 15000 })).textContent();

async function signUp(page, base) {
  await page.goto(base);
  await page.fill("input[name=name]", "Test Owner");
  await page.fill("input[name=email]", "owner@example.com");
  await page.fill("input[name=password]", "a-long-test-password");
  await page.click("button.primary");
  await page.waitForSelector("text=Create your first workspace");
}

async function passWithMocks(browser) {
  const yt = youtubeMock(), claude = claudeMock(), gh = githubMock();
  const [ytUrl, claudeUrl, ghUrl] = await Promise.all([listen(yt.server), listen(claude.server), listen(gh.server)]);
  const srv = await startServer({ YOUTUBE_API_KEY: "test-yt-key", YT_API_BASE: ytUrl, ANTHROPIC_API_KEY: "test-anthropic-key", ANTHROPIC_BASE_URL: claudeUrl, GITHUB_TOKEN: "test-gh-token", GITHUB_API_BASE: ghUrl }, 4391);
  const page = await browser.newPage();
  const errors = [];
  const answer = watchPage(page, errors);
  globalThis.currentPage = page;
  const base = srv.url;
  results.push("Pass 1: main flow with mocked YouTube, Claude and GitHub");
  try {
    await step("Create owner account and the CA workspace", async () => {
      await signUp(page, base);
      await page.click("text=Start with “CA Mahendra Sir”");
      await page.waitForSelector("h1:text('Dashboard')");
      assert(await page.isVisible("text=Getting started"), "checklist missing");
    });

    await step("Approve an AI budget (owner)", async () => {
      await go(page, base, "settings?tab=ai");
      await page.fill("input[name=aiBudgetUsd]", "20");
      await page.click("text=Approve budget");
      await toastText(page);
    });

    await step("1. Workspace profile is set up and saved", async () => {
      await go(page, base, "settings");
      assert((await page.inputValue("input[name=youtubeUrl]")).includes("@camahendrasir"), "preset channel missing");
      await page.fill("textarea[name=tone]", "Direct mentor, Hinglish, evidence first");
      await page.click("text=Save workspace");
      await toastText(page);
    });

    await step("2. Add own, competitor and inspiration channels (live data, outliers scored)", async () => {
      await go(page, base, "channels");
      for (const [input, list] of [["@camahendrasir", "own"], ["@testcompetitor", "competitor"], ["https://www.youtube.com/@testinspiration", "inspiration"]]) {
        await page.fill("input[name=input]", input);
        await page.selectOption("#addForm select[name=list]", list);
        await page.click("#addForm button");
        await page.waitForSelector(`text=${{ own: "Test Own Channel", competitor: "Test Competitor", inspiration: "Test Inspiration" }[list]}`);
      }
      const text = await page.textContent("#view");
      assert(text.includes("Live data"), "live label missing");
      assert(/stored videos/.test(text), "videos not stored");
    });

    await step("3. Search YouTube and see scored results", async () => {
      await go(page, base, "research");
      await page.waitForSelector("#outliers .vcard", { timeout: 10000 });
      await page.fill("#searchForm input[name=input]", "CA exam result");
      await page.click("#searchForm button.primary");
      await page.waitForSelector("#results .vcard");
      assert((await page.textContent("#results")).includes("Live data"), "source label missing");
    });

    await step("4. Save a reference from a search result", async () => {
      await page.click("#results .vcard >> nth=0 >> text=Save Reference");
      await page.check(".modal input[value=titles]");
      await page.fill(".modal textarea[name=notes]", "Study the title pattern");
      await page.click(".modal button.primary");
      await toastText(page);
      await go(page, base, "library");
      await page.waitForSelector("#list article");
      await page.click("#list article >> nth=0 >> text=Suggest tags & summary");
      await page.waitForSelector("text=Suggested (AI)");
      await page.click("text=Accept");
      await page.waitForSelector("#list article >> text=Test summary");
    });

    await step("5. Develop an original idea and shortlist it (with overlap check)", async () => {
      await page.click("#list article >> nth=0 >> text=Develop Idea");
      await page.fill(".modal input[name=i]", "focus on CA Inter students");
      await page.click(".modal button.primary");
      await page.waitForSelector("h1:text('Opportunities')");
      await page.waitForSelector("text=Test topic: articleship choices");
      await page.click("article >> nth=0 >> text=Shortlist");
      await toastText(page);
      await page.waitForSelector("article >> nth=0 >> .pill:text('shortlisted')");
    });

    await step("6. Develop Script: brief with sources, hooks, outline, script, revision, comment, approval", async () => {
      await page.click("article >> nth=0 >> text=Develop Script");
      await page.waitForSelector("text=Research and write brief");
      await page.click("text=Research and write brief");
      await page.waitForSelector("text=Test brief summary");
      assert(await page.isVisible("a:text('Test news source')"), "web source not shown");
      await page.click(".tabs >> text=Hooks");
      await page.click("text=Generate hooks");
      await page.waitForSelector("text=Test hook 1 (Relatable situation)");
      await page.check("input[name=chosenHook] >> nth=0");
      await page.waitForSelector("text=Chosen hook:");
      await page.click(".tabs >> text=Outline");
      await page.click("text=Generate outline");
      await page.waitForSelector("text=Test payoff");
      await page.click(".tabs >> text=Full script");
      await page.click("text=Write full script");
      await page.waitForSelector("textarea:has-text('Test script body.')");
      assert(await page.isVisible("text=claim(s) to verify"), "claims warning missing");
      answer("Make it shorter");
      await page.click("text=Revise section with AI >> nth=0");
      await page.waitForSelector("textarea:has-text('Revised test section.')");
      await page.click(".tabs >> text=Versions");
      assert((await page.$$("text=/^v\\d+$/")).length >= 5, "version history too short");
      await page.click(".tabs >> text=Comments");
      await page.fill("#commentText", "Looks good, check the statistic.");
      await page.click("button[data-act=comment]");
      await page.waitForSelector("text=Looks good, check the statistic.");
      await page.selectOption("#status", "approved");
      await toastText(page);
    });

    await step("7. Move the item through the pipeline (board)", async () => {
      await go(page, base, "planner");
      await page.waitForSelector(".icard");
      await page.selectOption(".icard >> nth=0 >> select", "Ready to Record");
      await toastText(page);
      await page.waitForSelector(".col[data-stage='Ready to Record'] .icard");
      await page.click("text=Calendar");
      await page.waitForSelector(".cal");
      assert(await page.isVisible("text=IG parthu"), "Instagram Planner posts not shown in calendar");
    });

    await step("Run my content research end to end → review queue", async () => {
      await go(page, base, "dashboard");
      await page.click("#runResearch");
      await page.waitForSelector("text=Research run finished.", { timeout: 30000 });
      await page.waitForSelector("h1:text('Dashboard')");
      const text = await page.textContent("#view");
      for (const s of ["Study my channel", "Find outlier videos", "Recommend topics", "Prepare hooks and outlines"]) assert(text.includes(s), `step ${s} missing`);
      assert(text.includes("waiting"), "review queue empty");
      assert(/audience questions found/.test(text), "audience questions missing");
    });

    await step("AI Assistant answers with workspace data and saves output", async () => {
      await go(page, base, "assistant");
      await page.fill("textarea[name=text]", "Find recent outliers among my saved competitors.");
      await page.click("#ask button.primary");
      await page.waitForSelector(".msg.assistant >> text=Workspace data used", { timeout: 15000 });
      await page.click(".msg.assistant >> text=Planner task");
      await page.waitForSelector("text=Saved to Content Planner");
    });

    await step("Analytics: own baseline, evidence, hypotheses and experiments", async () => {
      await go(page, base, "analytics");
      await page.waitForSelector("table");
      await page.click("[data-video] >> nth=0");
      await page.waitForSelector("text=1. Observed evidence");
      assert(await page.isVisible("text=Authorised analytics (retention"), "limits not explained");
      await page.click("text=Suggest explanations and experiments");
      await page.waitForSelector("text=Test hypothesis");
      await page.click(".modal [data-close]");
    });

    await step("Instagram hand-off waits for owner approval, then commits to posts.csv", async () => {
      await go(page, base, "planner?view=list");
      await page.click("[data-open] >> nth=0");
      await page.click("text=Prepare an Instagram post for the existing scheduler");
      const when = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) + "T18:30";
      await page.fill("#igForm input[name=publish_at]", when);
      await page.fill("#igForm textarea[name=media]", "https://example.org/reel.mp4");
      await page.click("#igForm button.primary");
      await toastText(page);
      assert(gh.writes.length === 0, "committed before approval!");
      await go(page, base, "dashboard");
      await page.click("text=Approve and schedule on Instagram");
      await page.waitForSelector("text=/Scheduled\\./");
      assert(gh.writes.length === 1 && gh.writes[0].path === "instagram/posts.csv", "posts.csv not written");
      assert(gh.files["instagram/posts.csv"].includes("https://example.org/reel.mp4"), "row missing");
      assert(/^ipa-\d{8}-1830-[a-z0-9]{4},ipa,/m.test(gh.files["instagram/posts.csv"]), "id format wrong");
    });

    await step("Every page renders without errors", async () => {
      for (const v of ["dashboard", "research", "channels", "opportunities", "assistant", "scripts", "library", "library?tab=preferences", "planner", "analytics?platform=youtube-short", "analytics?platform=instagram", "settings?tab=connections", "settings?tab=team", "settings?tab=schedule"]) {
        await go(page, base, v);
        assert(!(await page.isVisible(".notice.error")), `error box on ${v}`);
      }
    });

    await step("No browser errors and no secrets sent to the browser", async () => {
      assert(!errors.length, errors.join(" | "));
      const ws = await page.evaluate(async () => (await fetch("/api/workspaces")).json());
      const detail = await page.evaluate(async (id) => (await fetch(`/api/ws/${id}`)).text(), ws[0].id);
      assert(!/test-anthropic-key|test-yt-key|test-gh-token/.test(detail), "secret leaked");
      assert(claude.requests.every((r) => r.body.model === "claude-opus-5-5"), "unexpected model");
    });
  } finally {
    await page.close();
    srv.proc.kill();
    yt.server.close(); claude.server.close(); gh.server.close();
    if (failures && process.env.E2E_DEBUG) console.log(srv.log());
  }
}

async function passWithoutCredentials(browser) {
  const gh = githubMock();
  const ghUrl = await listen(gh.server);
  const srv = await startServer({ GITHUB_API_BASE: ghUrl }, 4392);
  const page = await browser.newPage();
  const errors = [];
  watchPage(page, errors);
  globalThis.currentPage = page;
  const base = srv.url;
  results.push("Pass 2: no credentials (honest unavailable states and fallbacks)");
  try {
    await step("Sign up, blank workspace", async () => {
      await signUp(page, base);
      await page.fill("#blank input[name=name]", "Second brand");
      await page.click("#blank button");
      await page.waitForSelector("h1:text('Dashboard')");
      assert(await page.isVisible("text=Connections 1/5 live"), "status count wrong");
    });

    await step("Connections page labels every integration", async () => {
      await go(page, base, "settings?tab=connections");
      await page.waitForSelector("text=Connection status");
      const t = await page.textContent("#view");
      assert((t.match(/Unavailable/g) || []).length >= 4, "unavailable labels missing");
      assert(t.includes("YOUTUBE_API_KEY"), "missing credential not named");
    });

    await step("Research shows the YouTube API as unavailable; search disabled", async () => {
      await go(page, base, "research");
      assert(await page.isDisabled("#searchForm button.primary"), "search not disabled");
    });

    await step("Channel added by hand + CSV import → imported data scored against its own baseline", async () => {
      await go(page, base, "channels");
      await page.fill("#addForm input[name=input]", "@somecompetitor");
      await page.click("#addForm button");
      await page.waitForSelector("text=@somecompetitor");
      const rows = ["Video ID,Title,Published,Duration,Views"];
      for (let i = 0; i < 12; i++) rows.push(`vid${String(i).padStart(8, "0")},Test video ${i},${new Date(Date.now() - (40 + i * 7) * 864e5).toISOString().slice(0, 10)},12:00,${i === 3 ? 90000 : 10000 + i * 300}`);
      const file = path.join(srv.dataDir, "import.csv");
      fs.writeFileSync(file, rows.join("\n"));
      await page.click("text=Import CSV");
      await page.setInputFiles("#f", file);
      await page.click("#go");
      await page.waitForSelector("text=Imported 12 videos");
      await page.click(".modal #cancel");
      await page.waitForSelector("text=Imported data");
      await go(page, base, "research");
      await page.waitForSelector("#outliers .vcard");
      assert((await page.textContent("#outliers")).includes("Test video 3"), "outlier not found");
    });

    await step("Template hooks when AI is not connected (clearly labelled)", async () => {
      await go(page, base, "opportunities");
      await page.click("#newTopic");
      await page.fill(".modal input[name=title]", "Should students take a drop year");
      await page.fill(".modal input[name=centralQuestion]", "Is a drop year worth it?");
      await page.click(".modal button.primary");
      await page.waitForSelector("text=Should students take a drop year");
      await page.click("text=Generate hooks");
      await page.click(".modal button.primary");
      await page.waitForSelector(".modal >> text=Template drafts");
      assert(await page.isVisible(".modal >> text=Is a drop year worth it?"), "template not built from the topic");
      await page.keyboard.press("Escape");
    });

    await step("Duplicate-topic warning", async () => {
      await page.click("#newTopic");
      await page.fill(".modal input[name=title]", "Should students take a drop year?");
      await page.fill(".modal input[name=centralQuestion]", "drop year");
      await page.waitForSelector(".modal >> text=/Likely duplicate|Possible overlap/");
      await page.keyboard.press("Escape");
    });

    await step("Assistant disabled with a clear reason", async () => {
      await go(page, base, "assistant");
      assert(await page.isDisabled("textarea[name=text]"), "chat not disabled");
      assert(await page.isVisible("text=ANTHROPIC_API_KEY"), "reason missing");
    });

    await step("Research run reports blocked steps instead of inventing results", async () => {
      await go(page, base, "dashboard");
      await page.click("#runResearch");
      await page.waitForSelector("#runBox >> text=/· (completed|completed with errors)/", { timeout: 20000 });
      const t = await page.textContent("#view");
      assert(t.includes("blocked"), "no blocked step");
      assert(/doesn't invent recommendations|Set a niche|No evidence/.test(t), "topic step not honest");
    });

    await step("Demo workspace is separate and labelled", async () => {
      await page.selectOption("#wsPick", "__new").catch(() => {});
      await page.evaluate(async () => fetch("/api/workspaces", { method: "POST", headers: { "x-studio": "1", "content-type": "application/json" }, body: JSON.stringify({ demo: true }) }));
      await page.goto(base);
      await page.waitForSelector("#wsPick");
      const id = await page.evaluate(async () => (await (await fetch("/api/workspaces")).json()).find((w) => w.demo).id);
      await page.selectOption("#wsPick", id);
      await page.waitForSelector(".pill.demo");
      await go(page, base, "channels");
      assert((await page.textContent("#view")).includes("Demo data"), "demo label missing");
    });

    await step("Viewer role can't edit; other users can't see the workspace", async () => {
      const ws = await page.evaluate(async () => (await (await fetch("/api/workspaces")).json()).find((w) => !w.demo).id);
      const r = await page.evaluate(async () => (await fetch("/api/users", { method: "POST", headers: { "x-studio": "1", "content-type": "application/json" }, body: JSON.stringify({ name: "Viewer", email: "viewer@example.com", password: "viewer-password-1" }) })).status);
      assert(r === 200, "create user failed");
      await page.evaluate(async (id) => fetch(`/api/ws/${id}/members`, { method: "POST", headers: { "x-studio": "1", "content-type": "application/json" }, body: JSON.stringify({ email: "viewer@example.com", role: "viewer" }) }), ws);
      const ctx2 = await browser.newContext();
      const p2 = await ctx2.newPage();
      await p2.goto(base);
      await p2.fill("input[name=email]", "viewer@example.com");
      await p2.fill("input[name=password]", "viewer-password-1");
      await p2.click("button.primary");
      await p2.waitForSelector("h1:text('Dashboard')");
      assert(!(await p2.isVisible("#runResearch")), "viewer can run research");
      const status = await p2.evaluate(async (id) => (await fetch(`/api/ws/${id}/items`, { method: "POST", headers: { "x-studio": "1", "content-type": "application/json" }, body: JSON.stringify({ title: "x" }) })).status, ws);
      assert(status === 403, "viewer could write");
      const demo = await page.evaluate(async () => (await (await fetch("/api/workspaces")).json()).find((w) => w.demo).id);
      const s2 = await p2.evaluate(async (id) => (await fetch(`/api/ws/${id}`)).status, demo);
      assert(s2 === 404, "non-member could read workspace");
      const csrf = await p2.evaluate(async (id) => (await fetch(`/api/ws/${id}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, ws);
      assert(csrf === 403, "missing header accepted");
      await ctx2.close();
    });

    await step("No browser errors", async () => assert(!errors.length, errors.join(" | ")));
  } finally {
    await page.close();
    srv.proc.kill();
    gh.server.close();
    if (failures && process.env.E2E_DEBUG) console.log(srv.log());
  }
}

const browser = await chromium.launch();
try {
  await passWithMocks(browser);
  await passWithoutCredentials(browser);
} finally {
  await browser.close();
}
console.log(results.join("\n"));
console.log(failures ? `\n${failures} step(s) failed.` : "\nAll end-to-end steps passed.");
process.exit(failures ? 1 : 0);
