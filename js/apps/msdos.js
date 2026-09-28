/* MS-DOS Prompt: a small COMMAND.COM over the virtual C: drive. */
(function () {
  var h = U.h;

  function launch(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var screen = h('div', { className: 'dos-screen', tabindex: '0' });
    var out = h('div', { className: 'dos-out' });
    var lineEl = h('span', { className: 'dos-line' });
    var cursor = h('span', { className: 'dos-cursor' }, '_');
    screen.appendChild(out);
    screen.appendChild(h('div', null, [lineEl, cursor]));
    var keyTrap = h('textarea', { className: 'dos-trap', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
    screen.appendChild(keyTrap);

    var cwd = 'C:\\WINDOWS';
    var input = '', history = [], hIdx = 0;
    var pending = null; // a one-key prompt (Abort, Retry, Fail?)
    var win = null, full = null;

    if (opts.dosMode) {
      full = h('div', { className: 'dos-fullscreen' }, screen);
      WM.closeAll().then(function (ok) {
        if (!ok) return;
        U.sound('shutdown');
        document.getElementById('machine').appendChild(full);
        cwd = 'C:\\';
        print('\nMicrosoft(R) Windows 98\n   (C)Copyright Microsoft Corp 1981-1998.\n\nType WIN to return to Windows.\n\n');
        prompt();
        focus();
      });
    } else {
      win = WM.open({ app: 'msdos', title: 'MS-DOS Prompt', icon: 'msdos', width: 660, height: 430, content: [
        h('div', { className: 'toolbar dos-toolbar' }, [h('select', { className: 'field', disabled: true }, h('option', null, 'Auto')), h('span', { className: 'dos-tb-note' }, '\u00a0Font: 8 x 16')]),
        screen
      ], className: 'msdos' });
      print('\nMicrosoft(R) Windows 98\n   (C)Copyright Microsoft Corp 1981-1998.\n\n');
      prompt();
      win.on('focus', function () { setTimeout(focus, 0); });
    }

    function focus() { keyTrap.focus({ preventScroll: true }); }
    screen.addEventListener('pointerup', focus);

    function print(text) {
      out.appendChild(document.createTextNode(text));
      trim();
      screen.scrollTop = screen.scrollHeight;
    }
    function trim() {
      while (out.textContent.length > 20000 && out.firstChild) out.removeChild(out.firstChild);
    }
    function promptText() { return cwd + '>'; }
    function prompt() { lineEl.textContent = promptText(); input = ''; }
    function redraw() { lineEl.textContent = (pending ? pending.text : promptText()) + input; screen.scrollTop = screen.scrollHeight; }

    keyTrap.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) { print(lineEl.textContent + '^C\n'); pending = null; prompt(); e.preventDefault(); return; }
      if (pending) {
        e.preventDefault();
        if (e.key.length === 1) {
          var k = e.key.toLowerCase();
          if (pending.keys.indexOf(k) !== -1) {
            var p = pending; pending = null;
            print(p.text + e.key + '\n');
            p.resolve(k);
          }
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        var cmd = input;
        print(promptText() + cmd + '\n');
        if (cmd.trim()) { history.push(cmd); hIdx = history.length; }
        input = '';
        lineEl.textContent = '';
        Promise.resolve(exec(cmd)).then(function () { if (!pending) prompt(); redraw(); });
        return;
      }
      if (e.key === 'Backspace') { input = input.slice(0, -1); redraw(); e.preventDefault(); return; }
      if (e.key === 'ArrowUp' || e.key === 'F3') { if (hIdx > 0) { hIdx--; input = history[hIdx]; redraw(); } e.preventDefault(); return; }
      if (e.key === 'ArrowDown') { if (hIdx < history.length - 1) { hIdx++; input = history[hIdx]; } else { hIdx = history.length; input = ''; } redraw(); e.preventDefault(); return; }
      if (e.key === 'Escape') { input = ''; redraw(); e.preventDefault(); return; }
      if (e.key === 'Tab') { e.preventDefault(); complete(); return; }
    });
    keyTrap.addEventListener('input', function () {
      var v = keyTrap.value.replace(/[\r\n]/g, '');
      keyTrap.value = '';
      if (!v || pending) return;
      input += v;
      redraw();
    });

    function complete() {
      var m = /(\S*)$/.exec(input), frag = m[1];
      var dir = frag.lastIndexOf('\\') !== -1 ? frag.slice(0, frag.lastIndexOf('\\') + 1) : '';
      var base = frag.slice(dir.length).toLowerCase();
      var list = FS.list(resolvePath(dir || '.')) || [];
      var hit = list.filter(function (e) { return e.name.toLowerCase().indexOf(base) === 0; })[0];
      if (hit) { input = input.slice(0, input.length - frag.length) + dir + hit.name; redraw(); }
    }

    function ask(text, keys) {
      return new Promise(function (resolve) { pending = { text: text, keys: keys, resolve: resolve }; input = ''; redraw(); });
    }

    function resolvePath(p) {
      p = (p || '').replace(/\//g, '\\').replace(/^"|"$/g, '');
      if (!p || p === '.') return cwd;
      if (/^[a-z]:$/i.test(p)) return p.toUpperCase() + '\\';
      var parts;
      if (/^[a-z]:\\/i.test(p)) parts = p.split('\\');
      else if (p.charAt(0) === '\\') parts = [cwd.slice(0, 2)].concat(p.split('\\'));
      else parts = cwd.split('\\').concat(p.split('\\'));
      var outp = [];
      parts.forEach(function (s) {
        if (!s || s === '.') return;
        if (s === '..') { if (outp.length > 1) outp.pop(); return; }
        if (/^\.{3,}$/.test(s)) { for (var i = 2; i < s.length; i++) if (outp.length > 1) outp.pop(); return; }
        outp.push(s);
      });
      return FS.join.apply(null, outp);
    }

    // Split arguments on spaces, keeping "quoted names" together.
    function args(a) {
      var out = [];
      (a || '').replace(/"([^"]*)"|(\S+)/g, function (m, q, w) { out.push(q != null ? q : w); });
      return out;
    }

    function notReady(letter) {
      U.sound('floppyRead', 1400);
      return U.wait(1400).then(function () {
        print('\nNot ready reading drive ' + letter + '\n');
        return ask('Abort, Retry, Fail?', ['a', 'r', 'f']);
      }).then(function (k) {
        if (k === 'r') return notReady(letter);
        if (k === 'f') print('Current drive is no longer valid');
        print('\n');
      });
    }

    function dosName(name) {
      var m = /^(.*?)(?:\.([^.]*))?$/.exec(name);
      var base = m[1].replace(/\s/g, '').toUpperCase(), ext = (m[2] || '').toUpperCase().slice(0, 3);
      if (base.length > 8) base = base.slice(0, 6) + '~1';
      return (base + '        ').slice(0, 8) + ' ' + (ext + '   ').slice(0, 3);
    }
    function dosDate(ms) {
      var d = new Date(ms), hh = d.getHours(), ap = hh >= 12 ? 'p' : 'a';
      return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '-' + String(d.getFullYear()).slice(-2) + '  ' +
        String(hh % 12 || 12).padStart(2, ' ') + ':' + String(d.getMinutes()).padStart(2, '0') + ap;
    }
    function num(n) { return n.toLocaleString('en-US'); }

    var COMMANDS = {
      help: function () {
        print('For more information on a specific command, type HELP command-name\n' +
          'CD       Displays the name of or changes the current directory.\n' +
          'CLS      Clears the screen.\n' +
          'COPY     Copies one file to another location.\n' +
          'DATE     Displays the date.\n' +
          'DEL      Deletes one or more files.\n' +
          'DIR      Displays a list of files and subdirectories in a directory.\n' +
          'ECHO     Displays messages.\n' +
          'EDIT     Starts the editor (Notepad).\n' +
          'EXIT     Quits the MS-DOS Prompt.\n' +
          'MD       Creates a directory.\n' +
          'MEM      Displays the amount of used and free memory in your system.\n' +
          'RD       Removes a directory.\n' +
          'REN      Renames a file or files.\n' +
          'TIME     Displays the system time.\n' +
          'TYPE     Displays the contents of a text file.\n' +
          'VER      Displays the MS-DOS version.\n' +
          'VOL      Displays a disk volume label and serial number.\n' +
          'WIN      Starts Windows (MS-DOS mode only).\n' +
          '\nYou can also type the name of a program: NOTEPAD, DOOM, AOL, WINMINE, EXPLORER.\n');
      },
      ver: function () { print('\nWindows 98 [Version 4.10.1998]\n\n'); },
      cls: function () { out.textContent = ''; },
      echo: function (a) { print((a || 'ECHO is on') + '\n'); },
      date: function () { var d = new Date(); print('Current date is ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '-' + d.getFullYear() + '\n'); },
      time: function () { var d = new Date(); print('Current time is ' + d.toLocaleTimeString('en-US') + '\n'); },
      vol: function () { print(' Volume in drive C is PRESARIO\n Volume Serial Number is 2A1F-0E73\n'); },
      mem: function () {
        print('\nMemory Type        Total  =   Used  +   Free\n' +
          '----------------  -------   -------   -------\n' +
          'Conventional          640K       41K      599K\n' +
          'Upper                   0K        0K        0K\n' +
          'Reserved              384K      384K        0K\n' +
          'Extended (XMS)     31,744K   22,016K    9,728K\n' +
          '----------------  -------   -------   -------\n' +
          'Total memory       32,768K   22,441K   10,327K\n\n' +
          'Largest executable program size       599K (613,264 bytes)\n' +
          'MS-DOS is resident in the high memory area.\n\n');
      },
      cd: function (a) {
        if (!a) { print(cwd + '\n'); return; }
        if (/^[abd]:/i.test(a)) return notReady(a.charAt(0).toUpperCase());
        var p = resolvePath(a);
        if (!FS.isDir(p)) { print('Invalid directory\n'); return; }
        cwd = FS.realPath(p);
      },
      dir: function (a) {
        var flags = (a || '').match(/\/\w/g) || [];
        a = (a || '').replace(/\/\w/g, '').trim();
        if (/^[abd]:/i.test(a)) return notReady(a.charAt(0).toUpperCase());
        var p = resolvePath(a), pattern = null;
        if (!FS.isDir(p)) {
          if (/[*?]/.test(FS.basename(p)) && FS.isDir(FS.dirname(p))) {
            pattern = new RegExp('^' + FS.basename(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
            p = FS.dirname(p);
          } else { print('File not found\n'); return; }
        }
        var wide = flags.some(function (f) { return /\/w/i.test(f); });
        var list = FS.list(p).filter(function (e) { return !pattern || pattern.test(e.name); });
        print('\n Volume in drive C is PRESARIO\n Volume Serial Number is 2A1F-0E73\n Directory of ' + FS.realPath(p) + '\n\n');
        var files = 0, dirs = 0, bytes = 0, lines = [];
        if (!/^c:\\?$/i.test(p) && !pattern) {
          lines.push(wide ? '[.]' : '.              <DIR>        ' + dosDate(Date.now()) + ' .');
          lines.push(wide ? '[..]' : '..             <DIR>        ' + dosDate(Date.now()) + ' ..');
          dirs += 2;
        }
        list.forEach(function (e) {
          var isDir = e.node.t === 'd', size = FS.sizeOf(e.node);
          if (isDir) dirs++; else { files++; bytes += size; }
          if (wide) { lines.push(isDir ? '[' + e.name.toUpperCase().slice(0, 12) + ']' : e.name.toUpperCase().slice(0, 12)); return; }
          lines.push(dosName(e.name) + (isDir ? '    <DIR>       ' : String(num(size)).padStart(14) + '  ') + ' ' + dosDate(e.node.m) + ' ' + e.name);
        });
        if (wide) {
          var row = '';
          lines.forEach(function (l, i) { row += (l + '                ').slice(0, 16); if (i % 5 === 4) { print(row + '\n'); row = ''; } });
          if (row) print(row + '\n');
        } else print(lines.join('\n') + (lines.length ? '\n' : ''));
        print(String(files).padStart(9) + ' file(s)' + String(num(bytes)).padStart(15) + ' bytes\n' +
          String(dirs).padStart(9) + ' dir(s)  ' + String(num(FS.freeSpace())).padStart(15) + ' bytes free\n\n');
      },
      type: function (a) {
        if (!a) { print('Required parameter missing\n'); return; }
        var p = resolvePath(a), n = FS.stat(p);
        if (!n || n.t !== 'f') { print('File not found - ' + a.toUpperCase() + '\n'); return; }
        if (n.bin) { print('\u263a\u2665\u2666MZ\u00ea\u0001\u0004\u0000\u00ff\u00ffThis program cannot be run in DOS mode.\u00a7\u00b6\n'); return; }
        print(n.d.replace(/\r\n/g, '\n') + (n.d.slice(-1) === '\n' ? '' : '\n'));
      },
      md: function (a) {
        if (!a) { print('Required parameter missing\n'); return; }
        try { FS.mkdir(resolvePath(a)); } catch (err) { print('Unable to create directory\n'); }
      },
      rd: function (a) {
        var p = resolvePath(a), n = FS.stat(p);
        if (!n || n.t !== 'd') { print('Invalid path, not directory,\nor directory not empty\n'); return; }
        if (Object.keys(n.c).length) { print('Invalid path, not directory,\nor directory not empty\n'); return; }
        try { FS.remove(p); } catch (err) { print('Access denied\n'); }
      },
      del: function (a) {
        if (!a) { print('Required parameter missing\n'); return; }
        var p = resolvePath(a), n = FS.stat(p);
        if (!n || n.t !== 'f') { print('File not found\n'); return; }
        try { FS.remove(p); } catch (err) { print('Access denied\n'); }
      },
      ren: function (a) {
        var parts = args(a);
        if (parts.length < 2) { print('Required parameter missing\n'); return; }
        try { FS.rename(resolvePath(parts[0]), parts[1]); } catch (err) { print(err.message === 'FILENOTFOUND' ? 'File not found\n' : 'Duplicate file name or file not found\n'); }
      },
      copy: function (a) {
        var parts = args(a);
        if (parts.length < 2) { print('Required parameter missing\n'); return; }
        var src = resolvePath(parts[0]), n = FS.stat(src);
        if (!n || n.t !== 'f' || n.bin) { print('File not found - ' + parts[0] + '\n'); return; }
        var dst = resolvePath(parts[1]);
        if (FS.isDir(dst)) dst = FS.join(dst, FS.basename(src));
        try { FS.write(dst, n.d); print('        1 file(s) copied\n'); } catch (err) { print('Access denied\n'); }
      },
      edit: function (a) { Shell.launch('notepad', a ? resolvePath(a) : undefined); },
      format: function (a) {
        if (/^c:?/i.test(a || '')) { print('\nWARNING, ALL DATA ON NON-REMOVABLE DISK\nDRIVE C: WILL BE LOST!\n'); return ask('Proceed with Format (Y/N)?', ['y', 'n']).then(function (k) { print(k === 'y' ? '\nNice try. Use Compaq QuickRestore in the Control Panel instead.\n\n' : '\n'); }); }
        return notReady('A');
      },
      deltree: function () { print('Deltree is too dangerous for a museum piece. Try DEL.\n'); },
      scandisk: function () { print('\nMicrosoft ScanDisk\n\n  Media descriptor .... OK\n  File allocation tables .... OK\n  Directory structure .... OK\n  File system .... OK\n\nScanDisk did not find any problems on drive C.\n\n'); },
      exit: function () {
        if (full) return COMMANDS.win();
        win.close();
      },
      win: function () {
        if (!full) { print('You are already running Windows.\n'); return; }
        full.remove();
        Boot.shutdown('restart');
      },
      notepad: function (a) { Shell.launch('notepad', a ? resolvePath(a) : undefined); },
      doom: function () { if (full) { print('DOOM requires Windows in this edition. Type WIN.\n'); return; } Shell.launch('doom'); },
      aol: function () { if (full) { print('This program requires Microsoft Windows.\n'); return; } Shell.launch('aol'); },
      winmine: function () { if (full) { print('This program requires Microsoft Windows.\n'); return; } Shell.launch('minesweeper'); },
      explorer: function () { if (full) { print('This program requires Microsoft Windows.\n'); return; } Shell.launch('explorer', cwd); },
      start: function (a) { if (full) { print('Bad command or file name\n'); return; } if (a) Shell.run(a); }
    };
    COMMANDS.chdir = COMMANDS.cd; COMMANDS.mkdir = COMMANDS.md; COMMANDS.rmdir = COMMANDS.rd;
    COMMANDS.erase = COMMANDS.del; COMMANDS.rename = COMMANDS.ren; COMMANDS['cd..'] = function () { return COMMANDS.cd('..'); };
    COMMANDS['cd\\'] = function () { return COMMANDS.cd('\\'); };
    COMMANDS.iexplore = function () { Shell.launch('ie'); };

    function exec(line) {
      line = line.trim();
      if (!line) return;
      if (window.BSOD && BSOD.command(line, { victim: win })) return;   // CON\CON: the classic Win9x crash
      if (/^[a-z]:$/i.test(line)) {
        var L = line.charAt(0).toUpperCase();
        if (L === 'C') { cwd = 'C:\\'; return; }
        if (L === 'A' || L === 'D') return notReady(L);
        print('Invalid drive specification\n');
        return;
      }
      var m = /^([^\s\\/.]+(?:\.\w+)?|cd\.\.|cd\\)\s*(.*)$/i.exec(line);
      var cmd = (m ? m[1] : line).toLowerCase().replace(/\.(exe|com|bat)$/, ''), arg = m ? m[2].trim() : '';
      if (COMMANDS[cmd]) return COMMANDS[cmd](arg);
      // A path to something runnable?
      var p = resolvePath(line.split(/\s+/)[0]), n = FS.stat(p) || FS.stat(p + '.exe') || FS.stat(p + '.com');
      if (n && n.app && !full) { Shell.launch(n.app); return; }
      if (n && /\.bat$/i.test(p)) { print(n.d.replace(/\r\n/g, '\n').split('\n').filter(function (l) { return /^echo /i.test(l); }).map(function (l) { return l.slice(5); }).join('\n') + '\n'); return; }
      print('Bad command or file name\n');
    }

    focus();
    return win;
  }

  Shell.register('msdos', { name: 'MS-DOS Prompt', icon: 'msdos', launch: launch });
})();
