"use client";

export default function HowWeStore() {
  return (
    <div className="min-h-screen antialiased bg-app text-primary">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
        <a href="/" className="text-[13px] underline text-dim">← Back to Chants</a>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">How we store your data</h1>
        <div className="mt-6 space-y-4 text-[14px] leading-relaxed text-primary">
          <p><strong className="text-primary">Local first.</strong> Everything you type and your characters live in your browser on this machine. We do not have accounts or servers storing your stuff unless you enable Cloud Backup.</p>
          <p><strong className="text-primary">D&D Beyond fetch.</strong> When you add a character, we fetch it from D&D Beyond via our proxy at <code className="text-[12px] px-1.5 py-0.5 rounded bg-surface border border-default">/api/dndbeyond</code>. We do not keep a copy on our servers, we just pass it through. We only do this because dndbeyond.com does not allow you to fetch directly.</p>
          <p><strong className="text-primary">Translate and audio.</strong> When you translate text, you send it directly to Google for translation. We never see it. When you play audio, we send the spell text and language to Google Translate via our proxy <code className="text-[12px] px-1.5 py-0.5 rounded bg-surface border border-default">/api/tts</code>. Similar to dndbeyond.com, this is a technical limitation with Google. No personal info, just the chant text.</p>
          <p><strong className="text-primary">Cloud Backup (optional).</strong> If you click Enable backups, we ask for Discord login only to get an authenticated user id. This allows us to limit who can access your backups to only people who can log in to Discord as you. We store your data in Firestore, a Google managed service.</p>
          <h2 className="text-[16px] font-semibold mt-6 text-primary">Encryption – so we cannot see what we are storing</h2>
          <p>Before anything is uploaded, your browser does a few things using the PIN you select to compress and encrypt your data. Your PIN never leaves this machine. The technical details are that we:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li><code className="text-[12px] px-1.5 py-0.5 rounded bg-surface border border-default">JSON.stringify</code> your characters, language selections, and chants</li>
            <li><code className="text-[12px] px-1.5 py-0.5 rounded bg-surface border border-default">gzip</code> compress with <code className="text-[12px] px-1.5 py-0.5 rounded bg-surface border border-default">pako</code> deflate. This helps keep us in the Firebase free tier.</li>
            <li>Derive a key from your 6-digit PIN with PBKDF2, salt it with your Discord uid (<code className="text-[12px] px-1.5 py-0.5 rounded bg-surface border border-default">discord:123</code>), and do 600,000 iterations of SHA-256 AES-GCM 256, 500 ms per try. We could do tighter encryption, but it would be less accessible.</li>
            <li>Generate a random 12-byte IV, then encrypt the data and <code className="text-[12px] px-1.5 py-0.5 rounded bg-surface border border-default">base64</code> encode it. We store that and the IV locally, then upload it to Firebase.</li>
          </ol>
          <p>The server never sees the PIN or the key. It only sees the IV and the encrypted data. We also record a timestamp, to be safe.</p>
          <p><strong className="text-primary">It is not perfect, but it is private.</strong> A 6-digit PIN has 1,000,000 possibilities. With PBKDF2 600k 500 ms, 1,000,000 tries takes ~5.7 days on a laptop to decrypt. We accept the trade-off because this is D&D data. If somebody wants to go through that effort you and they have bigger problems. If someone gets your device, everything is local, but again you have bigger problems. Please use a different PIN than your bank.</p>
          <p><strong className="text-primary">What if you forget the PIN?</strong>Your backup is gone. Your local data is fine. You can create a new backup with a better PIN.</p>
          <p><strong className="text-primary">Multi-device.</strong> Log in with Discord on device 2, enter same 6-digit PIN, and Restore.</p>
          <p><strong className="text-primary">Delete.</strong> You can Delete cloud backup from the drawer or Disable backups on device. Delete removes your backup from Firestore. Disable removes local key and signs out of Discord, but does not delete the Firestore copy.</p>
        </div>
        <div className="mt-8 pt-6 border-t text-[12px] border-default text-dim"><a href="/" className="underline">Back to Chants</a><span className="mx-2">·</span></div>
      </div>
    </div>
  );
}
