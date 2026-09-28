/*
 * The Windows 9x "Close Program" dialog (Ctrl+Alt+Del).
 *
 *   TaskMan.open()       show the dialog
 *   TaskMan.restart()    close everything and restart the machine through Boot
 *
 * Browsers often swallow Ctrl+Alt+Del, so Ctrl+Alt+Backspace and Ctrl+Shift+Esc work as well,
 * and the taskbar's right-click menu has a Task Manager entry. Pressing the combo a second
 * time while the dialog is open restarts the computer, just like the real warning says.
 */
(function () {
  var h = U.h;
  var win = null;
  var hung = {};             // window id -> is it "Not responding"? (decided once per window)
  var shellDown = false, trayDown = false;
  var refresh = null;        // rebuilds the open dialog's list

  function isHung(w) {
    if (!(w.id in hung)) hung[w.id] = Math.random() < 0.12;
    return hung[w.id];
  }

  function entries() {
    var list = WM.windows.filter(function (w) { return !w.closed && !w.noTaskbar && w !== win; }).map(function (w) {
      var bad = isHung(w);
      return { label: w.title + (bad ? ' (Not responding)' : ''), win: w, bad: bad };
    });
    // Explorer and Systray are always running, just like the real thing.
    list.push({ label: 'Explorer', kind: 'explorer' });
    list.push({ label: 'Systray', kind: 'systray' });
    return list;
  }

  // Ending Explorer takes the taskbar and icons with it; a moment later Windows restarts it.
  function endExplorer() {
    if (shellDown) return;
    shellDown = true;
    if (window.Menu) Menu.closeAll();
    document.body.classList.add('shell-dead');
    U.sound('error');
    if (window.Achievements) Achievements.unlock('explorer');
    setTimeout(function () {
      U.sound('hddSeek', 700);
      document.body.classList.remove('shell-dead');
      shellDown = false;
    }, 3500 + Math.random() * 1500);
  }
  function endSystray() {
    if (trayDown) return;
    trayDown = true;
    document.body.classList.add('tray-dead');
    setTimeout(function () { document.body.classList.remove('tray-dead'); trayDown = false; }, 2500);
  }

  function open() {
    if (win && !win.closed) { WM.focus(win); return win; }
    var chosen = null, rows = [];
    var listEl = h('div', { className: 'sunken-panel task-list', tabindex: '0' });
    var endBtn = h('button', { className: 'btn default', disabled: true }, U.label('&End Task'));
    var downBtn = h('button', { className: 'btn' }, U.label('&Shut Down'));
    var cancel = h('button', { className: 'btn' }, 'Cancel');

    function pick(i) {
      chosen = i;
      rows.forEach(function (r, k) { r.classList.toggle('selected', k === i); });
      endBtn.disabled = i == null;
    }
    var shown = [];
    function build() {
      shown = entries();
      listEl.innerHTML = '';
      rows = shown.map(function (en, i) {
        var r = h('div', { className: 'task-row' }, en.label);
        r.addEventListener('pointerdown', function () { pick(i); });
        U.onActivate(r, function () { pick(i); endTask(); });
        listEl.appendChild(r);
        return r;
      });
      chosen = null; endBtn.disabled = true;
    }
    function endTask() {
      var en = shown[chosen];
      if (!en) return;
      if (en.kind === 'explorer') { win.close(true); endExplorer(); return; }
      if (en.kind === 'systray') { endSystray(); return; }
      if (en.bad) U.sound('error');
      en.win.close(true);
      delete hung[en.win.id];
      build();
    }

    win = WM.dialog({ app: 'taskman', title: 'Close Program', width: 320, taskbar: false, content: h('div', { className: 'taskman' }, [
      h('p', null, 'Select the program you want to close, or press Ctrl+Alt+Del again to restart the computer.'),
      listEl,
      h('p', { className: 'task-warn' }, 'WARNING: Pressing CTRL+ALT+DEL again will restart your computer. You will lose unsaved information in all programs that are running.'),
      h('div', { className: 'button-row' }, [endBtn, downBtn, cancel])
    ]) });
    build();
    // The list follows windows opening and closing behind the dialog.
    refresh = function () { var keep = chosen; build(); if (keep != null && keep < rows.length) pick(keep); };
    endBtn.addEventListener('click', endTask);
    downBtn.addEventListener('click', function () { win.close(true); Shell.launch('shutdown'); });
    cancel.addEventListener('click', function () { win.close(true); });
    win.on('close', function () { refresh = null; win = null; });
    win.onKey = function (e) {
      if (e.key === 'Escape') { win.close(true); return true; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        pick(Math.max(0, Math.min(rows.length - 1, (chosen == null ? -1 : chosen) + (e.key === 'ArrowDown' ? 1 : -1))));
        return true;
      }
      if (e.key === 'Enter' && chosen != null) { endTask(); return true; }
      return false;
    };
    U.sound('chord');
    if (window.Achievements) Achievements.unlock('cad');
    return win;
  }

  // Hard restart: everything is closed without asking; then the usual Boot restart runs.
  function restart(fromDialog) {
    if (window.Menu) Menu.closeAll();
    document.body.classList.remove('shell-dead', 'tray-dead');
    shellDown = trayDown = false;
    WM.windows.slice().forEach(function (w) { if (!w.closed) w.close(true); });
    if (fromDialog && window.Achievements) Achievements.unlock('reboot');
    if (window.Boot) Boot.shutdown('restart');
  }

  var TaskMan = {
    open: open,
    restart: function () { restart(false); },
    get isOpen() { return !!win && !win.closed; }
  };
  window.TaskMan = TaskMan;
  WM.onChange(function () { if (refresh) refresh(); });

  document.addEventListener('keydown', function (e) {
    var cad = (e.ctrlKey && e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) || (e.ctrlKey && e.shiftKey && e.key === 'Escape');
    if (!cad || e.repeat) return;
    if (window.BSOD && BSOD.active) return;   // the blue screen has its own reboot handling
    if (!Shell.ready()) return;
    e.preventDefault();
    e.stopPropagation();   // Esc in Ctrl+Shift+Esc must not reach the dialog's own key handler
    if (TaskMan.isOpen) { restart(true); return; }
    open();
  }, true);
})();
