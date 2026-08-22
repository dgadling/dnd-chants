import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "D&D Chants",
  description: "Create and translate D&D spell chants with audio and idiom search",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('dnd-chant-theme-v1');var m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var t=s==='light'||s==='dark'?s:(s==='auto'||!s?m:'dark');document.documentElement.setAttribute('data-theme',t);var c=t==='light'?'#fafaf9':'#18181b';var meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta);}meta.content=c;}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
