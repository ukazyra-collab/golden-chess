/* Joker Chess — game controller and UI.
 * All game state changes go through one synchronous path (applyMove); clocks are derived from
 * performance.now() at the moment of each event, so there is nothing to race against.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var F_GOLDEN = GC.F_GOLDEN, F_CAPTURE = GC.F_CAPTURE, F_CASTLE = GC.F_CASTLE;
  var perf = function () { return performance.now(); };

  // ------------------------------------------------------------------ i18n
  var STR = {
    en: {
      newGame: 'New game', rules: 'Rules', settings: 'Settings', menu: 'Game menu', prev: 'Previous move', next: 'Next move',
      golden: 'Joker Move', goldenOnce: 'once per game', goldenPick: 'pick a queen, rook, bishop or knight', goldenTap: 'tap a joker dot',
      goldenOn: 'Joker Move on', goldenUsedT: 'Joker Move used', goldenUsedOn: '{san} on move {n}', goldenQueued: 'queued as a premove',
      goldenWhiteOnce: 'White: once per game', goldenBlackOnce: 'Black: once per game',
      goldenOnly: 'Only a queen, rook, bishop or knight can make the Joker Move', goldenGone: 'Your Joker Move is already used',
      goldenArmedToast: 'Joker Move on: pick a piece, then a joker dot', goldenPlayed: '{side} played the Joker Move {san}',
      you: 'You', bot: 'Joker Bot', white: 'White', black: 'Black', level: 'Level {n}', haptics: 'Vibration', usageStats: 'Usage statistics',
      dailyH: 'Daily puzzle', dailyN: 'Daily puzzle #{n}', dailyFind: 'find the Joker Move', dailySolvedCap: 'Solved! New puzzle tomorrow',
      dailyDone: 'Solved! A new daily puzzle comes tomorrow.', dailyOpen: 'Open', dailySolvedLine: 'Solved', morePuzzles: 'More puzzles',
      streakN: '{n}-day streak', streakRu: '{n} {d}', streakStart: 'Start a streak', streakHow: 'A game or a puzzle every day keeps it going. Missed a day? It waits two days for you.',
      streakBest: 'Best: {n}.', streakDone: 'Today counts.', streakDue: 'Play a game or solve the daily puzzle to keep it today.',
      streakPaused: 'Paused: play today and it goes on.', streakLost: 'Your {n}-day streak ended. A new one starts today.', saveStreak: 'Save your streak to an account',
      wdShort: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      remindT: 'Never miss the daily puzzle', remindSub: 'One reminder a day at most, never at night. Turn it off any time in Settings.', remindOn: 'Turn on reminders', notNowBtn: 'Not now',
      reminders: 'Reminders', remindPlanH: 'Reminder plan on this device', remindNone: 'Nothing planned: reminders are off or there is nothing to remind.',
      guestSaveRating: 'Your rating {r} and your streak live on this device only. Save them to an account: it takes ten seconds.',
      reportPlayer: 'Report {name}', reportT: 'Report {name}', reportSub: 'We check the game with our engine and look at how each move was played. {name} is not told who reported.',
      reportEngine: 'Used an engine or outside help', reportAbuse: 'Rude name or behaviour', reportOther: 'Something else', reportNote: 'Anything to add (optional)',
      reportSend: 'Send report', reportSent: 'Thanks. We’ll check this game.', reportAgain: 'You have already reported this game.', reportMany: 'That’s a lot of reports for one day. Try again tomorrow.',
      fairLine: 'Fair play: no engines, no outside help. Games are checked.',
      closedT: 'This account can’t play people online', closedB: 'It broke the fair play rules. Bots, puzzles and games on one device are still open.',
      fairH: 'Fair play', fairSub: 'Players reported or flagged by the nightly check. Close an account only when the numbers and the games agree.',
      fairNone: 'No reports, nothing flagged.', fairReports: 'Reports: {n}', fairNums: 'Engine’s first choice {t1}% over {n} moves, avg loss {acpl}, z {z}', fairNoScan: 'Not checked yet',
      fairJoker: 'Missed winning Joker Moves: {n} of {of}', fairWhy_engine: 'engine', fairWhy_abuse: 'abuse', fairWhy_other: 'other',
      fairState_watch: 'On watch', fairState_closed: 'Closed', fairClear: 'Clear', fairWatch: 'Watch', fairClose: 'Close account', fairSure: 'Tap again to close',
      fairClosedToast: 'Closed. Rating given back for {n} games.', fairDone: 'Done', fairOpen: 'Reports and checks',
      emailOptLabel: 'Email me a weekly summary of my games. Stop any time.', emailsSw: 'Emails about my games',
      emailsNote: 'A summary on Sundays, and a puzzle if you’ve been away a week. Never more than one a week.',
      emailAskT: 'Your week by email?', emailAskB: 'Your games, rating and best win of the week, every Sunday evening. One email a week at most; stop any time.',
      emailAskYes: 'Yes, send it', saveAskT: 'Save your progress?', saveAskSub: 'Your rating, career and games stay with you on any device. No password: we email you a code.', puzzleSeries: 'Puzzle series',
      careerTab: 'Road to Joker', freeTab: 'All bots', seasonNeed: '{n} ★ to open, you have {have}', lockedStage: 'Opens with season {n}', seasonN: 'Season {n}', starsOf: '{a} of {b} stars', seasonLocked: 'Opens at {n} stars. You have {have}.',
      seasonOpened: 'Season {n} is open: {name}', toCareer: 'Back to the career', statusH: 'Status', statStars: 'stars', statCards: 'Joker cards', statStreak: 'day streak',
      statusGuest: 'Your level and stars live on this device only. Sign in and they stay with you.',
      guestSaveStatus: 'Level {n} and your stars live on this device only. Save them to an account: it takes ten seconds.',
      playStage: 'Play', roadPlay: 'Play {name}', youWhite: 'You play White', youBlack: 'You play Black',
      nextStage: 'Next: {name}', tryAgain: 'Try again', newStars: '+{n} ★', levelUp: 'Level {n}!', newRewards: 'New rewards', great: 'Great', lvlSee: 'See',
      questsToday: 'Today’s quests', nextRewardAt: 'Level {n}: {what}', collection: 'Collection', jokerCards: 'Joker Moves found: {a} of {b}', rewardsH: 'Rewards',
      equip: 'Use', equipped: 'In use', lockedAt: 'level {n}', lockedStars: '{n} stars', newCard: 'New card: {name}', progressH: 'Your progress',
      gaAsk: 'May we count visits? Google Analytics shows us which videos bring players and what to improve. No ads, nothing sold.', gaYes: 'Allow', gaNo: 'No thanks',
      lv1: 'Beginner', lv2: 'Casual', lv3: 'Club player', lv4: 'Strong club', lv5: 'Expert', lv6: 'Master', lv7: 'Grandmaster', lv8: 'Maximum',
      opponent: 'Opponent', computer: 'Computer', twoPlayers: 'Two players, one device', playAs: 'Play as', random: 'Random',
      timeControl: 'Time control', noClock: 'No clock', strength: 'Bot strength', play: 'Play',
      record: 'Your score vs level {n}: {w} won, {d} drawn, {l} lost', recordNone: 'No games vs level {n} yet',
      resign: 'Resign', resignQ: 'Resign this game?', resignSub: 'The game ends and counts as a loss.', cancel: 'Cancel', abort: 'Abort game',
      takeback: 'Take back move', flip: 'Flip board', analyze: 'Analyze with engine', analyzeOff: 'Hide engine analysis', copyPgn: 'Copy PGN', rematch: 'Rematch',
      youWon: 'You won', youLost: 'You lost', draw: 'Draw', whiteWon: 'White won', blackWon: 'Black won',
      r_checkmate: 'by checkmate', r_resign: 'by resignation', r_timeout: 'on time', r_stalemate: 'Stalemate', r_repetition: 'Threefold repetition',
      r_fifty: '50-move rule', r_insufficient: 'Insufficient material', 'r_timeout-insufficient': 'Time ran out, but the opponent has too little material to mate', r_abort: 'Game aborted',
      r_left: 'by abandonment', oppLeft: 'Opponent left \u00b7 you win in {s} s',
      memberSince: 'Playing since {d}', recentGames: 'Recent games', yourRank: 'Your rank: #{n}', viewProfile: 'Profile',
      allTime: 'All time', movesN: '{n} moves', vsBotScore: 'Against {name}',
      playFreeNote: 'No sign-up needed. Sign in later to keep your rating on any device.',
      photo: 'Photo', choosePhoto: 'Choose a photo', removePhoto: 'Remove photo', photoSaved: 'Photo saved', photoRemoved: 'Photo removed', photoFailed: 'The photo could not be saved', photoSub: 'Shown next to your name in games and in the ratings.',
      credits: 'One evening my friend Vitaly Skalaban and I got tired of seeing the same patterns in chess. He said: what if each player had one extra move? We spent the rest of his visit refining it on a wooden board. This app exists so we could keep playing after he flew home.',
      premoveCancelled: 'Premove cancelled', pgnCopied: 'PGN copied', pgnManual: 'Copy the PGN below',
      movesEmpty: 'Moves appear here. A Joker Move is marked with *.', movesEmptyShort: 'Moves appear here', yourMove: 'Your move', botThinking: 'Joker Bot is thinking', whiteMove: 'White to move', blackMove: 'Black to move',
      best: 'Best', depth: 'depth {n}', mateIn: 'mate in {n}', mated: 'checkmate', noMoves: 'No legal moves', analysisStarting: 'Engine is thinking',
      sound: 'Sound', animation: 'Animation', animFast: 'Fast', animNormal: 'Normal', animOff: 'Off', boardTheme: 'Board', thSlate: 'Slate', thWalnut: 'Walnut', thMarble: 'Marble',
      coords: 'Coordinates', autoQueen: 'Always promote to queen', premoves: 'Premoves', language: 'Language', done: 'Done',
      rulesTitle: 'The Joker Move', rulesIntro: 'Regular chess, plus one Joker Move for each player, once per game.',
      rule1: 'Teleport your queen, rook, bishop or knight to any empty square.',
      rule2: 'No capture, and no check: after the Joker Move the opponent’s king must not be in check.',
      rule3: 'You can use it to block a check from a rook, bishop or queen. Your own king must be safe afterwards.',
      rule4: 'It is your whole move for that turn. Kings and pawns cannot make it.',
      rule5: 'Everything else is standard chess: castling, en passant, promotion. A rook that teleports loses its castling right.',
      howto: 'Tap <b>Joker Move</b> (or press G), pick a piece, then tap a joker dot. It also works as a premove.',
      credit: 'Pieces: the cburnett set by Colin M. L. Burnett (GPL / BSD), recoloured for Joker Chess. Engine, rules and sounds made for Joker Chess.',
      movesPlayed: 'Moves', goldenBy: 'Joker Moves', none: 'none', vsBot: 'vs Joker Bot, level {n}', passPlay: 'Two players', unlimited: 'no clock',
      viewing: 'Viewing move {n}. Tap the board to return to the game.',
      variation: 'Variation', backToGame: 'Back to game', review: 'Game review', analyzeOn: 'Show engine', reviewing: 'Reviewing the game: {i} of {n}',
      accuracy: 'Accuracy', estElo: 'Est. Elo', played: 'played', bestWas: 'best was', c_best: 'Best', c_excellent: 'Excellent', c_good: 'Good',
      c_inaccuracy: 'Inaccuracy', c_mistake: 'Mistake', c_blunder: 'Blunder', goldenTag: 'golden', tooShort: 'too short to rate',
      reviewHint: 'Tap the graph or step through the moves. You can also move pieces to try your own lines.',
      eloApprox: '\u2248{n} Elo',
      online: 'Online', findOpp: 'Find opponent', invite: 'Invite a friend', searching: 'Looking for an opponent', rated: 'Rated', casual: 'Casual',
      lobbyOnline: '{n} players online', lobbyOnline1: '1 player online', lobbyGames: '{n} games on', lobbyGames1: '1 game on', lobbySeeking: '{n} searching',
      lobbyMoods: ['Polishing the queen\u2019s crown', 'Waking up the knights', 'Counting the pawns twice', 'Shuffling the joker deck', 'Winding the clocks', 'Wiping the bishops\u2019 diagonals', 'Dusting off the a1 rook', 'Arguing with the arbiter', 'Warming up the board'],
      playingAs: 'Playing as', change: 'Change', save: 'Save', nameTaken: 'That name is taken by another player. If it’s you on another account, sign in with that account instead.', nameAcct: 'Account: {email}', badName: 'Use 2\u201320 letters, digits, spaces, _ or -',
      inviteSub: 'Send this link to a friend. The game starts when they open it.', copyLink: 'Copy link', linkCopied: 'Link copied', share: 'Share',
      shareText: 'Play Joker Chess with me', waitingFriend: 'Waiting for your friend', connecting: 'Connecting', netError: 'Can\u2019t reach the server. Check your connection and try again.',
      oppMove: 'Opponent\u2019s move', offerDraw: 'Offer draw', drawOffered: 'Draw offered', drawDeclined: 'Draw declined', oppOffersDraw: '{name} offers a draw',
      acceptDraw: 'Accept draw', declineDraw: 'Decline draw', accept: 'Accept', decline: 'Decline', rematchSent: 'Rematch offered', acceptRematch: 'Accept rematch',
      oppWantsRematch: '{name} wants a rematch', newOpponent: 'New opponent', ratingWord: 'Rating', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid',
      ratedLine: 'Rated {pool}', casualLine: 'Casual {pool}', yourRating: 'Your {pool} rating: {r}', firstMove: '{side}: first move within {s} s',
      r_agreement: 'by agreement', gameTaken: 'This game has already started, you are watching it', noGame: 'Game not found',
      stillPlaying: 'Your online game is still running. Starting another game leaves it, and your clock keeps ticking.',
      reconnecting: 'Reconnecting\u2026', connected: 'Online', disconnected: 'Away', leaderboard: 'Top players', lbEmpty: 'No rated games yet. The top spot is free.',
      gamesN: '{n} games', casualNote: 'Casual game: ratings don\u2019t change.', onlineElsewhere: 'Online games and ratings:', appOffline: 'No internet. Bots and two players on one phone work without it.', reconnect: 'Try again', privacy: 'Privacy policy',
      account: 'Account', signIn: 'Sign in', emailLabel: 'Email', sendCode: 'Send code', sending: 'Sending', manage: 'Manage',
      signInSub: 'Enter your email to keep your name, rating and games, or to sign in to your account on this device. We\u2019ll send you a code.',
      codeTitle: 'Enter the code', codeSub: 'We sent a code to {email}. Type it here, or open the link from the email on this device.',
      existingNote: 'This email already has an account. You\u2019ll switch to it; this guest\u2019s games and rating stay behind.',
      confirm: 'Confirm', checking: 'Checking', resend: 'Send again', resendIn: 'Send again in {s} s', otherEmail: 'Use a different email',
      methodsTitle: 'Ways to sign in', mEmail: 'Email', mGoogle: 'Google', mApple: 'Apple', mHidden: 'hidden email', mConnect: 'Connect', mOn: 'Connected',
      methodLinked: '{p} connected: it signs in to this account now', accountsMerged: 'Two accounts are one now: games and rating are together', mergeLive: 'Finish the game first, then connect',
      signedInAs: 'Signed in as {email}', signedSub: 'Your name, rating and games are saved to this account. Sign in with this email on any device.',
      signOut: 'Sign out', signedOutToast: 'Signed out. You\u2019re playing as a new guest.', progressSaved: 'Progress saved',
      pwSub: 'The password for {email}', pwLabel: 'Password', pwWrong: 'Wrong password',
      deleteAcct: 'Delete account', deleteQ: 'Delete your account?', deleteSub: 'Your name, ratings and sign-in ({email}) are deleted for good. Finished games stay in your opponents\u2019 history.',
      deletedToast: 'Account deleted. You\u2019re playing as a new guest.',
      emailInvalid: 'Enter a valid email address', codeWrong: 'That code is wrong or has expired', tooMany: 'Too many tries. Wait a minute and try again.',
      sendFailed: 'Couldn\u2019t send the email. Try again later.', finishFirst: 'Finish your online game first',
      linkExpired: 'That sign-in link has expired. Ask for a new code.', signInFailed: 'Couldn\u2019t sign in. Try again.',
      continueGoogle: 'Continue with Google', continueApple: 'Continue with Apple', or: 'or', houseNote: 'Account run by the developer', oppCard: 'Opponent', gamesWithYou: 'Games with you',
      stats: 'Statistics', loading: 'Loading', stAccounts: 'accounts', stRegistered: '{n} registered', stGuests: '{n} guests', stNew7: 'new this week', stNew30: '{n} in 30 days',
      stActive7: 'played online this week', stActive30: '{n} in 30 days', stGames7: 'online games this week', stGames30: '{n} in 30 days', stTotal: '{n} in all',
      stMethods: 'Google / Apple / email', stReturned: 'came back another day', stLive: '{n} playing now', stHouseShare: '{n} vs house players in 30 days',
      stPools: 'Last 30 days: bullet {bullet}, blitz {blitz}, rapid {rapid}', stRetH: 'Retention', stD1: 'back the next day', stD7: 'back on day 7', stBack: 'came back at all', stOf: '{n} of {of}',
      stDauH: 'People a day, two weeks', stDauLegend: 'iOS · Android · web', stCohortH: 'By first day', stCohortCols: 'day|new|D1|D7|back', stKinds: 'This week: online {online}, bots {bot}, puzzles {learn}, one phone {local}', stLegend: 'games per day (top {g}), dots: new accounts',
      guestNote: 'Guest: your rating is kept on this device only.', saveProgress: 'Save progress',
      guestRatingNote: 'Your rating is kept on this device only. Add your email to keep it.',
      playH: 'Play online',
      back: 'Back', close: 'Close', navPlay: 'Play', navLearn: 'Learn', navRatings: 'Ratings', navProfile: 'Profile',
      startGame: 'Start Game', playFriend: 'Play a Friend', playFriendSub: 'Send a link, the game starts when they open it',
      playBot: 'Play a Bot', playBotSub: 'Eight levels, from 600 to 2500 Elo', passPlay: 'Two Players', passPlaySub: 'Take turns on one device',
      more: 'More', gameOn: 'Your game is on', returnBtn: 'Return', continueGame: 'Continue your game', cont: 'Continue', vsName: 'vs {name}',
      signInToRate: 'Sign in to play online and get a rating', ratingIn: '{pool} rating: {r}', botSetupTitle: 'Play a bot',
      signInTitle: 'Sign in to play', signInPageSub: 'It\u2019s free, with no password: we email you a code. Your rating and games stay with your account on any device.',
      practise: 'Just practising?', playTheBot: 'Play the bot without an account',
      nameTitle: 'Your name in the game', nameSub: 'Opponents and the ratings see it. You can change it in Profile.', namePh: 'Your name', nameEmpty: 'Type your name', changeName: 'Change name', signedInTitle: 'You\u2019re signed in',
      yourRating: 'Your rating', wdl: '{w} wins, {d} draws, {l} losses', provisional: 'provisional', noGamesYet: 'no games yet',
      placeOf: '#{n} of {total}', topPct: 'top {p}%', unranked: 'Play a rated game to get a place', yourPlace: 'Your place', lbTop: 'Top 50', lbYou: 'you',
      wins1: 'wins', draws1: 'draws', losses1: 'losses', ratingH: 'Rating', gamesH: 'Games',
      profileGuest: 'Guest', profileSignedOut: 'Sign in to keep your rating and games on any device.', howItWorks: 'How the Joker Move works',
      learnTitle: 'One move that changes the game',
      learnLead: 'Once per game, teleport a queen, rook, bishop or knight to any empty square.',
      heroCap1: 'White still has the Joker Move. Black\u2019s queen stands right in front of the king.',
      heroCap2: '<b>Joker Move:</b> the rook teleports to e1 and pins the queen to the king.', heroCap3: 'The king steps aside, and the queen is lost.',
      ruleH: 'The rule', r1T: 'Any empty square',
      r1P: 'A queen, rook, bishop or knight. No captures, and never a check: joker dots show where this rook can go, red crosses mark squares that would give check.',
      r2T: 'It can block a check', r2P: 'Teleport a piece into the line of a check. Your own king must be safe afterwards.',
      // the Play tab reel: one line each on a phone (about 36 characters)
      reelMate0: 'Check. In normal chess, mate.', reelMate: 'The rook drops in and blocks it.',
      reelNet0: 'Black has the queen. No mate in sight.', reelNet: 'Knight to f6: Rxh7 mate is coming.', reelNet2: 'The queen rushes back to h7\u2026', reelNet3: 'Mate.',
      reelFork0: 'Two rooks and a queen vs the knight.', reelFork: 'Knight to d6: queen and rook forked.', reelFork2: 'The rook is gone. White is a rook up.',
      reelPin0: 'The queen stands before the king.', reelPin: 'The rook teleports and pins it.', reelPin2: 'The king steps aside, the queen falls.',
      reelDiag0: 'Queen and king on one diagonal.', reelDiag: 'The bishop drops in: queen pinned.', reelDiag2: 'A queen for a bishop. A rook up.',
      reelBlock0: 'Black is about to give check.', reelBlock1: 'In normal chess this is mate.', reelBlock: 'The queen lands on g2 and blocks it.',
      reelBoth0: 'Both sides still hold a Joker Move.', reelBoth1: 'White pins the queen. It looks lost.', reelBoth2: 'Black answers: a rook blocks the line.', reelBoth3: 'Rooks traded. Black is a knight up.',
      r2Cap0: 'Black is about to give check.', r2Cap1: 'The queen checks along the diagonal. In normal chess, that is mate.', r2Cap2: 'The <b>Joker Move</b> blocks it: the queen lands on g2, protected by the king.',
      r3T: 'Once per game, for each side', r3P: 'It replaces your normal move. While the joker is lit, it\u2019s still in your hand.', inHand: 'still in hand', usedUp: 'used',
      whyH: 'Why it changes chess',
      u1N: '220', u1T: 'options each turn while a Joker Move is unused, instead of about 30',
      u2N: '+130', u2T: 'Elo: what holding the Joker Move is worth, in our engine games',
      u3N: '9 of 10', u3T: 'games where both sides use it, most often around move 20',
      u4N: '0', u4T: 'new pieces to learn: everything you know about chess still works',
      vs960: 'Chess960 shuffles the starting position so memorized openings stop working. Joker Chess keeps the classic board and adds a threat that hangs over the whole game.',
      tryH: 'Try it', tryLead: 'In each position a Joker Move turns the game. Easy first, harder further on. Tap a glowing piece, then a joker dot.',
      puzzleN: 'Puzzle {n}', solvedOf: '{n} of {total} solved', lvlEasy: 'Easy', lvlMedium: 'Medium', lvlHard: 'Hard',
      pzWhite: 'White to move. Find the Joker Move.', pzBlack: 'Black to move. Find the Joker Move.', pzHint: 'The ringed piece makes the Joker Move.',
      pzGood: 'Found it. This Joker Move turns the game.', pzMate: 'Found it. Mate can no longer be stopped.',
      p1Guide: 'I\u2019m Oskar. Once a game one of your pieces can jump to any empty square: that is the Joker Move. You are in check. Tap the rook and block with it.',
      badMove2: 'Missed again. Tap Hint and I will show you the piece.',
      pzSaveW: 'White to move, and in trouble. Find the Joker Move that saves the game.', pzSaveB: 'Black to move, and in trouble. Find the Joker Move that saves the game.',
      pzCheckW: 'White is in check and in trouble. Block it with a Joker Move.', pzCheckB: 'Black is in check and in trouble. Block it with a Joker Move.',
      pzMateInW: 'White to move. Mate in {n}, and it starts with a Joker Move.', pzMateInB: 'Black to move. Mate in {n}, and it starts with a Joker Move.',
      rgLostW: 'In the game White played {m} and lost.', rgLostB: 'In the game Black played {m} and lost.', rgPlayedW: 'In the game White played {m}.', rgPlayedB: 'In the game Black played {m}.',
      rgEndW: 'The game ended here: White lost.', rgEndB: 'The game ended here: Black lost.', rgEnd: 'The game ended here.',
      rgFind: 'Find the Joker Move they never had.', rgSave: 'Save the game with a Joker Move.', rgWon: 'History rewritten: now {name} is winning.', rgBetter: 'Stronger than the move that was played.',
      idea_mate: 'Think about the king: the piece lands where mate cannot be stopped.', idea_shield: 'You are in check: put the piece in the way.', idea_fork: 'Find the square that attacks two pieces at once.',
      idea_pin: 'Find the line with one of their pieces and their king on it.', idea_escape: 'Your piece is under attack: jump it to where it hurts.', idea_none: 'Look for the empty square where this piece wins something.',
      good_shield: 'Blocked. The check is gone and the game goes on.', good_fork: 'A fork: two pieces attacked at once.', good_pin: 'A pin: that piece cannot move, the king is behind it.', good_escape: 'Out of danger and straight into the attack.',
      coachLevel: 'Level {n}', xpPlus: '+{n} XP', coachShown: 'No XP for a shown answer. Find it yourself another time and it is yours.', coachQuest: 'Daily quest done.', coachUp: 'New level: {n}, {rank}!',
      rulesOpen: 'Rules of the Joker Move', rulesClose: 'Hide the rules',
      p1Prompt: 'Black checks from d1. In normal chess this is mate. Find the Joker Move that saves you.',
      p1Good: 'Saved. The block on f1 is protected by your king, and it hits the queen on d1.',
      p1Hint: 'Put a piece between the queen and your king, on a square your king protects.',
      p2Prompt: 'Now attack. Win Black’s queen with one Joker Move.',
      p2Good: 'The bishop lands on the long diagonal, protected, and pins the queen to the king. The queen is lost.',
      p2Hint: 'Line the bishop up with the queen and the king, on a square you protect.',
      p3Prompt: 'Black\u2019s pawn is one step from queening. Stop it, then win the race.',
      p3Good: 'The knight stops the pawn for good, and your h-pawn walks in to queen.',
      p3Hint: 'The knight can stand on the queening square or guard it.',
      badMove: 'Not this one. Look again.', pzYes: 'Found it!', pzNo: 'Not this one', showAnswer: 'Show answer', nextPuzzle: 'Next', tryAgain: 'Try again', puzzleHint: 'Hint',
      allSolved: 'All solved. Now try it in a real game.', rulesH: 'All the rules', premoveRule: 'You can queue the Joker Move as a premove too.', playNow: 'Play now',
      navBots: 'Bots', easier: 'Easier', stronger: 'Stronger', yourColor: 'Your pieces', botOpp: 'vs {name}', unfinished: 'Game in progress',
      thinkingName: '{name} is thinking', playMain: 'Play', playFriendShort: 'Play a friend', playBotShort: 'Play a bot', friendT: 'Play a friend',
      friendLink: 'Invite a friend', friendLinkSub: 'Online. You get a 4-digit code for your friend', gcodeT: 'Your game code', gcodeSub: 'Tell your friend this code. The game starts when they enter it.', copyCode: 'Copy code', codeCopied: 'Code copied', shareCodeText: 'Play Joker Chess with me. Game code: {code}', joinCode: 'Join by code', joinCodeSub: 'Enter the 4 digits your friend tells you', noCode: 'No game with this code. Check the digits with your friend.', codeOpenT: 'Your game code: {code}', inviteKept: 'The code stays open. When your friend enters it, the game starts.', inviteOpenT: 'Your invite link is open', inviteOpenSub: 'Waiting for your friend', showLink: 'Show code', inviteGone: 'This invite was cancelled. Ask your friend for a new link.', joinLink: 'Join by link', joinLinkSub: 'Paste the link a friend sent you', joinPh: 'Paste the invite link', joinGo: 'Join the game', joinBad: 'That doesn\'t look like an invite link', appAskT: 'Play this game in the app?', appAskSub: 'If you have Joker Chess installed, the game opens there.', openApp: 'Open in the app', playHere: 'Play here in the browser', noAppT: 'No app yet? Get it, then open the link again.', getApp: 'Get the app',
      friendHere: 'On this device', friendHereSub: 'Take turns on one screen', signInFree: 'Online play needs a free sign-in: email or Google', signInFreeApple: 'Online play needs a free sign-in: email, Apple or Google', signInFreeEmail: 'Online play needs a free sign-in by email',
      passPlayLong: 'Two players on one device', learnCta: 'Play a bot', botScore: 'Your score: {w} won, {d} drawn, {l} lost', botNoGames: 'You haven’t played {name} yet',
      againBot: 'Play again',
      // game review: move classes, the coach's words, the report, game history
      c_brilliant: 'Brilliant', c_great: 'Great', c_miss: 'Miss', c_goldmiss: 'Missed Joker Move',
      v_brilliant: '{san} is brilliant', v_great: '{san} is a great move', v_best: '{san} is best', v_excellent: '{san} is excellent', v_good: '{san} is good',
      v_inaccuracy: '{san} is an inaccuracy', v_mistake: '{san} is a mistake', v_miss: '{san} is a miss', v_blunder: '{san} is a blunder', v_goldmiss: '{san} misses a Joker Move',
      r_sacrifice: 'A real sacrifice: taking the piece doesn’t pay.', r_missedMate: '{best} mates in {n}.', r_allowsMate: 'This allows mate in {n}.',
      r_hangs: 'Now the opponent can take your {piece}.', r_loses: 'This loses material.', r_missedTake: '{best} wins a {piece}.', r_missedMaterial: '{best} wins material.',
      r_goldmiss: 'The Joker Move {best} was much stronger.', r_goldenGood: 'Joker Move, perfectly timed.', r_goldenOk: 'A sound Joker Move; {best} was a little more precise.', r_goldenWasted: 'The Joker Move is used up, and {best} was better.',
      r_better: '{best} was better.', r_punish: 'The best answer to the opponent’s mistake.', r_goldenGreat: 'Here the Joker Move was clearly the best.',
      p_pawn: 'pawn', p_knight: 'knight', p_bishop: 'bishop', p_rook: 'rook', p_queen: 'queen', p_king: 'king',
      bestLabel: 'Best', bestGolden: 'Best: Joker {san}',
      rpReviewing: 'Reviewing the game… {p}%', rpGameRating: 'Game rating', rpRating: 'Rating', rpOpening: 'Opening', rpMiddlegame: 'Middlegame', rpEndgame: 'Endgame',
      rpMissed: 'Missed Joker Moves', rpMissedItem: 'Move {n}', rpMissedGain: '+{g}% winning chances', rpNoMissed: 'No Joker Move was missed.',
      rpGolden: 'Joker Move', rpGoldenNone: 'not used', rpStart: 'Start review', rpReport: 'Report', rpHelp: 'Tap a move to see it on the board.',
      coMissed1: 'You missed a winning Joker Move.', coMissedN: 'You missed {n} winning Joker Moves.', coGolden: 'Your Joker Move was spot on!',
      coGreat: 'Excellent game!', coGood: 'Good game.', coOk: 'Let’s see what could be better.', coShort: 'Too short a game to judge.',
      games: 'Games', allGames: 'All games', noGames: 'No games yet. The Joker is getting bored.', showMore: 'Show more',
      vsTwo: 'Two players', resWon: 'Won', resLost: 'Lost', resDraw: 'Draw', opponents: 'Opponents',
      h2h: 'You {w} : {l} {name}', h2hDraws: 'draws: {d}', allOpponents: 'All opponents', reviewShort: 'Review', today: 'Today', yesterday: 'Yesterday',
      // the coach: why a move is good or bad, lines on the board, another try
      showFollow: 'What follows', showShort: 'Next moves', hideLine: 'Back', bestBtn: 'Best: {san}', bestShort: '{san}', retryBtn: 'Find it yourself', retryShort: 'Try it', tryAgain: 'Try again', againShort: 'Again',
      lnFollow: 'Follow-up', lnBest: 'Best: {san}',
      rtAsk: 'Find a better move for {side}', rtChecking: 'Checking {san}…', rtRight: '{san} is the best move!', rtExcellent: '{san} is excellent too!',
      rtGood: '{san} is good, but there is better', rtWrong: '{san} isn’t it', rtGoldHint: 'A Joker Move counts too.',
      w_golden: '{side} answers with the Joker Move {san}', w_takes: '{side} answers {san} and takes the {piece}', w_hits: '{side} answers {san}',
      w_attacks: ', attacking the {targets}', w_check: ' with check', w_lose: 'In the end {side} wins {gain}.', w_win: '{best} would win {gain}.',
      w_keyGold: 'Key move: the Joker {san}.', w_mate: '{side} now mates in {n}.', w_lineMate: '{side} mates.', w_lineWins: '{side} wins {gain}.',
      w_equal: 'The position stays about equal.', w_better: '{side} is better.', w_winning: '{side} is winning.', w_missed: '{best} was much stronger.',
      w_and: ' and the ', g_pawn1: 'a pawn', g_pawn2: 'two pawns', g_pawn3: 'three pawns', g_pawn4: 'four pawns', g_pawnN: '{n} pawns',
      g_knight: 'a knight', g_bishop: 'a bishop', g_rook: 'a rook', g_queen: 'the queen', g_exchange: 'the exchange', g_points: 'material (+{n})', g_and: ' and ',
      t_knight: 'knight', t_bishop: 'bishop', t_rook: 'rook', t_queen: 'queen', sideGenW: 'White', sideGenB: 'Black'
    },
    ru: {
      newGame: 'Новая партия', rules: 'Правила', settings: 'Настройки', menu: 'Меню партии', prev: 'Предыдущий ход', next: 'Следующий ход',
      golden: 'Джокер', goldenOnce: 'один раз за партию', goldenPick: 'выберите ферзя, ладью, слона или коня', goldenTap: 'коснитесь точки джокера',
      goldenOn: 'Джокер включён', goldenUsedT: 'Джокер сделан', goldenUsedOn: '{san} на {n}-м ходу', goldenQueued: 'поставлен премувом',
      goldenWhiteOnce: 'Белые: один раз за партию', goldenBlackOnce: 'Чёрные: один раз за партию',
      goldenOnly: 'Джокер делают только ферзь, ладья, слон или конь', goldenGone: 'Ваш джокер уже сделан',
      goldenArmedToast: 'Джокер: выберите фигуру, затем точку джокера', goldenPlayed: '{side}: джокер {san}',
      you: 'Вы', bot: 'Joker Bot', white: 'Белые', black: 'Чёрные', level: 'Уровень {n}', haptics: 'Вибрация', usageStats: 'Статистика использования',
      dailyH: 'Задача дня', dailyN: 'Задача дня #{n}', dailyFind: 'найди ход-джокер', dailySolvedCap: 'Решено! Новая задача завтра',
      dailyDone: 'Решено! Новая задача дня — завтра.', dailyOpen: 'Открыть', dailySolvedLine: 'Решена', morePuzzles: 'Ещё задачи',
      streakN: '{n}-day streak', streakRu: 'Серия: {n} {d}', streakStart: 'Начни серию', streakHow: 'Партия или задача каждый день продлевают серию. Пропустил день? Она подождёт два дня.',
      streakBest: 'Рекорд: {n}.', streakDone: 'Сегодня засчитано.', streakDue: 'Сыграй партию или реши задачу дня, чтобы сегодня засчиталось.',
      streakPaused: 'На паузе: сыграй сегодня, и серия продолжится.', streakLost: 'Серия из {n} дн. закончилась. Новая начнётся сегодня.', saveStreak: 'Сохранить серию в аккаунт',
      wdShort: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'],
      remindT: 'Не пропусти задачу дня', remindSub: 'Не больше одного напоминания в день и никогда ночью. Выключить можно в настройках.', remindOn: 'Включить напоминания', notNowBtn: 'Не сейчас',
      reminders: 'Напоминания', remindPlanH: 'План напоминаний на этом устройстве', remindNone: 'Ничего не запланировано: напоминания выключены или напоминать не о чем.',
      guestSaveRating: 'Рейтинг {r} и серия хранятся только на этом устройстве. Сохрани их в аккаунт — это десять секунд.',
      reportPlayer: 'Пожаловаться на {name}', reportT: 'Жалоба на {name}', reportSub: 'Мы проверим партию движком и посмотрим, как делался каждый ход. {name} не узнает, кто пожаловался.',
      reportEngine: 'Играл с движком или подсказками', reportAbuse: 'Грубое имя или поведение', reportOther: 'Другое', reportNote: 'Что добавить (необязательно)',
      reportSend: 'Отправить жалобу', reportSent: 'Спасибо! Мы проверим эту партию.', reportAgain: 'Ты уже жаловался на эту партию.', reportMany: 'Слишком много жалоб за день. Попробуй завтра.',
      fairLine: 'Честная игра: без движков и подсказок. Партии проверяются.',
      closedT: 'Этот аккаунт не может играть онлайн', closedB: 'Он нарушил правила честной игры. Боты, задачи и игра на одном устройстве по-прежнему открыты.',
      fairH: 'Честная игра', fairSub: 'Игроки с жалобами или замеченные ночной проверкой. Закрывай аккаунт, только когда цифры и партии говорят одно и то же.',
      fairNone: 'Жалоб нет, проверка ничего не нашла.', fairReports: 'Жалоб: {n}', fairNums: 'Первый выбор движка {t1}% на {n} ходах, ср. потеря {acpl}, z {z}', fairNoScan: 'Ещё не проверен',
      fairJoker: 'Пропущено выигрывающих джокеров: {n} из {of}', fairWhy_engine: 'движок', fairWhy_abuse: 'грубость', fairWhy_other: 'другое',
      fairState_watch: 'Под наблюдением', fairState_closed: 'Закрыт', fairClear: 'Снять', fairWatch: 'Наблюдать', fairClose: 'Закрыть аккаунт', fairSure: 'Нажми ещё раз, чтобы закрыть',
      fairClosedToast: 'Закрыт. Рейтинг возвращён за партий: {n}.', fairDone: 'Готово', fairOpen: 'Жалобы и проверки',
      emailOptLabel: 'Присылать раз в неделю сводку моих партий. Можно отключить в любой момент.', emailsSw: 'Письма о моих партиях',
      emailsNote: 'Сводка по воскресеньям и задача, если тебя не было неделю. Не чаще раза в неделю.',
      emailAskT: 'Твоя неделя на почту?', emailAskB: 'Партии, рейтинг и лучшая победа недели — каждое воскресенье вечером. Не больше одного письма в неделю, отписаться можно в любой момент.',
      emailAskYes: 'Да, присылайте', saveAskT: 'Сохранить прогресс?', saveAskSub: 'Рейтинг, карьера и партии сохранятся на любом устройстве. Без пароля: пришлём код на почту.', puzzleSeries: 'Задачи по порядку',
      careerTab: 'Путь к Джокеру', freeTab: 'Все боты', seasonNeed: 'Нужно {n} ★, у тебя {have}', lockedStage: 'Откроется с сезоном {n}', seasonN: 'Сезон {n}', starsOf: 'Звёзд: {a} из {b}', seasonLocked: 'Откроется на {n} звёздах. У тебя {have}.',
      seasonOpened: 'Открыт сезон {n}: {name}', toCareer: 'К карьере', statusH: 'Статус', statStars: 'звёзд', statCards: 'карт джокера', statStreak: 'дней подряд',
      statusGuest: 'Уровень и звёзды хранятся только на этом устройстве. Войди, и они останутся с тобой.',
      guestSaveStatus: 'Уровень {n} и звёзды хранятся только на этом устройстве. Сохрани их в аккаунт — это десять секунд.',
      playStage: 'Играть', roadPlay: 'Играть: {name}', youWhite: 'Ты играешь белыми', youBlack: 'Ты играешь чёрными',
      nextStage: 'Дальше: {name}', tryAgain: 'Ещё раз', newStars: '+{n} ★', levelUp: 'Уровень {n}!', newRewards: 'Новые награды', great: 'Отлично', lvlSee: 'Смотреть',
      questsToday: 'Задания на сегодня', nextRewardAt: 'Уровень {n}: {what}', collection: 'Коллекция', jokerCards: 'Найдено ходов-джокеров: {a} из {b}', rewardsH: 'Награды',
      equip: 'Выбрать', equipped: 'Выбрано', lockedAt: 'уровень {n}', lockedStars: 'звёзд: {n}', newCard: 'Новая карта: {name}', progressH: 'Твой прогресс',
      gaAsk: 'Можно считать визиты? Google Analytics покажет, какие ролики приводят игроков и что улучшить. Без рекламы и продажи данных.', gaYes: 'Разрешить', gaNo: 'Не надо',
      lv1: 'Новичок', lv2: 'Любитель', lv3: 'Клубный игрок', lv4: 'Сильный клубный', lv5: 'Эксперт', lv6: 'Мастер', lv7: 'Гроссмейстер', lv8: 'Максимум',
      opponent: 'Соперник', computer: 'Компьютер', twoPlayers: 'Двое на одном устройстве', playAs: 'Играть за', random: 'Случайно',
      timeControl: 'Контроль времени', noClock: 'Без часов', strength: 'Сила бота', play: 'Играть',
      record: 'Счёт против уровня {n}: побед {w}, ничьих {d}, поражений {l}', recordNone: 'Против уровня {n} ещё не играли',
      resign: 'Сдаться', resignQ: 'Сдать партию?', resignSub: 'Партия закончится поражением.', cancel: 'Отмена', abort: 'Прервать партию',
      takeback: 'Вернуть ход', flip: 'Перевернуть доску', analyze: 'Анализ движком', analyzeOff: 'Скрыть анализ', copyPgn: 'Скопировать PGN', rematch: 'Реванш',
      youWon: 'Вы победили', youLost: 'Вы проиграли', draw: 'Ничья', whiteWon: 'Белые победили', blackWon: 'Чёрные победили',
      r_checkmate: 'мат', r_resign: 'сдача', r_timeout: 'время вышло', r_stalemate: 'Пат', r_repetition: 'Троекратное повторение',
      r_fifty: 'Правило 50 ходов', r_insufficient: 'Недостаточно материала', 'r_timeout-insufficient': 'Время вышло, но у соперника не хватает материала для мата', r_abort: 'Партия прервана',
      r_left: 'уход из партии', oppLeft: 'Соперник вышел \u00b7 победа через {s} с',
      memberSince: 'Играет с {d}', recentGames: 'Последние партии', yourRank: 'Ваше место: #{n}', viewProfile: 'Профиль',
      placeOf: '#{n} из {total}', topPct: 'топ {p}%', unranked: 'Сыграйте партию на рейтинг, чтобы занять место', yourPlace: 'Ваше место', lbTop: 'Топ-50', lbYou: 'вы',
      wins1: 'побед', draws1: 'ничьих', losses1: 'поражений', ratingH: 'Рейтинг', gamesH: 'Партий',
      allTime: 'За всё время', movesN: 'ходов: {n}', vsBotScore: 'Против {name}',
      playFreeNote: 'Без регистрации. Войти можно потом — чтобы рейтинг остался с вами на любом устройстве.',
      photo: 'Фото', choosePhoto: 'Выбрать фото', removePhoto: 'Убрать фото', photoSaved: 'Фото сохранено', photoRemoved: 'Фото убрано', photoFailed: 'Не удалось сохранить фото', photoSub: 'Видно рядом с вашим именем в партиях и в рейтинге.',
      credits: 'One evening my friend Vitaly Skalaban and I got tired of seeing the same patterns in chess. He said: what if each player had one extra move? We spent the rest of his visit refining it on a wooden board. This app exists so we could keep playing after he flew home.',
      premoveCancelled: 'Премув отменён', pgnCopied: 'PGN скопирован', pgnManual: 'Скопируйте PGN ниже',
      movesEmpty: 'Здесь будут ходы. Джокеры отмечены звездой.', movesEmptyShort: 'Здесь будут ходы', yourMove: 'Ваш ход', botThinking: 'Joker Bot думает', whiteMove: 'Ход белых', blackMove: 'Ход чёрных',
      best: 'Лучший', depth: 'глубина {n}', mateIn: 'мат в {n}', mated: 'мат', noMoves: 'Нет ходов', analysisStarting: 'Движок думает',
      sound: 'Звук', animation: 'Анимация', animFast: 'Быстро', animNormal: 'Обычно', animOff: 'Выкл', boardTheme: 'Доска', thSlate: 'Сланец', thWalnut: 'Орех', thMarble: 'Мрамор',
      coords: 'Координаты', autoQueen: 'Всегда превращать в ферзя', premoves: 'Премувы', language: 'Язык', done: 'Готово',
      rulesTitle: 'Джокер', rulesIntro: 'Обычные шахматы, плюс у каждого игрока один джокер за партию.',
      rule1: 'Перенесите ферзя, ладью, слона или коня на любое пустое поле.',
      rule2: 'Без взятия и без шаха: после джокера король соперника не должен быть под шахом.',
      rule3: 'Им можно закрыться от шаха ладьи, слона или ферзя. Ваш король после хода должен быть в безопасности.',
      rule4: 'Это полноценный ход вместо обычного. Король и пешки так ходить не могут.',
      rule5: 'Остальное — обычные шахматы: рокировка, взятие на проходе, превращение. Ладья после джокера теряет право на рокировку.',
      howto: 'Нажмите <b>Джокер</b> (или G), выберите фигуру и коснитесь точки джокера. Работает и как премув.',
      credit: 'Фигуры: набор cburnett, Colin M. L. Burnett (GPL / BSD), перекрашенный для Joker Chess. Движок, правила и звуки сделаны для Joker Chess.',
      movesPlayed: 'Ходов', goldenBy: 'Джокеры', none: 'нет', vsBot: 'против Joker Bot, уровень {n}', passPlay: 'Двое игроков', unlimited: 'без часов',
      viewing: 'Просмотр хода {n}. Коснитесь доски, чтобы вернуться к партии.',
      variation: 'Вариант', backToGame: 'Вернуться к партии', review: 'Разбор партии', analyzeOn: 'Показать движок', reviewing: 'Разбор партии: {i} из {n}',
      accuracy: 'Точность', estElo: 'Оценка Elo', played: 'сыграно', bestWas: 'лучше было', c_best: 'Лучший', c_excellent: 'Превосходный', c_good: 'Хороший',
      c_inaccuracy: 'Неточность', c_mistake: 'Ошибка', c_blunder: 'Зевок', goldenTag: 'джокер', tooShort: 'мало ходов для оценки',
      reviewHint: 'Коснитесь графика или листайте ходы. Можно двигать фигуры и пробовать свои варианты.',
      eloApprox: '\u2248{n} Elo',
      online: 'Онлайн', findOpp: 'Найти соперника', invite: 'Пригласить друга', searching: 'Ищем соперника', rated: 'На рейтинг', casual: 'Без рейтинга',
      lobbyOnline: '{n} {w} онлайн', lobbyOnlineW: ['игрок', 'игрока', 'игроков'], lobbyGames: '{n} {w}', lobbyGamesW: ['партия идёт', 'партии идут', 'партий идёт'], lobbySeeking: 'ищут: {n}',
      lobbyMoods: ['Полируем корону ферзя', 'Будим коней', 'Пересчитываем пешки', 'Тасуем колоду джокеров', 'Заводим часы', 'Протираем диагонали слонам', 'Чистим ладью на a1', 'Спорим с арбитром', 'Греем доску'],
      playingAs: 'Ваше имя:', change: 'Изменить', save: 'Сохранить', nameTaken: 'Это имя уже у другого игрока. Если это вы с другого аккаунта, войдите через него.', nameAcct: 'Аккаунт: {email}', badName: 'Нужно 2–20 букв, цифр, пробелов, _ или -',
      inviteSub: 'Отправьте ссылку другу. Партия начнётся, когда он её откроет.', copyLink: 'Скопировать', linkCopied: 'Ссылка скопирована', share: 'Поделиться',
      shareText: 'Сыграем в Joker Chess', waitingFriend: 'Ждём друга', connecting: 'Подключение', netError: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
      oppMove: 'Ход соперника', offerDraw: 'Предложить ничью', drawOffered: 'Ничья предложена', drawDeclined: 'Ничью отклонили', oppOffersDraw: '{name} предлагает ничью',
      acceptDraw: 'Согласиться на ничью', declineDraw: 'Отклонить ничью', accept: 'Принять', decline: 'Отклонить', rematchSent: 'Реванш предложен', acceptRematch: 'Принять реванш',
      oppWantsRematch: '{name} хочет реванш', newOpponent: 'Новый соперник', ratingWord: 'Рейтинг', bullet: 'Пуля', blitz: 'Блиц', rapid: 'Рапид',
      ratedLine: '{pool} на рейтинг', casualLine: '{pool} без рейтинга', yourRating: 'Ваш рейтинг ({pool}): {r}', firstMove: '{side}: первый ход — {s} с',
      r_agreement: 'по соглашению', gameTaken: 'Партия уже началась, вы смотрите её как зритель', noGame: 'Партия не найдена',
      stillPlaying: 'Ваша онлайн-партия ещё идёт. Если начать другую, часы в ней продолжат идти.',
      reconnecting: 'Переподключение…', connected: 'В игре', disconnected: 'Отошёл', leaderboard: 'Лучшие игроки', lbEmpty: 'Рейтинговых партий ещё нет. Первое место свободно.',
      gamesN: 'партий: {n}', casualNote: 'Партия без рейтинга: рейтинг не меняется.', onlineElsewhere: 'Онлайн-партии и рейтинг:', appOffline: 'Нет интернета. Боты и игра вдвоём на одном телефоне работают и без него.', reconnect: 'Повторить', privacy: 'Политика конфиденциальности',
      account: 'Аккаунт', signIn: 'Войти', emailLabel: 'Почта', sendCode: 'Получить код', sending: 'Отправляем', manage: 'Управление',
      signInSub: 'Введите почту, чтобы сохранить имя, рейтинг и партии или войти в свой аккаунт на этом устройстве. Мы пришлём код.',
      codeTitle: 'Введите код', codeSub: 'Код отправлен на {email}. Введите его здесь или откройте ссылку из письма на этом устройстве.',
      existingNote: 'У этой почты уже есть аккаунт. Вы перейдёте в него, а партии и рейтинг этого гостя останутся у гостя.',
      confirm: 'Подтвердить', checking: 'Проверяем', resend: 'Отправить ещё раз', resendIn: 'Ещё раз через {s} с', otherEmail: 'Другая почта',
      methodsTitle: 'Способы входа', mEmail: 'Почта', mGoogle: 'Google', mApple: 'Apple', mHidden: 'скрытая почта', mConnect: 'Подключить', mOn: 'Подключено',
      methodLinked: '{p} подключён: теперь он входит в этот аккаунт', accountsMerged: 'Два аккаунта стали одним: партии и рейтинг вместе', mergeLive: 'Сначала доиграйте партию, потом подключайте',
      signedInAs: 'Вы вошли как {email}', signedSub: 'Имя, рейтинг и партии сохранены в аккаунте. Входите с этой почтой на любом устройстве.',
      signOut: 'Выйти', signedOutToast: 'Вы вышли. Теперь вы играете как новый гость.', progressSaved: 'Прогресс сохранён',
      pwSub: 'Пароль для {email}', pwLabel: 'Пароль', pwWrong: 'Неверный пароль',
      deleteAcct: 'Удалить аккаунт', deleteQ: 'Удалить аккаунт?', deleteSub: 'Имя, рейтинг и вход ({email}) удалятся навсегда. Сыгранные партии останутся в истории соперников.',
      deletedToast: 'Аккаунт удалён. Теперь вы играете как новый гость.',
      emailInvalid: 'Введите корректную почту', codeWrong: 'Код неверный или устарел', tooMany: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
      sendFailed: 'Не удалось отправить письмо. Попробуйте позже.', finishFirst: 'Сначала доиграйте онлайн-партию',
      linkExpired: 'Ссылка для входа устарела. Запросите новый код.', signInFailed: 'Не удалось войти. Попробуйте ещё раз.',
      continueGoogle: 'Войти через Google', continueApple: 'Войти через Apple', or: 'или', houseNote: 'Аккаунт, управляемый разработчиком', oppCard: 'Соперник', gamesWithYou: 'Партий с вами',
      stats: 'Статистика', loading: 'Загрузка', stAccounts: 'аккаунтов', stRegistered: 'зарегистрировано {n}', stGuests: 'гостей {n}', stNew7: 'новых за неделю', stNew30: '{n} за 30 дней',
      stActive7: 'играли онлайн за неделю', stActive30: '{n} за 30 дней', stGames7: 'онлайн-партий за неделю', stGames30: '{n} за 30 дней', stTotal: 'всего {n}',
      stMethods: 'Google / Apple / почта', stReturned: 'вернулись в другой день', stLive: 'сейчас играют: {n}', stHouseShare: '{n} с ботами за 30 дней',
      stPools: 'За 30 дней: пуля {bullet}, блиц {blitz}, рапид {rapid}', stRetH: 'Удержание', stD1: 'вернулись на следующий день', stD7: 'вернулись на 7-й день', stBack: 'вернулись хоть раз', stOf: '{n} из {of}',
      stDauH: 'Людей в день, две недели', stDauLegend: 'iOS · Android · сайт', stCohortH: 'По дню прихода', stCohortCols: 'день|новых|D1|D7|вернулись', stKinds: 'За неделю: онлайн {online}, боты {bot}, задачи {learn}, вдвоём {local}', stLegend: 'партий в день (максимум {g}), точки: новые аккаунты',
      guestNote: 'Гость: рейтинг хранится только на этом устройстве.', saveProgress: 'Сохранить прогресс',
      guestRatingNote: 'Рейтинг хранится только на этом устройстве. Добавьте почту, чтобы не потерять его.',
      playH: 'Играть онлайн',
      back: 'Назад', close: 'Закрыть', navPlay: 'Играть', navLearn: 'Обучение', navRatings: 'Рейтинг', navProfile: 'Профиль',
      startGame: 'Начать игру', playFriend: 'Сыграть с другом', playFriendSub: 'Отправьте ссылку, игра начнётся, когда друг её откроет',
      playBot: 'Сыграть с ботом', playBotSub: 'Восемь уровней, от 600 до 2500 Elo', passPlay: 'Вдвоём', passPlaySub: 'По очереди на одном устройстве',
      more: 'Ещё', gameOn: 'Ваша партия идёт', returnBtn: 'Вернуться', continueGame: 'Продолжить партию', cont: 'Продолжить', vsName: 'против {name}',
      signInToRate: 'Войдите, чтобы играть онлайн и получить рейтинг', ratingIn: 'Рейтинг ({pool}): {r}', botSetupTitle: 'Игра с ботом',
      signInTitle: 'Войдите, чтобы играть', signInPageSub: 'Бесплатно и без пароля: пришлём код на почту. Рейтинг и партии сохранятся в аккаунте на любом устройстве.',
      practise: 'Просто потренироваться?', playTheBot: 'Сыграйте с ботом без аккаунта',
      nameTitle: 'Ваше имя в игре', nameSub: 'Его видят соперники и таблица рейтинга. Поменять можно в профиле.', namePh: 'Ваше имя', nameEmpty: 'Введите имя', changeName: 'Изменить имя', signedInTitle: 'Вы вошли',
      yourRating: 'Ваш рейтинг', wdl: 'побед {w}, ничьих {d}, поражений {l}', provisional: 'предварительный', noGamesYet: 'партий ещё нет',
      profileGuest: 'Гость', profileSignedOut: 'Войдите, чтобы рейтинг и партии остались с вами на любом устройстве.', howItWorks: 'Как работает джокер',
      learnTitle: 'Один ход, который меняет партию',
      learnLead: 'Раз за партию перенесите ферзя, ладью, слона или коня на любое пустое поле.',
      heroCap1: 'У белых остался джокер. Чёрный ферзь стоит прямо перед своим королём.',
      heroCap2: '<b>Джокер:</b> ладья переносится на e1 и связывает ферзя с королём.', heroCap3: 'Король уходит в сторону, и ферзь потерян.',
      ruleH: 'Правило', r1T: 'Любое пустое поле',
      r1P: 'Ферзь, ладья, слон или конь. Без взятия и никогда с шахом: точки джокера показывают, куда может перенестись ладья, красные крестики — поля, где был бы шах.',
      r2T: 'Им можно закрыться от шаха', r2P: 'Поставьте фигуру на линию шаха. Ваш король после хода должен быть в безопасности.',
      reelMate0: 'Шах. В обычных шахматах — мат.', reelMate: 'Ладья прыгает и закрывает линию.',
      reelNet0: 'У чёрных ферзь. Мата не видно.', reelNet: 'Конь на f6: грозит Лxh7 и мат.', reelNet2: 'Ферзь бежит защищать h7\u2026', reelNet3: 'Мат.',
      reelFork0: 'Две ладьи и ферзь. Конь ещё на b1.', reelFork: 'Конь на d6: вилка на ферзя и ладью.', reelFork2: 'Ладья съедена. У белых лишняя ладья.',
      reelPin0: 'Ферзь стоит перед королём.', reelPin: 'Ладья прыгает и связывает его.', reelPin2: 'Король отходит, ферзь потерян.',
      reelDiag0: 'Ферзь и король на одной диагонали.', reelDiag: 'Слон появляется. Ферзь связан.', reelDiag2: 'Ферзь за слона. Лишняя ладья.',
      reelBlock0: 'Чёрные сейчас дадут шах.', reelBlock1: 'В обычных шахматах это мат.', reelBlock: 'Ферзь садится на g2 и закрывает.',
      reelBoth0: 'Джокер ещё есть у обеих сторон.', reelBoth1: 'Белые связывают ферзя. Он потерян?', reelBoth2: 'Чёрные отвечают: ладья на линию.', reelBoth3: 'Размен ладей. У чёрных лишний конь.',
      r2Cap0: 'Чёрные сейчас дадут шах.', r2Cap1: 'Ферзь даёт шах по диагонали. В обычных шахматах это мат.', r2Cap2: '<b>Джокер</b> закрывает шах: ферзь встаёт на g2 под защитой короля.',
      r3T: 'Один раз за партию у каждого', r3P: 'Он заменяет обычный ход. Пока звезда горит, ход у вас в запасе.', inHand: 'в запасе', usedUp: 'использован',
      whyH: 'Чем это меняет шахматы',
      u1N: '220', u1T: 'вариантов на каждый ход, пока джокер не потрачен, вместо примерно 30',
      u2N: '+130', u2T: 'Elo — столько стоит джокер в запасе, по нашим партиям движка',
      u3N: '9 из 10', u3T: 'партий, где его используют обе стороны, чаще всего около 20-го хода',
      u4N: '0', u4T: 'новых фигур: всё, что вы знаете о шахматах, продолжает работать',
      vs960: 'Шахматы Фишера (960) перемешивают стартовую расстановку, чтобы заученные дебюты перестали работать. Joker Chess оставляет классическую доску и добавляет угрозу, которая висит над всей партией.',
      tryH: 'Попробуйте', tryLead: 'В каждой позиции партию переворачивает джокер. Сначала простые, дальше сложнее. Коснитесь светящейся фигуры, затем золотой точки.',
      puzzleN: 'Задача {n}', solvedOf: 'Решено {n} из {total}', lvlEasy: 'Легко', lvlMedium: 'Средне', lvlHard: 'Сложно',
      pzWhite: 'Ход белых. Найди джокер.', pzBlack: 'Ход чёрных. Найди джокер.', pzHint: 'Джокером ходит фигура в рамке.',
      pzGood: 'Есть! Этот джокер переворачивает партию.', pzMate: 'Есть! Мат уже не остановить.',
      p1Guide: 'Я Оскар. Раз за партию твоя фигура может прыгнуть на любое пустое поле: это ход-джокер. Тебе шах. Нажми на ладью и закройся ею.',
      badMove2: 'Снова мимо. Нажми «Подсказка», покажу фигуру.',
      pzSaveW: 'Ход белых, и дела плохи. Найди джокер, который спасает.', pzSaveB: 'Ход чёрных, и дела плохи. Найди джокер, который спасает.',
      pzCheckW: 'Белым шах, и дела плохи. Закройся джокером.', pzCheckB: 'Чёрным шах, и дела плохи. Закройся джокером.',
      pzMateInW: 'Ход белых. Мат в {n} хода, и начинается он с джокера.', pzMateInB: 'Ход чёрных. Мат в {n} хода, и начинается он с джокера.',
      rgLostW: 'В партии белые сыграли {m} и проиграли.', rgLostB: 'В партии чёрные сыграли {m} и проиграли.', rgPlayedW: 'В партии белые сыграли {m}.', rgPlayedB: 'В партии чёрные сыграли {m}.',
      rgEndW: 'Здесь партия закончилась: белые проиграли.', rgEndB: 'Здесь партия закончилась: чёрные проиграли.', rgEnd: 'Здесь партия закончилась.',
      rgFind: 'Найди джокер, которого у них не было.', rgSave: 'Спаси партию джокером.', rgWon: 'История переписана: теперь выигрывает {name}.', rgBetter: 'Сильнее, чем ход из партии.',
      idea_mate: 'Думай о короле: фигура встаёт туда, откуда мат не остановить.', idea_shield: 'Тебе шах: поставь фигуру на пути.', idea_fork: 'Ищи поле, с которого под ударом сразу две фигуры.',
      idea_pin: 'Ищи линию, на которой стоят чужая фигура и король за ней.', idea_escape: 'Твоя фигура под боем: перенеси её туда, где она опасна.', idea_none: 'Ищи пустое поле, с которого эта фигура что-то выигрывает.',
      good_shield: 'Шах закрыт, партия продолжается.', good_fork: 'Вилка: под ударом сразу две фигуры.', good_pin: 'Связка: фигура не может уйти, за ней король.', good_escape: 'Фигура ушла из-под удара и сразу напала.',
      coachLevel: 'Уровень {n}', xpPlus: '+{n} XP', coachShown: 'За показанный ответ XP нет. Реши эту задачу позже без ответа, и они твои.', coachQuest: 'Задание дня выполнено.', coachUp: 'Новый уровень: {n}, {rank}!',
      rulesOpen: 'Правила хода-джокера', rulesClose: 'Скрыть правила',
      p1Prompt: 'Чёрные дают шах ферзём с d1. В обычных шахматах это мат. Найди джокер, который спасает.',
      p1Good: 'Получилось. Фигура на f1 под защитой короля и сама бьёт ферзя на d1.',
      p1Hint: 'Поставь фигуру между ферзём и королём, на поле, которое защищает король.',
      p2Prompt: 'Теперь нападай. Выиграй чёрного ферзя одним джокером.',
      p2Good: 'Слон встал на большую диагональ под защитой и связал ферзя с королём. Ферзь пропадает.',
      p2Hint: 'Поставь слона на одну линию с ферзём и королём, на поле под твоей защитой.',
      p3Prompt: 'Чёрная пешка в шаге от превращения. Останови её и выиграй гонку.',
      p3Good: 'Конь остановил пешку, а твоя пешка h проходит в ферзи.',
      p3Hint: 'Конь может встать на поле превращения или держать его под ударом.',
      badMove: 'Не то. Посмотри ещё раз.', pzYes: 'Есть!', pzNo: 'Не то', showAnswer: 'Показать ответ', nextPuzzle: 'Дальше', tryAgain: 'Ещё раз', puzzleHint: 'Подсказка',
      allSolved: 'Все решены. Теперь попробуй в настоящей партии.', rulesH: 'Все правила', premoveRule: 'Джокер можно поставить и премувом.', playNow: 'Играть',
      navBots: 'Боты', easier: 'Полегче', stronger: 'Посильнее', yourColor: 'Ваш цвет', botOpp: 'соперник: {name}', unfinished: 'Партия идёт',
      thinkingName: '{name} думает', playMain: 'Играть', playFriendShort: 'Играть с другом', playBotShort: 'Играть с ботом', friendT: 'Игра с другом',
      friendLink: 'Пригласить друга', friendLinkSub: 'Онлайн. Вы получите код из 4 цифр для друга', gcodeT: 'Код партии', gcodeSub: 'Скажите другу этот код. Партия начнётся, когда он его введёт.', copyCode: 'Скопировать код', codeCopied: 'Код скопирован', shareCodeText: 'Сыграем в Joker Chess. Код партии: {code}', joinCode: 'Войти по коду', joinCodeSub: 'Введите 4 цифры, которые назвал друг', noCode: 'Партии с таким кодом нет. Сверьте цифры с другом.', codeOpenT: 'Код вашей партии: {code}', inviteKept: 'Код остаётся открытым. Когда друг введёт его, партия начнётся.', inviteOpenT: 'Ваша ссылка-приглашение открыта', inviteOpenSub: 'Ждём друга', showLink: 'Показать код', inviteGone: 'Это приглашение отменено. Попросите у друга новую ссылку.', joinLink: 'Войти по ссылке', joinLinkSub: 'Вставьте ссылку, которую прислал друг', joinPh: 'Вставьте ссылку-приглашение', joinGo: 'Войти в партию', joinBad: 'Это не похоже на ссылку-приглашение', appAskT: 'Сыграть в приложении?', appAskSub: 'Если Joker Chess установлен, партия откроется в нём.', openApp: 'Открыть в приложении', playHere: 'Играть здесь, в браузере', noAppT: 'Приложения ещё нет? Скачайте его и откройте ссылку снова.', getApp: 'Скачать приложение',
      friendHere: 'На одном устройстве', friendHereSub: 'Ходите по очереди на одном экране', signInFree: 'Для игры онлайн нужен вход по почте или через Google, это бесплатно', signInFreeApple: 'Для игры онлайн нужен вход по почте, через Apple или Google, это бесплатно', signInFreeEmail: 'Для игры онлайн нужен вход по почте, это бесплатно',
      passPlayLong: 'Вдвоём на одном устройстве', learnCta: 'Сыграть с ботом', botScore: 'Ваш счёт: побед {w}, ничьих {d}, поражений {l}', botNoGames: 'Вы ещё не играли с этим ботом',
      againBot: 'Ещё партия',
      c_brilliant: 'Блестящий', c_great: 'Отличный', c_miss: 'Упущенная возможность', c_goldmiss: 'Упущен джокер',
      v_brilliant: '{san} — блестящий ход', v_great: '{san} — отличный ход', v_best: '{san} — лучший ход', v_excellent: '{san} — превосходный ход', v_good: '{san} — хороший ход',
      v_inaccuracy: '{san} — неточность', v_mistake: '{san} — ошибка', v_miss: '{san} — упущенная возможность', v_blunder: '{san} — зевок', v_goldmiss: '{san}: упущен джокер',
      r_sacrifice: 'Настоящая жертва: брать фигуру невыгодно.', r_missedMate: '{best} ставит мат в {n}.', r_allowsMate: 'Теперь соперник ставит мат в {n}.',
      r_hangs: 'Теперь соперник забирает {piece}.', r_loses: 'Так теряется материал.', r_missedTake: '{best} выигрывает {piece}.', r_missedMaterial: '{best} выигрывает материал.',
      r_goldmiss: 'Джокер {best} был намного сильнее.', r_goldenGood: 'Джокер — точно вовремя.', r_goldenOk: 'Неплохой джокер, но {best} было чуть точнее.', r_goldenWasted: 'Джокер потрачен, а лучше было {best}.',
      r_better: 'Лучше было {best}.', r_punish: 'Лучший ответ на ошибку соперника.', r_goldenGreat: 'Здесь джокер был лучше всего.',
      p_pawn: 'пешку', p_knight: 'коня', p_bishop: 'слона', p_rook: 'ладью', p_queen: 'ферзя', p_king: 'короля',
      bestLabel: 'Лучший', bestGolden: 'Лучший: джокер {san}',
      rpReviewing: 'Разбираем партию… {p}%', rpGameRating: 'Уровень игры', rpRating: 'Рейтинг', rpOpening: 'Дебют', rpMiddlegame: 'Миттельшпиль', rpEndgame: 'Эндшпиль',
      rpMissed: 'Упущенные джокеры', rpMissedItem: 'Ход {n}', rpMissedGain: '+{g}% к шансам на победу', rpNoMissed: 'Джокеров не упущено.',
      rpGolden: 'Джокер', rpGoldenNone: 'не сыгран', rpStart: 'Начать разбор', rpReport: 'Отчёт', rpHelp: 'Нажмите на ход, чтобы увидеть его на доске.',
      coMissed1: 'Вы упустили выигрывающий джокер.', coMissedN: 'Вы упустили выигрывающих джокеров: {n}.', coGolden: 'Ваш джокер был точным!',
      coGreat: 'Отличная партия!', coGood: 'Хорошая партия.', coOk: 'Посмотрим, что можно было сыграть лучше.', coShort: 'Партия слишком короткая для оценки.',
      games: 'Партии', allGames: 'Все партии', noGames: 'Партий пока нет. Джокер скучает.', showMore: 'Показать ещё',
      vsTwo: 'Вдвоём', resWon: 'Победа', resLost: 'Поражение', resDraw: 'Ничья', opponents: 'Соперники',
      h2h: 'Вы {w} : {l} {name}', h2hDraws: 'ничьих: {d}', allOpponents: 'Все соперники', reviewShort: 'Разбор', today: 'Сегодня', yesterday: 'Вчера',
      showFollow: 'Что дальше', showShort: 'Дальше', hideLine: 'Назад', bestBtn: 'Лучше: {san}', bestShort: '{san}', retryBtn: 'Найти самому', retryShort: 'Найти', tryAgain: 'Ещё раз', againShort: 'Ещё раз',
      lnFollow: 'Продолжение', lnBest: 'Лучший: {san}',
      rtAsk: 'Найдите ход сильнее за {sideGen}', rtChecking: 'Проверяем {san}…', rtRight: '{san} — лучший ход!', rtExcellent: '{san} — тоже отличный ход!',
      rtGood: '{san} — неплохо, но есть сильнее', rtWrong: '{san} — не то', rtGoldHint: 'Джокер тоже считается.',
      w_golden: '{side} отвечают джокером {san}', w_takes: '{side} отвечают {san} и забирают {piece}', w_hits: '{side} отвечают {san}',
      w_attacks: ' с нападением на {targets}', w_check: ' с шахом', w_lose: 'В итоге {sideLc} выигрывают {gain}.', w_win: 'Ход {best} выигрывал {gain}.',
      w_keyGold: 'Ключевой ход — джокер {san}.', w_mate: 'Теперь у {sideGen} мат в {n}.', w_lineMate: '{side} ставят мат.', w_lineWins: '{side} выигрывают {gain}.',
      w_equal: 'Позиция примерно равная.', w_better: 'У {sideGen} лучше.', w_winning: '{side} выигрывают.', w_missed: 'Намного сильнее было {best}.',
      w_and: ' и ', g_pawn1: 'пешку', g_pawn2: 'две пешки', g_pawn3: 'три пешки', g_pawn4: 'четыре пешки', g_pawnN: '{n} пешек',
      g_knight: 'коня', g_bishop: 'слона', g_rook: 'ладью', g_queen: 'ферзя', g_exchange: 'качество', g_points: 'материал (+{n})', g_and: ' и ',
      t_knight: 'коня', t_bishop: 'слона', t_rook: 'ладью', t_queen: 'ферзя', sideGenW: 'белых', sideGenB: 'чёрных'
    }
  };
  var settings = Object.assign({ sound: true, haptics: true, stats: true, reminders: null, anim: 'normal', board: 'slate', coords: true, autoQueen: false, premoves: true, lang: null }, load('settings', {}));
  // progress (prototype; src/progress.js): XP, quests, the career against the bots, Joker cards, what is equipped
  var prog = Object.assign({ xp: 0, career: {}, cards: {}, q: null, firstWin: '', equip: {}, seen: { lv: 1, stars: 0 }, up: null, reviewed: [] }, load('prog', {}));
  var lang = settings.lang || (/^ru\b/i.test(navigator.language || '') ? 'ru' : 'en');
  function T(key, vars) {
    var s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (typeof s !== 'string') return s; // a list (lobbyMoods and the like)
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }
  // Russian counts: 1 игрок, 2 игрока, 5 игроков (forms: one, few, many)
  function ruForm(n, forms) { var m10 = n % 10, m100 = n % 100; return forms[m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2]; }
  // "12 players online · 3 games on": what the search dialog says about who is around
  function lobbyLine(o) {
    var parts = [];
    if (lang === 'ru') {
      parts.push(T('lobbyOnline', { n: o.online, w: ruForm(o.online, T('lobbyOnlineW')) }));
      if (o.games) parts.push(T('lobbyGames', { n: o.games, w: ruForm(o.games, T('lobbyGamesW')) }));
    } else {
      parts.push(o.online === 1 ? T('lobbyOnline1') : T('lobbyOnline', { n: o.online }));
      if (o.games) parts.push(o.games === 1 ? T('lobbyGames1') : T('lobbyGames', { n: o.games }));
    }
    if (o.seeking > 1) parts.push(T('lobbySeeking', { n: o.seeking }));
    return parts.join(' \u00b7 ');
  }

  // ------------------------------------------------------------------ storage
  function load(key, def) { try { var v = localStorage.getItem('goldenchess.' + key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem('goldenchess.' + key, JSON.stringify(val)); } catch (e) { /* private mode */ } }
  var lastSetup = Object.assign({ mode: 'bot', level: 3, color: 'w', tc: '5+0' }, load('setup', {}));
  var stats = load('stats', {});

  var TCS = ['1+0', '3+0', '3+2', '5+0', '10+0', '15+10', 'none'];
  function parseTc(s) {
    if (!s || s === 'none') return null;
    var m = /^(\d+)\+(\d+)$/.exec(s);
    return m ? { base: +m[1] * 60000, inc: +m[2] * 1000, label: s } : null;
  }

  // ------------------------------------------------------------------ game model
  function Game(cfg, startFen) {
    this.cfg = cfg;
    this.startFen = startFen || GC.START_FEN;
    this.pos = new GC.Position(this.startFen);
    this.records = [];
    this.fens = [this.pos.fen()];
    this.rep = {}; this.rep[this.pos.hashKey()] = 1;
    this.clock = cfg.tc ? { t: [cfg.tc.base, cfg.tc.base], since: perf() } : null;
    this.status = 'playing'; this.result = null; this.reason = null;
    this.legal = this.pos.legalMoves(true);
  }
  Game.prototype.running = function () { return !!this.clock && this.status === 'playing' && this.records.length >= 2 && !this.paused; };
  Game.prototype.timeLeft = function (color, now) {
    if (!this.clock) return Infinity;
    var t = this.clock.t[color];
    if (this.running() && this.pos.side === color) t -= (now - this.clock.since);
    return t;
  };
  Game.prototype.freeze = function (now) {
    if (this.running()) { var c = this.pos.side; this.clock.t[c] = Math.max(0, this.clock.t[c] - (now - this.clock.since)); this.clock.since = now; }
  };
  Game.prototype.end = function (result, reason, now) {
    if (this.status !== 'playing') return;
    this.freeze(now == null ? perf() : now);
    this.status = 'over'; this.result = result; this.reason = reason;
  };
  Game.prototype.flag = function (color, now) {
    this.freeze(now);
    this.clock.t[color] = 0;
    if (!this.pos.hasMatingMaterial(color ^ 1)) this.end('1/2-1/2', 'timeout-insufficient', now);
    else this.end(color === 0 ? '0-1' : '1-0', 'timeout', now);
  };
  Game.prototype.checkFlag = function (now) {
    if (!this.running() || this.online) return false; // online: the server decides when a flag falls
    var c = this.pos.side;
    if (this.timeLeft(c, now) <= 0) { this.flag(c, now); return true; }
    return false;
  };
  // Apply a legal move. Returns the record, or null if the mover's flag had already fallen.
  Game.prototype.play = function (m, now) {
    if (this.status !== 'playing') return null;
    this.idle = false;
    var us = this.pos.side;
    if (this.running()) {
      var left = this.clock.t[us] - (now - this.clock.since);
      if (left <= 0 && !this.online) { this.flag(us, now); return null; }
      this.clock.t[us] = Math.max(0, left) + this.cfg.tc.inc;
    }
    var moving = this.pos.board[m & 127];
    var san = this.pos.san(m, this.legal);
    this.pos.makeMove(m);
    var rec = {
      m: m, uci: GC.moveToUci(m), san: san, golden: !!(m & F_GOLDEN), color: us, piece: moving,
      capture: !!(m & F_CAPTURE), castle: !!(m & F_CASTLE), promo: GC.mPromo(m), check: this.pos.inCheck(),
      clock: this.clock ? this.clock.t.slice() : null
    };
    this.records.push(rec);
    this.fens.push(this.pos.fen());
    var k = this.pos.hashKey(); this.rep[k] = (this.rep[k] || 0) + 1;
    if (this.clock) this.clock.since = now;
    this.legal = this.pos.legalMoves(true);
    if (!this.legal.length) {
      if (this.pos.inCheck()) this.end(us === 0 ? '1-0' : '0-1', 'checkmate', now);
      else this.end('1/2-1/2', 'stalemate', now);
    } else if (this.rep[k] >= 3) this.end('1/2-1/2', 'repetition', now);
    else if (this.pos.halfmove >= 100) this.end('1/2-1/2', 'fifty', now);
    else if (this.pos.insufficientMaterial()) this.end('1/2-1/2', 'insufficient', now);
    return rec;
  };
  Game.prototype.truncate = function (n, now) {
    var keep = this.records.slice(0, n);
    var g = new Game(this.cfg, this.startFen), t = now;
    for (var i = 0; i < keep.length; i++) { g.play(keep[i].m, t); }
    this.pos = g.pos; this.records = keep; this.fens = g.fens; this.rep = g.rep; this.legal = g.legal;
    this.status = 'playing'; this.result = null; this.reason = null;
    if (this.clock) {
      this.clock.t = n > 0 && keep[n - 1].clock ? keep[n - 1].clock.slice() : [this.cfg.tc.base, this.cfg.tc.base];
      this.clock.since = now;
    }
  };
  Game.prototype.serialize = function () {
    return {
      v: 1, cfg: { mode: this.cfg.mode, level: this.cfg.level, bot: this.cfg.bot || null, human: this.cfg.human, tc: this.cfg.tc ? this.cfg.tc.label : 'none', career: this.cfg.career || null },
      startFen: this.startFen, moves: this.records.map(function (r) { return r.uci; }),
      clocks: this.records.map(function (r) { return r.clock; }), clock: this.clock ? this.clock.t.slice() : null,
      status: this.status, result: this.result, reason: this.reason, counted: !!this.counted, histKey: this.histKey || null
    };
  };
  Game.restore = function (d) {
    if (!d || d.v !== 1) return null;
    try {
      var cfg = { mode: d.cfg.mode, level: d.cfg.level, bot: d.cfg.bot || (d.cfg.career && d.cfg.career.who) || null, human: d.cfg.human, tc: parseTc(d.cfg.tc), career: d.cfg.career || null };
      var g = new Game(cfg, d.startFen), now = perf();
      var savedClock = g.clock;
      g.clock = null; // replay without time accounting
      for (var i = 0; i < d.moves.length; i++) {
        var m = g.pos.moveFromUci(d.moves[i]);
        if (!m) break;
        g.play(m, now);
        g.records[i].clock = d.clocks && d.clocks[i] ? d.clocks[i] : null;
      }
      g.clock = savedClock;
      if (g.clock && d.clock) { g.clock.t = d.clock.slice(); g.clock.since = now; }
      if (d.status === 'over') { g.status = 'over'; g.result = d.result; g.reason = d.reason; }
      g.counted = !!d.counted; g.histKey = d.histKey || null;
      return g;
    } catch (e) { return null; }
  };

  // ------------------------------------------------------------------ engine client (Web Worker, sync fallback)
  function EngineClient() { this.w = null; this.pending = {}; this.busy = false; this.fallback = false; this.spawn(); }
  EngineClient.prototype.spawn = function () {
    var self = this;
    try {
      var url = URL.createObjectURL(new Blob([$('engine-src').textContent], { type: 'text/javascript' }));
      var w = new Worker(url);
      w.onmessage = function (e) {
        var d = e.data, p = self.pending[d.id];
        if (!p) return;
        if (d.type === 'info') { if (p.info) p.info(d.info); return; }
        if (d.type === 'reviewStep') { if (p.step) p.step(d); return; }
        delete self.pending[d.id]; self.busy = Object.keys(self.pending).length > 0;
        p.done(d.res);
      };
      w.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); self.toFallback(); };
      this.w = w;
    } catch (e) { this.fallback = true; }
  };
  EngineClient.prototype.toFallback = function () {
    if (this.fallback) return;
    this.fallback = true;
    try { if (this.w) this.w.terminate(); } catch (e) { /* ignore */ }
    this.w = null;
    var pend = this.pending; this.pending = {}; this.busy = false;
    for (var id in pend) this.runSync(pend[id].req, pend[id].done);
  };
  EngineClient.prototype.runSync = function (req, done) {
    setTimeout(function () {
      var r = Engine.think({ fen: req.fen, moves: req.moves, timeMs: Math.min(req.timeMs || 300, 300), level: req.level, lv: req.lv, analysis: req.analysis, noGoldenRoot: !!req.noGoldenRoot });
      done(r);
    }, 30);
  };
  EngineClient.prototype.think = function (req, done, info) {
    if (this.fallback || !this.w) { this.runSync(req, done); return; }
    this.pending[req.id] = { req: req, done: done, info: info };
    this.busy = true;
    this.w.postMessage(Object.assign({ type: 'think' }, req));
  };
  EngineClient.prototype.review = function (req, step, done) {
    var self = this;
    if (this.fallback || !this.w) {
      // no worker: analyse position by position on the main thread, yielding between positions
      var i = req.from || 0, n = req.to != null ? req.to : req.moves.length;
      (function next() {
        if (self.reviewToken !== req.id) return;
        if (i > n) { done({ done: true }); return; }
        var st = Engine.reviewStep(req.fen, req.moves.slice(0, i), { depth: Math.min(req.depth || 8, 8), timeMs: Math.min(req.timeMs, 300) });
        st.i = i; step(st);
        i++; setTimeout(next, 16);
      })();
      this.reviewToken = req.id;
      return;
    }
    this.pending[req.id] = { req: req, done: done, step: step };
    this.busy = true;
    this.w.postMessage(Object.assign({ type: 'review' }, req));
  };
  EngineClient.prototype.cancel = function () {
    this.reviewToken = 0;
    if (this.busy && this.w) { try { this.w.terminate(); } catch (e) { /* ignore */ } this.w = null; this.pending = {}; this.busy = false; this.spawn(); }
  };
  EngineClient.prototype.clear = function () { if (this.w) this.w.postMessage({ type: 'clear' }); };
  // done with this engine: its worker (and the memory of its search table) goes
  EngineClient.prototype.destroy = function () { this.reviewToken = 0; try { if (this.w) this.w.terminate(); } catch (e) { /* ignore */ } this.w = null; this.pending = {}; this.busy = false; };

  // ------------------------------------------------------------------ state
  var app = $('app'), boardEl = $('board');
  var game = null, view = 0, selected = -1, premoves = [], goldenArmed = false, orient = 0;
  var botReq = null, reqSeq = 0, lowWarned = false, pendingPromo = false, plyBoards = {}, pendingRecapture = null, analysisArrow = null;
  var analysis = { on: false, id: 0, info: null, ply: -1 };
  var bot = new EngineClient(), anaClient = null, chkClient = null;
  var explore = null;   // free analysis line after the game: { base, fens[], records[], view }
  var review = null;    // engine review of the finished game
  var posCache = {};
  var currentDialog = null, toastTimer = 0;
  var clockEls = {}, lastClockText = {};

  var board = new BoardView(boardEl, {
    onAny: function () { Sound.unlock(); },
    onDown: onBoardDown, onTap: onBoardTap, onDrop: onBoardDrop, onRight: onBoardRight
  });

  function live() { return !explore && view === game.records.length; }
  function botGame() { return game.cfg.mode === 'bot'; }
  function onlineGame() { return game.cfg.mode === 'online'; }
  function oppGame() { return game.cfg.mode === 'bot' || game.cfg.mode === 'online'; } // one human side vs an opponent
  function spectating() { return onlineGame() && !!game.cfg.spectator; }
  // after the game the board is a free analysis board: either side may move, which starts a variation
  function canMoveNow() {
    if (pendingPromo) return false;
    if (game.status !== 'playing') return true;
    if (spectating()) return false;
    return live() && (!oppGame() || game.pos.side === game.cfg.human);
  }
  function canPremove() { return settings.premoves && game.status === 'playing' && live() && oppGame() && !spectating() && game.pos.side !== game.cfg.human && !pendingPromo; }
  function goldenColor() { if (game.status !== 'playing') return viewPos().side; return oppGame() ? game.cfg.human : game.pos.side; }
  function posFromFen(fen) { var p = posCache[fen]; if (!p) { p = new GC.Position(fen); posCache[fen] = p; } return p; }
  function viewFen() { return explore ? explore.fens[explore.view] : game.fens[view]; }
  function viewPos() { if (!explore && view === game.records.length) return game.pos; return posFromFen(viewFen()); }
  function movePos() { return game.status === 'playing' ? game.pos : viewPos(); }
  function moveLegal() { var p = movePos(); if (p === game.pos) return game.legal; return p._legal || (p._legal = p.legalMoves(true)); }
  function viewMovesUci() {
    var mv = game.records.slice(0, explore ? explore.base : view).map(function (r) { return r.uci; });
    if (explore) mv = mv.concat(explore.records.slice(0, explore.view).map(function (r) { return r.uci; }));
    return mv;
  }
  function goldenQueued() { for (var i = 0; i < premoves.length; i++) if (premoves[i].golden) return true; return false; }
  function goldenCapable(code) { var t = code & 7; return t >= 2 && t <= 5; }

  function boardAtPly(k) {
    if (k === game.records.length) return game.pos.board;
    if (!plyBoards[k]) plyBoards[k] = new GC.Position(game.fens[k]).board;
    return plyBoards[k];
  }
  function displayBoard() {
    if (explore) return posFromFen(explore.fens[explore.view]).board;
    if (!live()) return boardAtPly(view);
    return game.pos.board;
  }

  // geometric premove targets (ignores blockers, as on lichess/chess.com)
  function premoveDests(b, sq, golden) {
    var p = b[sq], color = p >> 3, t = p & 7, out = [];
    if (golden) {
      if (!goldenCapable(p)) return out;
      for (var s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if (s !== sq && (!b[s] || (b[s] >> 3) !== color)) out.push(s); }
      return out;
    }
    function add(x) { if (!(x & 0x88) && x !== sq) out.push(x); }
    if (t === 1) {
      var fwd = color ? -16 : 16; add(sq + fwd); add(sq + fwd - 1); add(sq + fwd + 1);
      if ((sq >> 4) === (color ? 6 : 1)) add(sq + 2 * fwd);
    } else if (t === 2) GC.KNIGHT_D.forEach(function (d) { add(sq + d); });
    else if (t === 6) {
      GC.KING_D.forEach(function (d) { add(sq + d); });
      var home = color ? 116 : 4;
      if (sq === home) { if (game.pos.castling & (color ? 4 : 1)) add(home + 2); if (game.pos.castling & (color ? 8 : 2)) add(home - 2); }
    } else {
      var dirs = t === 3 ? GC.DIAG_D : t === 4 ? GC.ORTHO_D : GC.KING_D;
      dirs.forEach(function (d) { var x = sq + d; while (!(x & 0x88)) { out.push(x); x += d; } });
    }
    return out;
  }
  function defends(b, from, to) {
    var p = b[from], t = p & 7, color = p >> 3, d = to - from, i;
    if (t === 1) return d === (color ? -15 : 15) || d === (color ? -17 : 17);
    if (t === 2) return GC.KNIGHT_D.indexOf(d) >= 0;
    if (t === 6) return GC.KING_D.indexOf(d) >= 0;
    var dirs = t === 3 ? GC.DIAG_D : t === 4 ? GC.ORTHO_D : GC.KING_D;
    for (i = 0; i < dirs.length; i++) {
      var x = from + dirs[i];
      while (!(x & 0x88)) { if (x === to) return true; if (b[x]) break; x += dirs[i]; }
    }
    return false;
  }
  function legalTargets(sq, golden) {
    var out = [];
    var legal = moveLegal();
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if ((m & 127) === sq && !!(m & F_GOLDEN) === golden) { var to = (m >> 7) & 127; if (out.indexOf(to) < 0) out.push(to); }
    }
    return out;
  }
  function currentDests() {
    if (selected < 0) return [];
    if (canMoveNow()) return legalTargets(selected, goldenArmed);
    if (canPremove()) return premoveDests(displayBoard(), selected, goldenArmed && game.pos.goldenAvailable(game.cfg.human) && !goldenQueued());
    return [];
  }

  // ------------------------------------------------------------------ board input
  function onBoardDown(sq) {
    if (!game) return null;
    if (currentDialog) return null;
    if (game.status === 'playing' && !live()) { gotoPly(game.records.length); return null; }
    var mode = canMoveNow() ? 'move' : canPremove() ? 'pre' : null;
    if (!mode) return null;
    var mp = movePos(), b = mode === 'pre' ? displayBoard() : mp.board;
    var color = mode === 'pre' ? game.cfg.human : mp.side;
    var piece = b[sq], own = piece && (piece >> 3) === color;
    pendingRecapture = null;
    if (selected >= 0 && selected !== sq && !own) {
      if (currentDests().indexOf(sq) >= 0) { tryMove(selected, sq, false); return null; }
    }
    if (own) {
      if (goldenArmed && !goldenCapable(piece)) { toast(T('goldenOnly')); select(-1); return null; }
      // premove onto your own defended piece = recapture if it gets taken (decided on release: a tap queues it, a drag moves the tapped piece)
      if (mode === 'pre' && !goldenArmed && selected >= 0 && selected !== sq && defends(b, selected, sq)) pendingRecapture = { from: selected, to: sq };
      var was = selected === sq;
      select(sq);
      return { drag: true, wasSelected: was, gold: goldenArmed };
    }
    select(-1);
    if (premoves.length) cancelPremoves(false);
    return null;
  }
  function onBoardTap(sq, wasSelected) {
    var pr = pendingRecapture; pendingRecapture = null;
    if (pr && pr.to === sq && canPremove()) { selected = pr.from; if (tryMove(pr.from, pr.to, false)) return; }
    if (wasSelected && selected === sq) select(-1);
  }
  function onBoardDrop(from, to) {
    pendingRecapture = null;
    if (selected !== from) select(from);
    var ok = tryMove(from, to, true);
    if (!ok) select(-1);
    return ok;
  }
  function onBoardRight() {
    if (premoves.length) cancelPremoves(false);
    select(-1);
  }
  function select(sq) {
    selected = sq;
    renderMarks();
    if (sq >= 0) Sound.play('select');
  }

  function tryMove(from, to, viaDrag) {
    if (canMoveNow()) {
      var golden = goldenArmed, cands = [], legal = moveLegal(), mp = movePos();
      for (var i = 0; i < legal.length; i++) {
        var m = legal[i];
        if ((m & 127) === from && ((m >> 7) & 127) === to && !!(m & F_GOLDEN) === golden) cands.push(m);
      }
      if (!cands.length) return false;
      if (cands.length > 1) {
        if (settings.autoQueen) { humanMove(cands.filter(function (c) { return GC.mPromo(c) === 5; })[0], viaDrag); return true; }
        var color = mp.side, tmp = new Int8Array(mp.board), wasOver = game.status !== 'playing';
        tmp[to] = tmp[from]; tmp[from] = 0;
        pendingPromo = true; selected = -1;
        board.sync(tmp, [{ from: from, to: to, instant: viaDrag }]);
        renderMarks();
        board.askPromotion(to, color, function (t) {
          pendingPromo = false;
          var pick = t ? cands.filter(function (c) { return GC.mPromo(c) === t; })[0] : 0;
          var stillOk = wasOver ? game.status !== 'playing' : (game.status === 'playing' && live());
          if (!pick || !stillOk) { board.sync(displayBoard(), []); renderMarks(); return; }
          humanMove(pick, true);
        });
        return true;
      }
      humanMove(cands[0], viaDrag);
      return true;
    }
    if (canPremove()) {
      var b = displayBoard(), p = b[from];
      if (!p || (p >> 3) !== game.cfg.human) return false;
      var g = goldenArmed && game.pos.goldenAvailable(game.cfg.human) && !goldenQueued();
      if (premoveDests(b, from, g).indexOf(to) < 0) return false;
      var promo = ((p & 7) === 1 && ((to >> 4) === 7 || (to >> 4) === 0)) ? 5 : 0;
      var stay = !g && !!b[to] && (b[to] >> 3) === game.cfg.human;
      premoves = [{ from: from, to: to, promo: promo, golden: g, stay: stay }]; // one premove at a time: a new one replaces the old
      if (g) setGoldenArmed(false);
      selected = -1;
      board.sync(displayBoard(), []);
      renderMarks(); renderControls();
      Sound.play('premove');
      return true;
    }
    return false;
  }

  function humanMove(m, instant) {
    if (game.status !== 'playing') exploreMove(m, instant);
    else commit(m, instant, 'human');
  }
  function makeRecord(pos, m) {
    var legal = pos._legal || (pos._legal = pos.legalMoves(true));
    var rec = { m: m, uci: GC.moveToUci(m), san: pos.san(m, legal), golden: !!(m & F_GOLDEN), color: pos.side, piece: pos.board[m & 127],
      capture: !!(m & F_CAPTURE), castle: !!(m & F_CASTLE), promo: GC.mPromo(m) };
    return rec;
  }
  // a move on the analysis board after the game: starts or extends a variation (never touches the game record)
  function exploreMove(m, instant) {
    var from = viewPos(), rec = makeRecord(from, m), np = new GC.Position(from.fen());
    np.makeMove(m);
    rec.check = np.inCheck();
    if (!explore) explore = { base: view, fens: [game.fens[view]], records: [], view: 0 };
    if (explore.line) { stopLine(); explore.line = null; } // a move of your own: from here it is your line
    explore.records = explore.records.slice(0, explore.view); explore.fens = explore.fens.slice(0, explore.view + 1);
    explore.records.push(rec); explore.fens.push(np.fen()); explore.view = explore.records.length;
    if (goldenArmed) setGoldenArmed(false);
    selected = -1;
    board.sync(displayBoard(), hintsFor(rec, instant));
    moveSound(rec);
    if (explore.retry && explore.records.length === 1) retryCheck(explore, rec);
    renderAll();
    if (analysis.on) requestAnalysis();
  }
  // toRet: back to the move the coach was on (a line or a retry starts from the position before it)
  function exitExplore(toRet) {
    if (!explore) return;
    stopLine();
    view = toRet === true && explore.ret != null ? explore.ret : explore.base; explore = null; selected = -1;
    if (goldenArmed) setGoldenArmed(false);
    board.sync(displayBoard(), []);
    renderAll();
    if (analysis.on) requestAnalysis();
  }
  // ---- the coach's buttons: the follow-up after a move or the best line, played on the board; another try at the move
  var lineTimer = 0;
  function stopLine() { clearTimeout(lineTimer); lineTimer = 0; }
  function lineRecords(fen, ucis) {
    var fens = [fen], records = [];
    for (var k = 0; k < ucis.length; k++) {
      var q = new GC.Position(fens[k]), m = q.moveFromUci(ucis[k]);
      if (!m) break;
      var rec = makeRecord(q, m);
      q.makeMove(m); rec.check = q.inCheck();
      records.push(rec); fens.push(q.fen());
    }
    return { fens: fens, records: records };
  }
  function showLine(kind, ply) {
    var mv = review.moves[ply], st = kind === 'best' ? mv.line : mv.follow;
    if (!st || !st.ucis.length) return;
    stopLine();
    var base = kind === 'best' ? ply : ply + 1, lr = lineRecords(game.fens[base], st.ucis);
    if (goldenArmed) setGoldenArmed(false);
    selected = -1; view = ply + 1;
    var E = explore = { base: base, fens: lr.fens, records: lr.records, view: 0, ret: ply + 1, line: { kind: kind, ply: ply } };
    board.sync(displayBoard(), []);
    renderAll(); requestAnalysis();
    (function step() {
      if (explore !== E || !E.line || E.view >= E.records.length) { lineTimer = 0; return; }
      lineTimer = setTimeout(function () {
        if (explore !== E || !E.line) return;
        var rec = E.records[E.view]; E.view++;
        board.sync(displayBoard(), hintsFor(rec, false)); moveSound(rec);
        renderAll(); requestAnalysis();
        step();
      }, E.view === 0 ? 450 : 950);
    })();
  }
  function startRetry(ply) {
    stopLine();
    if (goldenArmed) setGoldenArmed(false);
    selected = -1; view = ply + 1;
    explore = { base: ply, fens: [game.fens[ply]], records: [], view: 0, ret: ply + 1, retry: { ply: ply, state: 'ask', tries: 0 } };
    board.sync(displayBoard(), []);
    renderAll(); requestAnalysis();
  }
  // the engine's verdict on a retry: the same depth as the review, against the best move's score there
  function retryCheck(E, rec) {
    var R = E.retry, best = review && review.scores[E.base];
    if (!best) return;
    // (a blind review holds the move against the best normal move: so does the retry)
    if (review.blind && best.alt && String(best.uci).indexOf('*') >= 0 && !game.records[E.base].golden) best = best.alt;
    R.tries++; R.san = rec.san; R.uci = rec.uci; R.story = null; R.drop = 0;
    if (rec.uci === best.uci) { R.state = 'right'; return; }
    R.state = 'checking';
    var id = R.req = ++reqSeq;
    if (!chkClient) chkClient = new EngineClient();
    chkClient.cancel();
    var moves = game.records.slice(0, E.base).map(function (r) { return r.uci; }).concat([rec.uci]);
    chkClient.think({ id: id, fen: game.startFen, moves: moves, timeMs: Engine.REVIEW_CAP, maxDepth: Engine.REVIEW_DEPTH, level: 8, analysis: true }, function (res) {
      if (explore !== E || R.req !== id || !res) return;
      var drop = Math.max(0, winPct(cpOf(best)) - winPct(-cpOf({ score: res.score, mate: res.mate || 0 })));
      R.drop = drop; R.state = drop < 2 ? 'excellent' : drop < 5 ? 'good' : 'wrong'; R.score = { score: res.score, mate: res.mate || 0 };
      R.story = GCReview.story(E.fens[1], res.pv && res.pv.length ? res.pv : (res.uci ? [res.uci] : []), rec.color, 8, review && review.blind ? { blind: true } : null);
      renderReview();
    });
  }
  function coachAct(act) {
    if (act === 'hide') { exitExplore(true); return; }
    if (act === 'jk') { jkTap(); return; } // the Joker analysis, asked for from the move it would speak of
    var ply = explore ? (explore.line ? explore.line.ply : explore.retry ? explore.retry.ply : -1) : view - 1;
    if (ply < 0 || !review || !review.moves || !review.moves[ply]) return;
    if (act === 'follow' || act === 'best') showLine(act, ply);
    else if (act === 'retry' || act === 'again') startRetry(ply);
  }
  function navStep(dir) {
    if (!game) return;
    if (explore) {
      stopLine();
      var k = explore.view + dir;
      if (k < 0) { exitExplore(); return; }
      if (k > explore.records.length) return;
      var prev = explore.view, rec;
      explore.view = k; selected = -1;
      if (k > prev) { rec = explore.records[prev]; board.sync(displayBoard(), hintsFor(rec, false)); moveSound(rec); }
      else { rec = explore.records[k]; board.sync(displayBoard(), reverseHints(rec)); Sound.play(rec.capture ? 'capture' : 'move', 0.8); }
      renderAll();
      if (analysis.on) requestAnalysis();
      return;
    }
    gotoPly(view + dir);
  }

  function hintsFor(rec, instant) {
    var from = rec.m & 127, to = (rec.m >> 7) & 127;
    var hints = [{ from: from, to: to, golden: rec.golden, instant: instant, code: rec.piece }];
    if (rec.castle) {
      var rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      hints.push({ from: rf, to: rt, instant: instant, code: (rec.piece & 8) | 4 });
    }
    return hints;
  }
  function reverseHints(rec) {
    var from = rec.m & 127, to = (rec.m >> 7) & 127, after = rec.promo ? ((rec.piece & 8) | rec.promo) : rec.piece;
    var hints = [{ from: to, to: from, golden: rec.golden, code: after }];
    if (rec.castle) {
      var rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      hints.push({ from: rt, to: rf, code: (rec.piece & 8) | 4 });
    }
    return hints;
  }

  function commit(m, instant, by) {
    var now = perf(), wasLive = live();
    if (game.checkFlag(now)) { gameOver(); return null; }
    var rec = game.play(m, now);
    if (!rec) { gameOver(); return null; }
    var theirs = by === 'bot' || by === 'opp';
    // the opponent's move keeps your golden mode and selection (you may have armed it while they thought)
    var keepSel = theirs && selected >= 0 && !premoves.length && wasLive;
    if (rec.golden ? rec.color === goldenColor() || !oppGame() : (goldenArmed && !theirs)) setGoldenArmed(false);
    view = game.records.length; plyBoards = {};
    if (!keepSel || !game.pos.board[selected] || (game.pos.board[selected] >> 3) !== game.cfg.human) selected = -1;
    board.sync(displayBoard(), hintsFor(rec, instant));
    moveSound(rec);
    // the special moments, felt: a Joker Move by either side, a check against me
    if (rec.golden) haptic('joker'); else if (rec.check && theirs) haptic('check');
    if (rec.golden && !theirs && wasLive) Track.event('joker_move', { mode: game.online ? 'online' : game.cfg.mode, ply: game.records.length });
    if (rec.golden && (theirs || !oppGame())) toast(T('goldenPlayed', { side: sideLabel(rec.color), san: rec.san }), 'gold');
    if (analysis.on) setAnalysis(false);
    if (onlineGame() && !theirs) sendMove(rec);
    renderAll();
    persist();
    if (game.status !== 'playing') { gameOver(); return rec; }
    if (oppGame()) {
      if (game.pos.side === game.cfg.human) { if (theirs && premoves.length) runPremove(); }
      else if (botGame()) requestBot();
    }
    return rec;
  }
  function runPremove() {
    var pm = premoves.shift();
    var m = game.pos.findMove(pm.from, pm.to, pm.promo || 5, pm.golden);
    if (!m) { premoves.unshift(pm); cancelPremoves(true); return; }
    commit(m, true, 'premove');
  }
  function cancelPremoves(announce) {
    if (!premoves.length) return;
    premoves = [];
    board.sync(displayBoard(), []);
    renderMarks(); renderControls();
    if (announce) { Sound.play('cancel'); toast(T('premoveCancelled')); }
  }
  function moveSound(rec) {
    if (rec.golden) Sound.play('golden');
    else if (rec.check) Sound.play('check');
    else if (rec.promo) Sound.play('promote');
    else if (rec.castle) Sound.play('castle');
    else if (rec.capture) Sound.play('capture');
    else Sound.play('move');
  }

  // ------------------------------------------------------------------ bot
  // The bot thinks like a person: quick in the opening, on forced moves and recaptures, longer when the position is rich,
  // never the same time twice, and a real pause before its Joker Move. Bot games have no clock; older games that do
  // still never lose on time.
  var THINK_BASE = [950, 1150, 1350, 1550, 1800, 2100, 2400, 2700];
  function gauss() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function botThinkMs(uci) {
    var pos = game.pos, lvl = game.cfg.level, n = game.records.length, moveNo = Math.floor(n / 2) + 1;
    var normal = 0; game.legal.forEach(function (x) { if (!(x & F_GOLDEN)) normal++; });
    var m = uci ? pos.moveFromUci(uci) : 0, golden = !!(m && (m & F_GOLDEN)), last = n ? game.records[n - 1] : null;
    var recapture = !!(m && last && last.capture && (m & F_CAPTURE) && ((m >> 7) & 127) === ((last.m >> 7) & 127));
    var ms;
    if (normal <= 1 && !golden) ms = 380 + Math.random() * 420;
    else {
      ms = THINK_BASE[lvl - 1];
      ms *= moveNo <= 2 ? 0.42 : moveNo <= 5 ? 0.6 : moveNo <= 10 ? 0.85 : 1;
      ms *= Math.max(0.7, Math.min(1.35, 0.72 + normal / 70));
      if (pos.inCheck()) ms *= 0.85;
      ms *= Math.exp(gauss() * 0.33);
      if (moveNo > 8 && Math.random() < 0.12) ms *= 1.8;
      if (recapture) ms = Math.min(ms, 450 + Math.random() * 550);
      if (moveNo <= 8) ms = Math.min(ms, 1300 + Math.random() * 1700); // early moves come quickly even out of book
      if (golden) ms = ms * 1.3 + 900;
      ms = Math.max(450, Math.min(lvl >= 6 ? 9000 : 6500, ms));
    }
    if (game.clock) {
      var left = game.timeLeft(pos.side, perf()), inc = game.cfg.tc.inc;
      ms = Math.min(ms, Math.max(120, left / 28 + inc * 0.6));
      if (left < 10000) ms = Math.min(ms, 150 + Math.random() * 200);
    }
    return ms;
  }
  // who the bot of a game is: one of the sixteen (games saved before they had names of their own: by the engine level)
  function botOf(cfg) { return Progress.bot(cfg.bot) || Progress.levelBot(cfg.level); }
  function botName() { return window.GCBots ? GCBots.castName(botOf(game.cfg).who, lang) : T('bot'); }
  function botFaceHtml() { return GCBots.castAvatar(botOf(game.cfg).who, lang); }
  function botElo() { return botOf(game.cfg).elo; }
  // a bot's score against the player: the eight that play an engine level keep the key they always had
  function botStatKey(b) { return b.lv ? 'B' + b.who : 'L' + b.level; }
  function requestBot() {
    if (!botGame() || game.status !== 'playing' || game.pos.side === game.cfg.human) return;
    cancelBot();
    var id = ++reqSeq, t0 = perf(), color = game.pos.side, lvl = game.cfg.level, own = botOf(game.cfg).lv || null;
    var budget = (own || Engine.LEVELS[lvl - 1]).time;
    if (game.clock) {
      var left = game.timeLeft(color, t0), inc = game.cfg.tc.inc;
      budget = Math.min(budget, Math.max(40, left / 32 + inc * 0.7));
      if (left < 4000) budget = Math.min(budget, Math.max(15, left / 60));
    }
    botReq = { id: id, timer: 0 };
    renderBars(); renderSide();
    var moves = game.records.map(function (r) { return r.uci; });
    // the opening from the book (the engine's noise at the lower levels picks odd moves there), played quickly
    var book = game.startFen === GC.START_FEN && window.GCBook ? GCBook.pick(moves, lvl) : null;
    var answer = function (res, fromBook) {
      if (!botReq || botReq.id !== id) return;
      var wait = Math.max(0, (window.__gcFastBot ? 0 : fromBook ? bookThinkMs(1) : botThinkMs(res && res.uci)) - (perf() - t0));
      botReq.timer = setTimeout(function () {
        if (!botReq || botReq.id !== id) return;
        botReq = null;
        if (game.status !== 'playing' || game.pos.side === game.cfg.human) return;
        var m = res && res.uci ? game.pos.moveFromUci(res.uci) : 0;
        if (!m) m = game.legal[0];
        if (m) commit(m, false, 'bot');
      }, wait);
    };
    if (book) answer({ uci: book }, true);
    else bot.think({ id: id, fen: game.startFen, moves: moves, timeMs: budget, level: lvl, lv: own || undefined }, answer);
  }
  // a book move takes a moment, as if remembered (now and then a little longer); tempo scales it (house players)
  function bookThinkMs(tempo) {
    var ms = 350 + Math.random() * 650;
    if (Math.random() < 0.1) ms = 1200 + Math.random() * 1200;
    return ms * (tempo || 1);
  }
  function cancelBot() {
    if (botReq) { clearTimeout(botReq.timer); botReq = null; }
  }

  // ------------------------------------------------------------------ golden button
  function setGoldenArmed(v) {
    goldenArmed = !!v;
    boardEl.classList.toggle('armed', goldenArmed);
    board.markGolden(goldenArmed ? goldenColor() : -1);
    if (goldenArmed && selected >= 0) {
      var b = displayBoard();
      if (!b[selected] || !goldenCapable(b[selected])) selected = -1;
    }
    renderMarks(); renderControls();
  }
  function onGoldenButton() {
    Sound.unlock();
    if (!game) return;
    if (game.status === 'playing' && !live()) gotoPly(game.records.length);
    var c = goldenColor();
    if (goldenArmed) { setGoldenArmed(false); return; }
    if (!movePos().goldenAvailable(c) || (canPremove() && goldenQueued())) { toast(T('goldenGone')); return; }
    if (!canMoveNow() && !canPremove()) return;
    setGoldenArmed(true);
  }

  // ------------------------------------------------------------------ navigation
  function gotoPly(k) {
    if (!game) return;
    if (explore) { stopLine(); var base = explore.base; explore = null; view = base; board.sync(displayBoard(), []); }
    k = Math.max(0, Math.min(game.records.length, k));
    if (k === view) { renderAll(); if (analysis.on) requestAnalysis(); return; }
    var prev = view, hints = [], rec = null;
    view = k;
    if (k !== game.records.length) { selected = -1; board.closePromotion(); }
    if (k === prev + 1) { rec = game.records[prev]; hints = hintsFor(rec, false); }
    else if (k === prev - 1) { rec = game.records[k]; hints = reverseHints(rec); }
    board.sync(displayBoard(), hints);
    if (rec) { if (k > prev) moveSound(rec); else Sound.play(rec.capture ? 'capture' : 'move', 0.8); }
    renderAll();
    if (analysis.on) requestAnalysis();
  }

  // ------------------------------------------------------------------ analysis
  function setAnalysis(on) {
    analysis.on = !!on; analysis.info = null; analysis.id = ++reqSeq;
    $('evalbar').hidden = !analysis.on;
    if (!analysis.on) { if (anaClient) anaClient.cancel(); analysisArrow = null; refreshArrows(); renderAna(); layout(); return; }
    requestAnalysis();
  }
  function requestAnalysis() {
    if (!analysis.on) return;
    if (!anaClient) anaClient = new EngineClient();
    anaClient.cancel();
    var id = analysis.id = ++reqSeq, ply = view;
    analysis.ply = ply; analysis.info = null;
    analysisArrow = null;
    var rv = !explore && review && review.scores[view];
    if (rv) { analysis.info = { score: rv.score, mate: rv.mate, uci: rv.uci, depth: rv.depth, final: true, fromReview: true }; renderAna(); return; }
    if (explore && (explore.line || explore.retry) && review && review.scores[explore.base]) {
      // the line keeps its score; a retry shows the position's score without giving the move away
      var e0 = review.scores[explore.base], flip = posFromFen(explore.fens[0]).side !== viewPos().side;
      analysis.info = { score: flip ? -e0.score : e0.score, mate: flip ? -(e0.mate || 0) : (e0.mate || 0), uci: null, depth: e0.depth, final: true, fromReview: true };
      renderAna(); return;
    }
    refreshArrows(); renderAna();
    var p = viewPos();
    if (!p.hasLegalMove()) { analysis.info = { final: true, score: p.inCheck() ? -30000 : 0, mate: 0, none: true }; renderAna(); return; }
    // (while the review is blind the engine's line is too: the best normal move, never a Joker Move nobody played)
    var req = { id: id, fen: game.startFen, moves: viewMovesUci(), timeMs: 3000, level: 8, analysis: true, noGoldenRoot: !!(review && review.blind) };
    anaClient.think(req, function (res) { if (analysis.id === id) { res.final = true; analysis.info = res; renderAna(); } },
      function (inf) { if (analysis.id === id) { analysis.info = inf; renderAna(); } });
  }
  function renderAna() {
    var targets = [$('ana'), $('ana-side')], html = '';
    var bar = $('evalbar').firstElementChild;
    if (analysis.on) {
      var inf = analysis.info, p = viewPos();
      if (!inf) html = '<span>' + esc(T('analysisStarting')) + '…</span>';
      else if (inf.none) html = '<span>' + esc(p.inCheck() ? T('mated') : T('noMoves')) + '</span>';
      else {
        var white = p.side === 0 ? 1 : -1, cp = inf.score * white, mate = inf.mate * white;
        var pct = mate ? (mate > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-cp / 360)) - 1);
        bar.style.width = pct.toFixed(1) + '%';
        var evalTxt = mate ? T('mateIn', { n: Math.abs(mate) }) + (mate > 0 ? ' (' + T('white') + ')' : ' (' + T('black') + ')') : (cp >= 0 ? '+' : '−') + (Math.abs(cp) / 100).toFixed(2);
        var m = inf.uci ? p.moveFromUci(inf.uci) : 0, san = m ? p.san(m) : '';
        // during the review the coach explains each move; the engine's own line is for free analysis
        if (inf.fromReview) { html = ''; analysisArrow = null; }
        else {
          html = '<span>' + esc(T('best')) + ': <b class="' + (m & F_GOLDEN ? 'gold' : '') + '">' + esc(san) + '</b></span><span><b>' + esc(evalTxt) + '</b></span><span>' + esc(T('depth', { n: inf.depth })) + '</span>';
          analysisArrow = m ? { from: m & 127, to: (m >> 7) & 127, gold: !!(m & F_GOLDEN) } : null;
        }
        refreshArrows();
      }
    } else {
      bar.style.width = '50%';
      if (game && game.online) html = onlineNotice();
    }
    targets.forEach(function (t) { if (t.innerHTML !== html) t.innerHTML = html; });
    renderReview();
    var ah = $('ana').offsetHeight;
    if (ah !== lastAnaH) { lastAnaH = ah; if (!app.classList.contains('wide')) layout(); }
  }
  var lastAnaH = 0;

  // ------------------------------------------------------------------ game review
  // the review's arithmetic lives in src/review.js (shared with the tests)
  var winPct = GCReview.winPct, cpOf = GCReview.cpOf;
  // the review's workers: a few run side by side, each through its own stretch of the game (phones have several cores)
  var revPool = [];
  function reviewWorkers(n) {
    var k = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1, Math.ceil((n + 1) / 12)));
    while (revPool.length < k) revPool.push(new EngineClient());
    return revPool.slice(0, k);
  }
  function startReview() {
    noteDay('review');
    if (game && game.records.length >= 2 && game.status === 'over') { var rk = (game.online && online ? online.id : game.histKey) || game.fens[game.fens.length - 1]; var fresh = prog.reviewed.indexOf(rk) < 0; if (fresh) { prog.reviewed = prog.reviewed.concat([rk]).slice(-60); } progSmall('review', fresh ? Progress.XP.review : 0); }
    if (!game || !game.records.length) return;
    stopReview();
    var id = ++reqSeq, n = game.records.length, key = gameKey(), cached = key ? reviewCacheGet(key, n) : null;
    review = { id: id, key: key, n: n, done: 0, scores: [], moves: null, sum: null, running: true };
    if (!analysis.on) { analysis.on = true; $('evalbar').hidden = false; }
    function finished() {
      review.running = false; computeReview(); reviewCachePut(review);
      revPool.forEach(function (c) { c.destroy(); }); revPool = []; // the review's workers are not needed until the next review
      renderAll(); renderReport(); if (analysis.on) requestAnalysis(); layout();
    }
    if (cached) { review.scores = cached; review.done = n + 1; finished(); return; }
    var moves = game.records.map(function (r) { return r.uci; }), pool = reviewWorkers(n), per = Math.ceil((n + 1) / pool.length), left = pool.length;
    pool.forEach(function (client, k) {
      var from = k * per, to = Math.min(n, from + per - 1);
      if (from > to) { left--; return; }
      client.review({ id: id * 10 + k, fen: game.startFen, moves: moves, from: from, to: to, depth: Engine.REVIEW_DEPTH, timeMs: Engine.REVIEW_CAP },
        function (st) {
          if (!review || review.id !== id) return;
          review.scores[st.i] = { score: st.score, mate: st.mate || 0, uci: st.uci, depth: st.depth, pv: st.pv || [], alt: st.alt || null };
          review.done++;
          if (review.done % 3 === 0) computeReview();
          if (!explore && view === st.i) requestAnalysis(); else { renderReview(); renderMoves(); renderMarks(); }
          renderReport();
        },
        function () { if (!review || review.id !== id) return; if (--left === 0) finished(); });
    });
    if (!left) finished();
    renderAll(); layout();
  }
  // ---- reviews kept on this device: the engine's scores (a review opens at once the next time) and each game's
  // accuracy for the history list. Key: o:<id> for online games, the history key for games on this device.
  var REVIEW_KEEP = 40, REVIEW_V = 2;
  function gameKey() { return !game ? null : game.onlineId ? 'o:' + game.onlineId : game.histKey || null; }
  function reviewCacheGet(key, n) {
    var c = load('reviewCache', null), e = c && c.items && c.items[key];
    if (!e || e.v !== REVIEW_V || e.n !== n || !e.s || e.s.length !== n + 1) return null;
    return e.s.map(function (x) { return { score: x[0], mate: x[1], uci: x[2], depth: 0, pv: x[3] ? x[3].split(' ') : [], alt: x[4] ? { score: x[4][0], mate: x[4][1], uci: x[4][2], pv: x[4][3] ? x[4][3].split(' ') : [] } : null }; });
  }
  function reviewCachePut(rv) {
    if (!rv || !rv.key || !rv.sum) return;
    var c = load('reviewCache', null) || { order: [], items: {} };
    c.items[rv.key] = { v: REVIEW_V, n: rv.n, s: rv.scores.map(function (e) { return [e.score, e.mate || 0, e.uci, (e.pv || []).join(' '), e.alt ? [e.alt.score, e.alt.mate || 0, e.alt.uci, (e.alt.pv || []).join(' ')] : 0]; }) };
    c.order = c.order.filter(function (k) { return k !== rv.key; }).concat(rv.key);
    while (c.order.length > REVIEW_KEEP) delete c.items[c.order.shift()];
    save('reviewCache', c);
    var sums = load('reviewSums', {});
    var fs = rv.fullSum || rv.sum, r1 = function (x) { return x ? Math.round(x.accuracy * 10) / 10 : null; };
    sums[rv.key] = { acc: fs.map(r1), miss: fs.map(function (x) { return x ? x.missed.length : 0; }) };
    if (rv.blindSum) sums[rv.key].accB = rv.blindSum.map(r1); // (the accuracy without the Joker analysis: what a game not opened shows)
    var keys = Object.keys(sums);
    if (keys.length > 600) keys.slice(0, keys.length - 600).forEach(function (k) { delete sums[k]; });
    save('reviewSums', sums);
  }

  // ---- the report (chess.com's Game Review): how each side played, and the Joker Moves that were there
  function reportCard() { return currentDialog && currentDialog.dataset.kind === 'report' ? currentDialog.querySelector('.sheetdlg') : null; }
  function showReport() {
    if (!game || !game.records.length) return;
    if (!review) startReview();
    openDialog(function (card) {
      currentDialog.dataset.kind = 'report';
      card.classList.add('report');
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) { closeDialog(); return; }
        if (e.target.closest('[data-jk]')) { jkTap(showReport); return; }
        if (e.target.closest('[data-pro]')) { Track.event('pro_gate', { why: 'check' }); proSheet('check', null, showReport); return; }
        var t = e.target.closest('[data-goto],[data-start]');
        if (!t) return;
        closeDialog();
        gotoPly(t.dataset.start ? 1 : +t.dataset.goto);
      });
      renderReport(card);
    });
  }
  function coachLine(s) {
    if (!s) return T('coShort');
    if (s.missed.length) return s.missed.length === 1 ? T('coMissed1') : T('coMissedN', { n: s.missed.length });
    if (s.golden && s.golden.cls && GOOD_CLS[s.golden.cls]) return T('coGolden');
    if (s.n < 8) return T('coShort');
    return s.accuracy >= 90 ? T('coGreat') : s.accuracy >= 80 ? T('coGood') : T('coOk');
  }
  var PHASE_ICON = { great: 'best', good: 'excellent', inaccuracy: 'inaccuracy', mistake: 'mistake' };
  function renderReport(card) {
    card = card || reportCard();
    if (!card || !review || !game) return;
    var me = reviewSide(), you = oppGame() && !spectating(), html = '<div class="rp-head"><div class="dlg-title">' + esc(T('review')) + '</div><button type="button" class="rp-close" id="btn-report-close" data-close="1" aria-label="' + esc(T('close')) + '">' + ICON.x + '</button></div>';
    if (review.running || !review.sum) {
      card.innerHTML = '<div class="rp-body">' + html + '<div class="rp-coach">' + esc(T('rpReviewing', { p: reviewPct() })) + '</div><div class="rv-progress rp-progress"><i style="width:' + reviewPct() + '%"></i></div>' + graphHtml() + '</div>';
      return;
    }
    var keepScroll = card.querySelector('.rp-body') ? card.querySelector('.rp-body').scrollTop : 0;
    var sum = review.sum;
    html += '<div class="rp-coach">' + esc(coachLine(sum[me])) + '</div>' + graphHtml();
    function row(label, cells, cls) { return '<div class="rp-row' + (cls ? ' ' + cls : '') + '"><span class="rp-lbl">' + label + '</span>' + cells.join('') + '</div>'; }
    var t = '<div class="rp-table">';
    t += row('', [0, 1].map(function (c) { return '<span class="rp-name' + (you && c === me ? ' me' : '') + '"><i class="pc-ic ' + BoardView.cls((c << 3) | 6) + '"></i><span>' + esc(sideLabel(c)) + '</span></span>'; }), 'rp-head');
    t += row(esc(T('accuracy')), [0, 1].map(function (c) { return '<span class="acc-box ' + (c ? 'b' : 'w') + '">' + (sum[c] ? sum[c].accuracy.toFixed(1) : '—') + '</span>'; }), 'rp-acc');
    GCReview.CLASSES.forEach(function (k) {
      var a = (sum[0] && sum[0].counts[k]) || 0, b = (sum[1] && sum[1].counts[k]) || 0;
      if (k === 'goldmiss' && !a && !b) return;
      t += row(clsIcon(k) + '<span>' + esc(T('c_' + k)) + '</span>', [a, b].map(function (v) { return '<b class="rp-n s-' + k + (v ? '' : ' zero') + '">' + v + '</b>'; }), 'rp-cls');
    });
    t += row(esc(T('rpGameRating')), [0, 1].map(function (c) { return '<span class="rp-v">' + (sum[c] && sum[c].elo ? sum[c].elo : '—') + '</span>'; }));
    var st = online && online.id === game.onlineId ? online.s : null;
    if (st && st.rated && st.white_diff != null) {
      t += row(esc(T('rpRating')), [0, 1].map(function (c) {
        var before = c ? st.black_rating : st.white_rating, d = c ? st.black_diff : st.white_diff;
        return '<span class="rp-v">' + (before + d) + ' <em class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</em></span>';
      }));
    }
    ['opening', 'middlegame', 'endgame'].forEach(function (ph) {
      if (!(sum[0] && sum[0].phases[ph]) && !(sum[1] && sum[1].phases[ph])) return;
      t += row(esc(T('rp' + ph.charAt(0).toUpperCase() + ph.slice(1))), [0, 1].map(function (c) {
        var p = sum[c] && sum[c].phases[ph];
        return '<span class="rp-v">' + (p ? clsIcon(PHASE_ICON[p.mark]) : '—') + '</span>';
      }));
    });
    t += row(esc(T('rpGolden')), [0, 1].map(function (c) {
      var g = sum[c] && sum[c].golden;
      return '<span class="rp-v rp-gm">' + (g ? (g.hide ? '' : clsIcon(g.cls)) + '<b class="gold">' + esc(g.san) + '</b>' : '<em>' + esc(T('rpGoldenNone')) + '</em>') + '</span>';
    }));
    t += '</div>';
    var g = jokerBlock(me, you);
    // the list scrolls, the main action stays at the bottom
    card.innerHTML = '<div class="rp-body">' + html + g + t + '</div><div class="rp-foot"><button type="button" class="primary rp-start" data-start="1" id="btn-start-review">' + esc(T('rpStart')) + '</button></div>';
    card.querySelector('.rp-body').scrollTop = keepScroll;
  }
  function stopReview() { if (review && review.running) revPool.forEach(function (c) { c.cancel(); }); if (review) review.running = false; }
  // (the Joker analysis not open yet: the review is blind, see src/review.js; the saved sums are the full review's)
  function computeReview() {
    var input = { fens: game.fens, records: game.records, scores: review.scores }, full = GCReview.analyze(input);
    var bl = PRO ? GCReview.analyze(input, { blind: true }) : null;
    review.blind = !!bl && !jkOpen();
    var a = review.blind ? bl : full;
    review.moves = a.moves; review.sum = a.sum; review.missed = a.missed; review.fullSum = full.sum; review.blindSum = bl ? bl.sum : null;
  }
  // ---- the report's Joker analysis. Open (Pro, or the free one used on this game, or nothing is sold here): each
  // side's Joker Move with its verdict, the ones that were missed (yours first; a tap shows the moment on the board),
  // or that there was none. Not open: one card that asks for it, the same whatever the game held.
  function jokerBlock(me, you) {
    var head = '<div class="rp-gold-h">' + STAR_SVG + '<b>' + esc(PRO ? PX('jkT') : T('rpMissed')) + '</b>';
    if (review.blind) {
      var left = PRO.checksLeft(proJk) > 0;
      return '<div class="rp-gold jk-ask" id="rp-missed">' + head + '</div><p class="jk-q">' + esc(PX('jkAsk')) + '</p>' +
        '<div class="jk-row"><button type="button" class="jk-btn' + (left ? '' : ' pro') + '" id="btn-jk" ' + (left ? 'data-jk="1"' : 'data-pro="1"') + '>' + (left ? '' : '<span class="pro-mark">' + esc(PX('mark')) + '</span>') + esc(PX(left ? 'jkShow' : 'jkPro')) + '</button>' +
        '<span class="jk-note" id="jk-note">' + esc(PX(left ? 'jkFree' : 'jkUsed')) + '</span></div></div>';
    }
    var sum = review.sum, missed = (review.missed || []).slice().sort(function (a, b) { return (a.color === me ? 0 : 1) - (b.color === me ? 0 : 1) || a.ply - b.ply; });
    var g = '<div class="rp-gold" id="rp-missed">' + head + '</div>', any = false;
    // the Joker Move each side played, and what it was worth
    (me ? [1, 0] : [0, 1]).forEach(function (c) {
      var x = sum[c] && sum[c].golden;
      if (!x) return;
      any = true;
      var better = x.best ? x.best.replace(/\*/g, '\u2605') : '';
      var verdict = x.cls === 'great' ? T('r_goldenGreat') : x.cls === 'good' && better ? T('r_goldenOk', { best: better }) : GOOD_CLS[x.cls] ? T('r_goldenGood') : better ? T('r_goldenWasted', { best: better }) : T('c_' + x.cls);
      g += '<button type="button" class="rp-miss played" data-goto="' + (x.ply + 1) + '"><i class="pc-ic ' + BoardView.cls((c << 3) | 6) + '"></i><span class="rp-miss-t"><b>' +
        esc(T('rpMissedItem', { n: moveNoText(x.ply) })) + ' <span class="gold">' + esc(x.san) + '</span> ' + clsIcon(x.cls) + '</b><span>' + esc(verdict) + '</span></span>' + CHEV_RIGHT + '</button>';
    });
    missed.forEach(function (x) {
      g += '<button type="button" class="rp-miss" data-goto="' + (x.ply + 1) + '"><i class="pc-ic ' + BoardView.cls((x.color << 3) | 6) + '"></i><span class="rp-miss-t"><b>' +
        esc(T('rpMissedItem', { n: moveNoText(x.ply) })) + ' <span class="gold">' + esc(x.san) + '</span></b><span>' + esc(PRO ? PX('jkMissedBy') + ': ' : '') + esc(T('rpMissedGain', { g: Math.round(x.gain) })) + '</span></span>' + CHEV_RIGHT + '</button>';
    });
    var mine = missed.filter(function (x) { return x.color === me; }).length;
    if (!missed.length && !any) g += '<p class="rp-none">' + esc(PRO ? PX(you ? 'jkNoneYou' : 'jkNone') : T('rpNoMissed')) + '</p>';
    else if (PRO && you && !mine && !(sum[me] && sum[me].golden)) g += '<p class="rp-none">' + esc(PX('jkNoneYou')) + '</p>';
    else if (PRO && you && !mine && sum[me] && sum[me].golden && GOOD_CLS[sum[me].golden.cls]) g += '<p class="rp-none">' + esc(PX('jkNoBetter')) + '</p>';
    // a free player's one analysis, used here: where the rest are
    if (jkLimited()) g += '<button type="button" class="jk-more" id="jk-more" data-pro="1"><span class="pro-mark">' + esc(PX('mark')) + '</span><span>' + esc(PX('jkUpsell')) + '</span></button>';
    return g + '</div>';
  }
  // move classes as players know them from chess.com: a glyph in a coloured circle; sym: shown in the move list,
  // badge: shown on the board
  // the Joker Move mark in notation and reports: our jester silhouette, black, the size of a notation symbol
  var JOKER_SYM = '<svg class="jsym" viewBox="2 0 96 100" aria-hidden="true"><g><rect x="24" y="90" width="52" height="9" rx="4"/> <rect x="24" y="90" width="52" height="5" rx="3"/> <rect x="30" y="84" width="40" height="8" rx="3"/> <path d="M40 86 L41 70 L59 70 L60 86 Z"/> <path d="M43 86 L44 72 L56 72 L57 86 Z"/> <path d="M31 40 C25 35 25 27 30 25 C34 28 36 34 36 40 Z"/> <path d="M69 40 C75 35 75 27 70 25 C66 28 64 34 64 40 Z"/> <circle cx="50" cy="54" r="27"/> <circle cx="50" cy="56" r="21"/> <ellipse cx="50" cy="66" rx="14" ry="9"/> <path d="M40 67 C44 74 56 74 60 67" stroke-width="2.8" stroke-linecap="round"/> <circle cx="50" cy="60" r="7"/> <ellipse cx="47.4" cy="57.4" rx="2" ry="1.4" /> <ellipse cx="41" cy="49" rx="4.8" ry="5.2"/><ellipse cx="59" cy="49" rx="4.8" ry="5.2"/> <circle cx="41.6" cy="49.6" r="3.2"/><circle cx="59.6" cy="49.6" r="3.2"/> <circle cx="42.8" cy="48.2" r="1.1"/><circle cx="60.8" cy="48.2" r="1.1"/> <path d="M35.5 42.5 C38.5 39.5 43.5 39.5 46 41.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M54 41.5 C56.5 39.5 61.5 39.5 64.5 42.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M34 30 C26 24 14 20 6 24 C14 26 20 30 26 36 Z"/> <path d="M35 34 C45 31 48.5 20 50 2 C51.5 20 55 31 65 34 Z"/> <path d="M66 30 C74 24 86 20 94 24 C86 26 80 30 74 36 Z"/> <path d="M29 35 C40 26 60 26 71 35 L71 39 C60 31 40 31 29 39 Z"/> <circle cx="6" cy="24" r="3.2" stroke-width=".8"/> <circle cx="50" cy="3.5" r="3.2" stroke-width=".8"/> <circle cx="94" cy="24" r="3.2" stroke-width=".8"/></g></svg>', JOKER_CHIP = '<span class="jchip">' + JOKER_SYM + '</span>';
  var CLS = {
    brilliant: { g: '!!', sym: 1, badge: 1 }, great: { g: '!', sym: 1, badge: 1 }, best: { g: '★', badge: 1 },
    excellent: { g: '✓', badge: 1 }, good: { g: '✓', badge: 1 },
    inaccuracy: { g: '?!', sym: 1, badge: 1 }, mistake: { g: '?', sym: 1, badge: 1 }, miss: { g: '✕', sym: 1, badge: 1 },
    blunder: { g: '??', sym: 1, badge: 1 }, goldmiss: { g: JOKER_SYM, sym: 1, badge: 1, html: 1 }
  };
  var GOOD_CLS = { brilliant: 1, great: 1, best: 1, excellent: 1, good: 1 };
  function clsIcon(cls) { return '<span class="ci ci-' + cls + '" aria-hidden="true">' + (CLS[cls] ? CLS[cls].g : '') + '</span>'; }
  // the side the report is written for: the player (online or against the bot); White when two people share the device
  function reviewSide() { return oppGame() && !spectating() ? game.cfg.human : 0; }
  function moveNoText(i) {
    var startBlack = new GC.Position(game.startFen).side === 1, k = i + (startBlack ? 1 : 0);
    return Math.floor(k / 2) + 1 + (k % 2 ? '…' : '.');
  }
  // the score after move i, from White's side, as players read it: +0.64, -1.20, #3
  function evalAfter(i) {
    var e = review && review.scores[i + 1];
    if (!e) return '';
    var side = posFromFen(game.fens[i + 1]).side, sgn = side === 0 ? 1 : -1;
    if (e.mate) return '#' + (e.mate * sgn > 0 ? '' : '-') + Math.abs(e.mate);
    var v = sgn * e.score / 100;
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  }
  // ---- the coach's words. Sides are named White/Black (the sentence works for any game); `c` is the side that moved.
  function sideWords(c) { return { side: c ? T('black') : T('white'), sideLc: (c ? T('black') : T('white')).toLowerCase(), sideGen: c ? T('sideGenB') : T('sideGenW') }; }
  function gainText(g) {
    if (!g) return '';
    if (g.items && g.items.every(function (it) { return it[0] === 1 || it[1] === 1; })) {
      var words = g.items.map(function (it) {
        if (it[0] === 1) return it[1] <= 4 ? T('g_pawn' + it[1]) : T('g_pawnN', { n: it[1] });
        return T('g_' + ['', 'pawn', 'knight', 'bishop', 'rook', 'queen'][it[0]]);
      });
      if (g.exchange) words.unshift(T('g_exchange'));
      return words.join(T('g_and'));
    }
    if (g.exchange) return T('g_exchange');
    var pts = g.points != null ? g.points : g.items.reduce(function (a, it) { return a + [0, 1, 3, 3, 5, 9][it[0]] * it[1]; }, 0);
    return T('g_points', { n: pts });
  }
  function targetsText(ts) {
    var seen = {}, names = [];
    ts.forEach(function (t) { if (!seen[t]) { seen[t] = 1; names.push(T('t_' + ['', 'pawn', 'knight', 'bishop', 'rook', 'queen'][t])); } });
    return names.slice(0, 2).join(T('w_and'));
  }
  // a Joker Move inside a line (not its first move): often the whole point of it
  function keyGolden(st, from) { for (var k = from || 0; k < st.sans.length; k++) if (st.golden[k]) return st.sans[k]; return ''; }
  // why move i is good or bad, in a sentence or two
  function coachReason(i, mv) {
    var rec = game.records[i], r = mv.reason, best = mv.bestSan, c = rec.color, opp = sideWords(c ^ 1), out = [];
    if (mv.cls === 'goldmiss') return T('r_goldmiss', { best: best });
    if (rec.golden) return mv.cls === 'great' ? T('r_goldenGreat') : mv.cls === 'good' ? T('r_goldenOk', { best: best }) : GOOD_CLS[mv.cls] ? T('r_goldenGood') : T('r_goldenWasted', { best: best });
    if (mv.cls === 'great') return T('r_punish');
    if (r && r.key === 'sacrifice') return T('r_sacrifice');
    if (r && r.key === 'missedMate') return T('r_missedMate', { best: best, n: r.n });
    if (r && r.key === 'allowsMate') return T('w_mate', { side: opp.side, sideGen: opp.sideGen, n: r.n }) + (r.reply ? ' ' + replyText(r.reply, opp) : '');
    if (r && r.key === 'line') {
      if (r.missed && !r.win) out.push(T('w_missed', { best: best }));
      if (r.reply) out.push(replyText(r.reply, opp));
      if (r.lose) out.push(T('w_lose', { side: opp.side, sideLc: opp.sideLc, gain: gainText(r.lose) }));
      else if (r.hangs && !r.reply) out.push(T('r_hangs', { piece: T('p_' + r.hangs) }));
      var kg = r.missed ? keyGolden(mv.line, 0) : keyGolden(mv.follow, r.reply && r.reply.kind === 'golden' ? 1 : 0);
      if (kg) out.push(T('w_keyGold', { san: kg }));
      if (r.win) out.push(T('w_win', { best: best, gain: gainText(r.win) }));
    }
    if (out.length) return out.join(' ');
    if (mv.missedGolden) return T('r_goldmiss', { best: mv.missedGolden.san });
    if (GOOD_CLS[mv.cls]) {
      var f = mv.follow;
      return f && (f.mate >= 0 || f.swing >= 1 || f.swing <= -1 || keyGolden(f, 0)) ? lineOutcome(f, c, review.scores[i + 1], game.fens[i + 1]) : '';
    }
    kg = keyGolden(mv.follow, 0);
    return (kg ? T('w_keyGold', { san: kg }) + ' ' : '') + T('r_better', { best: best });
  }
  function replyText(rp, opp) {
    var s = rp.kind === 'golden' ? T('w_golden', { side: opp.side, san: rp.san }) : rp.kind === 'takes' ? T('w_takes', { side: opp.side, san: rp.san, piece: T('p_' + rp.piece) }) : T('w_hits', { side: opp.side, san: rp.san });
    if (rp.check) s += T('w_check');
    if (rp.kind !== 'takes' && rp.targets && rp.targets.length) s += T('w_attacks', { targets: targetsText(rp.targets) });
    return s + '.';
  }
  // a score as players read it, from White's side: +0.64, −1.20, #3
  function evalWhite(e, fen) {
    if (!e) return '';
    var sgn = posFromFen(fen).side === 0 ? 1 : -1;
    if (e.mate) return '#' + (e.mate * sgn > 0 ? '' : '-') + Math.abs(e.mate);
    var v = sgn * e.score / 100;
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  }
  var LINE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
  var STAR_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>';
  var RETRY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 3.5v5h5"/></svg>';
  var HIDE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  // a coach button: the full label, and a short one for narrow screens
  function cbtn(act, icon, label, extra, short) {
    return '<button type="button" class="cbtn' + (extra ? ' ' + extra : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '">' + icon +
      '<span class="lg">' + esc(label) + '</span><span class="sh">' + esc(short || label) + '</span></button>';
  }
  function coachBox(cls, icon, title, ev, body, acts) {
    return '<div class="coach ' + cls + '" id="coach"><div class="coach-top">' + icon + '<b class="coach-title">' + esc(title) + '</b>' + (ev ? '<span class="coach-ev">' + esc(ev) + '</span>' : '') +
      '</div><div class="coach-body">' + body + '</div>' + (acts ? '<div class="coach-acts">' + acts + '</div>' : '') + '</div>';
  }
  var B_FOLLOW = function () { return cbtn('follow', LINE_ICON, T('showFollow'), '', T('showShort')); };
  // the best move's name is on its button, so the row reads as a sentence: "Best: Nf3 · What follows · Find it yourself"
  var B_BEST = function (mv) {
    var san = mv && mv.bestSan ? mv.bestSan.replace(/\*/g, '\u2605') : ''; return cbtn('best', STAR_ICON, T('bestBtn', { san: san }), 'gold', T('bestShort', { san: san }));
  };
  var B_RETRY = function () { return cbtn('retry', RETRY_ICON, T('retryBtn'), '', T('retryShort')); };
  var B_HIDE = function () { return cbtn('hide', BACK_ICON, T('hideLine'), 'on'); };
  // "find a better move yourself" is for your own moves; on one device (two players) or watching, for either side
  function canRetry(rec) { return !oppGame() || spectating() || rec.color === game.cfg.human; }
  // the coach on a move of the game: what it was, why, and the ways to see it on the board
  function coachHtml(i, mv) {
    var rec = game.records[i], acts = '';
    if (mv.cls === 'joker') {
      // (the review is blind) the Joker Move that was played gets no verdict here: the Joker analysis has it
      if (mv.follow && mv.follow.ucis.length) acts += B_FOLLOW();
      acts += cbtn('jk', STAR_ICON, PX('jkT'), 'gold', PX('jkT'));
      return coachBox('c-joker', '<span class="ci ci-joker" aria-hidden="true">' + JOKER_SYM + '</span>', PX('jkMoveT', { san: moveNoText(i) + ' ' + rec.san }), evalAfter(i), '<p>' + esc(PX('jkMoveHidden')) + '</p>', acts);
    }
    var why = coachReason(i, mv), bad = !GOOD_CLS[mv.cls];
    if (mv.follow && mv.follow.ucis.length) acts += B_FOLLOW();
    if (mv.best && mv.best !== rec.uci) acts += B_BEST(mv);
    if ((bad || mv.cls === 'good') && canRetry(rec)) acts += B_RETRY();
    return coachBox('c-' + mv.cls, clsIcon(mv.cls), T('v_' + mv.cls, { san: moveNoText(i) + ' ' + rec.san }), evalAfter(i), (why ? '<p>' + esc(why) + '</p>' : ''), acts);
  }
  // a line on the board (the follow-up after a move, or the best move and its line): its moves, the one on the board
  // marked, and what it comes to
  function lineMovesHtml(st, cur) {
    var f = st.fen.split(' '), no = +f[5] || 1, side = f[1] === 'b' ? 1 : 0, out = [];
    st.sans.forEach(function (san, k) {
      var label = side === 0 ? no + '.' : k === 0 ? no + '…' : '';
      out.push('<span class="ln' + (k < cur ? ' done' : '') + (k === cur - 1 ? ' cur' : '') + (st.golden[k] ? ' gold' : '') + '">' + esc(label + san) + '</span>');
      if (side === 1) no++;
      side ^= 1;
    });
    return out.join(' ');
  }
  // what a line comes to for `c`: a mate, material, or (no material changes hands) how the position stands. e: the
  // engine's score at the line's start (side to move there), fen: that position
  function lineOutcome(st, c, e, fen) {
    var out = [], w, v = e ? (posFromFen(fen).side === 0 ? 1 : -1) * cpOf(e) : 0, vc = c === 0 ? v : -v;
    if (st.mate >= 0) out.push(T('w_lineMate', { side: sideWords(st.mate).side }));
    else if ((st.swing >= 1 && vc > -50) || (st.swing <= -1 && vc < 50)) { w = sideWords(st.swing >= 1 ? c : c ^ 1); out.push(T('w_lineWins', { side: w.side, gain: gainText(st.gain) })); }
    else if (e && !e.mate) {
      var lead = v >= 0 ? 0 : 1, a = Math.abs(v);
      w = sideWords(lead);
      out.push(a < 60 ? T('w_equal') : a < 300 ? T('w_better', w) : T('w_winning', w));
    }
    var kg = keyGolden(st, 0);
    if (kg) out.push(T('w_keyGold', { san: kg }));
    return out.join(' ');
  }
  function lineCardHtml(E) {
    var L = E.line, mv = review.moves[L.ply], st = L.kind === 'best' ? mv.line : mv.follow, rec = game.records[L.ply];
    var title = L.kind === 'best' ? T('lnBest', { san: mv.bestSan }) : T('lnFollow');
    var ev = L.kind === 'best' ? evalWhite(review.scores[L.ply], game.fens[L.ply]) : evalAfter(L.ply);
    var acts = B_HIDE();
    if (L.kind === 'follow' && mv.best && mv.best !== rec.uci) acts += B_BEST(mv);
    if ((!GOOD_CLS[mv.cls] || mv.cls === 'good') && canRetry(rec)) acts += B_RETRY();
    var base = L.kind === 'best' ? L.ply : L.ply + 1;
    var outcome = E.view >= E.records.length ? lineOutcome(st, rec.color, review.scores[base], game.fens[base]) : '';
    return coachBox('line l-' + L.kind, '<span class="ci ci-line">' + (L.kind === 'best' ? STAR_ICON : LINE_ICON) + '</span>', title, ev,
      (outcome ? '<p>' + esc(outcome) + '</p>' : '') + '<p class="coach-line">' + lineMovesHtml(st, E.view) + '</p>', acts);
  }
  function retryCardHtml(E) {
    var R = E.retry, mv = review.moves[R.ply], c = game.records[R.ply].color, sw = sideWords(c), title, icon, why = '', acts = '';
    if (R.state === 'ask') {
      title = T('rtAsk', { side: sw.side, sideGen: sw.sideGen }); icon = '<span class="ci ci-line">' + RETRY_ICON + '</span>';
      if (mv.best && mv.best.indexOf('*') >= 0) why = T('rtGoldHint'); // the move to find is a golden one
    }
    else if (R.state === 'checking') { title = T('rtChecking', { san: R.san }); icon = '<span class="ci ci-line">' + RETRY_ICON + '</span>'; }
    else if (R.state === 'right') { title = T('rtRight', { san: R.san }); icon = clsIcon('best'); }
    else if (R.state === 'excellent') { title = T('rtExcellent', { san: R.san }); icon = clsIcon('excellent'); }
    else if (R.state === 'good') { title = T('rtGood', { san: R.san }); icon = clsIcon('good'); }
    else { title = T('rtWrong', { san: R.san }); icon = clsIcon(R.drop >= 20 ? 'blunder' : R.drop >= 10 ? 'mistake' : 'inaccuracy'); }
    if (R.story && (R.state === 'wrong' || R.state === 'good')) {
      var f = R.story.first, opp = sideWords(c ^ 1), parts = [];
      if (f && (f.golden || f.took >= 2 || f.targets.length)) parts.push(replyText({ kind: f.golden ? 'golden' : f.took >= 2 ? 'takes' : 'hits', san: f.san, piece: ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][f.took], targets: f.targets, check: f.check }, opp));
      var oc = lineOutcome(R.story, c, R.score, E.fens[1]); if (oc) parts.push(oc);
      why = parts.join(' ');
    }
    if ((R.state === 'right' || R.state === 'excellent') && mv.line) {
      why = lineOutcome(mv.line, c, review.scores[R.ply], game.fens[R.ply]);
      acts += cbtn('best', LINE_ICON, T('showFollow'), '', T('showShort'));
    }
    if (R.state === 'good' || R.state === 'wrong') acts += cbtn('again', RETRY_ICON, T('tryAgain'), '', T('againShort'));
    if (R.state !== 'right' && R.state !== 'excellent' && mv.best) acts += B_BEST(mv);
    acts += B_HIDE();
    return coachBox('retry r-' + R.state, icon, title, '', why ? '<p>' + esc(why) + '</p>' : '', acts);
  }
  // White's winning chances over the game, with dots on the notable moves
  function graphHtml() {
    var n = game.records.length, pts = [], W = 1000, H = 100, i;
    for (i = 0; i <= n; i++) {
      var e = review.scores[i];
      if (!e) continue;
      var side = posFromFen(game.fens[i]).side, wcp = side === 0 ? cpOf(e) : -cpOf(e);
      pts.push([i * W / Math.max(1, n), H - winPct(wcp)]);
    }
    var cur = explore ? explore.base : view, curX = (cur * W / Math.max(1, n)).toFixed(1);
    var path = pts.length ? 'M0,' + H + ' ' + pts.map(function (p) { return 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + H + ' Z' : '';
    var dots = '';
    if (review.moves) review.moves.forEach(function (m, k) {
      if (!m || !(m.golden || { brilliant: 1, great: 1, mistake: 1, miss: 1, blunder: 1, goldmiss: 1 }[m.cls])) return;
      var e2 = review.scores[k + 1]; if (!e2) return;
      var sd = posFromFen(game.fens[k + 1]).side, w2 = sd === 0 ? cpOf(e2) : -cpOf(e2);
      dots += '<i class="gd g-' + (m.golden ? 'gold' : m.cls) + '" style="left:' + (100 * (k + 1) / Math.max(1, n)).toFixed(2) + '%;top:' + (100 - winPct(w2)).toFixed(1) + '%"></i>';
    });
    return '<div class="rv-graph" data-n="' + n + '"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + path + '"/><line class="mid" x1="0" y1="50" x2="' + W + '" y2="50"/><line class="cur" x1="' + curX + '" y1="0" x2="' + curX + '" y2="' + H + '"/></svg>' + dots + '</div>';
  }
  function reviewPct() { return Math.round(100 * review.done / (game.records.length + 1)); }
  // the review under the board (phone) or in the side panel (wide): progress, graph, the coach on the viewed move
  function renderReview() {
    var hosts = [$('review'), $('review-side')];
    if (!review || !game) { hosts.forEach(function (h) { h.hidden = true; h.innerHTML = ''; }); return; }
    var card, mvI = explore ? -1 : view - 1, mv = review.moves && review.moves[mvI];
    var progress = review.running ? '<div class="rv-progress"><span>' + esc(T('rpReviewing', { p: reviewPct() })) + '</span><i style="width:' + reviewPct() + '%"></i></div>' : '';
    if (explore && explore.line && review.moves && review.moves[explore.line.ply]) card = lineCardHtml(explore);
    else if (explore && explore.retry && review.moves && review.moves[explore.retry.ply]) card = retryCardHtml(explore);
    else if (mv) card = coachHtml(mvI, mv);
    else card = coachBox('hint', '', '', '', review.running ? progress : '<p class="rv-hint">' + esc(explore ? T('variation') : T('reviewHint')) + '</p>', '');
    var graph = graphHtml();
    hosts.forEach(function (h, k) { h.hidden = false; h.innerHTML = (k === 1 && mv ? progress : '') + graph + card; });
  }
  function onGraphClick(e) {
    if (e.target.closest('[data-report]')) { showReport(); return; }
    var act = e.target.closest('[data-act]');
    if (act) { coachAct(act.dataset.act); return; }
    var g = e.target.closest('.rv-graph'); if (!g) return;
    var r = g.getBoundingClientRect(), n = +g.dataset.n, k = Math.round((e.clientX - r.left) / r.width * n);
    gotoPly(Math.max(0, Math.min(n, k)));
  }

  // ------------------------------------------------------------------ game flow
  function startGame(setup, opts) {
    opts = opts || {};
    cancelLobby(); leaveOnline();
    cancelBot(); bot.cancel(); bot.clear();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion(); lowWarned = false; plyBoards = {};
    explore = null; posCache = {}; stopReview(); review = null; hint = null;
    if (analysis.on) setAnalysis(false);
    var human = setup.color === 'r' ? (Math.random() < 0.5 ? 0 : 1) : setup.color === 'b' ? 1 : 0;
    if (opts.human != null) human = opts.human;
    game = new Game({ mode: setup.mode, level: setup.level, bot: setup.mode === 'bot' ? (setup.bot || Progress.levelBot(setup.level).who) : null, human: human, tc: parseTc(setup.tc), career: setup.career || null }, opts.fen);
    view = 0;
    setGoldenArmed(false);
    orient = setup.mode === 'bot' ? human : 0;
    board.setOrientation(orient);
    board.sync(game.pos.board, []);
    Sound.play('start');
    Track.event('game_start', { mode: setup.mode, level: setup.mode === 'bot' ? setup.level : 0, bot: game.cfg.bot || '', career: setup.career ? setup.career.ch : 0, tc: setup.tc || 'none' });
    noteAct(setup.mode === 'bot' ? 'bot' : 'local');
    go('game');
    renderAll(); persist();
    if (setup.mode === 'bot' && game.pos.side !== human) requestBot();
  }
  function gameOver() {
    cancelBot();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion();
    setGoldenArmed(false);
    board.sync(displayBoard(), []);
    var outcome = humanOutcome();
    if (!spectating() && !game.tracked && game.reason !== 'abort' && game.records.length >= 2) {
      noteDay(game.online ? 'online' : game.cfg.mode);
      save('gamesDone', load('gamesDone', 0) + 1);
      afterGameAsk();
    }
    if (!spectating() && !game.progDone && game.reason !== 'abort' && game.records.length >= 2) progGame();
    if (!spectating() && !game.tracked) {
      game.tracked = true;
      Track.event('game_end', { mode: game.online ? 'online' : game.cfg.mode, result: game.reason === 'abort' ? 'abort' : oppGame() ? (outcome === 1 ? 'win' : outcome === 0 ? 'draw' : 'loss') : 'played', reason: game.reason || '', moves: game.records.length });
    }
    if (!game.online && !game.histKey && game.reason !== 'abort' && game.records.length >= 2) saveLocalGame();
    if (game.online) hist.at = 0;
    if (botGame() && !game.counted && game.reason !== 'abort') {
      game.counted = true;
      var key = botStatKey(botOf(game.cfg)), s = stats[key] || { w: 0, d: 0, l: 0 };
      s[outcome === 1 ? 'w' : outcome === 0 ? 'd' : 'l']++;
      stats[key] = s; save('stats', stats); progDirty();
    }
    Sound.play(outcome === 1 ? 'win' : outcome === 0 ? 'draw' : (oppGame() && !spectating() ? 'lose' : 'win'));
    if (oppGame() && !spectating()) haptic(outcome === 1 ? 'win' : outcome === 0 ? 'draw' : 'lose');
    noteSeries();
    renderAll(); persist();
    var g = game;
    // the result card, unless the player already opened something else (e.g. looking for the next game)
    setTimeout(function () { if (game === g && game.status === 'over' && !currentDialog && curView === 'game') showOver(); }, 450);
  }
  function humanOutcome() {
    if (game.result === '1/2-1/2' || game.reason === 'abort') return 0;
    var whiteWon = game.result === '1-0';
    if (!oppGame() || spectating()) return whiteWon ? 1 : -1;
    return (whiteWon ? 0 : 1) === game.cfg.human ? 1 : -1;
  }
  function resign() {
    if (game.status !== 'playing') return;
    if (onlineGame()) { onlineResign(); return; }
    var c = botGame() ? game.cfg.human : game.pos.side;
    if (game.records.length < 2 && botGame()) { game.end('*', 'abort', perf()); }
    else game.end(c === 0 ? '0-1' : '1-0', 'resign', perf());
    gameOver();
  }
  function takeback() {
    if (!botGame() || game.status !== 'playing') return;
    var h = game.cfg.human, k;
    for (k = game.records.length - 1; k >= 0; k--) if (game.records[k].color === h) break;
    if (k < 0) return;
    cancelBot(); bot.cancel();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion();
    game.truncate(k, perf());
    view = game.records.length; plyBoards = {};
    setGoldenArmed(false);
    board.sync(displayBoard(), []);
    renderAll(); persist();
    if (game.pos.side !== h) requestBot();
  }
  function flip() {
    orient ^= 1; board.setOrientation(orient); renderBars();
  }

  // ------------------------------------------------------------------ rendering
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sideLabel(color) {
    if (onlineGame()) return game.cfg.names[color] || (color === 0 ? T('white') : T('black'));
    if (botGame()) return color === game.cfg.human ? T('you') : botName();
    return color === 0 ? T('white') : T('black');
  }
  function renderAll() { renderMarks(); renderBars(); renderMoves(); renderControls(); renderSide(); renderAna(); renderClocks(perf(), true); }

  function renderMarks() {
    if (!game) return;
    var marks = [], dots = [], b = displayBoard(), r = lastRecord();
    if (r) {
      var cl = r.golden ? 'hl-gold' : 'hl-last';
      marks.push({ sq: r.m & 127, cls: cl }, { sq: (r.m >> 7) & 127, cls: cl });
      var mv = !explore && review && review.moves && review.moves[view - 1];
      if (mv && CLS[mv.cls] && CLS[mv.cls].badge) marks.push({ sq: (r.m >> 7) & 127, cls: 'badge bd-' + mv.cls });
    }
    var vp = viewPos(), checkSq = vp.inCheck() ? vp.kings[vp.side] : -1;
    if (checkSq >= 0) marks.push({ sq: checkSq, cls: 'hl-check' });
    premoves.forEach(function (pm) { marks.push({ sq: pm.from, cls: 'hl-pre-from' }, { sq: pm.to, cls: pm.golden ? 'hl-pre-gold' : 'hl-pre-to' }); });
    if (selected >= 0) {
      marks.push({ sq: selected, cls: 'hl-sel' });
      var dests = currentDests(), gold = goldenArmed;
      dests.forEach(function (d) { dots.push({ sq: d, cls: gold ? 'gdot' : (b[d] ? 'ring' : 'dot') }); });
    }
    board.setMarks(marks); board.setDots(dots);
    refreshArrows();
  }
  function lastRecord() {
    if (explore) return explore.view > 0 ? explore.records[explore.view - 1] : (explore.base > 0 ? game.records[explore.base - 1] : null);
    return view > 0 ? game.records[view - 1] : null;
  }
  function refreshArrows() {
    var list = [];
    if (live()) premoves.forEach(function (pm) { if (pm.stay) list.push({ from: pm.from, to: pm.to, pre: true }); });
    var rmv = !explore && review && review.moves && view > 0 ? review.moves[view - 1] : null;
    if (rmv) {
      if (!GOOD_CLS[rmv.cls] && rmv.cls !== 'goldmiss' && rmv.follow && rmv.follow.first) {
        var tm = posFromFen(game.fens[view]).moveFromUci(rmv.follow.first.uci);
        if (tm) list.push({ from: tm & 127, to: (tm >> 7) & 127, gold: !!(tm & F_GOLDEN), threat: true });
      }
    } else if (analysis.on && analysisArrow && !(explore && (explore.line || explore.retry))) list.push(analysisArrow);
    if (hint && hint.game === game && live() && hint.ply === game.records.length && game.status === 'playing') list.push({ from: hint.from, to: hint.to, gold: hint.gold });
    board.setArrows(list);
  }

  function counts(b) {
    var c = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]];
    for (var s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if (b[s]) c[b[s] >> 3][b[s] & 7]++; }
    return c;
  }
  var START_COUNT = [0, 8, 2, 2, 2, 1, 1], VALUE = [0, 1, 3, 3, 5, 9, 0];
  function renderBars() {
    if (!game) return;
    var bottom = orient === 0 ? 0 : 1;
    renderBar($('bar-bot'), bottom); renderBar($('bar-top'), bottom ^ 1);
  }
  function renderBar(el, color) {
    var b = displayBoard(), c = counts(b), opp = color ^ 1, posV = viewPos();
    var name, sub, extra = '', botFace = false;
    if (onlineGame()) {
      name = game.cfg.names[color] || (color === 0 ? T('white') : T('black'));
      sub = color === 0 ? T('white') : T('black');
      var rt = game.cfg.ratings[color], st = online && online.s, d = st ? (color === 0 ? st.white_diff : st.black_diff) : null;
      if (st) extra += rankMini(color === 0 ? st.white_id : st.black_id);
      if (rt != null) extra += '<span class="rt">' + rt + (d != null ? ' <b class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</b>' : '') + '</span>';
      if (online && !spectating() && color !== game.cfg.human && online.oppHere != null) extra += '<i class="conn' + (online.oppHere ? '' : ' off') + '" title="' + esc(online.oppHere ? T('connected') : T('disconnected')) + '"></i>';
    } else if (botGame()) {
      // a signed-in player is themselves here, picture and name, like in an online game
      if (color === game.cfg.human) { name = me && me.profile ? me.profile.username : T('you'); sub = color === 0 ? T('white') : T('black'); extra = rankMini(null); }
      else { name = botName(); sub = T('lv' + game.cfg.level); extra = '<span class="rt" title="Elo">' + botElo() + '</span>'; botFace = true; }
    } else { name = color === 0 ? T('white') : T('black'); sub = ''; }
    var caps = '', diff = 0;
    for (var t = 5; t >= 1; t--) {
      var missing = Math.max(0, START_COUNT[t] - c[opp][t]);
      for (var i = 0; i < missing; i++) caps += '<i class="' + BoardView.cls((opp << 3) | t) + (i === 0 && caps ? ' gap' : '') + '"></i>';
    }
    for (t = 1; t <= 5; t++) diff += (c[color][t] - c[opp][t]) * VALUE[t];
    var thinking = botReq && botGame() && color !== game.cfg.human && game.status === 'playing';
    var gAvail = posV.goldenAvailable(color);
    el.dataset.color = color;
    el.classList.toggle('tap', onlineGame() && !spectating() && color !== game.cfg.human);
    el.innerHTML =
      (botFace && window.GCBots ? '<div class="avatar bot' + (thinking ? ' busy' : '') + '">' + botFaceHtml() + '</div>'
        : onlineGame() && online && online.s ? '<div class="avatar"' + '>' + avatarHtml(color === 0 ? online.s.white_id : online.s.black_id, name, 'bar') + '</div>'
        : botGame() && color === game.cfg.human && me && me.profile ? '<div class="avatar">' + avatarHtml(me.uid, name, 'bar') + '</div>'
        : '<div class="avatar"><i class="pc-ic ' + BoardView.cls((color << 3) | 6) + '"></i></div>') +
      '<div class="pmeta"><div class="pname"><span class="nm">' + esc(name) + '</span>' + extra +
      '<svg class="gstar' + (gAvail ? '' : ' used') + '" viewBox="0 0 100 100" aria-label="' + esc(T('golden')) + '"><g class="fill"><rect x="24" y="90" width="52" height="9" rx="4"/> <rect x="24" y="90" width="52" height="5" rx="3"/> <rect x="30" y="84" width="40" height="8" rx="3"/> <path d="M40 86 L41 70 L59 70 L60 86 Z"/> <path d="M43 86 L44 72 L56 72 L57 86 Z"/> <path d="M31 40 C25 35 25 27 30 25 C34 28 36 34 36 40 Z"/> <path d="M69 40 C75 35 75 27 70 25 C66 28 64 34 64 40 Z"/> <circle cx="50" cy="54" r="27"/> <circle cx="50" cy="56" r="21"/> <ellipse cx="50" cy="66" rx="14" ry="9"/> <path d="M40 67 C44 74 56 74 60 67" stroke-width="2.8" stroke-linecap="round"/> <circle cx="50" cy="60" r="7"/> <ellipse cx="47.4" cy="57.4" rx="2" ry="1.4" /> <ellipse cx="41" cy="49" rx="4.8" ry="5.2"/><ellipse cx="59" cy="49" rx="4.8" ry="5.2"/> <circle cx="41.6" cy="49.6" r="3.2"/><circle cx="59.6" cy="49.6" r="3.2"/> <circle cx="42.8" cy="48.2" r="1.1"/><circle cx="60.8" cy="48.2" r="1.1"/> <path d="M35.5 42.5 C38.5 39.5 43.5 39.5 46 41.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M54 41.5 C56.5 39.5 61.5 39.5 64.5 42.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M34 30 C26 24 14 20 6 24 C14 26 20 30 26 36 Z"/> <path d="M35 34 C45 31 48.5 20 50 2 C51.5 20 55 31 65 34 Z"/> <path d="M66 30 C74 24 86 20 94 24 C86 26 80 30 74 36 Z"/> <path d="M29 35 C40 26 60 26 71 35 L71 39 C60 31 40 31 29 39 Z"/> <circle cx="6" cy="24" r="3.2" stroke-width=".8"/> <circle cx="50" cy="3.5" r="3.2" stroke-width=".8"/> <circle cx="94" cy="24" r="3.2" stroke-width=".8"/></g></svg>' +
      (thinking ? '<span class="thinking"><i></i><i></i><i></i></span>' : '') + '</div>' +
      '<div class="psub"><span class="caps">' + caps + '</span>' + (diff > 0 ? '<span class="adv">+' + diff + '</span>' : '') +
      (!caps && diff <= 0 ? '<span>' + esc(sub) + '</span>' : '') + '</div></div>' +
      '<div class="clock" data-color="' + color + '"' + (game.clock ? '' : ' hidden') + '></div>';
    clockEls[color] = el.querySelector('.clock');
    lastClockText[color] = null;
  }
  function fmtClock(ms) {
    ms = Math.max(0, ms);
    if (ms < 20000) { var tenths = Math.floor(ms / 100); return '0:' + (tenths < 100 ? '0' : '') + (tenths / 10).toFixed(1); }
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function renderClocks(now, force) {
    if (!game || !game.clock) return;
    for (var c = 0; c < 2; c++) {
      var el = clockEls[c];
      if (!el) continue;
      var left = game.timeLeft(c, now), txt = fmtClock(left);
      var on = game.status === 'playing' && game.pos.side === c;
      var cls = 'clock' + (on ? ' on' : '') + (left < 10000 && game.cfg.tc.base > 30000 ? ' low' : '') + (left <= 0 ? ' flag' : '');
      var key = txt + '|' + cls;
      if (force || lastClockText[c] !== key) { el.textContent = txt; el.className = cls; lastClockText[c] = key; }
    }
  }

  function renderMoves() {
    var strip = $('strip'), sheet = $('sheet'), recs = game.records;
    if (!recs.length) {
      strip.innerHTML = '<span class="empty">' + esc(T('movesEmptyShort')) + '</span>';
      sheet.innerHTML = '<div class="empty">' + esc(T('movesEmpty')) + '</div>';
      return;
    }
    var sh = '', st = '';
    var startBlack = new GC.Position(game.startFen).side === 1;
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i], idx = i + 1, num = Math.floor((i + (startBlack ? 1 : 0)) / 2) + 1, isWhite = r.color === 0;
      var mv = '<button class="mv' + (r.golden ? ' gold' : '') + (view === idx ? ' cur' : '') + '" data-ply="' + idx + '">' + esc(r.san) + '</button>';
      if (isWhite || i === 0) st += '<span class="num">' + num + (isWhite ? '.' : '…') + '</span>';
      st += mv;
      if (isWhite) sh += '<div class="row"><span class="n">' + num + '.</span>' + mv;
      else { if (i === 0) sh += '<div class="row"><span class="n">' + num + '.</span><span></span>'; sh += mv + '</div>'; }
    }
    if (recs[recs.length - 1].color === 0) sh += '<span></span></div>';
    if (explore) {
      var vs = '<span class="var-tag">' + esc(T('variation')) + '</span>', vh = '<div class="var-line"><span class="var-tag">' + esc(T('variation')) + '</span>';
      var bp = posFromFen(explore.fens[0]), mvNo = bp.fullmove, black = bp.side === 1;
      explore.records.forEach(function (r, i) {
        var w = r.color === 0, label = (w ? mvNo + '. ' : (i === 0 ? mvNo + '\u2026 ' : '')) + r.san;
        var b2 = '<button class="mv var' + (r.golden ? ' gold' : '') + (explore.view === i + 1 ? ' cur' : '') + '" data-var="' + (i + 1) + '">' + esc(label) + '</button>';
        vs += b2; vh += b2;
        if (!w) mvNo++;
      });
      vs += '<button class="var-exit" data-exit="1">' + esc(T('backToGame')) + '</button>';
      vh += '<button class="var-exit" data-exit="1">' + esc(T('backToGame')) + '</button></div>';
      st += vs; sh += vh;
    }
    strip.innerHTML = st; sheet.innerHTML = sh;
    if (review && review.moves) {
      [strip, sheet].forEach(function (host) {
        host.querySelectorAll('[data-ply]').forEach(function (el) {
          var mv = review.moves[+el.dataset.ply - 1];
          if (mv && CLS[mv.cls] && CLS[mv.cls].sym) { var i = document.createElement('i'); i.className = 'sym s-' + mv.cls; if (CLS[mv.cls].html) i.innerHTML = JOKER_CHIP; else i.textContent = CLS[mv.cls].g; el.appendChild(i); }
        });
      });
    }
    var cur = strip.querySelector('.var.cur') || strip.querySelector('.cur');
    if (cur) strip.scrollLeft = Math.max(0, cur.offsetLeft - strip.clientWidth + cur.offsetWidth + 24);
    else strip.scrollLeft = 0;
    var cur2 = sheet.querySelector('.cur');
    if (cur2) { var top = cur2.offsetTop, bh = sheet.clientHeight; if (top < sheet.scrollTop || top > sheet.scrollTop + bh - 40) sheet.scrollTop = top - bh / 2; }
  }

  function renderControls() {
    if (!game) return;
    var btn = $('btn-golden'), c = goldenColor(), avail = movePos().goldenAvailable(c), t1 = $('g-t1'), t2 = $('g-t2');
    btn.classList.toggle('armed', goldenArmed);
    var usedRec = null;
    for (var i = 0; i < game.records.length; i++) if (game.records[i].golden && game.records[i].color === c) usedRec = { r: game.records[i], n: Math.floor(i / 2) + 1 };
    var queued = goldenQueued();
    btn.classList.toggle('used', !avail && !goldenArmed);
    if (goldenArmed) { t1.textContent = T('goldenOn'); t2.textContent = selected >= 0 ? T('goldenTap') : T('goldenPick'); }
    else if (queued) { t1.textContent = T('golden'); t2.textContent = T('goldenQueued'); }
    else if (!avail && usedRec) { t1.textContent = T('goldenUsedT'); t2.textContent = T('goldenUsedOn', { san: usedRec.r.san, n: usedRec.n }); }
    else if (!avail) { t1.textContent = T('goldenUsedT'); t2.textContent = c === 0 ? T('white') : T('black'); }
    else { t1.textContent = T('golden'); t2.textContent = oppGame() && !spectating() && game.status === 'playing' ? T('goldenOnce') : (c === 0 ? T('goldenWhiteOnce') : T('goldenBlackOnce')); }
    btn.disabled = spectating() && game.status === 'playing';
    $('btn-prev').disabled = !explore && view === 0;
    $('btn-next').disabled = explore ? explore.view === explore.records.length : view === game.records.length;
  }

  function renderSide() {
    if (!game) return;
    $('side-title').textContent = onlineGame() ? T('online') : botGame() ? botName() : T('passPlay');
    var tc = game.cfg.tc ? game.cfg.tc.label : T('unlimited'), status;
    if (game.status === 'over') status = resultTitle() + (game.reason && reasonText() ? ', ' + reasonText().toLowerCase() : '') + (explore ? '. ' + T('variation') : '');
    else if (explore) status = T('variation');
    else if (!live()) status = T('viewing', { n: Math.ceil(view / 2) || 1 });
    else if (onlineGame() && !spectating()) status = game.pos.side === game.cfg.human ? T('yourMove') : T('oppMove');
    else if (botGame()) status = game.pos.side === game.cfg.human ? T('yourMove') : T('thinkingName', { name: botName() });
    else status = game.pos.side === 0 ? T('whiteMove') : T('blackMove');
    var pre = botGame() ? botElo() + ' Elo, ' : onlineGame() ? poolLine(game.cfg.pool, game.cfg.rated) + ', ' : '';
    $('side-sub').textContent = pre + tc + '. ' + status;
    var acts = $('side-actions'); acts.innerHTML = '';
    function add(label, fn, cls, disabled) { var b = document.createElement('button'); b.className = 'sbtn' + (cls ? ' ' + cls : ''); b.textContent = label; b.disabled = !!disabled; b.addEventListener('click', fn); acts.appendChild(b); }
    if (game.status === 'playing') {
      if (botGame() && proAvail()) add(hintLabel(), gameHint, 'hint', !hintReady());
      if (botGame()) add(T('takeback'), takeback, '', !game.records.some(function (r) { return r.color === game.cfg.human; }));
      if (onlineGame() && !spectating()) {
        var dOff = online && online.s ? online.s.draw_offer : null, mine = game.cfg.human === 0 ? 'w' : 'b';
        // an incoming offer is answered in the notice above these buttons
        if (!dOff || dOff === mine) add(dOff === mine ? T('drawOffered') : T('offerDraw'), function () { onlineAction('draw', { op: 'offer' }); }, '', !!dOff || game.records.length < 2);
      }
      if (!spectating()) add(abortable() ? T('abort') : T('resign'), confirmResign, 'danger');
    } else {
      add(review ? T('rpReport') : T('review'), function () { showReport(); renderSide(); });
      if (review) add(analysis.on ? T('analyzeOff') : T('analyzeOn'), function () { setAnalysis(!analysis.on); renderSide(); });
      if (explore) add(T('backToGame'), exitExplore);
      if (onlineGame() && !spectating() && !game.fromHistory) {
        var rm = rematchState();
        add(rm.label, rematch, rm.hot ? 'hot' : '', rm.disabled);
        add(T('newOpponent'), newOpponent);
      }
    }
  }
  function resultTitle() {
    if (game.reason === 'abort') return T('r_abort');
    var o = humanOutcome();
    if (game.result === '1/2-1/2') return T('draw');
    if (!oppGame() || spectating()) return game.result === '1-0' ? T('whiteWon') : T('blackWon');
    return o === 1 ? T('youWon') : T('youLost');
  }
  function reasonText() { return game.reason === 'abort' ? '' : T('r_' + game.reason); }

  function toast(msg, kind) {
    var el = $('toast');
    el.textContent = msg; el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast' + (kind ? ' ' + kind : ''); }, 2300);
  }

  // ------------------------------------------------------------------ dialogs
  function openDialog(build) {
    closeDialog();
    clearTimeout(toastTimer); $('toast').className = 'toast';
    var veil = document.createElement('div'); veil.className = 'veil';
    var card = document.createElement('div'); card.className = 'sheetdlg'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    card.appendChild(sheetHandle(card));
    veil.appendChild(card);
    veil.addEventListener('pointerdown', function (e) { if (e.target === veil) closeDialog(); });
    $('overlay-root').appendChild(veil);
    currentDialog = veil;
    build(card);
    var f = card.querySelector('button.primary, button');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  // the sheet leaves the way it came (a short animation); whoever closed it is told at once
  function closeDialog() {
    if (!currentDialog) return;
    var d = currentDialog; currentDialog = null;
    d.classList.add('out'); setTimeout(function () { d.remove(); }, 200);
    if (d.onClose) d.onClose();
  }
  // the grabber at the top of a sheet (a dialog that rebuilds its card puts it back first)
  function sheetHandle(card) { var handle = h('div', { class: 'sheet-handle' }, '<i></i>'); sheetDrag(card.parentNode || null, card, handle); return handle; }
  // a phone sheet follows the finger from its grabber: let go low enough (or fast enough) and it closes
  function sheetDrag(veil, card, handle) {
    var y0 = 0, dy = 0, t0 = 0, on = false;
    veil = veil || { classList: { contains: function () { return card.parentNode && card.parentNode.classList.contains('center'); } } };
    handle.addEventListener('pointerdown', function (e) {
      if (veil.classList.contains('center') || window.innerWidth > 520) return;
      on = true; y0 = e.clientY; dy = 0; t0 = perf(); card.classList.add('drag'); card.classList.remove('snap');
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) { if (!on) return; dy = Math.max(0, e.clientY - y0); card.style.transform = 'translateY(' + dy + 'px)'; });
    function end() {
      if (!on) return; on = false; card.classList.remove('drag');
      var v = dy / Math.max(1, perf() - t0); // px per ms
      if (dy > Math.min(140, card.offsetHeight * .35) || v > .6) { card.style.transition = 'transform .18s ease-in'; card.style.transform = 'translateY(110%)'; if (currentDialog === card.parentNode) closeDialog(); }
      else { card.classList.add('snap'); card.style.transform = ''; }
    }
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }
  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') el.className = attrs[k]; else if (k === 'onclick') el.addEventListener('click', attrs[k]); else el.setAttribute(k, attrs[k]); }
    if (html != null) el.innerHTML = html;
    return el;
  }
  function seg(options, value, onPick, extraCls) {
    var wrap = h('div', { class: 'seg' + (extraCls ? ' ' + extraCls : '') });
    options.forEach(function (o) {
      var b = h('button', { type: 'button', 'aria-pressed': String(o.v === value), id: 'opt-' + String(o.id || o.v).replace(/[^a-z0-9]/gi, '') });
      b.textContent = o.label;
      b.addEventListener('click', function () { wrap.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); onPick(o.v); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  // "New game" anywhere leads to the Play tab
  function showNewGame() { closeDialog(); go(gameHome()); }
  // bot setup (Play a Bot) and two players on one device
  function showBotSetup() { closeDialog(); go('bots'); }
  function showLocalSetup() {
    var s = Object.assign({}, lastSetup, { mode: 'local' });
    if (TCS.indexOf(s.tc) < 0) s.tc = '5+0';
    openDialog(function (card) {
      currentDialog.dataset.kind = 'local';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('twoPlayers'))));
      card.appendChild(tcField(s));
      card.appendChild(playRow(s));
    });
  }
  function tcField(s) {
    var f = h('div', { class: 'field' }); f.appendChild(h('div', { class: 'lbl' }, esc(T('timeControl'))));
    f.appendChild(seg(TCS.map(function (t) { return { v: t, label: t === 'none' ? T('noClock') : t, id: 'tc' + t }; }), s.tc, function (v) { s.tc = v; }, 'tc'));
    return f;
  }
  function playRow(s) {
    var row = h('div', { class: 'row-btns' });
    var go2 = h('button', { class: 'primary', id: 'btn-play', type: 'button' }, esc(T('play')));
    go2.addEventListener('click', function () { lastSetup = Object.assign({}, lastSetup, s); save('setup', lastSetup); closeDialog(); startGame(s); });
    var c = h('button', { class: 'secondary', type: 'button' }, esc(T('cancel')));
    c.addEventListener('click', closeDialog);
    row.appendChild(c); row.appendChild(go2);
    return row;
  }

  // today's score against the same opponent: the games in a row with them on this device (a sitting, up to a few hours)
  function noteSeries() {
    if (!onlineGame() || spectating() || game.reason === 'abort' || !online || !online.s) return;
    var opp = online.color === 0 ? online.s.black_id : online.s.white_id;
    if (!opp) return;
    var sr = load('series', null), now = Date.now();
    if (!sr || sr.opp !== opp || now - sr.at > 3 * 3600000) sr = { opp: opp, w: 0, d: 0, l: 0, ids: {}, at: now };
    if (!sr.ids[online.id]) { sr.ids[online.id] = 1; var r = humanOutcome(); if (r === 1) sr.w++; else if (r === 0) sr.d++; else sr.l++; }
    sr.at = now; save('series', sr);
  }
  function seriesScore() {
    var sr = load('series', null), opp = online && online.s && online.color >= 0 ? (online.color === 0 ? online.s.black_id : online.s.white_id) : null;
    return sr && opp && sr.opp === opp && (sr.w + sr.d + sr.l) ? sr : null;
  }
  // the two players face to face: avatar, name, rating (and what it did), the Joker Move each played; the score between
  function faceoffHtml() {
    var spec = spectating(), hum = game.cfg.human, L = spec ? 0 : hum, R = L ^ 1, st = onlineGame() && online ? online.s : null;
    var res = game.result, pts = res === '1-0' ? ['1', '0'] : res === '0-1' ? ['0', '1'] : res === '1/2-1/2' ? ['½', '½'] : ['–', '–'];
    function side(c) {
      var mine = !spec && c === hum, bot = botGame() && c !== hum;
      var nm = mine ? (me && me.profile ? me.profile.username : T('you')) : sideLabel(c);
      var uid = st ? (c === 0 ? st.white_id : st.black_id) : mine && me ? me.uid : null;
      var ava = bot && window.GCBots ? botFaceHtml()
        : mine && !(me && me.profile) ? '<i class="pc-ic ' + BoardView.cls((c << 3) | 6) + '"></i>' // not signed in: the king of your colour
        : avatarHtml(uid, mine && me && me.profile ? me.profile.username : nm, 'fo');
      var rating = '';
      if (st) {
        var before = c === 0 ? st.white_rating : st.black_rating, after = c === 0 ? st.white_after : st.black_after, d = c === 0 ? st.white_diff : st.black_diff;
        if (st.rated && d != null) rating = '<b>' + (after == null ? before + d : after) + '</b> <span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</span>';
        else if (before != null) rating = '<b>' + before + '</b>';
      } else if (bot) rating = '<b>' + botElo() + '</b>';
      var gi = -1; game.records.forEach(function (r, k) { if (r.golden && r.color === c && gi < 0) gi = k; });
      var gold = gi >= 0 ? '<i class="fo-gold">' + JOKER_CHIP + ' ' + esc(game.records[gi].san) + ' <span>(' + (Math.floor(gi / 2) + 1) + ')</span></i>' : '<i class="fo-gold off">✧</i>';
      var badge = bot ? '' : mine ? rankMini(null) : uid ? rankMini(uid) : '';
      return '<div class="fo-side"><div class="fo-ava' + (mine ? ' me' : '') + (bot ? ' bot' : '') + '">' + ava + '</div><div class="fo-name"><span>' + esc(nm) + '</span>' + badge + '</div>' +
        (rating ? '<div class="fo-rating">' + rating + '</div>' : '') + gold + '</div>';
    }
    var out = humanOutcome();
    return side(L) + '<div class="fo-mid' + (!spec && out === 1 ? ' win' : '') + '"><b>' + pts[L] + '</b><i>:</i><b>' + pts[R] + '</b></div>' + side(R);
  }
  function showOver() {
    var o = humanOutcome(), reason = reasonText();
    openDialog(function (card) {
      currentDialog.dataset.kind = 'over';
      currentDialog.classList.add('center');
      card.classList.add('over');
      var sub = [];
      if (reason) sub.push(reason.charAt(0).toUpperCase() + reason.slice(1));
      sub.push(T('movesN', { n: Math.ceil(game.records.length / 2) }));
      card.appendChild(h('div', { class: 'over-head' }, (o === 1 && !spectating() ? '<span class="over-joker' + (motionOK() ? ' drop' : '') + '">' + jokerPiece() + '</span>' : '') + '<div class="dlg-title over-title' + (o === 1 && !spectating() ? ' win' : '') + '">' + esc(resultTitle()) + '</div><div class="over-sub">' + esc(sub.join(' · ')) + '</div>'));
      var opb = overProg(); if (opb) card.appendChild(opb);
      var acts = h('div', { class: 'over-acts' });
      var rv = h('button', { class: 'second-btn', type: 'button', id: 'btn-over-review' }, esc(T('review')));
      rv.addEventListener('click', function () { closeDialog(); showReport(); renderSide(); });
      if (onlineGame()) {
        var st = online && online.s;
        card.appendChild(h('div', { class: 'faceoff' }, faceoffHtml()));
        if (st && !st.rated && st.status === 'over') card.appendChild(h('div', { class: 'dlg-note' }, esc(T('casualNote'))));
        if (st && st.rated && st.status === 'over' && !spectating() && me && me.guest) {
          var nudge = h('div', { class: 'dlg-note acct-nudge', id: 'acct-nudge' }, '<span>' + esc(T('guestSaveRating', { r: ratingText(st.pool || 'blitz') })) + '</span>');
          Track.event('save_prompt', { where: 'result' });
          var sp = h('button', { type: 'button', class: 'linkbtn', id: 'btn-save-progress' }, esc(T('saveProgress')));
          sp.addEventListener('click', function () { Track.event('save_tap', { where: 'result' }); showAccount(showOver); });
          nudge.appendChild(sp); card.appendChild(nudge);
        }
        var ms = h('div', { id: 'over-h2h-slot' }); card.appendChild(ms); renderMatch(ms);
        // rematch is the one bright action; the review under it, a new opponent as a quiet line
        if (!spectating()) {
          var rm = rematchState();
          var rb = h('button', { class: 'start-btn primary', type: 'button', id: 'btn-rematch' }, esc(rm.label)); rb.disabled = rm.disabled;
          rb.addEventListener('click', rematch);
          acts.appendChild(rb);
        }
        acts.appendChild(rv);
        card.appendChild(acts);
        if (!spectating()) {
          var no = h('button', { class: 'linkbtn center', type: 'button', id: 'btn-new-opp' }, esc(T('newOpponent')));
          no.addEventListener('click', function () { closeDialog(); newOpponent(); });
          card.appendChild(no);
          // a person (not a house player), a game that was played: a quiet way to report them
          if (fairOn() && st && !st.house && st.status === 'over' && (st.moves || []).length >= 2) {
            var oppName = game.cfg.names[online.color ^ 1], gid = st.id;
            var rp = h('button', { class: 'linkbtn center quiet', type: 'button', id: 'btn-report' }, esc(T('reportPlayer', { name: oppName })));
            rp.addEventListener('click', function () { closeDialog(); setTimeout(function () { reportSheet(gid, oppName, showOver); }, 220); });
            card.appendChild(rp);
          }
        }
        return;
      }
      if (botGame()) {
        card.appendChild(h('div', { class: 'faceoff' }, faceoffHtml()));
        if ((NETCFG && !signedIn()) || (window.GC_PROTO && !NETCFG)) {
          var gn = h('div', { class: 'dlg-note acct-nudge', id: 'acct-nudge' }, '<span>' + esc(T('guestSaveStatus', { n: progLevel().level })) + '</span>');
          Track.event('save_prompt', { where: 'bot_result' });
          var gs = h('button', { type: 'button', class: 'linkbtn', id: 'btn-save-progress' }, esc(T('saveProgress')));
          gs.addEventListener('click', function () { Track.event('save_tap', { where: 'bot_result' }); showAccount(showOver); });
          gn.appendChild(gs); card.appendChild(gn);
        }
        var bs = game.cfg.career ? null : stats[botStatKey(botOf(game.cfg))];
        if (bs && bs.w + bs.d + bs.l) card.appendChild(h('div', { class: 'over-match one' }, '<div class="om"><span>' + esc(T('vsBotScore', { name: botName() })) + '</span><b>' + pts(bs.w, bs.d) + ' : ' + pts(bs.l, bs.d) + '</b><em>' + esc(wdlText({ w: bs.w, d: bs.d, l: bs.l })) + '</em></div>'));
      }
      // a game against the bot or on one device: play again (colours swap with the bot), or look through the game
      // a career stage: on to the next one once it is open, otherwise the same stage again
      // a career stage: lost, the same one again; won, on to the next opponent not beaten yet (none: back to the list)
      var cr = botGame() && game.cfg.career, crWon = cr && !!((prog.career[cr.ch] || 0) & 1) && humanOutcome() === 1;
      var nst = crWon ? Progress.nextStage(prog.career, isPro()) : null, nxs = nst && !((prog.career[nst.ch] || 0) & 1) ? nst.ch : 0;
      var again = h('button', { class: 'start-btn primary', type: 'button', id: 'btn-again' }, esc(cr ? (nxs ? T('nextStage', { name: GCBots.castName(Progress.stage(nxs).who, lang) }) : crWon ? T('toCareer') : T('tryAgain')) : T('againBot')));
      again.addEventListener('click', function () {
        closeDialog();
        if (cr) { if (nxs || !crWon) startCareer(nxs || cr.ch); else { botsUi.tab = 'career'; go('bots'); } return; }
        var s = { mode: game.cfg.mode, level: game.cfg.level, bot: game.cfg.bot, tc: game.cfg.tc ? game.cfg.tc.label : 'none', color: 'w' };
        startGame(s, { human: botGame() ? game.cfg.human ^ 1 : 0 });
      });
      acts.appendChild(again); acts.appendChild(rv);
      card.appendChild(acts);
    });
    // the keyboard starts on the main action (not on the level-up line above it)
    var pf = currentDialog && currentDialog.querySelector('.over-acts .primary');
    if (pf) try { pf.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  // the score against this opponent over all their games together, the one just finished included (the result card);
  // a tap opens all the games against them
  function matchScore() {
    var o = online, m = o && o.match, d = m && m.data;
    if (!d || !game || !game.online || o.color < 0) return null;
    var s = { id: m.opp, name: game.cfg.names[o.color ^ 1], w: d.w, d: d.d, l: d.l, n: d.n };
    if (game.status === 'over' && game.reason !== 'abort' && !d.ids[o.id]) {
      var r = humanOutcome(); s.n++;
      if (r === 1) s.w++; else if (r === 0) s.d++; else s.l++;
    }
    return s.n ? s : null;
  }
  function renderMatch(slot) {
    var sc = matchScore(), sr = seriesScore();
    slot.innerHTML = ''; slot.hidden = !sc;
    if (!sc) return;
    var both = sr && sr.w + sr.d + sr.l < sc.n;
    var cell = function (label, w, d, l, n) { return '<div class="om"><span>' + esc(label) + '</span><b>' + pts(w, d) + ' : ' + pts(l, d) + '</b><em>' + esc(wdlText({ w: w, d: d, l: l })) + (n ? ' · ' + esc(gamesText(n)) : '') + '</em></div>'; };
    var b = h('button', { type: 'button', class: 'over-match' + (both ? '' : ' one'), id: 'over-h2h' },
      (both ? cell(T('today'), sr.w, sr.d, sr.l, 0) : '') + cell(both ? T('allTime') : T('allTime'), sc.w, sc.d, sc.l, sc.n));
    b.addEventListener('click', function () { closeDialog(); openOppGames(sc.id); });
    slot.appendChild(b);
  }

  // asked for as an online game opens (the games between the two so far), so the result card has the score at once;
  // ids: the latest of those games, to tell whether the game on the board is already counted
  function loadMatch(o, opp) {
    o.match = { opp: opp, data: null };
    Promise.all([net.h2h(me.uid), net.history(me.uid, null, opp)]).then(function (r) {
      var row = (r[0] || []).filter(function (x) { return x.opp_id === opp; })[0] || { wins: 0, draws: 0, losses: 0, games: 0 }, ids = {};
      (r[1] || []).forEach(function (g) { ids[g.id] = 1; });
      o.match.data = { w: row.wins, d: row.draws, l: row.losses, n: row.games, ids: ids };
      var slot = online === o && currentDialog ? document.getElementById('over-h2h-slot') : null;
      if (slot) renderMatch(slot);
    }, function () { /* no score on the card */ });
  }

  function abortable() { return (botGame() || onlineGame()) && game.records.length < 2; }
  function confirmResign() {
    openDialog(function (card) {
      var abort = abortable();
      card.appendChild(h('div', { class: 'dlg-title' }, esc(abort ? T('abort') : T('resignQ'))));
      if (!abort) card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('resignSub'))));
      var row = h('div', { class: 'row-btns' });
      var y = h('button', { class: 'secondary danger', type: 'button' }, esc(abort ? T('abort') : T('resign')));
      y.addEventListener('click', function () { closeDialog(); resign(); });
      var n = h('button', { class: 'secondary', type: 'button' }, esc(T('cancel')));
      n.addEventListener('click', closeDialog);
      row.appendChild(n); row.appendChild(y); card.appendChild(row);
    });
  }

  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
    flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v14l-3-3M17 20V6l3 3"/></svg>',
    eng: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 19h16"/><path d="M7 15v-4M12 15V6M17 15v-7"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    draw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15"/><path d="M4 20v-5h5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/></svg>'
  };
  function showMenu() {
    openDialog(function (card) {
      var list = h('div', { class: 'menu-list' });
      function item(icon, label, fn, cls, disabled) {
        var b = h('button', { type: 'button', class: cls || '' }, icon + '<span>' + esc(label) + '</span>');
        b.disabled = !!disabled;
        b.addEventListener('click', function () { closeDialog(); fn(); });
        list.appendChild(b);
      }
      if (game.status === 'playing') {
        if (botGame() && proAvail()) item(PERK_ICON.coach, hintLabel(), gameHint, 'hint', !hintReady());
        if (botGame()) item(ICON.back, T('takeback'), takeback, '', !game.records.some(function (r) { return r.color === game.cfg.human; }));
        if (onlineGame() && !spectating()) {
          var dOff = online && online.s ? online.s.draw_offer : null, mine = game.cfg.human === 0 ? 'w' : 'b';
          if (dOff && dOff !== mine) {
            item(ICON.draw, T('acceptDraw'), function () { onlineAction('draw', { op: 'accept' }); });
            item(ICON.x, T('declineDraw'), function () { onlineAction('draw', { op: 'decline' }); });
          } else item(ICON.draw, dOff === mine ? T('drawOffered') : T('offerDraw'), function () { onlineAction('draw', { op: 'offer' }); }, '', !!dOff || game.records.length < 2);
        }
        if (!spectating()) item(ICON.flag, abortable() ? T('abort') : T('resign'), confirmResign, 'danger');
      } else {
        item(ICON.eng, review ? T('rpReport') : T('review'), function () { showReport(); renderSide(); });
        if (review) item(ICON.eng, analysis.on ? T('analyzeOff') : T('analyzeOn'), function () { setAnalysis(!analysis.on); renderSide(); });
        if (explore) item(ICON.back, T('backToGame'), exitExplore);
        if (onlineGame() && !spectating() && !game.fromHistory) {
          var rm = rematchState();
          item(ICON.again, rm.label, rematch, '', rm.disabled);
          item(ICON.search, T('newOpponent'), function () { setTimeout(newOpponent, 0); });
        }
      }
      item(ICON.flip, T('flip'), flip);
      item(ICON.copy, T('copyPgn'), copyPgn);
      item(ICON.plus, T('newGame'), function () { setTimeout(showNewGame, 0); });
      card.appendChild(list);
    });
  }

  function showSettings() {
    openDialog(function (card) {
      currentDialog.dataset.kind = 'settings';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('settings'))));
      buildSettings(card, showSettings);
      card.appendChild(h('div', { class: 'credit' }, esc(T('credit'))));
      var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
      d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
    });
  }
  // the settings controls, in the dialog and on the Profile tab; redraw() rebuilds the host after a language change
  function buildSettings(card, redraw) {
    function sw(label, key, onChange, id) {
      var row = h('div', { class: 'toggle-row' }), lab = h('span', { id: id + '-l' }); lab.textContent = label;
      var b = h('button', { class: 'sw', type: 'button', role: 'switch', id: id, 'aria-labelledby': id + '-l', 'aria-checked': String(!!settings[key]) });
      b.addEventListener('click', function () { settings[key] = !settings[key]; b.setAttribute('aria-checked', String(settings[key])); saveSettings(); if (onChange) onChange(); });
      row.appendChild(lab); row.appendChild(b); card.appendChild(row);
    }
    sw(T('sound'), 'sound', function () { Sound.setEnabled(settings.sound); if (settings.sound) { Sound.unlock(); Sound.play('move'); } }, 'set-sound');
    if (hapticsAvailable()) sw(T('haptics'), 'haptics', function () { if (settings.haptics) haptic('found'); }, 'set-haptics');
    if (Track.live) sw(T('usageStats'), 'stats', function () { Track.setOn(settings.stats); }, 'set-stats');
    if (remindersAvailable()) sw(T('reminders'), 'reminders', function () {
      if (settings.reminders && NATIVE.on && NATIVE.has('LocalNotifications')) NATIVE.call('LocalNotifications', 'requestPermissions').then(function (p) { if (!p || p.display !== 'granted') { settings.reminders = false; saveSettings(); } planReminders(); }, function () { /* refused */ });
      else planReminders();
      Track.event('reminders', { on: !!settings.reminders, reason: 'settings' });
    }, 'set-reminders');
    if (mailOn() && me && !me.guest) emailSwitch(card);
    if (me && me.admin) { var rp = h('button', { type: 'button', class: 'linkbtn', id: 'btn-remind-plan' }, esc(T('remindPlanH'))); rp.addEventListener('click', remindPlanSheet); card.appendChild(rp); }
    var fa = h('div', { class: 'field' }); fa.appendChild(h('div', { class: 'lbl' }, esc(T('animation'))));
    fa.appendChild(seg([{ v: 'fast', label: T('animFast'), id: 'anfast' }, { v: 'normal', label: T('animNormal'), id: 'annormal' }, { v: 'off', label: T('animOff'), id: 'anoff' }], settings.anim, function (v) { settings.anim = v; applySettings(); saveSettings(); }));
    card.appendChild(fa);
    var fb = h('div', { class: 'field' }); fb.appendChild(h('div', { class: 'lbl' }, esc(T('boardTheme'))));
    fb.appendChild(seg([{ v: 'slate', label: T('thSlate') }, { v: 'walnut', label: T('thWalnut') }, { v: 'marble', label: T('thMarble') }], settings.board, function (v) { settings.board = v; applySettings(); saveSettings(); }));
    card.appendChild(fb);
    sw(T('coords'), 'coords', applySettings, 'set-coords');
    sw(T('premoves'), 'premoves', function () { if (!settings.premoves) cancelPremoves(false); }, 'set-pre');
    sw(T('autoQueen'), 'autoQueen', null, 'set-aq');
    var fl = h('div', { class: 'field' }); fl.appendChild(h('div', { class: 'lbl' }, esc(T('language'))));
    fl.appendChild(seg([{ v: 'en', label: 'English' }, { v: 'ru', label: 'Русский' }], lang, function (v) { lang = settings.lang = v; saveSettings(); applyLang(); syncPrefs(); if (redraw) redraw(); }));
    card.appendChild(fl);
  }

  function showRules() {
    openDialog(function (card) {
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('rulesTitle'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('rulesIntro'))));
      var ol = h('ol', { class: 'rules' });
      ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'].forEach(function (k) { ol.appendChild(h('li', null, '<span>' + esc(T(k)) + '</span>')); });
      card.appendChild(ol);
      card.appendChild(h('div', { class: 'howto' }, T('howto')));
      card.appendChild(h('p', { class: 'credits', id: 'credits' }, esc(T('credits'))));
      var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
      d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
    });
  }

  // ------------------------------------------------------------------ PGN
  function pgnText() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var names = onlineGame() ? game.cfg.names.slice() :
      [botGame() ? (game.cfg.human === 0 ? 'You' : 'Joker Bot L' + game.cfg.level) : 'White', botGame() ? (game.cfg.human === 1 ? 'You' : 'Joker Bot L' + game.cfg.level) : 'Black'];
    var res = game.status === 'over' && game.result !== '*' ? game.result : '*';
    var event = onlineGame() ? (game.cfg.rated ? 'Rated ' : 'Casual ') + game.cfg.pool + ' game' : 'Joker Chess';
    var site = onlineGame() && online ? location.origin + location.pathname + '?game=' + online.id : 'Joker Chess';
    var tags = [['Event', event], ['Site', site], ['Date', d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate())],
      ['White', names[0]], ['Black', names[1]], ['Result', res], ['Variant', 'Golden'], ['TimeControl', game.cfg.tc ? (game.cfg.tc.base / 1000) + '+' + (game.cfg.tc.inc / 1000) : '-']];
    if (onlineGame() && game.cfg.ratings[0] != null) tags.push(['WhiteElo', String(game.cfg.ratings[0])], ['BlackElo', String(game.cfg.ratings[1])]);
    if (botGame()) tags.push([game.cfg.human === 0 ? 'BlackElo' : 'WhiteElo', String(botElo())]);
    if (game.startFen !== GC.START_FEN) tags.push(['FEN', game.startFen]);
    var out = tags.map(function (t) { return '[' + t[0] + ' "' + t[1] + '"]'; }).join('\n') + '\n\n';
    var line = '', words = [];
    game.records.forEach(function (r, i) { if (r.color === 0) words.push((Math.floor(i / 2) + 1) + '.'); else if (i === 0) words.push('1...'); words.push(r.san); });
    words.push(res);
    words.forEach(function (w) { if ((line + ' ' + w).length > 79) { out += line + '\n'; line = w; } else line = line ? line + ' ' + w : w; });
    return out + line + '\n';
  }
  function copyPgn() {
    var text = pgnText();
    function manual() {
      openDialog(function (card) {
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('pgnManual'))));
        var ta = h('textarea', { class: 'pgnbox', id: 'pgn-text', readonly: 'readonly', rows: '8' }); ta.value = text; card.appendChild(ta);
        var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
        d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
        setTimeout(function () { ta.focus(); ta.select(); }, 30);
      });
    }
    try {
      navigator.clipboard.writeText(text).then(function () { toast(T('pgnCopied')); }, manual);
    } catch (e) { manual(); }
  }

  // ------------------------------------------------------------------ settings, layout, persistence
  function saveSettings() { save('settings', settings); }
  function applySettings() {
    $('shell').dataset.board = settings.board;
    $('shell').dataset.jdot = (prog.equip && prog.equip.jdot) || ''; $('shell').dataset.frame = (prog.equip && prog.equip.frame) || '';
    board.speed = settings.anim === 'off' ? 0 : settings.anim === 'fast' ? 0.6 : 1;
    board.setCoords(settings.coords);
    Sound.setEnabled(settings.sound);
  }
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = T(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', T(el.dataset.i18nAria)); });
    if (game) renderAll();
    if (typeof renderNav === 'function' && curView) { renderNav(); if (curView !== 'game') refreshView(); }
  }
  function layout() {
    if (app.hidden) return; // the game view is measured when it is shown
    var cs = getComputedStyle(app), padL = parseFloat(cs.paddingLeft) || 16, padR = parseFloat(cs.paddingRight) || 16;
    var W = app.clientWidth - padL - padR, H = app.clientHeight - (parseFloat(cs.paddingBottom) || 0);
    var wide = app.clientWidth >= 860 && app.clientWidth > app.clientHeight * 1.05;
    app.classList.toggle('wide', wide);
    var rs = getComputedStyle(document.documentElement), px = function (n, d) { return parseFloat(rs.getPropertyValue(n)) || d; };
    var topH = px('--top-h', 52), barH = px('--bar-h', 48), ctlH = px('--ctl-h', 56), stripH = px('--strip-h', 34), gap = 6, size;
    if (wide) size = Math.min(W - 340 - 22, H - topH - 2 * barH - ctlH - 4 * gap - 12);
    else {
      var rv = $('review'), extra = rv && !rv.hidden ? rv.offsetHeight + gap : 0;
      var an = $('ana'); if (an && an.offsetHeight > 18) extra += an.offsetHeight - 18;
      size = Math.min(W, H - topH - 2 * barH - ctlH - stripH - 18 - 6 * gap - extra);
    }
    size = Math.max(200, Math.floor(size / 8) * 8);
    app.style.setProperty('--bs', size + 'px');
  }
  function persist() { if (game && !game.online && !game.archived) save('game', game.serialize()); }

  // ------------------------------------------------------------------ main loop (clock + flag)
  function tick() {
    if (game && game.status === 'playing') {
      var now = perf();
      if (game.checkFlag(now)) { gameOver(); return; }
      renderClocks(now);
      if (game.clock && game.cfg.tc.base > 30000 && !spectating()) {
        var mine = oppGame() ? game.cfg.human : game.pos.side, left = game.timeLeft(mine, now);
        // the soft warning comes once, the first time 20 seconds are left on my own turn
        if (left < 20000 && game.pos.side === mine && game.running() && !lowWarned) { lowWarned = true; Sound.play('lowtime'); haptic('warn'); }
      }
      if (game.online) onlineTick(now);
    }
  }
  function loop() { tick(); requestAnimationFrame(loop); }

  // ------------------------------------------------------------------ wiring
  $('btn-golden').addEventListener('click', onGoldenButton);
  $('btn-prev').addEventListener('click', function () { navStep(-1); });
  $('btn-next').addEventListener('click', function () { navStep(1); });
  $('btn-menu').addEventListener('click', showMenu);
  // back from a game goes to the tab where that kind of game starts
  function playHome() { return game && botGame() ? 'bots' : 'play'; }
  function gameHome() { return game && game.fromPlayer && player ? 'player' : game && game.fromHistory ? 'games' : playHome(); }
  $('btn-new').addEventListener('click', function () { go(playHome()); });
  ['bar-top', 'bar-bot'].forEach(function (id) { $(id).addEventListener('click', function (e) { if (e.target.closest('.clock')) return; oppCard(+this.dataset.color); }); });
  // who the opponent is: name, rating, the score with you; a house player (an account run by the developer) says so
  // a tap on the opponent's bar: their page (ratings, recent games, the score against you)
  function oppCard(color) {
    if (!game || !onlineGame() || spectating() || color === game.cfg.human || !online || !online.s) return;
    var s = online.s, uid = color === 0 ? s.white_id : s.black_id;
    if (uid) openPlayer(uid, game.cfg.names[color] || '');
  }
  $('btn-back').addEventListener('click', function () { go(gameHome()); });
  $('btn-settings').addEventListener('click', showSettings);
  $('btn-rules').addEventListener('click', showRules);
  function onMoveClick(e) {
    var x = e.target.closest('[data-exit]'); if (x) { exitExplore(); return; }
    var v = e.target.closest('[data-var]');
    if (v && explore) { var k = +v.dataset.var; if (k !== explore.view) { explore.view = k; selected = -1; board.sync(displayBoard(), []); renderAll(); if (analysis.on) requestAnalysis(); } return; }
    var b = e.target.closest('[data-ply]'); if (b) gotoPly(+b.dataset.ply);
  }
  $('strip').addEventListener('click', onMoveClick);
  $('sheet').addEventListener('click', onMoveClick);
  $('review').addEventListener('click', onGraphClick);
  $('view-games').addEventListener('click', onHistClick);
  $('view-profile').addEventListener('click', onHistClick);
  $('review-side').addEventListener('click', onGraphClick);
  function onNoticeClick(e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'draw-accept') onlineAction('draw', { op: 'accept' });
    else if (a === 'draw-decline') onlineAction('draw', { op: 'decline' });
    else if (a === 'rematch') rematch();
  }
  $('ana').addEventListener('click', onNoticeClick);
  $('ana-side').addEventListener('click', onNoticeClick);
  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') {
      if (currentDialog) { closeDialog(); return; }
      if (curView !== 'game') return;
      if (goldenArmed) setGoldenArmed(false);
      else if (premoves.length) cancelPremoves(false);
      else if (explore && (explore.line || explore.retry)) { exitExplore(true); return; } // Esc hides a line or a retry
      select(-1); return;
    }
    if (currentDialog || !game || curView !== 'game') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); navStep(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navStep(1); }
    else if (e.key === 'Home') gotoPly(0);
    else if (e.key === 'End') gotoPly(game.records.length);
    else if (e.key === 'f' || e.key === 'F') flip();
    else if (e.key === 'g' || e.key === 'G') onGoldenButton();
  });
  document.addEventListener('pointerdown', function () { Sound.unlock(); }, { capture: true, passive: true });
  document.addEventListener('touchend', function () { Sound.unlock(); }, { capture: true, passive: true });
  // a click and a key also count as the user's own action in every browser (a touch's pointerdown does not on iOS)
  document.addEventListener('click', function () { Sound.unlock(); }, { capture: true, passive: true });
  document.addEventListener('keydown', function () { Sound.unlock(); }, { capture: true, passive: true });
  window.addEventListener('resize', layout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  setInterval(function () { if (document.hidden) tick(); }, 250);

  // ------------------------------------------------------------------ online play
  // The server owns legality, clocks and results. Own moves are shown at once and confirmed by the
  // server; the opponent's moves arrive as full game states (broadcast, with polling as a fallback).
  var NETCFG = window.GC_ONLINE || null;
  var ONLINE_TCS = ['1+0', '2+1', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10'];
  var FIRST_MOVE_MS = 30000, CLAIM_GRACE = 300, PEER_TTL = 4000;
  // Leaving: the device tells the server it has the game in front of it every SEEN_MS (not while the app is in the
  // background); the side to move that was quiet for GONE_MS has left and loses. Away during the opponent's turn is fine.
  var GONE_MS = 20000, SEEN_MS = 5000, appActive = true;
  var net = null, netReady = null, me = null, userSub = null;
  var online = null;   // the open online game: { id, s, color, pending, sub, connected, lastEvent, oppHere, ... }
  var lobby = null;    // seeking or inviting: { kind, tc, rated, t0, timer, tick, gameId, sub }
  var clockOffset = 0, bestRtt = Infinity;
  var urlQ = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var profileSuffix = String(urlQ.get('p') || '').replace(/[^a-z0-9]/gi, '').slice(0, 8);
  // Google's answer back through google.html (#g_state=…&g_id_token=…), taken before boot tidies the address
  var googleBack = (function () {
    var hh = (location.hash || '').replace(/^#/, '');
    if (!/(^|&)g_state=/.test(hh)) return null;
    try { return new URLSearchParams(hh); } catch (e) { return null; }
  })();

  function poolOfMs(base, inc) { var s = base / 1000 + 40 * inc / 1000; return s < 180 ? 'bullet' : s < 480 ? 'blitz' : 'rapid'; }
  function poolOfLabel(label) { var t = parseTc(label); return t ? poolOfMs(t.base, t.inc) : 'blitz'; }
  function poolLine(pool, rated) { var p = T(pool); return T(rated ? 'ratedLine' : 'casualLine', { pool: lang === 'en' ? p.toLowerCase() : p }); }
  function serverNow() { return Date.now() + clockOffset; }
  function noteTime(srv, t0, t1) {
    if (!(srv > 0)) return;
    var rtt = t1 - t0;
    bestRtt += 25; // old samples age out
    if (rtt <= bestRtt) { bestRtt = rtt; clockOffset = srv + rtt / 2 - t1; }
  }
  // A CORS "simple" request (text/plain body, no custom headers; the token travels in the body), so the
  // browser never waits for a preflight round trip before a move.
  function postJson(url, body) {
    var t0 = Date.now();
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        noteTime(j && (j.now || (j.game && j.game.now)), t0, Date.now());
        if (!r.ok || (j && j.error)) { var e = new Error((j && j.error) || 'http_' + r.status); e.data = j; e.status = r.status; throw e; }
        return j;
      });
    });
  }

  // The iPhone / Android app is a Capacitor shell around this website. The shell injects its bridge into the page
  // (the site doesn't ship Capacitor's JS: it runs in ordinary browsers too), so plugins are called through
  // Capacitor.nativePromise / Capacitor.addListener. Google refuses to sign in inside an app's web view, so in the
  // app sign-in opens in the system browser and comes back to goldenchess://auth (see nativeUrl).
  var NATIVE = (function () {
    var C = window.Capacitor, on = false;
    try { on = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()); } catch (e) { on = false; }
    var platform = on && typeof C.getPlatform === 'function' ? C.getPlatform() : 'web';
    function call(plugin, method, opts) {
      if (!on || typeof C.nativePromise !== 'function') return Promise.reject(new Error('no_bridge'));
      try { return Promise.resolve(C.nativePromise(plugin, method, opts || {})); } catch (e) { return Promise.reject(e); }
    }
    function listen(plugin, ev, fn) { if (!on || typeof C.addListener !== 'function') return null; try { return C.addListener(plugin, ev, fn); } catch (e) { return null; } }
    function has(plugin) { if (!on) return false; try { return typeof C.isPluginAvailable === 'function' ? !!C.isPluginAvailable(plugin) : false; } catch (e) { return false; } }
    function openUrl(url) {
      // the in-app browser (Safari View Controller / Chrome Custom Tab); without the plugin the shell sends
      // a navigation to another site to the system browser anyway
      return call('Browser', 'open', { url: url, presentationStyle: 'popover' }).catch(function () { location.assign(url); });
    }
    return { on: on, platform: platform, redirect: 'goldenchess://auth', call: call, listen: listen, has: has, openUrl: openUrl };
  })();

  // ---- usage statistics (Google Analytics 4): how many people come, from where (links under videos carry utm_ tags) and
  // what they play. Only on the real site and in the apps that show it; Google signals and ad features off. In Europe
  // (told by the time zone) it starts once the player allows it; anywhere it can be turned off in Settings.
  var Track = (function () {
    var GA_ID = 'G-7H6JEWRSN5';
    var live = /(^|\.)(joker-chess|golden-chess)\.com$/.test(location.hostname) && !window.GC_APP_OFFLINE;
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
    var europe = /^Europe\//.test(tz) || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$/.test(tz);
    var started = false, queue = [], firstPage = true;
    function answer() { return load('gaConsent', null); } // 'yes' | 'no' | null (not asked)
    function allowed() { return live && settings.stats !== false && (europe ? answer() === 'yes' : answer() !== 'no'); }
    function start() {
      if (started || !allowed()) return;
      started = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_flags: 'SameSite=None;Secure' });
      window.gtag('set', 'user_properties', { platform: NATIVE.platform, app_lang: lang });
      var sc = document.createElement('script'); sc.async = true; sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      document.head.appendChild(sc);
      queue.splice(0).forEach(function (a) { window.gtag.apply(null, a); });
    }
    function event(name, params) {
      if (!live || settings.stats === false) return;
      var a = ['event', name, params || {}];
      if (started) window.gtag.apply(null, a); else if (queue.length < 40) queue.push(a);
    }
    // a tab is a page: /play, /learn …; the first one keeps the address's utm_ tags, which say where the visit came from
    function page(v) {
      event('page_view', { page_title: v, page_location: location.origin + '/' + v + (firstPage ? location.search : '') });
      firstPage = false;
    }
    function setOn(on) {
      if (on) { if (europe) save('gaConsent', 'yes'); start(); }
      else if (started && window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    // Europe, not asked yet: one small card above the tab bar, one bright button
    function ask() {
      if (!live || !europe || answer() !== null || settings.stats === false || document.getElementById('consent')) return;
      var c = h('div', { class: 'consent', id: 'consent', role: 'dialog', 'aria-live': 'polite' });
      c.appendChild(h('p', {}, esc(T('gaAsk'))));
      var row = h('div', { class: 'consent-acts' });
      var no = h('button', { class: 'sbtn', type: 'button', id: 'consent-no' }, esc(T('gaNo')));
      var yes = h('button', { class: 'sbtn hot', type: 'button', id: 'consent-yes' }, esc(T('gaYes')));
      no.addEventListener('click', function () { save('gaConsent', 'no'); c.remove(); });
      yes.addEventListener('click', function () { save('gaConsent', 'yes'); c.remove(); start(); });
      row.appendChild(no); row.appendChild(yes); c.appendChild(row);
      document.body.appendChild(c);
    }
    return { live: live, start: start, event: event, page: page, setOn: setOn, ask: ask };
  })();

  // ---- habits: the days played, the daily puzzle, the streak and the reminders on the phone (the rules: src/habits.js).
  // A day counts once: a finished game of any kind, a solved puzzle, a game review. Kept on the device (the day log on
  // the server counts the same days for players with an account).
  var habitDays = load('days', []), habitHours = load('hours', []), dailyDone = load('dailyDone', {});
  var FLAME_SVG = '<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.6 2.2c.6 3.1-1.6 4.6-1.6 7 0 1.3.9 2.3 2.1 2.3 1.5 0 2.3-1.2 2.1-2.9 2.1 1.5 3.4 3.9 3.4 6.3A6.6 6.6 0 0 1 12 21.6a6.6 6.6 0 0 1-6.6-6.7c0-4.6 4.1-7.6 7.2-12.7z" fill="currentColor"/><path d="M12.2 13.3c.3 1.3-.7 1.9-.7 2.9 0 .7.5 1.2 1.1 1.2.8 0 1.2-.6 1.1-1.5 1 .7 1.6 1.7 1.6 2.7a3.2 3.2 0 0 1-6.4 0c0-2 1.6-3.3 3.3-5.3z" fill="rgba(42,28,3,.35)"/></svg>';
  var DAILY_LIST = typeof JOKER_DAILY !== 'undefined' && JOKER_DAILY.length ? JOKER_DAILY : typeof JOKER_PUZZLES !== 'undefined' ? JOKER_PUZZLES : [];
  function todayStr() { return Habits.dayOf(new Date()); }
  // (prototype, Joker Pro) the days a freeze covered carry the streak across a break (proFz: src/pro.js)
  function streakNow() { return Habits.streak(habitDays, todayStr(), proAvail() && proFz && proFz.days ? proFz.days : null); }
  function dailyToday() { var d = Habits.dailyFor(todayStr(), DAILY_LIST); if (d) d.solved = dailyDone[d.day] === d.p.id; return d; }
  function returningPlayer() { return Habits.returning(habitDays, todayStr()); }
  function streakText(n) { return lang === 'ru' ? T('streakRu', { n: n, d: ruForm(n, ['день подряд', 'дня подряд', 'дней подряд']) }) : T('streakN', { n: n }); }
  function noteDay(kind) {
    var t = todayStr();
    if (kind !== 'review' && kind !== 'local') save('lastKind', kind); // what the player came for last: the reminders follow it
    if (habitDays.indexOf(t) >= 0) return false;
    habitDays.push(t); habitDays = habitDays.slice(-400); save('days', habitDays); progDirty();
    var st = streakNow();
    Track.event('streak_day', { count: st.count, kind: kind });
    if (st.count >= 2) setTimeout(function () { toast(streakText(st.count), 'gold'); }, 1100);
    if (curView === 'play') refreshView();
    planReminders();
    return true;
  }
  // the hours the player comes (the reminders go out at the usual one); one note per visit of three hours
  function noteVisit() {
    if (Date.now() - load('visitAt', 0) < 3 * 3600e3) return;
    save('visitAt', Date.now());
    habitHours.push(new Date().getHours()); habitHours = habitHours.slice(-20); save('hours', habitHours);
  }
  function solveDaily(d) {
    if (!d || dailyDone[d.day] === d.p.id) return;
    dailyDone[d.day] = d.p.id;
    progSmall('daily', Progress.XP.daily);
    var keep = {}; Object.keys(dailyDone).sort().slice(-60).forEach(function (k) { keep[k] = dailyDone[k]; }); dailyDone = keep;
    save('dailyDone', dailyDone);
    Track.event('daily_solved', { n: d.n, lvl: d.lvl });
    noteAct('learn');
    noteDay('daily');
    setTimeout(function () { askReminders('daily'); }, 2600);
  }
  function openDaily() { if (learnKit && learnKit.showDaily) learnKit.showDaily(); go('learn'); }
  function streakChip() {
    var st = streakNow();
    if (st.count < 2) return null;
    var b = h('button', { type: 'button', class: 'streak-chip' + (st.state === 'done' ? ' on' : st.state === 'paused' ? ' paused' : ''), id: 'streak-chip', 'aria-label': streakText(st.count) }, FLAME_SVG + '<b>' + st.count + '</b>');
    b.addEventListener('click', streakSheet);
    return b;
  }
  // the streak: the flame and its number, this week day by day, what keeps it today (the one bright action)
  function streakSheet() {
    var st = streakNow(), d = dailyToday();
    Track.event('streak_open', { count: st.count, state: st.state });
    openDialog(function (card) {
      currentDialog.dataset.kind = 'streak';
      card.classList.add('streak-card');
      card.appendChild(h('div', { class: 'streak-big' + (st.state === 'done' ? ' on' : '') }, FLAME_SVG + '<b>' + st.count + '</b>'));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(st.count ? streakText(st.count) : T('streakStart'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(st.state === 'done' ? T('streakDone') : st.state === 'paused' ? T('streakPaused') : st.lost ? T('streakLost', { n: st.lost }) : T('streakDue'))));
      var wk = h('div', { class: 'streak-week', id: 'streak-week' }), names = T('wdShort');
      st.week.forEach(function (x, i) { wk.appendChild(h('div', { class: 'wd' + (x.on ? ' on' : '') + (x.frozen ? ' frozen' : '') + (x.today ? ' today' : '') + (x.future ? ' future' : '') }, '<i>' + (x.on ? FLAME_SVG : x.frozen ? PERK_ICON.streak : '') + '</i><span>' + esc(names[i]) + '</span>')); });
      card.appendChild(wk);
      // (prototype, Joker Pro) a freeze carried this streak across a break in the last week
      var iced = proAvail() && st.count && proFz && (proFz.days || []).some(function (d) { var k = Habits.diffDays(d, todayStr()); return k >= 1 && k <= PRO.FREEZE_SPAN; });
      if (iced) card.appendChild(h('div', { class: 'streak-frozen', id: 'streak-frozen' }, proMark() + '<span>' + esc(PX('frozenNote', { n: PRO.freezesLeft(proFz, todayStr().slice(0, 7)) })) + '</span>'));
      card.appendChild(h('div', { class: 'dlg-note' }, esc(T('streakHow')) + (st.best > 1 ? ' ' + esc(T('streakBest', { n: st.best })) : '')));
      if (st.state !== 'done') {
        if (d && !d.solved) card.appendChild(bigBtn('start-btn', T('dailyH'), 'btn-streak-daily', function () { closeDialog(); openDaily(); }));
        else card.appendChild(bigBtn('start-btn', T('playMain'), 'btn-streak-play', function () { closeDialog(); go('play'); }));
      }
      if (PRO && proSells() && !isPro() && proMoments().indexOf('streak') >= 0) {
        var lostN = streakBefore().lost;
        var fz = h('button', { type: 'button', class: 'op-pro', id: 'btn-streak-pro' }, '<span class="pro-mark">' + esc(PX('mark')) + '</span><span>' + esc(PX('why_streak', { n: lostN })) + '</span>');
        fz.addEventListener('click', function () { Track.event('pro_gate', { why: 'streak' }); proSheet('streak', { n: lostN }, streakSheet); });
        card.appendChild(fz);
      }
      if (NETCFG && !signedIn() && st.count >= 2) {
        var sv = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-save-streak' }, esc(T('saveStreak')));
        sv.addEventListener('click', function () { Track.event('save_prompt', { where: 'streak' }); showAccount(streakSheet); });
        card.appendChild(sv);
      }
    });
  }
  // ---- reminders: notifications the phone itself shows at set times (Capacitor's LocalNotifications, in the app from
  // the build that carries the plugin; nothing on the web). No server, no push keys: the plan (Habits.plan) is made
  // again on every visit and every time the app goes to the background, so it always starts from the last visit.
  var REMIND_IDS = []; (function () { for (var i = 7000; i <= 7030; i++) REMIND_IDS.push({ id: i }); })();
  function remindersAvailable() { return (NATIVE.on && NATIVE.has('LocalNotifications')) || !!window.GC_PROTO; }
  // what the plan needs to know about the player: what they came for last (the reminders of the first days follow
  // it), the career's next opponent by name, whether they play for the level, a season a few stars away
  function remindInputs() {
    var last = load('lastKind', ''), mode = last === 'online' ? 'online' : last === 'bot' ? 'career' : last === 'puzzle' || last === 'daily' ? 'puzzles' : '';
    var nx = Progress.nextStage(prog.career, isPro()), stars = Progress.careerStars(prog.career), season = null;
    for (var i = 0; i < Progress.SEASONS.length; i++) {
      var left = Progress.SEASONS[i].need - stars;
      if (left > 0) { if (left <= 3) season = { name: PT('s_' + Progress.SEASONS[i].key), n: left }; break; }
    }
    return { now: new Date(), lang: lang, days: habitDays, hours: habitHours, hasGame: load('history', []).length > 0 || !!(hist && hist.online && hist.online.length),
      mode: mode, next: nx && window.GCBots ? { name: GCBots.castName(nx.who, lang), elo: nx.elo } : null, bonus: prog.xp > 0, season: season };
  }
  function remindPlan() { return settings.reminders ? Habits.plan(remindInputs()) : []; }
  // the player is here: a reminder still lying in the phone's list has done its work (or was never needed)
  function clearShownReminders() {
    if (!NATIVE.on || !NATIVE.has('LocalNotifications')) return;
    NATIVE.call('LocalNotifications', 'removeAllDeliveredNotifications').catch(function () { /* nothing shown */ });
  }
  var remindChannel = false;
  function planReminders() {
    if (!NATIVE.on || !NATIVE.has('LocalNotifications')) return;
    var items = remindPlan();
    var ch = NATIVE.platform === 'android' && !remindChannel ? NATIVE.call('LocalNotifications', 'createChannel', { id: 'reminders', name: T('reminders'), importance: 3, visibility: 1 }).then(function () { remindChannel = true; }, function () { /* the default channel then */ }) : Promise.resolve();
    ch.then(function () { return NATIVE.call('LocalNotifications', 'cancel', { notifications: REMIND_IDS }); }).catch(function () { /* nothing pending */ }).then(function () {
      if (!items.length) return null;
      return NATIVE.call('LocalNotifications', 'schedule', { notifications: items.map(function (x) {
        // a reminder may come a few minutes late: no exact alarm, so Android never asks for the "Alarms & reminders" access.
        // The time goes as a Date itself, never as text: the iPhone's plugin takes only a real date (the bridge hands
        // it over as one), and a time it cannot read is no time at all: it shows the notification at once, all of
        // them. Android's bridge writes the same Date out as the text its plugin reads.
        var n = { id: x.id, title: x.title, body: x.body, schedule: { at: new Date(x.at.getTime()), allowWhileIdle: true }, isExactNotification: false, extra: { go: x.go, kind: x.kind }, smallIcon: 'ic_stat_joker', iconColor: '#F0B941' };
        if (NATIVE.platform === 'android' && remindChannel) n.channelId = 'reminders';
        return n;
      }) });
    }).catch(function () { /* the plugin refused: no reminders this time */ });
  }
  // asked at a good moment (after a finished game, a solved daily puzzle), at most three times, two days apart
  function remindAskDue() {
    if (!remindersAvailable() || settings.reminders != null) return false;
    var a = load('remindAsk', { n: 0, at: 0 });
    return a.n < 3 && Date.now() - a.at > 2 * 864e5;
  }
  function askReminders(reason, force) {
    if (!remindersAvailable() || (settings.reminders != null && !force) || currentDialog) return;
    if (!force && !remindAskDue()) return;
    askedNow();
    var a = load('remindAsk', { n: 0, at: 0 });
    save('remindAsk', { n: a.n + 1, at: Date.now() });
    Track.event('reminders_ask', { reason: reason });
    openDialog(function (card) {
      currentDialog.dataset.kind = 'remind';
      card.classList.add('remind-card');
      card.appendChild(h('div', { class: 'remind-art', 'aria-hidden': 'true' }, '<span class="bell">' + jokerPiece() + '</span>'));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('remindT'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('remindSub'))));
      card.appendChild(bigBtn('start-btn', T('remindOn'), 'btn-remind-on', function () {
        closeDialog();
        var req = NATIVE.on && NATIVE.has('LocalNotifications') ? NATIVE.call('LocalNotifications', 'requestPermissions') : Promise.resolve({ display: 'granted' });
        req.then(function (p) { settings.reminders = !!p && p.display === 'granted'; }, function () { settings.reminders = false; }).then(function () {
          saveSettings(); planReminders(); Track.event('reminders', { on: !!settings.reminders, reason: reason });
        });
      }));
      var later = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-remind-later' }, esc(T('notNowBtn')));
      later.addEventListener('click', function () { closeDialog(); Track.event('reminders_later', { reason: reason }); });
      card.appendChild(later);
    });
  }
  // ---- the prototype's preview (dist/proto.html only): made-up days to see each new screen without waiting for them
  function protoTour() {
    var pill = h('button', { type: 'button', class: 'proto-pill', id: 'proto-pill' }, esc(lang === 'ru' ? 'Прототип' : 'Prototype'));
    pill.addEventListener('click', protoSheet);
    document.body.appendChild(pill);
  }
  function protoSet(rel, solved) {
    var t = todayStr();
    habitDays = rel.map(function (k) { return Habits.addDays(t, k); }); save('days', habitDays);
    dailyDone = {};
    if (proAvail()) { proFz = null; save('proFz', null); } // the made-up days start without freezes used
    if (solved) { var d = Habits.dailyFor(t, DAILY_LIST); dailyDone[t] = d.p.id; }
    save('dailyDone', dailyDone);
    closeDialog(); go('play'); refreshView();
  }
  function protoSheet() {
    var ru = lang === 'ru';
    // the Learn tab from a given place: nothing solved (the coach's first lesson), or at a puzzle from a real game
    function learnAt(id, fresh) {
      if (fresh) save('puzzles', {});
      try { localStorage.setItem('goldenchess.puzzleAt', id); } catch (e) { /* private mode */ }
      save('dailyAuto', todayStr());
      learnKit = null; closeDialog(); go('play'); go('learn');
    }
    var later = function (fn) { closeDialog(); setTimeout(fn, 250); };
    // Joker Pro (src/pro.js): the paid tier's screens, each from the place a player meets it
    var proRows = !proAvail() ? [] : [
      [ru ? 'Экран оплаты' : 'The paywall', function () { later(function () { proSheet(); }); }],
      [isPro() ? (ru ? 'Выключить Pro (сейчас включён)' : 'Turn Pro off (it is on now)') : (ru ? 'Включить Pro без экрана оплаты' : 'Turn Pro on without the paywall'), function () {
        if (isPro()) proOff(); else { proState = PRO.start('year', Date.now()); save('pro', proState); proRefresh(); }
        closeDialog(); go('profile'); refreshView();
      }],
      [ru ? 'Партия с ботом: имя и подсказка в меню' : 'A bot game: the name, the hint in the menu', function () { protoProg(); closeDialog(); startGame({ mode: 'bot', level: 2, bot: 'mila', color: 'w', tc: 'none' }); }],
      [ru ? 'Итог партии и опыт' : 'A result card and its XP', function () { protoProg(); later(protoStageWin); }],
      [ru ? 'Разбор партии: карточка «Разбор джокера»' : 'A game review: the Joker analysis card', function () { closeDialog(); protoMissed(); }],
      [ru ? 'Дорога и закрытые сезоны' : 'The Road and its locked seasons', function () { protoProg(); closeDialog(); botsUi.tab = 'career'; go('bots'); refreshView(); }],
      [ru ? 'Все боты, Джокер под замком' : 'All bots, the Joker locked', function () { protoProg(); closeDialog(); botsUi.tab = 'free'; botsUi.keep = true; botsUi.sel = Progress.BOTS.length - 1; go('bots'); refreshView(); }],
      [ru ? 'Задания дня и задание Pro' : 'The day’s quests and the Pro quest', function () { protoProg(); closeDialog(); go('play'); refreshView(); setTimeout(progressSheet, 300); }],
      [ru ? 'Коллекция и оформление Pro' : 'The collection and the Pro looks', function () { protoProg(); later(collectionSheet); }],
      [ru ? 'Статистика «Мои джокеры»' : 'The “My Jokers” statistics', function () { protoProg(); later(proInsights); }],
      [ru ? 'Вернулся через пять дней: серия цела (с Pro)' : 'Back after five days: the streak is safe (with Pro)', function () {
        var t = todayStr(); habitDays = [-9, -8, -7, -6].map(function (k) { return Habits.addDays(t, k); }); save('days', habitDays);
        proFz = null; save('proFz', null); proFreezeCheck();
        closeDialog(); go('play'); refreshView(); setTimeout(streakSheet, 300);
      }],
      [ru ? 'Профиль и карточка Joker Pro' : 'The Profile tab and its Joker Pro line', function () { protoProg(); closeDialog(); go('profile'); refreshView(); }],
      [ru ? 'Статус Joker Pro (нужен включённый Pro)' : 'The Joker Pro status (with Pro on)', function () { protoProg(); if (!isPro()) { proState = PRO.start('year', Date.now()); save('pro', proState); proRefresh(); } later(proStatus); }],
      [ru ? 'Обучение: пак задач и марафон' : 'Learn: the puzzle pack and the marathon', function () {
        var d = load('puzzles', {}); d.i1 = d.i1 || 1; d.i2 = d.i2 || 1; d.i3 = d.i3 || 1; save('puzzles', d); save('dailyAuto', todayStr());
        learnKit = null; closeDialog(); go('play'); go('learn');
      }],
      [ru ? 'Строка о Pro на главной (без Pro)' : 'The line about Pro on the Play tab (without Pro)', function () {
        if (isPro()) proOff();
        proOf = { first: Habits.addDays(todayStr(), -9), banner: { id: 'plain', day: todayStr() } }; save('proOffer', proOf);
        closeDialog(); go('play'); refreshView();
      }],
      [ru ? 'Предложение после партии: сгоревшая серия' : 'The offer after a game: a streak that ran out', function () {
        if (isPro()) proOff();
        var t = todayStr(); habitDays = [-9, -8, -7, -6].map(function (k) { return Habits.addDays(t, k); }); save('days', habitDays); proFz = null; save('proFz', null);
        proOf = { first: Habits.addDays(t, -9) }; later(function () { proOfferSheet('streak'); });
      }],
      [ru ? 'Предложение после партии: новый ранг' : 'The offer after a game: a new rank', function () { if (isPro()) proOff(); protoProg(); proOf = proOf || { first: Habits.addDays(todayStr(), -9) }; later(function () { proOfferSheet('rank'); }); }]
    ];
    var rows = proRows.concat([
      [ru ? 'Новое: тренер Оскар, первый урок (Обучение)' : 'New: Oskar the coach, the first lesson (Learn)', function () { protoSet([]); learnAt('i1', true); }],
      [ru ? 'Новое: задача из настоящей партии' : 'New: a puzzle from a real game', function () { learnAt((typeof JOKER_REAL !== 'undefined' && JOKER_REAL[8] || { id: 'i1' }).id, false); }],
      [ru ? 'Новое: Путь к Джокеру, 16 соперников' : 'New: Road to Joker, 16 opponents', function () { protoProg(); closeDialog(); botsUi.tab = 'career'; go('bots'); }],
      [ru ? 'Новое: все боты, те же имена и рейтинги' : 'New: all bots, the same names and ratings', function () { closeDialog(); botsUi.tab = 'free'; botsUi.keep = true; go('bots'); }],
      [ru ? 'Новое: статус рядом с именем (партия с ботом)' : 'New: the status next to the name (a bot game)', function () { protoProg(); closeDialog(); startGame({ mode: 'bot', level: 2, bot: 'mila', color: 'w', tc: 'none' }); }],
      [ru ? 'Новое: статус в Профиле' : 'New: the status on the Profile tab', function () { protoProg(); closeDialog(); go('profile'); }],
      [ru ? 'Новое: напоминания про карьеру и бонус дня' : 'New: reminders about the career and the day’s bonus', function () { protoProg(); save('lastKind', 'bot'); closeDialog(); setTimeout(remindPlanSheet, 250); }],
      [ru ? 'День 1: новичок (ролик на главной)' : 'Day 1: a newcomer (the reel on Play)', function () { protoSet([]); }],
      [ru ? 'День 4: вернулся, серия 3 дня, задача дня ждёт' : 'Day 4: back with a 3-day streak, daily puzzle waiting', function () { protoSet([-3, -2, -1]); }],
      [ru ? 'Сегодня уже сыграно и задача решена' : 'Played today, daily puzzle solved', function () { protoSet([-2, -1, 0], true); }],
      [ru ? 'Пропустил вчера: серия на паузе' : 'Missed yesterday: streak paused', function () { protoSet([-4, -3, -2]); }],
      [ru ? 'Три дня не заходил: серия сгорела' : 'Three days away: streak lost', function () { protoSet([-8, -7, -6]); }],
      [ru ? 'Окно серии' : 'The streak sheet', function () { closeDialog(); setTimeout(streakSheet, 250); }],
      [ru ? 'Просьба включить напоминания' : 'The reminders ask', function () { closeDialog(); setTimeout(function () { askReminders('proto', true); }, 250); }],
      [ru ? 'План напоминаний: тексты и время' : 'Reminder plan: texts and times', function () { closeDialog(); setTimeout(remindPlanSheet, 250); }],
      [ru ? 'Игра: уровень, задания, прогресс' : 'Game: level, quests, progress', function () { protoProg(); closeDialog(); go('play'); refreshView(); setTimeout(progressSheet, 300); }],
      [ru ? 'Игра: карточка соперника (цели и звёзды)' : 'Game: an opponent’s card (goals and stars)', function () { protoProg(); closeDialog(); setTimeout(function () { stageSheet(2); }, 250); }],
      [ru ? 'Игра: победа над соперником (звёзды, опыт, новый сезон)' : 'Game: an opponent beaten (stars, XP, a new season)', function () { protoProg(); closeDialog(); setTimeout(protoStageWin, 250); }],
      [ru ? 'Игра: новый уровень и награды' : 'Game: a new level and its rewards', function () { protoProg(); closeDialog(); setTimeout(function () { levelUpSheet({ lv: 7, stars: 3 }, { lv: 8, stars: 3 }); }, 250); }],
      [ru ? 'Игра: коллекция ходов-джокеров и награды' : 'Game: the Joker Move collection and rewards', function () { protoProg(); closeDialog(); setTimeout(collectionSheet, 250); }],
      [ru ? 'Письма: согласие при сохранении аккаунта' : 'Emails: the yes while saving the account', function () { closeDialog(); setTimeout(function () { showAccount(null); }, 250); }],
      [ru ? 'Письма: карточка в Профиле' : 'Emails: the card on the Profile tab', function () { closeDialog(); setTimeout(emailCardSheet, 250); }],
      [ru ? 'Честная игра: жалоба на соперника' : 'Fair play: reporting an opponent', function () { closeDialog(); setTimeout(function () { reportSheet('proto', 'NightOwlGM', null); }, 250); }],
      [ru ? 'Честная игра: список владельца' : 'Fair play: the owner\'s list', function () { closeDialog(); setTimeout(fairListSheet, 250); }],
      [ru ? 'Честная игра: закрытый аккаунт' : 'Fair play: a closed account', function () { closeDialog(); setTimeout(closedSheet, 250); }]
    ]);
    openDialog(function (card) {
      currentDialog.dataset.kind = 'proto';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(proRows.length ? (ru ? 'Прототип: Joker Pro' : 'Prototype: Joker Pro') : (ru ? 'Прототип: удержание' : 'Prototype: retention'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(proRows.length ? (ru ? 'Оплата не списывается. Pro и выдуманные дни живут только на этом устройстве. Ничего из этого не выкачено.' : 'No payment is taken. Pro and the made-up days live on this device only. None of this is live.')
        : (ru ? 'Дни выдуманы и живут только на этом устройстве. Ничего из этого не выкачено.' : 'Made-up days, on this device only. None of this is live.'))));
      var list = h('div', { class: 'proto-list' });
      rows.forEach(function (r, i) {
        var pro = i < proRows.length, b = h('button', { type: 'button', class: 'second-btn proto-row' + (pro ? ' pro' : ''), id: pro ? 'proto-pro-' + i : 'proto-' + (i - proRows.length) }, esc(r[0]));
        if (!pro && proRows.length) b.hidden = true; // the earlier prototypes' screens: one tap away, under the Pro ones
        b.addEventListener('click', r[1]); list.appendChild(b);
      });
      card.appendChild(list);
      if (proRows.length) {
        var more = h('button', { type: 'button', class: 'linkbtn center', id: 'proto-more' }, esc(ru ? 'Остальные экраны: удержание, письма, честная игра' : 'The other screens: retention, emails, fair play'));
        more.addEventListener('click', function () { list.querySelectorAll('[hidden]').forEach(function (x) { x.hidden = false; }); more.remove(); });
        card.appendChild(more);
      }
    });
  }
  // the owner's look at the plan: when each reminder would go out and what it says
  function remindPlanSheet() {
    var items = Habits.plan(Object.assign(remindInputs(), { hasGame: true }));
    openDialog(function (card) {
      currentDialog.dataset.kind = 'remind-plan';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('remindPlanH'))));
      if (!items.length) { card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('remindNone')))); return; }
      var ul = h('div', { class: 'remind-list', id: 'remind-list' });
      items.forEach(function (x) {
        var when = x.at.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + x.at.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
        ul.appendChild(h('div', { class: 'remind-item' }, '<span class="when">' + esc(when) + '</span><b>' + esc(x.title) + '</b><span class="body">' + esc(x.body) + '</span>'));
      });
      card.appendChild(ul);
    });
  }

  // ---- progress (prototype; src/progress.js): XP and levels, three quests a day, the career against the bots, the
  // Joker cards. A game of its own on this device: it never touches the rating or the online pairing.
  function saveProg() { save('prog', prog); progDirty(); }
  // ---- the progress on the account (prototype; the server says it keeps it in hello: me.prog). When the session opens,
  // what this device has is merged with what the account has (Progress.mergeSave: nothing earned is lost) and the
  // result is kept on both; after that the device sends it a few seconds after it changes. The XP on the profile is
  // the rank badge other players see next to the name.
  var progTimer = 0, progSent = '';
  function progBlob() {
    return { v: 1, prog: { xp: prog.xp, career: prog.career, cards: prog.cards, q: prog.q, firstWin: prog.firstWin, equip: prog.equip, seen: prog.seen },
      days: habitDays, puzzles: load('puzzles', {}), dailyDone: dailyDone, stats: stats };
  }
  function progTake(m) {
    prog = Object.assign({ xp: 0, career: {}, cards: {}, q: null, firstWin: '', equip: {}, seen: { lv: 1, stars: 0 } }, m.prog, { up: prog.up, reviewed: prog.reviewed });
    habitDays = m.days; dailyDone = m.dailyDone; stats = m.stats;
    save('prog', prog); save('days', habitDays); save('dailyDone', dailyDone); save('stats', stats); save('puzzles', m.puzzles);
    if (learnKit && learnKit.reload) learnKit.reload();
    applySettings(); refreshLevelChip();
    if (curView && curView !== 'game' && !currentDialog) refreshView();
  }
  function progSync() {
    if (!net || !me || !me.prog) return Promise.resolve(false);
    return net.call('progress', {}).then(function (r) {
      var here = Progress.mergeSave(progBlob(), null), m = Progress.mergeSave(progBlob(), r.data);
      progSent = r.data ? Progress.saveKey(Progress.mergeSave(r.data, null)) : '';
      if (Progress.saveKey(m) !== Progress.saveKey(here)) { progTake(m); Track.event('progress_restored', { xp: m.prog.xp }); }
      return progPush();
    }).catch(function () { return false; });
  }
  function progPush() {
    clearTimeout(progTimer); progTimer = 0;
    if (!net || !me || !me.prog) return Promise.resolve(false);
    var b = Progress.mergeSave(progBlob(), null), key = Progress.saveKey(b);
    if (key === progSent) return Promise.resolve(true);
    if (!progSent && key === Progress.saveKey(Progress.mergeSave(null, null))) return Promise.resolve(true); // nothing here, nothing there: nothing to keep yet
    return net.call('progress', { data: b }).then(function (r) { progSent = key; if (me && me.profile) me.profile.xp = r.xp; return true; }, function () { return false; });
  }
  function progDirty() { if (!me || !me.prog) return; clearTimeout(progTimer); progTimer = setTimeout(progPush, 4000); }
  document.addEventListener('visibilitychange', function () { if (document.hidden && progTimer) progPush(); });
  function progLevel() { return Progress.levelOf(prog.xp); }
  function progStars() { return Progress.careerStars(prog.career); }
  function PT(key, vars) { return Progress.t(lang, key, vars); }
  function progEvent(ev) {
    var fin = Progress.applyQuests(prog, todayStr(), ev, isPro()), xp = 0;
    fin.forEach(function (id) { xp += Progress.QUESTS[id][1]; });
    return { quests: fin, xp: xp };
  }
  // a level or a reward reached: celebrated once nothing is open and no game is on (never over a game)
  // a new level (or a reward for career stars): no sheet pops up by itself, where it could catch a tap meant for something
  // else. The result card shows it, and the header's level gets a dot until the celebration is opened.
  function progAfter() {
    var lv = progLevel().level, stars = progStars(), seen = prog.seen || { lv: 1, stars: 0 }, up = null;
    if (lv > seen.lv || Progress.newRewards(seen.lv, lv, seen.stars, stars).length) {
      up = { from: prog.up ? prog.up.from : { lv: seen.lv, stars: seen.stars }, to: { lv: lv, stars: stars } };
      if (Progress.rankOf(lv).key !== Progress.rankOf(seen.lv).key) { proRankDay = todayStr(); save('proRank', proRankDay); }
      prog.up = up; prog.seen = { lv: lv, stars: stars }; saveProg();
    }
    refreshLevelChip();
    return up;
  }
  function refreshLevelChip() { var c = $('lvl-chip'); if (c && c.parentNode) c.parentNode.replaceChild(levelChip(), c); }
  // Pro's share of an XP gain: added for a Pro player (the answer), only counted for the others where Pro is sold
  function proXp(total) {
    if (!PRO || !total) return 0;
    var b = PRO.bonusXp(total);
    if (isPro()) { proCount('bonus', b); return b; }
    if (proSells()) proCount('would', b);
    return 0;
  }
  // the celebration of a level-up: from the header's dot, or from the result card (back: to the result card again)
  function openLevelUp(u, back) {
    if (!u) return;
    if (prog.up) { prog.up = null; saveProg(); refreshLevelChip(); }
    levelUpSheet(u.from, u.to, back);
  }
  // a puzzle, the daily puzzle, a review: a little XP and the quests
  function progSmall(kind, n) {
    var q = progEvent({ type: kind }), total = (n || 0) + q.xp;
    if (total) total += proXp(total);
    if (!total) { saveProg(); return; }
    prog.xp += total; saveProg();
    var up = progAfter();
    toast(PT('xpGain', { n: total }) + (q.quests.length ? ' · ' + PT('x_quest') : '') + (up && up.to.lv > up.from.lv ? ' · ' + T('levelUp', { n: up.to.lv }) : ''));
  }
  // the Learn tab's coach: the level under the board, and what a solved puzzle gives. XP only for a Joker Move the
  // player found (the first time), the quests for every puzzle solved without the answer being shown; nothing pops
  // up over the puzzle: the coach says it, and the header's level gets its dot
  function coachLevelInfo() { var L = progLevel(); return { level: L.level, into: L.into, need: L.need, rank: Progress.rankName(lang, L.level), badge: rankBadge(L.level) }; }
  function puzzleDone(p, r) {
    var before = coachLevelInfo(), base = r.first ? Progress.puzzleXp(p, r) : 0;
    var q = r.shown ? { quests: [], xp: 0 } : progEvent({ type: 'puzzle', real: !!p.g }), total = base + q.xp;
    if (total) total += proXp(total);
    if (total) prog.xp += total;
    saveProg();
    if (total) progAfter();
    var after = coachLevelInfo();
    return { xp: total, quests: q.quests, before: before, after: after, up: after.level > before.level };
  }
  // a finished game: XP, the career stage's stars, Joker cards found, quests
  function progGame() {
    game.progDone = true;
    var mode = game.online ? 'online' : game.cfg.mode, human = game.online ? online.color : botGame() ? game.cfg.human : -1;
    var outcome = mode === 'local' ? 0 : humanOutcome(), win = game.result === '1-0' ? 0 : game.result === '0-1' ? 1 : -1;
    var mated = game.reason === 'checkmate' && win >= 0 && (human < 0 || win === human);
    var p = new GC.Position(game.startFen), joker = false, cards = [], own = 0;
    for (var i = 0; i < game.records.length; i++) {
      var r = game.records[i], mine = human < 0 || r.color === human;
      if (mine) own++;
      if (r.golden && mine) {
        joker = true;
        try { cards = cards.concat(Progress.classify(GC, p, r.m, i, mated && r.color === win ? game.records.length - 1 - i : null)); } catch (e) { /* a card less */ }
      }
      p.makeMove(r.m);
    }
    var queenKept = false;
    if (human >= 0) for (var sq = 0; sq < 128; sq++) { if (sq & 0x88) { sq += 7; continue; } if (p.board[sq] === ((human << 3) | 5)) queenKept = true; }
    var day = todayStr(), firstWin = outcome === 1 && mode !== 'local' && prog.firstWin !== day;
    if (firstWin) prog.firstWin = day;
    var gx = Progress.gameXp({ mode: mode, level: game.cfg.level, outcome: outcome, joker: joker, firstWin: firstWin });
    var total = gx.xp, lines = gx.lines.slice(), stage = null, cr = botGame() && game.cfg.career;
    if (cr) {
      var rec = Progress.recordStage(prog.career, cr.ch, { outcome: outcome, joker: joker, moves: own }, isPro());
      stage = { ch: cr.ch, bits: rec.bits, best: rec.best, newStars: rec.newStars, opened: rec.opened };
      if (rec.newStars) { total += rec.newStars * Progress.XP.star; lines.push({ k: 'star', n: rec.newStars * Progress.XP.star }); }
      Track.event('career_end', { ch: cr.ch, stars: Progress.starsOf(rec.bits) });
    }
    var fresh = [];
    cards.forEach(function (id) { if (!prog.cards[id] && fresh.indexOf(id) < 0) fresh.push(id); prog.cards[id] = (prog.cards[id] || 0) + 1; });
    fresh.forEach(function (id) { var x = Progress.CARD_XP[Progress.rarityOf(id)]; total += x; lines.push({ k: 'card', n: x }); });
    var q = progEvent({ type: 'game', mode: mode, outcome: outcome, joker: joker, queenKept: queenKept, stars: stage ? stage.newStars : 0 });
    if (q.xp) { total += q.xp; lines.push({ k: 'quest', n: q.xp }); }
    var bonus = 0, would = 0;
    if (proAvail()) { if (isPro()) { bonus = proXp(total); if (bonus) { total += bonus; lines.push({ k: 'pro', n: bonus }); } } else { would = PRO.bonusXp(total); proXp(total); } }
    var before = progLevel();
    prog.xp += total; saveProg();
    game.prog = { xp: total, lines: lines, stage: stage, cards: fresh, quests: q.quests, before: before, after: progLevel(), proBonus: bonus, proWould: would };
    Track.event('xp', { n: total, mode: mode });
    game.prog.up = progAfter();
  }
  // the result card's part: the stage's goals, the XP, new Joker cards
  function overProg() {
    var gp = game && game.prog;
    if (!gp || spectating()) return null;
    var box = h('div', { class: 'over-prog', id: 'over-prog' });
    if (gp.stage) {
      var sg = Progress.stage(gp.stage.ch), gl = '';
      sg.goals.forEach(function (g, k) { gl += '<div class="goal' + ((gp.stage.bits >> k) & 1 ? ' got' : '') + '"><i>★</i><span>' + esc(Progress.goalText(lang, g)) + '</span></div>'; });
      box.appendChild(h('div', { class: 'op-stage' }, '<div class="op-st-h">' + esc(PT('s_' + Progress.SEASONS[sg.season].key) + ' · ' + GCBots.castName(sg.who, lang)) +
        (gp.stage.newStars ? '<span class="new-stars">' + esc(T('newStars', { n: gp.stage.newStars })) + '</span>' : '') + '</div>' + gl));
      if (gp.stage.opened >= 0) box.appendChild(h('div', { class: 'op-season', id: 'op-season' }, '<i aria-hidden="true">★</i><span>' +
        esc(T('seasonOpened', { n: gp.stage.opened + 1, name: PT('s_' + Progress.SEASONS[gp.stage.opened].key) })) + '</span>'));
    }
    var L = gp.after;
    if (gp.up) {
      var u = gp.up, lvUp = u.to.lv > u.from.lv, news = Progress.newRewards(u.from.lv, u.to.lv, u.from.stars, u.to.stars);
      var what = news.map(function (r) { return PT('r_' + r.kind) + ' «' + Progress.rewardName(lang, r) + '»'; }).join(', ');
      var ub = h('button', { type: 'button', class: 'op-lvlup' + (motionOK() ? ' pop' : ''), id: 'btn-over-lvlup' }, rankBadge(u.to.lv) +
        '<span class="op-lu-t"><b>' + esc(lvUp ? T('levelUp', { n: u.to.lv }) : T('newRewards')) + '</b><span>' + esc(what || Progress.rankName(lang, u.to.lv)) + '</span></span>' +
        '<span class="op-lu-go">' + esc(T('lvlSee')) + '</span>');
      ub.addEventListener('click', function () { var g0 = game; openLevelUp(u, function () { if (game === g0 && game.status === 'over') showOver(); else closeDialog(); }); });
      box.appendChild(ub);
    }
    box.appendChild(h('div', { class: 'op-xp' }, '<span class="op-gain">' + esc(PT('xpGain', { n: gp.xp })) + '</span><span class="op-lv">' + esc(PT('level', { n: L.level })) + '</span>' +
      '<span class="xp-bar mini"><i style="width:' + Math.round(L.into / L.need * 100) + '%"></i></span>'));
    if (gp.proBonus && proAvail()) box.appendChild(h('div', { class: 'op-pro on', id: 'op-pro' }, proMark() + '<span>' + esc(PX('proBonus', { n: gp.proBonus })) + '</span>'));
    else if (gp.proWould && proAvail() && !isPro()) {
      var pw = h('button', { type: 'button', class: 'op-pro', id: 'op-pro' }, '<span class="pro-mark">' + esc(PX('mark')) + '</span><span>' + esc(PX('withPro', { n: gp.proWould })) + '</span>');
      pw.addEventListener('click', function () { var g0 = game; proSheet('xp', { n: gp.proWould }, function () { if (game === g0 && game.status === 'over') showOver(); else closeDialog(); }); });
      box.appendChild(pw);
    }
    if (gp.cards.length) box.appendChild(h('div', { class: 'op-cards' }, gp.cards.map(function (id) { return '<span class="jc-chip r' + Progress.rarityOf(id) + '">' + esc(T('newCard', { name: PT('c_' + id) })) + '</span>'; }).join('')));
    return box;
  }
  var RANK_PC = { pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' };
  function rankBadge(level, cls) {
    var rk = Progress.rankOf(level), pc = RANK_PC[rk.key];
    return '<span class="rank-badge rk-' + rk.key + (cls ? ' ' + cls : '') + '">' + (pc ? '<i class="pc-ic p-w' + pc + '"></i>' : jokerPiece()) + '</span>';
  }
  // the header's level: a ring filling up to the next level; a tap opens the progress
  function levelChip() {
    var L = progLevel(), rk = Progress.rankOf(L.level);
    var b = h('button', { type: 'button', class: 'lvl-chip rk-' + rk.key + (prog.up ? ' has-new' : ''), id: 'lvl-chip',
      'aria-label': PT('level', { n: L.level }) + ', ' + Progress.rankName(lang, L.level) + (prog.up ? '. ' + T('newRewards') : '') },
      '<span class="lvl-ring" style="--p:' + Math.round(L.into / L.need * 100) + '%"><span class="lvl-n">' + L.level + '</span></span>');
    b.addEventListener('click', function () { if (prog.up) openLevelUp(prog.up); else progressSheet(); });
    return b;
  }
  function progressSheet() {
    var L = progLevel(), nx = Progress.nextReward(L.level), today = todayStr();
    var q = prog.q && prog.q.day === today ? prog.q : { ids: Progress.questsFor(today), p: {}, done: {} };
    // (prototype, Joker Pro) the day's Pro quest: the fourth line for a Pro player, a locked one for everybody else
    var pq = proAvail() ? Progress.proQuestFor(today) : '', qids = q.ids.filter(function (id) { return Progress.QUESTS[id] && (id !== pq || isPro()); });
    if (pq && isPro() && qids.indexOf(pq) < 0) qids.push(pq);
    openDialog(function (card) {
      currentDialog.dataset.kind = 'progress';
      card.classList.add('prog-card');
      card.appendChild(h('div', { class: 'prog-top' }, rankBadge(L.level, 'big') + '<div><div class="dlg-title">' + esc(PT('level', { n: L.level })) + '</div><div class="prog-rank">' +
        esc(Progress.rankName(lang, L.level)) + (prog.equip.title ? ' · «' + esc(PT('t_' + prog.equip.title)) + '»' : '') + '</div></div>'));
      card.appendChild(h('div', { class: 'xp-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(L.need), 'aria-valuenow': String(L.into) },
        '<i style="width:' + Math.round(L.into / L.need * 100) + '%"></i><span>' + esc(PT('xpOf', { a: L.into, b: L.need })) + '</span>'));
      if (nx) card.appendChild(h('div', { class: 'prog-next' }, esc(T('nextRewardAt', { n: nx.lv, what: PT('r_' + nx.kind) + ' «' + Progress.rewardName(lang, nx) + '»' }))));
      card.appendChild(h('div', { class: 'prog-h' }, esc(T('questsToday'))));
      var ql = h('div', { class: 'quest-list', id: 'quest-list' });
      qids.forEach(function (id) {
        var n = Progress.QUESTS[id][0], have = Math.min(n, q.p[id] || 0), done = !!q.done[id];
        ql.appendChild(h('div', { class: 'quest' + (done ? ' done' : '') + (id === pq ? ' pro' : '') }, '<span class="q-check">' + (done ? '✓' : '') + '</span><span class="q-t"><span>' + (id === pq ? proMark() + ' ' : '') + esc(Progress.questText(lang, id)) + '</span><i><b style="width:' +
          Math.round(have / n * 100) + '%"></b></i></span><span class="q-n">' + (done ? '' : have + '/' + n + ' · ') + '+' + Progress.QUESTS[id][1] + '</span>'));
      });
      if (pq && !isPro()) {
        var lq = h('button', { type: 'button', class: 'quest pro locked', id: 'quest-pro' }, '<span class="q-check">' + LOCK_SVG + '</span><span class="q-t"><span><span class="pro-mark">' + esc(PX('mark')) + '</span> ' + esc(Progress.questText(lang, pq)) +
          '</span><em>' + esc(PX('proQuestLocked')) + '</em></span><span class="q-n">+' + Progress.QUESTS[pq][1] + '</span>');
        lq.addEventListener('click', function () { proSheet(); });
        ql.appendChild(lq);
      }
      card.appendChild(ql);
      card.appendChild(bigBtn('start-btn', T('careerTab'), 'btn-career', function () { closeDialog(); botsUi.tab = 'career'; go('bots'); }));
      var cl = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-collection' }, esc(T('collection')));
      cl.addEventListener('click', function () { closeDialog(); setTimeout(collectionSheet, 230); });
      card.appendChild(cl);
    });
  }
  function levelUpSheet(from, to, back) {
    var news = Progress.newRewards(from.lv, to.lv, from.stars, to.stars), up = to.lv > from.lv;
    Sound.play('win'); haptic('win');
    openDialog(function (card) {
      currentDialog.dataset.kind = 'level-up';
      currentDialog.classList.add('center');
      card.classList.add('lvlup-card');
      card.appendChild(h('div', { class: 'lvlup-badge' + (motionOK() ? ' pop' : '') }, rankBadge(to.lv, 'huge')));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(up ? T('levelUp', { n: to.lv }) : T('newRewards'))));
      if (up) card.appendChild(h('div', { class: 'dlg-sub' }, esc(Progress.rankName(lang, to.lv))));
      if (news.length) {
        var list = h('div', { class: 'reward-list' });
        var draw = function () { list.innerHTML = ''; news.forEach(function (r) { list.appendChild(rewardRow(r, true, draw)); }); };
        draw(); card.appendChild(list);
      }
      card.appendChild(bigBtn('start-btn', T('great'), 'btn-lvl-ok', function () { if (back) back(); else closeDialog(); }));
    });
  }
  function rewardSwatch(r) {
    if (r.kind === 'board') return '<span class="rsw sw-board" data-board="' + r.id + '"><i></i><i></i><i></i><i></i></span>';
    if (r.kind === 'jdot') return '<span class="rsw sw-jdot" data-jdot="' + r.id + '"><i></i></span>';
    if (r.kind === 'frame') return '<span class="rsw sw-frame" data-frame="' + r.id + '"><span class="ava av"><i>' + esc(initial(me && me.profile ? me.profile.username : 'J')) + '</i></span></span>';
    return '<span class="rsw sw-title">«»</span>';
  }
  function isEquipped(r) { return r.kind === 'board' ? settings.board === r.id : prog.equip[r.kind] === r.id; }
  function equipReward(r) {
    if (r.kind === 'board') { settings.board = isEquipped(r) ? 'slate' : r.id; saveSettings(); }
    else { prog.equip[r.kind] = isEquipped(r) ? null : r.id; saveProg(); }
    applySettings();
  }
  function rewardRow(r, own, redraw) {
    var row = h('div', { class: 'reward-row' + (own ? '' : ' locked') }, rewardSwatch(r) + '<span class="rw-t"><b>' + esc(Progress.rewardName(lang, r)) + '</b><span>' + esc(PT('r_' + r.kind)) +
      (own ? '' : ' · ' + esc(r.lv ? T('lockedAt', { n: r.lv }) : T('lockedStars', { n: r.stars }))) + '</span></span>');
    if (own) {
      var b = h('button', { type: 'button', class: 'second-btn rw-use' + (isEquipped(r) ? ' on' : '') }, esc(isEquipped(r) ? T('equipped') : T('equip')));
      b.addEventListener('click', function () { equipReward(r); if (redraw) redraw(); });
      row.appendChild(b);
    }
    return row;
  }
  function collectionSheet() {
    openDialog(function (card) {
      currentDialog.dataset.kind = 'collection';
      card.classList.add('coll-card');
      var L = progLevel(), stars = progStars(), found = Progress.CARDS.filter(function (c) { return prog.cards[c[0]]; }).length;
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('collection'))));
      card.appendChild(h('div', { class: 'prog-h' }, esc(T('jokerCards', { a: found, b: Progress.CARDS.length }))));
      var grid = h('div', { class: 'jcard-grid', id: 'jcard-grid' });
      Progress.CARDS.forEach(function (c) {
        var have = prog.cards[c[0]] || 0;
        grid.appendChild(h('div', { class: 'jcard r' + c[1] + (have ? '' : ' unknown') }, '<span class="jc-ic">' + (have ? jokerPiece() : '?') + '</span><b>' + esc(have ? PT('c_' + c[0]) : PT('rar' + c[1])) +
          '</b><span>' + esc(PT('cd_' + c[0])) + (have > 1 ? ' · ×' + have : '') + '</span>'));
      });
      card.appendChild(grid);
      card.appendChild(h('div', { class: 'prog-h' }, esc(T('rewardsH'))));
      var list = h('div', { class: 'reward-list', id: 'reward-list' });
      var draw = function () {
        list.innerHTML = '';
        var own = isPro() ? Progress.REWARDS : Progress.owned(L.level, stars);
        Progress.REWARDS.forEach(function (r) { list.appendChild(rewardRow(r, own.indexOf(r) >= 0, draw)); });
        if (plist) { plist.innerHTML = ''; PRO.LOOKS.forEach(function (r) { plist.appendChild(proLookRow(r, draw)); }); }
      };
      // (prototype, Joker Pro) the looks only Pro has, first: a title, a frame, a trail for the Joker Move, two boards
      var plist = null;
      if (proAvail()) {
        card.insertBefore(h('div', { class: 'prog-h pro-h' }, '<span class="pro-mark">' + esc(PX('mark')) + '</span> ' + esc(PX('looksH'))), list.previousSibling);
        plist = h('div', { class: 'reward-list pro-looks', id: 'pro-looks' });
        card.insertBefore(plist, list.previousSibling);
      }
      draw(); card.appendChild(list);
    });
  }
  function proLookRow(r, redraw) {
    var own = isPro();
    var row = h('div', { class: 'reward-row pro-look' + (own ? '' : ' locked') }, rewardSwatch(r) + '<span class="rw-t"><b>' + esc(Progress.rewardName(lang, r)) + '</b><span>' + esc(PT('r_' + r.kind)) + (own ? '' : ' · ' + esc(PX('lookNeed'))) + '</span></span>');
    var b = h('button', { type: 'button', class: 'second-btn rw-use' + (own && isEquipped(r) ? ' on' : '') }, own ? esc(isEquipped(r) ? T('equipped') : T('equip')) : '<span class="pro-mark">' + esc(PX('mark')) + '</span>');
    b.addEventListener('click', function () { if (isPro()) { equipReward(r); if (redraw) redraw(); } else proSheet('look'); });
    row.appendChild(b);
    return row;
  }
  // ---- the career: chapters of the Bots tab, a stage sheet, the game
  function starsHtml(bits) { var s = ''; for (var k = 0; k < 3; k++) s += '<i class="' + ((bits >> k) & 1 ? 'on' : '') + '">★</i>'; return s; }
  // the Profile's status: level and rank, the title in use, stars, Joker cards, the streak; a tap opens the progress
  function statusCard() {
    var L = progLevel(), found = Progress.CARDS.filter(function (c) { return prog.cards[c[0]]; }).length, sn = streakNow();
    var tile = function (n, label) { return '<span class="st-tile"><b>' + n + '</b><span>' + esc(label) + '</span></span>'; };
    var c = h('button', { type: 'button', class: 'status-card', id: 'status-card' },
      '<span class="sc-top">' + rankBadge(L.level, 'big') + '<span class="sc-t"><span class="sc-h">' + esc(T('statusH')) + '</span><b>' + esc(Progress.rankName(lang, L.level)) + '</b><span>' +
      esc(PT('level', { n: L.level })) + (prog.equip.title ? ' · «' + esc(PT('t_' + prog.equip.title)) + '»' : '') + '</span></span></span>' +
      '<span class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + L.need + '" aria-valuenow="' + L.into + '"><i style="width:' + Math.round(L.into / L.need * 100) + '%"></i><span>' + esc(PT('xpOf', { a: L.into, b: L.need })) + '</span></span>' +
      '<span class="st-tiles">' + tile(progStars(), T('statStars')) + tile(found + '/' + Progress.CARDS.length, T('statCards')) + tile(sn.count || 0, T('statStreak')) + '</span>');
    c.addEventListener('click', progressSheet);
    return c;
  }
  // the career, "Road to Joker": a road down the page through four seasons of four opponents, the engine at full
  // strength at its end. A season opens on stars; inside an open one anyone can be played. A tap on an opponent: their
  // card (who they are, the three goals, Play). The main button under the road plays the next one not beaten yet.
  var LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1.2c.7 0 1.3.6 1.3 1.3v8.4c0 .7-.6 1.3-1.3 1.3H5.800c-.7 0-1.3-.6-1.3-1.3v-8.400c0-.7.6-1.3 1.3-1.3zm2.200 0h5.600V8a2.800 2.800 0 0 0-5.600 0z" fill="currentColor"/></svg>';
  function renderCareer(inn) {
    var nx = Progress.nextStage(prog.career, isPro()), L = progLevel(), have = Progress.careerStars(prog.career), allOpen = isPro();
    var top = h('button', { type: 'button', class: 'career-top', id: 'career-top' }, rankBadge(L.level) + '<span class="ct-t"><b>' + esc(PT('level', { n: L.level }) + ' · ' + Progress.rankName(lang, L.level)) +
      '</b><span>' + esc(T('starsOf', { a: have, b: Progress.CHAPTERS * 3 })) + '</span></span><span class="xp-bar mini"><i style="width:' + Math.round(L.into / L.need * 100) + '%"></i></span>');
    top.addEventListener('click', progressSheet);
    inn.appendChild(top);
    // where things stand on the road: a banner for each season, then its four opponents down a winding line
    var BAN = 66, STEP = 164, y = 14, pts = [], bans = [], zones = [];
    Progress.SEASONS.forEach(function (sn, i) {
      var z0 = y - 14;
      bans.push({ i: i, y: y }); y += BAN + 26;
      for (var c = 0; c < Progress.PER_SEASON; c++) { var k = i * Progress.PER_SEASON + c; pts.push({ ch: k + 1, x: 50 + 23 * Math.sin(0.9 * k + 0.5), y: y }); y += STEP; }
      y += 12; zones.push({ i: i, y: z0, h: y - z0 - 14 });
    });
    var H = y + 6, done = 0;
    // the last season's tint runs to the bottom edge (no strip of the bare board under it)
    var lastZ = zones[zones.length - 1]; lastZ.h = H - lastZ.y;
    pts.forEach(function (p) { if ((prog.career[p.ch] || 0) & 1) done = p.ch; });
    var line = function (upTo) {
      var d = '';
      for (var k = 0; k < upTo; k++) {
        var p = pts[k], cy = p.y + 62;
        if (!k) d += 'M' + p.x.toFixed(1) + ' ' + cy;
        else { var q = pts[k - 1], qy = q.y + 62, m = (qy + cy) / 2; d += 'C' + q.x.toFixed(1) + ' ' + m + ' ' + p.x.toFixed(1) + ' ' + m + ' ' + p.x.toFixed(1) + ' ' + cy; }
      }
      return d;
    };
    var map = h('div', { class: 'cmap', id: 'road', style: 'height:' + H + 'px' });
    zones.forEach(function (z) { map.appendChild(h('div', { class: 'cm-zone z' + z.i + (Progress.seasonOpen(prog.career, z.i, allOpen) ? '' : ' locked'), style: 'top:' + z.y + 'px;height:' + z.h + 'px' })); });
    map.appendChild(h('div', { class: 'cm-svg' }, '<svg class="cm-path" viewBox="0 0 100 ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="p-all" d="' + line(pts.length) + '"/>' +
      (done > 1 ? '<path class="p-done" d="' + line(done) + '"/>' : '') + '</svg>'));
    bans.forEach(function (b) {
      var sn = Progress.SEASONS[b.i], open = Progress.seasonOpen(prog.career, b.i, allOpen);
      var ban = h('div', { class: 'cm-banner' + (open ? '' : ' locked'), id: 'season-' + (b.i + 1), style: 'top:' + b.y + 'px' },
        '<span class="sn-t"><span>' + esc(T('seasonN', { n: b.i + 1 })) + '</span><b>' + esc(PT('s_' + sn.key)) + '</b></span>' +
        (open ? '<span class="sn-stars">' + Progress.seasonStars(prog.career, b.i) + '/' + (Progress.PER_SEASON * 3) + ' ★</span>'
          : '<span class="sn-need">' + LOCK_SVG + '<span>' + esc(T('seasonNeed', { n: sn.need, have: have })) + '</span></span>'));
      // (prototype, Joker Pro) a locked season: stars open it, or Pro at once
      if (!open && proAvail()) {
        var sp = h('button', { type: 'button', class: 'sn-pro', id: 'season-pro-' + (b.i + 1) }, '<span class="pro-mark">' + esc(PX('mark')) + '</span><span>' + esc(PX('seasonPro')) + '</span>');
        sp.addEventListener('click', function () { proSheet('road'); });
        ban.appendChild(sp); ban.classList.add('has-pro');
      }
      map.appendChild(ban);
    });
    pts.forEach(function (p) {
      var sg = Progress.stage(p.ch), bits = prog.career[p.ch] || 0, open = Progress.isOpen(prog.career, p.ch, allOpen), cur = !!nx && nx.ch === p.ch;
      var nb = h('button', { type: 'button', class: 'cm-node' + (open ? '' : ' locked') + (bits & 1 ? ' done' : '') + (cur ? ' cur' : '') + (Progress.starsOf(bits) === 3 ? ' full' : ''), id: 'stage-' + p.ch,
        style: 'left:' + p.x.toFixed(1) + '%;top:' + p.y + 'px', 'aria-label': GCBots.castName(sg.who, lang, true) + ', ' + sg.elo + ', ' + T('starsOf', { a: Progress.starsOf(bits), b: 3 }) },
        '<span class="st-stars">' + starsHtml(bits) + '</span><span class="cm-face">' + GCBots.castAvatar(sg.who, lang) + (open ? '' : '<i class="cm-lock">' + LOCK_SVG + '</i>') + '</span>' +
        '<span class="cm-name">' + esc(GCBots.castName(sg.who, lang)) + '</span><span class="cm-elo">' + sg.elo + '</span>' + (cur ? '<span class="cm-you' + (motionOK() ? ' hop' : '') + '">' + jokerPiece() + '</span>' : ''));
      nb.addEventListener('click', function () { stageSheet(p.ch); });
      map.appendChild(nb);
    });
    inn.appendChild(map);
    // the squares under the road are a quarter of its width (set here: a background can't square itself)
    var fit = function () { if (map.isConnected && map.clientWidth) map.style.setProperty('--cell', (map.clientWidth / 4) + 'px'); };
    fit(); setTimeout(fit, 0);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(map);
    if (nx) {
      var bar = h('div', { class: 'cta-bar' });
      bar.appendChild(bigBtn('start-btn', T('roadPlay', { name: GCBots.castName(nx.who, lang) }), 'btn-career-go', function () { startCareer(nx.ch); }));
      inn.appendChild(bar);
      // the page opens where the player stands on the road (the first opponents are in sight anyway)
      if (nx.ch > 2) setTimeout(function () { var n = $('stage-' + nx.ch), host = $('view-bots'); if (n && host && curView === 'bots') host.scrollTop = Math.max(0, n.offsetTop + map.offsetTop - host.clientHeight * 0.38); }, 30);
    }
  }
  function goalsHtml(sg, bits) {
    var s = '';
    sg.goals.forEach(function (g, k) { s += '<div class="goal' + ((bits >> k) & 1 ? ' got' : '') + '"><i>★</i><span>' + esc(Progress.goalText(lang, g)) + '</span></div>'; });
    return s;
  }
  function stageSub(sg) { return sg.elo + ' · ' + T(sg.color === 'b' ? 'youBlack' : 'youWhite'); }
  function stageSheet(ch) {
    var sg = Progress.stage(ch), bits = prog.career[ch] || 0;
    openDialog(function (card) {
      currentDialog.dataset.kind = 'stage';
      card.classList.add('stage-card');
      card.appendChild(h('div', { class: 'stage-op' }, '<span class="face">' + GCBots.castAvatar(sg.who, lang) + '</span><div><div class="dlg-title">' + esc(GCBots.castName(sg.who, lang, true)) +
        '</div><div class="dlg-sub">' + esc(PT('s_' + Progress.SEASONS[sg.season].key) + ' · ' + stageSub(sg)) + '</div></div>'));
      card.appendChild(h('p', { class: 'bs-bio' }, esc(GCBots.castBio(sg.who, lang))));
      card.appendChild(h('div', { class: 'goal-list' }, goalsHtml(sg, bits)));
      if (Progress.isOpen(prog.career, ch, isPro())) card.appendChild(bigBtn('start-btn', T('roadPlay', { name: GCBots.castName(sg.who, lang) }), 'btn-stage-go', function () { closeDialog(); startCareer(ch); }));
      else {
        card.appendChild(h('div', { class: 'dlg-note', id: 'stage-locked' }, esc(T('lockedStage', { n: sg.season + 1 }) + '. ' + T('seasonNeed', { n: Progress.SEASONS[sg.season].need, have: Progress.careerStars(prog.career) }) + '.')));
        if (proAvail()) card.appendChild(bigBtn('start-btn', PX('seasonPro'), 'btn-stage-pro', function () { proSheet('road'); }));
      }
    });
  }
  function startCareer(ch) {
    var sg = Progress.stage(ch);
    botsUi.sel = ch - 1;
    startGame({ mode: 'bot', level: sg.level, bot: sg.who, color: sg.color, tc: 'none', career: { ch: ch } });
    Track.event('career_start', { ch: ch });
  }
  // the prototype tour: a player some days in
  // the tour's fourth opponent beaten (the three stars open the second season): a bishop's Joker Move (a new card), a resignation, the result card
  function protoStageWin() {
    startCareer(4); cancelBot();
    var g = game, now = performance.now();
    ['g1f3', 'e7e5', 'f1b5*', 'g8f6'].forEach(function (u) { var m = g.pos.moveFromUci(u); if (m) g.play(m, now); });
    g.end('1-0', 'resign', now); gameOver();
  }
  function protoProg() {
    var looks = isPro() && prog && prog.equip ? prog.equip : null; // a Pro player keeps the looks they picked from one tour screen to the next
    prog = { xp: Progress.xpAt(7) + 210, career: { 1: 3, 2: 1 }, cards: { knight: 3, queen: 2, early: 2, escape: 1, fork: 1, rook: 1 },
      q: { day: todayStr(), ids: Progress.questsFor(todayStr()), p: {}, done: {} }, firstWin: '', equip: Object.assign({ title: 'teleporter' }, looks), seen: { lv: 7, stars: 3 }, reviewed: [] };
    prog.q.p[prog.q.ids[0]] = 1; prog.q.done[prog.q.ids[0]] = true; prog.q.p[prog.q.ids[1]] = 1;
    if (isPro()) {
      var pq = Progress.proQuestFor(todayStr()), twin = { p_win3: 'win2', p_joker3: 'joker2', p_puzzles5: 'puzzles3' }[pq];
      prog.q.ids = Progress.questsFor(todayStr(), true);
      prog.q.p[pq] = prog.q.done[twin] ? Progress.QUESTS[twin][0] : prog.q.p[twin] || 1;
    }
    saveProg(); applySettings();
  }

  // ---- Joker Pro (src/pro.js): the paid tier. The game itself stays free; Pro adds the Joker analysis of every game,
  // hints against the bots, the puzzle pack and its marathon, more XP, the whole Road at once, streak freezes, a gold
  // name and looks of its own.
  //   Who has it: the server's word (profiles.pro_until / pro_founder, written by the pay function as Stripe reports).
  //     hello brings it; the device keeps it between visits (proSrv) so that nothing flickers before hello answers.
  //   Where it is sold: on the website, on Stripe's own payment page, once the server says so (hello: pro; without a
  //     session, the database's pro_public()). In the apps, through the App Store or Google Play (the section "Joker
  //     Pro in the apps" below), once the server says so for that store (hello: iap) and the app has the purchase
  //     plugin (from 1.5). An older app sells nothing and shows no way to buy: it honours what was bought elsewhere
  //     (proSells() is false there, isPro() is not).
  //   The prototype page (GC_PROTO) has a switch of its own on this device and charges nothing.
  var PRO = typeof Pro !== 'undefined' ? Pro : null;
  var PROTO_PRO = !!(PRO && window.GC_PROTO);
  var proState = load('pro', null), proHints = load('proHints', null), proFz = load('proFz', null), proJk = load('proJk', null);
  var proSrv = load('proSrv', null);          // the account's Pro as the server said it last: { uid, until, founder, plan, via }
  var proPub = load('proPub', null);          // asked without a session: { on, ios, android, left, at }
  var proInfo = null;                         // the pay function's fuller answer about the account (this visit only)
  var proTally = load('proTally', null) || {}; // what Pro has given, or would have: { bonus, would, checks, hints }
  var proOf = load('proOffer', null);         // the offers made so far (Pro.offerDue)
  var bootUid = (function () {
    try {
      if (NETCFG && NETCFG.mock != null) return localStorage.getItem('goldenchess.mockuid' + profileSuffix);
      var s = JSON.parse(localStorage.getItem('goldenchess.auth' + profileSuffix) || 'null');
      return (s && s.user && s.user.id) || null;
    } catch (e) { return null; }
  })();
  function proMine() {
    var s = me && me.profile ? PRO.ofProfile(me.profile) : null;
    if (s) return s;
    return proSrv && proSrv.uid && proSrv.uid === (me ? me.uid : bootUid) ? proSrv : null;
  }
  function isPro() { return !!PRO && (PROTO_PRO ? PRO.active(proState, Date.now()) : PRO.entitled(proMine(), Date.now())); }
  // Pro can be bought here
  function proSells() { return !!PRO && (PROTO_PRO || (!!NETCFG && (NATIVE.on ? iapOn() : (me ? !!me.pro : !!(proPub && proPub.on))))); }
  // Pro exists for this player, to buy or to use
  function proAvail() { return proSells() || isPro(); }
  function proFounder() { if (PROTO_PRO) return !!(proState && proState.founder); var s = proMine(); return !!(s && s.founder); }
  function PX(key, vars) { return PRO.t(lang, key, vars); }
  function proMark(founder) { return '<span class="pro-mark' + ((founder == null ? proFounder() : founder) ? ' founder' : '') + '" role="img" aria-label="' + esc(PX('name')) + '">' + esc(PX('mark')) + '</span>'; }
  function fmtCount(n) { return n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US'); }
  // a day in words: 20 November (the year only when it isn't this one)
  function fmtDay(ms) {
    var d = new Date(ms), o = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', o).replace(/\s*г\.$/, '');
  }
  function proCount(k, n) { if (!n) return; proTally[k] = (proTally[k] || 0) + n; save('proTally', proTally); }
  var PERK_ICON = {
    coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.700 10.700c.700.600 1.100 1.400 1.200 2.300h5c.100-.900.500-1.700 1.200-2.300A6 6 0 0 0 12 3z"/></svg>',
    puzzles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/><path d="M13 7.500h7M16.500 4v7M4 16.500h7"/></svg>',
    xp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 14h6l-1 7 9-12h-6z"/></svg>',
    road: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.600-1.700"/></svg>',
    status: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/></svg>',
    streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9"/></svg>'
  };
  // ---- what the server says. hello (or the pay function) has spoken: the device keeps it and the page follows a change
  var proWas = PRO && !PROTO_PRO ? isPro() : null;
  function proTake() {
    if (!PRO || PROTO_PRO || !me) return;
    var s = me.profile ? PRO.ofProfile(me.profile) : null;
    if (s) { proSrv = { uid: me.uid, until: s.until, founder: s.founder, plan: s.plan, via: proSrv && proSrv.uid === me.uid ? proSrv.via || null : null }; save('proSrv', proSrv); }
    var on = isPro();
    if (s && !on) proLooksBack(); // (only once the server has said so: the looks a Pro player wears must not go while the device waits for hello)
    if (proWas !== on) { proWas = on; proRefresh(); }
    proOfferStart();
    iapTake();
  }
  // where the account's Pro was bought: 'stripe' (the website), 'apple', 'google'; null when nobody has said
  function proVia() {
    if (proInfo && proInfo.pro) return proInfo.pro.via || null;
    return proSrv && proSrv.uid === (me ? me.uid : bootUid) ? proSrv.via || null : null;
  }
  // the pay function's answer about the account: { pro: { on, founder, until, plan, status, cancel, trial, trialUsed, sub, via }, can, test, foundersLeft }
  function proApply(r) {
    if (!r || !r.pro || !me || !me.profile) return;
    proInfo = r;
    me.profile.pro_until = !r.pro.founder && r.pro.until ? new Date(r.pro.until).toISOString() : null;
    me.profile.pro_founder = !!r.pro.founder; me.profile.pro_plan = r.pro.plan || null;
    proTake();
    if (proSrv && proSrv.uid === me.uid && proSrv.via !== (r.pro.via || null)) { proSrv.via = r.pro.via || null; save('proSrv', proSrv); }
  }
  function proAsk() {
    if (PROTO_PRO || !net || !net.pay || !me) return Promise.resolve(null);
    return net.pay('state', {}).then(function (r) { proApply(r); return r; }, function () { return null; });
  }
  // without a session nobody has said whether Pro is sold: the database answers anyone (kept for six hours)
  function proPublicAsk() {
    if (!PRO || PROTO_PRO || !NETCFG || (NATIVE.on && !iapHere()) || me || hasNetSession()) return;
    if (proPub && Date.now() - (proPub.at || 0) < 6 * 3600e3) { iapTake(); return; }
    // a plain request, not the client: asking opens no session and leaves the address alone
    (NETCFG.mock != null ? MockNet : SupaNet).proPublic(NETCFG).then(function (r) {
      var was = proSells();
      proPub = { on: !!(r && r.on), ios: !!(r && r.ios), android: !!(r && r.android), left: r && r.founders_left != null ? r.founders_left : null, at: Date.now() }; save('proPub', proPub);
      proOfferStart();
      if (proSells() !== was) proRefresh();
      iapTake();
    }, function () { /* asked again next time */ });
  }
  function proRefresh() {
    applySettings(); refreshLevelChip();
    if (game) { if (review && review.sum) computeReview(); renderAll(); }
    if (curView && curView !== 'game' && !currentDialog) refreshView();
  }
  // the looks only Pro has go back in the box
  function proLooksBack() { var any = false; PRO.LOOKS.forEach(function (r) { if (isEquipped(r)) { equipReward(r); any = true; } }); return any; }

  // ---- Joker Pro in the apps: bought through the App Store or Google Play, with the shell's NativePurchases plugin
  // (in the apps from 1.5). The store knows the products and their prices in the player's currency, and it takes the
  // money; the pay function checks every purchase with the store and puts it on the account, so what was bought in an
  // app is Pro on the website too. A guest may buy (the stores ask for that): the purchase sits on the guest's
  // account and stays with it when the account is saved; "Restore purchases" brings it to whichever account asks.
  var IAP = 'NativePurchases';
  var iapCat = load('iapCat', null);   // the store's word on the products: { store, at, cat: Pro.storeCatalog() }
  var iapAsk = null, iapErr = false, iapSynced = false, iapSyncT = 0;
  function iapStore() { return NATIVE.platform === 'ios' ? 'apple' : NATIVE.platform === 'android' ? 'google' : null; }
  // this app can sell
  function iapHere() { return !!PRO && !PROTO_PRO && NATIVE.on && !!iapStore() && NATIVE.has(IAP); }
  // ... and the server lets it (hello: iap; without a session, the database's pro_public())
  function iapAllowed() { return iapHere() && !!NETCFG && (me ? !!me.iap : !!(proPub && proPub[NATIVE.platform])); }
  function iapPlans() { return iapCat && iapCat.store === iapStore() && iapCat.cat ? iapCat.cat : null; }
  // ... and the store has named something to sell. Only then does Pro show a way to buy in the app
  function iapOn() { var c = iapAllowed() ? iapPlans() : null; return !!(c && (c.year || c.month || c.founder)); }
  // asks the store about the products (one question at a time; the answer is kept for the next visit)
  function iapLoad() {
    if (!iapHere()) return Promise.reject(new Error('no_store'));
    if (iapAsk) return iapAsk;
    var store = iapStore(), S = PRO.STORE[store], was = iapOn();
    var got = function (r) { return (r && r.products) || []; };
    var ask = store === 'apple'
      ? NATIVE.call(IAP, 'getProducts', { productIdentifiers: [S.month, S.year, S.founder], productType: 'subs' }).then(got)
      // (Google is asked for one kind at a time, one after the other: its billing client takes no two questions at once)
      : NATIVE.call(IAP, 'getProducts', { productIdentifiers: [S.sub], productType: 'subs' }).then(got, function () { return []; }).then(function (subs) {
        return NATIVE.call(IAP, 'getProducts', { productIdentifiers: [S.founder], productType: 'inapp' }).then(function (r) { return subs.concat(got(r)); }, function () { return subs; });
      });
    iapAsk = ask.then(function (list) {
      iapAsk = null;
      var cat = PRO.storeCatalog(store, list);
      if (!(cat.year || cat.month || cat.founder)) throw new Error('no_products');
      iapErr = false; iapCat = { store: store, at: Date.now(), cat: cat }; save('iapCat', iapCat);
      if (iapOn() !== was) { proOfferStart(); proRefresh(); }
      if (proRepaint) proRepaint();
      return cat;
    }, function (e) { iapAsk = null; throw e; });
    iapAsk.catch(function () { iapErr = true; if (proRepaint) proRepaint(); });
    return iapAsk;
  }
  // the server has spoken (hello, or the public answer): the prices are asked for, and once a visit the store's own
  // list of purchases is looked through
  function iapTake() {
    if (!iapHere()) return;
    if (iapAllowed() && (!iapPlans() || Date.now() - (iapCat.at || 0) > 3600e3)) iapLoad().catch(function () { /* the sheet asks again */ });
    if (me && !iapSynced) { iapSynced = true; iapSync(); }
  }
  // a purchase as the plugin describes it: is it one of ours, paid for
  function iapOurs(p) {
    if (!p) return false;
    if (iapStore() === 'apple') return typeof p.jwsRepresentation === 'string' && !!p.jwsRepresentation;
    var S = PRO.STORE.google;
    return typeof p.purchaseToken === 'string' && !!p.purchaseToken && (p.productIdentifier === S.sub || p.productIdentifier === S.founder) && String(p.purchaseState) === '1';
  }
  // the purchases go to the pay function, which checks them with the store; its answer is the account's Pro.
  // quiet: nobody asked (a start of the app, the store's news): a purchase another account holds stays there
  function iapClaim(list, quiet) {
    var body = iapStore() === 'apple' ? { store: 'apple', jws: list.map(function (p) { return p.jwsRepresentation; }) }
      : { store: 'google', items: list.map(function (p) { return { token: p.purchaseToken, type: p.productIdentifier === PRO.STORE.google.founder ? 'inapp' : 'subs' }; }) };
    if (quiet) body.quiet = true;
    return ensureNet().then(function () { return net.pay('store', body); }).then(function (r) { proApply(r); return r; });
  }
  // ... a few times, should the server be slow to hear from the store
  function iapSettle(list, n) {
    return iapClaim(list).then(function () { return isPro(); }, function () { return false; }).then(function (on) {
      if (on || n >= 3) return on;
      return new Promise(function (res) { setTimeout(res, (window.__gcFastBot ? 150 : 2500) * (n + 1)); }).then(function () { return iapSettle(list, n + 1); });
    });
  }
  function iapWhy(e) {
    var m = String((e && (e.message || e.errorMessage)) || e || ''), c = String((e && e.code) || '');
    return /cancel/i.test(m) || /USER_CANCELED/.test(c) ? 'cancel' : /pending/i.test(m) ? 'pending' : /ITEM_ALREADY_OWNED/.test(c) ? 'owned' : 'error';
  }
  function iapList() { return NATIVE.call(IAP, 'getPurchases', iapStore() === 'apple' ? { onlyCurrentEntitlements: true } : {}).then(function (r) { return ((r && r.purchases) || []).filter(iapOurs); }); }
  // buying: the store's own payment sheet, then the pay function hears of it
  function iapBuy(plan, why, setBusy) {
    var c = (iapPlans() || {})[plan];
    if (!c) { toast(PX('storeErr')); iapLoad().catch(function () { /* said above */ }); return; }
    var busy = function (on) { if (setBusy) setBusy(on); };
    busy(true);
    Track.event('pro_checkout', { plan: plan, why: why || 'open', via: iapStore() });
    ensureNet().then(function () {
      // (the account goes with the purchase: the store hands it back with every piece of news about it)
      var o = { productIdentifier: c.id, productType: plan === 'founder' ? 'inapp' : 'subs', quantity: 1, appAccountToken: me.uid };
      if (c.base) o.planIdentifier = c.base;
      return NATIVE.call(IAP, 'purchaseProduct', o);
    }).then(function (tx) {
      save('iapPend', { plan: plan, at: Date.now() }); // (paid; until the server has heard of it, the next start tries again)
      toast(PX('buyCheck'));
      return iapSettle([tx], 0);
    }).then(function (on) {
      busy(false);
      if (!on) { toast(PX('buyWait')); return; }
      save('iapPend', null);
      Track.event('pro_start', { plan: (proInfo && proInfo.pro && proInfo.pro.plan) || plan, why: why || 'open', via: iapStore() });
      proFreezeCheck();
      if (currentDialog && currentDialog.dataset.kind === 'pro') closeDialog();
      proRefresh();
      Sound.play('win'); haptic('win');
      setTimeout(proWelcome, 260);
    }, function (e) {
      busy(false);
      var w = iapWhy(e);
      if (w === 'cancel') { Track.event('pro_back', { plan: plan, via: iapStore() }); return; }
      if (w === 'owned') { iapRestore(); return; }
      toast(PX(w === 'pending' ? 'buyPending' : 'buyErr'));
    });
  }
  // "Restore purchases": what this store account has bought comes to the account that is playing here
  function iapRestore(done) {
    if (!iapHere()) return;
    toast(PX('restoreBusy'));
    (iapStore() === 'apple' ? NATIVE.call(IAP, 'restorePurchases') : Promise.resolve()).then(iapList).then(function (list) {
      return list.length ? iapClaim(list).then(function () { return isPro(); }) : false;
    }).then(function (on) {
      Track.event('pro_restore', { ok: !!on, via: iapStore() });
      toast(PX(on ? 'restoreOk' : 'restoreNone'));
      if (on) { save('iapPend', null); if (currentDialog && currentDialog.dataset.kind === 'pro') closeDialog(); proRefresh(); }
      if (done) done(!!on);
    }, function (e) { if (iapWhy(e) !== 'cancel') toast(PX('restoreErr')); if (done) done(false); });
  }
  // quietly, when the app starts with an account and when the store has news: a purchase made for this account that
  // the server has not heard of (its claim was lost on the way, a renewal's notice is late) is shown to it again.
  // Another account's purchase is left alone: that is what "Restore purchases" is for.
  function iapSync() {
    if (!iapHere() || !me || !net || !net.pay) return;
    var pend = load('iapPend', null);
    iapList().then(function (all) {
      var mine = String(me.uid).toLowerCase(), s = proMine();
      var list = all.filter(function (p) {
        if (pend) return true;
        if (String(p.appAccountToken || '').toLowerCase() !== mine) return false;
        if (!isPro()) return true;
        var exp = p.expirationDate ? Date.parse(p.expirationDate) : NaN;
        return isFinite(exp) && !!s && !s.founder && s.until != null && exp > s.until + 60000;
      });
      if (pend && (!list.length || Date.now() - (pend.at || 0) > 3 * 864e5)) save('iapPend', null);
      if (list.length) return iapClaim(list, true).then(function () { if (isPro()) save('iapPend', null); });
    }).catch(function () { /* the next start tries again */ });
  }
  function iapStart() {
    if (!iapHere()) return;
    NATIVE.listen(IAP, 'transactionUpdated', function () { clearTimeout(iapSyncT); iapSyncT = setTimeout(iapSync, 1500); });
    iapTake();
  }
  // the store's own page for the subscription (cancelling, the payment method)
  function iapManage() { return NATIVE.call(IAP, 'manageSubscriptions').catch(function () { toast(PX('manageErr')); }); }

  // ---- the seal: the Joker on a gold-rimmed chip (the offers, the Profile, wherever Pro is named in a picture)
  var sealN = 0;
  function proSeal(cls) {
    var id = 'psl' + (++sealN), inl = '';
    for (var a = 0; a < 360; a += 45) inl += '<rect x="54.5" y="5" width="11" height="9.5" rx="2.5" transform="rotate(' + a + ' 60 60)"/>';
    return '<span class="pro-seal' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><svg viewBox="0 0 120 120">' +
      '<defs><linearGradient id="' + id + 'g" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#ffe9b3"/><stop offset=".45" stop-color="#f0b941"/><stop offset="1" stop-color="#a47418"/></linearGradient>' +
      '<radialGradient id="' + id + 'd" cx=".36" cy=".3" r=".95"><stop offset="0" stop-color="#5b8478"/><stop offset=".55" stop-color="#31493f"/><stop offset="1" stop-color="#1b2522"/></radialGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="60" cy="60" r="56"/></clipPath></defs>' +
      '<circle cx="60" cy="60" r="56" fill="url(#' + id + 'g)"/><g fill="#22312c">' + inl + '</g>' +
      '<circle cx="60" cy="60" r="43.5" fill="url(#' + id + 'd)"/><circle cx="60" cy="60" r="43.5" fill="none" stroke="#ffe9b3" stroke-opacity=".75" stroke-width="1.6"/>' +
      jokerPiece().replace('<svg ', '<svg x="27" y="21" width="66" height="66" ') +
      '<g clip-path="url(#' + id + 'c)"><rect class="ps-shine" x="-70" y="-10" width="30" height="140" fill="#fff" opacity=".3" transform="rotate(20 60 60)"/></g>' +
      '</svg></span>';
  }
  // the Joker Pro card: the player's own name as Pro shows it
  function proCardArt(name, founder, sub) {
    return h('div', { class: 'pro-art' + (founder ? ' founder' : ''), id: 'pro-art' }, proSeal() +
      '<span class="pa-t"><b class="pa-name" id="pro-title">' + esc(PX('name')) + '</b>' +
      '<span class="pro-who"><span class="pro-nm">' + esc(name) + '</span>' + rankBadge(progLevel().level, 'mini') + proMark(!!founder) + '</span>' +
      (sub ? '<span class="pa-sub">' + esc(sub) + '</span>' : '') + '</span>');
  }

  // ---- the Pro sheet: the card with the player's name, what Pro gives, the plans, one bright button.
  // why: what brought the player here (check, hints, puzzles, road, joker, xp, look, streak, rank; none: opened by
  // themselves); back: reopens the dialog they came from when they say "not now"; plan0: the plan picked before
  var proRepaint = null;
  function packCount() { return typeof JOKER_PACK !== 'undefined' ? JOKER_PACK.length : 0; }
  function proSheet(why, vars, back, plan0) {
    if (!proSells()) return;
    if (isPro()) { proStatus(); return; }
    var plan = plan0 && PRO.PLANS[plan0] ? plan0 : 'year';
    Track.event('pro_view', { why: why || 'open' });
    openDialog(function (card) {
      currentDialog.dataset.kind = 'pro';
      currentDialog.onClose = function () { proRepaint = null; };
      card.classList.add('pro-card');
      // what Pro is scrolls on a short phone; the button that starts it never leaves the screen
      var body = h('div', { class: 'pro-body', id: 'pro-body' }), foot = h('div', { class: 'pro-foot' });
      body.appendChild(proCardArt(me && me.profile ? me.profile.username : T('you'), false));
      var v = Object.assign({ n: why === 'puzzles' ? packCount() : PRO.FREE_HINTS }, vars || {});
      var line = why && PRO.TEXT.en['why_' + why] ? PX('why_' + why, v) : (proTally.would >= 60 ? PX('mineXp', { n: fmtCount(proTally.would) }) : PX('pitch'));
      body.appendChild(h('div', { class: 'dlg-sub', id: 'pro-why' }, esc(line)));
      var perks = h('div', { class: 'pro-perks', id: 'pro-perks' });
      PRO.PERKS.forEach(function (k) {
        if (k === 'puzzles' && !packCount()) return;
        perks.appendChild(h('div', { class: 'pro-perk' }, '<span class="pp-ic">' + PERK_ICON[k] + '</span><span class="pp-t"><b>' + esc(PX('p_' + k)) + '</b><span>' + esc(PX('pd_' + k, { n: packCount() })) + '</span></span>'));
      });
      body.appendChild(perks);
      var plans = h('div', { class: 'pro-plans', role: 'radiogroup', id: 'pro-plans', 'aria-label': PX('name') }), cta, fine, fb, busy = false;
      // in the apps the store sells: its products, its prices in the player's currency, its own payment sheet
      var S = !PROTO_PRO && NATIVE.on ? iapStore() : null;
      function cat() { return S ? iapPlans() : null; }
      function has(id) { var c = cat(); return S ? !!(c && c[id]) : true; }
      function priceOf(id) { var c = cat(); return S ? (c && c[id] ? c[id].price : '') : PRO.price(PRO.PLANS[id].usd); }
      function trialDays() { var c = cat(); return S ? (c && c.year ? c.year.trialDays : 0) : (proInfo && proInfo.pro && proInfo.pro.trialUsed ? 0 : PRO.PLANS.year.trialDays); }
      function seatsLeft() { var n = proInfo && proInfo.foundersLeft != null ? proInfo.foundersLeft : proPub && proPub.left != null ? proPub.left : null; return n == null ? null : n; }
      function put(sel, text) { var el = card.querySelector(sel); if (el) el.textContent = text; return el; }
      function paint() {
        var c = cat(), left = seatsLeft(), ready = !S || !!c;
        // a plan the store does not sell is not offered; nor is Founder once its places are gone
        ['year', 'month'].forEach(function (id) { var b = card.querySelector('#plan-' + id); if (b && S && c) b.hidden = !c[id]; });
        if (fb) fb.hidden = left === 0 || (!!S && !!c && !c.founder);
        if (ready && (!has(plan) || (plan === 'founder' && fb.hidden))) plan = has('year') ? 'year' : has('month') ? 'month' : 'founder';
        card.querySelectorAll('[data-plan]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.plan === plan)); });
        var share = S ? (c && c.year ? PRO.storeShare(c.year.price, c.year.amount, 12) : null) : PRO.price(PRO.perMonth('year'));
        var saving = S ? PRO.storeSaving(c) : PRO.yearSaving();
        put('#plan-year .pl-price', priceOf('year') || '\u2026'); put('#plan-month .pl-price', priceOf('month') || '\u2026'); put('#plan-founder .pf-price', priceOf('founder') || '\u2026');
        put('#plan-year .pl-sub', share ? PX('onlyMonth', { p: share }) : PX('perYearS'));
        var tag = put('#plan-year .pl-tag', saving ? PX('save', { n: saving }) : ''); if (tag) tag.hidden = !saving;
        var days = trialDays(), key = plan === 'year' && !days ? 'year_paid' : plan, vars = { n: days, p: priceOf(plan) };
        if (!ready) {
          // the store has not answered yet (or did not): nothing to buy until it has
          cta.disabled = busy || !iapErr; cta.textContent = PX(iapErr ? 'storeRetry' : 'storeLoad'); fine.textContent = iapErr ? PX('storeErr') : '\u00a0';
        } else {
          cta.disabled = busy;
          cta.textContent = busy ? PX(S ? 'goStore' : 'goPay') : PX('cta_' + key, vars);
          fine.textContent = PX((S && plan !== 'founder' ? 'thenS_' : 'then_') + key, vars);
        }
        var fs = card.querySelector('.pf-sub');
        if (fs) fs.textContent = left != null && left < PRO.PLANS.founder.seats ? PX('seatsLeft', { n: fmtCount(left) }) : PX('seats', { n: fmtCount(PRO.PLANS.founder.seats) });
      }
      [['year', PX('plan_year'), true], ['month', PX('plan_month'), false]].forEach(function (x) {
        var b = h('button', { type: 'button', role: 'radio', class: 'pro-plan', 'data-plan': x[0], id: 'plan-' + x[0], 'aria-checked': 'false' },
          (x[2] ? '<em class="pl-tag"></em>' : '') + '<span class="pl-name">' + esc(x[1]) + '</span><b class="pl-price"></b><span class="pl-sub">' + (x[2] ? '' : esc(PX('perMonth', { p: '' }).replace(/^\s+|\s+$/g, ''))) + '</span>');
        b.addEventListener('click', function () { if (busy) return; plan = x[0]; paint(); });
        plans.appendChild(b);
      });
      body.appendChild(plans);
      fb = h('button', { type: 'button', role: 'radio', class: 'pro-founder', 'data-plan': 'founder', id: 'plan-founder', 'aria-checked': 'false' },
        '<i class="pf-dot"></i><span><b>' + esc(PX('plan_founder')) + '</b> · <span class="pf-price"></span></span><span class="pf-sub"></span>');
      fb.addEventListener('click', function () { if (busy) return; plan = plan === 'founder' ? (has('year') ? 'year' : 'month') : 'founder'; paint(); });
      body.appendChild(fb);
      if (PROTO_PRO) body.appendChild(h('div', { class: 'pro-proto', id: 'pro-proto' }, esc(PX('protoNote'))));
      else if (!S && me && me.pro === 'test') body.appendChild(h('div', { class: 'pro-proto test', id: 'pro-test' }, esc(PX('testNote'))));
      cta = bigBtn('start-btn', '', 'btn-pro-buy', function () {
        if (busy) return;
        if (S && !cat()) { iapErr = false; paint(); iapLoad().catch(function () { /* the sheet says so */ }); return; }
        proBuy(plan, why, back, function (on) { busy = on; if (card.isConnected) paint(); });
      });
      foot.appendChild(cta);
      fine = h('div', { class: 'pro-fine', id: 'pro-fine' }); foot.appendChild(fine);
      var doc = function (url, key) { return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(PX(key)) + '</a>'; };
      if (S) {
        // what the stores ask a subscription's sheet to carry: who takes the money, the terms, the privacy policy, and a way to bring back what was bought before
        var by = h('div', { class: 'pro-fine pay-by', id: 'pro-payby' }, esc(PX('payBy_' + S)) + ' ' + doc(termsUrl(), 'terms') + ' · ' + doc(privacyUrl(), 'privacy') + ' · ');
        var rs = h('button', { type: 'button', class: 'pay-link', id: 'btn-pro-restore' }, esc(PX('restore')));
        rs.addEventListener('click', function () { if (busy) return; busy = true; paint(); iapRestore(function () { busy = false; if (card.isConnected) paint(); }); });
        by.appendChild(rs); foot.appendChild(by);
      } else if (!PROTO_PRO) foot.appendChild(h('div', { class: 'pro-fine pay-by', id: 'pro-payby' }, esc(PX('payBy')) + ' ' + doc(termsUrl(), 'terms')));
      var later = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-pro-later' }, esc(PX('notNow')));
      later.addEventListener('click', function () { Track.event('pro_later', { why: why || 'open' }); if (back) back(); else closeDialog(); });
      foot.appendChild(later);
      card.appendChild(body); card.appendChild(foot);
      paint();
      proRepaint = function () { if (card.isConnected) paint(); };
    });
    // whether the trial is still to be had, how many Founder places are left: the answer repaints the sheet
    if (!PROTO_PRO && me && (signedIn() || NATIVE.on)) proAsk().then(function () { if (isPro()) { if (currentDialog && currentDialog.dataset.kind === 'pro') { closeDialog(); setTimeout(proStatus, 230); } } else if (proRepaint) proRepaint(); });
    // in the apps: the store's prices of this moment (the ones kept from the last visit are on the sheet meanwhile)
    if (!PROTO_PRO && NATIVE.on && iapHere() && (!iapPlans() || Date.now() - (iapCat.at || 0) > 600e3)) iapLoad().catch(function () { /* the sheet says so */ });
  }
  function termsUrl() { return (window.GC_SITE || '') + 'terms.html'; }
  // ---- buying. The prototype flips its switch. For real: a saved account first (Pro lives on it), then Stripe's own
  // payment page; the way back is proReturn()
  function proBuy(plan, why, back, setBusy) {
    if (PROTO_PRO) {
      proState = PRO.start(plan, Date.now()); save('pro', proState);
      Track.event('pro_start', { plan: plan, why: why || 'open' });
      proFreezeCheck();
      closeDialog(); proRefresh();
      Sound.play('win'); haptic('win');
      setTimeout(proWelcome, 230);
      return;
    }
    if (!NETCFG) return;
    if (NATIVE.on) { iapBuy(plan, why, setBusy); return; } // the apps: the store's own payment sheet, guests included
    if (!signedIn()) {
      // (a sign-in that reloads the page comes back here through the pending action)
      Track.event('pro_save_first', { plan: plan });
      setPending({ kind: 'pro', plan: plan, why: why || '' });
      closeDialog();
      setTimeout(function () {
        showAccount(function () { save('pending', null); setTimeout(function () { proSheet(why, null, null, plan); }, 230); },
          { title: PX('saveFirstT'), sub: PX('saveFirstSub'), onCancel: function () { save('pending', null); } });
      }, 230);
      return;
    }
    if (setBusy) setBusy(true);
    Track.event('pro_checkout', { plan: plan, why: why || 'open' });
    ensureNet().then(function () { return net.pay('checkout', { plan: plan, back: location.origin + location.pathname, lang: lang }); }).then(function (r) {
      if (!r || !r.url) throw new Error('no_url');
      save('proGo', { plan: plan, why: why || '', at: Date.now() });
      location.href = r.url;
    }).catch(function (e) {
      if (setBusy) setBusy(false);
      var code = e && e.data && e.data.error;
      if (code === 'guest') { if (me) me.guest = true; proBuy(plan, why, back, setBusy); return; }
      // (a subscription bought in an app runs: it is managed in that store, a second one is not sold beside it)
      if (code === 'store_sub') { toast(PX('in_' + (e.data.store === 'google' ? 'google' : 'apple'))); proAsk().then(function () { if (isPro() && currentDialog && currentDialog.dataset.kind === 'pro') { closeDialog(); setTimeout(proStatus, 230); } }); return; }
      toast(PX(code === 'off' ? 'payOff' : code === 'sold_out' ? 'soldOut' : code === 'already' ? 'alreadyF' : 'payErr'));
      if (code === 'sold_out' || code === 'already') proAsk().then(function () { if (proRepaint) proRepaint(); });
    });
  }
  // back from Stripe's page: ?pro=ok&sid=… (paid, or a trial started) or ?pro=back (left it)
  function proReturn() {
    if (!PRO || PROTO_PRO || !NETCFG) return;
    var q = urlQ.get('pro'), sid = urlQ.get('sid') || '';
    if (!q) return;
    try { var u = new URL(location.href); u.searchParams.delete('pro'); u.searchParams.delete('sid'); history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash); } catch (e) { /* the address stays */ }
    var went = load('proGo', null); save('proGo', null);
    if (q !== 'ok' || !/^cs_[A-Za-z0-9_]+$/.test(sid)) { Track.event('pro_back', { plan: (went && went.plan) || '' }); return; }
    toast(PX('payCheck'));
    var tries = 0;
    var done = function () {
      Track.event('pro_start', { plan: (proInfo && proInfo.pro && proInfo.pro.plan) || (went && went.plan) || '', why: (went && went.why) || 'open' });
      proFreezeCheck(); proRefresh();
      Sound.play('win'); haptic('win');
      askWhenCalm(proWelcome, 300);
    };
    var look = function (call) {
      call().then(function (r) {
        proApply(r);
        if (isPro()) { done(); return; }
        if (++tries < 6) setTimeout(function () { look(function () { return net.pay('state', {}); }); }, 2500);
        else toast(PX('payWait'));
      }, function () { if (++tries < 6) setTimeout(function () { look(call); }, 2500); else toast(PX('payWait')); });
    };
    ensureNet().then(function () { look(function () { return net.pay('confirm', { sid: sid }); }); }, function () { toast(PX('payWait')); });
  }
  function proOff() { // (the prototype's switch)
    proState = null; save('pro', null);
    proLooksBack();
    proRefresh();
  }
  function proWelcome() {
    var nm = me && me.profile ? me.profile.username : T('you');
    openDialog(function (card) {
      currentDialog.dataset.kind = 'pro-welcome';
      currentDialog.classList.add('center');
      card.classList.add('lvlup-card', 'pro-welcome');
      card.appendChild(h('div', { class: 'lvlup-badge' + (motionOK() ? ' pop' : '') }, proSeal('big')));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(PX('welcomeT'))));
      card.appendChild(h('div', { class: 'pro-who big' }, '<span class="pro-nm">' + esc(nm) + '</span>' + proMark()));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(PX('welcomeSub'))));
      card.appendChild(bigBtn('start-btn', PX('welcomeBtn'), 'btn-pro-ok', function () { closeDialog(); }));
      if (!PROTO_PRO && NETCFG && me && !signedIn()) {
        // bought as a guest (the apps allow it): Pro sits on this guest account until it is saved
        card.appendChild(h('div', { class: 'pro-fine', id: 'pro-save-note' }, esc(PX('welcomeSave'))));
        var sv = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-pro-save' }, esc(PX('welcomeSaveBtn')));
        sv.addEventListener('click', function () { closeDialog(); setTimeout(function () { showAccount(); }, 230); });
        card.appendChild(sv);
      }
    });
  }
  // the plan in a line: the prototype's own switch, or what the server knows (proInfo, when it has answered)
  function proPlanLine() {
    if (PROTO_PRO) { var st = proState || {}; return PX(st.trial ? 'on_trial' : 'on_' + (st.plan || 'year')) + (st.until ? ', ' + PX('until', { d: fmtDay(st.until) }) : ''); }
    var s = proMine() || {}, i = proInfo && proInfo.pro, via = proVia(), shop = via === 'apple' || via === 'google';
    if (s.founder) return PX('st_founder');
    var d = s.until ? fmtDay(s.until) : '';
    if (i && (i.status === 'past_due' || (shop && i.status === 'grace'))) return PX(shop ? 'st_dueS' : 'st_due');
    if (i && i.trial && !i.cancel) {
      // (a store's price is the store's to say: named only where this app has heard it)
      var yp = shop ? (via === iapStore() && iapPlans() && iapPlans().year ? iapPlans().year.price : '') : PRO.price(PRO.PLANS.year.usd);
      return yp ? PX('st_trial', { d: d, p: yp }) : PX('st_trialS', { d: d });
    }
    if (i && i.cancel) return PX('st_ends', { d: d });
    if (i && i.sub) return PX('on_' + (i.plan || s.plan || 'year')) + '. ' + PX('st_renew', { d: d });
    return PX('on_' + (s.plan || 'year')) + (d ? ', ' + PX('until', { d: d }) : '');
  }
  // the Profile's line about Pro: what it is and a way in; for a Pro player, their plan and their status
  function proEntry() {
    if (!proAvail()) return null;
    var on = isPro();
    var c = h('button', { type: 'button', class: 'pro-entry' + (on ? ' on' : ''), id: 'pro-entry' },
      proSeal('sm') + '<span class="pe-t"><b>' + esc(PX('name')) + '</b><span>' + esc(on ? proPlanLine() : PX('cardSub')) + '</span></span>' +
      '<span class="pe-go">' + esc(on ? PX('manage') : PX('cardBtn')) + '</span>');
    c.addEventListener('click', function () { if (isPro()) proStatus(); else proSheet(); });
    return c;
  }
  // "Joker status": a Pro player's own page — the card, the plan, what Pro has given so far, the subscription
  function proStatus() {
    if (!isPro()) { proSheet(); return; }
    var month = todayStr().slice(0, 7), nm = me && me.profile ? me.profile.username : T('you');
    openDialog(function (card) {
      currentDialog.dataset.kind = 'pro-manage';
      card.classList.add('pro-manage');
      card.appendChild(proCardArt(nm, proFounder()));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(PX('manageT'))));
      var line = h('div', { class: 'dlg-sub', id: 'pro-plan-line' }, esc(proPlanLine()));
      card.appendChild(line);
      var pack = packCount(), solved = 0, done = load('puzzles', {});
      if (pack) JOKER_PACK.forEach(function (p) { if (done[p.id]) solved++; });
      var tiles = h('div', { class: 'st-tiles pro-tiles', id: 'pro-tiles' });
      var tile = function (n, label) { return '<span class="st-tile"><b>' + esc(String(n)) + '</b><span>' + esc(label) + '</span></span>'; };
      tiles.innerHTML = tile('+' + fmtCount(proTally.bonus || 0), PX('tile_bonus')) + tile(fmtCount(proTally.checks || 0), PX('tile_checks')) +
        (pack ? tile(solved + '/' + pack, PX('tile_pack')) : '') + tile(PRO.freezesLeft(proFz, month), PX('tile_freeze'));
      card.appendChild(tiles);
      card.appendChild(bigBtn('start-btn', PX('insOpen'), 'btn-pro-ins', function () { closeDialog(); setTimeout(proInsights, 230); }));
      if (PROTO_PRO) {
        var off = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-pro-off' }, esc(PX('turnOff')));
        off.addEventListener('click', function () { closeDialog(); proOff(); });
        card.appendChild(off);
      } else if (NETCFG) {
        var slot = h('div', { class: 'pro-manage-slot', id: 'pro-manage-slot' }); card.appendChild(slot);
        proManage(slot);
        if (me) proAsk().then(function () { if (line.isConnected) { line.textContent = proPlanLine(); proManage(slot); } });
      }
    });
  }
  // Stripe's own page for the account: the card, the receipts, cancelling
  function proPortal(btn) {
    if (btn) btn.disabled = true;
    ensureNet().then(function () { return net.pay('portal', { back: location.origin + location.pathname, lang: lang }); }).then(function (r) { if (!r || !r.url) throw new Error('no_url'); location.href = r.url; })
      .catch(function () { if (btn) btn.disabled = false; toast(PX('portalErr')); });
  }
  // managing Pro where it was bought. On the website: Stripe's page (a Founder has only receipts there). In the app
  // of the store that sold it: the store's own subscription page. Anywhere else: a line that says where it lives.
  function proManage(host, quiet) {
    host.innerHTML = '';
    var via = proVia(), founder = proFounder(), cls = 'linkbtn' + (quiet ? '' : ' center'), pre = quiet ? 'sub' : 'pro'; // (the Profile's row and the status page may both be on the page)
    var say = function (key) { host.appendChild(h('div', { class: 'pro-fine' + (quiet ? ' left' : ''), id: pre + '-where' }, esc(PX(key)))); };
    if (via === 'apple' || via === 'google') {
      if (founder) return; // (bought once: nothing to manage)
      if (NATIVE.on && iapHere() && iapStore() === via) {
        var mb = h('button', { type: 'button', class: cls, id: 'btn-' + pre + '-store' }, esc(PX('manage_' + via)));
        mb.addEventListener('click', function () { iapManage(); });
        host.appendChild(mb);
      } else say('in_' + via);
    } else if (NATIVE.on) {
      if (via === 'stripe' && !founder) say('in_stripe');
    } else if (signedIn()) {
      var pb = h('button', { type: 'button', class: cls, id: 'btn-' + pre + '-portal' }, esc(PX(founder ? 'receipts' : quiet ? 'subCancel' : 'portal')));
      pb.addEventListener('click', function () { proPortal(pb); });
      host.appendChild(pb);
    }
  }
  // the Profile's settings end with the subscription: the plan, and the way to cancel it or change the card. For a
  // player without Pro in the apps: the way to bring back what was bought before.
  function proSubRow() {
    if (!PRO || PROTO_PRO || !NETCFG) return null;
    var on = isPro();
    if (!on && !(NATIVE.on && iapOn())) return null;
    var f = h('div', { class: 'field sub-field', id: 'sub-row' });
    f.appendChild(h('div', { class: 'lbl' }, esc(PX('subRow'))));
    if (on) {
      var line = h('div', { class: 'sub-line', id: 'sub-line' }, esc(proPlanLine())), slot = h('div', { class: 'sub-act', id: 'sub-act' });
      f.appendChild(line); f.appendChild(slot);
      proManage(slot, true);
      if (me && !proInfo) proAsk().then(function () { if (f.isConnected && isPro()) { line.textContent = proPlanLine(); proManage(slot, true); } });
    } else {
      f.appendChild(h('div', { class: 'sub-line', id: 'sub-line' }, esc(PX('subNone'))));
      var rb = h('button', { type: 'button', class: 'linkbtn', id: 'btn-sub-restore' }, esc(PX('restore')));
      rb.addEventListener('click', function () { rb.disabled = true; iapRestore(function () { rb.disabled = false; }); });
      f.appendChild(rb);
    }
    return f;
  }
  // "My Jokers": what the device knows about the player's Joker Moves (the cards count every one played) and the bots
  function proInsights() {
    if (!proAvail()) return;
    if (!isPro()) { proSheet(); return; }
    var PCS = ['knight', 'bishop', 'rook', 'queen'], total = 0, fav = null, max = 0;
    PCS.forEach(function (k) { var n = prog.cards[k] || 0; total += n; if (n > max) { max = n; fav = k; } });
    var kinds = Progress.CARDS.filter(function (c) { return PCS.indexOf(c[0]) < 0 && prog.cards[c[0]]; });
    var w = 0, d = 0, l = 0, best = null;
    Progress.BOTS.forEach(function (b) { var st = stats[botStatKey(b)]; if (!st) return; w += st.w || 0; d += st.d || 0; l += st.l || 0; if (st.w && (!best || b.elo > best.elo)) best = b; });
    openDialog(function (card) {
      currentDialog.dataset.kind = 'pro-insights';
      card.classList.add('pro-ins');
      card.appendChild(h('div', { class: 'dlg-title' }, esc(PX('insT')) + ' ' + proMark()));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(PX('insSub'))));
      if (!total && !(w + d + l)) { card.appendChild(h('div', { class: 'dlg-note', id: 'ins-none' }, esc(PX('insNone')))); return; }
      var tiles = h('div', { class: 'st-tiles ins-tiles' });
      var tile = function (n, label) { return '<span class="st-tile"><b>' + esc(String(n)) + '</b><span>' + esc(label) + '</span></span>'; };
      tiles.innerHTML = tile(total, PX('insPlayed')) + tile(fav ? PT('rank_' + fav) : '–', PX('insFav')) + tile(kinds.length + '/' + (Progress.CARDS.length - PCS.length), PX('insKinds'));
      card.appendChild(tiles);
      var bars = h('div', { class: 'ins-bars', id: 'ins-bars' });
      PCS.forEach(function (k) {
        var n = prog.cards[k] || 0;
        bars.appendChild(h('div', { class: 'ins-bar' }, '<i class="pc-ic p-w' + RANK_PC[k] + '"></i><span class="ib-track"><b style="width:' + (max ? Math.round(n / max * 100) : 0) + '%"></b></span><span class="ib-n">' + n + '</span>'));
      });
      card.appendChild(bars);
      if (kinds.length) card.appendChild(h('div', { class: 'op-cards ins-kinds' }, kinds.map(function (c) { return '<span class="jc-chip r' + c[1] + '">' + esc(PT('c_' + c[0])) + (prog.cards[c[0]] > 1 ? ' ×' + prog.cards[c[0]] : '') + '</span>'; }).join('')));
      if (w + d + l) {
        card.appendChild(h('div', { class: 'prog-h' }, esc(PX('insBots'))));
        card.appendChild(h('div', { class: 'ins-line', id: 'ins-bots' }, '<b>' + esc(PX('insRate', { n: Math.round(w / (w + d + l) * 100) })) + '</b><span>' + esc(PX('insWdl', { w: w, d: d, l: l })) + '</span>'));
        if (best) card.appendChild(h('div', { class: 'ins-line' }, '<b>' + esc(PX('insBest')) + '</b><span>' + esc(GCBots.castName(best.who, lang, true)) + ', ' + best.elo + '</span>'));
      }
    });
  }
  // ---- the streak freeze: a Pro player's streak that has just run out (three or more days away) is carried across
  // the break, twice a month
  // the streak as it stood before today (a freeze bridges a break whether or not the player has played today yet)
  function streakBefore() { var t = todayStr(); return Habits.streak(habitDays.filter(function (d) { return d < t; }), t, proFz && proFz.days ? proFz.days : null); }
  function proFreezeCheck() {
    if (!isPro()) return false;
    var t = todayStr(), st = streakBefore();
    if (st.state !== 'none' || !st.lost || !st.last) return false;
    var missed = [];
    for (var d = Habits.addDays(st.last, 1); d < t && missed.length <= PRO.FREEZE_SPAN; d = Habits.addDays(d, 1)) missed.push(d);
    var nx = PRO.useFreeze(proFz, t.slice(0, 7), missed);
    if (!nx) return false;
    proFz = nx; save('proFz', proFz);
    Track.event('pro_freeze', { days: missed.length });
    return true;
  }

  // ---- the Joker analysis of a game: where the Joker Move was, how good the one played was, the lines that turn on a
  // Joker Move nobody played. Pro has it in every review. A free player has one (Pro.FREE_CHECKS), kept for the game
  // it was used on; until it is opened the review is blind (GCReview.analyze's opt.blind) and one card in the report
  // offers it, whatever the game held. Where nothing is sold (the apps, the server's switch off) nothing is limited.
  function jkLimited() { return proSells() && !isPro(); }
  function jkKey() { return (review && review.key) || (game ? gameKey() || game.fens[game.fens.length - 1] : '') || ''; }
  function jkOpen() { return !jkLimited() || PRO.checkOpen(proJk, jkKey()); }
  // the player asks for it: the free one is taken, or the Pro sheet comes (back: where "not now" returns to)
  function jkTap(back) {
    if (!game || !review) return false;
    if (jkOpen()) return true;
    var st = PRO.useCheck(proJk, jkKey());
    if (!st) { Track.event('pro_gate', { why: 'check' }); proSheet('check', null, back); return false; }
    proJk = st; save('proJk', proJk);
    Track.event('joker_check', { left: PRO.checksLeft(proJk) });
    computeReview(); renderAll(); renderReport();
    return true;
  }

  // ---- hints in a game against a bot (never online): the engine's best move as an arrow, and its name. A free player
  // has three a day (what was shown today stays shown), Pro has no limit
  function hintsLeftNow() { return PRO.hintsLeft(proHints, todayStr(), isPro()); }
  function takeHint(key, ply, back) {
    var st = PRO.useHint(proHints, todayStr(), isPro(), key, ply);
    if (!st) { Track.event('pro_gate', { why: 'hints' }); proSheet('hints', { n: PRO.FREE_HINTS }, back); return false; }
    proHints = st; save('proHints', proHints);
    proCount('hints', 1);
    return true;
  }
  var hintClient = null, hint = null, hintBusy = false;
  function hintLabel() { var left = hintsLeftNow(); return PX('hint') + (isPro() ? '' : ' · ' + left + '/' + PRO.FREE_HINTS); }
  function hintReady() { return proAvail() && !!game && botGame() && game.status === 'playing' && live() && game.pos.side === game.cfg.human && !hintBusy; }
  function showHint() {
    refreshArrows();
    toast(PX(hint.gold ? 'hintJoker' : 'hintMove', { san: hint.san.replace(/\*/g, '★') }), hint.gold ? 'gold' : '');
  }
  function gameHint() {
    if (!hintReady()) return;
    var g = game, ply = g.records.length;
    if (hint && hint.game === g && hint.ply === ply) { showHint(); return; }
    g.tipId = g.tipId || 'g' + Date.now();
    if (!takeHint('hint:' + g.tipId, ply)) return;
    hintBusy = true; toast(PX('hintThinking'));
    if (!hintClient) hintClient = new EngineClient();
    hintClient.think({ id: ++reqSeq, fen: g.startFen, moves: g.records.map(function (r) { return r.uci; }), timeMs: window.__gcFastBot ? 150 : 900, level: 8, analysis: true }, function (res) {
      hintBusy = false;
      if (game !== g || g.records.length !== ply || !res || !res.uci) return;
      var m = g.pos.moveFromUci(res.uci);
      if (!m) return;
      hint = { game: g, ply: ply, from: m & 127, to: (m >> 7) & 127, gold: !!(m & F_GOLDEN), san: g.pos.san(m) };
      Track.event('pro_tip', { where: 'game' });
      showHint();
      if (game) renderSide();
    }, function () { /* the final answer is enough */ });
  }
  // the Joker in the list of all bots: a free player reaches him on the Road first (its last season open)
  function jokerLocked() { return proSells() && !isPro() && !Progress.isOpen(prog.career, Progress.CHAPTERS); }

  // ---- bringing Pro up by ourselves, where it is sold and not yet bought. Never over a game or a puzzle; how often is
  // Pro.offerDue's business (nothing on the first day, one in three days at most, a rest after three closed in a row).
  // Two places: a sheet after a finished game, once the player has left the board (the last in the line of asks:
  // afterGameAsk), and a quiet line on the Play tab. What has just happened picks the words (a streak that ran out
  // and that a freeze would bring back, a new rank).
  var proRankDay = load('proRank', '');
  function proOfferStart() { if (proSells() && !PROTO_PRO && !(proOf && proOf.first)) { proOf = PRO.offerFirst(proOf, todayStr()); save('proOffer', proOf); } }
  function proMoments() {
    var out = [], st = streakBefore(), t = todayStr();
    if (st.lost >= 3 && st.last && Habits.diffDays(st.last, t) - 1 <= PRO.FREEZE_SPAN) out.push('streak');
    if (proRankDay === t) out.push('rank');
    return out;
  }
  function proOfferDue(plain) {
    if (PROTO_PRO || !proSells() || isPro() || !proOf) return null;
    return PRO.offerDue(proOf, { day: todayStr(), games: load('gamesDone', 0), moments: proMoments(), plain: !!plain });
  }
  function proOfferVars(id) { return id === 'streak' ? { n: streakBefore().lost } : id === 'rank' ? { rank: Progress.rankName(lang, progLevel().level) } : {}; }
  function proOfferEnd(how) { proOf = PRO.offerEnded(proOf, how, todayStr()); save('proOffer', proOf); }
  function proOfferSheet(id) {
    var vars = proOfferVars(id), looked = false;
    proOf = PRO.offerShown(proOf, id, todayStr()); save('proOffer', proOf);
    askedNow(); Track.event('pro_offer', { id: id, place: 'sheet' });
    openDialog(function (card) {
      currentDialog.dataset.kind = 'pro-offer';
      currentDialog.onClose = function () { if (!looked) { proOfferEnd('skip'); Track.event('pro_offer_skip', { id: id, place: 'sheet' }); } };
      card.classList.add('remind-card', 'pro-offer');
      card.appendChild(h('div', { class: 'pro-offer-art', 'aria-hidden': 'true' }, proSeal('big')));
      card.appendChild(h('div', { class: 'dlg-title', id: 'pro-offer-t' }, esc(PX('offer_' + id + '_t', vars))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(PX('offer_' + id + '_s', vars))));
      card.appendChild(bigBtn('start-btn', PX(id === 'streak' ? 'offerStreakCta' : 'offerCta'), 'btn-offer-go', function () {
        looked = true; proOfferEnd('look'); Track.event('pro_offer_go', { id: id, place: 'sheet' });
        closeDialog(); setTimeout(function () { proSheet(id === 'plain' ? null : id, vars); }, 230);
      }));
      var later = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-offer-later' }, esc(PX('notNow')));
      later.addEventListener('click', function () { closeDialog(); });
      card.appendChild(later);
    });
  }
  // the Play tab's line: picked once a day (it stays for that day unless hidden), by the same limits as the sheet
  function proBanner() {
    if ((window.__gcNoAsk && !PROTO_PRO) || !proSells() || isPro() || !proOf) return null;
    var t = todayStr(), b = proOf.banner && proOf.banner.day === t ? proOf.banner : null;
    if (!b) {
      var id = proOfferDue(true);
      if (!id) return null;
      proOf = PRO.offerShown(proOf, id, t); proOf.banner = b = { id: id, day: t }; save('proOffer', proOf);
      Track.event('pro_offer', { id: id, place: 'play' });
    }
    if (b.off) return null;
    var vars = proOfferVars(b.id);
    var el = h('div', { class: 'pro-banner', id: 'pro-banner' });
    var go = h('button', { type: 'button', class: 'pb-go', id: 'pro-banner-go' }, proSeal('sm') + '<span class="pb-t"><b>' + esc(PX('offer_' + b.id + '_t', vars)) + '</b><span>' + esc(PX('line_' + b.id, vars)) + '</span></span>');
    go.addEventListener('click', function () { proOf.banner.off = true; proOfferEnd('look'); Track.event('pro_offer_go', { id: b.id, place: 'play' }); proSheet(b.id === 'plain' ? null : b.id, vars); });
    var x = h('button', { type: 'button', class: 'pb-x', id: 'pro-banner-x', 'aria-label': PX('bannerClose') }, ICON.x);
    x.addEventListener('click', function () { proOf.banner.off = true; proOfferEnd('skip'); Track.event('pro_offer_skip', { id: b.id, place: 'play' }); el.remove(); });
    el.appendChild(go); el.appendChild(x);
    return el;
  }
  // the prototype tour: a short game in which White missed a Joker Move (a rook check that only a Joker Move blocks
  // well), its review open
  function protoMissed() {
    startGame({ mode: 'local', color: 'w', tc: 'none' }, { fen: 'r7/p1p4p/5k2/2N5/5P2/6P1/PPP2R1P/R1K1r3 w - - 1 28 Gg' });
    var g = game, now = performance.now();
    ['c1d2', 'e1a1'].forEach(function (u) { var m = g.pos.moveFromUci(u); if (m) g.play(m, now); });
    g.end('0-1', 'resign', now); gameOver();
    closeDialog();
    setTimeout(showReport, 250);
  }

  // ---- emails (prototype; the server says it keeps the yes / no in hello: me.mail)
  function mailOn() { return !!((me && me.mail) || (window.GC_PROTO && !NETCFG)); }
  // the sign-in box: also before the server has said (a guest who has only played on this device has no session yet);
  // the answer waits on the device until the account is saved, and goes nowhere if the server doesn't send emails
  function mailBox() { return mailOn() || (!!NETCFG && !me); }
  // the server keeps the player's language and time zone (sent again only when they change) and the yes given while
  // saving the account (sent once the account is saved)
  function syncPrefs() {
    if (!me || !me.mail || !net) return;
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* an old browser */ }
    var key = lang + '|' + tz, pend = load('emailOptPending', null), body = {};
    if (load('prefsSent', '') !== key) { body.lang = lang; if (tz) body.tz = tz; }
    if (pend != null && !me.guest) {
      // the box is ticked from the start: it turns emails on for an account that never answered, never over a no given before
      if (pend === true && me.profile && me.profile.email_opt === false) save('emailOptPending', null);
      else body.email_opt = !!pend;
    }
    if (!Object.keys(body).length) return;
    net.call('prefs', body).then(function (r) {
      save('prefsSent', key);
      if (body.email_opt != null) save('emailOptPending', null);
      if (r && r.prefs && me && me.profile) me.profile.email_opt = r.prefs.email_opt;
    }, function () { /* next time */ });
  }
  function setEmailOpt(on, where) {
    if (window.GC_PROTO && !NETCFG) { if (me && me.profile) me.profile.email_opt = on; return Promise.resolve(); }
    return ensureNet().then(function () { return net.call('prefs', { email_opt: on }); }).then(function (r) {
      if (me && me.profile) me.profile.email_opt = r.prefs.email_opt;
      Track.event('email_opt', { on: on, where: where });
    });
  }
  function emailSwitch(card) {
    var on = !!(me && me.profile && me.profile.email_opt);
    var row = h('div', { class: 'toggle-row' }), lab = h('span', { id: 'set-email-l' }); lab.textContent = T('emailsSw');
    var b = h('button', { class: 'sw', type: 'button', role: 'switch', id: 'set-email', 'aria-labelledby': 'set-email-l', 'aria-checked': String(on) });
    b.addEventListener('click', function () {
      var next = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(next));
      setEmailOpt(next, 'settings').catch(function () { b.setAttribute('aria-checked', String(!next)); toast(T('netError')); });
    });
    row.appendChild(lab); row.appendChild(b); card.appendChild(row);
    card.appendChild(h('div', { class: 'set-note', id: 'set-email-note' }, esc(T('emailsNote'))));
  }
  // a saved account that never answered (signed in with Google or Apple: no checkbox there): a card on the Profile
  // tab, never a sheet over the game; gone after an answer, "not now" hides it for two weeks, twice at most
  function emailCardDue() {
    if (!mailOn() || !me || me.guest || !me.profile || me.profile.email_opt != null) return false;
    var a = load('emailAsk', { n: 0, at: 0 });
    return a.n < 2 && Date.now() - a.at > 14 * 864e5;
  }
  function emailCard(force) {
    if (!force && !emailCardDue()) return null;
    var card = h('div', { class: 'card email-card', id: 'email-card' });
    card.appendChild(h('div', { class: 'email-card-top' }, '<span class="remind-art mail-art" aria-hidden="true"><span class="env">' + jokerPiece() + '</span></span><div><b>' + esc(T('emailAskT')) + '</b><span>' + esc(T('emailAskB')) + '</span></div>'));
    var row = h('div', { class: 'row-btns' });
    var later = h('button', { type: 'button', class: 'secondary', id: 'btn-email-later' }, esc(T('notNowBtn')));
    var yes = h('button', { type: 'button', class: 'primary', id: 'btn-email-yes' }, esc(T('emailAskYes')));
    later.addEventListener('click', function () { var a = load('emailAsk', { n: 0, at: 0 }); save('emailAsk', { n: a.n + 1, at: Date.now() }); Track.event('email_later', { where: 'profile' }); card.remove(); });
    yes.addEventListener('click', function () {
      yes.disabled = later.disabled = true;
      setEmailOpt(true, 'profile').then(function () { card.remove(); toast(T('fairDone')); }, function () { yes.disabled = later.disabled = false; toast(T('netError')); });
    });
    row.appendChild(later); row.appendChild(yes); card.appendChild(row);
    return card;
  }
  // the prototype tour shows the card in a sheet
  function emailCardSheet() {
    openDialog(function (card) {
      currentDialog.dataset.kind = 'email-card';
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(lang === 'ru' ? 'Так карточка выглядит в Профиле у сохранённого аккаунта, который ещё не ответил:' : 'How the card looks on the Profile tab of a saved account that hasn’t answered yet:')));
      card.appendChild(emailCard(true));
    });
  }
  // ---- after a finished game, once the player has left the board: one ask at a time, the most useful first —
  // reminders on the phone (the app), the weekly email for a saved account that never answered, saving the progress
  // for a guest (the emails box ticked there). Each keeps its own limits; six hours at least between two asks.
  var askedAt = 0;
  function askedNow() { askedAt = Date.now(); }
  function afterGameAsk() {
    if (window.__gcNoAsk || Date.now() - askedAt < 6 * 3600e3) return; // (__gcNoAsk: the automated tests of other things)
    askWhenCalm(function () {
      if (Date.now() - askedAt < 6 * 3600e3 || currentDialog) return;
      if (remindAskDue()) askReminders('game');
      else if (emailAskDue()) emailAskSheet();
      else if (saveAskDue()) saveAskSheet();
      else { var po = proOfferDue(true); if (po) proOfferSheet(po); }
    }, 1500);
  }
  // the weekly email, one tap: a saved account that never answered (twice at most, three days apart; the card on the
  // Profile tab stays until they answer)
  function emailAskDue() {
    if (!mailOn() || !me || me.guest || !me.profile || me.profile.email_opt != null || protoOffline()) return false;
    var a = load('emailSheet', { n: 0, at: 0 });
    return a.n < 2 && Date.now() - a.at > 3 * 864e5;
  }
  function emailAskSheet() {
    var a = load('emailSheet', { n: 0, at: 0 }); save('emailSheet', { n: a.n + 1, at: Date.now() });
    askedNow(); Track.event('email_ask', { where: 'game' });
    openDialog(function (card) {
      currentDialog.dataset.kind = 'email-ask';
      card.classList.add('remind-card');
      card.appendChild(h('div', { class: 'remind-art mail-art', 'aria-hidden': 'true' }, '<span class="env">' + jokerPiece() + '</span>'));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('emailAskT'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('emailAskB'))));
      var yes = bigBtn('start-btn', T('emailAskYes'), 'btn-email-ask-yes', function () {
        yes.disabled = true;
        setEmailOpt(true, 'game').then(function () {
          closeDialog(); toast(T('fairDone'));
          var c = document.getElementById('email-card'); if (c) c.remove();
        }, function () { yes.disabled = false; toast(T('netError')); });
      });
      card.appendChild(yes);
      var later = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-email-ask-later' }, esc(T('notNowBtn')));
      later.addEventListener('click', function () { closeDialog(); Track.event('email_later', { where: 'game' }); });
      card.appendChild(later);
    });
  }
  // a guest who keeps playing: save the progress (the emails box ticked) after the second finished game, then again
  // three days later, three times at most
  function saveAskDue() {
    if (!NETCFG || protoOffline() || signedIn() || liveOnlineGame() || load('gamesDone', 0) < 2) return false;
    var a = load('saveAsk', { n: 0, at: 0 });
    return a.n < 3 && Date.now() - a.at > 3 * 864e5;
  }
  function saveAskSheet() {
    var a = load('saveAsk', { n: 0, at: 0 }); save('saveAsk', { n: a.n + 1, at: Date.now() });
    askedNow(); Track.event('save_prompt', { where: 'game' });
    showAccount(null, { title: T('saveAskT'), sub: T('saveAskSub'), onCancel: function () { Track.event('save_later', { where: 'game' }); } });
  }
  // an ask that must not land on top of a game: run it once nothing is open and the player has left the board
  function askWhenCalm(fn, delay) {
    var tries = 0;
    var go = function () {
      var busy = currentDialog || curView === 'game' || (game && game.online && game.status === 'playing');
      if (!busy) { fn(); return; }
      if (++tries < 40) setTimeout(go, 1500); // a minute at most; otherwise another moment will come
    };
    setTimeout(go, delay || 0);
  }

  // ---- fair play (prototype; the server says it takes reports in hello: me.fair)
  function fairOn() { return !!((me && me.fair) || window.GC_PROTO); }
  var protoOffline = function () { return !!window.GC_PROTO && !NETCFG; }; // the preview page: no server behind it
  // a player reports the opponent of the game just played: what happened, a note if they like
  function reportSheet(gid, name, back) {
    var why = 'engine';
    openDialog(function (card) {
      currentDialog.dataset.kind = 'report';
      card.classList.add('report-card');
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('reportT', { name: name }))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('reportSub', { name: name }))));
      var list = h('div', { class: 'report-why', role: 'radiogroup', id: 'report-why' });
      [['engine', 'reportEngine'], ['abuse', 'reportAbuse'], ['other', 'reportOther']].forEach(function (x) {
        var b = h('button', { type: 'button', class: 'report-opt' + (x[0] === why ? ' on' : ''), role: 'radio', 'aria-checked': String(x[0] === why), 'data-why': x[0] }, '<i></i><span>' + esc(T(x[1])) + '</span>');
        b.addEventListener('click', function () {
          why = x[0];
          list.querySelectorAll('.report-opt').forEach(function (o) { var on = o.dataset.why === why; o.classList.toggle('on', on); o.setAttribute('aria-checked', String(on)); });
        });
        list.appendChild(b);
      });
      card.appendChild(list);
      var note = h('textarea', { class: 'report-note', id: 'report-note', rows: '2', maxlength: '300', placeholder: T('reportNote') });
      card.appendChild(note);
      var send = bigBtn('start-btn', T('reportSend'), 'btn-report-send', function () {
        send.disabled = true;
        var done = function (msg) { closeDialog(); toast(msg); if (back) setTimeout(back, 2400); };
        var call = protoOffline() ? Promise.resolve({ ok: true }) : ensureNet().then(function () { return net.call('report', { game: gid, why: why, note: note.value }); });
        call.then(function (r) { Track.event('report', { why: why }); done(r && r.again ? T('reportAgain') : T('reportSent')); }, function (e) {
          send.disabled = false;
          toast(e && e.data && e.data.error === 'too_many' ? T('reportMany') : T('netError'));
        });
      });
      card.appendChild(send);
      var cancel = h('button', { type: 'button', class: 'linkbtn center', id: 'btn-report-cancel' }, esc(T('cancel')));
      cancel.addEventListener('click', function () { closeDialog(); if (back) setTimeout(back, 220); });
      card.appendChild(cancel);
    });
  }
  // the server refused a closed account (search, invite, join): say why, once
  function fairClosed(e) {
    if (!(e && e.data && e.data.error === 'closed')) return false;
    if (lobby) stopLobby();
    if (currentDialog) closeDialog();
    setTimeout(closedSheet, 230);
    return true;
  }
  function closedSheet() {
    openDialog(function (card) {
      currentDialog.dataset.kind = 'closed';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('closedT'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('closedB'))));
      card.appendChild(bigBtn('second-btn', 'OK', 'btn-closed-ok', closeDialog));
    });
  }
  // the owner: players with open reports or flagged by the nightly check, with the check's numbers and a decision
  function fairListSheet() {
    openDialog(function (card) {
      currentDialog.dataset.kind = 'fair-list';
      card.classList.add('fair-card');
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('fairH'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('fairSub'))));
      var box = h('div', { class: 'fair-list', id: 'fair-list' }, '<div class="skel fair-skel"></div><div class="skel fair-skel"></div>');
      card.appendChild(box);
      var load = protoOffline() ? Promise.resolve({ players: protoFairData() }) : ensureNet().then(function () { return net.call('fair_list'); });
      load.then(function (r) { renderFairList(box, r.players || []); }, function () { box.innerHTML = ''; box.appendChild(h('div', { class: 'dlg-sub' }, esc(T('netError')))); });
    });
  }
  function renderFairList(box, rows) {
    box.innerHTML = ''; box._rows = rows;
    if (!rows.length) { box.appendChild(h('div', { class: 'dlg-sub' }, esc(T('fairNone')))); return; }
    rows.forEach(function (p) {
      var sc = p.score, lines = [];
      var why = Object.keys(p.why || {}).map(function (k) { return T('fairWhy_' + k) + ' ' + p.why[k]; }).join(', ');
      lines.push(T('fairReports', { n: p.open || 0 }) + (why ? ' (' + why + ')' : ''));
      lines.push(sc ? T('fairNums', { t1: Math.round(sc.t1 * 100), n: sc.moves, acpl: Math.round(sc.acpl), z: (+sc.z).toFixed(1) }) : T('fairNoScan'));
      if (sc && sc.joker_chances) lines.push(T('fairJoker', { n: sc.joker_blind, of: sc.joker_chances }));
      var row = h('div', { class: 'fair-row' + (sc && sc.verdict === 'review' ? ' hot' : sc && sc.verdict === 'watch' ? ' warm' : '') },
        '<div class="fair-top">' + avatarHtml(p.uid, p.name, 'fair-ava') + '<b>' + esc(p.name) + '</b>' + (p.fair && p.fair !== 'ok' ? '<span class="fair-state">' + esc(T('fairState_' + p.fair)) + '</span>' : '') + '</div>' +
        lines.map(function (l) { return '<div class="fair-meta">' + esc(l) + '</div>'; }).join(''));
      var acts = h('div', { class: 'fair-acts' });
      [['ok', 'fairClear'], ['watch', 'fairWatch'], ['closed', 'fairClose']].forEach(function (x) {
        if (p.fair === x[0]) return;
        var b = h('button', { type: 'button', class: 'second-btn' + (x[0] === 'closed' ? ' danger' : ''), 'data-state': x[0] }, esc(T(x[1])));
        b.addEventListener('click', function () { fairDecide(box, p, x[0], row, b); });
        acts.appendChild(b);
      });
      row.appendChild(acts);
      box.appendChild(row);
    });
  }
  // the decision: Watch keeps the player on the list (marked), Clear and Close take them off it
  function fairDecide(box, p, state, row, b) {
    if (state === 'closed' && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = T('fairSure'); return; } // a second tap closes
    b.disabled = true;
    var call = protoOffline() ? Promise.resolve({ refunds: state === 'closed' ? 3 : 0 }) : net.call('fair_set', { user: p.uid, state: state });
    call.then(function (r) {
      toast(state === 'closed' ? T('fairClosedToast', { n: (r && r.refunds) || 0 }) : T('fairDone'));
      if (state === 'watch') { p.fair = 'watch'; renderFairList(box, box._rows); return; }
      row.classList.add('gone');
      setTimeout(function () { renderFairList(box, box._rows.filter(function (x) { return x !== p; })); }, 240);
    }, function () { b.disabled = false; toast(T('netError')); });
  }
  // the preview page's made-up players (nothing here is a real account)
  function protoFairData() {
    var ago = function (h) { return new Date(Date.now() - h * 3600e3).toISOString(); };
    return [
      { uid: 'proto-1', name: 'NightOwlGM', fair: 'ok', open: 3, reports: 3, reporters: 3, why: { engine: 3 }, games: [], last_at: ago(5),
        score: { games: 11, moves: 236, t1: 0.71, acpl: 14, big: 0, joker_chances: 5, joker_found: 0, joker_blind: 5, z: 6.2, verdict: 'review' } },
      { uid: 'proto-2', name: 'FastBishop', fair: 'watch', open: 1, reports: 1, reporters: 1, why: { engine: 1 }, games: [], last_at: ago(30),
        score: { games: 7, moves: 131, t1: 0.55, acpl: 29, big: 1, joker_chances: 2, joker_found: 1, joker_blind: 1, z: 3.1, verdict: 'watch' } },
      { uid: 'proto-3', name: 'QuietRook7', fair: 'ok', open: 1, reports: 1, reporters: 1, why: { abuse: 1 }, games: [], last_at: ago(52),
        score: { games: 15, moves: 318, t1: 0.38, acpl: 57, big: 6, joker_chances: 3, joker_found: 2, joker_blind: 0, z: 0.4, verdict: 'ok' } }
    ];
  }

  // ---- haptics: a few special moments are felt, never every move — the opponent found, a Joker Move, a check
  // against me, the end of a game, the 20-second warning (the phone's own engine in the app; vibration on the web)
  var HAPTIC = { found: ['notification', 'SUCCESS', [30]], joker: ['impact', 'HEAVY', [18, 40, 30]], check: ['impact', 'LIGHT', [14]],
    win: ['notification', 'SUCCESS', [30, 60, 30]], lose: ['notification', 'ERROR', [70]], draw: ['notification', 'WARNING', [20, 40, 20]], warn: ['notification', 'WARNING', [45]] };
  function hapticsAvailable() { return (NATIVE.on && NATIVE.has('Haptics')) || (!!navigator.vibrate && matchMedia('(pointer: coarse)').matches); }
  function haptic(kind) {
    var m = HAPTIC[kind];
    if (!m || settings.haptics === false) return;
    if (NATIVE.on && NATIVE.has('Haptics')) { NATIVE.call('Haptics', m[0], m[0] === 'impact' ? { style: m[1] } : { type: m[1] }).catch(function () { /* no engine */ }); return; }
    if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) { try { navigator.vibrate(m[2]); } catch (e) { /* ignore */ } }
  }

  // transport: Supabase (production) ...
  function SupaNet(cfg) {
    var self = this;
    this.cfg = cfg; this.uid = null; this.token = null;
    // detectSessionInUrl: coming back from the link in a sign-in email signs this browser in
    this.sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { storageKey: 'goldenchess.auth' + profileSuffix, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
    this.sb.auth.onAuthStateChange(function (ev, session) {
      if (!session) return;
      self.token = session.access_token; self.uid = session.user.id;
      try { self.sb.realtime.setAuth(session.access_token); } catch (e) { /* ignore */ }
    });
  }
  SupaNet.hasSession = function () { try { return !!localStorage.getItem('goldenchess.auth' + profileSuffix); } catch (e) { return false; } };
  SupaNet.prototype.ready = function () {
    var self = this, sb = this.sb;
    return sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (s) return s;
      return sb.auth.signInAnonymously().then(function (r2) { if (r2.error) throw r2.error; return r2.data.session; });
    }).then(function (s) { self.uid = s.user.id; self.token = s.access_token; return sb.realtime.setAuth(s.access_token); });
  };
  SupaNet.prototype.call = function (action, body) {
    var self = this;
    return this.sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session ? r.data.session.access_token : self.token;
      // run next to the database (without this the call lands in the region nearest the player)
      return postJson(self.cfg.url + '/functions/v1/' + (self.cfg.fn || 'play') + '?forceFunctionRegion=' + encodeURIComponent(self.cfg.region || 'eu-central-1'),
        Object.assign({ action: action, token: tok }, body || {}));
    });
  };
  // Joker Pro's paying side (supabase/functions/pay): state, checkout, confirm, portal
  SupaNet.prototype.pay = function (action, body) {
    var self = this;
    return this.sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session ? r.data.session.access_token : self.token;
      return postJson(self.cfg.url + '/functions/v1/pay?forceFunctionRegion=' + encodeURIComponent(self.cfg.region || 'eu-central-1'), Object.assign({ action: action, token: tok }, body || {}));
    });
  };
  // is Pro sold? (anyone may ask: no session needed)
  SupaNet.proPublic = function (cfg) {
    try {
      return fetch(cfg.url + '/rest/v1/rpc/pro_public', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + cfg.key }, body: '{}' })
        .then(function (r) { if (!r.ok) throw new Error('http_' + r.status); return r.json(); }).then(function (j) { return j || {}; });
    } catch (e) { return Promise.reject(e); }
  };
  // ---- account (Supabase Auth): a guest links an email to the same account; on another device the email signs in
  // in the app, sign-in links and Google come back to the app itself
  function authRedirect() { return NATIVE.on ? NATIVE.redirect : location.origin + location.pathname + (profileSuffix ? '?p=' + profileSuffix : ''); }
  function authFail(r) { if (r && r.error) { var e = new Error(r.error.message || 'auth'); e.code = r.error.code || ''; e.status = r.error.status; throw e; } return r && r.data; }
  SupaNet.prototype.account = function () {
    return this.sb.auth.getSession().then(function (r) {
      var u = r.data && r.data.session && r.data.session.user, md = (u && u.user_metadata) || {};
      // gname: the name on the Google account, offered when the player picks their name
      return u ? { uid: u.id, email: u.email || null, guest: !!u.is_anonymous, gname: md.full_name || md.name || '' } : null;
    });
  };
  SupaNet.prototype.linkEmail = function (email) { return this.sb.auth.updateUser({ email: email }, { emailRedirectTo: authRedirect() }).then(authFail); };
  SupaNet.prototype.signInEmail = function (email, create) {
    return this.sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: !!create, emailRedirectTo: authRedirect() } }).then(authFail);
  };
  // the stores' review account (NETCFG.reviewEmail) has a password instead of codes by email
  SupaNet.prototype.signInPassword = function (email, pw) { return this.sb.auth.signInWithPassword({ email: email, password: pw }).then(authFail); };
  SupaNet.prototype.verifyCode = function (email, code, type) { return this.sb.auth.verifyOtp({ email: email, token: code, type: type }).then(authFail); };
  SupaNet.prototype.signOut = function () { return this.sb.auth.signOut({ scope: 'local' }).then(authFail); };
  // the player's own account goes (delete_my_account() in the database: not during a live game)
  SupaNet.prototype.deleteAccount = function () {
    return this.sb.rpc('delete_my_account').then(function (r) { if (r.error) { var e = new Error(r.error.message || 'delete_failed'); e.data = { error: /live_game/.test(r.error.message || '') ? 'live_game' : /active_subscription/.test(r.error.message || '') ? 'active_subscription' : 'delete_failed' }; throw e; } });
  };
  // Google / Apple: the ID token the provider gave us (see providerIdToken) is linked to this guest, or signs in
  SupaNet.prototype.idToken = function (provider, token, nonce, link) {
    var o = { provider: provider, token: token, nonce: nonce };
    return (link ? this.sb.auth.linkIdentity(o) : this.sb.auth.signInWithIdToken(o)).then(authFail);
  };
  // the ways this account signs in (Apple, Google, email), with the address each one gives
  SupaNet.prototype.methods = function () {
    return this.sb.auth.getUser().then(authFail).then(function (d) {
      var u = d && d.user;
      return ((u && u.identities) || []).map(function (i) { return { provider: i.provider, email: (i.identity_data && i.identity_data.email) || i.email || '' }; });
    });
  };
  // a signed-in player connects Google or Apple to their account. If that Google / Apple account already has a player of
  // its own, it is the same person twice: they sign in to it too (that proves it), the server makes one account of the
  // two (the one with more games stays) and the session goes on as that one. answers { linked } or { merged, keep }
  SupaNet.prototype.connectId = function (provider, token, nonce) {
    var sb = this.sb, self = this, o = { provider: provider, token: token, nonce: nonce }, mine = null;
    function back(e) { return sb.auth.setSession({ access_token: mine.access_token, refresh_token: mine.refresh_token }).then(function () { throw e; }, function () { throw e; }); }
    return sb.auth.refreshSession().then(authFail).then(function (d) {
      mine = d && d.session;
      if (!mine) { var e0 = new Error('auth'); e0.code = 'auth'; throw e0; }
      return sb.auth.linkIdentity(o).then(authFail).then(function () { return { linked: true }; }, function (e) {
        if (!methodTaken(e)) throw e;
        return sb.auth.signInWithIdToken(o).then(authFail).then(function (d2) {
          var theirs = d2 && d2.session;
          return postJson(self.cfg.url + '/functions/v1/' + (self.cfg.fn || 'play') + '?forceFunctionRegion=' + encodeURIComponent(self.cfg.region || 'eu-central-1'),
            { action: 'merge', token: mine.access_token, other: theirs.access_token }).then(function (r) {
            if (r.keep === mine.user.id) return sb.auth.setSession({ access_token: mine.access_token, refresh_token: mine.refresh_token }).then(authFail).then(function () { return { merged: true, keep: r.keep }; });
            return { merged: true, keep: r.keep };
          });
        }).catch(back);
      });
    });
  };
  // the owner's statistics (admin_stats() in the database answers only the accounts in `admins`)
  SupaNet.prototype.adminStats = function () { return this.sb.rpc('admin_stats').then(function (r) { if (r.error) throw r.error; return r.data; }); };
  // Apple says the name only the first time: it goes on the account (offered when the player picks their name)
  SupaNet.prototype.setFullName = function (name) { return this.sb.auth.updateUser({ data: { full_name: name } }).then(authFail); };
  // a player's finished games, newest first (HIST_PAGE at a time, older than `before`); opp: only those against one player
  var HIST_PAGE = 50, HIST_COLS = 'id,white_id,black_id,white_name,black_name,white_rating,black_rating,white_diff,black_diff,result,reason,pool,tc_base,tc_inc,rated,start_fen,moves,updated_at';
  SupaNet.prototype.history = function (uid, before, opp) {
    var q = this.sb.from('games').select(HIST_COLS)
      .or(opp ? 'and(white_id.eq.' + uid + ',black_id.eq.' + opp + '),and(white_id.eq.' + opp + ',black_id.eq.' + uid + ')' : 'white_id.eq.' + uid + ',black_id.eq.' + uid)
      .eq('status', 'over').order('updated_at', { ascending: false }).limit(HIST_PAGE);
    if (before) q = q.lt('updated_at', before);
    return q.then(function (r) { if (r.error) throw r.error; return r.data || []; });
  };
  // a player's page: the profile and ratings are public
  // several players' names and pictures at once (the two sides of a game)
  SupaNet.prototype.profilesOf = function (uids) {
    return this.sb.from('profiles').select('id, username, avatar_v' + (me && me.prog ? ', xp' : '') + (me && me.proc ? ', pro_until, pro_founder' : '')).in('id', uids).then(function (r) { if (r.error) throw r.error; return r.data || []; });
  };
  // the player's picture: a 256×256 JPEG in the public bucket `avatars` as <uid>.jpg (only the owner may write it)
  SupaNet.prototype.uploadAvatar = function (blob) {
    return this.sb.storage.from('avatars').upload(this.uid + '.jpg', blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' }).then(function (r) { if (r.error) throw r.error; return true; });
  };
  SupaNet.prototype.removeAvatar = function () {
    return this.sb.storage.from('avatars').remove([this.uid + '.jpg']).then(function (r) { if (r.error) throw r.error; return true; });
  };
  SupaNet.prototype.player = function (uid) {
    var sb = this.sb;
    return Promise.all([sb.from('profiles').select('id, username, created_at, house, avatar_v' + (me && me.prog ? ', xp' : '') + (me && me.proc ? ', pro_until, pro_founder' : '')).eq('id', uid).maybeSingle(),
      sb.from('ratings').select('pool, rating, rd, games, wins, draws, losses').eq('user_id', uid)]).then(function (r) {
      if (r[0].error) throw r[0].error;
      if (r[1].error) throw r[1].error;
      return { profile: r[0].data, ratings: r[1].data || [] };
    });
  };
  // the score against each opponent over all finished games (the database adds them up)
  SupaNet.prototype.h2h = function (uid) {
    return this.sb.rpc('head_to_head', { p_uid: uid }).then(function (r) { if (r.error) throw r.error; return r.data || []; });
  };
  // the leaderboard: public data, read with the public key (no account needed)
  SupaNet.prototype.top = function (pool) {
    return this.sb.from('ratings').select('user_id, rating, rd, games, wins, draws, losses, profiles(username, avatar_v, pro_until, pro_founder)').eq('pool', pool).gt('games', 0)
      .order('rating', { ascending: false }).limit(50).then(function (r) {
        if (r.error) throw r.error;
        return (r.data || []).map(function (x) {
          var pf = x.profiles || {}, fo = !!pf.pro_founder;
          return { uid: x.user_id, name: pf.username || '?', avatar_v: pf.avatar_v || 0, rating: Math.round(x.rating), rd: Math.round(x.rd), games: x.games, wins: x.wins, draws: x.draws, losses: x.losses,
            pro: fo || (!!pf.pro_until && Date.parse(pf.pro_until) > Date.now()), founder: fo };
        });
      });
  };
  // the player's place in the pool: one more than the rated players above them
  SupaNet.prototype.rank = function (pool, rating) {
    return this.sb.from('ratings').select('user_id', { count: 'exact', head: true }).eq('pool', pool).gt('games', 0).gt('rating', rating).then(function (r) {
      if (r.error) throw r.error;
      return (r.count || 0) + 1;
    });
  };
  // the leaderboard with the caller's place, the pool's size and (outside the top) their own row — needs the session
  SupaNet.prototype.board = function (pool) { return this.call('top', { pool: pool }); };
  MockNet.prototype.board = function (pool) { return this.call('top', { pool: pool }); };
  SupaNet.prototype.read = function (id) {
    return this.sb.from('games').select('*').eq('id', id).maybeSingle().then(function (r) { if (r.error) throw r.error; return r.data; });
  };
  SupaNet.prototype.sub = function (topic, h) {
    var sb = this.sb, ch = sb.channel(topic, { config: { private: true, presence: { key: this.uid || 'x' }, broadcast: { self: false } } });
    ['state', 'paired', 'move'].forEach(function (ev) { ch.on('broadcast', { event: ev }, function (m) { if (h.event) h.event(ev, m.payload); }); });
    if (h.presence) ch.on('presence', { event: 'sync' }, function () { h.presence(Object.keys(ch.presenceState())); });
    ch.subscribe(function (status) {
      if (status === 'SUBSCRIBED' && h.presence && !(h.hidden && h.hidden())) { try { ch.track({ at: Date.now() }); } catch (e) { /* ignore */ } }
      if (h.status) h.status(status);
    });
    return {
      close: function () { try { sb.removeChannel(ch); } catch (e) { /* ignore */ } },
      // the app went to the background (away) or came back: the others see it in the presence
      away: function (flag) { try { var p = flag ? ch.untrack() : ch.track({ at: Date.now() }); if (p && p.catch) p.catch(function () { /* ignore */ }); } catch (e) { /* ignore */ } },
      // fire-and-forget; only players of the game may send on its "m:" topic (database policy)
      send: function (ev, payload) { try { var p = ch.send({ type: 'broadcast', event: ev, payload: payload }); if (p && p.catch) p.catch(function () { /* ignore */ }); } catch (e) { /* ignore */ } }
    };
  };
  // ... or the local test server (same API, Server-Sent Events instead of Realtime)
  function MockNet(cfg) {
    var key = 'goldenchess.mockuid' + profileSuffix, uid = null;
    try { uid = localStorage.getItem(key); } catch (e) { /* ignore */ }
    if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem(key, uid); } catch (e) { /* ignore */ } }
    this.base = cfg.mock; this.uid = uid;
  }
  MockNet.hasSession = function () { try { return !!localStorage.getItem('goldenchess.mockuid' + profileSuffix); } catch (e) { return false; } };
  MockNet.prototype.ready = function () { return Promise.resolve(); };
  MockNet.prototype.call = function (action, body) { return postJson(this.base + '/play', Object.assign({ action: action, token: this.uid }, body || {})); };
  MockNet.prototype.read = function (id) { return this.call('game', { game: id }).then(function (r) { return r.game; }); };
  MockNet.prototype.pay = function (action, body) { return postJson(this.base + '/pay', Object.assign({ action: action, token: this.uid }, body || {})); };
  MockNet.proPublic = function (cfg) { try { return postJson(cfg.mock + '/pay', { action: 'public' }); } catch (e) { return Promise.reject(e); } };
  // the same account API against the test server's stand-in for Supabase Auth (codes land in its outbox)
  MockNet.prototype.authCall = function (body) {
    return postJson(this.base + '/auth', Object.assign({ token: this.uid }, body)).catch(function (e) { e.code = e.data && e.data.error || e.code; throw e; });
  };
  MockNet.prototype.account = function () { return this.authCall({ op: 'whoami' }); };
  MockNet.prototype.linkEmail = function (email) { return this.authCall({ op: 'link', email: email }); };
  MockNet.prototype.signInEmail = function (email, create) { return this.authCall({ op: 'signin', email: email, create: !!create }); };
  MockNet.prototype.verifyCode = function (email, code, type) {
    var self = this;
    return this.authCall({ op: 'verify', email: email, code: code, type: type }).then(function (r) {
      if (r.uid && r.uid !== self.uid) { self.uid = r.uid; try { localStorage.setItem('goldenchess.mockuid' + profileSuffix, r.uid); } catch (e) { /* ignore */ } }
      return r;
    });
  };
  MockNet.prototype.signInPassword = function (email, pw) {
    var self = this;
    return this.authCall({ op: 'password', email: email, password: pw }).then(function (r) {
      if (r.uid && r.uid !== self.uid) { self.uid = r.uid; try { localStorage.setItem('goldenchess.mockuid' + profileSuffix, r.uid); } catch (e) { /* ignore */ } }
      return r;
    });
  };
  MockNet.prototype.signOut = function () {
    this.uid = 'u' + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('goldenchess.mockuid' + profileSuffix, this.uid); } catch (e) { /* ignore */ }
    return Promise.resolve();
  };
  MockNet.prototype.idToken = function (provider, token, nonce, link) {
    // the test server: a token "apple:<email>" signs in as that email (see test/server/mock-server.mjs)
    var self = this;
    return this.authCall({ op: 'idtoken', provider: provider, idtoken: token, link: !!link }).then(function (r) { if (r && r.uid) self.uid = r.uid; return r; });
  };
  MockNet.prototype.setFullName = function () { return Promise.resolve(); };
  MockNet.prototype.methods = function () { return this.authCall({ op: 'whoami' }).then(function (r) { return r.methods || []; }); };
  MockNet.prototype.connectId = function (provider, token) {
    var self = this, mine = this.uid;
    function as(uid) { self.uid = uid; try { localStorage.setItem('goldenchess.mockuid' + profileSuffix, uid); } catch (e) { /* ignore */ } }
    return this.authCall({ op: 'idtoken', provider: provider, idtoken: token, link: true }).then(function () { return { linked: true }; }, function (e) {
      if (!methodTaken(e)) throw e;
      return self.authCall({ op: 'idtoken', provider: provider, idtoken: token }).then(function (r) {
        return postJson(self.base + '/play', { action: 'merge', token: mine, other: r.uid }).then(function (m) { as(m.keep); return { merged: true, keep: m.keep }; });
      });
    });
  };
  MockNet.prototype.adminStats = function () { return postJson(this.base + '/admin', { op: 'stats', token: this.uid }); };
  MockNet.prototype.deleteAccount = function () { return postJson(this.base + '/delete', { token: this.uid }); };
  MockNet.prototype.history = function (uid, before, opp) { return postJson(this.base + '/history', { token: uid, before: before || null, opp: opp || null, limit: HIST_PAGE }).then(function (r) { return r.games || []; }); };
  MockNet.prototype.h2h = function (uid) { return postJson(this.base + '/h2h', { token: uid }).then(function (r) { return r.rows || []; }); };
  MockNet.prototype.top = function (pool) { return this.call('top', { pool: pool }).then(function (r) { return r.rows || []; }); };
  MockNet.prototype.rank = function (pool) { return this.call('top', { pool: pool }).then(function (r) { return r.rank || null; }); };
  MockNet.prototype.player = function (uid) { return postJson(this.base + '/player', { uid: uid }); };
  MockNet.prototype.profilesOf = function (uids) { return postJson(this.base + '/profiles', { uids: uids }).then(function (r) { return r.rows || []; }); };
  MockNet.prototype.uploadAvatar = function (blob) {
    var self = this;
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { postJson(self.base + '/avatar', { token: self.uid, data: String(fr.result).split(',')[1] || '' }).then(res, rej); };
      fr.onerror = function () { rej(new Error('read')); };
      fr.readAsDataURL(blob);
    });
  };
  MockNet.prototype.removeAvatar = function () { return postJson(this.base + '/avatar', { token: this.uid, remove: true }); };
  MockNet.prototype.sub = function (topic, h) {
    var base = this.base, uid = this.uid;
    var es = new EventSource(base + '/events?topic=' + encodeURIComponent(topic) + '&uid=' + encodeURIComponent(uid));
    function away(flag) {
      fetch(base + '/presence', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ topic: topic, token: uid, away: !!flag }) }).catch(function () { /* ignore */ });
    }
    es.onopen = function () { if (h.hidden && h.hidden()) away(true); if (h.status) h.status('SUBSCRIBED'); };
    es.onerror = function () { if (h.status) h.status('CHANNEL_ERROR'); };
    es.onmessage = function (e) { var d = JSON.parse(e.data); if (d.event === 'presence') { if (h.presence) h.presence(d.payload); } else if (h.event) h.event(d.event, d.payload); };
    return {
      close: function () { es.close(); },
      away: away,
      send: function (ev, payload) {
        fetch(base + '/peer', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ topic: topic, event: ev, payload: payload, token: uid }) }).catch(function () { /* ignore */ });
      }
    };
  };

  function hasNetSession() { return NETCFG ? (NETCFG.mock != null ? MockNet : SupaNet).hasSession() : false; }
  // the transport without signing in (public reads)
  function getClient() { if (!net && NETCFG) net = NETCFG.mock != null ? new MockNet(NETCFG) : new SupaNet(NETCFG); return net; }
  function ensureNet() {
    if (!NETCFG) return Promise.reject(new Error('offline'));
    if (netReady) return netReady;
    try { getClient(); } catch (e) { return Promise.reject(e); }
    netReady = net.ready().then(function () { return Promise.all([net.call('hello', { platform: NATIVE.platform }), net.account().catch(function () { return null; })]); }).then(function (rr) {
      var r = rr[0], a = rr[1];
      me = { uid: net.uid, profile: r.profile, ratings: {}, email: a && a.email || null, guest: !a || a.guest, gname: a && a.gname || '', admin: !!r.admin, fair: !!r.fair, mail: !!r.mail, prog: !!r.prog, pro: r.pro || null, proc: !!r.proc, iap: !!r.iap };
      noteAvatars([r.profile]);
      proTake(); // Joker Pro: the account's own, and whether it is sold to this player
      progSync(); // the progress of this device and of the account, merged (prototype: only when the server keeps it)
      (r.ratings || []).forEach(function (x) { me.ratings[x.pool] = x; });
      if (!userSub) userSub = net.sub('u:' + net.uid, { event: function (ev, p) { if (ev === 'paired' && p && p.game && lobby) onPaired(p.game); } });
      syncPrefs(); // the language, the time zone and a yes given while saving (prototype: only when the server keeps them)
      return r;
    });
    netReady.catch(function () { netReady = null; });
    return netReady;
  }
  // the day log (the owner's retention numbers): what a player with an account did today, each kind once a day
  function noteAct(kind) {
    if (!NETCFG || !hasNetSession()) return;
    var day = new Date().toISOString().slice(0, 10), seen = load('act', {});
    if (seen[kind] === day) return;
    seen[kind] = day; save('act', seen);
    ensureNet().then(function () { return net.call('act', { what: kind, platform: NATIVE.platform }); }).catch(function () { /* a lost note is fine */ });
  }
  function refreshMe() {
    if (!net || !me) return Promise.resolve();
    return Promise.all([net.call('hello', { platform: NATIVE.platform }), net.account().catch(function () { return null; })]).then(function (rr) {
      var r = rr[0], a = rr[1];
      me.profile = r.profile; me.ratings = {}; (r.ratings || []).forEach(function (x) { me.ratings[x.pool] = x; }); me.admin = !!r.admin; me.fair = !!r.fair; me.mail = !!r.mail; me.prog = !!r.prog; me.pro = r.pro || null; me.proc = !!r.proc; me.iap = !!r.iap;
      noteAvatars([r.profile]);
      proTake();
      progSync();
      if (a) { me.email = a.email || null; me.guest = a.guest; me.gname = a.gname || ''; }
      syncPrefs(); // after the account is known: the yes to emails given while saving goes with a saved account only
    }, function () { /* ignore */ });
  }
  function setUrl(key, val) {
    try {
      var u = new URL(location.href);
      u.searchParams.delete('join'); u.searchParams.delete('game');
      if (key) u.searchParams.set(key, val);
      history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
    } catch (e) { /* ignore */ }
  }
  function inviteLink(id) { return location.origin + location.pathname + '?join=' + id; }

  // ---- lobby: seek a rated/casual opponent, or invite a friend by link
  function stopLobby() {
    if (!lobby) return;
    clearTimeout(lobby.timer); clearInterval(lobby.tick); clearTimeout(lobby.houseTimer);
    if (lobby.sub) lobby.sub.close();
    lobby = null;
  }
  function cancelLobby() {
    var L = lobby; stopLobby();
    if (!L || !net) return;
    if (L.kind === 'seek') net.call('cancel').catch(function () { /* ignore */ });
    if (L.kind === 'invite' && L.gameId) net.call('resign', { game: L.gameId }).catch(function () { /* ignore */ });
  }
  function pollLobby(L, el, reel) {
    if (!net) return;
    net.call('lobby').then(function (r) {
      if (!r || r.online == null) return;
      var first = !(lobbyStats && lobbyStats.faces && lobbyStats.faces.length);
      lobbyStats = r;
      if (lobby !== L || !el.isConnected) return;
      if (el.textContent !== lobbyLine(r)) { el.classList.add('bump'); setTimeout(function () { el.classList.remove('bump'); }, 260); }
      el.textContent = lobbyLine(r);
      if (reel && first && r.faces && r.faces.length) fillReel(reel, r.faces);
    }, function () { /* the line just stays */ });
  }
  // the reel: the faces roll past one by one; each stops in the lens for a moment (sharp there, blurred on the sides)
  // and the next one comes — like flicking through who might be your opponent. The list is there twice, so the loop
  // has no seam: after the first round the track jumps back without a transition.
  var REEL_PITCH = 70; // a disc (56) and the gap (14)
  function fillReel(reel, faces) {
    clearInterval(reel._step);
    var list = (faces || []).slice(0, 14);
    if (list.length) noteAvatars(list.map(function (x) { return { id: x.uid, avatar_v: x.avatar_v }; }));
    while (list.length < 10) list.push(null); // until the players come: blank discs
    var row = list.concat(list).map(function (x, k) {
      return x ? avatarHtml(x.uid, x.name, 'reel-ava t' + (k % 6)) : '<span class="ava reel-ava blank"></span>';
    }).join('');
    reel.innerHTML = '<div class="reel-track blur">' + row + '</div><div class="reel-lens"><div class="reel-track">' + row + '</div></div><i class="reel-ring"></i>';
    var tracks = reel.querySelectorAll('.reel-track'), k = 0, n = list.length;
    function place(animate) {
      var x = -k * REEL_PITCH;
      tracks[0].style.left = (reel.clientWidth / 2 - 28) + 'px'; tracks[1].style.left = '6px';
      for (var t = 0; t < 2; t++) { tracks[t].style.transition = animate ? 'transform .42s cubic-bezier(.3, .8, .25, 1)' : 'none'; tracks[t].style.transform = 'translateX(' + x + 'px)'; }
    }
    place(false); requestAnimationFrame(function () { place(false); });
    reel._step = setInterval(function () {
      if (!reel.isConnected) { clearInterval(reel._step); return; }
      k++; place(true);
      if (k >= n) setTimeout(function () { k = 0; place(false); }, 450);
    }, 800);
  }
  function onPaired(id) { stopLobby(); if (currentDialog && currentDialog.dataset.kind === 'lobby') closeDialog(); haptic('found'); openOnlineGame(id); }
  // How long the search "takes" before a house player is seated when no person is found: like a real queue, often
  // quick (2-3 s), mostly 4-5 s, now and then 6-7.5 s. People come first all along: one searching for the same game
  // is paired at once, and while others have the app open the server holds the house back for 5 s of search
  // (gc_house_pair), so a search ends within about 8 s.
  function seekSpan() {
    if (window.__gcSeekMs != null) return window.__gcSeekMs;
    var r = Math.random();
    return r < 0.3 ? 2000 + Math.random() * 1000 : r < 0.82 ? 3500 + Math.random() * 1800 : 6000 + Math.random() * 1500;
  }
  function startSeek(tc, rated) {
    if (lobby && lobby.kind === 'invite') cancelLobby(); else stopLobby(); // a search takes the place of an open invite
    var L = lobby = { kind: 'seek', tc: tc, rated: rated, t0: perf(), timer: 0, tick: 0, span: seekSpan(), houseTimer: 0 };
    Track.event('search_start', { tc: tc, rated: !!rated });
    showLobbyDialog();
    ensureNet().then(function () {
      seekTick(L);
      L.houseTimer = setTimeout(function () { houseSeek(L); }, L.span);
    }, function () { if (lobby === L) { stopLobby(); closeDialog(); toast(T('netError')); } });
  }
  function seekTick(L) {
    if (lobby !== L) return;
    net.call('seek', { tc: L.tc, rated: L.rated }).then(function (r) {
      if (r.game) { if (lobby === L || (online && online.id === r.game.id) || !online) onPaired(r.game.id); return; }
      if (lobby === L) L.timer = setTimeout(function () { seekTick(L); }, 2000);
    }, function (e) { if (fairClosed(e)) return; if (lobby === L) L.timer = setTimeout(function () { seekTick(L); }, 5000); });
  }
  function houseSeek(L) {
    if (lobby !== L) return;
    net.call('house', { tc: L.tc, rated: L.rated }).then(function (r) {
      if (r.game) { if (lobby === L || (online && online.id === r.game.id) || !online) onPaired(r.game.id); return; }
      if (lobby === L) L.houseTimer = setTimeout(function () { houseSeek(L); }, 1000);
    }, function (e) { if (fairClosed(e)) return; if (lobby === L) L.houseTimer = setTimeout(function () { houseSeek(L); }, 6000); });
  }
  function newOpponent() {
    var tc = game && game.cfg.tc ? game.cfg.tc.label : (lastSetup.otc || '3+2');
    if (ONLINE_TCS.indexOf(tc) < 0) tc = '3+2';
    startSeek(tc, game && game.online ? !!game.cfg.rated : lastSetup.rated !== false);
  }
  function startInvite(tc, rated) {
    stopLobby();
    var L = lobby = { kind: 'invite', tc: tc, rated: rated, t0: perf(), timer: 0, tick: 0, gameId: null };
    showLobbyDialog();
    ensureNet().then(function () { return net.call('challenge', { tc: tc, rated: rated, color: 'r' }); }).then(function (r) {
      if (lobby !== L) { net.call('resign', { game: r.game.id }).catch(function () { /* ignore */ }); return; }
      L.code = r.game.code || null;
      watchInvite(L, r.game.id);
    }, function (e) { if (fairClosed(e)) return; if (lobby === L) { stopLobby(); closeDialog(); toast(T('netError')); } });
  }
  function watchInvite(L, id) {
    L.gameId = id;
    L.sub = net.sub('g:' + id, { event: function (ev, s) { if (ev === 'state' && s && s.status === 'playing' && lobby === L) onPaired(id); } });
    (function poll() {
      if (lobby !== L) return;
      net.read(id).then(function (g) {
        if (lobby !== L) return;
        if (g && g.status === 'playing') onPaired(id);
        else if (!g || g.status !== 'waiting') { stopLobby(); closeDialog(); if (curView === 'play') refreshView(); }
        else L.timer = setTimeout(poll, 4000);
      }, function () { if (lobby === L) L.timer = setTimeout(poll, 6000); });
    })();
    if (L.render) L.render();
  }
  function copyText(text, okMsg, inputEl) {
    function fallback() { if (inputEl) { try { inputEl.focus(); inputEl.select(); } catch (e) { /* ignore */ } } }
    try { navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); } catch (e) { fallback(); }
  }
  // the last word from the server about who is around (shown at once when the dialog opens again)
  var lobbyStats = null;
  function showLobbyDialog() {
    var L = lobby;
    openDialog(function (card) {
      currentDialog.dataset.kind = 'lobby';
      currentDialog.onClose = function () {
        if (lobby !== L) return;
        if (L.kind === 'invite') { toast(T('inviteKept')); if (curView === 'play') refreshView(); return; }
        cancelLobby();
      };
      var meta = tcLabel(L.tc) + ' \u00b7 ' + (L.rated ? T('rated') : T('casual')).toLowerCase();
      if (L.kind === 'seek') {
        // centred on every screen: a card with the search, who is around, and a light line of what "we" are up to
        currentDialog.classList.add('center'); card.classList.add('lobby');
        // the players around roll past behind a lens: blurred on the sides, sharp in the middle
        var reel = h('div', { class: 'lobby-reel', id: 'lobby-reel', 'aria-hidden': 'true' });
        card.appendChild(reel); fillReel(reel, lobbyStats && lobbyStats.faces);
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('searching'))));
        var sub = h('div', { class: 'dlg-sub', id: 'seek-sub' }); card.appendChild(sub);
        // the Joker hops square to square for as long as the search goes on
        var sqs = ''; for (var qi = 0; qi < 5; qi++) sqs += '<i class="' + (qi % 2 ? 'd' : 'l') + '"></i>';
        card.appendChild(h('div', { class: 'hopper pong', id: 'seek-bar', 'aria-hidden': 'true' }, '<span class="hop-sq">' + sqs + '</span><span class="hop-pc">' + jokerPiece() + '</span>'));
        var live = h('div', { class: 'lobby-live', id: 'lobby-live' }, lobbyStats ? esc(lobbyLine(lobbyStats)) : '&nbsp;');
        card.appendChild(live);
        var moods = T('lobbyMoods'), mi = Math.floor(Math.random() * moods.length);
        var mood = h('div', { class: 'lobby-mood', id: 'lobby-mood' }, esc(moods[mi] + '\u2026'));
        card.appendChild(mood);
        if (fairOn()) card.appendChild(h('div', { class: 'lobby-fair', id: 'lobby-fair' }, esc(T('fairLine'))));
        var n = 0;
        var upd = function () {
          if (lobby !== L) return;
          var sec = Math.floor((perf() - L.t0) / 1000); sub.textContent = meta + ' \u00b7 ' + Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60);
          if (++n % 4 === 0) { mi = (mi + 1) % moods.length; mood.classList.add('swap'); setTimeout(function () { mood.textContent = moods[mi] + '\u2026'; mood.classList.remove('swap'); }, 180); }
          if (n % 5 === 1) pollLobby(L, live, reel);
        };
        upd(); L.tick = setInterval(upd, 1000);
      } else {
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('gcodeT'))));
        card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('gcodeSub'))));
        // the 4 digits, big enough to read out across a table
        var codeEl = h('div', { class: 'game-code', id: 'invite-code', 'aria-live': 'polite' });
        card.appendChild(codeEl);
        var inp = h('input', { type: 'hidden', id: 'invite-link' }); // the link, for the share and for a link already sent
        card.appendChild(inp);
        var box = h('div', { class: 'code-acts' });
        var cp = h('button', { type: 'button', class: 'sbtn', id: 'btn-copy-code' }, esc(T('copyCode')));
        cp.addEventListener('click', function () { if (L.code) copyText(L.code, T('codeCopied')); });
        box.appendChild(cp);
        var sh = null;
        // the share sheet: the browser's, or the system one in the app (an Android web view has no navigator.share)
        if (NATIVE.on || navigator.share) {
          sh = h('button', { type: 'button', class: 'sbtn', id: 'btn-share-link' }, esc(T('share')));
          sh.addEventListener('click', function () {
            if (!L.gameId) return;
            var o = { title: 'Joker Chess', text: T('shareCodeText', { code: L.code || '' }), url: inp.value };
            if (NATIVE.on) { NATIVE.call('Share', 'share', Object.assign({ dialogTitle: T('share') }, o)).catch(function () { copyText(L.code || inp.value, T('codeCopied')); }); return; }
            try { navigator.share(o).catch(function () { /* ignore */ }); } catch (e) { /* ignore */ }
          });
          box.appendChild(sh);
        }
        card.appendChild(box);
        card.appendChild(h('div', { class: 'record' }, esc(meta + '. ' + T('waitingFriend') + '…')));
        L.render = function () {
          inp.value = L.gameId ? inviteLink(L.gameId) : '';
          codeEl.innerHTML = L.code ? L.code.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('') : '<span class="wait">\u2022</span><span class="wait">\u2022</span><span class="wait">\u2022</span><span class="wait">\u2022</span>';
          cp.disabled = !L.code; if (sh) sh.disabled = !L.gameId;
        };
        L.render();
      }
      var row = h('div', { class: 'row-btns' }), c = h('button', { class: 'secondary', type: 'button', id: 'btn-cancel-lobby' }, esc(T('cancel')));
      c.addEventListener('click', function () { closeDialog(); });
      row.appendChild(c); card.appendChild(row);
    });
  }
  // ---- account: a guest keeps their progress by adding an email to the same account; on another device the
  // same email signs in to it. Sign-in codes come by email (the email also has a link that does the same).
  var OTP_LEN = (NETCFG && NETCFG.otpLength) || 6;
  function authMsg(e) {
    var c = String((e && (e.code || (e.data && e.data.error) || e.message)) || '');
    if (/rate|too_many|over_/i.test(c) || (e && e.status === 429)) return T('tooMany');
    if (/otp|token|expired|invalid_credentials/i.test(c)) return T('codeWrong');
    if (/email.*(invalid|format)|validation/i.test(c)) return T('emailInvalid');
    if (/not_authorized|sending|smtp/i.test(c) || (e && e.status >= 500)) return T('sendFailed');
    return T('netError');
  }
  function liveOnlineGame() { return !!(game && game.online && game.status === 'playing' && !spectating()); }

  // ---- a house player as the opponent (games.house: its colour; house_style: its level and manner). This device
  // plays for it: the engine picks the move, a think-time model says when it is made, and the server gets it with
  // `house: true` and the time it took (the house side's clock is counted from that). Now and then it resigns a lost
  // game, agrees to a draw in a dead one, wants a rematch, loses on time in time trouble, or leaves (rarely).
  function houseColor() { var s = online && online.s; return s && s.house ? (s.house === 'w' ? 0 : 1) : -1; }
  function houseOpp() { return online && online.color >= 0 && houseColor() >= 0 && houseColor() !== online.color; }
  function houseStyle() { return (online && online.s && online.s.house_style) || {}; }
  function houseCheck() {
    var o = online;
    if (!o || !o.s || !houseOpp() || o.pending || o.housePending) return;
    if (o.s.status !== 'playing') { houseAfter(o); return; }
    if (!game || game.status !== 'playing' || game.pos.side !== houseColor() || game.records.length !== o.s.moves.length) return;
    var ply = game.records.length;
    if (o.houseAt === ply) return;
    o.houseAt = ply;
    houseTurn(o, ply);
  }
  function houseValid(o, ply) { return online === o && game && game.online && game.status === 'playing' && game.pos.side === houseColor() && game.records.length === ply && !o.pending && !o.housePending; }
  function houseTurn(o, ply) {
    var st = houseStyle(), lvl = Math.max(1, Math.min(8, st.level || 5)), hc = houseColor(), fast = !!window.__gcFastBot;
    var rnd = Math.random;
    // the rare human things: not showing up for the first move (the game is aborted), walking away mid-game (loses)
    if (!fast && ply <= 1 && rnd() < (st.abort != null ? st.abort : 0.015)) return;
    if (!fast && ply >= 12 && !o.houseLeft && rnd() < (st.leave != null ? st.leave : 0.006)) { o.houseLeft = true; }
    if (o.houseLeft) { houseLeave(o, ply); return; }
    var budget = Engine.LEVELS[lvl - 1].time, t0 = perf();
    if (game.clock) {
      var left = game.timeLeft(hc, t0), inc = game.cfg.tc.inc;
      budget = Math.min(budget, Math.max(40, left / 32 + inc * 0.7));
      if (left < 4000) budget = Math.min(budget, Math.max(15, left / 60));
    }
    var id = ++reqSeq;
    o.houseReq = id;
    var moves = game.records.map(function (r) { return r.uci; });
    var book = game.startFen === GC.START_FEN && window.GCBook ? GCBook.pick(moves, lvl) : null;
    if (book) {
      // a book move: played from memory, quickly; nothing to resign or offer a draw over here
      var bt = fast ? 0 : bookThinkMs(st.tempo || 1);
      houseLater(o, bt, function () { if (houseValid(o, ply)) houseMove(o, ply, book, Math.max(200, Math.round(bt + 120))); });
      return;
    }
    bot.think({ id: id, fen: game.startFen, moves: moves, timeMs: budget, level: lvl }, function (res) {
      if (o.houseReq !== id || !houseValid(o, ply)) return;
      var score = res && typeof res.score === 'number' ? res.score : 0, uci = res && res.uci;
      var think = fast ? 0 : houseThinkMs(lvl, uci, hc, st);
      var human = hc === 0 ? 'b' : 'w';
      // the human offered a draw: taken in a level, long game; declined otherwise (then the move follows)
      if (o.s.draw_offer === human && !o.houseDrawAt) {
        o.houseDrawAt = ply;
        var take = Math.abs(score) < (st.drawAt || 60) && ply >= 30 && rnd() < (st.draw != null ? st.draw : 0.8);
        houseLater(o, fast ? 0 : 800 + rnd() * 2200, function () { houseAct(o, take ? 'accept' : 'decline'); if (!take) houseLater(o, 300, function () { if (houseValid(o, ply)) houseMove(o, ply, uci, think); }); });
        return;
      }
      // a lost game: resigned after a while, not at once (weaker players play on)
      if (st.resign !== 'never' && ply >= 20 && score < -(st.resignAt || 650) && rnd() < (st.resignP != null ? st.resignP : 0.35)) {
        houseLater(o, Math.min(think, 2500) + (fast ? 0 : 400 + rnd() * 1600), function () { if (houseValid(o, ply)) houseAct(o, 'resign'); });
        return;
      }
      // a dead-drawn long game: a draw is offered now and then (the move follows)
      if (ply >= 60 && Math.abs(score) < 25 && !o.s.draw_offer && rnd() < 0.12) houseLater(o, 200, function () { houseAct(o, 'draw'); });
      // time trouble: sometimes the flag falls
      if (!fast && game.clock && game.timeLeft(hc, perf()) < 2000 && rnd() < (st.flag != null ? st.flag : 0.04)) { houseFlag(o, ply); return; }
      houseLater(o, Math.max(0, think - (perf() - t0)), function () { if (houseValid(o, ply)) houseMove(o, ply, uci, Math.max(200, Math.round(perf() - t0 + 150))); });
    });
  }
  function houseLater(o, ms, fn) { var t = setTimeout(function () { if (online === o) fn(); }, ms); (o.houseTimers = o.houseTimers || []).push(t); }
  // the house player walks away: seen to go (the "away" countdown runs like for anyone), then gone on its device's word
  function houseLeave(o, ply) {
    if (!o.houseAway) { o.houseAway = true; setOppHere(o, false); }
    houseLater(o, GONE_MS + 400, function () { if (houseValid(o, ply)) houseAct(o, 'leave'); });
  }
  // the clock runs out on the house side: shown running down here, then told to the server as a move that took too long
  function houseFlag(o, ply) {
    var hc = houseColor(), left = game.clock ? game.timeLeft(hc, perf()) : 1000;
    houseLater(o, Math.min(Math.max(0, left) + 350, 90000), function () {
      if (!houseValid(o, ply)) return;
      var m = game.legal[0]; if (!m) return;
      pushHouse(o, { ply: ply, uci: GC.moveToUci(m), tries: 0, think: Math.max(200, Math.round(left) + 600) });
    });
  }
  // the house player's move goes to the server on its own track (o.pending is the human's own move: a premove
  // answering the house move can be on its way at the same time; the server waits a moment for the house move to land)
  function pushHouse(o, p) {
    if (online !== o) return;
    if (!o.housePending) o.housePending = p;
    if (o.housePending !== p) return;
    net.call('move', { game: o.id, uci: p.uci, ply: p.ply, house: true, think: p.think }).then(function (r) {
      if (online !== o) return;
      if (o.housePending === p) o.housePending = null;
      onServerState(r.game);
    }, function (e) {
      if (online !== o || o.housePending !== p) return;
      var d = e && e.data;
      if (d && d.game) {
        if (d.error === 'conflict' && d.game.status === 'playing' && d.game.moves.length === p.ply && p.tries++ < 4) { pushHouse(o, p); return; }
        o.housePending = null; o.houseAt = -1; // refused: the house's turn is taken again from the server's state
        onServerState(d.game, { force: true, authoritative: true });
        return;
      }
      if (e && e.status === 401) { netReady = null; }
      if (p.tries++ < 8) setTimeout(function () { pushHouse(o, p); }, Math.min(4000, 250 * p.tries));
      else { o.housePending = null; o.houseAt = -1; resyncOnline(); }
    });
  }
  // the think time of a house player: the bot's model (quick in the opening and in recaptures, longer when there is
  // more to think about, in a hurry when short of time), scaled by its tempo
  // the pace of a house player in this game: what a move takes on average, set once per game so that it uses a good part
  // of its clock like anyone (55–95 % of the base time over some forty moves, plus most of the increment); some play
  // faster than others (tempo), stronger ones a little slower
  function housePace(o, lvl, st) {
    if (!o.housePace) {
      var base = game.clock ? game.cfg.tc.base : 180000, inc = game.clock ? game.cfg.tc.inc : 0;
      o.housePace = (base * (0.55 + Math.random() * 0.4)) / 40 + inc * (0.7 + Math.random() * 0.25);
    }
    return o.housePace * (st.tempo || 1) * Math.sqrt(THINK_BASE[lvl - 1] / THINK_BASE[3]);
  }
  function houseThinkMs(lvl, uci, hc, st) {
    var pos = game.pos, n = game.records.length, moveNo = Math.floor(n / 2) + 1, normal = 0;
    game.legal.forEach(function (x) { if (!(x & F_GOLDEN)) normal++; });
    var m = uci ? pos.moveFromUci(uci) : 0, golden = !!(m && (m & F_GOLDEN)), last = n ? game.records[n - 1] : null;
    var recapture = !!(m && last && last.capture && (m & F_CAPTURE) && ((m >> 7) & 127) === ((last.m >> 7) & 127));
    var ms;
    if (normal <= 1 && !golden) ms = 380 + Math.random() * 420;
    else {
      ms = housePace(online, lvl, st);
      ms *= moveNo <= 2 ? 0.3 : moveNo <= 5 ? 0.5 : moveNo <= 10 ? 0.8 : 1.1;
      ms *= Math.max(0.7, Math.min(1.35, 0.72 + normal / 70));
      if (pos.inCheck()) ms *= 0.85;
      ms *= Math.exp(gauss() * 0.45);
      if (moveNo > 8 && Math.random() < 0.12) ms *= 2.4; // the long think now and then
      if (recapture) ms = Math.min(ms, 350 + Math.random() * 500);
      if (moveNo <= 8) ms = Math.min(ms, 1200 + Math.random() * 1800); // early moves come quickly even out of book
      if (golden) ms = ms * 1.3 + 900;
      ms = Math.max(400, Math.min(lvl >= 6 ? 25000 : 18000, ms));
    }
    if (game.clock) {
      // in a hurry when short of time: never more than a share of what is left
      var left = game.timeLeft(hc, perf()), inc = game.cfg.tc.inc;
      ms = Math.min(ms, Math.max(150, left / 12 + inc * 0.6));
      if (left < 10000) ms = Math.min(ms, 150 + Math.random() * 300);
    }
    return ms;
  }
  function houseMove(o, ply, uci, think) {
    var m = uci ? game.pos.moveFromUci(uci) : 0;
    if (!m) m = game.legal[0];
    if (!m) return;
    // sent first, then shown: a premove answering it (commit runs it) is sent right after, and the server takes them in order
    pushHouse(o, { ply: ply, uci: GC.moveToUci(m), tries: 0, think: think });
    commit(m, false, 'opp');
  }
  function houseAct(o, op) {
    if (online !== o) return;
    net.call('house_act', { game: o.id, op: op }).then(function (r) {
      if (online !== o) return;
      if (r.game) onServerState(r.game, { force: true });
      if (r.next) openOnlineGame(r.next);
    }, function (e) { if (online === o && e && e.data && e.data.game) onServerState(e.data.game, { force: true }); });
  }
  // after the game: a rematch the human asked for is mostly taken; sometimes the house player asks first
  function houseAfter(o) {
    var s = o.s, human = online.color === 0 ? 'w' : 'b';
    if (!s || s.rematch_game || o.houseRematch || (s.status !== 'over' && s.status !== 'aborted')) return;
    var st = houseStyle(), fast = !!window.__gcFastBot;
    if (s.rematch_offer === human) {
      o.houseRematch = true;
      if (Math.random() < (st.rematch != null ? st.rematch : 0.65)) houseLater(o, fast ? 0 : 1500 + Math.random() * 3500, function () { houseAct(o, 'rematch'); });
    } else if (!s.rematch_offer && s.status === 'over' && !o.houseAsked) {
      o.houseAsked = true;
      if (Math.random() < 0.25) houseLater(o, fast ? 0 : 2500 + Math.random() * 4000, function () { if (online === o && o.s && !o.s.rematch_offer && !o.s.rematch_game) houseAct(o, 'rematch'); });
    }
  }
  function hasProgress() { return !!me && Object.keys(me.ratings).some(function (p) { return me.ratings[p].games > 0; }); }
  function boldVar(key, name, value) { var v = {}; v[name] = '\u0000'; return esc(T(key, v)).replace('\u0000', '<b>' + esc(value) + '</b>'); }
  // The account dialog (save progress, sign out) and the sign-in page share one flow.
  // back: reopens the dialog the player came from once they are done here
  function showAccount(back, ask) {
    openDialog(function (card) {
      currentDialog.dataset.kind = ask ? 'save-ask' : 'account';
      var flow = accountFlow(card, { onDone: function () { closeDialog(); if (back) back(); }, onCancel: function () { closeDialog(); if (ask && ask.onCancel) ask.onCancel(); },
        title: ask && ask.title, sub: ask && ask.sub });
      currentDialog.onClose = flow.stop;
    });
  }
  // o: { page: the full-page sign-in, onDone(), onCancel() }
  function accountFlow(card, o) {
    var st = { step: 'form', email: '', code: '', type: '', existing: false, err: '', busy: false, sentAt: 0, acct: null, opt: true };
    var timer = 0, again = null, alive = true;
    if (me && !me.guest) { st.step = 'signed'; st.acct = { email: me.email, guest: false }; }
    else if (hasNetSession() && !me) {
      // a session from before: find out whose it is
      st.step = 'loading';
      ensureNet().then(function () { return net.account(); }).then(function (a) {
        if (!alive) return;
        st.acct = a; st.step = a && !a.guest ? 'signed' : 'form'; render();
      }, function () { if (!alive) return; st.step = 'form'; st.err = T('netError'); render(); });
    }
    render();

    function btn(cls, label, fn, id) { var b = h('button', { class: cls, type: 'button' }, esc(label)); if (id) b.id = id; b.addEventListener('click', fn); return b; }
    function row(btns) { var r = h('div', { class: 'row-btns' }); btns.forEach(function (b) { r.appendChild(b); }); return r; }
    function focus(el) { if (o.page && matchMedia('(pointer: coarse)').matches && st.step === 'form') return; setTimeout(function () { if (el.isConnected && !el.disabled) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30); }
    // the "send again" countdown (only that button changes, so typing in the code field is never disturbed)
    function tick() {
      if (!again || !again.isConnected) { clearInterval(timer); return; }
      var left = Math.max(0, 60 - Math.floor((Date.now() - st.sentAt) / 1000));
      again.textContent = left ? T('resendIn', { s: left }) : T('resend');
      again.disabled = left > 0 || st.busy;
      if (!left) clearInterval(timer);
    }
    function render() {
      if (!alive || !card.isConnected) return;
      card.innerHTML = ''; again = null;
      if (!o.page) card.appendChild(sheetHandle(card));
      var title = st.step === 'signed' ? (o.page ? T('signedInTitle') : T('account')) : st.step === 'code' ? T('codeTitle') : st.step === 'name' ? T('nameTitle') : st.step === 'password' ? T('signIn') : (o.page ? T('signInTitle') : o.title || T('signIn'));
      if (o.page) card.appendChild(h('div', { class: 'mark', 'aria-hidden': 'true' }, STAR_SVG));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(title)));
      if (st.step === 'loading') { card.appendChild(h('div', { class: 'muted' }, esc(T('connecting')) + '…')); return; }
      var err = st.err ? h('div', { class: 'err', id: 'acct-err', role: 'alert' }, esc(st.err)) : null;
      if (st.step === 'signed') {
        card.appendChild(h('div', { class: 'acct-who', id: 'acct-who' }, boldVar('signedInAs', 'email', (st.acct && st.acct.email) || '')));
        if (!o.page) card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('signedSub'))));
        if (!o.page) methodsBlock(card);
        if (err) card.appendChild(err);
        if (o.page) { card.appendChild(btn('primary', T('cont'), o.onDone, 'btn-acct-done')); return; }
        var so = btn('secondary danger', T('signOut'), signOut, 'btn-signout'); so.disabled = st.busy;
        card.appendChild(row([so, btn('primary', T('done'), o.onDone, 'btn-acct-done')]));
        return;
      }
      if (st.step === 'name') { focus(nameForm(card, o.onDone)); return; }
      if (st.step === 'form') {
        card.appendChild(h('div', { class: 'dlg-sub' }, esc(o.page ? T('signInPageSub') : o.sub || T('signInSub'))));
        var form = h('form', { class: 'acct-form', novalidate: '' });
        var inp = h('input', { type: 'email', class: 'acct-input', id: 'acct-email', name: 'email', autocomplete: 'email', inputmode: 'email',
          autocapitalize: 'off', spellcheck: 'false', placeholder: 'you@example.com', 'aria-label': T('emailLabel') });
        inp.value = st.email;
        form.appendChild(inp);
        if (err) form.appendChild(err);
        var go2 = h('button', { type: 'submit', class: 'primary', id: 'btn-send-code' }, esc(st.busy ? T('sending') + '…' : T('sendCode')));
        go2.disabled = st.busy;
        form.appendChild(o.page ? go2 : row([btn('secondary', T('cancel'), o.onCancel), go2]));
        form.addEventListener('submit', function (e) { e.preventDefault(); sendCode(inp.value); });
        card.appendChild(form);
        if (appleShown() || googleShown()) card.appendChild(h('div', { class: 'acct-or' }, esc(T('or'))));
        if (appleShown()) {
          var ab = btn('secondary a-btn', T('continueApple'), apple, 'btn-apple'); ab.disabled = st.busy;
          ab.innerHTML = APPLE_LOGO + '<span>' + esc(T('continueApple')) + '</span>';
          card.appendChild(row([ab]));
        }
        if (googleShown()) {
          var gb = btn('secondary g-btn', T('continueGoogle'), google, 'btn-google'); gb.disabled = st.busy;
          gb.innerHTML = GOOGLE_G + '<span>' + esc(T('continueGoogle')) + '</span>';
          var grow = row([gb]);
          card.appendChild(grow);
          if (!st.busy) gsiButton(grow, gb); // on the website: Google's own button (see gsiLoad)
        }
        // the emails about their games: ticked from the start, one tap to untick, for whichever way they sign in (sent
        // once the account is saved; every email can stop them too)
        if (mailBox()) {
          var opt = h('label', { class: 'acct-opt', id: 'acct-opt' }, '<input type="checkbox" id="acct-opt-box"' + (st.opt ? ' checked' : '') + '><span>' + esc(T('emailOptLabel')) + '</span>');
          // kept at once too: Google's own button on the website signs in without going through google() below
          save('emailOptPending', !!st.opt);
          opt.querySelector('input').addEventListener('change', function (e) { st.opt = !!e.target.checked; save('emailOptPending', st.opt); });
          card.appendChild(opt);
        }
        if (o.page) {
          var alt = h('div', { class: 'signin-alt' }, esc(T('practise')) + ' ');
          alt.appendChild(btn('linkbtn', T('playTheBot'), function () { save('pending', null); go('bots'); }, 'btn-signin-bot'));
          card.appendChild(alt);
        }
        if (!st.busy) focus(inp);
        return;
      }
      if (st.step === 'password') {
        // the stores' review account: a password instead of a code by email
        card.appendChild(h('div', { class: 'dlg-sub' }, boldVar('pwSub', 'email', st.email)));
        var pf = h('form', { class: 'acct-form', novalidate: '' });
        var pinp = h('input', { type: 'password', class: 'acct-input', id: 'acct-password', name: 'password', autocomplete: 'current-password',
          autocapitalize: 'off', spellcheck: 'false', 'aria-label': T('pwLabel'), placeholder: T('pwLabel') });
        pinp.disabled = st.busy;
        pf.appendChild(pinp);
        if (err) pf.appendChild(err);
        var pgo = h('button', { type: 'submit', class: 'primary', id: 'btn-password' }, esc(st.busy ? T('checking') + '…' : T('signIn')));
        pgo.disabled = st.busy;
        pf.appendChild(pgo);
        pf.addEventListener('submit', function (e) { e.preventDefault(); passwordSignIn(pinp.value); });
        card.appendChild(pf);
        card.appendChild(btn('linkbtn', T('otherEmail'), function () { st.step = 'form'; st.err = ''; render(); }, 'btn-other-email'));
        if (!st.busy) focus(pinp);
        return;
      }
      // the code from the email
      card.appendChild(h('div', { class: 'dlg-sub' }, boldVar('codeSub', 'email', st.email)));
      if (st.existing) card.appendChild(h('div', { class: 'dlg-note', id: 'acct-existing' }, esc(T('existingNote'))));
      var cinp = h('input', { type: 'text', class: 'acct-input code', id: 'acct-code', name: 'code', inputmode: 'numeric', pattern: '[0-9]*',
        autocomplete: 'one-time-code', maxlength: '10', spellcheck: 'false', placeholder: new Array(OTP_LEN + 1).join('•'), 'aria-label': T('codeTitle') });
      cinp.value = st.code;
      cinp.disabled = st.busy;
      cinp.addEventListener('input', function () {
        var v = cinp.value.replace(/\D/g, '');
        if (v !== cinp.value) cinp.value = v;
        st.code = v;
        if (v.length === OTP_LEN) verify(v);
      });
      card.appendChild(cinp);
      if (err) card.appendChild(err);
      again = btn('secondary', T('resend'), function () { sendCode(st.email); }, 'btn-resend');
      var ok = btn('primary', st.busy ? T('checking') + '…' : T('confirm'), function () { verify(cinp.value.replace(/\D/g, '')); }, 'btn-verify');
      ok.disabled = st.busy;
      card.appendChild(row([again, ok]));
      card.appendChild(btn('linkbtn', T('otherEmail'), function () { st.step = 'form'; st.err = ''; st.code = ''; clearInterval(timer); render(); }, 'btn-other-email'));
      tick();
      if (!st.busy) focus(cinp);
    }
    function sendCode(email) {
      email = String(email || '').trim();
      if (st.busy) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { st.email = email; st.err = T('emailInvalid'); render(); return; }
      if (NETCFG && NETCFG.reviewEmail && email.toLowerCase() === NETCFG.reviewEmail) { st.email = email; st.err = ''; st.step = 'password'; render(); return; }
      st.busy = true; st.err = ''; st.email = email; render();
      optPending();
      ensureNet().then(function () { return net.account(); }).then(function (a) {
        if (a && a.guest) {
          // a guest: the email is added to this same account, so the name, rating and games stay
          return net.linkEmail(email).then(function () { return { type: 'email_change', existing: false }; }, function (e) {
            if (!/email_exists|already.*(registered|exists)/i.test(String(e && (e.code || e.message)))) throw e;
            // the email has its own account: sign in to that one instead
            if (liveOnlineGame()) { var f = new Error('finish'); f.code = 'finish'; throw f; }
            return net.signInEmail(email, false).then(function () { return { type: 'email', existing: hasProgress() }; });
          });
        }
        return net.signInEmail(email, true).then(function () { return { type: 'email', existing: false }; });
      }).then(function (r) {
        if (!alive) return;
        st.busy = false; st.step = 'code'; st.type = r.type; st.existing = r.existing; st.sentAt = Date.now(); st.code = ''; render();
        clearInterval(timer); timer = setInterval(tick, 1000);
      }, function (e) { if (!alive) return; st.busy = false; st.err = e && e.code === 'finish' ? T('finishFirst') : authMsg(e); render(); });
    }
    function verify(code) {
      if (st.busy || code.length < 6) return;
      st.busy = true; st.err = ''; st.code = code; render();
      net.verifyCode(st.email, code, st.type).then(function () {
        clearInterval(timer);
        if (st.type === 'email_change') {
          // the same account, now with an email: nothing to reload
          return refreshMe().then(function () {
            st.busy = false;
            if (!me || me.guest) { st.code = ''; st.err = T('signInFailed'); render(); return; } // the account didn't change after all
            st.acct = { email: me.email || st.email, guest: false };
            toast(o.page ? T('signedInAs', { email: st.acct.email }) : T('progressSaved')); renderAll();
            if (!nameChosen()) { st.step = 'name'; render(); return; } // their own name instead of the made-up one
            if (o.page) { o.onDone(); return; }
            st.step = 'signed'; render();
          });
        }
        // another account: start over as that player
        save('online', null); save('notice', 'signedIn'); setUrl(null); // don't reopen the previous player's game
        location.reload();
      }).catch(function (e) { if (!alive) return; st.busy = false; st.code = ''; st.err = authMsg(e); render(); });
    }
    function passwordSignIn(pw) {
      if (st.busy || !pw) return;
      if (liveOnlineGame()) { st.err = T('finishFirst'); render(); return; }
      st.busy = true; st.err = ''; render();
      ensureNet().then(function () { return net.signInPassword(st.email, pw); }).then(function () {
        // another account: start over as that player (as after a code for an existing account)
        save('online', null); save('notice', 'signedIn'); setUrl(null);
        location.reload();
      }).catch(function (e) {
        if (!alive) return;
        st.busy = false;
        st.err = /invalid_credentials|invalid login|invalid_grant/i.test(String(e && (e.code || e.message))) ? T('pwWrong') : authMsg(e);
        render();
      });
    }
    // the ways to sign in to this account: what is connected, and Google / Apple to connect (one person, one account)
    function methodsBlock(into) {
      var box = h('div', { class: 'acct-methods', id: 'acct-methods' });
      box.appendChild(h('div', { class: 'am-title' }, esc(T('methodsTitle'))));
      into.appendChild(box);
      function rows(list) {
        box.querySelectorAll('.am-row').forEach(function (r) { r.remove(); });
        var by = {};
        (list || []).forEach(function (m) { (by[m.provider] = by[m.provider] || []).push(m.email || ''); });
        [['email', 'mEmail', null], ['google', 'mGoogle', googleShown() ? google : null], ['apple', 'mApple', appleShown() ? apple : null]].forEach(function (x) {
          var on = by[x[0]], can = x[2];
          if (!on && !can) return;
          var mail = on ? on.map(function (e) { return /privaterelay\.appleid\.com$/i.test(e) ? T('mHidden') : e; }).filter(Boolean).join(', ') : '';
          var r = h('div', { class: 'am-row', id: 'am-' + x[0] }, '<span class="am-name">' + esc(T(x[1])) + (mail ? '<span class="am-mail">' + esc(mail) + '</span>' : '') + '</span>');
          if (on) r.appendChild(h('span', { class: 'am-on' }, esc(T('mOn'))));
          else { var b = btn('linkbtn am-connect', T('mConnect'), function () { st.connect = true; can(); }, 'btn-connect-' + x[0]); b.disabled = st.busy; r.appendChild(b); }
          box.appendChild(r);
        });
      }
      rows(st.methods);
      ensureNet().then(function () { return net.methods(); }).then(function (list) { st.methods = list; if (box.isConnected) rows(list); }, function () { /* ignore */ });
    }
    function signOut() {
      if (liveOnlineGame()) { st.err = T('finishFirst'); render(); return; }
      st.busy = true; render();
      doSignOut(function (e) { st.busy = false; st.err = authMsg(e); render(); });
    }
    // the answer in the box goes to the server once the account is saved (syncPrefs): yes, or a no if they unticked it
    function optPending() {
      if (!mailBox()) return;
      save('emailOptPending', !!st.opt); Track.event('email_opt', { on: !!st.opt, where: 'save' });
    }
    function apple() {
      if (st.busy) return;
      optPending();
      st.busy = true; st.err = ''; render();
      var connect = !!st.connect; st.connect = false;
      appleSignIn(connect).then(function () { if (alive) { st.busy = false; render(); } }, function (e) {
        // the sheet closed without signing in (cancelled): nothing to say
        st.busy = false; st.err = /cancel|1001|AuthorizationError/i.test(String(e && (e.code || e.message))) ? '' : authMsg(e); render();
      });
    }
    function google() {
      if (st.busy) return;
      optPending();
      st.busy = true; st.err = ''; render();
      // Google's sign-in page (the page leaves for it here; in the app the system browser opens over the page) answers
      // through google.html; providerIdToken then links Google to this guest or signs in (see googleRedirect)
      var connect = !!st.connect; st.connect = false;
      ensureNet().then(function () { return googleRedirect(connect); })
        .then(function () { if (NATIVE.on && alive) { st.busy = false; render(); } }, function (e) { st.busy = false; st.err = authMsg(e); render(); });
    }
    return { stop: function () { alive = false; clearInterval(timer); } };
  }
  // deleting the account (the stores ask for it inside the app): asked once more, then the page starts over as a guest
  function confirmDeleteAccount() {
    if (liveOnlineGame()) { toast(T('finishFirst')); return; }
    openDialog(function (card) {
      currentDialog.dataset.kind = 'delete';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('deleteQ'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('deleteSub', { email: (me && me.email) || '' }).replace(' ()', ''))));
      // a subscription bought in an app is the store's to stop: deleting the account here does not end it
      var shop = PRO && !PROTO_PRO && isPro() && !proFounder() ? proVia() : null;
      if (shop === 'apple' || shop === 'google') card.appendChild(h('div', { class: 'dlg-note', id: 'delete-store' }, esc(PX('delStore_' + shop))));
      var er = h('div', { class: 'err', id: 'delete-err', role: 'alert' });
      var row = h('div', { class: 'row-btns' });
      var n = h('button', { class: 'secondary', type: 'button' }, esc(T('cancel')));
      var y = h('button', { class: 'secondary danger', type: 'button', id: 'btn-delete-confirm' }, esc(T('deleteAcct')));
      n.addEventListener('click', closeDialog);
      y.addEventListener('click', function () {
        y.disabled = n.disabled = true; er.textContent = '';
        ensureNet().then(function () { return net.deleteAccount(); }).then(function () {
          return net.signOut().catch(function () { /* the account is gone already */ });
        }).then(function () {
          save('online', null); save('notice', 'deleted'); save('pending', null); save('nameLater', null); save('reviewSums', {}); setUrl(null);
          location.hash = 'play'; location.reload();
        }, function (e) {
          y.disabled = n.disabled = false;
          er.textContent = e && e.data && e.data.error === 'live_game' ? T('finishFirst') : e && e.data && e.data.error === 'active_subscription' && PRO ? PX('delSub') : T('netError');
        });
      });
      row.appendChild(n); row.appendChild(y); card.appendChild(row); card.appendChild(er);
    });
  }
  function doSignOut(onErr) {
    net.signOut().then(function () { save('online', null); save('notice', 'signedOut'); save('pending', null); setUrl(null); location.hash = 'play'; location.reload(); }, onErr);
  }

  // ---- the player's own name. A made-up one (SharpGambit43) is only for guests: after every sign-in the player is
  // asked for their name until they pick one (keeping the made-up one counts), and Profile can change it any time.
  // An older server doesn't say (name_chosen missing): then nothing is asked.
  function nameChosen() { return !me || !me.profile || me.profile.name_chosen !== false; }
  // the name on the Google account, if it fits the rules (2-20 letters, digits, spaces, _ or -)
  function nameHint() {
    var g = String((me && me.gname) || '').replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
    if (g.length > 20) g = g.split(' ')[0];
    return g.length >= 2 && g.length <= 20 ? g : '';
  }
  // the form itself (sign-in page, account dialog, name dialog); done() once saved. Returns the field.
  function nameForm(card, done) {
    card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('nameSub'))));
    if (me && me.email) card.appendChild(h('div', { class: 'dlg-note name-acct', id: 'name-acct' }, esc(T('nameAcct', { email: me.email }))));
    var f = h('form', { class: 'acct-form', novalidate: '' });
    var inp = h('input', { type: 'text', class: 'acct-input', id: 'acct-name', maxlength: '20', autocomplete: 'nickname', autocapitalize: 'words',
      spellcheck: 'false', placeholder: T('namePh'), 'aria-label': T('nameTitle') });
    inp.value = nameChosen() && me && me.profile ? me.profile.username : nameHint();
    var er = h('div', { class: 'err', id: 'acct-err', role: 'alert' }); er.hidden = true;
    var sv = h('button', { type: 'submit', class: 'primary', id: 'btn-name' }, esc(T('save')));
    f.appendChild(inp); f.appendChild(er); f.appendChild(sv); card.appendChild(f);
    function fail(msg) { er.textContent = msg; er.hidden = false; inp.disabled = false; sv.disabled = false; try { inp.focus(); } catch (e) { /* ignore */ } }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sv.disabled) return;
      var name = inp.value.replace(/\s+/g, ' ').trim();
      if (!name) { fail(T('nameEmpty')); return; }
      if (nameChosen() && me && me.profile && name === me.profile.username) { done(); return; }
      inp.disabled = true; sv.disabled = true; er.hidden = true;
      ensureNet().then(function () { return net.call('rename', { name: name }); }).then(function (r) { me.profile = r.profile; done(); }, function (x) {
        var c = x && x.data && x.data.error;
        fail(c === 'name_taken' ? T('nameTaken') : c === 'bad_name' ? T('badName') : T('netError'));
      });
    });
    return inp;
  }
  // as a dialog; then(): what comes next (the action that waited for the sign-in), after saving or closing it.
  // Closed without saving: not asked again when the page opens, only at the next sign-in (and Profile has it).
  var nameAsked = false;
  function askName(then) {
    nameAsked = true;
    var saved = false, over = false;
    openDialog(function (card) {
      currentDialog.dataset.kind = 'name';
      currentDialog.onClose = function () {
        if (over) return; over = true;
        if (!saved && me) save('nameLater', me.uid);
        if (then) then();
      };
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('nameTitle'))));
      var inp = nameForm(card, function () {
        saved = true; save('nameLater', null);
        if (curView !== 'game' && curView !== 'signin') refreshView();
        closeDialog();
      });
      setTimeout(function () { if (inp.isConnected) try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    });
  }
  // right after a sign-in: off the sign-in page, the name (unless they have their own), then what they were doing
  function signedInNext() {
    if (curView === 'signin') go('play', true);
    function next() { var a = takePending(); if (a) runPending(a); }
    if (signedIn() && !nameChosen()) askName(next); else next();
  }
  // opening the site already signed in, with a made-up name: ask once (not over a game or another dialog)
  function maybeAskName() {
    if (nameAsked || !signedIn() || nameChosen() || currentDialog || curView === 'game' || curView === 'signin' || load('nameLater', '') === me.uid) return;
    askName();
  }

  // ---- Google, without the Supabase address. Google only ever talks to joker-chess.com, so its pages name
  // joker-chess.com (the redirect through Supabase showed the Supabase project's address), and the session comes
  // from Google's ID token (Supabase checks it against our nonce):
  //  - the website: Google's own button (Google Identity Services);
  //  - the app (Google refuses sign-in inside an app's web view), and the website if Google's script can't load:
  //    Google's sign-in page answers to joker-chess.com/google.html, which hands the token back here
  //    (the app: through goldenchess://auth).
  function randHex(n) { var b = crypto.getRandomValues(new Uint8Array(n)), s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function sha256hex(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      var b = new Uint8Array(buf), s = '';
      for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
      return s;
    });
  }
  // Sign in with Apple: the iPhone app, when its shell has the plugin (the first store build hasn't) and Supabase has the
  // provider on (NETCFG.appleAuth). The App Store asks for it next to any other company's sign-in (guideline 4.8), so
  // Google is offered on iPhone only beside it; an older iPhone build has the code by email alone (same account either way).
  function appleShown() { return !!(NETCFG && NETCFG.appleAuth) && NATIVE.on && NATIVE.platform === 'ios' && NATIVE.has('SignInWithApple'); }
  function googleShown() { return !!(NETCFG && NETCFG.googleAuth) && (!(NATIVE.on && NATIVE.platform === 'ios') || appleShown()); }
  // the Apple sheet (native): Apple signs an ID token with our hashed nonce; Supabase gets the raw one, as with Google
  function appleSignIn(connect) {
    var raw = randHex(16);
    return sha256hex(raw).then(function (hashed) {
      return NATIVE.call('SignInWithApple', 'authorize', { clientId: 'com.kozyramedia.goldenchess', redirectURI: location.origin + '/', scopes: 'email name', state: randHex(8), nonce: hashed });
    }).then(function (r) {
      var a = r && r.response;
      if (!a || !a.identityToken) { var e = new Error('cancelled'); e.code = 'cancelled'; throw e; }
      var name = [a.givenName, a.familyName].filter(Boolean).join(' ');
      providerIdToken('apple', a.identityToken, raw, name || '', connect);
    });
  }
  function googleOn() { return !!(NETCFG && NETCFG.googleAuth && NETCFG.googleClientId && NETCFG.mock == null) && !!(window.crypto && crypto.subtle && window.TextEncoder); }
  var gsi = null; // { ready: Promise of google.accounts.id, nonce: the raw nonce for Supabase, failed }
  function gsiLoad() {
    if (gsi) return gsi.ready;
    var raw = randHex(16);
    gsi = { nonce: raw };
    gsi.ready = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () { if (window.google && google.accounts && google.accounts.id) res(); else rej(new Error('gsi')); };
      s.onerror = function () { rej(new Error('gsi')); };
      setTimeout(function () { rej(new Error('gsi')); }, 12000);
      document.head.appendChild(s);
    }).then(function () { return sha256hex(raw); }).then(function (hashed) {
      google.accounts.id.initialize({ client_id: NETCFG.googleClientId, callback: gsiCredential, nonce: hashed, context: 'signin', ux_mode: 'popup',
        auto_select: false, use_fedcm_for_button: true });
      return google.accounts.id;
    });
    gsi.ready.catch(function () { gsi.failed = true; });
    return gsi.ready;
  }
  // the website: Google's button in place of ours (fb), once Google's script is there
  function gsiButton(slot, fb) {
    if (NATIVE.on || !googleOn() || (gsi && gsi.failed)) return;
    fb.style.visibility = 'hidden';
    gsiLoad().then(function (id) {
      if (!slot.isConnected) return;
      var box = h('div', { class: 'gsi-box', id: 'gsi-box' });
      slot.replaceChild(box, fb);
      id.renderButton(box, { type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center',
        width: Math.max(200, Math.min(400, Math.round(slot.clientWidth || 320))), locale: lang === 'ru' ? 'ru' : 'en' });
    }, function () { fb.style.visibility = ''; });
  }
  function gsiCredential(resp) { if (resp && resp.credential && gsi) providerIdToken('google', resp.credential, gsi.nonce); }
  // our button (the app; the website without Google's script): Google's sign-in page, answering to google.html.
  // The state says where the answer goes on (a: the app, w: this site, after the dot the ?p= profile); the nonce stays here.
  // Google answers to google.html on the address this page came from (golden-chess.com today, joker-chess.com after the
  // move; both are authorised redirect URIs of the Google client), so a sign-in never crosses to the other address
  function googleReturn() {
    var m = /^(?:www\.)?((?:joker|golden)-chess\.com)$/i.exec(location.hostname);
    return m ? 'https://' + m[1].toLowerCase() + '/google.html' : NETCFG.googleReturn;
  }
  function googleRedirect(connect) {
    if (!googleOn()) return Promise.reject(new Error('unsupported'));
    var raw = randHex(16), st = (NATIVE.on ? 'a' : 'w') + randHex(8) + (profileSuffix ? '.' + profileSuffix : '');
    save('gFlow', { nonce: raw, state: st, at: Date.now(), connect: !!connect });
    return sha256hex(raw).then(function (hashed) {
      var u = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(NETCFG.googleClientId) +
        '&redirect_uri=' + encodeURIComponent(googleReturn()) + '&response_type=id_token&scope=' + encodeURIComponent('openid email profile') +
        '&nonce=' + hashed + '&state=' + encodeURIComponent(st) + '&prompt=select_account';
      if (NATIVE.on) return NATIVE.openUrl(u);
      location.assign(u);
    });
  }
  // the answer from google.html: only for the sign-in started here (same state, not stale); cancelled: nothing to say
  function googleIdReturn(get) {
    var f = load('gFlow', null), st = get('g_state'), tok = get('g_id_token'), err = get('g_error');
    if (!f || f.state !== st || Date.now() - f.at > 30 * 60000) { toast(T('signInFailed')); return; }
    save('gFlow', null);
    if (err || !tok) { if (err !== 'access_denied') toast(T('signInFailed')); return; }
    providerIdToken('google', tok, f.nonce, '', !!f.connect);
  }
  // the provider account (or its email) already belongs to another player
  function methodTaken(e) { return /email_exists|identity_already_exists/.test(String(e && e.code)) || /already (been )?(registered|linked)/i.test(String(e && e.message)); }
  // Google or Apple answered with an ID token: a guest gets the provider on the same account (rating and games stay);
  // if that provider account (or its email) already has a player, sign in to that player instead, as with an email code
  function providerIdToken(provider, tok, nonce, fullName, connect) {
    toast(T('connecting') + '…');
    if (connect) { connectMethod(provider, tok, nonce); return; }
    ensureNet().then(function () { return net.account(); }).then(function (a) {
      if (a && a.guest) {
        return net.idToken(provider, tok, nonce, true).then(function () { return 'same'; }, function (e) {
          if (!methodTaken(e)) throw e;
          if (liveOnlineGame()) { var f = new Error('finish'); f.code = 'finish'; throw f; }
          return net.idToken(provider, tok, nonce, false).then(function () { return 'other'; });
        });
      }
      return net.idToken(provider, tok, nonce, false).then(function () { return 'other'; });
    }).then(function (how) {
      if (fullName) return net.setFullName(fullName).then(function () { return how; }, function () { return how; });
      return how;
    }).then(function (how) {
      // another player: start over as that one (as after an email code for another account)
      if (how === 'other') { save('online', null); save('notice', 'signedIn'); setUrl(null); location.reload(); return; }
      Track.event('login', { method: provider });
      return refreshMe().then(function () {
        if (currentDialog && currentDialog.dataset.kind === 'account') closeDialog();
        toast(T('signedInAs', { email: (me && me.email) || '' }));
        renderAll();
        if (curView !== 'game' && curView !== 'signin') refreshView();
        signedInNext();
      });
    }).catch(function (e) { toast(e && e.code === 'finish' ? T('finishFirst') : T('signInFailed')); });
  }
  // a signed-in player connects Google / Apple from the account sheet: linked to this account, or (the same person's
  // other account) the two made one; a different account kept: start over as that one
  function connectMethod(provider, tok, nonce) {
    var was = me && me.uid;
    ensureNet().then(function () {
      if (liveOnlineGame()) { var f = new Error('live_game'); f.code = 'live_game'; throw f; }
      return net.connectId(provider, tok, nonce);
    }).then(function (r) {
      if (r.merged && r.keep !== was) { save('online', null); save('notice', 'merged'); setUrl(null); location.reload(); return; }
      return refreshMe().then(function () {
        toast(r.merged ? T('accountsMerged') : T('methodLinked', { p: provider === 'apple' ? 'Apple' : 'Google' }));
        if (currentDialog && currentDialog.dataset.kind === 'account') { closeDialog(); showAccount(); }
        renderAll();
        if (curView !== 'game' && curView !== 'signin') refreshView();
      });
    }).catch(function (e) {
      var live = e && (e.code === 'live_game' || (e.data && e.data.error === 'live_game') || /live_game/.test(String(e.message)));
      toast(live ? T('mergeLive') : T('signInFailed'));
    });
  }
  // Back from the link in a sign-in email: supabase-js has already taken the session (or the error) from the
  // address. Tidy the address and say what happened.
  var AUTH_HASH = /(access_token|error_code|error_description)=/;
  function authReturn() {
    var hsh = location.hash || '';
    if (!AUTH_HASH.test(hsh)) return false;
    var q;
    try { q = new URLSearchParams(hsh.replace(/^#/, '')); } catch (e) { return false; }
    var err = q.get('error_code') || q.get('error'), desc = q.get('error_description') || '', type = q.get('type') || '';
    // an error comes in the query too (?error=…#error=…): keep only the rest of the query (?p=)
    var rest = (location.search || '').replace(/^\?/, '').split('&').filter(function (kv) { return kv && !/^error(_code|_description)?=/.test(kv); }).join('&');
    ensureNet().then(function () {
      try { history.replaceState({ v: curView }, '', location.pathname + (rest ? '?' + rest : '') + '#' + (curView || 'play')); } catch (e) { /* ignore */ }
      if (err) toast(/expired|invalid/i.test(err + ' ' + desc) ? T('linkExpired') : T('signInFailed'));
      else if (me && !me.guest) {
        toast(type === 'email_change' ? T('progressSaved') : T('signedInAs', { email: me.email || '' }));
        signedInNext();
      }
      renderAll(); if (curView !== 'game') refreshView();
    }, function () { toast(T('netError')); });
    return true;
  }

  // ---- the app: what the system browser sends back (goldenchess://auth: Google's ID token from google.html, or the
  // session from a sign-in email's link), the Android back button, the splash screen
  var nativeSeen = {};
  // a joker-chess.com (or old golden-chess.com) link opened the app (iOS universal link / Android app link): open that page here, as the browser
  // would have: an invite, a game, a sign-in link. Pages that are only documents (privacy, support) open in the browser
  function siteLink(url, launch) {
    var m = /^https:\/\/(?:www\.)?(?:joker|golden)-chess\.com(\/[^?#]*)?([?#].*)?$/i.exec(url);
    if (!m) return false;
    var path = m[1] || '/', rest = m[2] || '';
    if (/^\/(privacy|support|google)/i.test(path)) { NATIVE.call('Browser', 'open', { url: url }).catch(function () { /* ignore */ }); return true; }
    var mark = url.slice(-80);
    // the launch address stays the same for the whole run of the app: after the reload below it is not taken again
    if (launch && load('nativeLink', '') === mark) return true;
    save('nativeLink', mark);
    if (!rest || rest === '#' || rest === '?') return true; // the bare site: the app is already it
    location.href = location.origin + '/' + rest;
    return true;
  }
  function nativeUrl(url, launch) {
    url = String(url || '');
    var inv = /^goldenchess:\/\/auth\/?\?(join|game)=([A-Za-z0-9-]+)/i.exec(url);
    if (inv) url = 'https://joker-chess.com/?' + inv[1] + '=' + inv[2]; // siteLink keeps only the part after the host
    if (siteLink(url, launch)) return;
    if (!/^goldenchess:\/\/auth/i.test(url)) return;
    var mark = url.slice(-60), now = Date.now();
    // one opening can arrive twice (as the launch address and as an event); and the launch address stays the
    // same for the whole run of the app, so after a reload it is not taken again
    if (nativeSeen[mark] && now - nativeSeen[mark] < 5000) return;
    if (launch && load('nativeAuth', '') === mark) return;
    nativeSeen[mark] = now; save('nativeAuth', mark);
    NATIVE.call('Browser', 'close').catch(function () { /* Android closes it by itself */ });
    var i = url.indexOf('#'), j = url.indexOf('?'), hp, qp;
    try { hp = new URLSearchParams(i >= 0 ? url.slice(i + 1) : ''); qp = new URLSearchParams(j >= 0 ? url.slice(j + 1, i > j ? i : url.length) : ''); } catch (e) { return; }
    function g(k) { return hp.get(k) || qp.get(k) || ''; }
    var at = g('access_token'), rt = g('refresh_token'), err = g('error_code') || g('error'), desc = g('error_description'), type = g('type');
    if (!NETCFG || NETCFG.mock != null) return;
    if (g('g_state')) { googleIdReturn(g); return; } // Google (see googleRedirect)
    if (err) {
      toast(/expired|invalid/i.test(err + ' ' + desc) ? T('linkExpired') : T('signInFailed'));
      return;
    }
    if (!at || !rt) return;
    var before = net && net.uid;
    try { getClient(); } catch (e) { return; }
    net.sb.auth.setSession({ access_token: at, refresh_token: rt }).then(authFail).then(function (d) {
      var u = d && (d.user || (d.session && d.session.user)), uid = u && u.id;
      if (!before || uid !== before) {
        // another account: start over as that player (as after an email code for another account)
        save('online', null); save('notice', 'signedIn'); setUrl(null); location.reload();
        return;
      }
      // the same player, now with Google or a confirmed email: nothing to reload
      return refreshMe().then(function () {
        if (currentDialog && currentDialog.dataset.kind === 'account') closeDialog();
        toast(type === 'email_change' ? T('progressSaved') : T('signedInAs', { email: (me && me.email) || '' }));
        renderAll();
        if (curView !== 'game' && curView !== 'signin') refreshView();
        signedInNext();
      });
    }).catch(function () { toast(T('signInFailed')); });
  }
  function nativeBack(e) {
    if (currentDialog) { closeDialog(); return; }
    if (curView === 'game' && goldenArmed) { setGoldenArmed(false); return; }
    if (e && e.canGoBack) { history.back(); return; }
    if (curView !== 'play') { go('play', true); return; }
    NATIVE.call('App', 'minimizeApp').catch(function () { /* ignore */ });
  }
  function nativeInit() {
    if (!NATIVE.on) return;
    var de = document.documentElement;
    de.classList.add('native', NATIVE.platform === 'android' ? 'android' : 'ios');
    // an app doesn't zoom: no zoom on a focused field, no pinch over the board
    var vp = document.querySelector('meta[name=viewport]');
    if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    NATIVE.listen('App', 'appUrlOpen', function (e) { nativeUrl(e && e.url); });
    NATIVE.call('App', 'getLaunchUrl').then(function (r) { if (r && r.url) nativeUrl(r.url, true); }, function () { /* ignore */ });
    if (NATIVE.platform === 'android') NATIVE.listen('App', 'backButton', nativeBack);
    NATIVE.listen('App', 'appStateChange', function (st) { appActive = !st || st.isActive !== false; onVisibility(); });
    NATIVE.call('SplashScreen', 'hide', { fadeOutDuration: 200 }).catch(function () { /* ignore */ });
  }

  // ---- the online game itself
  function leaveOnline() {
    if (!online) return;
    if (online.sub) online.sub.close();
    if (online.peer) online.peer.close();
    clearTimeout(online.peerCheck);
    clearTimeout(online.seenTimer);
    (online.houseTimers || []).forEach(clearTimeout);
    online.houseReq = -1;
    online = null;
    save('online', null);
    setUrl(null);
  }
  // then(): after the game is on screen (the history opens a past game and its review)
  function openOnlineGame(id, then) {
    if (online && online.id === id) { if (then) { go('game'); then(); } return; }
    ensureNet().then(function () { return net.call('game', { game: id }); }).then(function (r) {
      var g = r.game;
      if (then && g.status !== 'waiting') { startOnline(g); then(); return; }
      if (g.status === 'waiting') {
        if (me && g.host_id === me.uid) { stopLobby(); lobby = { kind: 'invite', tc: (g.tc_base / 60000) + '+' + (g.tc_inc / 1000), rated: g.rated, t0: perf(), timer: 0, tick: 0, gameId: null }; showLobbyDialog(); watchInvite(lobby, g.id); }
        else joinGame(id);
        return;
      }
      startOnline(g);
    }, function (e) { toast(e && e.data && e.data.error === 'no_game' ? T('noGame') : T('netError')); });
  }
  function joinGame(id) {
    ensureNet().then(function () { return net.call('join', { game: id }); }).then(function (r) {
      if (r.game.status === 'waiting') { openOnlineGame(id); return; }
      startOnline(r.game);
    }, function (e) {
      var d = e && e.data;
      if (fairClosed(e)) { setUrl(null); return; }
      if (d && d.error === 'taken' && d.game && d.game.status === 'aborted') { setUrl(null); toast(T('inviteGone')); return; }
      if (d && d.error === 'taken' && d.game) { startOnline(d.game); toast(T('gameTaken')); return; }
      setUrl(null);
      toast(d && d.error === 'no_game' ? T('noGame') : T('netError'));
    });
  }
  function buildOnlineGame(s, color) {
    var tc = { base: s.tc_base, inc: s.tc_inc, label: (s.tc_base / 60000) + '+' + (s.tc_inc / 1000) };
    var cfg = { mode: 'online', human: color < 0 ? 0 : color, spectator: color < 0, tc: tc, rated: !!s.rated, pool: s.pool,
      names: [s.white_name || T('white'), s.black_name || T('black')], ratings: [s.white_rating, s.black_rating] };
    var g = new Game(cfg, s.start_fen);
    g.online = true; g.onlineId = s.id;
    var clk = g.clock; g.clock = null; // replay without time accounting
    for (var i = 0; i < s.moves.length; i++) { var m = g.pos.moveFromUci(s.moves[i]); if (!m) break; g.play(m, perf()); }
    g.clock = clk;
    return g;
  }
  function startOnline(s) {
    if (!s || !s.id || !me) return;
    if (online && online.id === s.id) { onServerState(s, { force: true }); return; }
    stopLobby(); leaveOnline();
    cancelBot(); bot.cancel(); bot.clear();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion(); lowWarned = false; plyBoards = {};
    explore = null; posCache = {}; stopReview(); review = null;
    if (analysis.on) setAnalysis(false);
    closeDialog();
    var color = s.white_id === me.uid ? 0 : s.black_id === me.uid ? 1 : -1;
    if (color >= 0 && s.status === 'playing' && !(s.moves && s.moves.length)) noteAct('online'); Track.event('game_start', { mode: 'online', rated: !!s.rated, tc: (s.tc_base / 60000) + '+' + (s.tc_inc / 1000), opponent: s.house ? 'house' : 'person' });
    var o = online = { id: s.id, s: null, color: color, pending: null, sub: null, connected: false, lastEvent: perf(), oppHere: s.house ? true : null,
      claimBusy: false, claimNext: 0, reading: false, firstSec: -1, peer: null, peerMoves: [], houseAt: -1, houseReq: 0, houseTimers: [],
      seenTimer: 0, awayAt: 0, awaySec: -1, houseAway: false };
    game = buildOnlineGame(s, color);
    view = game.records.length;
    setGoldenArmed(false);
    orient = color === 1 ? 1 : 0;
    board.setOrientation(orient);
    board.sync(game.pos.board, [], { instantAll: true });
    var opp = color === 0 ? s.black_id : s.white_id;
    if (color >= 0 && opp) loadMatch(o, opp);
    var ids = [s.white_id, s.black_id].filter(Boolean);
    if (ids.length && net.profilesOf) net.profilesOf(ids).then(function (rows) { noteAvatars(rows); if (online === o) renderBars(); }, function () { /* initials then */ });
    o.sub = net.sub('g:' + s.id, {
      event: function (ev, p) { if (ev === 'state' && online === o) { o.lastEvent = perf(); onServerState(p); } },
      status: function (st) { if (online !== o) return; var was = o.connected; o.connected = st === 'SUBSCRIBED'; if (o.connected && !was) resyncOnline(); },
      presence: function (keys) { if (online !== o || color < 0) return; setOppHere(o, keys.indexOf(opp) >= 0 || (!!(o.s && o.s.house) && !o.houseAway)); },
      hidden: hiddenNow
    });
    // moves straight from the other player (shown at once; the server's state on g: stays the authority)
    o.peer = net.sub('m:' + s.id, { event: function (ev, p) { if (ev === 'move' && online === o) onPeerMove(p); } });
    onServerState(s, { force: true, initial: true });
    if (game.status === 'playing') Sound.play('start');
    seenLoop(o);
    save('online', { id: s.id });
    setUrl('game', s.id);
    go('game');
    renderAll(); layout();
  }
  function rebuildOnline(s) {
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion(); plyBoards = {}; posCache = {};
    explore = null;
    game = buildOnlineGame(s, online.color);
    view = game.records.length;
    if (goldenArmed) setGoldenArmed(false);
    board.sync(game.pos.board, []);
    online.pending = null; online.housePending = null;
  }
  // bring the local game in line with a server state
  // a local move the server hasn't confirmed yet: ours on its way, or the opponent's seen peer-to-peer
  function unconfirmed(ply, uci) {
    var o = online, i;
    if (o.pending && o.pending.ply === ply && o.pending.uci === uci) return true;
    if (o.housePending && o.housePending.ply === ply && o.housePending.uci === uci) return true;
    for (i = 0; i < o.peerMoves.length; i++) { var x = o.peerMoves[i]; if (x.ply === ply && x.uci === uci && perf() - x.at < PEER_TTL) return true; }
    return false;
  }
  function reconcileMoves(s, opts) {
    var srv = s.moves || [], recs = game.records, n = recs.length, k = 0, i;
    while (k < srv.length && k < n && srv[k] === recs[k].uci) k++;
    online.peerMoves = online.peerMoves.filter(function (x) { return x.ply >= srv.length; });
    if (k < n) {
      // we have moves the server doesn't: fine while each is still unconfirmed (not refused, not too old)
      if (k === srv.length && !opts.authoritative && s.status === 'playing') {
        for (i = k; i < n && unconfirmed(i, recs[i].uci); i++) { /* check all */ }
        if (i === n) return;
      }
      rebuildOnline(s); return;
    }
    if (srv.length === n) return;
    if (srv.length === n + 1 && game.status === 'playing') {
      var m = game.pos.moveFromUci(srv[n]);
      if (m) { commit(m, false, 'opp'); return; }
    }
    rebuildOnline(s);
  }
  function syncClock(s) {
    if (!game.clock) return;
    game.clock.t = [s.clock_w, s.clock_b];
    var el = s.status === 'playing' && s.moves.length >= 2 && s.turn_started_at ? Math.max(0, serverNow() - Date.parse(s.turn_started_at)) : 0;
    game.clock.since = perf() - el;
  }
  function onServerState(s, opts) {
    opts = opts || {};
    if (!online || !s || s.id !== online.id || !game || !game.online) return;
    if (online.resigning && s.status === 'playing') return; // our resignation is on its way; its answer decides
    var prev = online.s;
    if (prev && (opts.force ? s.version < prev.version : s.version <= prev.version)) return;
    online.s = s;
    game.cfg.names = [s.white_name || T('white'), s.black_name || T('black')];
    game.cfg.ratings = [s.white_rating, s.black_rating];
    if (s.rematch_game && online.color >= 0 && (!prev || prev.rematch_game !== s.rematch_game) && !opts.initial) { var nx = s.rematch_game; online.s = s; setTimeout(function () { openOnlineGame(nx); }, 0); return; }
    reconcileMoves(s, opts);
    var mine = online.color === 0 ? 'w' : online.color === 1 ? 'b' : null;
    if (game.records.length > (s.moves || []).length) { renderAll(); return; } // our move is on its way; wait for the server
    syncClock(s);
    if (s.status === 'playing') {
      if (game.status !== 'playing') {
        // we had ended the game locally (e.g. a resignation the server never received): back to the real state
        rebuildOnline(s); syncClock(s);
        if (currentDialog && currentDialog.dataset.kind === 'over') closeDialog();
      }
      if (mine && s.draw_offer && s.draw_offer !== mine && (!prev || prev.draw_offer !== s.draw_offer) && !opts.initial) { Sound.play('select'); toast(T('oppOffersDraw', { name: sideLabel(online.color ^ 1) })); }
      if (mine && prev && prev.draw_offer === mine && !s.draw_offer && s.moves.length === prev.moves.length) toast(T('drawDeclined'));
    } else {
      var wasPlaying = game.status === 'playing';
      game.status = 'over';
      game.result = s.status === 'aborted' ? '*' : s.result;
      game.reason = s.status === 'aborted' ? 'abort' : s.reason;
      online.pending = null;
      if (s.rated && s.white_diff != null && (!prev || prev.white_diff == null)) refreshMe();
      if (mine && s.rematch_offer && s.rematch_offer !== mine && (!prev || prev.rematch_offer !== s.rematch_offer) && !opts.initial) { Sound.play('select'); toast(T('oppWantsRematch', { name: sideLabel(online.color ^ 1) })); }
      if (wasPlaying && !opts.initial) { gameOver(); houseCheck(); return; }
    }
    renderAll();
    if (currentDialog && currentDialog.dataset.kind === 'over') showOver();
    houseCheck();
  }
  function resyncOnline() {
    var o = online;
    if (!o || o.reading || !net) return;
    o.reading = true;
    net.read(o.id).then(function (g) { o.reading = false; o.lastEvent = perf(); if (online === o && g) onServerState(g, { force: true }); }, function () { o.reading = false; });
  }
  // ---- fair play: how often this device left the game during the player's own turn in an online game (another window
  // or app in front), and for how long; it goes with the move (the server keeps it apart from the game, for the checks)
  var FairEye = { n: 0, ms: 0, at: 0 };
  function fairAway() { return document.visibilityState === 'hidden' || (typeof document.hasFocus === 'function' && !document.hasFocus()); }
  function fairOwnTurn() { return !!(online && game && game.online && game.status === 'playing' && online.color >= 0 && game.pos.side === online.color && !spectating()); }
  function fairTick() {
    var away = fairAway();
    if (away && !FairEye.at && fairOwnTurn()) { FairEye.n++; FairEye.at = perf(); }
    else if (!away && FairEye.at) { FairEye.ms += perf() - FairEye.at; FairEye.at = 0; }
  }
  function fairTake() {
    var o = { bl: FairEye.n, aw: Math.round(FairEye.ms + (FairEye.at ? perf() - FairEye.at : 0)) };
    FairEye.n = 0; FairEye.ms = 0; FairEye.at = 0;
    return o;
  }
  function sendMove(rec) {
    var f = fairTake();
    var p = { ply: game.records.length - 1, uci: rec.uci, tries: 0, bl: f.bl || undefined, aw: f.aw || undefined };
    online.pending = p;
    if (online.peer && online.peer.send) online.peer.send('move', { ply: p.ply, uci: p.uci });
    pushMove(online, p);
  }
  // the opponent's move, straight from their browser: show it now, let the server confirm it
  function onPeerMove(p) {
    var o = online;
    if (!o || !game || !game.online || game.status !== 'playing' || !p || typeof p.uci !== 'string' || p.ply !== game.records.length) return;
    if (o.color >= 0 && game.pos.side === o.color) return; // only the opponent's move can arrive this way
    var m = game.pos.moveFromUci(p.uci);
    if (!m) return;
    o.peerMoves.push({ ply: p.ply, uci: p.uci, at: perf() });
    o.lastEvent = perf();
    commit(m, false, 'opp');
    // if the server never confirms it (the move was refused or the opponent's request was lost), resync
    clearTimeout(o.peerCheck);
    o.peerCheck = setTimeout(function () {
      if (online === o && o.s && o.s.moves.length <= p.ply && game.records.length > o.s.moves.length) resyncOnline();
    }, PEER_TTL + 300);
  }
  function pushMove(o, p) {
    if (online !== o || o.pending !== p) return;
    net.call('move', { game: o.id, uci: p.uci, ply: p.ply, bl: p.bl, aw: p.aw }).then(function (r) {
      if (online !== o) return;
      if (o.pending === p) o.pending = null;
      onServerState(r.game);
      houseCheck(); // the state may have come by broadcast while the move was pending: the house's turn is taken now
    }, function (e) {
      if (online !== o || o.pending !== p) return;
      var d = e && e.data;
      if (d && d.game) {
        if (d.error === 'conflict' && d.game.status === 'playing' && d.game.moves.length === p.ply && p.tries++ < 4) { pushMove(o, p); return; }
        o.pending = null;
        onServerState(d.game, { force: true, authoritative: true });
        return;
      }
      if (e && e.status === 401) { netReady = null; }
      // network trouble: retry (the server ignores a move it already has: wrong ply)
      if (p.tries++ < 8) setTimeout(function () { pushMove(o, p); }, Math.min(4000, 250 * p.tries));
      else { o.pending = null; resyncOnline(); }
    });
  }
  function onlineAction(action, extra) {
    var o = online;
    if (!o || !net) return Promise.resolve(null);
    return net.call(action, Object.assign({ game: o.id }, extra || {})).then(function (r) {
      if (online === o && r.game) onServerState(r.game);
      if (r.next && online === o) openOnlineGame(r.next);
      return r;
    }, function (e) {
      if (online === o && e && e.data && e.data.game) onServerState(e.data.game, { force: true });
      else toast(T('netError'));
      return null;
    });
  }
  // Resigning (or aborting) shows the result at once; the server confirms it, or corrects it if the game had
  // already ended another way (a flag, a mate) by the time the request arrived.
  function onlineResign() {
    var o = online;
    if (!o || o.color < 0 || !game || game.status !== 'playing' || o.resigning) return;
    var abort = game.records.length < 2;
    o.resigning = true;
    game.freeze(perf());
    game.status = 'over'; game.result = abort ? '*' : (o.color === 0 ? '0-1' : '1-0'); game.reason = abort ? 'abort' : 'resign';
    gameOver();
    (function attempt(n) {
      net.call('resign', { game: o.id }).then(function (r) {
        if (online !== o) return;
        o.resigning = false;
        onServerState(r.game, { force: true });
      }, function (e) {
        if (online !== o) return;
        if (e && e.data && e.data.game) { o.resigning = false; onServerState(e.data.game, { force: true }); return; }
        if (n < 4) { setTimeout(function () { attempt(n + 1); }, 500 * (n + 1)); return; }
        o.resigning = false; toast(T('netError')); resyncOnline();
      });
    })(0);
  }
  function rematchState() {
    var s = online && online.s, mine = game && game.cfg.human === 0 ? 'w' : 'b';
    if (!s) return { label: T('rematch'), disabled: true };
    if (s.rematch_offer && s.rematch_offer !== mine) return { label: T('acceptRematch'), hot: true };
    if (s.rematch_offer === mine) return { label: T('rematchSent'), disabled: true };
    return { label: T('rematch') };
  }
  function rematch() { onlineAction('rematch').then(function () { renderSide(); }); }
  function firstMoveSince(s) { return s.moves.length === 0 ? Date.parse(s.created_at) : Date.parse(s.updated_at); }
  // the app is not in front of the player: a hidden tab, a backgrounded app, a locked screen (tests: window.__gcAway)
  function hiddenNow() { return !!(document.hidden || window.__gcAway) || !appActive; }
  // "I have the game in front of me", every SEEN_MS while it is on; the answer may be the game's end (a side that was
  // quiet for GONE_MS on its own turn has left: the opponent's heartbeat claims the win, a late return learns of the loss)
  function seenLoop(o, last) {
    clearTimeout(o.seenTimer); o.seenTimer = 0;
    if (online !== o || o.color < 0 || !o.s || o.s.status !== 'playing' || !net || (hiddenNow() && !last)) return;
    net.call('seen', { game: o.id }).then(function (r) {
      if (online !== o) return;
      if (r && r.game) onServerState(r.game, { force: true });
      if (!last && !hiddenNow()) o.seenTimer = setTimeout(function () { seenLoop(o); }, SEEN_MS);
    }, function (e) {
      if (online !== o) return;
      var d = e && e.data;
      if (d && d.game) { onServerState(d.game, { force: true }); if (d.error === 'not_player') return; }
      if (e && e.status === 401) netReady = null;
      if (!last && !hiddenNow()) o.seenTimer = setTimeout(function () { seenLoop(o); }, 2000);
    });
  }
  function onVisibility() {
    if (hiddenNow()) { Sound.revive(); planReminders(); } else { noteVisit(); clearShownReminders(); } // the first touch after coming back makes a fresh audio context
    var o = online;
    if (!o) return;
    var hidden = hiddenNow();
    if (o.sub && o.sub.away) o.sub.away(hidden);
    if (hidden) { seenLoop(o, true); return; } // one last "seen now": the moment of leaving, for the countdown the other side sees
    seenLoop(o); resyncOnline();
  }
  function setOppHere(o, here) {
    if (o.oppHere === here) return;
    o.oppHere = here;
    o.awayAt = here ? 0 : perf();
    if (here && o.awaySec >= 0) { o.awaySec = -1; renderAna(); }
    renderBars();
  }
  // the opponent is away on their own turn: the countdown to their loss (the server's rule, shown; claimed at its end)
  function awayTick(o) {
    var s = o.s, sec = -1;
    if (o.color >= 0 && o.oppHere === false && o.awayAt && game.records.length >= 2 && game.pos.side !== o.color && s.turn_started_at) {
      var left = GONE_MS - Math.min(serverNow() - Date.parse(s.turn_started_at), perf() - o.awayAt);
      sec = Math.max(0, Math.ceil(left / 1000));
      if (left <= -500) claim();
    }
    if (sec !== o.awaySec) { o.awaySec = sec; renderAna(); }
  }
  function claim() {
    var o = online;
    if (!o || o.claimBusy || perf() < o.claimNext) return;
    o.claimBusy = true;
    net.call('claim', { game: o.id }).then(function (r) { o.claimBusy = false; o.claimNext = perf() + 1500; if (online === o) onServerState(r.game); },
      function () { o.claimBusy = false; o.claimNext = perf() + 3000; });
  }
  function onlineTick(now) {
    var o = online;
    if (!o || !o.s || o.s.status !== 'playing' || o.pending) return;
    awayTick(o);
    if (game.running()) { if (game.timeLeft(game.pos.side, now) < -CLAIM_GRACE) claim(); return; }
    if (game.records.length < 2) {
      var left = FIRST_MOVE_MS - (serverNow() - firstMoveSince(o.s)), sec = Math.max(0, Math.ceil(left / 1000));
      if (sec !== o.firstSec) { o.firstSec = sec; renderAna(); }
      if (left < -1200) claim();
    }
  }
  function onlineNotice() {
    var o = online;
    if (!o || !o.s || !game) return '';
    var s = o.s, mine = o.color === 0 ? 'w' : o.color === 1 ? 'b' : null, out = '';
    if (s.status === 'playing') {
      if (mine && s.draw_offer && s.draw_offer !== mine) {
        out += '<span class="notice"><b>' + esc(T('oppOffersDraw', { name: sideLabel(o.color ^ 1) })) + '</b>' +
          '<span class="notice-btns"><button class="sbtn" data-act="draw-accept">' + esc(T('accept')) + '</button><button class="sbtn" data-act="draw-decline">' + esc(T('decline')) + '</button></span></span>';
      } else if (mine && s.draw_offer === mine) out += '<span>' + esc(T('drawOffered')) + '</span>';
      if (game.records.length < 2 && o.firstSec >= 0) {
        var side = game.pos.side, who = mine && (side === 0 ? 'w' : 'b') === mine ? T('you') : sideLabel(side);
        out += '<span>' + esc(T('firstMove', { side: who, s: o.firstSec })) + '</span>';
      }
      if (o.awaySec >= 0) out += '<span class="notice"><b>' + esc(T('oppLeft', { s: o.awaySec })) + '</b></span>';
      if (!o.connected && perf() - o.lastEvent > 4000) out += '<span class="muted">' + esc(T('reconnecting')) + '</span>';
    } else if (mine && s.rematch_offer && s.rematch_offer !== mine && !s.rematch_game) {
      out += '<span class="notice"><b>' + esc(T('oppWantsRematch', { name: sideLabel(o.color ^ 1) })) + '</b><span class="notice-btns"><button class="sbtn" data-act="rematch">' + esc(T('acceptRematch')) + '</button></span></span>';
    }
    return out;
  }
  setInterval(function () {
    var o = online;
    if (!o || !o.s || !net) return;
    var idle = perf() - o.lastEvent, playing = o.s.status === 'playing';
    if (playing ? idle > (o.connected ? 12000 : 2500) : idle > 15000) resyncOnline();
  }, 1000);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', fairTick); window.addEventListener('focus', fairTick); document.addEventListener('visibilitychange', fairTick);
  // The app shows the live site, and the phone keeps a copy of the page for a while: when the app opens or comes back,
  // a newer build on the site (version.json) loads at once, unless a game is on. One try per build.
  function checkUpdate() {
    if (!NATIVE.on || !window.GC_BUILD || !window.fetch) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.build || j.build === window.GC_BUILD) return;
      if (liveOnlineGame() || curView === 'game' || currentDialog) return;
      try { if (sessionStorage.getItem('gcUpdate') === j.build) return; sessionStorage.setItem('gcUpdate', j.build); } catch (e) { return; }
      location.replace(location.pathname + '?b=' + j.build + location.hash);
    }, function () { /* offline: later */ });
  }
  setTimeout(checkUpdate, 2500);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkUpdate(); });
  // ------------------------------------------------------------------ app shell: tabs and pages
  // Play (start screen), Learn, Ratings, Profile, the sign-in page and the game itself are views of one page;
  // the address keeps the view (#play, #learn, ...) so the back button and reloads work.
  var shellEl = $('shell'), curView = null, learnKit = null, signinFlow = null, ratingsPool = null;
  var botsUi = { sel: Math.max(0, Progress.BOTS.indexOf(Progress.bot(lastSetup.bot) || Progress.levelBot(lastSetup.level || 3))), color: lastSetup.color || 'w', tab: 'career', keep: false };
  var VIEWS = ['play', 'bots', 'learn', 'ratings', 'profile', 'signin', 'games', 'player', 'game'], NAV = ['play', 'bots', 'learn', 'ratings', 'profile'];
  var NAV_KEY = { play: 'navPlay', bots: 'navBots', learn: 'navLearn', ratings: 'navRatings', profile: 'navProfile' };
  var COLOR_RANDOM_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="#1f2422"/><path d="M12 3.4a8.6 8.6 0 0 0 0 17.2z" fill="#f4efe4"/><circle cx="12" cy="12" r="8.6" fill="none" stroke="#8d9691" stroke-width="1.2"/></svg>';
  // Google's "G" for the sign-in button (their branding asks for it on "Continue with Google")
  var APPLE_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.61 2.79-.41 6.92 1.16 9.18.77 1.11 1.68 2.35 2.88 2.31 1.16-.05 1.59-.75 2.99-.75s1.79.75 3.01.72c1.24-.02 2.03-1.13 2.79-2.24.88-1.28 1.24-2.53 1.26-2.6-.03-.01-2.42-.93-2.48-3.69zM14.08 6c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.03.08 2.07-.52 2.71-1.29z"/></svg>';
  var GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  var CAMERA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.2"/></svg>';
  var PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5h4l10.3-10.3a2.83 2.83 0 0 0-4-4L4.5 15.5z"/><path d="M13.3 6.7l4 4"/></svg>';
  var STAR_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="var(--gold)" stroke="var(--gold)"><rect x="24" y="90" width="52" height="9" rx="4"/> <rect x="24" y="90" width="52" height="5" rx="3"/> <rect x="30" y="84" width="40" height="8" rx="3"/> <path d="M40 86 L41 70 L59 70 L60 86 Z"/> <path d="M43 86 L44 72 L56 72 L57 86 Z"/> <path d="M31 40 C25 35 25 27 30 25 C34 28 36 34 36 40 Z"/> <path d="M69 40 C75 35 75 27 70 25 C66 28 64 34 64 40 Z"/> <circle cx="50" cy="54" r="27"/> <circle cx="50" cy="56" r="21"/> <ellipse cx="50" cy="66" rx="14" ry="9"/> <path d="M40 67 C44 74 56 74 60 67" stroke-width="2.8" stroke-linecap="round"/> <circle cx="50" cy="60" r="7"/> <ellipse cx="47.4" cy="57.4" rx="2" ry="1.4" /> <ellipse cx="41" cy="49" rx="4.8" ry="5.2"/><ellipse cx="59" cy="49" rx="4.8" ry="5.2"/> <circle cx="41.6" cy="49.6" r="3.2"/><circle cx="59.6" cy="49.6" r="3.2"/> <circle cx="42.8" cy="48.2" r="1.1"/><circle cx="60.8" cy="48.2" r="1.1"/> <path d="M35.5 42.5 C38.5 39.5 43.5 39.5 46 41.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M54 41.5 C56.5 39.5 61.5 39.5 64.5 42.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M34 30 C26 24 14 20 6 24 C14 26 20 30 26 36 Z"/> <path d="M35 34 C45 31 48.5 20 50 2 C51.5 20 55 31 65 34 Z"/> <path d="M66 30 C74 24 86 20 94 24 C86 26 80 30 74 36 Z"/> <path d="M29 35 C40 26 60 26 71 35 L71 39 C60 31 40 31 29 39 Z"/> <circle cx="6" cy="24" r="3.2" stroke-width=".8"/> <circle cx="50" cy="3.5" r="3.2" stroke-width=".8"/> <circle cx="94" cy="24" r="3.2" stroke-width=".8"/></g></svg>';
  var LOGO_SVG = '__LOGO_SVG__'; // the icon (app/resources/icon.svg), put in by build.js
  var WORDMARK_SVG = '__WORDMARK__'; // the name (app/resources/wordmark.svg), put in by build.js
  var PIECE_SVG = '__PIECE_SVG__'; // the Joker piece alone (app/resources/piece.svg), put in by build.js
  function jokerPiece() { return uniqIds(PIECE_SVG); }
  // the small jokes in the motion play only when the player wants motion (settings, and the system's reduce-motion)
  function motionOK() { return settings.anim !== 'off' && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  // where there is nothing yet: the Joker on its square with one short line
  function emptyJoker(text) { return '<div class="empty-joker"><span class="ej-piece">' + jokerPiece() + '</span><span class="ej-text">' + esc(text) + '</span></div>'; }
  // an SVG put in the page more than once: its ids (clip paths, masks) made its own, so a hidden copy never breaks a shown one
  var uniqN = 0;
  function uniqIds(svg) {
    var n = 'u' + (++uniqN);
    return svg.replace(/id="([^"]+)"/g, 'id="$1' + n + '"').replace(/url\(#([^)]+)\)/g, 'url(#$1' + n + ')');
  }
  var CHEV_SVG = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var CHEV_RIGHT = '<svg class="chev-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var NAV_ICON = {
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="6.6" r="2.7"/><path d="M10 10h4M10.1 10c-.2 2.6-.9 4.7-2.4 6.5h8.6c-1.5-1.8-2.2-3.9-2.4-6.5"/><path d="M6.3 20.2h11.4v-1.6c0-1.2-.8-2.1-2-2.1H8.3c-1.2 0-2 .9-2 2.1z"/></svg>',
    bots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="8" width="15" height="11.5" rx="4"/><path d="M12 8V4.6"/><circle cx="12" cy="3.9" r="1" fill="currentColor"/><circle cx="9.2" cy="13.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13.4" r="1.3" fill="currentColor" stroke="none"/><path d="M2.5 12.5v3M21.5 12.5v3"/></svg>',
    learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 9.3L12 5l9.5 4.3L12 13.6z"/><path d="M6.6 11.3v4.3c1.6 1.5 3.4 2.2 5.4 2.2s3.8-.7 5.4-2.2v-4.3"/><path d="M21.5 9.3v5"/></svg>',
    ratings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.4" r="3.7"/><path d="M4.8 20c.9-3.6 3.6-5.6 7.2-5.6s6.3 2 7.2 5.6"/></svg>'
  };
  var POOL_ICON = {
    bullet: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.7 3.1a4.1 4.1 0 0 1 4.2 4.2l-.3.6-9.8 9.8-4.5-4.5 9.8-9.8z"/><path d="M5.3 14.2l4.5 4.5-1.7 1.7a1.5 1.5 0 0 1-2.1 0l-2.4-2.4a1.5 1.5 0 0 1 0-2.1z"/></svg>',
    blitz: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.6 2.5L5 13.6h6.1L9.6 21.5l8.9-11.3h-6.2z"/></svg>',
    rapid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.6M10 2.8h4M12 2.8v3.4"/></svg>'
  };
  var ROW_ICON = {
    friend: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11.5" cy="11" r="4.2"/><circle cx="22.5" cy="12.8" r="3.3"/><path d="M3.8 26.2c.8-4.7 3.7-7.4 7.7-7.4s6.9 2.7 7.7 7.4"/><path d="M19.4 19.6a6.2 6.2 0 0 1 3.1-.8c3.3 0 5.5 2.2 6.1 6"/></svg>',
    bot: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="10" width="19" height="14" rx="4"/><path d="M16 10V6.2M13.6 6h4.8M3.5 15.2v4M28.5 15.2v4"/><circle cx="12.2" cy="16.8" r="1.7" fill="currentColor" stroke="none"/><circle cx="19.8" cy="16.8" r="1.7" fill="currentColor" stroke="none"/></svg>',
    pass: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 11.5h18.5l-4.2-4.2M26 20.5H7.5l4.2 4.2"/></svg>',
    join: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="9.5" cy="8.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="16" cy="8.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="22.5" cy="8.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="9.5" cy="15" r="1.9" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1.9" fill="currentColor" stroke="none"/><circle cx="22.5" cy="15" r="1.9" fill="currentColor" stroke="none"/><circle cx="9.5" cy="21.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="16" cy="21.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="22.5" cy="21.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="16" cy="28" r="1.9" fill="currentColor" stroke="none"/></svg>'
  };
  function initial(name) { var c = String(name || '?').trim().charAt(0); return c ? c.toUpperCase() : '?'; }
  // ---- avatars: a player's own picture (storage, 256×256 JPEG at <uid>.jpg) or, without one, the first letter of the name
  var avatarV = {}; // uid -> profiles.avatar_v as last seen (0: no picture)
  var xpOf = {};    // uid -> profiles.xp as last seen (the rank badge next to a name)
  var proUid = {};  // uid -> 1 Pro, 2 Founder, 0 neither, as last seen (the gold name and the mark)
  function noteAvatars(rows) {
    (rows || []).forEach(function (p) {
      if (!p || !p.id) return;
      avatarV[p.id] = p.avatar_v || 0; if (p.xp != null) xpOf[p.id] = p.xp;
      if ('pro_until' in p || 'pro_founder' in p) proUid[p.id] = p.pro_founder ? 2 : p.pro_until && Date.parse(p.pro_until) > Date.now() ? 1 : 0;
      else if ('pro' in p) proUid[p.id] = p.founder ? 2 : p.pro ? 1 : 0;
    });
  }
  // the rank badge next to a name: the player's own from this device; another player's from their profile (none while
  // it isn't known, or before they have earned anything)
  function rankMini(uid) {
    var mine = !uid || (me && uid === me.uid), xp = mine ? prog.xp : xpOf[uid];
    // (Joker Pro) a Pro player's mark sits next to the badge, and the name beside it turns gold (CSS :has). Other
    // players' marks show where Pro exists for the one who looks (sold here, or their own)
    var mark = mine ? (isPro() ? proMark() : '') : (proUid[uid] && proAvail() ? proMark(proUid[uid] === 2) : '');
    if (!mine && !(xp > 0)) return mark;
    var lv = Progress.levelOf(xp || 0).level, label = PT('level', { n: lv }) + ', ' + Progress.rankName(lang, lv);
    return '<span class="rank-mini" role="img" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + rankBadge(lv, 'mini') + '</span>' + mark;
  }
  function avatarUrl(uid, v) {
    if (!NETCFG) return '';
    return NETCFG.mock != null ? NETCFG.mock + '/avatar/' + encodeURIComponent(uid) + '?v=' + v : String(NETCFG.url).replace(/\/+$/, '') + '/storage/v1/object/public/avatars/' + uid + '.jpg?v=' + v;
  }
  function avatarHtml(uid, name, cls) {
    var v = (uid && avatarV[uid]) || 0;
    return '<span class="ava' + (cls ? ' ' + cls : '') + (v ? ' pic' : '') + '">' + (v ? '<img src="' + esc(avatarUrl(uid, v)) + '" alt="">' : '') + '<i>' + esc(initial(name)) + '</i></span>';
  }
  // the picture sheet on the Profile tab: choose one (any image; squared and shrunk here before it goes up), or take it away
  var photoEl = null;
  function photoInput() {
    if (photoEl && photoEl.isConnected) return photoEl;
    photoEl = h('input', { type: 'file', accept: 'image/*', id: 'photo-file', style: 'position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0' });
    photoEl.addEventListener('change', function () { var f = photoEl.files && photoEl.files[0]; if (f) savePhoto(f); photoEl.value = ''; });
    document.body.appendChild(photoEl);
    return photoEl;
  }
  function avatarSheet() {
    if (!me || !net) return;
    var has = !!avatarV[me.uid];
    openDialog(function (card) {
      currentDialog.dataset.kind = 'photo';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('photo'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('photoSub'))));
      var pick = h('button', { class: 'primary', type: 'button', id: 'btn-photo-pick' }, esc(T('choosePhoto')));
      pick.addEventListener('click', function () { photoInput().click(); });
      var row = h('div', { class: 'row-btns' }); row.appendChild(pick);
      if (has) { var rm = h('button', { class: 'secondary danger', type: 'button', id: 'btn-photo-remove' }, esc(T('removePhoto'))); rm.addEventListener('click', removePhoto); row.appendChild(rm); }
      card.appendChild(row);
    });
  }
  // the chosen image squared from its middle and shrunk to 256×256, as a JPEG
  function fileToAvatar(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          var S = 256, c = document.createElement('canvas'); c.width = S; c.height = S;
          var w = img.naturalWidth, hh = img.naturalHeight, side = Math.min(w, hh);
          if (!side) throw new Error('empty');
          c.getContext('2d').drawImage(img, (w - side) / 2, (hh - side) / 2, side, side, 0, 0, S, S);
          c.toBlob(function (b) { if (b) res(b); else rej(new Error('image')); }, 'image/jpeg', 0.86);
        } catch (e) { rej(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  function savePhoto(file) {
    if (!me || !net) return;
    closeDialog();
    fileToAvatar(file).then(function (blob) { return net.uploadAvatar(blob); }).then(function () { return net.call('avatar', {}); }).then(function (r) {
      if (r && r.profile) { me.profile = r.profile; noteAvatars([r.profile]); }
      toast(T('photoSaved')); refreshView(); renderBars();
    }, function () { toast(T('photoFailed')); });
  }
  function removePhoto() {
    if (!me || !net) return;
    closeDialog();
    net.removeAvatar().catch(function () { /* the file may be gone already */ }).then(function () { return net.call('avatar', { remove: true }); }).then(function (r) {
      if (r && r.profile) { me.profile = r.profile; noteAvatars([r.profile]); }
      toast(T('photoRemoved')); refreshView(); renderBars();
    }, function () { toast(T('photoFailed')); });
  }
  function signedIn() { return !!(me && !me.guest); }
  function tcLabel(t) { return String(t); } // plain text: 3+2
  // buttons show 3 | 2 with a drawn divider (the | glyph reads as an I in some fonts); screen readers get 3+2
  function tcHtml(t) { var p = String(t).split('+'); return esc(p[0]) + '<i class="tc-sep"><b>+</b></i>' + esc(p[1] || '0'); }
  // no lichess-style "1489?" for provisional ratings: the number alone, like chess.com (the profile cards say "provisional")
  function ratingText(pool) { var r = me && me.ratings[pool]; return r ? String(Math.round(r.rating)) : '1500'; }
  function viewEl(v) { return v === 'game' ? app : $('view-' + v); }
  function viewFromUrl() { var hh = (location.hash || '').replace(/^#/, ''); return VIEWS.indexOf(hh) >= 0 ? hh : null; }
  function allowed(v) {
    if (VIEWS.indexOf(v) < 0) return false;
    if (v === 'game') return !!game;
    if (v === 'player') return !!player;
    return !!NETCFG || (v !== 'ratings' && v !== 'signin');
  }
  function go(v, replace) {
    if (!allowed(v)) v = 'play';
    var url = location.pathname + location.search + '#' + v;
    try { if (replace || curView === null || curView === v) history.replaceState({ v: v }, '', url); else history.pushState({ v: v }, '', url); } catch (e) { /* ignore */ }
    showView(v);
  }
  function onUrlView() { var v = viewFromUrl() || 'play'; if (!allowed(v)) v = 'play'; if (v !== curView) showView(v); }
  window.addEventListener('popstate', onUrlView);
  window.addEventListener('hashchange', onUrlView);
  function showView(v) {
    var prev = curView;
    curView = v; shellEl.dataset.view = v;
    if (prev !== v) Track.page(v);
    // the Bots tab always opens on the career (the Road to Joker); "All bots" is a choice made there, not remembered
    // (keep: a link that opens "All bots" on purpose, once)
    if (v === 'bots' && prev !== 'bots') { if (!botsUi.keep) botsUi.tab = 'career'; botsUi.keep = false; }
    VIEWS.forEach(function (x) { var el = viewEl(x); if (el) el.hidden = x !== v; });
    // a short fade as the tab comes in (not for the game, whose board sits still)
    if (prev !== null && prev !== v && v !== 'game') { var ve = viewEl(v); if (ve) { ve.classList.remove('view-in'); void ve.offsetWidth; ve.classList.add('view-in'); } }
    renderNav();
    if (prev !== null && prev !== v && currentDialog && currentDialog.dataset.kind !== 'lobby') closeDialog();
    if (prev === 'signin' && v !== 'signin' && signinFlow) { signinFlow.stop(); signinFlow = null; }
    // back from a past game: the game on this device again
    if (prev === 'game' && v !== 'game' && game && (game.archived || (game.fromHistory && game.online && game.status === 'over'))) { if (game.online) leaveOnline(); restoreSavedGame(); }
    if ((v === 'games' || v === 'profile') && (!hist.at || Date.now() - hist.at > 15000)) loadHistory();
    if (v === 'game') { resumeLocalGame(); layout(); renderAll(); } else pauseLocalGame();
    if (learnKit) learnKit.active(v); // autoplay boards run only on the tab that shows them
    if (v !== 'game') {
      refreshView();
      if (prev !== v) { var el = viewEl(v); try { el.scrollTop = 0; } catch (e) { /* ignore */ } }
    }
  }
  function refreshView() {
    if (curView === 'play') renderPlay(); else if (curView === 'bots') renderBots(); else if (curView === 'learn') renderLearn(); else if (curView === 'ratings') renderRatings();
    else if (curView === 'profile') renderProfile(); else if (curView === 'signin') renderSignin(); else if (curView === 'games') renderGames(); else if (curView === 'player') renderPlayer();
  }
  function renderNav() {
    var cur = curView === 'game' ? gameHome() : curView;
    if (cur === 'player') cur = (player && player.back) || 'ratings';
    var active = cur === 'signin' ? 'play' : cur === 'games' ? 'profile' : cur === 'game' ? playHome() : cur;
    var items = NAV.filter(allowed);
    [$('rail-items'), $('tabbar')].forEach(function (host) {
      if (host.dataset.built !== lang + items.join()) {
        host.innerHTML = ''; host.dataset.built = lang + items.join();
        items.forEach(function (v) {
          var a = h('a', { class: 'nav-item', href: '#' + v, 'data-nav': v }, NAV_ICON[v] + '<span>' + esc(T(NAV_KEY[v])) + '</span>');
          a.addEventListener('click', function (e) {
            e.preventDefault();
            var fresh = a.getAttribute('aria-current') !== 'page';
            go(v);
            // the tab opened gives one small hop
            if (fresh && motionOK()) { var ic = a.querySelector('svg'); if (ic) { ic.classList.remove('hop'); void ic.offsetWidth; ic.classList.add('hop'); } }
          });
          host.appendChild(a);
        });
      }
      host.querySelectorAll('[data-nav]').forEach(function (a) { if (a.dataset.nav === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    });
  }
  // a game against the bot or on one device waits while the player is on another tab
  function pauseLocalGame() {
    if (!game || game.online || game.paused || game.status !== 'playing' || !game.clock) return;
    game.freeze(perf()); game.paused = true; persist();
  }
  function resumeLocalGame() {
    if (!game || !game.paused) return;
    game.paused = false; if (game.clock) game.clock.since = perf();
  }
  function kit() {
    if (!learnKit && window.GCLearn) { learnKit = GCLearn.create({ daily: function () { return dailyToday(); }, solveDaily: solveDaily, streakSheet: streakSheet, streakLine: function () { var st = streakNow(); return st.count >= 2 ? { n: st.count, html: FLAME_SVG + '<b>' + st.count + '</b>' } : null; }, newcomer: function () { return !returningPlayer(); }, dailyAuto: function () { var t = todayStr(); if (load('dailyAuto', '') === t) return false; save('dailyAuto', t); return true; }, track: function (n, p) { Track.event(n, p); if (n === 'puzzle_solved') { noteAct('learn'); noteDay('puzzle'); } }, coachFace: function () { return window.GCBots ? GCBots.castAvatar('oskar', lang) : ''; }, levelInfo: coachLevelInfo, puzzleDone: puzzleDone, pro: !PRO ? null : { on: isPro, sells: proSells, sheet: function (why) { proSheet(why); }, t: PX, mark: function () { return '<span class="pro-mark">' + esc(PX('mark')) + '</span>'; }, variant: PRO.variant }, T: T, esc: esc, h: h, piece: jokerPiece, motionOK: motionOK, settings: settings, Sound: Sound, go: go, showBotSetup: showBotSetup, privacyUrl: privacyUrl }); if (curView) learnKit.active(curView); }
    return learnKit;
  }

  // ---- online play needs an account; the chosen action continues after signing in (even across a reload)
  function setPending(a) { a.at = Date.now(); save('pending', a); }
  function takePending() { var a = load('pending', null); save('pending', null); return a && a.at && Date.now() - a.at < 30 * 60000 ? a : null; }
  // Online play asks for nothing: a guest gets an account on the spot (an anonymous session with a made-up name) and
  // plays rated games on it. Signing in (the chip on the start screen, Profile, the result card) keeps that progress
  // on any device; nothing is gated behind it.
  function requireAccount(a) {
    if (!NETCFG) return;
    ensureNet().then(function () { runPending(a); }, function () { toast(T('netError')); });
  }
  function runPending(a) {
    if (!a) return;
    if (a.kind === 'seek') { go('play'); startSeek(a.tc, a.rated); }
    else if (a.kind === 'invite') { go('play'); startInvite(a.tc, a.rated); }
    else if (a.kind === 'join') joinGame(a.id);
    else if (a.kind === 'view') go(a.v);
    else if (a.kind === 'pro') { if (curView === 'signin') go('play'); setTimeout(function () { if (isPro()) proStatus(); else proSheet(a.why || null, null, null, a.plan); }, 300); }
  }
  function afterSignin() { var a = takePending(); if (a) runPending(a); else go('play'); }

  // ---- Play: the start screen. One main action (Play), one quiet one (Play a friend).
  var WIDE_MQ = window.matchMedia ? matchMedia('(min-width: 1100px)') : null;
  if (WIDE_MQ) { var onWide = function () { if (curView === 'play') renderPlay(); }; if (WIDE_MQ.addEventListener) WIDE_MQ.addEventListener('change', onWide); else if (WIDE_MQ.addListener) WIDE_MQ.addListener(onWide); }
  function renderPlay() {
    var host = $('view-play');
    host.innerHTML = '';
    var wrap = h('div', { class: 'play-wrap' }), bw = h('div', { class: 'play-board' }), col = h('div', { class: 'play-col' });
    wrap.appendChild(bw); wrap.appendChild(col); host.appendChild(wrap);
    var head = h('div', { class: 'play-head' });
    head.appendChild(h('div', { class: 'brand' }, '<span class="wordmark">' + uniqIds(WORDMARK_SVG) + '</span>'));
    if (NETCFG) {
      var chip;
      if (me && me.profile && signedIn()) chip = h('button', { type: 'button', class: 'acct-chip' + (isPro() ? ' pro' : ''), id: 'acct-chip' }, avatarHtml(me.uid, me.profile.username, 'av') + '<span>' + esc(me.profile.username) + '</span>');
      else chip = h('button', { type: 'button', class: 'acct-chip out', id: 'acct-chip' }, '<span>' + esc(T('signIn')) + '</span>');
      chip.addEventListener('click', function () { if (signedIn()) go('profile'); else { setPending({ kind: 'view', v: 'play' }); go('signin'); } });
      var hr = h('div', { class: 'head-r' }), fl = streakChip();
      hr.appendChild(levelChip());
      if (fl) hr.appendChild(fl);
      hr.appendChild(chip); head.appendChild(hr);
    } else { var hr2 = h('div', { class: 'head-r' }), fl2 = streakChip(); hr2.appendChild(levelChip()); if (fl2) hr2.appendChild(fl2); head.appendChild(hr2); }
    col.appendChild(head);
    var main = h('div', { class: 'play-main' }); col.appendChild(main);
    // the reel of Joker Moves: on a board beside the menu on wide screens, above the menu otherwise; the layout follows
    // the window as it is resized or zoomed (WIDE_MQ below)
    var wide = WIDE_MQ ? WIDE_MQ.matches : false, reelHost = wide ? bw : h('div', { class: 'play-reel' });
    var reelCap = h('div', { class: 'play-reel-cap', 'aria-live': 'polite' });
    if (!wide) main.appendChild(reelHost);
    var acts = h('div', { class: 'play-actions' });
    main.appendChild(acts);
    if (NETCFG) acts.appendChild(h('h2', { class: 'play-h' }, esc(T('playH')))); // the panel's title on tablet and desktop
    var lr = localResume(); if (lr) acts.appendChild(lr);
    if (lobby && lobby.kind === 'invite' && !currentDialog) {
      var iv = h('div', { class: 'resume', id: 'invite-open' }, '<span class="t"><b>' + esc(lobby.code ? T('codeOpenT', { code: lobby.code }) : T('inviteOpenT')) + '</b><span>' + esc(T('inviteOpenSub')) + '</span></span>');
      iv.appendChild(bigBtn('sbtn', T('showLink'), 'btn-show-invite', function () { showLobbyDialog(); }));
      iv.appendChild(bigBtn('sbtn quiet', T('cancel'), 'btn-cancel-invite', function () { cancelLobby(); refreshView(); }));
      acts.appendChild(iv);
    }
    if (liveOnlineGame()) {
      // a game is on: the only thing to do here is to go back to it
      acts.appendChild(h('div', { class: 'play-meta' }, esc(T('gameOn') + ': ' + T('vsName', { name: game.cfg.names[game.cfg.human ^ 1] || '' }) + (game.cfg.tc ? ', ' + tcLabel(game.cfg.tc.label) : ''))));
      acts.appendChild(bigBtn('start-btn', T('returnBtn'), 'btn-resume', function () { go('game'); }));
    } else if (NETCFG) {
      var tc = onlineTc(), pool = poolOfLabel(tc), rated = lastSetup.rated !== false;
      var tcb = h('button', { type: 'button', class: 'tc-field', id: 'play-tc', 'aria-haspopup': 'dialog' },
        '<span class="tc-ic ic-' + pool + '">' + POOL_ICON[pool] + '</span><span class="tc-l"><span class="pool">' + esc(T(pool)) + '</span><span class="v">' + tcHtml(tc) + '</span></span>' +
        (rated ? '' : '<span class="tag">' + esc(T('casual')) + '</span>') + CHEV_SVG);
      tcb.addEventListener('click', tcSheet);
      acts.appendChild(tcb);
      acts.appendChild(bigBtn('start-btn', T('playMain'), 'btn-start', function () { requireAccount({ kind: 'seek', tc: tc, rated: rated }); }));
      // the two quieter ways to play, side by side under the main one
      var row = h('div', { class: 'play-row' });
      row.appendChild(bigBtn('second-btn', T('playFriendShort'), 'btn-friend', friendSheet));
      row.appendChild(bigBtn('second-btn', T('playBotShort'), 'btn-bot', function () { go('bots'); }));
      acts.appendChild(row);
      // signed in: the rating line under the buttons; a guest gets no note — Play just works, sign-in is in the corner
      if (signedIn()) acts.appendChild(h('div', { class: 'play-meta', id: 'play-meta' }, esc(T('ratingIn', { pool: T(pool), r: ratingText(pool) }) + ', ' + (rated ? T('rated') : T('casual')).toLowerCase())));
      // Joker Pro's quiet line (not every day, never for a newcomer: Pro.offerDue)
      var pbn = !lobby && PRO ? proBanner() : null;
      if (pbn) acts.appendChild(pbn);
    } else {
      acts.appendChild(bigBtn('start-btn', T('playBot'), 'btn-start', function () { go('bots'); }));
      acts.appendChild(bigBtn('second-btn', T('passPlayLong'), 'btn-pass', showLocalSetup));
      if (window.GC_APP_OFFLINE) {
        // the app opened without internet: this is its built-in copy of the site; "Try again" goes back to the live one
        var off = h('div', { class: 'offline-note app-off', id: 'app-offline' }, '<span>' + esc(T('appOffline')) + '</span>');
        off.appendChild(bigBtn('linkbtn', T('reconnect'), 'btn-reconnect', function () { location.href = window.GC_SITE || '/'; }));
        acts.appendChild(off);
      } else if (window.GC_SITE) acts.appendChild(h('div', { class: 'offline-note' }, esc(T('onlineElsewhere')) + ' <a class="site-link" href="' + esc(window.GC_SITE) + '" target="_blank" rel="noopener">' + esc(window.GC_SITE.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>'));
    }
    // the reel plays on the Play tab only (learnKit.active pauses it elsewhere)
    // the hero: the reel of Joker Moves for a newcomer; from the second day on, the daily puzzle (a reason to come back)
    if (kit()) {
      var dd = returningPlayer() ? dailyToday() : null;
      if (dd && learnKit.dailyBoard) {
        learnKit.dailyBoard(reelHost, dd, function () { Track.event('daily_open', { from: 'play' }); openDaily(); });
        reelCap.classList.add('daily-cap'); reelCap.id = 'daily-cap';
        reelCap.innerHTML = dd.solved ? '<b>\u2713</b> ' + esc(T('dailySolvedCap')) : '<b>' + esc(T('dailyN', { n: dd.n })) + '</b> \u00b7 ' + esc(T('dailyFind'));
        reelCap.addEventListener('click', function () { openDaily(); });
      } else learnKit.heroBoard(reelHost, reelCap);
      reelHost.appendChild(reelCap);
    }
    // the website's own footer: who runs it and the legal pages (the apps show the same site, they don't need it)
    if (NETCFG && !NATIVE.on) col.appendChild(h('div', { class: 'site-foot', id: 'site-foot' },
      '<span>© Kozyra Media Group FZCO, Dubai</span><span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="support.html">Support</a></span>'));
  }
  function onlineTc() { return ONLINE_TCS.indexOf(lastSetup.otc) >= 0 ? lastSetup.otc : '3+2'; }
  function bigBtn(cls, label, id, fn) {
    var b = h('button', { type: 'button', class: cls, id: id }, esc(label));
    b.addEventListener('click', fn);
    return b;
  }
  // a two-player game on this device that isn't finished (bot games resume on the Bots tab)
  function localResume() {
    if (!game || game.online || botGame() || game.idle || game.status !== 'playing' || !game.records.length) return null;
    var c = h('div', { class: 'resume', id: 'resume' }, '<span class="t"><b>' + esc(T('unfinished')) + '</b><span>' + esc(T('passPlayLong')) + '</span></span>');
    c.appendChild(bigBtn('sbtn', T('cont'), 'btn-resume', function () { go('game'); }));
    return c;
  }
  // time control: a sheet with the choices; picking one closes it
  function tcSheet() {
    var cur = onlineTc();
    openDialog(function (card) {
      currentDialog.dataset.kind = 'tc';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('timeControl'))));
      [['bullet', ['1+0', '2+1']], ['blitz', ['3+0', '3+2', '5+0', '5+3']], ['rapid', ['10+0', '10+5', '15+10']]].forEach(function (g) {
        var grp = h('div', { class: 'tc-group' });
        grp.appendChild(h('div', { class: 'tc-group-h' }, '<span class="ic-' + g[0] + '">' + POOL_ICON[g[0]] + '</span><span>' + esc(T(g[0])) + '</span>' + (signedIn() ? '<span class="r">' + esc(ratingText(g[0])) + '</span>' : '')));
        var grid = h('div', { class: 'tc-grid' });
        g[1].forEach(function (t) {
          var b = h('button', { type: 'button', class: 'tc-opt', id: 'tc-' + t.replace('+', '-'), 'aria-pressed': String(t === cur) }, tcHtml(t));
          b.addEventListener('click', function () { lastSetup.otc = t; save('setup', lastSetup); closeDialog(); renderPlay(); });
          grid.appendChild(b);
        });
        grp.appendChild(grid); card.appendChild(grp);
      });
      var row = h('div', { class: 'toggle-row' }), lab = h('span', { id: 'set-rated-l' }, esc(T('rated')));
      var sw = h('button', { class: 'sw', type: 'button', role: 'switch', id: 'set-rated', 'aria-labelledby': 'set-rated-l', 'aria-checked': String(lastSetup.rated !== false) });
      sw.addEventListener('click', function () { lastSetup.rated = lastSetup.rated === false; save('setup', lastSetup); sw.setAttribute('aria-checked', String(lastSetup.rated !== false)); renderPlay(); });
      row.appendChild(lab); row.appendChild(sw); card.appendChild(row);
    });
  }
  // play a friend: by link (online) or on this device
  function friendSheet() {
    var tc = onlineTc(), rated = lastSetup.rated !== false;
    openDialog(function (card) {
      currentDialog.dataset.kind = 'friend';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('friendT'))));
      function opt(cls, icon, label, sub, id, fn) {
        var b = h('button', { type: 'button', class: 'opt-btn ' + cls, id: id }, '<span class="ic">' + ROW_ICON[icon] + '</span><span class="lbl">' + esc(label) + '<span class="sub">' + esc(sub) + '</span></span>');
        b.addEventListener('click', fn);
        return b;
      }
      card.appendChild(opt('main', 'friend', T('friendLink'), T('friendLinkSub') + ' (' + tcLabel(tc) + ')', 'btn-invite-link', function () { closeDialog(); requireAccount({ kind: 'invite', tc: tc, rated: rated }); }));
      card.appendChild(opt('', 'join', T('joinCode'), T('joinCodeSub'), 'btn-join-code', function () { joinByCodeSheet(); }));
      card.appendChild(opt('', 'pass', T('friendHere'), T('friendHereSub'), 'btn-pass', function () { closeDialog(); showLocalSetup(); }));
    });
  }
  // an invite link (or just its code) pasted by hand: the way in when a link opened somewhere else (a browser, another app)
  function inviteFrom(text) {
    text = String(text || '').trim();
    var m = /[?&](join|game)=([A-Za-z0-9-]{6,})/.exec(text);
    if (m) return { kind: m[1], id: m[2] };
    m = /^([A-Za-z0-9-]{6,})$/.exec(text);
    return m ? { kind: 'join', id: m[1] } : null;
  }
  // the friend's side: 4 digits (or a pasted invite link); the game starts as soon as the fourth digit is in
  function joinByCodeSheet() {
    openDialog(function (card) {
      currentDialog.dataset.kind = 'join-code';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('joinCode'))));
      var sub = h('div', { class: 'dlg-sub' }, esc(T('joinCodeSub')));
      card.appendChild(sub);
      var f = h('form', { class: 'join-form' });
      var inp = h('input', { type: 'text', id: 'join-code-input', class: 'code-input', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '120',
        autocapitalize: 'off', spellcheck: 'false', placeholder: '\u2022\u2022\u2022\u2022', 'aria-label': T('joinCodeSub') });
      f.appendChild(inp);
      var go2 = h('button', { type: 'submit', class: 'primary', id: 'btn-join-go' }, esc(T('joinGo')));
      f.appendChild(go2);
      var busy = false;
      function attempt() {
        if (busy) return;
        var v = inp.value.trim(), inv = /[?&](join|game)=/.test(v) ? inviteFrom(v) : null, digits = v.replace(/\D/g, '');
        if (inv) { closeDialog(); if (inv.kind === 'game') openOnlineGame(inv.id); else requireAccount({ kind: 'join', id: inv.id }); return; }
        if (digits.length !== 4) { inp.focus(); return; }
        busy = true; go2.disabled = true; sub.textContent = T('connecting') + '\u2026'; sub.classList.remove('bad');
        ensureNet().then(function () { return net.call('join', { code: digits }); }).then(function (r) {
          closeDialog();
          if (r.game.status === 'waiting') { openOnlineGame(r.game.id); return; }
          startOnline(r.game);
        }, function (e) {
          busy = false; go2.disabled = false;
          if (fairClosed(e)) return;
          var d = e && e.data;
          sub.textContent = d && d.error === 'no_code' ? T('noCode') : T('netError'); sub.classList.add('bad');
          inp.value = ''; inp.focus();
        });
      }
      inp.addEventListener('input', function () {
        if (/[?&](join|game)=/.test(inp.value)) return; // a link being pasted: wait for the button
        var d = inp.value.replace(/\D/g, '').slice(0, 4);
        if (inp.value !== d) inp.value = d;
        if (d.length === 4) attempt();
      });
      f.addEventListener('submit', function (e) { e.preventDefault(); attempt(); });
      card.appendChild(f);
      setTimeout(function () { try { inp.focus(); } catch (e) { /* ignore */ } }, 60);
    });
  }

  // ---- Bots: pick a character, one Play button
  function renderBots() {
    var host = $('view-bots'), keep = host.scrollTop;
    host.innerHTML = '';
    var inn = h('div', { class: 'page-in bots-page' }); host.appendChild(inn);
    inn.appendChild(h('h1', { class: 'page-h' }, esc(T('navBots'))));
    if (game && !game.online && botGame() && game.status === 'playing' && !game.idle && game.records.length) {
      var rb = h('div', { class: 'resume', id: 'resume' }, '<span class="av-s">' + botFaceHtml() + '</span><span class="t"><b>' + esc(T('unfinished')) + '</b><span>' + esc(T('botOpp', { name: botName() })) + '</span></span>');
      rb.appendChild(bigBtn('sbtn', T('cont'), 'btn-resume', function () { go('game'); }));
      inn.appendChild(rb);
    }
    var tabs = h('div', { class: 'bots-tabs', role: 'tablist' });
    [['career', T('careerTab')], ['free', T('freeTab')]].forEach(function (x) {
      var b = h('button', { type: 'button', role: 'tab', class: 'bt-tab', id: 'tab-' + x[0], 'aria-selected': String(botsUi.tab === x[0]) }, esc(x[1]));
      b.addEventListener('click', function () { botsUi.tab = x[0]; renderBots(); });
      tabs.appendChild(b);
    });
    inn.appendChild(tabs);
    if (botsUi.tab === 'career') { renderCareer(inn); host.scrollTop = keep; return; }
    var hw = h('div', { class: 'bot-hero-wrap' }), hero = h('div', { class: 'bot-hero', id: 'bot-hero' });
    hw.appendChild(hero); inn.appendChild(hw);
    var tiles = [], pb;
    function paint() {
      var i = botsUi.sel, b = Progress.BOTS[i], st = stats[botStatKey(b)], nm = GCBots.castName(b.who, lang);
      hero.innerHTML = '<div class="bot-face">' + GCBots.castAvatar(b.who, lang) + '</div>' +
        '<div class="bot-info"><div class="bot-name"><b>' + esc(GCBots.castName(b.who, lang, true)) + '</b><span class="elo">' + b.elo + '</span></div>' +
        '<div class="bot-lv">' + esc(T('lv' + b.level)) + '</div></div>' +
        '<p class="bot-bio">' + esc(GCBots.castBio(b.who, lang)) + '</p>';
      var foot = h('div', { class: 'bot-foot' });
      foot.appendChild(h('span', { class: 'bot-rec', id: 'bot-rec' }, esc(st ? T('botScore', { w: st.w, d: st.d, l: st.l }) : T('botNoGames', { name: nm }))));
      var pick = h('div', { class: 'color-pick', role: 'group', 'aria-label': T('yourColor') });
      [['w', '<i class="pc-ic p-wK"></i>', T('white')], ['r', COLOR_RANDOM_SVG, T('random')], ['b', '<i class="pc-ic p-bK"></i>', T('black')]].forEach(function (c) {
        var b = h('button', { type: 'button', id: 'opt-' + c[0], title: c[2], 'aria-label': c[2], 'aria-pressed': String(botsUi.color === c[0]) }, c[1]);
        b.addEventListener('click', function () {
          botsUi.color = c[0]; lastSetup.color = c[0]; save('setup', lastSetup);
          pick.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        });
        pick.appendChild(b);
      });
      foot.appendChild(pick); hero.appendChild(foot);
      // (prototype, Joker Pro) the Joker: reached on the Road, or played at once with Pro
      var lockedJ = b.who === 'golden' && jokerLocked();
      if (lockedJ) hero.appendChild(h('div', { class: 'bot-locked', id: 'bot-locked' }, LOCK_SVG + '<span><b>' + esc(PX('jokerLockedT')) + '</b><span>' +
        esc(PX('jokerLockedSub', { n: Progress.SEASONS[Progress.SEASONS.length - 1].need, have: Progress.careerStars(prog.career) })) + '</span></span>'));
      tiles.forEach(function (t, k) { t.setAttribute('aria-pressed', String(k === i)); });
      if (pb) pb.textContent = lockedJ ? PX('jokerPro') : GCBots.castPlay(b.who, lang);
    }
    // the same sixteen as on the road, in its four seasons, every one of them open here
    Progress.SEASONS.forEach(function (sn, k) {
      inn.appendChild(h('h2', { class: 'bot-group' }, esc(PT('s_' + sn.key))));
      var grid = h('div', { class: 'bot-grid' });
      Progress.BOTS.slice(k * Progress.PER_SEASON, (k + 1) * Progress.PER_SEASON).forEach(function (b, j) {
        var i = k * Progress.PER_SEASON + j, nm = GCBots.castName(b.who, lang);
        var lk = b.who === 'golden' && jokerLocked();
        var t = h('button', { type: 'button', class: 'bot-tile' + (lk ? ' locked' : ''), id: 'bot-' + b.who, 'aria-pressed': 'false', 'aria-label': GCBots.castName(b.who, lang, true) + ', ' + b.elo },
          '<span class="face">' + GCBots.castAvatar(b.who, lang) + (lk ? '<i class="bt-lock">' + LOCK_SVG + '</i>' : '') + '</span><span class="nm">' + esc(nm) + '</span><span class="el">' + b.elo + '</span>');
        t.addEventListener('click', function () { Sound.unlock(); botsUi.sel = i; lastSetup.level = b.level; lastSetup.bot = b.who; save('setup', lastSetup); paint(); });
        tiles[i] = t; grid.appendChild(t);
      });
      inn.appendChild(grid);
    });
    var bar = h('div', { class: 'cta-bar' });
    pb = bigBtn('start-btn', '', 'btn-play', function () {
      var b = Progress.BOTS[botsUi.sel], s = { mode: 'bot', level: b.level, bot: b.who, color: botsUi.color, tc: 'none' };
      if (b.who === 'golden' && jokerLocked()) { proSheet('joker'); return; }
      lastSetup = Object.assign({}, lastSetup, { level: s.level, bot: s.bot, color: s.color }); save('setup', lastSetup);
      startGame(s);
    });
    bar.appendChild(pb); inn.appendChild(bar);
    paint();
    host.scrollTop = keep;
  }

  // ---- sign in (a full page)
  function renderSignin() {
    var host = $('view-signin');
    host.innerHTML = '';
    var pg = h('div', { class: 'signin' }), top = h('div', { class: 'signin-top' });
    var back = h('button', { type: 'button', class: 'signin-back', id: 'signin-back' }, BACK_SVG + '<span>' + esc(T('back')) + '</span>');
    back.addEventListener('click', function () { save('pending', null); go('play'); });
    top.appendChild(back); pg.appendChild(top);
    var main = h('div', { class: 'signin-main' }), card = h('div', { class: 'signin-card', id: 'signin-card' });
    main.appendChild(card); pg.appendChild(main); host.appendChild(pg);
    if (signinFlow) signinFlow.stop();
    signinFlow = accountFlow(card, { page: true, onDone: afterSignin, onCancel: function () { go('play'); } });
  }

  // ---- Ratings
  function renderRatings() {
    var host = $('view-ratings');
    host.innerHTML = '';
    var inn = h('div', { class: 'page-in' }); host.appendChild(inn);
    inn.appendChild(h('h1', { class: 'page-h' }, esc(T('navRatings'))));
    var pool = ratingsPool || poolOfLabel(lastSetup.otc || '3+2');
    inn.appendChild(seg(['bullet', 'blitz', 'rapid'].map(function (p) { return { v: p, label: T(p), id: 'lb' + p }; }), pool, function (p) { ratingsPool = p; renderRatings(); }));
    // my card: picture, name, the rating big, and the place in the pool with the share of players I am ahead of
    var my = h('div', { class: 'card my-card', id: 'my-rating' });
    var r = me && me.profile ? me.ratings[pool] : null;
    if (me && me.profile) {
      var nm = me.profile.username;
      my.innerHTML = '<div class="my-top">' + avatarHtml(me.uid, nm, 'my-ava') + '<div class="my-who"><b>' + esc(nm) + '</b><span class="my-place" id="my-place">' +
        esc(r && r.games ? T('yourPlace') + '\u2026' : T('unranked')) + '</span></div><div class="big">' + esc(ratingText(pool)) + '</div></div>' +
        (r && r.games ? '<div class="my-wdl"><span class="w"><b>' + r.wins + '</b>' + esc(T('wins1')) + '</span><span class="d"><b>' + r.draws + '</b>' + esc(T('draws1')) + '</span><span class="l"><b>' + r.losses + '</b>' + esc(T('losses1')) + '</span></div>' : '');
      // a guest: the rating lives on this device until they sign in
      if (!signedIn()) { var sv = h('button', { type: 'button', class: 'linkbtn', id: 'btn-ratings-signin' }, esc(T('saveProgress'))); sv.addEventListener('click', function () { setPending({ kind: 'view', v: 'ratings' }); go('signin'); }); my.appendChild(sv); }
    } else {
      my.className += ' out';
      my.appendChild(h('div', { class: 'muted' }, esc(T('signInToRate'))));
      var sb = h('button', { type: 'button', class: 'primary', id: 'btn-ratings-signin' }, esc(T('signIn')));
      sb.addEventListener('click', function () { setPending({ kind: 'view', v: 'ratings' }); go('signin'); });
      my.appendChild(sb);
    }
    inn.appendChild(my);
    var lbc = h('div', { class: 'card lb-card' }), list = h('div', { class: 'lb', id: 'lb-list' });
    lbc.appendChild(h('div', { class: 'lb-head' }, '<span>' + esc(T('lbTop')) + '</span><span class="lb-head-r">' + esc(T('ratingH')) + '</span><span class="lb-head-g">' + esc(T('gamesH')) + '</span>'));
    lbc.appendChild(list); inn.appendChild(lbc);
    list.innerHTML = skeletonRows(8);
    var c = getClient();
    function rowHtml(x, n, mine) {
      var medal = n <= 3 ? ' top top' + n : '';
      return '<button type="button" class="lb-row' + (mine ? ' me' : '') + medal + '" data-uid="' + esc(x.uid || '') + '" data-name="' + esc(x.name) + '"><span class="lb-n"><i>' + n + '</i></span>' + avatarHtml(x.uid, x.name, 'lb-ava') +
        '<span class="lb-name"><span class="lb-nm">' + esc(x.name) + '</span>' + (x.uid ? rankMini(x.uid) : '') + (mine ? ' <em>' + esc(T('lbYou')) + '</em>' : '') + '</span><span class="lb-r">' + x.rating + '</span><span class="lb-g">' + x.games + '</span></button>';
    }
    function placeLine(rank, total) {
      if (!rank || !total) return T('unranked');
      var pct = Math.max(1, Math.round(rank / total * 100));
      return T('placeOf', { n: rank, total: total }) + (total >= 10 && pct <= 50 ? ' \u00b7 ' + T('topPct', { p: pct }) : '');
    }
    (c ? (hasNetSession() ? ensureNet().then(function () { return c.board(pool); }) : c.top(pool).then(function (rows) { return { rows: rows, total: rows.length, rank: null, me: null }; })) : Promise.reject(new Error('offline'))).then(function (b) {
      if (!list.isConnected) return;
      var rows = b.rows || [];
      if (!rows.length) { list.innerHTML = emptyJoker(T('lbEmpty')); return; }
      noteAvatars(rows.concat(b.me ? [b.me] : []).map(function (x) { var o = { id: x.uid, avatar_v: x.avatar_v, xp: x.xp }; if ('pro' in x) { o.pro = x.pro; o.founder = x.founder; } return o; }));
      var html = rows.map(function (x, i) { return rowHtml(x, i + 1, me && x.uid === me.uid); }).join('');
      // below the top: a gap, then my own row with my place
      if (b.me && b.rank) html += '<div class="lb-gap"><i></i><i></i><i></i></div>' + rowHtml(b.me, b.rank, true);
      list.innerHTML = html;
      var pl = $('my-place'); if (pl) pl.textContent = placeLine(b.rank, b.total);
    }, function () { if (list.isConnected) list.innerHTML = '<div class="muted" style="padding:10px 4px">' + esc(T('netError')) + '</div>'; });
    list.addEventListener('click', function (e) { var row = e.target.closest('.lb-row'); if (row && row.dataset.uid) openPlayer(row.dataset.uid, row.dataset.name); });
    if (!me && hasNetSession()) ensureNet().then(function () { if (curView === 'ratings' && me && !my.querySelector('.big')) renderRatings(); }, function () { /* offline */ });
  }
  // grey bars where a list is still loading (the page keeps its shape; the rows fade in over them)
  function skeletonRows(n) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<div class="sk-row" aria-hidden="true"><i class="sk sk-n"></i><i class="sk sk-ava"></i><i class="sk sk-name" style="width:' + (38 + ((i * 37) % 40)) + '%"></i><i class="sk sk-r"></i></div>';
    return '<div class="sk-list">' + out + '</div>';
  }

  // ---- Profile: account, ratings, settings
  // the privacy policy (a static <link rel=privacy-policy> in the page head points there too)
  function privacyUrl() { return NETCFG ? 'privacy.html' : window.GC_SITE ? window.GC_SITE + 'privacy.html' : 'privacy.html'; }
  function renderProfile() {
    var host = $('view-profile');
    host.innerHTML = '';
    var inn = h('div', { class: 'page-in' }); host.appendChild(inn);
    inn.appendChild(h('h1', { class: 'page-h' }, esc(T('navProfile'))));
    var tail = []; // sign out and delete account sit at the end of the page, below the games and settings
    if (NETCFG) {
      if (!me && hasNetSession()) ensureNet().then(function () { if (curView === 'profile') renderProfile(); }, function () { /* offline */ });
      var nm = me && me.profile && signedIn() ? me.profile.username : T('profileGuest');
      var hero = h('div', { class: 'prof-hero' });
      var avb = h('button', { type: 'button', class: 'avatar-lg' + (signedIn() ? ' reg' : ''), id: 'btn-photo', 'aria-label': T('photo') }, (me ? avatarHtml(me.uid, nm, 'ava-lg') : '<span class="ava ava-lg"><i>' + esc(initial(nm)) + '</i></span>') + '<span class="cam">' + CAMERA_SVG + '</span>');
      avb.addEventListener('click', avatarSheet);
      hero.appendChild(avb);
      if (me) photoInput();
      var who = h('div', { class: 'prof-who' });
      var nameEl = h('div', { class: 'prof-name' + (isPro() ? ' pro' : ''), id: 'prof-name' }, '<span>' + esc(nm) + '</span>' + (isPro() ? proMark() : ''));
      who.appendChild(nameEl);
      who.appendChild(h('div', { class: 'prof-sub', id: 'prof-sub' }, esc(signedIn() ? (me.email || '') : T('profileSignedOut'))));
      hero.appendChild(who); inn.appendChild(hero);
      inn.appendChild(statusCard());
      var pe = proEntry(); if (pe) inn.appendChild(pe);
      if (!signedIn()) inn.appendChild(h('div', { class: 'dlg-note status-note', id: 'status-note' }, esc(T('statusGuest'))));
      if (signedIn()) {
        var ch = h('button', { type: 'button', class: 'sbtn name-btn', id: 'btn-rename' }, PENCIL_SVG + '<span>' + esc(T('changeName')) + '</span>');
        ch.addEventListener('click', function () { askName(); });
        who.appendChild(ch);
        var grid = h('div', { class: 'pool-grid' });
        ['bullet', 'blitz', 'rapid'].forEach(function (p) {
          var r = me.ratings[p];
          grid.appendChild(h('div', { class: 'pool-card' }, '<span class="h"><span class="ic-' + p + '">' + POOL_ICON[p] + '</span>' + esc(T(p)) + '</span><span class="r">' + esc(ratingText(p)) + '</span><span class="g">' + esc(r && r.games ? gamesText(r.games) : T('noGamesYet')) + '</span>'));
        });
        inn.appendChild(grid);
        var ec = emailCard(); if (ec) inn.appendChild(ec);
        var so = h('button', { type: 'button', class: 'secondary danger', id: 'btn-signout' }, esc(T('signOut')));
        var soErr = h('div', { class: 'err', id: 'signout-err' });
        so.addEventListener('click', function () {
          if (liveOnlineGame()) { soErr.textContent = T('finishFirst'); return; }
          so.disabled = true;
          doSignOut(function (e) { so.disabled = false; soErr.textContent = authMsg(e); });
        });
        var row = h('div', { class: 'row-btns' }); row.appendChild(so);
        var del = h('button', { type: 'button', class: 'linkbtn del-acct', id: 'btn-delete-acct' }, esc(T('deleteAcct')));
        del.addEventListener('click', confirmDeleteAccount);
        tail.push(row, soErr, del);
      } else {
        var si = h('button', { type: 'button', class: 'primary', id: 'btn-profile-signin' }, esc(T('signIn')));
        si.addEventListener('click', function () { setPending({ kind: 'view', v: 'profile' }); go('signin'); });
        var row2 = h('div', { class: 'row-btns' }); row2.appendChild(si); inn.appendChild(row2);
      }
    }
    if (!NETCFG) { inn.appendChild(statusCard()); var pe0 = proEntry(); if (pe0) inn.appendChild(pe0); }
    profileGames(inn);
    if (NETCFG && me && me.admin && signedIn()) inn.appendChild(statsCard());
    var sc = h('div', { class: 'card', id: 'settings-card' });
    sc.appendChild(h('h2', null, esc(T('settings'))));
    buildSettings(sc, renderProfile);
    var subRow = proSubRow(); if (subRow) sc.appendChild(subRow);
    inn.appendChild(sc);
    tail.forEach(function (x) { inn.appendChild(x); });
    inn.appendChild(h('a', { class: 'page-foot', id: 'home-privacy', href: privacyUrl(), target: '_blank', rel: 'noopener' }, esc(T('privacy'))));
    var ll = h('button', { type: 'button', class: 'linkbtn', id: 'btn-howto' }, esc(T('howItWorks')));
    ll.addEventListener('click', function () { go('learn'); });
    inn.appendChild(ll);
    inn.appendChild(h('div', { class: 'credit' }, esc(T('credit'))));
    // the privacy policy sits next to the site (privacy.html); the offline copies link to the site's one
    var pv = NETCFG ? 'privacy.html' : window.GC_SITE ? window.GC_SITE + 'privacy.html' : '';
    if (pv) inn.appendChild(h('a', { class: 'credit privacy-link', id: 'privacy-link', href: pv, target: '_blank', rel: 'noopener' }, esc(T('privacy'))));
  }
  // ---- the owner's statistics: accounts and how they signed in, who plays online and how much, by day for a month
  var statsCache = null;
  function statsCard() {
    var card = h('div', { class: 'card stats-card', id: 'stats-card' });
    card.appendChild(h('h2', null, esc(T('stats'))));
    var body = h('div', { class: 'stats-body' }, '<div class="muted">' + esc(T('loading')) + '…</div>');
    card.appendChild(body);
    if (me && me.fair) { var fb = h('button', { type: 'button', class: 'linkbtn', id: 'btn-fair-list' }, esc(T('fairOpen'))); fb.addEventListener('click', fairListSheet); card.appendChild(fb); }
    var draw = function (st) {
      var m = st.methods || {}, pools = st.pools || {};
      var tile = function (n, label, sub) { return '<div class="st-tile"><b>' + esc(String(n)) + '</b><span>' + esc(label) + '</span>' + (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>'; };
      var html = '<div class="st-grid">' +
        tile(st.accounts, T('stAccounts'), T('stRegistered', { n: st.registered }) + ', ' + T('stGuests', { n: st.guests })) +
        tile(st.new7, T('stNew7'), T('stNew30', { n: st.new30 })) +
        tile(st.active7, T('stActive7'), T('stActive30', { n: st.active30 })) +
        tile(st.games7, T('stGames7'), T('stGames30', { n: st.games30 }) + ', ' + T('stTotal', { n: st.games })) +
        tile((m.google || 0) + ' / ' + (m.apple || 0) + ' / ' + (m.email || 0), T('stMethods'), '') +
        tile(st.returned, T('stReturned'), T('stLive', { n: st.live }) + ', ' + T('stHouseShare', { n: st.games_house30 })) + '</div>';
      html += '<div class="st-sub">' + esc(T('stPools', { bullet: pools.bullet || 0, blitz: pools.blitz || 0, rapid: pools.rapid || 0 })) + '</div>';
      // from the day log: retention, people a day by platform, cohorts by first day
      if (st.ret) {
        var pc = function (x) { return x && x.of ? Math.round(x.n / x.of * 100) + '%' : '–'; };
        html += '<h3 class="st-h">' + esc(T('stRetH')) + '</h3><div class="st-grid st-grid3">' +
          tile(pc(st.ret.d1), T('stD1'), T('stOf', { n: st.ret.d1.n, of: st.ret.d1.of })) +
          tile(pc(st.ret.d7), T('stD7'), T('stOf', { n: st.ret.d7.n, of: st.ret.d7.of })) +
          tile(pc(st.ret.back), T('stBack'), T('stOf', { n: st.ret.back.n, of: st.ret.back.of })) + '</div>';
      }
      if (st.dau && st.dau.length) {
        var maxD = 1; st.dau.forEach(function (d) { maxD = Math.max(maxD, d.n); });
        var DW = 300, DH = 60, dw = DW / st.dau.length, dsvg = '<svg class="st-chart st-dau" viewBox="0 0 ' + DW + ' ' + DH + '" preserveAspectRatio="none" aria-hidden="true">';
        st.dau.forEach(function (d, i) {
          var y = DH, x = (i * dw + 1).toFixed(1), w = Math.max(1, dw - 2).toFixed(1), other = d.n - d.ios - d.android - d.web;
          [['ios', d.ios], ['android', d.android], ['web', d.web + Math.max(0, other)]].forEach(function (p) {
            if (!p[1]) return; var hh = p[1] / maxD * DH; y -= hh;
            dsvg += '<rect x="' + x + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + hh.toFixed(1) + '" class="pf-' + p[0] + '"/>';
          });
        });
        dsvg += '</svg>';
        html += '<h3 class="st-h">' + esc(T('stDauH')) + '</h3><div class="st-chart-wrap">' + dsvg + '<div class="st-axis"><span>' + esc(st.dau[0].d.slice(5).replace('-', '.')) +
          '</span><span class="st-pf"><i class="pf-ios"></i><i class="pf-android"></i><i class="pf-web"></i>' + esc(T('stDauLegend')) + '</span><span>' + esc(String(maxD)) + '</span></div></div>';
      }
      if (st.cohorts && st.cohorts.length) {
        var cols = T('stCohortCols').split('|');
        html += '<h3 class="st-h">' + esc(T('stCohortH')) + '</h3><div class="st-table-wrap"><table class="st-table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          st.cohorts.slice(0, 14).map(function (c) { return '<tr><td>' + esc(c.d.slice(5).replace('-', '.')) + '</td><td>' + c.size + '</td><td>' + c.d1 + '</td><td>' + c.d7 + '</td><td>' + c.back + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }
      if (st.kinds7) { var k7 = st.kinds7; html += '<div class="st-sub">' + esc(T('stKinds', { online: k7.online || 0, bot: k7.bot || 0, learn: k7.learn || 0, local: k7.local || 0 })) + '</div>'; }
      // a month by day: online games as bars, new accounts as dots on top
      var days = st.days || [], maxG = 1, maxN = 1;
      days.forEach(function (d) { maxG = Math.max(maxG, d.games); maxN = Math.max(maxN, d.new); });
      var W = 300, H = 60, bw = W / Math.max(1, days.length);
      var svg = '<svg class="st-chart" viewBox="0 0 ' + W + ' ' + (H + 14) + '" preserveAspectRatio="none" aria-hidden="true">';
      days.forEach(function (d, i) {
        var hg = Math.round((d.games / maxG) * H), x = i * bw;
        svg += '<rect x="' + (x + 0.5).toFixed(1) + '" y="' + (H - hg) + '" width="' + Math.max(1, bw - 1).toFixed(1) + '" height="' + hg + '" class="bar"/>';
        if (d.new) svg += '<circle cx="' + (x + bw / 2).toFixed(1) + '" cy="' + (H + 7) + '" r="' + (2 + 3 * d.new / maxN).toFixed(1) + '" class="dot"/>';
      });
      svg += '</svg>';
      var first = days.length ? days[0].d.slice(5).replace('-', '.') : '', last = days.length ? days[days.length - 1].d.slice(5).replace('-', '.') : '';
      html += '<div class="st-chart-wrap">' + svg + '<div class="st-axis"><span>' + esc(first) + '</span><span>' + esc(T('stLegend', { g: maxG })) + '</span><span>' + esc(last) + '</span></div></div>';
      body.innerHTML = html;
    };
    var load = function () {
      ensureNet().then(function () { return net.adminStats(); }).then(function (st) { statsCache = { at: Date.now(), st: st }; if (card.isConnected) draw(st); },
        function () { if (card.isConnected) body.innerHTML = '<div class="muted">' + esc(T('netError')) + '</div>'; });
    };
    if (statsCache && Date.now() - statsCache.at < 60000) draw(statsCache.st); else load();
    return card;
  }
  // ---- game history: online games (from the server; anyone may read games) and games against the bots or on one
  // device (kept on the device, newest 200). The score against each opponent, each game's accuracy once reviewed.
  var hist = { items: null, online: [], more: false, loading: false, err: false, filter: null, uid: null, at: 0, h2h: null, opp: null };
  function saveLocalGame() {
    var key = 'l:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var r = { k: key, mode: game.cfg.mode, level: game.cfg.level, bot: game.cfg.bot || null, human: game.cfg.human, tc: game.cfg.tc ? game.cfg.tc.label : null,
      start: game.startFen === GC.START_FEN ? null : game.startFen, moves: game.records.map(function (x) { return x.uci; }),
      result: game.result, reason: game.reason, at: Date.now() };
    var list = load('history', []);
    list.unshift(r); if (list.length > 200) list.length = 200;
    save('history', list); game.histKey = key;
    if (hist.items) histMerge();
  }
  function resultFor(result, c) { return result === '1/2-1/2' ? 0 : (result === '1-0') === (c === 0) ? 1 : -1; }
  function usedGolden(moves, c, startSide) { for (var i = 0; i < moves.length; i++) if (moves[i].indexOf('*') >= 0 && ((i + startSide) & 1) === c) return true; return false; }
  function histFromOnline(g, uid) {
    var c = g.white_id === uid ? 0 : 1, mv = g.moves || [], ss = g.start_fen ? posFromFen(g.start_fen).side : 0;
    return { key: 'o:' + g.id, id: g.id, kind: 'online', at: Date.parse(g.updated_at), color: c, res: resultFor(g.result, c), result: g.result, reason: g.reason,
      opp: { id: c ? g.white_id || 'gone' : g.black_id || 'gone', name: (c ? g.white_name : g.black_name) || '?', rating: c ? g.white_rating : g.black_rating },
      diff: g.rated ? (c ? g.black_diff : g.white_diff) : null, pool: g.pool, tc: (g.tc_base / 60000) + '+' + (g.tc_inc / 1000), golden: usedGolden(mv, c, ss), n: mv.length };
  }
  function histFromLocal(r) {
    var bot = r.mode === 'bot', c = bot ? r.human : 0, ss = r.start ? posFromFen(r.start).side : 0, b = bot ? botOf(r) : null;
    return { key: r.k, kind: r.mode, at: r.at, color: c, res: bot ? resultFor(r.result, c) : null, result: r.result, reason: r.reason,
      opp: bot ? { id: 'bot:' + (b.lv ? b.who : b.level), name: window.GCBots ? GCBots.castName(b.who, lang) : T('bot'), rating: b.elo } : { id: 'two', name: T('vsTwo') },
      tc: r.tc && r.tc !== 'none' ? r.tc : null, golden: usedGolden(r.moves, c, ss), n: r.moves.length, local: r };
  }
  function histMerge() {
    var uid = hist.uid || (me && me.uid), items = hist.online.map(function (g) { return histFromOnline(g, uid); }).concat(load('history', []).map(histFromLocal));
    items.sort(function (a, b) { return b.at - a.at; });
    hist.items = items;
  }
  function loadHistory(more) {
    if (hist.loading) return;
    hist.at = Date.now();
    if (!NETCFG || !(me || hasNetSession())) { hist.online = []; hist.more = false; hist.h2h = null; histMerge(); renderHistViews(); return; }
    hist.loading = true; hist.err = false;
    if (!hist.items) histMerge(); // the games on this device at once
    ensureNet().then(function () {
      var before = more && hist.online.length ? hist.online[hist.online.length - 1].updated_at : null;
      return Promise.all([
        net.history(me.uid, before).then(function (rows) {
          hist.online = (more ? hist.online : []).concat(rows);
          hist.more = rows.length === HIST_PAGE;
        }),
        more ? null : net.h2h(me.uid).then(function (rows) { hist.h2h = rows; }, function () { hist.h2h = null; })
      ]).then(function () { hist.uid = me.uid; });
    }).catch(function () { hist.err = true; }).then(function () {
      hist.loading = false; histMerge(); renderHistViews();
      if (hist.filter && !more) loadOppGames(hist.filter); // the games against the chosen opponent are fresh too
    });
  }
  // all the games against one opponent (not only those among the latest), a page at a time
  function loadOppGames(id, more) {
    var o = hist.opp && hist.opp.id === id ? hist.opp : null;
    if (!net || !me || id.indexOf(':') >= 0 || id === 'gone' || (o && o.loading)) return;
    if (!o || !more) o = hist.opp = { id: id, rows: o && more ? o.rows : [], more: false, loading: false };
    o.loading = true;
    var before = more && o.rows.length ? o.rows[o.rows.length - 1].updated_at : null;
    net.history(me.uid, before, id).then(function (rows) {
      o.rows = (more ? o.rows : []).concat(rows); o.more = rows.length === HIST_PAGE;
    }, function () { /* the games among the latest still show */ }).then(function () { o.loading = false; if (hist.opp === o && curView === 'games') renderGames(); });
  }
  function renderHistViews() { if (curView === 'games') renderGames(); else if (curView === 'profile') renderProfile(); }
  // the score against each opponent (bots by level), most played first: online opponents over all games when the
  // database has added them up, otherwise over the games loaded so far
  function h2hOf(items) {
    var by = {}, out = [], full = !!hist.h2h;
    if (full) hist.h2h.forEach(function (r) {
      var id = r.opp_id || 'gone';
      by[id] = { id: id, name: r.opp_name || '?', w: r.wins, d: r.draws, l: r.losses, n: r.games, at: Date.parse(r.last_at) };
    });
    items.forEach(function (it) {
      if (it.res == null || (full && it.kind === 'online')) return;
      var o = by[it.opp.id] || (by[it.opp.id] = { id: it.opp.id, name: it.opp.name, w: 0, d: 0, l: 0, n: 0, at: 0 });
      o.n++; o.at = Math.max(o.at, it.at);
      if (it.res === 1) o.w++; else if (it.res === -1) o.l++; else o.d++;
    });
    for (var k in by) out.push(by[k]);
    return out.sort(function (a, b) { return b.n - a.n || b.at - a.at; });
  }
  // the score as chess counts a match: a win is a point, a draw half a point to each (6½ : 10½)
  function pts(w, d) { var p = w + d / 2, n = Math.floor(p); return (n || p === n ? String(n) : '') + (p > n ? '½' : ''); }
  function wdlText(o) {
    if (lang !== 'en') return T('wdl', { w: o.w, d: o.d, l: o.l });
    return o.w + (o.w === 1 ? ' win, ' : ' wins, ') + o.d + (o.d === 1 ? ' draw, ' : ' draws, ') + o.l + (o.l === 1 ? ' loss' : ' losses');
  }
  function gamesText(n) { return lang === 'en' && n === 1 ? '1 game' : T('gamesN', { n: n }); }
  // You 6½ : 10½ Boris, and the wins, draws and losses under it (the games page and the result card)
  function scoreHtml(o) {
    return '<div class="gh-score-n"><span class="me">' + esc(T('you')) + '</span><b>' + pts(o.w, o.d) + ' : ' + pts(o.l, o.d) + '</b><span>' + esc(o.name) + '</span></div>' +
      '<em>' + esc(wdlText(o)) + ' · ' + esc(gamesText(o.n)) + '</em>';
  }
  function chipsHtml(opps, all) {
    var s = all ? '<button type="button" class="gh-chip' + (hist.filter ? '' : ' on') + '" data-opp="">' + esc(T('allOpponents')) + '</button>' : '';
    opps.forEach(function (o) {
      s += '<button type="button" class="gh-chip' + (all && hist.filter === o.id ? ' on' : '') + '" data-opp="' + esc(o.id) + '"><b>' + esc(o.name) + '</b><span>' + pts(o.w, o.d) + ':' + pts(o.l, o.d) + '</span></button>';
    });
    return s;
  }
  function dayText(t) {
    var d = new Date(t), now = new Date(), y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var hm = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return T('today') + ' ' + hm;
    if (d.toDateString() === y.toDateString()) return T('yesterday') + ' ' + hm;
    return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  function histRow(it, sums) {
    var rs = sums[it.key], acc = rs && rs.acc ? rs.acc[it.color] : null;
    if (rs && rs.accB && PRO && jkLimited() && !PRO.checkOpen(proJk, it.key)) acc = rs.accB[it.color]; // (the Joker analysis of this game isn't open)
    var mark = it.res === 1 ? ['win', '+'] : it.res === -1 ? ['loss', '−'] : it.res === 0 ? ['draw', '='] : ['two', it.result === '1/2-1/2' ? '½' : it.result === '1-0' ? '1–0' : '0–1'];
    var sub = [];
    if (it.pool) sub.push('<span class="gh-tc ic-' + it.pool + '">' + POOL_ICON[it.pool] + esc(it.tc) + '</span>');
    else if (it.tc) sub.push('<span class="gh-tc">' + esc(it.tc) + '</span>');
    sub.push('<span>' + esc(dayText(it.at)) + '</span>');
    if (it.diff != null) sub.push('<b class="' + (it.diff >= 0 ? 'up' : 'down') + '">' + (it.diff >= 0 ? '+' : '−') + Math.abs(it.diff) + '</b>');
    var right = acc != null ? '<span class="gh-acc" title="' + esc(T('accuracy')) + '">' + acc.toFixed(1) + '</span>' : '<span class="gh-rev" aria-label="' + esc(T('reviewShort')) + '">' + ICON.search + '</span>';
    return '<button type="button" class="gh-row" data-key="' + esc(it.key) + '"><span class="gh-res r-' + mark[0] + '">' + mark[1] + '</span><span class="gh-main"><span class="gh-opp"><b>' +
      esc(it.opp.name) + '</b>' + (it.opp.rating ? '<em>' + it.opp.rating + '</em>' : '') + (it.golden ? '<i class="gh-gold" title="' + esc(T('golden')) + '">' + JOKER_CHIP + '</i>' : '') + '</span><span class="gh-sub">' + sub.join('<i class="gh-dot"></i>') + '</span></span>' + right + '</button>';
  }
  function renderGames() {
    var host = $('view-games');
    host.innerHTML = '';
    var inn = h('div', { class: 'page-in' }); host.appendChild(inn);
    var back = h('button', { type: 'button', class: 'signin-back gh-back', id: 'games-back' }, BACK_SVG + '<span>' + esc(T('navProfile')) + '</span>');
    back.addEventListener('click', function () { go('profile'); });
    inn.appendChild(back);
    inn.appendChild(h('h1', { class: 'page-h' }, esc(T('games'))));
    if (!hist.items) { inn.appendChild(h('div', { class: 'card' }, skeletonRows(6))); return; }
    var items = hist.items, opps = h2hOf(items), sums = load('reviewSums', {});
    if (opps.length) inn.appendChild(h('div', { class: 'gh-chips', id: 'gh-chips' }, chipsHtml(opps.slice(0, 12), true)));
    var oppMore = false;
    if (hist.filter) {
      var o = opps.filter(function (x) { return x.id === hist.filter; })[0], seen = {};
      items = items.filter(function (it) { return it.opp.id === hist.filter; });
      if (hist.opp && hist.opp.id === hist.filter) {
        items.forEach(function (it) { seen[it.key] = 1; });
        hist.opp.rows.forEach(function (g) { var it = histFromOnline(g, hist.uid || me.uid); if (!seen[it.key]) { seen[it.key] = 1; items.push(it); } });
        items.sort(function (a, b) { return b.at - a.at; });
        oppMore = hist.opp.more;
      }
      if (o) {
        var sc = h('div', { class: 'gh-score', id: 'gh-score' }, scoreHtml(o));
        if (o.id && o.id !== 'gone' && o.id.indexOf(':') < 0) { var pb = h('button', { type: 'button', class: 'sbtn', id: 'btn-opp-profile' }, esc(T('viewProfile'))); pb.addEventListener('click', function () { openPlayer(o.id, o.name); }); sc.appendChild(pb); }
        inn.appendChild(sc);
      }
    }
    var list = h('div', { class: 'gh-list', id: 'gh-list' }, items.map(function (it) { return histRow(it, sums); }).join(''));
    inn.appendChild(list);
    if (!items.length) inn.appendChild(hist.loading ? h('div', { class: 'card' }, skeletonRows(6)) : h('div', { class: 'gh-empty' }, emptyJoker(T('noGames'))));
    if (hist.err) inn.appendChild(h('div', { class: 'err' }, esc(T('netError'))));
    if (hist.filter ? oppMore : hist.more) {
      var more = h('button', { type: 'button', class: 'secondary gh-more', id: 'btn-more-games' }, esc(T('showMore')));
      more.disabled = hist.filter ? hist.opp.loading : hist.loading;
      more.addEventListener('click', function () { if (hist.filter) loadOppGames(hist.filter, true); else loadHistory(true); renderGames(); });
      inn.appendChild(more);
    }
  }
  // Profile: the last few games and the way to all of them
  function profileGames(inn) {
    // still loading (a signed-in player): the card keeps its place with grey rows
    if (!hist.items && hist.loading && signedIn()) { var sk = h('div', { class: 'card gh-card', id: 'profile-games' }); sk.appendChild(h('h2', null, esc(T('games')))); sk.innerHTML += skeletonRows(3); inn.appendChild(sk); return; }
    if (!hist.items || !hist.items.length) return;
    var card = h('div', { class: 'card gh-card', id: 'profile-games' });
    card.appendChild(h('h2', null, esc(T('games'))));
    // the score against each opponent at a glance; a chip opens all the games against that opponent
    var opps = h2hOf(hist.items);
    if (opps.length) card.appendChild(h('div', { class: 'gh-chips', id: 'profile-chips' }, chipsHtml(opps.slice(0, 8), false)));
    card.appendChild(h('div', { class: 'gh-list' }, hist.items.slice(0, 4).map(function (it) { return histRow(it, load('reviewSums', {})); }).join('')));
    var all = h('button', { type: 'button', class: 'secondary', id: 'btn-all-games' }, esc(T('allGames')));
    all.addEventListener('click', function () { hist.filter = null; go('games'); });
    card.appendChild(all);
    inn.appendChild(card);
  }
  function onHistClick(e) {
    var row = e.target.closest('.gh-row');
    if (row) { openHistory(row.dataset.key); return; }
    var chip = e.target.closest('.gh-chip');
    if (chip) openOppGames(chip.dataset.opp || null);
  }
  // the games page for one opponent (or everyone): the score card and all the games against them
  function openOppGames(id) {
    hist.filter = id;
    if (id) loadOppGames(id);
    if (curView === 'games') renderGames(); else go('games');
  }
  // open a past game on the board, with its review
  function openHistory(key) {
    var it = hist.items && hist.items.filter(function (x) { return x.key === key; })[0];
    if (!it && hist.opp && key.indexOf('o:') === 0) it = { kind: 'online', id: key.slice(2) };
    if (!it) return;
    if (liveOnlineGame()) { toast(T('finishFirst')); return; } // a game in progress stays on the board
    if (it.kind === 'online') { openOnlineGame(it.id, function () { if (game) game.fromHistory = true; renderNav(); renderSide(); showReport(); }); return; }
    openArchived(it.local);
    showReport();
  }
  function openArchived(r) {
    cancelLobby(); leaveOnline(); cancelBot(); bot.cancel(); bot.clear();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion(); plyBoards = {}; explore = null; posCache = {};
    stopReview(); review = null;
    if (analysis.on) setAnalysis(false);
    var g = new Game({ mode: r.mode, level: r.level, bot: r.bot || null, human: r.human, tc: null }, r.start || GC.START_FEN), now = perf();
    g.clock = null;
    for (var i = 0; i < r.moves.length; i++) { var m = g.pos.moveFromUci(r.moves[i]); if (!m) break; g.play(m, now); }
    g.status = 'over'; g.result = r.result; g.reason = r.reason; g.counted = true; g.archived = true; g.fromHistory = true; g.histKey = r.k;
    game = g; view = g.records.length; setGoldenArmed(false);
    orient = r.mode === 'bot' ? r.human : 0; board.setOrientation(orient); board.sync(game.pos.board, [], { instantAll: true });
    go('game'); renderAll(); layout();
  }
  // back from a past game: the game saved on this device (or a fresh board)
  function restoreSavedGame() {
    stopReview(); review = null; explore = null; posCache = {}; plyBoards = {};
    if (analysis.on) setAnalysis(false);
    var d = load('game', null), g = d ? Game.restore(d) : null;
    if (!g) { g = new Game({ mode: 'bot', level: lastSetup.level || 3, bot: lastSetup.bot || null, human: 0, tc: null }); g.idle = true; }
    game = g; view = g.idle ? 0 : g.records.length;
    orient = botGame() ? game.cfg.human : 0; board.setOrientation(orient); board.sync(game.pos.board, [], { instantAll: true });
  }

  // ---- a player's page: ratings by pool, recent games (opened for review), the score against you; public data,
  // so it opens for anyone. An account run by the developer says so at the bottom.
  var player = null; // { uid, name, back, prof, ratings, rows, more, loading, err, h2h }
  function openPlayer(uid, name) {
    if (!uid || uid === 'gone' || uid.indexOf(':') >= 0 || !NETCFG) return;
    if (player && player.uid === uid && curView === 'player') return;
    var p = player = { uid: uid, name: name || '', back: curView === 'player' ? player.back : curView, prof: null, ratings: null, rows: null, more: false, loading: true, err: false, h2h: null };
    go('player');
    var c = getClient();
    Promise.all([c.player(uid), c.history(uid), me && me.uid !== uid && net ? net.h2h(me.uid).catch(function () { return []; }) : []]).then(function (r) {
      if (player !== p) return;
      p.prof = r[0].profile; p.ratings = r[0].ratings || []; p.rows = r[1] || []; p.more = p.rows.length === HIST_PAGE;
      p.h2h = (r[2] || []).filter(function (x) { return x.opp_id === uid; })[0] || null;
      p.loading = false;
      if (curView === 'player') renderPlayer();
    }, function () { if (player !== p) return; p.loading = false; p.err = true; if (curView === 'player') renderPlayer(); });
  }
  function loadPlayerMore() {
    var p = player;
    if (!p || p.loading || !p.rows || !p.rows.length) return;
    p.loading = true; renderPlayer();
    getClient().history(p.uid, p.rows[p.rows.length - 1].updated_at).then(function (rows) {
      if (player !== p) return;
      p.rows = p.rows.concat(rows); p.more = rows.length === HIST_PAGE; p.loading = false;
      if (curView === 'player') renderPlayer();
    }, function () { if (player === p) { p.loading = false; if (curView === 'player') renderPlayer(); } });
  }
  function playerBack() {
    var b = player && player.back;
    if (b === 'game' && game && (game.online || !game.idle)) { go('game'); return; }
    go(b && (NAV.indexOf(b) >= 0 || b === 'games') ? b : 'ratings');
  }
  function monthYear(iso) { try { return new Date(iso).toLocaleDateString(lang, { month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function renderPlayer() {
    var host = $('view-player'), p = player;
    host.innerHTML = '';
    if (!p) return;
    var inn = h('div', { class: 'page-in' }); host.appendChild(inn);
    var back = h('button', { type: 'button', class: 'signin-back gh-back', id: 'player-back' }, BACK_SVG + '<span>' + esc(T('back')) + '</span>');
    back.addEventListener('click', playerBack);
    inn.appendChild(back);
    var name = (p.prof && p.prof.username) || p.name || '?';
    var head = h('div', { class: 'pl-head' });
    if (p.prof) noteAvatars([p.prof]);
    // the status: the rank badge and its name (a player's own from this device, another's from their profile)
    var pxp = me && p.uid === me.uid ? prog.xp : p.prof && p.prof.xp > 0 ? p.prof.xp : 0, plv = pxp > 0 || (me && p.uid === me.uid) ? Progress.levelOf(pxp).level : 0;
    head.innerHTML = '<div class="pl-avatar">' + avatarHtml(p.uid, name, 'ava-lg') + '</div><div class="pl-who"><h1 class="page-h">' + esc(name) + '</h1>' +
      (plv ? '<div class="pl-rank" id="pl-rank">' + rankBadge(plv, 'mini') + '<span>' + esc(Progress.rankName(lang, plv) + ' · ' + PT('level', { n: plv })) + '</span></div>' : '') +
      (p.prof && p.prof.created_at ? '<div class="muted">' + esc(T('memberSince', { d: monthYear(p.prof.created_at) })) + '</div>' : '') + '</div>';
    inn.appendChild(head);
    if (p.loading && !p.prof) { inn.appendChild(h('div', { class: 'card' }, skeletonRows(4))); return; }
    if (p.err) { inn.appendChild(h('div', { class: 'err' }, esc(T('netError')))); return; }
    var rc = h('div', { class: 'card pl-ratings', id: 'pl-ratings' });
    rc.innerHTML = ['bullet', 'blitz', 'rapid'].map(function (pool) {
      var r = (p.ratings || []).filter(function (x) { return x.pool === pool; })[0], on = r && r.games > 0;
      return '<div class="pl-pool' + (on ? '' : ' off') + '"><span class="pl-pool-n ic-' + pool + '">' + POOL_ICON[pool] + esc(T(pool)) + '</span><b>' + (on ? Math.round(r.rating) : '–') + '</b>' +
        '<span class="muted" title="' + esc(on ? T('wdl', { w: r.wins, d: r.draws, l: r.losses }) : '') + '">' + esc(on ? gamesText(r.games) : T('noGamesYet')) + '</span></div>';
    }).join('');
    inn.appendChild(rc);
    if (p.h2h && p.h2h.games) inn.appendChild(h('div', { class: 'gh-score', id: 'pl-score' }, scoreHtml({ name: name, w: p.h2h.wins, d: p.h2h.draws, l: p.h2h.losses, n: p.h2h.games })));
    var gc = h('div', { class: 'card gh-card', id: 'pl-games' });
    gc.appendChild(h('h2', null, esc(T('recentGames'))));
    var items = (p.rows || []).map(function (g) { return histFromOnline(g, p.uid); });
    if (items.length) gc.appendChild(h('div', { class: 'gh-list' }, items.map(function (it) { return histRow(it, {}); }).join('')));
    else if (p.loading) gc.innerHTML += skeletonRows(3);
    else gc.appendChild(h('div', { class: 'muted gh-empty' }, esc(T('noGamesYet'))));
    if (p.more) {
      var more = h('button', { type: 'button', class: 'secondary gh-more', id: 'btn-more-player' }, esc(T('showMore')));
      more.disabled = p.loading; more.addEventListener('click', loadPlayerMore); gc.appendChild(more);
    }
    inn.appendChild(gc);
    if (p.prof && p.prof.house) inn.appendChild(h('div', { class: 'house-note pl-note', id: 'house-note' }, esc(T('houseNote'))));
  }
  // a game on a player's page opens on the board with its review; back leads to the page
  $('view-player').addEventListener('click', function (e) {
    var row = e.target.closest('.gh-row'); if (!row || !row.dataset.key || row.dataset.key.indexOf('o:') !== 0) return;
    if (liveOnlineGame()) { toast(T('finishFirst')); return; }
    openOnlineGame(row.dataset.key.slice(2), function () { if (game) { game.fromHistory = true; game.fromPlayer = true; } renderNav(); renderSide(); showReport(); });
  });

  // ---- Learn
  function renderLearn() {
    var k = kit();
    if (!k) { $('view-learn').innerHTML = ''; return; }
    k.render($('view-learn'));
    k.active(curView);
  }

  function mobileOs() { var u = navigator.userAgent || ''; return /iPhone|iPad|iPod|Android/i.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? (/Android/i.test(u) ? 'android' : 'ios') : ''; }
  var STORE = { ios: 'https://apps.apple.com/app/id6828439421', android: 'https://play.google.com/store/apps/details?id=com.kozyramedia.goldenchess' };
  // an invite opened in a phone's browser: open it in the app (one tap), or play right here. The app's own address
  // (goldenchess://auth?...) is the one the installed builds already answer to
  function askOpenInApp(kind, id) {
    function here() { closeDialog(); if (kind === 'join') requireAccount({ kind: 'join', id: id }); else openOnlineGame(id); }
    openDialog(function (card) {
      currentDialog.dataset.kind = 'open-in-app';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('appAskT'))));
      var sub = h('div', { class: 'dlg-sub' }, esc(T('appAskSub')));
      card.appendChild(sub);
      var open = h('button', { type: 'button', class: 'primary', id: 'btn-open-app' }, esc(T('openApp')));
      var web = h('button', { type: 'button', class: 'sbtn wide', id: 'btn-play-here' }, esc(T('playHere')));
      var noApp = false;
      open.addEventListener('click', function () {
        if (noApp) { location.href = STORE[mobileOs()] || STORE.ios; return; }
        var left = false, onHide = function () { if (document.hidden) left = true; };
        document.addEventListener('visibilitychange', onHide);
        location.href = 'goldenchess://auth?' + kind + '=' + encodeURIComponent(id);
        // still here a moment later: no app on this phone. Offer the store, keep playing here as the other way
        setTimeout(function () {
          document.removeEventListener('visibilitychange', onHide);
          if (left || document.hidden) return;
          noApp = true; sub.textContent = T('noAppT'); open.textContent = T('getApp');
        }, 1600);
      });
      web.addEventListener('click', here);
      card.appendChild(open); card.appendChild(web);
    });
  }
  function bootOnline() {
    if (!NETCFG) return;
    var join = urlQ.get('join'), gid = urlQ.get('game'), saved = load('online', null), note = load('notice', null);
    if (note) {
      // the page was reloaded after signing in to another account, or after signing out
      save('notice', null);
      ensureNet().then(function () {
        if (note === 'signedOut') toast(T('signedOutToast'));
        else if (note === 'deleted') toast(T('deletedToast'));
        else if (note === 'merged') toast(T('accountsMerged'));
        else {
          toast(signedIn() ? T('signedInAs', { email: me.email || '' }) : T('signInFailed'));
          if (signedIn()) signedInNext();
        }
        refreshView();
      }, function () { /* offline */ });
    }
    var fromLink = authReturn();
    if (googleBack) { googleIdReturn(function (k) { return googleBack.get(k) || ''; }); googleBack = null; fromLink = true; }
    if ((join || gid) && !NATIVE.on && mobileOs()) { askOpenInApp(join ? 'join' : 'game', join || gid); return; }
    if (join) { requireAccount({ kind: 'join', id: join }); return; }
    if (gid) { openOnlineGame(gid); return; }
    if (fromLink || note || (saved && saved.id) || hasNetSession()) {
      ensureNet().then(function (r) {
        if (r.live && r.live.status === 'playing') openOnlineGame(r.live.id);
        else if (saved && saved.id) save('online', null);
        if (curView !== 'game') refreshView(); // the name and rating on the Play tab
        if (!(r.live && r.live.status === 'playing')) maybeAskName();
      }, function () { /* offline: stay with the local game */ });
    }
  }

  // ------------------------------------------------------------------ the launch intro
  // The app only: it takes over from the native splash (same picture). The website has no intro. A tap ends it early;
  // reduced motion skips it.
  // A tab whose content (almost) fits the screen doesn't scroll at all: no few-pixel wobble under the finger.
  // Watched as the content changes size (a page re-rendered, a list loaded, the window resized).
  function fitPages() {
    if (typeof ResizeObserver === 'undefined') return;
    // Play and Bots are one-screen pages on a phone: when they come out a little taller than the screen (a short
    // phone, the status bar and the home bar taking their share), the reel board gets smaller / the gaps tighter
    function squeeze(pg) {
      if (window.innerWidth >= 768) { pg.classList.remove('tight'); return; }
      var reel = pg.querySelector('.play-reel');
      if (reel) {
        reel.style.width = '';
        var d = pg.scrollHeight - pg.clientHeight;
        if (d > 0) reel.style.width = Math.max(170, reel.offsetWidth - d - 2) + 'px';
      }
      if (pg.id === 'view-bots') {
        pg.classList.remove('tight');
        var d2 = pg.scrollHeight - pg.clientHeight;
        if (d2 > 0 && d2 <= 140) pg.classList.add('tight');
      }
    }
    function fit(pg) {
      if (pg.id === 'view-play' || pg.id === 'view-bots') squeeze(pg);
      var fits = pg.scrollHeight - pg.clientHeight <= 12 && !pg.classList.contains('snap');
      if (fits && pg.scrollTop) pg.scrollTop = 0;
      pg.classList.toggle('fits', fits);
    }
    var ro = new ResizeObserver(function (ents) { ents.forEach(function (en) { var pg = en.target.classList.contains('page') ? en.target : en.target.parentNode; if (pg && pg.classList && pg.classList.contains('page')) fit(pg); }); });
    var mo = new MutationObserver(function (muts) { muts.forEach(function (m) { [].forEach.call(m.addedNodes, function (c) { if (c.nodeType === 1) ro.observe(c); }); fit(m.target); }); });
    document.querySelectorAll('.page').forEach(function (pg) {
      ro.observe(pg); [].forEach.call(pg.children, function (c) { ro.observe(c); });
      mo.observe(pg, { childList: true });
    });
  }
  function intro() {
    var el = $('intro'); if (!el) return;
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var want = NATIVE.on && !reduced && !navigator.webdriver && !AUTH_HASH.test(location.hash || '');
    if (!want) { el.remove(); return; }
    el.hidden = false; el.classList.add('run');
    if (NATIVE.on) NATIVE.call('SplashScreen', 'hide', { fadeOutDuration: 150 }).catch(function () { /* no plugin */ });
    var done = false;
    function end() { if (done) return; done = true; el.classList.add('out'); setTimeout(function () { el.remove(); }, 450); }
    el.addEventListener('click', end);
    setTimeout(end, 2200);
  }

  // ------------------------------------------------------------------ boot
  function boot(hotData) {
    applySettings(); applyLang(); nativeInit(); intro(); fitPages();
    var saved = (hotData && hotData.game) || load('game', null), g = saved ? Game.restore(saved) : null;
    if (g) {
      game = g; view = game.records.length;
      orient = botGame() ? game.cfg.human : 0;
    } else {
      // nothing played yet: an empty board for the game view
      game = new Game({ mode: 'bot', level: lastSetup.level || 3, bot: lastSetup.bot || null, human: 0, tc: null });
      game.idle = true; view = 0; orient = 0;
    }
    board.setOrientation(orient);
    board.sync(game.pos.board, [], { instantAll: true });
    renderAll();
    var v0 = viewFromUrl();
    // a sign-in link returns with tokens (or an error) in the hash: leave the address alone until the auth client has read it
    if (AUTH_HASH.test(location.hash || '')) showView('play');
    else go(v0 && allowed(v0) ? v0 : 'play', true);
    if (game.status === 'playing' && botGame() && !game.idle && game.pos.side !== game.cfg.human) requestBot();
    loop();
    bootOnline();
    noteVisit();
    clearShownReminders();
    setTimeout(planReminders, 1500);
    // notifications already allowed on this phone (Android 12 and older allow them unless turned off): the reminders
    // are on without an ask; Settings turns them off
    if (NATIVE.on && NATIVE.has('LocalNotifications') && settings.reminders == null) {
      NATIVE.call('LocalNotifications', 'checkPermissions').then(function (p) {
        if (!p || p.display !== 'granted' || settings.reminders != null) return;
        settings.reminders = true; saveSettings(); planReminders(); Track.event('reminders', { on: true, reason: 'allowed' });
      }, function () { /* asked after a game instead */ });
    }
    NATIVE.listen('LocalNotifications', 'localNotificationActionPerformed', function (e) {
      var x = e && e.notification && e.notification.extra, v = x && x.go;
      Track.event('reminder_open', { kind: (x && x.kind) || '' });
      if (v && allowed(v) && !liveOnlineGame() && curView !== 'game') go(v);
    });
    if (window.GC_PROTO) {
      protoTour();
      // the Pro prototype says what it is the first time it opens: the list of its screens
      if (proAvail() && !load('protoSeen', false)) { save('protoSeen', true); setTimeout(function () { if (!currentDialog && curView !== 'game') protoSheet(); }, 700); }
    }
    if (PROTO_PRO && proState && !isPro()) proOff(); // (the prototype) Pro has run out: its looks go back in the box
    // Pro never stands in the way of the game starting
    if (PRO && !PROTO_PRO) { try { proOfferStart(); proPublicAsk(); proReturn(); iapStart(); } catch (e) { /* the game goes on without it */ } }
    if (proFreezeCheck()) refreshView();
    Track.start();
    setTimeout(Track.ask, 2500);
  }
  var hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(function () { return { game: game && !game.online ? game.serialize() : null }; }); } catch (e) { /* ignore */ } }
  if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot(hot && hot.data);

  // test hooks (used by the automated stress test; harmless for players)
  window.__gc = {
    get game() { return game; }, board: board, get premoves() { return premoves; }, get view() { return view; },
    displayBoard: displayBoard, startGame: startGame, gotoPly: gotoPly, tryMove: tryMove, setGoldenArmed: setGoldenArmed, flip: flip,
    takeback: takeback, onGoldenButton: onGoldenButton, setAnalysis: setAnalysis, get botBusy() { return !!botReq; }, settings: settings, applySettings: applySettings,
    premoveDests: premoveDests, viewFen: function () { return viewFen(); }, get reviewState() { return review; }, get exploreState() { return explore; }, startReview: startReview, exitExplore: exitExplore, navStep: navStep,
    get goldenArmed() { return goldenArmed; }, get selected() { return selected; }, get dialogOpen() { return !!currentDialog; }, closeDialog: closeDialog,
    startCareer: function (ch) { startCareer(ch); }, gameOver: function () { gameOver(); }, get prog() { return prog; }, progPush: function () { return progPush(); }, cancelBot: function () { cancelBot(); },
    get dialogKind() { return currentDialog ? currentDialog.dataset.kind || '' : null; },
    get pro() { return { on: isPro(), sells: proSells(), avail: proAvail(), founder: proFounder(), jk: proJk, offer: proOf, tally: proTally, info: proInfo, blind: !!(review && review.blind),
      via: PRO ? proVia() : null, store: PRO ? { here: iapHere(), allowed: iapAllowed(), on: iapOn(), plans: iapPlans() } : null }; },
    proSheet: function (why, vars) { proSheet(why, vars); }, proStatus: function () { proStatus(); }, proOfferSheet: function (id) { proOfferSheet(id); }, proOfferDue: function (plain) { return proOfferDue(plain); },
    afterGameAsk: function () { afterGameAsk(); },
    get online() { return online; }, get me() { return me; }, get lobby() { return lobby; }, startSeek: startSeek, startInvite: startInvite,
    onlineAction: onlineAction, showNewGame: showNewGame, serverNow: serverNow, cancelPremoves: cancelPremoves,
    showAccount: showAccount, showSettings: showSettings, showOver: showOver, showReport: showReport,
    go: go, get curView() { return curView; }, showBotSetup: showBotSetup, showLocalSetup: showLocalSetup, botThinkMs: botThinkMs,
    historyStale: function () { hist.at = 0; },
    pts: pts, rematch: rematch, oppCard: oppCard,
    away: function (flag) { window.__gcAway = !!flag; onVisibility(); }, GONE_MS: GONE_MS, SEEN_MS: SEEN_MS
  };
})();
