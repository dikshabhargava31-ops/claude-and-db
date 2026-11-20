import { pageSession } from "../../../lib/auth";
import { env } from "../../../lib/env";
import { claudeMdSnippet } from "../../../lib/handoff";
import { db } from "../../../lib/supabase";
import { CopyButton, KeyMaker } from "../../../components/client";
import { TopBar } from "../../../components/TopBar";

export default async function Setup() {
  await pageSession("owner");
  const { data: keys } = await db().from("api_keys").select("id, created_at, last_used_at").eq("revoked", false);
  const active = keys?.[0];
  const host = env.appUrl ? new URL(env.appUrl).host : "your-helpdesk-address";
  const snippet = claudeMdSnippet(env.appUrl);
  return (
    <>
      <TopBar role="owner" name="Owner" />
      <main>
        <h1>Connect the evaluation app's Claude Code</h1>
        <p className="muted">
          This lets the Claude Code that works on the evaluation app (on any account) read the approved fixes and mark them done.
          The key can do nothing else: it cannot see teacher reports, screenshots or names.
        </p>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Step 1: the key</h2>
          {active
            ? <p>A key is active (created {new Date(active.created_at).toLocaleDateString("en-IN")}, {active.last_used_at ? `last used ${new Date(active.last_used_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : "not used yet"}).</p>
            : <p>No key yet.</p>}
          <KeyMaker hasKey={!!active} />
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Step 2: put the key where Claude Code can use it</h2>
          <p><strong>If they use Claude Code on the claude.ai website:</strong></p>
          <ol>
            <li>Open a session on the evaluation app, click the environment name in the title bar, then <em>Edit</em>.</li>
            <li>Under <em>Network secrets</em> (older apps: <em>API credentials</em>), add one with host <code>{host}</code> and paste the key. Claude never sees the key; it is added to requests automatically.</li>
            <li>Under <em>Network access</em>, allow <code>{host}</code>.</li>
            <li>Save and start a new session.</li>
          </ol>
          <p><strong>If they use Claude Code on their computer (desktop app or terminal):</strong></p>
          <ol>
            <li>Open <code>.claude/settings.json</code> in their home folder (Mac: <code>/Users/&lt;name&gt;/.claude/settings.json</code>, Windows: <code>C:\Users\&lt;name&gt;\.claude\settings.json</code>). Create it if it doesn't exist.</li>
            <li>Add <code>{`{ "env": { "HELPDESK_KEY": "paste-the-key-here" } }`}</code> (merge it with anything already in the file).</li>
            <li>Restart Claude Code.</li>
          </ol>
          <p className="muted small">Never put the key in the app's code, in CLAUDE.md, or in a chat.</p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Step 3: tell Claude Code what to do</h2>
          <p>Add this to the evaluation app's <code>CLAUDE.md</code> (it has no key in it). Then they just say <strong>“check the helpdesk”</strong>.</p>
          <pre className="block">{snippet}</pre>
          <CopyButton text={snippet} label="Copy this text" />
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Also on</h2>
          <ul>
            <li>Email when a fix is approved: {env.resendKey && env.developerEmails.length ? `on, to ${env.developerEmails.join(", ")}` : "off (set RESEND_API_KEY and DEVELOPER_EMAILS)"}</li>
            <li>Email to you when a new change needs review: {env.resendKey && env.ownerEmails.length ? `on, to ${env.ownerEmails.join(", ")}` : "off (set RESEND_API_KEY and OWNER_EMAILS)"}</li>
            <li>GitHub issue for each approved fix: {env.githubToken && env.githubRepo ? `on, in ${env.githubRepo}${env.githubMentionClaude ? " with @claude" : ""}` : "off (set GITHUB_ISSUES_TOKEN and GITHUB_REPO)"}</li>
            <li>Marks data from the evaluation app: {env.integrationToken ? "ready (INTEGRATION_TOKEN is set)" : "off (set INTEGRATION_TOKEN)"}</li>
          </ul>
        </div>
      </main>
    </>
  );
}
