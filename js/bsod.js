/*
 * The Blue Screen of Death, Windows 9x text-mode edition.
 *
 *   BSOD.show(opts)          crash now. opts: { victim: win, kind: 'vxd' | 'halt', egg: bool }
 *   BSOD.command(text, opts) true if `text` is a crash command (CON\CON, "crash"); it then crashes
 *   BSOD.chance              odds of a random crash when DOOM and Pinball run together (0.12)
 *   BSOD.active              a blue screen is up
 *
 * Any key (or a tap) dismisses it. Sometimes a second "Windows protection error" screen
 * follows, and a key press there reboots. Ctrl+Alt+Del reboots straight away.
 */
(function () {
  var h = U.h;
  var el = null, armed = false, kind = 'vxd', victim = null;

  // The classic wording, with a few real-looking variations.
  var FAULTS = [
    'A fatal exception 0E has occurred at 0028:C0011E36 in VXD VMM(01) +\n00010E36. The current application will be terminated.',
    'A fatal exception 0E has occurred at 0167:BFF9DB61 in VXD VWIN32(05) +\n000059F5. The current application will be terminated.',
    'A fatal exception 0D has occurred at 0028:C003A4E1 in VXD IOS(01) +\n0000A1D0. The current application will be terminated.'
  ];
  var CON = FAULTS[0];

  function screenText(k, fault) {
    if (k === 'halt') {
      return 'While initializing device VMM:\nWindows protection error. You need to restart your computer.\n\n' +
        'System halted';
    }
    return fault + '\n\n' +
      '*  Press any key to terminate the current application.\n' +
      '*  Press CTRL+ALT+DEL again to restart your computer. You will\n' +
      '   lose any unsaved information in all applications.\n\n' +
      '                       Press any key to continue ';
  }

  function restart() {
    hide();
    if (window.TaskMan) TaskMan.restart();
    else if (window.Boot) Boot.shutdown('restart');
  }

  function hide() {
    document.removeEventListener('keydown', onKey, true);
    if (el) { el.remove(); el = null; }
    BSOD.active = false;
    document.body.classList.remove('bsod-on');
  }

  function onKey(e) {
    if (!armed) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') return;
    e.preventDefault();
    e.stopPropagation();
    var cad = (e.ctrlKey && e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) || (e.ctrlKey && e.shiftKey && e.key === 'Escape');
    if (cad || kind === 'halt') { restart(); return; }
    dismiss();
  }

  // Back to the desktop: the crashed program is gone. Now and then Windows isn't done with you.
  function dismiss() {
    hide();
    var v = victim; victim = null;
    if (v && !v.closed) v.close(true);
    if (Math.random() < BSOD.repeat) setTimeout(function () { BSOD.show({ kind: 'halt' }); }, 900);
  }

  var BSOD = {
    active: false,
    chance: 0.12,   // random crash odds when DOOM and Pinball are open together
    repeat: 0.3,    // odds of a second blue screen after the first is dismissed

    show: function (opts) {
      opts = opts || {};
      if (BSOD.active || (window.Shell && !Shell.ready())) return false;
      kind = opts.kind || 'vxd';
      victim = opts.victim || null;
      var fault = opts.egg ? CON : FAULTS[Math.floor(Math.random() * FAULTS.length)];
      if (window.Menu) Menu.closeAll();
      var pre = h('pre', { className: 'bsod-text' }, screenText(kind, fault));
      pre.appendChild(h('span', { className: 'bsod-cursor' }, '_'));
      el = h('div', { className: 'bsod', role: 'alert' }, [h('div', { className: 'bsod-title' }, ' Windows '), pre]);
      document.body.appendChild(el);
      document.body.classList.add('bsod-on');
      // Take the keyboard back from DOOM's or the web's iframe, or "any key" would never arrive.
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); window.focus(); el.tabIndex = -1; el.focus(); } catch (e) { /* ignore */ }
      BSOD.active = true;
      armed = false;
      U.sound('error');
      // The key that caused the crash (Enter in Run, say) mustn't dismiss it at once.
      setTimeout(function () { armed = true; }, 700);
      document.addEventListener('keydown', onKey, true);
      el.addEventListener('pointerdown', function () { if (armed) { if (kind === 'halt') restart(); else dismiss(); } });
      if (window.Achievements) {
        Achievements.unlock('bsod');
        if (opts.egg) Achievements.unlock('egg');
      }
      return true;
    },

    // CON\CON, C:\CON\CON, or the hidden "crash" keyword.
    command: function (text, opts) {
      var t = String(text || '').trim().toLowerCase().replace(/\//g, '\\');
      if (!/^(?:[a-z]:)?\\?con\\con$/.test(t) && t !== 'crash') return false;
      setTimeout(function () { BSOD.show(Object.assign({ egg: true, kind: 'vxd' }, opts || {})); }, 350);
      return true;
    }
  };
  window.BSOD = BSOD;

  // Opening DOOM and Pinball at the same time is asking for it.
  var launch = Shell.launch;
  Shell.launch = function (id) {
    var r = launch.apply(Shell, arguments);
    var other = { doom: 'pinball', pinball: 'doom' }[id];
    if (r && other && WM.find(function (w) { return w.app === other && !w.closed; }) && Math.random() < BSOD.chance) {
      setTimeout(function () { BSOD.show({ victim: r }); }, 2500 + Math.random() * 2500);
    }
    return r;
  };

  // Typing "crash" onto the bare desktop works too.
  var typed = '';
  document.addEventListener('keydown', function (e) {
    if (BSOD.active || WM.active || !Shell.ready() || e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) { typed = ''; return; }
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { typed = ''; return; }
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed === 'crash') { typed = ''; BSOD.command('crash'); }
  });
})();
