import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parthu Helpdesk",
  description: "Report evaluation mistakes and get corrected marks.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
