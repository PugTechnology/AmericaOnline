/*
 * The machine: power button -> Compaq POST -> "Starting Windows 98..." -> splash ->
 * logon -> desktop, and the reverse on shutdown.
 */
(function () {
  var h = U.h;
  var machine, stageEl;
  var skipRequested = false;
  var state = 'off';

  // Waits that end early when the user presses Esc to skip the boot.
  function pause(ms) {
    return new Promise(function (resolve) {
      if (skipRequested) return resolve();
      var t = setTimeout(done, ms);
      var iv = setInterval(function () { if (skipRequested) done(); }, 50);
      function done() { clearTimeout(t); clearInterval(iv); resolve(); }
    });
  }

  function setStage(el) {
    if (stageEl) stageEl.remove();
    stageEl = el;
    if (el) machine.appendChild(el);
    return el;
  }

  var fastBoot = function () { return U.store.get('w98.fastboot', false); };

  // =====================================================================
  // Power-off room
  // =====================================================================
  function powerScreen() {
    state = 'off';
    document.title = 'Compaq Presario';
    var fast = h('input', { type: 'checkbox', checked: fastBoot() });
    fast.addEventListener('change', function () { U.store.set('w98.fastboot', fast.checked); });
    var btn = h('button', { id: 'power-button', 'aria-label': 'Power on', innerHTML:
      '<svg viewBox="0 0 48 48" fill="none" stroke="#4a463c" stroke-width="5" stroke-linecap="round"><path d="M16 11.5a16 16 0 1 0 16 0"/><path d="M24 5v17"/></svg>' });
    var ledPower = h('i', { className: 'led' }), ledHdd = h('i', { className: 'led' });
    var el = h('div', { id: 'power-screen', className: 'stage' }, [
      h('div', { className: 'brand' }, [
        h('div', { className: 'compaq', innerHTML: 'COMPAQ' }),
        h('div', { className: 'model' }, 'Presario')
      ]),
      h('div', { className: 'power-bezel' }, btn),
      h('div', { className: 'power-leds' }, [h('span', null, [ledPower, 'Power']), h('span', null, [ledHdd, 'Disk'])]),
      h('div', { className: 'hint' }, 'Press the power button'),
      h('div', { className: 'sub' }, 'Turn your sound on. Press Esc during start-up to hurry things along.'),
      h('label', { className: 'fast' }, [fast, 'Quick boot (skip the BIOS screens)'])
    ]);
    function press() {
      if (state !== 'off') return;
      state = 'booting';
      btn.classList.add('down');
      if (window.Sound) { Sound.unlock(); }
      U.sound('powerOn');
      ledPower.className = 'led on-green';
      setTimeout(function () { boot(); }, 650);
    }
    btn.addEventListener('click', press);
    setStage(el);
    setTimeout(function () { btn.focus(); }, 50);
  }

  // =====================================================================
  // Boot
  // =====================================================================
  function boot(isRestart) {
    skipRequested = false;
    state = 'booting';
    document.body.classList.add('busy');
    var chain = fastBoot() ? quickPost(isRestart) : post(isRestart);
    chain
      .then(function (r) {
        // DEL at the POST prompt skips the Windows start-up animation.
        if (r && r.skipSplash) {
          setStage(h('div', { className: 'stage', style: { background: '#000' } }));
          return pause(500);
        }
        return startingWindows().then(splash);
      })
      .then(function () { skipRequested = false; return logon(); })
      .then(desktop)
      .catch(function (e) { console.error(e); desktop(); });
  }

  function quickPost(isRestart) {
    var el = setStage(h('div', { id: 'bios', className: 'stage crt crt-on' }));
    if (!isRestart) U.sound('degauss');
    U.sound('hddSpinUp');
    el.innerHTML = '<span class="cursor"></span>';
    return pause(900);
  }

  var AWARD_RIBBON = '<svg class="award-ribbon" viewBox="0 0 40 44"><path d="M9 26 L3 42 L11 37 L15 44 L20 30 Z M31 26 L37 42 L29 37 L25 44 L20 30 Z" fill="#4f7dff"/><circle cx="20" cy="16" r="14" fill="#5b86ff"/><circle cx="20" cy="16" r="9" fill="none" stroke="#9fb8ff" stroke-width="2"/></svg>';
  var ENERGY_STAR = '<svg class="energy-star" viewBox="0 0 200 120"><g fill="none" stroke="#3dff8a" stroke-width="3"><path d="M18 78 A 82 70 0 0 1 182 70"/></g>' +
    '<text x="22" y="82" font-family="Brush Script MT, Segoe Script, cursive" font-style="italic" font-size="40" fill="#3dff8a">energy</text>' +
    '<polygon points="160,38 168,62 193,62 173,76 180,100 160,86 140,100 147,76 127,62 152,62" fill="none" stroke="#3dff8a" stroke-width="3"/>' +
    '<rect x="10" y="104" width="186" height="2.5" fill="#3dff8a"/><text x="12" y="119" font-family="Arial, sans-serif" font-weight="bold" font-size="13" fill="#3dff8a" textLength="182">EPA POLLUTION PREVENTER</text></svg>';

  // Award Modular BIOS POST, as on a late-90s Compaq Presario. It stops at
  // "Press F1 to continue, DEL to enter SETUP"; F1 boots normally and DEL
  // skips the Windows 98 start-up animation. Resolves { skipSplash }.
  function post(isRestart) {
    var el = setStage(h('div', { id: 'bios', className: 'stage crt award' + (isRestart ? '' : ' crt-on') }));
    if (!isRestart) U.sound('degauss');
    U.sound('hddSpinUp');
    document.title = 'Compaq Presario';

    var text = h('div', { className: 'post-text' });
    var bottom = h('div', { className: 'post-bottom' });
    el.innerHTML = AWARD_RIBBON + ENERGY_STAR;
    el.appendChild(text);
    el.appendChild(bottom);
    var lines = [];
    function render(extra) { text.innerHTML = lines.join('\n') + (extra || ''); }
    function line(html) { lines.push(html); render(); }
    function setBottom(html) { bottom.innerHTML = html + '\n01/06/2000-VP3-586B-W877-2A5LEF09C-00'; }

    return pause(isRestart ? 500 : 1100).then(function () {
      line('    Award Modular BIOS v4.60PGA, An Energy Star Ally');
      line('    Copyright (C) 1984-98, Award Software, Inc.');
      line('');
      line('Version J1437');
      line('');
      setBottom('Press <b>DEL</b> to enter SETUP');
      return pause(500);
    }).then(function () {
      line('AMD-K6(tm)-2/500 CPU Found');
      var total = 32768, shown = 0;
      return new Promise(function (resolve) {
        var iv = setInterval(function () {
          shown = Math.min(total, shown + (skipRequested ? total : 1024));
          render('\nMemory Test :  ' + String(shown).padStart(6) + 'K');
          if (shown >= total) { clearInterval(iv); resolve(); }
        }, 45);
      });
    }).then(function () {
      line('Memory Test :   32768K OK');
      line('');
      return pause(400);
    }).then(function () {
      line('Award Plug and Play BIOS Extension  v1.0A');
      line('Copyright (C) 1998, Award Software, Inc.');
      return pause(500);
    }).then(function () {
      line('   Detecting IDE Primary Master  ... QUANTUM FIREBALL ST2.1A');
      U.sound('hddSeek', 300);
      return pause(800);
    }).then(function () {
      line('   Detecting IDE Primary Slave   ... None');
      return pause(450);
    }).then(function () {
      line('   Detecting IDE Secondary Master... CD-ROM 24X');
      return pause(600);
    }).then(function () {
      line('   Detecting IDE Secondary Slave ... None');
      line('');
      return Promise.race([U.sound('floppySeek'), pause(1600)]);
    }).then(function () {
      line(' Floppy disk(s) fail (40)');
      U.sound('postBeep');
      document.body.classList.remove('busy');
      return waitForKey();
    }).then(function (key) {
      document.body.classList.add('busy');
      if (key === 'del') {
        setBottom('');
        return { skipSplash: true };
      }
      return systemConfig().then(function () { return { skipSplash: false }; });
    });

    // F1 / DEL (keys, or tap the words on a touch screen). Esc means "hurry up": F1.
    function waitForKey() {
      setBottom('Press <b class="key" data-k="f1">F1</b> to continue, <b class="key" data-k="del">DEL</b> to enter SETUP');
      return new Promise(function (resolve) {
        var done = false;
        function finish(k) {
          if (done) return;
          done = true;
          document.removeEventListener('keydown', onKey, true);
          clearInterval(iv);
          resolve(k);
        }
        function onKey(e) {
          if (e.key === 'F1' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish('f1'); }
          else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); finish('del'); }
        }
        document.addEventListener('keydown', onKey, true);
        bottom.querySelectorAll('.key').forEach(function (k) {
          k.addEventListener('click', function () { finish(k.dataset.k); });
        });
        var iv = setInterval(function () { if (skipRequested) finish('f1'); }, 100);
      });
    }

    // The summary box Award printed before handing over to the operating system.
    function systemConfig() {
      text.innerHTML = '';
      setBottom('');
      el.querySelectorAll('svg').forEach(function (n) { n.remove(); });
      var row = function (a, b, c, d) { return '<tr><td>' + a + '</td><td>: ' + b + '</td><td>' + c + '</td><td>: ' + d + '</td></tr>'; };
      text.innerHTML = '<div class="sysconf"><div class="sc-title">System Configurations</div><table>' +
        row('CPU Type', 'AMD-K6(tm)-2', 'Base Memory', '640K') +
        row('Co-Processor', 'Installed', 'Extended Memory', '31744K') +
        row('CPU Clock', '500MHz', 'Cache Memory', '512K') +
        '</table><div class="sc-rule"></div><table>' +
        row('Diskette Drive A', '1.44M, 3.5 in.', 'Display Type', 'EGA/VGA') +
        row('Diskette Drive B', 'None', 'Serial Port(s)', '3F8 2F8') +
        row('Pri. Master Disk', 'LBA ,Mode 4, 2111MB', 'Parallel Port(s)', '378') +
        row('Pri. Slave  Disk', 'None', 'SDRAM at Row(s)', '0 1') +
        row('Sec. Master Disk', 'CDROM,Mode 4', '', '') +
        row('Sec. Slave  Disk', 'None', '', '') +
        '</table></div>\n' +
        'PCI device listing.....\n' +
        'Bus No. Device No. Func No. Vendor ID  Device ID  Device Class\n' +
        '-------------------------------------------------------------------\n' +
        '   0        7         1      1106       0571      IDE Controller\n' +
        '   0        9         0      5333       8904      Display Controller\n' +
        '   0       11         0      12B9       1008      Simple COMM. Controller\n' +
        '   0       13         0      1102       0002      Multimedia Device\n';
      U.sound('hddSeek', 600);
      return pause(2600).then(function () {
        text.innerHTML += 'Verifying DMI Pool Data ........\n';
        return pause(900);
      });
    }
  }

  function startingWindows() {
    var el = setStage(h('div', { id: 'bios', className: 'stage crt' }));
    el.innerHTML = '\nStarting Windows 98...\n\n<span class="cursor"></span>';
    U.sound('hddSeek', 900);
    return pause(fastBoot() ? 600 : 1800);
  }

  // =====================================================================
  // Windows 98 splash
  // =====================================================================
  var skyCache = null;
  function skyCanvas() {
    var c = h('canvas', { className: 'sky' });
    var W = 320, H = 240;
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    if (skyCache) { ctx.putImageData(skyCache, 0, 0); return c; }
    // Sky gradient + fractal value-noise clouds.
    var img = ctx.createImageData(W, H), d = img.data;
    var seed = 1998;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var G = 64, grid = [];
    for (var i = 0; i < G * G; i++) grid.push(rnd());
    function vnoise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      function g(a, b) { return grid[((a % G + G) % G) + ((b % G + G) % G) * G]; }
      var sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
      var a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * sx;
      var b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * sx;
      return a + (b - a) * sy;
    }
    function fbm(x, y) {
      var v = 0, amp = 0.55, f = 1;
      for (var o = 0; o < 6; o++) { v += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
      return v;
    }
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var t = y / H;
        // pale powder-blue sky, mostly covered in soft cloud
        var sr = 128 + 30 * t, sg = 170 + 25 * t, sb = 214 + 15 * t;
        var n = fbm(x / 80, y / 50 + 3.1);
        var cloud = Math.max(0, Math.min(1, (n - 0.36) * 2.4));
        var shade = 0.86 + 0.14 * Math.min(1, (fbm(x / 30 + 9, y / 18) - 0.2));
        var cr = 255 * shade, cg = 255 * shade, cb = 255 * Math.min(1, shade + 0.06);
        var k = (y * W + x) * 4;
        d[k] = sr + (cr - sr) * cloud;
        d[k + 1] = sg + (cg - sg) * cloud;
        d[k + 2] = sb + (cb - sb) * cloud;
        d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    skyCache = img;
    return c;
  }

  // The Windows 98 flag: four panes in a thick black waving frame, trailing a
  // trail of squares that dissolve to the left.
  function flagSvg() {
    function warp(u, v) {
      var x = 60 + u * 118 + v * 14 - 10 * Math.sin(v * Math.PI);
      var y = 40 + v * 130 - u * 26 - 16 * Math.sin(u * Math.PI);
      return [x, y];
    }
    function quad(u0, u1, v0, v1) {
      var pts = [], i, n = 14;
      for (i = 0; i <= n; i++) pts.push(warp(u0 + (u1 - u0) * i / n, v0));
      for (i = 0; i <= n; i++) pts.push(warp(u1, v0 + (v1 - v0) * i / n));
      for (i = n; i >= 0; i--) pts.push(warp(u0 + (u1 - u0) * i / n, v1));
      for (i = n; i >= 0; i--) pts.push(warp(u0, v0 + (v1 - v0) * i / n));
      return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z';
    }
    var out = '<defs>' +
      '<linearGradient id="fr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset=".5" stop-color="#050505"/><stop offset="1" stop-color="#2a2a2a"/></linearGradient>' +
      '<linearGradient id="pr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a1f"/><stop offset="1" stop-color="#e2400c"/></linearGradient>' +
      '<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ed24f"/><stop offset="1" stop-color="#5aa832"/></linearGradient>' +
      '<linearGradient id="pb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b8ad6"/><stop offset="1" stop-color="#2d5aa8"/></linearGradient>' +
      '<linearGradient id="py" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff04a"/><stop offset="1" stop-color="#f2c80f"/></linearGradient>' +
      '</defs>';
    // Trail: rows of squares following the wave, black near the flag, coloured further out.
    var rows = 8, colors = ['#555', '#ee5a17', '#ee5a17', '#5a5a5a', '#2f6fd0', '#2f6fd0', '#555', '#333'];
    for (var c = 1; c <= 7; c++) {
      for (var r = 0; r < rows; r++) {
        if (c >= 5 && (r + c) % 3 === 0) continue;
        if (c === 7 && r % 2) continue;
        var size = 0.085 - c * 0.006, gap = 0.135;
        var u0 = -0.03 - c * gap, v0 = (r + 0.5) / rows - size * 0.6;
        var fill = c <= 2 ? '#141414' : colors[r];
        out += '<path d="' + quad(u0, u0 + size, v0, v0 + size * 1.2) + '" fill="' + fill + '"/>';
      }
    }
    out += '<path d="' + quad(-0.06, 1.06, -0.06, 1.06) + '" fill="url(#fr)" stroke="#000" stroke-width="1.5"/>';
    var g = 0.045;
    [['pr', 0.03, 0.5 - g, 0.03, 0.5 - g], ['pg', 0.5 + g, 0.97, 0.03, 0.5 - g], ['pb', 0.03, 0.5 - g, 0.5 + g, 0.97], ['py', 0.5 + g, 0.97, 0.5 + g, 0.97]].forEach(function (p) {
      out += '<path d="' + quad(p[1], p[2], p[3], p[4]) + '" fill="url(#' + p[0] + ')"/>';
    });
    return '<svg class="flag" viewBox="-60 -10 270 210" xmlns="http://www.w3.org/2000/svg">' + out + '</svg>';
  }

  function splashStage(footer) {
    var el = h('div', { className: 'stage w98-splash' }, [
      skyCanvas(),
      h('div', { className: 'logo', innerHTML: flagSvg() +
        '<div class="words"><div class="ms">Microsoft<sup>&reg;</sup></div><div class="win"><b>Windows</b><sup>&reg;</sup><span class="num">98</span></div></div>' }),
      footer ? h('div', { className: 'footer' }, footer) : null,
      footer ? null : h('div', { className: 'bar' })
    ]);
    return el;
  }

  function splash() {
    setStage(splashStage());
    document.title = 'Windows 98';
    var seeks = setInterval(function () { if (Math.random() < 0.6) U.sound('hddSeek', 150 + Math.random() * 500); }, 700);
    return pause(fastBoot() ? 2200 : 6500).then(function () {
      clearInterval(seeks);
      setStage(h('div', { className: 'stage', style: { background: '#000' } }));
      return pause(700);
    });
  }

  // =====================================================================
  // Logon
  // =====================================================================
  function logon() {
    state = 'logon';
    document.body.classList.remove('busy');
    var stage = setStage(h('div', { id: 'logon-stage', className: 'stage' }));
    Shell.build(stage);
    // Hide the taskbar and icons until someone logs on.
    var taskbar = stage.querySelector('#taskbar');
    taskbar.style.visibility = 'hidden';
    stage.querySelectorAll('.desk-icon').forEach(function (n) { n.style.visibility = 'hidden'; });

    return new Promise(function (resolve) {
      var user = h('input', { type: 'text', value: Shell.user || '', maxlength: 20, spellcheck: 'false' });
      var pass = h('input', { type: 'password' });
      var ok = h('button', { className: 'btn default' }, 'OK');
      var cancel = h('button', { className: 'btn' }, 'Cancel');
      var content = h('div', { className: 'logon-body' }, [
        U.img('logoff', 32, { className: 'key' }),
        h('div', null, [
          h('div', null, 'Type a user name and password to log on to Windows.'),
          h('div', { className: 'fields' }, [
            h('label', null, [U.label('&User name:')]), user,
            h('label', null, [U.label('&Password:')]), pass
          ])
        ]),
        h('div', { className: 'buttons' }, [ok, cancel])
      ]);
      var win = WM.dialog({ title: 'Welcome to Windows', content: content, width: 420, closable: true, helpButton: true, onHelp: function () {
        WM.msgbox({ title: 'Welcome to Windows', icon: 'info', text: 'Type any name you like. Your name is only stored in this web browser.' });
      } });
      function submit() {
        Shell.user = (user.value.trim() || 'Guest').slice(0, 20);
        U.store.set('w98.user', Shell.user);
        win.close(true);
        resolve();
      }
      ok.addEventListener('click', submit);
      cancel.addEventListener('click', function () { user.value = user.value || 'Guest'; submit(); });
      win.onKey = function (e) {
        if (e.key === 'Enter') { submit(); return true; }
        if (e.key === 'Escape' && !e.ctrlKey) { user.value = user.value || 'Guest'; submit(); return true; }
        return false;
      };
      win.on('close', function () { resolve(); });
      setTimeout(function () { (user.value ? pass : user).focus(); }, 30);
    });
  }

  // =====================================================================
  // Desktop
  // =====================================================================
  function desktop() {
    state = 'desktop';
    document.body.classList.remove('busy');
    document.title = 'Windows 98';
    var stage = document.getElementById('logon-stage');
    if (!stage) {
      stage = setStage(h('div', { id: 'logon-stage', className: 'stage' }));
      Shell.build(stage);
    }
    // "Loading your personal settings": icons trickle in, then the taskbar and the sound.
    document.body.classList.add('busy');
    U.sound('hddSeek', 1200);
    setTimeout(function () {
      stage.querySelector('#taskbar').style.visibility = '';
      U.sound('startup');
    }, 500);
    var icons = stage.querySelectorAll('.desk-icon');
    icons.forEach(function (n, i) { setTimeout(function () { n.style.visibility = ''; }, 900 + i * 120); });
    setTimeout(function () {
      document.body.classList.remove('busy');
      if (!U.store.get('w98.welcomed', false)) {
        U.store.set('w98.welcomed', true);
        Shell.launch('welcome');
      }
      if (FS.repaired) {
        FS.repaired = false;
        WM.msgbox({ title: 'ScanDisk', icon: 'warning', text: 'ScanDisk found errors on drive C: and repaired them.\n\nSome files may have been lost.' });
      }
    }, 1200 + icons.length * 120);
  }

  // =====================================================================
  // Shut down / restart / log off
  // =====================================================================
  function shutdown(mode) {
    return WM.closeAll().then(function (ok) {
      if (!ok) return;
      Menu.closeAll();
      if (mode === 'standby') return standby();
      state = 'shutting';
      document.body.classList.add('busy');
      U.sound('shutdown');
      var stage = setStage(splashStage(mode === 'restart' ? 'Windows is restarting...' : 'Windows is shutting down.'));
      var seeks = setInterval(function () { U.sound('hddSeek', 200 + Math.random() * 400); }, 600);
      return U.wait(3800).then(function () {
        clearInterval(seeks);
        document.body.classList.remove('busy');
        if (mode === 'restart') {
          setStage(h('div', { className: 'stage', style: { background: '#000' } }));
          return U.wait(900).then(function () { U.sound('postBeep'); boot(true); });
        }
        var safe = setStage(h('div', { id: 'safe-screen', className: 'stage' }, [
          h('div', null, ["It's now safe to turn off", h('br'), 'your computer.', h('small', null, 'Click anywhere to press the power button')])
        ]));
        state = 'safe';
        document.title = "It's now safe to turn off your computer";
        function off() {
          safe.removeEventListener('click', off);
          document.removeEventListener('keydown', keyOff);
          powerOff();
        }
        function keyOff(e) { if (e.key === 'Enter' || e.key === ' ') off(); }
        safe.addEventListener('click', off);
        document.addEventListener('keydown', keyOff);
      });
    });
  }

  function powerOff() {
    state = 'powering-off';
    U.sound('powerOff');
    if (stageEl) {
      stageEl.classList.add('crt-off');
    }
    setTimeout(powerScreen, 900);
  }

  function standby() {
    state = 'standby';
    var black = h('div', { className: 'stage', style: { background: '#000', zIndex: 99999, cursor: 'none' } });
    machine.appendChild(black);
    function wake() {
      black.remove();
      document.removeEventListener('keydown', wake, true);
      state = 'desktop';
    }
    setTimeout(function () {
      black.addEventListener('pointerdown', wake);
      document.addEventListener('keydown', wake, true);
    }, 500);
  }

  function logoff() {
    Shell.setAolTray(false);
    U.sound('shutdown');
    setStage(h('div', { className: 'stage', style: { background: '#000' } }));
    U.wait(1200).then(function () { return logon(); }).then(desktop);
  }

  // Esc during start-up skips ahead.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state === 'booting') skipRequested = true;
  });

  window.Boot = {
    init: function () {
      machine = document.getElementById('machine');
      // Unlock audio on the first interaction (there's no power button in ?desktop
      // mode), and resume the context if the browser suspends it later. Cheap once running.
      var unlock = function () { if (window.Sound) Sound.unlock(); };
      document.addEventListener('pointerdown', unlock, true);
      document.addEventListener('keydown', unlock, true);
      // ?desktop in the URL jumps straight in (handy for development).
      if (/[?&]desktop\b/.test(location.search)) {
        state = 'booting';
        if (!Shell.user) Shell.user = 'Guest';
        desktop();
        return;
      }
      powerScreen();
    },
    shutdown: shutdown,
    logoff: logoff,
    flagSvg: function () { return flagSvg(); },
    splashStage: splashStage,
    get state() { return state; }
  };
})();

Boot.init();
