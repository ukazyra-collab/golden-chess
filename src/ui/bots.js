/* Golden Chess — the bots: eight characters for the eight engine levels, each with a drawn portrait.
 * Portraits are inline SVG (120 x 120), drawn here so the page stays one self-contained file.
 */
var GCBots = (function () {
  'use strict';
  var BOTS = [
    { key: 'pip', with: 'Пипом', name: { en: 'Pip', ru: 'Пип' },
      bio: { en: 'Pip learned how the pieces move last week. He still forgets he has a golden move.',
        ru: 'Пип выучил ходы на прошлой неделе и всё время забывает, что у него есть золотой ход.' } },
    { key: 'mila', with: 'Милой', name: { en: 'Mila', ru: 'Мила' },
      bio: { en: 'Mila plays with friends on weekends. Leave a piece hanging and she takes it.',
        ru: 'Мила играет с друзьями по выходным. Оставите фигуру без защиты — заберёт.' } },
    { key: 'oskar', with: 'Оскаром', name: { en: 'Oskar', ru: 'Оскар' },
      bio: { en: 'Oskar has played in the park for thirty years. He knows every opening trap and loves a quick attack.',
        ru: 'Оскар тридцать лет играет в парке. Знает все дебютные ловушки и любит быструю атаку.' } },
    { key: 'zara', with: 'Зарой', name: { en: 'Zara', ru: 'Зара' },
      bio: { en: 'Zara checks every capture and check before she moves, and keeps her golden move for the right moment.',
        ru: 'Зара проверяет все шахи и взятия и бережёт золотой ход до нужного момента.' } },
    { key: 'viktor', with: 'Виктором', name: { en: 'Viktor', ru: 'Виктор' },
      bio: { en: 'Viktor is in no hurry. He builds a solid position and waits for you to slip.',
        ru: 'Виктор не торопится: строит крепкую позицию и ждёт, когда соперник ошибётся.' } },
    { key: 'nadia', with: 'Надей', name: { en: 'Nadia', ru: 'Надя' },
      bio: { en: 'Nadia attacks from the first move. Her golden move lands exactly where it hurts.',
        ru: 'Надя атакует с первого хода. Её золотой ход прилетает туда, где больнее всего.' } },
    { key: 'leo', with: 'Лео', name: { en: 'Leo', ru: 'Лео' },
      bio: { en: 'Leo is a grandmaster. He has seen your position before, in three variations.',
        ru: 'Лео — гроссмейстер. Эту позицию он уже видел, причём в трёх вариантах.' } },
    { key: 'golden', with: 'Голденом', name: { en: 'Golden', ru: 'Голден' },
      bio: { en: 'Golden is the engine at full strength. It never gets tired, and it never misses.',
        ru: 'Голден — движок на полной силе. Не устаёт и не промахивается.' } }
  ];

  var uid = 0;
  // ---- shared parts
  function bg(u, c1, c2) {
    return '<defs><radialGradient id="b' + u + '" cx="50%" cy="34%" r="78%"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></radialGradient></defs>' +
      '<rect width="120" height="120" rx="26" fill="url(#b' + u + ')"/>';
  }
  var TORSO = 'M10 121C12 101 29 91 60 91C91 91 108 101 110 121Z';
  function torso(fill) { return '<path d="' + TORSO + '" fill="' + fill + '"/>'; }
  function neck(fill) { return '<path d="M51 66V90Q60 97 69 90V66Z" fill="' + fill + '"/>'; }
  function head(skin, rx, ry) { return '<ellipse cx="60" cy="52" rx="' + (rx || 22) + '" ry="' + (ry || 25) + '" fill="' + skin + '"/>'; }
  function ears(skin, shade, dx) {
    var l = 60 - (dx || 22), r = 60 + (dx || 22);
    return '<ellipse cx="' + l + '" cy="56" rx="4.6" ry="6.2" fill="' + skin + '"/><ellipse cx="' + r + '" cy="56" rx="4.6" ry="6.2" fill="' + skin + '"/>' +
      '<path d="M' + (l - 1.6) + ' 53.5q2 2.5 .3 5" stroke="' + shade + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M' + (r + 1.6) + ' 53.5q-2 2.5 -.3 5" stroke="' + shade + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  }
  function eyes(o) {
    o = o || {};
    var y = o.y || 54, rx = o.rx || 2.7, ry = o.ry || 3.3, c = o.color || '#2b1d18', s = '';
    [51, 69].forEach(function (x) {
      s += '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + c + '"/><circle cx="' + (x + 0.9) + '" cy="' + (y - 1.1) + '" r="' + (rx * 0.36) + '" fill="#fff"/>';
    });
    return s;
  }
  function stroke(d, c, w) { return '<path d="' + d + '" stroke="' + c + '" stroke-width="' + (w || 2.2) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'; }
  function brows(c, l, r, w) { return stroke(l || 'M46 47.5q5-3.2 10-.6', c, w || 2.6) + stroke(r || 'M64 46.9q5-2.6 10 .6', c, w || 2.6); }
  function nose(c) { return stroke('M60.2 56.5q-2.6 5.2.4 6.8', c, 1.8); }
  function cheeks(c, o) { return '<ellipse cx="45.5" cy="63" rx="4.2" ry="2.6" fill="' + c + '" opacity="' + (o || 0.32) + '"/><ellipse cx="74.5" cy="63" rx="4.2" ry="2.6" fill="' + c + '" opacity="' + (o || 0.32) + '"/>'; }
  function svg(inner, label) {
    return '<svg class="bot-av" viewBox="0 0 120 120" role="img" aria-label="' + label + '">' + inner + '</svg>';
  }

  // ---- the eight portraits
  var DRAW = [
    // Pip: propeller cap, freckles, big grin
    function (u) {
      var skin = '#f4cba4', shade = '#dfaa80';
      return bg(u, '#c9efd5', '#7cc799') +
        torso('#3f9a62') + '<path d="M47 92q13 9 26 0" stroke="#2f7c4c" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        neck(shade) + head(skin) + ears(skin, shade) +
        '<path d="M38.5 44q-3 9 1.5 15l3.4-11z" fill="#d9773a"/><path d="M81.5 44q3 9-1.5 15l-3.4-11z" fill="#d9773a"/>' +
        '<defs><clipPath id="c' + u + '"><path d="M36.5 46C36.5 30 46.5 23.5 60 23.5S83.5 30 83.5 46Z"/></clipPath></defs>' +
        '<g clip-path="url(#c' + u + ')"><rect x="30" y="20" width="22" height="30" fill="#e5533f"/><rect x="52" y="20" width="16" height="30" fill="#f3c33c"/><rect x="68" y="20" width="22" height="30" fill="#2f73d6"/></g>' +
        '<path d="M42 45.5q18 6.5 36 0l-1.2 4q-16.8 5.6-33.6 0z" fill="#2459ad"/>' +
        '<rect x="58.8" y="15" width="2.4" height="9" rx="1.2" fill="#6b5a4a"/><ellipse cx="52" cy="15" rx="8" ry="2.4" fill="#f3c33c"/><ellipse cx="68" cy="15" rx="8" ry="2.4" fill="#e5533f"/><circle cx="60" cy="15" r="2.4" fill="#2459ad"/>' +
        brows('#c0642b', 'M45.5 46q5-3.6 10-1', 'M64.5 45q5-2.6 10 1') +
        eyes({ rx: 3, ry: 3.7, y: 54.5 }) + nose(shade) +
        '<g fill="#c9855a"><circle cx="44.5" cy="61.5" r=".9"/><circle cx="47.5" cy="63.2" r=".9"/><circle cx="44" cy="64.6" r=".8"/><circle cx="75.5" cy="61.5" r=".9"/><circle cx="72.5" cy="63.2" r=".9"/><circle cx="76" cy="64.6" r=".8"/></g>' +
        '<path d="M50.5 65.2h19q0 11-9.5 11t-9.5-11z" fill="#6b241c"/><path d="M51.2 65.2h17.6v2.2q-8.8 1.8-17.6 0z" fill="#fff"/><path d="M55 72.4q5-3.2 10 0q-1.5 3.6-5 3.6t-5-3.6z" fill="#e0675a"/>';
    },
    // Mila: bun, striped sweater, earrings
    function (u) {
      var skin = '#f6d3b8', shade = '#e4b596', hair = '#7b4628';
      return bg(u, '#ffe0cb', '#f2a987') +
        '<circle cx="60" cy="22" r="10.5" fill="' + hair + '"/><path d="M51 27q9 4 18 0" stroke="#5c3219" stroke-width="2.4" fill="none"/>' +
        '<defs><clipPath id="c' + u + '"><path d="' + TORSO + '"/></clipPath></defs>' +
        torso('#2f4b7d') + '<g clip-path="url(#c' + u + ')" stroke="#f2ede4" stroke-width="4"><path d="M0 101H120M0 111H120"/></g>' +
        '<path d="M47 91.5q13 8 26 0" stroke="#24395f" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
        neck(shade) + head(skin, 21.5, 24.5) + ears(skin, shade, 21.5) +
        '<path d="M37.6 55C35.5 34 47 26 61 26.3C75 26.6 85 35.5 82.4 55C80.5 45.5 74 39.5 66.5 37.5C60 41.5 50.5 42 43.6 44.4C40.5 47 39 51 37.6 55Z" fill="' + hair + '"/>' +
        brows('#5c3219', 'M46 47.6q5-2.6 10-.4', 'M64 47.2q5-2.2 10 .4', 2.2) +
        eyes({ y: 54.6, rx: 2.6, ry: 3.2 }) + stroke('M47.9 52.2q3.1-2.2 6.2 0l1 -.9', '#2b1d18', 1.5) + stroke('M72.1 52.2q-3.1-2.2-6.2 0l-1 -.9', '#2b1d18', 1.5) +
        nose(shade) + cheeks('#ff7f73', 0.38) +
        '<path d="M53.5 66.5q6.5 5.6 13 0q-6.5 2.4-13 0z" fill="#c4544a"/>' + stroke('M53.5 66.5q6.5 5.6 13 0', '#a13d34', 1.6) +
        '<circle cx="38.2" cy="63.5" r="1.8" fill="#f0b941"/><circle cx="81.8" cy="63.5" r="1.8" fill="#f0b941"/>';
    },
    // Oskar: flat cap, grey moustache, cardigan
    function (u) {
      var skin = '#eac19c', shade = '#d4a179';
      return bg(u, '#cfe3f5', '#86b3dc') +
        torso('#6f7c4e') + '<path d="M50 91L60 109L70 91Z" fill="#efe6d2"/><path d="M50 91L60 109L54 121H45Z" fill="#5d6941"/><path d="M70 91L60 109L66 121H75Z" fill="#5d6941"/>' +
        '<circle cx="60" cy="114" r="1.6" fill="#3e4529"/>' +
        neck(shade) + head(skin, 23, 25) + ears(skin, shade, 23) +
        '<path d="M37.4 49q-1.5 10 3 15l2.4-12z" fill="#c9c9c6"/><path d="M82.6 49q1.5 10-3 15l-2.4-12z" fill="#c9c9c6"/>' +
        '<path d="M35.5 47.5C36 31 48 25 61 25C76 25 86.5 33 85.5 45.5C78 43.5 70 42.5 60 42.5C50 42.5 41.5 44.5 35.5 47.5Z" fill="#7b6249"/>' +
        '<path d="M45 31q15-5 30 0" stroke="#68513b" stroke-width="1.4" fill="none"/>' +
        '<path d="M36.5 46.6C46 41.4 62 40.4 79.5 42.4C84.5 43 88 45 89 47.6C80.5 48.6 66 47.6 54 48.2C46 48.6 40 48.9 36.5 46.6Z" fill="#5f4b37"/><circle cx="62" cy="25.6" r="1.8" fill="#5f4b37"/>' +
        brows('#bdbdb8', 'M45.5 51q5.5-2.6 10.5-.6', 'M64 50.4q5.5-2 10.5.6', 3) +
        stroke('M47.4 56.4q3.6-3.2 7.2 0', '#2b1d18', 2.3) + stroke('M65.4 56.4q3.6-3.2 7.2 0', '#2b1d18', 2.3) +
        stroke('M44 55.6l-2.2.8M76 55.6l2.2.8', shade, 1.2) +
        nose(shade) + cheeks('#ff7d6e', 0.3) +
        '<path d="M49.6 66C53.5 61.4 58 62 60 64.2C62 62 66.5 61.4 70.4 66C66.5 68.6 62.4 67.6 60 66.4C57.6 67.6 53.5 68.6 49.6 66Z" fill="#dcdcd8"/>' +
        stroke('M55.5 70.6q4.5 2.6 9 0', '#9a5141', 1.8);
    },
    // Zara: curly hair, headphones, smirk
    function (u) {
      var skin = '#8c5737', shade = '#6f4128', hair = '#2a1a12';
      return bg(u, '#e2d6f7', '#a98fdc') +
        '<g fill="' + hair + '"><circle cx="41" cy="40" r="14"/><circle cx="79" cy="40" r="14"/><circle cx="60" cy="28" r="17"/><circle cx="47" cy="29" r="12"/><circle cx="73" cy="29" r="12"/><circle cx="36.5" cy="56" r="10.5"/><circle cx="83.5" cy="56" r="10.5"/><circle cx="39" cy="67" r="7"/><circle cx="81" cy="67" r="7"/></g>' +
        torso('#ee8a3c') + '<path d="M44 91.6q16 13 32 0" stroke="#cf6c22" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M54 98v12M66 98v12" stroke="#fbeee0" stroke-width="1.8" stroke-linecap="round"/>' +
        neck(shade) +
        '<path d="M39 90C40 80 80 80 81 90" stroke="#3a3c47" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="38" cy="90" rx="6.4" ry="7.6" fill="#33353f"/><ellipse cx="82" cy="90" rx="6.4" ry="7.6" fill="#33353f"/><ellipse cx="38" cy="90" rx="3.8" ry="4.8" fill="#4b4e5b"/><ellipse cx="82" cy="90" rx="3.8" ry="4.8" fill="#4b4e5b"/><path d="M35.6 86.6q2.4-1.4 4.8 0M79.6 86.6q2.4-1.4 4.8 0" stroke="#6a6e7d" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        head(skin, 21.5, 25) + ears(skin, shade, 21.5) +
        '<path d="M40 44C42 33 51 30 60 31C69 30 78 33 80 44C74 39 66 38 60 39C54 38 46 39 40 44Z" fill="' + hair + '"/>' +
        '<path d="M70 30.5l1.3 2.8 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="#f0b941"/>' +
        brows(hair, 'M45.5 47q5-4.2 10.5-1.6', 'M64 48q5-1.4 10.5.2', 2.6) +
        eyes({ y: 54.8, rx: 2.6, ry: 3, color: '#1c120d' }) + stroke('M48 51.3q3-1.4 6 0M66 51.8q3-1.2 6 0', '#1c120d', 1.6) +
        stroke('M60.2 56.8q-2.8 5 .6 6.6', '#5e3420', 1.9) +
        '<path d="M53.5 67.4q7 3.6 13.6-1.4q-6 5.6-13.6 1.4z" fill="#5d2b1d"/>' + stroke('M53.5 67.4q7 3.6 13.6-1.4', '#4a2016', 2) +
        '<circle cx="38" cy="63" r="2.6" fill="none" stroke="#f0b941" stroke-width="1.4"/><circle cx="82" cy="63" r="2.6" fill="none" stroke="#f0b941" stroke-width="1.4"/>';
    },
    // Viktor: glasses, short beard, turtleneck
    function (u) {
      var skin = '#efc7a4', shade = '#d8a682', hair = '#3b2a21';
      return bg(u, '#f4e6bf', '#d6b874') +
        torso('#2e415e') + '<path d="M47 76h26v14.6q-13 6-26 0z" fill="#273852"/><path d="M50 80v10M55 80v11M60 80v11.6M65 80v11M70 80v10" stroke="#22314a" stroke-width="1.4"/>' +
        head(skin, 22, 25) + ears(skin, shade) +
        '<path d="M37.6 52C35.5 34 46 26 60 26C75 26 85.5 34 82.6 50.5L80 44.5C72 38.6 62.5 37 53 39.6C46.5 41.4 41 45.6 37.6 52Z" fill="' + hair + '"/>' +
        stroke('M53 39.6q-3 4-3.6 8', '#2c1f18', 1.4) +
        '<path d="M38.6 57C39.5 71.5 48.5 80.4 60 80.4S80.5 71.5 81.4 57C78.4 65.6 71.6 71 60 71.4C48.4 71 41.6 65.6 38.6 57Z" fill="#4a3428"/>' +
        '<path d="M51.6 65q8.4-4.6 16.8 0q-8.4 2.2-16.8 0z" fill="#4a3428"/>' +
        brows(hair, 'M45 46.6q5.5-2 11 0', 'M64 46.6q5.5-2 11 0', 2.6) +
        eyes({ y: 54.4, rx: 2.4, ry: 2.9 }) + nose(shade) +
        stroke('M55.6 68.6q4.4 1.8 8.8 0', '#8a5040', 1.6) +
        '<rect x="42.6" y="48.6" width="15.2" height="11.6" rx="4.4" fill="#fff" fill-opacity=".14" stroke="#1d1e24" stroke-width="2.2"/>' +
        '<rect x="62.2" y="48.6" width="15.2" height="11.6" rx="4.4" fill="#fff" fill-opacity=".14" stroke="#1d1e24" stroke-width="2.2"/>' +
        stroke('M57.8 53.6q2.2-1.6 4.4 0', '#1d1e24', 2) + stroke('M42.6 52.6l-4.2-1.2M77.4 52.6l4.2-1.2', '#1d1e24', 1.8) +
        stroke('M46 51.6l3.6-1.8M65.6 51.6l3.6-1.8', '#fff', 1.4);
    },
    // Nadia: black bob, red beret, yellow scarf
    function (u) {
      var skin = '#f5cdb2', shade = '#e2ab8b', hair = '#1d1b22';
      return bg(u, '#bfece6', '#5fb2a9') +
        '<path d="M34.5 50C33.5 31 45 23.5 60 23.5S86.5 31 85.5 50L87 76.5C81 79.5 75.5 78.5 72.5 76L70.5 60H49.5L47.5 76C44.5 78.5 39 79.5 33 76.5Z" fill="' + hair + '"/>' +
        torso('#26272e') + '<path d="M48 91L57 112H51L41 95ZM72 91L63 112H69L79 95Z" fill="#1c1d23"/>' +
        neck(shade) +
        '<path d="M45 84.5C51.5 93 68.5 93 75 84.5L77 92.5C68.5 100 51.5 100 43 92.5Z" fill="#e3a43a"/><path d="M66 95L72 113L65 112L61 97Z" fill="#cf9030"/>' +
        head(skin, 21.5, 24.5) + ears(skin, shade, 21.5) +
        '<path d="M38.4 47C40 34 49 28.6 60 28.6S80 34 81.6 47C75.5 43.2 69.5 42.2 60 42.2S44.5 43.2 38.4 47Z" fill="' + hair + '"/>' +
        '<ellipse cx="57" cy="28" rx="25" ry="9.4" transform="rotate(-9 57 28)" fill="#d8443a"/><path d="M38 31.5C39 21 48 15.5 59 16C70 16 77.5 21 78 28" fill="#d8443a"/>' +
        '<rect x="61.5" y="12" width="3.4" height="5.6" rx="1.6" fill="#b5352d" transform="rotate(12 63 14)"/>' +
        brows(hair, 'M46 48.4q5-2.6 10-.8', 'M64 47.6q5-2.4 10 .4', 2.2) +
        eyes({ y: 54.8, rx: 2.5, ry: 3 }) + stroke('M53.6 53.4l3.2-2.2M73.6 53.4l3.2-2.2', '#1d1b22', 1.6) +
        nose(shade) + cheeks('#ff8a7e', 0.28) +
        '<path d="M53.6 66.6q6.4 4.6 12.8-.6q-1.4 4.4-6.6 4.6q-5 0-6.2-4z" fill="#c4362f"/>' +
        '<circle cx="69.2" cy="69.4" r=".9" fill="#5a3a30"/>';
    },
    // Leo: slicked hair, grey temples, suit and gold tie
    function (u) {
      var skin = '#d8a47b', shade = '#c08860', hair = '#27211f';
      return bg(u, '#c3d1e0', '#62778f') +
        torso('#333b48') + '<path d="M51 91L60 108L69 91Z" fill="#f4f1ea"/>' +
        '<path d="M51 91L60 108L52 121H40L45 96ZM69 91L60 108L68 121H80L75 96Z" fill="#2a313c"/>' +
        '<path d="M58 93.4h4l1.4 3-1 1.4 2 11-4.4 6-4.4-6 2-11-1-1.4z" fill="#e8b33c"/>' +
        neck(shade) +
        '<path d="M38 50C38 34 47.5 27 60 27S82 34 82 50C82 63.5 78 73.5 69.5 77.5C64.5 79.6 55.5 79.6 50.5 77.5C42 73.5 38 63.5 38 50Z" fill="' + skin + '"/>' +
        ears(skin, shade) +
        '<path d="M43 66C45 73 50 77 60 77.6S75 73 77 66C74.5 71 68 74 60 74S45.5 71 43 66Z" fill="#000" opacity=".1"/>' +
        '<path d="M37 50C35 31 47 22.6 61 22.6S86.5 31.5 83 50C80.6 39.6 73.5 33 61 33S40.5 39.6 37 50Z" fill="' + hair + '"/>' +
        stroke('M45 30q16-6 32 2', '#3d3532', 1.4) +
        '<path d="M37.4 50q-.4-7 3.2-10.6l1 9z" fill="#a8a7a3"/><path d="M82.6 50q.4-7-3.2-10.6l-1 9z" fill="#a8a7a3"/>' +
        brows(hair, 'M45 46q5.5-4.6 11-2', 'M64 47.4q5.5-1.2 11 .2', 2.8) +
        eyes({ y: 54.6, rx: 2.5, ry: 2.9 }) + stroke('M47.6 51.6q3.4-1.8 6.8 0M65.6 51.8q3.4-1.4 6.8 0', '#1f1714', 1.5) +
        stroke('M60.2 56.6q-2.8 5.6.6 7', shade, 1.9) +
        stroke('M53 68.6q6 2.8 12.4-.4q2-1 3-2.8', '#7a3c2f', 2);
    },
    // Golden: the engine, a robot with a golden star
    function (u) {
      return '<defs><radialGradient id="b' + u + '" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#3b4152"/><stop offset="1" stop-color="#1b1e27"/></radialGradient>' +
        '<radialGradient id="g' + u + '" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f6c44f" stop-opacity=".55"/><stop offset="1" stop-color="#f6c44f" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="m' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf0"/><stop offset="1" stop-color="#aeb8c0"/></linearGradient>' +
        '<linearGradient id="t' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c3cb"/><stop offset="1" stop-color="#7d8992"/></linearGradient></defs>' +
        '<rect width="120" height="120" rx="26" fill="url(#b' + u + ')"/><circle cx="60" cy="50" r="46" fill="url(#g' + u + ')"/>' +
        '<path d="' + TORSO + '" fill="url(#t' + u + ')"/><path d="M60 98.5l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#f0b941"/>' +
        '<rect x="50" y="74" width="20" height="18" rx="3" fill="#7f8a93"/><path d="M50 80h20M50 86h20" stroke="#69747d" stroke-width="1.6"/>' +
        '<path d="M60 31V20" stroke="#9aa5ae" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M60 9.5c.7 4.4 2.3 6 6.7 6.7-4.4.7-6 2.3-6.7 6.7-.7-4.4-2.3-6-6.7-6.7 4.4-.7 6-2.3 6.7-6.7z" fill="#f6c44f"/>' +
        '<circle cx="35.5" cy="53" r="6" fill="#c3cbd1"/><circle cx="35.5" cy="53" r="2.6" fill="#8d979f"/><circle cx="84.5" cy="53" r="6" fill="#c3cbd1"/><circle cx="84.5" cy="53" r="2.6" fill="#8d979f"/>' +
        '<rect x="36" y="29" width="48" height="47" rx="15" fill="url(#m' + u + ')"/>' +
        '<rect x="40.5" y="42" width="39" height="17" rx="8.5" fill="#1a2230"/>' +
        '<ellipse cx="51" cy="50.5" rx="7" ry="5" fill="#f6c44f" opacity=".25"/><ellipse cx="69" cy="50.5" rx="7" ry="5" fill="#f6c44f" opacity=".25"/>' +
        '<ellipse cx="51" cy="50.5" rx="4.2" ry="2.8" fill="#ffd979"/><ellipse cx="69" cy="50.5" rx="4.2" ry="2.8" fill="#ffd979"/>' +
        '<path d="M51 65h18M53 69h14" stroke="#8a96a0" stroke-width="2.2" stroke-linecap="round"/>' +
        '<circle cx="42" cy="66" r="1.6" fill="#f0b941"/><circle cx="78" cy="66" r="1.6" fill="#f0b941"/>';
    }
  ];

  function avatar(i, lang) {
    var b = BOTS[i] || BOTS[0], u = 'gcb' + (++uid);
    return svg(DRAW[i] ? DRAW[i](u) : '', b.name[lang] || b.name.en);
  }
  function name(i, lang) { var b = BOTS[i] || BOTS[0]; return b.name[lang] || b.name.en; }
  function bio(i, lang) { var b = BOTS[i] || BOTS[0]; return b.bio[lang] || b.bio.en; }
  // the Play button: "Play Oskar" / "Играть с Оскаром"
  function playWith(i, lang) { var b = BOTS[i] || BOTS[0]; return lang === 'ru' ? 'Играть с ' + b.with : 'Play ' + b.name.en; }
  return { list: BOTS, avatar: avatar, name: name, bio: bio, playWith: playWith, count: BOTS.length };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GCBots;
