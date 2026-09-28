/*
 * Desktop Themes, in the spirit of Microsoft Plus! 98.
 *
 *   Themes.apply(id [, { wall, colors, sounds }])   choose and persist a theme
 *   Themes.current()                                 -> { id, wall, colors, sounds }
 *   Themes.list                                      the theme definitions
 *
 * A theme sets: the desktop colour, a wallpaper drawn on a canvas (no image files), the active
 * title-bar gradient (the --title-a / --title-b custom properties in css/win98.css) and an
 * optional chime for the "Default sound". The choice is stored under w98.theme, a key of its
 * own, and layered under Display Properties: whatever colour, pattern or wallpaper the user
 * picked there wins over the theme's.
 */
(function () {
  var h = U.h;

  // ---------------------------------------------------------------- drawing helpers
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function glow(g, x, y, r, color, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(color, a));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---------------------------------------------------------------- wallpapers
  var PAINT = {
    // A starfield with a ringed planet and drifting nebulae.
    space: function (g, W, H) {
      var R = rng(11), m = Math.min(W, H);
      var bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#02020c'); bg.addColorStop(1, '#0a0620');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      glow(g, W * 0.25, H * 0.35, m * 0.7, '#3a1a8a', 0.35);
      glow(g, W * 0.7, H * 0.8, m * 0.6, '#0a4a8a', 0.3);
      glow(g, W * 0.9, H * 0.15, m * 0.4, '#8a1a5a', 0.25);
      var n = Math.round(W * H / 1500);
      for (var i = 0; i < n; i++) {
        var x = R() * W, y = R() * H, s = R(), a = 0.3 + R() * 0.7;
        g.fillStyle = s > 0.9 ? 'rgba(180,200,255,' + a + ')' : s > 0.8 ? 'rgba(255,220,180,' + a + ')' : 'rgba(255,255,255,' + a + ')';
        var sz = s > 0.97 ? 2.2 : s > 0.7 ? 1.4 : 1;
        g.fillRect(x, y, sz, sz);
        if (s > 0.985) { g.fillRect(x - 3, y + 0.4, 7, 0.8); g.fillRect(x + 0.4, y - 3, 0.8, 7); }
      }
      var px = W * 0.78, py = H * 0.32, pr = m * 0.15;
      glow(g, px, py, pr * 1.8, '#ff9a4a', 0.18);
      g.save();
      g.translate(px, py); g.rotate(-0.35);
      g.strokeStyle = 'rgba(230,200,150,0.7)'; g.lineWidth = pr * 0.16;
      g.beginPath(); g.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, Math.PI * 2); g.stroke();
      var pg = g.createRadialGradient(-pr * 0.4, -pr * 0.4, pr * 0.1, 0, 0, pr);
      pg.addColorStop(0, '#ffd9a0'); pg.addColorStop(0.55, '#c8703a'); pg.addColorStop(1, '#3a1608');
      g.fillStyle = pg; g.beginPath(); g.arc(0, 0, pr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(230,200,150,0.9)';
      g.beginPath(); g.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI); g.stroke();
      g.restore();
      var mg = g.createRadialGradient(W * 0.2 - 6, H * 0.72 - 6, 1, W * 0.2, H * 0.72, m * 0.05);
      mg.addColorStop(0, '#fff'); mg.addColorStop(1, '#556');
      g.fillStyle = mg; g.beginPath(); g.arc(W * 0.2, H * 0.72, m * 0.05, 0, Math.PI * 2); g.fill();
    },

    // Reptile scales under a slit-pupil eye.
    creatures: function (g, W, H) {
      var R = rng(23), s = Math.max(14, Math.round(Math.min(W, H) / 16));
      g.fillStyle = '#1a2208'; g.fillRect(0, 0, W, H);
      for (var row = -1; row * s * 0.6 < H + s; row++) {
        for (var col = -1; col * s < W + s; col++) {
          var x = col * s + (row & 1 ? s / 2 : 0), y = row * s * 0.6;
          var t = 0.5 + 0.5 * Math.sin(col * 0.35 + row * 0.5) * Math.cos(row * 0.22) + (R() - 0.5) * 0.15;
          var gr = g.createRadialGradient(x, y - s * 0.2, s * 0.1, x, y, s * 0.62);
          gr.addColorStop(0, 'hsl(' + (60 + t * 30) + ',60%,' + (30 + t * 25) + '%)');
          gr.addColorStop(1, 'hsl(' + (75 + t * 20) + ',55%,' + (12 + t * 8) + '%)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(x, y, s * 0.58, 0, Math.PI); g.lineTo(x - s * 0.58, y - s * 0.6); g.lineTo(x + s * 0.58, y - s * 0.6); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2;
          g.beginPath(); g.arc(x, y, s * 0.58, 0, Math.PI); g.stroke();
        }
      }
      var ex = W * 0.72, ey = H * 0.36, er = Math.min(W, H) * 0.14;
      glow(g, ex, ey, er * 2.2, '#000000', 0.5);
      var eg = g.createRadialGradient(ex, ey - er * 0.2, er * 0.1, ex, ey, er);
      eg.addColorStop(0, '#fff27a'); eg.addColorStop(0.6, '#e0a010'); eg.addColorStop(1, '#5a3a00');
      g.fillStyle = eg; g.beginPath(); g.ellipse(ex, ey, er * 1.3, er, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#0a0a00'; g.lineWidth = er * 0.1; g.stroke();
      g.fillStyle = '#000';
      g.beginPath(); g.ellipse(ex, ey, er * 0.16, er * 0.85, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(ex - er * 0.5, ey - er * 0.4, er * 0.1, 0, Math.PI * 2); g.fill();
    },

    // Circuit traces on a green board with chips and solder pads.
    inside: function (g, W, H) {
      var R = rng(37), step = 18;
      var bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#04261a'); bg.addColorStop(1, '#083a22');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.lineCap = 'round'; g.lineJoin = 'round';
      var traces = Math.round(W * H / 5000), i;
      for (i = 0; i < traces; i++) {
        var x = Math.round(R() * W / step) * step, y = Math.round(R() * H / step) * step;
        var dx = R() < 0.5 ? 1 : -1, dy = 0;
        g.beginPath(); g.moveTo(x, y);
        var segs = 3 + Math.floor(R() * 5);
        for (var k = 0; k < segs; k++) {
          var len = (2 + Math.floor(R() * 6)) * step;
          x += dx * len; y += dy * len;
          g.lineTo(x, y);
          // bend by 45 or 90 degrees
          if (dy === 0) { dy = R() < 0.5 ? 1 : -1; if (R() < 0.5) dx = dx; else dx = 0; }
          else { dy = 0; dx = R() < 0.5 ? 1 : -1; }
        }
        var hue = R() < 0.85 ? '#2fd67a' : '#d6c02f';
        g.strokeStyle = rgba(hue, 0.55); g.lineWidth = 2.5; g.stroke();
        g.fillStyle = rgba(hue, 0.9);
        g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#04261a'; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
      }
      var chips = Math.max(3, Math.round(W * H / 90000));
      for (i = 0; i < chips; i++) {
        var cw = 60 + R() * 80, ch = 50 + R() * 60, cx = R() * (W - cw), cy = R() * (H - ch);
        g.fillStyle = '#0a0a0a'; g.fillRect(cx, cy, cw, ch);
        g.strokeStyle = '#555'; g.lineWidth = 1; g.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
        g.fillStyle = '#b8b8a0';
        for (var p = 6; p < cw - 4; p += 8) { g.fillRect(cx + p, cy - 5, 3, 5); g.fillRect(cx + p, cy + ch, 3, 5); }
        for (var q = 6; q < ch - 4; q += 8) { g.fillRect(cx - 5, cy + q, 5, 3); g.fillRect(cx + cw, cy + q, 5, 3); }
        g.fillStyle = '#777'; g.beginPath(); g.arc(cx + 8, cy + 8, 2.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#9a9a8a'; g.font = 'bold 10px monospace'; g.fillText('K6-' + (2 + i), cx + 16, cy + ch / 2 + 3);
      }
    },

    // Layered leaves and vines with shafts of sunlight.
    jungle: function (g, W, H) {
      var R = rng(41), m = Math.min(W, H);
      var bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#2f6b1f'); bg.addColorStop(1, '#06200a');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      function leaf(x, y, len, ang, light) {
        g.save(); g.translate(x, y); g.rotate(ang);
        var lg = g.createLinearGradient(0, 0, len, 0);
        lg.addColorStop(0, 'hsl(' + (110 + R() * 20) + ',60%,' + (14 + light * 10) + '%)');
        lg.addColorStop(1, 'hsl(' + (90 + R() * 25) + ',65%,' + (26 + light * 22) + '%)');
        g.fillStyle = lg;
        g.beginPath(); g.moveTo(0, 0);
        g.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
        g.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
        g.fill();
        g.strokeStyle = 'rgba(0,30,0,0.5)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
        g.restore();
      }
      var n = Math.round(W * H / 2600), i;
      for (i = 0; i < n; i++) {
        var depth = R();
        leaf(R() * W, R() * H, m * (0.06 + depth * 0.16), R() * Math.PI * 2, depth);
      }
      g.strokeStyle = 'rgba(30,60,10,0.7)'; g.lineWidth = 4;
      for (i = 0; i < 6; i++) {
        var vx = R() * W;
        g.beginPath(); g.moveTo(vx, 0);
        for (var y = 0; y < H; y += 12) g.lineTo(vx + Math.sin(y / 40 + i) * 18, y);
        g.stroke();
      }
      // sun shafts
      for (i = 0; i < 5; i++) {
        var sx = W * (0.5 + R() * 0.6);
        var sg = g.createLinearGradient(sx, 0, sx - W * 0.25, H);
        sg.addColorStop(0, 'rgba(255,255,190,0.22)'); sg.addColorStop(1, 'rgba(255,255,190,0)');
        g.fillStyle = sg;
        g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + 40 + R() * 40, 0); g.lineTo(sx - W * 0.25 + 90, H); g.lineTo(sx - W * 0.25, H); g.fill();
      }
      for (i = 0; i < 7; i++) {
        var fx = R() * W, fy = R() * H;
        g.fillStyle = '#e02a1a';
        for (var pt = 0; pt < 6; pt++) { g.beginPath(); g.ellipse(fx + Math.cos(pt) * 6, fy + Math.sin(pt) * 6, 5, 3, pt, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(fx, fy, 3, 0, Math.PI * 2); g.fill();
      }
    },

    // Moonlit fog, a crooked house and question marks.
    mystery: function (g, W, H) {
      var R = rng(53), m = Math.min(W, H);
      var bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#06020e'); bg.addColorStop(1, '#2a1244');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      var i;
      for (i = 0; i < W * H / 4000; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + R() * 0.5) + ')'; g.fillRect(R() * W, R() * H * 0.7, 1, 1); }
      g.font = 'bold ' + Math.round(m * 0.08) + 'px Georgia, serif';
      for (i = 0; i < 14; i++) {
        g.fillStyle = 'rgba(150,90,220,' + (0.06 + R() * 0.12) + ')';
        g.save(); g.translate(R() * W, R() * H * 0.8); g.rotate((R() - 0.5) * 0.8); g.fillText('?', 0, 0); g.restore();
      }
      var mx = W * 0.76, my = H * 0.24, mr = m * 0.11;
      glow(g, mx, my, mr * 3.2, '#c8b4ff', 0.28);
      var mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#fffbe8'); mg.addColorStop(1, '#c8c0a0');
      g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(120,110,90,0.35)';
      [[-0.3, -0.2, 0.2], [0.3, 0.15, 0.25], [-0.1, 0.4, 0.13]].forEach(function (c) { g.beginPath(); g.arc(mx + c[0] * mr, my + c[1] * mr, c[2] * mr, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = '#05010a';
      g.beginPath(); g.moveTo(0, H);
      for (var x = 0; x <= W; x += 10) g.lineTo(x, H * 0.78 + Math.sin(x / 90) * m * 0.03 + Math.sin(x / 33) * m * 0.01);
      g.lineTo(W, H); g.fill();
      var hx = W * 0.18, hy = H * 0.78 - m * 0.02, hw = m * 0.2, hh = m * 0.14;
      g.fillRect(hx, hy - hh, hw, hh);
      g.beginPath(); g.moveTo(hx - 10, hy - hh); g.lineTo(hx + hw * 0.5, hy - hh - m * 0.11); g.lineTo(hx + hw + 10, hy - hh); g.fill();
      g.fillRect(hx + hw * 0.78, hy - hh - m * 0.09, hw * 0.08, m * 0.07);
      g.fillStyle = '#ffd24a'; g.fillRect(hx + hw * 0.2, hy - hh * 0.7, hw * 0.16, hh * 0.28);
      g.fillStyle = '#ff9a2a'; g.fillRect(hx + hw * 0.62, hy - hh * 0.7, hw * 0.16, hh * 0.28);
      g.strokeStyle = '#05010a'; g.lineWidth = 3;
      var tx = W * 0.5;
      (function branch(x, y, len, ang, d) {
        if (d > 5) return;
        var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        g.lineWidth = Math.max(1, 6 - d); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        branch(x2, y2, len * 0.72, ang - 0.5 + (R() - 0.5) * 0.3, d + 1);
        branch(x2, y2, len * 0.72, ang + 0.5 + (R() - 0.5) * 0.3, d + 1);
      })(tx, H * 0.8, m * 0.09, -Math.PI / 2, 0);
      for (i = 0; i < 5; i++) glow(g, R() * W, H * (0.72 + R() * 0.25), m * (0.25 + R() * 0.2), '#a890d0', 0.16);
    },

    // Flower power: daisies, target circles and a peace sign.
    sixties: function (g, W, H) {
      var R = rng(67), m = Math.min(W, H), i;
      g.fillStyle = '#f5a31c'; g.fillRect(0, 0, W, H);
      var cx = W * 0.3, cy = H * 0.65;
      ['#e8377a', '#f5a31c', '#ffe23a', '#1aa39a', '#e8377a', '#ffe23a', '#f5a31c'].forEach(function (c, k) {
        g.fillStyle = c; g.beginPath(); g.arc(cx, cy, m * (0.62 - k * 0.08), 0, Math.PI * 2); g.fill();
      });
      function daisy(x, y, r, petal, core) {
        for (var p = 0; p < 12; p++) {
          g.save(); g.translate(x, y); g.rotate(p * Math.PI / 6);
          g.fillStyle = petal; g.beginPath(); g.ellipse(r * 0.65, 0, r * 0.4, r * 0.17, 0, 0, Math.PI * 2); g.fill();
          g.restore();
        }
        g.fillStyle = core; g.beginPath(); g.arc(x, y, r * 0.26, 0, Math.PI * 2); g.fill();
      }
      for (i = 0; i < 12; i++) daisy(R() * W, R() * H, m * (0.06 + R() * 0.08), i % 2 ? '#ffffff' : '#ff8fc0', i % 3 ? '#ff7a00' : '#1aa39a');
      var px = W * 0.82, py = H * 0.25, pr = m * 0.14;
      g.strokeStyle = '#3a1a5a'; g.lineWidth = pr * 0.16; g.lineCap = 'round';
      g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(px, py - pr); g.lineTo(px, py + pr); g.moveTo(px, py); g.lineTo(px - pr * 0.7, py + pr * 0.7); g.moveTo(px, py); g.lineTo(px + pr * 0.7, py + pr * 0.7); g.stroke();
    }
  };

  // ---------------------------------------------------------------- themes
  // chime: notes for the "Default sound" ([Hz...], oscillator type); null keeps the standard ding.
  var LIST = [
    { id: 'default', name: 'Windows Default', desc: 'The classic teal desktop with the navy title bars.', color: '#008080', title: ['#000080', '#1084d0'], wall: null, chime: null },
    { id: 'space', name: 'Space', desc: 'Stars, nebulae and a ringed planet. Sounds like the void, but politely.', color: '#02020c', title: ['#141450', '#7a48c8'], wall: 'space', chime: { f: [523, 784, 1568, 2093], type: 'sine', gap: 0.11 } },
    { id: 'creatures', name: 'Dangerous Creatures', desc: 'Scales and one very unimpressed eye.', color: '#1a2208', title: ['#4a3a00', '#c8a01c'], wall: 'creatures', chime: { f: [196, 147, 196], type: 'sawtooth', gap: 0.09 } },
    { id: 'inside', name: 'Inside Your Computer', desc: 'Circuit traces, chips and solder pads. Warranty void if opened.', color: '#04261a', title: ['#04361a', '#12b060'], wall: 'inside', chime: { f: [880, 1175, 880, 1760], type: 'square', gap: 0.06 } },
    { id: 'jungle', name: 'Jungle', desc: 'Leaves, vines and dappled sunlight.', color: '#0a3a12', title: ['#1a4a1a', '#7ac142'], wall: 'jungle', chime: { f: [392, 494, 587, 784], type: 'triangle', gap: 0.14 } },
    { id: 'mystery', name: 'Mystery', desc: 'A crooked house, a full moon and fog rolling in.', color: '#0c0418', title: ['#2a0a3a', '#8a48b8'], wall: 'mystery', chime: { f: [247, 233, 220], type: 'triangle', gap: 0.2 } },
    { id: 'sixties', name: 'The 60\'s USA', desc: 'Flower power, target circles and peace.', color: '#f5a31c', title: ['#c8400a', '#f2b81c'], wall: 'sixties', chime: { f: [659, 784, 988, 1319], type: 'sine', gap: 0.1 } }
  ];
  function find(id) { return LIST.filter(function (t) { return t.id === id; })[0] || LIST[0]; }

  // Wallpapers are drawn once per size, then cached as JPEG data URLs.
  var wallCache = {};
  function wallpaper(t, W, H) {
    if (!t.wall) return '';
    var key = t.id + '@' + W + 'x' + H;
    if (!wallCache[key]) {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      PAINT[t.wall](c.getContext('2d'), W, H);
      wallCache[key] = c.toDataURL('image/jpeg', 0.88);
    }
    return wallCache[key];
  }

  // ---------------------------------------------------------------- applying
  var settings = Object.assign({ id: 'default', wall: true, colors: true, sounds: true }, U.store.get('w98.theme', {}));
  var wallSet = false;   // did we put a theme wallpaper on the desktop (so we know to clear it)?

  function applyVars() {
    var t = find(settings.id), root = document.documentElement.style;
    var cols = settings.colors ? t.title : LIST[0].title;
    root.setProperty('--title-a', cols[0]);
    root.setProperty('--title-b', cols[1]);
  }

  var realDing = window.Sound ? Sound.ding : null;
  var actx = null;
  function chime(c) {
    if (!window.Sound || Sound.muted) return Promise.resolve();
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime + 0.02;
      c.f.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), at = t0 + i * c.gap;
        o.type = c.type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.12, at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
        o.connect(g); g.connect(actx.destination);
        o.start(at); o.stop(at + 0.36);
      });
    } catch (e) { /* no audio */ }
    return Promise.resolve();
  }
  function applySound() {
    if (!window.Sound) return;
    var t = find(settings.id);
    Sound.ding = (settings.sounds && t.chime) ? function () { return chime(t.chime); } : realDing;
  }

  // Layer the theme under Display Properties. Anything the user chose there wins.
  var baseApply = Shell.applyDesktopStyle;
  Shell.applyDesktopStyle = function () {
    baseApply.apply(Shell, arguments);
    var d = document.getElementById('desktop');
    if (!d) return;
    var t = find(settings.id), user = U.store.get('w98.display', {});
    var userColour = user.color && String(user.color).toLowerCase() !== '#008080';
    var userWall = (user.pattern && user.pattern !== '(None)') || (user.wallpaper && user.wallpaper !== '(None)');
    if (settings.colors && !userColour && t.id !== 'default') d.style.backgroundColor = t.color;
    if (settings.wall && t.wall && !userWall) {
      var url = wallpaper(t, Math.max(320, window.innerWidth), Math.max(240, window.innerHeight - 28));
      d.style.backgroundImage = 'url(' + url + ')';
      d.style.backgroundSize = 'cover';
      d.style.backgroundPosition = 'center';
      d.style.backgroundRepeat = 'no-repeat';
      wallSet = true;
    } else if (wallSet) {
      d.style.backgroundSize = ''; d.style.backgroundPosition = ''; d.style.backgroundRepeat = '';
      wallSet = false;
    }
  };

  var Themes = {
    list: LIST,
    current: function () { return Object.assign({}, settings); },
    apply: function (id, opts) {
      var changed = settings.id !== id;
      settings = Object.assign({}, settings, opts || {}, { id: id });
      U.store.set('w98.theme', settings);
      applyVars(); applySound();
      Shell.applyDesktopStyle();
      if (changed && window.Achievements) Achievements.unlock('theme');
    },
    // A wallpaper canvas for the preview pane.
    paint: function (t, canvas) {
      var g = canvas.getContext('2d');
      g.fillStyle = t.color; g.fillRect(0, 0, canvas.width, canvas.height);
      if (t.wall) PAINT[t.wall](g, canvas.width, canvas.height);
    }
  };
  window.Themes = Themes;
  applyVars();
  applySound();

  // ---------------------------------------------------------------- the Control Panel applet
  Shell.register('themes', { name: 'Desktop Themes', icon: 'display', single: true, launch: function () {
    var pending = Object.assign({}, settings);
    var list = h('div', { className: 'sunken-panel theme-list' });
    var preview = h('canvas', { className: 'theme-preview', width: 220, height: 150 });
    var desc = h('p', { className: 'theme-desc' });
    function check(label, key) {
      var box = h('input', { type: 'checkbox', checked: pending[key] });
      box.addEventListener('change', function () { pending[key] = box.checked; paint(); dirty(); });
      return h('label', { className: 'check' }, [box, label]);
    }
    var ok = h('button', { className: 'btn default' }, 'OK');
    var cancel = h('button', { className: 'btn' }, 'Cancel');
    var apply = h('button', { className: 'btn', disabled: true }, U.label('&Apply'));
    var test = h('button', { className: 'btn' }, U.label('&Test sound'));
    function dirty() { apply.disabled = false; }

    function paint() {
      var t = find(pending.id), g = preview.getContext('2d');
      g.clearRect(0, 0, 220, 150);
      Themes.paint(pending.wall ? t : { color: t.color, wall: null }, preview);
      // A little window in the theme's title-bar colours, and a couple of icons.
      var cols = pending.colors ? t.title : LIST[0].title;
      g.fillStyle = '#c0c0c0'; g.fillRect(70, 40, 130, 80);
      g.strokeStyle = '#000'; g.strokeRect(70.5, 40.5, 129, 79);
      var gr = g.createLinearGradient(72, 0, 198, 0);
      gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
      g.fillStyle = gr; g.fillRect(72, 42, 126, 12);
      g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.fillText('Active Window', 76, 51);
      g.fillStyle = '#fff'; g.fillRect(74, 58, 122, 58);
      g.fillStyle = '#808080'; g.fillRect(80, 66, 90, 3); g.fillRect(80, 74, 70, 3); g.fillRect(80, 82, 100, 3);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(10, 12, 22, 18); g.fillRect(10, 62, 22, 18);
      g.fillStyle = '#000'; g.font = '8px sans-serif'; g.fillText('My Computer', 5, 40); g.fillText('Recycle Bin', 7, 90);
      desc.textContent = t.desc;
    }
    function select(id) {
      pending.id = id;
      list.querySelectorAll('.theme-row').forEach(function (r) { r.classList.toggle('selected', r.dataset.id === id); });
      paint(); dirty();
    }
    LIST.forEach(function (t) {
      var r = h('div', { className: 'theme-row', dataset: { id: t.id } }, [U.img('display', 16), h('span', null, t.name)]);
      r.addEventListener('pointerdown', function () { select(t.id); });
      list.appendChild(r);
    });

    var win = WM.dialog({ app: 'themes', title: 'Desktop Themes', width: 470, helpButton: true, taskbar: true, content: h('div', { className: 'themes-app' }, [
      h('p', null, 'Choose a theme to change the wallpaper, title bars and sounds all at once.'),
      h('div', { className: 'themes-main' }, [
        h('div', null, [h('div', null, U.label('&Theme:')), list]),
        h('div', null, [preview, desc])
      ]),
      h('fieldset', { className: 'group' }, [h('legend', null, 'Settings'), check('Wallpaper', 'wall'), check('Title bar colors', 'colors'), check('Sound events', 'sounds')]),
      h('div', { className: 'button-row right' }, [test, ok, cancel, apply])
    ]) });
    function commit() { Themes.apply(pending.id, { wall: pending.wall, colors: pending.colors, sounds: pending.sounds }); apply.disabled = true; }
    ok.addEventListener('click', function () { if (!apply.disabled) commit(); win.close(true); });
    apply.addEventListener('click', commit);
    cancel.addEventListener('click', function () { win.close(true); });
    test.addEventListener('click', function () { var t = find(pending.id); if (t.chime && pending.sounds) chime(t.chime); else U.sound('ding'); });
    win.onKey = function (e) { if (e.key === 'Escape') { win.close(true); return true; } return false; };
    select(pending.id);
    apply.disabled = true;
    win.center();
    return win;
  } });

  // The Control Panel's applet launcher only knows its own pages, so route 'themes' here.
  var control = Shell.program('control');
  if (control) {
    var baseLaunch = control.launch;
    control.launch = function (page) { return page === 'themes' ? Shell.launch('themes') : baseLaunch.apply(this, arguments); };
  }
})();
