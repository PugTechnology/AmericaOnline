/*
 * The late-90s web, served by the Internet Archive's Wayback Machine.
 * Pages load in an iframe using the `if_` modifier (no Wayback toolbar, links
 * rewritten to archived copies). The sandbox leaves out allow-top-navigation so
 * old frame-busting scripts can't take over the page.
 */
(function () {
  var h = U.h;

  // Hand-picked captures that look great. Anything else uses the chosen year.
  var SITES = {
    'yahoo.com': '19981202', 'excite.com': '19981202', 'lycos.com': '19981202', 'altavista.com': '19990117',
    'altavista.digital.com': '19980112', 'infoseek.com': '19981202', 'go.com': '19990508', 'dogpile.com': '19990125',
    'askjeeves.com': '19990125', 'ask.com': '20000301', 'google.com': '19990125', 'geocities.com': '19981202', 'angelfire.com': '19990125',
    'tripod.com': '19981202', 'cnn.com': '19981202', 'espn.go.com': '19990125', 'espn.sportszone.com': '19980603', 'mtv.com': '19981202',
    'amazon.com': '19990125', 'ebay.com': '19990125', 'microsoft.com': '19981202', 'home.microsoft.com': '19981202',
    'windowsupdate.microsoft.com': '19990125', 'apple.com': '19981202', 'netscape.com': '19981202', 'home.netscape.com': '19981202',
    'hotmail.com': '19990125', 'napster.com': '20000301', 'neopets.com': '20000301', 'homestarrunner.com': '20000815',
    'nintendo.com': '19981202', 'ign.com': '19990125', 'slashdot.org': '19981202', 'somethingawful.com': '20000301',
    'weather.com': '19981202', 'mapquest.com': '19981202', 'bluemountain.com': '19981202', 'drudgereport.com': '19990125',
    'aol.com': '19981202', 'zombo.com': '19991013', 'nick.com': '19990125', 'cartoonnetwork.com': '19990125', 'disney.com': '19990125',
    'pets.com': '20000301', 'expedia.com': '19990125', 'travelocity.com': '19990125', 'imdb.com': '19990125', 'eonline.com': '19990125',
    'gamespot.com': '19990125', 'cnet.com': '19990125', 'download.com': '19990125', 'zdnet.com': '19990125', 'tucows.com': '19990125',
    'webmd.com': '20000301', 'drkoop.com': '19991013', 'msnbc.com': '19990125', 'abcnews.go.com': '19990125', 'nfl.com': '19990125',
    'nba.com': '19990125', 'fool.com': '19990125', 'britannica.com': '20000301', 'shockwave.com': '19991013', 'real.com': '19990125',
    'winamp.com': '19990125', 'icq.com': '19990125', 'myspace.com': '19990125', 'toysrus.com': '19990125', 'barnesandnoble.com': '19990125',
    'digitalcity.com': '19990125', 'people.com': '19990125', 'time.com': '19990125', 'usatoday.com': '19990125', 'nytimes.com': '19990125',
    'starwars.com': '19990508', 'thesims.com': '20000301', 'blizzard.com': '19990125', 'idsoftware.com': '19990125', 'sega.com': '19991013',
    'www2.warnerbros.com': '19970101', 'whitehouse.gov': '19990125', 'nasa.gov': '19981202', 'msn.com': '19990125', 'dictionary.com': '19990125'
  };

  var Web = {
    year: function () { return U.store.get('w98.webyear', 1999); },
    setYear: function (y) { U.store.set('w98.webyear', y); },

    normalize: function (input) {
      var s = String(input || '').trim();
      if (!s) return '';
      if (/^https?:\/\/web\.archive\.org\//i.test(s)) return s;
      if (!/^[a-z]+:\/\//i.test(s)) s = 'http://' + s;
      try {
        var u = new URL(s);
        if (u.pathname === '') u.pathname = '/';
        return u.href.replace(/^https:/, 'http:');
      } catch (e) { return ''; }
    },

    host: function (url) {
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
    },

    // Curated capture by default; once someone picks a year with Time Travel, that year wins.
    timestampFor: function (url) {
      var full = '';
      try { full = new URL(url).hostname; } catch (e) { /* ignore */ }
      var pick = SITES[full] || SITES[Web.host(url)];
      var chosen = U.store.get('w98.webyear', null);
      if (!chosen) return pick || '19990615';
      chosen = String(chosen);
      if (pick && pick.slice(0, 4) === chosen) return pick;
      return chosen + '0615';
    },

    wayback: function (url, ts) {
      url = Web.normalize(url);
      if (!url) return '';
      if (/^https?:\/\/web\.archive\.org\//i.test(url)) return url;
      return 'https://web.archive.org/web/' + (ts || Web.timestampFor(url)) + 'if_/' + url;
    },

    // A browser pane: { el, go(url), back(), forward(), reload(), stop(), url, onchange }
    pane: function (opts) {
      opts = opts || {};
      var holder = h('div', { className: 'web-pane-holder' });
      var loading = h('div', { className: 'web-loading hidden' }, [h('div', { className: 'web-loading-box' }, [
        U.img(opts.icon || 'ie', 32), h('div', { className: 'web-loading-text' }, 'Connecting to site...'),
        h('div', { className: 'progress' })
      ])]);
      holder.appendChild(loading);
      var frame = null, history = [], index = -1, loadTimer = null, progressTimer = null;
      var pane = { el: holder, url: '', title: '', onchange: null, loading: false };

      function progress() {
        var bar = loading.querySelector('.progress');
        bar.innerHTML = '';
        var n = 0;
        clearInterval(progressTimer);
        progressTimer = setInterval(function () {
          if (n < 22) { bar.appendChild(h('div', { className: 'chunk' })); n++; }
        }, 350);
      }

      function load(entry) {
        var url = entry.url;
        var target = Web.wayback(url, entry.ts);
        if (!target) return;
        pane.url = Web.normalize(url);
        pane.title = Web.host(pane.url) || pane.url;
        pane.loading = true;
        if (frame) frame.remove();
        // A fresh iframe per navigation keeps the browser's own history clean.
        frame = h('iframe', {
          className: 'web-frame', src: target, title: 'Web page',
          sandbox: 'allow-scripts allow-forms allow-same-origin', referrerpolicy: 'no-referrer'
        });
        loading.classList.remove('hidden');
        loading.querySelector('.web-loading-text').textContent = 'Connecting to ' + (Web.host(pane.url) || 'site') + '...';
        progress();
        frame.addEventListener('load', function () {
          pane.loading = false;
          loading.classList.add('hidden');
          clearInterval(progressTimer);
          clearTimeout(loadTimer);
          if (pane.onchange) pane.onchange('loaded');
        });
        clearTimeout(loadTimer);
        loadTimer = setTimeout(function () {
          loading.querySelector('.web-loading-text').textContent = 'The site is taking a long time to respond...';
        }, 15000);
        holder.appendChild(frame);
        if (pane.onchange) pane.onchange('loading');
      }

      // `ts` optionally pins a Wayback timestamp (e.g. '19980909').
      pane.go = function (url, ts) {
        url = Web.normalize(url);
        if (!url) return;
        history = history.slice(0, index + 1);
        history.push({ url: url, ts: ts });
        index = history.length - 1;
        load(history[index]);
      };
      pane.back = function () { if (index > 0) { index--; load(history[index]); } };
      pane.forward = function () { if (index < history.length - 1) { index++; load(history[index]); } };
      pane.reload = function () { if (history[index]) load(history[index]); };
      pane.stop = function () {
        pane.loading = false;
        loading.classList.add('hidden');
        clearInterval(progressTimer);
        if (frame) try { frame.contentWindow.stop(); } catch (e) { /* cross-origin */ }
        if (pane.onchange) pane.onchange('stopped');
      };
      pane.canBack = function () { return index > 0; };
      pane.canForward = function () { return index < history.length - 1; };
      pane.destroy = function () { clearInterval(progressTimer); clearTimeout(loadTimer); if (frame) frame.src = 'about:blank'; };
      return pane;
    }
  };

  window.Web = Web;
})();
