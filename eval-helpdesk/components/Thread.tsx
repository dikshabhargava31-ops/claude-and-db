import { signedUrls } from "../lib/supabase";
import type { Attachment } from "../lib/uploads";

type Corrected = { question: string; awarded: number | null; should_be: number | null; reason: string };
export type ThreadMessage = {
  id: string; role: "teacher" | "assistant"; content: string;
  attachments: Attachment[]; corrected_marks: Corrected[] | null; created_at: string;
};

const fmt = (n: number | null) => (n === null ? "?" : String(n));

export async function Thread({ messages, teacherName }: { messages: ThreadMessage[]; teacherName: string }) {
  const urls = await signedUrls(messages.flatMap((m) => m.attachments.map((a) => a.path)));
  return (
    <div>
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.role}`}>
          <div className="who">
            {m.role === "teacher" ? teacherName : "Helpdesk assistant"} · {new Date(m.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </div>
          {m.content}
          {m.attachments.length > 0 && (
            <div className="shots">
              {m.attachments.map((a) => urls[a.path] && (
                <a key={a.path} href={urls[a.path]} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[a.path]} alt="Screenshot" />
                </a>
              ))}
            </div>
          )}
          {m.corrected_marks && m.corrected_marks.length > 0 && (
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Question</th><th>Given</th><th>Should be</th><th>Why</th></tr></thead>
              <tbody>
                {m.corrected_marks.map((c, i) => (
                  <tr key={i}><td>{c.question}</td><td>{fmt(c.awarded)}</td><td><strong>{fmt(c.should_be)}</strong></td><td>{c.reason}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
