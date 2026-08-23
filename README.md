# dnd-chants

dnd-chants is a web app where you link your D&D Beyond characters and write a short spoken chant for each spell in 104 languages.

## What it does

You get your spells grouped by school and you write a chant for each one. You can translate it, hear how it sounds, and look up idioms when you are stuck. Everything lives in your browser by default. If you want it on another device you can turn on encrypted cloud backup.

## How to use it

Paste a D&D Beyond link like `https://www.dndbeyond.com/characters/12345678` or just the id `12345678` in Add Character. Your characters show up in the left sidebar on desktop and as an overlay on mobile. Each row shows the name and how many spells it has and a link back to D&D Beyond. Click a row to switch characters. The active one expands to show when it was fetched and when the sheet changed, plus a Refresh button.

Pills across the top show schools and how many spells are in each. Empty schools look dimmed but you can still click them. If you have no characters yet all pills look dimmed.

Each school has a language picker. Each spell has translate and audio buttons and an editable box that looks like `native [pronunciation]`. That is the spell text in another language with how it sounds in brackets, like Hebrew with English letters. For example `שלום [shalom]`. The app saves automatically in this browser as you type.

Until you add a character sheet you'll see a short tutorial. The first time you visit you also get a welcome modal. You can pick Auto, Light, or Dark for appearance.

## Backup / restore

Discord is only used to log you in. We cannot see your messages or servers or anything like that. You pick a 6-digit PIN and the app encrypts everything before it ever leaves your browser. The server only ever sees encrypted data and can't read your chants.

The drawer shows your last action like Backed up or Restored with the size and the local time.

You can disable backups or delete the cloud copy from the drawer.
