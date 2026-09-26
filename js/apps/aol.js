/*
 * America Online 4.0.
 *
 * One AOL frame window (menu bar, toolbar, keyword bar) holding its own child
 * windows (MDI), just like the real client: Sign On, Welcome, Channels, Mail,
 * Buddy List, Instant Messages, chat, and web pages from the Wayback Machine.
 */
(function () {
  var h = U.h, D = window.AOLData;
  var STORE = 'w98.aol';
  var app = null;

  // ------------------------------------------------------------------ state
  function loadState() {
    var s = U.store.get(STORE, null) || {};
    s.names = s.names || [];
    s.mail = s.mail || {};
    s.profiles = s.profiles || {};
    s.favorites = s.favorites || [
      { label: 'Yahoo!', go: 'web:www.yahoo.com' }, { label: 'CNN Interactive', go: 'web:www.cnn.com' },
      { label: 'Space Jam', go: 'web:www2.warnerbros.com/spacejam/movie/jam.htm' }, { label: 'Weather', go: 'area:weather' }
    ];
    s.setup = Object.assign({ modemSounds: true, busySignals: true }, s.setup || {});
    return s;
  }
  function saveState() {
    if (!app) return;
    var copy = Object.assign({}, app.state);
    // Guests leave no trace.
    copy.mail = Object.assign({}, copy.mail);
    Object.keys(copy.mail).forEach(function (k) { if (/^Guest/.test(k)) delete copy.mail[k]; });
    U.store.set(STORE, copy);
  }

  function mailbox() {
    var sn = app.sn;
    if (!app.state.mail[sn]) app.state.mail[sn] = { inbox: D.starterMail(sn), sent: [], nextId: 10 };
    return app.state.mail[sn];
  }
  function unreadCount() { return app.sn ? mailbox().inbox.filter(function (m) { return m.unread; }).length : 0; }

  function say(text) { return U.sound('speak', text); }

  function alertBox(text, icon, title) {
    return WM.msgbox({ title: title || 'America Online', owner: app.win, icon: icon || 'info', text: text });
  }

  // ------------------------------------------------------------------ MDI
  function Mdi(area) {
    var kids = [], z = 10;
    var mdi = { kids: kids, active: null, onchange: null };

    mdi.find = function (kind) { return kids.filter(function (k) { return k.kind === kind; })[0] || null; };

    mdi.open = function (o) {
      if (o.kind) {
        var existing = mdi.find(o.kind);
        if (existing) { existing.focus(); return existing; }
      }
      o = Object.assign({ width: 420, height: 300, resizable: true, closable: true }, o);
      var ar = { w: area.clientWidth, h: area.clientHeight };
      var el = h('div', { className: 'window mdi-child' + (o.className ? ' ' + o.className : '') });
      var titleText = h('span', null, o.title);
      var titleImg = U.img(o.icon || 'aol', 16);
      var controls = h('div', { className: 'title-controls' });
      var bMin = h('button', { className: 't-min', 'aria-label': 'Minimize' });
      var bMax = h('button', { className: 't-max', 'aria-label': 'Maximize', disabled: !o.resizable });
      var bClose = h('button', { className: 't-close', 'aria-label': 'Close', disabled: !o.closable });
      controls.appendChild(bMin); controls.appendChild(bMax); controls.appendChild(bClose);
      var bar = h('div', { className: 'title-bar' }, [h('div', { className: 'title' }, [titleImg, titleText]), controls]);
      var body = h('div', { className: 'window-body' });
      el.appendChild(bar); el.appendChild(body);
      if (o.content) U.append(body, o.content);

      var w = Math.min(o.width, ar.w - 4), hh = Math.min(o.height, ar.h - 4);
      el.style.width = w + 'px';
      if (o.height !== 'auto') el.style.height = hh + 'px';
      var x = o.x, y = o.y;
      if (o.height === 'auto') { area.appendChild(el); hh = el.offsetHeight; }
      if (o.x === 'right') x = Math.max(0, ar.w - w - 4);
      if (x == null) x = Math.max(0, Math.round((ar.w - w) / 2) + (kids.length % 5) * 14 - 28);
      if (y == null) y = Math.max(0, Math.round((ar.h - hh) / 3) + (kids.length % 5) * 14 - 20);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      area.appendChild(el);

      var kid = { el: el, body: body, kind: o.kind, title: o.title, icon: o.icon, opts: o, handlers: {} };
      kid.setTitle = function (t) { kid.title = t; titleText.textContent = t; if (mdi.onchange) mdi.onchange(); };
      kid.on = function (ev, fn) { (kid.handlers[ev] = kid.handlers[ev] || []).push(fn); };
      kid.fire = function (ev) { (kid.handlers[ev] || []).forEach(function (fn) { fn(); }); };
      kid.focus = function () {
        if (kid.minimized) restoreMin();
        el.style.zIndex = ++z;
        if (mdi.active !== kid) {
          if (mdi.active) mdi.active.el.classList.remove('active');
          mdi.active = kid;
          el.classList.add('active');
          kid.fire('focus');
          if (mdi.onchange) mdi.onchange();
        }
      };
      kid.close = function (force) {
        if (kid.closed) return;
        if (!force && o.onClose && o.onClose() === false) return;
        kid.closed = true;
        kid.fire('close');
        el.remove();
        kids.splice(kids.indexOf(kid), 1);
        if (mdi.active === kid) {
          mdi.active = null;
          var top = kids.slice().sort(function (a, b) { return (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0); })[0];
          if (top) top.focus();
        }
        if (mdi.onchange) mdi.onchange();
      };
      function toggleMax() {
        if (kid.maximized) {
          Object.assign(el.style, kid.restore);
          kid.maximized = false; el.classList.remove('maximized'); bMax.className = 't-max';
        } else {
          kid.restore = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
          Object.assign(el.style, { left: '-3px', top: '-3px', width: 'calc(100% + 6px)', height: 'calc(100% + 6px)' });
          kid.maximized = true; el.classList.add('maximized'); bMax.className = 't-restore';
        }
      }
      function restoreMin() {
        kid.minimized = false; el.classList.remove('mdi-min');
        Object.assign(el.style, kid.beforeMin);
      }
      kid.toggleMax = toggleMax;
      bMax.addEventListener('click', toggleMax);
      bClose.addEventListener('click', function () { kid.close(); });
      bMin.addEventListener('click', function (e) {
        e.stopPropagation();
        if (kid.minimized) { restoreMin(); return; }
        if (kid.maximized) toggleMax();
        kid.beforeMin = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
        var n = kids.filter(function (k) { return k.minimized; }).length;
        kid.minimized = true; el.classList.add('mdi-min');
        Object.assign(el.style, { left: (n * 164) + 'px', top: (area.clientHeight - 24) + 'px', width: '160px', height: '24px' });
      });
      controls.addEventListener('pointerdown', function (e) { e.stopPropagation(); kid.focus(); });
      bar.addEventListener('dblclick', function () { if (o.resizable) toggleMax(); });
      bar.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        kid.focus();
        if (kid.maximized) return;
        var sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
        WM.drag(e, function (ev) {
          el.style.left = U.clamp(ox + ev.clientX - sx, -el.offsetWidth + 40, area.clientWidth - 40) + 'px';
          el.style.top = U.clamp(oy + ev.clientY - sy, 0, area.clientHeight - 20) + 'px';
        });
      });
      if (o.resizable) {
        var grip = h('div', { className: 'resize-grip' });
        grip.addEventListener('pointerdown', function (e) {
          e.stopPropagation(); kid.focus();
          var sx = e.clientX, sy = e.clientY, w0 = el.offsetWidth, h0 = el.offsetHeight;
          WM.drag(e, function (ev) {
            el.style.width = Math.max(200, w0 + ev.clientX - sx) + 'px';
            el.style.height = Math.max(120, h0 + ev.clientY - sy) + 'px';
          }, 'nwse-resize');
        });
        el.appendChild(grip);
      }
      el.addEventListener('pointerdown', function () { kid.focus(); }, true);
      kids.push(kid);
      kid.focus();
      if (o.maximized) toggleMax();
      return kid;
    };

    mdi.closeAll = function (except) {
      kids.slice().forEach(function (k) { if (k !== except) k.close(true); });
    };
    mdi.cascade = function () {
      kids.forEach(function (k, i) {
        if (k.maximized) k.toggleMax();
        k.el.style.left = (i * 22) + 'px'; k.el.style.top = (i * 22) + 'px'; k.focus();
      });
    };
    return mdi;
  }

  // ------------------------------------------------------------------ frame
  // AOL's loading splash, then the client itself.
  var splashing = false;
  function launch(arg) {
    if (app && !app.win.closed) { WM.focus(app.win); if (arg && app.online) go(arg); return app.win; }
    if (splashing) return null;
    splashing = true;
    var splash = h('div', { className: 'aol-splash' }, [
      U.img('aol-logo', 64),
      h('div', { className: 'as-text' }, [h('div', { className: 'as-name' }, 'America Online'), h('div', { className: 'as-ver' }, 'Version 4.0 for Windows 95/98')]),
      h('div', { className: 'as-load' }, 'Loading...')
    ]);
    document.getElementById('desktop').appendChild(splash);
    document.body.classList.add('busy');
    U.sound('hddSeek', 1400);
    setTimeout(function () {
      splash.remove();
      document.body.classList.remove('busy');
      splashing = false;
      // Logged off or shut down while loading? Then don't pop up afterwards.
      if (Shell.ready() && document.body.contains(document.getElementById('desktop'))) openClient(arg);
    }, 1600);
    return null;
  }

  function openClient(arg) {

    app = { state: loadState(), online: false, sn: null, timers: [], connecting: null };

    var toolbarSpec = [
      { id: 'read', label: 'Read', icon: 'aol-read', act: function () { area('mailbox'); } },
      { id: 'write', label: 'Write', icon: 'aol-write', act: function () { area('write'); } },
      { id: 'mailcenter', label: 'Mail Center', icon: 'aol-mailcenter', menu: function () {
        return [
          { label: 'Read Mail', icon: 'aol-read', action: function () { area('mailbox'); } },
          { label: 'Write Mail', icon: 'aol-write', action: function () { area('write'); } },
          { label: 'Old Mail', action: function () { area('mailbox', 'old'); } },
          { label: 'Sent Mail', action: function () { area('mailbox', 'sent'); } }
        ];
      } },
      { id: 'print', label: 'Print', icon: 'aol-print', menu: function () {
        return [{ label: 'Print...', action: function () { alertBox('No printer is installed.\n\nTo install a printer, open Printers in My Computer.', 'warning'); } }];
      } },
      { id: 'myfiles', label: 'My Files', icon: 'aol-myfiles', menu: function () {
        return [
          { label: 'Personal Filing Cabinet', action: function () { area('mailbox'); } },
          { label: 'Download Manager', action: function () { alertBox('There are no files waiting to be downloaded.'); } },
          { label: 'My Documents (C:)', action: function () { Shell.open('C:\\My Documents'); } }
        ];
      } },
      { id: 'myaol', label: 'My AOL', icon: 'aol-myaol', menu: function () {
        return [
          { label: 'My Member Profile', action: function () { area('profile'); } },
          { label: 'Screen Names', action: function () { area('names'); } },
          { label: 'Parental Controls', action: function () { area('parental'); } },
          { label: 'Buddy List', action: function () { area('buddy'); } },
          '-',
          { label: 'Preferences', action: setupDialog }
        ];
      } },
      { id: 'favorites', label: 'Favorites', icon: 'aol-favorites', menu: favoritesMenu },
      { id: 'internet', label: 'Internet', icon: 'aol-internet', menu: function () {
        return [
          { label: 'Go to the Web', icon: 'aol-internet', action: function () { go('www.aol.com'); } },
          { label: 'Search the Web', icon: 'find', action: function () { go('www.altavista.com'); } },
          { label: 'Internet Explorer', icon: 'ie', action: function () { Shell.launch('ie'); } },
          '-',
          { label: 'Time Travel', items: function () {
            return [1996, 1997, 1998, 1999, 2000, 2001].map(function (y) {
              return { label: 'The web of ' + y, checked: Web.year() === y, action: function () { Web.setYear(y); var k = activeWeb(); if (k) k.pane.reload(); } };
            });
          } }
        ];
      } },
      { id: 'channels', label: 'Channels', icon: 'aol-channels', menu: function () {
        return [{ label: 'Channels', icon: 'aol-channels', action: function () { area('channels'); } }, '-'].concat(
          D.CHANNELS.filter(function (c) { return c.id !== 'welcome'; }).map(function (c) { return { label: c.name, action: function () { openChannel(c.id); } }; }));
      } },
      { id: 'people', label: 'People', icon: 'aol-people', menu: function () {
        return [
          { label: 'People Connection', icon: 'aol-chat', action: function () { area('chat'); } },
          { label: 'Chat Now', action: function () { area('chat'); } },
          { label: 'Buddy List', icon: 'aol-buddy', action: function () { area('buddy'); } },
          { label: 'Send Instant Message', icon: 'aol-im', action: function () { area('im'); } },
          { label: 'Member Directory', action: function () { alertBox('Your search found 22,000,000 members. Please narrow your search.'); } }
        ];
      } },
      { id: 'quotes', label: 'Quotes', icon: 'aol-quotes', act: function () { area('quotes'); } },
      { id: 'perks', label: 'Perks', icon: 'aol-perks', act: function () { area('perks'); } },
      { id: 'weather', label: 'Weather', icon: 'aol-weather', act: function () { area('weather'); } }
    ];

    var toolbar = h('div', { className: 'aol-toolbar' });
    toolbarSpec.forEach(function (t) {
      var b = h('button', { className: 'aol-tb', dataset: { id: t.id }, title: t.label }, [
        U.img(t.icon, 32), h('span', null, [t.label, t.menu ? h('i', { className: 'drop' }) : null])
      ]);
      b.addEventListener('click', function () {
        if (!app.online) { mustSignOn(); return; }
        if (t.menu) { var r = b.getBoundingClientRect(); Menu.popup(t.menu(), r.left, r.bottom); }
        else t.act();
      });
      b.addEventListener('pointerdown', function (e) { if (t.menu) e.stopPropagation(); });
      toolbar.appendChild(b);
    });

    var kwInput = h('input', { type: 'text', className: 'aol-kw', placeholder: 'Type Keyword or Web Address here and click Go', spellcheck: 'false', autocomplete: 'off' });
    function navBtn(icon, title, fn) {
      var b = h('button', { className: 'aol-nav-btn', title: title }, U.img(icon, 16));
      b.addEventListener('click', function () { if (!app.online) { mustSignOn(); return; } fn(); });
      return b;
    }
    var bBack = navBtn('aol-back', 'Back', function () { var k = activeWeb(); if (k) k.pane.back(); });
    var bFwd = navBtn('aol-forward', 'Forward', function () { var k = activeWeb(); if (k) k.pane.forward(); });
    var bStop = navBtn('aol-stop', 'Stop', function () { var k = activeWeb(); if (k) k.pane.stop(); });
    var bReload = navBtn('aol-reload', 'Reload', function () { var k = activeWeb(); if (k) k.pane.reload(); });
    var bHome = navBtn('aol-home', 'Home: Welcome', function () { area('welcome'); });
    var goBtn = h('button', { className: 'btn aol-go' }, 'Go');
    var findBtn = h('button', { className: 'btn aol-small' }, 'Find');
    var kwBtn = h('button', { className: 'btn aol-small' }, [U.img('aol-keyword', 16), 'Keyword']);
    goBtn.addEventListener('click', function () { submitKeyword(); });
    findBtn.addEventListener('click', function () { if (!app.online) return mustSignOn(); go('www.altavista.com'); });
    kwBtn.addEventListener('click', function () { if (!app.online) return mustSignOn(); area('keyword'); });
    kwInput.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); submitKeyword(); }
    });
    // Clicking into the box selects what's there, so typing replaces it.
    var kwFresh = false;
    kwInput.addEventListener('pointerdown', function () { kwFresh = document.activeElement !== kwInput; });
    kwInput.addEventListener('pointerup', function (e) { if (kwFresh) { e.preventDefault(); kwInput.select(); } kwFresh = false; });
    kwInput.addEventListener('focus', function () { kwInput.select(); });
    function submitKeyword() {
      if (!app.online) { mustSignOn(); return; }
      var v = kwInput.value.trim();
      if (!v) return;
      kwInput.value = '';
      kwInput.blur();
      go(v);
      app.syncNav();
    }

    var navbar = h('div', { className: 'aol-navbar' }, [bBack, bFwd, bStop, bReload, bHome,
      h('div', { className: 'aol-kw-wrap' }, [kwInput]), goBtn, findBtn, kwBtn]);

    var mdiArea = h('div', { className: 'aol-mdi' });

    var win = WM.open({
      app: 'aol', title: 'America Online', icon: 'aol', width: 860, height: 620, maximized: window.innerWidth < 1100,
      className: 'aol', shield: false,
      content: h('div', { className: 'aol-frame' }, [toolbar, navbar, mdiArea]),
      onClose: function () {
        if (!app.online && !app.connecting) return true;
        return WM.msgbox({ title: 'America Online', owner: win, icon: 'question', buttons: ['&Yes', '&No'],
          text: 'Are you sure you want to sign off and exit America Online?' }).then(function (b) {
          if (b !== '&Yes') return false;
          signOff(true);
          return true;
        });
      }
    });
    app.win = win;
    app.toolbar = toolbar;
    app.kwInput = kwInput;
    app.mdi = Mdi(mdiArea);
    app.mdi.onchange = syncNav;
    win.on('close', function () { stopTimers(); if (app.connecting) app.connecting.cancel(); Shell.setAolTray(false); app = null; });

    function syncNav() {
      var k = activeWeb();
      bBack.disabled = !(k && k.pane.canBack());
      bFwd.disabled = !(k && k.pane.canForward());
      if (k && document.activeElement !== kwInput) kwInput.value = k.pane.url;
      else if (document.activeElement !== kwInput && app.mdi.active && !/^web/.test(app.mdi.active.kind || '')) kwInput.value = '';
    }
    app.syncNav = syncNav;

    Menu.bar(win, [
      { label: '&File', items: [
        { label: '&New', action: function () { if (app.online) area('write'); else mustSignOn(); } },
        { label: '&Open...', action: function () { Shell.launch('notepad'); } },
        '-',
        { label: '&Download Manager', action: function () { alertBox('There are no files waiting to be downloaded.'); } },
        '-',
        { label: 'E&xit', action: function () { win.close(); } }
      ] },
      { label: '&Edit', items: [
        { label: 'Cu&t', shortcut: 'Ctrl+X', action: function () { document.execCommand('cut'); } },
        { label: '&Copy', shortcut: 'Ctrl+C', action: function () { document.execCommand('copy'); } },
        { label: '&Paste', shortcut: 'Ctrl+V', action: function () { document.execCommand('paste'); } },
        '-',
        { label: 'Spell Check', action: function () { alertBox('No misspellings were found. Congratulations!'); } },
        { label: 'Dictionary', action: function () { go('www.dictionary.com'); } }
      ] },
      { label: '&Window', items: function () {
        var list = [
          { label: '&Cascade', action: function () { app.mdi.cascade(); } },
          { label: 'Close &All Except Front', action: function () { app.mdi.closeAll(app.mdi.active); } },
          '-'
        ];
        app.mdi.kids.forEach(function (k, i) { list.push({ label: (i + 1) + ' ' + k.title, checked: k === app.mdi.active, action: k.focus }); });
        return list;
      } },
      { label: '&Sign Off', items: function () {
        return app.online ? [
          { label: '&Sign Off', action: function () { signOff(); } },
          { label: 'S&witch Screen Name', action: function () { signOff(); } }
        ] : [{ label: '&Sign On', action: showSignOn }];
      } },
      { label: '&Help', items: [
        { label: '&Offline Help', action: function () { area('help', null, true); } },
        { label: '&Parental Controls', action: function () { if (app.online) area('parental'); else mustSignOn(); } },
        '-',
        { label: '&About America Online', action: about }
      ] }
    ]);

    win.onKey = function (e) {
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        if (app.online) area('keyword'); else mustSignOn();
        return true;
      }
      return false;
    };

    setOnlineUi(false);
    Shell.setAolTray(false);
    U.sound('hddSeek', 900);
    showSignOn();
    return win;
  }

  function setOnlineUi(on) {
    app.toolbar.classList.toggle('offline', !on);
    app.kwInput.disabled = !on;
    app.win.el.classList.toggle('aol-online', on);
  }

  function mustSignOn() {
    alertBox('You must be signed on to America Online to use this feature.\n\nClick SIGN ON to connect.', 'info');
  }

  function stopTimers() {
    if (!app) return;
    app.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    app.timers = [];
  }
  function later(ms, fn) { var t = setTimeout(fn, ms); app.timers.push(t); return t; }
  function every(ms, fn) { var t = setInterval(fn, ms); app.timers.push(t); return t; }

  function about() {
    WM.msgbox({ title: 'About America Online', owner: app && app.win, icon: 'aol', sound: null,
      text: 'America Online for Windows 95/98\nVersion 4.0\n\nThis is a loving re-creation, not the real thing. AOL areas are simulated, and the web is served from the Internet Archive\'s Wayback Machine. The voice uses your computer\'s built-in speech.\n\nSo long, and thanks for all the free hours.' });
  }

  // ------------------------------------------------------------------ Sign On
  function showSignOn(goodbye) {
    var s = app.state;
    var sel = h('select', { className: 'field' });
    s.names.forEach(function (n) { sel.appendChild(h('option', { value: n }, n)); });
    sel.appendChild(h('option', { value: '__new' }, 'New User'));
    sel.appendChild(h('option', { value: '__guest' }, 'Guest'));
    if (s.lastName && s.names.indexOf(s.lastName) !== -1) sel.value = s.lastName;
    var pass = h('input', { type: 'password', className: 'field', placeholder: '' });
    var loc = h('select', { className: 'field' }, [h('option', null, 'Home'), h('option', null, 'Home (TCP/IP)'), h('option', null, 'Visiting Grandma')]);
    var passRow = h('div', { className: 'so-row' }, [h('label', null, 'Enter Password:'), pass]);
    function updatePassRow() {
      var special = sel.value === '__new' || sel.value === '__guest';
      pass.disabled = special;
      if (special) pass.value = '';
      passRow.classList.toggle('disabled', special);
    }
    sel.addEventListener('change', updatePassRow);
    updatePassRow();

    var signOnBtn = h('button', { className: 'aol-btn big default' }, 'SIGN ON');
    var setupBtn = h('button', { className: 'aol-btn' }, 'SETUP');
    var accessBtn = h('button', { className: 'aol-btn' }, 'ACCESS NUMBERS');
    var helpBtn = h('button', { className: 'aol-btn' }, 'HELP');

    var form = h('div', { className: 'so-form' }, [
      h('div', { className: 'so-row' }, [h('label', null, 'Select Screen Name:'), sel]),
      passRow,
      h('div', { className: 'so-row' }, [h('label', null, 'Select Location:'), loc])
    ]);
    var progress = h('div', { className: 'so-progress hidden' });
    var buttons = h('div', { className: 'so-buttons' }, [setupBtn, accessBtn, helpBtn, signOnBtn]);

    var content = h('div', { className: 'signon' }, [
      h('div', { className: 'so-art' }, [
        U.img('aol-logo', 64),
        h('div', { className: 'so-brand' }, [h('div', { className: 'so-name' }, 'America Online'), h('div', { className: 'so-ver' }, 'for Windows 95/98  \u2022  Version 4.0')])
      ]),
      form, progress, buttons
    ]);

    var kid = app.mdi.open({ kind: 'signon', title: goodbye ? 'Goodbye from America Online!' : 'Sign On', icon: 'aol', width: 440, height: 'auto', resizable: false, closable: false, content: content, className: 'aol-signon' });
    if (!goodbye) kid.setTitle('Sign On');

    setupBtn.addEventListener('click', setupDialog);
    accessBtn.addEventListener('click', function () { alertBox('Access numbers for Home:\n\n1-800-555-0142  (V.90, 56K)\n1-800-555-0199  (V.34, 33.6K)\n\nMake sure your access numbers are local calls!'); });
    helpBtn.addEventListener('click', function () { area('help', null, true); });
    signOnBtn.addEventListener('click', start);
    pass.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') start(); });

    function start() {
      if (app.connecting) return;
      var v = sel.value;
      if (v !== '__new' && v !== '__guest' && !pass.value) {
        alertBox('Please enter your password.', 'warning').then(function () { pass.focus(); });
        return;
      }
      connect({ name: v, form: form, buttons: buttons, progress: progress, kid: kid });
    }

    setTimeout(function () { if (pass.disabled) signOnBtn.focus(); else pass.focus(); }, 50);
    return kid;
  }

  function setupDialog() {
    var s = app.state.setup;
    var snd = h('input', { type: 'checkbox', checked: s.modemSounds });
    var busy = h('input', { type: 'checkbox', checked: s.busySignals });
    var year = h('select', { className: 'field' }, [1996, 1997, 1998, 1999, 2000, 2001].map(function (y) { return h('option', { value: y, selected: y === Web.year() }, String(y)); }));
    var ok = h('button', { className: 'btn default' }, 'OK');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var d = WM.dialog({ title: 'America Online Setup', owner: app.win, width: 380, content: h('div', { className: 'aol-setup' }, [
      h('fieldset', { className: 'group' }, [h('legend', null, 'Connection'),
        h('p', null, 'Modem: U.S. Robotics 56K Voice (COM2)'), h('p', null, 'Access number: 1-800-555-0142'),
        h('label', { className: 'check' }, [snd, 'Play the modem sounds while connecting']),
        h('label', { className: 'check' }, [busy, 'Realistic busy signals (sometimes!)'])
      ]),
      h('fieldset', { className: 'group' }, [h('legend', null, 'Time Travel'),
        h('label', null, ['Show me the World Wide Web of ', year]),
        h('p', { className: 'note' }, 'Web pages come from the Internet Archive\'s Wayback Machine.')
      ]),
      h('div', { className: 'button-row right' }, [ok, cancel])
    ]) });
    ok.addEventListener('click', function () {
      s.modemSounds = snd.checked; s.busySignals = busy.checked;
      Web.setYear(+year.value);
      saveState();
      d.close(true);
    });
    cancel.addEventListener('click', function () { d.close(true); });
  }

  // The dial-up sequence, synchronised with the modem sound.
  function connect(ctx) {
    var s = app.state.setup;
    var busyFirst = s.busySignals && Math.random() < 0.2;
    var withSound = s.modemSounds && !(window.Sound && Sound.muted);
    var T = window.Sound && (busyFirst ? Sound.DIALUP_TIMELINE_BUSY : Sound.DIALUP_TIMELINE);
    if (!T) T = busyFirst
      ? { dtmf: 1.3, busy: 3.1, redialDtmf: 8.1, answer: 12.95, training: 18.86, connected: 23.45 }
      : { dtmf: 1.9, answer: 6.75, training: 12.66, connected: 17.25 };
    var scale = withSound ? 1 : 0.28;

    var panels = ['aol-step-modem', 'aol-step-runner', 'aol-step-people'].map(function (n) { return h('div', { className: 'so-panel dim' }, U.img(n, 64)); });
    var stepText = h('div', { className: 'so-step' }, '');
    var cancelBtn = h('button', { className: 'aol-btn' }, 'CANCEL');
    ctx.progress.innerHTML = '';
    U.append(ctx.progress, [h('div', { className: 'so-panels' }, panels), stepText]);
    ctx.form.classList.add('hidden');
    ctx.progress.classList.remove('hidden');
    ctx.buttons.classList.add('connecting');
    var oldButtons = Array.prototype.slice.call(ctx.buttons.children);
    oldButtons.forEach(function (b) { b.classList.add('hidden'); });
    ctx.buttons.appendChild(cancelBtn);

    var timers = [], modem = null, cancelled = false;
    function at(sec, fn) { timers.push(setTimeout(function () { if (!cancelled) fn(); }, sec * 1000)); }
    function step(n, text, lit) {
      stepText.textContent = 'Step ' + n + ': ' + text;
      panels.forEach(function (p, i) {
        p.classList.toggle('dim', i > lit);
        p.classList.toggle('active', i === lit);
      });
    }

    function reset() {
      timers.forEach(clearTimeout);
      if (modem) modem.stop();
      app.connecting = null;
      if (ctx.kid.closed) return;
      ctx.form.classList.remove('hidden');
      ctx.progress.classList.add('hidden');
      ctx.buttons.classList.remove('connecting');
      cancelBtn.remove();
      oldButtons.forEach(function (b) { b.classList.remove('hidden'); });
    }

    app.connecting = { cancel: function () { cancelled = true; reset(); } };
    cancelBtn.addEventListener('click', function () { app.connecting.cancel(); });

    step(1, 'Initializing Modem', 0);
    var t0 = 1.4;
    // Sound.dialup returns { promise, stop }; call it directly so Cancel can hang up.
    at(t0, function () {
      if (withSound && window.Sound && Sound.dialup) modem = Sound.dialup({ busyFirst: busyFirst });
    });
    at(t0 + T.dtmf * scale, function () { step(2, 'Dialing 1-800-555-0142...', 0); });
    if (busyFirst) {
      at(t0 + T.busy * scale, function () { step(2, 'The number is busy. Trying again...', 0); });
      at(t0 + T.redialDtmf * scale, function () { step(2, 'Dialing 1-800-555-0199...', 0); });
    }
    at(t0 + T.answer * scale, function () { step(3, 'Connecting...', 1); });
    at(t0 + T.training * scale, function () { step(3, 'Connecting at 49,333 bps...', 1); });
    var tc = t0 + T.connected * scale;
    at(tc, function () { step(4, 'Requesting network attention', 1); panels[1].classList.add('active'); });
    at(tc + 2.2 * (withSound ? 1 : 0.5), function () { step(5, 'Talking to network', 2); });
    at(tc + 4.2 * (withSound ? 1 : 0.5), function () { step(6, 'Checking password', 2); });
    at(tc + 5.8 * (withSound ? 1 : 0.5), function () {
      app.connecting = null;
      if (modem) modem.stop();
      chooseName(ctx.name).then(function (sn) {
        if (!sn) { reset(); return; }
        ctx.kid.close(true);
        onConnected(sn);
      });
    });
  }

  // New users pick a screen name; guests get a random one.
  function chooseName(v) {
    if (v === '__guest') return Promise.resolve('Guest' + Math.floor(1000 + Math.random() * 9000));
    if (v !== '__new') return Promise.resolve(v);
    return new Promise(function (resolve) {
      var input = h('input', { type: 'text', className: 'field', maxlength: 10, spellcheck: 'false', value: (Shell.user || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 7) + Math.floor(10 + Math.random() * 89) });
      var ok = h('button', { className: 'btn default' }, 'Continue');
      var err = h('div', { className: 'aol-err' });
      var done = false;
      var d = WM.dialog({ title: 'Welcome to America Online!', owner: app.win, width: 380, content: h('div', { className: 'aol-newuser' }, [
        h('div', { className: 'nu-head' }, [U.img('aol-logo', 32), h('b', null, 'Choose Your Screen Name')]),
        h('p', null, 'Your screen name is what other members will know you by. It must be 3 to 10 characters long and may contain letters, numbers and spaces.'),
        h('label', null, ['Screen Name: ', input]), err,
        h('div', { className: 'button-row right' }, [ok])
      ]) });
      function submit() {
        var sn = input.value.trim().replace(/\s+/g, ' ');
        if (!/^[A-Za-z][A-Za-z0-9 ]{2,9}$/.test(sn)) { err.textContent = 'Screen names must be 3-10 characters and start with a letter.'; U.sound('chord'); return; }
        if (app.state.names.some(function (n) { return n.toLowerCase() === sn.toLowerCase(); }) || /^(guest|aol|onlinehost)/i.test(sn)) {
          err.textContent = 'The screen name ' + sn + ' is already taken. Please try ' + sn.slice(0, 7) + Math.floor(100 + Math.random() * 899) + '.'; U.sound('chord'); return;
        }
        app.state.names.push(sn);
        saveState();
        done = true;
        d.close(true);
        resolve(sn);
      }
      ok.addEventListener('click', submit);
      input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') submit(); });
      d.on('close', function () { if (!done) resolve(null); });
      setTimeout(function () { input.focus(); input.select(); }, 0);
    });
  }

  function onConnected(sn) {
    app.online = true;
    app.sn = sn;
    if (!/^Guest/.test(sn)) app.state.lastName = sn;
    saveState();
    setOnlineUi(true);
    Shell.setAolTray(true);
    app.win.setTitle('America Online - ' + sn);
    area('buddy');
    area('welcome');
    say('Welcome!').then(function () {
      if (!app || !app.online) return;
      if (unreadCount()) return U.wait(250).then(function () { return say("You've got mail!"); });
    });
    startBuddySim();
  }

  function signOff(exiting) {
    if (!app) return;
    stopTimers();
    var wasOnline = app.online;
    app.online = false;
    app.sn = null;
    app.mdi.closeAll();
    setOnlineUi(false);
    Shell.setAolTray(false);
    app.win.setTitle('America Online');
    app.kwInput.value = '';
    if (wasOnline) { U.sound('doorClose'); say('Goodbye!'); }
    if (!exiting) showSignOn(true).setTitle('Goodbye from America Online!');
  }

  // ------------------------------------------------------------------ navigation
  function go(text) {
    text = String(text).trim();
    if (!text) return;
    var lower = text.toLowerCase().replace(/^keyword:\s*/, '');
    var target = D.KEYWORDS[lower];
    if (!target && (/^[a-z]+:\/\//i.test(text) || /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(text))) target = 'web:' + text;
    if (!target) { keywordNotFound(text); return; }
    dispatch(target);
  }

  function dispatch(target, ts) {
    var i = target.indexOf(':'), kind = target.slice(0, i), val = target.slice(i + 1);
    if (kind === 'area') return area(val);
    if (kind === 'channel') return openChannel(val);
    if (kind === 'web') return openWeb(val, ts);
    if (kind === 'msg') return alertBox(val);
  }

  function keywordNotFound(text) {
    var search = h('button', { className: 'btn' }, 'Search the Web');
    var list = h('button', { className: 'btn' }, 'Keyword List');
    var ok = h('button', { className: 'btn default' }, 'OK');
    var d = WM.dialog({ title: 'Keyword', owner: app.win, width: 360, content: h('div', { className: 'msgbox-wrap' }, [
      h('div', { className: 'msgbox' }, [U.img('info', 32), h('div', { className: 'text' }, '"' + text + '" is not a valid keyword.\n\nPlease check the spelling, or try one of these: NEWS, SPORTS, GAMES, WEATHER, KIDS ONLY, CHAT.')]),
      h('div', { className: 'button-row' }, [ok, search, list])
    ]) });
    U.sound('chord');
    ok.addEventListener('click', function () { d.close(true); });
    search.addEventListener('click', function () { d.close(true); openWeb('www.altavista.com'); });
    list.addEventListener('click', function () { d.close(true); area('keywordlist'); });
  }

  function activeWeb() {
    if (!app) return null;
    var a = app.mdi.active;
    if (a && a.pane) return a;
    return null;
  }

  function openWeb(url, ts) {
    var existing = app.mdi.kids.filter(function (k) { return k.pane; }).slice(-1)[0];
    if (existing) { existing.focus(); existing.pane.go(url, ts); return existing; }
    var pane = Web.pane({ icon: 'aol' });
    var kid = app.mdi.open({ kind: 'web', title: 'Loading...', icon: 'aol-internet', width: 720, height: 460, content: h('div', { className: 'aol-web sunken-panel' }, pane.el), className: 'aol-webwin' });
    kid.pane = pane;
    pane.onchange = function (what) {
      kid.setTitle(what === 'loading' ? 'Loading ' + (Web.host(pane.url) || '') + '...' : (Web.host(pane.url) || pane.url));
      app.syncNav();
    };
    kid.on('close', function () { pane.destroy(); });
    kid.on('focus', function () { app.syncNav(); });
    // Big windows get maximised within AOL on small screens.
    if (app.win.el.querySelector('.aol-mdi').clientWidth < 760) kid.toggleMax();
    pane.go(url, ts);
    return kid;
  }

  // ------------------------------------------------------------------ AOL areas
  var AREAS = {
    welcome: welcomeWindow,
    channels: channelsWindow,
    mailbox: mailboxWindow,
    write: function () { writeMail({}); },
    buddy: buddyList,
    im: sendImDialog,
    chat: chatRoom,
    quotes: quotesWindow,
    weather: weatherWindow,
    horoscopes: horoscopeWindow,
    help: helpWindow,
    keyword: keywordDialog,
    keywordlist: keywordList,
    parental: parentalControls,
    profile: profileWindow,
    names: namesWindow,
    perks: perksWindow
  };

  function area(id, arg, offlineOk) {
    if (!app.online && !offlineOk) { mustSignOn(); return null; }
    var fn = AREAS[id];
    return fn ? fn(arg) : null;
  }

  // -------------------------------------------- Welcome
  function welcomeWindow() {
    var unread = unreadCount();
    var mailBtn = h('button', { className: 'wl-mail' }, [U.img(unread ? 'aol-read' : 'aol-read-empty', 64), h('span', null, unread ? 'You Have Mail' : 'No New Mail')]);
    mailBtn.addEventListener('click', function () { area('mailbox'); });
    function side(label, icon, fn) {
      var b = h('button', { className: 'wl-side' }, [U.img(icon, 16), h('span', null, label)]);
      b.addEventListener('click', fn);
      return b;
    }
    var headlines = h('ul', { className: 'wl-news' }, D.HEADLINES.slice(0, 5).map(function (n) {
      var a = h('a', { href: '#' }, n.t);
      a.addEventListener('click', function (e) { e.preventDefault(); dispatch(n.go, n.when); });
      return h('li', null, a);
    }));
    function promo(title, sub, color, target) {
      var b = h('button', { className: 'wl-promo', style: { background: color } }, [h('b', null, title), h('span', null, sub)]);
      b.addEventListener('click', function () { dispatch(target); });
      return b;
    }
    var d = new Date();
    var content = h('div', { className: 'aol-welcome' }, [
      h('div', { className: 'wl-left' }, [
        mailBtn,
        side('Top News', 'aol-internet', function () { openChannel('news'); }),
        side('Channels', 'aol-channels', function () { area('channels'); }),
        side('People Connection', 'aol-chat', function () { area('chat'); }),
        side('Buddy List', 'aol-buddy', function () { area('buddy'); }),
        side('Keyword List', 'aol-keyword', function () { area('keywordlist'); })
      ]),
      h('div', { className: 'wl-main' }, [
        h('div', { className: 'wl-banner' }, [h('span', { className: 'wl-hello' }, 'Welcome, ' + app.sn + '!'), h('span', { className: 'wl-date' }, d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))]),
        h('div', { className: 'wl-today' }, [h('h3', null, 'Today on AOL'), headlines]),
        h('div', { className: 'wl-promos' }, [
          promo('Kids Only', 'Games, cartoons & fun', '#f4a300', 'channel:kids'),
          promo('Games', 'Play now!', '#d35400', 'channel:games'),
          promo('Entertainment', 'Movies & music', '#c2185b', 'channel:entertainment'),
          promo('The Web', 'Go surfing', '#1565c0', 'web:www.yahoo.com')
        ])
      ])
    ]);
    var kid = app.mdi.open({ kind: 'welcome', title: 'Welcome, ' + app.sn + '!', icon: 'aol', width: 560, height: 360, content: content, className: 'aol-welcome-win', x: 8, y: 8 });
    kid.refresh = function () {
      var u = unreadCount();
      mailBtn.querySelector('img').src = U.icon(u ? 'aol-read' : 'aol-read-empty', 64);
      mailBtn.querySelector('span').textContent = u ? 'You Have Mail' : 'No New Mail';
    };
    return kid;
  }
  function refreshWelcome() { var w = app && app.mdi.find('welcome'); if (w && w.refresh) w.refresh(); }

  // -------------------------------------------- Channels
  function channelsWindow() {
    var list = h('div', { className: 'ch-list' }, D.CHANNELS.map(function (c) {
      var b = h('button', { className: 'ch-btn', style: { '--c': c.color } }, c.name);
      b.addEventListener('click', function () { if (c.area) dispatch(c.area); else openChannel(c.id); });
      return b;
    }));
    return app.mdi.open({ kind: 'channels', title: 'Channels', icon: 'aol-channels', width: 170, height: 470, x: 0, y: 0, resizable: false, content: list, className: 'aol-channels' });
  }

  function openChannel(id) {
    var c = D.CHANNELS.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    if (c.area) return dispatch(c.area);
    var grid = h('div', { className: 'chw-grid' }, c.links.map(function (l) {
      var icon = /^web:/.test(l[1]) ? 'aol-internet' : /area:(mailbox|write)/.test(l[1]) ? 'aol-read' : /area:weather/.test(l[1]) ? 'aol-weather' : /area:quotes/.test(l[1]) ? 'aol-quotes' : /area:chat/.test(l[1]) ? 'aol-chat' : 'aol-channels';
      var b = h('button', { className: 'chw-link' }, [U.img(icon, 16), h('span', null, l[0])]);
      b.addEventListener('click', function () { dispatch(l[1]); });
      return b;
    }));
    var content = h('div', { className: 'aol-channel' }, [
      h('div', { className: 'chw-banner', style: { background: 'linear-gradient(90deg,' + c.color + ', #000 160%)' } }, [
        h('div', { className: 'chw-name' }, c.name), h('div', { className: 'chw-tag' }, c.tagline)
      ]),
      grid,
      h('div', { className: 'chw-foot' }, 'Keyword: ' + c.name.toUpperCase())
    ]);
    return app.mdi.open({ kind: 'channel:' + id, title: c.name, icon: 'aol-channels', width: 470, height: 330, content: content });
  }

  // -------------------------------------------- Mail
  function mailboxWindow(tab) {
    var kid = app.mdi.find('mailbox');
    if (kid) { kid.focus(); if (tab) kid.show(tab); return kid; }
    var cur = tab || 'new';
    var tabs = h('div', { className: 'tabs' });
    var table = h('table', { className: 'list-table mail-table' });
    var count = h('span', { className: 'mb-count' });
    var selected = null;
    ['new', 'old', 'sent'].forEach(function (t) {
      var b = h('div', { className: 'tab', dataset: { t: t } }, { new: 'New Mail', old: 'Old Mail', sent: 'Sent Mail' }[t]);
      b.addEventListener('click', function () { show(t); });
      tabs.appendChild(b);
    });
    function list() {
      var mb = mailbox();
      if (cur === 'sent') return mb.sent;
      return mb.inbox.filter(function (m) { return cur === 'new' ? m.unread : !m.unread; });
    }
    function show(t) {
      cur = t; selected = null;
      tabs.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.t === t); });
      table.innerHTML = '';
      table.appendChild(h('tr', null, [h('th', null, ''), h('th', null, 'Date'), h('th', null, cur === 'sent' ? 'To' : 'Sender'), h('th', { style: { width: '100%' } }, 'Subject')]));
      var msgs = list().slice().sort(function (a, b) { return b.date - a.date; });
      msgs.forEach(function (m) {
        var d = new Date(m.date);
        var tr = h('tr', null, [
          h('td', null, U.img(cur === 'new' ? 'envelope' : 'envelope-open', 16)),
          h('td', null, String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getFullYear()).slice(-2)),
          h('td', null, cur === 'sent' ? m.to : m.from),
          h('td', null, m.subj)
        ]);
        tr.addEventListener('click', function () { table.querySelectorAll('tr').forEach(function (r) { r.classList.remove('selected'); }); tr.classList.add('selected'); selected = m; });
        U.onActivate(tr, function () { readMail(m); });
        table.appendChild(tr);
      });
      count.textContent = msgs.length + ' message' + (msgs.length === 1 ? '' : 's');
    }
    function btn(label, fn) { var b = h('button', { className: 'aol-btn' }, label); b.addEventListener('click', fn); return b; }
    var content = h('div', { className: 'aol-mailbox' }, [
      tabs,
      h('div', { className: 'tab-panel mb-panel' }, [h('div', { className: 'sunken-panel mb-list' }, table), count]),
      h('div', { className: 'mb-buttons' }, [
        btn('Read', function () { if (selected) readMail(selected); }),
        btn('Keep As New', function () { if (selected && cur !== 'sent') { selected.unread = true; saveState(); refreshMail(); } }),
        btn('Delete', function () {
          if (!selected) return;
          var mb = mailbox(), arr = cur === 'sent' ? mb.sent : mb.inbox;
          arr.splice(arr.indexOf(selected), 1);
          saveState(); refreshMail();
        }),
        btn('Write', function () { area('write'); }),
        btn('Help', function () { alertBox('Double-click a message to read it. New Mail you have read moves to Old Mail.'); })
      ])
    ]);
    kid = app.mdi.open({ kind: 'mailbox', title: app.sn + "'s Online Mailbox", icon: 'aol-read', width: 520, height: 320, content: content });
    kid.show = show;
    kid.refresh = function () { show(cur); };
    show(cur);
    return kid;
  }
  function refreshMail() {
    var m = app && app.mdi.find('mailbox');
    if (m) m.refresh();
    refreshWelcome();
  }

  function readMail(m) {
    if (m.unread) { m.unread = false; saveState(); refreshMail(); }
    var d = new Date(m.date);
    function btn(label, fn) { var b = h('button', { className: 'aol-btn' }, label); b.addEventListener('click', fn); return b; }
    var content = h('div', { className: 'aol-read' }, [
      h('div', { className: 'rd-head' }, [
        h('div', null, [h('b', null, 'Subj:  '), m.subj]),
        h('div', null, [h('b', null, 'Date:  '), d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })]),
        h('div', null, [h('b', null, 'From:  '), m.from]),
        h('div', null, [h('b', null, 'To:  '), m.to])
      ]),
      h('div', { className: 'rd-body sunken-panel' }, m.body),
      h('div', { className: 'mb-buttons' }, [
        btn('Reply', function () { writeMail({ to: m.from, subj: /^re:/i.test(m.subj) ? m.subj : 'Re: ' + m.subj, body: '\n\n>' + m.body.split('\n').join('\n>') }); }),
        btn('Forward', function () { writeMail({ subj: 'Fwd: ' + m.subj, body: '\n\n----------\nForwarded message from ' + m.from + ':\n\n' + m.body }); }),
        btn('Close', function () { kid.close(); })
      ])
    ]);
    var kid = app.mdi.open({ kind: 'mail:' + m.id + ':' + m.date, title: m.subj, icon: 'envelope-open', width: 500, height: 380, content: content });
    return kid;
  }

  function writeMail(o) {
    var to = h('input', { type: 'text', className: 'field', value: o.to || '', spellcheck: 'false' });
    var cc = h('input', { type: 'text', className: 'field', spellcheck: 'false' });
    var subj = h('input', { type: 'text', className: 'field', value: o.subj || '' });
    var body = h('textarea', { className: 'wm-body', spellcheck: 'true' });
    body.value = o.body || '';
    [to, cc, subj, body].forEach(function (el) { el.addEventListener('keydown', function (e) { e.stopPropagation(); }); });
    var send = h('button', { className: 'aol-btn big' }, [U.img('aol-write', 16), ' Send Now']);
    var content = h('div', { className: 'aol-write' }, [
      h('div', { className: 'wm-grid' }, [h('label', null, 'Send To:'), to, h('label', null, 'Copy To:'), cc, h('label', null, 'Subject:'), subj]),
      h('div', { className: 'wm-format' }, ['Arial', '10', 'B', 'I', 'U'].map(function (x) { return h('span', { className: 'wm-fmt' }, x); })),
      body,
      h('div', { className: 'wm-send' }, [send, h('button', { className: 'aol-btn', disabled: true }, 'Send Later'), h('button', { className: 'aol-btn', disabled: true }, 'Attachments')])
    ]);
    var kid = app.mdi.open({ title: 'Write Mail', icon: 'aol-write', width: 500, height: 400, content: content });
    send.addEventListener('click', function () {
      var rcpt = to.value.trim();
      if (!rcpt) { alertBox('Please enter a screen name in the "Send To" box.', 'warning'); return; }
      if (!subj.value.trim()) { alertBox('Please enter a subject for your message.', 'warning'); return; }
      var mb = mailbox();
      var msg = { id: mb.nextId++, from: app.sn, to: rcpt, subj: subj.value.trim(), body: body.value, date: Date.now() };
      mb.sent.push(msg);
      saveState();
      U.sound('mailSent');
      kid.close(true);
      alertBox('Your mail has been sent.');
      refreshMail();
      deliver(msg);
    });
    setTimeout(function () { (o.to ? body : to).focus(); }, 0);
    return kid;
  }

  // Mail to yourself arrives; mail to a buddy gets a reply.
  function deliver(msg) {
    var sn = app.sn;
    var rcpts = msg.to.split(/[,;]\s*/);
    rcpts.forEach(function (r) {
      if (r.toLowerCase() === sn.toLowerCase()) {
        later(4000, function () { receive(Object.assign({}, msg, { id: mailbox().nextId++, unread: true })); });
        return;
      }
      var buddy = allBuddies().filter(function (b) { return b.toLowerCase() === r.toLowerCase(); })[0];
      if (buddy) {
        later(15000 + Math.random() * 15000, function () {
          receive({ id: mailbox().nextId++, from: buddy, to: sn, subj: 'Re: ' + msg.subj.replace(/^re:\s*/i, ''), date: Date.now(), unread: true,
            body: pick(['lol thanks for the email!!', 'got ur mail. ' + pick(D.BOT.filler), 'hey!! ' + pick(D.BOT.openers[buddy] || D.BOT.filler)]) + '\n\n' + '>' + msg.body.split('\n').slice(0, 6).join('\n>') });
        });
      }
    });
  }
  function receive(msg) {
    if (!app || !app.online) return;
    mailbox().inbox.push(msg);
    saveState();
    refreshMail();
    say("You've got mail!");
  }

  // -------------------------------------------- Buddy List / IM
  function allBuddies() { return [].concat.apply([], Object.keys(D.BUDDIES).map(function (g) { return D.BUDDIES[g]; })); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function startBuddySim() {
    app.onlineBuddies = {};
    var all = allBuddies();
    all.forEach(function (b) { if (Math.random() < 0.45) app.onlineBuddies[b] = true; });
    app.onlineBuddies.SkaterGrl1999 = true;
    refreshBuddies();
    // Buddies come and go.
    (function churn() {
      later(20000 + Math.random() * 40000, function () {
        var b = pick(all);
        if (app.onlineBuddies[b]) {
          if (openIm(b, true)) { churn(); return; } // don't leave mid-conversation
          delete app.onlineBuddies[b];
          U.sound('doorClose');
        } else {
          app.onlineBuddies[b] = true;
          U.sound('doorOpen');
        }
        refreshBuddies(b);
        churn();
      });
    })();
    // Someone says hi.
    (function surprise(first) {
      later(first ? 25000 + Math.random() * 20000 : 120000 + Math.random() * 180000, function () {
        var online = Object.keys(app.onlineBuddies);
        var b = online.length ? pick(online) : null;
        if (b && !openIm(b, true)) incomingIm(b, pick(D.BOT.greet) + ' ' + pick(D.BOT.openers[b] || D.BOT.filler));
        surprise(false);
      });
    })(true);
  }

  function buddyList() {
    var tree = h('div', { className: 'bl-tree sunken-panel' });
    var selected = null;
    function btn(label, icon, fn) { var b = h('button', { className: 'bl-btn' }, [U.img(icon, 16), h('span', null, label)]); b.addEventListener('click', fn); return b; }
    var content = h('div', { className: 'aol-buddy' }, [
      h('div', { className: 'bl-head' }, [U.img('aol-buddy', 32), h('div', null, [h('b', null, app.sn), h('div', null, 'Buddy List')])]),
      tree,
      h('div', { className: 'bl-buttons' }, [
        btn('IM', 'aol-im', function () { if (selected && app.onlineBuddies[selected]) openIm(selected); else sendImDialog(selected); }),
        btn('Info', 'info', function () {
          if (!selected) return;
          alertBox('Member Profile: ' + selected + '\n\nLocation: ' + pick(['Ohio', 'Cleveland', 'the Internet', 'my room', 'Tampa, FL', 'Portland']) + '\nHobbies: ' + pick(['skateboarding, AOL, music', 'DOOM, Quake, StarCraft', 'surfing the web', 'Beanie Babies', 'chatting!!!']) + '\nPersonal Quote: "' + pick(['Carpe diem', 'Whatever!', 'Talk to the hand', 'Party like its 1999', 'I want to believe']) + '"', 'info', 'Member Profile');
        }),
        btn('Setup', 'settings', function () { alertBox('Buddy List Setup\n\nYour groups: Buddies, Family, Co-Workers.\n\nTo add a buddy, ask them for their screen name at school tomorrow.'); }),
        btn('Chat', 'aol-chat', function () { area('chat'); })
      ])
    ]);
    var kid = app.mdi.open({ kind: 'buddy', title: 'Buddy List Online', icon: 'aol-buddy', width: 190, height: 380, x: 'right', y: 8, content: content, className: 'aol-buddywin' });
    kid.refresh = function (flash) {
      tree.innerHTML = '';
      Object.keys(D.BUDDIES).forEach(function (g) {
        var names = D.BUDDIES[g], on = names.filter(function (n) { return app.onlineBuddies && app.onlineBuddies[n]; });
        tree.appendChild(h('div', { className: 'bl-group' }, g + ' (' + on.length + '/' + names.length + ')'));
        on.forEach(function (n) {
          var row = h('div', { className: 'bl-buddy' + (n === selected ? ' selected' : '') + (n === flash ? ' flash' : '') }, n);
          row.addEventListener('click', function () { selected = n; kid.refresh(); });
          U.onActivate(row, function () { openIm(n); });
          tree.appendChild(row);
        });
      });
    };
    kid.refresh();
    return kid;
  }
  function refreshBuddies(flash) { var b = app && app.mdi.find('buddy'); if (b) b.refresh(flash); }

  function sendImDialog(prefill) {
    var to = h('input', { type: 'text', className: 'field', value: prefill || '', spellcheck: 'false' });
    var msg = h('textarea', { className: 'im-compose' });
    var send = h('button', { className: 'aol-btn big' }, 'Send');
    [to, msg].forEach(function (el) { el.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && el === msg && !e.shiftKey) { e.preventDefault(); send.click(); } }); });
    var kid = app.mdi.open({ kind: 'sendim', title: 'Send Instant Message', icon: 'aol-im', width: 360, height: 230, content: h('div', { className: 'aol-sendim' }, [
      h('div', { className: 'so-row' }, [h('label', null, 'To:'), to]), msg, h('div', { className: 'mb-buttons' }, [send])
    ]) });
    send.addEventListener('click', function () {
      var name = to.value.trim(), text = msg.value.trim();
      if (!name) { alertBox('Please enter a screen name.', 'warning'); return; }
      var buddy = allBuddies().filter(function (b) { return b.toLowerCase() === name.toLowerCase(); })[0];
      if (!buddy || !app.onlineBuddies[buddy]) {
        alertBox(name + ' is not currently signed on.', 'info');
        return;
      }
      kid.close(true);
      var w = openIm(buddy);
      if (text) w.send(text);
    });
    setTimeout(function () { (prefill ? msg : to).focus(); }, 0);
    return kid;
  }

  function openIm(name, onlyExisting) {
    var kid = app.mdi.find('im:' + name);
    if (kid) { if (!onlyExisting) kid.focus(); return kid; }
    if (onlyExisting) return null;
    var log = h('div', { className: 'im-log sunken-panel' });
    var input = h('textarea', { className: 'im-compose', placeholder: '' });
    var send = h('button', { className: 'aol-btn big' }, 'Send');
    var content = h('div', { className: 'aol-im' }, [log, h('div', { className: 'im-toolbar' }, ['A', 'A', 'B', 'I', 'U', ':-)'].map(function (x) { return h('span', { className: 'wm-fmt' }, x); })), input,
      h('div', { className: 'mb-buttons' }, [h('button', { className: 'aol-btn', onclick: function () { alertBox('You warned ' + name + '. Their warning level is now 10%.\n\n(Was that really necessary?)'); } }, 'Warn'),
        h('button', { className: 'aol-btn', onclick: function () { alertBox(name + ' has been blocked. Just kidding.'); } }, 'Block'), send])]);
    kid = app.mdi.open({ kind: 'im:' + name, title: 'Instant Message To: ' + name, icon: 'aol-im', width: 360, height: 300, content: content, className: 'aol-imwin' });
    kid.buddy = name;
    kid.add = function (who, text, mine) {
      log.appendChild(h('div', { className: 'im-line' }, [h('b', { className: mine ? 'me' : 'them' }, who + ': '), text]));
      log.scrollTop = log.scrollHeight;
    };
    kid.send = function (text) {
      kid.add(app.sn, text, true);
      U.sound('imSend');
      botReply(kid, text);
    };
    send.addEventListener('click', function () {
      var t = input.value.trim();
      if (!t) return;
      input.value = '';
      kid.send(t);
    });
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send.click(); }
    });
    kid.on('focus', function () { setTimeout(function () { input.focus(); }, 0); });
    setTimeout(function () { input.focus(); }, 0);
    return kid;
  }

  function incomingIm(name, text) {
    var kid = openIm(name);
    kid.setTitle('Instant Message From: ' + name);
    kid.add(name, text, false);
    U.sound('imReceive');
  }

  function botReply(kid, text) {
    var name = kid.buddy;
    var lines = null;
    D.BOT.replies.some(function (r) { if (r[0].test(text)) { lines = r[1]; return true; } return false; });
    var reply = pick(lines || D.BOT.filler).replace('{me}', app.sn);
    var bye = /\b(bye|gtg|g2g|cya|ttyl)\b/i.test(text);
    later(1200 + Math.random() * 2600, function () {
      if (kid.closed || !app.online) return;
      kid.add(name, reply, false);
      U.sound('imReceive');
      if (!bye && Math.random() < 0.35) later(2500 + Math.random() * 3000, function () {
        if (kid.closed || !app.online) return;
        kid.add(name, pick(D.BOT.openers[name] || D.BOT.filler).replace('{me}', app.sn), false);
        U.sound('imReceive');
      });
    });
  }

  // -------------------------------------------- Chat
  function chatRoom() {
    var log = h('div', { className: 'chat-log sunken-panel' });
    var people = h('div', { className: 'chat-people sunken-panel' });
    var count = h('div', { className: 'chat-count' });
    var input = h('input', { type: 'text', className: 'field chat-input', maxlength: 92, spellcheck: 'false' });
    var send = h('button', { className: 'aol-btn big' }, 'Send');
    var here = D.CHAT.people.slice(0, 5 + Math.floor(Math.random() * 3));
    var content = h('div', { className: 'aol-chat' }, [
      h('div', { className: 'chat-main' }, [log, h('div', { className: 'chat-send' }, [input, send])]),
      h('div', { className: 'chat-side' }, [count, people,
        h('button', { className: 'aol-btn', onclick: function () { alertBox('There are 312 public rooms in Town Square, Arts & Entertainment, Friends, Life, Places, Romance, Special Interests...\n\nThis one is the best, obviously.'); } }, 'List Rooms')])
    ]);
    var kid = app.mdi.open({ kind: 'chat', title: D.CHAT.room, icon: 'aol-chat', width: 560, height: 360, content: content });
    function renderPeople() {
      people.innerHTML = '';
      [app.sn].concat(here).forEach(function (p) { people.appendChild(h('div', null, p)); });
      count.textContent = 'People Here: ' + (here.length + 1);
    }
    function line(who, text, cls) {
      log.appendChild(h('div', { className: 'chat-line ' + (cls || '') }, [h('b', null, who + ':'), '\u00a0\u00a0' + text]));
      while (log.children.length > 200) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
    line('OnlineHost', '*** You are in "' + D.CHAT.room + '". ***', 'host');
    renderPeople();
    var timer = every(3500, function () {
      if (kid.closed) return;
      var r = Math.random();
      if (r < 0.08 && here.length > 4) {
        var gone = here.splice(Math.floor(Math.random() * here.length), 1)[0];
        line('OnlineHost', gone + ' has left the room.', 'host'); renderPeople();
      } else if (r < 0.16) {
        var outside = D.CHAT.people.filter(function (p) { return here.indexOf(p) === -1; });
        if (outside.length) { var p = pick(outside); here.push(p); line('OnlineHost', p + ' has entered the room.', 'host'); renderPeople(); }
      } else if (r < 0.7) {
        line(pick(here), pick(D.CHAT.lines));
      }
    });
    function post() {
      var t = input.value.trim();
      if (!t) return;
      input.value = '';
      line(app.sn, t, 'me');
      if (Math.random() < 0.6) later(1500 + Math.random() * 3000, function () {
        if (kid.closed) return;
        line(pick(here), pick([app.sn + ' lol', 'hi ' + app.sn + '!!', 'wb ' + app.sn, 'lol ' + app.sn, app.sn + ' where r u from?', 'agreed', 'LOL']));
      });
    }
    send.addEventListener('click', post);
    input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') post(); });
    kid.on('close', function () { clearInterval(timer); });
    kid.on('focus', function () { setTimeout(function () { input.focus(); }, 0); });
    setTimeout(function () { input.focus(); }, 0);
    return kid;
  }

  // -------------------------------------------- Quotes, Weather, Horoscopes
  function quotesWindow() {
    var prices = {};
    D.STOCKS.forEach(function (s) { prices[s[0]] = { p: s[2], open: s[2] }; });
    var table = h('table', { className: 'list-table' });
    var sym = h('input', { type: 'text', className: 'field', placeholder: 'Symbol', maxlength: 6, style: { width: '90px' } });
    var get = h('button', { className: 'aol-btn' }, 'Get Quote');
    function frac(n) {
      var whole = Math.floor(n), f = Math.round((n - whole) * 16) / 16;
      var map = { 0: '', 0.0625: ' 1/16', 0.125: ' 1/8', 0.1875: ' 3/16', 0.25: ' 1/4', 0.3125: ' 5/16', 0.375: ' 3/8', 0.4375: ' 7/16', 0.5: ' 1/2', 0.5625: ' 9/16', 0.625: ' 5/8', 0.6875: ' 11/16', 0.75: ' 3/4', 0.8125: ' 13/16', 0.875: ' 7/8', 0.9375: ' 15/16', 1: '' };
      return (f === 1 ? whole + 1 : whole) + (map[f] || '');
    }
    function render(hl) {
      table.innerHTML = '';
      table.appendChild(h('tr', null, ['Symbol', 'Company', 'Last', 'Change'].map(function (x) { return h('th', null, x); })));
      D.STOCKS.forEach(function (s) {
        var q = prices[s[0]], ch = q.p - q.open;
        table.appendChild(h('tr', { className: s[0] === hl ? 'selected' : '' }, [h('td', null, s[0]), h('td', null, s[1]), h('td', null, frac(q.p)),
          h('td', { style: { color: ch >= 0 ? '#008000' : '#c00000' } }, (ch >= 0 ? '+' : '-') + frac(Math.abs(ch)))]));
      });
    }
    var kid = app.mdi.open({ kind: 'quotes', title: 'Quotes & Portfolios', icon: 'aol-quotes', width: 440, height: 360, content: h('div', { className: 'aol-quotes' }, [
      h('div', { className: 'q-top' }, [U.img('aol-quotes', 32), h('div', null, [h('b', null, 'Quotes & Portfolios'), h('div', null, 'Quotes delayed at least 20 minutes. It is 1999 after all.')])]),
      h('div', { className: 'q-get' }, [h('label', null, 'Enter Symbol:'), sym, get]),
      h('div', { className: 'sunken-panel q-list' }, table)
    ]) });
    get.addEventListener('click', function () {
      var s = sym.value.trim().toUpperCase();
      if (prices[s]) render(s); else alertBox('"' + s + '" is not a valid symbol. Try AOL, YHOO, MSFT or PETS.', 'warning');
    });
    sym.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') get.click(); });
    var t = every(4000, function () {
      if (kid.closed) return;
      Object.keys(prices).forEach(function (k) { var q = prices[k]; q.p = Math.max(1, q.p + (Math.random() - 0.47) * q.p * 0.012); });
      render();
    });
    kid.on('close', function () { clearInterval(t); });
    render();
    return kid;
  }

  function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function weatherWindow() {
    var zip = h('input', { type: 'text', className: 'field', maxlength: 5, value: U.store.get('w98.aol.zip', '44114'), style: { width: '70px' } });
    var go = h('button', { className: 'aol-btn' }, 'Go');
    var out = h('div', { className: 'wx-out' });
    function show() {
      var z = zip.value.replace(/\D/g, '').slice(0, 5);
      if (z.length !== 5) { alertBox('Please enter a 5-digit ZIP code.', 'warning'); return; }
      U.store.set('w98.aol.zip', z);
      var rnd = seeded(+z + new Date().getDate());
      var base = 40 + Math.round(rnd() * 45);
      var kinds = [['Sunny', 'aol-weather'], ['Partly Cloudy', 'aol-weather'], ['Showers', 'aol-weather'], ['Clear', 'aol-weather']];
      var days = ['Today', 'Tomorrow'];
      var d = new Date();
      for (var i = 2; i < 5; i++) { var dd = new Date(d.getTime() + i * 864e5); days.push(dd.toLocaleDateString('en-US', { weekday: 'long' })); }
      out.innerHTML = '';
      out.appendChild(h('h3', null, 'Forecast for ZIP ' + z));
      out.appendChild(h('div', { className: 'wx-days' }, days.map(function (day, i) {
        var k = kinds[Math.floor(rnd() * kinds.length)], hi = base + Math.round(rnd() * 12 - 6);
        return h('div', { className: 'wx-day' }, [h('b', null, day), U.img(k[1], 32), h('span', null, k[0]), h('span', null, 'Hi ' + hi + '\u00b0  Lo ' + (hi - 8 - Math.round(rnd() * 10)) + '\u00b0')]);
      })));
      out.appendChild(h('p', null, [h('a', { href: '#', onclick: function (e) { e.preventDefault(); openWeb('www.weather.com'); } }, 'More weather from The Weather Channel on the web')]));
    }
    go.addEventListener('click', show);
    zip.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') show(); });
    var kid = app.mdi.open({ kind: 'weather', title: 'Weather', icon: 'aol-weather', width: 480, height: 300, content: h('div', { className: 'aol-weather' }, [
      h('div', { className: 'wx-top' }, [U.img('aol-weather', 32), h('b', null, 'AOL Weather'), h('span', null, 'ZIP Code:'), zip, go]), out
    ]) });
    show();
    return kid;
  }

  function horoscopeWindow() {
    var out = h('div', { className: 'hs-out' }, 'Choose your sign.');
    var grid = h('div', { className: 'hs-grid' }, D.SIGNS.map(function (s, i) {
      var b = h('button', { className: 'aol-btn' }, s);
      b.addEventListener('click', function () {
        var rnd = seeded(i * 31 + new Date().getDate() * 7 + new Date().getMonth());
        out.innerHTML = '';
        out.appendChild(h('b', null, s + ' - Today'));
        out.appendChild(h('p', null, D.FORTUNES[Math.floor(rnd() * D.FORTUNES.length)] + ' ' + D.FORTUNES[Math.floor(rnd() * D.FORTUNES.length)]));
        out.appendChild(h('p', null, 'Lucky numbers: ' + [1, 2, 3].map(function () { return 1 + Math.floor(rnd() * 49); }).join(', ')));
      });
      return b;
    }));
    return app.mdi.open({ kind: 'horoscopes', title: 'Horoscopes', icon: 'aol-channels', width: 440, height: 320, content: h('div', { className: 'aol-horo' }, [grid, out]) });
  }

  // -------------------------------------------- Keyword, Help and friends
  function keywordDialog() {
    var input = h('input', { type: 'text', className: 'field', spellcheck: 'false' });
    var goBtn = h('button', { className: 'aol-btn big' }, 'Go');
    var searchBtn = h('button', { className: 'aol-btn' }, 'Search');
    var listBtn = h('button', { className: 'aol-btn' }, 'Keyword List');
    var kid = app.mdi.open({ kind: 'keyword', title: 'Keyword', icon: 'aol-keyword', width: 380, height: 'auto', resizable: false, content: h('div', { className: 'aol-keyword' }, [
      h('div', { className: 'kw-top' }, [U.img('aol-keyword', 32), h('p', null, 'Enter a keyword or Web address and click Go. Keywords are shortcuts to places on AOL.')]),
      input, h('div', { className: 'mb-buttons' }, [goBtn, searchBtn, listBtn])
    ]) });
    function submit() { var v = input.value.trim(); if (!v) return; kid.close(true); go(v); }
    goBtn.addEventListener('click', submit);
    searchBtn.addEventListener('click', function () { kid.close(true); openWeb('www.altavista.com'); });
    listBtn.addEventListener('click', function () { kid.close(true); area('keywordlist'); });
    input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') submit(); if (e.key === 'Escape') kid.close(true); });
    setTimeout(function () { input.focus(); }, 0);
    return kid;
  }

  function keywordList() {
    var list = h('div', { className: 'kwl sunken-panel' }, D.KEYWORD_LIST.map(function (k) {
      var row = h('div', { className: 'kwl-row' }, k);
      U.onActivate(row, function () { go(k); });
      row.addEventListener('click', function () { list.querySelectorAll('.kwl-row').forEach(function (r) { r.classList.remove('selected'); }); row.classList.add('selected'); });
      return row;
    }));
    return app.mdi.open({ kind: 'keywordlist', title: 'Keyword List', icon: 'aol-keyword', width: 300, height: 340, content: h('div', { className: 'aol-kwl' }, [
      h('p', null, 'Double-click a keyword to go there. You can also type any web address, like www.yahoo.com.'), list
    ]) });
  }

  function helpWindow() {
    var sections = [
      ['Signing On', 'Choose your screen name, type your password and click SIGN ON. First time? Choose New User and pick a screen name. Your modem will dial, connect and log you in. It takes about 30 seconds, just like 1998.'],
      ['Keywords', 'Keywords are shortcuts. Type one into the box at the top and click Go, or press Ctrl+K. Try NEWS, SPORTS, GAMES, KIDS ONLY, WEATHER, QUOTES, HOROSCOPES, CHAT, or brand names like YAHOO, CNN, ESPN, NINTENDO and SPACE JAM.'],
      ['The Web', 'Type a web address such as www.geocities.com into the keyword box. Pages come from the Internet Archive\'s Wayback Machine, so you see the web as it was. Use Internet > Time Travel to pick a different year. Some pages are slow or incomplete; that\'s the authentic experience.'],
      ['Mail', 'Click Read to open your mailbox. Click Write to send a message. Send mail to your own screen name and it will arrive a few seconds later. Mail your buddies and they may write back.'],
      ['Buddy List & IMs', 'Your Buddy List shows who is online. The door sounds mean someone signed on or off. Double-click a buddy to send an Instant Message.'],
      ['Chat', 'People > People Connection takes you to a Town Square lobby. Say hi!']
    ];
    var body = h('div', { className: 'aol-help sunken-panel' }, sections.map(function (s) { return h('div', null, [h('h4', null, s[0]), h('p', null, s[1])]); }));
    return app.mdi.open({ kind: 'help', title: 'Member Services Online Help', icon: 'help', width: 440, height: 360, content: body });
  }

  function parentalControls() {
    var opts = ['Kids Only (12 and under)', 'Young Teen (13-15)', 'Mature Teen (16-17)', 'General Access (18+)'].map(function (o, i) {
      return h('label', { className: 'radio' }, [h('input', { type: 'radio', name: 'pc', checked: i === 3 }), o]);
    });
    return app.mdi.open({ kind: 'parental', title: 'Parental Controls', icon: 'aol-myaol', width: 380, height: 'auto', content: h('div', { className: 'aol-pc' }, [
      h('p', null, 'Parental Controls let you decide where your kids can go on AOL.'),
      h('div', { className: 'pc-opts' }, opts),
      h('p', { className: 'note' }, 'For this screen name: ' + app.sn)
    ]) });
  }

  function profileWindow() {
    var p = app.state.profiles[app.sn] || {};
    var fields = [['name', 'Member Name:'], ['location', 'Location:'], ['birthday', 'Birthday:'], ['computers', 'Computers:'], ['hobbies', 'Hobbies:'], ['quote', 'Personal Quote:']];
    var inputs = {};
    var grid = h('div', { className: 'prof-grid' });
    fields.forEach(function (f) {
      inputs[f[0]] = h('input', { type: 'text', className: 'field', value: p[f[0]] || (f[0] === 'computers' ? 'Compaq Presario, 56K modem' : '') });
      inputs[f[0]].addEventListener('keydown', function (e) { e.stopPropagation(); });
      grid.appendChild(h('label', null, f[1])); grid.appendChild(inputs[f[0]]);
    });
    var save = h('button', { className: 'aol-btn big' }, 'Update');
    var kid = app.mdi.open({ kind: 'profile', title: 'Edit Your Online Profile', icon: 'aol-myaol', width: 420, height: 'auto', content: h('div', { className: 'aol-profile' }, [
      h('p', null, 'Your profile is how other members get to know you. Screen name: ' + app.sn), grid, h('div', { className: 'mb-buttons' }, [save])
    ]) });
    save.addEventListener('click', function () {
      var out = {};
      fields.forEach(function (f) { out[f[0]] = inputs[f[0]].value; });
      app.state.profiles[app.sn] = out;
      saveState();
      kid.close(true);
      alertBox('Your profile has been updated.');
    });
    return kid;
  }

  function namesWindow() {
    var list = h('div', { className: 'sunken-panel names-list' }, app.state.names.map(function (n) { return h('div', null, n); }));
    return app.mdi.open({ kind: 'names', title: 'Screen Names', icon: 'aol-myaol', width: 320, height: 260, content: h('div', { className: 'aol-names' }, [
      h('p', null, 'Screen names on this account (up to 5):'), list,
      h('p', { className: 'note' }, 'To create another screen name, sign off and choose New User.')
    ]) });
  }

  function perksWindow() {
    var offers = [
      ['FREE AOL CD!', 'Get 1,000 free hours. Coming soon to your mailbox, cereal box and airplane seat.'],
      ['AOL Visa Card', 'Earn AOL Rewards points with every purchase!'],
      ['Moviefone', 'Buy tickets for The Matrix without the lines.'],
      ['Shop@AOL', 'Guaranteed secure shopping for the holidays.']
    ];
    return app.mdi.open({ kind: 'perks', title: 'AOL Member Perks', icon: 'aol-perks', width: 420, height: 300, content: h('div', { className: 'aol-perks' }, offers.map(function (o) {
      return h('div', { className: 'perk' }, [U.img('aol-perks', 32), h('div', null, [h('b', null, o[0]), h('p', null, o[1])])]);
    })) });
  }

  // -------------------------------------------- Favorites
  function favoritesMenu() {
    var items = [
      { label: 'Favorite Places', icon: 'aol-favorites', action: favoritePlaces },
      { label: 'Add Top Window to Favorites', action: function () {
        var k = app.mdi.active;
        if (!k) return;
        var fav = k.pane ? { label: Web.host(k.pane.url), go: 'web:' + k.pane.url } : k.kind && /^channel:/.test(k.kind) ? { label: k.title, go: k.kind } : AREAS[k.kind] ? { label: k.title, go: 'area:' + k.kind } : null;
        if (!fav) { alertBox('This window cannot be added to your Favorite Places.'); return; }
        app.state.favorites.push(fav); saveState();
        alertBox('"' + fav.label + '" has been added to your Favorite Places.');
      } },
      '-'
    ];
    app.state.favorites.forEach(function (f) { items.push({ label: f.label, icon: /^web:/.test(f.go) ? 'aol-internet' : 'aol-favorites', action: function () { dispatch(f.go); } }); });
    return items;
  }

  function favoritePlaces() {
    var list = h('div', { className: 'sunken-panel kwl' });
    function render() {
      list.innerHTML = '';
      app.state.favorites.forEach(function (f, i) {
        var row = h('div', { className: 'kwl-row' }, [U.img(/^web:/.test(f.go) ? 'aol-internet' : 'aol-favorites', 16), ' ' + f.label]);
        U.onActivate(row, function () { dispatch(f.go); });
        row.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          Menu.popup([{ label: '&Delete', action: function () { app.state.favorites.splice(i, 1); saveState(); render(); } }], e.clientX, e.clientY);
        });
        list.appendChild(row);
      });
    }
    render();
    return app.mdi.open({ kind: 'favorites', title: 'Favorite Places', icon: 'aol-favorites', width: 300, height: 300, content: h('div', { className: 'aol-kwl' }, [
      h('p', null, 'Double-click to go. Right-click to delete.'), list
    ]) });
  }

  Shell.register('aol', { name: 'America Online', icon: 'aol', single: true, launch: launch, reopen: function (w, arg) { if (arg && app && app.online) go(arg); } });
})();
