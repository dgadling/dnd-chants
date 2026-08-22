import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "D&D Chants",
  description: "Create and translate D&D spell chants with audio and idiom search",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-zinc-700 sticky top-0 z-10 backdrop-blur bg-zinc-900/80">
            <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
              <div className="font-bold tracking-wide">🐉 D&D Chants</div>
            </div>
          </header>
          <main className="max-w-[1200px] mx-auto px-4 py-6">{children}</main>
          <footer className="max-w-[1200px] mx-auto px-4 py-10 text-xs text-zinc-500"></footer>
        </div>
      </body>
    </html>
  );
}
