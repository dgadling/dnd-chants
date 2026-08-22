// Plain Worker for PBKDF2 600k – off main thread to avoid 500ms freeze
self.onmessage = async (e: MessageEvent<{ pin: string; salt: string }>) => {
  try {
    const { pin, salt } = e.data;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(pin) as unknown as BufferSource,
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(salt) as unknown as BufferSource,
        iterations: 600000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const raw = await crypto.subtle.exportKey("raw", key);
    (self as any).postMessage({ raw }, [raw]);
  } catch (err: any) {
    (self as any).postMessage({ error: err?.message || String(err) });
  }
};

export {};
