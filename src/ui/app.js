/* Golden Chess — game controller and UI.
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
      golden: 'Golden move', goldenOnce: 'once per game', goldenPick: 'pick a queen, rook, bishop or knight', goldenTap: 'tap a gold dot',
      goldenOn: 'Golden move on', goldenUsedT: 'Golden move used', goldenUsedOn: '{san} on move {n}', goldenQueued: 'queued as a premove',
      goldenWhiteOnce: 'White: once per game', goldenBlackOnce: 'Black: once per game',
      goldenOnly: 'Only a queen, rook, bishop or knight can make the golden move', goldenGone: 'Your golden move is already used',
      goldenArmedToast: 'Golden move on: pick a piece, then a gold dot', goldenPlayed: '{side} played the golden move {san}',
      you: 'You', bot: 'Golden Bot', white: 'White', black: 'Black', level: 'Level {n}',
      lv1: 'Beginner', lv2: 'Casual', lv3: 'Club player', lv4: 'Strong club', lv5: 'Expert', lv6: 'Master', lv7: 'Grandmaster', lv8: 'Maximum',
      opponent: 'Opponent', computer: 'Computer', twoPlayers: 'Two players, one device', playAs: 'Play as', random: 'Random',
      timeControl: 'Time control', noClock: 'No clock', strength: 'Bot strength', play: 'Play',
      record: 'Your score vs level {n}: {w} won, {d} drawn, {l} lost', recordNone: 'No games vs level {n} yet',
      resign: 'Resign', resignQ: 'Resign this game?', resignSub: 'The game ends and counts as a loss.', cancel: 'Cancel', abort: 'Abort game',
      takeback: 'Take back move', flip: 'Flip board', analyze: 'Analyze with engine', analyzeOff: 'Hide engine analysis', copyPgn: 'Copy PGN', rematch: 'Rematch',
      youWon: 'You won', youLost: 'You lost', draw: 'Draw', whiteWon: 'White won', blackWon: 'Black won',
      r_checkmate: 'by checkmate', r_resign: 'by resignation', r_timeout: 'on time', r_stalemate: 'Stalemate', r_repetition: 'Threefold repetition',
      r_fifty: '50-move rule', r_insufficient: 'Insufficient material', 'r_timeout-insufficient': 'Time ran out, but the opponent has too little material to mate', r_abort: 'Game aborted',
      premoveCancelled: 'Premove cancelled', pgnCopied: 'PGN copied', pgnManual: 'Copy the PGN below',
      movesEmpty: 'Moves appear here. Golden moves are marked with a star.', movesEmptyShort: 'Moves appear here', yourMove: 'Your move', botThinking: 'Golden Bot is thinking', whiteMove: 'White to move', blackMove: 'Black to move',
      best: 'Best', depth: 'depth {n}', mateIn: 'mate in {n}', mated: 'checkmate', noMoves: 'No legal moves', analysisStarting: 'Engine is thinking',
      sound: 'Sound', animation: 'Animation', animFast: 'Fast', animNormal: 'Normal', animOff: 'Off', boardTheme: 'Board', thSlate: 'Slate', thWalnut: 'Walnut', thMarble: 'Marble',
      coords: 'Coordinates', autoQueen: 'Always promote to queen', premoves: 'Premoves', language: 'Language', done: 'Done',
      rulesTitle: 'The golden move', rulesIntro: 'Regular chess, plus one golden move for each player, once per game.',
      rule1: 'Teleport your queen, rook, bishop or knight to any empty square.',
      rule2: 'No capture, and no check: after the golden move the opponent’s king must not be in check.',
      rule3: 'You can use it to block a check from a rook, bishop or queen. Your own king must be safe afterwards.',
      rule4: 'It is your whole move for that turn. Kings and pawns cannot make it.',
      rule5: 'Everything else is standard chess: castling, en passant, promotion. A rook that teleports loses its castling right.',
      howto: 'Tap <b>Golden move</b> (or press G), pick a piece, then tap a gold dot. It also works as a premove.',
      credit: 'Pieces: cburnett set by Colin M. L. Burnett (GPL / BSD). Engine, rules and sounds made for Golden Chess.',
      movesPlayed: 'Moves', goldenBy: 'Golden moves', none: 'none', vsBot: 'vs Golden Bot, level {n}', passPlay: 'Two players', unlimited: 'no clock',
      viewing: 'Viewing move {n}. Tap the board to return to the game.',
      variation: 'Variation', backToGame: 'Back to game', review: 'Game review', analyzeOn: 'Show engine', reviewing: 'Reviewing the game: {i} of {n}',
      accuracy: 'Accuracy', estElo: 'Est. Elo', played: 'played', bestWas: 'best was', c_best: 'Best move', c_excellent: 'Excellent', c_good: 'Good',
      c_inaccuracy: 'Inaccuracy', c_mistake: 'Mistake', c_blunder: 'Blunder', goldenTag: 'golden', tooShort: 'too short to rate',
      reviewHint: 'Tap the graph or step through the moves. You can also move pieces to try your own lines.',
      eloApprox: '\u2248{n} Elo',
      online: 'Online', findOpp: 'Find opponent', invite: 'Invite a friend', searching: 'Looking for an opponent', rated: 'Rated', casual: 'Casual',
      playingAs: 'Playing as', change: 'Change', save: 'Save', nameTaken: 'That name is taken', badName: 'Use 2\u201320 letters, digits, spaces, _ or -',
      inviteSub: 'Send this link to a friend. The game starts when they open it.', copyLink: 'Copy link', linkCopied: 'Link copied', share: 'Share',
      shareText: 'Play Golden Chess with me', waitingFriend: 'Waiting for your friend', connecting: 'Connecting', netError: 'Can\u2019t reach the server. Check your connection and try again.',
      oppMove: 'Opponent\u2019s move', offerDraw: 'Offer draw', drawOffered: 'Draw offered', drawDeclined: 'Draw declined', oppOffersDraw: '{name} offers a draw',
      acceptDraw: 'Accept draw', declineDraw: 'Decline draw', accept: 'Accept', decline: 'Decline', rematchSent: 'Rematch offered', acceptRematch: 'Accept rematch',
      oppWantsRematch: '{name} wants a rematch', newOpponent: 'New opponent', ratingWord: 'Rating', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid',
      ratedLine: 'Rated {pool}', casualLine: 'Casual {pool}', yourRating: 'Your {pool} rating: {r}', firstMove: '{side}: first move within {s} s',
      r_agreement: 'by agreement', gameTaken: 'This game has already started, you are watching it', noGame: 'Game not found',
      stillPlaying: 'Your online game is still running. Starting another game leaves it, and your clock keeps ticking.',
      reconnecting: 'Reconnecting\u2026', connected: 'Online', disconnected: 'Left the game', leaderboard: 'Top players', lbEmpty: 'No rated games yet. Be the first.',
      gamesN: '{n} games', casualNote: 'Casual game: ratings don\u2019t change.', onlineElsewhere: 'Online games and ratings:', appOffline: 'No internet. Bots and two players on one phone work without it.', reconnect: 'Try again', privacy: 'Privacy policy',
      account: 'Account', signIn: 'Sign in', emailLabel: 'Email', sendCode: 'Send code', sending: 'Sending', manage: 'Manage',
      signInSub: 'Enter your email to keep your name, rating and games, or to sign in to your account on this device. We\u2019ll send you a code.',
      codeTitle: 'Enter the code', codeSub: 'We sent a code to {email}. Type it here, or open the link from the email on this device.',
      existingNote: 'This email already has an account. You\u2019ll switch to it; this guest\u2019s games and rating stay behind.',
      confirm: 'Confirm', checking: 'Checking', resend: 'Send again', resendIn: 'Send again in {s} s', otherEmail: 'Use a different email',
      signedInAs: 'Signed in as {email}', signedSub: 'Your name, rating and games are saved to this account. Sign in with this email on any device.',
      signOut: 'Sign out', signedOutToast: 'Signed out. You\u2019re playing as a new guest.', progressSaved: 'Progress saved',
      emailInvalid: 'Enter a valid email address', codeWrong: 'That code is wrong or has expired', tooMany: 'Too many tries. Wait a minute and try again.',
      sendFailed: 'Couldn\u2019t send the email. Try again later.', finishFirst: 'Finish your online game first',
      linkExpired: 'That sign-in link has expired. Ask for a new code.', signInFailed: 'Couldn\u2019t sign in. Try again.',
      continueGoogle: 'Continue with Google', or: 'or', googleExists: 'You already have a player with this Google email. Signing in to it\u2026',
      guestNote: 'Guest: your rating is kept on this device only.', saveProgress: 'Save progress',
      guestRatingNote: 'Your rating is kept on this device only. Add your email to keep it.',
      back: 'Back', navPlay: 'Play', navLearn: 'Learn', navRatings: 'Ratings', navProfile: 'Profile',
      startGame: 'Start Game', playFriend: 'Play a Friend', playFriendSub: 'Send a link, the game starts when they open it',
      playBot: 'Play a Bot', playBotSub: 'Eight levels, from 600 to 2500 Elo', passPlay: 'Two Players', passPlaySub: 'Take turns on one device',
      more: 'More', gameOn: 'Your game is on', returnBtn: 'Return', continueGame: 'Continue your game', cont: 'Continue', vsName: 'vs {name}',
      signInToRate: 'Sign in to play online and get a rating', ratingIn: '{pool} rating: {r}', botSetupTitle: 'Play a bot',
      signInTitle: 'Sign in to play', signInPageSub: 'It\u2019s free, with no password: we email you a code. Your rating and games stay with your account on any device.',
      practise: 'Just practising?', playTheBot: 'Play the bot without an account',
      nameTitle: 'Choose your name', nameSub: 'Opponents and the ratings will see it. You can change it later.', signedInTitle: 'You\u2019re signed in',
      yourRating: 'Your rating', wdl: '{w} wins, {d} draws, {l} losses', provisional: 'provisional', noGamesYet: 'no games yet',
      profileGuest: 'Guest', profileSignedOut: 'Sign in to play online. Your rating and games are saved to your account.', howItWorks: 'How the golden move works',
      learnTitle: 'One move that changes the game',
      learnLead: 'Golden Chess is regular chess with one extra move for each player: once per game, teleport your queen, rook, bishop or knight to any empty square.',
      heroCap1: 'White still has the golden move. Black\u2019s queen stands right in front of the king.',
      heroCap2: '<b>Golden move:</b> the rook teleports to e1 and pins the queen to the king.', heroCap3: 'The king steps aside, and the queen is lost.',
      ruleH: 'The rule', r1T: 'Any empty square',
      r1P: 'A queen, rook, bishop or knight. No captures, and never a check: gold dots show where this rook can go, red crosses mark squares that would give check.',
      r2T: 'It can block a check', r2P: 'Teleport a piece into the line of a check. Your own king must be safe afterwards.',
      r2Cap0: 'Black is about to give check.', r2Cap1: 'The queen checks along the diagonal. In normal chess, that is mate.', r2Cap2: 'The <b>golden move</b> blocks it: the queen lands on g2, protected by the king.',
      r3T: 'Once per game, for each side', r3P: 'It replaces your normal move. While the star is lit, it\u2019s still in your hand.', inHand: 'still in hand', usedUp: 'used',
      whyH: 'Why it changes chess',
      u1N: '220', u1T: 'options each turn while a golden move is unused, instead of about 30',
      u2N: '+130', u2T: 'Elo: what holding the golden move is worth, in our engine games',
      u3N: '9 of 10', u3T: 'games where both sides use it, most often around move 20',
      u4N: '0', u4T: 'new pieces to learn: everything you know about chess still works',
      vs960: 'Chess960 shuffles the starting position so memorized openings stop working. Golden Chess keeps the classic board and adds a threat that hangs over the whole game.',
      tryH: 'Try it', tryLead: 'In each position one golden move does it. Tap a glowing piece, then a gold dot.',
      p1Prompt: 'Black checks from d1. In normal chess this is mate. Find the golden move that saves you.',
      p1Good: 'Saved. The block on f1 is protected by your king, and it hits the queen on d1.',
      p1Hint: 'Put a piece between the queen and your king, on a square your king protects.',
      p2Prompt: 'Win Black\u2019s queen with one golden move.',
      p2Good: 'The bishop lands on the long diagonal, protected, and pins the queen to the king. The queen is lost.',
      p2Hint: 'Line the bishop up with the queen and the king, on a square you protect.',
      p3Prompt: 'Black\u2019s pawn is one step from queening. Stop it, then win the race.',
      p3Good: 'The knight stops the pawn for good, and your h-pawn walks in to queen.',
      p3Hint: 'The knight can stand on the queening square or guard it.',
      badMove: 'Not this one. Look again.', showAnswer: 'Show answer', nextPuzzle: 'Next', tryAgain: 'Try again', puzzleHint: 'Hint',
      allSolved: 'All solved. Now try it in a real game.', rulesH: 'All the rules', premoveRule: 'You can queue the golden move as a premove too.', playNow: 'Play now',
      navBots: 'Bots', easier: 'Easier', stronger: 'Stronger', yourColor: 'Your pieces', botOpp: 'vs {name}', unfinished: 'Game in progress',
      thinkingName: '{name} is thinking', playMain: 'Play', playFriendShort: 'Play a friend', friendT: 'Play a friend',
      friendLink: 'Send a link', friendLinkSub: 'Online. The game starts when your friend opens it',
      friendHere: 'On this device', friendHereSub: 'Take turns on one screen', signInFree: 'Online play needs a free sign-in by email',
      passPlayLong: 'Two players on one device', learnCta: 'Play a bot', botScore: 'Your score: {w} won, {d} drawn, {l} lost', botNoGames: 'You haven’t played {name} yet',
      againBot: 'Play again'
    },
    ru: {
      newGame: 'Новая партия', rules: 'Правила', settings: 'Настройки', menu: 'Меню партии', prev: 'Предыдущий ход', next: 'Следующий ход',
      golden: 'Золотой ход', goldenOnce: 'один раз за партию', goldenPick: 'выберите ферзя, ладью, слона или коня', goldenTap: 'коснитесь золотой точки',
      goldenOn: 'Золотой ход включён', goldenUsedT: 'Золотой ход сделан', goldenUsedOn: '{san} на {n}-м ходу', goldenQueued: 'поставлен премувом',
      goldenWhiteOnce: 'Белые: один раз за партию', goldenBlackOnce: 'Чёрные: один раз за партию',
      goldenOnly: 'Золотой ход делают только ферзь, ладья, слон или конь', goldenGone: 'Ваш золотой ход уже сделан',
      goldenArmedToast: 'Золотой ход: выберите фигуру, затем золотую точку', goldenPlayed: '{side}: золотой ход {san}',
      you: 'Вы', bot: 'Golden Bot', white: 'Белые', black: 'Чёрные', level: 'Уровень {n}',
      lv1: 'Новичок', lv2: 'Любитель', lv3: 'Клубный игрок', lv4: 'Сильный клубный', lv5: 'Эксперт', lv6: 'Мастер', lv7: 'Гроссмейстер', lv8: 'Максимум',
      opponent: 'Соперник', computer: 'Компьютер', twoPlayers: 'Двое на одном устройстве', playAs: 'Играть за', random: 'Случайно',
      timeControl: 'Контроль времени', noClock: 'Без часов', strength: 'Сила бота', play: 'Играть',
      record: 'Счёт против уровня {n}: побед {w}, ничьих {d}, поражений {l}', recordNone: 'Против уровня {n} ещё не играли',
      resign: 'Сдаться', resignQ: 'Сдать партию?', resignSub: 'Партия закончится поражением.', cancel: 'Отмена', abort: 'Прервать партию',
      takeback: 'Вернуть ход', flip: 'Перевернуть доску', analyze: 'Анализ движком', analyzeOff: 'Скрыть анализ', copyPgn: 'Скопировать PGN', rematch: 'Реванш',
      youWon: 'Вы победили', youLost: 'Вы проиграли', draw: 'Ничья', whiteWon: 'Белые победили', blackWon: 'Чёрные победили',
      r_checkmate: 'мат', r_resign: 'сдача', r_timeout: 'время вышло', r_stalemate: 'Пат', r_repetition: 'Троекратное повторение',
      r_fifty: 'Правило 50 ходов', r_insufficient: 'Недостаточно материала', 'r_timeout-insufficient': 'Время вышло, но у соперника не хватает материала для мата', r_abort: 'Партия прервана',
      premoveCancelled: 'Премув отменён', pgnCopied: 'PGN скопирован', pgnManual: 'Скопируйте PGN ниже',
      movesEmpty: 'Здесь будут ходы. Золотые ходы отмечены звездой.', movesEmptyShort: 'Здесь будут ходы', yourMove: 'Ваш ход', botThinking: 'Golden Bot думает', whiteMove: 'Ход белых', blackMove: 'Ход чёрных',
      best: 'Лучший', depth: 'глубина {n}', mateIn: 'мат в {n}', mated: 'мат', noMoves: 'Нет ходов', analysisStarting: 'Движок думает',
      sound: 'Звук', animation: 'Анимация', animFast: 'Быстро', animNormal: 'Обычно', animOff: 'Выкл', boardTheme: 'Доска', thSlate: 'Сланец', thWalnut: 'Орех', thMarble: 'Мрамор',
      coords: 'Координаты', autoQueen: 'Всегда превращать в ферзя', premoves: 'Премувы', language: 'Язык', done: 'Готово',
      rulesTitle: 'Золотой ход', rulesIntro: 'Обычные шахматы, плюс у каждого игрока один золотой ход за партию.',
      rule1: 'Перенесите ферзя, ладью, слона или коня на любое пустое поле.',
      rule2: 'Без взятия и без шаха: после золотого хода король соперника не должен быть под шахом.',
      rule3: 'Им можно закрыться от шаха ладьи, слона или ферзя. Ваш король после хода должен быть в безопасности.',
      rule4: 'Это полноценный ход вместо обычного. Король и пешки так ходить не могут.',
      rule5: 'Остальное — обычные шахматы: рокировка, взятие на проходе, превращение. Ладья после золотого хода теряет право на рокировку.',
      howto: 'Нажмите <b>Золотой ход</b> (или G), выберите фигуру и коснитесь золотой точки. Работает и как премув.',
      credit: 'Фигуры: набор cburnett, Colin M. L. Burnett (GPL / BSD). Движок, правила и звуки сделаны для Golden Chess.',
      movesPlayed: 'Ходов', goldenBy: 'Золотые ходы', none: 'нет', vsBot: 'против Golden Bot, уровень {n}', passPlay: 'Двое игроков', unlimited: 'без часов',
      viewing: 'Просмотр хода {n}. Коснитесь доски, чтобы вернуться к партии.',
      variation: 'Вариант', backToGame: 'Вернуться к партии', review: 'Разбор партии', analyzeOn: 'Показать движок', reviewing: 'Разбор партии: {i} из {n}',
      accuracy: 'Точность', estElo: 'Оценка Elo', played: 'сыграно', bestWas: 'лучше было', c_best: 'Лучший ход', c_excellent: 'Отлично', c_good: 'Хорошо',
      c_inaccuracy: 'Неточность', c_mistake: 'Ошибка', c_blunder: 'Зевок', goldenTag: 'золотой', tooShort: 'мало ходов для оценки',
      reviewHint: 'Коснитесь графика или листайте ходы. Можно двигать фигуры и пробовать свои варианты.',
      eloApprox: '\u2248{n} Elo',
      online: 'Онлайн', findOpp: 'Найти соперника', invite: 'Пригласить друга', searching: 'Ищем соперника', rated: 'На рейтинг', casual: 'Без рейтинга',
      playingAs: 'Ваше имя:', change: 'Изменить', save: 'Сохранить', nameTaken: 'Это имя занято', badName: 'Нужно 2–20 букв, цифр, пробелов, _ или -',
      inviteSub: 'Отправьте ссылку другу. Партия начнётся, когда он её откроет.', copyLink: 'Скопировать', linkCopied: 'Ссылка скопирована', share: 'Поделиться',
      shareText: 'Сыграем в Golden Chess', waitingFriend: 'Ждём друга', connecting: 'Подключение', netError: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
      oppMove: 'Ход соперника', offerDraw: 'Предложить ничью', drawOffered: 'Ничья предложена', drawDeclined: 'Ничью отклонили', oppOffersDraw: '{name} предлагает ничью',
      acceptDraw: 'Согласиться на ничью', declineDraw: 'Отклонить ничью', accept: 'Принять', decline: 'Отклонить', rematchSent: 'Реванш предложен', acceptRematch: 'Принять реванш',
      oppWantsRematch: '{name} хочет реванш', newOpponent: 'Новый соперник', ratingWord: 'Рейтинг', bullet: 'Пуля', blitz: 'Блиц', rapid: 'Рапид',
      ratedLine: '{pool} на рейтинг', casualLine: '{pool} без рейтинга', yourRating: 'Ваш рейтинг ({pool}): {r}', firstMove: '{side}: первый ход — {s} с',
      r_agreement: 'по соглашению', gameTaken: 'Партия уже началась, вы смотрите её как зритель', noGame: 'Партия не найдена',
      stillPlaying: 'Ваша онлайн-партия ещё идёт. Если начать другую, часы в ней продолжат идти.',
      reconnecting: 'Переподключение…', connected: 'В игре', disconnected: 'Вышел из игры', leaderboard: 'Лучшие игроки', lbEmpty: 'Рейтинговых партий ещё нет. Будьте первым.',
      gamesN: 'партий: {n}', casualNote: 'Партия без рейтинга: рейтинг не меняется.', onlineElsewhere: 'Онлайн-партии и рейтинг:', appOffline: 'Нет интернета. Боты и игра вдвоём на одном телефоне работают и без него.', reconnect: 'Повторить', privacy: 'Политика конфиденциальности',
      account: 'Аккаунт', signIn: 'Войти', emailLabel: 'Почта', sendCode: 'Получить код', sending: 'Отправляем', manage: 'Управление',
      signInSub: 'Введите почту, чтобы сохранить имя, рейтинг и партии или войти в свой аккаунт на этом устройстве. Мы пришлём код.',
      codeTitle: 'Введите код', codeSub: 'Код отправлен на {email}. Введите его здесь или откройте ссылку из письма на этом устройстве.',
      existingNote: 'У этой почты уже есть аккаунт. Вы перейдёте в него, а партии и рейтинг этого гостя останутся у гостя.',
      confirm: 'Подтвердить', checking: 'Проверяем', resend: 'Отправить ещё раз', resendIn: 'Ещё раз через {s} с', otherEmail: 'Другая почта',
      signedInAs: 'Вы вошли как {email}', signedSub: 'Имя, рейтинг и партии сохранены в аккаунте. Входите с этой почтой на любом устройстве.',
      signOut: 'Выйти', signedOutToast: 'Вы вышли. Теперь вы играете как новый гость.', progressSaved: 'Прогресс сохранён',
      emailInvalid: 'Введите корректную почту', codeWrong: 'Код неверный или устарел', tooMany: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
      sendFailed: 'Не удалось отправить письмо. Попробуйте позже.', finishFirst: 'Сначала доиграйте онлайн-партию',
      linkExpired: 'Ссылка для входа устарела. Запросите новый код.', signInFailed: 'Не удалось войти. Попробуйте ещё раз.',
      continueGoogle: 'Войти через Google', or: 'или', googleExists: 'С этой почтой Google уже есть игрок. Входим в него…',
      guestNote: 'Гость: рейтинг хранится только на этом устройстве.', saveProgress: 'Сохранить прогресс',
      guestRatingNote: 'Рейтинг хранится только на этом устройстве. Добавьте почту, чтобы не потерять его.',
      back: 'Назад', navPlay: 'Играть', navLearn: 'Обучение', navRatings: 'Рейтинг', navProfile: 'Профиль',
      startGame: 'Начать игру', playFriend: 'Сыграть с другом', playFriendSub: 'Отправьте ссылку, игра начнётся, когда друг её откроет',
      playBot: 'Сыграть с ботом', playBotSub: 'Восемь уровней, от 600 до 2500 Elo', passPlay: 'Вдвоём', passPlaySub: 'По очереди на одном устройстве',
      more: 'Ещё', gameOn: 'Ваша партия идёт', returnBtn: 'Вернуться', continueGame: 'Продолжить партию', cont: 'Продолжить', vsName: 'против {name}',
      signInToRate: 'Войдите, чтобы играть онлайн и получить рейтинг', ratingIn: 'Рейтинг ({pool}): {r}', botSetupTitle: 'Игра с ботом',
      signInTitle: 'Войдите, чтобы играть', signInPageSub: 'Бесплатно и без пароля: пришлём код на почту. Рейтинг и партии сохранятся в аккаунте на любом устройстве.',
      practise: 'Просто потренироваться?', playTheBot: 'Сыграйте с ботом без аккаунта',
      nameTitle: 'Выберите имя', nameSub: 'Его увидят соперники и таблица рейтинга. Поменять можно потом.', signedInTitle: 'Вы вошли',
      yourRating: 'Ваш рейтинг', wdl: 'побед {w}, ничьих {d}, поражений {l}', provisional: 'предварительный', noGamesYet: 'партий ещё нет',
      profileGuest: 'Гость', profileSignedOut: 'Войдите, чтобы играть онлайн. Рейтинг и партии сохранятся в аккаунте.', howItWorks: 'Как работает золотой ход',
      learnTitle: 'Один ход, который меняет партию',
      learnLead: 'Golden Chess — это обычные шахматы, но у каждого игрока есть один золотой ход за партию: перенести ферзя, ладью, слона или коня на любое пустое поле.',
      heroCap1: 'У белых остался золотой ход. Чёрный ферзь стоит прямо перед своим королём.',
      heroCap2: '<b>Золотой ход:</b> ладья переносится на e1 и связывает ферзя с королём.', heroCap3: 'Король уходит в сторону, и ферзь потерян.',
      ruleH: 'Правило', r1T: 'Любое пустое поле',
      r1P: 'Ферзь, ладья, слон или конь. Без взятия и никогда с шахом: золотые точки показывают, куда может перенестись ладья, красные крестики — поля, где был бы шах.',
      r2T: 'Им можно закрыться от шаха', r2P: 'Поставьте фигуру на линию шаха. Ваш король после хода должен быть в безопасности.',
      r2Cap0: 'Чёрные сейчас дадут шах.', r2Cap1: 'Ферзь даёт шах по диагонали. В обычных шахматах это мат.', r2Cap2: '<b>Золотой ход</b> закрывает шах: ферзь встаёт на g2 под защитой короля.',
      r3T: 'Один раз за партию у каждого', r3P: 'Он заменяет обычный ход. Пока звезда горит, ход у вас в запасе.', inHand: 'в запасе', usedUp: 'использован',
      whyH: 'Чем это меняет шахматы',
      u1N: '220', u1T: 'вариантов на каждый ход, пока золотой ход не потрачен, вместо примерно 30',
      u2N: '+130', u2T: 'Elo — столько стоит золотой ход в запасе, по нашим партиям движка',
      u3N: '9 из 10', u3T: 'партий, где его используют обе стороны, чаще всего около 20-го хода',
      u4N: '0', u4T: 'новых фигур: всё, что вы знаете о шахматах, продолжает работать',
      vs960: 'Шахматы Фишера (960) перемешивают стартовую расстановку, чтобы заученные дебюты перестали работать. Golden Chess оставляет классическую доску и добавляет угрозу, которая висит над всей партией.',
      tryH: 'Попробуйте', tryLead: 'В каждой позиции всё решает один золотой ход. Коснитесь светящейся фигуры, затем золотой точки.',
      p1Prompt: 'Чёрные дают шах ферзём с d1. В обычных шахматах это мат. Найдите золотой ход, который спасает.',
      p1Good: 'Спасены. Фигура на f1 под защитой короля и сама бьёт ферзя на d1.',
      p1Hint: 'Поставьте фигуру между ферзём и королём — на поле, которое защищает король.',
      p2Prompt: 'Выиграйте чёрного ферзя одним золотым ходом.',
      p2Good: 'Слон встал на большую диагональ под защитой и связал ферзя с королём. Ферзь пропадает.',
      p2Hint: 'Поставьте слона на одну линию с ферзём и королём, на поле под вашей защитой.',
      p3Prompt: 'Чёрная пешка в шаге от превращения. Остановите её — и выиграйте гонку.',
      p3Good: 'Конь остановил пешку, а ваша пешка h проходит в ферзи.',
      p3Hint: 'Конь может встать на поле превращения или держать его под ударом.',
      badMove: 'Не то. Посмотрите ещё раз.', showAnswer: 'Показать ответ', nextPuzzle: 'Дальше', tryAgain: 'Ещё раз', puzzleHint: 'Подсказка',
      allSolved: 'Все решены. Теперь попробуйте в настоящей партии.', rulesH: 'Все правила', premoveRule: 'Золотой ход можно поставить и премувом.', playNow: 'Играть',
      navBots: 'Боты', easier: 'Полегче', stronger: 'Посильнее', yourColor: 'Ваш цвет', botOpp: 'соперник: {name}', unfinished: 'Партия идёт',
      thinkingName: '{name} думает', playMain: 'Играть', playFriendShort: 'Играть с другом', friendT: 'Игра с другом',
      friendLink: 'Отправить ссылку', friendLinkSub: 'Онлайн. Партия начнётся, когда друг откроет ссылку',
      friendHere: 'На одном устройстве', friendHereSub: 'Ходите по очереди на одном экране', signInFree: 'Для игры онлайн нужен вход по почте, это бесплатно',
      passPlayLong: 'Вдвоём на одном устройстве', learnCta: 'Сыграть с ботом', botScore: 'Ваш счёт: побед {w}, ничьих {d}, поражений {l}', botNoGames: 'Вы ещё не играли с этим ботом',
      againBot: 'Ещё партия'
    }
  };
  var settings = Object.assign({ sound: true, anim: 'normal', board: 'slate', coords: true, autoQueen: false, premoves: true, lang: null }, load('settings', {}));
  var lang = settings.lang || (/^ru\b/i.test(navigator.language || '') ? 'ru' : 'en');
  function T(key, vars) {
    var s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
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
      v: 1, cfg: { mode: this.cfg.mode, level: this.cfg.level, human: this.cfg.human, tc: this.cfg.tc ? this.cfg.tc.label : 'none' },
      startFen: this.startFen, moves: this.records.map(function (r) { return r.uci; }),
      clocks: this.records.map(function (r) { return r.clock; }), clock: this.clock ? this.clock.t.slice() : null,
      status: this.status, result: this.result, reason: this.reason, counted: !!this.counted
    };
  };
  Game.restore = function (d) {
    if (!d || d.v !== 1) return null;
    try {
      var cfg = { mode: d.cfg.mode, level: d.cfg.level, human: d.cfg.human, tc: parseTc(d.cfg.tc) };
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
      g.counted = !!d.counted;
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
      var r = Engine.think({ fen: req.fen, moves: req.moves, timeMs: Math.min(req.timeMs || 300, 300), level: req.level, analysis: req.analysis });
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
      var i = 0, n = req.moves.length;
      (function next() {
        if (self.reviewToken !== req.id) return;
        if (i > n) { done({ done: true }); return; }
        var r = Engine.think({ fen: req.fen, moves: req.moves.slice(0, i), timeMs: Math.min(req.timeMs, 120), analysis: true });
        step({ i: i, score: r.score, mate: r.mate, uci: r.uci, depth: r.depth });
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

  // ------------------------------------------------------------------ state
  var app = $('app'), boardEl = $('board');
  var game = null, view = 0, selected = -1, premoves = [], goldenArmed = false, orient = 0;
  var botReq = null, reqSeq = 0, lowWarned = false, pendingPromo = false, plyBoards = {}, pendingRecapture = null, analysisArrow = null;
  var analysis = { on: false, id: 0, info: null, ply: -1 };
  var bot = new EngineClient(), anaClient = null, revClient = null;
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
  function applyPseudo(b, pm) {
    var p = b[pm.from];
    if (!p) return;
    var t = p & 7;
    b[pm.from] = 0;
    if (!pm.golden && t === 6 && Math.abs((pm.to & 7) - (pm.from & 7)) === 2) {
      var rf = pm.to > pm.from ? pm.from + 3 : pm.from - 4, rt = pm.to > pm.from ? pm.from + 1 : pm.from - 1;
      if ((b[rf] & 7) === 4) { b[rt] = b[rf]; b[rf] = 0; }
    }
    if (t === 1 && ((pm.to >> 4) === 7 || (pm.to >> 4) === 0)) p = (p & 8) | (pm.promo || 5);
    b[pm.to] = p;
  }
  function displayBoard() {
    if (explore) return posFromFen(explore.fens[explore.view]).board;
    if (!live()) return boardAtPly(view);
    if (!premoves.length) return game.pos.board;
    var b = new Int8Array(game.pos.board);
    premoves.forEach(function (pm) { if (!pm.stay) applyPseudo(b, pm); });
    return b;
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
      if (premoveDests(b, from, g).indexOf(to) < 0 || premoves.length >= 12) return false;
      var promo = ((p & 7) === 1 && ((to >> 4) === 7 || (to >> 4) === 0)) ? 5 : 0;
      var stay = !g && !!b[to] && (b[to] >> 3) === game.cfg.human;
      premoves.push({ from: from, to: to, promo: promo, golden: g, stay: stay });
      if (g) setGoldenArmed(false);
      selected = -1;
      board.sync(displayBoard(), [{ from: from, to: to, golden: g, instant: viaDrag, code: p }]);
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
    explore.records = explore.records.slice(0, explore.view); explore.fens = explore.fens.slice(0, explore.view + 1);
    explore.records.push(rec); explore.fens.push(np.fen()); explore.view = explore.records.length;
    if (goldenArmed) setGoldenArmed(false);
    selected = -1;
    board.sync(displayBoard(), hintsFor(rec, instant));
    moveSound(rec);
    renderAll();
    if (analysis.on) requestAnalysis();
  }
  function exitExplore() {
    if (!explore) return;
    view = explore.base; explore = null; selected = -1;
    if (goldenArmed) setGoldenArmed(false);
    board.sync(displayBoard(), []);
    renderAll();
    if (analysis.on) requestAnalysis();
  }
  function navStep(dir) {
    if (!game) return;
    if (explore) {
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
  // never the same time twice, and a real pause before its golden move. Bot games have no clock; older games that do
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
  function botName() { return window.GCBots ? GCBots.name(game.cfg.level - 1, lang) : T('bot'); }
  function requestBot() {
    if (!botGame() || game.status !== 'playing' || game.pos.side === game.cfg.human) return;
    cancelBot();
    var id = ++reqSeq, t0 = perf(), color = game.pos.side, lvl = game.cfg.level;
    var budget = Engine.LEVELS[lvl - 1].time;
    if (game.clock) {
      var left = game.timeLeft(color, t0), inc = game.cfg.tc.inc;
      budget = Math.min(budget, Math.max(40, left / 32 + inc * 0.7));
      if (left < 4000) budget = Math.min(budget, Math.max(15, left / 60));
    }
    botReq = { id: id, timer: 0 };
    renderBars(); renderSide();
    bot.think({ id: id, fen: game.startFen, moves: game.records.map(function (r) { return r.uci; }), timeMs: budget, level: lvl }, function (res) {
      if (!botReq || botReq.id !== id) return;
      var wait = Math.max(0, (window.__gcFastBot ? 0 : botThinkMs(res && res.uci)) - (perf() - t0));
      botReq.timer = setTimeout(function () {
        if (!botReq || botReq.id !== id) return;
        botReq = null;
        if (game.status !== 'playing' || game.pos.side === game.cfg.human) return;
        var m = res && res.uci ? game.pos.moveFromUci(res.uci) : 0;
        if (!m) m = game.legal[0];
        if (m) commit(m, false, 'bot');
      }, wait);
    });
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
    if (explore) { var base = explore.base; explore = null; view = base; board.sync(displayBoard(), []); }
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
    refreshArrows(); renderAna();
    var p = viewPos();
    if (!p.hasLegalMove()) { analysis.info = { final: true, score: p.inCheck() ? -30000 : 0, mate: 0, none: true }; renderAna(); return; }
    var req = { id: id, fen: game.startFen, moves: viewMovesUci(), timeMs: 3000, level: 8, analysis: true };
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
        html = '<span>' + esc(T('best')) + ': <b class="' + (m & F_GOLDEN ? 'gold' : '') + '">' + esc(san) + '</b></span><span><b>' + esc(evalTxt) + '</b></span><span>' + esc(T('depth', { n: inf.depth })) + '</span>';
        analysisArrow = m ? { from: m & 127, to: (m >> 7) & 127, gold: !!(m & F_GOLDEN) } : null;
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
  function winPct(cp) { cp = Math.max(-1500, Math.min(1500, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function cpOf(e) {
    if (e.mate) return e.mate > 0 ? 10000 - e.mate * 10 : -10000 - e.mate * 10;
    return Math.max(-10000, Math.min(10000, e.score));
  }
  // accuracy (lichess formula) -> rough Elo. Calibrated on bot-vs-bot games reviewed exactly like player games
  // (test/acc_calib.js): mean accuracy 69.3 at ~600 Elo, 80.8 at ~1050, 83.6 at 1350, 86.0 at 1600, 93.2 at 1900, 96.9 at 2250, 98.3 at 2500
  var ELO_CURVE = [[40, 150], [55, 350], [69, 600], [80.8, 1050], [83.6, 1350], [86, 1600], [93.2, 1900], [96.9, 2250], [98.3, 2500], [99.5, 2750]];
  function estimateElo(acc) {
    var c = ELO_CURVE;
    if (acc <= c[0][0]) return c[0][1];
    for (var i = 1; i < c.length; i++) if (acc <= c[i][0]) { var a = c[i - 1], b = c[i]; return Math.round((a[1] + (b[1] - a[1]) * (acc - a[0]) / (b[0] - a[0])) / 10) * 10; }
    return c[c.length - 1][1];
  }
  function startReview() {
    if (!game || !game.records.length) return;
    stopReview();
    if (!revClient) revClient = new EngineClient();
    var id = ++reqSeq, n = game.records.length;
    review = { id: id, n: n, done: 0, scores: [], moves: null, sum: null, running: true };
    if (!analysis.on) { analysis.on = true; $('evalbar').hidden = false; }
    revClient.review({ id: id, fen: game.startFen, moves: game.records.map(function (r) { return r.uci; }), timeMs: 260 },
      function (st) {
        if (!review || review.id !== id) return;
        review.scores[st.i] = { score: st.score, mate: st.mate || 0, uci: st.uci, depth: st.depth };
        review.done = Math.max(review.done, st.i + 1);
        computeReview();
        if (!explore && view === st.i) requestAnalysis(); else { renderReview(); renderMoves(); renderMarks(); }
      },
      function () { if (!review || review.id !== id) return; review.running = false; computeReview(); renderAll(); if (analysis.on) requestAnalysis(); layout(); });
    renderAll(); layout();
  }
  function stopReview() { if (review && review.running && revClient) revClient.cancel(); if (review) review.running = false; }
  function computeReview() {
    var sc = review.scores, recs = game.records, moves = [], acc = [[], []], loss = [[], []], cnt = [{}, {}];
    for (var i = 0; i < recs.length; i++) {
      if (!sc[i] || !sc[i + 1]) continue;
      var c = recs[i].color, before = winPct(cpOf(sc[i])), after = winPct(-cpOf(sc[i + 1])), drop = Math.max(0, before - after);
      var a = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
      var cls = recs[i].uci === sc[i].uci ? 'best' : drop >= 15 ? 'blunder' : drop >= 10 ? 'mistake' : drop >= 5 ? 'inaccuracy' : drop < 2 ? 'excellent' : 'good';
      moves[i] = { cls: cls, drop: drop, acc: a, best: sc[i].uci, golden: recs[i].golden };
      acc[c].push(a); loss[c].push(Math.min(1000, Math.max(0, cpOf(sc[i]) + cpOf(sc[i + 1]))));
      cnt[c][cls] = (cnt[c][cls] || 0) + 1;
    }
    review.moves = moves;
    review.sum = [0, 1].map(function (c) {
      var xs = acc[c];
      if (!xs.length) return null;
      var mean = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length;
      var harm = xs.length / xs.reduce(function (s, v) { return s + 1 / Math.max(5, v); }, 0);
      var accuracy = (mean + harm) / 2;
      return { accuracy: accuracy, acpl: Math.round(loss[c].reduce(function (s, v) { return s + v; }, 0) / xs.length), counts: cnt[c], n: xs.length,
        elo: xs.length >= 8 ? estimateElo(accuracy) : null };
    });
  }
  var CLS_ORDER = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
  function renderReview() {
    var hosts = [$('review'), $('review-side')];
    if (!review || !game) { hosts.forEach(function (h) { h.hidden = true; h.innerHTML = ''; }); return; }
    var n = game.records.length, html = '';
    // progress
    if (review.running) html += '<div class="rv-progress"><span>' + esc(T('reviewing', { i: Math.min(review.done, n + 1), n: n + 1 })) + '</span><i style="width:' + (100 * review.done / (n + 1)).toFixed(1) + '%"></i></div>';
    // graph of White's winning chances
    var pts = [], W = 1000, H = 100;
    for (var i = 0; i <= n; i++) {
      var e = review.scores[i];
      if (!e) continue;
      var side = posFromFen(game.fens[i]).side, wcp = side === 0 ? cpOf(e) : -cpOf(e);
      pts.push([i * W / Math.max(1, n), H - winPct(wcp)]);
    }
    var cur = explore ? explore.base : view, curX = (cur * W / Math.max(1, n)).toFixed(1);
    var path = pts.length ? 'M0,' + H + ' ' + pts.map(function (p) { return 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + H + ' Z' : '';
    var dots = '';
    if (review.moves) review.moves.forEach(function (m, k) {
      if (!m || (m.cls !== 'mistake' && m.cls !== 'blunder' && !m.golden)) return;
      var e2 = review.scores[k + 1]; if (!e2) return;
      var sd = posFromFen(game.fens[k + 1]).side, w2 = sd === 0 ? cpOf(e2) : -cpOf(e2);
      dots += '<i class="gd ' + (m.golden ? 'g-gold' : 'g-' + m.cls) + '" style="left:' + (100 * (k + 1) / Math.max(1, n)).toFixed(2) + '%;top:' + (100 - winPct(w2)).toFixed(1) + '%"></i>';
    });
    html += '<div class="rv-graph" data-n="' + n + '"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + path + '"/><line class="mid" x1="0" y1="50" x2="' + W + '" y2="50"/><line class="cur" x1="' + curX + '" y1="0" x2="' + curX + '" y2="' + H + '"/></svg>' + dots + '</div>';
    // players
    if (review.sum) {
      html += '<div class="rv-players">';
      [0, 1].forEach(function (c) {
        var sm = review.sum[c];
        html += '<div class="rv-p"><span class="rv-name"><i class="pc-ic ' + BoardView.cls((c << 3) | 6) + '"></i>' + esc(sideLabel(c)) + '</span>';
        if (sm) {
          html += '<span class="rv-acc"><b>' + sm.accuracy.toFixed(1) + '%</b></span><span class="rv-elo">' + (sm.elo ? esc(T('eloApprox', { n: sm.elo })) : esc(T('tooShort'))) + '</span><span class="rv-counts">';
          ['inaccuracy', 'mistake', 'blunder'].forEach(function (k) { html += '<span class="cnt s-' + k + '" title="' + esc(T('c_' + k)) + '">' + (sm.counts[k] || 0) + '<em>' + SYM[k] + '</em></span>'; });
          html += '</span>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    // verdict for the viewed move
    var mvI = explore ? -1 : view - 1, mv = review.moves && review.moves[mvI];
    if (mv) {
      var rec = game.records[mvI], pBefore = posFromFen(game.fens[mvI]), bm = mv.best ? pBefore.moveFromUci(mv.best) : 0;
      var bestSan = bm ? pBefore.san(bm, pBefore._legal || (pBefore._legal = pBefore.legalMoves(true))) : '';
      var no = Math.floor(mvI / 2) + 1 + (rec.color === 0 ? '. ' : '\u2026 ');
      html += '<div class="rv-verdict"><span class="v-move' + (rec.golden ? ' gold' : '') + '">' + esc(no + rec.san) + '</span><span class="v-cls s-' + mv.cls + '">' + esc(T('c_' + mv.cls)) + '</span>' +
        (mv.cls !== 'best' && bestSan ? '<span class="v-best">' + esc(T('bestWas')) + ' <b' + (bm & F_GOLDEN ? ' class="gold"' : '') + '>' + esc(bestSan) + '</b></span>' : '') + '</div>';
    } else if (!review.running && !explore) html += '<div class="rv-hint">' + esc(T('reviewHint')) + '</div>';
    hosts.forEach(function (h) { h.hidden = false; h.innerHTML = html; });
  }
  function onGraphClick(e) {
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
    explore = null; posCache = {}; stopReview(); review = null;
    if (analysis.on) setAnalysis(false);
    var human = setup.color === 'r' ? (Math.random() < 0.5 ? 0 : 1) : setup.color === 'b' ? 1 : 0;
    if (opts.human != null) human = opts.human;
    game = new Game({ mode: setup.mode, level: setup.level, human: human, tc: parseTc(setup.tc) }, opts.fen);
    view = 0;
    setGoldenArmed(false);
    orient = setup.mode === 'bot' ? human : 0;
    board.setOrientation(orient);
    board.sync(game.pos.board, []);
    Sound.play('start');
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
    if (botGame() && !game.counted && game.reason !== 'abort') {
      game.counted = true;
      var key = 'L' + game.cfg.level, s = stats[key] || { w: 0, d: 0, l: 0 };
      s[outcome === 1 ? 'w' : outcome === 0 ? 'd' : 'l']++;
      stats[key] = s; save('stats', stats);
    }
    Sound.play(outcome === 1 ? 'win' : outcome === 0 ? 'draw' : (oppGame() && !spectating() ? 'lose' : 'win'));
    renderAll(); persist();
    var g = game;
    // the result card, unless the player already opened something else (e.g. looking for the next game)
    setTimeout(function () { if (game === g && game.status === 'over' && !currentDialog) showOver(); }, 450);
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
      if (mv && BADGE[mv.cls]) marks.push({ sq: (r.m >> 7) & 127, cls: 'badge bd-' + mv.cls });
    }
    var vp = viewPos(), checkSq = vp.inCheck() ? vp.kings[vp.side] : -1;
    if (checkSq >= 0) marks.push({ sq: checkSq, cls: 'hl-check' });
    premoves.forEach(function (pm) { marks.push({ sq: pm.from, cls: 'hl-pre' }, { sq: pm.to, cls: 'hl-pre' }); });
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
  var BADGE = { best: 1, inaccuracy: 1, mistake: 1, blunder: 1 };
  function refreshArrows() {
    var list = [];
    if (live()) premoves.forEach(function (pm) { if (pm.stay) list.push({ from: pm.from, to: pm.to, pre: true }); });
    if (analysis.on && analysisArrow) list.push(analysisArrow);
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
      if (rt != null) extra += '<span class="rt">' + rt + (d != null ? ' <b class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</b>' : '') + '</span>';
      if (online && !spectating() && color !== game.cfg.human && online.oppHere != null) extra += '<i class="conn' + (online.oppHere ? '' : ' off') + '" title="' + esc(online.oppHere ? T('connected') : T('disconnected')) + '"></i>';
    } else if (botGame()) {
      if (color === game.cfg.human) { name = T('you'); sub = color === 0 ? T('white') : T('black'); }
      else { name = botName(); sub = T('lv' + game.cfg.level); extra = '<span class="rt" title="Elo">' + Engine.LEVELS[game.cfg.level - 1].elo + '</span>'; botFace = true; }
    } else { name = color === 0 ? T('white') : T('black'); sub = ''; }
    var caps = '', diff = 0;
    for (var t = 5; t >= 1; t--) {
      var missing = Math.max(0, START_COUNT[t] - c[opp][t]);
      for (var i = 0; i < missing; i++) caps += '<i class="' + BoardView.cls((opp << 3) | t) + (i === 0 && caps ? ' gap' : '') + '"></i>';
    }
    for (t = 1; t <= 5; t++) diff += (c[color][t] - c[opp][t]) * VALUE[t];
    var thinking = botReq && botGame() && color !== game.cfg.human && game.status === 'playing';
    var gAvail = posV.goldenAvailable(color);
    el.innerHTML =
      (botFace && window.GCBots ? '<div class="avatar bot' + (thinking ? ' busy' : '') + '">' + GCBots.avatar(game.cfg.level - 1, lang) + '</div>'
        : '<div class="avatar"><i class="pc-ic ' + BoardView.cls((color << 3) | 6) + '"></i></div>') +
      '<div class="pmeta"><div class="pname"><span class="nm">' + esc(name) + '</span>' + extra +
      '<svg class="gstar' + (gAvail ? '' : ' used') + '" viewBox="0 0 24 24" aria-label="' + esc(T('golden')) + '"><path class="fill" d="M12 2.5c1 6.1 3.4 8.5 9.5 9.5-6.1 1-8.5 3.4-9.5 9.5-1-6.1-3.4-8.5-9.5-9.5 6.1-1 8.5-3.4 9.5-9.5z"/></svg>' +
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
          if (mv && SYM[mv.cls]) { var i = document.createElement('i'); i.className = 'sym s-' + mv.cls; i.textContent = SYM[mv.cls]; el.appendChild(i); }
        });
      });
    }
    var cur = strip.querySelector('.var.cur') || strip.querySelector('.cur');
    if (cur) strip.scrollLeft = Math.max(0, cur.offsetLeft - strip.clientWidth + cur.offsetWidth + 24);
    else strip.scrollLeft = 0;
    var cur2 = sheet.querySelector('.cur');
    if (cur2) { var top = cur2.offsetTop, bh = sheet.clientHeight; if (top < sheet.scrollTop || top > sheet.scrollTop + bh - 40) sheet.scrollTop = top - bh / 2; }
  }

  var SYM = { inaccuracy: '?!', mistake: '?', blunder: '??' };
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
    var pre = botGame() ? Engine.LEVELS[game.cfg.level - 1].elo + ' Elo, ' : onlineGame() ? poolLine(game.cfg.pool, game.cfg.rated) + ', ' : '';
    $('side-sub').textContent = pre + tc + '. ' + status;
    var acts = $('side-actions'); acts.innerHTML = '';
    function add(label, fn, cls, disabled) { var b = document.createElement('button'); b.className = 'sbtn' + (cls ? ' ' + cls : ''); b.textContent = label; b.disabled = !!disabled; b.addEventListener('click', fn); acts.appendChild(b); }
    if (game.status === 'playing') {
      if (botGame()) add(T('takeback'), takeback, '', !game.records.some(function (r) { return r.color === game.cfg.human; }));
      if (onlineGame() && !spectating()) {
        var dOff = online && online.s ? online.s.draw_offer : null, mine = game.cfg.human === 0 ? 'w' : 'b';
        // an incoming offer is answered in the notice above these buttons
        if (!dOff || dOff === mine) add(dOff === mine ? T('drawOffered') : T('offerDraw'), function () { onlineAction('draw', { op: 'offer' }); }, '', !!dOff || game.records.length < 2);
      }
      if (!spectating()) add(abortable() ? T('abort') : T('resign'), confirmResign, 'danger');
    } else {
      add(review ? (analysis.on ? T('analyzeOff') : T('analyzeOn')) : T('review'), function () { if (!review) startReview(); else setAnalysis(!analysis.on); renderSide(); });
      if (explore) add(T('backToGame'), exitExplore);
      if (onlineGame() && !spectating()) {
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
    veil.appendChild(card);
    veil.addEventListener('pointerdown', function (e) { if (e.target === veil) closeDialog(); });
    $('overlay-root').appendChild(veil);
    currentDialog = veil;
    build(card);
    var f = card.querySelector('button.primary, button');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function closeDialog() { if (currentDialog) { var d = currentDialog; currentDialog = null; d.remove(); if (d.onClose) d.onClose(); } }
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

  function showOver() {
    var o = humanOutcome();
    openDialog(function (card) {
      currentDialog.dataset.kind = 'over';
      card.appendChild(h('div', { class: 'dlg-title' + (o === 1 && !spectating() ? ' win' : '') }, esc(resultTitle())));
      var reason = reasonText();
      if (reason) card.appendChild(h('div', { class: 'dlg-sub' }, esc(reason.charAt(0).toUpperCase() + reason.slice(1))));
      var golds = game.records.map(function (r, i) { return r.golden ? sideLabel(r.color) + ': ' + r.san + ' (' + (Math.floor(i / 2) + 1) + ')' : null; }).filter(Boolean);
      card.appendChild(h('div', { class: 'over-stats' }, '<span>' + esc(T('movesPlayed')) + ': <b>' + Math.ceil(game.records.length / 2) + '</b></span><span>' + esc(T('goldenBy')) + ': <b>' + esc(golds.length ? golds.join(', ') : T('none')) + '</b></span>'));
      var row = h('div', { class: 'row-btns' });
      if (onlineGame()) {
        var st = online && online.s;
        if (st && st.rated && st.white_diff != null) {
          var rl = h('div', { class: 'rating-change' });
          [0, 1].forEach(function (c) {
            if (!spectating() && c !== game.cfg.human) return;
            var before = c === 0 ? st.white_rating : st.black_rating, after = c === 0 ? st.white_after : st.black_after, d = c === 0 ? st.white_diff : st.black_diff;
            if (after == null) after = before + d;
            rl.appendChild(h('div', null, esc(spectating() ? sideLabel(c) : T('ratingWord')) + ': <b>' + before + ' → ' + after + '</b> <span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</span>'));
          });
          card.appendChild(rl);
        } else if (st && !st.rated && st.status === 'over') card.appendChild(h('div', { class: 'dlg-note' }, esc(T('casualNote'))));
        if (st && st.rated && st.status === 'over' && !spectating() && me && me.guest) {
          var nudge = h('div', { class: 'dlg-note acct-nudge', id: 'acct-nudge' }, '<span>' + esc(T('guestRatingNote')) + '</span>');
          var sp = h('button', { type: 'button', class: 'linkbtn', id: 'btn-save-progress' }, esc(T('saveProgress')));
          sp.addEventListener('click', function () { showAccount(showOver); });
          nudge.appendChild(sp); card.appendChild(nudge);
        }
        var rv = h('button', { class: spectating() ? 'secondary' : 'linkbtn center', type: 'button', id: 'btn-over-review' }, esc(T('review')));
        rv.addEventListener('click', function () { closeDialog(); startReview(); renderSide(); });
        if (!spectating()) {
          var rm = rematchState();
          var rb = h('button', { class: 'primary', type: 'button', id: 'btn-rematch' }, esc(rm.label)); rb.disabled = rm.disabled;
          rb.addEventListener('click', rematch);
          var no = h('button', { class: 'secondary', type: 'button', id: 'btn-new-opp' }, esc(T('newOpponent')));
          no.addEventListener('click', function () { closeDialog(); newOpponent(); });
          row.appendChild(rb); row.appendChild(no);
          card.appendChild(row); card.appendChild(rv);
        } else { row.appendChild(rv); card.appendChild(row); }
        return;
      }
      // a game against the bot or on one device: play again (colours swap with the bot), or look through the game
      var again = h('button', { class: 'primary', type: 'button', id: 'btn-again' }, esc(T('againBot')));
      again.addEventListener('click', function () {
        closeDialog();
        var s = { mode: game.cfg.mode, level: game.cfg.level, tc: game.cfg.tc ? game.cfg.tc.label : 'none', color: 'w' };
        startGame(s, { human: botGame() ? game.cfg.human ^ 1 : 0 });
      });
      var anaB = h('button', { class: 'secondary', type: 'button', id: 'btn-over-review' }, esc(T('review')));
      anaB.addEventListener('click', function () { closeDialog(); startReview(); renderSide(); });
      row.appendChild(again); row.appendChild(anaB);
      card.appendChild(row);
    });
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
        item(ICON.eng, review ? (analysis.on ? T('analyzeOff') : T('analyzeOn')) : T('review'), function () { if (!review) startReview(); else setAnalysis(!analysis.on); renderSide(); });
        if (explore) item(ICON.back, T('backToGame'), exitExplore);
        if (onlineGame() && !spectating()) {
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
    fl.appendChild(seg([{ v: 'en', label: 'English' }, { v: 'ru', label: 'Русский' }], lang, function (v) { lang = settings.lang = v; saveSettings(); applyLang(); if (redraw) redraw(); }));
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
      var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
      d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
    });
  }

  // ------------------------------------------------------------------ PGN
  function pgnText() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var names = onlineGame() ? game.cfg.names.slice() :
      [botGame() ? (game.cfg.human === 0 ? 'You' : 'Golden Bot L' + game.cfg.level) : 'White', botGame() ? (game.cfg.human === 1 ? 'You' : 'Golden Bot L' + game.cfg.level) : 'Black'];
    var res = game.status === 'over' && game.result !== '*' ? game.result : '*';
    var event = onlineGame() ? (game.cfg.rated ? 'Rated ' : 'Casual ') + game.cfg.pool + ' game' : 'Golden Chess';
    var site = onlineGame() && online ? location.origin + location.pathname + '?game=' + online.id : 'Golden Chess';
    var tags = [['Event', event], ['Site', site], ['Date', d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate())],
      ['White', names[0]], ['Black', names[1]], ['Result', res], ['Variant', 'Golden'], ['TimeControl', game.cfg.tc ? (game.cfg.tc.base / 1000) + '+' + (game.cfg.tc.inc / 1000) : '-']];
    if (onlineGame() && game.cfg.ratings[0] != null) tags.push(['WhiteElo', String(game.cfg.ratings[0])], ['BlackElo', String(game.cfg.ratings[1])]);
    if (botGame()) tags.push([game.cfg.human === 0 ? 'BlackElo' : 'WhiteElo', String(Engine.LEVELS[game.cfg.level - 1].elo)]);
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
  function persist() { if (game && !game.online) save('game', game.serialize()); }

  // ------------------------------------------------------------------ main loop (clock + flag)
  function tick() {
    if (game && game.status === 'playing') {
      var now = perf();
      if (game.checkFlag(now)) { gameOver(); return; }
      renderClocks(now);
      if (game.clock && game.cfg.tc.base > 30000 && !spectating()) {
        var mine = oppGame() ? game.cfg.human : game.pos.side, left = game.timeLeft(mine, now);
        if (left < 10000 && game.pos.side === mine && game.running() && !lowWarned) { lowWarned = true; Sound.play('lowtime'); }
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
  function gameHome() { return game && botGame() ? 'bots' : 'play'; }
  $('btn-new').addEventListener('click', function () { go(gameHome()); });
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
  window.addEventListener('resize', layout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  setInterval(function () { if (document.hidden) tick(); }, 250);

  // ------------------------------------------------------------------ online play
  // The server owns legality, clocks and results. Own moves are shown at once and confirmed by the
  // server; the opponent's moves arrive as full game states (broadcast, with polling as a fallback).
  var NETCFG = window.GC_ONLINE || null;
  var ONLINE_TCS = ['1+0', '2+1', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10'];
  var FIRST_MOVE_MS = 30000, CLAIM_GRACE = 300, PEER_TTL = 4000;
  var net = null, netReady = null, me = null, userSub = null;
  var online = null;   // the open online game: { id, s, color, pending, sub, connected, lastEvent, oppHere, ... }
  var lobby = null;    // seeking or inviting: { kind, tc, rated, t0, timer, tick, gameId, sub }
  var clockOffset = 0, bestRtt = Infinity;
  var urlQ = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var profileSuffix = String(urlQ.get('p') || '').replace(/[^a-z0-9]/gi, '').slice(0, 8);

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
    function openUrl(url) {
      // the in-app browser (Safari View Controller / Chrome Custom Tab); without the plugin the shell sends
      // a navigation to another site to the system browser anyway
      return call('Browser', 'open', { url: url, presentationStyle: 'popover' }).catch(function () { location.assign(url); });
    }
    return { on: on, platform: platform, redirect: 'goldenchess://auth', call: call, listen: listen, openUrl: openUrl };
  })();

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
  // ---- account (Supabase Auth): a guest links an email to the same account; on another device the email signs in
  // in the app, sign-in links and Google come back to the app itself
  function authRedirect() { return NATIVE.on ? NATIVE.redirect : location.origin + location.pathname + (profileSuffix ? '?p=' + profileSuffix : ''); }
  function authFail(r) { if (r && r.error) { var e = new Error(r.error.message || 'auth'); e.code = r.error.code || ''; e.status = r.error.status; throw e; } return r && r.data; }
  SupaNet.prototype.account = function () {
    return this.sb.auth.getSession().then(function (r) {
      var u = r.data && r.data.session && r.data.session.user;
      return u ? { uid: u.id, email: u.email || null, guest: !!u.is_anonymous } : null;
    });
  };
  SupaNet.prototype.linkEmail = function (email) { return this.sb.auth.updateUser({ email: email }, { emailRedirectTo: authRedirect() }).then(authFail); };
  SupaNet.prototype.signInEmail = function (email, create) {
    return this.sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: !!create, emailRedirectTo: authRedirect() } }).then(authFail);
  };
  SupaNet.prototype.verifyCode = function (email, code, type) { return this.sb.auth.verifyOtp({ email: email, token: code, type: type }).then(authFail); };
  SupaNet.prototype.signOut = function () { return this.sb.auth.signOut({ scope: 'local' }).then(authFail); };
  SupaNet.prototype.google = function (link) {
    var o = { provider: 'google', options: { redirectTo: authRedirect() } };
    save('googleTry', link ? 'link' : 'signin'); // what the answer from Google belongs to (see googleTaken)
    if (NATIVE.on) o.options.skipBrowserRedirect = true; // the app opens the system browser itself
    return (link ? this.sb.auth.linkIdentity(o) : this.sb.auth.signInWithOAuth(o)).then(authFail).then(function (d) {
      if (!NATIVE.on) return d;
      if (!d || !d.url) throw new Error('no_url');
      return NATIVE.openUrl(d.url).then(function () { return d; });
    });
  };
  // the leaderboard: public data, read with the public key (no account needed)
  SupaNet.prototype.top = function (pool) {
    return this.sb.from('ratings').select('user_id, rating, rd, games, wins, draws, losses, profiles(username)').eq('pool', pool).gt('games', 0)
      .order('rating', { ascending: false }).limit(50).then(function (r) {
        if (r.error) throw r.error;
        return (r.data || []).map(function (x) {
          return { uid: x.user_id, name: (x.profiles && x.profiles.username) || '?', rating: Math.round(x.rating), rd: Math.round(x.rd), games: x.games, wins: x.wins, draws: x.draws, losses: x.losses };
        });
      });
  };
  SupaNet.prototype.read = function (id) {
    return this.sb.from('games').select('*').eq('id', id).maybeSingle().then(function (r) { if (r.error) throw r.error; return r.data; });
  };
  SupaNet.prototype.sub = function (topic, h) {
    var sb = this.sb, ch = sb.channel(topic, { config: { private: true, presence: { key: this.uid || 'x' }, broadcast: { self: false } } });
    ['state', 'paired', 'move'].forEach(function (ev) { ch.on('broadcast', { event: ev }, function (m) { if (h.event) h.event(ev, m.payload); }); });
    if (h.presence) ch.on('presence', { event: 'sync' }, function () { h.presence(Object.keys(ch.presenceState())); });
    ch.subscribe(function (status) {
      if (status === 'SUBSCRIBED' && h.presence) { try { ch.track({ at: Date.now() }); } catch (e) { /* ignore */ } }
      if (h.status) h.status(status);
    });
    return {
      close: function () { try { sb.removeChannel(ch); } catch (e) { /* ignore */ } },
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
  MockNet.prototype.signOut = function () {
    this.uid = 'u' + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('goldenchess.mockuid' + profileSuffix, this.uid); } catch (e) { /* ignore */ }
    return Promise.resolve();
  };
  MockNet.prototype.google = function () { return Promise.reject(new Error('unsupported')); };
  MockNet.prototype.top = function (pool) { return this.call('top', { pool: pool }).then(function (r) { return r.rows || []; }); };
  MockNet.prototype.sub = function (topic, h) {
    var base = this.base, uid = this.uid;
    var es = new EventSource(base + '/events?topic=' + encodeURIComponent(topic) + '&uid=' + encodeURIComponent(uid));
    es.onopen = function () { if (h.status) h.status('SUBSCRIBED'); };
    es.onerror = function () { if (h.status) h.status('CHANNEL_ERROR'); };
    es.onmessage = function (e) { var d = JSON.parse(e.data); if (d.event === 'presence') { if (h.presence) h.presence(d.payload); } else if (h.event) h.event(d.event, d.payload); };
    return {
      close: function () { es.close(); },
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
    netReady = net.ready().then(function () { return Promise.all([net.call('hello'), net.account().catch(function () { return null; })]); }).then(function (rr) {
      var r = rr[0], a = rr[1];
      me = { uid: net.uid, profile: r.profile, ratings: {}, email: a && a.email || null, guest: !a || a.guest };
      (r.ratings || []).forEach(function (x) { me.ratings[x.pool] = x; });
      if (!userSub) userSub = net.sub('u:' + net.uid, { event: function (ev, p) { if (ev === 'paired' && p && p.game && lobby) onPaired(p.game); } });
      return r;
    });
    netReady.catch(function () { netReady = null; });
    return netReady;
  }
  function refreshMe() {
    if (!net || !me) return Promise.resolve();
    return Promise.all([net.call('hello'), net.account().catch(function () { return null; })]).then(function (rr) {
      var r = rr[0], a = rr[1];
      me.profile = r.profile; me.ratings = {}; (r.ratings || []).forEach(function (x) { me.ratings[x.pool] = x; });
      if (a) { me.email = a.email || null; me.guest = a.guest; }
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
    clearTimeout(lobby.timer); clearInterval(lobby.tick);
    if (lobby.sub) lobby.sub.close();
    lobby = null;
  }
  function cancelLobby() {
    var L = lobby; stopLobby();
    if (!L || !net) return;
    if (L.kind === 'seek') net.call('cancel').catch(function () { /* ignore */ });
    if (L.kind === 'invite' && L.gameId) net.call('resign', { game: L.gameId }).catch(function () { /* ignore */ });
  }
  function onPaired(id) { stopLobby(); if (currentDialog && currentDialog.dataset.kind === 'lobby') closeDialog(); openOnlineGame(id); }
  function startSeek(tc, rated) {
    stopLobby();
    var L = lobby = { kind: 'seek', tc: tc, rated: rated, t0: perf(), timer: 0, tick: 0 };
    showLobbyDialog();
    ensureNet().then(function () { seekTick(L); }, function () { if (lobby === L) { stopLobby(); closeDialog(); toast(T('netError')); } });
  }
  function seekTick(L) {
    if (lobby !== L) return;
    net.call('seek', { tc: L.tc, rated: L.rated }).then(function (r) {
      if (r.game) { if (lobby === L || (online && online.id === r.game.id) || !online) onPaired(r.game.id); return; }
      if (lobby === L) L.timer = setTimeout(function () { seekTick(L); }, 3000);
    }, function () { if (lobby === L) L.timer = setTimeout(function () { seekTick(L); }, 5000); });
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
      watchInvite(L, r.game.id);
    }, function () { if (lobby === L) { stopLobby(); closeDialog(); toast(T('netError')); } });
  }
  function watchInvite(L, id) {
    L.gameId = id;
    L.sub = net.sub('g:' + id, { event: function (ev, s) { if (ev === 'state' && s && s.status === 'playing' && lobby === L) onPaired(id); } });
    (function poll() {
      if (lobby !== L) return;
      net.read(id).then(function (g) {
        if (lobby !== L) return;
        if (g && g.status === 'playing') onPaired(id);
        else if (!g || g.status !== 'waiting') { stopLobby(); closeDialog(); }
        else L.timer = setTimeout(poll, 4000);
      }, function () { if (lobby === L) L.timer = setTimeout(poll, 6000); });
    })();
    if (L.render) L.render();
  }
  function copyText(text, okMsg, inputEl) {
    function fallback() { if (inputEl) { try { inputEl.focus(); inputEl.select(); } catch (e) { /* ignore */ } } }
    try { navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); } catch (e) { fallback(); }
  }
  function showLobbyDialog() {
    var L = lobby;
    openDialog(function (card) {
      currentDialog.dataset.kind = 'lobby';
      currentDialog.onClose = function () { if (lobby === L) cancelLobby(); };
      var meta = tcLabel(L.tc) + ', ' + (L.rated ? T('rated') : T('casual')).toLowerCase();
      if (L.kind === 'seek') {
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('searching'))));
        var sub = h('div', { class: 'dlg-sub', id: 'seek-sub' }); card.appendChild(sub);
        card.appendChild(h('div', { class: 'seekbar' }, '<i></i>'));
        var upd = function () { if (lobby !== L) return; var sec = Math.floor((perf() - L.t0) / 1000); sub.textContent = meta + ', ' + Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); };
        upd(); L.tick = setInterval(upd, 1000);
      } else {
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('invite'))));
        card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('inviteSub'))));
        var box = h('div', { class: 'linkbox' });
        var inp = h('input', { type: 'text', readonly: 'readonly', id: 'invite-link', 'aria-label': T('invite') });
        var cp = h('button', { type: 'button', class: 'sbtn', id: 'btn-copy-link' }, esc(T('copyLink')));
        cp.addEventListener('click', function () { copyText(inp.value, T('linkCopied'), inp); });
        box.appendChild(inp); box.appendChild(cp);
        var sh = null;
        // the share sheet: the browser's, or the system one in the app (an Android web view has no navigator.share)
        if (NATIVE.on || navigator.share) {
          sh = h('button', { type: 'button', class: 'sbtn', id: 'btn-share-link' }, esc(T('share')));
          sh.addEventListener('click', function () {
            if (!L.gameId) return;
            var o = { title: 'Golden Chess', text: T('shareText'), url: inp.value };
            if (NATIVE.on) { NATIVE.call('Share', 'share', Object.assign({ dialogTitle: T('share') }, o)).catch(function () { copyText(inp.value, T('linkCopied'), inp); }); return; }
            try { navigator.share(o).catch(function () { /* ignore */ }); } catch (e) { /* ignore */ }
          });
          box.appendChild(sh);
        }
        card.appendChild(box);
        card.appendChild(h('div', { class: 'record' }, esc(meta + '. ' + T('waitingFriend') + '…')));
        L.render = function () { inp.value = L.gameId ? inviteLink(L.gameId) : T('connecting') + '…'; cp.disabled = !L.gameId; if (sh) sh.disabled = !L.gameId; };
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
  function hasProgress() { return !!me && Object.keys(me.ratings).some(function (p) { return me.ratings[p].games > 0; }); }
  function boldVar(key, name, value) { var v = {}; v[name] = '\u0000'; return esc(T(key, v)).replace('\u0000', '<b>' + esc(value) + '</b>'); }
  // The account dialog (save progress, sign out) and the sign-in page share one flow.
  // back: reopens the dialog the player came from once they are done here
  function showAccount(back) {
    openDialog(function (card) {
      currentDialog.dataset.kind = 'account';
      var flow = accountFlow(card, { onDone: function () { closeDialog(); if (back) back(); }, onCancel: closeDialog });
      currentDialog.onClose = flow.stop;
    });
  }
  // o: { page: the full-page sign-in, onDone(), onCancel() }
  function accountFlow(card, o) {
    var st = { step: 'form', email: '', code: '', type: '', existing: false, err: '', busy: false, sentAt: 0, acct: null, name: '' };
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
      var title = st.step === 'signed' ? (o.page ? T('signedInTitle') : T('account')) : st.step === 'code' ? T('codeTitle') : st.step === 'name' ? T('nameTitle') : (o.page ? T('signInTitle') : T('signIn'));
      if (o.page) card.appendChild(h('div', { class: 'mark', 'aria-hidden': 'true' }, STAR_SVG));
      card.appendChild(h('div', { class: 'dlg-title' }, esc(title)));
      if (st.step === 'loading') { card.appendChild(h('div', { class: 'muted' }, esc(T('connecting')) + '…')); return; }
      var err = st.err ? h('div', { class: 'err', id: 'acct-err', role: 'alert' }, esc(st.err)) : null;
      if (st.step === 'signed') {
        card.appendChild(h('div', { class: 'acct-who', id: 'acct-who' }, boldVar('signedInAs', 'email', (st.acct && st.acct.email) || '')));
        if (!o.page) card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('signedSub'))));
        if (err) card.appendChild(err);
        if (o.page) { card.appendChild(btn('primary', T('cont'), o.onDone, 'btn-acct-done')); return; }
        var so = btn('secondary danger', T('signOut'), signOut, 'btn-signout'); so.disabled = st.busy;
        card.appendChild(row([so, btn('primary', T('done'), o.onDone, 'btn-acct-done')]));
        return;
      }
      if (st.step === 'name') {
        card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('nameSub'))));
        var nf = h('form', { class: 'acct-form', novalidate: '' });
        var ni = h('input', { type: 'text', class: 'acct-input', id: 'acct-name', maxlength: '20', autocomplete: 'nickname', spellcheck: 'false', 'aria-label': T('nameTitle') });
        ni.value = st.name;
        nf.appendChild(ni);
        if (err) nf.appendChild(err);
        var nb = h('button', { type: 'submit', class: 'primary', id: 'btn-name' }, esc(T('cont')));
        nb.disabled = st.busy;
        nf.appendChild(nb);
        nf.addEventListener('submit', function (e) { e.preventDefault(); saveName(ni.value); });
        card.appendChild(nf);
        return;
      }
      if (st.step === 'form') {
        card.appendChild(h('div', { class: 'dlg-sub' }, esc(o.page ? T('signInPageSub') : T('signInSub'))));
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
        if (NETCFG && NETCFG.googleAuth) {
          card.appendChild(h('div', { class: 'acct-or' }, esc(T('or'))));
          var gb = btn('secondary g-btn', T('continueGoogle'), google, 'btn-google'); gb.disabled = st.busy;
          gb.innerHTML = GOOGLE_G + '<span>' + esc(T('continueGoogle')) + '</span>';
          card.appendChild(row([gb]));
        }
        if (o.page) {
          var alt = h('div', { class: 'signin-alt' }, esc(T('practise')) + ' ');
          alt.appendChild(btn('linkbtn', T('playTheBot'), function () { save('pending', null); go('bots'); }, 'btn-signin-bot'));
          card.appendChild(alt);
        }
        if (!st.busy) focus(inp);
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
      st.busy = true; st.err = ''; st.email = email; render();
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
            if (o.page && !hasProgress()) { st.step = 'name'; st.name = me.profile ? me.profile.username : ''; render(); return; } // a new account: let them pick a name
            if (o.page) { o.onDone(); return; }
            st.step = 'signed'; render();
          });
        }
        // another account: start over as that player
        save('online', null); save('notice', 'signedIn'); setUrl(null); // don't reopen the previous player's game
        location.reload();
      }).catch(function (e) { if (!alive) return; st.busy = false; st.code = ''; st.err = authMsg(e); render(); });
    }
    function saveName(name) {
      name = String(name || '').trim();
      if (st.busy) return;
      if (!name || (me && me.profile && name === me.profile.username)) { o.onDone(); return; }
      st.busy = true; st.err = ''; st.name = name; render();
      net.call('rename', { name: name }).then(function (r) { me.profile = r.profile; st.busy = false; o.onDone(); }, function (er) {
        var c = er && er.data && er.data.error;
        st.busy = false; st.err = c === 'name_taken' ? T('nameTaken') : c === 'bad_name' ? T('badName') : T('netError'); render();
      });
    }
    function signOut() {
      if (liveOnlineGame()) { st.err = T('finishFirst'); render(); return; }
      st.busy = true; render();
      doSignOut(function (e) { st.busy = false; st.err = authMsg(e); render(); });
    }
    function google() {
      if (st.busy) return;
      st.busy = true; st.err = ''; render();
      // a guest links Google to the same account; otherwise Google signs in (the page leaves for Google here;
      // in the app the system browser opens over the page and the answer comes back through nativeUrl)
      ensureNet().then(function () { return net.account(); }).then(function (a) { return net.google(!!(a && a.guest)); })
        .then(function () { if (NATIVE.on && alive) { st.busy = false; render(); } }, function (e) { st.busy = false; st.err = authMsg(e); render(); });
    }
    return { stop: function () { alive = false; clearInterval(timer); } };
  }
  function doSignOut(onErr) {
    net.signOut().then(function () { save('online', null); save('notice', 'signedOut'); save('pending', null); setUrl(null); location.hash = 'play'; location.reload(); }, onErr);
  }
  // Back from the link in a sign-in email (or from Google): supabase-js has already taken the session (or the
  // error) from the address. Tidy the address and say what happened.
  var AUTH_HASH = /(access_token|error_code|error_description)=/;
  // A guest's "Continue with Google" links Google to the guest. When that Google account (or its email) already
  // has a player, sign in to that player instead: once, never again after a sign-in attempt (no loop)
  function googleTaken(err, desc) {
    if (!(err === 'identity_already_exists' || err === 'email_exists' || /already (been )?(registered|linked)/i.test(desc || ''))) return false;
    if (load('googleTry', '') !== 'link') return false;
    save('googleTry', 'signin');
    return true;
  }
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
      if (net.google && googleTaken(err, desc)) { toast(T('googleExists')); net.google(false).catch(function () { toast(T('signInFailed')); }); return; }
      if (err) toast(/expired|invalid/i.test(err + ' ' + desc) ? T('linkExpired') : T('signInFailed'));
      else if (me && !me.guest) {
        toast(type === 'email_change' ? T('progressSaved') : T('signedInAs', { email: me.email || '' }));
        var a = takePending(); if (a) runPending(a);
      }
      renderAll(); if (curView !== 'game') refreshView();
    }, function () { toast(T('netError')); });
    return true;
  }

  // ---- the app: what the system browser sends back (goldenchess://auth#access_token=…), the Android back
  // button, the splash screen
  var nativeSeen = {};
  function nativeUrl(url, launch) {
    url = String(url || '');
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
    if (err) {
      // this Google account already belongs to another player: sign in to that one (one more trip to the browser)
      if (googleTaken(err, desc)) { toast(T('googleExists')); ensureNet().then(function () { return net.google(false); }).catch(function () { toast(T('signInFailed')); }); return; }
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
        var a = takePending();
        if (a) runPending(a); else if (curView === 'signin') go('play'); else if (curView !== 'game') refreshView();
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
    NATIVE.call('SplashScreen', 'hide', { fadeOutDuration: 200 }).catch(function () { /* ignore */ });
  }

  // ---- the online game itself
  function leaveOnline() {
    if (!online) return;
    if (online.sub) online.sub.close();
    if (online.peer) online.peer.close();
    clearTimeout(online.peerCheck);
    online = null;
    save('online', null);
    setUrl(null);
  }
  function openOnlineGame(id) {
    if (online && online.id === id) return;
    ensureNet().then(function () { return net.call('game', { game: id }); }).then(function (r) {
      var g = r.game;
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
    g.online = true;
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
    var o = online = { id: s.id, s: null, color: color, pending: null, sub: null, connected: false, lastEvent: perf(), oppHere: null,
      claimBusy: false, claimNext: 0, reading: false, firstSec: -1, peer: null, peerMoves: [] };
    game = buildOnlineGame(s, color);
    view = game.records.length;
    setGoldenArmed(false);
    orient = color === 1 ? 1 : 0;
    board.setOrientation(orient);
    board.sync(game.pos.board, [], { instantAll: true });
    var opp = color === 0 ? s.black_id : s.white_id;
    o.sub = net.sub('g:' + s.id, {
      event: function (ev, p) { if (ev === 'state' && online === o) { o.lastEvent = perf(); onServerState(p); } },
      status: function (st) { if (online !== o) return; var was = o.connected; o.connected = st === 'SUBSCRIBED'; if (o.connected && !was) resyncOnline(); },
      presence: function (keys) { if (online !== o || color < 0) return; o.oppHere = keys.indexOf(opp) >= 0; renderBars(); }
    });
    // moves straight from the other player (shown at once; the server's state on g: stays the authority)
    o.peer = net.sub('m:' + s.id, { event: function (ev, p) { if (ev === 'move' && online === o) onPeerMove(p); } });
    onServerState(s, { force: true, initial: true });
    if (game.status === 'playing') Sound.play('start');
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
    online.pending = null;
  }
  // bring the local game in line with a server state
  // a local move the server hasn't confirmed yet: ours on its way, or the opponent's seen peer-to-peer
  function unconfirmed(ply, uci) {
    var o = online, i;
    if (o.pending && o.pending.ply === ply && o.pending.uci === uci) return true;
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
      if (wasPlaying && !opts.initial) { gameOver(); return; }
    }
    renderAll();
    if (currentDialog && currentDialog.dataset.kind === 'over') showOver();
  }
  function resyncOnline() {
    var o = online;
    if (!o || o.reading || !net) return;
    o.reading = true;
    net.read(o.id).then(function (g) { o.reading = false; o.lastEvent = perf(); if (online === o && g) onServerState(g, { force: true }); }, function () { o.reading = false; });
  }
  function sendMove(rec) {
    var p = { ply: game.records.length - 1, uci: rec.uci, tries: 0 };
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
    net.call('move', { game: o.id, uci: p.uci, ply: p.ply }).then(function (r) {
      if (online !== o) return;
      if (o.pending === p) o.pending = null;
      onServerState(r.game);
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
  document.addEventListener('visibilitychange', function () { if (!document.hidden && online) resyncOnline(); });
  // ------------------------------------------------------------------ app shell: tabs and pages
  // Play (start screen), Learn, Ratings, Profile, the sign-in page and the game itself are views of one page;
  // the address keeps the view (#play, #learn, ...) so the back button and reloads work.
  var shellEl = $('shell'), curView = null, learnKit = null, signinFlow = null, ratingsPool = null;
  var botsUi = { sel: Math.max(0, Math.min(7, (lastSetup.level || 3) - 1)), color: lastSetup.color || 'w' };
  var VIEWS = ['play', 'bots', 'learn', 'ratings', 'profile', 'signin', 'game'], NAV = ['play', 'bots', 'learn', 'ratings', 'profile'];
  var NAV_KEY = { play: 'navPlay', bots: 'navBots', learn: 'navLearn', ratings: 'navRatings', profile: 'navProfile' };
  var COLOR_RANDOM_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="#1f2422"/><path d="M12 3.4a8.6 8.6 0 0 0 0 17.2z" fill="#f4efe4"/><circle cx="12" cy="12" r="8.6" fill="none" stroke="#8d9691" stroke-width="1.2"/></svg>';
  // Google's "G" for the sign-in button (their branding asks for it on "Continue with Google")
  var GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1 6.1 3.4 8.5 9.5 9.5-6.1 1-8.5 3.4-9.5 9.5-1-6.1-3.4-8.5-9.5-9.5 6.1-1 8.5-3.4 9.5-9.5z" fill="#e7b44a"/></svg>';
  var LOGO_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" fill="#3a423f"/><path d="M2 9a7 7 0 0 1 7-7h7v14H2z" fill="#4a5350"/><path d="M16 16h14v7a7 7 0 0 1-7 7h-7z" fill="#4a5350"/><path d="M16 5.5c.9 5.4 3.6 8.1 9 9-5.4.9-8.1 3.6-9 9-.9-5.4-3.6-8.1-9-9 5.4-.9 8.1-3.6 9-9z" fill="#e7b44a"/></svg>';
  var CHEV_SVG = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
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
    pass: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 11.5h18.5l-4.2-4.2M26 20.5H7.5l4.2 4.2"/></svg>'
  };
  function initial(name) { var c = String(name || '?').trim().charAt(0); return c ? c.toUpperCase() : '?'; }
  function signedIn() { return !!(me && !me.guest); }
  function tcLabel(t) { return String(t); } // plain text: 3+2
  // buttons show 3 | 2 with a drawn divider (the | glyph reads as an I in some fonts); screen readers get 3+2
  function tcHtml(t) { var p = String(t).split('+'); return esc(p[0]) + '<i class="tc-sep"><b>+</b></i>' + esc(p[1] || '0'); }
  function ratingText(pool) { var r = me && me.ratings[pool]; return r ? Math.round(r.rating) + (r.rd > 110 ? '?' : '') : '1500?'; }
  function viewEl(v) { return v === 'game' ? app : $('view-' + v); }
  function viewFromUrl() { var hh = (location.hash || '').replace(/^#/, ''); return VIEWS.indexOf(hh) >= 0 ? hh : null; }
  function allowed(v) {
    if (VIEWS.indexOf(v) < 0) return false;
    if (v === 'game') return !!game;
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
    VIEWS.forEach(function (x) { var el = viewEl(x); if (el) el.hidden = x !== v; });
    renderNav();
    if (prev !== null && prev !== v && currentDialog && currentDialog.dataset.kind !== 'lobby') closeDialog();
    if (prev === 'signin' && v !== 'signin' && signinFlow) { signinFlow.stop(); signinFlow = null; }
    if (v === 'game') { resumeLocalGame(); layout(); renderAll(); } else pauseLocalGame();
    if (learnKit) learnKit.active(v); // autoplay boards run only on the tab that shows them
    if (v !== 'game') {
      refreshView();
      if (prev !== v) { var el = viewEl(v); try { el.scrollTop = 0; } catch (e) { /* ignore */ } }
    }
  }
  function refreshView() {
    if (curView === 'play') renderPlay(); else if (curView === 'bots') renderBots(); else if (curView === 'learn') renderLearn(); else if (curView === 'ratings') renderRatings();
    else if (curView === 'profile') renderProfile(); else if (curView === 'signin') renderSignin();
  }
  function renderNav() {
    var active = curView === 'game' ? gameHome() : curView === 'signin' ? 'play' : curView;
    var items = NAV.filter(allowed);
    [$('rail-items'), $('tabbar')].forEach(function (host) {
      if (host.dataset.built !== lang + items.join()) {
        host.innerHTML = ''; host.dataset.built = lang + items.join();
        items.forEach(function (v) {
          var a = h('a', { class: 'nav-item', href: '#' + v, 'data-nav': v }, NAV_ICON[v] + '<span>' + esc(T(NAV_KEY[v])) + '</span>');
          a.addEventListener('click', function (e) { e.preventDefault(); go(v); });
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
    if (!learnKit && window.GCLearn) learnKit = GCLearn.create({ T: T, esc: esc, h: h, settings: settings, Sound: Sound, go: go, showBotSetup: showBotSetup });
    return learnKit;
  }

  // ---- online play needs an account; the chosen action continues after signing in (even across a reload)
  function setPending(a) { a.at = Date.now(); save('pending', a); }
  function takePending() { var a = load('pending', null); save('pending', null); return a && a.at && Date.now() - a.at < 30 * 60000 ? a : null; }
  function requireAccount(a) {
    if (!NETCFG) return;
    function proceed() { if (signedIn()) runPending(a); else { setPending(a); go('signin'); } }
    if (!me && hasNetSession()) ensureNet().then(proceed, proceed); else proceed();
  }
  function runPending(a) {
    if (!a) return;
    if (a.kind === 'seek') { go('play'); startSeek(a.tc, a.rated); }
    else if (a.kind === 'invite') { go('play'); startInvite(a.tc, a.rated); }
    else if (a.kind === 'join') joinGame(a.id);
    else if (a.kind === 'view') go(a.v);
  }
  function afterSignin() { var a = takePending(); if (a) runPending(a); else go('play'); }

  // ---- Play: the start screen. One main action (Play), one quiet one (Play a friend).
  function renderPlay() {
    var host = $('view-play');
    var bwOld = host.querySelector('.play-board');
    host.innerHTML = '';
    var wrap = h('div', { class: 'play-wrap' }), bw = h('div', { class: 'play-board' }), col = h('div', { class: 'play-col' });
    wrap.appendChild(bw); wrap.appendChild(col); host.appendChild(wrap);
    var head = h('div', { class: 'play-head' });
    head.appendChild(h('div', { class: 'brand' }, LOGO_SVG + '<span class="wordmark"><b>Golden</b> Chess</span>'));
    if (NETCFG) {
      var chip;
      if (me && me.profile && signedIn()) chip = h('button', { type: 'button', class: 'acct-chip', id: 'acct-chip' }, '<span class="av">' + esc(initial(me.profile.username)) + '</span><span>' + esc(me.profile.username) + '</span>');
      else chip = h('button', { type: 'button', class: 'acct-chip out', id: 'acct-chip' }, '<span>' + esc(T('signIn')) + '</span>');
      chip.addEventListener('click', function () { if (signedIn()) go('profile'); else { setPending({ kind: 'view', v: 'play' }); go('signin'); } });
      head.appendChild(chip);
    }
    col.appendChild(head);
    var main = h('div', { class: 'play-main' }); col.appendChild(main);
    main.appendChild(h('div', { class: 'play-mark', 'aria-hidden': 'true' }, '<div class="ring"></div><i class="pc-ic p-wN"></i>' +
      '<span class="sp" style="left:6px;top:34px"></span><span class="sp" style="left:100px;top:76px"></span><span class="sp" style="left:24px;top:98px;width:4px;height:4px"></span><span class="st">' + STAR_SVG + '</span>'));
    var acts = h('div', { class: 'play-actions' });
    main.appendChild(acts);
    var lr = localResume(); if (lr) acts.appendChild(lr);
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
      acts.appendChild(bigBtn('second-btn', T('playFriendShort'), 'btn-friend', friendSheet));
      acts.appendChild(h('div', { class: 'play-meta', id: 'play-meta' }, esc(signedIn() ? T('ratingIn', { pool: T(pool), r: ratingText(pool) }) + ', ' + (rated ? T('rated') : T('casual')).toLowerCase() : T('signInFree'))));
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
    // wide screens: a board beside the menu, showing a golden move
    if (window.matchMedia && matchMedia('(min-width: 1100px)').matches && kit()) learnKit.heroBoard(bw, bwOld);
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
      card.appendChild(opt('', 'pass', T('friendHere'), T('friendHereSub'), 'btn-pass', function () { closeDialog(); showLocalSetup(); }));
    });
  }

  // ---- Bots: pick a character, one Play button
  function renderBots() {
    var host = $('view-bots'), keep = host.scrollTop;
    host.innerHTML = '';
    var inn = h('div', { class: 'page-in bots-page' }); host.appendChild(inn);
    inn.appendChild(h('h1', { class: 'page-h' }, esc(T('navBots'))));
    if (game && !game.online && botGame() && game.status === 'playing' && !game.idle && game.records.length) {
      var rb = h('div', { class: 'resume', id: 'resume' }, '<span class="av-s">' + GCBots.avatar(game.cfg.level - 1, lang) + '</span><span class="t"><b>' + esc(T('unfinished')) + '</b><span>' + esc(T('botOpp', { name: GCBots.name(game.cfg.level - 1, lang) })) + '</span></span>');
      rb.appendChild(bigBtn('sbtn', T('cont'), 'btn-resume', function () { go('game'); }));
      inn.appendChild(rb);
    }
    var hw = h('div', { class: 'bot-hero-wrap' }), hero = h('div', { class: 'bot-hero', id: 'bot-hero' });
    hw.appendChild(hero); inn.appendChild(hw);
    var tiles = [], pb;
    function paint() {
      var i = botsUi.sel, st = stats['L' + (i + 1)], nm = GCBots.name(i, lang);
      hero.innerHTML = '<div class="bot-face">' + GCBots.avatar(i, lang) + '</div>' +
        '<div class="bot-info"><div class="bot-name"><b>' + esc(nm) + '</b><span class="elo">' + Engine.LEVELS[i].elo + '</span></div>' +
        '<div class="bot-lv">' + esc(T('lv' + (i + 1))) + '</div></div>' +
        '<p class="bot-bio">' + esc(GCBots.bio(i, lang)) + '</p>';
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
      tiles.forEach(function (t, k) { t.setAttribute('aria-pressed', String(k === i)); });
      if (pb) pb.textContent = GCBots.playWith(i, lang);
    }
    [[T('easier'), [0, 1, 2, 3]], [T('stronger'), [4, 5, 6, 7]]].forEach(function (g) {
      inn.appendChild(h('h2', { class: 'bot-group' }, esc(g[0])));
      var grid = h('div', { class: 'bot-grid' });
      g[1].forEach(function (i) {
        var t = h('button', { type: 'button', class: 'bot-tile', id: 'bot-' + (i + 1), 'aria-pressed': 'false', 'aria-label': GCBots.name(i, lang) + ', ' + Engine.LEVELS[i].elo },
          '<span class="face">' + GCBots.avatar(i, lang) + '</span><span class="nm">' + esc(GCBots.name(i, lang)) + '</span><span class="el">' + Engine.LEVELS[i].elo + '</span>');
        t.addEventListener('click', function () { Sound.unlock(); botsUi.sel = i; lastSetup.level = i + 1; save('setup', lastSetup); paint(); });
        tiles[i] = t; grid.appendChild(t);
      });
      inn.appendChild(grid);
    });
    var bar = h('div', { class: 'cta-bar' });
    pb = bigBtn('start-btn', '', 'btn-play', function () {
      var s = { mode: 'bot', level: botsUi.sel + 1, color: botsUi.color, tc: 'none' };
      lastSetup = Object.assign({}, lastSetup, { level: s.level, color: s.color }); save('setup', lastSetup);
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
    var my = h('div', { class: 'card my-card', id: 'my-rating' });
    if (signedIn()) {
      var r = me.ratings[pool];
      my.innerHTML = '<div class="big">' + esc(ratingText(pool)) + '</div><div class="meta"><b>' + esc(T('yourRating')) + '</b><span>' +
        esc(r && r.games ? T('gamesN', { n: r.games }) + ', ' + T('wdl', { w: r.wins, d: r.draws, l: r.losses }) : T('noGamesYet')) + '</span></div>';
    } else {
      my.className += ' out';
      my.appendChild(h('div', { class: 'muted' }, esc(T('signInToRate'))));
      var sb = h('button', { type: 'button', class: 'primary', id: 'btn-ratings-signin' }, esc(T('signIn')));
      sb.addEventListener('click', function () { setPending({ kind: 'view', v: 'ratings' }); go('signin'); });
      my.appendChild(sb);
    }
    inn.appendChild(my);
    var lbc = h('div', { class: 'card lb-card' }), list = h('div', { class: 'lb', id: 'lb-list' });
    lbc.appendChild(list); inn.appendChild(lbc);
    list.innerHTML = '<div class="muted" style="padding:10px 4px">' + esc(T('connecting')) + '…</div>';
    var c = getClient();
    (c ? c.top(pool) : Promise.reject(new Error('offline'))).then(function (rows) {
      if (!list.isConnected) return;
      if (!rows.length) { list.innerHTML = '<div class="muted" style="padding:10px 4px">' + esc(T('lbEmpty')) + '</div>'; return; }
      list.innerHTML = rows.map(function (x, i) {
        var mine = me && (x.uid ? x.uid === me.uid : me.profile && x.name === me.profile.username);
        return '<div class="lb-row' + (mine ? ' me' : '') + '"><span class="lb-n">' + (i + 1) + '</span><span class="lb-name">' + esc(x.name) + '</span><span class="lb-r">' + x.rating + (x.rd > 110 ? '?' : '') + '</span><span class="lb-g">' + esc(T('gamesN', { n: x.games })) + '</span></div>';
      }).join('');
    }, function () { if (list.isConnected) list.innerHTML = '<div class="muted" style="padding:10px 4px">' + esc(T('netError')) + '</div>'; });
    if (!me && hasNetSession()) ensureNet().then(function () { if (curView === 'ratings' && signedIn() && !my.querySelector('.big')) renderRatings(); }, function () { /* offline */ });
  }

  // ---- Profile: account, ratings, settings
  function renderProfile() {
    var host = $('view-profile');
    host.innerHTML = '';
    var inn = h('div', { class: 'page-in' }); host.appendChild(inn);
    inn.appendChild(h('h1', { class: 'page-h' }, esc(T('navProfile'))));
    if (NETCFG) {
      if (!me && hasNetSession()) ensureNet().then(function () { if (curView === 'profile') renderProfile(); }, function () { /* offline */ });
      var nm = me && me.profile && signedIn() ? me.profile.username : T('profileGuest');
      var hero = h('div', { class: 'prof-hero' });
      hero.appendChild(h('div', { class: 'avatar-lg' + (signedIn() ? ' reg' : ''), 'aria-hidden': 'true' }, esc(initial(nm))));
      var who = h('div', { class: 'prof-who' });
      var nameEl = h('div', { class: 'prof-name', id: 'prof-name' }, '<span>' + esc(nm) + '</span>');
      who.appendChild(nameEl);
      who.appendChild(h('div', { class: 'prof-sub', id: 'prof-sub' }, esc(signedIn() ? (me.email || '') : T('profileSignedOut'))));
      hero.appendChild(who); inn.appendChild(hero);
      if (signedIn()) {
        var ch = h('button', { type: 'button', class: 'linkbtn', id: 'btn-rename' }, esc(T('change')));
        ch.addEventListener('click', function () { renameForm(who, nameEl); });
        nameEl.appendChild(ch);
        var grid = h('div', { class: 'pool-grid' });
        ['bullet', 'blitz', 'rapid'].forEach(function (p) {
          var r = me.ratings[p];
          grid.appendChild(h('div', { class: 'pool-card' }, '<span class="h"><span class="ic-' + p + '">' + POOL_ICON[p] + '</span>' + esc(T(p)) + '</span><span class="r">' + esc(ratingText(p)) + '</span><span class="g">' + esc(r && r.games ? T('gamesN', { n: r.games }) : T('noGamesYet')) + '</span>'));
        });
        inn.appendChild(grid);
        var so = h('button', { type: 'button', class: 'secondary danger', id: 'btn-signout' }, esc(T('signOut')));
        var soErr = h('div', { class: 'err', id: 'signout-err' });
        so.addEventListener('click', function () {
          if (liveOnlineGame()) { soErr.textContent = T('finishFirst'); return; }
          so.disabled = true;
          doSignOut(function (e) { so.disabled = false; soErr.textContent = authMsg(e); });
        });
        var row = h('div', { class: 'row-btns' }); row.appendChild(so); inn.appendChild(row); inn.appendChild(soErr);
      } else {
        var si = h('button', { type: 'button', class: 'primary', id: 'btn-profile-signin' }, esc(T('signIn')));
        si.addEventListener('click', function () { setPending({ kind: 'view', v: 'profile' }); go('signin'); });
        var row2 = h('div', { class: 'row-btns' }); row2.appendChild(si); inn.appendChild(row2);
      }
    }
    var sc = h('div', { class: 'card', id: 'settings-card' });
    sc.appendChild(h('h2', null, esc(T('settings'))));
    buildSettings(sc, renderProfile);
    inn.appendChild(sc);
    var ll = h('button', { type: 'button', class: 'linkbtn', id: 'btn-howto' }, esc(T('howItWorks')));
    ll.addEventListener('click', function () { go('learn'); });
    inn.appendChild(ll);
    inn.appendChild(h('div', { class: 'credit' }, esc(T('credit'))));
    // the privacy policy sits next to the site (privacy.html); the offline copies link to the site's one
    var pv = NETCFG ? 'privacy.html' : window.GC_SITE ? window.GC_SITE + 'privacy.html' : '';
    if (pv) inn.appendChild(h('a', { class: 'credit privacy-link', id: 'privacy-link', href: pv, target: '_blank', rel: 'noopener' }, esc(T('privacy'))));
  }
  function renameForm(who, nameEl) {
    var form = h('form', { class: 'prof-edit' });
    var inp = h('input', { type: 'text', maxlength: '20', id: 'name-input', autocomplete: 'nickname', spellcheck: 'false', 'aria-label': T('playingAs') });
    inp.value = me.profile.username;
    var sv = h('button', { type: 'submit', class: 'sbtn' }, esc(T('save')));
    var er = h('div', { class: 'err' });
    form.appendChild(inp); form.appendChild(sv);
    nameEl.replaceWith(form); form.after(er);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); sv.disabled = true;
      net.call('rename', { name: inp.value }).then(function (r) { me.profile = r.profile; renderProfile(); }, function (x) {
        var code = x && x.data && x.data.error; sv.disabled = false;
        er.textContent = code === 'name_taken' ? T('nameTaken') : code === 'bad_name' ? T('badName') : T('netError');
      });
    });
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { /* ignore */ } }, 20);
  }

  // ---- Learn
  function renderLearn() {
    var k = kit();
    if (!k) { $('view-learn').innerHTML = ''; return; }
    k.render($('view-learn'));
    k.active(curView);
  }

  function bootOnline() {
    if (!NETCFG) return;
    var join = urlQ.get('join'), gid = urlQ.get('game'), saved = load('online', null), note = load('notice', null);
    if (note) {
      // the page was reloaded after signing in to another account, or after signing out
      save('notice', null);
      ensureNet().then(function () {
        if (note === 'signedOut') toast(T('signedOutToast'));
        else {
          toast(signedIn() ? T('signedInAs', { email: me.email || '' }) : T('signInFailed'));
          if (signedIn()) { var a = takePending(); if (a) runPending(a); else if (curView === 'signin') go('play', true); }
        }
        refreshView();
      }, function () { /* offline */ });
    }
    var fromLink = authReturn();
    if (join) { requireAccount({ kind: 'join', id: join }); return; }
    if (gid) { openOnlineGame(gid); return; }
    if (fromLink || note || (saved && saved.id) || hasNetSession()) {
      ensureNet().then(function (r) {
        if (r.live && r.live.status === 'playing') openOnlineGame(r.live.id);
        else if (saved && saved.id) save('online', null);
        if (curView !== 'game') refreshView(); // the name and rating on the Play tab
      }, function () { /* offline: stay with the local game */ });
    }
  }

  // ------------------------------------------------------------------ boot
  function boot(hotData) {
    applySettings(); applyLang(); nativeInit();
    var saved = (hotData && hotData.game) || load('game', null), g = saved ? Game.restore(saved) : null;
    if (g) {
      game = g; view = game.records.length;
      orient = botGame() ? game.cfg.human : 0;
    } else {
      // nothing played yet: an empty board for the game view
      game = new Game({ mode: 'bot', level: lastSetup.level || 3, human: 0, tc: null });
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
    get dialogKind() { return currentDialog ? currentDialog.dataset.kind || '' : null; },
    get online() { return online; }, get me() { return me; }, get lobby() { return lobby; }, startSeek: startSeek, startInvite: startInvite,
    onlineAction: onlineAction, showNewGame: showNewGame, serverNow: serverNow, cancelPremoves: cancelPremoves,
    showAccount: showAccount, showSettings: showSettings, showOver: showOver,
    go: go, get curView() { return curView; }, showBotSetup: showBotSetup, showLocalSetup: showLocalSetup, botThinkMs: botThinkMs
  };
})();
