/*
 * America Online content: keywords, channels, headlines, starter mail, buddies, chat scripts.
 * Keyword targets:
 *   'area:<id>'  an AOL window (mail, buddy, chat, quotes, weather, horoscopes...)
 *   'channel:<id>'
 *   'web:<url>'  a page from the late-90s web (via the Wayback Machine)
 *   'msg:<text>' a simple AOL dialog
 */
(function () {
  var CHANNELS = [
    { id: 'welcome', name: 'Welcome', color: '#1d4fa3', area: 'area:welcome' },
    { id: 'news', name: "Today's News", color: '#b01e23', tagline: 'Up-to-the-minute news, around the clock.', links: [
      ['CNN Interactive', 'web:www.cnn.com'], ['MSNBC', 'web:www.msnbc.com'], ['ABCNEWS.com', 'web:abcnews.go.com'], ['USA TODAY', 'web:www.usatoday.com'],
      ['The New York Times', 'web:www.nytimes.com'], ['TIME', 'web:www.time.com'], ['Drudge Report', 'web:www.drudgereport.com'], ['Weather', 'area:weather']
    ] },
    { id: 'finance', name: 'Personal Finance', color: '#1b7a3a', tagline: 'Your money, your way.', links: [
      ['Quotes & Portfolios', 'area:quotes'], ['The Motley Fool', 'web:www.fool.com'], ['Yahoo! Finance', 'web:quote.yahoo.com'], ['CNNfn', 'web:cnnfn.com'],
      ['Y2K and Your Money', 'web:www.y2k.gov']
    ] },
    { id: 'computing', name: 'Computing', color: '#5a3d8a', tagline: 'Downloads, help and the latest in tech.', links: [
      ['Download.com', 'web:www.download.com'], ['CNET', 'web:www.cnet.com'], ['ZDNet', 'web:www.zdnet.com'], ['Tucows', 'web:www.tucows.com'],
      ['Microsoft', 'web:www.microsoft.com'], ['Apple', 'web:www.apple.com'], ['Slashdot', 'web:slashdot.org'], ['Winamp', 'web:www.winamp.com']
    ] },
    { id: 'travel', name: 'Travel', color: '#0f7f86', tagline: 'Plan it, book it, go.', links: [
      ['Expedia', 'web:www.expedia.com'], ['Travelocity', 'web:www.travelocity.com'], ['MapQuest', 'web:www.mapquest.com'], ['Weather', 'area:weather']
    ] },
    { id: 'research', name: 'Research & Learn', color: '#8a5a1d', tagline: 'Homework help, reference and more.', links: [
      ['Ask Jeeves', 'web:www.askjeeves.com'], ['Encyclopaedia Britannica', 'web:www.britannica.com'], ['Dictionary.com', 'web:www.dictionary.com'],
      ['NASA', 'web:www.nasa.gov'], ['The White House', 'web:www.whitehouse.gov']
    ] },
    { id: 'entertainment', name: 'Entertainment', color: '#c2185b', tagline: 'Movies, music, TV and the stars.', links: [
      ['MTV Online', 'web:www.mtv.com'], ['E! Online', 'web:www.eonline.com'], ['Internet Movie Database', 'web:www.imdb.com'],
      ['Star Wars: Episode I', 'web:www.starwars.com'], ['Space Jam', 'web:www2.warnerbros.com/spacejam/movie/jam.htm'], ['People', 'web:www.people.com'],
      ['Horoscopes', 'area:horoscopes'], ['Napster', 'web:www.napster.com']
    ] },
    { id: 'games', name: 'Games', color: '#d35400', tagline: 'Play, compete, cheat (codes).', links: [
      ['IGN', 'web:www.ign.com'], ['GameSpot', 'web:www.gamespot.com'], ['Nintendo', 'web:www.nintendo.com'], ['Blizzard (StarCraft)', 'web:www.blizzard.com'],
      ['id Software (DOOM)', 'web:www.idsoftware.com'], ['Shockwave.com', 'web:www.shockwave.com'], ['Neopets', 'web:www.neopets.com'], ['Sega Dreamcast', 'web:www.sega.com']
    ] },
    { id: 'international', name: 'International', color: '#2e6f9e', tagline: 'Your passport to the world.', links: [
      ['BBC News', 'web:news.bbc.co.uk'], ['CNN World', 'web:www.cnn.com/WORLD/'], ['Yahoo! World', 'web:www.yahoo.com']
    ] },
    { id: 'lifestyles', name: 'Lifestyles', color: '#7b1fa2', tagline: 'Communities for every interest.', links: [
      ['GeoCities', 'web:www.geocities.com'], ['Angelfire', 'web:www.angelfire.com'], ['Tripod', 'web:www.tripod.com'], ['Blue Mountain e-cards', 'web:www.bluemountain.com'],
      ['Horoscopes', 'area:horoscopes'], ['People Connection', 'area:chat']
    ] },
    { id: 'local', name: 'Local', color: '#0a6d4f', tagline: 'Digital City: your hometown online.', links: [
      ['Digital City', 'web:www.digitalcity.com'], ['MapQuest', 'web:www.mapquest.com'], ['Weather', 'area:weather'], ['Moviefone', 'web:www.moviefone.com']
    ] },
    { id: 'health', name: 'Health', color: '#00897b', tagline: 'Stay well, live well.', links: [
      ['drkoop.com', 'web:www.drkoop.com'], ['WebMD', 'web:www.webmd.com'], ['Ask Jeeves', 'web:www.askjeeves.com']
    ] },
    { id: 'kids', name: 'Kids Only', color: '#f4a300', tagline: 'Just for kids! No grown-ups allowed.', links: [
      ['Nick.com', 'web:www.nick.com'], ['Cartoon Network', 'web:www.cartoonnetwork.com'], ['Disney.com', 'web:www.disney.com'], ['Neopets', 'web:www.neopets.com'],
      ['Space Jam', 'web:www2.warnerbros.com/spacejam/movie/jam.htm'], ['Homestar Runner', 'web:www.homestarrunner.com'], ['Games', 'channel:games']
    ] },
    { id: 'sports', name: 'Sports', color: '#1565c0', tagline: 'Scores, stats and all the highlights.', links: [
      ['ESPN.com', 'web:espn.go.com'], ['CNN/SI', 'web:sportsillustrated.cnn.com'], ['NFL.com', 'web:www.nfl.com'], ['NBA.com', 'web:www.nba.com']
    ] },
    { id: 'influence', name: 'Influence', color: '#37474f', tagline: 'Culture, style and the people who shape them.', links: [
      ['TIME', 'web:www.time.com'], ['People', 'web:www.people.com'], ['The New York Times', 'web:www.nytimes.com']
    ] },
    { id: 'families', name: 'Families', color: '#6d4c41', tagline: 'Parenting, pets and home.', links: [
      ['Pets.com', 'web:www.pets.com'], ['Disney.com', 'web:www.disney.com'], ['Parental Controls', 'area:parental']
    ] },
    { id: 'shopping', name: 'Shopping', color: '#ad1457', tagline: 'Shop@AOL: guaranteed secure.', links: [
      ['Amazon.com', 'web:www.amazon.com'], ['eBay', 'web:www.ebay.com'], ['Pets.com', 'web:www.pets.com'], ['Toys R Us', 'web:www.toysrus.com'],
      ['barnesandnoble.com', 'web:www.barnesandnoble.com']
    ] },
    { id: 'workplace', name: 'Workplace', color: '#455a64', tagline: 'Get ahead at work.', links: [
      ['Monster.com', 'web:www.monster.com'], ['Microsoft', 'web:www.microsoft.com'], ['ZDNet', 'web:www.zdnet.com']
    ] }
  ];

  var K = {};
  function kw(names, target) { names.split('|').forEach(function (n) { K[n] = target; }); }

  // AOL areas
  kw('welcome|home|aol today', 'area:welcome');
  kw('channels|channel|guide', 'area:channels');
  kw('mail|mailbox|read|read mail|mail center|new mail|online mailbox', 'area:mailbox');
  kw('write|compose|write mail|compose mail', 'area:write');
  kw('buddy|buddy list|buddies|bl', 'area:buddy');
  kw('im|ims|instant message|instant messages', 'area:im');
  kw('chat|people connection|pc|town square|lobby|chat rooms|people', 'area:chat');
  kw('quotes|stocks|quote|portfolio|portfolios', 'area:quotes');
  kw('weather|forecast', 'area:weather');
  kw('horoscope|horoscopes|astrology|stars', 'area:horoscopes');
  kw('help|member services|aol help|keyword help', 'area:help');
  kw('keyword|keywords|keyword list|kw', 'area:keywordlist');
  kw('parental controls|parental control|parental|kids safety', 'area:parental');
  kw('profile|my profile|member profile', 'area:profile');
  kw('names|screen names|screen name', 'area:names');
  kw('perks|member perks', 'area:perks');
  kw('upgrade|aol 5.0|aol 5', 'msg:AOL 5.0 is available! Downloading it will take about 3 hours and 42 minutes at 28.8 Kbps. Maybe try again this weekend.');
  kw('password|passwords', 'msg:To change your password, you must be signed on as the primary screen name. (Also, please never tell anyone your password. AOL staff will NEVER ask for it.)');
  kw('billing|accounts|account', 'msg:Your current billing plan: Unlimited Access, $21.95/month.\n\nThank you for being a member!');
  kw('access|access numbers|access number', 'msg:Your access numbers:\n\n1-800-555-0142  (56K / V.90)\n1-800-555-0199  (33.6K)\n\nAlways check with your phone company that a number is local!');
  kw('cancel|cancel account', 'msg:We\'re sorry to see you go! To cancel, please call 1-800-555-0177 and hold for the next available representative. Estimated wait time: 4 hours.');
  kw('free|free hours|cd|cds|1000 hours', 'msg:Congratulations! Your 1,000 FREE HOURS are on the CD that just came in the mail. And the cereal box. And the magazine. And the frozen dinner.');
  kw('y2k|year 2000|millennium bug', 'web:www.y2k.gov');

  // AOL channels
  CHANNELS.forEach(function (c) { if (c.id !== 'welcome') { K[c.name.toLowerCase()] = 'channel:' + c.id; K[c.id] = 'channel:' + c.id; } });
  kw('news|top news|todays news|today\'s news', 'channel:news');
  kw('pf|money|finance', 'channel:finance');
  kw('computers|computer center|tech', 'channel:computing');
  kw('learn|reference|homework|homework help', 'channel:research');
  kw('movies|music|tv', 'channel:entertainment');
  kw('kids|kids only|ko', 'channel:kids');
  kw('shop|shop@aol', 'channel:shopping');
  kw('digital city', 'channel:local');

  // Brand keywords on the web
  var WEB = {
    'yahoo|yahoo!': 'www.yahoo.com', 'excite': 'www.excite.com', 'lycos': 'www.lycos.com', 'altavista|search the web|netfind': 'www.altavista.com',
    'infoseek|go.com': 'www.go.com', 'dogpile': 'www.dogpile.com', 'ask jeeves|jeeves|ask': 'www.askjeeves.com', 'google': 'www.google.com',
    'geocities|homepage|home page': 'www.geocities.com', 'angelfire': 'www.angelfire.com', 'tripod': 'www.tripod.com', 'cnn': 'www.cnn.com',
    'espn': 'espn.go.com', 'mtv': 'www.mtv.com', 'amazon|books': 'www.amazon.com', 'ebay|auctions|auction': 'www.ebay.com',
    'microsoft|msft|windows': 'www.microsoft.com', 'apple|mac|imac': 'www.apple.com', 'netscape': 'home.netscape.com',
    'space jam|spacejam': 'www2.warnerbros.com/spacejam/movie/jam.htm', 'hotmail': 'www.hotmail.com', 'napster|mp3|mp3s': 'www.napster.com',
    'neopets': 'www.neopets.com', 'homestar|homestar runner|strong bad': 'www.homestarrunner.com', 'nintendo|pokemon|n64': 'www.nintendo.com',
    'ign': 'www.ign.com', 'slashdot': 'slashdot.org', 'something awful': 'www.somethingawful.com', 'weather.com': 'www.weather.com',
    'mapquest|maps|directions': 'www.mapquest.com', 'blue mountain|cards|ecards|e-cards': 'www.bluemountain.com', 'drudge': 'www.drudgereport.com',
    'aol.com|www|web|internet|the web': 'www.aol.com', 'zombo|zombo.com': 'www.zombo.com', 'nick|nickelodeon': 'www.nick.com',
    'cartoon network|cartoons': 'www.cartoonnetwork.com', 'disney': 'www.disney.com', 'pets.com|pets': 'www.pets.com',
    'star wars|phantom menace|episode 1|episode i': 'www.starwars.com', 'time': 'www.time.com', 'people magazine': 'www.people.com',
    'moviefone': 'www.moviefone.com', 'imdb': 'www.imdb.com', 'gamespot': 'www.gamespot.com', 'cnet': 'www.cnet.com', 'download|download.com|downloads|download center|filesearch': 'www.download.com',
    'winamp': 'www.winamp.com', 'icq': 'www.icq.com', 'blizzard|starcraft|diablo': 'www.blizzard.com', 'doom|id software|quake': 'www.idsoftware.com',
    'nasa': 'www.nasa.gov', 'white house|whitehouse': 'www.whitehouse.gov', 'usa today': 'www.usatoday.com', 'msnbc': 'www.msnbc.com',
    'expedia': 'www.expedia.com', 'travelocity': 'www.travelocity.com', 'motley fool|fool': 'www.fool.com', 'dreamcast|sega': 'www.sega.com',
    'the sims|sims': 'www.thesims.com', 'monster|jobs|careers': 'www.monster.com', 'webmd': 'www.webmd.com', 'drkoop': 'www.drkoop.com',
    'britannica|encyclopedia': 'www.britannica.com', 'dictionary': 'www.dictionary.com', 'ebaumsworld|hampster dance|hamster dance': 'www.hampsterdance.com',
    'real|realplayer': 'www.real.com', 'shockwave': 'www.shockwave.com', 'toys r us|toys': 'www.toysrus.com', 'digitalcity': 'www.digitalcity.com'
  };
  Object.keys(WEB).forEach(function (names) { kw(names, 'web:' + WEB[names]); });

  // The Keyword List window (a curated selection, like the real one)
  var KEYWORD_LIST = [
    'ALTAVISTA', 'AMAZON', 'ASK JEEVES', 'BUDDY LIST', 'CHANNELS', 'CHAT', 'CNN', 'COMPUTING', 'DOOM', 'EBAY', 'ENTERTAINMENT', 'ESPN',
    'GAMES', 'GEOCITIES', 'HAMSTER DANCE', 'HELP', 'HOMESTAR', 'HOROSCOPES', 'IM', 'KIDS ONLY', 'MAIL', 'MAPQUEST', 'MTV', 'NAPSTER', 'NEOPETS',
    'NEWS', 'NICK', 'NINTENDO', 'PARENTAL CONTROLS', 'PEOPLE CONNECTION', 'PERKS', 'QUOTES', 'SHOPPING', 'SPACE JAM', 'SPORTS', 'STAR WARS',
    'TRAVEL', 'WEATHER', 'WELCOME', 'WRITE', 'Y2K', 'YAHOO', 'ZOMBO'
  ];

  // "Today on AOL" headlines (all real stories from 1998-1999).
  var HEADLINES = [
    { t: 'McGwire slugs No. 62, breaks Maris\' home run record', go: 'web:www.cnn.com', when: '19980909' },
    { t: 'John Glenn, 77, returns to space aboard Discovery', go: 'web:www.nasa.gov', when: '19981030' },
    { t: 'Fans line up for weeks for Star Wars: Episode I', go: 'web:www.starwars.com', when: '19990508' },
    { t: 'Y2K: Is your computer ready for the year 2000?', go: 'web:www.y2k.gov', when: '19990601' },
    { t: 'Napster lets you swap MP3s with the world', go: 'web:www.napster.com', when: '19991013' },
    { t: 'Apple\'s colorful iMac is the year\'s hottest computer', go: 'web:www.apple.com', when: '19981202' }
  ];

  // Starter mail for a new screen name.
  function starterMail(sn) {
    var now = Date.now();
    return [
      { id: 1, from: 'AOLMemberSvc', to: sn, subj: 'Welcome to America Online!', date: now - 3600e3 * 26, unread: true, body:
        'Dear ' + sn + ',\n\n' +
        'Welcome to America Online! We\'re thrilled to have you as part of the AOL community.\n\n' +
        'Here are a few things to try on your first visit:\n\n' +
        '  * Type a Keyword in the box at the top of your screen and click Go.\n' +
        '    Try NEWS, SPORTS, GAMES, KIDS ONLY or WEATHER.\n' +
        '  * Type a web address like www.yahoo.com to explore the World Wide Web.\n' +
        '  * Your Buddy List shows when your friends are online. Double-click a\n' +
        '    buddy to send an Instant Message.\n' +
        '  * Click People and choose People Connection to chat.\n\n' +
        'Need help? Just use Keyword: HELP any time, day or night.\n\n' +
        'See you online!\n\nAOL Member Services' },
      { id: 2, from: 'SkaterGrl1999', to: sn, subj: 'FW: FW: FW: FW: Bill Gates is giving away $$$ !!!!!', date: now - 3600e3 * 5, unread: true, body:
        '>>>>> hey!!! my cousin sent me this and says it is TOTALLY REAL. forward it to everyone!!!\n>>>>>\n' +
        '>>>> Microsoft and AOL are testing a new e-mail tracking program.\n' +
        '>>>> For every person you forward this to, Bill Gates will pay you $245.00!!!\n' +
        '>>>> My uncle\'s friend works at Microsoft and he got a check for $4,000!\n>>>>\n' +
        '>>>> THIS IS NOT A JOKE!!! (probably)\n\n' +
        'ok it is probably fake but just in case lol\n\nttyl!!!\n~*~SkAtEr GrL~*~' },
      { id: 3, from: 'Mom', to: sn, subj: 'Did you get on the internet ok?', date: now - 3600e3 * 2, unread: true, body:
        'Hi sweetie,\n\n' +
        'Your father set up the America Online on the new computer. Did it work? He says we\n' +
        'have 700 free hours left on the CD.\n\n' +
        'Please don\'t stay on too long, I need to use the phone to call Aunt Linda.\n\n' +
        'Love,\nMom\n\n' +
        'P.S. How do you make the little smiley faces?  :-)  Oh I did it!' }
    ];
  }

  var BUDDIES = {
    Buddies: ['SkaterGrl1999', 'xXGamerDudeXx', 'SurferJoe77', 'CoolBreeze42', 'DialUpDan'],
    Family: ['Mom', 'Grandpa1931'],
    'Co-Workers': ['TPSReports', 'BossMan99']
  };

  // What buddies say. {me} is replaced with the user's screen name.
  var BOT = {
    greet: ['hey!!', 'hiya {me}', 'sup', 'heyyy whats up', 'omg hi!!', 'yo'],
    openers: {
      SkaterGrl1999: ['did u get my email?? the bill gates one', 'omg did u see the new backstreet boys video on TRL', 'r u going to the mall this weekend?'],
      xXGamerDudeXx: ['dude have u played DOOM yet. its on ur computer', 'i got to level 4 in doom lol', 'wanna play starcraft on battle.net later?'],
      SurferJoe77: ['duuude the waves were gnarly today', 'have u seen the matrix yet? whoa'],
      CoolBreeze42: ['check out my geocities page!! it has a hit counter now', 'do u know html? how do u make the text blink'],
      DialUpDan: ['my mom keeps picking up the phone and kicking me off lol', 'got bumped offline AGAIN'],
      Mom: ['Hello dear. Is this how the instant messages work?', 'Don\'t forget to eat dinner.'],
      Grandpa1931: ['HELLO. HOW DO I TURN OFF THE CAPITAL LETTERS', 'Your grandmother says hi.'],
      TPSReports: ['did u get the memo about the TPS reports', 'mmmyeah'],
      BossMan99: ['Are you on AOL at work??', 'Need that report by Friday.']
    },
    replies: [
      [/\b(hi|hey|hello|sup|yo)\b/i, ['hey!', 'hiii', 'sup {me}', 'heyyy']],
      [/how (are|r) (you|u)|hru|wassup|whats up|what's up/i, ['good u?', 'bored lol', 'nm just chillin', 'eating pizza rolls lol']],
      [/\bdoom\b/i, ['DOOM rules!! use the chaingun', 'iddqd lol', 'the shareware only has episode 1 tho']],
      [/y2k/i, ['my dad is buying like 40 gallons of water for y2k', 'i think the computers will be fine lol']],
      [/\b(lol|haha|rofl|lmao)\b/i, ['lol', 'rofl', 'hahaha', ':-D']],
      [/\b(bye|brb|gtg|g2g|cya|ttyl)\b/i, ['ok ttyl!', 'bye!!', 'cya', 'k brb too']],
      [/\?$/, ['hmm idk', 'maybe lol', 'good question', 'ask jeeves lol']],
      [/music|song|cd/i, ['have u heard the new britney song', 'i just got the TLC cd', 'napster has everything!!']],
      [/school|homework|class/i, ['ugh homework', 'i have a book report due monday']]
    ],
    filler: ['lol', 'cool', 'k', 'thats awesome', 'omg', 'haha ya', 'wait what', 'totally', ':-)', 'sweet', 'nice', 'brb my mom needs the phone']
  };

  var CHAT = {
    room: 'Town Square - Lobby 42',
    people: ['BeanieBabyQueen', 'NSYNCfan4ever', 'Tamagotchi_Mom', 'FurbyLover98', 'RadDad1965', 'GoldenEye007', 'MillenniumMan', 'Xena_Warrior99'],
    lines: [
      'hi all', 'any1 from ohio?', 'this room is dead lol', 'my furby wont stop talking', 'WHO LIKES N SYNC!!!', 'backstreet boys > nsync',
      'anyone seen titanic?? i cried', 'goldeneye multiplayer tonight?', 'is it just me or is AOL slow tonight', 'brb phone',
      'my beanie babies are gonna be worth a fortune', 'y2k is gonna be crazy', 'lol', 'hiya!!!', 'anyone want to trade pokemon cards',
      'just got a new 56k modem!!', 'my tamagotchi died :-(', 'does anyone know how to make a website', 'www.geocities.com/Area51/ has cool stuff',
      'ok who keeps sending me IMs lol', 'I am typing with my new ergonomic keyboard', 'just got back from blockbuster', 'the x-files is on!!'
    ]
  };

  var SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  var FORTUNES = [
    'A message from an old friend arrives. Check your mailbox.', 'Your modem connects on the first try today. Celebrate.',
    'Do not pick up the phone while someone is online.', 'Someone in your Buddy List is thinking of you.',
    'A chain letter will tempt you. Resist!', 'Great fortune awaits: 700 more free hours are in the mail.',
    'Today is a good day to update your GeoCities page.', 'Beware of anyone asking for your password.',
    'A new high score in Minesweeper is within reach.', 'Your Tamagotchi needs attention.',
    'Your lucky keyword today is SPACE JAM.', 'Stay online a little longer. What could go wrong?'
  ];

  var STOCKS = [
    ['AOL', 'America Online', 92.25], ['YHOO', 'Yahoo!', 165.50], ['MSFT', 'Microsoft', 89.38], ['AMZN', 'Amazon.com', 76.13],
    ['EBAY', 'eBay', 131.00], ['CSCO', 'Cisco Systems', 64.44], ['INTC', 'Intel', 71.81], ['AAPL', 'Apple Computer', 64.00],
    ['CPQ', 'Compaq Computer', 24.69], ['IBM', 'IBM', 125.94], ['PETS', 'Pets.com', 11.00], ['NSCP', 'Netscape', 41.50]
  ];

  window.AOLData = {
    CHANNELS: CHANNELS, KEYWORDS: K, KEYWORD_LIST: KEYWORD_LIST, HEADLINES: HEADLINES, starterMail: starterMail,
    BUDDIES: BUDDIES, BOT: BOT, CHAT: CHAT, SIGNS: SIGNS, FORTUNES: FORTUNES, STOCKS: STOCKS
  };
})();
