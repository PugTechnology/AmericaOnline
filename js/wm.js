/*
 * Window manager + menus.
 *
 *   WM.open(opts)       -> win     create an application window
 *   WM.msgbox(opts)     -> Promise<button label>
 *   Menu.popup(items, x, y, opts) -> menu
 *   Menu.bar(win, spec)            attach a menu bar to a window
 *
 * Menu items: { label: '&Open...', shortcut: 'Ctrl+O', icon, action(), disabled, checked, items }
 *             or '-' for a separator. `items` may be a function returning an array.
 */
(function () {
  var h = U.h;
  var zTop = 100;
  var nextId = 1;
  var listeners = [];

  function emit() { listeners.forEach(function (fn) { fn(); }); }

  function desktopRect() {
    var d = document.getElementById('desktop');
    return { w: d.clientWidth, h: d.clientHeight };
  }

  // =====================================================================
  // Menus
  // =====================================================================
  var Menu = { stack: [] };
  var hoverTimer = null;

  Menu.closeAll = function () {
    clearTimeout(hoverTimer);
    Menu.stack.forEach(function (m) { if (m.el.parentNode) m.el.remove(); if (m.onClose) m.onClose(); });
    Menu.stack = [];
  };

  // Close menus deeper than `level` (0 = root).
  Menu.closeFrom = function (level) {
    while (Menu.stack.length > level) {
      var m = Menu.stack.pop();
      if (m.el.parentNode) m.el.remove();
      if (m.onClose) m.onClose();
    }
  };

  Menu.isOpen = function () { return Menu.stack.length > 0; };

  function resolveItems(items) { return typeof items === 'function' ? items() : items; }

  Menu.popup = function (items, x, y, opts) {
    opts = opts || {};
    var level = opts.level || 0;
    Menu.closeFrom(level);
    items = resolveItems(items) || [];
    var hasIcons = items.some(function (it) { return it && it.icon; });
    var el = h('div', { className: 'menu' + (hasIcons ? ' with-icons' : '') + (opts.className ? ' ' + opts.className : ''), role: 'menu' });
    var menu = { el: el, level: level, items: items, hot: -1, rows: [], onClose: opts.onClose, owner: opts.owner };

    if (!items.length) {
      el.appendChild(h('div', { className: 'mi disabled empty' }, '(Empty)'));
    }

    items.forEach(function (it, idx) {
      if (it === '-' || (it && it.separator)) { el.appendChild(h('div', { className: 'sep' })); menu.rows.push(null); return; }
      var sub = !!it.items;
      var cls = 'mi' + (sub ? ' has-sub' : '') + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '') + (it.small ? ' small' : '');
      var row = h('div', { className: cls, role: 'menuitem' });
      if (it.icon) row.appendChild(U.img(it.icon, opts.iconSize || 16));
      var label = h('span', { className: 'ml' });
      label.appendChild(U.label(it.label));
      row.appendChild(label);
      if (it.shortcut) row.appendChild(h('span', { className: 'shortcut' }, it.shortcut));
      menu.rows.push(row);

      row.addEventListener('pointerenter', function () {
        setHot(menu, idx);
        clearTimeout(hoverTimer);
        if (sub && !it.disabled) hoverTimer = setTimeout(function () { openSub(menu, idx); }, 280);
        else hoverTimer = setTimeout(function () { Menu.closeFrom(level + 1); }, 280);
      });
      row.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        if (it.disabled) return;
        if (sub) { clearTimeout(hoverTimer); openSub(menu, idx); return; }
        Menu.closeAll();
        U.sound('menuClick');
        if (it.action) setTimeout(function () { it.action(); }, 0);
      });
      el.appendChild(row);
    });

    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.body.appendChild(el);

    // Keep inside the viewport, flipping like Windows does.
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight - (opts.avoidTaskbar === false ? 0 : 0);
    var left = x, top = y;
    if (opts.anchorBottom) top = y - r.height;
    if (left + r.width > vw) left = opts.flipX != null ? opts.flipX - r.width : vw - r.width;
    if (top + r.height > vh) top = Math.max(0, vh - r.height);
    if (left < 0) left = 0;
    el.style.left = left + 'px';
    el.style.top = top + 'px';

    Menu.stack.push(menu);
    return menu;
  };

  function setHot(menu, idx) {
    menu.rows.forEach(function (r, i) { if (r) r.classList.toggle('hot', i === idx); });
    menu.hot = idx;
  }

  function openSub(menu, idx) {
    var it = menu.items[idx], row = menu.rows[idx];
    if (!it || !it.items || !row) return;
    if (Menu.stack[menu.level + 1] && Menu.stack[menu.level + 1].parentIdx === idx) return;
    var r = row.getBoundingClientRect();
    var sub = Menu.popup(it.items, r.right - 3, r.top - 3, { level: menu.level + 1, flipX: r.left + 3 });
    sub.parentIdx = idx;
    setHot(menu, idx);
  }

  function activateHot(menu) {
    var it = menu.items[menu.hot];
    if (!it || it === '-' || it.disabled) return;
    if (it.items) { openSub(menu, menu.hot); var s = Menu.stack[menu.level + 1]; if (s) moveHot(s, 1); return; }
    Menu.closeAll();
    if (it.action) setTimeout(it.action, 0);
  }

  function moveHot(menu, dir) {
    var n = menu.items.length, i = menu.hot;
    for (var k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      var it = menu.items[i];
      if (it && it !== '-' && !it.separator) { setHot(menu, i); return; }
    }
  }

  // Keyboard navigation for whichever menu is on top.
  Menu.handleKey = function (e) {
    if (!Menu.stack.length) return false;
    var menu = Menu.stack[Menu.stack.length - 1];
    switch (e.key) {
      case 'ArrowDown': moveHot(menu, 1); break;
      case 'ArrowUp': moveHot(menu, -1); break;
      case 'ArrowRight':
        if (menu.items[menu.hot] && menu.items[menu.hot].items) activateHot(menu);
        else if (Menu.bar.current) Menu.bar.current.step(1);
        break;
      case 'ArrowLeft':
        if (menu.level > 0 && Menu.stack.length > 1 && !(Menu.bar.current && menu.level === 0)) Menu.closeFrom(menu.level);
        else if (Menu.bar.current) Menu.bar.current.step(-1);
        break;
      case 'Enter': activateHot(menu); break;
      case 'Escape': Menu.closeFrom(Math.max(0, menu.level)); break;
      default:
        // Ctrl/Cmd shortcuts (Cmd+S, Ctrl+R...) are not menu accelerators.
        if (e.metaKey || e.ctrlKey || e.key.length !== 1) return false;
        var ch = e.key.toLowerCase();
        var idx = menu.items.findIndex(function (it) { return it && it.label && U.accel(it.label) === ch; });
        if (idx === -1) return true;
        setHot(menu, idx); activateHot(menu);
    }
    e.preventDefault();
    return true;
  };

  // A window menu bar: spec = [{ label: '&File', items: [...] }, ...]
  Menu.bar = function (win, spec) {
    var bar = h('div', { className: 'menubar' });
    var tops = [];
    var state = { open: -1 };

    function open(i) {
      if (win.modalChild) { win.modalChild.flash(); return; }
      tops.forEach(function (t, k) { t.classList.toggle('open', k === i); });
      state.open = i;
      var r = tops[i].getBoundingClientRect();
      Menu.bar.current = { step: function (d) { open((i + d + spec.length) % spec.length); if (Menu.stack[0]) moveHot(Menu.stack[0], 1); } };
      Menu.popup(spec[i].items, r.left, r.bottom, {
        onClose: function () {
          tops[i].classList.remove('open');
          if (state.open === i) { state.open = -1; Menu.bar.current = null; }
        }
      });
    }

    spec.forEach(function (m, i) {
      var t = h('div', { className: 'mb-item' });
      t.appendChild(U.label(m.label));
      t.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        win.focus();
        if (state.open === i) { Menu.closeAll(); return; }
        open(i);
      });
      t.addEventListener('pointerenter', function () {
        if (state.open !== -1 && state.open !== i) open(i);
      });
      tops.push(t);
      bar.appendChild(t);
    });

    win.menuAccel = function (ch) {
      var i = spec.findIndex(function (m) { return U.accel(m.label) === ch; });
      if (i === -1) return false;
      open(i);
      if (Menu.stack[0]) moveHot(Menu.stack[0], 1);
      return true;
    };
    win.el.insertBefore(bar, win.bodyWrap);
    return bar;
  };

  // Capture phase, so clicks on things that stop propagation (icons, taskbar) still close menus.
  document.addEventListener('pointerdown', function (e) {
    if (!Menu.stack.length) return;
    if (e.target.closest && e.target.closest('.menu, .mb-item, #start-button')) return;
    Menu.closeAll();
  }, true);
  window.addEventListener('blur', function () { if (Menu.stack.length) Menu.closeAll(); });

  // =====================================================================
  // Windows
  // =====================================================================
  var WM = { windows: [], active: null };

  WM.onChange = function (fn) { listeners.push(fn); };

  WM.find = function (pred) { return WM.windows.filter(pred)[0] || null; };

  WM.open = function (o) {
    o = Object.assign({
      title: 'Untitled', icon: 'exe', width: 400, height: 300,
      resizable: true, minimizable: true, maximizable: true, taskbar: true
    }, o);

    var layer = document.getElementById('windows-layer');
    var dr = desktopRect();
    var win = {
      id: nextId++, app: o.app, title: o.title, icon: o.icon, opts: o,
      minimized: false, maximized: false, closed: false, handlers: {}
    };

    var el = h('div', { className: 'window' + (o.dialog ? ' dialog' : '') + (o.className ? ' ' + o.className : ''), role: o.dialog ? 'dialog' : 'application' });
    var titleImg = o.dialog ? null : U.img(o.icon, 16);
    var titleText = h('span', null, o.title);
    var titleBar = h('div', { className: 'title-bar' }, [
      h('div', { className: 'title' }, [titleImg, titleText]),
      h('div', { className: 'title-controls' })
    ]);
    var controls = titleBar.lastChild;
    var btnMin, btnMax, btnClose;
    if (o.helpButton) controls.appendChild(h('button', { className: 't-help', 'aria-label': 'Help', onclick: function () { if (o.onHelp) o.onHelp(); } }));
    if (!o.dialog && (o.minimizable || o.maximizable)) {
      btnMin = h('button', { className: 't-min', 'aria-label': 'Minimize', disabled: !o.minimizable });
      btnMax = h('button', { className: 't-max', 'aria-label': 'Maximize', disabled: !o.maximizable });
      controls.appendChild(btnMin);
      controls.appendChild(btnMax);
    }
    btnClose = h('button', { className: 't-close', 'aria-label': 'Close', disabled: o.closable === false });
    controls.appendChild(btnClose);

    var body = h('div', { className: 'window-body' + (o.pad ? ' pad' : '') });
    var bodyWrap = body;
    el.appendChild(titleBar);
    el.appendChild(body);
    if (o.shield) body.appendChild(h('div', { className: 'drag-shield' }));

    win.el = el; win.body = body; win.bodyWrap = bodyWrap; win.titleBar = titleBar;

    // ---- geometry ----
    var w = o.width === 'auto' ? 300 : Math.min(o.width, dr.w - 8);
    var hgt = o.height === 'auto' ? 150 : Math.min(o.height, dr.h - 8);
    if (o.width !== 'auto') el.style.width = w + 'px';
    if (o.height !== 'auto') el.style.height = hgt + 'px';
    var x = o.x, y = o.y;
    if (x == null || y == null) {
      if (o.center || o.dialog) {
        x = null; y = null;
      } else {
        var n = WM.windows.filter(function (w2) { return !w2.opts.dialog; }).length % 8;
        x = 40 + n * 24; y = 30 + n * 24;
        if (x + w > dr.w) x = Math.max(0, dr.w - w - 10);
        if (y + hgt > dr.h) y = Math.max(0, dr.h - hgt - 10);
      }
    }
    el.style.left = (x || 0) + 'px';
    el.style.top = (y || 0) + 'px';

    if (o.content) U.append(body, o.content);
    layer.appendChild(el);

    if (x == null) {
      // center (needs layout for auto-height dialogs)
      var r = el.getBoundingClientRect();
      el.style.left = Math.max(0, Math.round((dr.w - r.width) / 2)) + 'px';
      el.style.top = Math.max(0, Math.round((dr.h - r.height) / 2.4)) + 'px';
    }

    // ---- behaviour ----
    win.setTitle = function (t) { win.title = t; titleText.textContent = t; emit(); };
    win.setIcon = function (i) { win.icon = i; if (titleImg) titleImg.src = U.icon(i, 16); emit(); };
    win.on = function (ev, fn) { (win.handlers[ev] = win.handlers[ev] || []).push(fn); };
    win.fire = function (ev, arg) { (win.handlers[ev] || []).forEach(function (fn) { fn(arg); }); };
    win.focus = function () { WM.focus(win); };
    win.flash = function () {
      WM.focus(win);
      U.sound('ding');
      var n = 0;
      var t = setInterval(function () {
        el.classList.toggle('active');
        if (++n >= 6) { clearInterval(t); el.classList.add('active'); }
      }, 70);
    };
    win.center = function () {
      var r = el.getBoundingClientRect(), d = desktopRect();
      el.style.left = Math.max(0, Math.round((d.w - r.width) / 2)) + 'px';
      el.style.top = Math.max(0, Math.round((d.h - r.height) / 2.4)) + 'px';
    };

    win.close = function (force) {
      if (win.closed) return Promise.resolve(true);
      if (win.modalChild && !force) { win.modalChild.flash(); return Promise.resolve(false); }
      var check = (!force && o.onClose) ? Promise.resolve(o.onClose()) : Promise.resolve(true);
      return check.then(function (ok) {
        if (ok === false) return false;
        win.closed = true;
        win.fire('close');
        if (win.modalChild) win.modalChild.close(true);
        if (win.owner && win.owner.modalChild === win) win.owner.modalChild = null;
        el.remove();
        WM.windows = WM.windows.filter(function (w2) { return w2 !== win; });
        if (WM.active === win) {
          WM.active = null;
          var next = (win.owner && !win.owner.closed) ? win.owner : topmost();
          if (next) WM.focus(next);
        }
        emit();
        return true;
      });
    };

    win.minimize = function () {
      if (!o.minimizable || win.minimized) return;
      zoomAnim(el.getBoundingClientRect(), taskbarRect(win));
      win.minimized = true;
      el.classList.add('minimized');
      if (WM.active === win) { WM.active = null; el.classList.remove('active'); var nx = topmost(); if (nx) WM.focus(nx); }
      emit();
    };
    win.restore = function () {
      if (win.minimized) {
        win.minimized = false;
        el.classList.remove('minimized');
        zoomAnim(taskbarRect(win), el.getBoundingClientRect());
        WM.focus(win);
        return;
      }
      if (win.maximized) toggleMax();
    };
    function toggleMax() {
      if (!o.maximizable || !o.resizable && !o.maximizable) return;
      if (win.maximized) {
        var r = win.restoreRect;
        Object.assign(el.style, { left: r.left, top: r.top, width: r.width, height: r.height });
        win.maximized = false;
        el.classList.remove('maximized');
        if (btnMax) btnMax.className = 't-max';
      } else {
        win.restoreRect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
        Object.assign(el.style, { left: '-3px', top: '-3px', width: 'calc(100% + 6px)', height: 'calc(100% + 6px)' });
        win.maximized = true;
        el.classList.add('maximized');
        if (btnMax) btnMax.className = 't-restore';
      }
      win.fire('resize');
    }
    win.toggleMax = toggleMax;

    if (btnMin) btnMin.addEventListener('click', function (e) { e.stopPropagation(); win.minimize(); });
    if (btnMax) btnMax.addEventListener('click', function (e) { e.stopPropagation(); toggleMax(); });
    btnClose.addEventListener('click', function (e) { e.stopPropagation(); win.close(); });
    controls.addEventListener('pointerdown', function (e) { e.stopPropagation(); WM.focus(win); });
    titleBar.addEventListener('dblclick', function () { if (o.maximizable && !o.dialog) toggleMax(); });

    // Window (system) menu on the title icon / right-click on the title bar.
    function systemMenu(x, y) {
      Menu.popup([
        { label: '&Restore', disabled: !(win.maximized || win.minimized), action: win.restore },
        { label: '&Move', disabled: win.maximized },
        { label: '&Size', disabled: win.maximized || !o.resizable },
        { label: 'Mi&nimize', disabled: !o.minimizable || o.dialog, action: win.minimize },
        { label: 'Ma&ximize', disabled: !o.maximizable || win.maximized || o.dialog, action: toggleMax },
        '-',
        { label: '&Close', shortcut: 'Alt+F4', action: function () { win.close(); } }
      ], x, y);
    }
    titleBar.addEventListener('contextmenu', function (e) { e.preventDefault(); systemMenu(e.clientX, e.clientY); });
    if (titleImg) titleImg.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); WM.focus(win);
      var r = titleImg.getBoundingClientRect(); systemMenu(r.left, r.bottom + 2);
    });
    if (titleImg) titleImg.addEventListener('dblclick', function (e) { e.stopPropagation(); win.close(); });

    // Dragging by the title bar.
    titleBar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      WM.focus(win);
      if (win.maximized) return;
      var sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      drag(e, function (ev) {
        var d = desktopRect();
        var nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
        el.style.left = U.clamp(nx, -el.offsetWidth + 40, d.w - 40) + 'px';
        el.style.top = U.clamp(ny, 0, d.h - 20) + 'px';
      });
    });

    // Resizing from edges and the grip.
    if (o.resizable) {
      ['n', 's', 'e', 'w', 'nw', 'ne', 'sw'].forEach(function (dir) {
        var edge = h('div', { className: 'resize-edge ' + dir });
        edge.addEventListener('pointerdown', function (e) { startResize(e, dir); });
        el.appendChild(edge);
      });
      var grip = h('div', { className: 'resize-grip' });
      grip.addEventListener('pointerdown', function (e) { startResize(e, 'se'); });
      el.appendChild(grip);
    }
    function startResize(e, dir) {
      if (win.maximized) return;
      e.stopPropagation();
      WM.focus(win);
      var sx = e.clientX, sy = e.clientY;
      var r0 = { l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      var minW = o.minWidth || 150, minH = o.minHeight || 80;
      drag(e, function (ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        var l = r0.l, t = r0.t, ww = r0.w, hh = r0.h;
        if (dir.indexOf('e') !== -1) ww = Math.max(minW, r0.w + dx);
        if (dir.indexOf('s') !== -1) hh = Math.max(minH, r0.h + dy);
        if (dir.indexOf('w') !== -1) { ww = Math.max(minW, r0.w - dx); l = r0.l + r0.w - ww; }
        if (dir.indexOf('n') !== -1) { hh = Math.max(minH, r0.h - dy); t = Math.max(0, r0.t + r0.h - hh); }
        Object.assign(el.style, { left: l + 'px', top: t + 'px', width: ww + 'px', height: hh + 'px' });
        win.fire('resize');
      }, dir === 'se' ? 'nwse-resize' : getComputedStyle(e.target).cursor);
    }

    el.addEventListener('pointerdown', function (e) {
      // A modal dialog blocks its owner completely.
      if (win.modalChild && !win.modalChild.closed) { e.preventDefault(); e.stopPropagation(); win.modalChild.flash(); return; }
      WM.focus(win);
    }, true);

    // Modal dialogs lock their owner.
    if (o.owner) {
      win.owner = o.owner;
      if (o.modal !== false) o.owner.modalChild = win;
    }
    if (o.owner || o.taskbar === false) win.noTaskbar = true;

    WM.windows.push(win);
    WM.focus(win);
    if (o.maximized) toggleMax();
    emit();
    return win;
  };

  function topmost() {
    var best = null, z = -1;
    WM.windows.forEach(function (w) {
      if (w.minimized) return;
      var zi = +w.el.style.zIndex || 0;
      if (zi > z) { z = zi; best = w; }
    });
    return best;
  }

  WM.focus = function (win) {
    if (!win || win.closed) return;
    // Focusing a window that owns a modal dialog focuses the dialog instead.
    while (win.modalChild && !win.modalChild.closed) {
      if (win.minimized) { win.minimized = false; win.el.classList.remove('minimized'); }
      win.el.style.zIndex = ++zTop;
      win = win.modalChild;
    }
    if (win.minimized) { win.minimized = false; win.el.classList.remove('minimized'); }
    if (WM.active !== win) {
      if (WM.active) { WM.active.el.classList.remove('active'); WM.active.fire('blur'); }
      WM.active = win;
      win.el.classList.add('active');
      win.fire('focus');
    }
    // Owner below its dialog.
    win.el.style.zIndex = ++zTop;
    if (win.modalChild && !win.modalChild.closed) { win.modalChild.el.style.zIndex = ++zTop; }
    emit();
  };

  WM.deactivateAll = function () {
    if (WM.active) { WM.active.el.classList.remove('active'); WM.active.fire('blur'); }
    WM.active = null;
    emit();
  };

  // Dialogs first, so their owners can then ask about unsaved work.
  WM.closeAll = function () {
    var list = WM.windows.slice().sort(function (a, b) { return (b.owner ? 1 : 0) - (a.owner ? 1 : 0); });
    return list.reduce(function (p, w) {
      return p.then(function (ok) { return !ok ? false : w.closed ? true : w.close(); });
    }, Promise.resolve(true));
  };

  function drag(e, move, cursor) {
    e.preventDefault();
    var id = e.pointerId;
    document.body.classList.add('dragging');
    if (cursor) document.body.style.cursor = cursor;
    function mv(ev) { if (ev.pointerId === id) move(ev); }
    function up(ev) {
      if (ev.pointerId !== id) return;
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging');
      document.body.style.cursor = '';
    }
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }
  WM.drag = drag;

  function taskbarRect(win) {
    var b = document.querySelector('.task-btn[data-win="' + win.id + '"]');
    if (b) return b.getBoundingClientRect();
    return { left: 4, top: window.innerHeight - 26, width: 150, height: 22 };
  }
  function zoomAnim(from, to) {
    var z = h('div', { className: 'zoom-rect' });
    Object.assign(z.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    document.body.appendChild(z);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        Object.assign(z.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
      });
    });
    setTimeout(function () { z.remove(); }, 220);
  }

  // Clicking into an iframe (DOOM, the web) doesn't bubble; catch it via focus.
  window.addEventListener('blur', function () {
    setTimeout(function () {
      var a = document.activeElement;
      if (!a || a.tagName !== 'IFRAME') return;
      var w = WM.windows.filter(function (w2) { return w2.el.contains(a); })[0];
      if (w && WM.active !== w) WM.focus(w);
    }, 0);
  });

  // =====================================================================
  // Message boxes
  // =====================================================================
  var ICON_SOUND = { error: 'error', warning: 'chord', info: 'chord', question: 'chord' };

  WM.msgbox = function (o) {
    o = Object.assign({ title: 'Windows', text: '', icon: 'info', buttons: ['OK'] }, o);
    return new Promise(function (resolve) {
      var result = o.buttons[o.buttons.length - 1];
      var row = h('div', { className: 'button-row' });
      var win;
      o.buttons.forEach(function (b, i) {
        var btn = h('button', { className: 'btn' + (i === (o.defaultButton || 0) ? ' default' : '') });
        btn.appendChild(U.label(b));
        btn.addEventListener('click', function () { result = b; win.close(true); });
        row.appendChild(btn);
      });
      var content = [
        h('div', { className: 'msgbox' }, [o.icon ? U.img(o.icon, 32) : null, h('div', { className: 'text' }, o.text)]),
        row
      ];
      win = WM.open({
        title: o.title, dialog: true, resizable: false, width: o.width || 'auto', height: 'auto',
        owner: o.owner, content: content, className: 'msgbox-window', taskbar: !o.owner
      });
      win.el.style.width = 'auto';
      win.el.style.minWidth = '200px';
      win.center();
      win.on('close', function () { resolve(result); });
      win.onKey = function (e) {
        if (e.key === 'Enter') { result = o.buttons[o.defaultButton || 0]; win.close(true); return true; }
        if (e.key === 'Escape') { result = o.buttons.indexOf('Cancel') !== -1 ? 'Cancel' : o.buttons[o.buttons.length - 1]; win.close(true); return true; }
        var i = o.buttons.findIndex(function (b) { return U.accel(b) === e.key.toLowerCase(); });
        if (i !== -1 && e.altKey) { result = o.buttons[i]; win.close(true); return true; }
        return false;
      };
      var s = o.sound !== undefined ? o.sound : ICON_SOUND[o.icon];
      if (s) U.sound(s);
      setTimeout(function () { var b = row.querySelector('.default'); if (b) b.focus(); }, 0);
    });
  };

  // Simple modal dialog with arbitrary content and a button row.
  WM.dialog = function (o) {
    var win = WM.open(Object.assign({ dialog: true, resizable: false, height: 'auto' }, o));
    if (o.width) win.el.style.width = Math.min(o.width, desktopRect().w - 8) + 'px';
    win.center();
    return win;
  };

  // =====================================================================
  // Global keyboard handling
  // =====================================================================
  document.addEventListener('keydown', function (e) {
    if (Menu.handleKey(e)) return;
    var w = WM.active;
    if (e.altKey && e.key === 'F4') { e.preventDefault(); if (w) w.close(); return; }
    if (!w) return;
    // Enter/Space on a focused button presses that button, not the dialog default.
    var a = document.activeElement;
    if ((e.key === 'Enter' || e.key === ' ') && a && a.tagName === 'BUTTON' && w.el.contains(a)) return;
    if (w.onKey && w.onKey(e)) { e.preventDefault(); return; }
    if (e.altKey && !e.ctrlKey && w.menuAccel && e.key.length === 1) {
      if (w.menuAccel(e.key.toLowerCase())) e.preventDefault();
    }
  });

  window.WM = WM;
  window.Menu = Menu;
})();
