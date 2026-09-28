/*
 * sound.js — fully synthesized (Web Audio API) sound effects for the
 * Compaq Presario / Windows 98 boot simulation. No audio files.
 *
 * Public API: window.Sound (see bottom of file). Every call is a silent
 * no-op until Sound.unlock() has been called from a user gesture, and
 * nothing here ever throws.
 *
 * Internally all synthesis lives in Engine(ctx, out), which works with
 * either a live AudioContext or an OfflineAudioContext (used for tests).
 * Engine methods take an optional start time `at` as their first argument
 * and return the nominal duration in seconds.
 */
(function (global) {
  'use strict';

  var MASTER = 0.6;              // master volume (moderate)
  var STORE_KEY = 'w98.muted';

  // Phase start offsets (seconds) of the default dial-up sequence.
  var DIALUP_TIMELINE = { dialTone: 0.1, dtmf: 1.9, ring: 4.0, answer: 6.75,
                          handshake: 9.4, training: 12.66, connected: 17.25 };
  var DIALUP_LEN = 17.4;
  // busyFirst: dial, busy x3, hang up, then the default sequence shifted by BUSY_PRE.
  var BUSY_PRE = 6.2;
  var BUSY_PHASES = { dialTone: 0.1, dtmf: 1.3, busy: 3.1, hangup: 5.75 };
  var DIALUP_TIMELINE_BUSY = (function () {
    var o = {};
    for (var k in DIALUP_TIMELINE) o[k] = +(DIALUP_TIMELINE[k] + BUSY_PRE).toFixed(3);
    o.redialTone = o.dialTone; o.redialDtmf = o.dtmf;
    o.dialTone = BUSY_PHASES.dialTone; o.dtmf = BUSY_PHASES.dtmf;
    o.busy = BUSY_PHASES.busy; o.hangup = BUSY_PHASES.hangup;
    return o;
  })();

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function noop() {}

  // ---------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------
  function Engine(ctx, out) {
    var E = {};
    var sr = ctx.sampleRate;
    var nyq = sr / 2;
    var cache = {};
    var collector = null;        // when non-null, started sources are recorded here
    var state = { fan: null, hdd: null, dial: null };

    function now(at) { return (at != null && isFinite(at)) ? at : ctx.currentTime + 0.02; }

    // ---- buffers ------------------------------------------------------
    function noiseBuf() {
      if (!cache.noise) {
        var len = Math.floor(sr * 4);
        var b = ctx.createBuffer(1, len, sr);
        var d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        cache.noise = b;
      }
      return cache.noise;
    }
    // a short sharp mechanical impulse (stepper / head click excitation)
    function clickBuf() {
      if (!cache.click) {
        var len = Math.floor(sr * 0.006);
        var b = ctx.createBuffer(1, len, sr);
        var d = b.getChannelData(0);
        var k = sr * 0.0007;
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / k);
        d[0] = 1; d[1] = -0.8; d[2] = 0.5;
        cache.click = b;
      }
      return cache.click;
    }

    // ---- node helpers -------------------------------------------------
    function G(v, dest) {
      var g = ctx.createGain();
      g.gain.value = v;
      if (dest) g.connect(dest);
      return g;
    }
    function F(type, f, q, dest) {
      var fl = ctx.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = Math.min(f, nyq * 0.95);
      if (q != null) fl.Q.value = q;
      if (dest) fl.connect(dest);
      return fl;
    }
    function O(type, f, dest) {
      var o = ctx.createOscillator();
      if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
      o.frequency.value = f;
      if (dest) o.connect(dest);
      return o;
    }
    function run(s, t, t2) {
      s.start(t);
      if (t2 != null) s.stop(t2);
      if (collector) collector.push(s);
      return s;
    }
    // looping white noise source; dur == null => runs until stopped
    function N(dest, t, dur) {
      var s = ctx.createBufferSource();
      s.buffer = noiseBuf();
      s.loop = true;
      s.connect(dest);
      s.start(t, Math.random() * 3.5);
      if (dur != null) s.stop(t + dur);
      if (collector) collector.push(s);
      return s;
    }
    // percussive envelope: linear attack, exponential decay
    function perc(p, t, peak, a, d) {
      peak = Math.max(peak, 0.0002);
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(peak, t + a);
      p.exponentialRampToValueAtTime(0.0001, t + a + d);
      p.setValueAtTime(0, t + a + d + 0.001);
    }
    // gated envelope: attack, sustain, release (linear)
    function gate(p, t, peak, a, dur, r) {
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(peak, t + a);
      p.setValueAtTime(peak, Math.max(t + a, t + dur - r));
      p.linearRampToValueAtTime(0, t + dur);
    }
    function glide(p, t, target, tau) {
      try {
        if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
        else p.cancelScheduledValues(t);
      } catch (e) { try { p.cancelScheduledValues(t); } catch (e2) { /* ignore */ } }
      p.setTargetAtTime(target, t, tau);
    }

    // ---- sound building blocks ---------------------------------------
    function tone(f, t, dur, peak, type, dest, a, r) {
      var g = G(0, dest);
      gate(g.gain, t, peak, a == null ? 0.005 : a, dur, r == null ? 0.005 : r);
      run(O(type || 'sine', f, g), t, t + dur + 0.02);
      return g;
    }
    function burst(t, dur, ftype, f, q, peak, dest) {
      var g = G(0, dest);
      var fl = F(ftype, f, q, g);
      perc(g.gain, t, peak, 0.0006, dur);
      N(fl, t, dur + 0.03);
      return g;
    }
    function thump(t, f, peak, decay, dest) {
      var g = G(0, dest);
      var o = O('sine', f * 1.6, g);
      o.frequency.setValueAtTime(f * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(f, t + decay * 0.5);
      perc(g.gain, t, peak, 0.002, decay);
      run(o, t, t + decay + 0.05);
    }
    function impulse(t, amp, rate, dest) {
      var s = ctx.createBufferSource();
      s.buffer = clickBuf();
      s.playbackRate.value = rate || 1;
      var g = G(amp, dest);
      s.connect(g);
      run(s, t);
    }
    // inharmonic bell: [ratio, amp, decayMul]
    var BELL = [[1, 1, 1], [2.005, 0.32, 0.55], [2.76, 0.38, 0.4], [4.07, 0.16, 0.28],
                [5.43, 0.09, 0.18], [0.5, 0.1, 1.3]];
    function bell(f, t, peak, decay, dest, send) {
      var sum = G(1, dest);
      if (send) sum.connect(send);
      for (var i = 0; i < BELL.length; i++) {
        var p = BELL[i], pf = f * p[0];
        if (pf > nyq * 0.9) continue;
        var g = G(0, sum);
        perc(g.gain, t, peak * p[1], 0.003, decay * p[2]);
        var o = O('sine', pf, g);
        o.detune.value = rnd(-3, 3);
        run(o, t, t + decay * p[2] + 0.05);
      }
    }
    // shared generated-noise convolution reverb; returns its input node
    function reverb() {
      if (!cache.verb) {
        var len = Math.floor(sr * 2.8);
        var ir = ctx.createBuffer(2, len, sr);
        for (var c = 0; c < 2; c++) {
          var d = ir.getChannelData(c);
          for (var i = 0; i < len; i++) {
            var x = i / len;
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 2.5) * Math.exp(-x * 3);
          }
          // tiny pre-delay
          for (var j = 0; j < Math.floor(sr * 0.012); j++) d[j] = 0;
        }
        var conv = ctx.createConvolver();
        conv.buffer = ir;
        var inG = G(1, null);
        var lp = F('lowpass', 6500, 0.5, conv);
        inG.connect(lp);
        conv.connect(G(0.55, out));
        cache.verb = inG;
      }
      return cache.verb;
    }
    // synth pad chord (detuned saws + triangle) through an opening lowpass
    function pad(notes, t, a, holdEnd, rel, peak, dest, cf0, cf1) {
      var g = G(0, dest);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, holdEnd);
      g.gain.setTargetAtTime(0, holdEnd, rel / 4);
      var lp = F('lowpass', cf0, 0.8, g);
      lp.frequency.setValueAtTime(cf0, t);
      lp.frequency.exponentialRampToValueAtTime(cf1, t + a);
      var end = holdEnd + rel + 0.1;
      for (var i = 0; i < notes.length; i++) {
        var f = mtof(notes[i]);
        var o1 = O('sawtooth', f, lp); o1.detune.value = -9 + rnd(-2, 2);
        var o2 = O('sawtooth', f, lp); o2.detune.value = 9 + rnd(-2, 2);
        var tg = G(0.6, lp);
        var o3 = O('triangle', f * 2, tg);
        run(o1, t, end); run(o2, t, end); run(o3, t, end);
      }
      return end;
    }

    // ---- PSU / case fan loop -----------------------------------------
    function startFan(t) {
      if (state.fan) return;
      var srcs = [];
      var bus = G(0, out);
      bus.gain.setValueAtTime(0, t);
      bus.gain.linearRampToValueAtTime(1, t + 1.8);
      // air: low-passed noise that opens as the fan spins up
      var lp = F('lowpass', 120, 0.5, G(0.06, bus));
      lp.frequency.setValueAtTime(120, t);
      lp.frequency.setTargetAtTime(420, t, 0.6);
      srcs.push(N(lp, t));
      var bp = F('bandpass', 110, 1.3, G(0.035, bus));
      bp.frequency.setValueAtTime(110, t);
      bp.frequency.setTargetAtTime(230, t, 0.6);
      srcs.push(N(bp, t));
      // transformer / mains hum
      var hum = G(1, bus);
      var H = [[60, 0.012], [120, 0.009], [180, 0.0035], [240, 0.0015]];
      for (var i = 0; i < H.length; i++) {
        srcs.push(run(O('sine', H[i][0], G(H[i][1], hum)), t));
      }
      // faint fan blade-pass tone with slow wobble
      var blade = O('triangle', 40, G(0.0035, bus));
      blade.frequency.setValueAtTime(40, t);
      blade.frequency.setTargetAtTime(170, t, 0.6);
      var wob = O('sine', 0.37, G(1.5, blade.frequency));
      srcs.push(run(blade, t)); srcs.push(run(wob, t));
      state.fan = { srcs: srcs, bus: bus, freqs: [[lp.frequency, 60], [bp.frequency, 60], [blade.frequency, 20]] };
    }
    function stopFan(t) {
      var f = state.fan;
      if (!f) return;
      state.fan = null;
      glide(f.bus.gain, t, 0, 0.42);
      for (var i = 0; i < f.freqs.length; i++) glide(f.freqs[i][0], t, f.freqs[i][1], 0.5);
      for (var j = 0; j < f.srcs.length; j++) { try { f.srcs[j].stop(t + 1.9); } catch (e) { /* */ } }
    }

    // ---- HDD motor ------------------------------------------------------
    var HDD_RPS = 120;           // 7200 rpm spindle
    var HDD_PARTS = [[1, 'sine', 0.10], [2, 'sine', 0.08], [3, 'triangle', 0.03],
                     [4, 'sine', 0.02], [9, 'sine', 0.008], [17.5, 'sine', 0.005]];
    function stopHdd(t) {
      var h = state.hdd;
      if (!h) return;
      state.hdd = null;
      glide(h.bus.gain, t, 0, 0.45);
      for (var i = 0; i < h.freqs.length; i++) glide(h.freqs[i][0], t, h.freqs[i][1] * 0.3, 0.7);
      for (var j = 0; j < h.srcs.length; j++) { try { h.srcs[j].stop(t + 1.9); } catch (e) { /* */ } }
    }

    // ---- stepper body (floppy) ------------------------------------------
    function floppyBody(dest) {
      var outG = G(1, dest);
      var inG = G(1, null);
      inG.connect(F('bandpass', 620, 4, G(1.0, outG)));
      inG.connect(F('bandpass', 1350, 6, G(0.55, outG)));
      inG.connect(F('lowpass', 260, 0.9, G(0.5, outG)));
      inG.connect(G(0.06, outG));
      return inG;
    }
    function floppyMotor(t, dur, level, dest) {
      var bus = G(0, dest);
      gate(bus.gain, t, level, 0.18, dur, 0.18);
      var nb = F('bandpass', 280, 1.6, null);
      var am = G(0.7, bus);
      nb.connect(am);
      run(O('sine', 5, G(0.3, am.gain)), t, t + dur + 0.05);   // 300 rpm wobble
      N(nb, t, dur + 0.05);
      var tri = O('triangle', 30, F('lowpass', 420, 0.7, G(0.22, bus)));
      tri.frequency.setValueAtTime(30, t);
      tri.frequency.setTargetAtTime(96, t, 0.12);
      run(tri, t, t + dur + 0.05);
      run(O('sine', 50, G(0.08, bus)), t, t + dur + 0.05);
    }
    function floppyClunk(t, level, dest) {
      burst(t, 0.05, 'lowpass', 420, 1, 0.6 * level, dest);
      thump(t, 75, 0.7 * level, 0.09, dest);
      burst(t + 0.002, 0.012, 'bandpass', 1500, 2, 0.35 * level, dest);
    }

    // =====================================================================
    // Public sounds
    // =====================================================================
    E.powerOn = function (at) {
      var t = now(at);
      burst(t, 0.012, 'bandpass', 2500, 1.2, 0.8, out);   // switch snap
      burst(t, 0.035, 'lowpass', 600, 1, 0.45, out);       // plastic body
      thump(t, 70, 0.45, 0.1, out);
      burst(t + 0.11, 0.008, 'bandpass', 3200, 2, 0.25, out); // PSU relay
      burst(t + 0.124, 0.006, 'bandpass', 1800, 2, 0.15, out);
      startFan(t + 0.08);
      return 0.4;
    };

    E.powerOff = function (at) {
      var t = now(at);
      burst(t, 0.012, 'bandpass', 2300, 1.2, 0.7, out);
      burst(t, 0.03, 'lowpass', 600, 1, 0.4, out);
      thump(t, 65, 0.4, 0.1, out);
      stopFan(t + 0.03);
      stopHdd(t + 0.03);
      if (state.dial) { try { state.dial(); } catch (e) { /* */ } }
      return 1.6;
    };

    E.degauss = function (at) {
      var t = now(at);
      // relay thunk
      thump(t, 55, 0.5, 0.13, out);
      burst(t, 0.045, 'lowpass', 500, 1, 0.35, out);
      burst(t, 0.006, 'bandpass', 2200, 1.5, 0.2, out);
      // degauss coil "bwommm": mains buzz decaying
      var g = G(0, out);
      perc(g.gain, t + 0.01, 0.2, 0.02, 1.1);
      var lp = F('lowpass', 520, 1.2, g);
      run(O('sawtooth', 60, lp), t, t + 1.3);
      run(O('sine', 120, G(0.6, lp)), t, t + 1.3);
      // static crackle on the glass
      for (var i = 0; i < 14; i++) {
        var ct = t + 0.05 + Math.pow(Math.random(), 1.6) * 0.9;
        burst(ct, rnd(0.001, 0.004), 'highpass', rnd(2500, 6000), 0.7, rnd(0.03, 0.1), out);
      }
      // flyback whine (subtle, fades quickly)
      var w = G(0, out);
      w.gain.setValueAtTime(0, t + 0.05);
      w.gain.linearRampToValueAtTime(0.012, t + 0.15);
      w.gain.setTargetAtTime(0, t + 0.3, 0.45);
      run(O('sine', Math.min(15734, nyq * 0.9), w), t + 0.05, t + 3.0);
      return 1.5;
    };

    E.hddSpinUp = function (at) {
      if (state.hdd) return 0;
      var t = now(at);
      var srcs = [], freqs = [];
      var bus = G(0, out);
      bus.gain.setValueAtTime(0, t);
      bus.gain.linearRampToValueAtTime(0.6, t + 1.0);
      bus.gain.linearRampToValueAtTime(1.0, t + 2.8);
      bus.gain.setTargetAtTime(0.1, t + 3.0, 0.35);
      var mot = G(1, bus);
      for (var i = 0; i < HDD_PARTS.length; i++) {
        var p = HDD_PARTS[i];
        var o = O(p[1], 8 * p[0], G(p[2], mot));
        o.frequency.setValueAtTime(8 * p[0], t);
        o.frequency.setTargetAtTime(HDD_RPS * p[0], t + 0.05, 1.0);
        freqs.push([o.frequency, HDD_RPS * p[0]]);
        srcs.push(run(o, t));
      }
      // air rush inside the sealed case
      var air = F('bandpass', 120, 0.8, G(0.05, bus));
      air.frequency.setValueAtTime(120, t);
      air.frequency.setTargetAtTime(900, t, 1.0);
      freqs.push([air.frequency, 900]);
      srcs.push(N(air, t));
      state.hdd = { srcs: srcs, bus: bus, freqs: freqs };
      // motor engage + head unpark + calibration seeks
      burst(t + 0.02, 0.01, 'bandpass', 900, 1.5, 0.12, out);
      var c = [3.0, 3.12, 3.3, 3.36, 3.47];
      for (var k = 0; k < c.length; k++) {
        burst(t + c[k], 0.004, 'bandpass', rnd(1500, 2600), 1.6, k < 2 ? 0.4 : 0.25, out);
        thump(t + c[k], 150, k < 2 ? 0.12 : 0.07, 0.015, out);
      }
      return 3.6;
    };

    E.hddSeek = function (at, ms) {
      var t = now(at);
      var dur = Math.max(0.02, (ms == null ? 400 : +ms || 400) / 1000);
      var bus = G(1, out);
      var x = 0;
      while (x < dur) {
        var tt = t + x;
        var amp = rnd(0.35, 0.75);
        burst(tt, rnd(0.002, 0.004), 'bandpass', rnd(1400, 3000), 1.5, amp, bus);
        thump(tt, rnd(130, 190), amp * 0.35, 0.012, bus);
        if (Math.random() < 0.35) {          // "tk-tk" double tick
          var d2 = rnd(0.004, 0.009);
          burst(tt + d2, 0.003, 'bandpass', rnd(1800, 3000), 1.5, amp * 0.6, bus);
        }
        x += (Math.random() < 0.25) ? rnd(0.012, 0.02) : rnd(0.015, 0.08);
      }
      return dur;
    };

    E.floppySeek = function (at) {
      var t = now(at);
      var total = 1.55;
      floppyMotor(t, total, 0.22, out);
      burst(t, 0.01, 'bandpass', 1100, 1.5, 0.25, out);     // drive engage
      var body = floppyBody(G(1, out));
      var grind = G(0, F('lowpass', 500, 0.7, out));
      var i, st;
      // step out
      st = t + 0.28;
      for (i = 0; i < 42; i++) impulse(st + i * 0.008 + rnd(-0.0005, 0.0005), rnd(0.75, 1), rnd(0.95, 1.05), body);
      gate(grind.gain, st, 0.03, 0.01, 42 * 0.008, 0.01);
      // step back in (slightly faster, slightly different pitch)
      var st2 = st + 42 * 0.008 + 0.07;
      for (i = 0; i < 42; i++) impulse(st2 + i * 0.007 + rnd(-0.0005, 0.0005), rnd(0.75, 1), rnd(1.05, 1.15), body);
      var gg = G(0, grind);
      gate(gg.gain, st2, 1, 0.01, 42 * 0.007, 0.01);
      run(O('square', 125, grind), st, st + 42 * 0.008);
      var g2 = O('square', 143, gg); run(g2, st2, st2 + 42 * 0.007 + 0.01);
      // final clunk (head unload)
      floppyClunk(st2 + 42 * 0.007 + 0.12, 1, out);
      return total;
    };

    E.floppyRead = function (at, ms) {
      var t = now(at);
      var dur = Math.max(0.3, (ms == null ? 1500 : +ms || 1500) / 1000);
      floppyMotor(t, dur, 0.22, out);
      floppyClunk(t + 0.04, 0.6, out);
      var body = floppyBody(G(1, out));
      var x = 0.25;
      while (x < dur - 0.2) {
        var n = 1 + Math.floor(Math.random() * 4);
        for (var i = 0; i < n; i++) impulse(t + x + i * 0.008, rnd(0.6, 0.95), rnd(0.95, 1.1), body);
        x += rnd(0.12, 0.35);
      }
      floppyClunk(t + dur - 0.08, 0.5, out);
      return dur;
    };

    E.postBeep = function (at) {
      var t = now(at);
      var lp = F('lowpass', 6000, 0.7, out);
      var hp = F('highpass', 250, 0.7, lp);
      tone(896, t, 0.15, 0.13, 'square', hp, 0.001, 0.003);
      return 0.16;
    };

    E.startup = function (at) {
      var t = now(at);
      var lvl = G(1.7, out);
      var dry = G(1, lvl);
      var send = G(1.0, reverb());
      var dryPad = G(0.8, dry); dryPad.connect(send);
      // airy whoosh swelling into the chord
      var wg = G(0, send);
      wg.gain.setValueAtTime(0, t);
      wg.gain.linearRampToValueAtTime(0.05, t + 2.2);
      wg.gain.setTargetAtTime(0, t + 2.4, 0.5);
      var wf = F('bandpass', 300, 0.9, wg);
      wf.frequency.setValueAtTime(300, t);
      wf.frequency.exponentialRampToValueAtTime(3200, t + 2.4);
      N(wf, t, 4.5);
      // IV (Ab maj9) swelling -> I (Eb add9) resolution: an original plagal cadence
      pad([44, 51, 55, 58, 60], t, 2.0, t + 2.55, 1.0, 0.030, dryPad, 300, 2200);
      pad([39, 46, 55, 58, 65, 67], t + 2.3, 0.7, t + 4.3, 1.8, 0.028, dryPad, 700, 2600);
      // warm sub
      var sg = G(0, dry);
      sg.gain.setValueAtTime(0, t + 2.35);
      sg.gain.linearRampToValueAtTime(0.10, t + 2.9);
      sg.gain.setTargetAtTime(0, t + 4.3, 0.45);
      run(O('sine', mtof(39), sg), t + 2.35, t + 6.8);
      // rising bell arpeggio
      var arp = [75, 79, 82, 84, 87];
      for (var i = 0; i < arp.length; i++) bell(mtof(arp[i]), t + 1.25 + i * 0.17, 0.05 + i * 0.006, 1.6, dry, send);
      // resolution bells
      bell(mtof(79), t + 2.45, 0.05, 3.0, dry, send);
      bell(mtof(82), t + 2.46, 0.045, 3.0, dry, send);
      bell(mtof(87), t + 2.47, 0.055, 3.2, dry, send);
      bell(mtof(63), t + 2.45, 0.05, 3.2, dry, send);
      // high shimmer
      bell(mtof(91), t + 3.1, 0.025, 2.0, dry, send);
      bell(mtof(94), t + 3.45, 0.02, 2.0, dry, send);
      bell(mtof(89), t + 3.8, 0.018, 2.0, dry, send);
      return 6.0;
    };

    E.shutdown = function (at) {
      var t = now(at);
      var dry = G(1.6, out);
      var send = G(1.0, reverb());
      var pg = G(0.8, dry); pg.connect(send);
      pad([46, 53, 58, 62], t, 0.35, t + 1.1, 1.8, 0.028, pg, 500, 1600);
      var notes = [82, 77, 74, 70];
      for (var i = 0; i < notes.length; i++) bell(mtof(notes[i]), t + i * 0.28, 0.07, 1.8, dry, send);
      bell(mtof(58), t + 0.86, 0.05, 2.2, dry, send);
      return 3.0;
    };

    E.ding = function (at) {
      var t = now(at);
      var send = G(0.25, reverb());
      bell(mtof(88), t, 0.16, 0.9, out, send);
      bell(mtof(95), t, 0.05, 0.6, out, send);
      return 0.9;
    };

    E.chord = function (at) {
      var t = now(at);
      var send = G(0.25, reverb());
      var notes = [72, 76, 79, 84];
      for (var i = 0; i < notes.length; i++) {
        var tt = t + i * 0.028;
        var g = G(0, out); g.connect(send);
        perc(g.gain, tt, 0.1, 0.004, 0.9);
        var f = mtof(notes[i]);
        run(O('sine', f, g), tt, tt + 1);
        run(O('triangle', f * 2, G(0.25, g)), tt, tt + 1);
        run(O('sine', f * 3, G(0.08, g)), tt, tt + 1);
      }
      return 1.0;
    };

    E.error = function (at) {
      var t = now(at);
      var send = G(0.2, reverb());
      var lp = F('lowpass', 2400, 0.8, out);
      lp.connect(send);
      function hit(tt, notes, peak, dec) {
        for (var i = 0; i < notes.length; i++) {
          var g = G(0, lp);
          perc(g.gain, tt, peak, 0.004, dec);
          var f = mtof(notes[i]);
          run(O('sawtooth', f, g), tt, tt + dec + 0.05);
          run(O('square', f / 2, G(0.35, g)), tt, tt + dec + 0.05);
        }
      }
      hit(t, [69, 75], 0.17, 0.14);
      hit(t + 0.13, [64, 70], 0.19, 0.45);
      return 0.6;
    };

    E.menuClick = function (at) {
      var t = now(at);
      burst(t, 0.0015, 'highpass', 3000, 0.7, 0.06, out);
      return 0.02;
    };

    // ---- dial-up modem --------------------------------------------------
    var DTMF = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
    };
    function waveFromTones(fund, harms, seed) {
      var n = 0;
      for (var i = 0; i < harms.length; i++) n = Math.max(n, harms[i]);
      var re = new Float32Array(n + 1), im = new Float32Array(n + 1);
      for (var j = 0; j < harms.length; j++) {
        var ph = Math.random() * Math.PI * 2;
        re[harms[j]] = Math.cos(ph); im[harms[j]] = Math.sin(ph);
      }
      return ctx.createPeriodicWave(re, im);
    }

    function telLine(dest) { return F('highpass', 280, 0.7, F('lowpass', 3500, 0.7, dest)); }
    function dialDigits(num, t0, line) {
      for (var i = 0; i < num.length; i++) {
        var pr = DTMF[num.charAt(i)];
        if (!pr) continue;
        tone(pr[0], t0, 0.085, 0.10, 'sine', line, 0.004, 0.004);
        tone(pr[1], t0, 0.085, 0.12, 'sine', line, 0.004, 0.004);
        t0 += 0.085 + 0.055;
      }
    }
    // US busy signal 480+620 Hz, 0.5 s on / 0.5 s off
    function busyTones(t0, cycles, line) {
      for (var c = 0; c < cycles; c++) {
        tone(480, t0 + c, 0.5, 0.075, 'sine', line, 0.01, 0.01);
        tone(620, t0 + c, 0.5, 0.075, 'sine', line, 0.01, 0.01);
      }
    }
    E.busy = function (at, cycles) {
      var t = now(at);
      var n = Math.max(1, Math.min(60, Math.round(cycles == null ? 4 : +cycles || 4)));
      busyTones(t, n, telLine(out));
      return n;
    };

    E.dialup = function (at, opts) {
      var t0 = now(at);
      var busyFirst = !!(opts && opts.busyFirst);
      var t = t0 + (busyFirst ? BUSY_PRE : 0);
      var total = Math.round(((t - t0) + DIALUP_LEN) * 1000) / 1000;
      var srcs = [];
      collector = srcs;
      var bus;
      try {
        bus = G(1, out);
        var line = telLine(bus);
        // line hiss throughout (drops out briefly while hung up)
        var hg = G(0, F('bandpass', 1500, 0.4, line));
        gate(hg.gain, t0, 0.012, 0.05, total - 0.5, 0.05);
        N(hg, t0, total - 0.4);
        if (busyFirst) {
          burst(t0, 0.01, 'bandpass', 1200, 1, 0.3, line);
          tone(350, t0 + BUSY_PHASES.dialTone, 1.0, 0.09, 'sine', line, 0.01, 0.01);
          tone(440, t0 + BUSY_PHASES.dialTone, 1.0, 0.09, 'sine', line, 0.01, 0.01);
          dialDigits('18005550142', t0 + BUSY_PHASES.dtmf, line);
          busyTones(t0 + BUSY_PHASES.busy, 3, line);
          hg.gain.setValueAtTime(0.012, t0 + BUSY_PHASES.hangup);
          hg.gain.linearRampToValueAtTime(0.002, t0 + BUSY_PHASES.hangup + 0.02);
          hg.gain.setValueAtTime(0.002, t - 0.02);
          hg.gain.linearRampToValueAtTime(0.012, t);
          burst(t0 + BUSY_PHASES.hangup, 0.012, 'bandpass', 1000, 1, 0.3, line);   // hang up
        }
        // off-hook click
        burst(t, 0.01, 'bandpass', 1200, 1, 0.3, line);
        // dial tone 350+440
        tone(350, t + 0.1, 1.6, 0.09, 'sine', line, 0.01, 0.01);
        tone(440, t + 0.1, 1.6, 0.09, 'sine', line, 0.01, 0.01);
        // DTMF digits (fictional 555 number)
        dialDigits('18005550142', t + DIALUP_TIMELINE.dtmf, line);
        // ringback 440+480
        tone(440, t + 4.0, 1.8, 0.07, 'sine', line, 0.02, 0.02);
        tone(480, t + 4.0, 1.8, 0.07, 'sine', line, 0.02, 0.02);
        // remote answers
        burst(t + 6.5, 0.012, 'bandpass', 900, 1, 0.2, line);
        // ANSam: 2100 Hz, 15 Hz AM, phase reversals every 450 ms
        var a0 = t + 6.75, a1 = t + 9.25;
        var aenv = G(0, line);
        gate(aenv.gain, a0, 0.16, 0.02, a1 - a0, 0.02);
        var am = G(0.8, aenv);
        run(O('sine', 15, G(0.2, am.gain)), a0, a1 + 0.05);
        var sign = G(1, am), sgn = 1;
        for (var r = a0 + 0.45; r < a1; r += 0.45) { sgn = -sgn; sign.gain.setValueAtTime(sgn, r); }
        run(O('sine', 2100, sign), a0, a1 + 0.05);

        // V.21 FSK chatter (V.8 CM / JM) — both modems at 300 baud
        function fsk(c, dev, t0, t1, amp) {
          var g = G(0, line);
          gate(g.gain, t0, amp, 0.01, t1 - t0, 0.01);
          var o = O('sine', c, g);
          for (var x = t0; x < t1; x += 1 / 300) o.frequency.setValueAtTime(c + (Math.random() < 0.5 ? -dev : dev), x);
          run(o, t0, t1 + 0.02);
        }
        fsk(1080, 100, t + 9.4, t + 10.1, 0.09);
        fsk(1750, 100, t + 9.55, t + 10.15, 0.08);
        // DPSK "bing/bong" INFO bursts
        function psk(f, t0, t1, amp, baud) {
          var g = G(0, line);
          gate(g.gain, t0, amp, 0.008, t1 - t0, 0.01);
          var s = G(1, g);
          var v = 1;
          for (var x = t0; x < t1; x += 1 / baud) { if (Math.random() < 0.5) v = -v; s.gain.setValueAtTime(v, x); }
          run(O('sine', f, s), t0, t1 + 0.02);
        }
        // V.34 line probing L1/L2: comb of 150 Hz-spaced tones
        function probe(t0, t1, amp, skip) {
          var h = [];
          for (var k = 1; k <= 25; k++) if (skip.indexOf(k) < 0) h.push(k);
          var g = G(0, line);
          gate(g.gain, t0, amp, 0.01, t1 - t0, 0.01);
          var s = G(1, g);
          var v = 1;
          for (var x = t0 + 0.1; x < t1; x += 0.1) { v = -v; s.gain.setValueAtTime(v, x); }
          run(O(waveFromTones(150, h), 150, s), t0, t1 + 0.02);
        }
        psk(1200, t + 10.2, t + 10.45, 0.12, 600);
        psk(2400, t + 10.5, t + 10.78, 0.11, 600);
        probe(t + 10.82, t + 11.42, 0.16, [6, 8, 12, 16]);
        psk(2400, t + 11.47, t + 11.72, 0.1, 600);
        probe(t + 11.76, t + 12.36, 0.15, [6, 8, 12, 16, 22]);
        psk(1200, t + 12.4, t + 12.62, 0.11, 600);

        // training / scrambled data: the screech and hiss
        function hiss(t0, t1, amp, f, q) {
          var g = G(0, line);
          gate(g.gain, t0, amp, 0.02, t1 - t0, 0.03);
          N(F('bandpass', f, q, g), t0, t1 - t0 + 0.02);
          return g;
        }
        hiss(t + 12.66, t + 14.2, 0.35, 1800, 0.55);
        // tonal screech segment: warbling tones over hiss
        var sc = G(0, line);
        gate(sc.gain, t + 14.2, 0.06, 0.01, 0.35, 0.02);
        var so1 = O('sine', 1800, sc), so2 = O('sine', 2900, sc);
        for (var y = t + 14.2; y < t + 14.55; y += 1 / 240) {
          so1.frequency.setValueAtTime(1800 + rnd(-60, 60), y);
          so2.frequency.setValueAtTime(2900 + rnd(-80, 80), y);
        }
        run(so1, t + 14.2, t + 14.6); run(so2, t + 14.2, t + 14.6);
        hiss(t + 14.2, t + 14.55, 0.15, 2400, 1.2);
        // full-duplex data: two overlapping hisses, a touch louder
        var fd = hiss(t + 14.55, t + 17.2, 0.3, 1400, 0.5);
        hiss(t + 14.6, t + 17.2, 0.22, 2600, 0.8);
        run(O('sine', 7, G(0.08, fd.gain)), t + 14.55, t + 17.2);
        // speaker cut: tiny click
        burst(t + 17.25, 0.004, 'bandpass', 1500, 1, 0.08, line);
      } catch (e) { /* ignore */ }
      collector = null;
      var stopped = false;
      function stop(when) {
        if (stopped) return;
        stopped = true;
        if (state.dial === stop) state.dial = null;
        var s = (when != null) ? when : ctx.currentTime;
        try { if (bus) glide(bus.gain, s, 0, 0.012); } catch (e) { /* */ }
        for (var k = 0; k < srcs.length; k++) { try { srcs[k].stop(s + 0.08); } catch (e2) { /* */ } }
      }
      state.dial = stop;
      return { dur: total, stop: stop };
    };

    // ---- door creak / slam (AOL buddy sounds) -----------------------------
    // hinge squeak: rough tone whose pitch wanders, gated by irregular
    // stick-slip pulses at 20-60 Hz, through resonant wood filters
    function creak(t, dur, f0, f1, level, dest) {
      var body = G(1, dest);
      var r1 = F('bandpass', f0, 7, G(1.0, body));
      var r2 = F('bandpass', f0 * 2.3, 6, G(0.45, body));
      var wood = F('bandpass', 260, 3, G(0.5, body));
      var pg = G(0, null);
      pg.connect(r1); pg.connect(r2); pg.connect(wood);
      var osc = O('sawtooth', f0, pg);
      var osc2 = O('square', f0 * 1.51, G(0.25, pg));
      osc.frequency.setValueAtTime(f0, t);
      osc2.frequency.setValueAtTime(f0 * 1.51, t);
      r1.frequency.setValueAtTime(f0 * 1.05, t);
      r2.frequency.setValueAtTime(Math.min(f0 * 2.3, nyq * 0.9), t);
      // wandering pitch: random walk biased from f0 toward f1
      var x = 0.03, f = f0;
      while (x < dur) {
        var target = f0 + (f1 - f0) * (x / dur) + rnd(-90, 90);
        f = f * 0.6 + target * 0.4;
        f = Math.max(380, Math.min(1250, f));
        osc.frequency.linearRampToValueAtTime(f, t + x);
        osc2.frequency.linearRampToValueAtTime(f * 1.51, t + x);
        r1.frequency.linearRampToValueAtTime(f * 1.05, t + x);
        r2.frequency.linearRampToValueAtTime(Math.min(f * 2.3, nyq * 0.9), t + x);
        x += rnd(0.03, 0.07);
      }
      // stick-slip pulses
      pg.gain.setValueAtTime(0, t);
      x = 0;
      while (x < dur) {
        var prog = x / dur;
        var shape = Math.sin(Math.PI * Math.min(1, prog * 1.15 + 0.05));   // swell & fade
        var amp = level * (0.4 + 0.6 * Math.random()) * (0.3 + 0.7 * shape);
        var pt = t + x, len = rnd(0.008, 0.02);
        pg.gain.setValueAtTime(0.0001, pt);
        pg.gain.linearRampToValueAtTime(amp, pt + 0.0015);
        pg.gain.exponentialRampToValueAtTime(Math.max(amp * 0.05, 0.0001), pt + len);
        impulse(pt, amp * 1.5, rnd(0.8, 1.2), wood);
        x += 1 / rnd(20, 60);
      }
      pg.gain.setValueAtTime(0, t + dur);
      run(osc, t, t + dur + 0.05); run(osc2, t, t + dur + 0.05);
    }
    function latch(t, level, dest) {
      burst(t, 0.004, 'bandpass', 2800, 2, 0.35 * level, dest);
      burst(t + 0.018, 0.005, 'bandpass', 1900, 2, 0.25 * level, dest);
      thump(t, 220, 0.12 * level, 0.02, dest);
    }
    E.doorOpen = function (at) {
      var t = now(at);
      latch(t, 0.8, out);
      creak(t + 0.06, 0.95, 520, 980, 0.5, out);
      return 1.05;
    };
    E.doorClose = function (at) {
      var t = now(at);
      creak(t, 0.24, 900, 600, 0.4, out);
      var s = t + 0.27;
      thump(s, 62, 0.55, 0.22, out);                         // slab of wood hitting frame
      burst(s, 0.09, 'lowpass', 320, 1, 0.5, out);
      burst(s, 0.16, 'bandpass', 115, 7, 0.9, out);          // low body resonance
      burst(s, 0.05, 'bandpass', 700, 3, 0.25, out);
      latch(s + 0.012, 1, out);
      return 0.6;
    };

    // ---- AOL IM / mail -------------------------------------------------------
    function chime(f, t, peak, dec, dest) {
      var g = G(0, dest);
      perc(g.gain, t, peak, 0.004, dec);
      run(O('sine', f, g), t, t + dec + 0.05);
      run(O('sine', f * 2, G(0.18, g)), t, t + dec + 0.05);
      run(O('sine', f * 3.01, G(0.06, g)), t, t + dec * 0.5 + 0.05);
    }
    E.imReceive = function (at) {
      var t = now(at);
      var send = G(0.2, reverb());
      var d = G(1, out); d.connect(send);
      chime(mtof(81), t, 0.2, 0.25, d);          // A5
      chime(mtof(88), t + 0.11, 0.2, 0.32, d);   // E6
      return 0.45;
    };
    E.imSend = function (at) {
      var t = now(at);
      var g = G(0, out);
      perc(g.gain, t, 0.22, 0.03, 0.1);
      var bp = F('bandpass', 700, 1.2, g);
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
      N(bp, t, 0.16);
      // soft pop
      var pg = G(0, out);
      perc(pg.gain, t + 0.1, 0.2, 0.002, 0.05);
      var o = O('sine', 1100, pg);
      o.frequency.setValueAtTime(1100, t + 0.1);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.14);
      run(o, t + 0.1, t + 0.18);
      return 0.2;
    };
    E.mailSent = function (at) {
      var t = now(at);
      var send = G(0.3, reverb());
      var g = G(0, out); g.connect(send);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      var bp = F('bandpass', 300, 1.6, g);
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(4200, t + 0.36);
      N(bp, t, 0.42);
      var tg = G(0, g);
      perc(tg.gain, t + 0.05, 0.05, 0.2, 0.15);
      var o = O('sine', 400, tg);
      o.frequency.setValueAtTime(400, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(1600, t + 0.4);
      run(o, t + 0.05, t + 0.42);
      return 0.4;
    };
    E.modemSpeakerOff = function () {
      if (state.dial) { try { state.dial(); } catch (e) { /* */ } }
      return 0;
    };

    E._state = state;
    return E;
  }

  // ---------------------------------------------------------------------
  // Public wrapper
  // ---------------------------------------------------------------------
  var AC = global.AudioContext || global.webkitAudioContext || null;
  var ctx = null, master = null, eng = null;

  var muted = false;
  var VOL_KEY = 'w98.volume';
  var level = 1;   // user volume 0..1, scales MASTER
  try { var lv = global.localStorage && global.localStorage.getItem(VOL_KEY); if (lv != null && !isNaN(+lv)) level = Math.max(0, Math.min(1, +lv)); } catch (e) { level = 1; }
  function masterGain() { return muted ? 0 : MASTER * level; }
  try { muted = global.localStorage && global.localStorage.getItem(STORE_KEY) === '1'; } catch (e) { muted = false; }

  function wait(sec) {
    return new Promise(function (res) { setTimeout(res, Math.max(0, sec) * 1000); });
  }
  function call(name, arg) {
    if (!eng) return Promise.resolve();
    try {
      var d = eng[name](null, arg);
      return wait(+d || 0);
    } catch (e) {
      return Promise.resolve();
    }
  }

  // ---- speech (Web Speech API) ------------------------------------------
  var PREFERRED_VOICES = ['Male', 'David', 'Daniel', 'Alex', 'Fred'];
  var voiceCache = null;
  function synth() {
    try { return (global.speechSynthesis && global.SpeechSynthesisUtterance) ? global.speechSynthesis : null; } catch (e) { return null; }
  }
  function listVoices(ss) { try { return ss.getVoices() || []; } catch (e) { return []; } }
  function pickVoice(vs) {
    var en = [], i, j;
    for (i = 0; i < vs.length; i++) if (/^en/i.test(vs[i].lang || '')) en.push(vs[i]);
    for (j = 0; j < PREFERRED_VOICES.length; j++) {
      for (i = 0; i < en.length; i++) {
        var nm = en[i].name || '';
        if (nm.indexOf(PREFERRED_VOICES[j]) >= 0 && !/female/i.test(nm)) return en[i];
      }
    }
    for (i = 0; i < en.length; i++) if ((en[i].name || '').indexOf('Google US English') >= 0) return en[i];
    for (i = 0; i < en.length; i++) if (/en[-_]US/i.test(en[i].lang) && !/female/i.test(en[i].name || '')) return en[i];
    return en[0] || null;
  }
  function voicesReady(ss) {
    return new Promise(function (res) {
      var vs = listVoices(ss);
      if (vs.length) { res(vs); return; }
      var done = false;
      function fin() {
        if (done) return;
        done = true;
        try { ss.removeEventListener('voiceschanged', fin); } catch (e) { /* */ }
        res(listVoices(ss));
      }
      try { ss.addEventListener('voiceschanged', fin); } catch (e) { /* */ }
      setTimeout(fin, 1000);
    });
  }
  function speak(text, opts) {
    try {
      opts = opts || {};
      var ss = synth();
      if (muted || !ss || text == null || String(text) === '') return Promise.resolve();
      return voicesReady(ss).then(function (vs) {
        if (muted) return;
        if (!voiceCache && vs.length) voiceCache = pickVoice(vs);
        return new Promise(function (res) {
          var finished = false, timer = null;
          function fin() { if (finished) return; finished = true; clearTimeout(timer); res(); }
          try {
            ss.cancel();
            var u = new global.SpeechSynthesisUtterance(String(text));
            var v = opts.voice || voiceCache;
            u.lang = 'en-US';
            if (v) { try { u.voice = v; u.lang = v.lang || 'en-US'; } catch (e2) { /* keep default voice */ } }
            u.rate = opts.rate != null ? opts.rate : 0.95;
            u.pitch = opts.pitch != null ? opts.pitch : 0.95;
            u.volume = opts.volume != null ? opts.volume : 1;
            u.onend = fin;
            u.onerror = fin;
            timer = setTimeout(fin, opts.timeout != null ? opts.timeout : 4000);
            ss.speak(u);
          } catch (e) { fin(); }
        });
      }).catch(noop);
    } catch (e) {
      return Promise.resolve();
    }
  }

  // ---- AOL voice clips (drop-in files, with fallbacks) ------------------------
  // Sound.clip('welcome', 'Welcome!') plays the file named in sounds/aol/clips.json.
  // No entry (null), or no manifest? It falls back to a synth sound (im, buddy-in,
  // buddy-out) or to speech. Only listed files are fetched, so a stock checkout
  // makes no failing requests.
  var CLIP_DIR = 'sounds/aol/';
  var CLIP_SYNTH = { 'im': 'imReceive', 'buddy-in': 'doorOpen', 'buddy-out': 'doorClose' };
  var clipBufs = {};             // name -> AudioBuffer, or false once it failed or isn't listed
  var clipLoads = {};            // name -> in-flight load promise
  var clipManifest = null;       // promise for the parsed clips.json, fetched once

  function fetchClip(url) {
    return global.fetch(url).then(function (r) {
      if (!r.ok) throw new Error('missing');
      return r.arrayBuffer();
    }).then(function (ab) {
      return new Promise(function (res, rej) {
        var p = ctx.decodeAudioData(ab, res, rej);   // callbacks for old Safari
        if (p && p.then) p.then(res, rej);
      });
    });
  }
  // Resolves with {name: filename|null}; {} if clips.json can't be loaded (e.g. file://).
  function loadManifest() {
    if (!clipManifest) {
      clipManifest = (global.fetch ? global.fetch(CLIP_DIR + 'clips.json').then(function (r) {
        if (!r.ok) throw new Error('no manifest');
        return r.json();
      }) : Promise.reject(new Error('no fetch'))).then(function (m) {
        return (m && typeof m === 'object') ? m : {};
      }, function () { return {}; });
    }
    return clipManifest;
  }
  // Resolves with the decoded buffer, or null. Failures are remembered.
  function loadClip(name) {
    if (clipBufs[name] !== undefined) return Promise.resolve(clipBufs[name] || null);
    if (!ctx || !global.fetch) return Promise.resolve(null);   // not unlocked yet: try again later
    if (clipLoads[name]) return clipLoads[name];
    clipLoads[name] = loadManifest().then(function (m) {
      var file = m[name];
      if (typeof file !== 'string' || !file) { clipBufs[name] = false; return null; }
      return fetchClip(CLIP_DIR + file).then(function (b) { clipBufs[name] = b; return b; }, function () { clipBufs[name] = false; return null; });
    }).then(function (b) { delete clipLoads[name]; return b; }, function () { delete clipLoads[name]; return null; });
    return clipLoads[name];
  }
  function playClip(buf) {
    return new Promise(function (res) {
      try {
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(master);
        src.onended = res;
        src.start();
        setTimeout(res, buf.duration * 1000 + 500);
      } catch (e) { res(); }
    });
  }
  function clip(name, fallbackText) {
    try {
      return loadClip(name).then(function (buf) {
        if (buf) return playClip(buf);
        if (CLIP_SYNTH[name]) return call(CLIP_SYNTH[name]);
        return speak(fallbackText);
      }).catch(noop);
    } catch (e) {
      return Promise.resolve();
    }
  }
  // Quietly fetch clips ahead of time (no sound, no errors).
  function preloadClips(names) {
    (names || ['welcome', 'youve-got-mail', 'goodbye', 'files-done', 'im', 'buddy-in', 'buddy-out']).forEach(function (n) { loadClip(n).catch(noop); });
  }

  var Sound = {
    unlock: function () {
      try {
        if (!AC) return;
        if (!ctx) {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = masterGain();
          var lim = ctx.createDynamicsCompressor();   // safety limiter only
          lim.threshold.value = -3; lim.knee.value = 2; lim.ratio.value = 20;
          lim.attack.value = 0.002; lim.release.value = 0.15;
          master.connect(lim);
          lim.connect(ctx.destination);
          eng = Engine(ctx, master);
        }
        if (ctx.state === 'suspended' && ctx.resume) {
          var p = ctx.resume();
          if (p && p.catch) p.catch(noop);
        }
      } catch (e) { /* audio unavailable: stay silent */ }
    },
    setMuted: function (b) {
      muted = !!b;
      try { if (global.localStorage) global.localStorage.setItem(STORE_KEY, muted ? '1' : '0'); } catch (e) { /* */ }
      if (muted) { try { var ss = synth(); if (ss) ss.cancel(); } catch (e) { /* */ } }
      try {
        if (master) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setTargetAtTime(masterGain(), ctx.currentTime, 0.02);
        }
      } catch (e) { /* */ }
    },
    // Master volume, 0..1 (persisted). Independent of the mute switch.
    setVolume: function (v) {
      level = Math.max(0, Math.min(1, +v || 0));
      try { if (global.localStorage) global.localStorage.setItem(VOL_KEY, String(level)); } catch (e) { /* */ }
      try {
        if (master) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setTargetAtTime(masterGain(), ctx.currentTime, 0.02);
        }
      } catch (e) { /* */ }
    },
    // Play a little chiptune. song = { tempo: bpm, voices: [{ wave, gain, notes: [[midi|0, beats], ...] }] }.
    // Returns { dur, stop }; dur (seconds) is valid even when audio is unavailable or muted,
    // so callers can keep their own clock. opts.offset skips ahead by that many seconds.
    playSong: function (song, opts) {
      opts = opts || {};
      var spb = 60 / song.tempo, off = opts.offset || 0, dur = 0, oscs = [];
      song.voices.forEach(function (v) {
        var t = 0;
        v.notes.forEach(function (n) { t += n[1] * spb; });
        dur = Math.max(dur, t);
      });
      var out = null;
      try {
        if (!ctx || !master) Sound.unlock();
        if (ctx && master) {
          out = ctx.createGain();
          out.gain.value = 1;
          out.connect(master);          // master carries the mute and volume
          var t0 = ctx.currentTime + 0.05;
          song.voices.forEach(function (v) {
            var t = 0;
            v.notes.forEach(function (n) {
              var len = n[1] * spb, start = t - off;
              t += len;
              if (!n[0] || t <= off) return;
              var at = Math.max(0, start), nl = Math.min(len * 0.92, t - off - at);
              var o = ctx.createOscillator(), g = ctx.createGain();
              o.type = v.wave || 'square';
              o.frequency.value = 440 * Math.pow(2, (n[0] - 69) / 12);
              var peak = v.gain == null ? 0.12 : v.gain;
              g.gain.setValueAtTime(0.0001, t0 + at);
              g.gain.linearRampToValueAtTime(peak, t0 + at + 0.01);
              g.gain.setValueAtTime(peak * 0.7, t0 + at + Math.min(0.08, nl * 0.5));
              g.gain.linearRampToValueAtTime(0.0001, t0 + at + nl);
              o.connect(g); g.connect(out);
              o.start(t0 + at); o.stop(t0 + at + nl + 0.02);
              oscs.push(o);
            });
          });
        }
      } catch (e) { out = null; }
      return {
        dur: Math.max(0, dur - off),
        stop: function () {
          try {
            oscs.forEach(function (o) { try { o.stop(); } catch (e) { /* already ended */ } });
            if (out) { out.disconnect(); out = null; }
          } catch (e) { /* */ }
        }
      };
    },
    powerOn: function () { return call('powerOn'); },
    powerOff: function () { return call('powerOff'); },
    degauss: function () { return call('degauss'); },
    hddSpinUp: function () { return call('hddSpinUp'); },
    hddSeek: function (ms) { return call('hddSeek', ms == null ? 400 : ms); },
    floppySeek: function () { return call('floppySeek'); },
    floppyRead: function (ms) { return call('floppyRead', ms == null ? 1500 : ms); },
    postBeep: function () { return call('postBeep'); },
    startup: function () { return call('startup'); },
    shutdown: function () { return call('shutdown'); },
    ding: function () { return call('ding'); },
    chord: function () { return call('chord'); },
    error: function () { return call('error'); },
    menuClick: function () { return call('menuClick'); },
    doorOpen: function () { return call('doorOpen'); },
    doorClose: function () { return call('doorClose'); },
    imReceive: function () { return call('imReceive'); },
    imSend: function () { return call('imSend'); },
    mailSent: function () { return call('mailSent'); },
    busy: function (cycles) { return call('busy', cycles == null ? 4 : cycles); },
    modemSpeakerOff: function () { return call('modemSpeakerOff'); },
    speak: function (text, opts) { return speak(text, opts); },
    clip: clip,
    preloadClips: preloadClips,
    DIALUP_TIMELINE: DIALUP_TIMELINE,
    DIALUP_TIMELINE_BUSY: DIALUP_TIMELINE_BUSY,
    dialup: function (opts) {
      var none = { promise: Promise.resolve(), stop: noop };
      if (!eng) return none;
      try {
        var h = eng.dialup(null, opts);
        var timer = null, done = null;
        var promise = new Promise(function (res) {
          done = res;
          timer = setTimeout(res, h.dur * 1000);
        });
        return {
          promise: promise,
          stop: function () {
            try { clearTimeout(timer); h.stop(); } catch (e) { /* */ }
            if (done) done();
          }
        };
      } catch (e) {
        return none;
      }
    },
    // internals exposed for offline testing
    _Engine: Engine,
    _MASTER: MASTER
  };
  Object.defineProperty(Sound, 'volume', {
    enumerable: true,
    get: function () { return level; },
    set: function (v) { Sound.setVolume(v); }
  });
  Object.defineProperty(Sound, 'muted', {
    enumerable: true,
    get: function () { return muted; },
    set: function (b) { Sound.setMuted(b); }
  });

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : this);
