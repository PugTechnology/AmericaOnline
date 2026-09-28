/*
 * Achievements: a tiny trophy case with a Windows 98 balloon-tip toast.
 *
 *   Achievements.unlock(id [, { title, desc, icon }])   unlock once; shows the toast
 *   Achievements.has(id)                                 already unlocked?
 *   Achievements.list()                                  [{ id, title, desc, icon, unlocked, when }]
 *   Achievements.define(id, { title, desc, icon })       register one (unknown ids can also pass it to unlock)
 *   Achievements.reset()                                 forget everything
 *
 * Other features can call it defensively:  window.Achievements && Achievements.unlock('doom')
 * State lives in localStorage under w98.achievements as { id: unlockedAtMs }.
 */
(function () {
  var h = U.h;
  var KEY = 'w98.achievements';

  var DEFS = {};
  var ORDER = [];
  function define(id, d) {
    if (!DEFS[id]) ORDER.push(id);
    DEFS[id] = Object.assign({ title: id, desc: '', icon: 'favorites' }, DEFS[id] || {}, d || {});
  }

  // Shell-level achievements; games and AOL can add their own with define() or unlock(id, opts).
  [
    ['bsod', 'Blue Screen of Death', 'A fatal exception 0E has occurred. You are now a real Windows user.', 'error'],
    ['cad', 'The Three-Finger Salute', 'Opened the Close Program dialog with Ctrl+Alt+Del.', 'exe'],
    ['reboot', 'Turn It Off and On Again', 'Restarted the computer from the Close Program dialog.', 'shutdown'],
    ['explorer', 'Have You Tried Restarting Explorer?', 'Ended the Explorer task and watched the desktop vanish.', 'folder-open'],
    ['y2k', 'Survived Y2K', 'Saw the year 2000 arrive, and 1900 for a moment.', 'settings'],
    ['theme', 'Plus! One', 'Changed the Desktop Theme.', 'display'],
    ['bin', 'Taking Out the Trash', 'Emptied the Recycle Bin.', 'recycle-full'],
    ['clipboard', 'Copy That', 'Pasted a file with Cut, Copy and Paste.', 'documents'],
    ['tidy', 'A Place for Everything', 'Switched on Auto Arrange for the desktop icons.', 'my-documents'],
    ['egg', 'Easter Egg Hunter', 'Found something the programmers hid.', 'question'],
    ['patience', 'The Patience of a Saint', 'Waited out a web page at 28.8k.', 'ie'],
    ['multi', 'Multitasker', 'Had six windows open at once. Your 32 MB of RAM is sweating.', 'programs'],
    ['doom', 'Rip and Tear', 'Started DOOM.', 'doom'],
    ['pinball', 'Space Cadet', 'Started 3D Pinball.', 'pinball'],
    ['aol', 'Welcome!', 'Started America Online.', 'aol']
  ].forEach(function (a) { define(a[0], { title: a[1], desc: a[2], icon: a[3] }); });

  var got = U.store.get(KEY, {});
  var queue = [], showing = false;

  function save() { U.store.set(KEY, got); }

  // ---- the balloon ----
  function toast(d) {
    queue.push(d);
    if (!showing) next();
  }
  function next() {
    var d = queue.shift();
    if (!d) { showing = false; return; }
    showing = true;
    var close = h('button', { className: 'ach-x', 'aria-label': 'Close' }, '\u00d7');
    var el = h('div', { className: 'ach-toast', role: 'status' }, [
      close,
      h('div', { className: 'ach-head' }, [U.img(d.icon, 16), h('b', null, 'Achievement unlocked')]),
      h('div', { className: 'ach-title' }, d.title),
      h('div', { className: 'ach-desc' }, d.desc)
    ]);
    document.body.appendChild(el);
    U.sound('ding');
    var gone = false;
    function dismiss() {
      if (gone) return; gone = true;
      el.classList.add('out');
      setTimeout(function () { el.remove(); next(); }, 250);
    }
    close.addEventListener('click', dismiss);
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    setTimeout(dismiss, 6500);
  }

  var Achievements = {
    define: define,
    has: function (id) { return !!got[id]; },
    unlock: function (id, opts) {
      if (!id || got[id]) return false;
      if (opts || !DEFS[id]) define(id, opts);
      got[id] = Date.now();
      save();
      toast(DEFS[id]);
      return true;
    },
    list: function () {
      return ORDER.map(function (id) { return Object.assign({ id: id, unlocked: !!got[id], when: got[id] || 0 }, DEFS[id]); });
    },
    reset: function () { got = {}; save(); }
  };
  window.Achievements = Achievements;

  // ---- hooks on shell-level events ----
  var emptyBin = FS.emptyRecycleBin;
  FS.emptyRecycleBin = function () { var r = emptyBin.apply(FS, arguments); Achievements.unlock('bin'); return r; };

  var launch = Shell.launch;
  Shell.launch = function (id) {
    var r = launch.apply(Shell, arguments);
    if (r && (id === 'doom' || id === 'pinball' || id === 'aol')) Achievements.unlock(id);
    return r;
  };

  WM.onChange(function () {
    var n = WM.windows.filter(function (w) { return !w.noTaskbar; }).length;
    if (n >= 6) Achievements.unlock('multi');
  });

  // ---- the viewer ----
  Shell.register('achievements', { name: 'Achievements', icon: 'favorites', single: true, launch: function () {
    var list = h('div', { className: 'sunken-panel ach-list' });
    var count = h('div', { className: 'ach-count' });
    function render() {
      list.innerHTML = '';
      var all = Achievements.list();
      var n = all.filter(function (a) { return a.unlocked; }).length;
      count.textContent = n + ' of ' + all.length + ' achievements unlocked';
      all.forEach(function (a) {
        list.appendChild(h('div', { className: 'ach-row' + (a.unlocked ? '' : ' locked') }, [
          U.img(a.unlocked ? a.icon : 'question', 32),
          h('div', null, [
            h('b', null, a.unlocked ? a.title : '???'),
            h('div', null, a.unlocked ? a.desc : 'Keep exploring to find this one.'),
            a.unlocked ? h('small', null, 'Unlocked ' + U.formatDate(a.when)) : null
          ])
        ]));
      });
    }
    render();
    var close = h('button', { className: 'btn default', onclick: function () { win.close(); } }, 'Close');
    var win = WM.open({ app: 'achievements', title: 'Achievements', icon: 'favorites', width: 400, height: 380, minWidth: 260, minHeight: 200,
      content: h('div', { className: 'ach-app' }, [count, list, h('div', { className: 'button-row right' }, [close])]) });
    win.onKey = function (e) { if (e.key === 'Escape') { win.close(); return true; } return false; };
    return win;
  } });

  // A shortcut in My Documents (once, so deleting it sticks). Older drives never had it in the seed.
  if (!U.store.get('w98.ach.link', false)) {
    U.store.set('w98.ach.link', true);
    try { if (FS.isDir('C:\\My Documents') && !FS.exists('C:\\My Documents\\Achievements.lnk')) FS.mklink('C:\\My Documents\\Achievements.lnk', 'achievements'); }
    catch (e) { /* disk full or missing folder: skip the shortcut */ }
  }
})();
