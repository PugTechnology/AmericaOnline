/* Small DOM helpers shared by every module. */
(function () {
  var U = {};

  // h('div', { className: 'x', onclick: fn, style: {...} }, [children | 'text'])
  U.h = function (tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') {
          for (var sk in v) {
            if (sk.slice(0, 2) === '--') el.style.setProperty(sk, v[sk]);
            else el.style[sk] = v[sk];
          }
        }
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'className' || k === 'textContent' || k === 'innerHTML' || k === 'value' || k === 'htmlFor') el[k] = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    U.append(el, children);
    return el;
  };

  U.append = function (el, children) {
    if (children == null) return el;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  };

  U.icon = function (name, size) {
    try { if (window.Icons) return Icons.get(name, size || 32); } catch (e) { /* fall through */ }
    return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  };

  U.img = function (name, size, attrs) {
    return U.h('img', Object.assign({ src: U.icon(name, size), width: size || 32, height: size || 32, alt: '', draggable: 'false' }, attrs || {}));
  };

  // "&File" -> File with the F underlined (Windows accelerator notation).
  // One wrapper span, so flex containers treat the label as a single item.
  U.label = function (text) {
    var el = document.createElement('span');
    var i = text.indexOf('&');
    if (i === -1) { el.textContent = text; return el; }
    el.appendChild(document.createTextNode(text.slice(0, i)));
    el.appendChild(U.h('span', { className: 'u' }, text.charAt(i + 1)));
    el.appendChild(document.createTextNode(text.slice(i + 2)));
    return el;
  };
  U.plain = function (text) { return String(text).replace('&', ''); };
  U.accel = function (text) { var i = text.indexOf('&'); return i === -1 ? '' : text.charAt(i + 1).toLowerCase(); };

  U.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  U.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  U.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  // Double-click that also works as double-tap on touch screens. Taps are matched on
  // the bound element (the target can change as selection styling appears), and the
  // browser's own synthetic dblclick after a double-tap is ignored.
  U.onActivate = function (el, fn) {
    var lastTap = 0, touchFired = 0;
    el.addEventListener('dblclick', function (e) {
      if (Date.now() - touchFired < 600) return;
      fn(e);
    });
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch') return;
      var t = Date.now();
      if (t - lastTap < 400) { lastTap = 0; touchFired = t; fn(e); }
      else lastTap = t;
    });
  };

  U.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  U.formatDate = function (ms) {
    var d = new Date(ms);
    var h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(-2) + ' ' + h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap;
  };

  U.sound = function (name) {
    try { if (window.Sound && Sound[name]) return Sound[name].apply(Sound, [].slice.call(arguments, 1)); } catch (e) { /* ignore */ }
    return Promise.resolve();
  };

  window.U = U;
})();
