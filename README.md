# dnd-chants — GCP Chant Lab Option A

GCP-hosted Next.js 14 public chant lab, idiom 💬 button (Option A).

## Stack
- Next.js 14 App Router + TS + Tailwind minimal
- Pages: `/` (lab), `/s/[slug]` public share stub, `/api/health`, `/api/translate`, `/api/tts`
- `src/data/spells.json` from original lab
- `lib/lang.ts` 104 LANG_OPTIONS + TTS_LANG_MAP + SCHOOL_DEFAULTS (Abj iw, Conj is, Div hi, Ench it, Evo ru, Ill ar, Nec la, Trans de)
- `lib/transliterate.ts` transliterateRu/Hi/He/Ar + localTransliterate
- Translate: gtx primary 3s abort, parse native+roman (prefer seg[2] distinct latin over seg[3]), fallback v2, roman local
- TTS: Google translate_tts proxy, audio/mpeg stream, caching headers, in-mem cache, /tmp audio cache simple
- DesktopRow / MobileCard with 🔊 audio and 💬 idiom button

## Setup

### 0. Owner adds collaborator hatchlet
GitHub repo → Settings → Collaborators → Add people → `hatchlet` → Write access.

This allows `hatchlet` user to push initial scaffold and future changes (`git config user.name hatchlet`).

### 1. Env vars (Secret Manager)
Create secrets:
```bash
gcloud secrets create GOOGLE_TRANSLATE_API_KEY --data-file=<(echo -n "YOUR_KEY")
gcloud secrets create NEXT_PUBLIC_APP_URL --data-file=<(echo -n "https://your-run-url")
# optional discord
gcloud secrets create DISCORD_CLIENT_ID --data-file=<(echo -n "...")
gcloud secrets create DISCORD_CLIENT_SECRET --data-file=<(echo -n "...")
```
Grant Cloud Build SA `Secret Manager Secret Accessor`.

`.env.example` lists:
```
GOOGLE_TRANSLATE_API_KEY=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

Local dev:
```bash
cp .env.example .env.local
# edit values
npm install
npm run dev
# http://localhost:3000
```

### 2. Deploy to Cloud Run
Multi-stage Dockerfile (node:20-slim builder `npm ci && npm run build`, runner `node:20-slim` `next start PORT 8080`).

```bash
# via Cloud Build
gcloud builds submit --config cloudbuild.yaml .

# manual
gcloud builds submit -t gcr.io/$PROJECT_ID/dnd-chants:latest .
gcloud run deploy dnd-chants \
  --image gcr.io/$PROJECT_ID/dnd-chants:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-secrets=GOOGLE_TRANSLATE_API_KEY=GOOGLE_TRANSLATE_API_KEY:latest,NEXT_PUBLIC_APP_URL=NEXT_PUBLIC_APP_URL:latest
```

`cloudbuild.yaml` placeholder wires secrets `GOOGLE_TRANSLATE_API_KEY`, `NEXT_PUBLIC_APP_URL`.

### 3. Pages
- `/` lab main: groups spells by SCHOOLS sorted Jex first, language selector per school, try input, translate button, result box parseBox/formatBox, audio 🔊, idiom 💬, save to localStorage stub
- `/s/[slug]` public share stub says shared set
- `/api/health` returns `{ok:true}`
- `/api/translate` POST `{text, source, target}` gtx + v2 fallback + local transliterate, in-mem Map cache source|target|original lower
- `/api/tts` GET `?text=&target=` fetch gtx tts 5s timeout, stream audio/mpeg with caching headers

### Idiom 💬 Option A
Query `idiom in ${langName} for "${englishTry}"` → `window.open('https://www.google.com/search?q='+encodeURIComponent(query), '_blank')`

### Files
- `app/globals.css` CSS vars --bg --surface --border --text --dim
- `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`
- `Dockerfile` Cloud Run ready
- `.env.example`

## License
See LICENSE.
