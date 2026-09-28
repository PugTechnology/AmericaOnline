/* Small system programs: Run, Shut Down, Help, Find, Welcome, About and Control Panel applets. */
(function () {
  var h = U.h;

  // ---------------------------------------------------------------- Run
  var RUN_ALIASES = {
    notepad: 'notepad', 'notepad.exe': 'notepad', edit: 'notepad', 'edit.com': 'notepad',
    command: 'msdos', 'command.com': 'msdos', cmd: 'msdos', 'cmd.exe': 'msdos',
    doom: 'doom', 'doom.exe': 'doom',
    aol: 'aol', 'aol.exe': 'aol', waol: 'aol',
    winmine: 'minesweeper', 'winmine.exe': 'minesweeper', minesweeper: 'minesweeper',
    pinball: 'pinball', 'pinball.exe': 'pinball',
    explorer: 'explorer', 'explorer.exe': 'explorer',
    iexplore: 'ie', 'iexplore.exe': 'ie',
    control: 'control', 'control.exe': 'control',
    winver: 'about', 'winver.exe': 'about',
    help: 'help', 'winhelp': 'help', 'winhlp32': 'help'
  };

  function run(cmd) {
    cmd = (cmd || '').trim();
    if (!cmd) return true;
    var lower = cmd.toLowerCase();
    if (window.BSOD && BSOD.command(lower)) return true;   // CON\CON, and the hidden "crash"
    if (RUN_ALIASES[lower]) { Shell.launch(RUN_ALIASES[lower], lower === 'explorer' || lower === 'explorer.exe' ? 'C:\\' : undefined); return true; }
    if (/^(https?:\/\/|www\.)/i.test(cmd) || /\.(com|org|net|edu)(\/|$)/i.test(cmd)) { Shell.launch('ie', cmd); return true; }
    if (/^[a-z]:/i.test(cmd)) {
      if (/^[abd]:/i.test(cmd)) { WM.msgbox({ title: cmd, icon: 'error', text: cmd.charAt(0).toUpperCase() + ':\\ is not accessible.\n\nThe device is not ready.' }); return false; }
      if (FS.exists(cmd)) { Shell.open(cmd); return true; }
    }
    WM.msgbox({ title: cmd, icon: 'error', text: 'Cannot find the file \'' + cmd + '\' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.' });
    return false;
  }
  Shell.run = run;

  Shell.register('run', { name: 'Run', icon: 'run', single: true, launch: function () {
    var history = U.store.get('w98.runmru', ['notepad']);
    var input = h('input', { type: 'text', className: 'field', value: history[0] || '', list: 'run-mru', spellcheck: 'false', autocomplete: 'off' });
    var dl = h('datalist', { id: 'run-mru' }, history.map(function (x) { return h('option', { value: x }); }));
    var ok = h('button', { className: 'btn default' }, 'OK');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var browse = h('button', { className: 'btn' }, U.label('&Browse...'));
    var win = WM.dialog({ app: 'run', title: 'Run', width: 350, taskbar: false, content: h('div', { className: 'run-dialog' }, [
      h('div', { className: 'run-top' }, [U.img('run', 32), h('p', null, 'Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.')]),
      h('div', { className: 'run-row' }, [h('label', null, U.label('&Open:')), input, dl]),
      h('div', { className: 'button-row right' }, [ok, cancel, browse])
    ]), helpButton: true });
    win.el.style.left = '6px';
    win.el.style.top = (document.getElementById('desktop').clientHeight - win.el.offsetHeight - 6) + 'px';
    function go() {
      var v = input.value;
      if (run(v)) {
        U.store.set('w98.runmru', [v].concat(history.filter(function (x) { return x !== v; })).slice(0, 10));
        win.close(true);
      }
    }
    ok.addEventListener('click', go);
    cancel.addEventListener('click', function () { win.close(true); });
    browse.addEventListener('click', function () {
      Dialogs.file({ mode: 'open', owner: win, title: 'Browse', dir: 'C:\\WINDOWS', types: [{ label: 'Programs', ext: 'exe' }, { label: 'All Files (*.*)', ext: '*' }] })
        .then(function (p) { if (p) input.value = p; });
    });
    win.onKey = function (e) {
      if (e.key === 'Enter') { go(); return true; }
      if (e.key === 'Escape') { win.close(true); return true; }
      return false;
    };
    setTimeout(function () { input.focus(); input.select(); }, 0);
    return win;
  } });

  // ---------------------------------------------------------------- Shut Down
  Shell.register('shutdown', { name: 'Shut Down Windows', icon: 'shutdown', single: true, launch: function () {
    var choice = 'off';
    var opts = [['standby', 'S&tand by'], ['off', '&Shut down'], ['restart', '&Restart'], ['dos', 'Restart in &MS-DOS mode']];
    var radios = opts.map(function (o) {
      var r = h('input', { type: 'radio', name: 'sd', value: o[0], checked: o[0] === 'off' });
      r.addEventListener('change', function () { choice = o[0]; });
      return h('label', { className: 'radio' }, [r, U.label(o[1])]);
    });
    var ok = h('button', { className: 'btn default' }, 'OK');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var help = h('button', { className: 'btn' }, U.label('&Help'));
    // Everything behind the dialog goes grey, just like the real thing.
    var veil = h('div', { className: 'shutdown-veil' });
    document.getElementById('desktop').appendChild(veil);
    var win = WM.dialog({ app: 'shutdown', title: 'Shut Down Windows', width: 330, taskbar: false, className: 'above-veil', content: h('div', { className: 'shutdown-dialog' }, [
      U.img('shutdown', 32),
      h('div', null, [h('p', null, 'What do you want the computer to do?'), h('div', { className: 'radios' }, radios)]),
      h('div', { className: 'button-row' }, [ok, cancel, help])
    ]) });
    win.on('close', function () { veil.remove(); });
    ok.addEventListener('click', function () {
      win.close(true);
      if (choice === 'dos') { Shell.launch('msdos', { fullscreen: true, dosMode: true }); return; }
      Boot.shutdown(choice);
    });
    cancel.addEventListener('click', function () { win.close(true); });
    help.addEventListener('click', function () { win.close(true); Shell.launch('help', 'shutdown'); });
    win.onKey = function (e) {
      if (e.key === 'Enter') { ok.click(); return true; }
      if (e.key === 'Escape') { win.close(true); return true; }
      return false;
    };
    setTimeout(function () { ok.focus(); }, 0);
    return win;
  } });

  // ---------------------------------------------------------------- Help
  var HELP = [
    { t: 'Welcome to Windows 98', b: 'This is a re-creation of a Compaq Presario running Windows 98, built for the web. Everything runs in your browser. Files you save are stored on drive C:, which lives in this browser\'s local storage.' },
    { t: 'Using the Start menu', b: 'Click Start in the lower-left corner. Point to Programs to see the programs on this computer. Notepad is under Programs > Accessories, DOOM is under Programs > id Software, and America Online has its own folder.' },
    { t: 'Saving your work', b: 'In Notepad, click File, then Save As. Choose a folder (My Documents is a good choice), type a name and click Save. Your file will still be there the next time you turn on the computer.' },
    { t: 'Getting online with America Online', b: 'Double-click America Online on the desktop, then click SIGN ON. Your modem will dial and connect. Once you\'re online, type a Keyword (like NEWS, SPORTS or GAMES) or a web address (like www.yahoo.com) into the box at the top and click Go. The web you see is the real web of 1998-2000, courtesy of the Internet Archive\'s Wayback Machine.' },
    { t: 'Playing DOOM', b: 'Arrow keys move, Ctrl fires, Space opens doors, Shift runs. Press Esc for the menu; saved games are kept between visits. Click inside the DOOM window first so it hears your keys.' },
    { t: 'Shutting down', b: 'Always use Start > Shut Down before turning off your computer. Otherwise ScanDisk will scold you next time. (Not really. But it\'s polite.)' },
    { t: 'Keyboard shortcuts', b: 'Alt+F4 closes the active window. Ctrl+Esc opens the Start menu. Alt plus an underlined letter opens a menu. F2 renames, Delete sends to the Recycle Bin.' }
  ];
  Shell.register('help', { name: 'Windows Help', icon: 'help', single: true, launch: function (topic) {
    var list = h('div', { className: 'help-list sunken-panel' });
    var body = h('div', { className: 'help-body sunken-panel' });
    function show(i) {
      list.querySelectorAll('.help-topic').forEach(function (n, k) { n.classList.toggle('selected', k === i); });
      body.innerHTML = '';
      body.appendChild(h('h2', null, HELP[i].t));
      body.appendChild(h('p', null, HELP[i].b));
    }
    HELP.forEach(function (x, i) {
      var t = h('div', { className: 'help-topic' }, [U.img('help', 16), h('span', null, x.t)]);
      t.addEventListener('click', function () { show(i); });
      list.appendChild(t);
    });
    var win = WM.open({ app: 'help', title: 'Windows Help', icon: 'help', width: 560, height: 360, content: h('div', { className: 'help-app' }, [list, body]) });
    var idx = { notepad: 2, shutdown: 5, aol: 3, doom: 4 }[topic] || 0;
    show(idx);
    return win;
  } });

  // ---------------------------------------------------------------- Find
  Shell.register('find', { name: 'Find: All Files', icon: 'find', launch: function () {
    var named = h('input', { type: 'text', className: 'field', spellcheck: 'false' });
    var containing = h('input', { type: 'text', className: 'field', spellcheck: 'false' });
    var findBtn = h('button', { className: 'btn default' }, U.label('F&ind Now'));
    var results = h('div', { className: 'sunken-panel find-results' });
    var status = h('div');
    var win = WM.open({ app: 'find', title: 'Find: All Files', icon: 'find', width: 470, height: 360, content: h('div', { className: 'find-app' }, [
      h('div', { className: 'find-form' }, [
        h('label', null, U.label('&Named:')), named, findBtn,
        h('label', null, U.label('Containing &text:')), containing, h('span'),
        h('label', null, 'Look in:'), h('span', null, [U.img('drive-hdd', 16), ' Presario (C:)']), h('span')
      ]),
      results,
      h('div', { className: 'status-bar' }, [status])
    ]) });
    function search() {
      var n = named.value.trim().toLowerCase(), c = containing.value.trim().toLowerCase();
      var re = n ? new RegExp('^' + n.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + (n.indexOf('*') === -1 ? '|' + n.replace(/[.+^${}()|[\]\\*?]/g, '\\$&') : '')) : null;
      var found = [];
      (function walk(p) {
        (FS.list(p) || []).forEach(function (e) {
          var nameOk = !re || re.test(e.name.toLowerCase()) || (n && e.name.toLowerCase().indexOf(n) !== -1);
          var textOk = !c || (e.node.t === 'f' && !e.node.bin && e.node.d.toLowerCase().indexOf(c) !== -1);
          if (nameOk && textOk) found.push(e);
          if (e.node.t === 'd') walk(e.path);
        });
      })('C:\\');
      results.innerHTML = '';
      var table = h('table', { className: 'list-table' }, [h('tr', null, [h('th', null, 'Name'), h('th', null, 'In Folder'), h('th', null, 'Size')])]);
      found.forEach(function (e) {
        var tr = h('tr', null, [
          h('td', null, [U.img(Shell.iconFor(e.name, e.node), 16), ' ', Shell.displayName(e.name, e.node)]),
          h('td', null, FS.dirname(e.path)),
          h('td', null, e.node.t === 'f' ? FS.formatSize(FS.sizeOf(e.node)) : '')
        ]);
        tr.addEventListener('click', function () { table.querySelectorAll('tr').forEach(function (r) { r.classList.remove('selected'); }); tr.classList.add('selected'); });
        U.onActivate(tr, function () { Shell.open(e.path); });
        table.appendChild(tr);
      });
      results.appendChild(table);
      status.textContent = found.length + ' file(s) found';
      U.sound('hddSeek', 600);
    }
    findBtn.addEventListener('click', search);
    win.onKey = function (e) { if (e.key === 'Enter') { search(); return true; } return false; };
    setTimeout(function () { named.focus(); }, 0);
    return win;
  } });

  // ---------------------------------------------------------------- Welcome
  Shell.register('welcome', { name: 'Welcome to Windows 98', icon: 'windows-flag', single: true, launch: function () {
    var items = [
      ['Register Now', 'windows-update', function () { WM.msgbox({ title: 'Registration Wizard', icon: 'info', text: 'Thank you! Your registration has been faxed to Redmond.\n\n(It hasn\'t.)' }); }],
      ['Connect to the Internet', 'aol', function () { Shell.launch('aol'); }],
      ['Discover Windows 98', 'help', function () { Shell.launch('help'); }],
      ['Maintain Your Computer', 'drive-hdd', function () { Shell.launch('control', 'system'); }]
    ];
    var menu = h('div', { className: 'welcome-menu' }, items.map(function (it) {
      var b = h('button', { className: 'welcome-item' }, [U.img(it[1], 16), h('span', null, it[0])]);
      b.addEventListener('click', it[2]);
      return b;
    }));
    var show = h('input', { type: 'checkbox', checked: true });
    // Background music: a YouTube embed, shown as a small "Now Playing" player
    // (YouTube players must stay visible). Muting Windows sounds silences it too.
    var MUSIC_ID = 'mTf806u38Ng';
    var musicOn = U.store.get('w98.welcome.music', true) && !(window.Sound && Sound.muted);
    var musicBox = h('div', { className: 'welcome-music' });
    var musicToggle = h('input', { type: 'checkbox', checked: musicOn });
    function setMusic(on) {
      musicBox.innerHTML = '';
      if (!on) { musicBox.appendChild(h('div', { className: 'wm-off' }, '\u266a Music is off')); return; }
      musicBox.appendChild(h('iframe', {
        src: 'https://www.youtube-nocookie.com/embed/' + MUSIC_ID + '?autoplay=1&loop=1&playlist=' + MUSIC_ID + '&controls=1&modestbranding=1&rel=0',
        title: 'Welcome music', allow: 'autoplay; encrypted-media', referrerpolicy: 'strict-origin-when-cross-origin'
      }));
    }
    musicToggle.addEventListener('change', function () { U.store.set('w98.welcome.music', musicToggle.checked); setMusic(musicToggle.checked); });
    setMusic(musicOn);
    var win = WM.open({ app: 'welcome', title: 'Welcome to Windows 98', icon: 'windows-flag', width: 560, height: 420, resizable: false, maximizable: false, shield: true,
      content: h('div', { className: 'welcome-app' }, [
        h('div', { className: 'welcome-head', innerHTML: '<span>Welcome to </span><b>Windows</b><i>98</i>' }),
        h('div', { className: 'welcome-main' }, [
          h('div', { className: 'welcome-left' }, [h('h3', null, 'CONTENTS'), menu]),
          h('div', { className: 'welcome-right' }, [
            h('p', null, 'Hello, ' + (Shell.user || 'friend') + '.'),
            h('p', null, 'Welcome to the exciting new world of Windows 98, where your computer and the Internet work together. This is the Compaq Presario you remember: a 500 MHz AMD K6-2, 32 MB of RAM, a 2.1 GB hard drive and a 56K modem that sings.'),
            h('p', null, 'To begin, click an item on the left. Or double-click America Online and get connected.'),
            musicBox
          ])
        ]),
        h('div', { className: 'welcome-foot' }, [h('label', { className: 'check' }, [show, 'Show this screen each time Windows 98 starts.']),
          h('label', { className: 'check' }, [musicToggle, 'Music']),
          h('button', { className: 'btn', onclick: function () { win.close(); } }, 'Close')])
      ]) });
    show.addEventListener('change', function () { U.store.set('w98.welcomed', !show.checked); });
    win.on('close', function () { musicBox.innerHTML = ''; });
    return win;
  } });

  // ---------------------------------------------------------------- About
  Shell.register('about', { name: 'About', icon: 'windows-flag', launch: function (o) {
    o = o || { name: 'Windows 98', icon: 'windows-flag' };
    var ok = h('button', { className: 'btn default' }, 'OK');
    var win = WM.dialog({ title: 'About ' + o.name, width: 400, content: h('div', { className: 'about-dialog' }, [
      h('div', { className: 'about-banner', innerHTML: '<b>Microsoft</b>&reg; <b>Windows</b><i>98</i>' }),
      h('div', { className: 'about-body' }, [
        U.img(o.icon, 32),
        h('div', null, [
          h('p', null, 'Microsoft (R) ' + o.name), h('p', null, 'Windows 98'), h('p', null, 'Copyright (C) 1981-1998 Microsoft Corp.'),
          h('p', { style: { marginTop: '10px' } }, 'This product is licensed to:'), h('p', null, Shell.user || 'Guest'), h('p', null, 'COMPAQ'),
          h('div', { className: 'hr' }),
          h('p', null, 'Physical Memory Available to Windows: 32,212 KB'), h('p', null, 'System Resources: 84% Free')
        ])
      ]),
      h('div', { className: 'button-row right' }, [ok])
    ]) });
    ok.addEventListener('click', function () { win.close(true); });
    win.onKey = function (e) { if (e.key === 'Enter' || e.key === 'Escape') { win.close(true); return true; } return false; };
    return win;
  } });

  // ---------------------------------------------------------------- Control Panel applets
  function propSheet(title, icon, tabs, onApply) {
    var ok = h('button', { className: 'btn default' }, 'OK');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var apply = h('button', { className: 'btn', disabled: true }, U.label('&Apply'));
    var tabBar = h('div', { className: 'tabs' });
    var panel = h('div', { className: 'tab-panel' });
    var win = WM.dialog({ title: title, width: 400, helpButton: true, content: h('div', { className: 'prop-sheet' }, [tabBar, panel, h('div', { className: 'button-row right' }, [ok, cancel, apply])]) });
    function show(i) {
      tabBar.querySelectorAll('.tab').forEach(function (t, k) { t.classList.toggle('active', k === i); });
      panel.innerHTML = '';
      U.append(panel, tabs[i].content);
    }
    tabs.forEach(function (t, i) { var b = h('div', { className: 'tab' }, t.title); b.addEventListener('click', function () { show(i); }); tabBar.appendChild(b); });
    show(0);
    win.changed = function () { apply.disabled = false; };
    ok.addEventListener('click', function () { if (onApply) onApply(); win.close(true); });
    apply.addEventListener('click', function () { if (onApply) onApply(); apply.disabled = true; });
    cancel.addEventListener('click', function () { win.close(true); });
    win.onKey = function (e) { if (e.key === 'Escape') { win.close(true); return true; } return false; };
    win.center();
    return win;
  }

  var COLORS = [['Teal (Windows default)', '#008080'], ['Black', '#000000'], ['Navy', '#000080'], ['Dark Green', '#008000'], ['Maroon', '#800000'], ['Purple', '#800080'], ['Olive', '#808000'], ['Gray', '#808080'], ['Blue', '#3a6ea5']];

  var applets = {
    display: function () {
      var s = U.store.get('w98.display', { color: '#008080', pattern: '(None)' });
      var pending = Object.assign({}, s);
      var preview = h('div', { className: 'monitor-preview' }, h('div', { className: 'screen' }));
      function paint() {
        preview.firstChild.style.backgroundColor = pending.color;
        preview.firstChild.style.backgroundImage = Shell.PATTERNS[pending.pattern] || '';
      }
      var patList = h('select', { className: 'field', size: 5, style: { width: '160px', height: '80px' } }, Object.keys(Shell.PATTERNS).map(function (p) { return h('option', { selected: p === s.pattern }, p); }));
      var colSel = h('select', { className: 'field' }, COLORS.map(function (c) { return h('option', { value: c[1], selected: c[1] === s.color }, c[0]); }));
      patList.addEventListener('change', function () { pending.pattern = patList.value; paint(); win.changed(); });
      colSel.addEventListener('change', function () { pending.color = colSel.value; paint(); win.changed(); });
      var wpOld = U.store.get('w98.wallpaper', null);
      var wpSel = h('select', { className: 'field' }, [h('option', { selected: !wpOld }, '(None)'), wpOld ? h('option', { selected: true }, 'Paint wallpaper') : null]);
      wpSel.addEventListener('change', function () { win.changed(); });
      var fast = h('input', { type: 'checkbox', checked: U.store.get('w98.fastboot', false) });
      fast.addEventListener('change', function () { win.changed(); });
      var ss = Object.assign({}, Shell.screensaverSettings()), ssPreview = null;
      function screenSaverTab() {
        var names = ['(None)'].concat(window.Screensaver ? Screensaver.names.filter(function (n) { return n !== '(None)'; }) : []);
        var mon = h('div', { className: 'monitor-preview' }, h('div', { className: 'screen ss-screen' }));
        var sel = h('select', { className: 'field' }, names.map(function (n) { return h('option', { selected: n === ss.name }, n); }));
        var wait = h('input', { type: 'number', className: 'field', min: 1, max: 60, value: ss.wait, style: { width: '50px' } });
        var prev = h('button', { className: 'btn', disabled: ss.name === '(None)' }, U.label('Pre&view'));
        function showPreview() {
          if (ssPreview) { ssPreview.stop(); ssPreview = null; }
          var scr = mon.firstChild;
          scr.innerHTML = '';
          scr.style.background = ss.name === '(None)' ? '' : '#000';
          if (window.Screensaver && ss.name !== '(None)') ssPreview = Screensaver.preview(scr, ss.name);
        }
        sel.addEventListener('change', function () { ss.name = sel.value; prev.disabled = ss.name === '(None)'; showPreview(); win.changed(); });
        wait.addEventListener('change', function () { ss.wait = Math.max(1, Math.min(60, +wait.value || 3)); win.changed(); });
        prev.addEventListener('click', function () { if (window.Screensaver && ss.name !== '(None)') setTimeout(function () { Screensaver.start(ss.name); }, 300); });
        setTimeout(showPreview, 0);
        return [mon, h('fieldset', { className: 'group' }, [h('legend', null, 'Screen Saver'),
          h('div', { className: 'ss-row' }, [sel, prev]),
          h('div', { className: 'ss-row' }, [h('span', null, 'Wait:'), wait, h('span', null, 'minutes')])])];
      }
      var win = propSheet('Display Properties', 'display', [
        { title: 'Background', content: [preview, h('div', { className: 'display-row' }, [
          h('div', null, [h('div', null, U.label('&Pattern:')), patList]),
          h('div', null, [h('div', null, U.label('&Color:')), colSel]),
          h('div', null, [h('div', null, U.label('&Wallpaper:')), wpSel])
        ])] },
        { title: 'Screen Saver', content: screenSaverTab() },
        { title: 'Settings', content: [
          h('p', null, 'Display: Compaq MV500 on S3 Trio64V2/DX'),
          h('p', null, 'Colors: True Color (24 bit)   Screen area: ' + window.innerWidth + ' by ' + window.innerHeight + ' pixels'),
          h('div', { className: 'hr' }),
          h('label', { className: 'check' }, [fast, 'Quick boot: skip the BIOS screens when the computer starts'])
        ] }
      ], function () {
        U.store.set('w98.display', pending);
        if (wpOld && wpSel.value === '(None)') Shell.setWallpaper(null);
        U.store.set('w98.screensaver', ss);
        U.store.set('w98.fastboot', fast.checked);
        Shell.applyDesktopStyle();
      });
      paint();
      win.on('close', function () { if (ssPreview) ssPreview.stop(); });
      return win;
    },
    sounds: function () {
      var mute = h('input', { type: 'checkbox', checked: window.Sound && Sound.muted });
      var win = propSheet('Sounds Properties', 'volume', [{ title: 'Sounds', content: [
        h('p', null, 'Events: Start Windows, Exit Windows, Default sound, Asterisk, Critical Stop, Exclamation, Question.'),
        h('p', null, 'Schemes: Windows Default'),
        h('div', { className: 'hr' }),
        h('label', { className: 'check' }, [mute, 'Mute all sounds (including the modem!)']),
        h('div', { className: 'sound-tests' }, [
          ['Ding', 'ding'], ['Chord', 'chord'], ['Critical Stop', 'error'], ['Start Windows', 'startup'], ['Floppy', 'floppySeek']
        ].map(function (t) { return h('button', { className: 'btn', onclick: function () { U.sound(t[1]); } }, '\u25b6 ' + t[0]); }))
      ] }], function () { if (window.Sound) Sound.setMuted(mute.checked); });
      mute.addEventListener('change', function () { win.changed(); });
      return win;
    },
    system: function () {
      return propSheet('System Properties', 'computer', [
        { title: 'General', content: h('div', { className: 'sys-general' }, [
          h('div', { className: 'sys-art' }, U.img('computer', 32)),
          h('div', null, [
            h('p', null, h('b', null, 'System:')), h('p', { className: 'ind' }, 'Microsoft Windows 98'), h('p', { className: 'ind' }, '4.10.1998'),
            h('p', null, h('b', null, 'Registered to:')), h('p', { className: 'ind' }, Shell.user || 'Guest'), h('p', { className: 'ind' }, 'COMPAQ'), h('p', { className: 'ind' }, '12398-OEM-0017341-94715'),
            h('p', null, h('b', null, 'Manufactured and supported by:')), h('p', { className: 'ind' }, 'Compaq Computer Corporation'), h('p', { className: 'ind' }, 'Presario'),
            h('p', null, h('b', null, 'Computer:')), h('p', { className: 'ind' }, 'AuthenticAMD'), h('p', { className: 'ind' }, 'AMD-K6(tm)-2 3D processor'), h('p', { className: 'ind' }, '32.0MB RAM')
          ])
        ]) },
        { title: 'Device Manager', content: h('div', { className: 'sunken-panel device-tree' }, [
          'Computer', 'CDROM', 'Disk drives', 'Display adapters', 'Floppy disk controllers', 'Hard disk controllers', 'Keyboard', 'Modem', 'Monitors', 'Mouse', 'Ports (COM & LPT)', 'Sound, video and game controllers', 'System devices'
        ].map(function (d) { return h('div', null, [U.img(d === 'Modem' ? 'network' : d === 'Computer' ? 'computer' : 'settings', 16), ' ', d]); })) },
        { title: 'Performance', content: [
          h('p', null, 'Memory: 32.0 MB of RAM'), h('p', null, 'System Resources: 84% free'), h('p', null, 'File System: 32-bit'), h('p', null, 'Virtual Memory: 32-bit'),
          h('p', null, 'Disk Compression: Not installed'), h('p', null, 'PC Cards (PCMCIA): No PC Card sockets are installed.'),
          h('div', { className: 'hr' }), h('p', null, 'Your system is configured for optimal performance.')
        ] }
      ]);
    },
    datetime: function () {
      var now = new Date();
      var cal = h('div', { className: 'cal' });
      var first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
      var days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      'SMTWTFS'.split('').forEach(function (d) { cal.appendChild(h('b', null, d)); });
      for (var i = 0; i < first; i++) cal.appendChild(h('span'));
      for (var d = 1; d <= days; d++) cal.appendChild(h('span', { className: d === now.getDate() ? 'today' : '' }, String(d)));
      var clock = h('div', { className: 'analog' });
      var hand = function (cls, deg) { return h('i', { className: cls, style: { transform: 'rotate(' + deg + 'deg)' } }); };
      clock.appendChild(hand('hh', (now.getHours() % 12) * 30 + now.getMinutes() / 2));
      clock.appendChild(hand('mm', now.getMinutes() * 6));
      return propSheet('Date/Time Properties', 'settings', [{ title: 'Date & Time', content: h('div', { className: 'datetime' }, [
        h('div', null, [h('p', null, now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })), cal]),
        h('div', null, [clock, h('p', { style: { textAlign: 'center' } }, now.toLocaleTimeString('en-US'))])
      ]) }, { title: 'Time Zone', content: h('p', null, Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time') }]);
    },
    quickrestore: function () {
      return WM.msgbox({ title: 'Compaq QuickRestore', icon: 'warning', buttons: ['&Yes', '&No'], defaultButton: 1,
        text: 'QuickRestore will return drive C: to its factory condition.\n\nALL of your documents, including everything in My Documents, will be permanently erased. Your desktop icon layout and preferences will be reset.\n\nDo you want to continue?' }).then(function (b) {
        if (b !== '&Yes') return;
        WM.closeAll().then(function (ok) {
          if (!ok) return;
          FS.reset();
          ['w98.iconpos', 'w98.recent', 'w98.display', 'w98.welcomed', 'w98.aol'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
          Object.keys(localStorage).forEach(function (k) { if (/^w98\.aol/.test(k)) try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
          WM.msgbox({ title: 'Compaq QuickRestore', icon: 'info', text: 'Drive C: has been restored. Windows will now restart.' }).then(function () { Boot.shutdown('restart'); });
        });
      });
    },
    addremove: function () {
      var list = ['America Online 4.0', 'DOOM Shareware v1.9', 'Microsoft Internet Explorer 4.0', 'Minesweeper', 'U.S. Robotics 56K Modem Drivers'];
      return propSheet('Add/Remove Programs Properties', 'exe', [{ title: 'Install/Uninstall', content: [
        h('p', null, 'The following software can be automatically removed by Windows:'),
        h('div', { className: 'sunken-panel', style: { height: '120px' } }, list.map(function (x) { return h('div', null, x); })),
        h('p', null, 'Removing these would ruin the whole experience, so the Remove button has been disabled by Compaq.')
      ] }]);
    },
    internet: function () {
      var year = h('select', { className: 'field' }, ['1996', '1997', '1998', '1999', '2000', '2001'].map(function (y) { return h('option', { selected: y === String(U.store.get('w98.webyear', 1999)) }, y); }));
      var win = propSheet('Internet Properties', 'ie', [{ title: 'General', content: [
        h('p', null, 'Home page: http://home.microsoft.com/'),
        h('div', { className: 'hr' }),
        h('p', null, 'This computer browses the web through the Internet Archive\'s Wayback Machine.'),
        h('label', null, ['Travel to the web of: ', year])
      ] }], function () { U.store.set('w98.webyear', +year.value); });
      year.addEventListener('change', function () { win.changed(); });
      return win;
    }
  };

  Shell.register('control', { name: 'Control Panel', icon: 'control-panel', launch: function (page) {
    if (!page) return Shell.launch('explorer', 'Control Panel');
    var fn = applets[page];
    return fn ? fn() : Shell.launch('explorer', 'Control Panel');
  } });
})();
