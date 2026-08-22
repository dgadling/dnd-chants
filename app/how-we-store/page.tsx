export default function HowWeStore() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 antialiased">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
        <a href="/" className="text-[13px] text-zinc-400 hover:text-zinc-200 underline">← Back to Chants</a>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">How we store your data</h1>
        <div className="mt-6 space-y-4 text-[14px] leading-relaxed text-zinc-300">
          <p><strong className="text-zinc-100">Local first.</strong> Everything you type and your characters live in your browser (localStorage and IndexedDB). We do not have accounts or servers storing your stuff unless you enable Cloud Backup.</p>
          <p><strong className="text-zinc-100">D&D Beyond fetch.</strong> When you add a character, we fetch it from D&D Beyond via our proxy at <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">/api/dndbeyond</code>. We do not keep a copy on our servers, we just pass it through.</p>
          <p><strong className="text-zinc-100">Translate and audio.</strong> When you translate or play audio, we send the spell text and language to Google Translate via our proxy <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">/api/tts</code> and <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">translate.googleapis.com</code>. No personal info, just the chant text.</p>
          <p><strong className="text-zinc-100">Cloud Backup (optional).</strong> If you click Enable backups, we ask for Discord login only to get a stable id so only you can fetch your backup. We store one blob in Firestore at <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">backups/discord:{"{yourId}"}</code>.</p>
          <h2 className="text-[16px] font-semibold text-zinc-100 mt-6">Encryption – so we cannot see what we are storing</h2>
          <p>Before upload, the browser does:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>JSON.stringify your characters, languages, and chants</li>
            <li>gzip compress with pako deflate (smaller blob)</li>
            <li>Derive key from your 6-digit PIN with PBKDF2, salt = your Discord uid (<code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">discord:123</code>), 600,000 iterations SHA-256 AES-GCM 256, 500 ms per try stronger than 100k 100 ms, ideal would be Argon2id memory-hard GPU resistant but webpack ESM issue with Next.js 14</li>
            <li>Generate random 12-byte IV, encrypt, store IV + ciphertext as base64</li>
          </ol>
          <p>The server never sees the PIN or the key. It only sees <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">iv</code> and <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">ciphertext</code> and <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">updatedAt</code>.</p>
          <p><strong className="text-zinc-100">It is not perfect, but it is private.</strong> A 6-digit PIN is 1,000,000 possibilities. With PBKDF2 600k 500 ms, 1M tries is ~5.7 days on a laptop, vs PBKDF2 100k 27 hours. GPU can be 100x faster ~1.3 hours, but we accept trade-off because this is D&D data not financial. Argon2id 500 ms memory-hard would be 5.7 days GPU resistant ideal, but Next.js webpack ESM issue prevents libsodium-wrappers. If someone gets your device, derived key is in localStorage (<code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">dnd-chant-backup-key</code>) and they can read it. XSS could also steal it. Use different PIN than bank.</p>
          <p><strong className="text-zinc-100">What if you forget the PIN?</strong> Backup unreadable without it. No recovery. You can still use local data and create new backup with new PIN (overwrites old blob).</p>
          <p><strong className="text-zinc-100">Multi-device.</strong> Log in with Discord on device 2, enter same 6-digit PIN, and Restore. Key derived same way PIN+uid, so device 2 can decrypt what device 1 uploaded. Change PIN cheap: re-derive key and re-upload, no need re-encrypt with old key.</p>
          <p><strong className="text-zinc-100">What we log.</strong> Cloud Functions logs only uid, method, timestamp. No spell text, no PIN, no key. Firestore rules allow read/write only if <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">request.auth.uid == userId</code> and <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">userId</code> is <code className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded">discord:{"{id}"}</code>.</p>
          <p><strong className="text-zinc-100">Delete.</strong> You can Delete cloud backup from drawer or Disable backups on device. Delete removes Firestore doc. Disable removes local key and signs out but does not delete cloud copy unless you click Delete cloud.</p>
        </div>
        <div className="mt-8 pt-6 border-t border-zinc-800 text-[12px] text-zinc-500"><a href="/" className="underline hover:text-zinc-300">Back to Chants</a><span className="mx-2">·</span><span>Everything is saved locally unless you enable backup.</span></div>
      </div>
    </div>
  );
}
