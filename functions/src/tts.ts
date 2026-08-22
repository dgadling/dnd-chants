import { onRequest } from "firebase-functions/v2/https";

export const ttsProxy = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 10,
    concurrency: 80,
    cors: [
      "https://chants-506202.web.app",
      "https://chants-506202.firebaseapp.com",
      "http://localhost:3000",
    ],
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    const tlRaw = (req.query?.tl as string) || (req.query?.target as string) || "";
    const qRaw = (req.query?.q as string) || (req.query?.text as string) || "";
    const ie = ((req.query?.ie as string) || "UTF-8").slice(0, 10);
    if (!tlRaw || !qRaw) {
      res.status(400).json({ error: "missing tl or q" });
      return;
    }
    if (!/^[a-z-]{2,10}$/i.test(tlRaw)) {
      res.status(400).json({ error: "invalid tl" });
      return;
    }
    const qTrim = String(qRaw).trim().slice(0, 200);
    if (!qTrim) {
      res.status(400).json({ error: "empty q" });
      return;
    }
    const upstream = `https://translate.googleapis.com/translate_tts?ie=${encodeURIComponent(
      ie
    )}&tl=${encodeURIComponent(tlRaw)}&client=gtx&q=${encodeURIComponent(qTrim)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const upstreamRes = await fetch(upstream, {
        method: "GET",
        headers: {
          Referer: "https://translate.google.com/",
          "User-Agent": "Mozilla/5.0 (compatible; dnd-chants-tts-proxy/1.0)",
        },
        signal: controller.signal as any,
      });
      if (!upstreamRes.ok) {
        const txt = await upstreamRes.text().catch(() => "");
        res.status(502).json({ error: `tts upstream ${upstreamRes.status}: ${txt.slice(0, 200)}` });
        return;
      }
      const buf = Buffer.from(await upstreamRes.arrayBuffer());
      res.set("Content-Type", "audio/mpeg");
      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.status(200).send(buf);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("aborted") || e?.name === "AbortError") {
        res.status(504).json({ error: "tts fetch timed out" });
        return;
      }
      res.status(502).json({ error: msg.slice(0, 400) });
    } finally {
      clearTimeout(timer);
    }
  }
);
