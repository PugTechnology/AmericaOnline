/* Notepad, Windows 98 edition. Files live on the virtual C: drive. */
(function () {
  var h = U.h;
  var wordWrap = U.store.get('w98.notepad.wrap', false);

  function launch(path) {
    var doc = { path: null, dirty: false };
    var ta = h('textarea', { className: 'notepad-text', spellcheck: 'false', wrap: wordWrap ? 'soft' : 'off' });
    var win = WM.open({
      app: 'notepad', title: 'Untitled - Notepad', icon: 'notepad', width: 520, height: 360,
      content: ta, className: 'notepad', onClose: function () { return confirmDiscard(); }
    });

    function name() { return doc.path ? FS.basename(doc.path) : 'Untitled'; }
    function updateTitle() { win.setTitle(name() + ' - Notepad'); }

    function load(p) {
      try {
        ta.value = FS.read(p).replace(/\r\n/g, '\n');
        doc.path = FS.realPath(p);
        doc.dirty = false;
        Shell.addRecent(doc.path);
        updateTitle();
        ta.setSelectionRange(0, 0);
        ta.scrollTop = 0;
      } catch (err) {
        WM.msgbox({ title: 'Notepad', owner: win, icon: 'error', text: 'Cannot find the ' + p + ' file.\n\nDo you want to create a new file?', buttons: ['&Yes', '&No'] }).then(function (b) {
          if (b === '&Yes') { doc.path = p; updateTitle(); }
        });
      }
    }

    // Resolves true when it's OK to throw the current text away.
    function confirmDiscard() {
      if (!doc.dirty) return Promise.resolve(true);
      return WM.msgbox({
        title: 'Notepad', owner: win, icon: 'warning', buttons: ['&Yes', '&No', 'Cancel'],
        text: 'The text in the ' + (doc.path || 'Untitled') + ' file has changed.\n\nDo you want to save the changes?'
      }).then(function (b) {
        if (b === 'Cancel') return false;
        if (b === '&No') return true;
        return save();
      });
    }

    function writeTo(p) {
      try {
        FS.write(p, ta.value.replace(/\n/g, '\r\n'));
        doc.path = FS.realPath(p);
        doc.dirty = false;
        Shell.addRecent(doc.path);
        updateTitle();
        U.sound('hddSeek', 250);
        return true;
      } catch (err) {
        WM.msgbox({ title: 'Notepad', owner: win, icon: 'error', text: FS.errorText(err, p) });
        return false;
      }
    }

    function save() {
      if (doc.path) return Promise.resolve(writeTo(doc.path));
      return saveAs();
    }

    function saveAs() {
      return Dialogs.file({
        mode: 'save', owner: win, dir: doc.path ? FS.dirname(doc.path) : 'C:\\My Documents',
        name: doc.path ? FS.basename(doc.path) : '*.txt'
      }).then(function (p) { return p ? writeTo(p) : false; });
    }

    function open() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        Dialogs.file({ mode: 'open', owner: win, dir: doc.path ? FS.dirname(doc.path) : 'C:\\My Documents' }).then(function (p) {
          if (p) load(p);
        });
      });
    }

    function newDoc() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        ta.value = ''; doc.path = null; doc.dirty = false; updateTitle();
      });
    }

    function timeDate() {
      var d = new Date();
      var hh = d.getHours(), ap = hh >= 12 ? 'PM' : 'AM';
      insert((hh % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap + ' ' + (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(-2));
    }

    function insert(text) {
      ta.focus();
      var s = ta.selectionStart, e = ta.selectionEnd;
      ta.setRangeText(text, s, e, 'end');
      markDirty();
    }

    function markDirty() { doc.dirty = true; }

    function exec(cmd) {
      ta.focus();
      try { document.execCommand(cmd); } catch (e) { /* unsupported */ }
      markDirty();
    }

    function paste() {
      ta.focus();
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(insert, function () { exec('paste'); });
      } else exec('paste');
    }

    var lastFind = '', matchCase = false, findWin = null;
    win.on('close', function () { if (findWin) findWin.close(true); });
    function findNext(term) {
      term = term || lastFind;
      if (!term) return findDialog();
      lastFind = term;
      var hay = matchCase ? ta.value : ta.value.toLowerCase();
      var needle = matchCase ? term : term.toLowerCase();
      var i = hay.indexOf(needle, ta.selectionEnd);
      if (i === -1) {
        WM.msgbox({ title: 'Notepad', owner: win, icon: 'info', text: 'Cannot find "' + term + '"' });
        return;
      }
      ta.focus();
      ta.setSelectionRange(i, i + term.length);
    }

    function findDialog() {
      var input = h('input', { type: 'text', className: 'field', value: lastFind, style: { width: '190px' } });
      var mc = h('input', { type: 'checkbox', checked: matchCase });
      var next = h('button', { className: 'btn default' }, U.label('&Find Next'));
      var cancel = h('button', { className: 'btn' }, 'Cancel');
      if (findWin && !findWin.closed) { findWin.focus(); return; }
      var d = findWin = WM.dialog({
        title: 'Find', owner: win, modal: false, width: 360,
        content: h('div', { className: 'find-dialog' }, [
          h('div', { className: 'row' }, [h('label', null, U.label('Fi&nd what:')), input]),
          h('label', { className: 'check' }, [mc, U.label('Match &case')]),
          h('div', { className: 'btns' }, [next, cancel])
        ])
      });
      next.addEventListener('click', function () { matchCase = mc.checked; findNext(input.value); });
      cancel.addEventListener('click', function () { d.close(true); });
      d.onKey = function (e) {
        if (e.key === 'Enter') { matchCase = mc.checked; findNext(input.value); return true; }
        if (e.key === 'Escape') { d.close(true); return true; }
        return false;
      };
      setTimeout(function () { input.focus(); input.select(); }, 0);
    }

    function setWrap(on) {
      wordWrap = on;
      U.store.set('w98.notepad.wrap', on);
      ta.setAttribute('wrap', on ? 'soft' : 'off');
      ta.classList.toggle('wrap', on);
    }
    ta.classList.toggle('wrap', wordWrap);

    Menu.bar(win, [
      { label: '&File', items: function () {
        return [
          { label: '&New', action: newDoc },
          { label: '&Open...', action: open },
          { label: '&Save', action: save },
          { label: 'Save &As...', action: saveAs },
          '-',
          { label: 'Page Se&tup...', action: noPrinter },
          { label: '&Print', action: noPrinter },
          '-',
          { label: 'E&xit', action: function () { win.close(); } }
        ];
      } },
      { label: '&Edit', items: function () {
        var sel = ta.selectionStart !== ta.selectionEnd;
        return [
          { label: '&Undo', shortcut: 'Ctrl+Z', action: function () { exec('undo'); } },
          '-',
          { label: 'Cu&t', shortcut: 'Ctrl+X', disabled: !sel, action: function () { exec('cut'); } },
          { label: '&Copy', shortcut: 'Ctrl+C', disabled: !sel, action: function () { exec('copy'); } },
          { label: '&Paste', shortcut: 'Ctrl+V', action: paste },
          { label: 'De&lete', shortcut: 'Del', disabled: !sel, action: function () { insert(''); } },
          '-',
          { label: 'Select &All', action: function () { ta.focus(); ta.select(); } },
          { label: 'Time/&Date', shortcut: 'F5', action: timeDate },
          '-',
          { label: '&Word Wrap', checked: wordWrap, action: function () { setWrap(!wordWrap); } },
          { label: 'Set &Font...', action: function () {
            WM.msgbox({ title: 'Font', owner: win, icon: 'info', text: 'Fixedsys is the only font a real Notepad user needs.' });
          } }
        ];
      } },
      { label: '&Search', items: [
        { label: '&Find...', action: findDialog },
        { label: 'Find &Next', shortcut: 'F3', action: function () { findNext(); } }
      ] },
      { label: '&Help', items: [
        { label: '&Help Topics', action: function () { Shell.launch('help', 'notepad'); } },
        '-',
        { label: '&About Notepad', action: function () { Shell.launch('about', { name: 'Notepad', icon: 'notepad' }); } }
      ] }
    ]);

    function noPrinter() {
      WM.msgbox({ title: 'Notepad', owner: win, icon: 'warning', text: 'No printers are installed. To install a printer, click the Start button, point to Settings, click Printers, and then double-click Add Printer.' });
    }

    ta.addEventListener('input', markDirty);
    ta.addEventListener('keydown', function (e) {
      if (win.modalChild) { e.preventDefault(); return; }
      if (e.key === 'F5') { e.preventDefault(); timeDate(); }
      if (e.key === 'F3') { e.preventDefault(); findNext(); }
      if (e.key === 'Tab') { e.preventDefault(); insert('\t'); }
      if (e.ctrlKey && !e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); }
      if (e.ctrlKey && !e.altKey && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); open(); }
      if (e.ctrlKey && !e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); newDoc(); }
    });
    win.on('focus', function () { setTimeout(function () { if (!win.modalChild) ta.focus(); }, 0); });

    if (path) load(path);
    setTimeout(function () { ta.focus(); }, 0);
    return win;
  }

  Shell.register('notepad', { name: 'Notepad', icon: 'notepad', launch: launch });
})();
