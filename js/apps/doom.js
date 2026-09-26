/* DOOM: the Chocolate Doom WebAssembly build running the shareware episode, in a window. */
(function () {
  var h = U.h;

  function launch() {
    var frame = h('iframe', { className: 'doom-frame', src: 'apps/doom/index.html', title: 'DOOM', allow: 'autoplay; fullscreen; pointer-lock' });
    var win = WM.open({
      app: 'doom', title: 'DOOM', icon: 'doom', width: 668, height: 530, minWidth: 330, minHeight: 280,
      content: frame, className: 'doom', shield: true
    });
    U.sound('hddSeek', 2500);
    function focusGame() {
      setTimeout(function () {
        try { frame.focus(); frame.contentWindow.focus(); var c = frame.contentDocument && frame.contentDocument.getElementById('canvas'); if (c) c.focus(); }
        catch (e) { /* not ready yet */ }
      }, 0);
    }
    frame.addEventListener('load', focusGame);
    win.on('focus', focusGame);
    // Removing the frame on close stops the game and its audio.
    win.on('close', function () { frame.src = 'about:blank'; });
    Menu.bar(win, [
      { label: '&Game', items: [
        { label: '&Restart DOOM', action: function () { frame.src = 'apps/doom/index.html'; } },
        { label: '&Full Screen', action: function () {
          var el = frame;
          (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
          focusGame();
        } },
        '-',
        { label: '&Read Me', action: function () { Shell.open('C:\\DOOM\\README.TXT'); } },
        '-',
        { label: 'E&xit', action: function () { win.close(); } }
      ] }
    ]);
    return win;
  }

  Shell.register('doom', { name: 'DOOM', icon: 'doom', single: true, launch: launch });
})();
