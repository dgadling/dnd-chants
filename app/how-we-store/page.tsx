"use client";
import { useTheme } from "@/lib/useTheme";

export default function HowWeStore() {
  const { actual } = useTheme();
  const isLight = actual === "light";
  return (
    <div className={`min-h-screen antialiased ${isLight ? "bg-white text-zinc-900" : "bg-zinc-900 text-zinc-100"}`}>
      <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
        <a href="/" className={`text-[13px] underline ${isLight ? "text-zinc-600 hover:text-zinc-900" : "text-zinc-400 hover:text-zinc-200"}`}>← Back to Chants</a>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">How we store your data</h1>
        <div className={`mt-6 space-y-4 text-[14px] leading-relaxed ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>Local first.</strong> Everything you type and your characters live in your browser on this machine. We do not have accounts or servers storing your stuff unless you enable Cloud Backup.</p>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>D&D Beyond fetch.</strong> When you add a character, we fetch it from D&D Beyond via our proxy at <code className={`text-[12px] px-1.5 py-0.5 rounded ${isLight ? "bg-zinc-100 text-zinc-800" : "bg-zinc-800 text-zinc-100"}`}>/api/dndbeyond</code>. We do not keep a copy on our servers, we just pass it through. We only do this because dndbeyond.com does not allow you to fetch directly.</p>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>Translate and audio.</strong> When you translate text, you send it directly to Google for translation. We never see it. When you play audio, we send the spell text and language to Google Translate via our proxy <code className={`text-[12px] px-1.5 py-0.5 rounded ${isLight ? "bg-zinc-100 text-zinc-800" : "bg-zinc-800 text-zinc-100"}`}>/api/tts</code>. Similar to dndbeyond.com, this is a technical limitation with Google. No personal info, just the chant text.</p>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>Cloud Backup (optional).</strong> If you click Enable backups, we ask for Discord login only to get an authenticated user id. This allows us to limit who can access your backups to only people who can log in to Discord as you. We store your data in Firestore, a Google managed service.</p>
          <h2 className={`text-[16px] font-semibold mt-6 ${isLight ? "text-zinc-900" : "text-zinc-100"}`}>Encryption – so we cannot see what we are storing</h2>
          <p>Before anything is uploaded, your browser does a few things using the PIN you select to compress and encrypt your data. Your PIN never leaves this machine. The technical details are that we:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li><code className={`text-[12px] px-1.5 py-0.5 rounded ${isLight ? "bg-zinc-100" : "bg-zinc-800"}`}>JSON.stringify</code> your characters, language selections, and chants</li>
            <li><code className={`text-[12px] px-1.5 py-0.5 rounded ${isLight ? "bg-zinc-100" : "bg-zinc-800"}`}>gzip</code> compress with <code className={`text-[12px] px-1.5 py-0.5 rounded ${isLight ? "bg-zinc-100" : "bg-zinc-800"}`}>pako</code> deflate. This helps keep us in the Firebase free tier.</li>
            <li>Derive a key from your 6-digit PIN with PBKDF2, salt it with your Discord uid (<code className={`text-[12px] px-1.5 py-0.5 rounded ${isLight ? "bg-zinc-100" : "bg-zinc-800"}`}>discord:123</code>), and do 600,000 iterations of SHA-256 AES-GCM 256, 500 ms per try. We could do tighter encryption, but it would be less accessible.</li>
            <li>Generate a random 12-byte IV, then encrypt the data and <code className={`text-[12px] px-1.5 py-0.5 rounded ${isLight ? "bg-zinc-100" : "bg-zinc-800"}`}>base64</code> encode it. We store that and the IV locally, then upload it to Firebase.</li>
          </ol>
          <p>The server never sees the PIN or the key. It only sees the IV and the encrypted data. We also record a timestamp, to be safe.</p>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>It is not perfect, but it is private.</strong> A 6-digit PIN has 1,000,000 possibilities. With PBKDF2 600k 500 ms, 1,000,000 tries takes ~5.7 days on a laptop to decrypt. We accept the trade-off because this is D&D data. If somebody wants to go through that effort you and they have bigger problems. If someone gets your device, everything is local, but again you have bigger problems. Please use a different PIN than your bank.</p>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>What if you forget the PIN?</strong>Your backup is gone. Your local data is fine. You can create a new backup with a better PIN.</p>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>Multi-device.</strong> Log in with Discord on device 2, enter same 6-digit PIN, and Restore.</p>
          <p><strong className={isLight ? "text-zinc-900" : "text-zinc-100"}>Delete.</strong> You can Delete cloud backup from the drawer or Disable backups on device. Delete removes your backup from Firestore. Disable removes local key and signs out of Discord, but does not delete the Firestore copy.</p>
        </div>
        <div className={`mt-8 pt-6 border-t text-[12px] ${isLight ? "border-zinc-200 text-zinc-500" : "border-zinc-800 text-zinc-500"}`}><a href="/" className={`underline ${isLight ? "hover:text-zinc-700" : "hover:text-zinc-300"}`}>Back to Chants</a><span className="mx-2">·</span></div>
      </div>
    </div>
  );
}
