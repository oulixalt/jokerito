'use strict';

var E = window.Engine;

var MAX_ANTES = 3;
var JOKER_SLOTS = 5;
var BASE_TARGETS = [300, 800, 2000];
var BLIND_MULT = [1, 1.5, 2];
var BLIND_NAMES = ['Petite Blinde', 'Grosse Blinde', 'Blinde Boss'];
var BLIND_REWARDS = [3, 4, 5];
var REROLL_COST = 5;
var PLANET_COST = 3;

var BOSSES = [
  { id: 'trefle', name: 'Le Trèfle', desc: 'Les ♣ ne marquent pas de points', debuffSuit: 'C' },
  { id: 'lame', name: 'La Lame', desc: 'Les ♠ ne marquent pas de points', debuffSuit: 'S' },
  { id: 'coeur', name: 'Le Cœur Brisé', desc: 'Les ♥ ne marquent pas de points', debuffSuit: 'H' },
  { id: 'carreau', name: 'Le Carreau', desc: 'Les ♦ ne marquent pas de points', debuffSuit: 'D' },
  { id: 'psy', name: 'Le Psychique', desc: 'Vous devez jouer exactement 5 cartes', mustPlay5: true },
  { id: 'manacle', name: 'Le Manacle', desc: '-1 carte en main', handSize: 7 },
  { id: 'etouffeur', name: "L'Étouffeur", desc: 'Aucune défausse', noDiscards: true },
  { id: 'mur', name: 'Le Mur', desc: 'Score cible ×2', targetMult: 2 }
];

var G = {
  screen: 'menu',
  ante: 1,
  blindIndex: 0,
  money: 4,
  hands: 4,
  discards: 3,
  handSize: 8,
  score: 0,
  target: 0,
  deck: [],
  draw: [],
  hand: [],
  jokers: [],
  handLevels: {},
  boss: null,
  selected: new Set(),
  busy: false,
  sortMode: 'rank',
  shopOffers: [],
  rng: null,
  runStats: { handsPlayed: 0, bestHand: 0 }
};

function $(sel) { return document.querySelector(sel); }

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function newRng() {
  G.rng = E.makeRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
}

function pick(arr) { return arr[Math.floor(G.rng() * arr.length)]; }

function newRun() {
  newRng();
  G.ante = 1;
  G.blindIndex = 0;
  G.money = 4;
  G.jokers = [];
  G.handLevels = {};
  for (var i = 0; i < E.HAND_TYPES.length; i++) G.handLevels[E.HAND_TYPES[i]] = 1;
  G.deck = E.shuffle(E.makeDeck(), G.rng);
  G.runStats = { handsPlayed: 0, bestHand: 0 };
  startBlind();
}

function pickBoss() {
  var pool = BOSSES.filter(function (b) { return !G.boss || b.id !== G.boss.id; });
  return pick(pool);
}

function computeTarget() {
  var t = BASE_TARGETS[G.ante - 1] * BLIND_MULT[G.blindIndex];
  if (G.boss && G.boss.targetMult) t *= G.boss.targetMult;
  return Math.round(t);
}

function startBlind() {
  G.score = 0;
  G.hands = 4;
  G.discards = 3;
  G.boss = G.blindIndex === 2 ? pickBoss() : null;
  G.handSize = G.boss && G.boss.handSize ? G.boss.handSize : 8;
  if (G.boss && G.boss.noDiscards) G.discards = 0;
  G.target = computeTarget();
  G.draw = G.deck.slice();
  G.hand = [];
  G.selected = new Set();
  G.screen = 'play';
  drawUp();
  render();
}

function drawUp() {
  while (G.hand.length < G.handSize && G.draw.length > 0) {
    G.hand.push(G.draw.pop());
  }
}

function sortHand() {
  G.hand.sort(function (a, b) {
    if (G.sortMode === 'suit') {
      if (a.suit !== b.suit) return a.suit < b.suit ? -1 : 1;
      return b.rank - a.rank;
    }
    return b.rank - a.rank;
  });
}

function suitOf(id) {
  for (var i = 0; i < E.SUITS.length; i++) if (E.SUITS[i].id === id) return E.SUITS[i];
  return E.SUITS[0];
}

function cardHtml(card, extraClass) {
  var s = suitOf(card.suit);
  var cls = 'card ' + s.color + (extraClass ? ' ' + extraClass : '');
  return '<div class="' + cls + '" data-id="' + card.id + '">' +
    '<span>' + E.rankLabel(card.rank) + s.symbol + '</span>' +
    '<span class="suit-bottom">' + s.symbol + '</span></div>';
}

function render() {
  var app = $('#app');
  if (G.screen === 'menu') { app.innerHTML = renderMenuHtml(); bindMenu(); return; }
  if (G.screen === 'play') { app.innerHTML = renderPlayHtml(); bindPlay(); updatePreview(); return; }
  if (G.screen === 'shop') { app.innerHTML = renderShopHtml(); bindShop(); return; }
  if (G.screen === 'end') { app.innerHTML = renderEndHtml(); bindEnd(); return; }
}

function renderMenuHtml() {
  return '<div class="center-screen">' +
    '<h1>Jokerito</h1>' +
    '<p>Roguelike de poker inspiré de Balatro. Formez des mains de poker, ' +
    'achetez des Jokers, surmontez les Blindes Boss et survivez à ' + MAX_ANTES + ' Antes.</p>' +
    '<button class="big-btn btn-play" id="startBtn">Nouvelle partie</button>' +
    '<p style="font-size:13px">Prototype non affilié à LocalThunk / Playstack.</p>' +
    '</div>';
}

function bindMenu() {
  $('#startBtn').addEventListener('click', newRun);
}

function renderPlayHtml() {
  var bossHtml = G.boss ? '<div class="boss-desc">⚠ ' + G.boss.name + ' : ' + G.boss.desc + '</div>' : '';
  var jokersHtml = '';
  for (var i = 0; i < G.jokers.length; i++) {
    var j = G.jokers[i];
    jokersHtml += '<div class="joker-card" data-jindex="' + i + '"><div class="joker-name">' +
      j.def.name + '</div><div>' + j.def.desc + '</div></div>';
  }
  var handHtml = '';
  for (var k = 0; k < G.hand.length; k++) {
    var c = G.hand[k];
    var debuffed = G.boss && G.boss.debuffSuit === c.suit;
    handHtml += cardHtml(c, (G.selected.has(c.id) ? 'selected ' : '') + (debuffed ? 'blocked' : ''));
  }
  var discardDisabled = G.discards <= 0 ? 'disabled' : '';

  return '<div class="topbar">' +
      '<div class="stat-box"><div class="label">Ante</div><div class="value">' + G.ante + '/' + MAX_ANTES + '</div></div>' +
      '<div class="stat-box blind-info"><div class="label">' + BLIND_NAMES[G.blindIndex] + '</div>' +
        '<div class="value">Récompense : $' + BLIND_REWARDS[G.blindIndex] + '</div>' + bossHtml + '</div>' +
      '<div class="stat-box target"><div class="label">Cible</div><div class="value">' + G.target + '</div></div>' +
      '<div class="stat-box score"><div class="label">Score</div><div class="value" id="scoreVal">' + G.score + '</div></div>' +
      '<div class="stat-box"><div class="label">Argent</div><div class="value">$' + G.money + '</div></div>' +
      '<div class="stat-box"><div class="label">Mains</div><div class="value">' + G.hands + '</div></div>' +
      '<div class="stat-box"><div class="label">Défausses</div><div class="value">' + G.discards + '</div></div>' +
    '</div>' +
    '<div class="joker-row"><span class="slot-label">Jokers (' + G.jokers.length + '/' + JOKER_SLOTS + ')</span>' + jokersHtml + '</div>' +
    '<div class="table">' +
      '<div class="played-area" id="playedArea"></div>' +
      '<div class="chips-mult" id="chipsMult"><span class="chips">0</span><span class="op">×</span><span class="mult">0</span></div>' +
      '<div class="hand-preview" id="handPreview"></div>' +
    '</div>' +
    '<div class="hand-area" id="handArea">' + handHtml + '</div>' +
    '<div class="controls">' +
      '<button class="btn-play" id="playBtn">Jouer la main</button>' +
      '<button class="btn-discard" id="discardBtn" ' + discardDisabled + '>Défausser</button>' +
      '<button class="btn-ghost" id="sortBtn">Trier : ' + (G.sortMode === 'rank' ? 'rang' : 'couleur') + '</button>' +
    '</div>' +
    '<div class="deck-count">Pioche : ' + G.draw.length + ' cartes</div>';
}

function bindPlay() {
  var cards = document.querySelectorAll('#handArea .card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener('click', onCardClick);
  }
  $('#playBtn').addEventListener('click', playHand);
  $('#discardBtn').addEventListener('click', discardSelected);
  $('#sortBtn').addEventListener('click', function () {
    G.sortMode = G.sortMode === 'rank' ? 'suit' : 'rank';
    sortHand();
    render();
  });
}

function onCardClick(ev) {
  if (G.busy) return;
  var id = ev.currentTarget.getAttribute('data-id');
  if (G.selected.has(id)) G.selected.delete(id);
  else if (G.selected.size < 5) G.selected.add(id);
  ev.currentTarget.classList.toggle('selected', G.selected.has(id));
  updatePreview();
}

function selectedCards() {
  return G.hand.filter(function (c) { return G.selected.has(c.id); });
}

function updatePreview() {
  var el = $('#handPreview');
  var sel = selectedCards();
  if (!sel.length) { el.innerHTML = '<span class="pv-detail">Sélectionnez 1 à 5 cartes</span>'; return; }
  var det = E.detectHand(sel);
  var level = G.handLevels[det.type] || 1;
  var base = E.HAND_BASE[det.type];
  var chips = base.chips + (level - 1) * base.lc;
  var mult = base.mult + (level - 1) * base.lm;
  el.innerHTML = E.HAND_NAMES[det.type] + ' niv.' + level +
    ' <span class="pv-detail">≈ ' + chips + ' × ' + mult + ' (hors Jetons des cartes et Jokers)</span>';
  $('#playBtn').disabled = !!(G.boss && G.boss.mustPlay5 && sel.length !== 5);
}

function showPlayed(cards) {
  var area = $('#playedArea');
  var html = '';
  for (var i = 0; i < cards.length; i++) {
    var debuffed = G.boss && G.boss.debuffSuit === cards[i].suit;
    html += cardHtml(cards[i], debuffed ? 'blocked' : '');
  }
  area.innerHTML = html;
}

function updateCm(chips, mult) {
  var el = $('#chipsMult');
  var m = Math.round(mult * 10) / 10;
  el.innerHTML = '<span class="chips">' + Math.floor(chips) + '</span><span class="op">×</span><span class="mult">' + m + '</span>';
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function findPlayedCardEl(cardId) {
  return document.querySelector('#playedArea .card[data-id="' + cardId + '"]');
}

function findJokerEl(jokerId) {
  var cards = document.querySelectorAll('#app .joker-card');
  for (var i = 0; i < cards.length; i++) {
    var idx = +cards[i].getAttribute('data-jindex');
    if (G.jokers[idx] && G.jokers[idx].def.id === jokerId) return cards[i];
  }
  return null;
}

function floatScore(text) {
  var table = document.querySelector('.table');
  var el = document.createElement('div');
  el.className = 'score-float';
  el.textContent = text;
  el.style.left = '50%';
  el.style.top = '40%';
  table.style.position = 'relative';
  table.appendChild(el);
  setTimeout(function () { el.remove(); }, 1000);
}

async function playHand() {
  if (G.busy) return;
  var sel = selectedCards();
  if (!sel.length || sel.length > 5) return;
  if (G.boss && G.boss.mustPlay5 && sel.length !== 5) return;

  G.busy = true;
  G.hands--;
  G.runStats.handsPlayed++;

  var result = E.evaluate(sel, G.jokers.map(function (j) { return j.def; }), {
    handLevels: G.handLevels,
    discards: G.discards,
    debuffSuit: G.boss ? G.boss.debuffSuit : null
  });
  if (result.final > G.runStats.bestHand) G.runStats.bestHand = result.final;

  showPlayed(sel);
  G.hand = G.hand.filter(function (c) { return !G.selected.has(c.id); });
  G.selected.clear();
  $('#handPreview').innerHTML = '';
  $('#playBtn').disabled = true;
  $('#discardBtn').disabled = true;

  var chips = 0, mult = 0;
  for (var i = 0; i < result.log.length; i++) {
    var step = result.log[i];
    await sleep(300);
    if (step.kind === 'hand') {
      chips = step.chips; mult = step.mult;
    } else {
      var el = null;
      if (step.card) el = findPlayedCardEl(step.card.id);
      if (step.joker) el = findJokerEl(step.joker.id);
      if (el && step.kind !== 'blocked') {
        el.classList.add(step.joker ? 'active' : 'scoring');
        setTimeout(function (node) {
          return function () { node.classList.remove('scoring', 'active'); };
        }(el), 280);
      }
      if (step.chips) chips += step.chips;
      if (step.mult) mult += step.mult;
      if (step.xmult) mult *= step.xmult;
    }
    updateCm(chips, mult);
  }

  await sleep(400);
  var final = Math.floor(chips * mult);
  floatScore('+' + final);
  G.score += final;
  $('#scoreVal').textContent = G.score;
  await sleep(600);

  $('#playedArea').innerHTML = '';
  updateCm(0, 0);
  G.busy = false;

  if (G.score >= G.target) { blindWon(); return; }
  if (G.hands === 0) { endGame(false); return; }
  drawUp();
  sortHand();
  render();
}

function discardSelected() {
  if (G.busy || G.discards <= 0) return;
  var sel = selectedCards();
  if (!sel.length) return;
  G.discards--;
  G.hand = G.hand.filter(function (c) { return !G.selected.has(c.id); });
  G.selected.clear();
  drawUp();
  sortHand();
  render();
}

function blindWon() {
  var interest = Math.min(5, Math.floor(G.money / 5));
  var gain = BLIND_REWARDS[G.blindIndex] + G.hands + interest;
  G.money += gain;
  if (G.ante === MAX_ANTES && G.blindIndex === 2) { endGame(true); return; }
  openShop();
}

function openShop() {
  var owned = {};
  for (var i = 0; i < G.jokers.length; i++) owned[G.jokers[i].def.id] = true;
  var pool = E.JOKERS.filter(function (j) { return !owned[j.id]; });
  G.shopOffers = [];
  for (var k = 0; k < 2 && pool.length; k++) {
    var idx = Math.floor(G.rng() * pool.length);
    G.shopOffers.push({ kind: 'joker', def: pool.splice(idx, 1)[0] });
  }
  G.shopOffers.push({ kind: 'planet', def: pick(E.PLANETS) });
  G.screen = 'shop';
  render();
}

function nextBlindName() {
  var bi = G.blindIndex === 2 ? 0 : G.blindIndex + 1;
  var an = G.blindIndex === 2 ? G.ante + 1 : G.ante;
  return 'Ante ' + an + ' — ' + BLIND_NAMES[bi];
}

function nextTarget() {
  var bi = G.blindIndex === 2 ? 0 : G.blindIndex + 1;
  var an = G.blindIndex === 2 ? G.ante + 1 : G.ante;
  return Math.round(BASE_TARGETS[an - 1] * BLIND_MULT[bi]);
}

function renderShopHtml() {
  var isLast = G.ante === MAX_ANTES && G.blindIndex === 2;
  var offersHtml = '';
  for (var i = 0; i < G.shopOffers.length; i++) {
    var o = G.shopOffers[i];
    if (o.kind === 'joker') {
      offersHtml += '<div class="shop-item"><div class="item-name">🃏 ' + o.def.name + '</div>' +
        '<div class="item-desc">' + o.def.desc + '</div>' +
        '<div class="item-cost">$' + o.def.cost + '</div>' +
        '<button data-buy="' + i + '">Acheter</button></div>';
    } else {
      var lvl = G.handLevels[o.def.hand];
      offersHtml += '<div class="shop-item"><div class="item-name">🪐 ' + o.def.name + '</div>' +
        '<div class="item-desc">Améliore « ' + E.HAND_NAMES[o.def.hand] + ' » d\'un niveau (niv. ' + lvl + ' → ' + (lvl + 1) + ')</div>' +
        '<div class="item-cost">$' + PLANET_COST + '</div>' +
        '<button data-buy="' + i + '">Acheter</button></div>';
    }
  }
  if (!offersHtml) offersHtml = '<p style="color:var(--muted)">Boutique épuisée.</p>';

  var ownedHtml = '';
  for (var j = 0; j < G.jokers.length; j++) {
    var jk = G.jokers[j];
    ownedHtml += '<div class="owned-joker"><div class="joker-name">' + jk.def.name + '</div>' +
      '<div>' + jk.def.desc + '</div>' +
      '<button data-sell="' + j + '">Vendre $' + Math.floor(jk.def.cost / 2) + '</button></div>';
  }

  return '<div class="shop">' +
    '<div class="topbar">' +
      '<div class="stat-box"><div class="label">Ante</div><div class="value">' + G.ante + '/' + MAX_ANTES + '</div></div>' +
      '<div class="stat-box"><div class="label">Argent</div><div class="value">$' + G.money + '</div></div>' +
      '<div class="stat-box blind-info"><div class="label">Prochaine blinde</div>' +
        '<div class="value">' + nextBlindName() + ' — cible ' + nextTarget() + '</div></div>' +
    '</div>' +
    '<h2>Boutique</h2>' +
    '<div class="shop-grid">' + offersHtml + '</div>' +
    '<h2>Vos Jokers (' + G.jokers.length + '/' + JOKER_SLOTS + ')</h2>' +
    '<div class="owned-jokers">' + (ownedHtml || '<p style="color:var(--muted)">Aucun Joker.</p>') + '</div>' +
    '<div class="controls">' +
      '<button class="btn-reroll" id="rerollBtn">Recharger ($' + REROLL_COST + ')</button>' +
      '<button class="btn-shop" id="nextBtn">' + (isLast ? 'Affronter le Boss final' : 'Blinde suivante') + '</button>' +
    '</div></div>';
}

function bindShop() {
  var buyBtns = document.querySelectorAll('[data-buy]');
  for (var i = 0; i < buyBtns.length; i++) {
    buyBtns[i].addEventListener('click', function (ev) {
      buyOffer(+ev.currentTarget.getAttribute('data-buy'));
    });
  }
  var sellBtns = document.querySelectorAll('[data-sell]');
  for (var j = 0; j < sellBtns.length; j++) {
    sellBtns[j].addEventListener('click', function (ev) {
      sellJoker(+ev.currentTarget.getAttribute('data-sell'));
    });
  }
  $('#rerollBtn').addEventListener('click', function () {
    if (G.money < REROLL_COST) return;
    G.money -= REROLL_COST;
    openShop();
  });
  $('#nextBtn').addEventListener('click', nextBlind);
}

function buyOffer(i) {
  var o = G.shopOffers[i];
  if (!o) return;
  if (o.kind === 'joker') {
    if (G.jokers.length >= JOKER_SLOTS || G.money < o.def.cost) return;
    G.money -= o.def.cost;
    G.jokers.push({ def: o.def });
  } else {
    if (G.money < PLANET_COST) return;
    G.money -= PLANET_COST;
    G.handLevels[o.def.hand] = (G.handLevels[o.def.hand] || 1) + 1;
  }
  G.shopOffers.splice(i, 1);
  render();
}

function sellJoker(i) {
  var jk = G.jokers[i];
  if (!jk) return;
  G.money += Math.floor(jk.def.cost / 2);
  G.jokers.splice(i, 1);
  render();
}

function nextBlind() {
  if (G.blindIndex === 2) {
    G.blindIndex = 0;
    G.ante++;
  } else {
    G.blindIndex++;
  }
  startBlind();
}

function endGame(won) {
  G.screen = 'end';
  G.won = won;
  render();
}

function renderEndHtml() {
  var title = G.won ? '🏆 Victoire !' : '💀 Défaite';
  var msg = G.won
    ? 'Vous avez survécu aux ' + MAX_ANTES + ' Antes.'
    : "Vous n'avez pas atteint la cible de " + G.target + ' points.';
  return '<div class="center-screen">' +
    '<h1 style="color:' + (G.won ? 'var(--accent)' : 'var(--accent2)') + '">' + title + '</h1>' +
    '<p>' + msg + '</p>' +
    '<div class="end-stats">' +
      '<div>Ante atteinte : <span>' + G.ante + '</span></div>' +
      '<div>Score final : <span>' + G.score + '</span> / ' + G.target + '</div>' +
      '<div>Mains jouées : <span>' + G.runStats.handsPlayed + '</span></div>' +
      '<div>Meilleure main : <span>' + G.runStats.bestHand + '</span> points</div>' +
      '<div>Jokers possédés : <span>' + G.jokers.length + '</span></div>' +
    '</div>' +
    '<button class="big-btn btn-play" id="againBtn">Rejouer</button>' +
    '</div>';
}

function bindEnd() {
  $('#againBtn').addEventListener('click', newRun);
}

render();
