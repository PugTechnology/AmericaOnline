# AOL voice clips (drop-in)

The simulator can play the genuine AOL voice lines, but **the audio files are not bundled** with this project. They are AOL's recordings, and we have not been able to check that they are free to redistribute. Add your own copies here, then list each one in `clips.json` and they are picked up. Without them, the simulator falls back to your browser's speech engine (or, for the IM and door sounds, to its built-in synthesized sounds).

## Installing clips

1. Drop your file directly in this folder (`sounds/aol/`), e.g. `welcome.mp3`.
2. Open `clips.json` and set that clip's entry to the filename: `"welcome": "welcome.mp3"`.
3. Reload the page.

`clips.json` maps each clip name to a filename, or `null` for "not installed". Only clips with a filename are fetched, so a stock checkout makes no failing network requests. The names are below; the filename can be anything.

| Clip name | Plays when | Fallback if missing |
| --- | --- | --- |
| `welcome` | You finish signing on: "Welcome!" | Speech: "Welcome!" |
| `youve-got-mail` | You have unread mail at sign-on, or new mail arrives: "You've got mail!" | Speech: "You've got mail!" |
| `goodbye` | You sign off, or are disconnected for being idle: "Goodbye!" | Speech: "Goodbye!" |
| `files-done` | A download finishes: "File's done!" | Speech: "File's done!" |
| `im` | An Instant Message arrives (the "bing") | Synthesized IM chime |
| `buddy-in` | A buddy signs on (door opens) | Synthesized door opening |
| `buddy-out` | A buddy signs off (door closes) | Synthesized door closing |

"You've got pictures" is not wired to anything yet, but `Sound.clip('youve-got-pictures', "You've got pictures!")` will play it if you list a file for `youve-got-pictures` in `clips.json`.

Example `clips.json` entries: `"welcome": "welcome.mp3"`, `"youve-got-mail": "youve-got-mail.wav"`, `"im": "im.ogg"`.

## Preferred formats

- **MP3** is preferred: it is small and every browser decodes it.
- **WAV** (16-bit PCM) works everywhere too, but is bigger.
- **OGG** (Vorbis) works in most browsers except older Safari.

Keep the clips short and trimmed of silence at the start. They play through the same master volume as the rest of the simulator, so the Sounds mute in Control Panel silences them.

## Notes

- `clips.json` and the clips are loaded with `fetch`, so use a web server (`python3 -m http.server`). Opening `index.html` from `file://` won't load them, and the speech fallback is used silently.
- The manifest is read once per visit, and a clip that fails to load is remembered, so reload the page after editing `clips.json`.
- Please don't commit audio you don't have the right to share.
