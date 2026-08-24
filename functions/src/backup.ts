import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { isAllowedCorsOrigin } from "./lib/isAllowedOrigin";

if (!admin.apps.length) admin.initializeApp();

export const backup = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 10,
    concurrency: 40,
    cors: false,
  },
  async (req, res) => {
    const origin = (req.headers?.origin as string) || "";
    if (isAllowedCorsOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (origin && !isAllowedCorsOrigin(origin)) {
      res.status(403).json({ error: "origin not allowed" });
      return;
    }
    const authHeader = (req.headers?.authorization as string) || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) {
      res.status(401).json({ error: "missing Authorization Bearer token" });
      return;
    }
    let decoded: any;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(401).json({ error: "invalid or expired ID token" });
      return;
    }
    const uid = String(decoded?.uid || "");
    if (!uid) {
      res.status(401).json({ error: "invalid token – no uid" });
      return;
    }
    const db = admin.firestore();
    const docRef = db.collection("backups").doc(uid);

    if (req.method === "GET") {
      try {
        const snap = await docRef.get();
        if (!snap.exists) {
          res.status(404).json({ exists: false });
          return;
        }
        const data = snap.data();
        let ua: any = data?.updatedAt || null;
        try {
          if (ua && typeof ua.toMillis === "function") ua = ua.toMillis();
          else if (ua && typeof ua._seconds === "number") ua = ua._seconds * 1000;
        } catch {}
        res.status(200).json({
          exists: true,
          iv: data?.iv || null,
          ciphertext: data?.ciphertext || null,
          updatedAt: ua,
        });
      } catch {
        res.status(500).json({ error: "backup GET failed" });
      }
      return;
    }

    if (req.method === "PUT") {
      let body: any = {};
      try {
        body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
      } catch {
        res.status(400).json({ error: "invalid JSON body" });
        return;
      }
      const iv = typeof body?.iv === "string" ? body.iv : "";
      const ciphertext = typeof body?.ciphertext === "string" ? body.ciphertext : "";
      if (!iv || !ciphertext) {
        res.status(400).json({ error: "missing iv or ciphertext" });
        return;
      }
      // --- validation: IV fixed length, ciphertext limit, base64 ---
      if (iv.length > 50) {
        res.status(400).json({ error: "invalid iv length" });
        return;
      }
      if (/\s/.test(iv)) {
        res.status(400).json({ error: "iv contains whitespace" });
        return;
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(iv)) {
        res.status(400).json({ error: "iv not valid base64" });
        return;
      }
      let ivBuf: Buffer;
      try {
        ivBuf = Buffer.from(iv, "base64");
      } catch {
        res.status(400).json({ error: "iv not valid base64" });
        return;
      }
      if (ivBuf.length !== 12) {
        res.status(400).json({ error: `invalid iv length: expected 12 bytes got ${ivBuf.length}` });
        return;
      }
      if (ciphertext.length > 800_000) {
        res.status(413).json({ error: `ciphertext too large: ${ciphertext.length} > 800000` });
        return;
      }
      if (/\s/.test(ciphertext)) {
        res.status(400).json({ error: "ciphertext contains whitespace" });
        return;
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext)) {
        res.status(400).json({ error: "ciphertext not valid base64" });
        return;
      }
      try {
        const ctBuf = Buffer.from(ciphertext, "base64");
        if (ctBuf.length === 0) {
          res.status(400).json({ error: "ciphertext empty after base64 decode" });
          return;
        }
      } catch {
        res.status(400).json({ error: "ciphertext not valid base64" });
        return;
      }
      try {
        await docRef.set(
          { iv, ciphertext, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: false }
        );
        const nowMs = Date.now();
        res.status(200).json({ ok: true, updatedAt: nowMs });
      } catch {
        res.status(500).json({ error: "backup PUT failed" });
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await docRef.delete();
        res.status(200).json({ ok: true });
      } catch {
        res.status(500).json({ error: "backup DELETE failed" });
      }
      return;
    }

    res.status(405).json({ error: "method not allowed" });
  }
);
