import { pageSession } from "../../../lib/auth";
import { NewReportForm } from "../../../components/client";
import { TopBar } from "../../../components/TopBar";

export default async function NewReport() {
  const s = await pageSession("teacher");
  return (
    <>
      <TopBar role="teacher" name={s.name} />
      <main>
        <h1>Report a problem</h1>
        <p className="muted">Tell us which copy and which questions are wrong, and attach screenshots. The assistant replies with the correct marks, and if the portal has a bug it is sent to the owner to fix.</p>
        <NewReportForm />
      </main>
    </>
  );
}
