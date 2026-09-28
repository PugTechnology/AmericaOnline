/*
 * Y2K, cosmetically. Only the tray clock is affected (through Shell.clockDate); the real time,
 * file dates and everything else keep using the real clock.
 *
 *   Y2K.start()             countdown from 11:59:50 PM on 12/31/1999, then the 1900 rollover
 *   Y2K.setClock(date)      make the tray clock show `date` (setting 12/31/1999 starts the countdown)
 *   Y2K.reset()             back to the real time
 *
 * Date/Time Properties gets a small "Y2K test" section for all of this.
 */
(function () {
  var h = U.h;
  var virt = null;          // { base: ms shown at real0, real0: Date.now() } while the clock is faked
  var running = false;

  Shell.clockDate = function () { return virt ? new Date(virt.base + (Date.now() - virt.real0)) : new Date(); };
  function setVirtual(ms) { virt = ms == null ? null : { base: ms, real0: Date.now() }; if (Shell.tickClock) Shell.tickClock(); }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ---- the countdown window ----
  function countdown() {
    var big = h('div', { className: 'y2k-digits' }, '00:00:10');
    var note = h('p', { className: 'y2k-note' }, 'Stay calm. Do not use elevators.');
    var win = WM.dialog({ title: 'Millennium Countdown', width: 260, taskbar: false, closable: false,
      content: h('div', { className: 'y2k-count' }, [h('p', null, 'The year 2000 arrives in'), big, note]) });
    return new Promise(function (resolve) {
      var iv = setInterval(function () {
        var left = Math.max(0, Math.ceil((new Date(2000, 0, 1).getTime() - Shell.clockDate().getTime()) / 1000));
        if (Shell.tickClock) Shell.tickClock();
        big.textContent = '00:00:' + pad(left);
        if (left <= 3) note.textContent = left ? 'Hold on to something.' : 'HAPPY NEW YEAR!';
        U.sound(left ? 'menuClick' : 'chord');
        if (!left) { clearInterval(iv); setTimeout(function () { win.close(true); resolve(); }, 900); }
      }, 1000);
    });
  }

  function progressWindow() {
    var bar = h('div', { className: 'progress' });
    var text = h('div', null, 'Installing Y2K Update (KB000101)...');
    var win = WM.dialog({ title: 'Windows Update', width: 340, taskbar: false, closable: false,
      content: h('div', { className: 'y2k-update' }, [U.img('windows-update', 32), h('div', null, [text, bar])]) });
    return new Promise(function (resolve) {
      var n = 0, lines = ['Installing Y2K Update (KB000101)...', 'Teaching the BIOS about the year 2000...', 'Moving 99 years of files forward...', 'Removing 1900...'];
      var iv = setInterval(function () {
        bar.appendChild(h('div', { className: 'chunk' }));
        if (++n % 6 === 0) text.textContent = lines[Math.min(lines.length - 1, n / 6)];
        if (n >= 24) { clearInterval(iv); setTimeout(function () { win.close(true); resolve(); }, 400); }
      }, 220);
    });
  }

  function say(o) { return WM.msgbox(o); }

  function start() {
    if (running) return;
    running = true;
    if (window.Menu) Menu.closeAll();
    setVirtual(new Date(1999, 11, 31, 23, 59, 50).getTime());
    countdown().then(function () {
      setVirtual(new Date(1900, 0, 1, 0, 0, 0).getTime());
      return say({ title: 'Compaq Presario BIOS', icon: 'error', text: 'Your computer\'s BIOS is not Y2K compliant.\n\nThe system clock has rolled over to 12:00 AM, January 1, 1900.' });
    }).then(function () {
      return say({ title: 'Windows', icon: 'warning', text: 'Windows has detected that today is Monday, January 1, 1900.\n\nAll of your files are now 99 years older than Windows 98, which will not exist for another 98 years.' });
    }).then(function () {
      return say({ title: 'Windows', icon: 'question', buttons: ['&Yes', '&No'], text: 'Your library books are now 36,524 days overdue.\n\nDo you want to pay the late fee now?' });
    }).then(function (b) {
      return say({ title: 'Windows', icon: 'info', text: b === '&Yes' ? 'The late fee is $73,048.00. Your balance is $0.00. Please try again in 1901.' : 'The librarian has been notified.' });
    }).then(function () {
      return say({ title: 'Microsoft Windows Critical Update', icon: 'info', buttons: ['&Yes', '&No'],
        text: 'A critical update for the Year 2000 problem is available for this computer.\n\nMicrosoft Y2K Update (KB000101)\nSize: 1.2 MB   Estimated time: 1 minute\n\nDo you want to install it now?' });
    }).then(function (b) {
      if (b === '&No') return say({ title: 'Microsoft Windows Critical Update', icon: 'warning', text: 'That was not really a question. Installing anyway.' });
    }).then(progressWindow).then(function () {
      setVirtual(null);
      running = false;
      if (window.Achievements) Achievements.unlock('y2k');
      return say({ title: 'Y2K Update Applied', icon: 'info', text: 'The Microsoft Y2K Update has been applied.\n\nYour computer is now compliant with the year 2000 and the calendar has been restored. Thank you for choosing Microsoft Windows.\n\n(Have a wonderful new millennium.)' });
    }).catch(function (e) { console.error(e); setVirtual(null); running = false; });
  }

  var Y2K = {
    start: start,
    get running() { return running; },
    setClock: function (d) {
      if (running) return;
      setVirtual(d.getTime());
      if (d.getFullYear() === 1999 && d.getMonth() === 11 && d.getDate() === 31) setTimeout(start, 400);
    },
    reset: function () { if (!running) setVirtual(null); }
  };
  window.Y2K = Y2K;

  // ---- Date/Time Properties: a few extra controls above the buttons ----
  function extend(win) {
    var row = win.el.querySelector('.prop-sheet > .button-row');
    if (!row) return;
    var now = Shell.clockDate();
    var date = h('input', { type: 'date', className: 'field', value: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) });
    var set = h('button', { className: 'btn' }, 'Set clock');
    var test = h('button', { className: 'btn' }, 'Y2K test');
    var real = h('button', { className: 'btn' }, 'Real time');
    set.addEventListener('click', function () {
      var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(date.value);
      if (!m) return;
      var t = Shell.clockDate();
      var d = new Date(+m[1], +m[2] - 1, +m[3], t.getHours(), t.getMinutes(), t.getSeconds());
      win.close(true);
      Y2K.setClock(d);
    });
    test.addEventListener('click', function () { win.close(true); Y2K.start(); });
    real.addEventListener('click', function () { Y2K.reset(); win.close(true); });
    row.parentNode.insertBefore(h('fieldset', { className: 'group y2k-group' }, [
      h('legend', null, 'Pretend clock (for fun; files keep real dates)'),
      h('div', { className: 'y2k-row' }, [date, set, test, real])
    ]), row);
    win.center();
  }
  var control = Shell.program('control');
  if (control) {
    var baseLaunch = control.launch;
    control.launch = function (page) {
      var w = baseLaunch.apply(this, arguments);
      if (page === 'datetime' && w && w.el) extend(w);
      return w;
    };
  }
})();
