# dnd-chants — Chant Lab Option A

Local Next.js 14 public chant lab, idiom 💬 button (Option A).

## Stack
- Next.js 14 App Router + TS + Tailwind minimal
- Pages: `/` (lab), `/s/[slug]` public share stub, `/api/health`, `/api/translate`, `/api/tts`
- `src/data/spells.json` from original lab
- `lib/lang.ts` 104 LANG_OPTIONS + TTS_LANG_MAP + SCHOOL_DEFAULTS (Abj iw, Conj is, Div hi, Ench it, Evo ru, Ill ar, Nec la, Trans de)
- `lib/transliterate.ts` transliterateRu/Hi/He/Ar + localTransliterate
- Translate: gtx primary 3s abort, parse native+roman (prefer seg[2] distinct latin over seg[3]), fallback v2, roman local
- TTS: Google translate_tts proxy, audio/mpeg stream, caching headers, in-mem cache
- DesktopRow / MobileCard with 🔊 audio and 💬 idiom button

## Local dev

Copy env:

```bash
cp .env.example .env.local
# edit GOOGLE_TRANSLATE_API_KEY
```

Install and run:

```bash
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

`.env.example` lists:

```
GOOGLE_TRANSLATE_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`GOOGLE_TRANSLATE_API_KEY` is optional for local – without it the app falls back to gtx + local tables.

## Pages

- `/` lab main: groups spells by SCHOOLS sorted Jex first, language selector per school, try input, translate button, result box parseBox/formatBox, audio 🔊, idiom 💬, save to localStorage stub
- `/s/[slug]` public share stub
- `/api/health` returns `{ok:true}`
- `/api/translate` POST `{text, source, target}` gtx + v2 fallback + local transliterate, in-mem Map cache
- `/api/tts` GET `?text=&target=` fetch gtx tts 5s timeout, stream audio/mpeg with caching headers

## Idiom 💬 Option A

Query `idiom in ${langName} for "${englishTry}"` → `window.open('https://www.google.com/search?q='+encodeURIComponent(query), '_blank')`

## Files

- `app/globals.css` CSS vars --bg --surface --border --text --dim
- `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`
- `Dockerfile` bun-based reference
- `.env.example`

## License

See LICENSE.
