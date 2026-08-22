import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "D&D Chants",
  description: "Create and translate D&D spell chants with audio and idiom search",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-900">{children}</body>
    </html>
  );
}
