/*
 * Common dialogs: the Windows 98 Open / Save As file picker and a few helpers.
 *   Dialogs.file({ mode: 'open'|'save', owner, dir, name, types }) -> Promise<path | null>
 */
(function () {
  var h = U.h;

  var TYPES = [
    { label: 'Text Documents (*.txt)', ext: 'txt' },
    { label: 'All Files (*.*)', ext: '*' }
  ];

  function file(o) {
    o = Object.assign({ mode: 'open', dir: 'C:\\My Documents', name: '', types: TYPES }, o);
    var save = o.mode === 'save';
    var cwd = FS.isDir(o.dir) ? FS.realPath(o.dir) : 'C:\\My Documents';
    var type = o.types[0];
    var selectedName = null;

    return new Promise(function (resolve) {
      var result = null;
      var lookIn = h('select', { className: 'field look-in' });
      var upBtn = h('button', { className: 'btn icon-btn', title: 'Up One Level' }, U.img('folder-up', 16));
      var newBtn = h('button', { className: 'btn icon-btn', title: 'Create New Folder' }, U.img('folder', 16));
      var list = h('div', { className: 'icon-view list file-list', tabindex: '0' });
      var nameInput = h('input', { type: 'text', className: 'field', value: o.name, spellcheck: 'false' });
      var typeSel = h('select', { className: 'field' }, o.types.map(function (t) { return h('option', null, t.label); }));
      var okBtn = h('button', { className: 'btn default' }, save ? '&Save'.replace('&', '') : 'Open');
      okBtn.innerHTML = ''; okBtn.appendChild(U.label(save ? '&Save' : '&Open'));
      var cancelBtn = h('button', { className: 'btn' }, 'Cancel');

      var content = h('div', { className: 'file-dialog' }, [
        h('div', { className: 'fd-top' }, [h('label', null, U.label(save ? 'Save &in:' : 'Look &in:')), lookIn, upBtn, newBtn]),
        list,
        h('div', { className: 'fd-grid' }, [
          h('label', null, U.label('File &name:')), nameInput, okBtn,
          h('label', null, U.label(save ? 'Save as &type:' : 'Files of &type:')), typeSel, cancelBtn
        ])
      ]);

      var win = WM.dialog({ title: o.title || (save ? 'Save As' : 'Open'), owner: o.owner, content: content, width: 430, helpButton: true });

      function fillLookIn() {
        lookIn.innerHTML = '';
        var parts = cwd.split('\\').filter(Boolean);
        var opts = [
          { label: 'Desktop', path: 'C:\\WINDOWS\\Desktop', depth: 0 },
          { label: 'My Computer', path: null, depth: 1 },
          { label: '3\u00bd Floppy (A:)', path: 'A:', depth: 2 }
        ];
        parts.forEach(function (p, i) {
          opts.push({ label: i === 0 ? '(C:)' : p, path: parts.slice(0, i + 1).join('\\') + (i === 0 ? '\\' : ''), depth: 2 + i });
        });
        if (parts.length === 1 || parts[0] !== 'C:') opts.push({ label: '(C:)', path: 'C:\\', depth: 2 });
        opts.push({ label: '(D:)', path: 'D:', depth: 2 });
        opts.push({ label: 'My Documents', path: 'C:\\My Documents', depth: 1 });
        opts.forEach(function (op) {
          var el = h('option', { value: op.path || '' }, '\u00a0'.repeat(op.depth * 3) + op.label);
          if (op.path && op.path.toLowerCase() === cwd.toLowerCase()) el.selected = true;
          lookIn.appendChild(el);
        });
      }

      function refresh() {
        fillLookIn();
        list.innerHTML = '';
        var entries = FS.list(cwd) || [];
        entries.forEach(function (e) {
          if (e.node.t !== 'd' && type.ext !== '*' && FS.ext(e.name) !== type.ext) return;
          var item = h('div', { className: 'item', dataset: { name: e.name } }, [
            U.img(Shell.iconFor(e.name, e.node), 16), h('span', { className: 'label' }, Shell.displayName(e.name, e.node))
          ]);
          item.addEventListener('pointerdown', function () {
            list.querySelectorAll('.item.selected').forEach(function (n) { n.classList.remove('selected'); });
            item.classList.add('selected');
            selectedName = e.name;
            if (e.node.t !== 'd') nameInput.value = e.name;
          });
          U.onActivate(item, function () {
            if (e.node.t === 'd') { cwd = e.path; refresh(); }
            else { nameInput.value = e.name; accept(); }
          });
          list.appendChild(item);
        });
        upBtn.disabled = cwd.split('\\').filter(Boolean).length <= 1;
      }

      function notReady(drive) {
        var floppy = drive.charAt(0).toUpperCase() === 'A';
        U.sound(floppy ? 'floppyRead' : 'hddSeek', 1500);
        return U.wait(floppy ? 1500 : 600).then(function () {
          return WM.msgbox({ title: 'Open', owner: win, icon: 'error', buttons: ['&Retry', 'Cancel'],
            text: drive.charAt(0).toUpperCase() + ':\\ is not accessible.\n\nThe device is not ready.' });
        });
      }

      lookIn.addEventListener('change', function () {
        var v = lookIn.value;
        if (!v) { refresh(); return; }
        if (/^[AD]:/i.test(v)) { notReady(v).then(refresh); return; }
        cwd = FS.realPath(v) || cwd;
        refresh();
      });
      upBtn.addEventListener('click', function () {
        var p = FS.dirname(cwd);
        if (p) { cwd = p; refresh(); }
      });
      newBtn.addEventListener('click', function () {
        try { FS.mkdir(FS.join(cwd, FS.uniqueName(cwd, 'New Folder'))); refresh(); }
        catch (err) { WM.msgbox({ title: 'Error', owner: win, icon: 'error', text: FS.errorText(err) }); }
      });
      typeSel.addEventListener('change', function () { type = o.types[typeSel.selectedIndex]; refresh(); });

      function accept() {
        var name = nameInput.value.trim();
        // "*.txt" and friends are filters, as in the real dialog.
        if (/[*?]/.test(name)) { nameInput.select(); return; }
        if (!name) {
          if (selectedName && FS.isDir(FS.join(cwd, selectedName))) { cwd = FS.join(cwd, selectedName); refresh(); }
          return;
        }
        // Typed a folder or a full path?
        var target = /^[a-z]:/i.test(name) ? name : FS.join(cwd, name);
        if (/^[ABD]:/i.test(target) && !/^c:/i.test(target)) { notReady(target); return; }
        if (FS.isDir(target)) { cwd = FS.realPath(target); nameInput.value = ''; refresh(); return; }
        if (!FS.validName(FS.basename(target))) {
          WM.msgbox({ title: save ? 'Save As' : 'Open', owner: win, icon: 'warning', text: 'The above file name is invalid.' });
          return;
        }
        if (save) {
          if (!/\.[^.\\]+$/.test(FS.basename(target)) && type.ext !== '*') target += '.' + type.ext;
          if (!FS.isDir(FS.dirname(target))) {
            WM.msgbox({ title: 'Save As', owner: win, icon: 'warning', text: FS.basename(target) + '\nPath does not exist.\nPlease verify the correct path was given.' });
            return;
          }
          if (FS.exists(target)) {
            WM.msgbox({ title: 'Save As', owner: win, icon: 'warning', buttons: ['&Yes', '&No'],
              text: FS.basename(target) + ' already exists.\nDo you want to replace it?' }).then(function (b) {
              if (b === '&Yes') { result = FS.realPath(target); win.close(true); }
            });
            return;
          }
          result = target;
          win.close(true);
        } else {
          if (!FS.exists(target)) {
            WM.msgbox({ title: 'Open', owner: win, icon: 'warning', text: FS.basename(target) + '\nFile not found.\nPlease verify the correct file name was given.' });
            return;
          }
          result = FS.realPath(target);
          win.close(true);
        }
      }

      okBtn.addEventListener('click', accept);
      cancelBtn.addEventListener('click', function () { win.close(true); });
      nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); accept(); } });
      win.onKey = function (e) {
        if (e.key === 'Escape') { win.close(true); return true; }
        if (e.key === 'Enter' && document.activeElement !== nameInput) { accept(); return true; }
        return false;
      };
      win.on('close', function () { resolve(result); });
      refresh();
      win.center();
      setTimeout(function () { nameInput.focus(); nameInput.select(); }, 0);
    });
  }

  window.Dialogs = { file: file };
})();
