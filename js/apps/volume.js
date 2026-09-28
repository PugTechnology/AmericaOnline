/*
 * Volume: the tray speaker's slider popup (click) and the Volume Control
 * window (double-click). Both drive Sound's master volume and mute switch.
 */
(function () {
  var h = U.h;
  var popup = null;

  function pct() { return Math.round((window.Sound ? Sound.volume : 1) * 100); }

  function closePopup() {
    if (!popup) return;
    popup.el.remove();
    document.removeEventListener('pointerdown', popup.away, true);
    document.removeEventListener('keydown', popup.esc, true);
    popup = null;
  }

  // The little "Volume" panel above the speaker: a vertical slider and a Mute checkbox.
  function showPopup(anchor) {
    if (popup) { closePopup(); return; }
    var slider = h('input', { type: 'range', className: 'vol-slider', min: 0, max: 100, value: pct(), orient: 'vertical' });
    var mute = h('input', { type: 'checkbox', checked: !!Sound.muted });
    var el = h('div', { className: 'vol-popup' }, [
      h('div', { className: 'vol-title' }, 'Volume'),
      slider,
      h('label', { className: 'check' }, [mute, U.label('&Mute')])
    ]);
    slider.addEventListener('input', function () { Sound.setVolume(slider.value / 100); });
    slider.addEventListener('change', function () { U.sound('ding'); });
    mute.addEventListener('change', function () { Sound.setMuted(mute.checked); Shell.updateMuteIcon(); });
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
    el.style.left = Math.max(0, Math.min(window.innerWidth - w - 2, r.left + r.width / 2 - w / 2)) + 'px';
    el.style.top = Math.max(0, r.top - hh - 4) + 'px';
    popup = {
      el: el,
      away: function (e) { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopup(); },
      esc: function (e) { if (e.key === 'Escape') closePopup(); }
    };
    document.addEventListener('pointerdown', popup.away, true);
    document.addEventListener('keydown', popup.esc, true);
  }

  // The full Volume Control window.
  function launch() {
    var slider = h('input', { type: 'range', className: 'vol-slider', min: 0, max: 100, value: pct(), orient: 'vertical' });
    var mute = h('input', { type: 'checkbox', checked: !!Sound.muted });
    slider.addEventListener('input', function () { Sound.setVolume(slider.value / 100); });
    slider.addEventListener('change', function () { U.sound('ding'); });
    mute.addEventListener('change', function () { Sound.setMuted(mute.checked); Shell.updateMuteIcon(); });
    var win = WM.open({
      app: 'volume', title: 'Volume Control', icon: 'volume', width: 'auto', height: 'auto', resizable: false, maximizable: false,
      content: h('div', { className: 'vol-window' }, [
        h('div', { className: 'vol-col' }, [h('div', { className: 'vol-title' }, 'Volume Control'), slider, h('label', { className: 'check' }, [mute, U.label('&Mute all')])])
      ])
    });
    win.on('focus', function () { slider.value = pct(); mute.checked = !!Sound.muted; });
    return win;
  }

  Shell.showVolume = function (anchor, control) {
    if (control) { closePopup(); Shell.launch('volume'); return; }
    showPopup(anchor);
  };
  Shell.register('volume', { name: 'Volume Control', icon: 'volume', launch: launch, single: true });
})();
