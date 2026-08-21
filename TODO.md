# TODO – dnd-chants remaining work

This file tracks meaningful chunks of work left, excluding deployment steps. All local-only.

## Deferred Auth

- Discord OAuth2 disabled for now (removed from .env.example and README). To re-add later:
  - Create Discord app, collect CLIENT_ID / CLIENT_SECRET / REDIRECT_URI
  - Generate FERNET key and SESSION_SECRET (python secrets.token_urlsafe)
  - Implement Next.js routes `app/api/auth/discord/*` with fail-closed env checks
  - Store secrets in Secret Manager, env vars via --set-env-vars
  - Add UI login button and session handling
- Current hooks simplified to commit-msg only – no auth bypass guard needed while auth disabled

## Spell Management (deferred)

- Spell count test deferred – handle spell management later (explicit user request: do not test 117 spells now)
- Current `src/data/spells.json` contains 117 verbals filtered, but management is static
- Future:
  - Source of truth: raw D&D Beyond JSONs vs curated list
  - Filtering logic: verbal component V only, school mapping, Jex-known flag
  - Admin UI or script to add/remove spells without hand-editing JSON
  - Validation: school is one of SCHOOLS, name uniqueness, chant fields present
  - Migration path if spell list changes (localStorage extras keyed by name)
- Note: Do not add spell count assertion until spell management design finalized

## Tests (TDD)

- No tests yet – pre-commit / pre-push simplified to exit 0, only commit-msg enforced
- Need to introduce vitest and follow TDD:
  - `test(lang):` getLangName, LANG_OPTIONS length 104, SCHOOL_DEFAULTS coverage, TTS_LANG_MAP
  - `test(transliterate):` ru/hi/he/iw/ar local tables, fallback behavior
  - `test(api-translate):` cache Map MAX 500, gtx primary parsing seg[2] vs seg[3], v2 fallback, 3s abort
  - `test(api-tts):` translate_tts proxy 5s timeout, mem cache MAX 100, mime audio/mpeg, caching headers
  - `test(ui):` formatBox / parseBox native [roman] single-box editable, idiom query builder `idiom in ${langName} for "${englishTry}"`
  - `test(save):` localStorage extras v1 key `dnd-chant-extras-v1`, RowExtra shape box/targetLang/saving/status
  - Guard: fail-closed env checks for GOOGLE_TRANSLATE_API_KEY optional fallback
- Once tests exist, re-enable pre-commit to run `bun run lint` + `bun run test` + `bun run build` (not npm, not ruff/pytest)
- CI workflow `.github/workflows/ci.yml` currently references backend/frontend dirs that don't exist – needs rewrite for this repo (bun only)

## UI Polish

- Idiom search Option A done: 💬 button opens `window.open('https://www.google.com/search?q='+encodeURIComponent(...))` – no iframe (X-Frame-Options DENY)
- Width col already 96→132 to hold 🔊 💬 💾 – verify no layout shift on save
- DesktopRow / MobileCard: ensure editable textbox single native [roman] formatBox() parse regex, bracket same color, label Name(code), mobile In <language>
- Mobile 44px buttons – verify unchanged after recent changes
- LocalStorage save MVP works but:
  - No sync to server / DB yet – save persists only per browser
  - No share URL generation for saved set
  - No delete/clear UI for extras
- Audio: Google TTS proxy works, but need to verify caching chain mem → IDB `jex-chant-audio` → server `tts_cache` → Google translate_tts he→iw 5s base64 fallback speechSynthesis (from private lab) – currently only mem cache in this repo
- Save button tooltip status idle/saving/✓ saved/failed – ensure no shared Maps+deleteChant regression

## Data / Translate

- Translate route: gtx primary `dt=t&dt=rm` 3s abort, cache first, fallback v2 with GOOGLE_TRANSLATE_API_KEY env, local transliterate fallback – done, but no tests
- TTS route: caching headers, in-mem cache – done, but no IDB or server cache yet
- LANG_OPTIONS 104 – need to verify all codes have getLangName and TTS voice mapping
- SCHOOL_DEFAULTS: Abj iw, Conj is, Div hi, Ench it, Evo ru, Ill ar, Nec la, Trans de – currently in lib/lang.ts, needs test
- Shield `iw` roman fix (prefer seg[2] `megen` over seg[3] `SHēld`) implemented in original lab – ensure ported to this route's parser
- Verbal filter 117 spells – Abj 13 Conj 21 Div 11 Ench 14 Evoc 31 Ill 6 Nec 7 Trans 14 – static for now, management deferred

## D&D Beyond Linking (future)

- Original proposal: link to dndbeyond character sheets and pull list of spells
- Deferred – needs:
  - DDB parsing using `dndbeyond-parser.py` pattern (raw JSON source of truth)
  - UI to paste DDB link / upload JSON, filter to verbal only, mark Jex-known ★ first
  - Privacy: don't store raw DDB JSON in repo

## Sharing / Publishing (future)

- Original proposal: sharing/publishing
- Current: localStorage only, `/s/[slug]` stub says shared set
- Future:
  - DB table `chants` id,spell_name,school,lang_code,english_phrase,translated,romanized,created_at,updated_at (from 2026-08-18 schema)
  - `translation_cache` source,target,original_text,translated,romanized,target_used,created_at
  - `tts_cache` id,target,original_text,audio_base64,mime,target_used,created_at
  - Public slug generation, owner check, read-only share page
  - No markdown reports unless explicitly asked (per USER.md)

## Other

- bun-only: ensure no npm remains in Dockerfile (now fixed to oven/bun:1.1), cloudbuild.yaml reference kept as PROJECT_ID example only, README now bun-only
- Hooks: only commit-msg style `^(fix|feat|chore|docs|style|refactor|perf|test|build|ci|revert)(\([a-z0-9._-]+\))?!?:.+` enforced
- Build green locally with `bun run build` – verified after next.config.js cleanup (removed ignoreBuildErrors and outputFileTracing)
- No push to origin yet – hold until OK, no gcloud execution per user stop
