/*
 * The file clipboard behind Cut / Copy / Paste on the desktop and in Explorer.
 *
 *   FileClip.set('cut' | 'copy', [paths])   put files on the clipboard
 *   FileClip.has()                          anything to paste?
 *   FileClip.isCut(path)                    should this icon be drawn faded?
 *   FileClip.paste(folderPath, owner)       paste into a folder; returns the new names
 *   FileClip.onChange(fn) -> unsubscribe    re-render when the clipboard changes
 */
(function () {
  var mode = null, paths = [], listeners = [];

  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  var FileClip = {
    set: function (m, list) {
      // System files can be copied but never moved.
      list = (list || []).filter(function (p) { var n = FS.stat(p); return n && (m === 'copy' || !n.sys); });
      if (!list.length) return false;
      mode = m; paths = list.slice();
      emit();
      return true;
    },
    has: function () { return !!mode && paths.some(function (p) { return FS.exists(p); }); },
    mode: function () { return mode; },
    isCut: function (path) {
      return mode === 'cut' && paths.some(function (p) { return p.toLowerCase() === String(path).toLowerCase(); });
    },
    clear: function () { if (!mode) return; mode = null; paths = []; emit(); },

    paste: function (folder, owner) {
      if (!FileClip.has()) return [];
      var made = [], cut = mode === 'cut';
      paths.slice().forEach(function (p) {
        if (!FS.exists(p)) return;
        try { made.push(cut ? FS.move(p, folder) : FS.copy(p, folder)); }
        catch (err) { WM.msgbox({ title: 'Error Copying File', owner: owner, icon: 'error', text: FS.errorText(err, p) }); }
      });
      if (cut) { mode = null; paths = []; emit(); }
      if (made.length) {
        U.sound('hddSeek', 250);
        if (window.Achievements) Achievements.unlock('clipboard');
      }
      return made;
    },

    onChange: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    }
  };

  window.FileClip = FileClip;
})();
