/*
 * icons.js - procedurally drawn Windows 98 style pixel-art icons.
 *
 * Every icon is painted pixel-by-pixel onto a <canvas> using a tiny "pen" API
 * (rects, Bresenham lines, and masked shapes that get an automatic 1px black
 * outline), plus small string pixel-maps for the tiniest details. No
 * anti-aliasing is ever used. Icons have a 32px drawing and most also have a
 * hand-tuned 16px drawing; a few sign-on artworks have a 64px drawing. Any
 * missing size is rescaled from the 32px (or nearest available) drawing.
 *
 *   Icons.get(name, size)  -> PNG data URL (size 16, 32 or 64, cached)
 *   Icons.names            -> array of icon names
 */
(function () {
  'use strict';

  // ---- Win98 palette ------------------------------------------------------
  var K = '#000000', W = '#ffffff', L = '#c0c0c0', D = '#808080',
      N = '#000080', B = '#0000ff', T = '#008080', C = '#00ffff',
      Y = '#ffff00', O = '#808000', R = '#ff0000', M = '#800000',
      G = '#008000', LG = '#00ff00', P = '#800080', PK = '#ff00ff',
      // folder manila
      FH = '#fffbd0', FY = '#ffe58a', FS = '#d8b048', FD = '#8a6a10';

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  // ---- pen: pixel drawing helpers ----------------------------------------
  function Pen(ctx) { this.c = ctx; }
  var pp = Pen.prototype;
  pp.rect = function (x, y, w, h, col) {
    if (!col || w <= 0 || h <= 0) return;
    this.c.fillStyle = col; this.c.fillRect(x, y, w, h);
  };
  pp.px = function (x, y, col) { this.rect(x, y, 1, 1, col); };
  pp.hl = function (x0, x1, y, col) { this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, col); };
  pp.vl = function (x, y0, y1, col) { this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, col); };
  pp.frame = function (x, y, w, h, col) {
    this.hl(x, x + w - 1, y, col); this.hl(x, x + w - 1, y + h - 1, col);
    this.vl(x, y, y + h - 1, col); this.vl(x + w - 1, y, y + h - 1, col);
  };
  pp.box = function (x, y, w, h, fill, out) { this.rect(x, y, w, h, fill); if (out) this.frame(x, y, w, h, out); };
  pp.clear = function (x, y, w, h) { this.c.clearRect(x, y, w, h); };
  // raised 3D object: black outline, white top-left, grey bottom-right
  pp.raised = function (x, y, w, h, fill) {
    this.box(x, y, w, h, fill || L, K);
    this.hl(x + 1, x + w - 2, y + 1, W); this.vl(x + 1, y + 1, y + h - 2, W);
    this.hl(x + 2, x + w - 2, y + h - 2, D); this.vl(x + w - 2, y + 2, y + h - 2, D);
  };
  // sunken well (screens, slots)
  pp.sunken = function (x, y, w, h, fill) {
    this.rect(x, y, w, h, fill);
    this.hl(x, x + w - 1, y, D); this.vl(x, y, y + h - 1, D);
    this.hl(x, x + w - 1, y + h - 1, W); this.vl(x + w - 1, y, y + h - 1, W);
  };
  pp.line = function (x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      this.px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  // Masked shape. inside(px,py) is tested at pixel centres. Pixels whose
  // 4-neighbour is outside get the outline colour. fill may be a function.
  pp.shape = function (x0, y0, x1, y1, inside, fill, out) {
    var w = x1 - x0 + 1, h = y1 - y0 + 1, m = [], x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) m[y * w + x] = !!inside(x0 + x + 0.5, y0 + y + 0.5);
    function at(x, y) { return x >= 0 && y >= 0 && x < w && y < h && m[y * w + x]; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      var edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      var col = edge && out ? out : (typeof fill === 'function' ? fill(x0 + x, y0 + y) : fill);
      this.px(x0 + x, y0 + y, col);
    }
  };
  pp.ellipse = function (cx, cy, rx, ry, fill, out) {
    this.shape(Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(cy + ry + 1),
      function (x, y) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b <= 1 + 0.6 / Math.min(rx, ry); }, fill, out);
  };
  pp.disc = function (cx, cy, r, fill, out) { this.ellipse(cx, cy, r, r, fill, out); };
  pp.poly = function (pts, fill, out) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    this.shape(Math.floor(Math.min.apply(0, xs)) - 1, Math.floor(Math.min.apply(0, ys)) - 1,
      Math.ceil(Math.max.apply(0, xs)) + 1, Math.ceil(Math.max.apply(0, ys)) + 1,
      function (x, y) { return inPoly(pts, x, y); }, fill, out);
  };
  // string pixel map; legend maps chars to colours, '.' and ' ' transparent
  pp.map = function (x, y, rows, legend, sc) {
    sc = sc || 1; legend = legend || {};
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var ch = rows[j][i];
      if (ch !== '.' && ch !== ' ') this.rect(x + i * sc, y + j * sc, sc, sc, legend[ch] || PAL[ch]);
    }
  };
  // 3x5 micro font
  pp.text = function (x, y, str, col, sc) {
    sc = sc || 1;
    for (var k = 0; k < str.length; k++) {
      var gl = FONT[str[k]] || FONT[' '];
      for (var j = 0; j < 5; j++) for (var i = 0; i < gl[j].length; i++) if (gl[j][i] === '1') this.rect(x + i * sc, y + j * sc, sc, sc, col);
      x += (gl[0].length + 1) * sc;
    }
  };

  var PAL = { K: K, W: W, L: L, D: D, N: N, B: B, T: T, C: C, Y: Y, O: O, R: R, M: M, G: G, g: LG, P: P, p: PK,
    h: FH, y: FY, s: FS, d: FD };
  var FONT = {
    'C': ['111', '100', '100', '100', '111'], ':': ['0', '1', '0', '1', '0'], '\\': ['100', '100', '010', '001', '001'],
    '_': ['000', '000', '000', '000', '111'], '>': ['100', '010', '001', '010', '100'], ' ': ['0', '0', '0', '0', '0'],
    'D': ['110', '101', '101', '101', '110'], 'O': ['111', '101', '101', '101', '111'], 'M': ['10001', '11011', '10101', '10001', '10001'],
    'S': ['111', '100', '111', '001', '111'], 'I': ['111', '010', '010', '010', '111'], '-': ['000', '000', '111', '000', '000']
  };

  function inPoly(pts, x, y) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // dithered top-left lit shading across a list of colours (light -> dark)
  function shade(cols, cx, cy, r, bias) {
    return function (x, y) {
      var t = ((x + 0.5 - cx) + (y + 0.5 - cy)) / (2.2 * r) + 0.5 + (bias || 0);
      var i = Math.floor(t * cols.length + (bayer(x, y) - 0.5) * 0.9);
      return cols[Math.max(0, Math.min(cols.length - 1, i))];
    };
  }

  // ---- reusable parts -----------------------------------------------------
  function folderBack(g, x, y, w, h, col) {
    col = col || FY;
    var tw = Math.round(w * 0.42);
    g.box(x, y + 2, w, h - 2, col, K);
    g.rect(x + 1, y + 1, tw - 1, 2, col);
    g.hl(x + 2, x + tw - 1, y, K); g.px(x + 1, y + 1, K); g.px(x + tw, y + 1, K);
    g.hl(x + 2, x + tw - 1, y + 1, FH); g.hl(x + 1, x + tw - 1, y + 2, FH);
    g.hl(x + tw, x + w - 2, y + 3, FH); g.vl(x + 1, y + 2, y + h - 2, FH);
  }
  function folderFront(g, x, y, w, h) {
    g.box(x, y, w, h, FY, K);
    g.hl(x + 1, x + w - 2, y + 1, FH); g.vl(x + 1, y + 1, y + h - 2, FH);
    g.hl(x + 2, x + w - 2, y + h - 2, FS); g.vl(x + w - 2, y + 2, y + h - 2, FS);
  }
  function folder(g, x, y, w, h, inner) {
    folderBack(g, x, y, w, h);
    if (inner) inner();
    folderFront(g, x, y + (h > 14 ? 5 : 3), w, h - (h > 14 ? 5 : 3));
  }
  function folderOpen(g, x, y, w, h, inner) {
    var sk = Math.round(w * 0.2), fy = y + Math.round(h * 0.4);
    folderBack(g, x, y, w - sk + 1, h, FS);
    g.hl(x + Math.round(w * 0.42), x + w - 1 - sk, y + 3, FY); g.vl(x + 1, y + 2, y + h - 2, FY);
    g.hl(x + 1, x + Math.round(w * 0.42) - 1, y + 2, FY); g.hl(x + 2, x + Math.round(w * 0.42) - 1, y + 1, FY);
    if (inner) inner();
    g.poly([[x + sk, fy], [x + w, fy], [x + w - sk, y + h], [x, y + h]],
      function (px, py) { return py === fy + 1 ? FH : (py >= y + h - 2 ? FS : FY); }, K);
  }
  function page(g, x, y, w, h, e, fill) {
    e = e == null ? Math.max(3, Math.round(w / 4)) : e;
    g.rect(x + 1, y + 1, w - 2, h - 2, fill || W);
    g.hl(x, x + w - e - 1, y, K); g.vl(x, y, y + h - 1, K); g.hl(x, x + w - 1, y + h - 1, K); g.vl(x + w - 1, y + e, y + h - 1, K);
    if (e > 0) {
      for (var i = 0; i <= e; i++) { g.clear(x + w - e + i, y + i, e - i, 1); g.px(x + w - e - 1 + i, y + i, K); }
      g.vl(x + w - e - 1, y, y + e, K); g.hl(x + w - e - 1, x + w - 1, y + e, K);
      for (i = 2; i < e; i++) g.hl(x + w - e, x + w - e + i - 2, y + i, i === 2 ? W : L);
    }
  }
  function lines(g, x, y, w, n, gap, col, seed) {
    var lens = [1, 0.8, 0.95, 0.6, 1, 0.85, 0.7, 1, 0.9];
    for (var i = 0; i < n; i++) g.hl(x, x + Math.max(1, Math.round((w - 1) * lens[(i + (seed || 0)) % lens.length])), y + i * gap, col || D);
  }
  // application window
  function win(g, x, y, w, h, body, tb) {
    tb = tb || (h > 12 ? 3 : 2);
    g.box(x, y, w, h, L, K);
    g.rect(x + 1, y + 1, w - 2, tb, N);
    if (w > 14) { g.px(x + w - 3, y + 2, W); g.px(x + w - 5, y + 2, W); }
    g.rect(x + 1, y + 1 + tb, w - 2, h - 2 - tb, L);
    if (body !== false) g.rect(x + 2, y + 2 + tb, w - 4, h - 4 - tb, body || W);
  }
  // gear of odd pixel size s with top-left corner (x,y)
  function gear(g, x, y, s) {
    var c = s / 2, t = s * 0.13;
    g.shape(x, y, x + s - 1, y + s - 1, function (px, py) {
      var dx = Math.abs(px - x - c), dy = Math.abs(py - y - c), d = Math.hypot(dx, dy);
      if (d <= s * 0.14) return false;
      if (d <= s * 0.35) return true;
      if ((dx <= t && dy < c) || (dy <= t && dx < c)) return true;
      return Math.abs(dx - dy) <= t * 1.3 && d <= s * 0.47;
    }, shade([W, L, L, D], x + c, y + c, c), K);
  }
  function globe(g, cx, cy, r) {
    g.disc(cx, cy, r, function (x, y) {
      var u = (x + 0.5 - cx) / r, v = (y + 0.5 - cy) / r;
      var land = Math.sin(u * 4.2 + 1.1) + Math.cos(v * 3.6 - u * 1.7) > 1.05 ||
                 (u > 0.1 && v > 0.25 && Math.sin(u * 7) + Math.cos(v * 5 + 1) > 0.9);
      var s = shade(land ? [LG, LG, G, G] : [C, B, B, N], cx, cy, r)(x, y);
      return s;
    }, K);
  }
  function monitor(g, x, y, w, h, screen) {
    g.raised(x, y, w, h, L);
    var bw = w > 14 ? 3 : 2;
    g.sunken(x + bw - 1, y + bw - 1, w - 2 * bw + 2, h - 2 * bw + 1, K);
    g.rect(x + bw, y + bw, w - 2 * bw, h - 2 * bw - 1, T);
    if (screen) screen(x + bw, y + bw, w - 2 * bw, h - 2 * bw - 1);
  }
  function driveBox(g, x, y, w, h, d) {
    // 3/4 view: top face, front face, right face
    g.poly([[x, y + d], [x + 2 * d, y], [x + w, y], [x + w - 2 * d, y + d]], shade([W, W, L], x + w / 2, y, w / 2), null);
    g.rect(x, y + d, w - 2 * d, h - d, L);
    g.poly([[x + w - 2 * d, y + d], [x + w, y], [x + w, y + h - d], [x + w - 2 * d, y + h]], D, null);
    // outline
    g.shape(x - 1, y - 1, x + w + 1, y + h + 1, function (px, py) {
      return inPoly([[x, y + d], [x + 2 * d, y], [x + w, y], [x + w, y + h - d], [x + w - 2 * d, y + h], [x, y + h]], px, py);
    }, null, K);
    g.hl(x + 1, x + w - 2 * d - 1, y + d, W);
    g.vl(x + 1, y + d, y + h - 2, W);
    g.line(x + w - 2 * d, y + d, x + w - 1, y + 1 - 0, D);
    g.vl(x + w - 2 * d, y + d + 1, y + h - 1, K);
  }
  function mag(g, cx, cy, r, hl) {
    g.line(cx + r - 1, cy + r - 1, cx + r + hl, cy + r + hl, K);
    g.line(cx + r, cy + r - 1, cx + r + hl, cy + r + hl - 1, D);
    g.line(cx + r - 1, cy + r, cx + r + hl - 1, cy + r + hl, K);
    if (hl > 3) { g.line(cx + r + 1, cy + r - 1, cx + r + hl, cy + r + hl - 2, K); g.line(cx + r - 1, cy + r + 1, cx + r + hl - 2, cy + r + hl, K); }
    g.disc(cx, cy, r, function (x, y) { return (x - cx) + (y - cy) < -r * 0.6 ? W : C; }, K);
    g.shape(Math.floor(cx - r - 2), Math.floor(cy - r - 2), Math.ceil(cx + r + 2), Math.ceil(cy + r + 2), function (x, y) {
      var d = Math.hypot(x - cx, y - cy); return d <= r + 1 && d > r - 0.5;
    }, D, K);
  }
  function star(g, cx, cy, ro, ri, fill) {
    var pts = [];
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    g.poly(pts, fill || Y, K);
  }

  // ---- icon definitions: name -> { 32: fn(g), 16: fn(g) } -----------------
  var I = {};

  I.computer = {
    32: function (g) {
      monitor(g, 5, 1, 22, 19, function (x, y, w, h) {
        g.hl(x, x + w - 1, y + h - 1, L); g.rect(x + 2, y + 2, 5, 4, W); g.rect(x + 2, y + 2, 5, 1, N);
        g.px(x + 1, y + 1, C); g.px(x + 2, y + 1, C); g.px(x + 1, y + 2, C);
      });
      g.rect(11, 20, 10, 2, D); g.hl(11, 20, 20, K); g.box(9, 21, 14, 2, L, K);
      g.raised(1, 23, 30, 8, L);
      g.box(17, 25, 11, 2, D, null); g.hl(17, 27, 25, K); g.hl(17, 27, 26, W);
      g.px(4, 27, LG); g.px(5, 27, G);
      g.hl(8, 14, 26, D);
    },
    16: function (g) {
      monitor(g, 2, 0, 12, 10, null);
      g.px(5, 3, C); g.px(4, 3, C); g.px(4, 4, C);
      g.box(5, 10, 6, 2, L, K);
      g.raised(0, 11, 16, 5, L);
      g.hl(9, 13, 13, K); g.px(2, 13, LG);
    }
  };

  I['my-documents'] = {
    32: function (g) { folder(g, 1, 5, 30, 22, function () { page(g, 5, 1, 18, 16, 5); lines(g, 8, 6, 10, 3, 2, D); }); },
    16: function (g) { folder(g, 0, 3, 16, 12, function () { g.box(3, 0, 9, 8, W, K); g.hl(5, 9, 2, D); g.hl(5, 8, 4, D); }); }
  };
  I.folder = {
    32: function (g) { folder(g, 1, 5, 30, 22); },
    16: function (g) { folder(g, 0, 2, 15, 12); }
  };
  I['folder-open'] = {
    32: function (g) { folderOpen(g, 1, 5, 30, 22, function () { g.rect(5, 12, 18, 2, W); g.hl(5, 22, 12, L); }); },
    16: function (g) {
      g.map(0, 1, [
        '.KKKK...........',
        'KhhhhK..........',
        'KhsssKKKKKKK....',
        'KhsssssssssK....',
        'KhsssssssssK....',
        'KhssKKKKKKKKKKKK',
        'KhsKhhhhhhhhhhK.',
        'KhsKhyyyyyyyyyK.',
        'KhKhyyyyyyyyyK..',
        'KhKyyyyyyyyyyK..',
        'KKhyyyyyyyyyK...',
        'KKyssssssssyK...',
        'KKKKKKKKKKKK....'
      ]);
    }
  };

  function bin(g, x, y, w, h, full) {
    var rim = Math.max(2, Math.round(h * 0.14)), ins = Math.round(w * 0.12);
    var top = y + rim;
    var body = [[x + 1, top], [x + w - 1, top], [x + w - 1 - ins, y + h], [x + 1 + ins, y + h]];
    var mesh = w > 16 ? 3 : 2;
    g.poly(body, function (px, py) {
      var a = (px + py) % (mesh + 1) === 0, b = (px - py + 64) % (mesh + 1) === 0;
      var lit = px < x + w * 0.45;
      return a || b ? (lit ? L : D) : (lit ? W : L);
    }, K);
    if (full) {
      var cx = x + w / 2;
      g.ellipse(cx - w * 0.16, top - rim * 0.3, w * 0.22, rim + 1.5, shade([W, W, L, D], cx - w * 0.16, top - rim, w * 0.22), K);
      g.ellipse(cx + w * 0.18, top - rim * 0.6, w * 0.2, rim + 1.5, shade([W, W, L, D], cx + w * 0.18, top - rim, w * 0.2), K);
      if (w > 16) { g.line(cx - w * 0.25, top - rim, cx - w * 0.1, top - rim + 1, D); g.line(cx + w * 0.1, top - rim - 1, cx + w * 0.25, top - rim, D); }
    }
    g.ellipse(x + w / 2, top, (w - 1) / 2, rim, function (px, py) { return py < top ? L : (full ? W : D); }, K);
    if (!full) g.ellipse(x + w / 2, top + 0.5, (w - 1) / 2 - 2, rim - 1.2, D, null);
    // base band
    g.hl(x + 2 + ins, x + w - 2 - ins, y + h - 1, D);
  }
  var BIN16 = [
    '..KKLWWWWWWLKK..',
    '.KLWDDDDDDDDLDK.',
    '.KLLDDDDDDDDLDK.',
    '..KKLLLLLLLLKK..',
    '..KWDWLWDLDLDK..',
    '..KDWDWDLDLDLK..',
    '...KWDWLDLDLK...',
    '...KDWDWDLDLK...',
    '...KWDWLDLDLK...',
    '...KDWDWDLDLK...',
    '....KWDLDLDK....',
    '....KDLDLDDK....',
    '....KKKKKKKK....'
  ];
  I['recycle-empty'] = {
    32: function (g) { bin(g, 5, 3, 22, 27, false); },
    16: function (g) { g.map(0, 1, ['....KKKKKKKK....'].concat(BIN16)); }
  };
  I['recycle-full'] = {
    32: function (g) { bin(g, 5, 3, 22, 27, true); },
    16: function (g) {
      g.map(0, 2, BIN16);
      g.map(0, 0, [
        '....KKK.KKK.....',
        '...KWWWKWWLK....',
        '..KWLWWWWLWWKK..',
        '.KLWWWKWWWLWWDK.',
        '.KLLWLWWLWWLLDK.'
      ]);
    }
  };

  function miniPC(g, x, y, w) { // w ~ 10 or 6
    var h = Math.round(w * 0.8);
    g.box(x, y, w, h, L, K);
    g.rect(x + 2, y + 2, w - 4, h - 4, T);
    g.px(x + 2, y + 2, C);
    g.box(x - 1, y + h, w + 2, w > 8 ? 3 : 2, L, K);
  }
  I.network = {
    32: function (g) {
      globe(g, 16, 10, 8);
      g.hl(6, 26, 25, K); g.vl(16, 18, 25, K); g.vl(6, 21, 25, K); g.vl(26, 21, 25, K);
      miniPC(g, 1, 13, 10); miniPC(g, 21, 13, 10); miniPC(g, 11, 22, 10);
    },
    16: function (g) {
      var pc = ['KKKKKKK', 'KLLLLLK', 'KLTTTDK', 'KLTTTDK', 'KDDDDDK', 'KKKKKKK', '.KDDDK.', 'KKKKKKKK', 'KLLLLLDK', 'KKKKKKKK'];
      g.vl(3, 10, 13, K); g.hl(3, 8, 13, K);
      g.map(0, 0, pc); g.map(8, 6, pc);
      g.px(2, 2, C); g.px(10, 8, C);
    }
  };

  var E20 = [
    '.......KKKKKK.......',
    '.....KKCCCCBBKK.....',
    '....KCCCCBBBBBBK....',
    '...KCCCKKKKKBBBBK...',
    '..KCCCK.....KBBBBK..',
    '..KCCK.......KBBBK..',
    '.KCCCK.......KBBBBK.',
    '.KCCK.........KBBBK.',
    '.KCCKKKKKKKKKKKBBBK.',
    'KCCCBBBBBBBBBBBBBBNK',
    'KCCBBBBBBBBBBBBBBBNK',
    'KCCBKKKKKKKKKKKKKKKK',
    'KCCBK...............',
    'KCBBK...............',
    '.KBBBK.........KKKK.',
    '.KBBBBK......KKBBNK.',
    '..KBBBBKKKKKKBBBNK..',
    '...KNBBBBBBBBBNNK...',
    '....KKNNNNNNNNKK....',
    '......KKKKKKKK......'
  ];
  function ie(g, cx, cy, r, ring) {
    var ang = -0.5, ca = Math.cos(ang), sa = Math.sin(ang), ra = r * 1.3, rb = r * 0.58, th = 3;
    function orbit(front) {
      return function (x, y) {
        var dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        var e = Math.sqrt((u / ra) * (u / ra) + (v / rb) * (v / rb)), eo = Math.sqrt((u / (ra + th)) * (u / (ra + th)) + (v / (rb + th)) * (v / (rb + th)));
        return e >= 1 && eo <= 1 && (!front || (v > 0 && u < -ra * 0.35));
      };
    }
    var ringFill = function (x, y) { return (x + y) < cx + cy ? Y : ((x + y) % 2 ? O : Y); };
    if (ring) g.shape(0, 0, 31, 31, orbit(false), ringFill, K);
    g.map(Math.round(cx - 10), Math.round(cy - 10), E20);
    if (ring) g.shape(0, 0, 31, 31, orbit(true), ringFill, K);
  }
  I.ie = {
    32: function (g) { ie(g, 16, 16, 10.5, true); },
    16: function (g) {
      g.map(0, 0, [
        '..............KK',
        '......KKKKK..KYK',
        '....KKCCBBBKKYK.',
        '...KCCKKKKBBKK..',
        '..KCCK....KBBK..',
        '..KCBKKKKKKBBK..',
        '..KCBBBBBBBBBK..',
        '..KCBKKKKKKKKK..',
        '..KCBK....KK....',
        '.YKCBBK..KBBK...',
        'KYK.KBBKKBBK....',
        'KYK..KKBBBK.....',
        '.KYK..KKKK......',
        '..KYYK....KYYK..',
        '...KKYYYYYYKK...',
        '.....KKKKKK.....'
      ]);
    }
  };

  function aol(g, cx, cy, r) {
    g.disc(cx, cy, r, shade([C, B, B, N], cx, cy, r), K);
    // yellow triangle with a circle in it (evocative, not the real mark)
    var s = r * 0.95;
    var tri = [[cx + s * 0.15, cy - s * 0.75], [cx + s * 0.85, cy + s * 0.55], [cx - s * 0.55, cy + s * 0.55]];
    g.poly(tri, function (x, y) { return (x + y) < cx + cy ? Y : ((x ^ y) & 1 ? Y : O); }, K);
    g.disc(cx + s * 0.13, cy + s * 0.2, s * 0.23, N, K);
    // swoosh arc
    g.shape(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(cx + r), Math.ceil(cy + r), function (x, y) {
      var d = Math.hypot(x - cx, y - cy);
      return d < r * 0.8 && d > r * 0.8 - (r > 8 ? 2.2 : 1.4) && x < cx - r * 0.1 && y < cy + r * 0.3;
    }, W, null);
  }
  I.aol = {
    32: function (g) { aol(g, 16, 16, 14); },
    16: function (g) {
      g.map(0, 0, [
        '................',
        '.....KKKKKK.....',
        '...KKCCBBBBKK...',
        '..KCCBBBKBBBNK..',
        '..KCBBBBKBBBNK..',
        '.KCBBBBKYKBBBNK.',
        '.KCBBBBKYKBBBNK.',
        '.KBBBBKYYYKBBNK.',
        '.KBBBBKYKYKBBNK.',
        '.KBBBKYKNKYKBNK.',
        '.KBBBKYYKYOKBNK.',
        '..KBKYYYYOOOKK..',
        '..KNKKKKKKKKKK..',
        '...KKNNNNNNKK...',
        '.....KKKKKK.....',
        '................'
      ]);
    }
  };

  function notepad(g, x, y, w, h) {
    var big = w > 12;
    g.box(x, y + 2, w, h - 2, W, K);
    g.rect(x + 1, y + 3, w - 2, big ? 3 : 2, C); g.hl(x + 1, x + w - 2, y + (big ? 5 : 4), T);
    for (var i = 0; i < (big ? 6 : 4); i++) {
      var ly = y + (big ? 9 : 6) + i * (big ? 3 : 2);
      if (ly < y + h - 2) g.hl(x + 2, x + w - 3, ly, i % 2 && !big ? L : '#8080ff');
    }
    if (big) g.vl(x + 5, y + 6, y + h - 2, '#ff8080');
    g.vl(x + w - 1, y + 3, y + h - 1, D); g.hl(x + 1, x + w - 1, y + h - 1, K);
    for (var sx = x + 2; sx < x + w - 1; sx += big ? 3 : 2) { g.vl(sx, y, y + (big ? 3 : 2), K); if (big) g.px(sx + 1, y, D); }
  }
  I.notepad = {
    32: function (g) { notepad(g, 5, 2, 21, 27); g.vl(26, 5, 29, D); g.hl(6, 26, 29, D); g.hl(5, 25, 28, K); },
    16: function (g) { notepad(g, 2, 0, 12, 15); }
  };

  I['text-file'] = {
    32: function (g) { page(g, 6, 1, 20, 29, 6); lines(g, 9, 10, 14, 8, 2, D); },
    16: function (g) { page(g, 2, 0, 11, 15, 4); lines(g, 4, 5, 6, 4, 2, D); }
  };

  I.doom = {
    32: function (g) {
      g.box(1, 1, 30, 30, K, K);
      g.shape(2, 2, 29, 29, function () { return true; }, function (x, y) {
        var f = 29 - y - 6 * Math.abs(Math.sin(x * 0.55)) - 3 * Math.abs(Math.sin(x * 1.3 + 1));
        var t = f + (bayer(x, y) - 0.5) * 3;
        return t < 0 ? Y : t < 4 ? '#ff8000' : t < 9 ? R : t < 15 ? M : K;
      }, null);
      // horns
      g.poly([[6, 4], [10, 12], [13, 10]], shade([W, L, D], 9, 8, 5), K);
      g.poly([[26, 4], [22, 12], [19, 10]], shade([W, L, D], 23, 8, 5), K);
      // skull
      g.shape(6, 7, 26, 29, function (x, y) {
        return (Math.hypot(x - 16, y - 15) <= 8.2 && y < 21) || (x > 10 && x < 22 && y >= 15 && y < 27 - Math.abs(x - 16) * 0.3);
      }, shade([W, W, L, D], 13, 13, 9), K);
      g.map(9, 13, [
        '..KKK...KKK..',
        '.KKRKK.KKRKK.',
        '.KRRRK.KRRRK.',
        '..KKK...KKK..',
        '.....K.K.....',
        '....KK.KK....',
        '.............',
        '..KWKWKWKWK..',
        '..KKKKKKKKK..',
        '..KWKWKWKWK..'
      ], {});
    },
    16: function (g) {
      g.map(0, 0, [
        'KKKKKKKKKKKKKKKK',
        'KKLKKKKKKKKKKLKK',
        'KKWLKKKKKKKKLDKK',
        'KMKWLKWWWKKLDKMK',
        'KMKKWWWWWWLDKKMK',
        'KMMKWWWWWLLLKMMK',
        'KRMKWKKWKKLLKMRK',
        'KRMKWKRWKRKLKMRK',
        'KRRKWLWKWLLDKRRK',
        'KRRRKLWKLLDKRRRK',
        'KORRKWKWKWKKRROK',
        'KOYRKKKKKKKKRYOK',
        'KYOYRKWKWKKRYOYK',
        'KYYYORKKKKROYYYK',
        'KYYYYYYOYYYYYYYK',
        'KKKKKKKKKKKKKKKK'
      ], { O: '#ff8000' });
    }
  };

  I.msdos = {
    32: function (g) {
      win(g, 1, 3, 30, 25, K, 4);
      g.rect(2, 2 + 2, 3, 3, L); g.px(3, 5, K);
      g.text(4, 11, 'C:\\>', L); g.hl(20, 22, 15, L);
      g.text(4, 18, 'DOS', L);
    },
    16: function (g) {
      win(g, 0, 1, 16, 14, K, 3);
      g.text(2, 7, 'C:\\', L);
    }
  };

  var MINE13 = [
    '......K......',
    '......K......',
    '..K.KKKKK.K..',
    '...KKKKKKK...',
    '..KKWWKKKKK..',
    '..KKWWKKKKK..',
    'KKKKKKKKKKKKK',
    '..KKKKKKKKK..',
    '..KKKKKKKKK..',
    '...KKKKKKK...',
    '..K.KKKKK.K..',
    '......K......',
    '......K......'
  ];
  I.minesweeper = {
    32: function (g) { g.raised(1, 1, 30, 30, L); g.map(3, 3, MINE13, null, 2); },
    16: function (g) { g.raised(0, 0, 16, 16, L); g.map(1, 1, MINE13); g.px(7, 1, L); g.px(7, 13, L); g.px(1, 7, L); g.px(13, 7, L); }
  };
  // 3D Pinball: a steel ball above a red flipper on a starry blue table.
  I.pinball = {
    32: function (g) {
      g.box(3, 1, 26, 30, N, K);
      g.rect(4, 2, 24, 3, B);
      [[8, 7], [22, 9], [14, 5], [25, 17], [6, 19]].forEach(function (p) { g.px(p[0], p[1], W); });
      g.disc(20, 12, 3, Y, K); g.disc(10, 14, 3, R, K);
      g.poly([[6, 25], [17, 22], [17, 25], [7, 28]], R, K);
      g.hl(8, 15, 24, W);
      g.disc(19, 19, 4, L, K); g.px(18, 17, W); g.px(17, 18, W); g.px(18, 18, W); g.px(21, 21, D); g.px(20, 22, D);
    },
    16: function (g) {
      g.box(1, 0, 14, 16, N, K);
      g.px(4, 3, W); g.px(11, 2, W); g.px(12, 8, W);
      g.disc(5, 6, 1.5, R, null);
      g.poly([[3, 13], [9, 11], [9, 13], [4, 15]], R, K);
      g.disc(10, 8, 2.5, L, K); g.px(9, 7, W);
    }
  };
  I.mine = {
    32: function (g) { g.map(3, 3, MINE13, null, 2); },
    16: function (g) { g.map(1, 1, MINE13); }
  };
  var FLAG16 = [
    '......RR..',
    '....RRRR..',
    '...RRRRR..',
    '....RRRR..',
    '......RR..',
    '.......K..',
    '.......K..',
    '.....KKKK.',
    '...KKKKKKKK'
  ];
  I.flag = {
    32: function (g) {
      g.poly([[18, 4], [18, 17], [6, 10.5]], R, null);
      g.rect(18, 4, 2, 22, K);
      g.rect(12, 23, 12, 2, K); g.rect(8, 25, 20, 3, K);
    },
    16: function (g) { g.map(2, 3, FLAG16, {}); }
  };

  function drive(g, x, y, w, h, d, kind) {
    driveBox(g, x, y, w, h, d);
    var fw = w - 2 * d, big = w > 16;
    if (kind === 'floppy') {
      g.hl(x + 3, x + fw - 4, y + d + Math.round((h - d) * 0.45), K);
      g.hl(x + 3, x + fw - 4, y + d + Math.round((h - d) * 0.45) + 1, W);
      g.box(x + fw - (big ? 7 : 4), y + h - (big ? 4 : 3), big ? 3 : 2, big ? 2 : 1, D);
    } else if (kind === 'hdd') {
      g.px(x + 3, y + h - 3, LG); if (big) { g.px(x + 4, y + h - 3, LG); g.hl(x + 7, x + fw - 3, y + h - 3, D); }
    } else {
      g.hl(x + 2, x + fw - 3, y + d + Math.round((h - d) * 0.4), D);
      g.hl(x + 2, x + fw - 3, y + d + Math.round((h - d) * 0.4) + 1, W);
      g.px(x + fw - 4, y + h - 3, big ? LG : G); if (big) g.hl(x + 3, x + 7, y + h - 3, D);
    }
  }
  function cd(g, cx, cy, rx, ry) {
    g.ellipse(cx, cy, rx, ry, function (x, y) {
      var a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx), k = (a + Math.PI) / (2 * Math.PI);
      var band = [W, L, C, W, L, PK, W, Y, L, W, C, L][Math.floor(k * 12) % 12];
      return band;
    }, K);
    g.ellipse(cx, cy, rx * 0.28, ry * 0.3, D, K);
    g.ellipse(cx, cy, rx * 0.12, ry * 0.1, '#000001', null);
  }
  I['drive-floppy'] = {
    32: function (g) {
      drive(g, 1, 14, 30, 13, 3, 'floppy');
      g.poly([[8, 3], [22, 3], [24, 5], [24, 16], [8, 16]], N, K);
      g.rect(12, 4, 8, 5, L); g.rect(16, 5, 2, 3, D);
      g.rect(10, 11, 12, 5, W); g.hl(11, 20, 12, D);
    },
    16: function (g) {
      drive(g, 0, 7, 16, 7, 2, 'floppy');
      g.box(4, 1, 8, 7, N, K); g.rect(6, 2, 4, 2, L); g.rect(5, 5, 6, 2, W);
    }
  };
  I['drive-hdd'] = {
    32: function (g) { drive(g, 1, 9, 30, 15, 4, 'hdd'); },
    16: function (g) { drive(g, 0, 4, 16, 8, 2, 'hdd'); }
  };
  I['drive-cd'] = {
    32: function (g) { drive(g, 1, 16, 30, 13, 3, 'cd'); cd(g, 15, 10, 13, 6.5); },
    16: function (g) {
      drive(g, 0, 8, 16, 7, 2, 'cd');
      g.map(2, 1, ['...KKKKKK...', '.KKWWCLLpKK.', 'KWLCWKKWLpLK', 'KLWLWKKLWYWK', '.KKLLWLWCKK.', '...KKKKKK...']);
    }
  };

  I['control-panel'] = {
    32: function (g) {
      folder(g, 1, 5, 30, 22);
      monitor(g, 12, 13, 13, 11, null); g.rect(15, 23, 7, 2, L); g.frame(14, 23, 9, 2, K);
      // screwdriver
      g.line(4, 12, 11, 19, K); g.line(5, 12, 12, 19, L);
      g.poly([[11, 18.5], [15.5, 23], [12.5, 26], [8, 21.5]], R, K); g.px(11, 21, '#ff8080');
    },
    16: function (g) {
      folder(g, 0, 1, 15, 12);
      g.map(6, 6, ['KKKKKKKKK', 'KLLLLLLLK', 'KLTTTTTDK', 'KLCTTTTDK', 'KLTTTTTDK', 'KDDDDDDDK', 'KKKKKKKKK', '..KDDDK..', '.KKKKKKK.']);
    }
  };

  function printer(g, x, y, w, big) {
    var h = big ? 12 : 7, pw = Math.round(w * 0.6);
    page(g, x + Math.round((w - pw) / 2), y - (big ? 9 : 5), pw, big ? 11 : 6, 0);
    if (big) lines(g, x + Math.round((w - pw) / 2) + 2, y - 6, pw - 4, 2, 2, D);
    g.poly([[x + (big ? 3 : 2), y], [x + w - (big ? 3 : 2), y], [x + w, y + (big ? 4 : 2)], [x, y + (big ? 4 : 2)]], L, K);
    g.raised(x, y + (big ? 4 : 2), w, h - (big ? 4 : 2), L);
    g.hl(x + 3, x + w - 4, y + (big ? 7 : 4), K);
    g.px(x + w - 4, y + h - 3, LG);
    g.rect(x + 2, y + h, w - 4, big ? 2 : 1, W); g.frame(x + 1, y + h - 1, w - 2, big ? 4 : 2, K);
  }
  I.printers = {
    32: function (g) { folder(g, 1, 3, 30, 20); printer(g, 7, 17, 22, true); },
    16: function (g) {
      folder(g, 0, 1, 14, 11);
      g.map(4, 8, ['...KKKKKK...', '...KWWWWK...', '..KKWDDWKK..', '.KWWWWWWWLK.', 'KWLLLLLLLLDK', 'KLLLLLLLLgDK', 'KDDDDDDDDDDK', 'KKKKKKKKKKKK']);
    }
  };

  I.exe = {
    32: function (g) { win(g, 2, 4, 28, 24); },
    16: function (g) { win(g, 1, 2, 14, 12); }
  };

  I['sys-file'] = {
    32: function (g) { page(g, 5, 1, 20, 29, 6); lines(g, 8, 9, 12, 3, 2, D); gear(g, 13, 14, 17); },
    16: function (g) {
      page(g, 1, 0, 11, 15, 4); g.hl(3, 7, 4, D); g.hl(3, 6, 6, D);
      g.map(6, 7, ['..K.K..', '.KLKLK.', 'KLWLDLK', '.LLKLL.', 'KLDDDDK', '.KDKDK.', '..K.K..'], {});
    }
  };
  I['bat-file'] = {
    32: function (g) { win(g, 1, 3, 26, 22); lines(g, 4, 10, 10, 3, 3, D); gear(g, 15, 15, 17); },
    16: function (g) {
      win(g, 0, 1, 14, 11);
      g.map(8, 8, ['..K.K..', '.KLKLK.', 'KLWLDLK', '.LLKLL.', 'KLDDDDK', '.KDKDK.', '..K.K..'], {});
    }
  };
  I['wad-file'] = {
    32: function (g) {
      page(g, 5, 1, 20, 29, 6);
      g.box(9, 11, 6, 6, R, K); g.box(16, 11, 6, 6, LG, K); g.box(9, 18, 6, 6, B, K); g.box(16, 18, 6, 6, Y, K);
      g.px(10, 12, '#ff8080'); g.px(17, 12, W); g.px(10, 19, C); g.px(17, 19, W);
    },
    16: function (g) { page(g, 2, 0, 11, 15, 4); g.box(4, 6, 4, 4, R, K); g.box(7, 9, 4, 4, B, K); g.box(4, 10, 3, 3, LG, K); }
  };

  function book(g, x, y, w, h, t) { // t = page thickness
    g.box(x + t, y + t, w - t, h - t, W, K);
    for (var i = 1; i < t; i++) { g.hl(x + t + 1, x + w - 2, y + h - 1 - i, i % 2 ? L : W); g.vl(x + w - 1 - i, y + t + 1, y + h - 2, i % 2 ? L : W); }
    g.box(x, y, w - t, h - t, B, K);
    g.rect(x + 1, y + 1, Math.max(1, Math.round(t / 1.5)), h - t - 2, N);
    g.vl(x + 1 + Math.max(1, Math.round(t / 1.5)), y + 1, y + h - t - 2, '#6060ff');
    g.hl(x + 2, x + w - t - 2, y + 1, '#6060ff');
  }
  I.help = {
    32: function (g) {
      book(g, 4, 2, 24, 28, 4);
      g.map(11, 7, ['.KKKKK.', 'KYYYYYK', 'YYKKKYY', 'KK..KYY', '...KYYK', '..KYYK.', '..KYYK.', '...KK..', '..KYYK.', '..KYYK.', '...KK..'], { K: N });
    },
    16: function (g) {
      book(g, 1, 0, 14, 16, 2);
      g.map(5, 3, ['.YYY.', 'Y...Y', '...Y.', '..Y..', '.....', '..Y..']);
    }
  };

  function arrowRight(g, x, y, col) {
    g.poly([[x, y + 3], [x + 6, y + 3], [x + 6, y], [x + 11, y + 5], [x + 6, y + 10], [x + 6, y + 7], [x, y + 7]], col || LG, K);
  }
  I.run = {
    32: function (g) {
      win(g, 7, 4, 24, 21);
      arrowRight(g, 1, 12, LG);
      g.px(3, 16, W); g.hl(2, 7, 16, '#80ff80');
    },
    16: function (g) { win(g, 4, 1, 12, 12); g.map(0, 5, ['...K...', '...KK..', 'KKKKgK.', 'KggggGK', 'KKKKGK.', '...KK..', '...K...']); }
  };
  I.find = {
    32: function (g) { page(g, 3, 1, 19, 26, 5); lines(g, 6, 8, 12, 7, 2, D); mag(g, 18, 18, 6, 6); },
    16: function (g) { page(g, 1, 0, 10, 13, 3); mag(g, 9, 9, 3.2, 3); }
  };
  I.settings = {
    32: function (g) { folder(g, 1, 3, 30, 22); gear(g, 13, 11, 19); },
    16: function (g) {
      folder(g, 0, 1, 15, 12);
      g.map(8, 8, ['..K.K..', '.KLKLK.', 'KLWLDLK', '.LLKLL.', 'KLDDDDK', '.KDKDK.', '..K.K..'], {});
    }
  };
  I.documents = {
    32: function (g) { folder(g, 1, 3, 26, 20); page(g, 13, 9, 16, 21, 5); lines(g, 16, 16, 9, 6, 2, D); },
    16: function (g) { folder(g, 0, 1, 13, 11); page(g, 7, 5, 8, 10, 3); g.hl(9, 12, 9, D); g.hl(9, 11, 11, D); }
  };
  I.programs = {
    32: function (g) { folder(g, 1, 3, 26, 20); win(g, 11, 12, 20, 17); g.rect(14, 18, 4, 4, T); },
    16: function (g) { folder(g, 0, 1, 13, 11); win(g, 5, 6, 11, 9); }
  };
  I.favorites = {
    32: function (g) { folder(g, 1, 3, 30, 22); star(g, 20, 19, 10, 4.2, Y); },
    16: function (g) { folder(g, 0, 1, 15, 11); star(g, 10.5, 10.5, 5.6, 2.3, Y); }
  };
  I['windows-update'] = {
    32: function (g) { globe(g, 13, 13, 12); win(g, 15, 16, 16, 14); g.rect(19, 21, 3, 3, R); g.rect(23, 20, 3, 3, LG); g.rect(19, 25, 3, 3, B); g.rect(23, 24, 3, 3, Y); },
    16: function (g) { globe(g, 6.5, 6.5, 6.3); win(g, 7, 8, 9, 8, W, 2); }
  };
  I.shutdown = {
    32: function (g) {
      monitor(g, 3, 1, 26, 21, function (x, y, w, h) {
        g.rect(x, y, w, h, N);
        g.disc(x + w / 2 + 1, y + h / 2, 5.5, Y, null); g.disc(x + w / 2 + 3.5, y + h / 2 - 2, 5, N, null);
        g.px(x + 3, y + 3, W); g.px(x + w - 3, y + h - 3, W); g.px(x + w - 5, y + 2, W);
      });
      g.box(10, 22, 12, 2, L, K); g.raised(2, 24, 28, 6, L); g.px(5, 27, LG);
    },
    16: function (g) {
      monitor(g, 1, 0, 14, 11, function (x, y, w, h) {
        g.rect(x, y, w, h, N);
        g.map(x + 3, y + 1, ['.YY.', 'YY..', 'YY..', 'YY..', '.YY.'], {}); g.px(x + w - 2, y + 1, W);
      });
      g.box(5, 11, 6, 1, K); g.raised(0, 12, 16, 4, L);
    }
  };
  I.logoff = {
    32: function (g) {
      // gold key, diagonal
      g.disc(10, 10, 7.5, shade([Y, Y, '#e0c000', O], 10, 10, 7.5), K);
      g.disc(8.5, 8.5, 2.2, null, null); g.clear(7, 7, 3, 3); g.frame(6, 6, 5, 5, K); g.clear(7, 7, 3, 3);
      g.poly([[14, 12], [16, 10], [29, 23], [27, 25]], function (x, y) { return x - y > 3 ? Y : O; }, K);
      g.poly([[22, 20], [24, 18], [27, 21], [25, 23]], O, null);
      g.poly([[20, 23], [23, 20], [26, 24], [23, 27]], shade([Y, O], 23, 23, 3), K);
      g.poly([[25, 25], [27, 23], [29, 26], [27, 28]], shade([Y, O], 27, 26, 3), K);
    },
    16: function (g) {
      g.map(0, 0, [
        '..KKKK..........',
        '.KYYYYK.........',
        'KYYKKYOK........',
        'KYK..KOK........',
        'KYK..KOK........',
        'KYOKKOOK........',
        '.KOOOOOKK.......',
        '..KKKKOYYK......',
        '.......KOYK.....',
        '........KOYK....',
        '.........KOYK...',
        '........KKKOYK..',
        '........KYKKOYK.',
        '.........KYYKOK.',
        '..........KYKK..',
        '...........KK...'
      ], {});
    }
  };
  I.display = {
    32: function (g) {
      monitor(g, 2, 2, 28, 22, function (x, y, w, h) {
        g.rect(x, y + h - 2, w, 2, L); g.hl(x, x + w - 1, y + h - 2, W); g.rect(x + 1, y + h - 1, 3, 1, D);
        g.rect(x + 2, y + 2, 2, 2, Y); g.rect(x + 2, y + 6, 2, 2, W);
        win(g, x + 7, y + 3, 12, 9, W, 2);
      });
      g.rect(11, 24, 10, 2, D); g.hl(11, 20, 24, K); g.raised(7, 26, 18, 4, L);
    },
    16: function (g) {
      monitor(g, 1, 0, 14, 12, function (x, y, w, h) { g.hl(x, x + w - 1, y + h - 1, L); g.px(x + 1, y + 1, W); g.rect(x + 4, y + 2, 4, 3, W); g.hl(x + 4, x + 7, y + 2, N); });
      g.box(5, 12, 6, 1, K); g.raised(3, 13, 10, 3, L);
    }
  };
  I.volume = {
    32: function (g) {
      g.poly([[4, 11], [10, 11], [18, 3], [18, 28], [10, 20], [4, 20]], shade([W, L, D], 11, 14, 10), K);
      g.vl(10, 11, 20, K); g.rect(5, 12, 5, 8, L); g.hl(5, 9, 19, D);
      g.hl(5, 9, 12, W);
      for (var i = 0; i < 3; i++) {
        var r = 5 + i * 4;
        g.shape(18, 2, 31, 30, (function (r) { return function (x, y) { var d = Math.hypot(x - 17, y - 15.5); return d <= r && d > r - 1.5 && x > 20; }; })(r), K, null);
      }
    },
    16: function (g) {
      g.map(0, 0, [
        '................',
        '.......K........',
        '......KK........',
        '.....KWK...K....',
        '.KKKKWLK....K...',
        '.KWWLLLK.K...K..',
        '.KWLLLLK..K..K..',
        '.KWLLLLK..K..K..',
        '.KWLLLLK..K..K..',
        '.KDDDDDK.K...K..',
        '.KKKKDDK....K...',
        '.....KDK...K....',
        '......KK........',
        '.......K........',
        '................',
        '................'
      ], {});
    }
  };

  // --- message box icons ---
  function shadowDisc(g, cx, cy, r) { g.disc(cx + 2, cy + 2, r, D, null); }
  I.error = {
    32: function (g) {
      shadowDisc(g, 15, 15, 13);
      g.disc(15, 15, 13, function (x, y) { return (x - 15) + (y - 15) > 12 ? M : R; }, K);
      for (var i = -5; i <= 5; i++) {
        g.rect(15 + i - 1, 15 + i - 1, 3, 2, W); g.rect(15 + i - 1, 15 - i - 1, 3, 2, W);
      }
    },
    16: function (g) {
      g.disc(8.5, 8.5, 7, D, null);
      g.disc(7.5, 7.5, 7, R, K);
      for (var i = -3; i <= 3; i++) { g.rect(7 + i, 7 + i, 2, 1, W); g.rect(7 + i, 7 - i, 2, 1, W); }
    }
  };
  I.warning = {
    32: function (g) {
      g.poly([[17, 3], [31, 30], [3, 30]], D, null);
      g.poly([[15.5, 1], [29.5, 28], [1.5, 28]], function (x, y) { return y > 25 || x > 15 + (y - 1) * 0.5 - 1 ? '#e0e000' : Y; }, K);
      g.rect(14, 9, 3, 11, K); g.rect(14, 22, 3, 3, K);
    },
    16: function (g) {
      g.poly([[7.5, 0], [15, 15], [0, 15]], Y, K);
      g.rect(7, 5, 2, 5, K); g.rect(7, 11, 2, 2, K);
    }
  };
  function bubble(g, cx, cy, rx, ry, tail) { // white balloon with drop shadow
    g.poly(tail, D, null);
    g.ellipse(cx + 2, cy + 2, rx, ry, D, null);
    g.poly(tail, W, K);
    g.ellipse(cx, cy, rx, ry, W, K);
    g.poly([[tail[0][0] + 1, tail[0][1] - 2], [tail[1][0], tail[1][1] - 1], [tail[2][0] - 1, tail[2][1] - 2]], W, null);
  }
var BUBBLE16 = [
    '....KKKKKKK.....',
    '..KKWWWWWWWKK...',
    '.KWWWWWWWWWWWK..',
    'KWWWWWWWWWWWWWK.',
    'KWWWWWWWWWWWWWKD',
    'KWWWWWWWWWWWWWKD',
    'KWWWWWWWWWWWWWKD',
    'KWWWWWWWWWWWWWKD',
    '.KWWWWWWWWWWWKDD',
    '..KKWWWWWWWKKDD.',
    '...KWWKKKKKDDD..',
    '...KWKDDDDD.....',
    '...KKD..........',
    '...KD...........'
  ];
  I.info = {
    32: function (g) {
      bubble(g, 16, 13, 14, 11.5, [[8, 21], [7, 30], [16, 22]]);
      g.rect(14, 5, 4, 3, B); g.rect(13, 10, 5, 2, B); g.rect(15, 12, 3, 8, B); g.rect(13, 20, 7, 2, B);
    },
    16: function (g) {
      g.map(0, 0, BUBBLE16);
      g.rect(7, 2, 2, 2, B); g.rect(6, 5, 3, 1, B); g.rect(7, 6, 2, 4, B); g.rect(6, 10, 4, 1, B);
    }
  };
  I.question = {
    32: function (g) {
      bubble(g, 16, 13, 14, 11.5, [[8, 21], [7, 30], [16, 22]]);
      g.map(11, 4, [
        '..BBBBBB..', '.BBBBBBBB.', 'BBB....BBB', 'BBB....BBB', '......BBB.', '....BBBB..', '....BBB...', '....BBB...',
        '..........', '....BBB...', '....BBB...'
      ], {});
    },
    16: function (g) {
      g.map(0, 0, BUBBLE16);
      g.map(5, 2, ['.BBBB.', 'BB..BB', '...BB.', '..BB..', '......', '..BB..'], {});
    }
  };

  I['windows-flag'] = {
    32: function (g) {
      g.map(0, 2, [
        '..........KKK...................',
        '........KKRRRKK.....KKK.........',
        '.......KRRRRRRRKK.KKgggKK.......',
        '..K..K.KRRRRRRRRRKgggggggKK.....',
        '.......KRRRRRRRRRKggggggggggK...',
        'K..K.K.KRRRRRRRRRKggggggggggK...',
        '......KRRRRRRRRRKggggggggggK....',
        '.K..K.KRRRRRRRRRKggggggggggK....',
        '......KRRRRRRRRRKggggggggggK....',
        'K..K.KRRRRRRRRRKggggggggggK.....',
        '.....KKKKRRRRRKKggggggggggK.....',
        '.K..K.KKKKKKKKKKKKKgggggKK......',
        '.....KKBBBKKK.KKKKKKKKKK........',
        'K..K.KBBBBBBBKKYYYYKKKKK........',
        '.....KBBBBBBBBBKYYYYYYYYYK......',
        '.K.K.KBBBBBBBBKYYYYYYYYYYK......',
        '....KBBBBBBBBBKYYYYYYYYYYK......',
        'K.K.KBBBBBBBBBKYYYYYYYYYK.......',
        '....KBBBBBBBBBKYYYYYYYYYK.......',
        '.K.KBBBBBBBBBKYYYYYYYYYYK.......',
        '...KKKBBBBBBKKYYYYYYYYYK........',
        '......KKKKKKKKKKYYYYYKK.........',
        '................KKKKK...........'
      ], {});
    },
    16: function (g) {
      g.map(0, 1, [
        '.....KKK........',
        '....KRRRK.KKK...',
        '.K.KRRRRKKgggK..',
        '...KRRRRKggggK..',
        'K.KRRRRKggggK...',
        '..KRRRRKggggK...',
        '.K.KKKKKKggK....',
        '...KBBBKKKKK....',
        'K.KBBBBKYYYK....',
        '..KBBBBKYYYYK...',
        '.KBBBBKYYYYK....',
        '..KBBBKYYYYK....',
        '...KKK.KKKK.....'
      ], {});
    }
  };

  // ---- AOL-era toolbar icons & sign-on artwork ---------------------------
  var SKIN = ['#ffe0c0', '#ffcc99', '#ffcc99', '#d09060'], YHEAD = [W, Y, Y, '#d0b000'],
      REDS = ['#ff8080', R, R, M], GRNS = ['#80ff80', LG, G, G], BLUS = ['#8080ff', B, B, N],
      GOLD = [W, Y, Y, '#e0c000', O], BROWN = '#804000', WOOD = '#c06020', PINK = '#ff8080';

  function segDist(px, py, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    var t = l ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l)) : 0;
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  }
  // union of thick polylines / discs: parts = [[points], radius]; one outline around the lot
  function limbs(g, parts, fill, box) {
    g.shape(box[0], box[1], box[2], box[3], function (x, y) {
      for (var i = 0; i < parts.length; i++) {
        var pts = parts[i][0], r = parts[i][1];
        if (pts.length === 1 && Math.hypot(x - pts[0][0], y - pts[0][1]) <= r) return true;
        for (var j = 0; j + 1 < pts.length; j++) if (segDist(x, y, pts[j], pts[j + 1]) <= r) return true;
      }
      return false;
    }, fill, K);
  }
  // the yellow running man, fitted to an s x s square at (x,y)
  function runner(g, x, y, s) {
    function P(u, v) { return [x + u * s, y + v * s]; }
    var lw = Math.max(1.3, s * 0.07), box = [x, y, x + s - 1, y + s - 1];
    limbs(g, [
      [[P(.55, .33), P(.38, .43), P(.20, .37)], lw],
      [[P(.46, .60), P(.30, .74), P(.10, .68)], lw]
    ], shade(['#fff080', '#f0c800', '#d0a000'], x + s * 0.3, y + s * 0.5, s * 0.3), box);
    limbs(g, [
      [[P(.67, .16)], s * 0.125],
      [[P(.60, .32), P(.46, .60)], lw * 1.4],
      [[P(.59, .35), P(.77, .46), P(.90, .33)], lw],
      [[P(.46, .60), P(.68, .72), P(.62, .92), P(.76, .93)], lw]
    ], shade([W, Y, Y, Y, '#e0c000'], x + s * 0.55, y + s * 0.4, s * 0.5), box);
  }
  // head-and-shoulders bust; top = top of head, s = height
  function person(g, cx, top, s, shirt, hair, skin) {
    var hr = s * 0.25, hy = top + hr, sy = top + s, rx = s * 0.47, ry = s * 0.47;
    g.shape(Math.floor(cx - rx) - 1, Math.floor(sy - ry) - 1, Math.ceil(cx + rx) + 1, Math.ceil(sy), function (x, y) {
      var a = (x - cx) / rx, b = (y - sy) / ry; return a * a + b * b <= 1 && y < sy;
    }, shade(shirt, cx - rx * 0.3, sy - ry * 0.6, rx), K);
    var sk = shade(skin || SKIN, cx - hr * 0.3, hy - hr * 0.3, hr);
    g.disc(cx, hy, hr, function (x, y) { return hair && y + 0.5 < hy - hr * 0.35 ? hair : sk(x, y); }, K);
    if (s >= 20) {
      var e = Math.max(1, Math.round(hr * 0.38)), fy = Math.round(hy + hr * 0.05);
      g.px(Math.round(cx - 0.5) - e, fy, K); g.px(Math.round(cx - 0.5) + e, fy, K);
      g.px(Math.round(cx - 0.5) - e, fy + e, K); g.px(Math.round(cx - 0.5) + e, fy + e, K);
      g.hl(Math.round(cx - 0.5) - e + 1, Math.round(cx - 0.5) + e - 1, fy + e + 1, K);
    }
  }
  function heart(g, cx, cy, s) {
    var r = s * 0.27, ty = cy - s * 0.12;
    g.shape(Math.floor(cx - s / 2) - 1, Math.floor(cy - s / 2) - 1, Math.ceil(cx + s / 2) + 1, Math.ceil(cy + s / 2) + 1, function (x, y) {
      if (Math.hypot(x - (cx - s * 0.23), y - ty) <= r || Math.hypot(x - (cx + s * 0.23), y - ty) <= r) return true;
      return y >= ty && Math.abs(x - cx) <= (cy + s * 0.46 - y) * 0.92;
    }, shade(REDS, cx - s * 0.1, cy - s * 0.1, s * 0.45), K);
    if (s >= 10) g.px(Math.round(cx - s * 0.3), Math.round(ty - r * 0.3), W);
  }
  function envelope(g, x, y, w, h, col) {
    g.box(x, y, w, h, col || W, K);
    g.hl(x + 1, x + w - 2, y + h - 2, L); g.vl(x + w - 2, y + 1, y + h - 2, L);
    var m = Math.round(h * 0.6);
    g.line(x + 1, y + h - 2, x + Math.round(w * 0.38), y + Math.round(h * 0.45), L);
    g.line(x + w - 2, y + h - 2, x + w - 1 - Math.round(w * 0.38), y + Math.round(h * 0.45), L);
    g.line(x + 1, y + 1, x + Math.floor((w - 1) / 2), y + m, K);
    g.line(x + w - 2, y + 1, x + Math.ceil((w - 1) / 2), y + m, K);
  }
  function floppy(g, x, y, s) {
    g.box(x, y, s, s, N, K);
    var sx = x + Math.round(s * 0.28), sw = Math.round(s * 0.5), sh = Math.round(s * 0.36);
    g.rect(sx, y + 1, sw, sh, L); g.rect(sx + sw - Math.round(s * 0.2), y + 2, Math.max(1, Math.round(s * 0.12)), sh - 2, N);
    var lh = Math.round(s * 0.42);
    g.rect(x + 2, y + s - lh, s - 4, lh - 1, W); g.hl(x + 3, x + s - 4, y + s - lh + 2, '#8080ff');
  }
  // pencil with its tip at (x,y), body running up-right for n pixels
  function pencil(g, x, y, n, w) {
    function uv(px, py) { var dx = px - x, dy = y - py; return [(dx + dy) / Math.SQRT2, (dx - dy) / Math.SQRT2]; }
    var U = n * Math.SQRT2;
    g.shape(x - 2, y - n - 2, x + n + 2, y + 2, function (px, py) {
      var t = uv(px, py), hw = t[0] < w * 1.8 ? t[0] / 1.8 : w;
      return t[0] >= -0.2 && t[0] <= U && Math.abs(t[1]) <= hw + 0.3;
    }, function (px, py) {
      var t = uv(px + 0.5, py + 0.5);
      if (t[0] < w * 0.8) return K;
      if (t[0] < w * 1.8) return '#ffe0a0';
      if (t[0] > U - w * 1.3) return PINK;
      if (t[0] > U - w * 2.3) return L;
      return t[1] > w * 0.35 ? '#ffff80' : (t[1] < -w * 0.35 ? '#e0a000' : Y);
    }, K);
  }
  function balloon(g, cx, cy, rx, ry, tail, fill) {
    g.poly(tail, fill, K);
    g.ellipse(cx, cy, rx, ry, fill, K);
    g.poly([[tail[0][0] + 1, tail[0][1] - 2], [tail[1][0], tail[1][1] - 1], [tail[2][0] - 1, tail[2][1] - 2]], fill, null);
  }
  function octagon(cx, cy, r) {
    var p = [];
    for (var i = 0; i < 8; i++) { var a = Math.PI / 8 + i * Math.PI / 4; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return p;
  }
  function mirror(rows) { return rows.map(function (r) { return r.split('').reverse().join(''); }); }

  I['folder-up'] = {
    32: function (g) {
      folder(g, 1, 5, 30, 22);
      g.map(6, 9, [
        '....K....', '...KKK...', '..KKKKK..', '.KKKKKKK.', 'KKKKKKKKK',
        '...KKK...', '...KKK...', '...KKK...', '...KKKKKKKKKKKKKK', '...KKKKKKKKKKKKKK', '...KKKKKKKKKKKKKK'
      ]);
    },
    16: function (g) {
      folder(g, 0, 2, 15, 12);
      g.map(3, 6, ['..K.....', '.KKK....', 'KKKKK...', '..K.....', '..KKKKKK']);
    }
  };

  function mailbox(g, up) {
    g.box(15, 21, 5, 10, BROWN, K); g.vl(16, 22, 29, WOOD);
    // side of the half-cylinder
    g.shape(8, 7, 29, 22, function (x, y) { return x > 8 && x < 29 && y > 7.5 && y < 22; }, function (x, y) {
      var t = (y - 8) / 14 + (bayer(x, y) - 0.5) * 0.15;
      return t < 0.12 ? '#a0a0ff' : t < 0.3 ? '#4040ff' : t < 0.7 ? B : N;
    }, K);
    g.hl(10, 27, 9, W);
    // front door (arched)
    g.shape(2, 7, 13, 22, function (x, y) { return x > 2 && x < 13 && y < 22 && (y > 13 || Math.hypot(x - 7.5, y - 13) <= 5.4); },
      shade(['#c0c0ff', '#8080ff', '#4040ff', B], 6, 12, 6), K);
    g.rect(7, 14, 2, 3, K); g.px(7, 14, W);
    if (up) {
      g.rect(23, 2, 2, 12, R); g.frame(22, 1, 4, 14, K); g.vl(23, 2, 13, PINK);
      g.box(25, 1, 6, 6, R, K); g.hl(26, 29, 2, PINK);
      g.px(24, 14, K);
    } else {
      g.box(18, 12, 12, 3, R, K); g.hl(19, 28, 13, PINK); g.box(26, 12, 5, 7, R, K); g.px(27, 13, PINK);
    }
  }
  I['aol-read'] = {
    32: function (g) { mailbox(g, true); envelope(g, 1, 17, 9, 6); g.box(1, 17, 9, 6, null, K); },
    16: function (g) {
      g.map(0, 0, [
        '..........KKK...',
        '..........KRRKK.',
        '..........KRRRK.',
        '..KKKKKKKKKRKKK.',
        '.KWLKbbbbbKRKbK.',
        'KWLLKcccccKRKcK.',
        'KWLLKBBBBBBBBBK.',
        'KWLKKBBBBBBBBBK.',
        'KLLKKBBBBBBBBBK.',
        'KLLLKNNNNNNNNNK.',
        'KDDDKNNNNNNNNNK.',
        'KKKKKKKKKKKKKKK.',
        '.......KdK......',
        '.......KdK......',
        '.......KdK......',
        '......KKKKK.....'
      ], { b: '#a0a0ff', c: '#4040ff', d: BROWN });
    }
  };
  I['aol-read-empty'] = {
    32: function (g) { mailbox(g, false); },
    16: function (g) {
      g.map(0, 3, [
        '..KKKKKKKKKKKK..',
        '.KWLKbbbbbbbbK..',
        'KWLLKccccccccK..',
        'KWLLKBBBBBKKKKKK',
        'KWLKKBBBBBKRRRRK',
        'KLLKKBBBBBKKKRRK',
        'KLLLKNNNNNNNKRRK',
        'KDDDKNNNNNNNKKKK',
        'KKKKKKKKKKKKK...',
        '.......KdK......',
        '.......KdK......',
        '.......KdK......',
        '......KKKKK.....'
      ], { b: '#a0a0ff', c: '#4040ff', d: BROWN });
    }
  };
  I['aol-write'] = {
    32: function (g) {
      g.box(2, 7, 22, 23, W, K); g.vl(23, 8, 29, D); g.hl(3, 23, 29, D); g.hl(2, 23, 30, K);
      for (var i = 0; i < 6; i++) g.hl(5, 20 - (i === 5 ? 8 : 0), 11 + i * 3, '#8080ff');
      g.vl(6, 8, 28, PINK);
      g.line(8, 26, 10, 24, B); g.line(10, 24, 12, 26, B); g.line(12, 26, 14, 25, B);
      pencil(g, 14, 25, 17, 2.6);
    }
  };
  I['aol-mailcenter'] = {
    32: function (g) {
      envelope(g, 8, 3, 23, 15, '#ffffc0'); envelope(g, 5, 8, 23, 15, '#e0f0ff'); envelope(g, 1, 14, 24, 16);
      g.box(19, 16, 4, 5, R, K); g.px(20, 17, PINK);
    },
    16: function (g) { envelope(g, 4, 1, 12, 8, '#ffffc0'); envelope(g, 2, 4, 12, 8, '#e0f0ff'); envelope(g, 0, 7, 13, 9); }
  };
  I['aol-print'] = {
    32: function (g) {
      printer(g, 4, 15, 24, true);
      g.box(9, 7, 4, 3, R, null); g.box(13, 7, 4, 3, LG, null); g.box(17, 7, 4, 3, B, null);
    }
  };
  I['aol-myfiles'] = {
    32: function (g) {
      folder(g, 1, 4, 30, 22, function () { page(g, 5, 0, 14, 14, 4); g.rect(9, 3, 5, 5, '#ff8080'); page(g, 11, 2, 14, 14, 4); lines(g, 13, 7, 8, 3, 2, D); });
      floppy(g, 17, 16, 14);
    },
    16: function (g) { folder(g, 0, 2, 15, 12); floppy(g, 8, 7, 8); }
  };
  I['aol-myaol'] = {
    32: function (g) { person(g, 13, 2, 27, BLUS, null, YHEAD); heart(g, 24, 23, 13); }
  };
  I['aol-favorites'] = {
    32: function (g) { page(g, 3, 1, 19, 24, 5); lines(g, 6, 8, 11, 5, 2, D); heart(g, 20, 20, 19); },
    16: function (g) { page(g, 1, 0, 10, 13, 3); heart(g, 10, 10, 11); }
  };
  I['aol-internet'] = {
    32: function (g) {
      globe(g, 13, 13, 12);
      mag(g, 21, 21, 5, 5);
    }
  };
  I['aol-channels'] = {
    32: function (g) {
      g.line(15, 9, 9, 2, K); g.line(17, 9, 23, 1, K); g.px(9, 1, R); g.px(23, 0, R);
      g.raised(1, 9, 30, 20, '#d0b080'); g.hl(2, 29, 10, '#fff0c0'); g.vl(2, 10, 27, '#fff0c0');
      g.box(4, 12, 19, 14, K, null);
      g.box(5, 13, 8, 6, R, null); g.box(14, 13, 8, 6, LG, null); g.box(5, 19, 8, 6, B, null); g.box(14, 19, 8, 6, Y, null);
      g.px(5, 13, PINK); g.px(14, 13, '#c0ffc0'); g.px(5, 19, '#8080ff'); g.px(14, 19, W);
      g.disc(26.5, 15.5, 2, L, K); g.disc(26.5, 22.5, 2, L, K);
      g.rect(4, 29, 4, 2, K); g.rect(24, 29, 4, 2, K);
    }
  };
  I['aol-people'] = {
    32: function (g) {
      person(g, 8.5, 2, 16, GRNS, null, YHEAD); person(g, 23.5, 2, 16, REDS, null, YHEAD);
      person(g, 16, 9, 22, BLUS, null, YHEAD);
    }
  };
  I['aol-quotes'] = {
    32: function (g) {
      g.box(1, 2, 30, 27, W, K); g.hl(2, 29, 27, L); g.vl(29, 3, 27, L);
      for (var y = 7; y < 26; y += 5) g.hl(5, 27, y, '#c0e0ff');
      g.vl(4, 4, 26, K); g.hl(4, 28, 26, K);
      [5, 7, 6, 9, 12, 14].forEach(function (h, i) { g.box(7 + i * 3, 26 - h, 2, h, '#8080ff', null); });
      limbs(g, [[[[6, 21], [12, 17], [16, 19], [23, 10]], 1.3]], LG, [3, 3, 29, 28]);
      g.poly([[20, 7], [27, 5], [25, 12]], LG, K);
    }
  };
  I['aol-perks'] = {
    32: function (g) {
      g.ellipse(11, 7, 5, 3.5, shade([W, Y, Y, O], 10, 6, 5), K); g.ellipse(21, 7, 5, 3.5, shade([W, Y, Y, O], 20, 6, 5), K);
      g.box(3, 15, 26, 15, R, K); g.rect(4, 16, 1, 13, PINK); g.rect(26, 16, 2, 13, M);
      g.box(2, 10, 28, 6, R, K); g.hl(3, 28, 11, PINK); g.hl(3, 28, 14, M);
      g.box(14, 10, 5, 20, Y, K); g.vl(15, 11, 28, W); g.vl(17, 11, 28, O);
      g.box(13, 5, 7, 5, Y, K); g.hl(14, 18, 6, W);
    }
  };
  I['aol-weather'] = {
    32: function (g) {
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4 + 0.2;
        g.poly([[12 + Math.cos(a - 0.3) * 7.5, 12 + Math.sin(a - 0.3) * 7.5], [12 + Math.cos(a) * 11.5, 12 + Math.sin(a) * 11.5], [12 + Math.cos(a + 0.3) * 7.5, 12 + Math.sin(a + 0.3) * 7.5]], '#ff8000', K);
      }
      g.disc(12, 12, 7, shade([W, Y, Y, '#ffc000'], 12, 12, 7), K);
      limbs(g, [[[[14, 23]], 5.2], [[[21, 18.5]], 6.4], [[[26.5, 23]], 4.6], [[[12, 26], [27, 26]], 3.4]], shade([W, W, W, L, D], 20, 20, 10), [5, 10, 31, 30]);
    }
  };
  function bigKey(g, s) { // s: 1 at 32px
    g.shape(0, 0, 32 * s - 1, 32 * s - 1, function (x, y) {
      x /= s; y /= s;
      var d = Math.hypot(x - 9, y - 16);
      if (d <= 7.5) return d > 2.6;
      return (x >= 15 && x < 30 && y >= 14 && y < 18.5) || (x >= 21 && x < 24 && y >= 18 && y < 23) || (x >= 26 && x < 29 && y >= 18 && y < 21.5);
    }, shade(GOLD, 14 * s, 14 * s, 17 * s), K);
  }
  I['aol-keyword'] = { 32: function (g) { bigKey(g, 1); } };
  I['aol-buddy'] = {
    32: function (g) { runner(g, 0, 0, 32); },
    16: function (g) {
      g.map(0, 0, [
        '.........KKK....',
        '........KWYYK...',
        '........KYYYK...',
        '.........KKK....',
        '.......KKK...KK.',
        '..KKK.KYYKKKKYK.',
        '.KYYKKYYYYYYYK..',
        '..KKKYYYKKKKK...',
        '....KYYK........',
        '...KYYYKK.......',
        '.KKYYKKYYK......',
        'KYYKK..KYK......',
        '.KK....KYK......',
        '.......KYKK.....',
        '.......KYYYK....',
        '........KKK.....'
      ]);
    }
  };
  I['aol-im'] = {
    32: function (g) {
      bubble(g, 16, 13, 14.5, 11, [[8, 21], [6, 30], [16, 23]]);
      g.text(7, 8, 'IM', N, 2);
    },
    16: function (g) { g.map(0, 0, BUBBLE16); g.text(3, 3, 'IM', N); }
  };
  I['aol-chat'] = {
    32: function (g) {
      balloon(g, 20, 10, 11, 8, [[23, 15], [28, 23], [17, 17]], '#ffff80');
      balloon(g, 12, 18, 11, 8, [[8, 23], [4, 31], [15, 25]], W);
      g.rect(7, 17, 2, 2, B); g.rect(11, 17, 2, 2, B); g.rect(15, 17, 2, 2, B);
      g.rect(18, 5, 2, 2, O); g.rect(22, 5, 2, 2, O);
    }
  };
  var ARROW16 = [
    '................',
    '.......K........',
    '......KK........',
    '.....KgK........',
    '....KggKKKKKKKK.',
    '...KgWgggggggggK',
    '..KgWggggggggggK',
    '.KgggggggggggGGK',
    '..KgGGGGGGGGGGGK',
    '...KgGGGGGGGGGGK',
    '....KgGKKKKKKKK.',
    '.....KGK........',
    '......KK........',
    '.......K........'
  ];
  function bigArrow(g, flip) {
    var pts = [[1, 16], [14, 3], [14, 10], [30, 10], [30, 23], [14, 23], [14, 29]];
    if (flip) pts = pts.map(function (p) { return [32 - p[0], p[1]]; });
    g.poly(pts, shade(['#c0ffc0', LG, LG, G, G], 16, 14, 13), K);
  }
  I['aol-back'] = { 32: function (g) { bigArrow(g, false); }, 16: function (g) { g.map(0, 1, ARROW16); } };
  I['aol-forward'] = { 32: function (g) { bigArrow(g, true); }, 16: function (g) { g.map(0, 1, mirror(ARROW16)); } };
  I['aol-stop'] = {
    32: function (g) {
      g.poly(octagon(16, 16, 15.5), W, K);
      g.poly(octagon(16, 16, 13.2), shade(REDS, 16, 16, 13), null);
      for (var i = -5; i <= 5; i++) { g.rect(15 + i, 15 + i, 3, 2, W); g.rect(15 + i, 15 - i, 3, 2, W); }
    },
    16: function (g) {
      g.poly(octagon(8, 8, 8), R, K);
      for (var i = -3; i <= 3; i++) { g.rect(7 + i, 7 + i, 2, 2, W); g.rect(7 + i, 8 - i, 2, 1, W); g.rect(7 + i, 7 - i, 2, 1, W); }
    }
  };
  var RELOAD16 = [
    '................',
    '.....KKKKK......',
    '...KKgggggKK....',
    '..KggKKKKKggK...',
    '.KgKK....KggK...',
    '.KgK...KgggggK..',
    '.KgK....KgggK...',
    '.KKK.K...KgK....',
    '....KBK...K.KKK.',
    '...KBBBK....KBK.',
    '..KBBBBBK...KBK.',
    '...KBBK....KKBK.',
    '...KBBKKKKKBBK..',
    '....KKBBBBBKK...',
    '......KKKKK.....',
    '................'
  ];
  I['aol-reload'] = {
    32: function (g) { g.map(0, 0, RELOAD16, null, 2); },
    16: function (g) { g.map(0, 0, RELOAD16); }
  };
  I['aol-home'] = {
    32: function (g) {
      g.box(21, 3, 5, 9, WOOD, K); g.hl(21, 25, 3, K); g.vl(22, 4, 10, '#ff9040');
      g.box(5, 15, 22, 15, '#ffffc0', K); g.vl(6, 16, 28, W); g.vl(25, 16, 28, '#e0d080'); g.hl(6, 25, 28, '#e0d080');
      g.poly([[0.5, 17], [16, 2], [31.5, 17]], function (x, y) { return y > 14 ? M : (x - 16) + (y - 9) * 0.3 > 3 ? M : R; }, K);
      g.box(9, 20, 7, 10, WOOD, K); g.vl(10, 21, 28, '#ff9040'); g.px(14, 25, Y);
      g.box(18, 19, 6, 6, C, K); g.hl(18, 23, 21, K); g.vl(20, 19, 24, K); g.px(19, 20, W);
    },
    16: function (g) {
      g.map(0, 0, [
        '................',
        '.......KK..KKK..',
        '......KRRK.KoK..',
        '.....KRRRRKKoK..',
        '....KRRRRRRKoK..',
        '...KRRRRRRRRKK..',
        '..KRRRRRRRRRRK..',
        '.KRMMMMMMMMMMRK.',
        'KKKKKKKKKKKKKKKK',
        '..KWyyyyyyyyyK..',
        '..KWKKKyyKKKyK..',
        '..KWKoKyyKCKyK..',
        '..KWKoKyyKKKyK..',
        '..KWKoKyyyyyyK..',
        '..KWKoKssssssK..',
        '..KKKKKKKKKKKK..'
      ], { o: WOOD, y: '#ffffc0', s: '#e0d080' });
    }
  };
  I.envelope = {
    32: function (g) { envelope(g, 1, 7, 30, 19); },
    16: function (g) { envelope(g, 0, 3, 16, 10); }
  };
  I['envelope-open'] = {
    32: function (g) {
      g.poly([[1, 13], [16, 1], [31, 13]], shade([W, L, L, D], 16, 7, 12), K);
      g.box(6, 5, 20, 16, W, K); lines(g, 9, 9, 13, 4, 2, D);
      g.box(1, 13, 30, 16, W, K);
      g.poly([[1, 13], [16, 23], [31, 13], [31, 29], [1, 29]], W, K);
      g.line(2, 28, 12, 20, L); g.line(29, 28, 20, 20, L);
    },
    16: function (g) {
      g.poly([[0, 7], [8, 0], [16, 7]], L, K);
      g.box(3, 2, 10, 8, W, K); g.hl(5, 10, 4, D); g.hl(5, 9, 6, D);
      g.poly([[0, 7], [8, 12], [16, 7], [16, 15], [0, 15]], W, K);
      g.line(1, 14, 5, 11, L); g.line(14, 14, 10, 11, L);
    }
  };
  I.door = {
    32: function (g) {
      g.box(5, 1, 22, 30, L, K); g.hl(6, 25, 2, W); g.vl(6, 2, 29, W); g.vl(25, 3, 29, D);
      g.box(8, 4, 16, 27, WOOD, K); g.vl(9, 5, 29, '#ff9040');
      g.frame(11, 7, 10, 8, BROWN); g.frame(11, 18, 10, 10, BROWN);
      g.disc(20.5, 17.5, 1.6, Y, K);
    },
    16: function (g) {
      g.map(0, 0, [
        '..KKKKKKKKKKKK..',
        '..KWWWWWWWWWLK..',
        '..KWKKKKKKKKDK..',
        '..KWKobbbbbKDK..',
        '..KWKbnnnnbKDK..',
        '..KWKbnbbnbKDK..',
        '..KWKbnnnnbKDK..',
        '..KWKbbbbbbKDK..',
        '..KWKbbbbYYKDK..',
        '..KWKbnnnnbKDK..',
        '..KWKbnbbnbKDK..',
        '..KWKbnbbnbKDK..',
        '..KWKbnnnnbKDK..',
        '..KWKbbbbbbKDK..',
        '..KWKKKKKKKKDK..',
        '..KKKKKKKKKKKK..'
      ], { b: WOOD, n: BROWN, o: '#ff9040' });
    }
  };

  // --- 64px sign-on artwork ---
  I['aol-step-modem'] = {
    64: function (g) {
      // lightning / signal
      g.poly([[46, 2], [60, 2], [53, 12], [60, 12], [42, 32], [48, 18], [41, 18]], shade([W, Y, Y, '#ffc000'], 50, 12, 14), K);
      // modem
      driveBox(g, 4, 40, 56, 20, 4);
      for (var i = 0; i < 6; i++) g.box(9 + i * 6, 52, 3, 2, i < 4 ? LG : G, K);
      g.hl(9, 42, 57, D); g.hl(9, 42, 58, W);
      // telephone base
      g.poly([[12, 24], [38, 24], [43, 41], [7, 41]], shade(['#f0e0c0', '#e0d0a0', '#c0b080', '#a09060'], 25, 30, 16), K);
      g.hl(13, 37, 25, W);
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) g.box(17 + c * 6, 28 + r * 4, 4, 3, W, K);
      // handset
      limbs(g, [[[[12, 17], [38, 17]], 3.6], [[[10, 21]], 5.2], [[[40, 21]], 5.2]], shade(['#f0e0c0', '#e0d0a0', '#c0b080', '#806040'], 25, 14, 16), [3, 11, 47, 28]);
      g.hl(10, 40, 14, W);
      // cord
      for (var t = 0; t < 12; t++) g.px(44 + (t % 2 ? 2 : 0), 24 + t, K);
    },
    32: function (g) {
      g.poly([[22, 1], [30, 1], [26, 6], [30, 6], [20, 16], [23, 9], [19, 9]], Y, K);
      driveBox(g, 2, 20, 28, 10, 2);
      g.px(5, 26, LG); g.px(8, 26, LG); g.px(11, 26, G);
      g.poly([[6, 12], [19, 12], [22, 21], [3, 21]], '#e0d0a0', K);
      g.rect(9, 15, 7, 4, W); g.hl(9, 15, 17, D); g.vl(12, 15, 18, D);
      limbs(g, [[[[6, 8], [19, 8]], 1.8], [[[5, 10]], 2.6], [[[20, 10]], 2.6]], '#c0b080', [1, 4, 24, 14]);
    }
  };
  I['aol-step-runner'] = {
    64: function (g) { runner(g, 1, 1, 62); },
    32: function (g) { runner(g, 0, 0, 32); }
  };
  function people3(g, s) {
    globe(g, 32 * s, 25 * s, 23 * s);
    person(g, 15 * s, 27 * s, 28 * s, REDS, BROWN);
    person(g, 49 * s, 27 * s, 28 * s, GRNS, '#ffd040');
    person(g, 32 * s, 31 * s, 33 * s, BLUS, K);
  }
  I['aol-step-people'] = {
    64: function (g) { people3(g, 1); },
    32: function (g) { people3(g, 0.5); }
  };
  I['aol-logo'] = {
    64: function (g) { aol(g, 32, 32, 30); },
    32: function (g) { aol(g, 16, 16, 14); },
    16: function (g) { I.aol[16](g); }
  };

  // ---- rendering / cache --------------------------------------------------
  var cache = {};
  function render(name, size) {
    var def = I[name];
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (def[size]) {
      def[size](new Pen(ctx));
    } else { // fallback: rescale the 32px drawing (or the nearest size that exists)
      var src = def[32] ? 32 : (def[64] ? 64 : 16), tmp = document.createElement('canvas');
      tmp.width = tmp.height = src;
      def[src](new Pen(tmp.getContext('2d')));
      ctx.imageSmoothingEnabled = src > size; // smooth when shrinking, nearest-neighbour when enlarging
      ctx.drawImage(tmp, 0, 0, size, size);
    }
    return cv.toDataURL('image/png');
  }

  window.Icons = {
    names: Object.keys(I),
    get: function (name, size) {
      size = +size === 16 ? 16 : +size === 64 ? 64 : 32;
      if (!I[name]) name = 'exe';
      var key = name + '@' + size;
      if (!cache[key]) {
        try { cache[key] = render(name, size); } catch (e) { cache[key] = ''; if (window.console) console.error('Icons: ' + name, e); }
      }
      return cache[key];
    }
  };
})();
