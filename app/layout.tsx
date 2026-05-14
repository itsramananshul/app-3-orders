import type { Metadata } from "next";
import "./globals.css";

const instanceName = process.env.NEXT_PUBLIC_INSTANCE_NAME ?? "Instance";

export const metadata: Metadata = {
  title: `${instanceName} — Orders Management`,
  description: "Standalone orders management app for the enterprise demo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
