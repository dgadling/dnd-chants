import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "D&D Chants - Chant Lab",
  description: "GCP-hosted Next.js chant lab Option A with idiom search",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur bg-[color-mix(in_srgb,var(--bg)_80%,transparent)]">
            <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
              <div className="font-bold tracking-wide">🐉 D&D Chants Lab</div>
              <div className="text-xs text-[var(--dim)]">Option A · idiom 💬 · public</div>
            </div>
          </header>
          <main className="max-w-[1200px] mx-auto px-4 py-6">{children}</main>
          <footer className="max-w-[1200px] mx-auto px-4 py-10 text-xs text-[var(--dim)]">
            Built for GCP Cloud Run · Next.js 14 · Tailwind
          </footer>
        </div>
      </body>
    </html>
  );
}
