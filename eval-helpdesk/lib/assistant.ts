import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { askClaude, AssistantError } from "./claude";
import { env } from "./env";
import type { ChangeRow } from "./fixes";
import { notifyNewChange } from "./notify";
import { redact, redactDeep } from "./redact";
import { db } from "./supabase";
import { loadImage, type Attachment } from "./uploads";

type MessageRow = { role: "teacher" | "assistant"; content: string; attachments: Attachment[]; created_at: string };

const MAX_IMAGES = 6; // newest screenshots sent to Claude per request

/** Messages a teacher has sent in the last hour, across all their reports. */
export async function teacherMessagesLastHour(teacherId: string): Promise<number> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db()
    .from("report_messages")
    .select("id, reports!inner(teacher_id)", { count: "exact", head: true })
    .eq("reports.teacher_id", teacherId)
    .eq("role", "teacher")
    .gte("created_at", since);
  return count ?? 0;
}

export async function assertWithinLimit(teacherId: string) {
  if ((await teacherMessagesLastHour(teacherId)) >= env.hourlyLimit) {
    throw new AssistantError("You have sent a lot of messages in the last hour. Please wait a little and try again.");
  }
}

/**
 * Reads the whole report thread, asks Claude, saves the reply, and logs a change
 * request if Claude found a code fault. Returns the saved reply text.
 */
export async function runAssistant(reportId: string): Promise<string> {
  const sb = db();
  const { data: report } = await sb.from("reports").select("*").eq("id", reportId).single();
  if (!report) throw new Error("Report not found");

  const { data: msgs } = await sb
    .from("report_messages")
    .select("role, content, attachments, created_at")
    .eq("report_id", reportId)
    .order("created_at");
  const thread = (msgs ?? []) as MessageRow[];

  const snapshot = report.copy_ref
    ? (await sb.from("copy_snapshots").select("data").eq("copy_ref", report.copy_ref).maybeSingle()).data
    : null;

  const { data: known } = await sb
    .from("change_requests")
    .select("title, status")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(30);

  // Only the newest screenshots are sent, to keep each request small.
  const imagePaths = new Set(thread.flatMap((m) => m.attachments.map((a) => a.path)).slice(-MAX_IMAGES));

  const context = [
    "<report>",
    `Copy ID: ${report.copy_ref || "not given"}`,
    `Student roll/ID: ${report.student_ref || "not given"}`,
    `Subject: ${report.subject || "not given"}`,
    `Title: ${report.title}`,
    "</report>",
    snapshot
      ? `<copy_data>\n${JSON.stringify(redactDeep(snapshot.data), null, 1).slice(0, 60_000)}\n</copy_data>`
      : "<copy_data>No copy data from the portal for this copy. Work from the teacher's description and screenshots.</copy_data>",
    `<known_issues>\n${(known ?? []).map((k) => `- ${k.title} (${k.status})`).join("\n") || "None logged yet."}\n</known_issues>`,
  ].join("\n");

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (let i = 0; i < thread.length; i++) {
    const m = thread[i];
    if (m.role === "assistant") {
      messages.push({ role: "assistant", content: m.content });
      continue;
    }
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (i === 0) content.push({ type: "text", text: context });
    for (const a of m.attachments) {
      if (!imagePaths.has(a.path)) continue;
      const data = await loadImage(a.path);
      if (data) content.push({ type: "image", source: { type: "base64", media_type: a.media_type, data } });
    }
    content.push({ type: "text", text: `<teacher_message>\n${m.content}\n</teacher_message>` });
    messages.push({ role: "user", content });
  }

  const result = await askClaude(messages);

  const reply = redact(result.reply);
  const corrected = redactDeep(result.corrected_marks);
  await sb.from("report_messages").insert({
    report_id: reportId,
    role: "assistant",
    content: reply,
    corrected_marks: corrected.length ? corrected : null,
  });

  let status = result.classification === "needs_more_info" ? "open" : "answered";
  if (result.classification === "code_bug" && result.change_request) {
    const cr = redactDeep(result.change_request);
    const { data: row } = await sb
      .from("change_requests")
      .insert({ report_id: reportId, ...cr })
      .select("*")
      .single();
    status = "waiting_owner";
    if (row) await notifyNewChange(row as ChangeRow).catch((e) => console.error(e));
  }

  await sb
    .from("reports")
    .update({ classification: result.classification, status, updated_at: new Date().toISOString() })
    .eq("id", reportId);

  return reply;
}
