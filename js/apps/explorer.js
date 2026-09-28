/*
 * Folder windows: My Computer, drives and folders on C:, Recycle Bin, Control Panel,
 * Printers, Network Neighborhood and Dial-Up Networking, with the Win98 Web View pane.
 */
(function () {
  var h = U.h;

  var SPECIAL = {
    'My Computer': { icon: 'computer', title: 'My Computer' },
    'Recycle Bin': { icon: 'recycle-empty', title: 'Recycle Bin' },
    'Control Panel': { icon: 'control-panel', title: 'Control Panel' },
    'Printers': { icon: 'printers', title: 'Printers' },
    'Network Neighborhood': { icon: 'network', title: 'Network Neighborhood' },
    'Dial-Up Networking': { icon: 'network', title: 'Dial-Up Networking' },
    'Entire Network': { icon: 'network', title: 'Entire Network' }
  };

  function driveNotReady(letter, owner) {
    var floppy = letter === 'A';
    U.sound(floppy ? 'floppyRead' : 'hddSeek', floppy ? 1800 : 700);
    document.body.classList.add('busy');
    return U.wait(floppy ? 1800 : 1200).then(function () {
      document.body.classList.remove('busy');
      return WM.msgbox({ title: floppy ? '3\u00bd Floppy (A:)' : 'CD-ROM (D:)', owner: owner, icon: 'error', buttons: ['&Retry', 'Cancel'],
        text: letter + ':\\ is not accessible.\n\nThe device is not ready.' });
    }).then(function (b) { if (b === '&Retry') return driveNotReady(letter, owner); });
  }

  // Items for a location. Each: { name, icon, open(), path?, node?, desc, kind }
  function itemsFor(loc, win) {
    if (loc === 'My Computer') {
      return [
        { name: '3\u00bd Floppy (A:)', icon: 'drive-floppy', kind: 'drive', desc: '3\u00bd Inch Floppy Disk', open: function () { driveNotReady('A', win); } },
        { name: 'Presario (C:)', icon: 'drive-hdd', kind: 'drive', drive: true, desc: 'Local Disk', open: function () { nav('C:\\'); } },
        { name: '(D:)', icon: 'drive-cd', kind: 'drive', desc: 'CD-ROM Disc', open: function () { driveNotReady('D', win); } },
        { name: 'Printers', icon: 'printers', kind: 'sys', desc: 'Use the Printers folder to add, remove, and change settings for printers.', open: function () { nav('Printers'); } },
        { name: 'Control Panel', icon: 'control-panel', kind: 'sys', desc: 'Use the settings in Control Panel to personalize your computer.', open: function () { nav('Control Panel'); } },
        { name: 'Dial-Up Networking', icon: 'network', kind: 'sys', desc: 'Connects to other computers by using a modem.', open: function () { nav('Dial-Up Networking'); } },
        { name: 'Scheduled Tasks', icon: 'folder', kind: 'sys', desc: 'Schedules computer tasks to run automatically.', open: function () { WM.msgbox({ title: 'Scheduled Tasks', owner: win, icon: 'info', text: 'There are no scheduled tasks. ScanDisk will have to wait.' }); } }
      ];
    }
    if (loc === 'Control Panel') {
      return [
        cp('Add/Remove Programs', 'exe', 'addremove', 'Sets up programs and creates shortcuts.'),
        cp('Date/Time', 'settings', 'datetime', 'Changes date, time, and time zone information.'),
        cp('Desktop Themes', 'display', 'themes', 'Changes the look and sound of your whole desktop with a Plus! 98 theme.'),
        cp('Display', 'display', 'display', 'Changes display settings: background, colors, screen saver.'),
        cp('Compaq QuickRestore', 'drive-hdd', 'quickrestore', 'Restores drive C: to the way it left the factory.'),
        cp('Internet', 'ie', 'internet', 'Configures your Internet display and connection settings.'),
        cp('Sounds', 'volume', 'sounds', 'Changes the sounds your computer makes.'),
        cp('System', 'computer', 'system', 'Provides system information and changes advanced settings.')
      ];
    }
    if (loc === 'Printers') {
      return [{ name: 'Add Printer', icon: 'printers', kind: 'sys', desc: 'Adds a new printer.', open: function () {
        WM.msgbox({ title: 'Add Printer Wizard', owner: win, icon: 'warning', text: 'Windows could not find a printer on LPT1.\n\nMake sure the printer is turned on and the cable is plugged in.' });
      } }];
    }
    if (loc === 'Network Neighborhood') {
      return [{ name: 'Entire Network', icon: 'network', kind: 'sys', desc: 'Shows all the computers on your network.', open: function () {
        WM.msgbox({ title: 'Network Neighborhood', owner: win, icon: 'error', text: 'Unable to browse the network.\n\nThe network is not accessible.\n\nFor more information, look up \'troubleshooting network\' in the Help Index.' });
      } }];
    }
    if (loc === 'Dial-Up Networking') {
      return [
        { name: 'Make New Connection', icon: 'network', kind: 'sys', desc: 'Creates a new Dial-Up Networking connection.', open: function () {
          WM.msgbox({ title: 'Make New Connection', owner: win, icon: 'info', text: 'Why bother? America Online brings its own dialer.\n\nDouble-click America Online on the desktop.' });
        } },
        { name: 'America Online', icon: 'aol', kind: 'sys', desc: 'AOL dial-up via U.S. Robotics 56K Voice Modem', open: function () { Shell.launch('aol'); } }
      ];
    }
    if (loc === 'Recycle Bin') {
      return (FS.list('C:\\RECYCLED', { hidden: true }) || []).map(function (e) {
        return { name: Shell.displayName(e.name, e.node), rawName: e.name, icon: Shell.iconFor(e.name, e.node), kind: 'recycled', path: e.path, node: e.node,
          desc: 'Original location: ' + (e.node.orig || '?'), open: function () { props({ name: e.name, path: e.path, node: e.node }); } };
      });
    }
    var list = FS.list(loc) || [];
    return list.map(function (e) {
      return { name: Shell.displayName(e.name, e.node), rawName: e.name, icon: Shell.iconFor(e.name, e.node), kind: e.node.t === 'd' ? 'folder' : 'file',
        path: e.path, node: e.node, open: function () {
          if (e.node.t === 'd') nav(e.path); else Shell.open(e.path);
        } };
    });

    function cp(name, icon, page, desc) {
      return { name: name, icon: icon, kind: 'sys', desc: desc, open: function () { Shell.launch('control', page); } };
    }
    function nav(p) { win.navigate(p); }
    function props(it) { showProps(it, win); }
  }

  function locTitle(loc) {
    if (SPECIAL[loc]) return SPECIAL[loc].title;
    if (/^c:\\?$/i.test(loc)) return 'Presario (C:)';
    return FS.basename(loc);
  }
  function locIcon(loc) {
    if (SPECIAL[loc]) {
      if (loc === 'Recycle Bin') return (FS.list('C:\\RECYCLED', { hidden: true }) || []).length ? 'recycle-full' : 'recycle-empty';
      return SPECIAL[loc].icon;
    }
    if (/^c:\\?$/i.test(loc)) return 'drive-hdd';
    if (/my documents$/i.test(loc)) return 'my-documents';
    return 'folder-open';
  }
  function parentOf(loc) {
    if (loc === 'My Computer') return null;
    if (SPECIAL[loc]) return loc === 'Entire Network' ? 'Network Neighborhood' : (loc === 'Recycle Bin' || loc === 'Network Neighborhood' ? null : 'My Computer');
    if (/^c:\\?$/i.test(loc)) return 'My Computer';
    return FS.dirname(loc);
  }

  function showProps(it, owner) {
    var n = it.node;
    var rows = [['Type:', it.kind === 'folder' ? 'File Folder' : n && n.lnk ? 'Shortcut' : n && n.app ? 'Application' : (FS.ext(it.rawName || it.name).toUpperCase() || 'File') + ' File']];
    if (it.path) rows.push(['Location:', n && n.orig ? n.orig : FS.dirname(it.path)]);
    if (n) rows.push(['Size:', FS.formatSize(FS.sizeOf(n)) + ' (' + FS.sizeOf(n).toLocaleString() + ' bytes)']);
    if (n && n.t === 'd') {
      var files = 0, dirs = 0;
      (function walk(d) { for (var k in d.c) { if (d.c[k].t === 'd') { dirs++; walk(d.c[k]); } else files++; } })(n);
      rows.push(['Contains:', files + ' Files, ' + dirs + ' Folders']);
    }
    if (n) rows.push(['Modified:', U.formatDate(n.m)]);
    if (n) rows.push(['Attributes:', (n.sys ? 'Read-only, System' : 'Archive') + (n.hidden ? ', Hidden' : '')]);
    var content = h('div', { className: 'props' }, [
      h('div', { className: 'props-head' }, [U.img(it.icon, 32), h('span', null, it.name)]),
      h('div', { className: 'hr' }),
      h('table', null, rows.map(function (r) { return h('tr', null, [h('td', null, r[0]), h('td', null, r[1])]); })),
      h('div', { className: 'button-row right' }, [h('button', { className: 'btn default', onclick: function () { d.close(true); } }, 'OK')])
    ]);
    var d = WM.dialog({ title: it.name + ' Properties', owner: owner, content: content, width: 340, helpButton: true });
    d.onKey = function (e) { if (e.key === 'Enter' || e.key === 'Escape') { d.close(true); return true; } return false; };
  }

  function drivePie(used, total) {
    var c = h('canvas', { width: 120, height: 70, className: 'pie' });
    var x = c.getContext('2d');
    var cx = 60, cy = 30, rx = 55, ry = 25, depth = 10;
    var frac = used / total;
    // 3D side
    for (var d = depth; d > 0; d--) {
      x.beginPath(); x.ellipse(cx, cy + d, rx, ry, 0, 0, Math.PI * 2);
      x.fillStyle = '#808000'; x.fill();
    }
    x.beginPath(); x.ellipse(cx, cy + depth, rx, ry, 0, 0, Math.PI);
    x.fillStyle = '#000080'; x.fill();
    // top: free (magenta) and used (blue)
    x.beginPath(); x.moveTo(cx, cy); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fillStyle = '#ff00ff'; x.fill();
    x.beginPath(); x.moveTo(cx, cy); x.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); x.closePath();
    x.fillStyle = '#0000ff'; x.fill();
    x.strokeStyle = '#000'; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.stroke();
    return c;
  }

  function launch(loc) {
    loc = loc || 'My Computer';
    var history = [], future = [];
    var view = U.store.get('w98.explorer.view', 'icons');
    var selected = null;

    var iconView = h('div', { className: 'icon-view', tabindex: '0' });
    var webPane = h('div', { className: 'web-pane' });
    var statusLeft = h('div'), statusMid = h('div', { className: 'fixed' }), statusRight = h('div', { className: 'fixed' });
    var addrText = h('span'), addrImg = U.img('computer', 16);
    var btnBack = tbtn('aol-back', 'Back', function () { goBack(); });
    var btnFwd = tbtn('aol-forward', 'Forward', function () { goFwd(); });
    var btnUp = tbtn('folder-up', 'Up', function () { var p = parentOf(loc); if (p) navigate(p); });
    var btnDel = tbtn('error', 'Delete', function () { if (selected) deleteItem(selected); });
    var btnProps = tbtn('sys-file', 'Properties', function () { if (selected) showProps(selected, win); });
    var btnViews = tbtn('exe', 'Views', function () { setView(view === 'icons' ? 'list' : 'icons'); });

    var content = [
      h('div', { className: 'toolbar' }, [btnBack, btnFwd, btnUp, h('div', { className: 'tb-divider' }), btnDel, btnProps, h('div', { className: 'tb-divider' }), btnViews]),
      h('div', { className: 'address-bar' }, [h('span', null, U.label('A&ddress')), h('div', { className: 'combo' }, [addrImg, addrText])]),
      h('div', { className: 'explorer-main' }, [webPane, iconView]),
      h('div', { className: 'status-bar' }, [statusLeft, statusMid, statusRight])
    ];

    var win = WM.open({ app: 'explorer', title: locTitle(loc), icon: locIcon(loc), width: 560, height: 390, content: content, className: 'explorer' });

    function tbtn(icon, label, fn) {
      var b = h('button', { className: 'tbtn', title: label }, [U.img(icon, 16), h('span', null, label)]);
      b.addEventListener('click', fn);
      return b;
    }

    function navigate(p, fromHistory) {
      if (!SPECIAL[p]) {
        if (!FS.isDir(p)) { WM.msgbox({ title: 'Explorer', owner: win, icon: 'error', text: 'Cannot find \'' + p + '\'.' }); return; }
        p = FS.realPath(p);
      }
      if (!fromHistory && p !== loc) { history.push(loc); future = []; }
      loc = p;
      selected = null;
      render();
    }
    win.navigate = navigate;
    function goBack() { if (history.length) { future.push(loc); navigate(history.pop(), true); } }
    function goFwd() { if (future.length) { history.push(loc); navigate(future.pop(), true); } }

    function setView(v) {
      view = v; U.store.set('w98.explorer.view', v);
      iconView.classList.toggle('list', v === 'list');
    }

    var items = [];
    function render() {
      win.setTitle(locTitle(loc));
      win.setIcon(locIcon(loc));
      addrImg.src = U.icon(locIcon(loc), 16);
      addrText.textContent = SPECIAL[loc] ? locTitle(loc) : loc;
      btnBack.disabled = !history.length;
      btnFwd.disabled = !future.length;
      btnUp.disabled = !parentOf(loc);
      btnDel.disabled = true;
      btnProps.disabled = true;
      setView(view);
      items = itemsFor(loc, win);
      iconView.innerHTML = '';
      items.forEach(function (it) {
        var el = h('div', { className: 'item', tabindex: '-1' }, [U.img(it.icon, view === 'list' ? 16 : 32), h('span', { className: 'label' }, it.name)]);
        if (it.node && it.node.lnk) el.firstChild.classList.add('lnk');
        if (it.path && loc !== 'Recycle Bin' && FileClip.isCut(it.path)) el.classList.add('cut');
        it.el = el;
        el.addEventListener('pointerdown', function (e) { e.stopPropagation(); select(it); });
        U.onActivate(el, function () { it.open(); });
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); select(it); itemMenu(it, e.clientX, e.clientY); });
        iconView.appendChild(el);
      });
      iconView.querySelectorAll('img').forEach(function (img) { if (view === 'list') { img.width = 16; img.height = 16; } });
      updateStatus();
      renderWebPane();
    }

    function select(it) {
      selected = it;
      items.forEach(function (i) { i.el.classList.toggle('selected', i === it); });
      var canDelete = it && it.path && !(it.node && it.node.sys);
      btnDel.disabled = !canDelete;
      btnProps.disabled = !it || !it.node;
      updateStatus();
      renderWebPane();
    }

    function updateStatus() {
      var n = items.length;
      if (selected) {
        statusLeft.textContent = selected.desc || (selected.node && selected.node.t === 'f' ? 'Type: ' + (FS.ext(selected.rawName || '').toUpperCase() || 'File') + ' File' : '1 object(s) selected');
        statusMid.textContent = selected.node && selected.node.t === 'f' ? FS.formatSize(FS.sizeOf(selected.node)) : '';
      } else {
        statusLeft.textContent = n + ' object(s)' + (loc === 'Recycle Bin' ? '' : '');
        var total = items.reduce(function (s, it) { return s + (it.node && it.node.t === 'f' ? FS.sizeOf(it.node) : 0); }, 0);
        statusMid.textContent = SPECIAL[loc] ? '' : FS.formatSize(total) + (/^c:\\?$/i.test(loc) ? ' (Disk free space: ' + FS.formatSize(FS.freeSpace()) + ')' : '');
      }
      statusRight.innerHTML = '';
      statusRight.appendChild(U.img(SPECIAL[loc] ? locIcon(loc) : 'computer', 16));
      statusRight.appendChild(document.createTextNode(' ' + (SPECIAL[loc] ? locTitle(loc) : 'My Computer')));
    }

    function renderWebPane() {
      webPane.innerHTML = '';
      webPane.appendChild(U.img(locIcon(loc), 32));
      webPane.appendChild(h('h1', null, locTitle(loc)));
      webPane.appendChild(h('div', { className: 'web-rule' }));
      var it = selected;
      if (!it) {
        var intro = {
          'My Computer': 'Displays the contents of your computer',
          'Control Panel': 'Use the settings in Control Panel to personalize your computer.',
          'Recycle Bin': 'This folder contains files and folders that you have deleted from your computer.',
          'Printers': 'Use the Printers folder to add, remove, and change settings for printers.'
        }[loc] || 'Select an item to view its description.';
        webPane.appendChild(h('p', null, intro));
        if (loc === 'Recycle Bin' && items.length) {
          webPane.appendChild(h('p', null, [h('a', { href: '#', onclick: function (e) { e.preventDefault(); Shell.emptyRecycleBin(); } }, 'Empty Recycle Bin')]));
        }
        if (/my documents$/i.test(loc)) webPane.appendChild(h('p', null, 'Stores and manages documents'));
        return;
      }
      webPane.appendChild(h('p', null, h('b', null, it.name)));
      if (it.drive) {
        var total = FS.DISK_TOTAL, free = FS.freeSpace(), used = total - free;
        webPane.appendChild(h('p', null, 'Local Disk'));
        webPane.appendChild(h('p', null, 'Capacity: ' + FS.formatSize(total)));
        webPane.appendChild(drivePie(used, total));
        webPane.appendChild(h('p', { className: 'legend' }, [h('i', { className: 'sw used' }), 'Used: ' + FS.formatSize(used)]));
        webPane.appendChild(h('p', { className: 'legend' }, [h('i', { className: 'sw free' }), 'Free: ' + FS.formatSize(free)]));
        return;
      }
      if (it.desc) webPane.appendChild(h('p', null, it.desc));
      if (it.node && it.node.t === 'f') {
        webPane.appendChild(h('p', null, (it.node.lnk ? 'Shortcut' : it.node.app ? 'Application' : (FS.ext(it.rawName).toUpperCase() || 'File') + ' File')));
        webPane.appendChild(h('p', null, 'Modified: ' + U.formatDate(it.node.m)));
        webPane.appendChild(h('p', null, 'Size: ' + FS.formatSize(FS.sizeOf(it.node))));
      } else if (it.node) {
        webPane.appendChild(h('p', null, 'File Folder'));
        webPane.appendChild(h('p', null, 'Modified: ' + U.formatDate(it.node.m)));
      }
    }

    function isFolderLoc() { return !SPECIAL[loc]; }

    // Cut / Copy / Paste through the shared file clipboard.
    function clip(mode) { if (selected && selected.path && loc !== 'Recycle Bin') FileClip.set(mode, [selected.path]); }
    function pasteHere() { if (isFolderLoc()) FileClip.paste(loc, win); }
    function canClip() { return !!selected && !!selected.path && loc !== 'Recycle Bin'; }

    function itemMenu(it, x, y) {
      var m = [{ label: '&Open', action: it.open }];
      if (it.kind === 'folder') m.push({ label: '&Explore', action: function () { Shell.launch('explorer', it.path); } });
      if (it.node && it.node.t === 'f' && !it.node.bin) m.push({ label: '&Edit', action: function () { Shell.launch('notepad', it.path); } });
      if (loc === 'Recycle Bin') {
        m = [{ label: 'R&estore', action: function () { FS.restore(it.rawName); render(); } }, '-',
          { label: '&Delete', action: function () { deleteItem(it); } }, '-',
          { label: 'P&roperties', action: function () { showProps(it, win); } }];
      } else if (it.path) {
        m.push('-', { label: 'Cu&t', disabled: it.node && it.node.sys, action: function () { clip('cut'); } }, { label: '&Copy', action: function () { clip('copy'); } });
        if (it.kind === 'folder') m.push({ label: '&Paste', disabled: !FileClip.has(), action: function () { FileClip.paste(it.path, win); } });
        m.push('-',
          { label: '&Delete', disabled: it.node && it.node.sys, action: function () { deleteItem(it); } },
          { label: 'Rena&me', disabled: it.node && it.node.sys, action: function () { rename(it); } },
          '-', { label: 'P&roperties', action: function () { showProps(it, win); } });
      }
      Menu.popup(m, x, y);
    }

    function bgMenu(x, y) {
      var m = [
        { label: '&View', items: [
          { label: 'Lar&ge Icons', checked: view === 'icons', action: function () { setView('icons'); render(); } },
          { label: '&List', checked: view === 'list', action: function () { setView('list'); render(); } }
        ] },
        '-',
        { label: 'R&efresh', action: render }
      ];
      if (isFolderLoc()) {
        m.push('-', { label: '&Paste', disabled: !FileClip.has(), action: pasteHere }, '-', { label: 'Ne&w', items: [
          { label: '&Folder', icon: 'folder', action: function () { newItem('folder'); } },
          '-',
          { label: 'Text Document', icon: 'text-file', action: function () { newItem('txt'); } }
        ] });
      }
      if (loc === 'Recycle Bin') m.push('-', { label: 'Empty Recycle &Bin', disabled: !items.length, action: Shell.emptyRecycleBin });
      Menu.popup(m, x, y);
    }

    function newItem(kind) {
      try {
        var name;
        if (kind === 'folder') { name = FS.uniqueName(loc, 'New Folder'); FS.mkdir(FS.join(loc, name)); }
        else { name = FS.uniqueName(loc, 'New Text Document', '.txt'); FS.write(FS.join(loc, name), ''); }
        var it = items.filter(function (i) { return i.rawName === name; })[0];
        if (it) { select(it); rename(it); }
      } catch (err) { WM.msgbox({ title: 'Error', owner: win, icon: 'error', text: FS.errorText(err) }); }
    }

    function deleteItem(it) {
      if (!it.path || (it.node && it.node.sys)) return;
      var permanent = loc === 'Recycle Bin';
      var what = it.kind === 'folder' ? 'Folder' : 'File';
      WM.msgbox({
        title: 'Confirm ' + what + ' Delete', owner: win, icon: permanent ? 'warning' : 'question', buttons: ['&Yes', '&No'],
        text: permanent ? 'Are you sure you want to delete \'' + it.name + '\'?' : 'Are you sure you want to send \'' + it.name + '\' to the Recycle Bin?'
      }).then(function (b) {
        if (b !== '&Yes') return;
        try { if (permanent) FS.remove(it.path); else FS.recycle(it.path); U.sound('hddSeek', 200); }
        catch (err) { WM.msgbox({ title: 'Error Deleting File', owner: win, icon: 'error', text: FS.errorText(err, it.path) }); }
      });
    }

    function rename(it) {
      var label = it.el.querySelector('.label');
      var ext = it.node && it.node.lnk ? '.lnk' : '';
      var input = h('input', { type: 'text', className: 'rename', value: it.name });
      label.replaceWith(input);
      input.focus();
      var dot = it.kind === 'file' ? it.name.lastIndexOf('.') : -1;
      input.setSelectionRange(0, dot > 0 ? dot : it.name.length);
      var done = false;
      function finish(commit) {
        if (done) return; done = true;
        var v = input.value.trim();
        if (commit && v && v !== it.name) {
          try { FS.rename(it.path, v + ext); return; }
          catch (err) { WM.msgbox({ title: 'Error Renaming File', owner: win, icon: 'error', text: FS.errorText(err, it.path) }); }
        }
        render();
      }
      input.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', function () { finish(true); });
      input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    }

    iconView.addEventListener('pointerdown', function () { select(null); });
    iconView.addEventListener('contextmenu', function (e) { e.preventDefault(); bgMenu(e.clientX, e.clientY); });
    win.onKey = function (e) {
      if (e.target.tagName === 'INPUT') return false;
      if (e.key === 'Backspace') { var p = parentOf(loc); if (p) navigate(p); return true; }
      if (e.key === 'Enter' && selected) { selected.open(); return true; }
      if (e.key === 'Delete' && selected) { deleteItem(selected); return true; }
      if (e.key === 'F2' && selected && selected.path) { rename(selected); return true; }
      if (e.key === 'F5') { render(); return true; }
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        var k = e.key.toLowerCase();
        if (k === 'x' || k === 'c') { clip(k === 'x' ? 'cut' : 'copy'); return true; }
        if (k === 'v') { pasteHere(); return true; }
      }
      return false;
    };

    Menu.bar(win, [
      { label: '&File', items: function () {
        var m = [];
        if (selected) m.push({ label: '&Open', action: selected.open }, '-');
        if (isFolderLoc()) m.push({ label: 'Ne&w', items: [
          { label: '&Folder', icon: 'folder', action: function () { newItem('folder'); } }, '-',
          { label: 'Text Document', icon: 'text-file', action: function () { newItem('txt'); } }] }, '-');
        if (loc === 'Recycle Bin') m.push({ label: 'Empty Recycle &Bin', disabled: !items.length, action: Shell.emptyRecycleBin }, '-');
        m.push({ label: '&Delete', disabled: !selected || !selected.path, action: function () { deleteItem(selected); } },
          { label: 'Rena&me', disabled: !selected || !selected.path || loc === 'Recycle Bin', action: function () { rename(selected); } },
          { label: 'P&roperties', disabled: !selected || !selected.node, action: function () { showProps(selected, win); } },
          '-', { label: '&Close', action: function () { win.close(); } });
        return m;
      } },
      { label: '&Edit', items: function () {
        return [{ label: '&Undo', disabled: true }, '-',
          { label: 'Cu&t', shortcut: 'Ctrl+X', disabled: !canClip() || (selected.node && selected.node.sys), action: function () { clip('cut'); } },
          { label: '&Copy', shortcut: 'Ctrl+C', disabled: !canClip(), action: function () { clip('copy'); } },
          { label: '&Paste', shortcut: 'Ctrl+V', disabled: !isFolderLoc() || !FileClip.has(), action: pasteHere }, '-',
          { label: 'Select &All', action: function () { WM.msgbox({ title: locTitle(loc), owner: win, icon: 'info', text: 'Select one thing at a time. It was 1998, and we were patient.' }); } }];
      } },
      { label: '&View', items: function () {
        return [
          { label: 'Lar&ge Icons', checked: view === 'icons', action: function () { setView('icons'); render(); } },
          { label: '&List', checked: view === 'list', action: function () { setView('list'); render(); } },
          '-', { label: '&Refresh', shortcut: 'F5', action: render }
        ];
      } },
      { label: '&Go', items: [
        { label: '&Back', shortcut: 'Alt+Left', action: goBack },
        { label: '&Forward', shortcut: 'Alt+Right', action: goFwd },
        { label: '&Up One Level', action: function () { var p = parentOf(loc); if (p) navigate(p); } },
        '-',
        { label: '&My Computer', action: function () { navigate('My Computer'); } },
        { label: 'My &Documents', action: function () { navigate('C:\\My Documents'); } },
        { label: '&Internet Explorer', action: function () { Shell.launch('ie'); } }
      ] },
      { label: 'F&avorites', items: [{ label: 'My Documents', icon: 'my-documents', action: function () { navigate('C:\\My Documents'); } }] },
      { label: '&Help', items: [{ label: '&About Windows 98', action: function () { Shell.launch('about', { name: 'Windows 98', icon: 'windows-flag' }); } }] }
    ]);

    function refresh() { if (!win.closed) { var sel = selected && selected.rawName; render(); if (sel) { var it = items.filter(function (i) { return i.rawName === sel; })[0]; if (it) select(it); } } }
    var unsub = FS.onChange(refresh), unclip = FileClip.onChange(refresh);
    win.on('close', function () { unsub(); unclip(); });
    render();
    return win;
  }

  Shell.register('explorer', { name: 'Windows Explorer', icon: 'folder-open', launch: launch });
})();
