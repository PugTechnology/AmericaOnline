/* Internet Explorer 4, browsing the Wayback Machine's copy of the late-90s web. */
(function () {
  var h = U.h;
  var HOME = 'http://home.microsoft.com/';

  function launch(url) {
    var pane = Web.pane({ icon: 'ie' });
    var addr = h('input', { type: 'text', className: 'ie-address', spellcheck: 'false', autocomplete: 'off' });
    var status = h('div'), zone = h('div', { className: 'fixed' }, [U.img('network', 16), ' Internet zone']);
    var throbber = h('div', { className: 'ie-throbber' }, U.img('windows-flag', 32));
    // The progress bar that fills while a page loads (slowly, with the 28.8k modem on).
    var progFill = h('i');
    var progBox = h('div', { className: 'fixed ie-progress' }, progFill);

    function tb(icon, label, fn) {
      var b = h('button', { className: 'tbtn', title: label }, [U.img(icon, 16), h('span', null, label)]);
      b.addEventListener('click', fn);
      return b;
    }
    var bBack = tb('aol-back', 'Back', function () { pane.back(); });
    var bFwd = tb('aol-forward', 'Forward', function () { pane.forward(); });

    var content = [
      h('div', { className: 'ie-bars' }, [
        h('div', { className: 'toolbar' }, [
          bBack, bFwd,
          tb('aol-stop', 'Stop', function () { pane.stop(); }),
          tb('aol-reload', 'Refresh', function () { pane.reload(); }),
          tb('aol-home', 'Home', function () { pane.go(HOME); }),
          h('div', { className: 'tb-divider' }),
          tb('find', 'Search', function () { pane.go('www.altavista.com'); }),
          tb('favorites', 'Favorites', function (e) { favMenu(e.currentTarget); }),
          tb('aol-channels', 'Channels', function () { pane.go('www.msnbc.com'); }),
          h('div', { className: 'tb-divider' }),
          tb('aol-read', 'Mail', function () { Shell.launch('aol'); })
        ]),
        throbber
      ]),
      h('div', { className: 'address-bar' }, [h('span', null, U.label('A&ddress')), h('div', { className: 'combo' }, [U.img('ie', 16), addr]),
        h('button', { className: 'btn go-btn', onclick: function () { go(); } }, 'Go')]),
      h('div', { className: 'ie-view sunken-panel' }, pane.el),
      h('div', { className: 'status-bar' }, [status, progBox, zone])
    ];

    var win = WM.open({ app: 'ie', title: 'Microsoft Internet Explorer', icon: 'ie', width: 720, height: 520, content: content, className: 'ie', shield: true });

    function go() { var v = addr.value.trim(); if (v) pane.go(v); }
    addr.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); } });

    pane.onchange = function (what) {
      addr.value = pane.url;
      win.setTitle((pane.title || 'about:blank') + ' - Microsoft Internet Explorer');
      bBack.disabled = !pane.canBack();
      bFwd.disabled = !pane.canForward();
      throbber.classList.toggle('busy', what === 'loading');
      status.textContent = what === 'loading' ? 'Opening page ' + pane.url + '...' : 'Done';
      progBox.classList.toggle('on', what === 'loading');
    };
    pane.onprogress = function (p) { progFill.style.width = Math.round(p * 100) + '%'; };

    var FAVS = [
      ['Yahoo!', 'www.yahoo.com'], ['AltaVista', 'www.altavista.com'], ['Ask Jeeves', 'www.askjeeves.com'], ['CNN Interactive', 'www.cnn.com'],
      ['GeoCities', 'www.geocities.com'], ['Amazon.com', 'www.amazon.com'], ['eBay', 'www.ebay.com'], ['Space Jam', 'www2.warnerbros.com/spacejam/movie/jam.htm'],
      ['Zombo.com', 'www.zombo.com'], ['Slashdot', 'slashdot.org']
    ];
    function favMenu(anchor) {
      var r = anchor.getBoundingClientRect();
      Menu.popup(favItems(), r.left, r.bottom);
    }
    function favItems() {
      return [{ label: '&Add to Favorites...', disabled: true }, { label: '&Organize Favorites...', disabled: true }, '-'].concat(
        FAVS.map(function (f) { return { label: f[0], icon: 'ie', action: function () { pane.go(f[1]); } }; }));
    }

    function yearMenu() {
      return [1996, 1997, 1998, 1999, 2000, 2001].map(function (y) {
        return { label: String(y), checked: Web.year() === y, action: function () { Web.setYear(y); pane.reload(); } };
      });
    }

    Menu.bar(win, [
      { label: '&File', items: [
        { label: '&New', items: [{ label: '&Window', action: function () { Shell.launch('ie'); } }] },
        { label: '&Open...', action: function () { addr.focus(); addr.select(); } },
        '-',
        { label: 'Wor&k Offline', disabled: true },
        { label: '&Close', action: function () { win.close(); } }
      ] },
      { label: '&Edit', items: [{ label: 'Cu&t', disabled: true }, { label: '&Copy', disabled: true }, { label: '&Paste', disabled: true }] },
      { label: '&View', items: function () {
        return [
          { label: '&Stop', shortcut: 'Esc', action: function () { pane.stop(); } },
          { label: '&Refresh', shortcut: 'F5', action: function () { pane.reload(); } },
          '-',
          { label: 'Time &Travel', items: yearMenu },
          { label: 'Simulate 28.8k &Modem', checked: Web.modemOn(), action: function () { Web.setModem(!Web.modemOn()); } }
        ];
      } },
      { label: '&Go', items: [
        { label: '&Back', action: function () { pane.back(); } },
        { label: '&Forward', action: function () { pane.forward(); } },
        '-',
        { label: '&Home Page', action: function () { pane.go(HOME); } },
        { label: '&Search the Web', action: function () { pane.go('www.altavista.com'); } }
      ] },
      { label: 'F&avorites', items: favItems },
      { label: '&Help', items: [
        { label: '&About Internet Explorer', action: function () {
          WM.msgbox({ title: 'About Internet Explorer', owner: win, icon: 'info', text: 'Microsoft Internet Explorer 4.0\n\nThe pages you see are real copies of the web from the late 1990s, preserved by the Internet Archive\'s Wayback Machine (web.archive.org). Some pages load slowly or have missing pictures, just like in 1998.' });
        } }
      ] }
    ]);

    win.on('close', function () { pane.destroy(); });
    pane.go(url || HOME);
    return win;
  }

  Shell.register('ie', { name: 'Internet Explorer', icon: 'ie', launch: launch });
})();
