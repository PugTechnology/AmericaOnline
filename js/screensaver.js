/*
 * screensaver.js — Windows 98 style screen savers, re-created from scratch.
 *
 *   3D Pipes  — raw WebGL (own matrix helpers + Blinn-Phong shaders), with a
 *               Canvas2D fallback when WebGL is unavailable.
 *   Starfield — classic "Flying Through Space" (Canvas2D).
 *   Mystify   — "Mystify Your Mind" bouncing polygons (Canvas2D).
 *
 * Public API (window.Screensaver):
 *   names                 list of implemented saver names
 *   start(name, opts)     full-screen overlay; ends on input. opts { onStop, renderer: '2d' }
 *   stop()                tear everything down (rAF, listeners, WebGL context)
 *   preview(el, name)     small live preview inside `el`; returns { stop() }
 *   running               boolean
 *
 * Pipes rendering strategy: like the original, the canvas is never cleared
 * between frames (preserveDrawingBuffer); each frame only draws the pieces
 * that were grown during that frame, so cost is independent of how full the
 * screen is. Each piece is one draw call of a small static mesh (cylinder,
 * sphere, elbow, disc) positioned by uniforms. Nothing here ever throws.
 */
(function (global) {
  'use strict';

  var NAMES = ['3D Pipes', 'Starfield', 'Mystify', '(None)'];

  /* ------------------------------------------------------------------ */
  /* Small math helpers                                                  */
  /* ------------------------------------------------------------------ */

  var DIRS = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
  ];
  function opposite(d) { return d ^ 1; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function add(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
  function norm(a) {
    var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  // Right-handed basis whose Z axis is `z` (axis-aligned or not).
  function basisZ(z) {
    var up = Math.abs(z[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    var x = norm(cross(up, z));
    var y = cross(z, x);
    return [x, y, z];
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }
  // Model-view (column-major) from basis columns, per-axis scale, translation.
  // The view is a pure translation along -Z, folded in by the caller.
  function modelView(out, b, sx, sy, sz, t) {
    out[0] = b[0][0] * sx; out[1] = b[0][1] * sx; out[2] = b[0][2] * sx; out[3] = 0;
    out[4] = b[1][0] * sy; out[5] = b[1][1] * sy; out[6] = b[1][2] * sy; out[7] = 0;
    out[8] = b[2][0] * sz; out[9] = b[2][1] * sz; out[10] = b[2][2] * sz; out[11] = 0;
    out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
    return out;
  }
  function rot3(out, b) {
    out[0] = b[0][0]; out[1] = b[0][1]; out[2] = b[0][2];
    out[3] = b[1][0]; out[4] = b[1][1]; out[5] = b[1][2];
    out[6] = b[2][0]; out[7] = b[2][1]; out[8] = b[2][2];
    return out;
  }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ------------------------------------------------------------------ */
  /* Pipes simulation (renderer independent)                             */
  /* ------------------------------------------------------------------ */

  var PIPE_R = 0.19;     // pipe radius (cell = 1 unit)
  var BALL_R = 0.30;     // ball joint radius

  // Bright, glossy material colours in the spirit of the original.
  var PALETTE = [
    [0.85, 0.08, 0.08], [0.10, 0.70, 0.12], [0.12, 0.25, 0.95], [0.95, 0.85, 0.10],
    [0.10, 0.80, 0.85], [0.85, 0.15, 0.80], [0.95, 0.50, 0.08], [0.80, 0.80, 0.80],
    [0.55, 0.20, 0.90], [0.60, 0.85, 0.20], [0.95, 0.45, 0.55], [0.72, 0.55, 0.25]
  ];

  function PipesSim(nx, ny, nz, opts) {
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.total = nx * ny * nz;
    this.occ = new Uint8Array(this.total);
    this.used = 0;
    this.pipes = [];
    this.out = [];
    this.joint = opts.joints || 'mixed';     // 'ball' | 'elbow' | 'mixed'
    this.maxPipes = 2 + rnd(3);              // 2..4 simultaneous pipes
    this.turn = 0.28;                        // chance of turning when straight is free
    this.failed = false;
    this.lastColor = -1;
  }
  PipesSim.prototype.idx = function (c) { return (c[2] * this.ny + c[1]) * this.nx + c[0]; };
  PipesSim.prototype.free = function (c) {
    return c[0] >= 0 && c[1] >= 0 && c[2] >= 0 && c[0] < this.nx && c[1] < this.ny &&
      c[2] < this.nz && !this.occ[this.idx(c)];
  };
  PipesSim.prototype.mark = function (c) { this.occ[this.idx(c)] = 1; this.used++; };
  PipesSim.prototype.pos = function (c) {
    return [c[0] - (this.nx - 1) / 2, c[1] - (this.ny - 1) / 2, c[2] - (this.nz - 1) / 2];
  };
  PipesSim.prototype.freeDirs = function (c) {
    var r = [];
    for (var d = 0; d < 6; d++) {
      if (this.free([c[0] + DIRS[d][0], c[1] + DIRS[d][1], c[2] + DIRS[d][2]])) r.push(d);
    }
    return r;
  };
  PipesSim.prototype.spawn = function () {
    for (var tries = 0; tries < 60; tries++) {
      var c = [rnd(this.nx), rnd(this.ny), rnd(this.nz)];
      if (!this.free(c) || !this.freeDirs(c).length) continue;
      this.mark(c);
      var ci;
      do { ci = rnd(PALETTE.length); } while (ci === this.lastColor);
      this.lastColor = ci;
      this.pipes.push({ c: c, dIn: -1, col: PALETTE[ci] });
      return true;
    }
    this.failed = true;
    return false;
  };
  PipesSim.prototype.stepPipe = function (p) {
    var P = this.pos(p.c), out = this.out, col = p.col;
    var cand = this.freeDirs(p.c);
    if (!cand.length) {
      // Stuck: finish the pipe with a flat cap at the cell centre.
      if (p.dIn >= 0) {
        out.push({ t: 0, a: add(P, DIRS[p.dIn], -0.5), dir: p.dIn, len: 0.5, col: col });
        out.push({ t: 3, p: P, dir: p.dIn, col: col });
      } else {
        out.push({ t: 1, p: P, r: BALL_R, col: col });
      }
      return false;
    }
    var dOut;
    if (p.dIn >= 0 && cand.indexOf(p.dIn) >= 0 && Math.random() > this.turn) {
      dOut = p.dIn;
    } else {
      var turns = cand.filter(function (d) { return d !== p.dIn; });
      dOut = (turns.length ? turns : cand)[rnd((turns.length ? turns : cand).length)];
    }
    if (p.dIn < 0) {
      out.push({ t: 3, p: P, dir: opposite(dOut), col: col });
      out.push({ t: 0, a: P, dir: dOut, len: 0.5, col: col });
    } else if (p.dIn === dOut) {
      out.push({ t: 0, a: add(P, DIRS[dOut], -0.5), dir: dOut, len: 1, col: col });
    } else {
      var ball = this.joint === 'ball' || (this.joint === 'mixed' && Math.random() < 0.5);
      if (ball) {
        out.push({ t: 0, a: add(P, DIRS[p.dIn], -0.5), dir: p.dIn, len: 0.5, col: col });
        out.push({ t: 0, a: P, dir: dOut, len: 0.5, col: col });
        out.push({ t: 1, p: P, r: BALL_R, col: col });
      } else {
        out.push({ t: 2, p: P, dIn: p.dIn, dOut: dOut, col: col });
      }
    }
    p.c = [p.c[0] + DIRS[dOut][0], p.c[1] + DIRS[dOut][1], p.c[2] + DIRS[dOut][2]];
    this.mark(p.c);
    p.dIn = dOut;
    return true;
  };
  PipesSim.prototype.step = function () {
    if (!this.pipes.length ||
        (this.pipes.length < this.maxPipes && Math.random() < 0.04)) this.spawn();
    for (var i = this.pipes.length - 1; i >= 0; i--) {
      if (!this.stepPipe(this.pipes[i])) {
        this.pipes.splice(i, 1);
        this.spawn();
      }
    }
  };
  PipesSim.prototype.full = function () {
    return this.failed || this.used > this.total * 0.55;
  };

  // Grid dimensions and camera for a viewport aspect ratio.
  function pipesLayout(aspect) {
    var base = 12, nx, ny;
    if (aspect >= 1) { ny = base; nx = Math.max(8, Math.min(26, Math.round(base * aspect))); }
    else { nx = base; ny = Math.max(8, Math.min(26, Math.round(base / aspect))); }
    var nz = 12;
    var fov = 45 * Math.PI / 180;
    // Fit the plane a quarter of the way toward the viewer to the screen.
    var fitH = Math.max(ny, nx / aspect);
    var dist = nz / 4 + (fitH / 2) / Math.tan(fov / 2);
    return { nx: nx, ny: ny, nz: nz, fov: fov, dist: dist };
  }

  // Shared growth / reset timing driver for both pipes renderers.
  function PipesDriver(r, opts) {
    this.r = r;
    this.rate = (opts && opts.speed) || 22;  // segments per second, per pipe
    this.maxTime = (opts && opts.maxTime) || 45;
    this.opts = opts || {};
    this.sim = null;
  }
  PipesDriver.prototype.reset = function (aspect) {
    this.layout = pipesLayout(aspect);
    var L = this.layout;
    this.sim = new PipesSim(L.nx, L.ny, L.nz, this.opts);
    this.acc = 0; this.time = 0; this.dissolve = null;
    this.r.clear();
  };
  PipesDriver.prototype.frame = function (dt) {
    if (!this.sim) return;
    if (this.dissolve) {
      var D = this.dissolve;
      D.t += dt;
      var upto = Math.min(D.blocks.length, Math.ceil(D.blocks.length * D.t / 0.9));
      if (upto > D.done) { this.r.clearBlocks(D.blocks.slice(D.done, upto), D.cols, D.rows); D.done = upto; }
      if (D.done >= D.blocks.length) this.reset(this.aspect);
      return;
    }
    this.time += dt;
    this.acc += dt * this.rate;
    var n = 0;
    while (this.acc >= 1 && n < 6) { this.sim.step(); this.acc -= 1; n++; }
    if (this.acc > 1) this.acc = 0;
    if (this.sim.out.length) { this.r.draw(this.sim.out, this.layout); this.sim.out.length = 0; }
    if (this.sim.full() || this.time > this.maxTime) {
      // Original-style block dissolve to black, then start over.
      var cols = 16, rows = 12, blocks = [];
      for (var i = 0; i < cols * rows; i++) blocks.push(i);
      this.dissolve = { t: 0, done: 0, cols: cols, rows: rows, blocks: shuffle(blocks) };
    }
  };

  /* ------------------------------------------------------------------ */
  /* WebGL pipes renderer                                                */
  /* ------------------------------------------------------------------ */

  var VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNrm;',
    'uniform mat4 uProj;',
    'uniform mat4 uMV;',
    'uniform mat3 uRot;',
    'varying vec3 vN;',
    'varying vec3 vP;',
    'void main() {',
    '  vec4 p = uMV * vec4(aPos, 1.0);',
    '  vP = p.xyz;',
    '  vN = uRot * aNrm;',
    '  gl_Position = uProj * p;',
    '}'
  ].join('\n');

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec3 uColor;',
    'uniform vec3 uL0;',
    'uniform vec3 uL1;',
    'varying vec3 vN;',
    'varying vec3 vP;',
    'void main() {',
    '  vec3 n = normalize(vN);',
    '  vec3 v = normalize(-vP);',
    '  float d0 = max(dot(n, uL0), 0.0);',
    '  float d1 = max(dot(n, uL1), 0.0);',
    '  float s0 = pow(max(dot(n, normalize(uL0 + v)), 0.0), 70.0);',
    '  float s1 = pow(max(dot(n, normalize(uL1 + v)), 0.0), 40.0);',
    '  vec3 c = uColor * (0.13 + 0.80 * d0 + 0.30 * d1) + vec3(0.95 * s0 + 0.35 * s1);',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  var SIDES = 16;

  function meshCylinder() {           // radius 1, z from 0..1, open ended
    var p = [], n = [], idx = [];
    for (var i = 0; i <= SIDES; i++) {
      var a = i / SIDES * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      p.push(c, s, 0, c, s, 1); n.push(c, s, 0, c, s, 0);
    }
    for (i = 0; i < SIDES; i++) {
      var k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    return { p: p, n: n, i: idx };
  }
  function meshDisc() {               // radius 1 at z=0 facing +z
    var p = [0, 0, 0], n = [0, 0, 1], idx = [];
    for (var i = 0; i <= SIDES; i++) {
      var a = i / SIDES * Math.PI * 2;
      p.push(Math.cos(a), Math.sin(a), 0); n.push(0, 0, 1);
      if (i) idx.push(0, i, i + 1);
    }
    return { p: p, n: n, i: idx };
  }
  function meshSphere() {             // unit sphere
    var p = [], n = [], idx = [], LAT = 12, LON = SIDES;
    for (var y = 0; y <= LAT; y++) {
      var th = y / LAT * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (var x = 0; x <= LON; x++) {
        var ph = x / LON * Math.PI * 2;
        var v = [Math.cos(ph) * st, ct, Math.sin(ph) * st];
        p.push(v[0], v[1], v[2]); n.push(v[0], v[1], v[2]);
      }
    }
    for (y = 0; y < LAT; y++) for (x = 0; x < LON; x++) {
      var a = y * (LON + 1) + x, b = a + LON + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { p: p, n: n, i: idx };
  }
  // Quarter torus elbow in a cell-centred frame: enters at (0,0,-.5) moving
  // +Z, leaves at (.5,0,0) moving +X. Bend radius .5, tube radius PIPE_R.
  function meshElbow() {
    var p = [], n = [], idx = [], ARC = 10;
    for (var i = 0; i <= ARC; i++) {
      var t = i / ARC * Math.PI / 2;
      var ctr = [0.5 - 0.5 * Math.cos(t), 0, -0.5 + 0.5 * Math.sin(t)];
      var out = [-Math.cos(t), 0, Math.sin(t)];   // radial direction from bend centre
      var up = [0, 1, 0];
      for (var j = 0; j <= SIDES; j++) {
        var a = j / SIDES * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        var nn = [out[0] * c + up[0] * s, out[1] * c + up[1] * s, out[2] * c + up[2] * s];
        p.push(ctr[0] + nn[0] * PIPE_R, ctr[1] + nn[1] * PIPE_R, ctr[2] + nn[2] * PIPE_R);
        n.push(nn[0], nn[1], nn[2]);
      }
    }
    for (i = 0; i < ARC; i++) for (j = 0; j < SIDES; j++) {
      var k = i * (SIDES + 1) + j, k2 = k + SIDES + 1;
      idx.push(k, k2, k + 1, k2, k2 + 1, k + 1);
    }
    return { p: p, n: n, i: idx };
  }

  function GLPipes(canvas, opts) {
    var gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: true, antialias: true, alpha: false, depth: true,
      powerPreference: 'low-power'
    }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    this.canvas = canvas;
    this.lost = false;
    this.init();
    this.driver = new PipesDriver(this, opts);
    var self = this;
    this._onLost = function (e) { e.preventDefault(); self.lost = true; };
    this._onRestored = function () {
      self.lost = false;
      try { self.init(); self.driver.reset(self.driver.aspect); } catch (err) { self.lost = true; }
    };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);
  }
  GLPipes.prototype.init = function () {
    var gl = this.gl;
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;
    this.aPos = gl.getAttribLocation(prog, 'aPos');
    this.aNrm = gl.getAttribLocation(prog, 'aNrm');
    this.u = {};
    var names = ['uProj', 'uMV', 'uRot', 'uColor', 'uL0', 'uL1'];
    for (var i = 0; i < names.length; i++) this.u[names[i]] = gl.getUniformLocation(prog, names[i]);
    gl.enableVertexAttribArray(this.aPos);
    gl.enableVertexAttribArray(this.aNrm);
    this.meshes = [meshCylinder(), meshSphere(), meshElbow(), meshDisc()].map(function (m) {
      var inter = new Float32Array(m.p.length * 2);
      for (var v = 0; v < m.p.length / 3; v++) {
        inter.set(m.p.slice(v * 3, v * 3 + 3), v * 6);
        inter.set(m.n.slice(v * 3, v * 3 + 3), v * 6 + 3);
      }
      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.i), gl.STATIC_DRAW);
      return { vb: vb, ib: ib, count: m.i.length };
    });
    // Two directional lights in view space: key from upper-left-front, fill from right.
    var l0 = norm([-0.55, 0.65, 0.55]), l1 = norm([0.7, -0.2, 0.6]);
    gl.uniform3fv(this.u.uL0, l0);
    gl.uniform3fv(this.u.uL1, l1);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
    this.mv = new Float32Array(16);
    this.r3 = new Float32Array(9);
    this.bound = -1;
  };
  GLPipes.prototype.resize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.w = w; this.h = h;
    this.driver.aspect = w / h;
    if (this.lost) return;
    this.gl.viewport(0, 0, w, h);
    this.driver.reset(w / h);
    var L = this.driver.layout;
    this.gl.uniformMatrix4fv(this.u.uProj, false, perspective(L.fov, w / h, 1, L.dist + L.nz));
  };
  GLPipes.prototype.clear = function () {
    if (this.lost) return;
    var gl = this.gl;
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };
  GLPipes.prototype.clearBlocks = function (list, cols, rows) {
    if (this.lost) return;
    var gl = this.gl, bw = this.w / cols, bh = this.h / rows;
    gl.enable(gl.SCISSOR_TEST);
    for (var i = 0; i < list.length; i++) {
      var cx = list[i] % cols, cy = (list[i] / cols) | 0;
      var x0 = Math.floor(cx * bw), y0 = Math.floor(cy * bh);
      gl.scissor(x0, y0, Math.floor((cx + 1) * bw) - x0, Math.floor((cy + 1) * bh) - y0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    gl.disable(gl.SCISSOR_TEST);
  };
  GLPipes.prototype.bind = function (k) {
    if (this.bound === k) return;
    var gl = this.gl, m = this.meshes[k];
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(this.aNrm, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    this.bound = k;
  };
  GLPipes.prototype.draw = function (pieces, L) {
    if (this.lost) return;
    var gl = this.gl, u = this.u, mv = this.mv, r3 = this.r3;
    for (var i = 0; i < pieces.length; i++) {
      var pc = pieces[i], b, t;
      if (pc.t === 0) {
        b = basisZ(DIRS[pc.dir]); t = pc.a;
        modelView(mv, b, PIPE_R, PIPE_R, pc.len, t);
      } else if (pc.t === 1) {
        b = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; t = pc.p;
        modelView(mv, b, pc.r, pc.r, pc.r, t);
      } else if (pc.t === 2) {
        var X = DIRS[pc.dOut], Z = DIRS[pc.dIn];
        b = [X, cross(Z, X), Z]; t = pc.p;
        modelView(mv, b, 1, 1, 1, t);
      } else {
        b = basisZ(DIRS[pc.dir]); t = pc.p;
        modelView(mv, b, PIPE_R, PIPE_R, 1, t);
      }
      mv[14] -= L.dist;                      // view transform: camera at +dist on Z
      gl.uniformMatrix4fv(u.uMV, false, mv);
      gl.uniformMatrix3fv(u.uRot, false, rot3(r3, b));
      gl.uniform3fv(u.uColor, pc.col);
      this.bind(pc.t);
      gl.drawElements(gl.TRIANGLES, this.meshes[pc.t].count, gl.UNSIGNED_SHORT, 0);
    }
  };
  GLPipes.prototype.frame = function (dt) { if (!this.lost) this.driver.frame(dt); };
  GLPipes.prototype.destroy = function () {
    var gl = this.gl;
    this.canvas.removeEventListener('webglcontextlost', this._onLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored, false);
    try {
      if (!this.lost && this.meshes) {
        this.meshes.forEach(function (m) { gl.deleteBuffer(m.vb); gl.deleteBuffer(m.ib); });
        gl.deleteProgram(this.prog);
      }
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch (e) { /* ignore */ }
    this.gl = null;
  };

  /* ------------------------------------------------------------------ */
  /* Canvas2D pipes fallback                                             */
  /* ------------------------------------------------------------------ */

  function shadeCss(c, k, white) {
    white = white || 0;
    function ch(v) { return Math.max(0, Math.min(255, Math.round((v * k * (1 - white) + white) * 255))); }
    return 'rgb(' + ch(c[0]) + ',' + ch(c[1]) + ',' + ch(c[2]) + ')';
  }

  function Canvas2DPipes(canvas, opts) {
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d');
    this.ctx = ctx; this.canvas = canvas;
    this.driver = new PipesDriver(this, opts);
  }
  Canvas2DPipes.prototype.resize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.w = w; this.h = h;
    this.driver.aspect = w / h;
    this.driver.reset(w / h);
    this.focal = (h / 2) / Math.tan(this.driver.layout.fov / 2);
  };
  Canvas2DPipes.prototype.clear = function () {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.w, this.h);
  };
  Canvas2DPipes.prototype.clearBlocks = function (list, cols, rows) {
    var bw = this.w / cols, bh = this.h / rows, ctx = this.ctx;
    ctx.fillStyle = '#000';
    for (var i = 0; i < list.length; i++) {
      var cx = list[i] % cols, cy = (list[i] / cols) | 0;
      ctx.fillRect(Math.floor(cx * bw), Math.floor(cy * bh), Math.ceil(bw) + 1, Math.ceil(bh) + 1);
    }
  };
  Canvas2DPipes.prototype.proj = function (p) {
    var d = this.driver.layout.dist - p[2];
    if (d < 0.5) d = 0.5;
    return [this.w / 2 + p[0] * this.focal / d, this.h / 2 - p[1] * this.focal / d, this.focal / d];
  };
  Canvas2DPipes.prototype.tube = function (pts3, col) {
    var ctx = this.ctx, pts = [], s = 0, i;
    for (i = 0; i < pts3.length; i++) { pts.push(this.proj(pts3[i])); s += pts[i][2]; }
    var r = PIPE_R * s / pts.length;
    var a = pts[0], b = pts[pts.length - 1];
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy);
    var ox = -0.6, oy = -0.8;               // toward the light (up-left)
    if (l > r * 0.5) {
      var nx = -dy / l, ny = dx / l;
      if (nx * ox + ny * oy < 0) { nx = -nx; ny = -ny; }
      ox = nx; oy = ny;
    }
    var layers = [[2.0, 0.40, 0, 0], [1.55, 0.72, 0.12, 0], [1.0, 1.0, 0.28, 0.05], [0.32, 1, 0.45, 0.75]];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var k = 0; k < layers.length; k++) {
      var L = layers[k], off = L[2] * r;
      ctx.beginPath();
      for (i = 0; i < pts.length; i++) {
        var x = pts[i][0] + ox * off, y = pts[i][1] + oy * off;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.lineWidth = Math.max(1, L[0] * r);
      ctx.strokeStyle = shadeCss(col, L[1], L[3]);
      if (k === 3) ctx.lineCap = 'butt';
      ctx.stroke();
    }
  };
  Canvas2DPipes.prototype.ball = function (p, rad, col) {
    var ctx = this.ctx, q = this.proj(p), r = rad * q[2];
    var g = ctx.createRadialGradient(q[0] - r * 0.35, q[1] - r * 0.4, r * 0.05, q[0], q[1], r);
    g.addColorStop(0, shadeCss(col, 1, 0.85));
    g.addColorStop(0.25, shadeCss(col, 1, 0.1));
    g.addColorStop(0.8, shadeCss(col, 0.55));
    g.addColorStop(1, shadeCss(col, 0.3));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
  };
  Canvas2DPipes.prototype.draw = function (pieces) {
    for (var i = 0; i < pieces.length; i++) {
      var pc = pieces[i];
      if (pc.t === 0) {
        this.tube([pc.a, add(pc.a, DIRS[pc.dir], pc.len)], pc.col);
      } else if (pc.t === 1) {
        this.ball(pc.p, pc.r, pc.col);
      } else if (pc.t === 2) {
        var X = DIRS[pc.dOut], Z = DIRS[pc.dIn], pts = [];
        for (var k = 0; k <= 6; k++) {
          var t = k / 6 * Math.PI / 2, u = 0.5 - 0.5 * Math.cos(t), w = -0.5 + 0.5 * Math.sin(t);
          pts.push([pc.p[0] + X[0] * u + Z[0] * w, pc.p[1] + X[1] * u + Z[1] * w, pc.p[2] + X[2] * u + Z[2] * w]);
        }
        this.tube(pts, pc.col);
      }
      // flat caps (t === 3) are implied by the round line caps
    }
  };
  Canvas2DPipes.prototype.frame = function (dt) { this.driver.frame(dt); };
  Canvas2DPipes.prototype.destroy = function () { this.ctx = null; };

  /* ------------------------------------------------------------------ */
  /* Starfield ("Flying Through Space")                                  */
  /* ------------------------------------------------------------------ */

  function Starfield(canvas) {
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('no 2d');
    this.canvas = canvas;
    this.stars = [];
    for (var i = 0; i < 220; i++) this.stars.push(this.newStar(true));
  }
  Starfield.prototype.newStar = function (anyDepth) {
    return { x: (Math.random() * 2 - 1) * 1.2, y: (Math.random() * 2 - 1) * 1.2,
      z: anyDepth ? 0.05 + Math.random() * 0.95 : 1 };
  };
  Starfield.prototype.resize = function (w, h, dpr) {
    this.canvas.width = w; this.canvas.height = h; this.w = w; this.h = h; this.dpr = dpr;
  };
  Starfield.prototype.frame = function (dt) {
    var ctx = this.ctx, w = this.w, h = this.h, sc = Math.max(w, h) * 0.5;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    var speed = 0.35 * dt, unit = Math.max(1, this.dpr * (h < 200 ? 0.6 : 1));
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      s.z -= speed;
      var x = w / 2 + s.x / s.z * sc * 0.5, y = h / 2 + s.y / s.z * sc * 0.5;
      if (s.z <= 0.02 || x < -4 || y < -4 || x > w + 4 || y > h + 4) { this.stars[i] = this.newStar(false); continue; }
      var size = Math.max(1, Math.round((1 - s.z) * 3 * unit));
      ctx.fillRect(Math.round(x), Math.round(y), size, size);
    }
  };
  Starfield.prototype.destroy = function () { this.ctx = null; };

  /* ------------------------------------------------------------------ */
  /* Mystify Your Mind                                                   */
  /* ------------------------------------------------------------------ */

  function Mystify(canvas) {
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('no 2d');
    this.canvas = canvas;
    this.shapes = null;
  }
  Mystify.prototype.resize = function (w, h, dpr) {
    this.canvas.width = w; this.canvas.height = h; this.w = w; this.h = h; this.dpr = dpr;
    var sp = Math.max(w, h) * 0.35;
    this.shapes = [0, 1].map(function (k) {
      var pts = [];
      for (var i = 0; i < 4; i++) {
        pts.push({ x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() * 0.7 + 0.3) * sp * (Math.random() < 0.5 ? -1 : 1),
          vy: (Math.random() * 0.7 + 0.3) * sp * (Math.random() < 0.5 ? -1 : 1) });
      }
      return { pts: pts, hist: [], hue: k * 180 + Math.random() * 60, acc: 0 };
    });
  };
  Mystify.prototype.frame = function (dt) {
    var ctx = this.ctx, w = this.w, h = this.h;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = Math.max(1, this.dpr * (h < 200 ? 0.6 : 1));
    for (var s = 0; s < this.shapes.length; s++) {
      var S = this.shapes[s];
      S.hue = (S.hue + dt * 25) % 360;
      for (var i = 0; i < S.pts.length; i++) {
        var p = S.pts[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
        if (p.y > h) { p.y = h; p.vy = -Math.abs(p.vy); }
      }
      S.acc += dt;
      if (S.acc >= 0.045 || !S.hist.length) {
        S.acc = 0;
        S.hist.unshift(S.pts.map(function (q) { return [q.x, q.y]; }));
        if (S.hist.length > 7) S.hist.pop();
      }
      ctx.strokeStyle = 'hsl(' + Math.round(S.hue) + ',100%,55%)';
      ctx.beginPath();
      for (var k = 0; k < S.hist.length; k++) {
        var poly = S.hist[k];
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
        ctx.closePath();
      }
      ctx.stroke();
    }
  };
  Mystify.prototype.destroy = function () { this.ctx = null; };

  /* ------------------------------------------------------------------ */
  /* Host: canvas, sizing, animation loop                                */
  /* ------------------------------------------------------------------ */

  function makeCanvas() {
    var c = document.createElement('canvas');
    c.style.cssText = 'display:block;width:100%;height:100%;background:#000;';
    return c;
  }

  function createEffect(name, opts) {
    var canvas = makeCanvas(), effect = null;
    if (name === '3D Pipes') {
      if (opts.renderer !== '2d' && !API._forceCanvas2D) {
        try { effect = new GLPipes(canvas, opts); } catch (e) { effect = null; canvas = makeCanvas(); }
      }
      if (!effect) { try { effect = new Canvas2DPipes(canvas, opts); } catch (e2) { effect = null; } }
    } else if (name === 'Starfield') {
      try { effect = new Starfield(canvas); } catch (e3) { effect = null; }
    } else if (name === 'Mystify') {
      try { effect = new Mystify(canvas); } catch (e4) { effect = null; }
    }
    if (effect) effect.kind = effect instanceof GLPipes ? 'webgl' : '2d';
    return { canvas: canvas, effect: effect };
  }

  // Runs an effect inside `box`; returns a stop function.
  function runIn(box, name, opts, preview) {
    var made = createEffect(name, opts || {});
    var canvas = made.canvas, effect = made.effect;
    if (!effect) return { stop: function () {}, kind: null };
    box.appendChild(canvas);
    var raf = 0, last = 0, stopped = false, ro = null;

    function size() {
      var r = box.getBoundingClientRect();
      var cw = Math.max(1, r.width || (preview ? 150 : global.innerWidth));
      var ch = Math.max(1, r.height || (preview ? 110 : global.innerHeight));
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      // Keep full-screen fill-rate sane on huge displays.
      var maxPx = 2.6e6;
      if (cw * ch * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cw * ch));
      var w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
      if (w === canvas.width && h === canvas.height && effect._sized) return;
      effect._sized = true;
      try { effect.resize(w, h, dpr); } catch (e) { /* ignore */ }
    }
    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(size, 120);
    }
    function loop(ts) {
      if (stopped) return;
      raf = global.requestAnimationFrame(loop);
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 1 / 60;
      last = ts;
      try { effect.frame(dt); } catch (e) { /* keep going */ }
    }
    size();
    if (preview && typeof global.ResizeObserver === 'function') {
      ro = new global.ResizeObserver(onResize);
      ro.observe(box);
    } else {
      global.addEventListener('resize', onResize);
    }
    raf = global.requestAnimationFrame(loop);

    return {
      kind: effect.kind,
      stop: function () {
        if (stopped) return;
        stopped = true;
        global.cancelAnimationFrame(raf);
        clearTimeout(resizeTimer);
        if (ro) ro.disconnect(); else global.removeEventListener('resize', onResize);
        try { effect.destroy(); } catch (e) { /* ignore */ }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas.width = canvas.height = 0;
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  var current = null;   // { overlay, runner, listeners, onStop }

  var API = {
    names: NAMES.slice(),
    running: false,
    _forceCanvas2D: false,
    renderer: null,     // 'webgl' | '2d' | null — what the running saver uses

    start: function (name, opts) {
      try {
        opts = opts || {};
        if (current) API.stop();
        if (NAMES.indexOf(name) < 0 || name === '(None)') return;
        var overlay = document.createElement('div');
        overlay.setAttribute('data-screensaver', name);
        overlay.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;width:100vw;height:100vh;' +
          'margin:0;padding:0;background:#000;z-index:2147483000;cursor:none;overflow:hidden;' +
          'touch-action:none;user-select:none;-webkit-user-select:none;';
        document.body.appendChild(overlay);

        var startT = Date.now(), origin = null, THRESH = 6, GRACE = 400;
        function quit(e, swallowClick) {
          if (e && e.cancelable) e.preventDefault();
          if (e) e.stopPropagation();
          API.stop();
          if (swallowClick) {
            // Eat the click that follows the pointerdown which dismissed us.
            var eat = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
            global.addEventListener('click', eat, true);
            setTimeout(function () { global.removeEventListener('click', eat, true); }, 500);
          }
        }
        var L = {
          pointermove: function (e) {
            if (origin === null || Date.now() - startT < GRACE) { origin = [e.clientX, e.clientY]; return; }
            var dx = e.clientX - origin[0], dy = e.clientY - origin[1];
            if (dx * dx + dy * dy > THRESH * THRESH) quit(null);
          },
          pointerdown: function (e) { quit(e, true); },
          keydown: function (e) { if (Date.now() - startT >= 150) quit(e); },
          wheel: function (e) { quit(e); }
        };
        for (var k in L) global.addEventListener(k, L[k], { capture: true, passive: k === 'pointermove' });

        current = { overlay: overlay, listeners: L, onStop: opts.onStop, runner: null };
        API.running = true;
        current.runner = runIn(overlay, name, opts, false);
        API.renderer = current.runner.kind;
      } catch (err) {
        try { API.stop(); } catch (e2) { /* ignore */ }
      }
    },

    stop: function () {
      var c = current;
      if (!c) { API.running = false; return; }
      current = null;
      API.running = false;
      API.renderer = null;
      try {
        for (var k in c.listeners) global.removeEventListener(k, c.listeners[k], { capture: true });
        if (c.runner) c.runner.stop();
        if (c.overlay.parentNode) c.overlay.parentNode.removeChild(c.overlay);
      } catch (e) { /* ignore */ }
      if (typeof c.onStop === 'function') { try { c.onStop(); } catch (e2) { /* ignore */ } }
    },

    preview: function (container, name, opts) {
      try {
        if (!container || NAMES.indexOf(name) < 0 || name === '(None)') return { stop: function () {} };
        var o = {};
        for (var k in (opts || {})) o[k] = opts[k];
        if (name === '3D Pipes' && !o.speed) o.speed = 16;
        var r = runIn(container, name, o, true);
        return { stop: r.stop, renderer: r.kind };
      } catch (e) {
        return { stop: function () {} };
      }
    }
  };

  global.Screensaver = API;
})(window);
