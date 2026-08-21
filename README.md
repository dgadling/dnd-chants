# dnd-chants

Generic D&D chant lab – no static spell list. Spells are generated per-character when linking D&D Beyond sheets.

## Stack
- Next.js 14 App Router + TS + Tailwind
- Pages: `/` lab (empty until D&D Beyond linked), `/api/health`, `/api/translate`, `/api/tts`
- `lib/lang.ts` 111 languages + TTS mapping, generic (no school→language defaults)
- Translate: Google translate single API (gtx) primary 3s abort, v2 fallback, romanization from seg[2]
- TTS: Google translate_tts proxy
- DesktopRow / MobileCard with audio 🔊 and idiom 💬

## Local dev

```bash
cp .env.example .env.local
# edit GOOGLE_TRANSLATE_API_KEY
bun install
bun run dev
# http://localhost:3000
```

Build:

```bash
bun run build
bun run start -p 8080
```

## Env

`.env.example`:
```
GOOGLE_TRANSLATE_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`GOOGLE_TRANSLATE_API_KEY` optional – without it app uses gtx primary.

## Pages

- `/` generic – no static spells. Shows "No spells yet – link your D&D Beyond character". Future: D&D Beyond linking will populate spells by school, per-character. Each spell has chant box native [roman], language selector, translate, audio 🔊, idiom 💬, save to localStorage
- `/api/health` `{ok:true}`
- `/api/translate` POST `{text, source, target}` gtx + v2 fallback
- `/api/tts` GET `?text=&target=` audio/mpeg

## Idiom search

`idiom in ${langName} for "${englishTry}"` → `window.open('https://www.google.com/search?q='+...)`

## Future: D&D Beyond linking

- Paste D&D Beyond URL or upload JSON
- Parse raw JSON for spell list
- Intersect with verbal-only spells, populate per-school tabs
- No raw DDB JSON stored in repo, only spell names per user session
- Chant data keyed by spell name + lang, stored per user (localStorage now, DB later after Discord auth)

## Files

- `app/globals.css`, `tailwind.config.js`, `tsconfig.json`
- `Dockerfile` oven/bun:1.3 multi-stage
- `cloudbuild.yaml` Artifact Registry us-central1-docker.pkg.dev/chants-506202/dnd-chants/dnd-chants

## License
See LICENSE.
