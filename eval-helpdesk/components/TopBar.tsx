import Link from "next/link";
import { LogoutButton } from "./client";

type Role = "teacher" | "owner" | "developer";
const LINKS: Record<Role, Array<[string, string]>> = {
  teacher: [["/reports", "My reports"], ["/reports/new", "Report a problem"]],
  owner: [["/owner", "Change log"], ["/owner/reports", "Reports"], ["/fixes", "Fixes"], ["/owner/teachers", "Teachers"], ["/owner/setup", "Claude Code key"]],
  developer: [["/fixes", "Fixes"]],
};

export function TopBar({ role, name }: { role: Role; name?: string }) {
  return (
    <header className="top">
      <div className="in">
        <Link className="brand" href="/">Parthu Helpdesk</Link>
        <nav>
          {LINKS[role].map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <span className="muted small">{name ?? role}</span>
        <LogoutButton />
      </div>
    </header>
  );
}

export function StatusChip({ value }: { value: string }) {
  const tone: Record<string, string> = {
    pending: "warn", approved: "ok", done: "ok", rejected: "bad",
    open: "warn", answered: "ok", waiting_owner: "warn", closed: "",
    code_bug: "bad", ai_marking_error: "warn", teacher_query: "", needs_more_info: "warn",
    critical: "bad", high: "bad", medium: "warn", low: "",
  };
  const label = value.replace(/_/g, " ");
  return <span className={`chip ${tone[value] ?? ""}`}>{label}</span>;
}
