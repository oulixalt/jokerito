/* Moteur de jeu pur (sans DOM) — testable sous Node et utilisable dans le navigateur. */
(function (root) {
  'use strict';

  var SUITS = [
    { id: 'S', symbol: '♠', name: 'Pique', color: 'black' },
    { id: 'H', symbol: '♥', name: 'Cœur', color: 'red' },
    { id: 'D', symbol: '♦', name: 'Carreau', color: 'red' },
    { id: 'C', symbol: '♣', name: 'Trèfle', color: 'black' }
  ];

  var RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  function rankLabel(r) { return RANK_LABEL[r] || String(r); }
  function cardChips(c) { return c.rank === 14 ? 11 : (c.rank >= 11 ? 10 : c.rank); }

  function makeDeck() {
    var d = [];
    for (var i = 0; i < SUITS.length; i++) {
      for (var r = 2; r <= 14; r++) {
        d.push({ rank: r, suit: SUITS[i].id, id: SUITS[i].id + r });
      }
    }
    return d;
  }

  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var HAND_TYPES = ['straight_flush', 'four_kind', 'full_house', 'flush', 'straight', 'three_kind', 'two_pair', 'pair', 'high_card'];

  var HAND_NAMES = {
    straight_flush: 'Quinte Flush', four_kind: 'Carré', full_house: 'Full',
    flush: 'Couleur', straight: 'Quinte', three_kind: 'Brelan',
    two_pair: 'Double Paire', pair: 'Paire', high_card: 'Carte Haute'
  };

  var HAND_BASE = {
    straight_flush: { chips: 100, mult: 8, lc: 40, lm: 4 },
    four_kind: { chips: 60, mult: 7, lc: 30, lm: 3 },
    full_house: { chips: 40, mult: 4, lc: 25, lm: 2 },
    flush: { chips: 35, mult: 4, lc: 15, lm: 2 },
    straight: { chips: 30, mult: 4, lc: 30, lm: 3 },
    three_kind: { chips: 30, mult: 3, lc: 20, lm: 2 },
    two_pair: { chips: 20, mult: 2, lc: 20, lm: 1 },
    pair: { chips: 10, mult: 2, lc: 15, lm: 1 },
    high_card: { chips: 5, mult: 1, lc: 10, lm: 1 }
  };

  function detectHand(cards) {
    var n = cards.length;
    var sorted = cards.slice().sort(function (a, b) { return b.rank - a.rank; });
    var counts = {};
    for (var i = 0; i < n; i++) counts[cards[i].rank] = (counts[cards[i].rank] || 0) + 1;
    var groups = Object.keys(counts).map(function (r) {
      return { rank: +r, count: counts[r] };
    }).sort(function (a, b) { return b.count - a.count || b.rank - a.rank; });

    var suitCount = {};
    for (var j = 0; j < n; j++) suitCount[cards[j].suit] = (suitCount[cards[j].suit] || 0) + 1;
    var isFlush = n === 5 && Object.keys(suitCount).some(function (s) { return suitCount[s] === 5; });

    var isStraight = false;
    if (n === 5) {
      var uniq = [];
      for (var k = 0; k < sorted.length; k++) {
        if (uniq.length === 0 || uniq[uniq.length - 1] !== sorted[k].rank) uniq.push(sorted[k].rank);
      }
      if (uniq.length === 5) {
        if (uniq[0] - uniq[4] === 4) isStraight = true;
        if (!isStraight && uniq[0] === 14 && uniq[1] === 5 && uniq[1] - uniq[4] === 3) isStraight = true;
      }
    }

    var flags = { pair: false, trips: false, quad: false };
    for (var g = 0; g < groups.length; g++) {
      if (groups[g].count >= 2) flags.pair = true;
      if (groups[g].count >= 3) flags.trips = true;
      if (groups[g].count >= 4) flags.quad = true;
    }

    var type, scoring;
    if (isStraight && isFlush) type = 'straight_flush';
    else if (groups[0].count === 4) type = 'four_kind';
    else if (groups[0].count === 3 && groups[1] && groups[1].count === 2) type = 'full_house';
    else if (isFlush) type = 'flush';
    else if (isStraight) type = 'straight';
    else if (groups[0].count === 3) type = 'three_kind';
    else if (groups[0].count === 2 && groups[1] && groups[1].count === 2) type = 'two_pair';
    else if (groups[0].count === 2) type = 'pair';
    else type = 'high_card';

    if (type === 'four_kind') {
      scoring = cards.filter(function (c) { return c.rank === groups[0].rank; });
    } else if (type === 'three_kind') {
      scoring = cards.filter(function (c) { return c.rank === groups[0].rank; });
    } else if (type === 'pair') {
      scoring = cards.filter(function (c) { return c.rank === groups[0].rank; });
    } else if (type === 'two_pair') {
      scoring = cards.filter(function (c) { return c.rank === groups[0].rank || c.rank === groups[1].rank; });
    } else if (type === 'high_card') {
      scoring = [sorted[0]];
    } else {
      scoring = cards.slice();
    }

    return { type: type, scoring: scoring, flags: flags };
  }

  var JOKERS = [
    { id: 'duo', name: 'Duo', cost: 3, desc: '+4 Mult', onHandScore: function () { return { mult: 4 }; } },
    { id: 'trio', name: 'Trio', cost: 3, desc: '+30 Jetons', onHandScore: function () { return { chips: 30 }; } },
    { id: 'jolly', name: 'Jolly', cost: 4, desc: '+8 Mult si la main contient une Paire', onHandScore: function (c) { return c.hand.flags.pair ? { mult: 8 } : null; } },
    { id: 'sly', name: 'Sly', cost: 4, desc: '+50 Jetons si la main contient une Paire', onHandScore: function (c) { return c.hand.flags.pair ? { chips: 50 } : null; } },
    { id: 'half', name: 'Half', cost: 4, desc: '+20 Mult si 3 cartes ou moins jouées', onHandScore: function (c) { return c.played.length <= 3 ? { mult: 20 } : null; } },
    { id: 'banner', name: 'Bannière', cost: 5, desc: '+30 Jetons par défausse restante', onHandScore: function (c) { return { chips: 30 * c.discards }; } },
    { id: 'abstract', name: 'Abstrait', cost: 4, desc: '+3 Mult par autre Joker possédé', onHandScore: function (c) { return { mult: 3 * (c.jokerCount - 1) }; } },
    { id: 'even', name: 'Égal', cost: 4, desc: 'Chaque carte de rang pair marquée : +4 Mult', onCardScore: function (c) { return c.card.rank % 2 === 0 ? { mult: 4 } : null; } },
    { id: 'odd', name: 'Impair', cost: 4, desc: 'Chaque carte de rang impair marquée : +30 Jetons', onCardScore: function (c) { return c.card.rank % 2 === 1 ? { chips: 30 } : null; } },
    { id: 'fou', name: 'Le Fou', cost: 4, desc: '+12 Mult si la main est une Quinte', onHandScore: function (c) { return c.hand.type === 'straight' || c.hand.type === 'straight_flush' ? { mult: 12 } : null; } },
    { id: 'avare', name: 'Avare', cost: 5, desc: 'Chaque ♦ marqué : +3 Mult', onCardScore: function (c) { return c.card.suit === 'D' ? { mult: 3 } : null; } },
    { id: 'lion', name: 'Lion', cost: 5, desc: 'Chaque ♥ marqué : +3 Mult', onCardScore: function (c) { return c.card.suit === 'H' ? { mult: 3 } : null; } },
    { id: 'foi', name: 'Foi', cost: 6, desc: '×2 Mult si la main contient un Brelan', onHandScore: function (c) { return c.hand.flags.trips ? { xmult: 2 } : null; } },
    { id: 'etoile', name: 'Étoile', cost: 6, desc: '×1.5 Mult si la main est une Couleur', onHandScore: function (c) { return c.hand.type === 'flush' || c.hand.type === 'straight_flush' ? { xmult: 1.5 } : null; } }
  ];

  var PLANETS = [
    { id: 'mercure', name: 'Mercure', hand: 'pair' },
    { id: 'venus', name: 'Vénus', hand: 'two_pair' },
    { id: 'terre', name: 'Terre', hand: 'three_kind' },
    { id: 'mars', name: 'Mars', hand: 'straight' },
    { id: 'jupiter', name: 'Jupiter', hand: 'flush' },
    { id: 'saturne', name: 'Saturne', hand: 'full_house' },
    { id: 'uranus', name: 'Uranus', hand: 'four_kind' },
    { id: 'neptune', name: 'Neptune', hand: 'straight_flush' }
  ];

  function evaluate(played, jokerDefs, opts) {
    opts = opts || {};
    var handLevels = opts.handLevels || {};
    var discards = opts.discards || 0;
    var debuffSuit = opts.debuffSuit || null;

    var det = detectHand(played);
    var level = handLevels[det.type] || 1;
    var base = HAND_BASE[det.type];
    var chips = base.chips + (level - 1) * base.lc;
    var mult = base.mult + (level - 1) * base.lm;

    var log = [{ kind: 'hand', label: HAND_NAMES[det.type] + ' (niv. ' + level + ')', chips: chips, mult: mult }];

    function applyJokerEffect(joker, eff, extra) {
      if (eff.chips) chips += eff.chips;
      if (eff.mult) mult += eff.mult;
      if (eff.xmult) mult *= eff.xmult;
      log.push(Object.assign({ kind: extra.kind, joker: joker, card: extra.card }, eff));
    }

    for (var i = 0; i < det.scoring.length; i++) {
      var card = det.scoring[i];
      if (debuffSuit && card.suit === debuffSuit) {
        log.push({ kind: 'blocked', card: card });
        continue;
      }
      var c = cardChips(card);
      chips += c;
      log.push({ kind: 'card', card: card, chips: c });
      for (var j = 0; j < jokerDefs.length; j++) {
        var jd = jokerDefs[j];
        if (jd.onCardScore) {
          var eff = jd.onCardScore({ card: card, played: played, scoring: det.scoring, hand: det, state: opts });
          if (eff) applyJokerEffect(jd, eff, { kind: 'jokerCard', card: card });
        }
      }
    }

    for (var k = 0; k < jokerDefs.length; k++) {
      var jk = jokerDefs[k];
      if (jk.onHandScore) {
        var eff2 = jk.onHandScore({
          played: played, scoring: det.scoring, hand: det,
          jokerCount: jokerDefs.length, discards: discards, state: opts
        });
        if (eff2) applyJokerEffect(jk, eff2, { kind: 'jokerHand', card: null });
      }
    }

    return { chips: chips, mult: mult, final: Math.floor(chips * mult), detail: det, log: log };
  }

  var api = {
    SUITS: SUITS,
    HAND_TYPES: HAND_TYPES,
    HAND_NAMES: HAND_NAMES,
    HAND_BASE: HAND_BASE,
    JOKERS: JOKERS,
    PLANETS: PLANETS,
    rankLabel: rankLabel,
    cardChips: cardChips,
    makeDeck: makeDeck,
    makeRng: makeRng,
    shuffle: shuffle,
    detectHand: detectHand,
    evaluate: evaluate
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
