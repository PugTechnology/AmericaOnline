/*
 * 3D Pinball for Windows - Space Cadet (a tribute).
 *
 * An original table in the spirit of the Windows 98 classic. Every pixel is
 * drawn procedurally and every sound is synthesized with Web Audio: no
 * assets from the original game are used.
 *
 *   - Physics: fixed 120 Hz step with adaptive substeps, circle vs capsule
 *     collision for walls/flippers, circle vs circle for bumpers, flipper
 *     impulses from the surface velocity of the swinging bat.
 *   - Rendering: the flat playfield art is painted in "world" space and warped
 *     into a perspective trapezoid once; raised parts (rails, bumpers, flippers,
 *     ball, ramp) are projected and extruded every frame.
 */
(function () {
  'use strict';
  var h = U.h;

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  var CW = 600, CH = 460;           // logical canvas size
  var TW = 372;                     // width of the table area (panel is to the right)
  var WW = 360, WH = 640;           // world (physics) size of the table
  var BR = 7.5;                     // ball radius
  var GRAV = 1150;                  // units / s^2 along the table
  var DT = 1 / 120;                 // fixed physics step
  var FL_UP = 27, FL_DOWN = 15;     // flipper angular speed, rad/s
  var PL_REST = 612, PL_PULL = 28;  // plunger rest position and travel
  var SAVE_TIME = 10;               // ball save seconds after launch
  var SCORE_KEY = 'w98.pinball.scores', OPT_KEY = 'w98.pinball.options';
  var RANKS = ['Cadet', 'Ensign', 'Lieutenant', 'Captain', 'Lt Commander', 'Commander', 'Commodore', 'Admiral', 'Fleet Admiral'];
  var MISSIONS = [
    { name: 'Target Practice', ev: 'drop', n: 3, what: 'Drop targets' },
    { name: 'Launch Training', ev: 'ramp', n: 2, what: 'Launch ramp' },
    { name: 'Re-Entry Training', ev: 'bumper', n: 10, what: 'Attack bumpers' },
    { name: 'Science', ev: 'lanes', n: 1, what: 'Re-fuel lanes' },
    { name: 'Satellite Retrieval', ev: 'fuel', n: 3, what: 'Fuel targets' },
    { name: 'Orbit Survey', ev: 'orbit', n: 2, what: 'Orbits' },
    { name: 'Hyperspace Launch', ev: 'hyper', n: 2, what: 'Hyperspace' },
    { name: 'Cosmic Wave', ev: 'bumper', n: 20, what: 'Attack bumpers' }
  ];
  var HYPER_AWARDS = [5000, 10000, 25000, 50000];

  // ---------------------------------------------------------------------
  // Projection: world (x, y on the table, z height) -> logical screen px.
  // A true projective map (lines stay straight), top of the table recedes.
  // ---------------------------------------------------------------------
  var PJ = { k: 0.27, S: 0.97, cx: 186, Y0: 16, Hs: 436, Z: 0.55 };
  function pw(y) { return 1 + PJ.k * (1 - y / WH); }
  function P(x, y, z) {
    var w = pw(y);
    return [PJ.cx + PJ.S * (x - WW / 2) / w, PJ.Y0 + (PJ.Hs * y / WH - (z || 0) * PJ.Z * PJ.S) / w];
  }
  function kx(y) { return PJ.S / pw(y); }
  function ky(y) { var w = pw(y); return PJ.Hs / WH * (1 + PJ.k) / (w * w); }
  function unwarp(u) { return u * (1 + PJ.k) / (1 + u * PJ.k); }

  // ---------------------------------------------------------------------
  // Table geometry (static)
  // ---------------------------------------------------------------------
  var STYLE = {
    outer:  { side: ['#10183a', '#2c3a72'], top: '#7f93c8', hi: '#e6ecff', h: 16 },
    rail:   { side: ['#141f4a', '#34488e'], top: '#9db1e6', hi: '#ffffff', h: 11 },
    guide:  { side: ['#2a2f3a', '#6d7688'], top: '#dfe5f1', hi: '#ffffff', h: 10 },
    rubber: { side: ['#3a0606', '#8a1a12'], top: '#e0442e', hi: '#ffc0b0', h: 9 },
    sling:  { side: ['#6d6d6d', '#cfcfcf'], top: '#f4f4f4', hi: '#ffffff', h: 9 },
    ramp:   { side: ['#0c2d57', '#2a70b8'], top: '#8fd3ff', hi: '#ecfaff', h: 13 },
    gate:   { side: ['#3a3a3a', '#8a8a8a'], top: '#d0d0d0', hi: '#ffffff', h: 7 }
  };

  var SEGS = [];
  function seg(ax, ay, bx, by, kind, o) {
    o = o || {};
    var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var s = {
      ax: ax, ay: ay, bx: bx, by: by, dx: dx, dy: dy, l2: dx * dx + dy * dy, len: L,
      nx: dy / L, ny: -dx / L, t: o.t != null ? o.t : 2, e: o.e != null ? o.e : 0.42,
      kind: kind, one: !!o.one, tag: o.tag || null, idx: o.idx, draw: o.draw !== false
    };
    SEGS.push(s);
    return s;
  }
  function poly(pts, kind, o) {
    for (var i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], kind, o);
  }
  function mirror(pts) { return pts.map(function (p) { return [334 - p[0], p[1]]; }); }

  var ARC_C = [180, 180], ARC_R = 168;
  var OUTER = [[12, 670], [12, 180]];
  for (var ai = 1; ai <= 44; ai++) {
    var aa = Math.PI + Math.PI * ai / 44;
    OUTER.push([ARC_C[0] + ARC_R * Math.cos(aa), ARC_C[1] + ARC_R * Math.sin(aa)]);
  }
  OUTER.push([348, 670]);
  poly(OUTER, 'outer', { t: 1, e: 0.35 });

  // Plunger lane separator + one-way gate at its top.
  seg(322, 670, 322, 214, 'rail', { t: 2 });
  var GATE = seg(322, 214, 348, 200, 'gate', { t: 1.5, one: true, e: 0.2 });
  // Left orbit channel wall, deflectors at the bottom of both orbit channels.
  seg(40, 232, 40, 388, 'rail', { t: 2 });
  seg(12, 392, 32, 414, 'rubber', { t: 2.5, e: 0.6 });
  seg(322, 392, 302, 414, 'rubber', { t: 2.5, e: 0.6 });
  // Inlane / outlane separators feeding the flippers.
  var GUIDE_L = [[34, 462], [34, 524], [96, 560]];
  poly(GUIDE_L, 'rail', { t: 2 });
  poly(mirror(GUIDE_L), 'rail', { t: 2 });
  // Slingshots: two rubber sides and a kicking face.
  var SLING_L = { a: [58, 466], b: [58, 510], c: [90, 528] };
  var SLING_R = { a: [276, 466], b: [276, 510], c: [244, 528] };
  [SLING_L, SLING_R].forEach(function (s, i) {
    seg(s.a[0], s.a[1], s.b[0], s.b[1], 'rubber', { t: 2.5, e: 0.55 });
    seg(s.b[0], s.b[1], s.c[0], s.c[1], 'rubber', { t: 2.5, e: 0.55 });
    seg(s.c[0], s.c[1], s.a[0], s.a[1], 'sling', { t: 2.5, e: 0.5, tag: 'sling', idx: i });
  });
  // Top rollover lane guides.
  [116, 150, 184, 218].forEach(function (x) { seg(x, 56, x, 94, 'guide', { t: 3, e: 0.5 }); });
  // Launch ramp entrance.
  seg(248, 306, 250, 240, 'ramp', { t: 2 });
  seg(250, 240, 292, 232, 'ramp', { t: 2, e: 0.3 });
  seg(292, 232, 292, 300, 'ramp', { t: 2 });
  // Fuel stand-up targets on the plunger lane wall.
  var FUEL_Y = [335, 360, 385];
  FUEL_Y.forEach(function (y, i) { seg(319, y - 10, 319, y + 10, 'fuel', { t: 2, e: 0.35, tag: 'fuel', idx: i, draw: false }); });

  // Dynamic pieces.
  var DROP_Y = [272, 298, 324];
  var DROPS = DROP_Y.map(function (y, i) {
    var s = { ax: 44.5, ay: y - 10, bx: 44.5, by: y + 10, dx: 0, dy: 20, l2: 400, len: 20, nx: 1, ny: 0, t: 2.5, e: 0.3, kind: 'drop', tag: 'drop', idx: i };
    return s;
  });
  var BUMPERS = [
    { x: 128, y: 150, r: 17, cap: '#ff5a3c', ring: '#ffd0a0' },
    { x: 206, y: 150, r: 17, cap: '#ffc21c', ring: '#fff0a8' },
    { x: 167, y: 202, r: 17, cap: '#39d0ff', ring: '#c8f4ff' }
  ];
  var LANES = [[133, 80], [167, 80], [201, 80]];
  var SAUCER = { x: 70, y: 200 };
  var INLANES = [[46, 492], [288, 492]], OUTLANES = [[23, 500], [311, 500]];
  var PLANET = { x: 167, y: 378, r: 32 };

  // The launch ramp: a spline in (x, y, z), sampled with arc length.
  var RAMP = (function () {
    var K = [[271, 262, 0], [272, 226, 6], [276, 188, 14], [281, 150, 22], [278, 114, 28], [262, 88, 31], [238, 71, 30], [214, 62, 25], [201, 64, 19]];
    var pts = [];
    function cr(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    for (var i = 0; i < K.length - 1; i++) {
      var p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)];
      for (var s = 0; s < 8; s++) {
        var t = s / 8;
        pts.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t), cr(p0[2], p1[2], p2[2], p3[2], t)]);
      }
    }
    pts.push(K[K.length - 1].slice());
    var acc = 0;
    pts[0][3] = 0;
    for (var j = 1; j < pts.length; j++) {
      acc += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1], pts[j][2] - pts[j - 1][2]);
      pts[j][3] = acc;
    }
    return { pts: pts, len: acc };
  })();
  function rampAt(s) {
    var p = RAMP.pts;
    if (s <= 0) return p[0];
    for (var i = 1; i < p.length; i++) {
      if (p[i][3] >= s) {
        var a = p[i - 1], b = p[i], t = (s - a[3]) / ((b[3] - a[3]) || 1);
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
    }
    return p[p.length - 1];
  }

  // ---------------------------------------------------------------------
  // Lamps (inserts): world polygons + a function saying how lit they are.
  // ---------------------------------------------------------------------
  function circlePts(x, y, r, n) {
    var a = [];
    n = n || 16;
    for (var i = 0; i < n; i++) a.push([x + r * Math.cos(i / n * Math.PI * 2), y + r * Math.sin(i / n * Math.PI * 2)]);
    return a;
  }
  function arrowPts(x, y, ang, s) {
    var base = [[0, -1.2], [0.85, 0.15], [0.38, 0.15], [0.38, 1], [-0.38, 1], [-0.38, 0.15], [-0.85, 0.15]];
    var c = Math.cos(ang), sn = Math.sin(ang);
    return base.map(function (p) { var px = p[0] * s, py = p[1] * s; return [x + px * c - py * sn, y + px * sn + py * c]; });
  }
  function triPts(x, y, ang, s) {
    var c = Math.cos(ang), sn = Math.sin(ang);
    return [[0, -1], [0.8, 0.7], [-0.8, 0.7]].map(function (p) { var px = p[0] * s, py = p[1] * s; return [x + px * c - py * sn, y + px * sn + py * c]; });
  }
  var LAMPS = [];
  function lamp(id, pts, col, x, y, r) { var L = { id: id, pts: pts, col: col, x: x, y: y, r: r }; LAMPS.push(L); return L; }
  LANES.forEach(function (p, i) { lamp('lane' + i, circlePts(p[0], 108, 5, 14), [255, 220, 60], p[0], 108, 5); });
  lamp('ramp', arrowPts(270, 330, 0, 12), [60, 255, 120], 270, 330, 12);
  lamp('orbitL', arrowPts(56, 436, -0.62, 10), [80, 200, 255], 56, 436, 10);
  lamp('orbitR', arrowPts(307, 328, 0, 10), [80, 200, 255], 307, 328, 10);
  var HYP = [[122, 326], [112, 302], [102, 278], [92, 254]];
  HYP.forEach(function (p, i) { lamp('hyper' + i, circlePts(p[0], p[1], 5, 14), [200, 120, 255], p[0], p[1], 5); });
  lamp('hyperArrow', arrowPts(82, 230, -0.38, 10), [210, 130, 255], 82, 230, 10);
  DROP_Y.forEach(function (y, i) { lamp('drop' + i, triPts(58, y, -Math.PI / 2, 6), [255, 150, 40], 58, y, 6); });
  FUEL_Y.forEach(function (y, i) { lamp('fuel' + i, triPts(305, y, Math.PI / 2, 6), [255, 70, 70], 305, y, 6); });
  [2, 3, 4, 5].forEach(function (m, i) { lamp('mult' + m, circlePts(131 + i * 24, 468, 7.5, 16), [255, 190, 60], 131 + i * 24, 468, 7.5); });
  for (var ri = 0; ri < 9; ri++) {
    var ra = Math.PI + 0.22 + ri / 8 * (Math.PI - 0.44);
    var rx = PLANET.x + 56 * Math.cos(ra), ry = PLANET.y + 56 * Math.sin(ra);
    lamp('rank' + ri, circlePts(rx, ry, 4.5, 12), [120, 230, 255], rx, ry, 4.5);
  }
  lamp('extra', circlePts(167, 504, 7, 16), [255, 120, 40], 167, 504, 7);
  lamp('save', circlePts(167, 546, 7.5, 16), [255, 60, 60], 167, 546, 7.5);
  lamp('inL', circlePts(46, 470, 4.5, 12), [255, 255, 255], 46, 470, 4.5);
  lamp('inR', circlePts(288, 470, 4.5, 12), [255, 255, 255], 288, 470, 4.5);
  lamp('outL', circlePts(23, 478, 4.5, 12), [255, 90, 60], 23, 478, 4.5);
  lamp('outR', circlePts(311, 478, 4.5, 12), [255, 90, 60], 311, 478, 4.5);

  // ---------------------------------------------------------------------
  // 5x7 dot-matrix font (rows, MSB = leftmost column)
  // ---------------------------------------------------------------------
  var FONT = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
    4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
    ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0],
    '!': [4, 4, 4, 4, 4, 0, 4], '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [1, 1, 2, 4, 8, 16, 16],
    '?': [14, 17, 1, 2, 4, 0, 4], "'": [4, 4, 8, 0, 0, 0, 0], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
    '*': [0, 4, 21, 14, 21, 4, 0], '=': [0, 0, 31, 0, 31, 0, 0], '#': [10, 10, 31, 10, 31, 10, 10], '%': [24, 25, 2, 4, 8, 19, 3]
  };
  var colCache = {};
  function textCols(str) {
    str = String(str).toUpperCase();
    if (colCache[str]) return colCache[str];
    var cols = [];
    for (var i = 0; i < str.length; i++) {
      var g = FONT[str.charAt(i)] || FONT['?'];
      for (var c = 0; c < 5; c++) {
        var m = 0;
        for (var r = 0; r < 7; r++) if (g[r] & (16 >> c)) m |= 1 << r;
        cols.push(m);
      }
      cols.push(0);
    }
    if (cols.length) cols.pop();
    colCache[str] = cols;
    return cols;
  }

  function fmt(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t;
    var g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t;
    var bl = (pa & 255) * (1 - t) + (pb & 255) * t;
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(bl) + ')';
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function mkCanvas(w, hh) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(hh)); return c; }

  // ---------------------------------------------------------------------
  // Collision helpers
  // ---------------------------------------------------------------------
  // Returns impact speed (>0) when the ball touched the segment.
  function collideSeg(b, s) {
    var t = ((b.x - s.ax) * s.dx + (b.y - s.ay) * s.dy) / s.l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = s.ax + s.dx * t, cy = s.ay + s.dy * t;
    var dx = b.x - cx, dy = b.y - cy, rr = b.r + s.t, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return 0;
    if (s.one && (b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny < 0) return 0;
    var d = Math.sqrt(d2), nx, ny;
    if (d < 1e-6) { nx = s.nx; ny = s.ny; } else { nx = dx / d; ny = dy / d; }
    return resolve(b, nx, ny, rr - d, 0, 0, s.e);
  }
  function collideCircle(b, cx, cy, r, e) {
    var dx = b.x - cx, dy = b.y - cy, rr = b.r + r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return 0;
    var d = Math.sqrt(d2) || 1e-6;
    return resolve(b, dx / d, dy / d, rr - d, 0, 0, e) || 1e-3;
  }
  // Push out along n, reflect the velocity relative to a surface moving at (svx, svy).
  function resolve(b, nx, ny, pen, svx, svy, e) {
    b.x += nx * pen; b.y += ny * pen;
    var rvx = b.vx - svx, rvy = b.vy - svy;
    var vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 1e-3;
    var ee = -vn < 35 ? 0 : e;
    var jn = -(1 + ee) * vn;
    // Coulomb-ish friction on the tangential component, proportional to the impulse.
    var tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    var ft = Math.min(Math.abs(vt), jn * 0.08) * (vt > 0 ? -1 : 1);
    b.vx += nx * jn + tx * ft;
    b.vy += ny * jn + ty * ft;
    return -vn;
  }

  function flipperTip(f) { return [f.x + f.s * f.len * Math.cos(f.angle), f.y + f.len * Math.sin(f.angle)]; }
  function collideFlipper(b, f) {
    var tip = flipperTip(f), dx = tip[0] - f.x, dy = tip[1] - f.y, l2 = dx * dx + dy * dy;
    var t = ((b.x - f.x) * dx + (b.y - f.y) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = f.x + dx * t, cy = f.y + dy * t, rad = f.r1 + (f.r2 - f.r1) * t;
    var ddx = b.x - cx, ddy = b.y - cy, rr = b.r + rad, d2 = ddx * ddx + ddy * ddy;
    if (d2 >= rr * rr) return 0;
    var d = Math.sqrt(d2), nx, ny;
    if (d < 1e-6) { nx = f.s * Math.sin(f.angle); ny = -Math.cos(f.angle); } else { nx = ddx / d; ny = ddy / d; }
    var px = cx + nx * rad - f.x, py = cy + ny * rad - f.y;
    var svx = -f.s * f.omega * py, svy = f.s * f.omega * px;
    return resolve(b, nx, ny, rr - d, svx, svy, 0.32);
  }

  // =====================================================================
  // The application
  // =====================================================================
  function launch() {
    var opts = Object.assign({ sound: true, music: false }, U.store.get(OPT_KEY, {}));
    var canvas = h('canvas', { className: 'pinball-canvas', width: CW, height: CH });
    var root = h('div', { className: 'pinball-root' }, canvas);
    var ctx = canvas.getContext('2d');

    var win = WM.open({
      app: 'pinball', title: '3D Pinball for Windows - Space Cadet', icon: 'pinball',
      width: CW + 6, height: 'auto', resizable: false, maximizable: false,
      content: root, className: 'pinball'
    });

    // -------------------------------------------------------------------
    // Audio (lazy, synthesized)
    // -------------------------------------------------------------------
    var A = { ctx: null, out: null, noise: null, nextNote: 0, step: 0, lastHit: 0 };
    function audioInit() {
      if (!A.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { A.ctx = new AC(); } catch (e) { A.ctx = null; return; }
        A.out = A.ctx.createGain();
        A.out.gain.value = 0.32;
        var comp = A.ctx.createDynamicsCompressor();
        A.out.connect(comp); comp.connect(A.ctx.destination);
        var len = A.ctx.sampleRate;
        A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
        var d = A.noise.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (A.ctx.state === 'suspended' && A.ctx.resume) A.ctx.resume().catch(function () {});
    }
    function canPlay() { return A.ctx && opts.sound && !(window.Sound && Sound.muted) && A.ctx.state !== 'closed'; }
    function tone(type, f0, f1, dur, vol, delay, out) {
      if (!canPlay()) return;
      var c = A.ctx, t = c.currentTime + 0.005 + (delay || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out || A.out);
      o.start(t); o.stop(t + dur + 0.03);
    }
    function noise(dur, vol, ftype, f0, f1, q, delay) {
      if (!canPlay()) return;
      var c = A.ctx, t = c.currentTime + 0.005 + (delay || 0);
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = A.noise;
      f.type = ftype || 'lowpass'; f.Q.value = q || 0.8;
      f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(A.out);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    }
    var SFX = {
      flipper: function () { noise(0.06, 0.55, 'lowpass', 2200, 300); tone('square', 110, 45, 0.07, 0.18); },
      flipperDown: function () { noise(0.035, 0.18, 'lowpass', 900, 250); },
      bumper: function () { tone('square', 620, 170, 0.13, 0.2); tone('sine', 1240, 420, 0.1, 0.18); noise(0.05, 0.3, 'bandpass', 2600, 900, 1.5); },
      sling: function () { tone('square', 330, 110, 0.09, 0.2); noise(0.06, 0.35, 'lowpass', 3200, 400); },
      wall: function (v) { var now = A.ctx ? A.ctx.currentTime : 0; if (now - A.lastHit < 0.05) return; A.lastHit = now; noise(0.035, Math.min(0.35, v / 2500), 'bandpass', 1400, 700, 1.2); },
      rollover: function () { tone('sine', 1320, 1320, 0.2, 0.18); tone('sine', 1980, 1980, 0.14, 0.08, 0.02); },
      target: function () { tone('triangle', 240, 110, 0.12, 0.3); noise(0.05, 0.4, 'lowpass', 2400, 300); },
      fuel: function () { tone('square', 880, 660, 0.08, 0.12); noise(0.04, 0.3, 'lowpass', 2000, 400); },
      launch: function (p) { noise(0.35, 0.3 + 0.2 * p, 'bandpass', 300, 2800, 1.2); tone('sawtooth', 90, 40, 0.18, 0.12); },
      pull: function () { noise(0.05, 0.15, 'highpass', 3000, 5000); },
      drain: function () { tone('sawtooth', 440, 55, 0.9, 0.12); tone('square', 220, 40, 0.9, 0.06); },
      ramp: function () { tone('sawtooth', 180, 1400, 0.5, 0.08); tone('sine', 360, 2200, 0.5, 0.12); },
      hyper: function () { tone('sine', 120, 2600, 1.0, 0.18); tone('triangle', 240, 5200, 1.0, 0.06); noise(1.0, 0.12, 'bandpass', 200, 6000, 3); },
      kick: function () { noise(0.08, 0.45, 'lowpass', 1800, 200); tone('square', 160, 60, 0.1, 0.15); },
      saucer: function () { tone('sine', 300, 70, 0.3, 0.3); },
      chime: function () { [880, 1175, 1568, 2093].forEach(function (f, i) { tone('sine', f, f, 0.5, 0.14, i * 0.09); tone('triangle', f * 2, f * 2, 0.25, 0.03, i * 0.09); }); },
      fanfare: function () { [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { tone('square', f, f, 0.14, 0.08, i * 0.1); tone('triangle', f / 2, f / 2, 0.14, 0.12, i * 0.1); }); },
      lanes: function () { [660, 880, 1100, 1320].forEach(function (f, i) { tone('square', f, f, 0.08, 0.07, i * 0.06); }); },
      tilt: function () { tone('sawtooth', 98, 92, 0.8, 0.2); tone('square', 104, 96, 0.8, 0.12); },
      warn: function () { tone('square', 200, 200, 0.12, 0.12); tone('square', 200, 200, 0.12, 0.12, 0.18); },
      nudge: function () { noise(0.12, 0.5, 'lowpass', 400, 80); },
      save: function () { [784, 1047, 784, 1047].forEach(function (f, i) { tone('sine', f, f, 0.12, 0.12, i * 0.08); }); },
      over: function () { [523, 440, 349, 262].forEach(function (f, i) { tone('triangle', f, f * 0.98, 0.35, 0.16, i * 0.28); }); },
      start: function () { [392, 523, 659, 784].forEach(function (f, i) { tone('square', f, f, 0.1, 0.06, i * 0.07); }); }
    };
    function sfx(name, arg) { try { if (SFX[name]) SFX[name](arg); } catch (e) { /* audio is best effort */ } }

    // A gentle synthesized space loop, scheduled from the frame loop.
    var SONG = {
      bass: [45, 45, 45, 45, 41, 41, 41, 41, 48, 48, 48, 48, 43, 43, 43, 43],
      arp: [69, 72, 76, 72, 65, 69, 72, 69, 67, 72, 76, 79, 67, 71, 74, 71]
    };
    function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
    function musicTick() {
      if (!opts.music || !canPlay() || !running()) { A.nextNote = 0; return; }
      var c = A.ctx, stepLen = 0.2;
      if (A.nextNote < c.currentTime) A.nextNote = c.currentTime + 0.05;
      while (A.nextNote < c.currentTime + 0.25) {
        var d = A.nextNote - c.currentTime, i = A.step % 16, bar = Math.floor(A.step / 16) % 4;
        if (i % 2 === 0) tone('triangle', midi(SONG.bass[(i + bar * 4) % 16] - 12), 0, stepLen * 1.8, 0.1, d);
        tone('square', midi(SONG.arp[i] + (bar === 3 ? 2 : 0)), 0, stepLen * 0.8, 0.018, d);
        if (i % 4 === 2) noise(0.05, 0.03, 'highpass', 7000, 9000, 1, d);
        A.nextNote += stepLen;
        A.step++;
      }
    }

    // -------------------------------------------------------------------
    // Game state
    // -------------------------------------------------------------------
    var ball = { x: 335, y: PL_REST - 2 - BR, vx: 0, vy: 0, r: BR, z: 0, mode: 'plunger', rampS: 0, rampV: 0, still: 0 };
    var flippers = [
      { x: 104, y: 566, s: 1, len: 54, r1: 8, r2: 5, rest: 0.52, up: -0.44, angle: 0.52, omega: 0, on: false },
      { x: 230, y: 566, s: -1, len: 54, r1: 8, r2: 5, rest: 0.52, up: -0.44, angle: 0.52, omega: 0, on: false }
    ];
    var plunger = { y: PL_REST, pull: 0, holding: false, vy: 0 };
    var input = { L: false, R: false, plunge: false };
    var G;
    var timers = [];
    var clock = 0;           // game time (s), only advances while running
    var userPaused = false, autoPaused = false;
    var stats = { steps: 0, errors: 0 };

    function after(t, fn) { timers.push({ t: clock + t, fn: fn }); }

    function newGame() {
      timers = [];
      G = {
        score: 0, ball: 1, extra: 0, rank: 0, mission: 0, prog: 0, cycle: 0,
        lanes: [0, 0, 0], drops: [1, 1, 1], dropAnim: [0, 0, 0], fuel: [0, 0, 0], hyper: 0, mult: 1, rampLit: false,
        count: { bumper: 0, target: 0, ramp: 0, orbit: 0, hyper: 0 },
        tilt: 0, tilted: false, save: 0, launched: false, over: false, draining: false,
        flash: { bumper: [0, 0, 0], sling: [0, 0], lanes: 0, inL: 0, inR: 0, outL: 0, outR: 0, orbitL: 0, orbitR: 0, ramp: 0, drop: 0, mission: 0 },
        msgs: [], cur: null, lastOrbit: -9, saucerT: 0, shake: 0, hs: false
      };
      DROPS.forEach(function (d) { d.active = true; });
      serve();
      msg('Welcome, Cadet', 'Player 1');
      msg('Mission accepted:', MISSIONS[0].name);
      sfx('start');
    }

    function serve() {
      ball.x = 335; ball.y = PL_REST - 2 - BR; ball.vx = 0; ball.vy = 0; ball.z = 0; ball.mode = 'plunger'; ball.still = 0;
      plunger.y = PL_REST; plunger.pull = 0;
      G.launched = false; G.draining = false; G.save = 0; G.tilted = false; G.tilt = 0;
    }

    function add(pts) { if (!G.tilted && !G.over) G.score += pts; }

    function msg(a, b, dur) {
      G.msgs.push({ a: a || '', b: b || '', dur: dur || 2.2 });
      if (G.msgs.length > 5) G.msgs.splice(0, G.msgs.length - 5);
    }

    function mission() { return MISSIONS[G.mission % MISSIONS.length]; }
    function missionNeed() { return Math.ceil(mission().n * (1 + 0.5 * G.cycle)); }
    function event(ev) {
      if (G.over || G.tilted) return;
      var m = mission();
      if (m.ev !== ev) return;
      G.prog++;
      if (G.prog >= missionNeed()) {
        var pts = 25000 * (G.rank + 1);
        add(pts);
        G.flash.mission = 2;
        sfx('chime');
        msg('Mission completed', fmt(pts) + ' points', 2.6);
        promote();
        G.mission++;
        if (G.mission % MISSIONS.length === 0) G.cycle++;
        G.prog = 0;
        after(1.4, function () { msg('Mission accepted:', mission().name, 2.6); });
      } else {
        msg(m.name, m.what + ' ' + G.prog + '/' + missionNeed(), 1.6);
      }
    }
    function promote() {
      if (G.rank >= RANKS.length - 1) { add(100000); msg('Fleet Admiral bonus', '100,000'); return; }
      G.rank++;
      msg('Promotion to', RANKS[G.rank], 2.6);
      if (G.rank === 2 || G.rank === 5 || G.rank === 8) after(1.2, awardExtra);
    }
    function awardExtra() {
      if (G.over) return;
      G.extra++;
      sfx('fanfare');
      msg('Extra ball!', 'Shoot again', 2.6);
    }

    // --- events from the table ---
    function hitBumper(i) {
      G.flash.bumper[i] = 1;
      add(500);
      G.count.bumper++;
      sfx('bumper');
      event('bumper');
    }
    function hitSling(i) { G.flash.sling[i] = 1; add(100); sfx('sling'); }
    function hitDrop(i) {
      DROPS[i].active = false;
      G.drops[i] = 0;
      add(1500);
      G.count.target++;
      sfx('target');
      event('drop');
      if (!G.drops[0] && !G.drops[1] && !G.drops[2]) {
        add(15000);
        msg('Target bank', 'complete  15,000');
        sfx('lanes');
        after(1.5, function () { DROPS.forEach(function (d, k) { d.active = true; G.drops[k] = 1; }); sfx('kick'); });
      }
    }
    function hitFuel(i) {
      add(G.fuel[i] ? 250 : 750);
      G.fuel[i] = 1;
      G.count.target++;
      sfx('fuel');
      event('fuel');
      if (G.fuel[0] && G.fuel[1] && G.fuel[2]) {
        add(5000);
        msg('Fuel tanks full', '5,000');
        sfx('lanes');
        G.hyper = Math.min(3, G.hyper + 1);
        after(0.8, function () { G.fuel = [0, 0, 0]; });
      }
    }
    function rollover(i) {
      add(1000);
      if (!G.lanes[i]) { G.lanes[i] = 1; sfx('rollover'); } else sfx('rollover');
      if (G.lanes[0] && G.lanes[1] && G.lanes[2]) {
        G.flash.lanes = 1.2;
        add(10000);
        G.mult = Math.min(5, G.mult + 1);
        G.rampLit = true;
        sfx('lanes');
        msg('Launch ramp', 're-fueled', 2.2);
        if (G.mult > 1) msg('Bonus', G.mult + 'x multiplier', 1.8);
        event('lanes');
        after(1.2, function () { G.lanes = [0, 0, 0]; });
      }
    }
    function laneChange(dir) {
      if (ball.mode === 'plunger' || G.flash.lanes > 0) return;
      var l = G.lanes;
      G.lanes = dir < 0 ? [l[1], l[2], l[0]] : [l[2], l[0], l[1]];
    }
    function orbit(side) {
      var pts = 2500;
      if (clock - G.lastOrbit < 4) { pts = 7500; msg('Double orbit', '7,500'); } else msg('Orbit', '2,500', 1.4);
      G.lastOrbit = clock;
      add(pts);
      G.count.orbit++;
      G.flash[side ? 'orbitR' : 'orbitL'] = 1;
      sfx('rollover');
      event('orbit');
    }
    function enterRamp() {
      ball.mode = 'ramp';
      ball.rampS = 0;
      ball.rampV = Math.min(900, Math.max(520, Math.hypot(ball.vx, ball.vy) * 0.8));
      sfx('ramp');
    }
    function leaveRamp() {
      var end = RAMP.pts[RAMP.pts.length - 1];
      ball.mode = 'live';
      ball.x = end[0]; ball.y = end[1]; ball.z = end[2];
      ball.vx = -10; ball.vy = 140;
      var pts = G.rampLit ? 10000 : 5000;
      add(pts);
      G.count.ramp++;
      G.flash.ramp = 1;
      msg(G.rampLit ? 'Re-fueled launch' : 'Launch ramp', fmt(pts), 1.8);
      G.rampLit = false;
      G.hyper = Math.min(3, G.hyper + 1);
      event('ramp');
    }
    function enterSaucer() {
      ball.mode = 'saucer';
      ball.x = SAUCER.x; ball.y = SAUCER.y; ball.vx = 0; ball.vy = 0;
      sfx('saucer');
      var lvl = G.hyper;
      var pts = HYPER_AWARDS[lvl];
      add(pts);
      G.count.hyper++;
      after(0.25, function () { sfx('hyper'); });
      msg('Hyperspace bonus', fmt(pts), 2.0);
      if (lvl === 3) { after(1.0, awardExtra); G.hyper = 0; } else G.hyper = lvl + 1;
      event('hyper');
      after(1.3, function () {
        if (ball.mode !== 'saucer') return;
        ball.mode = 'live';
        ball.vx = 250 + Math.random() * 60; ball.vy = 330 + Math.random() * 60;
        G.saucerT = 0.5;
        sfx('kick');
      });
    }
    function drain() {
      if (G.draining) return;
      if (G.save > 0 && !G.tilted) {
        G.save = 0;
        msg('Ball saved', '', 1.8);
        sfx('save');
        ball.mode = 'gone';
        after(0.8, function () { serve(); G.launched = true; G.save = 0; });
        return;
      }
      G.draining = true;
      ball.mode = 'gone';
      sfx('drain');
      if (!G.tilted) {
        var c = G.count;
        var bonus = (c.bumper * 100 + c.target * 500 + c.ramp * 2500 + c.orbit * 1000 + c.hyper * 2500 + 1000 * (G.rank + 1)) * G.mult;
        after(0.6, function () { add(bonus); msg('End of ball bonus', fmt(bonus) + (G.mult > 1 ? '  (' + G.mult + 'x)' : ''), 2.0); });
      }
      G.count = { bumper: 0, target: 0, ramp: 0, orbit: 0, hyper: 0 };
      after(2.8, function () {
        G.mult = 1;
        if (G.extra > 0) { G.extra--; serve(); msg('Shoot again', 'Player 1'); return; }
        G.ball++;
        if (G.ball > 3) { gameOver(); return; }
        serve();
        msg('Ball ' + G.ball, 'Player 1', 1.6);
      });
    }
    function gameOver() {
      G.over = true;
      G.ball = 3;
      ball.mode = 'gone';
      sfx('over');
      msg('Game over', fmt(G.score), 4);
      after(1.5, checkHighScore);
    }
    function nudge(dir) {
      if (!G || G.over) return;
      G.shake = 0.18;
      G.shakeDir = dir;
      sfx('nudge');
      if (ball.mode === 'live') {
        ball.vx += dir * (70 + Math.random() * 40);
        ball.vy -= 50 + Math.random() * 40;
      }
      if (G.tilted || ball.mode === 'plunger') return;
      G.tilt += 1;
      if (G.tilt > 2.6) {
        G.tilted = true;
        sfx('tilt');
        msg('TILT', '', 3);
      } else if (G.tilt > 1.4) {
        sfx('warn');
        msg('Tilt warning', '', 1.2);
      }
    }

    // -------------------------------------------------------------------
    // Physics
    // -------------------------------------------------------------------
    function setFlipper(i, on) {
      if (!G) return;
      if (on && (G.tilted || G.over)) on = false;
      var f = flippers[i];
      if (f.on === on) return;
      f.on = on;
      if (on) { sfx('flipper'); laneChange(i === 0 ? -1 : 1); } else sfx('flipperDown');
    }

    function step(dt) {
      clock += dt;
      stats.steps++;
      for (var i = timers.length - 1; i >= 0; i--) {
        if (timers[i].t <= clock) { var fn = timers[i].fn; timers.splice(i, 1); fn(); }
      }
      // Decays
      var F = G.flash;
      for (var b = 0; b < 3; b++) F.bumper[b] = Math.max(0, F.bumper[b] - dt * 5);
      F.sling[0] = Math.max(0, F.sling[0] - dt * 6); F.sling[1] = Math.max(0, F.sling[1] - dt * 6);
      ['lanes', 'inL', 'inR', 'outL', 'outR', 'orbitL', 'orbitR', 'ramp', 'mission'].forEach(function (k) { F[k] = Math.max(0, F[k] - dt); });
      for (var d = 0; d < 3; d++) G.dropAnim[d] += ((DROPS[d].active ? 0 : 1) - G.dropAnim[d]) * Math.min(1, dt * 18);
      G.tilt = Math.max(0, G.tilt - dt * 0.35);
      G.shake = Math.max(0, G.shake - dt);
      G.saucerT = Math.max(0, G.saucerT - dt);
      if (G.save > 0 && ball.mode === 'live') G.save = Math.max(0, G.save - dt);
      if (G.tilted) { flippers[0].on = false; flippers[1].on = false; }
      else { flippers[0].on = input.L && !G.over; flippers[1].on = input.R && !G.over; }

      // Plunger
      if (plunger.holding && (ball.mode === 'plunger' || ball.mode === 'gone' || G.over)) {
        plunger.pull = Math.min(1, plunger.pull + dt / 1.1);
      }
      if (!plunger.holding && plunger.pull > 0) plunger.pull = Math.max(0, plunger.pull - dt * 14);
      plunger.y = PL_REST + plunger.pull * PL_PULL;

      // Messages
      if (!G.cur || clock - G.cur.t0 > G.cur.hold) {
        var m = G.msgs.shift();
        if (m) {
          var extraCols = Math.max(0, Math.max(textCols(m.a).length, textCols(m.b).length) - 122);
          G.cur = { a: m.a, b: m.b, t0: clock, hold: m.dur + extraCols / 26 };
        } else if (G.cur && clock - G.cur.t0 > G.cur.hold) G.cur = null;
      }

      if (ball.mode === 'ramp') {
        ball.rampS += ball.rampV * dt;
        var p = rampAt(ball.rampS);
        ball.x = p[0]; ball.y = p[1]; ball.z = p[2];
        if (ball.rampS >= RAMP.len) leaveRamp();
      }
      var sp = Math.hypot(ball.vx, ball.vy);
      var moving = flippers[0].angle !== (flippers[0].on ? flippers[0].up : flippers[0].rest) ||
        flippers[1].angle !== (flippers[1].on ? flippers[1].up : flippers[1].rest);
      var n = Math.max(moving ? 8 : 4, Math.min(24, Math.ceil(sp * dt / 1.6)));
      var hdt = dt / n;
      for (var s = 0; s < n; s++) substep(hdt);

      // Stuck-ball rescue (not while cradled on a raised flipper).
      if (ball.mode === 'live') {
        if (Math.hypot(ball.vx, ball.vy) < 6 && !flippers[0].on && !flippers[1].on) ball.still += dt; else ball.still = 0;
        if (ball.still > 2.5) { ball.still = 0; ball.vx += (Math.random() - 0.5) * 200; ball.vy -= 150; }
      }
    }

    function substep(dt) {
      for (var i = 0; i < 2; i++) {
        var f = flippers[i], target = f.on ? f.up : f.rest, prev = f.angle;
        var spd = (f.on ? FL_UP : FL_DOWN) * dt;
        if (f.angle < target) f.angle = Math.min(target, f.angle + spd);
        else if (f.angle > target) f.angle = Math.max(target, f.angle - spd);
        f.omega = (f.angle - prev) / dt;
      }
      if (ball.mode !== 'live' && ball.mode !== 'plunger') return;
      var b = ball;
      var px = b.x, py = b.y;
      b.vy += GRAV * dt;
      var damp = 1 - 0.1 * dt;
      b.vx *= damp; b.vy *= damp;
      var sp = Math.hypot(b.vx, b.vy);
      // Tiny imperfections so a ball can never balance on a post tip forever.
      if (sp < 15 && b.mode === 'live') b.vx += (Math.random() - 0.5) * 6;
      if (sp > 2600) { b.vx *= 2600 / sp; b.vy *= 2600 / sp; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.z > 0) b.z = Math.max(0, b.z - 90 * dt);

      var hit, k;
      for (k = 0; k < SEGS.length; k++) {
        var s = SEGS[k];
        hit = collideSeg(b, s);
        if (!hit) continue;
        if (s.tag === 'sling') {
          if (hit > 60 && G.flash.sling[s.idx] < 0.5) {
            b.vx += s.nx * 0; // placeholder, kick applied below with outward normal
            var nx = s.nx, ny = s.ny;
            if ((b.x - s.ax) * nx + (b.y - s.ay) * ny < 0) { nx = -nx; ny = -ny; }
            b.vx += nx * 380; b.vy += ny * 380;
            hitSling(s.idx);
          }
        } else if (s.tag === 'fuel') {
          if (hit > 50) hitFuel(s.idx);
        } else if (hit > 260 && s.kind !== 'gate') sfx('wall', hit);
      }
      for (k = 0; k < 3; k++) {
        if (!DROPS[k].active) continue;
        hit = collideSeg(b, DROPS[k]);
        if (hit > 40) hitDrop(k);
      }
      for (k = 0; k < BUMPERS.length; k++) {
        var bp = BUMPERS[k];
        hit = collideCircle(b, bp.x, bp.y, bp.r, 0.5);
        if (hit) {
          var dx = b.x - bp.x, dy = b.y - bp.y, dl = Math.hypot(dx, dy) || 1;
          dx /= dl; dy /= dl;
          var vn = b.vx * dx + b.vy * dy;
          if (vn < 560) { b.vx += dx * (560 - vn); b.vy += dy * (560 - vn); }
          if (G.flash.bumper[k] < 0.6) hitBumper(k);
        }
      }
      for (k = 0; k < 2; k++) collideFlipper(b, flippers[k]);
      // Plunger tip
      if (b.x > 322 && b.y > plunger.y - 20) {
        var ptop = plunger.y - 2;
        if (b.y + b.r > ptop) {
          b.y = ptop - b.r;
          if (b.vy > 0) b.vy = b.vy > 60 ? -b.vy * 0.25 : 0;
          b.vx *= 0.9;
        }
      }
      // Hard safety bounds (should never trigger).
      if (b.x < 12 + b.r - 3 || b.x > 348 - b.r + 3 || b.y < 12 - 3) {
        stats.errors++;
        b.x = U.clamp(b.x, 12 + b.r, 348 - b.r);
        b.y = Math.max(b.y, 20);
        if (b.y < 180 && Math.hypot(b.x - ARC_C[0], b.y - ARC_C[1]) > ARC_R - b.r) {
          var ang = Math.atan2(b.y - ARC_C[1], b.x - ARC_C[0]);
          b.x = ARC_C[0] + (ARC_R - b.r - 1) * Math.cos(ang); b.y = ARC_C[1] + (ARC_R - b.r - 1) * Math.sin(ang);
        }
      }
      if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) {
        stats.errors++;
        b.x = 167; b.y = 300; b.vx = 0; b.vy = 0;
      }
      sensors(px, py);
    }

    function sensors(px, py) {
      var b = ball;
      if (b.mode === 'plunger') {
        if (b.y < 196 || b.x < 320) {
          b.mode = 'live';
          if (!G.launched) { G.launched = true; G.save = SAVE_TIME; }
        }
        return;
      }
      if (b.z > 2) return;
      var i;
      for (i = 0; i < 3; i++) {
        var L = LANES[i];
        if (py < L[1] && b.y >= L[1] && Math.abs(b.x - L[0]) < 12) rollover(i);
      }
      // Ramp capture line
      if (py >= 262 && b.y < 262 && b.x > 250 && b.x < 292 && b.vy < -380) { enterRamp(); return; }
      // Orbits (upward crossings)
      if (py >= 300 && b.y < 300 && b.x < 40 && b.vy < 0) orbit(0);
      if (py >= 272 && b.y < 272 && b.x > 292 && b.x < 322 && b.vy < 0) orbit(1);
      // Hyperspace kickout
      if (G.saucerT <= 0 && Math.hypot(b.x - SAUCER.x, b.y - SAUCER.y) < 8) { enterSaucer(); return; }
      // In / out lanes
      if (py < 480 && b.y >= 480) {
        if (Math.abs(b.x - INLANES[0][0]) < 11) { add(250); G.flash.inL = 1; sfx('rollover'); }
        else if (Math.abs(b.x - INLANES[1][0]) < 11) { add(250); G.flash.inR = 1; sfx('rollover'); }
        else if (Math.abs(b.x - OUTLANES[0][0]) < 11) { add(500); G.flash.outL = 1.5; sfx('warn'); }
        else if (Math.abs(b.x - OUTLANES[1][0]) < 11) { add(500); G.flash.outR = 1.5; sfx('warn'); }
      }
      if (b.y > WH + 18) drain();
    }

    // -------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------
    var sc = 1;                      // device px per logical px
    var cache = null, overlay = null;
    var CHUNKS = [];                 // wall pieces re-drawn in front of the ball

    function pathPts(g, pts, z) {
      g.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var q = P(pts[i][0], pts[i][1], z);
        if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
      }
      g.closePath();
    }
    function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }

    // Wall outline pieces (quad + round caps) in world space.
    function wallShapes(s, outward) {
      var t = s.t + (s.kind === 'outer' ? 0 : 0.6);
      var nx = s.nx, ny = s.ny, shapes = [];
      if (outward) {
        shapes.push([[s.ax, s.ay], [s.bx, s.by], [s.bx + nx * 9, s.by + ny * 9], [s.ax + nx * 9, s.ay + ny * 9]]);
      } else {
        shapes.push([[s.ax + nx * t, s.ay + ny * t], [s.bx + nx * t, s.by + ny * t], [s.bx - nx * t, s.by - ny * t], [s.ax - nx * t, s.ay - ny * t]]);
        shapes.push(circlePts(s.ax, s.ay, t, 10));
        shapes.push(circlePts(s.bx, s.by, t, 10));
      }
      return shapes;
    }
    function drawWalls(g, list, pieces) {
      // Side layers for all, then the top faces: no notches at the joints.
      var zmax = 0;
      list.forEach(function (it) { zmax = Math.max(zmax, STYLE[it.kind].h); });
      for (var z = 0; z < zmax; z += 1.6) {
        list.forEach(function (it) {
          var st = STYLE[it.kind];
          if (z >= st.h) return;
          g.fillStyle = mix(st.side[0], st.side[1], z / st.h);
          it.shapes.forEach(function (sh) { pathPts(g, sh, z); g.fill(); });
        });
      }
      list.forEach(function (it) {
        var st = STYLE[it.kind];
        g.fillStyle = st.top;
        it.shapes.forEach(function (sh) { pathPts(g, sh, st.h); g.fill(); });
      });
      if (pieces) return;
      list.forEach(function (it) {
        var st = STYLE[it.kind], s = it.seg;
        var a = P(s.ax, s.ay, st.h), b = P(s.bx, s.by, st.h);
        g.strokeStyle = st.hi; g.lineWidth = it.kind === 'outer' ? 1.3 : 0.9; g.lineCap = 'round';
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      });
    }

    function buildChunks() {
      CHUNKS = [];
      SEGS.forEach(function (s) {
        if (!s.draw || s.kind === 'outer') return;
        var n = Math.max(1, Math.ceil(s.len / 10));
        for (var i = 0; i < n; i++) {
          var t0 = i / n, t1 = (i + 1) / n, t = s.t + 0.6;
          var ax = s.ax + s.dx * t0, ay = s.ay + s.dy * t0, bx = s.ax + s.dx * t1, by = s.ay + s.dy * t1;
          CHUNKS.push({
            kind: s.kind, cx: (ax + bx) / 2, cy: (ay + by) / 2, front: Math.max(ay, by) + t,
            shapes: [[[ax + s.nx * t, ay + s.ny * t], [bx + s.nx * t, by + s.ny * t], [bx - s.nx * t, by - s.ny * t], [ax - s.nx * t, ay - s.ny * t]]]
          });
        }
      });
    }
    buildChunks();

    // Flat playfield art, painted in world space then warped.
    function paintArt(RS) {
      var art = mkCanvas(WW * RS, WH * RS), g = art.getContext('2d');
      g.setTransform(RS, 0, 0, RS, 0, 0);
      var bg = g.createLinearGradient(0, 0, 0, WH);
      bg.addColorStop(0, '#070b2a'); bg.addColorStop(0.45, '#0c1650'); bg.addColorStop(1, '#060a22');
      g.fillStyle = bg; g.fillRect(0, 0, WW, WH);
      var R = rng(1998);
      // Nebula
      g.globalCompositeOperation = 'lighter';
      var NEB = [[150, 60, 200], [40, 110, 210], [200, 50, 120], [30, 160, 170], [110, 40, 190]];
      for (var i = 0; i < 26; i++) {
        var x = R() * WW, y = R() * WH, r = 30 + R() * 110, c = NEB[Math.floor(R() * NEB.length)];
        var gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(c, 0.16 + R() * 0.12)); gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // A spiral galaxy smudge
      g.save(); g.translate(262, 520); g.rotate(-0.5);
      for (var gi = 0; gi < 180; gi++) {
        var ga = gi * 0.11, gd = 2 + gi * 0.16;
        g.fillStyle = 'rgba(200,190,255,' + (0.25 - gi / 900) + ')';
        g.fillRect(Math.cos(ga) * gd * 1.6, Math.sin(ga) * gd * 0.7, 1.2, 1.2);
        g.fillRect(-Math.cos(ga) * gd * 1.6, -Math.sin(ga) * gd * 0.7, 1.2, 1.2);
      }
      g.restore();
      // Stars
      for (i = 0; i < 700; i++) {
        var sx = R() * WW, sy = R() * WH, br = R();
        g.fillStyle = br > 0.93 ? '#ffffff' : br > 0.7 ? 'rgba(200,220,255,0.8)' : 'rgba(160,170,255,0.45)';
        var sz = br > 0.93 ? 1.3 : 0.8;
        g.fillRect(sx, sy, sz, sz);
        if (br > 0.985) {
          g.fillStyle = 'rgba(200,220,255,0.35)';
          g.fillRect(sx - 3, sy + 0.4, 7, 0.5); g.fillRect(sx + 0.4, sy - 3, 0.5, 7);
        }
      }
      g.globalCompositeOperation = 'source-over';

      // Planet with rings (the table's centrepiece)
      var p = PLANET;
      g.save();
      g.translate(p.x, p.y);
      g.strokeStyle = 'rgba(160,200,255,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, 0, p.r * 2.1, p.r * 0.55, -0.25, Math.PI, Math.PI * 2); g.stroke();
      var pg = g.createRadialGradient(-p.r * 0.4, -p.r * 0.45, p.r * 0.1, 0, 0, p.r);
      pg.addColorStop(0, '#a8e0ff'); pg.addColorStop(0.35, '#3a74c8'); pg.addColorStop(0.8, '#1a2a78'); pg.addColorStop(1, '#0a0f30');
      g.fillStyle = pg; g.beginPath(); g.arc(0, 0, p.r, 0, Math.PI * 2); g.fill();
      g.save(); g.clip();
      g.globalAlpha = 0.25; g.strokeStyle = '#cfe8ff'; g.lineWidth = 3;
      for (var bnd = -2; bnd <= 2; bnd++) { g.beginPath(); g.ellipse(0, bnd * 11, p.r * 1.2, 4, -0.25, 0, Math.PI * 2); g.stroke(); }
      g.restore();
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(200,230,255,0.75)'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(0, 0, p.r * 2.1, p.r * 0.55, -0.25, 0, Math.PI); g.stroke();
      g.restore();
      // Rank arc guide
      g.strokeStyle = 'rgba(120,200,255,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.arc(p.x, p.y, 56, Math.PI + 0.1, Math.PI * 2 - 0.1); g.stroke();

      // Printed shot lanes (dotted flight paths)
      g.setLineDash([2, 4]); g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(80,255,140,0.35)';
      g.beginPath(); g.moveTo(170, 540); g.quadraticCurveTo(250, 440, 270, 346); g.stroke();
      g.strokeStyle = 'rgba(210,130,255,0.4)';
      g.beginPath(); g.moveTo(170, 540); g.quadraticCurveTo(120, 420, 124, 338); g.stroke();
      g.strokeStyle = 'rgba(80,200,255,0.35)';
      g.beginPath(); g.moveTo(150, 540); g.quadraticCurveTo(290, 420, 307, 344); g.stroke();
      g.beginPath(); g.moveTo(190, 540); g.quadraticCurveTo(80, 470, 62, 448); g.stroke();
      g.setLineDash([]);

      // Top lanes plate
      g.fillStyle = 'rgba(20,30,80,0.55)';
      g.fillRect(116, 50, 102, 50);
      // Lane arrows
      g.fillStyle = 'rgba(255,220,80,0.25)';
      LANES.forEach(function (l) { g.beginPath(); g.moveTo(l[0] - 4, l[1] - 12); g.lineTo(l[0] + 4, l[1] - 12); g.lineTo(l[0], l[1] - 4); g.fill(); });

      // Hyperspace saucer
      var sg = g.createRadialGradient(SAUCER.x, SAUCER.y, 1, SAUCER.x, SAUCER.y, 13);
      sg.addColorStop(0, '#000'); sg.addColorStop(0.55, '#05030a'); sg.addColorStop(0.75, '#6a3cb0'); sg.addColorStop(0.9, '#d7c2ff'); sg.addColorStop(1, 'rgba(60,20,120,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(SAUCER.x, SAUCER.y, 13, 0, Math.PI * 2); g.fill();
      // Ramp entrance floor
      g.fillStyle = 'rgba(40,110,200,0.35)';
      g.beginPath(); g.moveTo(250, 306); g.lineTo(250, 240); g.lineTo(292, 232); g.lineTo(292, 300); g.fill();
      // Plunger lane floor
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(322, 200, 26, 440);
      // Apron-side dead zones
      g.fillStyle = '#0a0f2c';
      g.beginPath(); g.moveTo(34, 524); g.lineTo(96, 560); g.lineTo(104, 640); g.lineTo(34, 640); g.fill();
      g.beginPath(); g.moveTo(300, 524); g.lineTo(238, 560); g.lineTo(230, 640); g.lineTo(300, 640); g.fill();

      // Sling plastics bases (shadows)
      g.fillStyle = 'rgba(0,0,0,0.5)';
      [SLING_L, SLING_R].forEach(function (s) { g.beginPath(); g.moveTo(s.a[0], s.a[1]); g.lineTo(s.b[0], s.b[1]); g.lineTo(s.c[0], s.c[1]); g.fill(); });

      // Wall contact shadows (ambient occlusion)
      g.lineCap = 'round';
      SEGS.forEach(function (s) {
        if (!s.draw) return;
        g.strokeStyle = 'rgba(0,0,10,0.45)'; g.lineWidth = s.t * 2 + 5;
        g.beginPath(); g.moveTo(s.ax + 1.5, s.ay + 2); g.lineTo(s.bx + 1.5, s.by + 2); g.stroke();
      });
      BUMPERS.forEach(function (b) {
        var sh = g.createRadialGradient(b.x + 2, b.y + 3, b.r * 0.6, b.x + 2, b.y + 3, b.r + 9);
        sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh; g.beginPath(); g.arc(b.x + 2, b.y + 3, b.r + 9, 0, Math.PI * 2); g.fill();
      });

      // Unlit inserts
      LAMPS.forEach(function (L) {
        g.beginPath();
        L.pts.forEach(function (q, k) { if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
        g.closePath();
        var lg = g.createRadialGradient(L.x - L.r * 0.3, L.y - L.r * 0.3, 0.5, L.x, L.y, L.r * 1.3);
        lg.addColorStop(0, rgba(L.col.map(function (v) { return Math.round(v * 0.55); }), 1));
        lg.addColorStop(1, rgba(L.col.map(function (v) { return Math.round(v * 0.18); }), 1));
        g.fillStyle = lg; g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1; g.stroke();
      });

      // Labels
      function label(text, x, y, size, col, rot, glow) {
        g.save(); g.translate(x, y); if (rot) g.rotate(rot);
        g.font = 'bold ' + size + 'px Arial, Helvetica, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if (glow) { g.shadowColor = glow; g.shadowBlur = 6; }
        g.fillStyle = col; g.fillText(text, 0, 0);
        g.restore();
      }
      label('RE-FUEL', 167, 121, 7, '#ffd84a');
      label('LAUNCH RAMP', 270, 348, 7, '#6dff9a');
      label('ORBIT', 307, 346, 6, '#7fd4ff');
      label('ORBIT', 70, 450, 6, '#7fd4ff', -0.62);
      label('HYPERSPACE', 92, 292, 7, '#d59bff', -1.2);
      label('FUEL', 296, 360, 6, '#ff7a7a', Math.PI / 2);
      label('TARGETS', 68, 298, 6, '#ffb060', -Math.PI / 2);
      ['2X', '3X', '4X', '5X'].forEach(function (t, i) { label(t, 131 + i * 24, 482, 6, '#ffcf70'); });
      label('EXTRA BALL', 167, 517, 6, '#ff9a5a');
      label('SHOOT AGAIN', 167, 560, 6, '#ff7070');
      label('SPACE CADET', 167, 432, 13, '#e8f2ff', 0, '#4aa8ff');
      label('RANK', 167, 336, 6, '#9fe4ff');
      g.globalAlpha = 0.6;
      label('IN', 46, 458, 5, '#fff'); label('IN', 288, 458, 5, '#fff');
      label('OUT', 23, 466, 5, '#ff9a80'); label('OUT', 311, 466, 5, '#ff9a80');
      g.globalAlpha = 1;

      // Cabinet outside the playfield boundary
      g.fillStyle = '#12173a';
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(WW, 0); g.lineTo(WW, 180); g.arc(ARC_C[0], ARC_C[1], ARC_R, 0, Math.PI, true); g.lineTo(0, 180); g.closePath();
      g.fill();
      g.fillRect(0, 180, 12, WH); g.fillRect(348, 180, 12, WH);
      return art;
    }

    function buildCaches() {
      var W = Math.round(CW * sc), Hh = Math.round(CH * sc);
      cache = mkCanvas(W, Hh);
      overlay = mkCanvas(W, Hh);
      var g = cache.getContext('2d');
      // Cabinet background
      g.setTransform(sc, 0, 0, sc, 0, 0);
      var cab = g.createLinearGradient(0, 0, TW, 0);
      cab.addColorStop(0, '#1c2036'); cab.addColorStop(0.08, '#3b4262'); cab.addColorStop(0.5, '#0b0d18'); cab.addColorStop(0.92, '#3b4262'); cab.addColorStop(1, '#1c2036');
      g.fillStyle = cab; g.fillRect(0, 0, TW, CH);
      // Cabinet side rails following the trapezoid
      var tl = P(0, 0, 0), tr = P(WW, 0, 0), bl = P(0, WH, 0), br = P(WW, WH, 0);
      g.fillStyle = '#05060c';
      g.beginPath(); g.moveTo(tl[0] - 4, tl[1] - 4); g.lineTo(tr[0] + 4, tr[1] - 4); g.lineTo(br[0] + 4, br[1] + 3); g.lineTo(bl[0] - 4, bl[1] + 3); g.fill();
      // Warp the art
      var RS = Math.min(3, Math.max(1, Math.ceil(sc * PJ.S)));
      var art = paintArt(RS);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = true;
      var top = Math.floor(PJ.Y0 * sc), bot = Math.ceil((PJ.Y0 + PJ.Hs) * sc);
      for (var j = top; j < bot; j++) {
        var u0 = (j / sc - PJ.Y0) / PJ.Hs, u1 = ((j + 1) / sc - PJ.Y0) / PJ.Hs;
        var t0 = Math.max(0, unwarp(u0)), t1 = Math.min(1, unwarp(u1));
        if (t1 <= t0) continue;
        var w = pw((t0 + t1) / 2 * WH), half = PJ.S * WW / 2 / w;
        g.drawImage(art, 0, t0 * WH * RS, WW * RS, Math.max(0.5, (t1 - t0) * WH * RS), (PJ.cx - half) * sc, j, 2 * half * sc, 1);
      }
      g.setTransform(sc, 0, 0, sc, 0, 0);
      // Raised static walls
      var outer = [], inner = [];
      SEGS.forEach(function (s) {
        if (!s.draw) return;
        if (s.kind === 'outer') outer.push({ kind: 'outer', seg: s, shapes: wallShapes(s, true) });
        else inner.push({ kind: s.kind, seg: s, shapes: wallShapes(s, false) });
      });
      inner.sort(function (a, b) { return Math.max(a.seg.ay, a.seg.by) - Math.max(b.seg.ay, b.seg.by); });
      drawWalls(g, outer);
      drawFuelTargets(g);
      drawWalls(g, inner);
      // Lane guide caps (little chrome studs)
      [116, 150, 184, 218].forEach(function (x) {
        var q = P(x, 56, STYLE.guide.h + 1);
        g.fillStyle = '#fff'; ellipse(g, q[0], q[1], 1.6, 1.2); g.fill();
      });
      drawPanelStatic(g);

      // Overlay: apron covering the drain, drawn after the ball.
      var o = overlay.getContext('2d');
      o.setTransform(sc, 0, 0, sc, 0, 0);
      var apron = [[12, 618], [100, 618], [112, 600], [222, 600], [234, 618], [322, 618], [322, 660], [12, 660]];
      var ag = o.createLinearGradient(0, P(0, 600, 0)[1], 0, P(0, 660, 0)[1]);
      ag.addColorStop(0, '#2c3566'); ag.addColorStop(1, '#0d1126');
      for (var z = 0; z < 6; z += 1.5) { o.fillStyle = mix('#05070f', '#1a2044', z / 6); pathPts(o, apron, z); o.fill(); }
      o.fillStyle = ag; pathPts(o, apron, 6); o.fill();
      o.strokeStyle = '#8fa2d8'; o.lineWidth = 1;
      o.beginPath();
      apron.slice(0, 6).forEach(function (q, i) { var s = P(q[0], q[1], 6); if (i) o.lineTo(s[0], s[1]); else o.moveTo(s[0], s[1]); });
      o.stroke();
      var mid = P(167, 630, 6);
      o.font = 'bold 8px Arial, sans-serif'; o.textAlign = 'center'; o.fillStyle = '#9fb3ec';
      o.fillText('SPACE CADET  •  3D PINBALL', mid[0], mid[1] + 3);
      // Bottom cabinet lip
      var lb = P(0, 660, 0), rb = P(WW, 660, 0);
      o.fillStyle = '#05060c'; o.fillRect(0, lb[1], TW, CH - lb[1]);
      o.fillStyle = '#39406a'; o.fillRect(lb[0], lb[1], rb[0] - lb[0], 1);
      void rb;
    }

    function drawFuelTargets(g) {
      FUEL_Y.forEach(function (y) {
        var box = [[316.5, y - 9], [320, y - 9], [320, y + 9], [316.5, y + 9]];
        for (var z = 0; z < 12; z += 1.5) { g.fillStyle = mix('#401010', '#c02a2a', z / 12); pathPts(g, box, z); g.fill(); }
        g.fillStyle = '#ff8a7a'; pathPts(g, box, 12); g.fill();
      });
    }

    // ---- dynamic drawing ----
    function drawLamps(g) {
      var blink = (Math.floor(clock * 6) % 2) === 0;
      var F = G.flash;
      function state(id) {
        if (G.tilted) return 0;
        if (id.slice(0, 4) === 'lane') { var li = +id.charAt(4); return F.lanes > 0 ? (blink ? 1 : 0) : G.lanes[li]; }
        if (id === 'ramp') return F.ramp > 0 ? (blink ? 1 : 0) : G.rampLit ? 1 : (Math.floor(clock * 1.5) % 2 ? 0.35 : 0);
        if (id === 'orbitL') return F.orbitL > 0 ? (blink ? 1 : 0) : 0;
        if (id === 'orbitR') return F.orbitR > 0 ? (blink ? 1 : 0) : 0;
        if (id.slice(0, 5) === 'hyper' && id !== 'hyperArrow') { var hi = +id.charAt(5); return hi < G.hyper ? 1 : hi === G.hyper ? (blink ? 0.9 : 0.2) : 0; }
        if (id === 'hyperArrow') return ball.mode === 'saucer' ? (blink ? 1 : 0) : 0.5 + 0.5 * Math.sin(clock * 5);
        if (id.slice(0, 4) === 'drop') return G.drops[+id.charAt(4)] ? 0 : 1;
        if (id.slice(0, 4) === 'fuel') return G.fuel[+id.charAt(4)];
        if (id.slice(0, 4) === 'mult') return G.mult >= +id.charAt(4) ? 1 : 0;
        if (id.slice(0, 4) === 'rank') { var r = +id.charAt(4); return r < G.rank ? 1 : r === G.rank ? (F.mission > 0 ? (blink ? 1 : 0) : 1) : 0; }
        if (id === 'extra') return G.extra > 0 ? 1 : 0;
        if (id === 'save') return G.save > 0 ? (G.save < 2.5 ? (blink ? 1 : 0) : 1) : 0;
        if (id === 'inL' || id === 'inR' || id === 'outL' || id === 'outR') return F[id] > 0 ? 1 : 0;
        return 0;
      }
      LAMPS.forEach(function (L) {
        var a = state(L.id);
        if (!a) return;
        var c = P(L.x, L.y, 0), rad = L.r * kx(L.y) * 3.2;
        g.globalCompositeOperation = 'lighter';
        var hg = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], rad);
        hg.addColorStop(0, rgba(L.col, 0.5 * a)); hg.addColorStop(1, rgba(L.col, 0));
        g.fillStyle = hg; g.fillRect(c[0] - rad, c[1] - rad, rad * 2, rad * 2);
        g.globalCompositeOperation = 'source-over';
        pathPts(g, L.pts, 0);
        var lg = g.createRadialGradient(c[0], c[1] - 1, 0, c[0], c[1], L.r * kx(L.y) * 1.3);
        lg.addColorStop(0, rgba([255, 255, 255], a));
        lg.addColorStop(0.5, rgba(L.col, a));
        lg.addColorStop(1, rgba(L.col.map(function (v) { return Math.round(v * 0.6); }), a));
        g.fillStyle = lg; g.fill();
      });
    }

    function extrude(g, pts, z0, z1, c0, c1, top, stroke) {
      for (var z = z0; z < z1; z += 1.4) { g.fillStyle = mix(c0, c1, (z - z0) / (z1 - z0)); pathPts(g, pts, z); g.fill(); }
      pathPts(g, pts, z1);
      g.fillStyle = top; g.fill();
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.7; g.stroke(); }
    }

    function drawFlipper(g, f) {
      var tip = flipperTip(f), a = Math.atan2(tip[1] - f.y, tip[0] - f.x), pts = [];
      var i;
      for (i = 0; i <= 8; i++) { var t1 = a - Math.PI / 2 + i / 8 * Math.PI; pts.push([tip[0] + f.r2 * Math.cos(t1), tip[1] + f.r2 * Math.sin(t1)]); }
      for (i = 0; i <= 10; i++) { var t2 = a + Math.PI / 2 + i / 10 * Math.PI; pts.push([f.x + f.r1 * Math.cos(t2), f.y + f.r1 * Math.sin(t2)]); }
      extrude(g, pts, 0, 9, '#5a0a0a', '#c8261c', '#e8ebf2', '#20242e');
      // Top face shading + highlight
      var inner = pts.map(function (p) { return [f.x + (p[0] - f.x) * 0.72 + (tip[0] - f.x) * 0.06, f.y + (p[1] - f.y) * 0.62 + (tip[1] - f.y) * 0.06]; });
      pathPts(g, inner, 9.2);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill();
      var pv = P(f.x, f.y, 9.5);
      g.fillStyle = '#9aa3b5'; ellipse(g, pv[0], pv[1], 2.6 * kx(f.y), 2.2 * ky(f.y)); g.fill();
      g.fillStyle = '#fff'; ellipse(g, pv[0] - 0.6, pv[1] - 0.6, 1, 0.8); g.fill();
    }

    function drawBumper(g, bp, i) {
      var fl = G.flash.bumper[i];
      var ex = kx(bp.y), ey = ky(bp.y);
      var hb = 12, hc = 15 - fl * 3;
      var base = P(bp.x, bp.y, 0);
      // Skirt
      g.fillStyle = '#e8e8f0'; ellipse(g, base[0], base[1], (bp.r + 4) * ex, (bp.r + 4) * ey); g.fill();
      var sk = P(bp.x, bp.y, 2);
      g.fillStyle = '#b8bccb'; ellipse(g, sk[0], sk[1], (bp.r + 4) * ex, (bp.r + 4) * ey); g.fill();
      // Body
      var body = g.createLinearGradient(base[0] - bp.r * ex, 0, base[0] + bp.r * ex, 0);
      body.addColorStop(0, '#0c1a4a'); body.addColorStop(0.3, '#4a7ad8'); body.addColorStop(0.45, '#b8d4ff'); body.addColorStop(0.7, '#2a4aa0'); body.addColorStop(1, '#081030');
      for (var z = 2; z <= hb; z += 1.2) {
        var q = P(bp.x, bp.y, z);
        g.fillStyle = body; ellipse(g, q[0], q[1], bp.r * 0.78 * ex, bp.r * 0.78 * ey); g.fill();
      }
      // Cap
      var c = P(bp.x, bp.y, hc);
      for (var z2 = hb; z2 < hc; z2 += 1) { var q2 = P(bp.x, bp.y, z2); g.fillStyle = mix('#300000', bp.cap, 0.4); ellipse(g, q2[0], q2[1], bp.r * ex, bp.r * ey); g.fill(); }
      var cg = g.createRadialGradient(c[0] - bp.r * ex * 0.3, c[1] - bp.r * ey * 0.4, 1, c[0], c[1], bp.r * ex);
      cg.addColorStop(0, fl > 0 ? '#ffffff' : bp.ring); cg.addColorStop(0.55, fl > 0 ? bp.ring : bp.cap); cg.addColorStop(1, mix('#000000', bp.cap, 0.55));
      g.fillStyle = cg; ellipse(g, c[0], c[1], bp.r * ex, bp.r * ey); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.8; g.stroke();
      // Star emblem
      g.beginPath();
      for (var k = 0; k < 10; k++) {
        var ang = -Math.PI / 2 + k * Math.PI / 5, rr = (k % 2 ? 0.22 : 0.55) * bp.r;
        var sx = c[0] + Math.cos(ang) * rr * ex, sy = c[1] + Math.sin(ang) * rr * ey;
        if (k) g.lineTo(sx, sy); else g.moveTo(sx, sy);
      }
      g.closePath();
      g.fillStyle = fl > 0 ? '#fff' : 'rgba(255,255,255,0.8)'; g.fill();
      if (fl > 0) {
        g.globalCompositeOperation = 'lighter';
        var rad = bp.r * ex * 2.6;
        var hg = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], rad);
        hg.addColorStop(0, 'rgba(255,240,200,' + (0.7 * fl) + ')'); hg.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = hg; g.fillRect(c[0] - rad, c[1] - rad, rad * 2, rad * 2);
        g.globalCompositeOperation = 'source-over';
      }
    }

    function drawSlingPlastic(g, s, i) {
      var fl = G.flash.sling[i];
      var cx = (s.a[0] + s.b[0] + s.c[0]) / 3, cy = (s.a[1] + s.b[1] + s.c[1]) / 3;
      var tri = [s.a, s.b, s.c].map(function (p) { return [cx + (p[0] - cx) * 0.7, cy + (p[1] - cy) * 0.7]; });
      pathPts(g, tri, 13);
      var q = P(cx, cy, 13);
      var pg = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], 22);
      pg.addColorStop(0, fl > 0 ? '#fff6c0' : 'rgba(255,120,90,0.95)'); pg.addColorStop(1, fl > 0 ? '#ff7a2a' : 'rgba(170,20,40,0.9)');
      g.fillStyle = pg; g.fill();
      g.strokeStyle = 'rgba(255,220,200,0.9)'; g.lineWidth = 0.8; g.stroke();
      if (fl > 0) {
        g.globalCompositeOperation = 'lighter';
        var hg = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], 40);
        hg.addColorStop(0, 'rgba(255,200,120,' + 0.6 * fl + ')'); hg.addColorStop(1, 'rgba(255,80,20,0)');
        g.fillStyle = hg; g.fillRect(q[0] - 40, q[1] - 40, 80, 80);
        g.globalCompositeOperation = 'source-over';
      }
    }

    function drawDrop(g, d, i) {
      var down = G.dropAnim[i];
      if (down > 0.98) return;
      var hz = 13 * (1 - down);
      var box = [[42, d.ay], [47, d.ay], [47, d.by], [42, d.by]];
      extrude(g, box, 0, Math.max(0.5, hz), '#6a3000', '#ff9a1a', '#ffd070', '#3a1a00');
      // Face stripe
      var a = P(46.5, d.ay + 3, hz * 0.55), b = P(46.5, d.by - 3, hz * 0.55);
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }

    function drawPlunger(g) {
      var y = plunger.y;
      // Spring
      var top = y + 6, bot = 650;
      g.strokeStyle = '#c9ced8'; g.lineWidth = 1.2;
      g.beginPath();
      var coils = 9;
      for (var i = 0; i <= coils * 2; i++) {
        var yy = top + (bot - top) * i / (coils * 2), xx = 335 + (i % 2 ? 6 : -6);
        var q = P(xx, yy, 5);
        if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
      }
      g.stroke();
      // Rod
      var r0 = P(335, y, 5), r1 = P(335, 660, 5);
      g.strokeStyle = '#8e95a6'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.stroke();
      // Tip
      var tipBox = [[326, y - 2], [344, y - 2], [344, y + 5], [326, y + 5]];
      extrude(g, tipBox, 0, 10, '#400808', '#b01818', '#ff5a3a', '#200000');
    }

    function drawBall(g) {
      var b = ball, r = BR;
      var sink = b.mode === 'saucer' ? -4 : 0;
      var sh = P(b.x + 2.5, b.y + 3.5, 0), e1 = kx(b.y), e2 = ky(b.y);
      var shade = Math.max(0.12, 0.5 - b.z * 0.012);
      g.fillStyle = 'rgba(0,0,8,' + shade + ')';
      ellipse(g, sh[0], sh[1], r * e1 * (1 + b.z * 0.01), r * e2 * 0.95); g.fill();
      var c = P(b.x, b.y, b.z + r + sink), rs = r * e1;
      var gr = g.createRadialGradient(c[0] - rs * 0.35, c[1] - rs * 0.42, rs * 0.05, c[0], c[1], rs);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, '#e8ecf4'); gr.addColorStop(0.55, '#9aa2b4'); gr.addColorStop(0.85, '#3c4254'); gr.addColorStop(1, '#161922');
      g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], rs, 0, Math.PI * 2); g.fill();
      // Reflected playfield glow
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(70,110,255,0.22)';
      g.beginPath(); g.arc(c[0], c[1] + rs * 0.45, rs * 0.5, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
    }

    function drawRamp(g) {
      var p = RAMP.pts, W = 11;
      var edges = p.map(function (q, i) {
        var a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        var nx = -dy / l, ny = dx / l;
        return { l: [q[0] + nx * W, q[1] + ny * W, q[2]], r: [q[0] - nx * W, q[1] - ny * W, q[2]], c: q };
      });
      // Support posts
      g.strokeStyle = 'rgba(160,190,230,0.55)'; g.lineWidth = 1.2;
      [16, 32, 48].forEach(function (i) {
        if (!edges[i]) return;
        [edges[i].l, edges[i].r].forEach(function (e) {
          var a = P(e[0], e[1], 0), b = P(e[0], e[1], e[2]);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        });
      });
      // Floor and side walls (back to front)
      var lit = G.rampLit || G.flash.ramp > 0;
      var floorCol = lit ? 'rgba(70,230,140,0.42)' : 'rgba(80,160,255,0.38)';
      var wallCol = lit ? 'rgba(140,255,190,0.30)' : 'rgba(150,210,255,0.26)';
      function quad(a, b, c, d) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); }
      for (var i = edges.length - 2; i >= 0; i--) {
        var e0 = edges[i], e1 = edges[i + 1];
        var l0 = P(e0.l[0], e0.l[1], e0.l[2]), l1 = P(e1.l[0], e1.l[1], e1.l[2]), r1 = P(e1.r[0], e1.r[1], e1.r[2]), r0 = P(e0.r[0], e0.r[1], e0.r[2]);
        var l0u = P(e0.l[0], e0.l[1], e0.l[2] + 6), l1u = P(e1.l[0], e1.l[1], e1.l[2] + 6), r1u = P(e1.r[0], e1.r[1], e1.r[2] + 6), r0u = P(e0.r[0], e0.r[1], e0.r[2] + 6);
        g.fillStyle = floorCol; quad(l0, l1, r1, r0);
        g.fillStyle = wallCol; quad(l0, l1, l1u, l0u); quad(r0, r1, r1u, r0u);
      }
      // Rails
      ['l', 'r'].forEach(function (side) {
        [[0, 'rgba(10,30,70,0.9)', 1.6], [6, '#f2f8ff', 1.4]].forEach(function (st) {
          g.strokeStyle = st[1]; g.lineWidth = st[2];
          g.beginPath();
          edges.forEach(function (e, j) { var q = P(e[side][0], e[side][1], e[side][2] + st[0]); if (j) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
          g.stroke();
        });
      });
      // Chevrons along the ramp
      g.strokeStyle = 'rgba(200,255,220,0.5)'; g.lineWidth = 1;
      for (var k = 6; k < edges.length - 4; k += 6) {
        var e = edges[k], a = P(e.l[0], e.l[1], e.l[2] + 0.5), m = P(edges[k + 2].c[0], edges[k + 2].c[1], edges[k + 2].c[2] + 0.5), b = P(e.r[0], e.r[1], e.r[2] + 0.5);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(m[0], m[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
    }

    function drawGate(g) {
      var s = GATE;
      var a = P(s.ax, s.ay, 7), b = P(s.bx, s.by, 7);
      g.strokeStyle = '#d8dce6'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }

    function renderTable(g) {
      drawLamps(g);
      var items = [];
      BUMPERS.forEach(function (bp, i) { items.push({ y: bp.y + bp.r * 0.3, f: function () { drawBumper(g, bp, i); } }); });
      flippers.forEach(function (f) { items.push({ y: f.y + 10, f: function () { drawFlipper(g, f); } }); });
      DROPS.forEach(function (d, i) { items.push({ y: d.by, f: function () { drawDrop(g, d, i); } }); });
      [SLING_L, SLING_R].forEach(function (s, i) { items.push({ y: 520, f: function () { drawSlingPlastic(g, s, i); } }); });
      items.push({ y: PL_REST, f: function () { drawPlunger(g); } });
      var ballVisible = ball.mode !== 'gone' && ball.mode !== 'ramp';
      if (ballVisible) items.push({ y: ball.y + 1, ball: true, f: function () { drawBall(g); } });
      items.sort(function (a, b) { return a.y - b.y; });
      items.forEach(function (it) { it.f(); });
      // Walls in front of the ball
      if (ballVisible && ball.z < 6) {
        var near = CHUNKS.filter(function (c) { return c.front > ball.y + 2 && Math.abs(c.cx - ball.x) < 26 && c.cy - ball.y < 26 && c.cy - ball.y > -8; });
        if (near.length) drawWalls(g, near, true);
      }
      drawGate(g);
      drawRamp(g);
      if (ball.mode === 'ramp') drawBall(g);
    }

    // ---- info panel ----
    var PNL = { x: TW, w: CW - TW };
    function dotGrid(g, x, y, cols, pitch, col) {
      g.fillStyle = col;
      var s = pitch * 0.72;
      for (var c = 0; c < cols; c++) for (var r = 0; r < 7; r++) g.fillRect(x + c * pitch, y + r * pitch, s, s);
    }
    function dotText(g, text, x, y, pitch, col, cols, offset, center) {
      var arr = textCols(text), s = pitch * 0.72;
      var start = 0;
      if (center && arr.length < cols) start = Math.floor((cols - arr.length) / 2);
      g.fillStyle = col;
      for (var c = 0; c < cols; c++) {
        var idx = c - start + (offset || 0);
        var m = arr[idx];
        if (!m) continue;
        for (var r = 0; r < 7; r++) if (m & (1 << r)) g.fillRect(x + c * pitch, y + r * pitch, s, s);
      }
    }
    var MSG_COLS = 122, MSG_P = 1.62, MSG_X = TW + 13;

    function bevelBox(g, x, y, w, hh, fill) {
      g.fillStyle = '#3a3f55'; g.fillRect(x - 2, y - 2, w + 4, hh + 4);
      g.fillStyle = '#9aa0b8'; g.fillRect(x - 2, y + hh, w + 4, 2); g.fillRect(x + w, y - 2, 2, hh + 4);
      g.fillStyle = '#10121c'; g.fillRect(x - 2, y - 2, w + 4, 1.5); g.fillRect(x - 2, y - 2, 1.5, hh + 4);
      g.fillStyle = fill; g.fillRect(x, y, w, hh);
    }

    function drawPanelStatic(g) {
      var x0 = PNL.x, w = PNL.w;
      g.setTransform(sc, 0, 0, sc, 0, 0);
      g.fillStyle = '#000'; g.fillRect(x0, 0, w, CH);
      var R = rng(42);
      for (var i = 0; i < 160; i++) {
        var br = R();
        g.fillStyle = br > 0.9 ? '#fff' : 'rgba(150,160,255,' + (0.25 + br * 0.4) + ')';
        g.fillRect(x0 + R() * w, R() * CH, br > 0.9 ? 1.2 : 0.8, br > 0.9 ? 1.2 : 0.8);
      }
      // Separator between table and panel
      var sep = g.createLinearGradient(x0, 0, x0 + 6, 0);
      sep.addColorStop(0, '#5b6386'); sep.addColorStop(0.5, '#c7cde6'); sep.addColorStop(1, '#2a2f48');
      g.fillStyle = sep; g.fillRect(x0, 0, 5, CH);

      // ---- Logo ----
      var lx = x0 + w / 2 + 2;
      // planet
      var pgx = x0 + 180, pgy = 44;
      var pg = g.createRadialGradient(pgx - 8, pgy - 8, 2, pgx, pgy, 22);
      pg.addColorStop(0, '#ffd6a0'); pg.addColorStop(0.5, '#d0602a'); pg.addColorStop(1, '#3a0e08');
      g.fillStyle = pg; g.beginPath(); g.arc(pgx, pgy, 22, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,220,170,0.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(pgx, pgy, 34, 7, -0.3, 0.1, Math.PI - 0.1); g.stroke();
      // "3D PINBALL"
      g.save();
      g.font = 'italic 900 27px "Arial Black", "Arial", Helvetica, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      var tg = g.createLinearGradient(0, 18, 0, 46);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.45, '#b8c4e8'); tg.addColorStop(0.5, '#56628e'); tg.addColorStop(1, '#e8ecff');
      g.lineWidth = 4; g.strokeStyle = '#0a0f3a'; g.strokeText('3D PINBALL', lx - 8, 46);
      g.fillStyle = tg; g.fillText('3D PINBALL', lx - 8, 46);
      g.font = 'italic bold 19px "Trebuchet MS", Arial, Helvetica, sans-serif';
      g.shadowColor = '#2aa8ff'; g.shadowBlur = 10;
      g.fillStyle = '#9fe0ff'; g.fillText('Space Cadet', lx - 2, 72);
      g.shadowBlur = 0;
      g.restore();
      // Rocket streak
      g.strokeStyle = 'rgba(255,170,60,0.9)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x0 + 14, 92); g.quadraticCurveTo(x0 + 60, 86, x0 + 96, 80); g.stroke();
      g.save(); g.translate(x0 + 100, 79); g.rotate(-0.18);
      g.fillStyle = '#e8ecf6'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-4, -3.5); g.lineTo(-4, 3.5); g.fill();
      g.fillStyle = '#ff5a3a'; g.beginPath(); g.moveTo(-4, -3.5); g.lineTo(-8, -6); g.lineTo(-6, 0); g.lineTo(-8, 6); g.lineTo(-4, 3.5); g.fill();
      g.restore();

      // ---- Player / ball ----
      bevelBox(g, x0 + 12, 102, w - 24, 64, '#020812');
      dotGrid(g, x0 + 16, 106, 122, 1.62, '#0a1822');
      // Score digits unlit
      for (var d = 0; d < 9; d++) seg7(g, x0 + 20 + d * 21.5, 124, 15, 34, '8', '#0a1a24', 0);
      // ---- Rank ----
      bevelBox(g, x0 + 12, 176, w - 24, 36, '#020812');
      dotGrid(g, x0 + 16, 181, 122, 1.62, '#0a1822');
      dotGrid(g, x0 + 16, 196, 122, 1.62, '#0a1822');
      // ---- Messages ----
      bevelBox(g, x0 + 12, 222, w - 24, 44, '#120a02');
      dotGrid(g, MSG_X, 228, MSG_COLS, MSG_P, '#2a1606');
      dotGrid(g, MSG_X, 247, MSG_COLS, MSG_P, '#2a1606');
      // ---- Mission ----
      bevelBox(g, x0 + 12, 276, w - 24, 66, '#020a06');
      dotGrid(g, x0 + 16, 281, 122, 1.62, '#07170c');
      dotGrid(g, x0 + 16, 298, 122, 1.62, '#07170c');
      g.fillStyle = '#0a2a14'; g.fillRect(x0 + 18, 318, w - 36, 8);
      // ---- Launch button ----
      drawLaunchButton(g, false);
      g.font = '9px Arial, Helvetica, sans-serif'; g.fillStyle = '#6f7ba8'; g.textAlign = 'center';
      g.fillText('Z  Left flipper          /  Right flipper', x0 + w / 2 + 2, 434);
      g.fillText('Space  Plunger    X . ↑  Nudge    F3  Pause', x0 + w / 2 + 2, 448);
    }
    function drawLaunchButton(g, down) {
      var x0 = PNL.x;
      var bx = x0 + 20, by = 352, bw = PNL.w - 40, bh = 64;
      g.fillStyle = '#05070f'; g.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
      var lg = g.createLinearGradient(0, by, 0, by + bh);
      lg.addColorStop(0, down ? '#3a1010' : '#5a1818'); lg.addColorStop(1, down ? '#1a0404' : '#260606');
      g.fillStyle = lg; g.fillRect(bx, by, bw, bh);
      g.strokeStyle = '#a04040'; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    }

    function seg7(g, x, y, w, hh, ch, col, skew) {
      var SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
      var on = SEG[ch] || '', t = 3.2, gp = 0.9, hm = hh / 2;
      var L = {
        a: [[0, 0], [w, 0]], d: [[0, hh], [w, hh]], g: [[0, hm], [w, hm]],
        f: [[0, 0], [0, hm]], b: [[w, 0], [w, hm]], e: [[0, hm], [0, hh]], c: [[w, hm], [w, hh]]
      };
      g.fillStyle = col;
      for (var k in L) {
        if (on.indexOf(k) === -1) continue;
        var p = L[k], x1 = p[0][0], y1 = p[0][1], x2 = p[1][0], y2 = p[1][1], pts;
        if (y1 === y2) pts = [[x1 + gp, y1], [x1 + gp + t / 2, y1 - t / 2], [x2 - gp - t / 2, y1 - t / 2], [x2 - gp, y1], [x2 - gp - t / 2, y1 + t / 2], [x1 + gp + t / 2, y1 + t / 2]];
        else pts = [[x1, y1 + gp], [x1 + t / 2, y1 + gp + t / 2], [x1 + t / 2, y2 - gp - t / 2], [x1, y2 - gp], [x1 - t / 2, y2 - gp - t / 2], [x1 - t / 2, y1 + gp + t / 2]];
        g.beginPath();
        pts.forEach(function (q, i) { var qx = x + q[0] + (hh - q[1]) * (skew == null ? 0.1 : skew); if (i) g.lineTo(qx, y + q[1]); else g.moveTo(qx, y + q[1]); });
        g.closePath(); g.fill();
      }
    }

    function renderPanel(g) {
      var x0 = PNL.x, w = PNL.w;
      dotText(g, 'PLAYER 1', x0 + 16, 106, 1.62, '#5fd8ff', 60);
      var bl = G.over ? 'GAME OVER' : 'BALL ' + G.ball;
      var blc = textCols(bl).length;
      dotText(g, bl, x0 + 16 + (122 - blc) * 1.62, 106, 1.62, '#5fd8ff', blc);
      // Score
      var s = String(Math.min(999999999, Math.floor(G.score)));
      var digits = ('         ' + s).slice(-9);
      g.save();
      g.shadowColor = '#2ad4ff'; g.shadowBlur = 6 * sc;
      for (var d = 0; d < 9; d++) seg7(g, x0 + 20 + d * 21.5, 124, 15, 34, digits.charAt(d), '#7ae8ff', 0);
      g.restore();
      // Rank
      dotText(g, 'RANK', x0 + 16, 181, 1.62, '#5fd8ff', 30);
      dotText(g, RANKS[G.rank], x0 + 16, 196, 1.62, '#bff2ff', 100);
      // Rank pips: one per rank, lit up to the current one
      for (var r = 0; r < RANKS.length; r++) {
        var on = r <= G.rank, cur = r === G.rank;
        g.fillStyle = !on ? '#10262e' : (cur && G.flash.mission > 0 && Math.floor(clock * 8) % 2) ? '#ffffff' : cur ? '#ffe070' : '#d0a030';
        starAt(g, x0 + 83 + r * 13.5, 185, 4.2);
      }
      // Messages
      var m = G.cur;
      if (m) {
        var el = clock - m.t0;
        var off = Math.max(0, Math.floor((el - 0.7) * 26));
        [m.a, m.b].forEach(function (t, i) {
          var len = textCols(t).length;
          var o = len > MSG_COLS ? Math.min(len - MSG_COLS, off) : 0;
          dotText(g, t, MSG_X, 228 + i * 19, MSG_P, i ? '#ffb040' : '#ffd070', MSG_COLS, o, true);
        });
      } else {
        var idle = G.over ? ['Game over', 'Press F2 to play'] :
          ball.mode === 'plunger' ? ['Hold SPACE', 'to launch ball'] : ['Player 1', fmt(G.score)];
        dotText(g, idle[0], MSG_X, 228, MSG_P, '#b07020', MSG_COLS, 0, true);
        dotText(g, idle[1], MSG_X, 247, MSG_P, '#b07020', MSG_COLS, 0, true);
      }
      // Mission
      var mm = mission(), need = missionNeed();
      dotText(g, 'MISSION', x0 + 16, 281, 1.62, '#40ff90', 60);
      var mc = textCols(G.prog + '/' + need).length;
      dotText(g, G.prog + '/' + need, x0 + 16 + (122 - mc) * 1.62, 281, 1.62, '#40ff90', mc);
      dotText(g, mm.name, x0 + 16, 298, 1.62, '#b8ffd0', 122);
      var pw2 = (w - 36) * Math.min(1, G.prog / need);
      var pg = g.createLinearGradient(x0 + 18, 0, x0 + 18 + (w - 36), 0);
      pg.addColorStop(0, '#1a8a40'); pg.addColorStop(1, '#6aff9a');
      g.fillStyle = pg; g.fillRect(x0 + 18, 318, pw2, 8);
      g.font = '9px Arial, Helvetica, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#4aa870';
      g.fillText(mm.what + (G.mult > 1 ? '    Bonus ' + G.mult + 'x' : '') + (G.extra ? '    Extra ball' : ''), x0 + 18, 337);
      // Launch button / plunger gauge
      var bx = x0 + 20, by = 352, bw = w - 40;
      var hot = plunger.holding;
      if (hot) drawLaunchButton(g, true);
      var ready = ball.mode === 'plunger' && !G.over;
      g.font = 'bold 13px Arial, Helvetica, sans-serif'; g.textAlign = 'center';
      g.fillStyle = ready ? (Math.floor(clock * 2) % 2 ? '#ffd0c0' : '#ff8a6a') : '#8a4a4a';
      g.fillText(G.over ? 'NEW GAME (F2)' : 'LAUNCH', bx + bw / 2, by + 22);
      g.fillStyle = '#1a0606'; g.fillRect(bx + 12, by + 32, bw - 24, 12);
      var gl = g.createLinearGradient(bx + 12, 0, bx + bw - 12, 0);
      gl.addColorStop(0, '#ffcc30'); gl.addColorStop(0.6, '#ff6a20'); gl.addColorStop(1, '#ff2020');
      g.fillStyle = gl; g.fillRect(bx + 12, by + 32, (bw - 24) * plunger.pull, 12);
      g.strokeStyle = '#a04040'; g.strokeRect(bx + 12.5, by + 32.5, bw - 25, 11);
      g.font = '8px Arial, Helvetica, sans-serif'; g.fillStyle = '#b06a6a';
      g.fillText('hold to pull the plunger', bx + bw / 2, by + 56);
    }
    function starAt(g, x, y, r) {
      g.beginPath();
      for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    }

    function render() {
      var g = ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      var shake = G.shake > 0 ? Math.sin(G.shake * 90) * 3 * (G.shake / 0.18) * (G.shakeDir || 1) : 0;
      // Table (with nudge shake)
      g.drawImage(cache, 0, 0, TW * sc, CH * sc, shake * sc, 0, TW * sc, CH * sc);
      if (shake) { g.fillStyle = '#000'; g.fillRect(shake > 0 ? 0 : (TW + shake) * sc, 0, Math.abs(shake) * sc + 1, CH * sc); }
      g.save();
      g.beginPath(); g.rect(0, 0, TW * sc, CH * sc); g.clip();
      g.setTransform(sc, 0, 0, sc, shake * sc, 0);
      renderTable(g);
      g.setTransform(1, 0, 0, 1, shake * sc, 0);
      g.drawImage(overlay, 0, 0, TW * sc, CH * sc, 0, 0, TW * sc, CH * sc);
      g.setTransform(sc, 0, 0, sc, 0, 0);
      if (G.tilted) bigText(g, 'TILT', '#ff3a2a');
      else if (G.over && !G.cur) bigText(g, 'GAME OVER', '#ffd040');
      g.restore();
      // Panel
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(cache, TW * sc, 0, (CW - TW) * sc, CH * sc, TW * sc, 0, (CW - TW) * sc, CH * sc);
      g.setTransform(sc, 0, 0, sc, 0, 0);
      renderPanel(g);
      if (userPaused || autoPaused) {
        g.fillStyle = 'rgba(0,0,20,0.55)'; g.fillRect(0, 0, TW, CH);
        bigText(g, 'PAUSED', '#ffffff');
        g.font = '11px Arial, Helvetica, sans-serif'; g.fillStyle = '#c8d0ff'; g.textAlign = 'center';
        g.fillText(userPaused ? 'Press F3 to resume' : 'Click here to resume', TW / 2, CH / 2 + 26);
      }
    }
    function bigText(g, t, col) {
      g.save();
      g.font = 'italic 900 34px "Arial Black", Arial, Helvetica, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = '#000'; g.strokeText(t, TW / 2, CH / 2 - 10);
      g.shadowColor = col; g.shadowBlur = 14;
      g.fillStyle = col; g.fillText(t, TW / 2, CH / 2 - 10);
      g.restore();
    }

    // -------------------------------------------------------------------
    // Sizing: crisp at any scale, fits narrow (phone) desktops.
    // -------------------------------------------------------------------
    var cssScale = 1;
    function fit() {
      if (win.closed) return;
      var desk = document.getElementById('desktop');
      var dw = desk ? desk.clientWidth : window.innerWidth, dh = desk ? desk.clientHeight : window.innerHeight;
      var chrome = win.el.offsetHeight - root.offsetHeight;
      var s = Math.min(1, (dw - 8 - 6) / CW, (dh - 8 - Math.max(40, chrome)) / CH);
      s = Math.max(0.3, s);
      cssScale = s;
      var cw = Math.floor(CW * s), ch = Math.floor(CH * s);
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      root.style.width = cw + 'px'; root.style.height = ch + 'px';
      win.el.style.width = (cw + 6) + 'px';
      win.el.style.height = 'auto';
      var dpr = window.devicePixelRatio || 1;
      var nsc = Math.min(3, Math.max(0.5, s * dpr));
      var bw = Math.round(CW * nsc), bh = Math.round(CH * nsc);
      if (canvas.width !== bw || canvas.height !== bh || !cache) {
        sc = nsc;
        canvas.width = bw; canvas.height = bh;
        buildCaches();
      }
      // Keep on screen
      var r = win.el.getBoundingClientRect(), dr = desk ? desk.getBoundingClientRect() : { left: 0, top: 0 };
      if (r.right - dr.left > dw) win.el.style.left = Math.max(0, dw - r.width) + 'px';
      if (r.bottom - dr.top > dh) win.el.style.top = Math.max(0, dh - r.height) + 'px';
      dirty = true;
      if (typeof kick === 'function') kick();
    }

    // -------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------
    var LEFT_KEYS = { KeyZ: 1, ShiftLeft: 1, ArrowLeft: 1 };
    var RIGHT_KEYS = { Slash: 1, ShiftRight: 1, ArrowRight: 1, NumpadDivide: 1 };
    var PLUNGE_KEYS = { Space: 1, ArrowDown: 1, Enter: 1, NumpadEnter: 1 };
    function running() { return !userPaused && !autoPaused; }
    function plungeStart() {
      if (G.over) { newGame(); return; }
      if (!running()) return;
      if (!plunger.holding) { plunger.holding = true; if (ball.mode === 'plunger') sfx('pull'); }
    }
    function plungeEnd() {
      if (!plunger.holding) return;
      plunger.holding = false;
      if (!running()) { plunger.pull = 0; return; }
      if (ball.mode === 'plunger' && ball.x > 322 && ball.y > PL_REST - 40 && plunger.pull > 0.02) {
        var p = plunger.pull;
        ball.vy = -(260 + p * 1320);
        ball.vx = 0;
        sfx('launch', p);
      }
    }
    function releaseAll() {
      input.L = input.R = false;
      if (G) { flippers[0].on = flippers[1].on = false; }
      plunger.holding = false;
    }
    function togglePause() {
      kick();
      if (autoPaused) { autoPaused = false; return; }
      userPaused = !userPaused;
      if (userPaused) releaseAll();
      dirty = true;
    }
    function keyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      audioInit();
      kick();
      if (e.key === 'F2') { newGame(); userPaused = false; return true; }
      if (e.key === 'F3') { togglePause(); return true; }
      var c = e.code || '';
      var isL = LEFT_KEYS[c] || e.key === 'z' || e.key === 'Z';
      var isR = RIGHT_KEYS[c] || e.key === '/' || e.key === '?';
      if (isL || isR || PLUNGE_KEYS[c] || e.key === ' ' || c === 'KeyX' || c === 'Period' || c === 'ArrowUp') {
        if (autoPaused) autoPaused = false;
        if (!running()) return true;
      }
      if (isL) { input.L = true; setFlipper(0, true); return true; }
      if (isR) { input.R = true; setFlipper(1, true); return true; }
      if (PLUNGE_KEYS[c] || e.key === ' ') { if (!e.repeat) plungeStart(); return true; }
      if (c === 'KeyX' && !e.repeat) { nudge(1); return true; }
      if (c === 'Period' && !e.repeat) { nudge(-1); return true; }
      if (c === 'ArrowUp' && !e.repeat) { nudge(0); if (ball.mode === 'live') ball.vy -= 60; return true; }
      return false;
    }
    function keyUp(e) {
      var c = e.code || '', mine = WM.active === win;
      var handled = false;
      if (LEFT_KEYS[c] || e.key === 'z' || e.key === 'Z') { input.L = false; setFlipper(0, false); handled = true; }
      if (RIGHT_KEYS[c] || e.key === '/' || e.key === '?') { input.R = false; setFlipper(1, false); handled = true; }
      if (PLUNGE_KEYS[c] || e.key === ' ') { plungeEnd(); handled = true; }
      if (handled && mine) e.preventDefault();
    }
    win.onKey = keyDown;
    document.addEventListener('keyup', keyUp);
    function onWinBlur() { releaseAll(); }
    window.addEventListener('blur', onWinBlur);
    window.addEventListener('resize', fit);

    // Pointer / touch: left and right halves flip, the plunger lane and the
    // panel's LAUNCH button pull the plunger.
    var pointers = {};
    function zoneAt(e) {
      var r = canvas.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * CW, y = (e.clientY - r.top) / r.height * CH;
      if (x >= TW) return y > 345 && y < 422 ? 'P' : null;
      var lane = P(322, 500, 0);
      if (x > lane[0] - 4 && y > lane[1]) return 'P';
      return x < TW / 2 ? 'L' : 'R';
    }
    function applyZones() {
      var l = false, rr = false, p = false;
      for (var id in pointers) { if (pointers[id] === 'L') l = true; else if (pointers[id] === 'R') rr = true; else if (pointers[id] === 'P') p = true; }
      if (l !== input.L) { input.L = l; setFlipper(0, l); }
      if (rr !== input.R) { input.R = rr; setFlipper(1, rr); }
      if (p && !plunger.holding) plungeStart();
      if (!p && plunger.holding) plungeEnd();
    }
    canvas.addEventListener('pointerdown', function (e) {
      audioInit();
      kick();
      if (e.button > 0) return;
      e.preventDefault();
      if (autoPaused) { autoPaused = false; return; }
      if (userPaused) return;
      var z = zoneAt(e);
      if (!z) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointers[e.pointerId] = z;
      applyZones();
    });
    function ptrUp(e) { if (pointers[e.pointerId] == null) return; delete pointers[e.pointerId]; applyZones(); }
    canvas.addEventListener('pointerup', ptrUp);
    canvas.addEventListener('pointercancel', ptrUp);
    canvas.addEventListener('lostpointercapture', ptrUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // -------------------------------------------------------------------
    // High scores
    // -------------------------------------------------------------------
    function loadScores() { var s = U.store.get(SCORE_KEY, []); return Array.isArray(s) ? s : []; }
    function checkHighScore() {
      if (win.closed || G.hs) return;
      G.hs = true;
      var list = loadScores();
      if (G.score <= 0 || (list.length >= 5 && G.score <= list[list.length - 1].score)) return;
      var score = G.score;
      askName(score).then(function (name) {
        list = loadScores();
        list.push({ name: name, score: score, date: Date.now() });
        list.sort(function (a, b) { return b.score - a.score; });
        U.store.set(SCORE_KEY, list.slice(0, 5));
        U.store.set('w98.pinball.lastName', name);
        showScores(name, score);
      });
    }
    function askName(score) {
      return new Promise(function (resolve) {
        var input2 = h('input', { type: 'text', className: 'field', maxlength: '24', spellcheck: 'false', value: U.store.get('w98.pinball.lastName', Shell.user || 'Player 1') });
        var ok = h('button', { className: 'btn default' }, 'OK');
        var done = false;
        var content = h('div', { className: 'pinball-dialog' }, [
          h('div', { className: 'pinball-dialog-row' }, [U.img(window.Icons && Icons.names && Icons.names.indexOf('pinball') !== -1 ? 'pinball' : 'info', 32), h('div', null, [
            h('p', null, 'Congratulations! You have a new high score:'),
            h('p', { className: 'pinball-big' }, fmt(score)),
            h('label', null, U.label('Enter your &name:'))
          ])]),
          input2,
          h('div', { className: 'button-row' }, ok)
        ]);
        var dlg = WM.dialog({ title: 'High Score', owner: win, content: content, width: 300 });
        function finish() {
          if (done) return;
          done = true;
          var n = (input2.value || '').trim().slice(0, 24) || 'Player 1';
          if (!dlg.closed) dlg.close(true);
          resolve(n);
        }
        ok.addEventListener('click', finish);
        dlg.on('close', finish);
        dlg.onKey = function (e) { if (e.key === 'Enter' || e.key === 'Escape') { finish(); return true; } return false; };
        setTimeout(function () { try { input2.focus(); input2.select(); } catch (e) { /* ignore */ } }, 0);
      });
    }
    function showScores(hiName, hiScore) {
      var list = loadScores();
      var rows = [];
      for (var i = 0; i < 5; i++) {
        var e = list[i];
        var mine = e && hiScore != null && e.score === hiScore && e.name === hiName;
        rows.push(h('tr', { className: mine ? 'mine' : '' }, [h('td', null, String(i + 1) + '.'), h('td', null, e ? e.name : ''), h('td', { className: 'num' }, e ? fmt(e.score) : '')]));
      }
      var ok = h('button', { className: 'btn default' }, 'OK');
      var clear = h('button', { className: 'btn' }, U.label('&Clear'));
      var table = h('table', { className: 'pinball-scores' }, [h('thead', null, h('tr', null, [h('th', null, 'Rank'), h('th', null, 'Name'), h('th', { className: 'num' }, 'Score')])), h('tbody', null, rows)]);
      var dlg = WM.dialog({ title: 'High Scores', owner: win, width: 280, content: h('div', { className: 'pinball-dialog' }, [h('div', { className: 'sunken-panel' }, table), h('div', { className: 'button-row' }, [ok, clear])]) });
      ok.addEventListener('click', function () { dlg.close(true); });
      clear.addEventListener('click', function () {
        WM.msgbox({ title: 'High Scores', owner: dlg, icon: 'question', text: 'Clear the high score table?', buttons: ['&Yes', '&No'] }).then(function (b) {
          if (b !== '&Yes') return;
          U.store.set(SCORE_KEY, []);
          dlg.close(true);
          showScores();
        });
      });
      dlg.onKey = function (e) { if (e.key === 'Enter' || e.key === 'Escape') { dlg.close(true); return true; } return false; };
    }

    // -------------------------------------------------------------------
    // Menus
    // -------------------------------------------------------------------
    function saveOpts() { U.store.set(OPT_KEY, opts); }
    Menu.bar(win, [
      { label: '&Game', items: function () {
        return [
          { label: '&New Game', shortcut: 'F2', action: function () { newGame(); userPaused = false; autoPaused = false; kick(); } },
          { label: '&Launch Ball', action: function () {
            if (G.over) { newGame(); return; }
            if (ball.mode === 'plunger') { plunger.pull = 1; plunger.holding = true; plungeEnd(); }
          } },
          { label: userPaused ? '&Resume Game' : '&Pause/Resume Game', shortcut: 'F3', action: togglePause },
          '-',
          { label: '&High Scores...', action: function () { showScores(); } },
          '-',
          { label: 'E&xit', action: function () { win.close(); } }
        ];
      } },
      { label: '&Options', items: function () {
        return [
          { label: '&Sounds', checked: opts.sound, action: function () { opts.sound = !opts.sound; saveOpts(); } },
          { label: '&Music', checked: opts.music, action: function () { opts.music = !opts.music; saveOpts(); audioInit(); } },
          '-',
          { label: 'Player &Controls...', action: function () {
            WM.msgbox({ title: 'Player Controls', owner: win, icon: 'info', sound: null, text:
              'Left flipper:\tZ, Left Shift or Left Arrow\n' +
              'Right flipper:\t/, Right Shift or Right Arrow\n' +
              'Plunger:\t\tHold Space (or Down Arrow), release to launch\n' +
              'Nudge table:\tX (left), . (right), Up Arrow (up)\n' +
              'New game:\tF2        Pause/Resume:  F3\n\n' +
              'Touch: tap the left or right half of the table to flip,\nhold the plunger lane or the LAUNCH button to pull.' });
          } }
        ];
      } },
      { label: '&Help', items: [
        { label: '&How to Play...', action: function () {
          WM.msgbox({ title: 'How to Play', owner: win, icon: 'info', sound: null, text:
            'Launch the ball and work your way up from Cadet to Fleet Admiral.\n\n' +
            'Each mission shown on the right asks for a set of shots. Completing it\n' +
            'earns points and a promotion. Promotions to Lieutenant, Commander and\n' +
            'Fleet Admiral award an extra ball.\n\n' +
            '• Roll through the three RE-FUEL lanes to re-fuel the launch ramp and\n   raise the bonus multiplier (flippers change the lit lanes).\n' +
            '• The launch ramp and the fuel targets light the hyperspace chute.\n' +
            '• Sink the hyperspace kickout for growing awards; the fourth one\n   awards an extra ball.\n' +
            '• Drop all three targets and loop the orbits for big points.\n\n' +
            'Nudge carefully: three hard nudges in a row will TILT the table.' });
        } },
        '-',
        { label: '&About 3D Pinball...', action: function () {
          WM.msgbox({ title: 'About 3D Pinball', owner: win, icon: 'info', text:
            '3D Pinball for Windows - Space Cadet\nA tribute table\n\n' +
            'Every graphic on this table is drawn in code and every sound is\nsynthesized on the fly. No original game assets are used.' });
        } }
      ] }
    ]);

    // -------------------------------------------------------------------
    // Main loop
    // -------------------------------------------------------------------
    var raf = 0, last = 0, acc = 0, dirty = true;
    function frame(now) {
      raf = 0;
      if (win.closed) return;
      var active = WM.active === win && !win.minimized && !document.hidden;
      if (!active && !autoPaused && !G.over) { autoPaused = true; releaseAll(); dirty = true; }
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (running()) {
        acc += dt;
        var n = 0;
        while (acc >= DT && n < 12) { step(DT); acc -= DT; n++; }
        if (n >= 12) acc = 0;
        render();
        dirty = !!(userPaused || autoPaused);
      } else if (dirty) {
        render();
        dirty = false;
      }
      musicTick();
      // Nothing left to animate (paused, minimized, hidden or in the background): stop
      // scheduling frames. kick() restarts the loop on input, focus or visibility.
      if (!dirty && (!running() || !active)) { last = 0; acc = 0; return; }
      raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (raf || win.closed) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    function onVisible() { if (!document.hidden) kick(); }
    document.addEventListener('visibilitychange', onVisible);

    win.on('close', function () {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      timers = [];
      document.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', onWinBlur);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('resize', fit);
      if (A.ctx) { try { A.ctx.close(); } catch (e) { /* ignore */ } A.ctx = null; }
    });
    win.on('focus', function () { dirty = true; kick(); });
    win.on('blur', function () { releaseAll(); });

    // Test hook (used by automated checks; harmless otherwise).
    win.pinball = {
      get state() { return G; }, ball: ball, flippers: flippers, plunger: plunger, stats: stats, input: input,
      step: function (n) { for (var i = 0; i < (n || 1); i++) step(DT); },
      press: function (side, on) { kick(); if (side === 'L') { input.L = on; setFlipper(0, on); } else { input.R = on; setFlipper(1, on); } },
      plunge: function (on) { kick(); if (on) plungeStart(); else plungeEnd(); },
      nudge: function () { kick(); return nudge.apply(null, arguments); },
      newGame: function () { kick(); return newGame.apply(null, arguments); }, render: render, kick: kick
    };

    newGame();
    fit();
    win.center();
    fit();
    kick();
    return win;
  }

  Shell.register('pinball', { name: '3D Pinball', icon: 'pinball', single: true, launch: launch });
})();
