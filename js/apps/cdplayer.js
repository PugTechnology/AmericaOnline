/*
 * CD Player, Windows 98 edition. The one disc in the drive is the "Compaq
 * Presario Demo CD": five chiptune tracks synthesized by Sound.playSong.
 */
(function () {
  var h = U.h;

  // Notes are written "C5:0.5" (name, octave, beats); "R:1" is a rest.
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function seq(str, times) {
    var out = [];
    for (var k = 0; k < (times || 1); k++) {
      str.split(/\s+/).forEach(function (tok) {
        if (!tok) return;
        var m = /^([A-GR])([#b]?)(\d?):([\d.]+)$/.exec(tok);
        if (!m) return;
        var beats = parseFloat(m[4]);
        if (m[1] === 'R') { out.push([0, beats]); return; }
        out.push([12 * (parseInt(m[3], 10) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), beats]);
      });
    }
    return out;
  }

  var TRACKS = [
    { title: 'Startup Groove', song: { tempo: 132, voices: [
      { wave: 'square', gain: 0.1, notes: seq('C5:.5 E5:.5 G5:.5 E5:.5 C5:.5 E5:.5 G5:1 A4:.5 C5:.5 F5:.5 C5:.5 A4:.5 C5:.5 F5:1 G4:.5 B4:.5 D5:.5 B4:.5 G4:.5 B4:.5 D5:1 C5:.5 E5:.5 G5:.5 C6:1.5 R:1', 2) },
      { wave: 'triangle', gain: 0.22, notes: seq('C3:2 C3:2 F3:2 F3:2 G3:2 G3:2 C3:2 R:2', 2) }] } },
    { title: 'Dial-Up Blues', song: { tempo: 96, voices: [
      { wave: 'square', gain: 0.09, notes: seq('A4:1 C5:.5 D5:.5 Eb5:.5 E5:.5 G5:1 E5:1 D5:.5 C5:.5 A4:2 D5:1 F5:.5 G5:.5 Ab5:.5 A5:.5 C6:1 A5:1 G5:.5 E5:.5 A4:2', 2) },
      { wave: 'triangle', gain: 0.22, notes: seq('A2:1 A2:1 A2:1 A2:1 D3:1 D3:1 D3:1 D3:1 E3:1 E3:1 A2:2', 4) }] } },
    { title: 'Blue Screen Waltz', song: { tempo: 126, voices: [
      { wave: 'square', gain: 0.09, notes: seq('E5:1 G5:1 B5:1 A5:1.5 G5:.5 F#5:1 G5:1 E5:1 B4:1 E5:1 G5:1 B5:1 C6:1.5 B5:.5 A5:1 G5:3', 2) },
      { wave: 'triangle', gain: 0.2, notes: seq('E3:1 B3:1 B3:1 A3:1 E3:1 E3:1 E3:1 B3:1 B3:1 E3:1 B3:1 B3:1 A3:1 E3:1 E3:1 E3:3', 2) }] } },
    { title: 'Defrag Disco', song: { tempo: 140, voices: [
      { wave: 'sawtooth', gain: 0.07, notes: seq('E5:.5 E5:.5 R:.5 G5:.5 A5:1 G5:.5 E5:.5 D5:.5 D5:.5 R:.5 F5:.5 G5:1 F5:.5 D5:.5 C5:.5 C5:.5 R:.5 E5:.5 G5:1 E5:.5 C5:.5 D5:1 E5:1 R:1', 2) },
      { wave: 'square', gain: 0.1, notes: seq('A2:.5 A3:.5 A2:.5 A3:.5 A2:.5 A3:.5 A2:.5 A3:.5 G2:.5 G3:.5 G2:.5 G3:.5 G2:.5 G3:.5 G2:.5 G3:.5', 3) }] } },
    { title: 'Y2K Countdown', song: { tempo: 152, voices: [
      { wave: 'square', gain: 0.08, notes: seq('C5:.25 E5:.25 G5:.25 C6:.25 G5:.25 E5:.25 C5:.25 E5:.25 D5:.25 F5:.25 A5:.25 D6:.25 A5:.25 F5:.25 D5:.25 F5:.25 E5:.25 G5:.25 B5:.25 E6:.25 B5:.25 G5:.25 E5:.25 G5:.25 C6:2', 3) },
      { wave: 'triangle', gain: 0.22, notes: seq('C3:2 D3:2 E3:2 C3:2', 3) }] } }
  ];
  TRACKS.forEach(function (t) {
    t.dur = 0;
    t.song.voices.forEach(function (v) {
      var d = 0;
      v.notes.forEach(function (n) { d += n[1] * 60 / t.song.tempo; });
      t.dur = Math.max(t.dur, d);
    });
    t.len = Math.round(t.dur);
  });

  function two(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); return two(Math.floor(sec / 60)) + ':' + two(sec % 60); }

  // 16px transport glyphs (inline SVG, so they never depend on font support).
  var GLYPH = {
    play: '<path d="M4 2l9 6-9 6z" fill="#000"/>',
    pause: '<path d="M3 2h4v12H3zM9 2h4v12H9z" fill="#000"/>',
    stop: '<path d="M3 3h10v10H3z" fill="#000"/>',
    prev: '<path d="M2 2h2v12H2zM14 2v12L5 8z" fill="#000"/>',
    next: '<path d="M12 2h2v12h-2zM2 2l9 6-9 6z" fill="#000"/>',
    back: '<path d="M8 3v10L2 8zM14 3v10L8 8z" fill="#000"/>',
    fwd: '<path d="M8 3v10l6-5zM2 3v10l6-5z" fill="#000"/>',
    eject: '<path d="M8 2l6 7H2zM2 11h12v3H2z" fill="#000"/>'
  };

  function launch() {
    var pl = { status: 'stopped', track: 0, pos: 0, startedAt: 0, handle: null, timer: null };
    var disc = true, ejected = false;
    var opts = U.store.get('w98.cdplayer', { random: false, continuous: false, mode: 'elapsed' });
    var order = [0, 1, 2, 3, 4], orderIdx = 0;

    var led = h('div', { className: 'cd-led-text' }, '[--] --:--');
    var ledInfo = h('div', { className: 'cd-led-info' });
    var display = h('div', { className: 'cd-display' }, [led, ledInfo]);
    var artistEl = h('span', null, 'Compaq Presario');
    var titleEl = h('span', null, 'Demo CD');
    var trackSel = h('select', { className: 'field cd-tracksel' });
    var info = h('div', { className: 'cd-info' }, [
      h('div', null, [h('label', null, 'Artist:'), artistEl]),
      h('div', null, [h('label', null, 'Title:'), titleEl]),
      h('div', null, [h('label', null, 'Track:'), trackSel])
    ]);
    var btns = {};
    function cbtn(id, title, fn) {
      var b = h('button', { className: 'btn cd-btn', title: title, tabindex: '-1', dataset: { act: id } });
      b.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16">' + GLYPH[id] + '</svg>';
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); });
      b.addEventListener('click', fn);
      btns[id] = b;
      return b;
    }
    var row1 = h('div', { className: 'cd-row' }, [cbtn('play', 'Play', play), cbtn('pause', 'Pause', pause), cbtn('stop', 'Stop', stop)]);
    var row2 = h('div', { className: 'cd-row' }, [cbtn('prev', 'Previous Track', function () { skipTrack(-1); }), cbtn('back', 'Skip Backwards', function () { seekBy(-5); }),
      cbtn('fwd', 'Skip Forwards', function () { seekBy(5); }), cbtn('next', 'Next Track', function () { skipTrack(1); }), cbtn('eject', 'Eject', eject)]);
    var win = WM.open({
      app: 'cdplayer', title: 'CD Player', icon: 'cdplayer', width: 'auto', height: 'auto', resizable: false, maximizable: false,
      content: h('div', { className: 'cd' }, [display, h('div', { className: 'cd-controls' }, [row1, row2]), info]), className: 'cd-window',
      onClose: function () { hardStop(); return true; }
    });

    TRACKS.forEach(function (t, i) { trackSel.appendChild(h('option', { value: String(i) }, two(i + 1) + '\u00a0\u00a0' + t.title + '\u00a0\u00a0' + mmss(t.len))); });

    function totalLen() { return TRACKS.reduce(function (a, t) { return a + t.len; }, 0); }
    function elapsed() { return pl.status === 'playing' ? pl.pos + (performance.now() - pl.startedAt) / 1000 : pl.pos; }

    function render() {
      var t = TRACKS[pl.track], e = elapsed();
      if (!disc) {
        led.textContent = '[--] --:--';
        ledInfo.textContent = ejected ? 'No disc' : '';
        trackSel.disabled = true; artistEl.textContent = ''; titleEl.textContent = '';
      } else {
        var shown = opts.mode === 'remaining' ? t.dur - e : opts.mode === 'disc' ? totalLen() - (TRACKS.slice(0, pl.track).reduce(function (a, x) { return a + x.len; }, 0) + e) : e;
        led.textContent = '[' + two(pl.track + 1) + '] ' + (opts.mode === 'elapsed' ? '' : '-') + mmss(shown);
        ledInfo.textContent = pl.status === 'playing' ? 'Playing' : pl.status === 'paused' ? 'Paused' : 'Stopped';
        trackSel.disabled = false; trackSel.value = String(pl.track);
        artistEl.textContent = 'Compaq Presario'; titleEl.textContent = 'Demo CD';
      }
      btns.play.classList.toggle('on', pl.status === 'playing');
      btns.pause.classList.toggle('on', pl.status === 'paused');
    }

    function buildOrder() {
      order = [0, 1, 2, 3, 4];
      if (opts.random) {
        for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = order[i]; order[i] = order[j]; order[j] = x; }
        // Start the shuffle at the current track.
        var at = order.indexOf(pl.track); order.splice(at, 1); order.unshift(pl.track);
      }
      orderIdx = order.indexOf(pl.track);
    }

    function startAudio(offset) {
      if (pl.handle) pl.handle.stop();
      pl.handle = Sound.playSong ? Sound.playSong(TRACKS[pl.track].song, { offset: offset || 0 }) : null;
      pl.pos = offset || 0;
      pl.startedAt = performance.now();
      pl.status = 'playing';
      if (!pl.timer) pl.timer = setInterval(tick, 200);
    }
    function hardStop() {
      if (pl.handle) { pl.handle.stop(); pl.handle = null; }
      clearInterval(pl.timer); pl.timer = null;
      pl.status = 'stopped'; pl.pos = 0;
    }
    function noDisc() {
      WM.msgbox({ title: 'CD Player', owner: win, icon: 'warning', text: 'Please insert an audio compact disc into the CD-ROM drive.' }).then(function () {
        // Closing the tray: the demo disc goes back in.
        disc = true; ejected = false; render();
      });
    }

    function play() {
      if (!disc) { noDisc(); return; }
      if (pl.status === 'playing') return;
      if (pl.status === 'paused') startAudio(pl.pos);
      else { buildOrder(); startAudio(0); }
      render();
    }
    function pause() {
      if (pl.status === 'playing') {
        pl.pos = elapsed();
        if (pl.handle) { pl.handle.stop(); pl.handle = null; }
        pl.status = 'paused';
      } else if (pl.status === 'paused') startAudio(pl.pos);
      render();
    }
    function stop() { hardStop(); render(); }
    function goTrack(i, keepPlaying) {
      pl.track = (i + TRACKS.length) % TRACKS.length;
      pl.pos = 0;
      if (keepPlaying) startAudio(0);
      else if (pl.handle) { pl.handle.stop(); pl.handle = null; }
      render();
    }
    function skipTrack(d) {
      if (!disc) return;
      var was = pl.status === 'playing';
      if (opts.random && order.length) { orderIdx = (orderIdx + d + order.length) % order.length; goTrack(order[orderIdx], was); }
      else goTrack(pl.track + d, was);
    }
    function seekBy(d) {
      if (!disc || pl.status === 'stopped') return;
      var t = TRACKS[pl.track], e = U.clamp(elapsed() + d, 0, t.dur - 0.5);
      if (pl.status === 'playing') startAudio(e); else pl.pos = e;
      render();
    }
    function eject() {
      hardStop();
      if (disc) { disc = false; ejected = true; U.sound('hddSeek', 300); render(); }
      else noDisc();     // second press: nothing to eject
    }

    // Called ten times a second-ish: keeps the LED honest and moves on at the end of a track.
    function tick() {
      if (win.closed) { hardStop(); return; }
      if (pl.status === 'playing' && elapsed() >= TRACKS[pl.track].dur) {
        if (orderIdx < order.length - 1) { orderIdx++; goTrack(order[orderIdx], true); return; }
        if (opts.continuous) { buildOrder(); orderIdx = 0; goTrack(order[0], true); return; }
        hardStop();
        pl.track = order[0];
      }
      render();
    }

    trackSel.addEventListener('change', function () {
      var was = pl.status === 'playing';
      var i = +trackSel.value;
      orderIdx = order.indexOf(i);
      goTrack(i, was);
    });

    function setOpt(k, v) { opts[k] = v; U.store.set('w98.cdplayer', opts); if (k === 'random') buildOrder(); render(); }
    Menu.bar(win, [
      { label: '&Disc', items: [
        { label: '&Edit Play List...', disabled: true },
        '-',
        { label: 'E&ject Disc', action: eject },
        '-',
        { label: 'E&xit', action: function () { win.close(); } }
      ] },
      { label: '&View', items: function () {
        return [
          { label: '&Track Time Elapsed', checked: opts.mode === 'elapsed', action: function () { setOpt('mode', 'elapsed'); } },
          { label: 'Track Time &Remaining', checked: opts.mode === 'remaining', action: function () { setOpt('mode', 'remaining'); } },
          { label: '&Disc Time Remaining', checked: opts.mode === 'disc', action: function () { setOpt('mode', 'disc'); } }
        ];
      } },
      { label: '&Options', items: function () {
        return [
          { label: '&Random Order', checked: opts.random, action: function () { setOpt('random', !opts.random); } },
          { label: '&Continuous Play', checked: opts.continuous, action: function () { setOpt('continuous', !opts.continuous); } }
        ];
      } },
      { label: '&Help', items: [
        { label: '&Help Topics', action: function () { Shell.launch('help', 'cdplayer'); } },
        '-',
        { label: '&About CD Player', action: function () { Shell.launch('about', { name: 'CD Player', icon: 'cdplayer' }); } }
      ] }
    ]);

    win.on('close', hardStop);
    buildOrder();
    render();
    return win;
  }

  Shell.register('cdplayer', { name: 'CD Player', icon: 'cdplayer', launch: launch, single: true });
})();
