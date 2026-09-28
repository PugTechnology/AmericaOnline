/*
 * Paint, Windows 98 edition. A pixel canvas with the classic tool box and
 * 28-colour palette. Images are saved on C: as .bmp files whose content is a
 * PNG data URL (the node is flagged `bin` so Notepad never opens it).
 */
(function () {
  var h = U.h;

  var PALETTE = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#4000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'
  ];
  var TYPES = [{ label: 'Bitmap Files (*.bmp)', ext: 'bmp' }, { label: 'All Files (*.*)', ext: '*' }];
  var DEFAULT_W = 480, DEFAULT_H = 320;

  // Tool box: id, tooltip, 16px glyph (inline SVG paths).
  var TOOLS = [
    ['select', 'Select', '<rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="#000" stroke-dasharray="2 1"/>'],
    ['eraser', 'Eraser/Color Eraser', '<path d="M2 10l6-7 6 5-5 6H5z" fill="#f8a0a0" stroke="#000"/><path d="M5 14h9" stroke="#000"/>'],
    ['fill', 'Fill With Color', '<path d="M3 9l5-6 5 5-5 5z" fill="#fff" stroke="#000"/><path d="M13 10q2 2 0 3q-2-1 0-3z" fill="#00f" stroke="#00f"/>'],
    ['pick', 'Pick Color', '<path d="M3 13l1-3 6-6 2 2-6 6z" fill="#fff" stroke="#000"/><path d="M10 3l1-1 3 3-1 1z" fill="#000"/>'],
    ['pencil', 'Pencil', '<path d="M3 13l1-3 7-7 2 2-7 7z" fill="#ff0" stroke="#000"/><path d="M3 13l1-3 2 2z" fill="#000"/>'],
    ['brush', 'Brush', '<path d="M13 2L8 8" stroke="#a06020" stroke-width="2"/><path d="M8 8q-3 0-3 4q3 0 4-2z" fill="#000"/>'],
    ['airbrush', 'Airbrush', '<rect x="8" y="2" width="5" height="6" fill="#c0c0c0" stroke="#000"/><path d="M3 10h1M5 12h1M3 13h1M6 10h1M2 12h1" stroke="#f00"/>'],
    ['text', 'Text', '<path d="M3 3h10M8 3v10M6 13h4" stroke="#000" stroke-width="1.5" fill="none"/>'],
    ['line', 'Line', '<path d="M2 13L14 3" stroke="#000" stroke-width="1.5"/>'],
    ['rect', 'Rectangle', '<rect x="2.5" y="4.5" width="11" height="8" fill="none" stroke="#000"/>'],
    ['ellipse', 'Ellipse', '<ellipse cx="8" cy="8" rx="6" ry="4.5" fill="none" stroke="#000"/>']
  ];

  function rgba(col) {
    var n = parseInt(col.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }

  function launch(path) {
    var doc = { path: null, dirty: false };
    var tool = 'pencil', prevTool = 'pencil';
    var fg = '#000000', bg = '#ffffff';
    var opt = { brush: 3, eraser: 8, air: 9, width: 1, fill: 0 };
    var hist = [], sel = null, textBox = null;
    var drag = null;      // the gesture in progress

    var canvas = h('canvas', { className: 'paint-canvas', width: DEFAULT_W, height: DEFAULT_H });
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var over = h('canvas', { className: 'paint-over', width: DEFAULT_W, height: DEFAULT_H });
    var octx = over.getContext('2d');
    var stage = h('div', { className: 'paint-stage' }, [canvas, over]);
    var area = h('div', { className: 'paint-area' }, stage);
    var toolbox = h('div', { className: 'paint-tools' });
    var optBox = h('div', { className: 'paint-opts' });
    var toolCol = h('div', { className: 'paint-toolcol' }, [toolbox, optBox]);
    var swatchBox = h('div', { className: 'paint-current' });
    var pal = h('div', { className: 'paint-palette' });
    var colorBar = h('div', { className: 'paint-colorbar' }, [swatchBox, pal]);
    var statHelp = h('div', { className: 'panel help' }, 'For Help, click Help Topics on the Help Menu.');
    var statPos = h('div', { className: 'panel pos' });
    var statSize = h('div', { className: 'panel size' });
    var status = h('div', { className: 'statusbar paint-status' }, [statHelp, statPos, statSize]);
    var content = h('div', { className: 'paint' }, [h('div', { className: 'paint-mid' }, [toolCol, area]), colorBar, status]);

    var win = WM.open({
      app: 'paint', title: 'untitled - Paint', icon: 'paint', width: 640, height: 480,
      content: content, className: 'paint-window', onClose: function () { return confirmDiscard(); }
    });

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    function name() { return doc.path ? FS.basename(doc.path) : 'untitled'; }
    function updateTitle() { win.setTitle(name() + ' - Paint'); }
    function markDirty() { doc.dirty = true; }
    function updateSize() { statSize.textContent = canvas.width + ' x ' + canvas.height; }

    // ---- history ---------------------------------------------------------
    function pushUndo() {
      hist.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (hist.length > 20) hist.shift();
      markDirty();
    }
    function setCanvasSize(w, hh) {
      canvas.width = over.width = w; canvas.height = over.height = hh;
      ctx.imageSmoothingEnabled = false;
      updateSize();
    }
    function undo() {
      commitSel(); commitText();
      var img = hist.pop();
      if (!img) return;
      if (img.width !== canvas.width || img.height !== canvas.height) setCanvasSize(img.width, img.height);
      ctx.putImageData(img, 0, 0);
    }

    // ---- pixel drawing primitives ------------------------------------------
    function px(x, y, n, col, round) {
      ctx.fillStyle = col;
      if (n <= 1) { ctx.fillRect(x, y, 1, 1); return; }
      var r = n / 2, i0 = -Math.floor(r), i1 = Math.ceil(r) - 1;
      if (!round || n < 3) { ctx.fillRect(x + i0, y + i0, n, n); return; }
      for (var dy = i0; dy <= i1; dy++) {
        var w = Math.round(Math.sqrt(Math.max(0, r * r - (dy + 0.5) * (dy + 0.5))));
        ctx.fillRect(x - w, y + dy, w * 2 + 1, 1);
      }
    }
    // Bresenham with a stamp at every step, so strokes never have gaps.
    function line(x0, y0, x1, y1, n, col, round) {
      var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
      for (;;) {
        px(x0, y0, n, col, round);
        if (x0 === x1 && y0 === y1) break;
        var e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    }
    function rectShape(a, b, col, other) {
      var x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), n = opt.width;
      if (opt.fill === 1) { ctx.fillStyle = other; ctx.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1); }
      if (opt.fill === 2) { ctx.fillStyle = col; ctx.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1); return; }
      ctx.fillStyle = col;
      ctx.fillRect(x0, y0, x1 - x0 + 1, n);
      ctx.fillRect(x0, y1 - n + 1, x1 - x0 + 1, n);
      ctx.fillRect(x0, y0, n, y1 - y0 + 1);
      ctx.fillRect(x1 - n + 1, y0, n, y1 - y0 + 1);
    }
    function ellipseShape(a, b, col, other) {
      var x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x) + 1, y1 = Math.max(a.y, b.y) + 1;
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, y;
      function span(c) {
        ctx.fillStyle = c;
        for (y = y0; y < y1; y++) {
          var t = (y + 0.5 - cy) / ry, w = rx * Math.sqrt(Math.max(0, 1 - t * t));
          ctx.fillRect(Math.round(cx - w), y, Math.max(1, Math.round(cx + w) - Math.round(cx - w)), 1);
        }
      }
      if (opt.fill === 1) span(other);
      if (opt.fill === 2) { span(col); return; }
      var steps = Math.ceil(Math.max(rx, ry) * 8) + 8;
      for (var i = 0; i < steps; i++) {
        var th = i / steps * Math.PI * 2;
        px(Math.floor(cx + (rx - 0.5) * Math.cos(th)), Math.floor(cy + (ry - 0.5) * Math.sin(th)), opt.width, col, false);
      }
    }
    // Flood fill on exact colour match, scanline style.
    function floodFill(sx, sy, col) {
      var w = canvas.width, hh = canvas.height;
      if (sx < 0 || sy < 0 || sx >= w || sy >= hh) return;
      var img = ctx.getImageData(0, 0, w, hh), d = new Uint32Array(img.data.buffer);
      var c = rgba(col), want = ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;   // little-endian ABGR
      var target = d[sy * w + sx];
      if (target === want) return;
      var stack = [[sx, sy]];
      while (stack.length) {
        var p = stack.pop(), x = p[0], y = p[1];
        while (x >= 0 && d[y * w + x] === target) x--;
        x++;
        var up = false, dn = false;
        while (x < w && d[y * w + x] === target) {
          d[y * w + x] = want;
          if (y > 0) { var u = d[(y - 1) * w + x] === target; if (u && !up) stack.push([x, y - 1]); up = u; }
          if (y < hh - 1) { var v = d[(y + 1) * w + x] === target; if (v && !dn) stack.push([x, y + 1]); dn = v; }
          x++;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    function spray(x, y, col) {
      ctx.fillStyle = col;
      var r = opt.air / 2;
      for (var i = 0; i < 10; i++) {
        var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
        ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 1, 1);
      }
    }

    // ---- selection -------------------------------------------------------
    function drawMarquee() {
      octx.clearRect(0, 0, over.width, over.height);
      if (!sel) return;
      octx.save();
      octx.strokeStyle = '#000'; octx.lineWidth = 1; octx.setLineDash([3, 3]);
      octx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w - 1, sel.h - 1);
      octx.restore();
    }
    function commitSel() { if (sel) { sel = null; drawMarquee(); } }
    function deleteSel() {
      if (!sel) return;
      if (sel.lifted) ctx.putImageData(sel.base, 0, 0);
      else { pushUndo(); ctx.fillStyle = bg; ctx.fillRect(sel.x, sel.y, sel.w, sel.h); }
      commitSel();
    }
    function liftSel() {
      pushUndo();
      var tmp = document.createElement('canvas');
      tmp.width = sel.w; tmp.height = sel.h;
      tmp.getContext('2d').putImageData(ctx.getImageData(sel.x, sel.y, sel.w, sel.h), 0, 0);
      sel.float = tmp;
      ctx.fillStyle = bg; ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
      sel.base = ctx.getImageData(0, 0, canvas.width, canvas.height);
      sel.lifted = true;
    }

    // ---- text tool -------------------------------------------------------
    function commitText() {
      if (!textBox) return;
      var tb = textBox;
      textBox = null;
      var txt = tb.ta.value;
      tb.ta.remove();
      if (!txt) return;
      pushUndo();
      ctx.fillStyle = tb.col;
      ctx.font = '16px Arial, Helvetica, sans-serif';
      ctx.textBaseline = 'top';
      txt.split('\n').forEach(function (ln, i) { ctx.fillText(ln, tb.x + 2, tb.y + 2 + i * 19); });
    }
    function startText(x, y, w, hh, col) {
      var ta = h('textarea', { className: 'paint-text', spellcheck: 'false' });
      ta.style.left = x + 'px'; ta.style.top = y + 'px';
      ta.style.width = Math.max(70, w) + 'px'; ta.style.height = Math.max(26, hh) + 'px';
      ta.style.color = col;
      stage.appendChild(ta);
      textBox = { ta: ta, x: x, y: y, col: col };
      ta.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      ta.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') { ta.value = ''; commitText(); } });
      setTimeout(function () { ta.focus(); }, 0);
    }

    // ---- pointer handling ----------------------------------------------------
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: Math.floor((e.clientX - r.left) * canvas.width / r.width), y: Math.floor((e.clientY - r.top) * canvas.height / r.height) };
    }
    function inSel(p) { return sel && p.x >= sel.x && p.y >= sel.y && p.x < sel.x + sel.w && p.y < sel.y + sel.h; }

    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      win.focus();
      if (drag) return;
      var p = pos(e), right = e.button === 2;
      var col = right ? bg : fg, other = right ? fg : bg;
      if (textBox && tool !== 'text') commitText();
      if (tool === 'text') commitText();
      if (tool !== 'select') commitSel();
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      drag = { start: p, last: p, col: col, other: other, right: right };

      switch (tool) {
        case 'pencil':
          pushUndo(); px(p.x, p.y, 1, col); break;
        case 'brush':
          pushUndo(); px(p.x, p.y, opt.brush, col, true); break;
        case 'eraser':
          pushUndo(); px(p.x, p.y, opt.eraser, bg, false); break;
        case 'airbrush':
          pushUndo(); spray(p.x, p.y, col);
          drag.timer = setInterval(function () { spray(drag.last.x, drag.last.y, col); }, 30);
          break;
        case 'fill':
          pushUndo(); floodFill(p.x, p.y, col); drag = null; break;
        case 'pick':
          if (p.x >= 0 && p.y >= 0 && p.x < canvas.width && p.y < canvas.height) {
            var d = ctx.getImageData(p.x, p.y, 1, 1).data;
            var hex = '#' + [d[0], d[1], d[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
            if (right) bg = hex; else fg = hex;
            renderSwatches();
          }
          drag = null;
          setTool(prevTool);
          break;
        case 'line': case 'rect': case 'ellipse':
          pushUndo(); drag.snap = ctx.getImageData(0, 0, canvas.width, canvas.height); break;
        case 'select':
          if (inSel(p)) {
            if (!sel.lifted) liftSel();
            drag.move = { ox: sel.x, oy: sel.y };
          } else {
            commitSel();
            drag.marquee = true;
          }
          break;
        case 'text':
          drag.textRect = true; break;
      }
    });

    stage.addEventListener('pointermove', function (e) {
      var p = pos(e);
      statPos.textContent = p.x >= 0 && p.y >= 0 && p.x < canvas.width && p.y < canvas.height ? p.x + ', ' + p.y : '';
      if (!drag) return;
      var l = drag.last;
      switch (tool) {
        case 'pencil': line(l.x, l.y, p.x, p.y, 1, drag.col); break;
        case 'brush': line(l.x, l.y, p.x, p.y, opt.brush, drag.col, true); break;
        case 'eraser': line(l.x, l.y, p.x, p.y, opt.eraser, bg, false); break;
        case 'airbrush': spray(p.x, p.y, drag.col); break;
        case 'line': case 'rect': case 'ellipse':
          ctx.putImageData(drag.snap, 0, 0);
          if (tool === 'line') line(drag.start.x, drag.start.y, p.x, p.y, opt.width, drag.col, false);
          else if (tool === 'rect') rectShape(drag.start, p, drag.col, drag.other);
          else ellipseShape(drag.start, p, drag.col, drag.other);
          break;
        case 'select':
          if (drag.move) {
            sel.x = drag.move.ox + p.x - drag.start.x; sel.y = drag.move.oy + p.y - drag.start.y;
            ctx.putImageData(sel.base, 0, 0);
            ctx.drawImage(sel.float, sel.x, sel.y);
            drawMarquee();
          } else if (drag.marquee) {
            var x0 = U.clamp(Math.min(drag.start.x, p.x), 0, canvas.width), y0 = U.clamp(Math.min(drag.start.y, p.y), 0, canvas.height);
            var x1 = U.clamp(Math.max(drag.start.x, p.x) + 1, 0, canvas.width), y1 = U.clamp(Math.max(drag.start.y, p.y) + 1, 0, canvas.height);
            sel = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, lifted: false };
            drawMarquee();
          }
          break;
        case 'text':
          if (drag.textRect) {
            octx.clearRect(0, 0, over.width, over.height);
            octx.save(); octx.setLineDash([3, 3]); octx.strokeStyle = '#000';
            octx.strokeRect(Math.min(drag.start.x, p.x) + 0.5, Math.min(drag.start.y, p.y) + 0.5, Math.abs(p.x - drag.start.x), Math.abs(p.y - drag.start.y));
            octx.restore();
          }
          break;
      }
      drag.last = p;
    });

    function endDrag(e) {
      if (!drag) return;
      var d = drag, p = pos(e);
      drag = null;
      if (d.timer) clearInterval(d.timer);
      if (tool === 'select' && d.marquee && sel && (sel.w < 2 || sel.h < 2)) commitSel();
      if (tool === 'text' && d.textRect) {
        octx.clearRect(0, 0, over.width, over.height);
        startText(Math.min(d.start.x, p.x), Math.min(d.start.y, p.y), Math.abs(p.x - d.start.x), Math.abs(p.y - d.start.y), d.col);
      }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', function () { statPos.textContent = ''; });

    // ---- tool box, options and palette ---------------------------------------------
    function setTool(t) {
      if (t !== tool) { commitText(); commitSel(); if (tool !== 'pick') prevTool = tool; }
      tool = t;
      renderTools();
      renderOpts();
      area.dataset.tool = t;
    }
    function renderTools() {
      toolbox.innerHTML = '';
      TOOLS.forEach(function (t) {
        var b = h('button', { className: 'paint-tool' + (t[0] === tool ? ' sel' : ''), title: t[1], tabindex: '-1', dataset: { tool: t[0] } });
        b.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16">' + t[2] + '</svg>';
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); win.focus(); });
        b.addEventListener('click', function () { setTool(t[0]); });
        toolbox.appendChild(b);
      });
    }
    function optButtons(list, current, set, draw) {
      return list.map(function (v) {
        var b = h('button', { className: 'paint-opt' + (v === current ? ' sel' : ''), tabindex: '-1' });
        draw(b, v);
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () { set(v); renderOpts(); });
        return b;
      });
    }
    function dotOpt(b, v) { b.appendChild(h('span', { className: 'dot', style: { width: Math.min(v, 12) + 'px', height: Math.min(v, 12) + 'px' } })); }
    function barOpt(b, v) { b.appendChild(h('span', { className: 'bar', style: { height: v + 'px' } })); }
    function renderOpts() {
      optBox.innerHTML = '';
      if (tool === 'brush') U.append(optBox, optButtons([2, 4, 6, 9], opt.brush, function (v) { opt.brush = v; }, dotOpt));
      else if (tool === 'eraser') U.append(optBox, optButtons([4, 6, 8, 10], opt.eraser, function (v) { opt.eraser = v; }, function (b, v) { b.appendChild(h('span', { className: 'sq', style: { width: v + 'px', height: v + 'px' } })); }));
      else if (tool === 'airbrush') U.append(optBox, optButtons([5, 9, 15, 21], opt.air, function (v) { opt.air = v; }, function (b, v) { b.appendChild(h('span', { className: 'dot ring', style: { width: Math.min(v, 14) + 'px', height: Math.min(v, 14) + 'px' } })); }));
      else if (tool === 'line') U.append(optBox, optButtons([1, 2, 3, 4, 5], opt.width, function (v) { opt.width = v; }, barOpt));
      else if (tool === 'rect' || tool === 'ellipse') {
        U.append(optBox, optButtons([0, 1, 2], opt.fill, function (v) { opt.fill = v; }, function (b, v) {
          b.title = ['Outline', 'Filled with outline', 'Filled'][v];
          b.appendChild(h('span', { className: 'shape s' + v }));
        }));
      }
    }
    function renderSwatches() {
      swatchBox.innerHTML = '';
      swatchBox.appendChild(h('div', { className: 'cur-bg', style: { background: bg } }));
      swatchBox.appendChild(h('div', { className: 'cur-fg', style: { background: fg } }));
    }
    PALETTE.forEach(function (c) {
      var s = h('button', { className: 'paint-swatch', tabindex: '-1', title: c, style: { background: c }, dataset: { color: c } });
      s.addEventListener('pointerdown', function (e) { e.preventDefault(); win.focus(); if (e.button === 2) { bg = c; renderSwatches(); } else if (e.button === 0) { fg = c; renderSwatches(); } });
      s.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      pal.appendChild(s);
    });

    // ---- image menu operations -----------------------------------------------------
    function withCopy(fn) {
      var tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = canvas.height;
      tmp.getContext('2d').drawImage(canvas, 0, 0);
      fn(tmp);
    }
    function flipRotate() {
      commitSel(); commitText();
      var mode = 'fh', rot = 90;
      function radio(group, value, text, on, checked) {
        var r = h('input', { type: 'radio', name: group + win.id, checked: checked });
        r.addEventListener('change', on);
        return h('label', { className: 'check' }, [r, U.label(text)]);
      }
      var angles = h('div', { className: 'paint-angles' }, [90, 180, 270].map(function (a) {
        return radio('ang', a, a + ' degrees', function () { rot = a; }, a === 90);
      }));
      var ok = h('button', { className: 'btn default' }, 'OK'), cancel = h('button', { className: 'btn' }, 'Cancel');
      var d = WM.dialog({
        title: 'Flip and Rotate', owner: win, width: 300, content: h('div', { className: 'paint-dialog' }, [
          h('fieldset', { className: 'group' }, [h('legend', null, 'Flip or rotate'),
            radio('fr', 'fh', '&Flip horizontal', function () { mode = 'fh'; }, true),
            radio('fr', 'fv', 'Flip &vertical', function () { mode = 'fv'; }),
            radio('fr', 'rot', '&Rotate by angle', function () { mode = 'rot'; }),
            angles]),
          h('div', { className: 'btns' }, [ok, cancel])
        ])
      });
      ok.addEventListener('click', function () { d.close(true); doFlipRotate(mode, rot); });
      cancel.addEventListener('click', function () { d.close(true); });
      d.onKey = function (e) {
        if (e.key === 'Enter') { d.close(true); doFlipRotate(mode, rot); return true; }
        if (e.key === 'Escape') { d.close(true); return true; }
        return false;
      };
    }
    function doFlipRotate(mode, rot) {
      pushUndo();
      withCopy(function (tmp) {
        var w = tmp.width, hh = tmp.height;
        if (mode === 'rot' && rot !== 180) setCanvasSize(hh, w);
        ctx.save();
        if (mode === 'fh') { ctx.translate(w, 0); ctx.scale(-1, 1); }
        else if (mode === 'fv') { ctx.translate(0, hh); ctx.scale(1, -1); }
        else if (rot === 180) { ctx.translate(w, hh); ctx.rotate(Math.PI); }
        else if (rot === 90) { ctx.translate(hh, 0); ctx.rotate(Math.PI / 2); }
        else { ctx.translate(0, w); ctx.rotate(-Math.PI / 2); }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0);
        ctx.restore();
      });
    }
    function invertColors() {
      commitSel(); commitText();
      pushUndo();
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
      for (var i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
      ctx.putImageData(img, 0, 0);
    }
    function clearImage() {
      commitSel(); commitText();
      pushUndo();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    function attributes() {
      var wi = h('input', { type: 'text', className: 'field', value: String(canvas.width), style: { width: '60px' } });
      var hi = h('input', { type: 'text', className: 'field', value: String(canvas.height), style: { width: '60px' } });
      var ok = h('button', { className: 'btn default' }, 'OK'), cancel = h('button', { className: 'btn' }, 'Cancel');
      var d = WM.dialog({
        title: 'Attributes', owner: win, width: 260, content: h('div', { className: 'paint-dialog' }, [
          h('div', { className: 'row' }, [h('label', null, U.label('&Width:')), wi, h('span', null, 'pixels')]),
          h('div', { className: 'row' }, [h('label', null, U.label('&Height:')), hi, h('span', null, 'pixels')]),
          h('div', { className: 'btns' }, [ok, cancel])
        ])
      });
      function apply() {
        var nw = U.clamp(parseInt(wi.value, 10) || canvas.width, 1, 2000), nh = U.clamp(parseInt(hi.value, 10) || canvas.height, 1, 2000);
        d.close(true);
        if (nw === canvas.width && nh === canvas.height) return;
        commitSel(); commitText(); pushUndo();
        withCopy(function (tmp) {
          setCanvasSize(nw, nh);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, nw, nh);
          ctx.drawImage(tmp, 0, 0);
        });
      }
      ok.addEventListener('click', apply);
      cancel.addEventListener('click', function () { d.close(true); });
      d.onKey = function (e) {
        if (e.key === 'Enter') { apply(); return true; }
        if (e.key === 'Escape') { d.close(true); return true; }
        return false;
      };
      setTimeout(function () { wi.focus(); wi.select(); }, 0);
    }

    // ---- files ----------------------------------------------------------------------
    function confirmDiscard() {
      commitSel(); commitText();
      if (!doc.dirty) return Promise.resolve(true);
      return WM.msgbox({
        title: 'Paint', owner: win, icon: 'warning', buttons: ['&Yes', '&No', 'Cancel'],
        text: 'Save changes to ' + (doc.path || 'untitled') + '?'
      }).then(function (b) {
        if (b === 'Cancel') return false;
        if (b === '&No') return true;
        return save();
      });
    }
    function load(p) {
      var data;
      try { data = FS.read(p); } catch (err) {
        WM.msgbox({ title: 'Paint', owner: win, icon: 'error', text: FS.errorText(err, p) });
        return;
      }
      if (!/^data:image\//.test(data)) {
        WM.msgbox({ title: 'Paint', owner: win, icon: 'error', text: 'Paint cannot read this file.\n\nThis is not a valid bitmap file, or its format is not currently supported.' });
        return;
      }
      var img = new Image();
      img.onload = function () {
        commitSel(); commitText();
        setCanvasSize(img.width, img.height);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);
        hist = [];
        doc.path = FS.realPath(p); doc.dirty = false;
        Shell.addRecent(doc.path);
        updateTitle();
      };
      img.onerror = function () {
        WM.msgbox({ title: 'Paint', owner: win, icon: 'error', text: 'Paint cannot read this file.\n\nThis is not a valid bitmap file, or its format is not currently supported.' });
      };
      img.src = data;
    }
    function writeTo(p) {
      commitSel(); commitText();
      try {
        var url = canvas.toDataURL('image/png');
        FS.write(p, url, { bin: true, img: 'png', size: Math.round(url.length * 0.75) });
        doc.path = FS.realPath(p); doc.dirty = false;
        Shell.addRecent(doc.path);
        updateTitle();
        U.sound('hddSeek', 250);
        return true;
      } catch (err) {
        WM.msgbox({ title: 'Paint', owner: win, icon: 'error', text: FS.errorText(err, p) });
        return false;
      }
    }
    function save() { return doc.path ? Promise.resolve(writeTo(doc.path)) : saveAs(); }
    function saveAs() {
      return Dialogs.file({
        mode: 'save', owner: win, types: TYPES, dir: doc.path ? FS.dirname(doc.path) : 'C:\\My Documents',
        name: doc.path ? FS.basename(doc.path) : 'untitled.bmp'
      }).then(function (p) { return p ? writeTo(p) : false; });
    }
    function open() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        Dialogs.file({ mode: 'open', owner: win, types: TYPES, dir: doc.path ? FS.dirname(doc.path) : 'C:\\My Documents' }).then(function (p) { if (p) load(p); });
      });
    }
    function newDoc() {
      confirmDiscard().then(function (ok) {
        if (!ok) return;
        setCanvasSize(DEFAULT_W, DEFAULT_H);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        hist = []; doc.path = null; doc.dirty = false; updateTitle();
      });
    }
    function wallpaper(mode) {
      commitSel(); commitText();
      var ok = Shell.setWallpaper(canvas.toDataURL('image/png'), mode);
      if (!ok) {
        Shell.setWallpaper(null);
        WM.msgbox({ title: 'Paint', owner: win, icon: 'error', text: 'There is not enough memory to set this picture as the wallpaper.' });
      }
    }
    function noPrinter() {
      WM.msgbox({ title: 'Paint', owner: win, icon: 'warning', text: 'No printers are installed. To install a printer, click the Start button, point to Settings, click Printers, and then double-click Add Printer.' });
    }
    function toggleView(el, cls) { return function () { el.classList.toggle(cls); }; }

    Menu.bar(win, [
      { label: '&File', items: [
        { label: '&New', shortcut: 'Ctrl+N', action: newDoc },
        { label: '&Open...', shortcut: 'Ctrl+O', action: open },
        { label: '&Save', shortcut: 'Ctrl+S', action: save },
        { label: 'Save &As...', action: saveAs },
        '-',
        { label: '&Print', shortcut: 'Ctrl+P', action: noPrinter },
        '-',
        { label: 'Set As &Wallpaper (Tiled)', action: function () { wallpaper('tile'); } },
        { label: 'Set As Wallpaper (&Centered)', action: function () { wallpaper('center'); } },
        '-',
        { label: 'E&xit', action: function () { win.close(); } }
      ] },
      { label: '&Edit', items: function () {
        return [
          { label: '&Undo', shortcut: 'Ctrl+Z', disabled: !hist.length, action: undo },
          '-',
          { label: 'C&lear Selection', shortcut: 'Del', disabled: !sel, action: deleteSel },
          { label: 'Select &All', shortcut: 'Ctrl+A', action: function () { setTool('select'); sel = { x: 0, y: 0, w: canvas.width, h: canvas.height, lifted: false }; drawMarquee(); } }
        ];
      } },
      { label: '&View', items: function () {
        return [
          { label: '&Tool Box', checked: !content.classList.contains('no-tools'), action: toggleView(content, 'no-tools') },
          { label: '&Color Box', checked: !content.classList.contains('no-colors'), action: toggleView(content, 'no-colors') },
          { label: '&Status Bar', checked: !content.classList.contains('no-status'), action: toggleView(content, 'no-status') }
        ];
      } },
      { label: '&Image', items: [
        { label: '&Flip/Rotate...', shortcut: 'Ctrl+R', action: flipRotate },
        { label: '&Invert Colors', shortcut: 'Ctrl+I', action: invertColors },
        { label: '&Attributes...', shortcut: 'Ctrl+E', action: attributes },
        { label: '&Clear Image', shortcut: 'Ctrl+Shft+N', action: clearImage }
      ] },
      { label: '&Colors', items: [
        { label: '&Edit Colors...', disabled: true }
      ] },
      { label: '&Help', items: [
        { label: '&Help Topics', action: function () { Shell.launch('help', 'paint'); } },
        '-',
        { label: '&About Paint', action: function () { Shell.launch('about', { name: 'Paint', icon: 'paint' }); } }
      ] }
    ]);

    win.onKey = function (e) {
      if (win.modalChild || (textBox && document.activeElement === textBox.ta)) return false;
      var k = e.key.toLowerCase();
      if (e.ctrlKey && !e.altKey) {
        if (k === 'z') { undo(); return true; }
        if (k === 's') { save(); return true; }
        if (k === 'o') { open(); return true; }
        if (k === 'n' && e.shiftKey) { clearImage(); return true; }
        if (k === 'n') { newDoc(); return true; }
        if (k === 'i') { invertColors(); return true; }
        if (k === 'r') { flipRotate(); return true; }
        if (k === 'e') { attributes(); return true; }
        if (k === 'a') { setTool('select'); sel = { x: 0, y: 0, w: canvas.width, h: canvas.height, lifted: false }; drawMarquee(); return true; }
        return false;
      }
      if (e.key === 'Delete') { deleteSel(); return true; }
      return false;
    };

    renderTools(); renderOpts(); renderSwatches(); updateSize();
    area.dataset.tool = tool;
    if (path) load(path);
    return win;
  }

  Shell.register('paint', { name: 'Paint', icon: 'paint', launch: launch });
  Shell.associate('bmp', 'paint', 'bmp-file');
})();
