# America Online (on a Compaq Presario running Windows 98)

Power on a late-90s Compaq Presario in your browser. Hear the hard drive spin up and the floppy drive grind, watch the BIOS count memory, sit through the Windows 98 splash, log on, and land on the teal desktop. Then double-click **America Online**, listen to the modem sing, and hear *"Welcome! You've got mail!"*

Everything runs client-side in plain HTML, CSS and JavaScript. There's no build step and no server code.

## What's in the box

**The boot**
- A power button, with Power and Disk LEDs.
- An Award Modular BIOS POST: the Energy Star logo, a memory count, IDE detection and the floppy seek.
- It stops at *Press F1 to continue, DEL to enter SETUP*. **F1** continues through the System Configurations screen; **DEL** skips the Windows 98 start-up animation.
- "Starting Windows 98...", then the cloud splash with its scrolling bar.
- The "Welcome to Windows" logon, and the startup chime.
- Shut Down runs "Windows is shutting down" and ends on "It's now safe to turn off your computer." Restart, Stand by and "Restart in MS-DOS mode" work too.
- Press **Esc** during start-up to hurry it along. Tick *Quick boot* on the power screen to skip the BIOS.

**Sound**
- Every sound is synthesized live with the Web Audio API: the power switch, fan hum, hard drive spin-up and seeks, floppy stepper, POST beep and Windows chimes.
- The 17-second dial-up handshake and busy signal are synthesized the same way, as are the Buddy List door sounds and the IM chimes.
- AOL's voice lines ("Welcome!", "You've got mail!", "Goodbye!") use your browser's speech engine.

**Windows 98**
- A real window manager: drag, resize, minimize, maximize, the taskbar and the Start menu with its cascading submenus.
- Right-click menus, keyboard shortcuts (Alt+F4, Ctrl+Esc, Alt+letter), and desktop icons you can drag, rename and delete.
- **Drive C:** lives in `localStorage`. Anything you save survives a reload, and the Recycle Bin actually works.
- **Notepad:** New, Open, Save and Save As through the classic common dialogs, plus Find, Time/Date and Word Wrap. It asks before throwing away unsaved changes.
- **Calculator:** Standard and Scientific views, memory keys, keyboard input and Copy/Paste. Standard mode works left to right like the real one, so 2+3*4= is 20, and pressing = again repeats the last operation. Scientific adds precedence, Hex/Dec/Oct/Bin, trig, x^y and n!.
- **Paint:** pencil, brush, airbrush, eraser, fill, line, rectangle, ellipse, text, colour picker and a movable rectangle selection, with the 28-colour palette (left click for the foreground, right click for the background). Image menu: Flip/Rotate, Invert Colors, Attributes, Clear Image. Pictures save to C: as `.bmp` files (a PNG inside), and File > Set As Wallpaper (Tiled or Centered) puts one on the desktop.
- **WordPad:** rich text with a toolbar and format bar (font, size, colour, bold, italic, underline, alignment, bullets). It saves `.doc` and `.rtf` files as HTML, opens `.txt`, and cleans anything it loads of scripts and unsafe markup. Double-clicking a `.doc`, `.rtf` or `.wri` opens it; `.bmp` opens Paint.
- **CD Player:** an LED display, play, pause, stop, previous and next, skip, eject, random and continuous play. The "Compaq Presario Demo CD" holds five chiptune tracks synthesized on the fly.
- **Volume control:** click the tray speaker for a volume slider and Mute checkbox (double-click for the full Volume Control window). It drives the same master volume and mute the rest of the sound uses.
- **My Computer and Explorer:** folders on C:, the Web View pane with the disk-usage pie, Recycle Bin, Control Panel, Printers and Network Neighborhood. Drive A: gives "The device is not ready", floppy grind included.
- **MS-DOS Prompt:** `DIR`, `CD`, `TYPE`, `COPY`, `REN`, `DEL`, `MD`, `MEM`, `VER`, and the classic *Abort, Retry, Fail?*
- **Minesweeper:** Beginner, Intermediate and Expert, with flags, ? marks, chording and best times.
- **Solitaire:** Klondike with Draw One / Draw Three, Standard / Vegas / None scoring, a timer, Undo, twelve card backs, drag-and-drop or double-click to the foundations, and the bouncing-cards win animation.
- **FreeCell:** the classic numbered deals (game 11982 is the unsolvable one), free cells, home cells, supermoves, Select Game, Statistics and a king who watches the mouse.
- **3D Pinball:** an original space-cadet-style table with flippers, plunger, bumpers, ramp, hyperspace, missions, ranks and high scores. Z and / flip, Space launches.
- **Screen savers:** 3D Pipes (WebGL), Starfield and Mystify. They start after idle time; Display Properties has the settings and a live preview.
- **Welcome to Windows 98:** plays background music from a YouTube embed, with a Music toggle.
- **DOOM:** the shareware Episode 1, running in a window. Saved games persist.
- **Internet Explorer 4:** browses the web as it was in 1996–2001.
- **Control Panel:** Display (desktop colour and pattern), Sounds (mute), System Properties, Date/Time, and *Compaq QuickRestore* to wipe C: back to factory.

**Shell extras**
- **Close Program (Ctrl+Alt+Del):** lists the open windows plus Explorer and Systray, and now and then one is *(Not responding)*. **End Task** closes it (ending Explorer makes the taskbar and icons vanish, then Windows restarts it), **Shut Down** and **Cancel** work too. Browsers often eat Ctrl+Alt+Del, so **Ctrl+Alt+Backspace** and **Ctrl+Shift+Esc** do the same, and the taskbar right-click menu has *Task Manager...*. Press the combo again while the dialog is open and the computer restarts.
- **Blue Screen of Death:** the text-mode "A fatal exception 0E has occurred at 0028:C0011E36 in VXD VMM(01)" screen. Type `con\con` (or `C:\CON\CON`) into Run or the MS-DOS Prompt, open DOOM and Pinball together and hope, or find the hidden `crash` keyword (Run, MS-DOS, or just type it on the desktop). Any key returns to the desktop, sometimes to a second "Windows protection error" screen, and a key there reboots.
- **Cut, Copy and Paste** for files on the desktop and in Explorer, from the menus or with Ctrl+X, C and V. Cut icons are drawn faded, name clashes become "Copy of X", and you can paste into folders.
- **Arrange Icons** by Name, Type, Size or Date, **Line Up Icons**, and a **Auto Arrange** toggle that is remembered.
- **Desktop Themes** (Control Panel, or Programs > Accessories > System Tools): Windows Default, Space, Dangerous Creatures, Inside Your Computer, Jungle, Mystery and The 60's USA. Each draws its wallpaper on a canvas (no image files), recolours the title bars and can change the "ding". A colour, pattern or wallpaper picked in Display Properties always wins over the theme's.
- **Simulate 28.8k modem** (IE's View menu; on by default while AOL is signed on): web pages take 5 to 9 seconds, with the throbber spinning, "Opening page http://..." in the status bar, a slow progress bar, and the page revealed top-down as a blur that sharpens.
- **Y2K:** Date/Time Properties has a *Y2K test* button (or set the pretend clock to 12/31/1999). The tray clock counts down from 11:59:50 PM, rolls over to 1/1/1900, and a chain of dialogs ends in the Microsoft Y2K Update. Only the tray clock is faked.
- **Achievements:** balloon toasts for things like your first blue screen, Ctrl+Alt+Del, a theme change, emptying the Recycle Bin and surviving Y2K. View them from `C:\My Documents\Achievements` or Programs > Accessories > System Tools. Other features can call `window.Achievements && Achievements.unlock('id', { title, desc, icon })`.
- Start menu: **Programs > StartUp** and **Favorites > Channels** (MSNBC, Disney, Warner Bros., PointCast) are filled in.

**America Online 4.0**
- **Sign On:** screen names, New User and Guest.
- **Dial-up:** the six-step connection (modem, running man, people) synced to the modem sound, with the occasional busy signal.
- **Welcome screen:** "You Have Mail", "Today on AOL" headlines and the Channels list.
- **Keywords:** type NEWS, SPORTS, WEATHER, KIDS ONLY, CHAT, QUOTES or HOROSCOPES into the box, or brand keywords like YAHOO, CNN, SPACE JAM, NINTENDO and NAPSTER. Press Ctrl+K for the Keyword window.
- **Web addresses:** type any web address (e.g. `www.geocities.com`) to open the archived page from the Internet Archive's Wayback Machine. *Internet > Time Travel* picks the year.
- **Mail:** an Online Mailbox (New, Old and Sent) and Write Mail. Mail to yourself arrives; mail to buddies gets replies.
- **Buddy List and IMs:** buddies sign on and off with door sounds, and they'll IM you.
- **People Connection:** the *Town Square - Lobby 42* chat room.
- **Sign Off:** "Goodbye!"

## Running it

It's a static site. Serve the folder with anything:

```sh
npx http-server .        # or: python3 -m http.server
```

Then open http://localhost:8080 (or the port your server prints). It deploys as-is to GitHub Pages, Netlify and similar hosts.

- **Opening `index.html` directly:** from `file://` most things work, but DOOM won't, because browsers refuse to load WebAssembly from disk. Use a local server.
- **Skipping the boot:** add `?desktop` to the URL (`index.html?desktop`) to jump straight to the desktop. It's handy while developing.

## Project layout

```
index.html            the page; loads everything below in order
css/win98.css         Windows 98 chrome: bevels, windows, menus, taskbar, desktop
css/boot.css          power screen, BIOS, splash, logon, shutdown
css/apps.css          per-app styles
css/accessories.css   Calculator, Paint, WordPad, CD Player, volume popup
css/aol.css           America Online
js/util.js            DOM helpers and storage wrapper
js/icons.js           pixel-art icon library, drawn procedurally to canvas
js/sound.js           Web Audio synthesis of every sound
js/fs.js              the virtual C: drive (localStorage)
js/wm.js              window manager, menus, message boxes
js/shell.js           desktop icons, taskbar, Start menu, program registry
js/dialogs.js         Open / Save As common dialog
js/web.js             Wayback Machine browser panes
js/boot.js            the power-on to desktop sequence (and back)
js/clipboard.js       the file clipboard (Cut / Copy / Paste)
js/achievements.js    achievements, toasts and the viewer
js/bsod.js            the Blue Screen of Death
js/themes.js          Desktop Themes and their canvas wallpapers
js/y2k.js             the Y2K countdown and rollover
js/extras.js          StartUp and Channels menu entries
css/extras.css        styles for all of the above
js/apps/*.js          Notepad, Calculator, Paint, WordPad, CD Player, Explorer, MS-DOS, Minesweeper, DOOM, IE, AOL, Close Program, system dialogs
apps/doom/            DOOM host page, engine (WASM) and shareware IWAD
fonts/                MS Sans Serif pixel font and VT323, with their licenses
```

To add a program, call `Shell.register('id', { name, icon, launch(arg) })` and open a window with `WM.open({...})`. The apps in `js/apps/` show the pattern.

## Credits and licenses

- **DOOM engine:** [cloudflare/doom-wasm](https://github.com/cloudflare/doom-wasm), a WebAssembly port of [Chocolate Doom](https://www.chocolate-doom.org/). It's GPL-2.0; the source is at those links. The binary was taken from the npm package `@nicejsisverycool/tizendoom`.
- **DOOM game data:** `doom1.wad` is the DOOM v1.9 shareware release by id Software, which id allowed to be freely distributed unmodified.
- **MS Sans Serif font:** the pixel version is by "lou" on FontStruct (CC BY-SA 3.0), via [98.css](https://github.com/jdan/98.css); the license files are in `fonts/`.
- **VT323 font:** by Peter Hull (SIL Open Font License 1.1).
- **Archived web pages:** served live by the [Internet Archive's Wayback Machine](https://web.archive.org/). Please consider supporting them.
- **Icons, sounds and the startup chime:** original creations for this project, drawn and synthesized in code. No Microsoft, Compaq or AOL assets are included.
- **3D Pinball and 3D Pipes:** original re-creations written for this project; no Microsoft game data or code is used.
- **Welcome music:** streamed from YouTube through its embedded player; it isn't stored in this repository.

This is a fan-made nostalgia project. It isn't affiliated with or endorsed by Microsoft, HP/Compaq, AOL or id Software. Windows, America Online and DOOM are trademarks of their respective owners.
