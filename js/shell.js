/*
 * The Windows shell: program registry, file associations, desktop icons,
 * taskbar, Start menu, clock and tray.
 */
(function () {
  var h = U.h;

  // =====================================================================
  // Programs
  // =====================================================================
  var programs = {};
  var Shell = {
    user: U.store.get('w98.user', ''),

    register: function (id, def) { programs[id] = def; },
    program: function (id) { return programs[id]; },

    launch: function (id, arg) {
      var p = programs[id];
      if (!p) {
        WM.msgbox({ title: id, icon: 'error', text: 'Cannot find the file \'' + id + '\' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.' });
        return null;
      }
      // Single-instance programs just come to the front.
      if (p.single) {
        var existing = WM.find(function (w) { return w.app === id; });
        if (existing) { WM.focus(existing); if (p.reopen) p.reopen(existing, arg); return existing; }
      }
      U.sound('hddSeek', 250);
      return p.launch(arg);
    },

    // Open a path the way Explorer would on double-click.
    open: function (path) {
      if (path === 'My Computer' || path === 'Recycle Bin' || path === 'Control Panel' || path === 'Printers' || path === 'Network Neighborhood' || path === 'Dial-Up Networking') {
        return Shell.launch('explorer', path);
      }
      var node = FS.stat(path);
      if (!node) {
        WM.msgbox({ title: FS.basename(path) || 'Windows', icon: 'error', text: 'Cannot find the file \'' + path + '\' (or one of its components).' });
        return null;
      }
      if (node.t === 'd') return Shell.launch('explorer', FS.realPath(path));
      if (node.app) return Shell.launch(node.app, node.lnk ? undefined : path);
      if (!node.bin) {
        Shell.addRecent(FS.realPath(path));
        return Shell.launch('notepad', FS.realPath(path));
      }
      WM.msgbox({ title: 'Open With', icon: 'warning', text: 'Windows cannot open this file:\n\n' + FS.basename(path) + '\n\nThere is no program registered to open this type of file.' });
      return null;
    },

    iconFor: function (name, node) {
      if (!node) return 'exe';
      if (node.t === 'd') return name.toLowerCase() === 'my documents' ? 'my-documents' : 'folder';
      if (node.app) {
        var p = programs[node.app];
        return p ? p.icon : 'exe';
      }
      var e = FS.ext(name);
      if (e === 'txt' || e === 'log' || e === 'doc' || e === 'me') return 'text-file';
      if (e === 'ini' || e === 'sys' || e === 'cfg' || e === 'inf') return 'sys-file';
      if (e === 'bat') return 'bat-file';
      if (e === 'exe' || e === 'com') return 'exe';
      if (!node.bin) return 'text-file';
      return 'wad-file';
    },

    displayName: function (name, node) {
      if (node && node.lnk) return name.replace(/\.lnk$/i, '');
      return name;
    },

    recent: U.store.get('w98.recent', []),
    addRecent: function (path) {
      Shell.recent = [path].concat(Shell.recent.filter(function (p) { return p.toLowerCase() !== path.toLowerCase(); })).slice(0, 12);
      U.store.set('w98.recent', Shell.recent);
    }
  };

  // =====================================================================
  // Desktop icons
  // =====================================================================
  var DESKTOP_DIR = 'C:\\WINDOWS\\Desktop';
  var SYSTEM_ICONS = [
    { id: 'sys:computer', label: 'My Computer', icon: 'computer', open: function () { Shell.open('My Computer'); } },
    { id: 'sys:docs', label: 'My Documents', icon: 'my-documents', open: function () { Shell.open('C:\\My Documents'); } },
    { id: 'sys:ie', label: 'Internet Explorer', icon: 'ie', open: function () { Shell.launch('ie'); } },
    { id: 'sys:network', label: 'Network Neighborhood', icon: 'network', open: function () { Shell.open('Network Neighborhood'); } },
    { id: 'sys:recycle', label: 'Recycle Bin', icon: 'recycle-empty', open: function () { Shell.open('Recycle Bin'); } }
  ];
  var iconPositions = U.store.get('w98.iconpos', {});
  var desktopEl, selected = [];

  function desktopItems() {
    var items = SYSTEM_ICONS.map(function (s) {
      var it = Object.assign({}, s);
      if (s.id === 'sys:recycle') {
        var bin = FS.list('C:\\RECYCLED', { hidden: true });
        it.icon = bin && bin.length ? 'recycle-full' : 'recycle-empty';
      }
      return it;
    });
    (FS.list(DESKTOP_DIR) || []).forEach(function (e) {
      items.push({
        id: 'file:' + e.name.toLowerCase(), label: Shell.displayName(e.name, e.node), icon: Shell.iconFor(e.name, e.node),
        shortcut: !!e.node.lnk, path: e.path, node: e.node,
        open: function () { Shell.open(e.path); }
      });
    });
    return items;
  }

  function gridSlot(i, rect) {
    var perCol = Math.max(1, Math.floor((rect.h - 8) / 75));
    return { x: 4 + Math.floor(i / perCol) * 75, y: 4 + (i % perCol) * 75 };
  }

  function renderDesktop() {
    if (!desktopEl) return;
    desktopEl.querySelectorAll('.desk-icon').forEach(function (n) { n.remove(); });
    var rect = { w: desktopEl.clientWidth, h: desktopEl.clientHeight };
    var taken = {};
    var items = desktopItems();
    // Occupied slots first so auto-placed icons don't overlap moved ones.
    items.forEach(function (it) { var p = iconPositions[it.id]; if (p) taken[p.x + ',' + p.y] = true; });
    var slot = 0;
    items.forEach(function (it) {
      var pos = iconPositions[it.id];
      if (!pos) {
        do { pos = gridSlot(slot++, rect); } while (taken[pos.x + ',' + pos.y]);
        taken[pos.x + ',' + pos.y] = true;
      }
      var imgSrc = U.icon(it.icon, 32);
      var el = h('div', { className: 'desk-icon', tabindex: '0', dataset: { id: it.id }, style: { left: pos.x + 'px', top: pos.y + 'px' } }, [
        h('div', { className: 'img-wrap', style: { '--mask': 'url(' + imgSrc + ')' } }, [
          h('img', { src: imgSrc, alt: '', draggable: 'false' }),
          it.shortcut ? h('img', { className: 'shortcut-arrow', src: shortcutArrow(), alt: '' }) : null
        ]),
        h('div', { className: 'label' }, it.label)
      ]);
      el._item = it;
      bindIcon(el, it);
      if (selected.indexOf(it.id) !== -1) el.classList.add('selected');
      desktopEl.appendChild(el);
    });
  }

  var arrowUrl = null;
  function shortcutArrow() {
    if (arrowUrl) return arrowUrl;
    // The little curved shortcut arrow overlay.
    var c = document.createElement('canvas'); c.width = c.height = 11;
    var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 11, 11);
    x.fillStyle = '#fff'; x.fillRect(1, 1, 9, 9);
    x.fillStyle = '#000';
    [[5, 2], [6, 2], [7, 2], [8, 2], [8, 3], [8, 4], [8, 5], [7, 3], [6, 4], [5, 5], [4, 6], [3, 7], [3, 8], [4, 5], [3, 6]].forEach(function (p) { x.fillRect(p[0], p[1], 1, 1); });
    arrowUrl = c.toDataURL();
    return arrowUrl;
  }

  function select(ids) {
    selected = ids;
    desktopEl.querySelectorAll('.desk-icon').forEach(function (n) {
      n.classList.toggle('selected', ids.indexOf(n.dataset.id) !== -1);
    });
  }

  function bindIcon(el, it) {
    U.onActivate(el, function () { select([it.id]); it.open(); });
    el.addEventListener('keydown', function (e) {
      if (WM.active || !Shell.ready()) return;
      if (e.key === 'Enter') it.open();
      if (e.key === 'Delete' && it.path) deleteDesktopFile(it);
      if (e.key === 'F2' && it.path) renameDesktopIcon(el, it);
    });
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault(); e.stopPropagation();
      select([it.id]);
      var items = [{ label: '&Open', action: it.open }];
      if (it.id === 'sys:computer') items.push({ label: 'E&xplore', action: function () { Shell.launch('explorer', 'C:\\'); } });
      if (it.id === 'sys:recycle') items.push('-', { label: 'Empty Recycle &Bin', action: emptyBin });
      if (it.path) items.push('-', { label: 'Cu&t', disabled: true }, { label: '&Copy', disabled: true }, '-',
        { label: '&Delete', action: function () { deleteDesktopFile(it); } },
        { label: 'Rena&me', action: function () { renameDesktopIcon(el, it); } });
      items.push('-', { label: 'P&roperties', action: function () { properties(it); } });
      Menu.popup(items, e.clientX, e.clientY);
    });
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.stopPropagation();
      WM.deactivateAll();
      if (selected.indexOf(it.id) === -1) select([it.id]);
      el.focus({ preventScroll: true });
      var sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop, moved = false;
      WM.drag(e, function (ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        moved = true;
        el.classList.add('dragging');
        el.style.left = (ox + dx) + 'px';
        el.style.top = (oy + dy) + 'px';
      });
      document.addEventListener('pointerup', function up() {
        document.removeEventListener('pointerup', up);
        el.classList.remove('dragging');
        if (!moved) return;
        // Snap to the icon grid, like "Auto Arrange" off but "Align to grid" on.
        var x = Math.max(4, Math.round((el.offsetLeft - 4) / 75) * 75 + 4);
        var y = Math.max(4, Math.round((el.offsetTop - 4) / 75) * 75 + 4);
        x = Math.min(x, desktopEl.clientWidth - 75);
        y = Math.min(y, desktopEl.clientHeight - 70);
        iconPositions[it.id] = { x: x, y: y };
        U.store.set('w98.iconpos', iconPositions);
        el.style.left = x + 'px'; el.style.top = y + 'px';
      });
    });
  }

  function deleteDesktopFile(it) {
    WM.msgbox({
      title: 'Confirm File Delete', icon: 'question', buttons: ['&Yes', '&No'],
      text: 'Are you sure you want to send \'' + it.label + '\' to the Recycle Bin?'
    }).then(function (b) {
      if (b !== '&Yes') return;
      try { FS.recycle(it.path); delete iconPositions[it.id]; U.store.set('w98.iconpos', iconPositions); }
      catch (err) { WM.msgbox({ title: 'Error Deleting File', icon: 'error', text: FS.errorText(err, it.path) }); }
    });
  }

  function renameDesktopIcon(el, it) {
    var label = el.querySelector('.label');
    var ext = it.node && it.node.lnk ? '.lnk' : '';
    var input = h('input', { type: 'text', className: 'rename', value: it.label });
    input.style.width = '74px';
    label.replaceWith(input);
    input.focus(); input.select();
    var done = false;
    function finish(commit) {
      if (done) return; done = true;
      var v = input.value.trim();
      if (commit && v && v !== it.label) {
        try {
          FS.rename(it.path, v + ext);
          iconPositions['file:' + (v + ext).toLowerCase()] = iconPositions[it.id];
          U.store.set('w98.iconpos', iconPositions);
          return;
        } catch (err) { WM.msgbox({ title: 'Error Renaming File', icon: 'error', text: FS.errorText(err, it.path) }); }
      }
      renderDesktop();
    }
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', function () { finish(true); });
    input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }

  function emptyBin() {
    var bin = FS.list('C:\\RECYCLED', { hidden: true }) || [];
    if (!bin.length) return;
    WM.msgbox({
      title: 'Confirm Multiple File Delete', icon: 'question', buttons: ['&Yes', '&No'],
      text: 'Are you sure you want to delete these ' + bin.length + ' items?'
    }).then(function (b) { if (b === '&Yes') FS.emptyRecycleBin(); });
  }
  Shell.emptyRecycleBin = emptyBin;

  function properties(it) {
    if (it.id === 'sys:computer') return Shell.launch('control', 'system');
    var text = it.label;
    if (it.node) {
      text += '\n\nType:  ' + (it.node.lnk ? 'Shortcut' : it.node.t === 'd' ? 'File Folder' : (FS.ext(it.path).toUpperCase() || 'File') + ' File') +
        '\nLocation:  ' + DESKTOP_DIR + '\nSize:  ' + FS.formatSize(FS.sizeOf(it.node)) + '\nModified:  ' + U.formatDate(it.node.m);
    }
    WM.msgbox({ title: it.label + ' Properties', icon: null, text: text, sound: null });
  }

  function desktopContextMenu(e) {
    e.preventDefault();
    // Only the bare desktop gets this menu; windows sit inside the desktop element.
    if (e.target !== desktopEl && e.target.id !== 'windows-layer') return;
    if (!Shell.ready()) return;
    Menu.popup([
      { label: 'Acti&ve Desktop', items: [{ label: '&View As Web Page', disabled: true }, { label: '&Customize my Desktop...', action: function () { Shell.launch('control', 'display'); } }] },
      '-',
      { label: 'Arrange &Icons', items: [{ label: 'by &Name', action: arrangeIcons }, { label: 'by &Type', action: arrangeIcons }, '-', { label: '&Auto Arrange', action: arrangeIcons }] },
      { label: 'Lin&e Up Icons', action: arrangeIcons },
      '-',
      { label: 'R&efresh', action: renderDesktop },
      '-',
      { label: '&Paste', disabled: true },
      { label: 'Paste &Shortcut', disabled: true },
      '-',
      { label: 'Ne&w', items: [
        { label: '&Folder', icon: 'folder', action: function () { newOnDesktop('folder'); } },
        '-',
        { label: 'Text Document', icon: 'text-file', action: function () { newOnDesktop('txt'); } }
      ] },
      '-',
      { label: 'P&roperties', action: function () { Shell.launch('control', 'display'); } }
    ], e.clientX, e.clientY);
  }

  function arrangeIcons() {
    iconPositions = {};
    U.store.set('w98.iconpos', iconPositions);
    renderDesktop();
  }

  function newOnDesktop(kind) {
    try {
      var name;
      if (kind === 'folder') { name = FS.uniqueName(DESKTOP_DIR, 'New Folder'); FS.mkdir(FS.join(DESKTOP_DIR, name)); }
      else { name = FS.uniqueName(DESKTOP_DIR, 'New Text Document', '.txt'); FS.write(FS.join(DESKTOP_DIR, name), ''); }
      var el = desktopEl.querySelector('.desk-icon[data-id="file:' + name.toLowerCase().replace(/"/g, '\\"') + '"]');
      if (el) { select([el.dataset.id]); renameDesktopIcon(el, el._item); }
    } catch (err) {
      WM.msgbox({ title: 'Error', icon: 'error', text: FS.errorText(err) });
    }
  }

  // Rubber-band selection on the empty desktop.
  function bindDesktop() {
    desktopEl.addEventListener('contextmenu', desktopContextMenu);
    desktopEl.addEventListener('pointerdown', function (e) {
      if (e.target !== desktopEl && e.target.id !== 'windows-layer') return;
      if (!Shell.ready()) return;
      WM.deactivateAll();
      select([]);
      if (e.button !== 0) return;
      var r0 = desktopEl.getBoundingClientRect();
      var sx = e.clientX - r0.left, sy = e.clientY - r0.top;
      var band = h('div', { className: 'rubber-band' });
      var shown = false;
      WM.drag(e, function (ev) {
        var x = ev.clientX - r0.left, y = ev.clientY - r0.top;
        var l = Math.min(sx, x), t = Math.min(sy, y), w = Math.abs(x - sx), hh = Math.abs(y - sy);
        if (!shown) { desktopEl.appendChild(band); shown = true; }
        Object.assign(band.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: hh + 'px' });
        var ids = [];
        desktopEl.querySelectorAll('.desk-icon').forEach(function (n) {
          var il = n.offsetLeft + 20, it = n.offsetTop, ir = n.offsetLeft + 55, ib = n.offsetTop + 60;
          if (ir > l && il < l + w && ib > t && it < t + hh) ids.push(n.dataset.id);
        });
        select(ids);
      });
      document.addEventListener('pointerup', function up() { document.removeEventListener('pointerup', up); band.remove(); });
    });
  }

  // =====================================================================
  // Taskbar
  // =====================================================================
  var taskButtons;

  function renderTaskbar() {
    if (!taskButtons) return;
    taskButtons.innerHTML = '';
    WM.windows.forEach(function (w) {
      if (w.noTaskbar) return;
      var b = h('button', { className: 'task-btn' + (WM.active === w ? ' active' : ''), dataset: { win: w.id }, title: w.title }, [
        U.img(w.icon, 16), h('span', null, w.title)
      ]);
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      b.addEventListener('click', function () {
        if (WM.active === w && !w.minimized) w.minimize();
        else if (w.minimized) w.restore();
        else WM.focus(w);
      });
      b.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        Menu.popup([
          { label: '&Restore', disabled: !w.minimized && !w.maximized, action: w.restore },
          { label: 'Mi&nimize', disabled: w.minimized || !w.opts.minimizable, action: w.minimize },
          { label: 'Ma&ximize', disabled: w.maximized || !w.opts.maximizable, action: function () { WM.focus(w); w.toggleMax(); } },
          '-',
          { label: '&Close', shortcut: 'Alt+F4', action: function () { w.close(); } }
        ], e.clientX, e.clientY - 120);
      });
      taskButtons.appendChild(b);
    });
  }

  var clockTimer = null;
  function startClock(clockEl) {
    function tick() {
      var d = new Date();
      var hh = d.getHours(), ap = hh >= 12 ? 'PM' : 'AM';
      clockEl.textContent = (hh % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap;
      clockEl.title = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    tick();
    clearInterval(clockTimer);
    clockTimer = setInterval(tick, 1000 * 10);
  }

  // =====================================================================
  // Start menu
  // =====================================================================
  function startMenuItems() {
    return [
      { label: 'Windows Update', icon: 'windows-update', action: function () { Shell.launch('ie', 'windowsupdate.microsoft.com'); } },
      '-',
      { label: '&Programs', icon: 'programs', items: programsMenu },
      { label: 'F&avorites', icon: 'favorites', items: [
        { label: 'Channels', icon: 'folder', items: [] },
        { label: 'Links', icon: 'folder', items: [
          { label: 'Best of the Web', icon: 'ie', action: function () { Shell.launch('ie', 'www.yahoo.com'); } },
          { label: 'Microsoft', icon: 'ie', action: function () { Shell.launch('ie', 'www.microsoft.com'); } }
        ] },
        { label: 'My Documents', icon: 'my-documents', action: function () { Shell.open('C:\\My Documents'); } }
      ] },
      { label: '&Documents', icon: 'documents', items: function () {
        var list = [{ label: 'My Documents', icon: 'my-documents', action: function () { Shell.open('C:\\My Documents'); } }, '-'];
        var recent = Shell.recent.filter(function (p) { return FS.exists(p); });
        if (!recent.length) list.push({ label: '(Empty)', disabled: true });
        recent.forEach(function (p) { list.push({ label: FS.basename(p), icon: Shell.iconFor(p, FS.stat(p)), action: function () { Shell.open(p); } }); });
        return list;
      } },
      { label: '&Settings', icon: 'settings', items: [
        { label: '&Control Panel', icon: 'control-panel', action: function () { Shell.open('Control Panel'); } },
        { label: '&Printers', icon: 'printers', action: function () { Shell.open('Printers'); } },
        { label: '&Taskbar & Start Menu...', icon: 'settings', action: function () { Shell.launch('control', 'display'); } },
        '-',
        { label: 'Folder &Options...', icon: 'folder', disabled: true },
        { label: '&Active Desktop', icon: 'display', items: [{ label: '&Customize my Desktop...', action: function () { Shell.launch('control', 'display'); } }] },
        { label: '&Windows Update...', icon: 'windows-update', action: function () { Shell.launch('ie', 'windowsupdate.microsoft.com'); } }
      ] },
      { label: '&Find', icon: 'find', items: [
        { label: '&Files or Folders...', icon: 'find', action: function () { Shell.launch('find'); } },
        { label: '&Computer...', icon: 'computer', action: function () { WM.msgbox({ title: 'Find: Computer', icon: 'info', text: 'The computer was not found.' }); } },
        { label: 'On the &Internet...', icon: 'ie', action: function () { Shell.launch('ie', 'www.altavista.com'); } },
        { label: '&People...', icon: 'find', disabled: true }
      ] },
      { label: '&Help', icon: 'help', action: function () { Shell.launch('help'); } },
      { label: '&Run...', icon: 'run', action: function () { Shell.launch('run'); } },
      '-',
      { label: '&Log Off ' + (Shell.user || 'User') + '...', icon: 'logoff', action: function () { Shell.logoff(); } },
      { label: 'Sh&ut Down...', icon: 'shutdown', action: function () { Shell.launch('shutdown'); } }
    ];
  }

  function programsMenu() {
    return [
      { label: 'Accessories', icon: 'programs', items: [
        { label: 'Games', icon: 'programs', items: [
          { label: 'Minesweeper', icon: 'minesweeper', action: function () { Shell.launch('minesweeper'); } }
        ] },
        { label: 'System Tools', icon: 'programs', items: [
          { label: 'Compaq QuickRestore', icon: 'drive-hdd', action: function () { Shell.launch('control', 'quickrestore'); } }
        ] },
        { label: 'Notepad', icon: 'notepad', action: function () { Shell.launch('notepad'); } }
      ] },
      { label: 'America Online', icon: 'programs', items: [
        { label: 'America Online 4.0', icon: 'aol', action: function () { Shell.launch('aol'); } },
        { label: 'AOL Read Me', icon: 'text-file', action: function () { Shell.open('C:\\Program Files\\America Online 4.0\\README.TXT'); } }
      ] },
      { label: 'id Software', icon: 'programs', items: [
        { label: 'DOOM', icon: 'doom', action: function () { Shell.launch('doom'); } },
        { label: 'DOOM Read Me', icon: 'text-file', action: function () { Shell.open('C:\\DOOM\\README.TXT'); } }
      ] },
      { label: 'StartUp', icon: 'programs', items: [] },
      { label: 'Internet Explorer', icon: 'ie', action: function () { Shell.launch('ie'); } },
      { label: 'MS-DOS Prompt', icon: 'msdos', action: function () { Shell.launch('msdos'); } },
      { label: 'Windows Explorer', icon: 'folder-open', action: function () { Shell.launch('explorer', 'C:\\'); } }
    ];
  }

  var startBtn, startOpen = false;
  function toggleStart(force) {
    var open = force != null ? force : !startOpen;
    if (open === startOpen) return;
    if (!open) { Menu.closeAll(); return; }
    Menu.closeAll();
    startOpen = true;
    startBtn.classList.add('pressed');
    var tb = document.getElementById('taskbar').getBoundingClientRect();
    var m = Menu.popup(startMenuItems(), 2, tb.top + 2, {
      anchorBottom: true, iconSize: 32, className: 'start-root',
      onClose: function () { startOpen = false; startBtn.classList.remove('pressed'); }
    });
    // Rebuild as a Start panel with the vertical "Windows98" banner.
    var items = h('div', { className: 'items' });
    while (m.el.firstChild) items.appendChild(m.el.firstChild);
    m.el.id = 'start-menu';
    m.el.appendChild(h('div', { className: 'banner' }, h('span', { innerHTML: '<b>Windows</b>98' })));
    m.el.appendChild(items);
    var r = m.el.getBoundingClientRect();
    m.el.style.top = (tb.top + 2 - r.height) + 'px';
    m.el.style.left = '2px';
  }
  Shell.toggleStart = toggleStart;

  // =====================================================================
  // Building the desktop
  // =====================================================================
  Shell.build = function (root) {
    root.innerHTML = '';
    desktopEl = h('div', { id: 'desktop' }, h('div', { id: 'windows-layer' }));
    applyDesktopStyle();

    startBtn = h('button', { id: 'start-button' }, [U.img('windows-flag', 16), h('span', null, 'Start')]);
    startBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); if (Shell.ready()) toggleStart(); });

    var quick = h('div', { id: 'quick-launch' }, [
      quickBtn('ie', 'Launch Internet Explorer Browser', function () { Shell.launch('ie'); }),
      quickBtn('desktop-show', 'Show Desktop', showDesktop),
      quickBtn('aol', 'America Online', function () { Shell.launch('aol'); })
    ]);

    taskButtons = h('div', { id: 'task-buttons' });
    var clock = h('span', { id: 'clock' });
    var vol = h('button', { className: 'tray-btn', title: 'Volume' }, U.img('volume', 16));
    vol.addEventListener('click', toggleMute);
    var aolTray = h('button', { className: 'tray-btn hidden', id: 'tray-aol', title: 'America Online' }, U.img('aol', 16));
    aolTray.addEventListener('click', function () { Shell.launch('aol'); });
    var tray = h('div', { id: 'tray' }, [aolTray, vol, clock]);
    clock.addEventListener('dblclick', function () { Shell.launch('control', 'datetime'); });

    var taskbar = h('div', { id: 'taskbar' }, [
      startBtn, h('div', { className: 'tb-divider' }), h('div', { className: 'tb-grip' }), quick,
      h('div', { className: 'tb-divider' }), h('div', { className: 'tb-grip' }), taskButtons, tray
    ]);
    taskbar.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      Menu.popup([
        { label: '&Cascade Windows', action: cascade },
        { label: 'Tile Windows &Horizontally', action: cascade },
        { label: 'Tile Windows V&ertically', action: cascade },
        '-',
        { label: '&Minimize All Windows', action: showDesktop },
        '-',
        { label: 'P&roperties', action: function () { Shell.launch('control', 'display'); } }
      ], e.clientX, e.clientY - 130);
    });

    root.appendChild(desktopEl);
    root.appendChild(taskbar);
    startClock(clock);
    bindDesktop();
    renderDesktop();
    updateMuteIcon(vol);
    bindGlobalsOnce();
  };

  // Build runs on every logon; document-level hooks must only be added once.
  var globalsBound = false;
  function bindGlobalsOnce() {
    if (globalsBound) return;
    globalsBound = true;
    WM.onChange(renderTaskbar);
    FS.onChange(function () { renderDesktop(); });
    window.addEventListener('resize', renderDesktop);
    // The Windows key opens Start only when tapped on its own (so Cmd+S on a Mac doesn't).
    var metaAlone = false;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Meta' || e.key === 'OS') { metaAlone = !e.repeat; return; }
      metaAlone = false;
      if (e.ctrlKey && e.key === 'Escape' && Shell.ready()) { toggleStart(); e.preventDefault(); }
    });
    document.addEventListener('keyup', function (e) {
      if ((e.key === 'Meta' || e.key === 'OS') && metaAlone && Shell.ready()) toggleStart();
      metaAlone = false;
    });
  }

  // True once someone has logged on and the desktop is live.
  Shell.ready = function () { return !window.Boot || Boot.state === 'desktop'; };

  function quickBtn(icon, title, fn) {
    var b = h('button', { title: title }, U.img(icon === 'desktop-show' ? 'display' : icon, 16));
    b.addEventListener('click', fn);
    return b;
  }

  function showDesktop() { WM.windows.forEach(function (w) { if (!w.noTaskbar) w.minimize(); }); }

  function cascade() {
    var i = 0;
    WM.windows.forEach(function (w) {
      if (w.minimized || w.noTaskbar) return;
      if (w.maximized) w.toggleMax();
      w.el.style.left = (10 + i * 26) + 'px';
      w.el.style.top = (10 + i * 26) + 'px';
      WM.focus(w);
      i++;
    });
  }

  function toggleMute() {
    if (!window.Sound) return;
    Sound.setMuted(!Sound.muted);
    updateMuteIcon(document.querySelector('#tray .tray-btn[title="Volume"]'));
  }
  function updateMuteIcon(btn) {
    if (!btn) return;
    var muted = window.Sound && Sound.muted;
    btn.title = muted ? 'Volume (muted)' : 'Volume';
    btn.style.opacity = muted ? '0.45' : '1';
  }

  Shell.setAolTray = function (on) {
    var t = document.getElementById('tray-aol');
    if (t) t.classList.toggle('hidden', !on);
  };

  // Desktop colour and pattern from Display Properties.
  var PATTERNS = {
    '(None)': '',
    'Bricks': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M0 0h8v1H0zM0 4h8v1H0zM3 1h1v3H3zM7 5h1v3H7z' fill='%23000'/%3E%3C/svg%3E\")",
    'Buttons': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M0 0h7v1H0zM0 0h1v7H0z' fill='%23fff' fill-opacity='.5'/%3E%3Cpath d='M7 0h1v8H0V7h7z' fill='%23000' fill-opacity='.5'/%3E%3C/svg%3E\")",
    'Critters': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M1 1h1v1H1zM5 1h1v1H5zM2 2h3v1H2zM1 3h5v1H1zM2 4h1v1H2zM4 4h1v1H4z' fill='%23000'/%3E%3C/svg%3E\")",
    'Diamonds': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M3 0h1v1H3zM2 1h1v1H2zM4 1h1v1H4zM1 2h1v1H1zM5 2h1v1H5zM2 3h1v1H2zM4 3h1v1H4zM3 4h1v1H3z' fill='%23000'/%3E%3C/svg%3E\")"
  };
  Shell.PATTERNS = PATTERNS;
  function applyDesktopStyle() {
    var s = U.store.get('w98.display', { color: '#008080', pattern: '(None)' });
    if (!desktopEl) return;
    desktopEl.style.backgroundColor = s.color;
    desktopEl.style.backgroundImage = PATTERNS[s.pattern] || '';
  }
  Shell.applyDesktopStyle = applyDesktopStyle;

  Shell.logoff = function () {
    WM.msgbox({ title: 'Log Off Windows', icon: 'question', buttons: ['&Yes', '&No'], text: 'Are you sure you want to log off?' }).then(function (b) {
      if (b !== '&Yes') return;
      WM.closeAll().then(function (ok) { if (ok && window.Boot) Boot.logoff(); });
    });
  };

  window.Shell = Shell;
})();
