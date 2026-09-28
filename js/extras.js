/*
 * Small Start-menu stubs: Programs > StartUp and Favorites > Channels.
 * shell.js asks for these lazily (Shell.startupItems / Shell.channelItems).
 */
(function () {
  function note(title, icon, text) {
    return function () { WM.msgbox({ title: title, icon: icon, text: text }); };
  }

  // The Internet Explorer 4 "Channel bar" line-up. They open the archived sites through IE.
  Shell.channelItems = function () {
    return [
      { label: 'MSNBC', icon: 'aol-channels', action: function () { Shell.launch('ie', 'www.msnbc.com'); } },
      { label: 'Disney.com', icon: 'aol-channels', action: function () { Shell.launch('ie', 'www.disney.com'); } },
      { label: 'Warner Bros.', icon: 'aol-channels', action: function () { Shell.launch('ie', 'www2.warnerbros.com'); } },
      { label: 'PointCast Network', icon: 'aol-channels', action: function () { Shell.launch('ie', 'www.pointcast.com'); } },
      '-',
      { label: 'Channel Guide', icon: 'ie', action: function () { Shell.launch('ie', 'www.microsoft.com/ie'); } }
    ];
  };

  // What a 1998 Compaq loaded at start-up.
  Shell.startupItems = function () {
    return [
      { label: 'Welcome to Windows 98', icon: 'windows-flag', action: function () { Shell.launch('welcome'); } },
      { label: 'Compaq Connections', icon: 'help', action: note('Compaq Connections', 'info', 'Welcome to Compaq Connections.\n\nRegister your Presario today and receive absolutely nothing in the mail.') },
      { label: 'Microsoft Office Shortcut Bar', icon: 'programs', action: note('Microsoft Office Shortcut Bar', 'error', 'Cannot find the file \'C:\\Program Files\\Microsoft Office\\Office\\OSA.EXE\' (or one of its components).\n\nThe trial version of Microsoft Office expired long ago.') },
      { label: 'Norton AntiVirus Auto-Protect', icon: 'warning', action: note('Norton AntiVirus', 'warning', 'Your virus definitions were last updated on 6/25/1998.\n\nUse LiveUpdate to download the latest definitions. (Please do not use LiveUpdate. It is a 56K modem.)') }
    ];
  };
})();
