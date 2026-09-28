/*
 * Calculator, Windows 98 edition. Standard mode is a plain left-to-right adding
 * machine (2+3*4= is 20); Scientific mode obeys operator precedence and adds
 * radix conversion, trig, powers and logic operators.
 */
(function () {
  var h = U.h;

  // Binary operators, with their precedence in Scientific mode.
  var PREC = { 'Or': 1, 'Xor': 1, 'And': 2, '+': 3, '-': 3, '*': 4, '/': 4, 'Mod': 4, '^': 5, 'root': 5 };
  var SHOWN = { '/': '/', '*': '*', '+': '+', '-': '-' };
  var DIV0 = 'Cannot divide by zero.';
  var INVALID = 'Invalid input for function.';

  function launch() {
    var view = U.store.get('w98.calc.view', 'standard');
    // Engine state. `vals` and `ops` hold the pending expression.
    var vals = [], ops = [];
    var entry = '0';        // digits being typed (or the last result), in the current radix
    var fresh = true;       // the next digit starts a new number
    var opJust = false;     // an operator was the last thing pressed
    var lastOp = null, lastOperand = 0;   // for repeated =
    var mem = 0, err = null;
    var radix = 10, angle = 'deg', inv = false;

    var display = h('div', { className: 'calc-display' }, '0');
    var memBox = h('div', { className: 'calc-mem' });
    var body = h('div', { className: 'calc' });
    var win = WM.open({
      app: 'calc', title: 'Calculator', icon: 'calc', width: 'auto', height: 'auto',
      resizable: false, maximizable: false, content: body, className: 'calc-window'
    });

    // ---- numbers ---------------------------------------------------------
    function val() {
      var n = radix === 10 ? parseFloat(entry) : parseInt(entry, radix);
      return isNaN(n) ? 0 : n;
    }
    function fmt(n) {
      if (radix !== 10) return Math.trunc(n).toString(radix).toUpperCase();
      if (Math.abs(n) < 1e-15) n = 0;
      var s = String(parseFloat(n.toPrecision(14)));
      return s;
    }
    function show() {
      var t = err || entry;
      display.textContent = t;
      memBox.textContent = mem !== 0 ? 'M' : '';
    }
    function setResult(n) {
      if (!isFinite(n) || isNaN(n)) { fail(INVALID); return; }
      entry = fmt(n); fresh = true; opJust = false;
      show();
    }
    function fail(msg) { err = msg; vals = []; ops = []; opJust = false; fresh = true; show(); }

    function apply(a, op, b) {
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': if (b === 0) throw new Error(DIV0); return a / b;
        case 'Mod': if (b === 0) throw new Error(DIV0); return a % b;
        case '^': return Math.pow(a, b);
        case 'root': return Math.pow(a, 1 / b);
        case 'And': return Math.trunc(a) & Math.trunc(b);
        case 'Or': return Math.trunc(a) | Math.trunc(b);
        case 'Xor': return Math.trunc(a) ^ Math.trunc(b);
      }
      return b;
    }
    function prec(op) { return view === 'scientific' ? PREC[op] : 1; }
    function reduce(minPrec) {
      while (ops.length && prec(ops[ops.length - 1]) >= minPrec) {
        var b = vals.pop(), a = vals.pop();
        vals.push(apply(a, ops.pop(), b));
      }
    }

    // ---- key actions -----------------------------------------------------
    function digit(d) {
      if (err) return;
      var v = parseInt(d, 16);
      if (v >= radix) return;
      if (fresh) { entry = '0'; fresh = false; }
      opJust = false;
      if (entry.replace(/[-.]/g, '').length >= 20) return;
      entry = entry === '0' ? d : entry === '-0' ? '-' + d : entry + d;
      show();
    }
    function point() {
      if (err || radix !== 10) return;
      if (fresh) { entry = '0'; fresh = false; }
      opJust = false;
      if (entry.indexOf('.') === -1) entry += '.';
      show();
    }
    function binary(op) {
      if (err) return;
      if (opJust && ops.length) { ops[ops.length - 1] = op; return; }
      try {
        vals.push(val());
        reduce(op === '^' || op === 'root' ? PREC[op] + 1 : prec(op));
      } catch (e) { fail(e.message === DIV0 ? DIV0 : INVALID); return; }
      ops.push(op);
      entry = fmt(vals[vals.length - 1]);
      fresh = true; opJust = true;
      show();
    }
    function equals() {
      if (err) return;
      try {
        if (ops.length) {
          lastOp = ops[ops.length - 1];
          lastOperand = val();
          vals.push(lastOperand);
          reduce(0);
          var r = vals.pop();
          vals = []; ops = [];
          setResult(r);
        } else if (lastOp) {
          setResult(apply(val(), lastOp, lastOperand));
        }
      } catch (e) { fail(e.message === DIV0 ? DIV0 : INVALID); }
    }
    function unary(fn) {
      if (err) return;
      try { setResult(fn(val())); } catch (e) { fail(e.message === DIV0 ? DIV0 : INVALID); }
    }
    function clearEntry() { if (err) { clearAll(); return; } entry = '0'; fresh = false; opJust = false; show(); }
    function clearAll() { vals = []; ops = []; entry = '0'; fresh = true; opJust = false; err = null; lastOp = null; show(); }
    function back() {
      if (err || fresh) return;
      entry = entry.length <= 1 || (entry.length === 2 && entry.charAt(0) === '-') ? '0' : entry.slice(0, -1);
      show();
    }
    function negate() {
      if (err) return;
      if (val() === 0 && entry.indexOf('.') === -1) return;
      if (fresh) { setResult(-val()); return; }
      entry = entry.charAt(0) === '-' ? entry.slice(1) : '-' + entry;
      show();
    }
    function memory(k) {
      if (err) return;
      if (k === 'MC') mem = 0;
      else if (k === 'MR') { entry = fmt(mem); fresh = true; opJust = false; }
      else if (k === 'MS') { mem = val(); fresh = true; }
      else if (k === 'M+') { mem += val(); fresh = true; }
      show();
    }
    function percent() {
      if (err) return;
      // "50 + 10 %" is 5: a percentage of the value already entered.
      if (vals.length) setResult(vals[vals.length - 1] * val() / 100);
      else setResult(0);
    }

    // Trig helpers honouring the Deg/Rad/Grad setting.
    function toRad(x) { return angle === 'deg' ? x * Math.PI / 180 : angle === 'grad' ? x * Math.PI / 200 : x; }
    function fromRad(x) { return angle === 'deg' ? x * 180 / Math.PI : angle === 'grad' ? x * 200 / Math.PI : x; }
    function fact(n) {
      if (n < 0 || n !== Math.floor(n) || n > 170) throw new Error(INVALID);
      var r = 1;
      for (var i = 2; i <= n; i++) r *= i;
      return r;
    }
    function trig(f, fi) {
      return function (x) {
        if (!inv) {
          var t = f(toRad(x));
          // sin(180) and friends: snap floating noise to zero.
          return Math.abs(t) < 1e-14 ? 0 : t;
        }
        return fromRad(fi(x));
      };
    }

    function setRadix(r) {
      if (err) return;
      var n = val();
      radix = r;
      entry = fmt(n); fresh = true;
      renderKeys();
      show();
    }

    // ---- copy / paste ----------------------------------------------------
    function copy() {
      var t = display.textContent;
      function fallback() {
        var ta = h('textarea', { style: { position: 'fixed', left: '-999px', top: '0' } }, t);
        document.body.appendChild(ta);
        try { ta.select(); document.execCommand('copy'); } catch (e) { /* no clipboard: nothing to do */ }
        ta.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(fallback);
      else fallback();
    }
    function paste() {
      function take(t) {
        t = String(t == null ? '' : t).trim().replace(/,/g, '');
        var ok = radix === 10 ? /^-?\d*\.?\d+(e[+-]?\d+)?$|^-?\d+\.$/i.test(t) : /^-?[0-9a-f]+$/i.test(t) && !isNaN(parseInt(t, radix));
        if (!ok) return;
        err = null; opJust = false; fresh = false;
        entry = radix === 10 ? String(parseFloat(t)) : t.toUpperCase();
        show();
      }
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(take, function () { /* permission denied */ });
    }

    // ---- building the keypad ---------------------------------------------
    var keyEls = {};
    function key(label, cls, fn, id) {
      var b = h('button', { className: 'calc-key ' + (cls || ''), tabindex: '-1' }, label);
      // Keep focus off the keys so Enter still means "=".
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); win.focus(); });
      b.addEventListener('click', function () { if (!b.disabled) fn(); });
      if (id) keyEls[id] = b;
      return b;
    }
    function radio(name, value, text, checked, on) {
      var r = h('input', { type: 'radio', name: name + win.id, tabindex: '-1', checked: checked });
      r.addEventListener('change', function () { on(value); });
      return h('label', { className: 'calc-radio' }, [r, U.label(text)]);
    }

    function renderKeys() {
      body.innerHTML = '';
      win.el.style.width = 'max-content';
      win.el.style.height = 'auto';
      keyEls = {};
      var sci = view === 'scientific';
      var top = h('div', { className: 'calc-top' }, [memBox, h('div', { className: 'calc-edit' }, [
        key('Backspace', 'red wide', back), key('CE', 'red wide', clearEntry), key('C', 'red wide', clearAll)
      ])]);
      var std = h('div', { className: 'calc-grid std' }, [
        key('MC', 'red', function () { memory('MC'); }), key('7', 'blue', function () { digit('7'); }, '7'), key('8', 'blue', function () { digit('8'); }, '8'), key('9', 'blue', function () { digit('9'); }, '9'),
        key('/', 'red', function () { binary('/'); }), key('sqrt', 'blue', function () { unary(function (x) { if (x < 0) throw new Error(INVALID); return Math.sqrt(x); }); }),
        key('MR', 'red', function () { memory('MR'); }), key('4', 'blue', function () { digit('4'); }, '4'), key('5', 'blue', function () { digit('5'); }, '5'), key('6', 'blue', function () { digit('6'); }, '6'),
        key('*', 'red', function () { binary('*'); }), key('%', 'blue', percent),
        key('MS', 'red', function () { memory('MS'); }), key('1', 'blue', function () { digit('1'); }, '1'), key('2', 'blue', function () { digit('2'); }, '2'), key('3', 'blue', function () { digit('3'); }, '3'),
        key('-', 'red', function () { binary('-'); }), key('1/x', 'blue', function () { unary(function (x) { if (x === 0) throw new Error(DIV0); return 1 / x; }); }),
        key('M+', 'red', function () { memory('M+'); }), key('0', 'blue', function () { digit('0'); }, '0'), key('+/-', 'blue', negate), key('.', 'blue', point),
        key('+', 'red', function () { binary('+'); }), key('=', 'red', equals)
      ]);
      if (!sci) {
        body.appendChild(h('div', { className: 'calc-main' }, [display, top, std]));
        return;
      }
      var sciKeys = h('div', { className: 'calc-grid sci' }, [
        key('sin', 'red', function () { unary(trig(Math.sin, Math.asin)); }), key('cos', 'red', function () { unary(trig(Math.cos, Math.acos)); }), key('tan', 'red', function () { unary(trig(Math.tan, Math.atan)); }),
        key('ln', 'red', function () { unary(function (x) { if (x <= 0 && !inv) throw new Error(INVALID); return inv ? Math.exp(x) : Math.log(x); }); }),
        key('log', 'red', function () { unary(function (x) { if (x <= 0 && !inv) throw new Error(INVALID); return inv ? Math.pow(10, x) : Math.log(x) / Math.LN10; }); }),
        key('n!', 'red', function () { unary(fact); }),
        key('x^2', 'red', function () { unary(function (x) { return inv ? Math.sqrt(x) : x * x; }); }),
        key('x^3', 'red', function () { unary(function (x) { return inv ? Math.cbrt(x) : x * x * x; }); }),
        key('x^y', 'red', function () { binary(inv ? 'root' : '^'); }),
        key('Int', 'red', function () { unary(Math.trunc); }),
        key('Not', 'red', function () { unary(function (x) { return ~Math.trunc(x); }); }),
        key('Mod', 'red', function () { binary('Mod'); }),
        key('And', 'red', function () { binary('And'); }), key('Or', 'red', function () { binary('Or'); }), key('Xor', 'red', function () { binary('Xor'); }),
        key('pi', 'blue', function () { if (err) return; setResult(inv ? 2 * Math.PI : Math.PI); })
      ]);
      var hexRow = h('div', { className: 'calc-hex' }, ['A', 'B', 'C', 'D', 'E', 'F'].map(function (c) {
        return key(c, 'blue', function () { digit(c); }, c);
      }));
      var invBox = h('input', { type: 'checkbox', tabindex: '-1', checked: inv });
      invBox.addEventListener('change', function () { inv = invBox.checked; });
      var opts = h('div', { className: 'calc-opts' }, [
        h('fieldset', { className: 'group calc-radix' }, [
          radio('rx', 16, '&Hex', radix === 16, setRadix), radio('rx', 10, '&Dec', radix === 10, setRadix),
          radio('rx', 8, '&Oct', radix === 8, setRadix), radio('rx', 2, '&Bin', radix === 2, setRadix)
        ]),
        h('fieldset', { className: 'group calc-angle' }, [
          radio('an', 'deg', 'De&grees', angle === 'deg', function (v) { angle = v; }),
          radio('an', 'rad', '&Radians', angle === 'rad', function (v) { angle = v; }),
          radio('an', 'grad', 'Gra&ds', angle === 'grad', function (v) { angle = v; })
        ]),
        h('label', { className: 'calc-radio' }, [invBox, U.label('&Inv')])
      ]);
      body.appendChild(h('div', { className: 'calc-main sci' }, [display, top,
        h('div', { className: 'calc-sci-row' }, [h('div', { className: 'calc-sci-left' }, [opts, sciKeys]),
          h('div', { className: 'calc-sci-right' }, [hexRow, std])])]));
      updateHex();
    }
    // Digits beyond the radix are greyed out, as on the real thing.
    function updateHex() {
      '0123456789ABCDEF'.split('').forEach(function (d) {
        if (keyEls[d]) keyEls[d].disabled = parseInt(d, 16) >= radix;
      });
    }

    function setView(v) {
      if (v === view) return;
      view = v;
      U.store.set('w98.calc.view', v);
      if (v === 'standard') { radix = 10; entry = fmt(val()); fresh = true; }
      vals = []; ops = []; opJust = false;
      renderKeys(); show();
    }

    Menu.bar(win, [
      { label: '&Edit', items: [
        { label: '&Copy', shortcut: 'Ctrl+C', action: copy },
        { label: '&Paste', shortcut: 'Ctrl+V', action: paste }
      ] },
      { label: '&View', items: function () {
        return [
          { label: '&Standard', checked: view === 'standard', action: function () { setView('standard'); } },
          { label: 'S&cientific', checked: view === 'scientific', action: function () { setView('scientific'); } }
        ];
      } },
      { label: '&Help', items: [
        { label: '&Help Topics', action: function () { Shell.launch('help', 'calc'); } },
        '-',
        { label: '&About Calculator', action: function () { Shell.launch('about', { name: 'Calculator', icon: 'calc' }); } }
      ] }
    ]);

    // ---- keyboard --------------------------------------------------------
    win.onKey = function (e) {
      if (win.modalChild) return false;
      var k = e.key;
      if (e.ctrlKey && !e.altKey) {
        if (k === 'c' || k === 'C') { copy(); return true; }
        if (k === 'v' || k === 'V') { paste(); return true; }
        return false;
      }
      if (e.altKey) return false;
      if (/^[0-9]$/.test(k)) { digit(k); return true; }
      if (radix === 16 && /^[a-fA-F]$/.test(k)) { digit(k.toUpperCase()); return true; }
      if (k === '.' || k === ',') { point(); return true; }
      if (SHOWN[k]) { binary(k); return true; }
      if (k === '=' || k === 'Enter') { equals(); return true; }
      if (k === 'Backspace') { back(); return true; }
      if (k === 'Escape') { clearAll(); return true; }
      if (k === 'Delete') { clearEntry(); return true; }
      if (k === '%') { percent(); return true; }
      if (k === '@') { unary(function (x) { if (x < 0) throw new Error(INVALID); return Math.sqrt(x); }); return true; }
      if (k === 'r' || k === 'R') { unary(function (x) { if (x === 0) throw new Error(DIV0); return 1 / x; }); return true; }
      if (k === 'F9') { negate(); return true; }
      return false;
    };

    renderKeys();
    show();
    return win;
  }

  Shell.register('calc', { name: 'Calculator', icon: 'calc', launch: launch });
})();
