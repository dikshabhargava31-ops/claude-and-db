import { LoginForm } from "../../components/client";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 440 }}>
      <h1>Parthu Helpdesk</h1>
      <p className="muted">Report a mistake in a checked answer copy and get the corrected marks.</p>
      <LoginForm />
    </main>
  );
}
