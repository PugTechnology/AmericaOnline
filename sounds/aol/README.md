# AOL voice clips (drop-in)

The simulator can play the genuine AOL voice lines, but **the audio files are not bundled** with this project. They are AOL's recordings, and we have not been able to check that they are free to redistribute. Add your own copies here and they are picked up automatically. Without them, the simulator falls back to your browser's speech engine (or, for the IM and door sounds, to its built-in synthesized sounds).

## Filenames

Put files directly in this folder (`sounds/aol/`). For each name, the simulator tries `.mp3` first, then `.wav`, then `.ogg`, and uses the first one that loads.

| File name (without extension) | Plays when | Fallback if missing |
| --- | --- | --- |
| `welcome` | You finish signing on: "Welcome!" | Speech: "Welcome!" |
| `youve-got-mail` | You have unread mail at sign-on, or new mail arrives: "You've got mail!" | Speech: "You've got mail!" |
| `goodbye` | You sign off, or are disconnected for being idle: "Goodbye!" | Speech: "Goodbye!" |
| `files-done` | A download finishes: "File's done!" | Speech: "File's done!" |
| `im` | An Instant Message arrives (the "bing") | Synthesized IM chime |
| `buddy-in` | A buddy signs on (door opens) | Synthesized door opening |
| `buddy-out` | A buddy signs off (door closes) | Synthesized door closing |

"You've got pictures" is not wired to anything yet, but `Sound.clip('youve-got-pictures', "You've got pictures!")` will pick up `youve-got-pictures.mp3` if you want to use it.

Example: `sounds/aol/welcome.mp3`, `sounds/aol/youve-got-mail.wav`, `sounds/aol/im.ogg`.

## Preferred formats

- **MP3** is preferred: it is small and every browser decodes it.
- **WAV** (16-bit PCM) works everywhere too, but is bigger.
- **OGG** (Vorbis) works in most browsers except older Safari.

Keep the clips short and trimmed of silence at the start. They play through the same master volume as the rest of the simulator, so the Sounds mute in Control Panel silences them.

## Notes

- Files are loaded with `fetch`, so use a web server (`python3 -m http.server`). Opening `index.html` from `file://` won't load them, and the speech fallback is used.
- A missing file is remembered for the rest of the visit, so the simulator doesn't keep asking the server for it. Reload the page after adding files.
- Please don't commit audio you don't have the right to share.
