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
      .then(startingWindows)
      .then(splash)
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

  function post(isRestart) {
    var el = setStage(h('div', { id: 'bios', className: 'stage crt' + (isRestart ? '' : ' crt-on') }));
    if (!isRestart) U.sound('degauss');
    document.title = 'Compaq Presario';

    var lines = [];
    function render(extra) {
      el.innerHTML = lines.join('\n') + (extra || '') + '<span class="cursor"></span>';
    }
    function line(html) { lines.push(html); render(); }

    // 1. Compaq's quiet moment: a white block cursor blinking top-right. This is where
    //    you'd hit F10 for setup.
    el.innerHTML = '<span class="f10-cursor"></span>';
    U.sound('hddSpinUp');
    return pause(isRestart ? 900 : 2200).then(function () {
      // 2. Compaq logo screen with the classic "F10 = Setup" in the corner.
      var logo = h('div', { id: 'compaq-logo', className: 'stage' }, [
        h('div', { className: 'logo', innerHTML: 'COMPAQ' }),
        h('div', { className: 'presario' }, 'PRESARIO'),
        h('div', { className: 'f10' }, 'F10 = Setup')
      ]);
      el.appendChild(logo);
      return pause(2400).then(function () { logo.remove(); render(); });
    }).then(function () {
      // 3. Text POST.
      line('<span class="w">COMPAQ Presario System BIOS</span>  Version 4.10  (C) 1982-1998 Compaq Computer Corporation');
      line('');
      line('Intel(R) Pentium(R) processor with MMX(TM) technology  233 MHz');
      render('\nMemory Test :      0K');
      var total = 32768, shown = 0;
      return new Promise(function (resolve) {
        var iv = setInterval(function () {
          shown = Math.min(total, shown + (skipRequested ? total : 1024));
          render('\nMemory Test : ' + String(shown).padStart(6) + 'K');
          if (shown >= total) { clearInterval(iv); resolve(); }
        }, 45);
      });
    }).then(function () {
      lines.push('Memory Test :  32768K <span class="w">OK</span>');
      line('512K Pipeline Burst Cache');
      line('');
      return pause(400);
    }).then(function () {
      line('Detecting IDE Primary Master   ... <span class="w">QUANTUM FIREBALL ST2.1A</span>');
      U.sound('hddSeek', 300);
      return pause(700);
    }).then(function () {
      line('Detecting IDE Primary Slave    ... None');
      return pause(350);
    }).then(function () {
      line('Detecting IDE Secondary Master ... <span class="w">CD-ROM 24X</span>');
      return pause(500);
    }).then(function () {
      line('Detecting IDE Secondary Slave  ... None');
      line('');
      line('Floppy Drive A: ... <span class="w">1.44 MB 3&#189;"</span>');
      return Promise.race([U.sound('floppySeek'), pause(1600)]);
    }).then(function () {
      line('');
      line('Plug and Play BIOS Extension v1.0A');
      line('Initializing Plug and Play Cards...');
      line('  PnP Card #1 : <span class="w">Creative SB16 PnP</span>');
      line('  PnP Card #2 : <span class="w">U.S. Robotics 56K Voice Modem</span>');
      return pause(900);
    }).then(function () {
      line('');
      line('Verifying DMI Pool Data ........');
      U.sound('postBeep');
      return pause(900);
    }).then(function () {
      line('Boot from Hard Disk C:');
      U.sound('hddSeek', 500);
      return pause(700);
    });
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
        // deep blue at the top, lighter toward the horizon
        var sr = 40 + 70 * t, sg = 95 + 80 * t, sb = 200 + 45 * t;
        var n = fbm(x / 70, y / 38 + 3.1);
        var cloud = Math.max(0, Math.min(1, (n - 0.47) * 3.2));
        var shade = 0.78 + 0.22 * Math.min(1, (fbm(x / 30 + 9, y / 18) - 0.2));
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

  // The four-pane waving flag, drawn as warped quads.
  function flagSvg() {
    function warp(u, v) {
      var x = 18 + u * 100 + v * 6;
      var y = 8 + v * 92 - 12 * Math.sin(u * Math.PI) + 4 * Math.sin(u * Math.PI * 2) * (1 - v);
      return [x.toFixed(2), y.toFixed(2)];
    }
    function pane(u0, u1, v0, v1) {
      var pts = [], i, s = 12;
      for (i = 0; i <= s; i++) pts.push(warp(u0 + (u1 - u0) * i / s, v0));
      for (i = 0; i <= s; i++) pts.push(warp(u1, v0 + (v1 - v0) * i / s));
      for (i = s; i >= 0; i--) pts.push(warp(u0 + (u1 - u0) * i / s, v1));
      for (i = s; i >= 0; i--) pts.push(warp(u0, v0 + (v1 - v0) * i / s));
      return 'M' + pts.map(function (p) { return p.join(','); }).join('L') + 'Z';
    }
    var g = 0.035;
    var panes = [
      ['#f0461e', 0, 0.5 - g, 0, 0.5 - g], ['#43b02a', 0.5 + g, 1, 0, 0.5 - g],
      ['#1d6fe0', 0, 0.5 - g, 0.5 + g, 1], ['#ffc81e', 0.5 + g, 1, 0.5 + g, 1]
    ];
    var trail = '';
    // Trailing "pixels" to the left of each half of the flag.
    [[0.1, '#f0461e'], [0.3, '#f0461e'], [0.62, '#1d6fe0'], [0.82, '#1d6fe0']].forEach(function (r, ri) {
      for (var i = 0; i < 4; i++) {
        var size = 7 - i * 1.3, x = 10 - i * 9, y = 10 + r[0] * 90 + (ri % 2) * 2;
        trail += '<rect x="' + (x - size / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + size.toFixed(1) + '" height="' + size.toFixed(1) + '" fill="' + r[1] + '" opacity="' + (1 - i * 0.2) + '"/>';
      }
    });
    return '<svg class="flag" viewBox="-30 -10 160 125" xmlns="http://www.w3.org/2000/svg">' + trail +
      panes.map(function (p) { return '<path d="' + pane(p[1], p[2], p[3], p[4]) + '" fill="' + p[0] + '" stroke="rgba(0,0,0,.25)" stroke-width="0.8"/>'; }).join('') +
      '</svg>';
  }

  function splashStage(footer) {
    var el = h('div', { className: 'stage w98-splash' }, [
      skyCanvas(),
      h('div', { className: 'logo', innerHTML: flagSvg() + '<div class="words"><div class="ms">Microsoft<sup>&reg;</sup></div><div class="win">Windows<sup>&reg;</sup><span class="num">98</span></div></div>' }),
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
        if (e.key === 'Escape') { user.value = user.value || 'Guest'; submit(); return true; }
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
