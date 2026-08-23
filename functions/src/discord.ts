import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { safeJson } from "./lib/safeJson";

if (!admin.apps.length) admin.initializeApp();

const DISCORD_CLIENT_ID = defineSecret("DISCORD_CLIENT_ID");
const DISCORD_CLIENT_SECRET = defineSecret("DISCORD_CLIENT_SECRET");

function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === "https://chants-506202.web.app") return true;
  if (origin === "https://chants-506202.firebaseapp.com") return true;
  if (origin === "http://localhost:3000") return true;
  if (origin === "http://127.0.0.1:3000") return true;
  try {
    const u = new URL(origin);
    if (u.hostname.startsWith("chants-506202--") && (u.hostname.endsWith(".web.app") || u.hostname.endsWith(".firebaseapp.com"))) return true;
  } catch {}
  return false;
}

function getRedirectUri(req: any): string {
  const override = (req.query?.redirect_uri as string) || "";
  if (override) {
    try {
      const u = new URL(override);
      // Only allow prod + localhost – preview channels must use prod redirect_uri
      // so Discord (which only whitelists prod) accepts it. The callback page
      // then postMessages to the preview opener via "*" fallback.
      if (
        u.hostname === "chants-506202.web.app" ||
        u.hostname === "chants-506202.firebaseapp.com" ||
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname.startsWith("chants-506202--")
      )
        return override;
    } catch {}
  }
  return "https://chants-506202.web.app/api/discord-auth/callback";
}

function buildPostMessageHtml(payload: any): string {
  return `<!doctype html><html><body><script>(function(){var payload=${safeJson(
    payload
  )};var targetOrigin=window.location.origin;var allowed=["https://chants-506202.web.app","https://chants-506202.firebaseapp.com",targetOrigin];var openerOrigin="";try{if(window.opener){try{openerOrigin=window.opener.location.origin;}catch(e){}}}catch(e){}if(openerOrigin){try{allowed.push(openerOrigin);}catch(e){}}try{window.opener.postMessage(payload,openerOrigin);}catch(e){}try{window.opener.postMessage(payload,"*");}catch(e){}}if(window.opener){try{window.opener.postMessage(payload,targetOrigin);}catch(e){}for(var i=0;i<allowed.length;i++){try{if(allowed[i]!==targetOrigin) window.opener.postMessage(payload,allowed[i]);}catch(e){}}}document.body.innerText=payload.type==="discord-auth-error"?"Discord auth failed: "+(payload.error||"unknown")+" – you can close this window.":"Discord login successful – you can close this window.";})();</script></body></html>`;
}

export const discordAuthCallback = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 15,
    concurrency: 40,
    cors: false,
    secrets: [DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET],
  },
  async (req, res) => {
    const origin = (req.headers?.origin as string) || "";
    if (isAllowedCorsOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    const code = (req.query?.code as string) || "";
    const state = (req.query?.state as string) || "";
    const error = (req.query?.error as string) || "";
    const errorDesc = (req.query?.error_description as string) || "";
    if (error) {
      logger.warn("discord oauth error", { error, errorDesc });
      const html = buildPostMessageHtml({
        type: "discord-auth-error",
        error,
        error_description: errorDesc,
        state,
      });
      res.set("Content-Type", "text/html").status(200).send(html);
      return;
    }
    if (!code) {
      res.status(400).json({ error: "missing code" });
      return;
    }
    const clientId = DISCORD_CLIENT_ID.value();
    const clientSecret = DISCORD_CLIENT_SECRET.value();
    if (!clientId || !clientSecret) {
      res.status(500).json({ error: "server misconfigured" });
      return;
    }
    const redirectUri = getRedirectUri(req);
    try {
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });
      if (!tokenRes.ok) {
        const txt = await tokenRes.text().catch(() => "");
        logger.error("discord token exchange failed", {
          status: tokenRes.status,
          body: txt.slice(0, 500),
        });
        const html = buildPostMessageHtml({
          type: "discord-auth-error",
          error: "token_exchange_failed",
          details: txt.slice(0, 200),
          state,
        });
        res.set("Content-Type", "text/html").status(200).send(html);
        return;
      }
      const tokenJson: any = await tokenRes.json();
      const accessToken = tokenJson?.access_token;
      if (!accessToken) {
        res.status(502).json({ error: "Discord did not return access_token" });
        return;
      }
      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) {
        res.status(502).json({ error: "Discord user fetch failed" });
        return;
      }
      const discordUser: any = await userRes.json();
      const discordId = String(discordUser?.id || "");
      const discordUsername = String(discordUser?.username || discordUser?.global_name || "");
      const discordAvatar = discordUser?.avatar ? String(discordUser.avatar) : null;
      if (!discordId) {
        res.status(502).json({ error: "Discord user id missing" });
        return;
      }
      const uid = `discord:${discordId}`;
      const customToken = await admin.auth().createCustomToken(uid, {
        discordId,
        discordUsername,
        discordAvatar,
      });
      logger.info("discord auth success", { uid, discordUsername });
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Discord auth success</title></head><body style="font-family:system-ui;padding:20px;background:#18181b;color:#e4e4e7"><p>Discord login successful – you can close this window.</p><script>(function(){var payload={type:"discord-auth-success",customToken:${safeJson(
        customToken
      )},discordUser:{id:${safeJson(discordId)},username:${safeJson(
        discordUsername
      )},avatar:${safeJson(discordAvatar)}},state:${safeJson(
        state
      )}};try{if(window.opener){var targetOrigin=window.location.origin;var allowed=["https://chants-506202.web.app","https://chants-506202.firebaseapp.com",targetOrigin];try{window.opener.postMessage(payload,targetOrigin);}catch(e){}for(var i=0;i<allowed.length;i++){try{if(allowed[i]!==targetOrigin) window.opener.postMessage(payload,allowed[i]);}catch(e){}}}try{localStorage.setItem("dnd-chant-discord-callback",JSON.stringify(payload));}catch(e){}setTimeout(function(){window.close();},500);setTimeout(function(){if(!window.opener){window.location.href="/?discord_auth=success";}},800);}catch(e){document.body.innerHTML+="<pre>"+String(e)+"</pre>";}})();</script></body></html>`;
      res.set("Content-Type", "text/html").status(200).send(html);
    } catch (e: any) {
      logger.error("discord callback exception", { err: String(e?.message || e) });
      res.status(500).json({ error: String(e?.message || e).slice(0, 400) });
    }
  }
);
