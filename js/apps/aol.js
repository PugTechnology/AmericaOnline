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
    s.setup = Object.assign({ modemSounds: true, busySignals: true, idleMinutes: 45 }, s.setup || {});
    s.buddyGroups = s.buddyGroups || JSON.parse(JSON.stringify(D.BUDDIES));
    s.blocked = s.blocked || {};    // screen name -> true
    s.away = s.away || null;        // { msg, since } while away
    s.awayMsgs = s.awayMsgs || [];  // your own away messages, newest first
    s.usage = s.usage || {};        // 'YYYY-MM' -> seconds online
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

  // AOL's voice lines: a drop-in file from sounds/aol/, else the synth sound or speech.
  function clip(name, text) { return U.sound('clip', name, text); }

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

    app = { state: loadState(), online: false, sn: null, timers: [], connecting: null, warn: {}, memberRooms: [], downloads: null };
    U.sound('preloadClips');   // quietly look for real AOL voice files in sounds/aol/

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
        return [{ label: 'Print...', action: printDialog }];
      } },
      { id: 'myfiles', label: 'My Files', icon: 'aol-myfiles', menu: function () {
        return [
          { label: 'Personal Filing Cabinet', action: function () { area('mailbox'); } },
          { label: 'Download Manager', action: function () { area('downloads'); } },
          { label: 'My Documents (C:)', action: function () { Shell.open('C:\\My Documents'); } }
        ];
      } },
      { id: 'myaol', label: 'My AOL', icon: 'aol-myaol', menu: function () {
        return [
          { label: 'My Member Profile', action: function () { area('profile'); } },
          { label: 'Screen Names', action: function () { area('names'); } },
          { label: 'Parental Controls', action: function () { area('parental'); } },
          { label: 'Buddy List', action: function () { area('buddy'); } },
          { label: 'Buddy List Setup', action: function () { area('buddysetup'); } },
          { label: 'Away Message', action: function () { area('buddy'); awayDialog(); } },
          { label: 'Warn and Block', action: function () { area('warnblock'); } },
          { label: 'Time Online', action: function () { area('timeonline'); } },
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
          { label: 'Chat Room List', action: function () { area('rooms'); } },
          { label: 'Create a Room', action: function () { area('createroom'); } },
          { label: 'Member Directory', action: function () { area('directory'); } }
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
        { label: '&Print...', action: printDialog },
        { label: '&Download Manager', action: function () { area('downloads'); } },
        '-',
        { label: 'E&xit', action: function () { win.close(); } }
      ] },
      { label: '&Edit', items: [
        { label: 'Cu&t', shortcut: 'Ctrl+X', action: function () { document.execCommand('cut'); } },
        { label: '&Copy', shortcut: 'Ctrl+C', action: function () { document.execCommand('copy'); } },
        { label: '&Paste', shortcut: 'Ctrl+V', action: function () { document.execCommand('paste'); } },
        '-',
        { label: 'Spell Check', action: function () {
          var k = app.mdi.active;
          if (k && k.spell) k.spell();
          else alertBox('Spell Check checks the message you are writing.\n\nOpen Write Mail and try again.');
        } },
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
    if (app.unIdle) { app.unIdle(); app.unIdle = null; }
    if (app.idleDlg) app.idleDlg.close(true);
    app.dlTimer = null; app.dlRunning = false;
  }
  function later(ms, fn) { var t = setTimeout(fn, ms); app.timers.push(t); return t; }
  function every(ms, fn) { var t = setInterval(fn, ms); app.timers.push(t); return t; }

  function about() {
    WM.msgbox({ title: 'About America Online', owner: app && app.win, icon: 'aol', sound: null,
      text: 'America Online for Windows 95/98\nVersion 4.0\n\nThis is a loving re-creation, not the real thing. AOL areas are simulated, and the web is served from the Internet Archive\'s Wayback Machine. The voice lines are files you can drop in, or your computer\'s built-in speech.\n\nSo long, and thanks for all the free hours.' });
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
    var idle = h('select', { className: 'field' }, [15, 30, 45, 60, 0].map(function (m) { return h('option', { value: m, selected: m === s.idleMinutes }, m ? m + ' minutes' : 'never'); }));
    var ok = h('button', { className: 'btn default' }, 'OK');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var d = WM.dialog({ title: 'America Online Setup', owner: app.win, width: 380, content: h('div', { className: 'aol-setup' }, [
      h('fieldset', { className: 'group' }, [h('legend', null, 'Connection'),
        h('p', null, 'Modem: U.S. Robotics 56K Voice (COM2)'), h('p', null, 'Access number: 1-800-555-0142'),
        h('label', { className: 'check' }, [snd, 'Play the modem sounds while connecting']),
        h('label', { className: 'check' }, [busy, 'Realistic busy signals (sometimes!)']),
        h('label', null, ['Disconnect me when idle for ', idle]),
        h('p', { className: 'note' }, 'Takes effect the next time you sign on.')
      ]),
      h('fieldset', { className: 'group' }, [h('legend', null, 'Time Travel'),
        h('label', null, ['Show me the World Wide Web of ', year]),
        h('p', { className: 'note' }, 'Web pages come from the Internet Archive\'s Wayback Machine.')
      ]),
      h('div', { className: 'button-row right' }, [ok, cancel])
    ]) });
    ok.addEventListener('click', function () {
      s.modemSounds = snd.checked; s.busySignals = busy.checked; s.idleMinutes = +idle.value;
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
    app.state.away = null;
    app.since = app.usageAt = Date.now();
    every(30000, tickUsage);
    area('buddy');
    area('welcome');
    clip('welcome', 'Welcome!').then(function () {
      if (!app || !app.online) return;
      if (unreadCount()) return U.wait(250).then(function () { return clip('youve-got-mail', "You've got mail!"); });
    });
    startBuddySim();
    startIdleWatch();
  }

  // ------------------------------------------------------------------ idle disconnect
  // ?fastidle (or ?fastidle=<seconds>) shortens the wait so it can be tested.
  var FASTIDLE = /[?&]fastidle(?:=(\d+))?/.exec(location.search);

  function startIdleWatch() {
    var idleMs = FASTIDLE ? (+FASTIDLE[1] || 8) * 1000 : app.state.setup.idleMinutes * 60000;
    if (!idleMs) return;
    app.lastInput = Date.now();
    var evs = ['pointerdown', 'pointermove', 'keydown', 'wheel'];
    function poke() { if (app) app.lastInput = Date.now(); }
    evs.forEach(function (ev) { document.addEventListener(ev, poke, true); });
    app.unIdle = function () { evs.forEach(function (ev) { document.removeEventListener(ev, poke, true); }); };
    every(1000, function () {
      if (app.idleDlg || !app.online) return;
      if (Date.now() - app.lastInput >= idleMs) areYouThere(FASTIDLE ? 10 : 60);
    });
  }

  // The classic "Are you still there?" box, with a countdown.
  function areYouThere(secs) {
    var left = secs;
    var msg = h('div', { className: 'text' });
    var ok = h('button', { className: 'btn default' }, 'Stay Online');
    var d = WM.dialog({ title: 'America Online', owner: app.win, width: 340, content: h('div', { className: 'msgbox-wrap' }, [
      h('div', { className: 'msgbox' }, [U.img('aol-logo', 32), msg]),
      h('div', { className: 'button-row' }, [ok])
    ]) });
    app.idleDlg = d;
    function text() { msg.textContent = 'Are you still there?\n\nYou have been idle for a while. If you do not respond, you will be disconnected in ' + left + ' second' + (left === 1 ? '' : 's') + '.'; }
    text();
    U.sound('chord');
    var t = every(1000, function () {
      if (--left > 0) { text(); return; }
      clearInterval(t);
      d.close(true);
      signOff(false, 'idle');
    });
    d.on('close', function () { clearInterval(t); if (app) app.idleDlg = null; });
    ok.addEventListener('click', function () { app.lastInput = Date.now(); d.close(true); });
    setTimeout(function () { ok.focus(); }, 0);
  }

  // ------------------------------------------------------------------ time online
  function usageKey() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  // Add the seconds since the last tick to this month's total.
  function tickUsage() {
    if (!app || !app.usageAt) return;
    var now = Date.now(), k = usageKey();
    app.state.usage[k] = (app.state.usage[k] || 0) + (now - app.usageAt) / 1000;
    app.usageAt = now;
    saveState();
  }

  function signOff(exiting, reason) {
    if (!app) return;
    tickUsage();
    app.state.away = null;
    saveState();
    stopTimers();
    var wasOnline = app.online;
    app.online = false;
    app.sn = null;
    app.mdi.closeAll();
    setOnlineUi(false);
    Shell.setAolTray(false);
    app.win.setTitle('America Online');
    app.kwInput.value = '';
    if (wasOnline) { U.sound('doorClose'); clip('goodbye', 'Goodbye!'); }
    if (!exiting) showSignOn(true).setTitle('Goodbye from America Online!');
    if (reason === 'idle' && !exiting) alertBox('You have been disconnected from America Online because you were idle.\n\nClick SIGN ON to connect again.', 'warning', 'Disconnected');
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
    perks: perksWindow,
    downloads: downloadsWindow,
    timeonline: timeOnlineWindow,
    directory: directoryWindow,
    rooms: roomListWindow,
    createroom: function () { createRoomDialog(); },
    buddysetup: buddySetupWindow,
    warnblock: warnBlockWindow
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
    var spell = h('button', { className: 'aol-btn' }, 'Spell Check');
    spell.addEventListener('click', function () { spellCheck(body); });
    var content = h('div', { className: 'aol-write' }, [
      h('div', { className: 'wm-grid' }, [h('label', null, 'Send To:'), to, h('label', null, 'Copy To:'), cc, h('label', null, 'Subject:'), subj]),
      h('div', { className: 'wm-format' }, ['Arial', '10', 'B', 'I', 'U'].map(function (x) { return h('span', { className: 'wm-fmt' }, x); })),
      body,
      h('div', { className: 'wm-send' }, [send, spell, h('button', { className: 'aol-btn', disabled: true }, 'Send Later'), h('button', { className: 'aol-btn', disabled: true }, 'Attachments')])
    ]);
    var kid = app.mdi.open({ title: 'Write Mail', icon: 'aol-write', width: 500, height: 400, content: content });
    kid.spell = function () { spellCheck(body); };
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
    clip('youve-got-mail', "You've got mail!");
  }

  // -------------------------------------------- Buddy List / IM
  function groups() { return app.state.buddyGroups; }
  function allBuddies() { return [].concat.apply([], Object.keys(groups()).map(function (g) { return groups()[g]; })); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function same(a, b) { return a.toLowerCase() === b.toLowerCase(); }
  function findBuddy(name) { return allBuddies().filter(function (b) { return same(b, name); })[0] || null; }
  function memberOf(sn) { return D.MEMBERS.filter(function (m) { return same(m.sn, sn); })[0] || null; }
  function isBlocked(name) { return !!app.state.blocked[name]; }
  function validName(n) { return /^[A-Za-z][A-Za-z0-9_ ]{2,15}$/.test(n); }
  // Buddies are online when the sim says so; directory members come and go by the hour.
  function isOnline(sn) {
    var b = findBuddy(sn);
    if (b) return !!app.onlineBuddies[b];
    var m = memberOf(sn);
    if (!m) return false;
    var n = new Date().getHours();
    for (var i = 0; i < m.sn.length; i++) n += m.sn.charCodeAt(i);
    return n % 10 < 7;
  }

  // A small "type a name" dialog. Resolves with the text, or null if cancelled.
  function askText(title, label, value, maxlen) {
    return new Promise(function (resolve) {
      var input = h('input', { type: 'text', className: 'field', maxlength: maxlen, value: value || '', spellcheck: 'false' });
      var ok = h('button', { className: 'btn default' }, 'OK');
      var cancel = h('button', { className: 'btn' }, 'Cancel');
      var done = false;
      var d = WM.dialog({ title: title, owner: app.win, width: 340, content: h('div', { className: 'aol-ask' }, [
        h('label', null, label), input, h('div', { className: 'button-row right' }, [ok, cancel])
      ]) });
      function fin(v) { if (done) return; done = true; d.close(true); resolve(v); }
      ok.addEventListener('click', function () { fin(input.value.trim()); });
      cancel.addEventListener('click', function () { fin(null); });
      d.on('close', function () { fin(null); });
      input.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') fin(input.value.trim());
        if (e.key === 'Escape') fin(null);
      });
      setTimeout(function () { input.focus(); input.select(); }, 0);
    });
  }

  function startBuddySim() {
    app.onlineBuddies = {};
    allBuddies().forEach(function (b) { if (Math.random() < 0.45) app.onlineBuddies[b] = true; });
    var skater = findBuddy('SkaterGrl1999');
    if (skater) app.onlineBuddies[skater] = true;
    refreshBuddies();
    // Buddies come and go.
    (function churn() {
      later(20000 + Math.random() * 40000, function () {
        var all = allBuddies();
        if (!all.length) { churn(); return; }
        var b = pick(all);
        if (app.onlineBuddies[b]) {
          if (openIm(b, true)) { churn(); return; } // don't leave mid-conversation
          delete app.onlineBuddies[b];
          clip('buddy-out');
        } else {
          app.onlineBuddies[b] = true;
          clip('buddy-in');
        }
        refreshBuddies(b);
        churn();
      });
    })();
    // Someone says hi.
    (function surprise(first) {
      later(first ? 25000 + Math.random() * 20000 : 120000 + Math.random() * 180000, function () {
        var b = visitor();
        if (b && !openIm(b, true)) incomingIm(b, pick(D.BOT.greet) + ' ' + pick(D.BOT.openers[b] || D.BOT.filler));
        surprise(false);
      });
    })(true);
  }
  // An online buddy who hasn't been blocked.
  function visitor() {
    var online = Object.keys(app.onlineBuddies).filter(function (b) { return !isBlocked(b); });
    return online.length ? pick(online) : null;
  }

  function memberInfo(sn) {
    var m = memberOf(sn);
    if (!m) { alertBox('Member Profile: ' + sn + '\n\nThis member has not filled out a profile.', 'info', 'Member Profile'); return; }
    alertBox('Member Profile: ' + m.sn + '\n\nName: ' + m.name + '\nLocation: ' + m.location + '\nOccupation: ' + m.job + '\nHobbies: ' + m.hobbies + '\nComputers: ' + m.computers + '\nPersonal Quote: "' + m.quote + '"', 'info', 'Member Profile');
  }

  function buddyList() {
    var tree = h('div', { className: 'bl-tree sunken-panel' });
    var selected = null;
    function btn(label, icon, fn) { var b = h('button', { className: 'bl-btn' }, [U.img(icon, 16), h('span', null, label)]); b.addEventListener('click', fn); return b; }
    var status = h('div', null, 'Buddy List');
    var head = h('div', { className: 'bl-head' }, [U.img('aol-buddy', 32), h('div', null, [h('b', null, app.sn), status])]);
    var awayBtn = btn('Away', 'aol-buddy', function () { if (app.state.away) imBack(); else awayDialog(); });
    var content = h('div', { className: 'aol-buddy' }, [
      head,
      tree,
      h('div', { className: 'bl-buttons' }, [
        btn('IM', 'aol-im', function () { if (selected && app.onlineBuddies[selected]) openIm(selected); else sendImDialog(selected); }),
        btn('Info', 'info', function () { if (selected) memberInfo(selected); }),
        btn('Setup', 'settings', function () { area('buddysetup'); }),
        btn('Chat', 'aol-chat', function () { area('chat'); }),
        awayBtn,
        btn('Warn', 'warning', function () { area('warnblock', selected); })
      ])
    ]);
    var kid = app.mdi.open({ kind: 'buddy', title: 'Buddy List Online', icon: 'aol-buddy', width: 190, height: 410, x: 'right', y: 8, content: content, className: 'aol-buddywin' });
    kid.refresh = function (flash) {
      var away = app.state.away;
      var title = away ? 'Buddy List (Away)' : 'Buddy List Online';
      if (kid.title !== title) kid.setTitle(title);
      status.textContent = away ? 'Away: ' + away.msg : 'Buddy List';
      head.classList.toggle('away', !!away);
      awayBtn.querySelector('span').textContent = away ? "I'm Back" : 'Away';
      tree.innerHTML = '';
      Object.keys(groups()).forEach(function (g) {
        var names = groups()[g], on = names.filter(function (n) { return app.onlineBuddies && app.onlineBuddies[n]; });
        tree.appendChild(h('div', { className: 'bl-group' }, g + ' (' + on.length + '/' + names.length + ')'));
        on.forEach(function (n) {
          var lv = app.warn[n];
          var row = h('div', { className: 'bl-buddy' + (n === selected ? ' selected' : '') + (n === flash ? ' flash' : '') + (isBlocked(n) ? ' blocked' : ''), title: lv ? 'Warning level: ' + lv + '%' : null }, n + (isBlocked(n) ? ' (blocked)' : ''));
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

  // -------------------------------------------- Away message
  function awayDialog() {
    var s = app.state, away = s.away;
    var presets = s.awayMsgs.concat(D.AWAY_PRESETS);
    var list = h('select', { className: 'field', size: 6 }, presets.map(function (m, i) { return h('option', { value: i }, m); }));
    var text = h('textarea', { className: 'im-compose away-text', maxlength: 200 });
    text.value = away ? away.msg : presets[0];
    list.addEventListener('change', function () { text.value = presets[+list.value]; });
    text.addEventListener('keydown', function (e) { e.stopPropagation(); });
    var ok = h('button', { className: 'btn default' }, "I'm Away");
    var back = h('button', { className: 'btn' }, "I'm Back");
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var d = WM.dialog({ title: 'Set Away Message', owner: app.win, width: 380, content: h('div', { className: 'aol-away' }, [
      h('label', null, 'Pick a message, or write your own:'), list,
      h('label', null, 'Your Away Message:'), text,
      h('p', { className: 'note' }, 'Buddies who IM you while you are away get this message back automatically.'),
      h('div', { className: 'button-row right' }, away ? [ok, back, cancel] : [ok, cancel])
    ]) });
    ok.addEventListener('click', function () {
      var msg = text.value.trim();
      if (!msg) { alertBox('Please type an away message.', 'warning'); return; }
      d.close(true);
      setAway(msg);
    });
    back.addEventListener('click', function () { d.close(true); imBack(); });
    cancel.addEventListener('click', function () { d.close(true); });
    setTimeout(function () { text.focus(); text.select(); }, 0);
  }

  function setAway(msg) {
    var s = app.state;
    s.away = { msg: msg, since: Date.now() };
    if (D.AWAY_PRESETS.indexOf(msg) === -1 && s.awayMsgs.indexOf(msg) === -1) s.awayMsgs = [msg].concat(s.awayMsgs).slice(0, 5);
    saveState();
    refreshBuddies();
    // Somebody always notices.
    later(9000 + Math.random() * 6000, function () {
      var b = s.away && visitor();
      if (b) incomingIm(b, pick(D.BOT.greet) + ' ' + pick(D.BOT.openers[b] || D.BOT.filler));
    });
  }

  function imBack() {
    var s = app.state, away = s.away;
    if (!away) return;
    s.away = null;
    saveState();
    refreshBuddies();
    var mins = Math.max(1, Math.round((Date.now() - away.since) / 60000));
    alertBox('Welcome back, ' + app.sn + '!\n\nYou were away for ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.', 'info');
  }

  // -------------------------------------------- Buddy List Setup
  function buddySetupWindow() {
    var tree = h('div', { className: 'bl-tree sunken-panel' });
    var sel = { g: null, b: null };
    function btn(label, fn) { var b = h('button', { className: 'aol-btn' }, label); b.addEventListener('click', fn); return b; }
    function render() {
      tree.innerHTML = '';
      Object.keys(groups()).forEach(function (g) {
        var grp = h('div', { className: 'bl-group' + (sel.g === g && !sel.b ? ' selected' : '') }, g + ' (' + groups()[g].length + ')');
        grp.addEventListener('click', function () { sel = { g: g, b: null }; render(); });
        tree.appendChild(grp);
        groups()[g].forEach(function (n) {
          var row = h('div', { className: 'bl-buddy' + (sel.b === n ? ' selected' : '') }, n);
          row.addEventListener('click', function () { sel = { g: g, b: n }; render(); });
          tree.appendChild(row);
        });
      });
    }
    function changed() { saveState(); refreshBuddies(); refreshWarnBlock(); render(); }
    function addBuddy() {
      var gs = Object.keys(groups());
      if (!gs.length) { alertBox('Create a group first, then add buddies to it.', 'info'); return; }
      var g = sel.g && groups()[sel.g] ? sel.g : gs[0];
      askText('Add Buddy', 'Screen name to add to "' + g + '":', '', 16).then(function (n) {
        if (n == null) return;
        n = n.replace(/\s+/g, ' ');
        if (!validName(n)) { alertBox('"' + n + '" is not a valid screen name.\n\nScreen names are 3 to 16 characters, start with a letter and use letters, numbers and spaces.', 'warning'); return; }
        if (findBuddy(n)) { alertBox(n + ' is already on your Buddy List.', 'info'); return; }
        groups()[g].push(n);
        if (Math.random() < 0.6) app.onlineBuddies[n] = true;
        sel = { g: g, b: n };
        changed();
      });
    }
    function addGroup() {
      askText('Create Group', 'Name for the new group:', '', 20).then(function (n) {
        if (n == null) return;
        if (!n) { alertBox('Please type a group name.', 'warning'); return; }
        if (Object.keys(groups()).some(function (g) { return same(g, n); })) { alertBox('You already have a group named "' + n + '".', 'info'); return; }
        groups()[n] = [];
        sel = { g: n, b: null };
        changed();
      });
    }
    function remove() {
      if (sel.b) {
        var arr = groups()[sel.g];
        arr.splice(arr.indexOf(sel.b), 1);
        delete app.onlineBuddies[sel.b];
        sel.b = null;
        changed();
      } else if (sel.g && groups()[sel.g]) {
        var g = sel.g, n = groups()[g].length;
        var go = n ? WM.msgbox({ title: 'Delete Group', owner: app.win, icon: 'question', buttons: ['&Yes', '&No'], text: 'Delete the group "' + g + '" and its ' + n + ' buddies?' }) : Promise.resolve('&Yes');
        go.then(function (b) {
          if (b !== '&Yes') return;
          groups()[g].forEach(function (x) { delete app.onlineBuddies[x]; });
          delete groups()[g];
          sel = { g: null, b: null };
          changed();
        });
      } else alertBox('Click a buddy or a group first.', 'info');
    }
    render();
    return app.mdi.open({ kind: 'buddysetup', title: 'Buddy List Setup', icon: 'aol-buddy', width: 270, height: 340, x: 60, y: 30, content: h('div', { className: 'aol-buddy' }, [
      h('p', { className: 'bs-help' }, 'Create groups and add the screen names of your friends. Click a name and choose Remove to delete it.'),
      tree,
      h('div', { className: 'mb-buttons bs-buttons' }, [btn('Add Buddy', addBuddy), btn('Create Group', addGroup), btn('Remove', remove)])
    ]) });
  }

  // -------------------------------------------- Warn and Block
  function warnBlockWindow(prefill) {
    var ex = app.mdi.find('warnblock');
    if (ex) { ex.focus(); if (prefill) ex.setName(prefill); return ex; }
    var input = h('input', { type: 'text', className: 'field', value: prefill || '', spellcheck: 'false' });
    var table = h('table', { className: 'list-table' });
    var bar = h('i', { style: { width: '0%' } });
    var level = h('span', null, '0%');
    input.addEventListener('keydown', function (e) { e.stopPropagation(); });
    input.addEventListener('input', function () { meter(); });
    function meter() { var lv = app.warn[input.value.trim()] || 0; bar.style.width = lv + '%'; level.textContent = lv + '%'; }
    function names() {
      var seen = {};
      return allBuddies().concat(Object.keys(app.state.blocked)).filter(function (n) { if (seen[n]) return false; seen[n] = true; return true; });
    }
    function render() {
      table.innerHTML = '';
      table.appendChild(h('tr', null, [h('th', { style: { width: '100%' } }, 'Screen Name'), h('th', null, 'Warning'), h('th', null, 'IMs')]));
      names().forEach(function (n) {
        var tr = h('tr', { className: same(n, input.value.trim()) ? 'selected' : '' }, [h('td', null, n), h('td', null, (app.warn[n] || 0) + '%'), h('td', null, isBlocked(n) ? 'Blocked' : 'Allowed')]);
        tr.addEventListener('click', function () { input.value = n; kid.refresh(); });
        table.appendChild(tr);
      });
      meter();
    }
    function target() {
      var n = input.value.trim().replace(/\s+/g, ' ');
      if (!validName(n)) { alertBox('Please enter a valid screen name, or click one in the list.', 'warning'); return null; }
      return findBuddy(n) || n;
    }
    function btn(label, fn) { var b = h('button', { className: 'aol-btn' }, label); b.addEventListener('click', fn); return b; }
    var kid = app.mdi.open({ kind: 'warnblock', title: 'Warn and Block', icon: 'aol-buddy', width: 340, height: 340, x: 40, y: 20, content: h('div', { className: 'aol-warn' }, [
      h('p', null, 'Warning tells AOL a member is bothering you. Blocking stops their Instant Messages completely.'),
      h('div', { className: 'so-row' }, [h('label', null, 'Screen Name:'), input]),
      h('div', { className: 'sunken-panel wb-list' }, table),
      h('div', { className: 'wb-level' }, [h('span', null, 'Warning level:'), h('div', { className: 'dl-bar' }, bar), level]),
      h('div', { className: 'mb-buttons' }, [
        btn('Warn', function () { var n = target(); if (n) warnDialog(n); }),
        btn('Block', function () { var n = target(); if (n && !isBlocked(n)) toggleBlock(n); else if (n) alertBox(n + ' is already blocked.', 'info'); }),
        btn('Unblock', function () { var n = target(); if (n && isBlocked(n)) toggleBlock(n); else if (n) alertBox(n + ' is not blocked.', 'info'); })
      ])
    ]) });
    kid.refresh = render;
    kid.setName = function (n) { input.value = n; render(); };
    render();
    return kid;
  }
  function refreshWarnBlock() { var w = app && app.mdi.find('warnblock'); if (w) w.refresh(); }

  function warnDialog(name) {
    var warn = h('button', { className: 'btn default' }, 'Warn');
    var anon = h('button', { className: 'btn' }, 'Warn Anonymously');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var d = WM.dialog({ title: 'Warn ' + name, owner: app.win, width: 380, content: h('div', { className: 'msgbox-wrap' }, [
      h('div', { className: 'msgbox' }, [U.img('warning', 32), h('div', { className: 'text' }, 'Warning ' + name + ' tells AOL this member is sending you unwanted messages.\n\nA warning raises their warning level by 10% (5% if you stay anonymous). Warn only members who are really bothering you.')]),
      h('div', { className: 'button-row' }, [warn, anon, cancel])
    ]) });
    warn.addEventListener('click', function () { d.close(true); doWarn(name, 10); });
    anon.addEventListener('click', function () { d.close(true); doWarn(name, 5); });
    cancel.addEventListener('click', function () { d.close(true); });
  }
  function doWarn(name, pts) {
    var lv = Math.min(100, (app.warn[name] || 0) + pts);
    app.warn[name] = lv;
    var w = app.mdi.find('im:' + name);
    if (w && lv < 100) w.add(name, pick(['omg why did u warn me', 'ur so mean!!', 'i was just kidding lol', 'this is so unfair']), false);
    if (lv >= 100) {
      delete app.onlineBuddies[name];
      if (w) w.add('AOL', name + ' has been disconnected for exceeding the warning limit.', false, 'sys');
      alertBox(name + '\'s warning level has reached 100%.\n\nThey have been signed off America Online. Nicely done.', 'info');
    } else {
      alertBox('You have warned ' + name + '. Their warning level is now ' + lv + '%.\n\n(Was that really necessary?)', 'info');
    }
    refreshBuddies(); refreshWarnBlock();
  }
  function toggleBlock(name) {
    var b = app.state.blocked;
    if (b[name]) delete b[name]; else b[name] = true;
    saveState();
    var w = app.mdi.find('im:' + name);
    if (w) w.add('AOL', b[name] ? 'You have blocked ' + name + '.' : name + ' has been unblocked.', false, 'sys');
    refreshBuddies(); refreshWarnBlock();
    alertBox(b[name] ? 'You have blocked ' + name + '.\n\nThey can no longer send you Instant Messages.' : name + ' has been unblocked.', 'info');
  }

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
      var who = findBuddy(name) || (memberOf(name) || {}).sn;
      if (!who || !isOnline(who)) {
        alertBox(name + ' is not currently signed on.', 'info');
        return;
      }
      kid.close(true);
      var w = openIm(who);
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
      h('div', { className: 'mb-buttons' }, [h('button', { className: 'aol-btn', onclick: function () { warnDialog(name); } }, 'Warn'),
        h('button', { className: 'aol-btn', onclick: function () { toggleBlock(name); } }, 'Block'), send])]);
    kid = app.mdi.open({ kind: 'im:' + name, title: 'Instant Message To: ' + name, icon: 'aol-im', width: 360, height: 300, content: content, className: 'aol-imwin' });
    kid.buddy = name;
    kid.add = function (who, text, mine, cls) {
      log.appendChild(h('div', { className: 'im-line' + (cls ? ' ' + cls : '') }, [h('b', { className: mine ? 'me' : 'them' }, who + ': '), text]));
      log.scrollTop = log.scrollHeight;
    };
    kid.send = function (text) {
      kid.add(app.sn, text, true);
      U.sound('imSend');
      if (isBlocked(name)) { kid.add('AOL', 'You have blocked ' + name + ', so they will not see this message.', false, 'sys'); return; }
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
    if (isBlocked(name)) return;
    var kid = openIm(name);
    kid.setTitle('Instant Message From: ' + name);
    kid.add(name, text.replace('{me}', app.sn), false);
    clip('im');
    // While you're away, they get your away message back, once per away spell.
    var away = app.state.away;
    if (away && kid.awaySince !== away.since) {
      kid.awaySince = away.since;
      later(900, function () {
        if (kid.closed) return;
        kid.add(app.sn + ' (Auto Response)', away.msg, true, 'auto');
        U.sound('imSend');
      });
    }
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
      clip('im');
      if (!bye && Math.random() < 0.35) later(2500 + Math.random() * 3000, function () {
        if (kid.closed || !app.online) return;
        kid.add(name, pick(D.BOT.openers[name] || D.BOT.filler).replace('{me}', app.sn), false);
        clip('im');
      });
    });
  }

  // -------------------------------------------- Member Directory
  function directoryWindow() {
    var q = h('input', { type: 'text', className: 'field', placeholder: 'screen name or keyword', spellcheck: 'false' });
    var find = h('button', { className: 'aol-btn big' }, 'Search');
    var table = h('table', { className: 'list-table' });
    var detail = h('div', { className: 'dir-detail sunken-panel' }, 'Search for a member by screen name, or by anything in their profile. Try: Ohio, skateboarding, DOOM, Beanie Babies.');
    var count = h('span', { className: 'mb-count' });
    var imBtn = h('button', { className: 'aol-btn', disabled: true }, 'Send IM');
    var addBtn = h('button', { className: 'aol-btn', disabled: true }, 'Add Buddy');
    var results = [], cur = null;
    function row(label, value) { return h('div', null, [h('b', null, label + ' '), value]); }
    function show(m) {
      cur = m;
      imBtn.disabled = addBtn.disabled = !m;
      detail.innerHTML = '';
      U.append(detail, [
        h('div', { className: 'dir-sn' }, [h('b', null, m.sn), isOnline(m.sn) ? ' (online)' : ' (not signed on)']),
        row('Name:', m.name), row('Location:', m.location), row('Occupation:', m.job), row('Hobbies:', m.hobbies), row('Computers:', m.computers), row('Quote:', '"' + m.quote + '"')
      ]);
    }
    function search() {
      var text = q.value.trim().toLowerCase();
      if (!text) { alertBox('Your search found 22,000,000 members.\n\nPlease narrow your search.', 'info'); return; }
      var words = text.split(/\s+/);
      results = D.MEMBERS.filter(function (m) {
        var hay = [m.sn, m.name, m.location, m.hobbies, m.quote, m.computers, m.job].join(' ').toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) !== -1; });
      });
      cur = null; imBtn.disabled = addBtn.disabled = true;
      table.innerHTML = '';
      table.appendChild(h('tr', null, [h('th', null, 'Screen Name'), h('th', null, 'Name'), h('th', { style: { width: '100%' } }, 'Location')]));
      results.forEach(function (m) {
        var tr = h('tr', null, [h('td', null, m.sn), h('td', null, m.name), h('td', null, m.location)]);
        tr.addEventListener('click', function () { table.querySelectorAll('tr').forEach(function (r) { r.classList.remove('selected'); }); tr.classList.add('selected'); show(m); });
        U.onActivate(tr, function () { show(m); sendIm(); });
        table.appendChild(tr);
      });
      count.textContent = results.length ? 'Your search found ' + results.length + ' member' + (results.length === 1 ? '' : 's') + '.' : 'No members matched "' + q.value.trim() + '". Try a different keyword.';
      detail.textContent = results.length ? 'Click a member to see the profile.' : '';
    }
    function sendIm() {
      if (!cur) return;
      if (!isOnline(cur.sn)) { alertBox(cur.sn + ' is not currently signed on.', 'info'); return; }
      var fresh = !app.mdi.find('im:' + cur.sn), sn = cur.sn;
      var w = openIm(sn);
      if (fresh) later(1500, function () { if (!w.closed && !isBlocked(sn)) { w.add(sn, pick(D.BOT.greet).replace('{me}', app.sn) + ' ' + pick(D.BOT.openers[sn] || D.BOT.filler), false); clip('im'); } });
    }
    function addBuddy() {
      if (!cur) return;
      if (findBuddy(cur.sn)) { alertBox(cur.sn + ' is already on your Buddy List.', 'info'); return; }
      var g = Object.keys(groups())[0];
      if (!g) { g = 'Buddies'; groups()[g] = []; }
      groups()[g].push(cur.sn);
      if (isOnline(cur.sn)) app.onlineBuddies[cur.sn] = true;
      saveState(); refreshBuddies();
      alertBox(cur.sn + ' has been added to "' + g + '" on your Buddy List.', 'info');
    }
    find.addEventListener('click', search);
    imBtn.addEventListener('click', sendIm);
    addBtn.addEventListener('click', addBuddy);
    q.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') search(); });
    var kid = app.mdi.open({ kind: 'directory', title: 'Member Directory', icon: 'aol-people', width: 460, height: 440, content: h('div', { className: 'aol-dir' }, [
      h('div', { className: 'dir-top' }, [h('label', null, 'Search for:'), q, find]),
      h('div', { className: 'sunken-panel dir-list' }, table), count, detail,
      h('div', { className: 'mb-buttons' }, [imBtn, addBtn])
    ]) });
    setTimeout(function () { q.focus(); }, 0);
    return kid;
  }

  // -------------------------------------------- Chat
  var CHAT_MAX = 23;   // public rooms hold 23 people, like the real ones
  var NAME_A = ['Jenny', 'Mikey', 'Sammy', 'Chrissy', 'Davey', 'Katie', 'Robbie', 'Tommy', 'Lizzy', 'Andy'];
  var NAME_B = ['82', '99', '_OH', '1977', 'xx', '2000', '_FL', '4ever'];
  function fakeName() { return pick(NAME_A) + pick(NAME_B); }

  function findRoom(id) {
    var r = null;
    D.ROOMS.forEach(function (c) { c.rooms.forEach(function (x) { if (x.id === id) r = { room: x, cat: c.id }; }); });
    app.memberRooms.forEach(function (x) { if (x.id === id) r = { room: x, cat: 'member' }; });
    return r;
  }
  // People in a room right now: a base that drifts a little through the hour.
  function roomCount(r) {
    if (r.member) return r.here || 0;
    var n = 0;
    for (var i = 0; i < r.id.length; i++) n += r.id.charCodeAt(i);
    return U.clamp(r.base + (Math.floor(Date.now() / 60000) + n) % 5 - 2, 1, CHAT_MAX);
  }
  function roomCast(flavor, n) {
    var here = flavor.people.slice().sort(function () { return Math.random() - 0.5; }).slice(0, n);
    while (here.length < n) { var nm = fakeName(); if (here.indexOf(nm) === -1) here.push(nm); }
    return here;
  }

  function chatRoom(id) {
    var ex = app.mdi.find('chat');
    if (ex) { ex.focus(); if (id) ex.join(id); return ex; }
    var log = h('div', { className: 'chat-log sunken-panel' });
    var people = h('div', { className: 'chat-people sunken-panel' });
    var count = h('div', { className: 'chat-count' });
    var input = h('input', { type: 'text', className: 'field chat-input', maxlength: 92, spellcheck: 'false' });
    var send = h('button', { className: 'aol-btn big' }, 'Send');
    var here = [], room = null, flavor = null, lines = [];
    var content = h('div', { className: 'aol-chat' }, [
      h('div', { className: 'chat-main' }, [log, h('div', { className: 'chat-send' }, [input, send])]),
      h('div', { className: 'chat-side' }, [count, people,
        h('button', { className: 'aol-btn', onclick: function () { area('rooms'); } }, 'List Rooms'),
        h('button', { className: 'aol-btn', onclick: function () { area('createroom'); } }, 'Create a Room')])
    ]);
    var kid = app.mdi.open({ kind: 'chat', title: D.CHAT.room, icon: 'aol-chat', width: 560, height: 360, content: content });
    function renderPeople() {
      people.innerHTML = '';
      [app.sn].concat(here).forEach(function (p) { people.appendChild(h('div', null, p)); });
      count.textContent = 'People Here: ' + (here.length + 1);
      if (room && room.member) room.here = here.length + 1;
    }
    function line(who, text, cls) {
      log.appendChild(h('div', { className: 'chat-line ' + (cls || '') }, [h('b', null, who + ':'), '  ' + text]));
      while (log.children.length > 200) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
    // Switch to another room, with its own cast and chatter.
    kid.join = function (rid, quiet) {
      var f = findRoom(rid);
      if (!f) return;
      room = f.room; flavor = D.ROOM_FLAVOR[f.cat];
      lines = flavor.lines.concat(room.lines || []);
      here = room.member ? [] : roomCast(flavor, roomCount(room) - 1);
      log.innerHTML = '';
      kid.setTitle(room.name);
      line('OnlineHost', '*** You are in "' + room.name + '". ***', 'host');
      if (room.member) line('OnlineHost', 'You are the first one here. Others will wander in soon.', 'host');
      renderPeople();
      if (!quiet) U.sound('doorOpen');
    };
    kid.join(id || 'lobby42', true);
    var timer = every(3500, function () {
      if (kid.closed) return;
      var r = Math.random();
      if (r < 0.08 && here.length > (room.member ? 0 : 4)) {
        var gone = here.splice(Math.floor(Math.random() * here.length), 1)[0];
        line('OnlineHost', gone + ' has left the room.', 'host'); renderPeople();
      } else if (r < (room.member && here.length < 3 ? 0.4 : 0.16)) {
        var outside = flavor.people.filter(function (p) { return here.indexOf(p) === -1; });
        var p = outside.length ? pick(outside) : fakeName();
        if (here.length < CHAT_MAX - 1 && here.indexOf(p) === -1) { here.push(p); line('OnlineHost', p + ' has entered the room.', 'host'); renderPeople(); }
      } else if (r < 0.7 && here.length) {
        line(pick(here), pick(lines));
      }
    });
    function post() {
      var t = input.value.trim();
      if (!t) return;
      input.value = '';
      line(app.sn, t, 'me');
      if (here.length && Math.random() < 0.6) later(1500 + Math.random() * 3000, function () {
        if (kid.closed || !here.length) return;
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

  // The categorized room list.
  function roomListWindow() {
    var cur = D.ROOMS[0].id, selected = null;
    var catList = h('div', { className: 'rl-cats sunken-panel' });
    var table = h('table', { className: 'list-table' });
    function categories() {
      var pub = app.memberRooms.filter(function (r) { return !r.priv; });
      return D.ROOMS.concat(pub.length ? [{ id: 'member', name: 'Member Rooms', rooms: pub }] : []);
    }
    function go() {
      if (!selected) { alertBox('Click a room first, then click Go.', 'info'); return; }
      joinRoom(selected);
    }
    function render() {
      selected = null;
      var cats = categories();
      catList.innerHTML = '';
      cats.forEach(function (c) {
        var row = h('div', { className: 'kwl-row' + (c.id === cur ? ' selected' : '') }, c.name);
        row.addEventListener('click', function () { cur = c.id; render(); });
        catList.appendChild(row);
      });
      var c = cats.filter(function (x) { return x.id === cur; })[0] || cats[0];
      table.innerHTML = '';
      table.appendChild(h('tr', null, [h('th', { style: { width: '100%' } }, 'Room Name'), h('th', null, 'People')]));
      c.rooms.forEach(function (r) {
        var n = roomCount(r);
        var tr = h('tr', null, [h('td', null, r.name), h('td', null, !r.member && n >= CHAT_MAX ? n + ' (full)' : String(n))]);
        tr.addEventListener('click', function () { table.querySelectorAll('tr').forEach(function (x) { x.classList.remove('selected'); }); tr.classList.add('selected'); selected = r; });
        U.onActivate(tr, function () { selected = r; go(); });
        table.appendChild(tr);
      });
    }
    function btn(label, fn) { var b = h('button', { className: 'aol-btn' }, label); b.addEventListener('click', fn); return b; }
    var kid = app.mdi.open({ kind: 'rooms', title: 'List Rooms', icon: 'aol-chat', width: 470, height: 320, content: h('div', { className: 'aol-rooms' }, [
      h('div', { className: 'rl-body' }, [catList, h('div', { className: 'sunken-panel rl-rooms' }, table)]),
      h('div', { className: 'mb-buttons' }, [btn('Go', go), btn('Create a Room', function () { createRoomDialog(); }), btn('Refresh', render)])
    ]) });
    kid.refresh = render;
    render();
    return kid;
  }

  function joinRoom(r) {
    if (!r.member && roomCount(r) >= CHAT_MAX) {
      alertBox('Sorry, "' + r.name + '" is full.\n\nPublic rooms hold ' + CHAT_MAX + ' people. Try another room, or create your own.', 'warning', 'People Connection');
      return;
    }
    area('chat', r.id);
  }

  function createRoomDialog() {
    var input = h('input', { type: 'text', className: 'field', maxlength: 20, spellcheck: 'false' });
    var priv = h('input', { type: 'checkbox' });
    var err = h('div', { className: 'aol-err' });
    var ok = h('button', { className: 'btn default' }, 'Create');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var d = WM.dialog({ title: 'Create a Room', owner: app.win, width: 360, content: h('div', { className: 'aol-ask' }, [
      h('label', null, 'Name your new room (3 to 20 characters):'), input,
      h('label', { className: 'check' }, [priv, 'Private room (not listed; friends need the name)']), err,
      h('div', { className: 'button-row right' }, [ok, cancel])
    ]) });
    function submit() {
      var name = input.value.trim().replace(/\s+/g, ' ');
      if (!/^[A-Za-z0-9][A-Za-z0-9 '!&-]{2,19}$/.test(name)) { err.textContent = 'Room names are 3-20 letters, numbers or spaces.'; U.sound('chord'); return; }
      var taken = app.memberRooms.some(function (r) { return same(r.name, name); }) || D.ROOMS.some(function (c) { return c.rooms.some(function (r) { return same(r.name, name); }); });
      if (taken) { err.textContent = 'A room named "' + name + '" already exists.'; U.sound('chord'); return; }
      var room = { id: 'm' + Date.now(), name: name, member: true, priv: priv.checked, here: 1 };
      app.memberRooms.push(room);
      d.close(true);
      area('chat', room.id);
      var w = app.mdi.find('rooms');
      if (w) w.refresh();
    }
    ok.addEventListener('click', submit);
    cancel.addEventListener('click', function () { d.close(true); });
    input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') submit(); if (e.key === 'Escape') d.close(true); });
    setTimeout(function () { input.focus(); }, 0);
    return d;
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

  // -------------------------------------------- Download Manager
  var DL_RATE = 3.4;   // KB per second: a 28.8 modem on a good day

  function dlQueue() {
    if (!app.downloads) app.downloads = D.DOWNLOADS.slice(0, 3).map(function (f) { return { name: f[0], kb: f[1], from: f[2], got: 0, done: false }; });
    return app.downloads;
  }
  function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

  // One file at a time, like the real thing. Runs even if the window is closed.
  function dlTick() {
    var q = dlQueue(), cur = q.filter(function (f) { return !f.done; })[0];
    if (!cur) { app.dlRunning = false; return; }
    cur.got = Math.min(cur.kb, cur.got + DL_RATE * 0.5);
    if (cur.got >= cur.kb) {
      cur.done = true;
      clip('files-done', "File's done!");
      if (q.every(function (f) { return f.done; })) {
        app.dlRunning = false;
        alertBox('Your file transfer is complete.\n\n' + q.length + ' file' + (q.length === 1 ? '' : 's') + ' saved to C:\\America Online 4.0\\Download.', 'info', 'Download Manager');
      }
    }
    var w = app.mdi.find('downloads');
    if (w) w.refresh();
  }

  function downloadsWindow() {
    var table = h('table', { className: 'list-table' });
    var foot = h('span', { className: 'mb-count' });
    var selected = null;
    function btn(label, fn) { var b = h('button', { className: 'aol-btn' }, label); b.addEventListener('click', fn); return b; }
    function render() {
      var q = dlQueue(), first = q.filter(function (f) { return !f.done; })[0];
      table.innerHTML = '';
      table.appendChild(h('tr', null, [h('th', null, 'File'), h('th', null, 'Size'), h('th', { style: { width: '100%' } }, 'Progress'), h('th', null, 'Status'), h('th', null, 'Left')]));
      q.forEach(function (f) {
        var pct = Math.round(f.got / f.kb * 100);
        var st = f.done ? 'Done' : (app.dlRunning && f === first) ? DL_RATE + ' KB/s' : f.got ? 'Stopped' : 'Waiting';
        var tr = h('tr', { className: f === selected ? 'selected' : '' }, [
          h('td', null, f.name), h('td', null, f.kb + ' KB'),
          h('td', null, h('div', { className: 'dl-bar' }, h('i', { style: { width: pct + '%' } }))),
          h('td', null, st), h('td', null, f.done ? '' : fmtTime((f.kb - f.got) / DL_RATE))
        ]);
        tr.addEventListener('click', function () { selected = f; render(); });
        table.appendChild(tr);
      });
      var n = q.filter(function (f) { return f.done; }).length;
      foot.textContent = q.length ? n + ' of ' + q.length + ' files complete. Connected at 28,800 bps.' : 'No files are waiting to be downloaded.';
    }
    function start() {
      if (dlQueue().every(function (f) { return f.done; })) { alertBox('There are no files waiting to be downloaded.\n\nClick Add File to queue one.', 'info', 'Download Manager'); return; }
      if (app.dlRunning) return;
      app.dlRunning = true;
      if (app.dlTimer) clearInterval(app.dlTimer);
      app.dlTimer = every(500, function () { if (app.dlRunning) dlTick(); else { clearInterval(app.dlTimer); app.dlTimer = null; render(); } });
      render();
    }
    function add() {
      var have = dlQueue().map(function (f) { return f.name; });
      var more = D.DOWNLOADS.filter(function (f) { return have.indexOf(f[0]) === -1; });
      if (!more.length) { alertBox('There are no more files available for download today.', 'info', 'Download Manager'); return; }
      var f = pick(more);
      dlQueue().push({ name: f[0], kb: f[1], from: f[2], got: 0, done: false });
      render();
    }
    function remove() {
      if (!selected) return;
      var q = dlQueue();
      q.splice(q.indexOf(selected), 1);
      selected = null;
      render();
    }
    var kid = app.mdi.open({ kind: 'downloads', title: 'Download Manager', icon: 'aol-myfiles', width: 480, height: 280, content: h('div', { className: 'aol-dl' }, [
      h('div', { className: 'sunken-panel dl-list' }, table), foot,
      h('div', { className: 'mb-buttons' }, [btn('Start Download', start), btn('Stop', function () { app.dlRunning = false; render(); }), btn('Remove', remove), btn('Add File', add)])
    ]) });
    kid.refresh = render;
    render();
    return kid;
  }

  // -------------------------------------------- Print
  // Progress, then the printer that isn't there.
  function printDialog() {
    var k = app.mdi.active;
    if (!k) { alertBox('There is nothing to print.\n\nOpen a window first.'); return; }
    var bar = h('i', { style: { width: '0%' } });
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var d = WM.dialog({ title: 'Print', owner: app.win, width: 320, content: h('div', { className: 'aol-print' }, [
      h('div', { className: 'msgbox' }, [U.img('aol-print', 32), h('div', { className: 'text' }, 'Printing "' + k.title + '"...\n\nPage 1 of 1 on HP DeskJet 600 (LPT1)')]),
      h('div', { className: 'dl-bar' }, bar),
      h('div', { className: 'button-row' }, [cancel])
    ]) });
    var pct = 0;
    var t = every(150, function () {
      pct += 4 + Math.random() * 8;
      bar.style.width = Math.min(pct, 96) + '%';
      if (pct < 100) return;
      clearInterval(t);
      d.close(true);
      WM.msgbox({ title: 'Print', owner: app.win, icon: 'error', buttons: ['&Retry', 'Cancel'],
        text: 'There was an error writing to LPT1.\n\nMake sure the printer is connected properly and turned on, then click Retry.' }).then(function (b) { if (b === '&Retry' && app) printDialog(); });
    });
    d.on('close', function () { clearInterval(t); });
    cancel.addEventListener('click', function () { d.close(true); });
  }

  // -------------------------------------------- Spell Check
  var spellDict = null;
  // Edit distance where swapping two neighbours ("teh") counts as one edit.
  function editDist(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }
  function suggestWords(w) {
    return Object.keys(spellDict).filter(function (k) { return Math.abs(k.length - w.length) <= 2; })
      .map(function (k) { return [editDist(w, k) + (k.charAt(0) === w.charAt(0) ? 0 : 0.5), k]; })
      .filter(function (x) { return x[0] <= 2; })
      .sort(function (a, b) { return a[0] - b[0] || a[1].localeCompare(b[1]); })
      .slice(0, 5).map(function (x) { return x[1]; });
  }

  // Walks the text in a Write Mail box, asking about each word the dictionary doesn't know.
  function spellCheck(ta) {
    if (!spellDict) { spellDict = {}; D.SPELL.forEach(function (w) { spellDict[w] = true; }); }
    var ignore = {}, pos = 0, found = 0;
    function next() {
      var re = /[A-Za-z][A-Za-z']*/g, m, text = ta.value;
      re.lastIndex = pos;
      while ((m = re.exec(text))) {
        var w = m[0].replace(/'+$/, ''), low = w.toLowerCase().replace(/'s$/, '').replace(/'/g, '');
        var prev = text.slice(0, m.index).replace(/[\s"(]+$/, '').slice(-1);
        var skip = low.length < 2 || spellDict[low] || ignore[low]
          || (/^[A-Z]/.test(w) && prev && !/[.!?]/.test(prev))            // a name, mid-sentence
          || (w === w.toUpperCase() && w.length <= 4)                     // AOL, LOL, TTYL
          || /\d/.test(text.charAt(m.index + m[0].length)) || /\d/.test(text.charAt(m.index - 1));
        if (skip) continue;
        found++;
        return ask(m.index, m.index + w.length, w, low);
      }
      alertBox(found ? 'The spelling check is complete.' : 'No misspellings were found. Congratulations!', 'info', 'Spell Check');
    }
    function ask(start, end, word, low) {
      var sug = suggestWords(low).map(function (s) { return /^[A-Z]/.test(word) ? s.charAt(0).toUpperCase() + s.slice(1) : s; });
      var change = h('input', { type: 'text', className: 'field', value: sug[0] || word, spellcheck: 'false' });
      var list = h('select', { className: 'field', size: 5 }, sug.map(function (s) { return h('option', { value: s }, s); }));
      list.addEventListener('change', function () { change.value = list.value; });
      change.addEventListener('keydown', function (e) { e.stopPropagation(); });
      function btn(label, fn, def) { var b = h('button', { className: 'btn' + (def ? ' default' : '') }, label); b.addEventListener('click', fn); return b; }
      var d = WM.dialog({ title: 'Spell Check', owner: app.win, width: 340, content: h('div', { className: 'aol-ask' }, [
        h('div', null, ['Not in dictionary: ', h('b', null, word)]),
        h('label', null, 'Change to:'), change,
        h('label', null, 'Suggestions:'), list,
        h('div', { className: 'button-row right' }, [
          btn('Ignore', function () { d.close(true); pos = end; next(); }),
          btn('Ignore All', function () { d.close(true); ignore[low] = true; pos = end; next(); }),
          btn('Change', function () {
            var t = ta.value;
            ta.value = t.slice(0, start) + change.value + t.slice(end);
            d.close(true); pos = start + change.value.length; next();
          }, true),
          btn('Cancel', function () { d.close(true); })
        ])
      ]) });
      setTimeout(function () { change.focus(); change.select(); }, 0);
    }
    next();
  }

  // -------------------------------------------- Time Online
  // The 1998 price list, as a readout: unlimited vs. $4.95 for 5 hours, then $2.95 an hour.
  function timeOnlineWindow() {
    var out = h('div', { className: 'to-out' });
    function hms(sec) { sec = Math.floor(sec); return Math.floor(sec / 3600) + ':' + String(Math.floor(sec / 60) % 60).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
    function row(label, value) { return h('div', { className: 'to-row' }, [h('span', null, label), h('b', null, value)]); }
    function render() {
      var now = Date.now();
      var month = (app.state.usage[usageKey()] || 0) + (now - app.usageAt) / 1000;
      var hours = month / 3600, pay = 4.95 + Math.max(0, hours - 5) * 2.95;
      out.innerHTML = '';
      U.append(out, [
        row('Screen name:', app.sn),
        row('Signed on at:', new Date(app.since).toLocaleTimeString('en-US')),
        row('Time online this session:', hms((now - app.since) / 1000)),
        row('This month:', hours.toFixed(1) + ' hours (' + Math.round(month / 60) + ' minutes)'),
        row('Free hours left on the CD:', Math.max(0, 1000 - hours).toFixed(1) + ' of 1,000'),
        h('h4', null, 'What you would owe in 1998'),
        row('Unlimited Access:', '$21.95 a month'),
        row('$4.95 for 5 hours, then $2.95 an hour:', '$' + pay.toFixed(2)),
        h('p', null, pay > 21.95
          ? 'Unlimited saves you $' + (pay - 21.95).toFixed(2) + ' this month. Smart choice!'
          : 'The hourly plan would cost $' + (21.95 - pay).toFixed(2) + ' less this month. Break-even is about 10.8 hours. Stay online a little longer!'),
        h('p', { className: 'note' }, 'Your free hours are on the house. Nobody has ever actually been billed.')
      ]);
    }
    var kid = app.mdi.open({ kind: 'timeonline', title: 'Time Online', icon: 'aol-myaol', width: 400, height: 340, content: h('div', { className: 'aol-timeonline' }, [
      h('div', { className: 'q-top' }, [U.img('aol-myaol', 32), h('div', null, [h('b', null, 'Time Online'), h('div', null, 'Your AOL account usage')])]), out
    ]) });
    var t = every(1000, render);
    kid.on('close', function () { clearInterval(t); });
    render();
    return kid;
  }

  // -------------------------------------------- The AOL 4.0 CD (drive D:)
  var cdLoading = false;
  // Opening D: spins the disc, then the autorun splash appears.
  function launchCd() {
    if (cdLoading) return null;
    cdLoading = true;
    document.body.classList.add('busy');
    U.sound('hddSeek', 1300);
    setTimeout(function () {
      document.body.classList.remove('busy');
      cdLoading = false;
      if (Shell.ready()) cdSplash();
    }, 1300);
    return null;
  }

  function cdSplash() {
    var install = h('button', { className: 'aol-btn big default' }, 'Install America Online');
    var exit = h('button', { className: 'aol-btn big' }, 'Exit');
    var files = ['AOL.EXE', 'WAOL.DLL', 'AOLDIAL.DLL', 'MODEMS.INF', 'FREEHRS.DAT', 'WELCOME.WAV'];
    var status = h('div', { className: 'cd-status' });
    var bar = h('i', { style: { width: '0%' } });
    var buttons = h('div', { className: 'cd-buttons' }, [install, exit]);
    var win = WM.open({ app: 'aolcd', title: 'America Online 4.0', icon: 'drive-cd', width: 440, height: 'auto', resizable: false, maximizable: false,
      content: h('div', { className: 'aolcd' }, [
        h('div', { className: 'cd-art' }, [U.img('aol-logo', 64), h('div', null, [h('div', { className: 'cd-name' }, 'America Online'), h('div', { className: 'cd-ver' }, 'Version 4.0 for Windows 95/98')])]),
        h('div', { className: 'cd-head' }, 'Install America Online 4.0 \u2014 1000 hours FREE!'),
        h('p', { className: 'cd-fine' }, 'Try AOL free for 45 days. Chat, e-mail, surf the Web and hear "You\'ve got mail!" for the first time in your own home.\n\nRequires a 486 or better, 16 MB of RAM, a modem and a phone line nobody else is using.'),
        status, h('div', { className: 'dl-bar hidden' }, bar), buttons
      ]) });
    var t = null;
    win.on('close', function () { clearInterval(t); });
    exit.addEventListener('click', function () { win.close(true); });
    install.addEventListener('click', function () {
      buttons.classList.add('hidden');
      bar.parentNode.classList.remove('hidden');
      var pct = 0;
      U.sound('hddSeek', 3000);
      t = setInterval(function () {
        pct += 3 + Math.random() * 5;
        bar.style.width = Math.min(pct, 100) + '%';
        status.textContent = 'Copying ' + files[Math.min(files.length - 1, Math.floor(pct / 100 * files.length))] + ' to C:\\America Online 4.0';
        if (pct < 100) return;
        clearInterval(t);
        status.textContent = 'Setup is complete.';
        setTimeout(function () { win.close(true); Shell.launch('aol'); }, 500);
      }, 120);
    });
    setTimeout(function () { install.focus(); }, 0);
    return win;
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

  Shell.register('aolcd', { name: 'AOL 4.0 CD', icon: 'drive-cd', single: true, launch: launchCd });
  Shell.register('aol', { name: 'America Online', icon: 'aol', single: true, launch: launch, reopen: function (w, arg) { if (arg && app && app.online) go(arg); } });
})();
