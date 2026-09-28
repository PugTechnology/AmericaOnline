/* Solitaire (Klondike) and FreeCell, Windows 98 style. Cards are painted procedurally on canvas at 71x96. */
(function () {
  var h = U.h;
  var PW = 71, PH = 96;                       // the Win98 card size
  var RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  // Suits use the Microsoft order: 0 clubs, 1 diamonds, 2 hearts, 3 spades.
  function isRed(s) { return s === 1 || s === 2; }

  // ---------------------------------------------------------------------
  // Card painting
  // ---------------------------------------------------------------------
  function newCanvas() { return h('canvas', { width: PW, height: PH }); }

  function roundRect(x, l, t, w, hh, r) {
    x.beginPath();
    x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.arcTo(l + w, t, l + w, t + r, r);
    x.lineTo(l + w, t + hh - r); x.arcTo(l + w, t + hh, l + w - r, t + hh, r);
    x.lineTo(l + r, t + hh); x.arcTo(l, t + hh, l, t + hh - r, r);
    x.lineTo(l, t + r); x.arcTo(l, t, l + r, t, r);
    x.closePath();
  }

  // White card blank with a black outline.
  function cardBase(x) {
    roundRect(x, 0.5, 0.5, PW - 1, PH - 1, 3.5);
    x.fillStyle = '#fff'; x.fill();
    x.strokeStyle = '#000'; x.lineWidth = 1; x.stroke();
  }

  // A suit symbol centred on (cx, cy), about sz pixels tall. Each part is filled on its own so overlaps stay solid.
  function suit(x, s, cx, cy, sz) {
    x.fillStyle = isRed(s) ? '#e00000' : '#000';
    var disc = function (dx, dy, r) { x.beginPath(); x.arc(cx + dx * sz, cy + dy * sz, r * sz, 0, Math.PI * 2); x.fill(); };
    var tri = function (a, b, c, d, e, f) {
      x.beginPath(); x.moveTo(cx + a * sz, cy + b * sz); x.lineTo(cx + c * sz, cy + d * sz); x.lineTo(cx + e * sz, cy + f * sz); x.closePath(); x.fill();
    };
    if (s === 1) {
      x.beginPath();
      x.moveTo(cx, cy - 0.5 * sz); x.lineTo(cx + 0.36 * sz, cy); x.lineTo(cx, cy + 0.5 * sz); x.lineTo(cx - 0.36 * sz, cy);
      x.closePath(); x.fill();
    } else if (s === 2) {
      disc(-0.24, -0.2, 0.27); disc(0.24, -0.2, 0.27);
      tri(-0.49, -0.12, 0.49, -0.12, 0, 0.5);
    } else if (s === 3) {
      disc(-0.24, 0.08, 0.27); disc(0.24, 0.08, 0.27);
      tri(-0.49, 0.02, 0.49, 0.02, 0, -0.5);
      tri(0, 0.1, -0.2, 0.5, 0.2, 0.5);
    } else {
      disc(0, -0.26, 0.22); disc(-0.26, 0.1, 0.22); disc(0.26, 0.1, 0.22);
      tri(0, 0, -0.2, 0.5, 0.2, 0.5);
    }
  }

  // Pip positions as [column, row fraction]; the lower half is drawn upside down.
  var PIP_X = { L: 23, C: 35.5, R: 48 };
  var PIPS = {
    2: [['C', 0], ['C', 1]],
    3: [['C', 0], ['C', 0.5], ['C', 1]],
    4: [['L', 0], ['R', 0], ['L', 1], ['R', 1]],
    5: [['L', 0], ['R', 0], ['C', 0.5], ['L', 1], ['R', 1]],
    6: [['L', 0], ['R', 0], ['L', 0.5], ['R', 0.5], ['L', 1], ['R', 1]],
    7: [['L', 0], ['R', 0], ['C', 0.25], ['L', 0.5], ['R', 0.5], ['L', 1], ['R', 1]],
    8: [['L', 0], ['R', 0], ['C', 0.25], ['L', 0.5], ['R', 0.5], ['C', 0.75], ['L', 1], ['R', 1]],
    9: [['L', 0], ['R', 0], ['L', 1 / 3], ['R', 1 / 3], ['C', 0.5], ['L', 2 / 3], ['R', 2 / 3], ['L', 1], ['R', 1]],
    10: [['L', 0], ['R', 0], ['C', 1 / 6], ['L', 1 / 3], ['R', 1 / 3], ['L', 2 / 3], ['R', 2 / 3], ['C', 5 / 6], ['L', 1], ['R', 1]]
  };

  function poly(x, pts, fill, line) {
    x.beginPath();
    pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); });
    x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (line) { x.strokeStyle = line; x.lineWidth = 1; x.stroke(); }
  }
  function oval(x, cx, cy, rx, ry, fill, line) {
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (line) { x.strokeStyle = line; x.lineWidth = 1; x.stroke(); }
  }

  // Top half of a court card in local coordinates (38 wide, 38 tall); the bottom half is a rotated copy.
  function courtHalf(x, rank, s) {
    var main = isRed(s) ? '#d02020' : '#2038b0', gold = '#f0c828', skin = '#f5c69a', ink = '#000';
    var hair = rank === 12 ? '#c8901c' : '#7a4a1a';
    // robe with a belt
    poly(x, [[2, 38], [5, 28], [12, 24], [26, 24], [33, 28], [36, 38]], main, ink);
    x.fillStyle = gold; x.fillRect(3, 32, 33, 2);
    poly(x, [[16, 25], [19, 29], [22, 25]], gold, ink);
    // neck and face
    x.fillStyle = skin; x.fillRect(16, 21, 6, 5);
    if (rank === 12) { x.fillStyle = hair; x.fillRect(11, 9, 4, 19); x.fillRect(23, 9, 4, 19); }
    else { x.fillStyle = hair; x.fillRect(11, 10, 3, rank === 13 ? 14 : 9); x.fillRect(24, 10, 3, rank === 13 ? 14 : 9); }
    oval(x, 19, 15, 6.5, 7.5, skin, ink);
    x.fillStyle = ink; x.fillRect(16, 14, 2, 2); x.fillRect(21, 14, 2, 2);
    x.fillStyle = rank === 12 ? '#c01010' : '#802010'; x.fillRect(17, 19, 4, 1);
    if (rank === 13) {
      poly(x, [[13, 18], [25, 18], [23, 26], [19, 29], [15, 26]], hair, ink);
      x.fillStyle = '#c05030'; x.fillRect(17, 20, 4, 1);
      poly(x, [[11, 10], [11, 2], [15, 6], [19, 1], [23, 6], [27, 2], [27, 10]], gold, ink);
      x.fillStyle = '#d02020'; x.fillRect(18, 5, 2, 2);
      // sword
      x.fillStyle = '#909090'; x.fillRect(32, 4, 2, 24); x.fillStyle = gold; x.fillRect(29, 12, 8, 2);
    } else if (rank === 12) {
      poly(x, [[12, 9], [12, 3], [16, 6], [19, 2], [22, 6], [26, 3], [26, 9]], gold, ink);
      x.fillStyle = '#2060d0'; x.fillRect(18, 4, 2, 2);
      // flower
      x.fillStyle = '#208020'; x.fillRect(32, 14, 1, 14);
      oval(x, 32.5, 12, 3, 3, '#e04080', ink);
    } else {
      // jack: feathered cap
      poly(x, [[11, 9], [12, 3], [26, 3], [27, 9]], main, ink);
      poly(x, [[25, 4], [34, 0], [32, 9], [27, 8]], gold, ink);
      x.fillStyle = ink; x.fillRect(11, 8, 16, 1);
      // halberd
      x.fillStyle = '#909090'; x.fillRect(32, 8, 1, 22);
      poly(x, [[32, 10], [37, 12], [32, 16]], '#c0c0c0', ink);
    }
    suit(x, s, 7, 9, 9);
  }

  // Draws one face-up card onto a fresh canvas.
  function paintFace(rank, s) {
    var cv = newCanvas(), x = cv.getContext('2d');
    cardBase(x);
    var col = isRed(s) ? '#e00000' : '#000';
    // corner index, top-left and (rotated) bottom-right
    for (var k = 0; k < 2; k++) {
      x.save();
      if (k) { x.translate(PW, PH); x.rotate(Math.PI); }
      x.fillStyle = col; x.font = 'bold 13px Arial, Helvetica, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'top';
      x.fillText(RANKS[rank], 10, 3);
      suit(x, s, 10, 25, 10);
      x.restore();
    }
    if (rank === 1) {
      suit(x, s, 35.5, 48, 30);
    } else if (rank >= 11) {
      // framed court card
      x.save();
      x.beginPath(); x.rect(17, 9, 38, 78); x.clip();
      x.fillStyle = '#fff6cf'; x.fillRect(17, 9, 38, 78);
      for (var q = 0; q < 2; q++) {
        x.save();
        if (q) { x.translate(35.5, 48); x.rotate(Math.PI); x.translate(-35.5, -48); }
        x.translate(17, 10);
        courtHalf(x, rank, s);
        x.restore();
      }
      x.restore();
      x.strokeStyle = '#000'; x.lineWidth = 1; x.strokeRect(16.5, 8.5, 39, 79);
    } else {
      PIPS[rank].forEach(function (p) {
        var px = PIP_X[p[0]], py = 18 + p[1] * 60;
        x.save(); x.translate(px, py);
        if (p[1] > 0.5) x.rotate(Math.PI);
        suit(x, s, 0, 0, 13);
        x.restore();
      });
    }
    return cv;
  }

  // ---- card backs ----
  function hatch(x, bg, fg, step) {
    x.fillStyle = bg; x.fillRect(3, 3, 65, 90);
    x.strokeStyle = fg; x.lineWidth = 1; x.beginPath();
    for (var i = -100; i < 160; i += step) { x.moveTo(i, 0); x.lineTo(i + 100, 100); x.moveTo(i + 100, 0); x.lineTo(i, 100); }
    x.stroke();
  }
  function weave(x, a, b) {
    for (var j = 0; j < 23; j++) for (var i = 0; i < 17; i++) {
      x.fillStyle = (i + j) % 2 ? a : b;
      if ((i >> 1) % 2 === (j >> 1) % 2) x.fillRect(3 + i * 4, 3 + j * 4, 4, 2); else x.fillRect(3 + i * 4, 3 + j * 4, 2, 4);
      x.fillStyle = (i + j) % 2 ? b : a;
      if ((i >> 1) % 2 === (j >> 1) % 2) x.fillRect(3 + i * 4, 5 + j * 4, 4, 2); else x.fillRect(5 + i * 4, 3 + j * 4, 2, 4);
    }
  }
  function dots(x, bg, fg, step) {
    x.fillStyle = bg; x.fillRect(3, 3, 65, 90); x.fillStyle = fg;
    for (var j = 0; j < 90 / step; j++) for (var i = 0; i < 65 / step; i++) {
      x.beginPath(); x.arc(3 + step / 2 + i * step + (j % 2 ? step / 2 : 0), 3 + step / 2 + j * step, 1.6, 0, Math.PI * 2); x.fill();
    }
  }
  function stripes(x, a, b) {
    for (var i = 0; i < 17; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(3 + i * 4, 3, 4, 90); }
  }
  function checks(x, a, b) {
    for (var j = 0; j < 23; j++) for (var i = 0; i < 17; i++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(3 + i * 4, 3 + j * 4, 4, 4); }
  }
  function crenels(x, cx, y, w) {
    for (var i = 0; i < w; i += 4) x.fillRect(cx + i, y - 3, 2, 3);
  }
  var BACKS = [
    function (x) { hatch(x, '#0000a8', '#7878ff', 5); },
    function (x) { weave(x, '#b01818', '#e86060'); },
    function (x) {   // castle
      x.fillStyle = '#4a94e8'; x.fillRect(3, 3, 65, 90);
      x.fillStyle = '#20a020'; x.fillRect(3, 76, 65, 17);
      x.fillStyle = '#b8b8b8'; x.fillRect(19, 46, 33, 32); x.fillRect(11, 38, 13, 40); x.fillRect(47, 38, 13, 40);
      x.fillStyle = '#909090'; crenels(x, 11, 38, 13); crenels(x, 47, 38, 13); crenels(x, 25, 46, 22);
      x.fillStyle = '#b8b8b8'; crenels(x, 11, 38, 13); crenels(x, 47, 38, 13); crenels(x, 25, 46, 22);
      x.fillStyle = '#d02020'; x.fillRect(16, 26, 1, 12); x.fillRect(53, 26, 1, 12); poly(x, [[17, 26], [24, 29], [17, 32]], '#d02020');
      poly(x, [[54, 26], [61, 29], [54, 32]], '#d02020');
      x.fillStyle = '#402010'; x.fillRect(31, 62, 9, 16); x.fillRect(32, 59, 7, 3);
      x.fillStyle = '#000'; x.fillRect(15, 46, 2, 5); x.fillRect(54, 46, 2, 5); x.fillRect(27, 54, 2, 4); x.fillRect(42, 54, 2, 4);
    },
    function (x) {   // island
      x.fillStyle = '#68c8f8'; x.fillRect(3, 3, 65, 90);
      oval(x, 52, 22, 8, 8, '#ffe020', null);
      x.fillStyle = '#1060c0'; x.fillRect(3, 62, 65, 31);
      x.fillStyle = '#60a0f0'; for (var i = 0; i < 6; i++) x.fillRect(8 + i * 11, 70 + (i % 3) * 7, 6, 1);
      oval(x, 35, 64, 22, 8, '#e8d080', null);
      x.strokeStyle = '#7a4a1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(35, 64); x.quadraticCurveTo(40, 52, 37, 38); x.stroke();
      x.strokeStyle = '#108010'; x.lineWidth = 2; x.beginPath();
      x.moveTo(37, 38); x.quadraticCurveTo(28, 32, 20, 40); x.moveTo(37, 38); x.quadraticCurveTo(46, 30, 54, 38);
      x.moveTo(37, 38); x.quadraticCurveTo(34, 28, 30, 27); x.moveTo(37, 38); x.quadraticCurveTo(42, 27, 46, 28); x.stroke();
    },
    function (x) {   // robot
      x.fillStyle = '#485068'; x.fillRect(3, 3, 65, 90);
      x.strokeStyle = '#c0c0c0'; x.lineWidth = 1; x.beginPath(); x.moveTo(35.5, 26); x.lineTo(35.5, 15); x.stroke();
      oval(x, 35.5, 13, 3, 3, '#ff3030', null);
      x.fillStyle = '#c0c0c0'; x.fillRect(19, 26, 33, 30); x.strokeStyle = '#000'; x.strokeRect(19.5, 26.5, 32, 29);
      x.fillStyle = '#ffe020'; x.fillRect(25, 33, 8, 7); x.fillRect(38, 33, 8, 7);
      x.fillStyle = '#000'; x.fillRect(28, 35, 2, 3); x.fillRect(41, 35, 2, 3);
      x.fillStyle = '#404040'; for (var i = 0; i < 6; i++) x.fillRect(25 + i * 4, 46, 2, 6);
      x.fillStyle = '#a0a0a0'; x.fillRect(24, 60, 23, 22); x.strokeStyle = '#000'; x.strokeRect(24.5, 60.5, 22, 21);
      x.fillStyle = '#30c030'; x.fillRect(30, 66, 4, 4); x.fillStyle = '#e03030'; x.fillRect(38, 66, 4, 4);
    },
    function (x) { dots(x, '#106828', '#70e088', 8); },
    function (x) { hatch(x, '#a01020', '#f08090', 8); },
    function (x) { stripes(x, '#ffffff', '#2040b0'); },
    function (x) {   // space
      x.fillStyle = '#000018'; x.fillRect(3, 3, 65, 90);
      var seed = 7; x.fillStyle = '#fff';
      for (var i = 0; i < 50; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; var a = 3 + seed % 65; seed = (seed * 1103515245 + 12345) & 0x7fffffff; x.fillRect(a, 3 + seed % 90, 1, 1); }
      oval(x, 35.5, 48, 15, 15, '#e07820', null); oval(x, 30, 43, 5, 5, '#f0a850', null);
      x.strokeStyle = '#c0c0ff'; x.lineWidth = 2; x.beginPath(); x.ellipse(35.5, 48, 28, 7, -0.4, 0, Math.PI * 2); x.stroke();
    },
    function (x) { checks(x, '#c01818', '#181818'); },
    function (x) {   // sun
      x.fillStyle = '#101868'; x.fillRect(3, 3, 65, 90);
      x.strokeStyle = '#ffd820'; x.lineWidth = 2; x.beginPath();
      for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8; x.moveTo(35.5 + Math.cos(a) * 17, 48 + Math.sin(a) * 17); x.lineTo(35.5 + Math.cos(a) * 30, 48 + Math.sin(a) * 30); }
      x.stroke(); oval(x, 35.5, 48, 13, 13, '#ffd820', '#000');
      x.fillStyle = '#000'; x.fillRect(31, 45, 2, 2); x.fillRect(38, 45, 2, 2); x.fillRect(32, 52, 7, 1);
    },
    function (x) { hatch(x, '#602090', '#c090f0', 6); }
  ];
  var BACK_NAMES = ['Crosshatch', 'Weave', 'Castle', 'Island', 'Robot', 'Spots', 'Lattice', 'Stripes', 'Space', 'Checkers', 'Sun', 'Violet'];

  function paintBack(n) {
    var cv = newCanvas(), x = cv.getContext('2d');
    cardBase(x);
    x.save();
    roundRect(x, 3, 3, 65, 90, 2); x.clip();
    BACKS[n](x);
    x.restore();
    x.strokeStyle = '#000'; x.lineWidth = 1; roundRect(x, 2.5, 2.5, 66, 91, 2); x.stroke();
    return cv;
  }

  // Caches: a canvas (for the win animation) and a data URL (for the DOM cards).
  var faceCache = {}, backCache = {};
  var Cards = {
    face: function (rank, s) { var k = rank + ':' + s; return faceCache[k] || (faceCache[k] = paintFace(rank, s)); },
    faceUrl: function (rank, s) { var c = Cards.face(rank, s); return c.url || (c.url = 'url(' + c.toDataURL() + ')'); },
    back: function (n) { return backCache[n] || (backCache[n] = paintBack(n)); },
    backUrl: function (n) { var c = Cards.back(n); return c.url || (c.url = 'url(' + c.toDataURL() + ')'); }
  };
  window.Cards = Cards;

  // ---------------------------------------------------------------------
  // Shared UI helpers
  // ---------------------------------------------------------------------
  function backChoice() { return U.store.get('w98.cards.back', 0); }

  // Modal dialog with a button row. buttons: [{ label, def, action(close) }]
  function box(owner, title, content, buttons, width) {
    var row = h('div', { className: 'button-row' });
    var dlg = WM.dialog({ title: title, owner: owner, width: width || 300, content: [h('div', { className: 'cards-dlg' }, content), row] });
    function close() { dlg.close(true); }
    buttons.forEach(function (b) {
      var btn = h('button', { className: 'btn' + (b.def ? ' default' : ''), onclick: function () { b.action ? b.action(close) : close(); } });
      btn.appendChild(U.label(b.label));
      row.appendChild(btn);
    });
    dlg.onKey = function (e) {
      if (e.key === 'Escape') { close(); return true; }
      if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName === 'INPUT') {
        var d = row.querySelector('.default'); if (d) d.click();
        return true;
      }
      return false;
    };
    return dlg;
  }

  // Deck picker: a grid of card backs.
  function chooseDeck(win, done) {
    var sel = backChoice(), cells = [];
    var grid = h('div', { className: 'deck-grid' });
    BACKS.forEach(function (_, i) {
      var img = h('img', { src: Cards.back(i).toDataURL(), width: PW, height: PH, draggable: 'false', title: BACK_NAMES[i] });
      var cell = h('div', { className: 'deck-cell' + (i === sel ? ' sel' : '') }, img);
      cell.addEventListener('pointerdown', function () { pick(i); });
      cell.addEventListener('dblclick', function () { pick(i); U.store.set('w98.cards.back', sel); dlg.close(true); done(); });
      cells.push(cell); grid.appendChild(cell);
    });
    var dlg;
    function pick(i) { sel = i; cells.forEach(function (c, k) { c.classList.toggle('sel', k === i); }); }
    dlg = box(win, 'Select Card Back', [h('p', null, 'Choose a card back:'), grid], [
      { label: 'OK', def: true, action: function (close) { U.store.set('w98.cards.back', sel); close(); done(); } },
      { label: 'Cancel' }
    ], 380);
  }

  // Finds the drop target with the greatest overlap that accepts the drop.
  function pickTarget(l, t, targets, accepts) {
    var best = null, bestA = 0;
    targets.forEach(function (g) {
      var a = Math.max(0, Math.min(l + PW, g.x + PW) - Math.max(l, g.x)) * Math.max(0, Math.min(t + PH, g.y + PH) - Math.max(t, g.y));
      if (a > bestA && accepts(g)) { best = g; bestA = a; }
    });
    return best;
  }

  // ---------------------------------------------------------------------
  // Solitaire (Klondike)
  // ---------------------------------------------------------------------
  function launchSolitaire() {
    var COLX = function (i) { return 10 + 80 * i; };
    var TOP = 10, TABY = 118, BW = 571, BH = 440;
    var opts = Object.assign({ draw: 1, scoring: 'standard', timed: true, keep: false, status: true }, U.store.get('w98.sol.opts', {}));
    var gameDraw, gameScoring;
    var cards = [], stock, waste, found, tab, score, passes, moves, seconds, clock, undo, over, drag, lastClick, anim;

    var board = h('div', { className: 'card-board sol-board' });
    var scoreEl = h('div', null, ''), timeEl = h('div', null, '');
    var status = h('div', { className: 'status-bar' }, [scoreEl, timeEl]);
    var win = WM.open({ app: 'solitaire', title: 'Solitaire', icon: 'solitaire', width: BW + 6, height: 300, resizable: false, maximizable: false, content: [board, status], className: 'cards-win' });
    board.style.width = BW + 'px'; board.style.height = BH + 'px';
    win.el.style.width = 'auto'; win.el.style.height = 'auto';

    // static outlines for the piles
    var slots = {};
    function slot(key, x, y, cls) {
      var el = h('div', { className: 'slot ' + (cls || ''), style: { left: x + 'px', top: y + 'px' } });
      slots[key] = { el: el, x: x, y: y }; board.appendChild(el); return el;
    }
    slot('stock', COLX(0), TOP, 'stock');
    slot('waste', COLX(1), TOP);
    for (var i = 0; i < 4; i++) slot('f' + i, COLX(3 + i), TOP, 'ace');
    for (i = 0; i < 7; i++) slot('t' + i, COLX(i), TABY);

    for (i = 0; i < 52; i++) {
      var c = { id: i, r: (i % 13) + 1, s: Math.floor(i / 13), up: false, el: h('div', { className: 'card' }) };
      c.el._c = c;
      cards.push(c); board.appendChild(c.el);
    }

    function setStatus() {
      var pre = gameScoring === 'vegas' ? 'Score: ' + (score < 0 ? '-$' + (-score) : '$' + score) : 'Score: ' + score;
      scoreEl.textContent = gameScoring === 'none' ? '' : pre;
      timeEl.textContent = opts.timed ? 'Time: ' + seconds : '';
      timeEl.style.display = opts.timed ? '' : 'none';
      status.style.display = opts.status ? '' : 'none';
    }

    // ---- layout ----
    function tabStep(col) {
      var downs = 0, ups = 0;
      col.forEach(function (c) { if (c.up) ups++; else downs++; });
      var avail = BH - TABY - PH - 6, up = 16, dn = 4;
      if (downs * dn + Math.max(0, ups - 1) * up > avail) up = Math.max(5, (avail - downs * dn) / Math.max(1, ups - 1));
      return { dn: dn, up: up };
    }
    function place(c, x, y, z) {
      var s = c.el.style;
      s.left = x + 'px'; s.top = y + 'px'; s.zIndex = z; s.display = '';
      s.backgroundImage = c.up ? Cards.faceUrl(c.r, c.s) : Cards.backUrl(backChoice());
    }
    function tabTop(i) {   // y of the next card in tableau pile i
      var col = tab[i], st = tabStep(col), y = TABY;
      col.forEach(function (c) { y += c.up ? st.up : st.dn; });
      return y;
    }
    function render() {
      stock.forEach(function (c, k) { place(c, COLX(0), TOP, k + 1); });
      var fan = gameDraw === 3 ? 3 : 1;
      waste.forEach(function (c, k) {
        var d = waste.length - 1 - k;
        place(c, COLX(1) + (d < fan ? (fan - 1 - d) * 14 : 0), TOP, k + 1);
      });
      found.forEach(function (p, i) { p.forEach(function (c, k) { place(c, COLX(3 + i), TOP, k + 1); }); });
      tab.forEach(function (col, i) {
        var st = tabStep(col), y = TABY;
        col.forEach(function (c, k) { place(c, COLX(i), y, k + 1); y += c.up ? st.up : st.dn; });
      });
      var canRecycle = passesLeft();
      slots.stock.el.classList.toggle('empty-ok', !stock.length && canRecycle);
      slots.stock.el.classList.toggle('empty-no', !stock.length && !canRecycle);
      cards.forEach(function (c) { c.el.classList.remove('sel'); });
      setStatus();
    }

    // ---- rules ----
    function canTab(c, i) {
      var col = tab[i];
      if (!col.length) return c.r === 13;
      var t = col[col.length - 1];
      return t.up && t.r === c.r + 1 && isRed(t.s) !== isRed(c.s);
    }
    function canFound(c, i) {
      var p = found[i];
      if (!p.length) return c.r === 1;
      var t = p[p.length - 1];
      return t.s === c.s && t.r + 1 === c.r;
    }
    function locate(c) {
      var k, p;
      if ((k = stock.indexOf(c)) !== -1) return { p: 'stock', k: k };
      if ((k = waste.indexOf(c)) !== -1) return { p: 'waste', k: k };
      for (p = 0; p < 4; p++) if ((k = found[p].indexOf(c)) !== -1) return { p: 'found', i: p, k: k };
      for (p = 0; p < 7; p++) if ((k = tab[p].indexOf(c)) !== -1) return { p: 'tab', i: p, k: k };
      return null;
    }
    function pileOf(l) { return l.p === 'tab' ? tab[l.i] : l.p === 'waste' ? waste : l.p === 'found' ? found[l.i] : stock; }
    // The run of cards picked up when grabbing c, or null.
    function runFrom(c) {
      var l = locate(c);
      if (!l || !c.up || l.p === 'stock') return null;
      var pile = pileOf(l);
      if (l.p === 'tab') return pile.slice(l.k);
      return l.k === pile.length - 1 ? [c] : null;
    }
    function passesLeft() {
      if (gameScoring !== 'vegas') return waste.length > 0 || stock.length > 0;
      return passes < (gameDraw === 3 ? 3 : 1) || stock.length > 0;
    }

    function addScore(d) {
      if (gameScoring === 'none') return;
      score += d;
      if (gameScoring === 'standard') score = Math.max(0, score);
      else if (opts.keep) U.store.set('w98.sol.vegas', score);
    }

    // ---- undo ----
    function snapshot() {
      var sn = function (a) { return a.map(function (c) { return c.id * 2 + (c.up ? 1 : 0); }); };
      return { stock: sn(stock), waste: sn(waste), found: found.map(sn), tab: tab.map(sn), score: score, passes: passes };
    }
    function restore(s) {
      var un = function (a) { return a.map(function (v) { var c = cards[v >> 1]; c.up = !!(v & 1); return c; }); };
      stock = un(s.stock); waste = un(s.waste); found = s.found.map(un); tab = s.tab.map(un);
      score = s.score; passes = s.passes;
    }
    function pushUndo() { undo.push(snapshot()); if (undo.length > 400) undo.shift(); }
    function doUndo() {
      if (over || !undo.length) return;
      restore(undo.pop()); moves++;
      if (gameScoring === 'vegas' && opts.keep) U.store.set('w98.sol.vegas', score);
      render();
    }

    // ---- clock ----
    function startClock() {
      if (clock || !opts.timed) return;
      clock = setInterval(function () {
        seconds++;
        if (gameScoring === 'standard' && seconds % 10 === 0) score = Math.max(0, score - 2);
        setStatus();
      }, 1000);
    }
    function stopClock() { clearInterval(clock); clock = null; }

    // ---- moves ----
    function doMove(run, from, to) {
      pushUndo(); startClock();
      var src = pileOf(from);
      src.splice(src.length - run.length, run.length);
      var dst = to.p === 'tab' ? tab[to.i] : found[to.i];
      dst.push.apply(dst, run);
      if (to.p === 'found') { if (from.p !== 'found') addScore(gameScoring === 'vegas' ? 5 : 10); }
      else if (from.p === 'waste') addScore(5);
      else if (from.p === 'found') addScore(gameScoring === 'vegas' ? -5 : -15);
      if (from.p === 'tab' && src.length && !src[src.length - 1].up) { src[src.length - 1].up = true; addScore(5); }
      moves++;
      render();
      if (found.every(function (p) { return p.length === 13; })) winGame();
    }

    function dealFromStock() {
      if (over) return;
      if (!stock.length) {
        if (!waste.length || !passesLeft()) return;
        pushUndo(); startClock();
        while (waste.length) { var w = waste.pop(); w.up = false; stock.push(w); }
        passes++;
        if (gameScoring === 'standard') {
          if (gameDraw === 1) addScore(-100); else if (passes > 3) addScore(-20);
        }
      } else {
        pushUndo(); startClock();
        for (var n = 0; n < gameDraw && stock.length; n++) { var t = stock.pop(); t.up = true; waste.push(t); }
      }
      moves++;
      render();
    }

    function autoFound(c) {
      var run = runFrom(c), l = locate(c);
      if (!run || run.length !== 1 || l.p === 'found') return false;
      for (var i = 0; i < 4; i++) if (found[i].length && canFound(c, i)) { doMove(run, l, { p: 'found', i: i }); return true; }
      for (i = 0; i < 4; i++) if (!found[i].length && canFound(c, i)) { doMove(run, l, { p: 'found', i: i }); return true; }
      return false;
    }

    // ---- deal ----
    function deal() {
      if (anim) stopWin(true);
      stopClock();
      gameDraw = opts.draw; gameScoring = opts.scoring;
      var deck = cards.slice();
      for (var i = 51; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
      cards.forEach(function (c) { c.up = false; });
      tab = []; found = [[], [], [], []]; waste = []; undo = []; passes = 0; moves = 0; seconds = 0; over = false; drag = null; lastClick = null;
      var n = 0;
      for (i = 0; i < 7; i++) {
        tab[i] = [];
        for (j = 0; j <= i; j++) tab[i].push(deck[n++]);
        tab[i][i].up = true;
      }
      stock = deck.slice(n);
      score = gameScoring === 'vegas' ? (opts.keep ? U.store.get('w98.sol.vegas', 0) : 0) - 52 : 0;
      if (gameScoring === 'vegas' && opts.keep) U.store.set('w98.sol.vegas', score);
      render();
    }

    // ---- pointer handling ----
    function targets(run) {
      var list = [], i, y;
      for (i = 0; i < 7; i++) {
        y = tab[i].length ? tabTop(i) - (tab[i][tab[i].length - 1].up ? tabStep(tab[i]).up : tabStep(tab[i]).dn) : TABY;
        list.push({ p: 'tab', i: i, x: COLX(i), y: y });
      }
      if (run.length === 1) for (i = 0; i < 4; i++) list.push({ p: 'found', i: i, x: COLX(3 + i), y: TOP });
      return list;
    }
    function accepts(run, g) { return g.p === 'tab' ? canTab(run[0], g.i) : canFound(run[0], g.i); }

    board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    board.addEventListener('pointerdown', function (e) {
      if (over || anim || e.button > 0) return;
      win.focus();
      var t = e.target, c = t._c;
      if (!c && t.classList.contains('stock')) { dealFromStock(); return; }
      if (!c) return;
      if (stock.indexOf(c) !== -1) { dealFromStock(); return; }
      var run = runFrom(c);
      if (!run) return;
      e.preventDefault();
      drag = { c: c, run: run, from: locate(c), sx: e.clientX, sy: e.clientY, moved: false, pos: run.map(function (r) { return [parseFloat(r.el.style.left), parseFloat(r.el.style.top)]; }), z: run.map(function (r) { return r.el.style.zIndex; }) };
      try { t.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    });
    board.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true;
      drag.run.forEach(function (r, k) {
        r.el.style.left = (drag.pos[k][0] + dx) + 'px'; r.el.style.top = (drag.pos[k][1] + dy) + 'px'; r.el.style.zIndex = 1000 + k;
      });
    });
    function endDrag(e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved) {
        var l = parseFloat(d.run[0].el.style.left), t = parseFloat(d.run[0].el.style.top);
        var g = pickTarget(l, t, targets(d.run), function (g) { return accepts(d.run, g); });
        if (g) doMove(d.run, d.from, g); else render();
        lastClick = null;
        return;
      }
      // a plain click: two in quick succession send the card to a foundation
      var now = Date.now();
      if (lastClick && lastClick.c === d.c && now - lastClick.t < 450) { lastClick = null; autoFound(d.c); }
      else lastClick = { c: d.c, t: now };
    }
    board.addEventListener('pointerup', endDrag);
    board.addEventListener('pointercancel', function () { if (drag) { drag = null; render(); } });

    // ---- the win animation: cards bounce along the bottom, leaving trails ----
    function winGame() {
      over = true; stopClock();
      if (gameScoring === 'standard' && opts.timed && seconds >= 30) addScore(Math.floor(700000 / seconds));
      setStatus();
      cascade();
    }
    function cascade() {
      var cv = h('canvas', { width: BW, height: BH, className: 'win-canvas' });
      board.appendChild(cv);
      var x = cv.getContext('2d');
      var order = [];
      for (var k = 12; k >= 0; k--) for (var p = 0; p < 4; p++) if (found[p][k]) order.push({ c: found[p][k], x: COLX(3 + p), y: TOP });
      var cur = null, raf = null;
      anim = { cv: cv };
      function launchNext() {
        var o = order.shift();
        if (!o) { cur = null; return; }
        o.c.el.style.display = 'none';
        var dir = Math.random() < 0.5 ? -1 : 1;
        cur = { img: Cards.face(o.c.r, o.c.s), x: o.x, y: o.y, dx: dir * (3 + Math.random() * 5), dy: -Math.random() * 6 };
      }
      function frame() {
        if (!cur && order.length) launchNext();
        if (cur) {
          for (var n = 0; n < 3 && cur; n++) {
            cur.x += cur.dx; cur.y += cur.dy; cur.dy += 0.5;
            if (cur.y + PH > BH) { cur.y = BH - PH; cur.dy = -cur.dy * 0.85; }
            x.drawImage(cur.img, Math.round(cur.x), Math.round(cur.y));
            if (cur.x < -PW || cur.x > BW) cur = null;
          }
        }
        raf = requestAnimationFrame(frame);
      }
      function stop() { stopWin(false); }
      anim.stop = stop;
      cv.addEventListener('pointerdown', stop);
      anim.key = function () { stop(); };
      document.addEventListener('keydown', anim.key, true);
      anim.cancel = function () { cancelAnimationFrame(raf); };
      launchNext();
      raf = requestAnimationFrame(frame);
    }
    // Ends the animation; unless quiet, asks whether to deal again.
    function stopWin(quiet) {
      if (!anim) return;
      var a = anim; anim = null;
      a.cancel(); document.removeEventListener('keydown', a.key, true);
      if (a.cv.parentNode) a.cv.parentNode.removeChild(a.cv);
      cards.forEach(function (c) { c.el.style.display = ''; });
      if (quiet) return;
      WM.msgbox({ title: 'Solitaire', owner: win, icon: 'question', text: 'Deal Again?', buttons: ['Yes', 'No'] }).then(function (b) { if (b === 'Yes') deal(); });
    }

    // ---- options ----
    function optionsDialog() {
      var r = function (name, val, text, on) { return h('label', { className: 'radio' }, [h('input', { type: 'radio', name: name, value: val, checked: on }), U.label(text)]); };
      var cb = function (text, on) { var i = h('input', { type: 'checkbox', checked: on }); return [i, h('label', { className: 'check' }, [i, U.label(text)])]; };
      var drawG = h('fieldset', { className: 'group' }, [h('legend', null, 'Draw'), r('sd', '1', 'Draw &One', opts.draw === 1), r('sd', '3', 'Draw &Three', opts.draw === 3)]);
      var scoreG = h('fieldset', { className: 'group' }, [h('legend', null, 'Scoring'), r('ss', 'standard', '&Standard', opts.scoring === 'standard'), r('ss', 'vegas', '&Vegas', opts.scoring === 'vegas'), r('ss', 'none', 'N&one', opts.scoring === 'none')]);
      var timed = cb('Timed game', opts.timed), stat = cb('Status bar', opts.status), keep = cb('&Keep score', opts.keep);
      var content = [h('div', { className: 'cards-cols' }, [drawG, scoreG]), timed[1], stat[1], keep[1]];
      box(win, 'Options', content, [
        { label: 'OK', def: true, action: function (close) {
          opts.draw = drawG.querySelector(':checked').value === '3' ? 3 : 1;
          opts.scoring = scoreG.querySelector(':checked').value;
          opts.timed = timed[0].checked; opts.status = stat[0].checked; opts.keep = keep[0].checked;
          U.store.set('w98.sol.opts', opts);
          if (!opts.timed) stopClock(); else if (moves && !over) startClock();
          setStatus(); close();
        } },
        { label: 'Cancel' }
      ], 280);
    }

    win.on('close', function () { stopClock(); if (anim) stopWin(true); });

    Menu.bar(win, [
      { label: '&Game', items: function () {
        return [
          { label: '&Deal', shortcut: 'F2', action: deal },
          { label: '&Undo', shortcut: 'Ctrl+Z', disabled: over || !undo.length, action: doUndo },
          '-',
          { label: 'D&eck...', shortcut: 'F3', action: function () { chooseDeck(win, render); } },
          { label: '&Options...', action: optionsDialog },
          '-',
          { label: 'E&xit', action: function () { win.close(); } }
        ];
      } },
      { label: '&Help', items: [{ label: '&About Solitaire...', action: function () { Shell.launch('about', { name: 'Solitaire', icon: 'solitaire' }); } }] }
    ]);
    win.onKey = function (e) {
      if (anim) return false;
      if (e.key === 'F2') { deal(); return true; }
      if (e.key === 'F3') { chooseDeck(win, render); return true; }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { doUndo(); return true; }
      return false;
    };

    // handles for tests and tinkering
    win.game = {
      state: function () { return { stock: stock, waste: waste, found: found, tab: tab, score: score, seconds: seconds, moves: moves, over: over }; },
      deal: deal, winNow: function () {
        deal(); found = [[], [], [], []]; stock = []; waste = []; tab = [[], [], [], [], [], [], []];
        cards.forEach(function (c) { c.up = true; found[c.s].push(c); });
        found.forEach(function (p) { p.sort(function (a, b) { return a.r - b.r; }); });
        render(); winGame();
      }
    };
    deal();
    win.center();
    return win;
  }

  // ---------------------------------------------------------------------
  // FreeCell
  // ---------------------------------------------------------------------
  // The classic Microsoft deal: an LCG picks cards out of the deck, dealt left to right across 8 columns.
  function msDeal(num) {
    var seed = num, deck = [], out = [], left = 52, i;
    for (i = 0; i < 52; i++) deck[i] = i;
    for (i = 0; i < 52; i++) {
      seed = (Math.imul(seed, 214013) + 2531011) | 0;
      var j = ((seed >>> 16) & 0x7fff) % left;
      out[i] = deck[j];
      deck[j] = deck[--left];
    }
    return out;   // card value v: rank = (v >> 2) + 1, suit = v & 3
  }
  function cardName(v) { return RANKS[(v >> 2) + 1] + 'CDHS'.charAt(v & 3); }

  function launchFreeCell() {
    var BW = 654, BH = 450, TOP = 8, TABY = 118;
    var COLX = function (i) { return 8 + 81 * i; };
    var FREEX = function (i) { return 8 + 75 * i; };
    var HOMEX = function (i) { return 350 + 75 * i; };
    var cards = [], free, home, col, gameNum, moves, undo, over, drag, sel, lastClick, counted, kingDir = 0;

    var board = h('div', { className: 'card-board fc-board' });
    var gameEl = h('div', null, ''), leftEl = h('div', null, '');
    var win = WM.open({ app: 'freecell', title: 'FreeCell', icon: 'freecell', width: BW + 6, height: 300, resizable: false, maximizable: false, content: [board, h('div', { className: 'status-bar' }, [gameEl, leftEl])], className: 'cards-win' });
    board.style.width = BW + 'px'; board.style.height = BH + 'px';
    win.el.style.width = 'auto'; win.el.style.height = 'auto';

    var slots = {}, i;
    function slot(key, x, y) {
      var el = h('div', { className: 'slot', style: { left: x + 'px', top: y + 'px' } });
      el._slot = key; slots[key] = { el: el, x: x, y: y }; board.appendChild(el);
    }
    for (i = 0; i < 4; i++) slot('free' + i, FREEX(i), TOP);
    for (i = 0; i < 4; i++) slot('home' + i, HOMEX(i), TOP);
    for (i = 0; i < 8; i++) slot('col' + i, COLX(i), TABY);
    for (i = 0; i < 52; i++) {
      var c = { id: i, r: (i >> 2) + 1, s: i & 3, up: true, el: h('div', { className: 'card' }) };
      c.el._c = c; cards.push(c); board.appendChild(c.el);
    }

    // the king in the middle watches the mouse
    var king = h('canvas', { width: 32, height: 32, className: 'fc-king' });
    king.style.left = '311px'; king.style.top = (TOP + 30) + 'px';
    board.appendChild(king);
    function drawKing(dir, happy) {
      var x = king.getContext('2d');
      x.clearRect(0, 0, 32, 32);
      var pen = function (col, a, b, w, hh) { x.fillStyle = col; x.fillRect(a, b, w, hh); };
      // crown
      poly(x, [[7, 11], [7, 3], [12, 7], [16, 1], [20, 7], [25, 3], [25, 11]], '#ffd800', '#000');
      pen('#e02020', 15, 5, 2, 2);
      // hair and face
      pen('#7a4a1a', 6, 10, 20, 10);
      pen('#f5c69a', 9, 10, 14, 14); x.strokeStyle = '#000'; x.strokeRect(9.5, 10.5, 13, 13);
      // eyes: whites with pupils looking left, ahead or right
      pen('#fff', 11, 14, 4, 3); pen('#fff', 17, 14, 4, 3);
      var px = dir < 0 ? 0 : dir > 0 ? 2 : 1;
      pen('#000', 11 + px, 14, 2, 3); pen('#000', 17 + px, 14, 2, 3);
      // beard and mouth
      poly(x, [[8, 20], [24, 20], [22, 28], [16, 31], [10, 28]], '#7a4a1a', '#000');
      pen('#f5c69a', 13, 21, 6, 3);
      pen('#c02010', 14, happy ? 22 : 23, 4, 1);
      if (happy) { pen('#c02010', 13, 21, 1, 1); pen('#c02010', 18, 21, 1, 1); }
    }
    document.addEventListener('pointermove', watch);
    function watch(e) {
      if (win.closed) return;
      var r = king.getBoundingClientRect();
      var d = e.clientX < r.left + 6 ? -1 : e.clientX > r.right - 6 ? 1 : 0;
      if (d !== kingDir) { kingDir = d; drawKing(d, over); }
    }

    // ---- layout ----
    function step(k) {
      var avail = BH - TABY - PH - 6, n = col[k].length;
      return n > 1 ? Math.min(22, avail / (n - 1)) : 22;
    }
    function place(c, x, y, z) {
      var s = c.el.style;
      s.left = x + 'px'; s.top = y + 'px'; s.zIndex = z;
      s.backgroundImage = Cards.faceUrl(c.r, c.s);
    }
    function render() {
      free.forEach(function (c, k) { if (c) place(c, FREEX(k), TOP, 1); });
      home.forEach(function (p, k) { p.forEach(function (c, j) { place(c, HOMEX(k), TOP, j + 1); }); });
      col.forEach(function (p, k) { var st = step(k); p.forEach(function (c, j) { place(c, COLX(k), TABY + j * st, j + 1); }); });
      cards.forEach(function (c) { c.el.classList.remove('sel'); });
      if (sel) sel.run.forEach(function (c) { c.el.classList.add('sel'); });
      var n = 0; home.forEach(function (p) { n += p.length; });
      gameEl.textContent = 'Game #' + gameNum;
      leftEl.textContent = 'Cards left: ' + (52 - n);
      win.setTitle('FreeCell Game #' + gameNum);
    }

    // ---- rules ----
    function emptyFree() { return free.filter(function (c) { return !c; }).length; }
    function emptyCols() { return col.filter(function (p) { return !p.length; }).length; }
    // Largest run that can be moved: (free cells + 1) * 2^(empty columns), not counting the target column.
    function maxRun(toEmptyCol) { return (emptyFree() + 1) * Math.pow(2, emptyCols() - (toEmptyCol ? 1 : 0)); }
    function isSeq(run) {
      for (var k = 1; k < run.length; k++) if (run[k].r !== run[k - 1].r - 1 || isRed(run[k].s) === isRed(run[k - 1].s)) return false;
      return true;
    }
    function locate(c) {
      var k, p;
      if ((k = free.indexOf(c)) !== -1) return { p: 'free', i: k };
      for (p = 0; p < 4; p++) if ((k = home[p].indexOf(c)) !== -1) return { p: 'home', i: p, k: k };
      for (p = 0; p < 8; p++) if ((k = col[p].indexOf(c)) !== -1) return { p: 'col', i: p, k: k };
      return null;
    }
    function runFrom(c) {
      var l = locate(c);
      if (!l || l.p === 'home') return null;
      if (l.p === 'free') return [c];
      var run = col[l.i].slice(l.k);
      return isSeq(run) ? run : null;
    }
    // Can the run go to target g = { p, i }?
    function accepts(run, g) {
      var c = run[0], p;
      if (g.p === 'free') return run.length === 1 && !free[g.i];
      if (g.p === 'home') {
        if (run.length !== 1) return false;
        p = home[g.i];
        return p.length ? p[p.length - 1].s === c.s && p[p.length - 1].r + 1 === c.r : c.r === 1;
      }
      p = col[g.i];
      if (!p.length) return run.length <= maxRun(true);
      var t = p[p.length - 1];
      return t.r === c.r + 1 && isRed(t.s) !== isRed(c.s) && run.length <= maxRun(false);
    }

    // ---- undo ----
    function snapshot() {
      return { free: free.map(function (c) { return c ? c.id : -1; }), home: home.map(function (p) { return p.map(function (c) { return c.id; }); }), col: col.map(function (p) { return p.map(function (c) { return c.id; }); }) };
    }
    function restore(s) {
      var un = function (a) { return a.map(function (v) { return cards[v]; }); };
      free = s.free.map(function (v) { return v < 0 ? null : cards[v]; }); home = s.home.map(un); col = s.col.map(un);
    }
    function doUndo() { if (over || !undo.length) return; restore(undo.pop()); sel = null; render(); }

    // ---- statistics ----
    function stats() { return Object.assign({ won: 0, lost: 0, streak: 0, bestWin: 0, bestLose: 0 }, U.store.get('w98.freecell.stats', {})); }
    function record(won) {
      var s = stats();
      if (won) { s.won++; s.streak = s.streak > 0 ? s.streak + 1 : 1; s.bestWin = Math.max(s.bestWin, s.streak); }
      else { s.lost++; s.streak = s.streak < 0 ? s.streak - 1 : -1; s.bestLose = Math.max(s.bestLose, -s.streak); }
      U.store.set('w98.freecell.stats', s);
    }
    function statsDialog() {
      var s = stats(), total = s.won + s.lost;
      var row = function (a, b) { return h('tr', null, [h('td', null, a), h('td', { className: 'num' }, String(b))]); };
      var streak = s.streak > 0 ? s.streak + ' win' + (s.streak > 1 ? 's' : '') : s.streak < 0 ? -s.streak + ' loss' + (s.streak < -1 ? 'es' : '') : 'none';
      box(win, 'FreeCell Statistics', [
        h('table', { className: 'fc-stats' }, [
          row('Games won:', s.won), row('Games lost:', s.lost),
          row('Percentage won:', (total ? Math.round(100 * s.won / total) : 0) + '%'),
          row('Current streak:', streak), row('Longest winning streak:', s.bestWin), row('Longest losing streak:', s.bestLose)
        ])
      ], [
        { label: 'OK', def: true },
        { label: '&Clear', action: function (close) { U.store.set('w98.freecell.stats', null); close(); } }
      ], 290);
    }

    // ---- games ----
    function newGame(num) {
      if (!over && moves > 0 && !counted) record(false);   // walking away from a game in progress is a loss
      gameNum = num; counted = false;
      var deal = msDeal(num);
      free = [null, null, null, null]; home = [[], [], [], []]; col = [[], [], [], [], [], [], [], []];
      deal.forEach(function (v, k) { col[k % 8].push(cards[v]); });
      undo = []; moves = 0; over = false; sel = null; drag = null; lastClick = null;
      drawKing(kingDir, false);
      render();
    }
    function randomGame() { return 1 + Math.floor(Math.random() * 32000); }
    function restartGame() { var n = gameNum; if (!over && moves > 0 && !counted) { record(false); counted = true; } newGame(n); }

    function move(run, from, to) {
      undo.push(snapshot());
      if (from.p === 'free') free[from.i] = null; else col[from.i].splice(col[from.i].length - run.length, run.length);
      if (to.p === 'free') free[to.i] = run[0]; else if (to.p === 'home') home[to.i].push(run[0]); else col[to.i].push.apply(col[to.i], run);
      moves++; sel = null;
      render();
      if (home.every(function (p) { return p.length === 13; })) winGame();
    }
    function winGame() {
      over = true; counted = true; record(true);
      drawKing(kingDir, true);
      WM.msgbox({ title: 'FreeCell', owner: win, icon: 'info', text: 'Congratulations!  You won game #' + gameNum + '.\n\nDo you want to play again?', buttons: ['Yes', 'No'] }).then(function (b) { if (b === 'Yes') newGame(randomGame()); });
    }

    // double-click: up to a home cell, else into a free cell
    function quickMove(c) {
      var run = runFrom(c), l = locate(c);
      if (!run || run.length !== 1) return;
      if (l.p === 'col' && l.k !== col[l.i].length - 1) return;
      var k;
      for (k = 0; k < 4; k++) if (accepts(run, { p: 'home', i: k })) { move(run, l, { p: 'home', i: k }); return; }
      if (l.p === 'free') return;
      for (k = 0; k < 4; k++) if (!free[k]) { move(run, l, { p: 'free', i: k }); return; }
    }

    // ---- pointer handling ----
    function targets() {
      var list = [], k;
      for (k = 0; k < 4; k++) list.push({ p: 'free', i: k, x: FREEX(k), y: TOP });
      for (k = 0; k < 4; k++) list.push({ p: 'home', i: k, x: HOMEX(k), y: TOP });
      for (k = 0; k < 8; k++) list.push({ p: 'col', i: k, x: COLX(k), y: TABY + Math.max(0, col[k].length - 1) * step(k) });
      return list;
    }
    function targetOf(el) {
      var c = el._c, l, m;
      if (c) { l = locate(c); return l && { p: l.p, i: l.i }; }
      if (el._slot) { m = /^([a-z]+)(\d)$/.exec(el._slot); return { p: m[1], i: +m[2] }; }
      return null;
    }
    board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    board.addEventListener('pointerdown', function (e) {
      if (over || e.button > 0) return;
      win.focus();
      var t = e.target, c = t._c, run = c ? runFrom(c) : null;
      drag = { c: c, run: run, el: t, from: c ? locate(c) : null, sx: e.clientX, sy: e.clientY, moved: false };
      if (run) {
        e.preventDefault();
        drag.pos = run.map(function (r) { return [parseFloat(r.el.style.left), parseFloat(r.el.style.top)]; });
        try { t.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      }
    });
    board.addEventListener('pointermove', function (e) {
      if (!drag || !drag.run) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true;
      drag.run.forEach(function (r, k) {
        r.el.style.left = (drag.pos[k][0] + dx) + 'px'; r.el.style.top = (drag.pos[k][1] + dy) + 'px'; r.el.style.zIndex = 1000 + k;
      });
    });
    board.addEventListener('pointerup', function () {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved) {
        var l = parseFloat(d.run[0].el.style.left), t = parseFloat(d.run[0].el.style.top);
        var g = pickTarget(l, t, targets(), function (g) { return accepts(d.run, g); });
        if (g) move(d.run, d.from, g); else render();
        lastClick = null;
        return;
      }
      // a click: double-click quick-moves; otherwise select, or move the selection here
      var now = Date.now(), tg = targetOf(d.el);
      if (d.c && lastClick && lastClick.c === d.c && now - lastClick.t < 450) { lastClick = null; sel = null; quickMove(d.c); render(); return; }
      lastClick = d.c ? { c: d.c, t: now } : null;
      if (sel && tg && !(d.c && sel.run.indexOf(d.c) !== -1)) {
        if (accepts(sel.run, tg)) { move(sel.run, sel.from, tg); return; }
      }
      sel = d.run ? { run: d.run, from: d.from } : null;
      render();
    });
    board.addEventListener('pointercancel', function () { if (drag) { drag = null; render(); } });

    // ---- dialogs ----
    function selectGameDialog() {
      var input = h('input', { type: 'text', className: 'field', value: String(gameNum), maxlength: 5, spellcheck: 'false', style: { width: '80px' } });
      box(win, 'Select Game', [h('label', null, ['Game number (1 - 32000):  ', input])], [
        { label: 'OK', def: true, action: function (close) {
          var n = parseInt(input.value, 10);
          if (!(n >= 1 && n <= 32000)) { WM.msgbox({ title: 'FreeCell', owner: win, icon: 'warning', text: 'Please enter a game number between 1 and 32000.' }); return; }
          close(); newGame(n);
        } },
        { label: 'Cancel' },
        { label: '&Random', action: function (close) { input.value = String(randomGame()); input.select(); } }
      ], 320);
      setTimeout(function () { input.focus(); input.select(); }, 0);
    }

    win.on('close', function () { document.removeEventListener('pointermove', watch); if (!over && moves > 0 && !counted) record(false); });

    Menu.bar(win, [
      { label: '&Game', items: function () {
        return [
          { label: '&New Game', shortcut: 'F2', action: function () { newGame(randomGame()); } },
          { label: 'S&elect Game...', action: selectGameDialog },
          { label: '&Restart Game', action: restartGame },
          '-',
          { label: '&Statistics...', shortcut: 'F4', action: statsDialog },
          { label: '&Undo', shortcut: 'Ctrl+Z', disabled: over || !undo.length, action: doUndo },
          { label: 'Deck...', shortcut: 'F3', action: function () { chooseDeck(win, render); } },
          '-',
          { label: 'E&xit', action: function () { win.close(); } }
        ];
      } },
      { label: '&Help', items: [{ label: '&About FreeCell...', action: function () { Shell.launch('about', { name: 'FreeCell', icon: 'freecell' }); } }] }
    ]);
    win.onKey = function (e) {
      if (e.key === 'F2') { newGame(randomGame()); return true; }
      if (e.key === 'F3') { chooseDeck(win, render); return true; }
      if (e.key === 'F4') { statsDialog(); return true; }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { doUndo(); return true; }
      return false;
    };

    // handles for tests and tinkering
    win.game = {
      layout: function () { return col.map(function (p) { return p.map(function (c) { return cardName(c.id); }); }); },
      state: function () { return { free: free, home: home, col: col, moves: moves, over: over, num: gameNum }; },
      newGame: newGame
    };
    newGame(randomGame());
    win.center();
    return win;
  }

  Shell.register('solitaire', { name: 'Solitaire', icon: 'solitaire', single: true, launch: launchSolitaire });
  Shell.register('freecell', { name: 'FreeCell', icon: 'freecell', single: true, launch: launchFreeCell });
})();
