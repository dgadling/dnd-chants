import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const SCHOOL_BY_ID: Record<number, string> = {
  1: "Abjuration", 2: "Conjuration", 3: "Divination", 4: "Enchantment",
  5: "Evocation", 6: "Illusion", 7: "Necromancy", 8: "Transmutation",
};

function normalizeSchool(raw: any): string {
  if (!raw) return "Evocation";
  if (typeof raw === "string") {
    const known = Object.values(SCHOOL_BY_ID);
    if (known.includes(raw)) return raw;
    const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if (known.includes(cap)) return cap;
    const num = Number(raw);
    if (!isNaN(num) && SCHOOL_BY_ID[num]) return SCHOOL_BY_ID[num];
    return "Evocation";
  }
  if (typeof raw === "number" && SCHOOL_BY_ID[raw]) return SCHOOL_BY_ID[raw];
  return "Evocation";
}

function hasVerbal(defn: any): boolean {
  const comps = defn?.components;
  if (Array.isArray(comps)) return comps.includes(1);
  const desc = defn?.componentsDescription;
  if (typeof desc === "string") return desc.includes("V");
  return true;
}

type DdbSpellEntry = { name: string; school: string; level: number };
function collectSpells(char: any): DdbSpellEntry[] {
  const seen = new Set<string>(); const out: DdbSpellEntry[] = [];
  const add = (defn: any) => {
    if (!defn || !hasVerbal(defn)) return;
    const name = (defn.name||"").toString().trim(); if (!name) return;
    if (seen.has(name.toLowerCase())) return; seen.add(name.toLowerCase());
    out.push({ name, school: normalizeSchool(defn.school), level: typeof defn.level==="number"?defn.level:0 });
  };
  if (Array.isArray(char.classSpells)) for (const cs of char.classSpells) if (Array.isArray(cs?.spells)) for (const sp of cs.spells) add(sp?.definition);
  const spellsSection = char.spells;
  if (spellsSection && typeof spellsSection==="object" && !Array.isArray(spellsSection)) for (const k of Object.keys(spellsSection)) if (Array.isArray((spellsSection as any)[k])) for (const sp of (spellsSection as any)[k]) add(sp?.definition);
  if (Array.isArray(spellsSection)) for (const sp of spellsSection) add(sp?.definition||sp);
  out.sort((a,b)=>a.name.localeCompare(b.name)); return out;
}

function extractIdFromRequest(req: any): string|null {
  const rawPath=(req.path as string)||(req.url as string)||""; const q=(req.query?.id as string)||(req.query?.characterId as string);
  if(q && /^\d+$/.test(q)) return q;
  const m1=rawPath.match(/\/api\/dndbeyond\/(\d{5,})/i); if(m1) return m1[1];
  const m2=rawPath.match(/\/(\d{5,})\/?(?:\?.*)?$/); if(m2) return m2[1];
  const m3=rawPath.match(/(\d{5,})/); if(m3) return m3[1]; return null;
}

export const ttsProxy = onRequest({ region:"us-central1", memory:"256MiB", timeoutSeconds:10, concurrency:80, cors:true }, async (req,res)=>{
  if(req.method==="OPTIONS"){ res.status(204).send(""); return; }
  const tlRaw=(req.query?.tl as string)||(req.query?.target as string)||""; const qRaw=(req.query?.q as string)||(req.query?.text as string)||""; const ie=((req.query?.ie as string)||"UTF-8").slice(0,10);
  if(!tlRaw||!qRaw){ res.status(400).json({error:"missing tl or q"}); return; }
  if(!/^[a-z-]{2,10}$/i.test(tlRaw)){ res.status(400).json({error:"invalid tl"}); return; }
  const qTrim=String(qRaw).trim().slice(0,200); if(!qTrim){ res.status(400).json({error:"empty q"}); return; }
  const upstream=`https://translate.googleapis.com/translate_tts?ie=${encodeURIComponent(ie)}&tl=${encodeURIComponent(tlRaw)}&client=gtx&q=${encodeURIComponent(qTrim)}`;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const upstreamRes=await fetch(upstream,{method:"GET",headers:{"Referer":"https://translate.google.com/","User-Agent":"Mozilla/5.0 (compatible; dnd-chants-tts-proxy/1.0)"},signal:controller.signal as any});
    if(!upstreamRes.ok){ const txt=await upstreamRes.text().catch(()=>""); res.status(502).json({error:`tts upstream ${upstreamRes.status}: ${txt.slice(0,200)}`}); return; }
    const buf=Buffer.from(await upstreamRes.arrayBuffer());
    res.set("Content-Type","audio/mpeg"); res.set("Cache-Control","public, max-age=86400, s-maxage=86400"); res.status(200).send(buf);
  }catch(e:any){ const msg=String(e?.message||e); if(msg.includes("aborted")||e?.name==="AbortError"){ res.status(504).json({error:"tts fetch timed out"}); return; } res.status(502).json({error:msg.slice(0,400)}); }finally{ clearTimeout(timer); }
});

export const dndbeyondProxy = onRequest({ region:"us-central1", memory:"256MiB", timeoutSeconds:15, concurrency:40, cors:true }, async (req,res)=>{
  if(req.method==="OPTIONS"){ res.status(204).send(""); return; }
  const charId=extractIdFromRequest(req); if(!charId){ res.status(400).json({error:"missing character id"}); return; }
  if(!/^\d+$/.test(charId)){ res.status(400).json({error:"invalid character id"}); return; }
  const upstream=`https://character-service.dndbeyond.com/character/v5/character/${charId}`;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const upstreamRes=await fetch(upstream,{method:"GET",headers:{"Accept":"application/json","User-Agent":"dnd-chants-firebase-proxy/1.0"},signal:controller.signal as any});
    if(!upstreamRes.ok){ const txt=await upstreamRes.text().catch(()=>"" ); if(upstreamRes.status===404){ res.status(404).json({error:"character not found or private"}); return; } if(upstreamRes.status===403){ res.status(403).json({error:"character is private"}); return; } res.status(502).json({error:`upstream ${upstreamRes.status}: ${txt.slice(0,400)}`}); return; }
    const raw=(await upstreamRes.json()) as any; const char=raw?.data??raw; if(!char||!char.name){ res.status(502).json({error:"unexpected upstream shape"}); return; }
    const spells=collectSpells(char); let lastModifiedISO:string|null=null; const dm=char.dateModified??char.modified??char.updatedAt;
    if(typeof dm==="number"){ const ms=dm>1e12?dm:dm>1e10?dm:dm*1000; try{ lastModifiedISO=new Date(ms).toISOString(); }catch{} }else if(typeof dm==="string"){ try{ lastModifiedISO=new Date(dm).toISOString(); }catch{ lastModifiedISO=dm; } }
    res.set("Cache-Control","public, max-age=60, s-maxage=120");
    res.status(200).json({ characterId:String(char.id??charId), characterName:char.name, spells:spells.map(s=>({name:s.name,school:s.school})), lastModified:lastModifiedISO, fetchTime:new Date().toISOString(), totalSpells:spells.length });
  }catch(e:any){ const msg=String(e?.message||e); if(msg.includes("aborted")||e?.name==="AbortError"){ res.status(504).json({error:"fetch timed out"}); return; } res.status(500).json({error:msg.slice(0,400)}); }finally{ clearTimeout(timer); }
});

const DISCORD_CLIENT_ID=defineSecret("DISCORD_CLIENT_ID");
const DISCORD_CLIENT_SECRET=defineSecret("DISCORD_CLIENT_SECRET");

function getRedirectUri(req:any): string {
  const override=(req.query?.redirect_uri as string)||""; if(override.startsWith("https://chants-506202.web.app")) return override; if(override.startsWith("http://localhost:")) return override;
  return "https://chants-506202.web.app/api/discord-auth/callback";
}

function buildPostMessageHtml(payload:any): string {
  return `<!doctype html><html><body><script>(function(){var payload=${JSON.stringify(payload)};var targetOrigin=window.location.origin;var allowed=["https://chants-506202.web.app","https://chants-506202.firebaseapp.com",targetOrigin];if(window.opener){try{window.opener.postMessage(payload,targetOrigin);}catch(e){}for(var i=0;i<allowed.length;i++){try{if(allowed[i]!==targetOrigin) window.opener.postMessage(payload,allowed[i]);}catch(e){}}}document.body.innerText=payload.type==="discord-auth-error"?"Discord auth failed: "+(payload.error||"unknown")+" – you can close this window.":"Discord login successful – you can close this window.";})();</script></body></html>`;
}

export const discordAuthCallback = onRequest({ region:"us-central1", memory:"256MiB", timeoutSeconds:15, concurrency:40, cors:true, secrets:[DISCORD_CLIENT_ID,DISCORD_CLIENT_SECRET] }, async (req,res)=>{
  if(req.method==="OPTIONS"){ res.status(204).send(""); return; }
  const code=(req.query?.code as string)||""; const state=(req.query?.state as string)||""; const error=(req.query?.error as string)||""; const errorDesc=(req.query?.error_description as string)||"";
  if(error){ logger.warn("discord oauth error",{error,errorDesc}); const html=buildPostMessageHtml({type:"discord-auth-error",error,error_description:errorDesc,state}); res.set("Content-Type","text/html").status(200).send(html); return; }
  if(!code){ res.status(400).json({error:"missing code"}); return; }
  const clientId=DISCORD_CLIENT_ID.value(); const clientSecret=DISCORD_CLIENT_SECRET.value(); if(!clientId||!clientSecret){ res.status(500).json({error:"server misconfigured"}); return; }
  const redirectUri=getRedirectUri(req);
  try{
    const tokenRes=await fetch("https://discord.com/api/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:"authorization_code",code,redirect_uri:redirectUri}).toString()});
    if(!tokenRes.ok){ const txt=await tokenRes.text().catch(()=>"" ); logger.error("discord token exchange failed",{status:tokenRes.status,body:txt.slice(0,500)}); const html=buildPostMessageHtml({type:"discord-auth-error",error:"token_exchange_failed",details:txt.slice(0,200),state}); res.set("Content-Type","text/html").status(200).send(html); return; }
    const tokenJson:any=await tokenRes.json(); const accessToken=tokenJson?.access_token; if(!accessToken){ res.status(502).json({error:"Discord did not return access_token"}); return; }
    const userRes=await fetch("https://discord.com/api/users/@me",{headers:{Authorization:`Bearer ${accessToken}`}}); if(!userRes.ok){ res.status(502).json({error:"Discord user fetch failed"}); return; }
    const discordUser:any=await userRes.json(); const discordId=String(discordUser?.id||""); const discordUsername=String(discordUser?.username||discordUser?.global_name||""); const discordAvatar=discordUser?.avatar?String(discordUser.avatar):null; if(!discordId){ res.status(502).json({error:"Discord user id missing"}); return; }
    const uid=`discord:${discordId}`; const customToken=await admin.auth().createCustomToken(uid,{discordId,discordUsername}); logger.info("discord auth success",{uid,discordUsername});
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Discord auth success</title></head><body style="font-family:system-ui;padding:20px;background:#18181b;color:#e4e4e7"><p>Discord login successful – you can close this window.</p><script>(function(){var payload={type:"discord-auth-success",customToken:${JSON.stringify(customToken)},discordUser:{id:${JSON.stringify(discordId)},username:${JSON.stringify(discordUsername)},avatar:${JSON.stringify(discordAvatar)}},state:${JSON.stringify(state)}};try{if(window.opener){var targetOrigin=window.location.origin;var allowed=["https://chants-506202.web.app","https://chants-506202.firebaseapp.com",targetOrigin];try{window.opener.postMessage(payload,targetOrigin);}catch(e){}for(var i=0;i<allowed.length;i++){try{if(allowed[i]!==targetOrigin) window.opener.postMessage(payload,allowed[i]);}catch(e){}}}try{localStorage.setItem("dnd-chant-discord-callback",JSON.stringify(payload));}catch(e){}setTimeout(function(){window.close();},500);setTimeout(function(){if(!window.opener){window.location.href="/?discord_auth=success";}},800);}catch(e){document.body.innerHTML+="<pre>"+String(e)+"</pre>";}})();</script></body></html>`;
    res.set("Content-Type","text/html").status(200).send(html);
  }catch(e:any){ logger.error("discord callback exception",{err:String(e?.message||e)}); res.status(500).json({error:String(e?.message||e).slice(0,400)}); }
});

export const backup = onRequest({ region:"us-central1", memory:"256MiB", timeoutSeconds:10, concurrency:40, cors:true }, async (req,res)=>{
  if(req.method==="OPTIONS"){ res.status(204).send(""); return; }
  const authHeader=(req.headers?.authorization as string)||""; const idToken=authHeader.startsWith("Bearer ")?authHeader.slice(7):""; if(!idToken){ res.status(401).json({error:"missing Authorization Bearer token"}); return; }
  let decoded:any; try{ decoded=await admin.auth().verifyIdToken(idToken); }catch(e:any){ res.status(401).json({error:"invalid or expired ID token"}); return; }
  const uid=String(decoded?.uid||""); if(!uid){ res.status(401).json({error:"invalid token – no uid"}); return; }
  const db=admin.firestore(); const docRef=db.collection("backups").doc(uid);
  if(req.method==="GET"){ try{ const snap=await docRef.get(); if(!snap.exists){ res.status(404).json({exists:false}); return; } const data=snap.data(); res.status(200).json({exists:true,iv:data?.iv||null,ciphertext:data?.ciphertext||null,updatedAt:data?.updatedAt||null}); }catch(e:any){ res.status(500).json({error:"backup GET failed"}); } return; }
  if(req.method==="PUT"){ let body:any={}; try{ body=typeof req.body==="object"?req.body:JSON.parse(req.body||"{}"); }catch{ res.status(400).json({error:"invalid JSON body"}); return; } const iv=typeof body?.iv==="string"?body.iv:""; const ciphertext=typeof body?.ciphertext==="string"?body.ciphertext:""; const updatedAt=typeof body?.updatedAt==="number"?body.updatedAt:Date.now(); if(!iv||!ciphertext){ res.status(400).json({error:"missing iv or ciphertext"}); return; } try{ await docRef.set({iv,ciphertext,updatedAt},{merge:false}); res.status(200).json({ok:true,updatedAt}); }catch(e:any){ res.status(500).json({error:"backup PUT failed"}); } return; }
  if(req.method==="DELETE"){ try{ await docRef.delete(); res.status(200).json({ok:true}); }catch(e:any){ res.status(500).json({error:"backup DELETE failed"}); } return; }
  res.status(405).json({error:"method not allowed"});
});
