/* Minesweeper, Windows 98 style: LED counters, the smiley, flags, question marks and chording. */
(function () {
  var h = U.h;
  var LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };
  var NUM_COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080'];

  // Seven-segment LED digits on a canvas.
  var SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
  function drawLed(canvas, value) {
    var x = canvas.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 39, 23);
    var s = value < 0 ? '-' + String(Math.min(99, -value)).padStart(2, '0') : String(Math.min(999, value)).padStart(3, '0');
    for (var i = 0; i < 3; i++) digit(x, 2 + i * 13, 2, s.charAt(i));
  }
  function digit(x, ox, oy, ch) {
    var on = SEGS[ch] || '';
    var seg = {
      a: [1, 0, 9, 2], b: [9, 1, 2, 9], c: [9, 10, 2, 9], d: [1, 17, 9, 2],
      e: [0, 10, 2, 9], f: [0, 1, 2, 9], g: [1, 8.5, 9, 2]
    };
    for (var k in seg) {
      x.fillStyle = on.indexOf(k) !== -1 ? '#ff0000' : '#400000';
      var r = seg[k];
      x.fillRect(ox + r[0], oy + r[1], r[2], r[3]);
    }
  }

  function drawFace(canvas, mood) {
    var x = canvas.getContext('2d');
    x.clearRect(0, 0, 17, 17);
    x.fillStyle = '#ffff00'; x.strokeStyle = '#000';
    x.beginPath(); x.arc(8.5, 8.5, 7.5, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#000';
    if (mood === 'dead') {
      [[5, 5], [11, 5]].forEach(function (p) {
        x.fillRect(p[0] - 1, p[1] - 1, 1, 1); x.fillRect(p[0] + 1, p[1] - 1, 1, 1); x.fillRect(p[0], p[1], 1, 1);
        x.fillRect(p[0] - 1, p[1] + 1, 1, 1); x.fillRect(p[0] + 1, p[1] + 1, 1, 1);
      });
      x.beginPath(); x.arc(8.5, 13.5, 3, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    } else if (mood === 'cool') {
      x.fillRect(3, 5, 11, 1); x.fillRect(4, 5, 4, 3); x.fillRect(9, 5, 4, 3);
      x.beginPath(); x.arc(8.5, 9, 4, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
    } else if (mood === 'oh') {
      x.fillRect(5, 5, 2, 2); x.fillRect(10, 5, 2, 2);
      x.beginPath(); x.arc(8.5, 12, 2, 0, Math.PI * 2); x.stroke();
    } else {
      x.fillRect(5, 5, 2, 2); x.fillRect(10, 5, 2, 2);
      x.beginPath(); x.arc(8.5, 9, 4, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
    }
  }

  function launch() {
    var level = U.store.get('w98.mines.level', 'beginner');
    var marks = U.store.get('w98.mines.marks', true);
    var W, H, M, cells, state, flags, timer, seconds, firstClick, revealedCount;

    var mineLed = h('canvas', { width: 39, height: 23, className: 'led' });
    var timeLed = h('canvas', { width: 39, height: 23, className: 'led' });
    var faceCanvas = h('canvas', { width: 17, height: 17 });
    var faceBtn = h('button', { className: 'mine-face' }, faceCanvas);
    var grid = h('div', { className: 'mine-grid' });
    var board = h('div', { className: 'mine-board' }, [
      h('div', { className: 'mine-head' }, [mineLed, faceBtn, timeLed]),
      h('div', { className: 'mine-field' }, grid)
    ]);

    var win = WM.open({ app: 'minesweeper', title: 'Minesweeper', icon: 'minesweeper', width: 200, height: 260, resizable: false, maximizable: false, content: board, className: 'minesweeper' });

    function fit() {
      win.el.style.width = 'auto';
      win.el.style.height = 'auto';
    }

    function reset() {
      var L = LEVELS[level]; W = L[0]; H = L[1]; M = L[2];
      cells = []; flags = 0; seconds = 0; firstClick = true; revealedCount = 0; state = 'play';
      clearInterval(timer); timer = null;
      grid.innerHTML = '';
      grid.style.gridTemplateColumns = 'repeat(' + W + ', 16px)';
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var el = h('div', { className: 'cell' });
        var c = { x: x, y: y, mine: false, n: 0, open: false, flag: 0, el: el };
        bindCell(c);
        cells.push(c);
        grid.appendChild(el);
      }
      drawLed(mineLed, M); drawLed(timeLed, 0); drawFace(faceCanvas, 'smile');
      fit();
    }

    function at(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? cells[y * W + x] : null; }
    function around(c) {
      var r = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (dx || dy) { var n = at(c.x + dx, c.y + dy); if (n) r.push(n); }
      return r;
    }

    function layMines(avoid) {
      var spots = cells.filter(function (c) { return c !== avoid; });
      for (var i = 0; i < M; i++) {
        var k = i + Math.floor(Math.random() * (spots.length - i));
        var t = spots[i]; spots[i] = spots[k]; spots[k] = t;
        spots[i].mine = true;
      }
      cells.forEach(function (c) { c.n = around(c).filter(function (n) { return n.mine; }).length; });
    }

    function startTimer() {
      if (timer) return;
      seconds = 1; drawLed(timeLed, 1);
      timer = setInterval(function () { seconds = Math.min(999, seconds + 1); drawLed(timeLed, seconds); }, 1000);
    }

    function reveal(c) {
      if (state !== 'play' || c.open || c.flag === 1) return;
      if (firstClick) { firstClick = false; layMines(c); startTimer(); }
      if (c.mine) { lose(c); return; }
      var stack = [c];
      while (stack.length) {
        var cur = stack.pop();
        if (cur.open || cur.flag === 1) continue;
        cur.open = true; revealedCount++;
        cur.el.className = 'cell open';
        if (cur.n) { cur.el.textContent = cur.n; cur.el.style.color = NUM_COLORS[cur.n]; }
        else around(cur).forEach(function (n) { if (!n.open) stack.push(n); });
      }
      if (revealedCount === W * H - M) winGame();
    }

    function chord(c) {
      if (!c.open || !c.n) return;
      var ns = around(c);
      if (ns.filter(function (n) { return n.flag === 1; }).length === c.n) ns.forEach(reveal);
    }

    function toggleFlag(c) {
      if (state !== 'play' || c.open) return;
      c.flag = (c.flag + 1) % (marks ? 3 : 2);
      if (c.flag === 1) flags++; else if (c.flag === 2 || (!marks && c.flag === 0)) flags--;
      c.el.className = 'cell' + (c.flag === 1 ? ' flagged' : c.flag === 2 ? ' question' : '');
      c.el.textContent = c.flag === 2 ? '?' : '';
      drawLed(mineLed, M - flags);
    }

    function lose(hit) {
      state = 'dead';
      clearInterval(timer);
      cells.forEach(function (c) {
        if (c.mine && c.flag !== 1) c.el.className = 'cell open mine' + (c === hit ? ' hit' : '');
        else if (!c.mine && c.flag === 1) c.el.className = 'cell open wrong';
      });
      drawFace(faceCanvas, 'dead');
    }

    function winGame() {
      state = 'won';
      clearInterval(timer);
      cells.forEach(function (c) { if (c.mine) { c.flag = 1; c.el.className = 'cell flagged'; } });
      drawLed(mineLed, 0);
      drawFace(faceCanvas, 'cool');
      var best = U.store.get('w98.mines.best', {});
      if (level !== 'custom' && (!best[level] || seconds < best[level].t)) {
        setTimeout(function () {
          WM.msgbox({ title: 'Congratulations', owner: win, icon: 'info', text: 'You have the fastest time for ' + level + ' level: ' + seconds + ' seconds.' }).then(function () {
            best[level] = { t: seconds, name: Shell.user || 'Anonymous' };
            U.store.set('w98.mines.best', best);
          });
        }, 200);
      }
    }

    function bindCell(c) {
      var el = c.el, longPress = null, pressed = false;
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      el.addEventListener('pointerdown', function (e) {
        if (state !== 'play') return;
        if (e.button === 2) { toggleFlag(c); return; }
        if (e.button === 1) { e.preventDefault(); chord(c); return; }
        pressed = true;
        drawFace(faceCanvas, 'oh');
        if (!c.open && !c.flag) el.classList.add('down');
        if (e.pointerType === 'touch') longPress = setTimeout(function () { pressed = false; el.classList.remove('down'); toggleFlag(c); drawFace(faceCanvas, 'smile'); }, 450);
      });
      el.addEventListener('pointerleave', function () { el.classList.remove('down'); clearTimeout(longPress); });
      el.addEventListener('pointerup', function (e) {
        clearTimeout(longPress);
        el.classList.remove('down');
        if (!pressed || e.button !== 0) return;
        pressed = false;
        if (state === 'play') drawFace(faceCanvas, 'smile');
        if (c.open) chord(c); else reveal(c);
      });
      el.addEventListener('dblclick', function () { chord(c); });
    }
    document.addEventListener('pointerup', function () { if (state === 'play' && !win.closed) drawFace(faceCanvas, 'smile'); });

    faceBtn.addEventListener('click', reset);

    function setLevel(l) { level = l; U.store.set('w98.mines.level', l); reset(); }

    Menu.bar(win, [
      { label: '&Game', items: function () {
        return [
          { label: '&New', shortcut: 'F2', action: reset },
          '-',
          { label: '&Beginner', checked: level === 'beginner', action: function () { setLevel('beginner'); } },
          { label: '&Intermediate', checked: level === 'intermediate', action: function () { setLevel('intermediate'); } },
          { label: '&Expert', checked: level === 'expert', action: function () { setLevel('expert'); } },
          '-',
          { label: '&Marks (?)', checked: marks, action: function () { marks = !marks; U.store.set('w98.mines.marks', marks); } },
          '-',
          { label: 'Best &Times...', action: function () {
            var b = U.store.get('w98.mines.best', {});
            var row = function (k, n) { return n + ':  ' + (b[k] ? b[k].t + ' seconds   ' + b[k].name : '999 seconds   Anonymous'); };
            WM.msgbox({ title: 'Fastest Mine Sweepers', owner: win, icon: null, sound: null, text: row('beginner', 'Beginner') + '\n' + row('intermediate', 'Intermediate') + '\n' + row('expert', 'Expert') });
          } },
          '-',
          { label: 'E&xit', action: function () { win.close(); } }
        ];
      } },
      { label: '&Help', items: [{ label: '&About Minesweeper...', action: function () { Shell.launch('about', { name: 'Minesweeper', icon: 'minesweeper' }); } }] }
    ]);
    win.onKey = function (e) { if (e.key === 'F2') { reset(); return true; } return false; };

    reset();
    win.center();
    return win;
  }

  Shell.register('minesweeper', { name: 'Minesweeper', icon: 'minesweeper', single: true, launch: launch });
})();
