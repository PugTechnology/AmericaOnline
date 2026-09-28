/*
 * The virtual C: drive. A small tree of folders and files persisted to localStorage.
 *
 * Nodes:  folder { t: 'd', c: { name: node }, m }
 *         file   { t: 'f', d: text, m, size?, app?, bin?, sys? }
 *   app  - id of a program this file launches (EXEs, shortcuts)
 *   bin  - binary file with no viewable text (size is faked via `size`)
 *   sys  - read-only system file
 * Paths are Windows style ("C:\My Documents\notes.txt") and case-insensitive.
 */
(function () {
  var KEY = 'w98.cdrive.v1';
  var DISK_TOTAL = 2111864832;        // a 2.1 GB Quantum Fireball
  var DISK_BASE_USED = 732 * 1048576; // Windows, Office and friends
  var listeners = [];
  var root;

  var now = function () { return Date.now(); };
  var y98 = new Date(1998, 5, 25, 20, 1).getTime(); // Windows 98 RTM

  function file(text, extra) {
    var n = { t: 'f', d: text || '', m: y98 };
    if (extra) for (var k in extra) n[k] = extra[k];
    return n;
  }
  function bin(size, extra) { return file('', Object.assign({ bin: true, size: size }, extra || {})); }
  function dir(children) { return { t: 'd', c: children || {}, m: y98 }; }

  function seed() {
    return dir({
      'C:': dir({
        'AUTOEXEC.BAT': file('@ECHO OFF\r\nSET BLASTER=A220 I5 D1 H5 P330 T6\r\nSET SOUND=C:\\PROGRA~1\\CREATIVE\\CTSND\r\nSET PATH=C:\\WINDOWS;C:\\WINDOWS\\COMMAND\r\nLH C:\\WINDOWS\\COMMAND\\MSCDEX.EXE /D:MSCD001\r\nPROMPT $p$g\r\n', { sys: true }),
        'CONFIG.SYS': file('DEVICE=C:\\WINDOWS\\HIMEM.SYS\r\nDEVICE=C:\\WINDOWS\\EMM386.EXE NOEMS\r\nDOS=HIGH,UMB\r\nDEVICEHIGH=C:\\CDROM\\OAKCDROM.SYS /D:MSCD001\r\nFILES=40\r\nBUFFERS=30\r\n', { sys: true }),
        'COMMAND.COM': bin(93890, { app: 'msdos', sys: true }),
        'IO.SYS': bin(222390, { sys: true, hidden: true }),
        'MSDOS.SYS': file('[Paths]\r\nWinDir=C:\\WINDOWS\r\nWinBootDir=C:\\WINDOWS\r\nHostWinBootDrv=C\r\n\r\n[Options]\r\nBootMulti=1\r\nBootGUI=1\r\nDoubleBuffer=1\r\nAutoScan=1\r\nWinVer=4.10.1998\r\n', { sys: true, hidden: true }),
        'SCANDISK.LOG': file('Microsoft ScanDisk\r\n\r\nScanDisk checked drive C for problems, with the following results:\r\n\r\n  Directory structure    No problems found.\r\n  File allocation table  No problems found.\r\n  File system            No problems found.\r\n  Surface scan           Not performed.\r\n'),
        'My Documents': dir({
          'Welcome.txt': file(
            'Welcome to your very own Compaq Presario!\r\n\r\n' +
            'This computer is running Windows 98. Everything you save here is\r\n' +
            'stored on drive C:, which lives inside your web browser. Close the\r\n' +
            'page, come back tomorrow, and your files will still be here.\r\n\r\n' +
            'Things to try:\r\n' +
            '  - Double-click "America Online" and listen to that modem sing.\r\n' +
            '  - Start > Programs > Accessories > Notepad, write something, and\r\n' +
            '    File > Save it into My Documents.\r\n' +
            '  - Start > Programs > id Software > DOOM. Rip and tear.\r\n' +
            '  - Start > Programs > MS-DOS Prompt, then type DIR.\r\n' +
            '  - Minesweeper is under Accessories > Games.\r\n\r\n' +
            'When you are done, use Start > Shut Down like a responsible adult.\r\n')
        }),
        'Program Files': dir({
          'America Online 4.0': dir({
            'AOL.EXE': bin(1531904, { app: 'aol' }),
            'README.TXT': file('America Online for Windows 95/98, version 4.0\r\n\r\nTo sign on, double-click the America Online icon on your desktop,\r\nselect your screen name and click SIGN ON. First time? Choose "Guest"\r\nor "New User".\r\n\r\nUse Keywords to get around: press Ctrl+K or type a word into the\r\nkeyword box on the navigation bar and click Go.\r\n')
          }),
          'Internet Explorer': dir({ 'IEXPLORE.EXE': bin(72976, { app: 'ie' }) }),
          'Accessories': dir({ 'WORDPAD.EXE': bin(204800) })
        }),
        'DOOM': dir({
          'DOOM.EXE': bin(715493, { app: 'doom' }),
          'DOOM1.WAD': bin(4196020),
          'SETUP.EXE': bin(90044),
          'DEFAULT.CFG': file('mouse_sensitivity 5\r\nsfx_volume 8\r\nmusic_volume 8\r\nshow_messages 1\r\nkey_right 77\r\nkey_left 75\r\nkey_up 72\r\nkey_down 80\r\nkey_strafeleft 51\r\nkey_straferight 52\r\nkey_fire 29\r\nkey_use 57\r\nkey_strafe 56\r\nkey_speed 54\r\nscreenblocks 10\r\n'),
          'README.TXT': file(
            'DOOM Shareware v1.9\r\n' +
            '===================\r\n\r\n' +
            'Episode 1: Knee-Deep in the Dead.\r\n\r\n' +
            'CONTROLS\r\n' +
            '  Arrow keys ....... move / turn\r\n' +
            '  Ctrl ............. fire\r\n' +
            '  Space ............ open doors, flip switches\r\n' +
            '  Shift ............ run\r\n' +
            '  Alt + arrows ..... strafe  (or  ,  and  .)\r\n' +
            '  1-7 .............. choose weapon\r\n' +
            '  Tab .............. automap\r\n' +
            '  Esc .............. menu (save and load games here)\r\n\r\n' +
            'Saved games are kept on this computer between visits.\r\n')
        }),
        'WINDOWS': dir({
          'Desktop': dir({
            'America Online.lnk': file('', { app: 'aol', lnk: true }),
            'DOOM.lnk': file('', { app: 'doom', lnk: true })
          }),
          'COMMAND': dir({
            'MSCDEX.EXE': bin(25473, { sys: true }),
            'DELTREE.EXE': bin(19415, { sys: true }),
            'EDIT.COM': bin(69886, { app: 'notepad', sys: true }),
            'XCOPY.EXE': bin(3878, { sys: true })
          }),
          'SYSTEM': dir({
            'KRNL386.EXE': bin(75490, { sys: true }),
            'USER.EXE': bin(264016, { sys: true }),
            'GDI.EXE': bin(144960, { sys: true }),
            'VMM32.VXD': bin(1024853, { sys: true })
          }),
          'NOTEPAD.EXE': bin(53248, { app: 'notepad' }),
          'EXPLORER.EXE': bin(241664, { app: 'explorer' }),
          'WINMINE.EXE': bin(24064, { app: 'minesweeper' }),
          'PINBALL.EXE': bin(281088, { app: 'pinball' }),
          'COMMAND.COM': bin(93890, { app: 'msdos' }),
          'WIN.INI': file('; for 16-bit app support\r\n[windows]\r\nload=\r\nrun=\r\nNullPort=None\r\n\r\n[Desktop]\r\nWallpaper=(None)\r\nTileWallpaper=0\r\n\r\n[fonts]\r\n[extensions]\r\ntxt=notepad.exe ^.txt\r\nini=notepad.exe ^.ini\r\n\r\n[mci extensions]\r\n[Sounds]\r\nSystemStart=The Microsoft Sound.wav\r\n', { sys: true }),
          'SYSTEM.INI': file('[boot]\r\nshell=Explorer.exe\r\nsystem.drv=system.drv\r\ndrivers=mmsystem.dll power.drv\r\nuser.exe=user.exe\r\ngdi.exe=gdi.exe\r\nsound.drv=mmsound.drv\r\n\r\n[386Enh]\r\nebios=*ebios\r\nwoafont=dosapp.fon\r\n\r\n[drivers]\r\nwave=mmdrv.dll\r\ntimer=timer.drv\r\n', { sys: true }),
          'SETUPLOG.TXT': file('[Setup]\r\nInstallType=3\r\nCustomise=0\r\nOEM=COMPAQ\r\nProduct=Windows 98\r\nVersion=4.10.1998\r\n')
        }),
        'RECYCLED': Object.assign(dir({}), { hidden: true, sys: true })
      })
    });
  }

  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw) {
        var t = JSON.parse(raw);
        if (t && t.t === 'd' && t.c && typeof t.c === 'object') { root = t; lastGood = raw; return; }
        throw new Error('BADDRIVE');
      }
    } catch (e) {
      // Unparseable or wrong shape: keep the bad blob aside and start over.
      if (raw) {
        try { localStorage.setItem(KEY + '.corrupt', raw); } catch (e2) { /* full */ }
        FS.repaired = true;
      }
    }
    root = seed();
    try { lastGood = JSON.stringify(root); } catch (e) { lastGood = null; }
    if (FS.repaired) persist();
  }

  function persist() {
    try {
      var str = JSON.stringify(root);
      localStorage.setItem(KEY, str);
      lastGood = str;
      return true;
    } catch (e) {
      return false;
    }
  }
  // If saving fails (storage full) the tree is rolled back to the last string that
  // was saved, so the screen never shows a change that wasn't saved.
  var lastGood = null;
  function changed(path) {
    var ok = persist();
    if (!ok && lastGood) root = JSON.parse(lastGood);
    listeners.forEach(function (fn) { try { fn(path); } catch (e) { console.error(e); } });
    if (!ok) throw new Error('DISKFULL');
  }

  // ---- path helpers ----
  function split(path) {
    return String(path).replace(/\//g, '\\').split('\\').filter(function (p) { return p.length; });
  }
  function join() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) parts = parts.concat(split(arguments[i]));
    if (parts.length === 1) return parts[0] + '\\';
    return parts.join('\\');
  }
  function normalize(path) { return join(path); }
  function dirname(path) {
    var p = split(path); p.pop();
    return p.length ? join.apply(null, p) : '';
  }
  function basename(path) { var p = split(path); return p[p.length - 1] || ''; }
  function ext(name) { var m = /\.([^.\\]+)$/.exec(name); return m ? m[1].toLowerCase() : ''; }

  function childKey(folder, name) {
    var lower = name.toLowerCase();
    for (var k in folder.c) if (k.toLowerCase() === lower) return k;
    return null;
  }
  function resolve(path) {
    var parts = split(path), node = root;
    for (var i = 0; i < parts.length; i++) {
      if (!node || node.t !== 'd') return null;
      var k = childKey(node, parts[i]);
      if (k === null) return null;
      node = node.c[k];
    }
    return node;
  }
  // Canonical casing for a path that exists.
  function realPath(path) {
    var parts = split(path), node = root, out = [];
    for (var i = 0; i < parts.length; i++) {
      var k = childKey(node, parts[i]);
      if (k === null) return null;
      out.push(k); node = node.c[k];
    }
    return join.apply(null, out);
  }

  function validName(name) {
    return !!name && !/[\\/:*?"<>|]/.test(name) && name.trim().length > 0;
  }

  function parentOf(path) {
    var p = resolve(dirname(path));
    if (!p || p.t !== 'd') throw new Error('PATHNOTFOUND');
    return p;
  }

  // ---- public API ----
  var FS = {
    DISK_TOTAL: DISK_TOTAL,
    join: join, dirname: dirname, basename: basename, ext: ext, normalize: normalize, realPath: realPath,
    validName: validName,

    exists: function (path) { return !!resolve(path); },
    stat: function (path) { return resolve(path); },
    isDir: function (path) { var n = resolve(path); return !!n && n.t === 'd'; },

    list: function (path, opts) {
      var node = resolve(path);
      if (!node || node.t !== 'd') return null;
      var base = realPath(path);
      var out = Object.keys(node.c).map(function (name) {
        return { name: name, path: join(base, name), node: node.c[name] };
      }).filter(function (e) { return (opts && opts.hidden) || !e.node.hidden; });
      out.sort(function (a, b) {
        if (a.node.t !== b.node.t) return a.node.t === 'd' ? -1 : 1;
        return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
      });
      return out;
    },

    read: function (path) {
      var n = resolve(path);
      if (!n || n.t !== 'f') throw new Error('FILENOTFOUND');
      return n.d;
    },

    write: function (path, text) {
      var parent = parentOf(path), name = basename(path);
      if (!validName(name)) throw new Error('BADNAME');
      var k = childKey(parent, name);
      if (k !== null && parent.c[k].t === 'd') throw new Error('ISDIR');
      if (k !== null && parent.c[k].sys) throw new Error('READONLY');
      var key = k !== null ? k : name;
      parent.c[key] = file(text);
      parent.c[key].m = now();
      parent.m = now();
      changed(join(dirname(path), key));
    },

    mkdir: function (path) {
      var parent = parentOf(path), name = basename(path);
      if (!validName(name)) throw new Error('BADNAME');
      if (childKey(parent, name) !== null) throw new Error('EXISTS');
      parent.c[name] = dir({});
      parent.c[name].m = now();
      changed(path);
    },

    rename: function (path, newName) {
      var parent = parentOf(path), k = childKey(parent, basename(path));
      if (k === null) throw new Error('FILENOTFOUND');
      if (!validName(newName)) throw new Error('BADNAME');
      var clash = childKey(parent, newName);
      if (clash !== null && clash !== k) throw new Error('EXISTS');
      if (parent.c[k].sys) throw new Error('READONLY');
      var node = parent.c[k];
      delete parent.c[k];
      parent.c[newName] = node;
      changed(join(dirname(path), newName));
    },

    remove: function (path) {
      var parent = parentOf(path), k = childKey(parent, basename(path));
      if (k === null) throw new Error('FILENOTFOUND');
      if (parent.c[k].sys) throw new Error('READONLY');
      delete parent.c[k];
      changed(path);
    },

    // Move into C:\RECYCLED, remembering where it came from.
    recycle: function (path) {
      var parent = parentOf(path), k = childKey(parent, basename(path));
      if (k === null) throw new Error('FILENOTFOUND');
      if (parent.c[k].sys) throw new Error('READONLY');
      var bin = resolve('C:\\RECYCLED');
      if (!bin) { resolve('C:').c.RECYCLED = dir({}); bin = resolve('C:\\RECYCLED'); }
      var node = parent.c[k];
      node.orig = realPath(dirname(path));
      node.deleted = now();
      var name = k, i = 1;
      while (childKey(bin, name) !== null) name = k.replace(/(\.[^.]*)?$/, ' (' + (++i) + ')$1');
      delete parent.c[k];
      bin.c[name] = node;
      changed(path);
    },

    restore: function (binName) {
      var bin = resolve('C:\\RECYCLED'), k = childKey(bin, binName);
      if (k === null) return;
      var node = bin.c[k], dest = resolve(node.orig || 'C:\\My Documents');
      if (!dest || dest.t !== 'd') dest = resolve('C:\\My Documents');
      if (!dest || dest.t !== 'd') dest = resolve('C:');
      var name = k;
      while (childKey(dest, name) !== null) name = 'Copy of ' + name;
      delete node.orig; delete node.deleted;
      delete bin.c[k];
      dest.c[name] = node;
      changed(binName);
    },

    emptyRecycleBin: function () {
      var bin = resolve('C:\\RECYCLED');
      if (bin) { bin.c = {}; changed('C:\\RECYCLED'); }
    },

    sizeOf: function (node) {
      if (!node) return 0;
      if (node.t === 'f') return node.size != null ? node.size : new Blob([node.d]).size;
      var s = 0;
      for (var k in node.c) s += FS.sizeOf(node.c[k]);
      return s;
    },
    freeSpace: function () { return Math.max(0, DISK_TOTAL - DISK_BASE_USED - FS.sizeOf(root)); },

    // Unique "New Folder", "New Text Document.txt" style names.
    uniqueName: function (folderPath, base, extension) {
      var name = base + (extension || ''), i = 1;
      while (FS.exists(join(folderPath, name))) name = base + ' (' + (++i) + ')' + (extension || '');
      return name;
    },

    onChange: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },

    reset: function () { root = seed(); changed('C:\\'); },

    formatSize: function (bytes) {
      if (bytes < 1024) return bytes + ' bytes';
      if (bytes < 1048576) return Math.max(1, Math.round(bytes / 1024)) + 'KB';
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(bytes < 10485760 ? 2 : 1) + 'MB';
      return (bytes / 1073741824).toFixed(2) + 'GB';
    },

    errorText: function (err, path) {
      switch (err && err.message) {
        case 'DISKFULL': return 'There is not enough free disk space on drive C:.\n\nDelete some files you no longer need, and then try again.';
        case 'BADNAME': return 'A filename cannot contain any of the following characters:\n\\ / : * ? " < > |';
        case 'EXISTS': return 'Cannot rename ' + basename(path || '') + ': A file with the name you specified already exists. Specify a different filename.';
        case 'READONLY': return 'Access is denied.\n\nMake sure the disk is not full or write-protected and that the file is not currently in use.';
        case 'PATHNOTFOUND': return 'The folder ' + dirname(path || '') + ' does not exist.';
        default: return (path ? path + '\n' : '') + 'The file could not be accessed.';
      }
    }
  };

  // When the disk is too full even to move a file to the Recycle Bin, delete it outright.
  var recycle = FS.recycle;
  FS.recycle = function (path) {
    try { return recycle(path); }
    catch (e) { if (e.message === 'DISKFULL') return FS.remove(path); throw e; }
  };

  load();
  window.FS = FS;
})();
