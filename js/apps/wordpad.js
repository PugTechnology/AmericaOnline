/*
 * WordPad, Windows 98 edition. A contenteditable page with a toolbar and a
 * format bar. .doc/.rtf/.wri files on C: hold sanitized HTML; .txt opens as text.
 */
(function () {
  var h = U.h;

  var FONTS = ['Arial', 'Courier New', 'Times New Roman', 'Comic Sans MS', 'Verdana', 'Tahoma'];
  var SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  var COLORS = [['Black', '#000000'], ['Maroon', '#800000'], ['Green', '#008000'], ['Olive', '#808000'], ['Navy', '#000080'], ['Purple', '#800080'], ['Teal', '#008080'], ['Gray', '#808080'],
    ['Silver', '#c0c0c0'], ['Red', '#ff0000'], ['Lime', '#00ff00'], ['Yellow', '#ffff00'], ['Blue', '#0000ff'], ['Fuchsia', '#ff00ff'], ['Aqua', '#00ffff'], ['White', '#ffffff']];
  var TYPES = [
    { label: 'Word for Windows 6.0 (*.doc)', ext: 'doc' },
    { label: 'Rich Text Format (*.rtf)', ext: 'rtf' },
    { label: 'Text Documents (*.txt)', ext: 'txt' },
    { label: 'All Documents (*.*)', ext: '*' }
  ];

  // ---- HTML sanitizer ------------------------------------------------------
  // Only basic formatting survives: everything else is unwrapped, and script-like
  // elements are dropped with their contents.
  var ALLOWED = { B: 1, I: 1, U: 1, STRONG: 1, EM: 1, S: 1, STRIKE: 1, BR: 1, P: 1, DIV: 1, SPAN: 1, FONT: 1, UL: 1, OL: 1, LI: 1, H1: 1, H2: 1, H3: 1, SUB: 1, SUP: 1, CENTER: 1 };
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, TITLE: 1, HEAD: 1, FRAME: 1, FRAMESET: 1, APPLET: 1, TEMPLATE: 1, NOSCRIPT: 1, SVG: 1, MATH: 1 };
  var STYLE_OK = { 'color': 1, 'background-color': 1, 'font-family': 1, 'font-size': 1, 'font-weight': 1, 'font-style': 1, 'text-decoration': 1, 'text-align': 1 };

  function cleanStyle(text) {
    return String(text).split(';').map(function (d) {
      var i = d.indexOf(':');
      if (i < 0) return '';
      var prop = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim();
      if (!STYLE_OK[prop] || /url\s*\(|expression|javascript|[<>\\@]/i.test(v)) return '';
      return prop + ':' + v;
    }).filter(Boolean).join(';');
  }

  function sanitizeNode(src, out) {
    Array.prototype.forEach.call(src.childNodes, function (n) {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toUpperCase();
      if (DROP[tag]) return;
      if (!ALLOWED[tag]) { sanitizeNode(n, out); return; }   // unknown tag: keep its text
      var el = document.createElement(tag.toLowerCase());
      Array.prototype.forEach.call(n.attributes, function (a) {
        var an = a.name.toLowerCase(), v = a.value;
        if (an.slice(0, 2) === 'on' || /javascript:|vbscript:|data:/i.test(v)) return;
        if (an === 'style') { var s = cleanStyle(v); if (s) el.setAttribute('style', s); }
        else if (an === 'color' && /^#?[0-9a-z]+$/i.test(v)) el.setAttribute('color', v);
        else if (an === 'face' && !/[<>"]/.test(v)) el.setAttribute('face', v);
        else if (an === 'size' && /^[1-7]$/.test(v)) el.setAttribute('size', v);
        else if (an === 'align' && /^(left|center|right|justify)$/i.test(v)) el.setAttribute('align', v.toLowerCase());
      });
      sanitizeNode(n, el);
      out.appendChild(el);
    });
    return out;
  }
  function sanitize(html) {
    var doc = new DOMParser().parseFromString(String(html), 'text/html');   // inert: nothing runs
    var box = document.createElement('div');
    sanitizeNode(doc.body, box);
    return box.innerHTML;
  }
  function textToHtml(t) {
    return t.replace(/\r\n?/g, '\n').split('\n').map(function (l) { return '<div>' + (U.esc(l) || '<br>') + '</div>'; }).join('');
  }
  // Very rough RTF: keeps the text, turns \par into paragraphs.
  function rtfToHtml(rtf) {
    var t = rtf.replace(/\{\\\*[^{}]*\}/g, '').replace(/\\par[d]?\b ?/g, '\n').replace(/\\'([0-9a-f]{2})/gi, function (m, x) { return String.fromCharCode(parseInt(x, 16)); })
      .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '');
    return textToHtml(t.trim());
  }

  function launch(path) {
    var doc = { path: null, dirty: false };
    var editor = h('div', { className: 'wp-editor', contenteditable: 'true', spellcheck: 'false' });
    editor.innerHTML = '<div><br></div>';
    var page = h('div', { className: 'wp-page' }, editor);
    var status = h('div', { className: 'statusbar wp-status' }, h('div', { className: 'panel' }, 'For Help, press F1'));

    var fontSel = h('select', { className: 'field wp-font', title: 'Font' }, FONTS.map(function (f) { return h('option', null, f); }));
    var sizeSel = h('select', { className: 'field wp-size', title: 'Font Size' }, SIZES.map(function (s) { return h('option', { selected: s === 10 }, String(s)); }));
    var colorSel = h('select', { className: 'field wp-color', title: 'Color' }, COLORS.map(function (c) { return h('option', { value: c[1], style: { color: c[1] === '#ffffff' ? '#808080' : c[1] } }, c[0]); }));

    function tbtn(id, title, html, fn) {
      var b = h('button', { className: 'wp-btn', title: title, tabindex: '-1', dataset: { cmd: id } });
      b.innerHTML = html;
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { editor.focus(); fn(); syncState(); });
      return b;
    }
    function sep() { return h('span', { className: 'wp-sep' }); }
    function glyph(paths) { return '<svg width="16" height="16" viewBox="0 0 16 16">' + paths + '</svg>'; }
    function fmtBtn(cmd, title, label, style) {
      return tbtn(cmd, title, '<b style="' + style + '">' + label + '</b>', function () { exec(cmd); });
    }

    var toolbar = h('div', { className: 'wp-bar wp-toolbar' }, [
      tbtn('new', 'New', glyph('<path d="M3 1h7l3 3v11H3z" fill="#fff" stroke="#000"/>'), newDoc),
      tbtn('open', 'Open', glyph('<path d="M1 4h5l1 2h8v8H1z" fill="#ffe58a" stroke="#000"/>'), open),
      tbtn('save', 'Save', glyph('<rect x="2" y="2" width="12" height="12" fill="#008" stroke="#000"/><rect x="4" y="2" width="8" height="5" fill="#fff"/><rect x="5" y="10" width="6" height="4" fill="#c0c0c0"/>'), save),
      sep(),
      tbtn('print', 'Print', glyph('<rect x="3" y="2" width="10" height="5" fill="#fff" stroke="#000"/><rect x="1" y="7" width="14" height="6" fill="#c0c0c0" stroke="#000"/>'), noPrinter),
      sep(),
      tbtn('cut', 'Cut', glyph('<path d="M5 2l4 8M11 2L7 10" stroke="#000"/><circle cx="6" cy="12" r="2" fill="none" stroke="#000"/><circle cx="10" cy="12" r="2" fill="none" stroke="#000"/>'), function () { exec('cut'); }),
      tbtn('copy', 'Copy', glyph('<rect x="2" y="2" width="7" height="9" fill="#fff" stroke="#000"/><rect x="6" y="5" width="7" height="9" fill="#fff" stroke="#000"/>'), function () { exec('copy'); }),
      tbtn('paste', 'Paste', glyph('<rect x="2" y="3" width="11" height="12" fill="#c8a060" stroke="#000"/><rect x="5" y="1" width="5" height="3" fill="#c0c0c0" stroke="#000"/><rect x="5" y="6" width="8" height="8" fill="#fff" stroke="#000"/>'), paste),
      tbtn('undo', 'Undo', glyph('<path d="M4 6h6a3 3 0 010 6H6" fill="none" stroke="#000" stroke-width="1.5"/><path d="M6 3L3 6l3 3" fill="none" stroke="#000" stroke-width="1.5"/>'), function () { exec('undo'); }),
      sep(),
      tbtn('date', 'Date/Time', glyph('<rect x="2" y="3" width="12" height="11" fill="#fff" stroke="#000"/><rect x="2" y="3" width="12" height="3" fill="#f00"/><path d="M5 9h2M9 9h2M5 12h2" stroke="#000"/>'), dateTime)
    ]);
    var formatbar = h('div', { className: 'wp-bar wp-format' }, [
      fontSel, sizeSel, colorSel, sep(),
      fmtBtn('bold', 'Bold', 'B', 'font-weight:bold'), fmtBtn('italic', 'Italic', 'I', 'font-style:italic;font-family:serif'), fmtBtn('underline', 'Underline', 'U', 'text-decoration:underline'),
      sep(),
      tbtn('justifyLeft', 'Align Left', glyph('<path d="M2 3h12M2 6h8M2 9h12M2 12h8" stroke="#000"/>'), function () { exec('justifyLeft'); }),
      tbtn('justifyCenter', 'Center', glyph('<path d="M2 3h12M4 6h8M2 9h12M4 12h8" stroke="#000"/>'), function () { exec('justifyCenter'); }),
      tbtn('justifyRight', 'Align Right', glyph('<path d="M2 3h12M6 6h8M2 9h12M6 12h8" stroke="#000"/>'), function () { exec('justifyRight'); }),
      sep(),
      tbtn('insertUnorderedList', 'Bullets', glyph('<path d="M6 4h8M6 8h8M6 12h8" stroke="#000"/><path d="M2 3h2v2H2zM2 7h2v2H2zM2 11h2v2H2z" fill="#000"/>'), function () { exec('insertUnorderedList'); })
    ]);

    var win = WM.open({
      app: 'wordpad', title: 'Document - WordPad', icon: 'wordpad', width: 620, height: 440,
      content: h('div', { className: 'wp' }, [toolbar, formatbar, page, status]), className: 'wordpad-window',
      onClose: function () { return confirmDiscard(); }
    });

    function name() { return doc.path ? FS.basename(doc.path) : 'Document'; }
    function updateTitle() { win.setTitle(name() + ' - WordPad'); }
    var lastRange = null;   // the caret survives a trip to the drop-downs
    function exec(cmd, arg) {
      if (document.activeElement !== editor) {
        editor.focus();
        if (lastRange) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(lastRange); }
      }
      try { document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, arg); } catch (e) { /* unsupported */ }
      doc.dirty = true;
    }
    function paste() {
      editor.focus();
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) { exec('insertText', t); }, function () { exec('paste'); });
      } else exec('paste');
    }
    function dateTime() {
      var d = new Date(), hh = d.getHours();
      exec('insertText', (hh % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (hh >= 12 ? 'PM' : 'AM') + ' ' + (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear());
    }

    // Font size in points: execCommand only knows 1-7, so use 7 as a marker and rewrite it.
    function setSize(pt) {
      exec('fontSize', '7');
      var made = [];
      editor.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach(function (n) {
        if (n.tagName === 'SPAN') { n.style.fontSize = pt + 'pt'; made.push(n); return; }   // keeps any colour on the same span
        var s = document.createElement('span');
        s.style.fontSize = pt + 'pt';
        while (n.firstChild) s.appendChild(n.firstChild);
        n.parentNode.replaceChild(s, n);
        made.push(s);
      });
      // Keep the selection on the resized text so further formatting still applies.
      if (made.length) {
        var r = document.createRange(), sel = window.getSelection();
        r.setStartBefore(made[0]); r.setEndAfter(made[made.length - 1]);
        sel.removeAllRanges(); sel.addRange(r);
      }
    }
    fontSel.addEventListener('change', function () { exec('fontName', fontSel.value); syncState(); });
    sizeSel.addEventListener('change', function () { setSize(+sizeSel.value); syncState(); });
    colorSel.addEventListener('change', function () { exec('foreColor', colorSel.value); });

    // Reflect the caret's formatting in the buttons and drop-downs.
    function syncState() {
      if (win.closed) return;
      ['bold', 'italic', 'underline', 'justifyLeft', 'justifyCenter', 'justifyRight', 'insertUnorderedList'].forEach(function (c) {
        var b = win.el.querySelector('.wp-btn[data-cmd="' + c + '"]'), on = false;
        try { on = document.queryCommandState(c); } catch (e) { /* */ }
        if (b) b.classList.toggle('on', !!on);
      });
      try {
        var f = (document.queryCommandValue('fontName') || '').replace(/["']/g, '');
        for (var i = 0; i < fontSel.options.length; i++) if (fontSel.options[i].text.toLowerCase() === f.toLowerCase()) fontSel.selectedIndex = i;
      } catch (e) { /* */ }
    }
    function onSel() {
      var s = window.getSelection();
      if (s && s.anchorNode && editor.contains(s.anchorNode)) { lastRange = s.getRangeAt(0).cloneRange(); syncState(); }
    }
    document.addEventListener('selectionchange', onSel);
    win.on('close', function () { document.removeEventListener('selectionchange', onSel); });

    // ---- files -----------------------------------------------------------
    function noPrinter() {
      WM.msgbox({ title: 'WordPad', owner: win, icon: 'warning', text: 'No printers are installed. To install a printer, click the Start button, point to Settings, click Printers, and then double-click Add Printer.' });
    }
    function confirmDiscard() {
      if (!doc.dirty) return Promise.resolve(true);
      return WM.msgbox({
        title: 'WordPad', owner: win, icon: 'warning', buttons: ['&Yes', '&No', 'Cancel'],
        text: 'Save changes to document ' + name() + '?'
      }).then(function (b) {
        if (b === 'Cancel') return false;
        if (b === '&No') return true;
        return save();
      });
    }
    function load(p) {
      var text;
      try { text = FS.read(p); } catch (err) {
        WM.msgbox({ title: 'WordPad', owner: win, icon: 'error', text: FS.errorText(err, p) });
        return;
      }
      var e = FS.ext(p), html;
      if (/^\{\\rtf/.test(text)) html = rtfToHtml(text);
      else if (e === 'txt' || e === 'log' || e === 'ini' || !/<[a-z!][^>]*>/i.test(text)) html = textToHtml(text);
      else html = sanitize(text);
      editor.innerHTML = html || '<div><br></div>';
      doc.path = FS.realPath(p); doc.dirty = false;
      Shell.addRecent(doc.path);
      updateTitle();
    }
    function writeTo(p) {
      try {
        var e = FS.ext(p);
        FS.write(p, e === 'txt' ? (editor.innerText || '').replace(/\n/g, '\r\n') : editor.innerHTML);
        doc.path = FS.realPath(p); doc.dirty = false;
        Shell.addRecent(doc.path);
        updateTitle();
        U.sound('hddSeek', 250);
        return true;
      } catch (err) {
        WM.msgbox({ title: 'WordPad', owner: win, icon: 'error', text: FS.errorText(err, p) });
        return false;
      }
    }
    function save() { return doc.path ? Promise.resolve(writeTo(doc.path)) : saveAs(); }
    function saveAs() {
      return Dialogs.file({
        mode: 'save', owner: win, types: TYPES, dir: doc.path ? FS.dirname(doc.path) : 'C:\\My Documents',
        name: doc.path ? FS.basename(doc.path) : 'Document.doc'
      }).then(function (p) { return p ? writeTo(p) : false; });
    }
    function open() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        Dialogs.file({ mode: 'open', owner: win, types: TYPES.slice(3).concat(TYPES.slice(0, 3)), dir: doc.path ? FS.dirname(doc.path) : 'C:\\My Documents' }).then(function (p) { if (p) load(p); });
      });
    }
    function newDoc() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        editor.innerHTML = '<div><br></div>'; doc.path = null; doc.dirty = false; updateTitle();
      });
    }
    function toggle(el, cls) { return function () { el.classList.toggle(cls); }; }
    var root = win.el;

    Menu.bar(win, [
      { label: '&File', items: [
        { label: '&New...', shortcut: 'Ctrl+N', action: newDoc },
        { label: '&Open...', shortcut: 'Ctrl+O', action: open },
        { label: '&Save', shortcut: 'Ctrl+S', action: save },
        { label: 'Save &As...', action: saveAs },
        '-',
        { label: '&Print...', shortcut: 'Ctrl+P', action: noPrinter },
        { label: 'Page Se&tup...', action: noPrinter },
        '-',
        { label: 'E&xit', action: function () { win.close(); } }
      ] },
      { label: '&Edit', items: [
        { label: '&Undo', shortcut: 'Ctrl+Z', action: function () { exec('undo'); } },
        '-',
        { label: 'Cu&t', shortcut: 'Ctrl+X', action: function () { exec('cut'); } },
        { label: '&Copy', shortcut: 'Ctrl+C', action: function () { exec('copy'); } },
        { label: '&Paste', shortcut: 'Ctrl+V', action: paste },
        { label: 'C&lear', shortcut: 'Del', action: function () { exec('delete'); } },
        { label: 'Select &all', shortcut: 'Ctrl+A', action: function () { editor.focus(); exec('selectAll'); } }
      ] },
      { label: '&View', items: function () {
        return [
          { label: '&Toolbar', checked: !root.classList.contains('no-toolbar'), action: toggle(root, 'no-toolbar') },
          { label: '&Format Bar', checked: !root.classList.contains('no-format'), action: toggle(root, 'no-format') },
          { label: '&Status Bar', checked: !root.classList.contains('no-status'), action: toggle(root, 'no-status') }
        ];
      } },
      { label: 'I&nsert', items: [{ label: '&Date and Time...', action: dateTime }] },
      { label: 'F&ormat', items: [
        { label: '&Bullet Style', action: function () { exec('insertUnorderedList'); } },
        '-',
        { label: 'Align &Left', action: function () { exec('justifyLeft'); } },
        { label: '&Center', action: function () { exec('justifyCenter'); } },
        { label: 'Align &Right', action: function () { exec('justifyRight'); } }
      ] },
      { label: '&Help', items: [
        { label: '&Help Topics', action: function () { Shell.launch('help', 'wordpad'); } },
        '-',
        { label: '&About WordPad', action: function () { Shell.launch('about', { name: 'WordPad', icon: 'wordpad' }); } }
      ] }
    ]);

    editor.addEventListener('input', function () { doc.dirty = true; });
    // Pasting HTML from elsewhere goes through the sanitizer.
    editor.addEventListener('paste', function (e) {
      var cd = e.clipboardData;
      if (!cd) return;
      e.preventDefault();
      var html = cd.getData('text/html');
      if (html) exec('insertHTML', sanitize(html)); else exec('insertText', cd.getData('text/plain'));
    });
    editor.addEventListener('keydown', function (e) {
      if (win.modalChild) { e.preventDefault(); return; }
      if (!e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); save(); }
      else if (k === 'o') { e.preventDefault(); open(); }
      else if (k === 'n') { e.preventDefault(); newDoc(); }
    });
    win.on('focus', function () { setTimeout(function () { if (!win.modalChild) editor.focus(); }, 0); });
    page.addEventListener('pointerdown', function (e) { if (e.target === page) { e.preventDefault(); editor.focus(); } });

    if (path) load(path);
    setTimeout(function () { editor.focus(); }, 0);
    return win;
  }

  Shell.register('wordpad', { name: 'WordPad', icon: 'wordpad', launch: launch });
  Shell.associate('doc', 'wordpad', 'doc-file');
  Shell.associate('rtf', 'wordpad', 'doc-file');
  Shell.associate('wri', 'wordpad', 'doc-file');
  window.WordPadSanitize = sanitize;
})();
