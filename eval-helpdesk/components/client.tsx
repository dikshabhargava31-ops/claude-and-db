"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function call(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function LogoutButton() {
  const router = useRouter();
  return (
    <button onClick={async () => { await call("/api/auth/logout", json("POST")); router.push("/login"); router.refresh(); }}>
      Sign out
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<"teacher" | "owner" | "developer">("teacher");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
          const { next } = await call("/api/auth/login", json("POST", { role, secret }));
          router.push(next); router.refresh();
        } catch (err) { setError((err as Error).message); setBusy(false); }
      }}
    >
      <div className="tabs">
        {(["teacher", "owner", "developer"] as const).map((r) => (
          <a key={r} href="#" className={role === r ? "on" : ""} onClick={(e) => { e.preventDefault(); setRole(r); setSecret(""); }}>
            {r === "teacher" ? "Teacher" : r === "owner" ? "Owner" : "Developer"}
          </a>
        ))}
      </div>
      <label htmlFor="secret">{role === "teacher" ? "Your access code" : "Password"}</label>
      <input
        id="secret" autoComplete={role === "teacher" ? "off" : "current-password"}
        type={role === "teacher" ? "text" : "password"} value={secret}
        placeholder={role === "teacher" ? "ABCD-EFGH-JKLM" : ""}
        onChange={(e) => setSecret(e.target.value)}
      />
      {error && <div className="error">{error}</div>}
      <p><button className="primary" disabled={busy || secret.length < 4}>{busy ? "Signing in…" : "Sign in"}</button></p>
      <p className="muted small">Teachers: ask the owner for your access code. Keep it private.</p>
    </form>
  );
}

function FilePicker({ name }: { name: string }) {
  return (
    <>
      <input type="file" name={name} accept="image/png,image/jpeg,image/webp" multiple />
      <div className="muted small">Up to 3 screenshots (PNG, JPEG or WebP, 5 MB each). Don't include passwords or other private details.</div>
    </>
  );
}

export function NewReportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
          const data = await call("/api/reports", { method: "POST", body: new FormData(e.currentTarget) });
          router.push(`/reports/${data.id}`); router.refresh();
        } catch (err) { setError((err as Error).message); setBusy(false); }
      }}
    >
      <div className="row">
        <div className="grow"><label htmlFor="copy_ref">Copy ID</label><input id="copy_ref" name="copy_ref" type="text" maxLength={100} placeholder="As shown in the portal" /></div>
        <div className="grow"><label htmlFor="student_ref">Roll number</label><input id="student_ref" name="student_ref" type="text" maxLength={100} /></div>
        <div className="grow"><label htmlFor="subject">Subject</label><input id="subject" name="subject" type="text" maxLength={100} /></div>
      </div>
      <label htmlFor="title">Short title</label>
      <input id="title" name="title" type="text" maxLength={160} placeholder="e.g. Q5 MCQ marked wrong" />
      <label htmlFor="message">What went wrong?</label>
      <textarea id="message" name="message" required minLength={5} maxLength={6000}
        placeholder={"e.g. Q5 is an MCQ. The student marked B, the answer key says B, but the portal gave 0 out of 1.\nQ12 was not checked at all."} />
      <label>Screenshots</label>
      <FilePicker name="screenshots" />
      {error && <div className="error">{error}</div>}
      <p><button className="primary" disabled={busy}>{busy ? "Sending… the assistant is checking (up to a minute)" : "Send report"}</button></p>
    </form>
  );
}

export function ReplyBox({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true); setError("");
        try {
          await call(`/api/reports/${reportId}/messages`, { method: "POST", body: new FormData(form) });
          form.reset(); router.refresh();
        } catch (err) { setError((err as Error).message); }
        setBusy(false);
      }}
    >
      <label htmlFor="message">Reply or ask a follow-up</label>
      <textarea id="message" name="message" maxLength={6000} />
      <FilePicker name="screenshots" />
      {error && <div className="error">{error}</div>}
      <p><button className="primary" disabled={busy}>{busy ? "The assistant is checking…" : "Send"}</button></p>
    </form>
  );
}

export function ChangeActions({ id, status, proposed }: { id: string; status: string; proposed: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState(proposed);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  async function decide(next: "approved" | "rejected" | "pending") {
    setBusy(true); setError(""); setMsg("");
    try {
      const data = await call(`/api/owner/changes/${id}`, json("PATCH", {
        status: next, note: note || undefined, proposed_change: edit !== proposed ? edit : undefined,
      }));
      setMsg(next === "approved" ? `Approved.${data.github_issue_url ? " GitHub issue opened." : ""}` : next === "rejected" ? "Rejected." : "Moved back to pending.");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }
  if (status === "done") return null;
  return (
    <div>
      {status === "pending" && (
        <>
          <label>Proposed change (you can edit before approving)</label>
          <textarea value={edit} onChange={(e) => setEdit(e.target.value)} />
        </>
      )}
      <label>Note for the developer (optional)</label>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
      <div className="row" style={{ marginTop: 10 }}>
        {status !== "approved" && <button className="primary" disabled={busy} onClick={() => decide("approved")}>Approve</button>}
        {status !== "rejected" && <button className="danger" disabled={busy} onClick={() => decide("rejected")}>Reject</button>}
        {status !== "pending" && <button disabled={busy} onClick={() => decide("pending")}>Move back to pending</button>}
      </div>
      {msg && <div className="success">{msg}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export function CopyButton({ text, label = "Copy for Claude Code" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}>
      {done ? "Copied ✓" : label}
    </button>
  );
}

export function MarkDoneButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button disabled={busy} onClick={async () => {
        const note = window.prompt("What was changed? (optional)") ?? "";
        setBusy(true); setError("");
        try { await call(`/api/fixes/${id}/done`, json("POST", { note })); router.refresh(); }
        catch (err) { setError((err as Error).message); setBusy(false); }
      }}>Mark done</button>
      {error && <span className="error">{error}</span>}
    </>
  );
}

export function AddTeacher() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Add a teacher</h2>
      <div className="row">
        <div className="grow"><label>Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grow"><label>School / centre (optional)</label><input type="text" value={school} onChange={(e) => setSchool(e.target.value)} /></div>
      </div>
      <p><button className="primary" disabled={name.trim().length < 2} onClick={async () => {
        setError("");
        try {
          const d = await call("/api/owner/teachers", json("POST", { name, school }));
          setCode(`${name}: ${d.code}`); setName(""); setSchool(""); router.refresh();
        } catch (err) { setError((err as Error).message); }
      }}>Create access code</button></p>
      {code && <div className="success">Access code for <span className="code">{code}</span><br />Send it to the teacher privately. It won't be shown again.</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export function TeacherRowActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <div className="row">
      <button onClick={async () => { await call(`/api/owner/teachers/${id}`, json("PATCH", { active: !active })); router.refresh(); }}>
        {active ? "Switch off" : "Switch on"}
      </button>
      <button onClick={async () => {
        if (!window.confirm(`Give ${name} a new code? The old one stops working.`)) return;
        const d = await call(`/api/owner/teachers/${id}`, json("PATCH", { newCode: true })); setCode(d.code);
      }}>New code</button>
      {code && <span className="code small">{code}</span>}
    </div>
  );
}

export function KeyMaker({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  return (
    <div>
      <div className="row">
        <button className="primary" onClick={async () => {
          if (hasKey && !window.confirm("Make a new key? The current key stops working immediately.")) return;
          setError("");
          try { const d = await call("/api/owner/keys", json("POST", { label: "Claude Code" })); setKey(d.key); router.refresh(); }
          catch (err) { setError((err as Error).message); }
        }}>{hasKey ? "Replace the key" : "Create the key"}</button>
        {hasKey && <button className="danger" onClick={async () => {
          if (!window.confirm("Switch off the key? Claude Code will lose access until you create a new one.")) return;
          await call("/api/owner/keys", json("DELETE")); setKey(""); router.refresh();
        }}>Switch off the key</button>}
      </div>
      {key && (
        <div className="success">
          <div>New key (shown only once):</div>
          <div className="code small" style={{ wordBreak: "break-all" }}>{key}</div>
          <div className="row" style={{ marginTop: 8 }}><CopyButton text={key} label="Copy key" /></div>
          <div className="small">Send it to the developer privately. Never put it in code, in CLAUDE.md, or in a chat.</div>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
