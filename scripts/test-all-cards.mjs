import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerCards, getCard } from '../packages/game-core/dist/cards.js';
import { createMatch, applyAction, monsterAtk } from '../packages/game-core/dist/engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(readFileSync(join(root, 'packages/cards/data/set1.json'), 'utf8'));
registerCards(cards);

const report = { passed: [], failed: [], skipped: [] };
const log = (name, ok, detail) => {
  (ok ? report.passed : report.failed).push({ name, detail });
  console.log(ok ? '✓' : '✗', name, detail ? JSON.stringify(detail) : '');
};

function deckOf(...ids) {
  // pad to 40 with fillers
  const base = [...ids];
  while (base.length < 40) base.push('ember_sprite');
  return base.slice(0, 40);
}

function fresh(handCard, opts = {}) {
  const filler = opts.filler ?? 'ember_sprite';
  const d1 = deckOf(handCard, ...Array(4).fill(filler), ...Array(35).fill(filler));
  const d2 = deckOf(...Array(40).fill('pebble_golem'));
  // deterministic: put handCard first so it's in opening hand
  const state = createMatch('t', d1, d2, () => 0.1);
  // force hand to contain the card we want
  state.players.p1.hand = [handCard, filler, filler, filler, filler];
  state.players.p1.deck = Array(30).fill(filler);
  state.players.p2.hand = Array(5).fill('pebble_golem');
  state.players.p2.deck = Array(30).fill('pebble_golem');
  state.players.p2.monsters = [null, null, null];
  state.phase = 'main';
  state.turn = 'p1';
  state.players.p1.normalSummonUsed = false;
  return state;
}

function putEnemyMonster(state, cardId = 'pebble_golem') {
  state.players.p2.monsters[0] = {
    instanceId: 'e1',
    cardId,
    position: 'attack',
    atkBuff: 0,
    defBuff: 0,
    canAttack: false,
    faceUp: true,
  };
}

function putAllyMonster(state, cardId = 'ember_sprite', zone = 0) {
  state.players.p1.monsters[zone] = {
    instanceId: `a${zone}`,
    cardId,
    position: 'attack',
    atkBuff: 0,
    defBuff: 0,
    canAttack: true,
    faceUp: true,
  };
}

// —— Monsters with on_summon ——
const summonEffects = cards.filter(
  (c) => c.type === 'monster' && c.effects?.some((e) => e.trigger === 'on_summon'),
);

for (const card of summonEffects) {
  try {
    const state = fresh(card.id);
    const lifeBefore = { p1: state.players.p1.life, p2: state.players.p2.life };
    const handBefore = state.players.p1.hand.length;
    applyAction(state, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      position: 'attack',
      faceUp: true,
    });
    const m = state.players.p1.monsters[0];
    const ops = card.effects.find((e) => e.trigger === 'on_summon').ops;
    let ok = !!m && m.cardId === card.id && m.faceUp;
    const detail = { life: state.players.p1.life, foe: state.players.p2.life, hand: state.players.p1.hand.length, log: state.log.slice(-3) };

    for (const op of ops) {
      if (op.op === 'draw') {
        ok = ok && state.players.p1.hand.length >= handBefore; // summoned removes 1, draw adds
        // hand: start 5, remove 1 = 4, draw 1 = 5
        ok = ok && state.players.p1.hand.length === handBefore - 1 + (op.count ?? 1);
      }
      if (op.op === 'damage' && op.target === 'opponent') {
        ok = ok && state.players.p2.life === lifeBefore.p2 - (op.amount ?? 0);
      }
      if (op.op === 'heal' && op.target === 'self') {
        ok = ok && state.players.p1.life === lifeBefore.p1 + (op.amount ?? 0);
      }
      if (op.op === 'summon_token') {
        const tokens = state.players.p1.monsters.filter((x) => x && x.cardId === (op.tokenId || 'aether_token'));
        ok = ok && tokens.length >= 1;
      }
    }
    // face-down set should NOT trigger
    const state2 = fresh(card.id);
    const life2 = state2.players.p2.life;
    const hand2 = state2.players.p1.hand.length;
    applyAction(state2, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      position: 'defense',
      faceUp: false,
    });
    let noTrig = state2.players.p1.monsters[0]?.faceUp === false;
    for (const op of ops) {
      if (op.op === 'damage') noTrig = noTrig && state2.players.p2.life === life2;
      if (op.op === 'heal') noTrig = noTrig && state2.players.p1.life === 8000;
      if (op.op === 'draw') noTrig = noTrig && state2.players.p1.hand.length === hand2 - 1;
      if (op.op === 'summon_token') {
        noTrig =
          noTrig &&
          !state2.players.p1.monsters.some((x) => x && x.cardId === 'aether_token');
      }
    }
    log(`summon_effect:${card.id}`, ok && noTrig, { ...detail, setNoTrigger: noTrig });
  } catch (e) {
    log(`summon_effect:${card.id}`, false, { error: String(e.message || e) });
  }
}

// —— Plain monsters summon ——
for (const card of cards.filter((c) => c.type === 'monster' && !c.tags?.includes('token') && !c.effects?.length)) {
  try {
    const state = fresh(card.id);
    applyAction(state, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      position: 'attack',
      faceUp: true,
    });
    log(`summon_plain:${card.id}`, state.players.p1.monsters[0]?.cardId === card.id);
  } catch (e) {
    log(`summon_plain:${card.id}`, false, { error: String(e.message || e) });
  }
}

// —— Spells ——
for (const card of cards.filter((c) => c.type === 'spell')) {
  try {
    const state = fresh(card.id);
    // ensure ally monsters for buffs
    putAllyMonster(state, 'ember_sprite', 0);
    putAllyMonster(state, 'coral_knight', 1);
    putEnemyMonster(state, 'pebble_golem');
    const lifeBefore = { p1: state.players.p1.life, p2: state.players.p2.life };
    const handBefore = state.players.p1.hand.length;
    const foeMonBefore = state.players.p2.monsters.filter(Boolean).length;
    const atkBefore = state.players.p1.monsters[0].atkBuff;
    const defBefore = state.players.p1.monsters[0].defBuff;

    applyAction(state, 'p1', { type: 'activate_spell', handIndex: 0, zoneIndex: 2 });
    const st = state.players.p1.spellTraps[2];
    const continuous = !!card.tags?.includes('continuous');
    let ok = continuous
      ? !!st && st.faceUp && st.cardId === card.id
      : !st && state.players.p1.graveyard.includes(card.id);
    const ops = (card.effects ?? []).flatMap((e) => e.ops);

    for (const op of ops) {
      if (op.op === 'draw') {
        ok = ok && state.players.p1.hand.length === handBefore - 1 + (op.count ?? 1);
      }
      if (op.op === 'damage') {
        ok = ok && state.players.p2.life === lifeBefore.p2 - (op.amount ?? 0);
      }
      if (op.op === 'heal') {
        ok = ok && state.players.p1.life === lifeBefore.p1 + (op.amount ?? 0);
      }
      if (op.op === 'buff_stat') {
        if (op.stat === 'def') {
          ok = ok && state.players.p1.monsters[0].defBuff === defBefore + (op.amount ?? 0);
        } else {
          ok = ok && state.players.p1.monsters[0].atkBuff === atkBefore + (op.amount ?? 0);
        }
      }
      if (op.op === 'destroy_target' && op.target === 'all_enemy_monsters') {
        ok = ok && state.players.p2.monsters.every((m) => !m);
        ok = ok && foeMonBefore > 0;
      }
    }

    // set then activate from field
    const state2 = fresh(card.id);
    putAllyMonster(state2, 'ember_sprite', 0);
    putEnemyMonster(state2, 'pebble_golem');
    applyAction(state2, 'p1', { type: 'set_spell_trap', handIndex: 0, zoneIndex: 0 });
    const setFace = state2.players.p1.spellTraps[0];
    let setOk = !!setFace && !setFace.faceUp && setFace.cardId === card.id;

    let fieldActOk = true;
    if (card.tags?.includes('quick') && setFace.setThisTurn) {
      try {
        applyAction(state2, 'p1', { type: 'activate_spell', zoneIndex: 0 });
        fieldActOk = false; // should have thrown
      } catch {
        fieldActOk = true; // correctly blocked
      }
      // next turn clear setThisTurn
      setFace.setThisTurn = false;
      applyAction(state2, 'p1', { type: 'activate_spell', zoneIndex: 0 });
    } else {
      applyAction(state2, 'p1', { type: 'activate_spell', zoneIndex: 0 });
    }

    if (continuous) {
      fieldActOk =
        fieldActOk &&
        state2.players.p1.spellTraps[0]?.faceUp === true &&
        state2.players.p1.spellTraps[0]?.cardId === card.id;
    } else {
      // العادية تغادر الساحة إلى المقبرة فور الحل
      fieldActOk =
        fieldActOk &&
        !state2.players.p1.spellTraps[0] &&
        state2.players.p1.graveyard.includes(card.id);
    }

    log(`spell:${card.id}`, ok && setOk && fieldActOk, {
      tags: card.tags || [],
      setOk,
      fieldActOk,
      continuous: !!continuous,
    });
  } catch (e) {
    log(`spell:${card.id}`, false, { error: String(e.message || e) });
  }
}

// —— Traps ——
for (const card of cards.filter((c) => c.type === 'trap')) {
  try {
    const state = fresh(card.id);
    putEnemyMonster(state, 'pebble_golem');
    applyAction(state, 'p1', { type: 'set_spell_trap', handIndex: 0, zoneIndex: 0 });
    const st = state.players.p1.spellTraps[0];
    let ok = !!st && !st.faceUp && st.setThisTurn;

    // same turn activate should fail
    let blocked = false;
    try {
      applyAction(state, 'p1', { type: 'activate_trap', zoneIndex: 0 });
    } catch {
      blocked = true;
    }
    ok = ok && blocked;

    st.setThisTurn = false;
    const lifeBefore = state.players.p2.life;
    const handBefore = state.players.p1.hand.length;
    const lifeSelf = state.players.p1.life;
    applyAction(state, 'p1', { type: 'activate_trap', zoneIndex: 0 });
    const trapContinuous = card.tags?.includes('continuous');
    if (trapContinuous) {
      ok = ok && state.players.p1.spellTraps[0]?.faceUp === true;
    } else {
      ok =
        ok &&
        !state.players.p1.spellTraps[0] &&
        state.players.p1.graveyard.includes(card.id);
    }

    const ops = (card.effects ?? []).flatMap((e) => e.ops);
    for (const op of ops) {
      if (op.op === 'damage') ok = ok && state.players.p2.life === lifeBefore - (op.amount ?? 0);
      if (op.op === 'heal') ok = ok && state.players.p1.life === lifeSelf + (op.amount ?? 0);
      if (op.op === 'draw') ok = ok && state.players.p1.hand.length === handBefore + (op.count ?? 1);
      if (op.op === 'destroy_target' && op.target === 'all_enemy_monsters') {
        ok = ok && state.players.p2.monsters.every((m) => !m);
      }
    }
    log(`trap:${card.id}`, ok);
  } catch (e) {
    log(`trap:${card.id}`, false, { error: String(e.message || e) });
  }
}

// —— Combat scenarios ——
try {
  const state = fresh('magma_brute');
  applyAction(state, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, position: 'attack', faceUp: true });
  // end turn to allow attack
  applyAction(state, 'p1', { type: 'end_turn' });
  // p2 turn - end
  applyAction(state, 'p2', { type: 'end_turn' });
  // p1 can attack
  putEnemyMonster(state, 'tide_minnow'); // 500 atk
  state.players.p1.monsters[0].canAttack = true;
  const foeLife = state.players.p2.life;
  applyAction(state, 'p1', { type: 'go_phase', phase: 'battle' });
  applyAction(state, 'p1', { type: 'declare_attack', attackerZone: 0, targetZone: 0 });
  log('combat:destroy_weaker', !state.players.p2.monsters[0] && state.players.p2.life < foeLife);
} catch (e) {
  log('combat:destroy_weaker', false, { error: String(e.message || e) });
}

try {
  const state = fresh('ember_sprite');
  applyAction(state, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, position: 'attack', faceUp: true });
  applyAction(state, 'p1', { type: 'end_turn' });
  applyAction(state, 'p2', { type: 'end_turn' });
  state.players.p2.monsters = [null, null, null];
  state.players.p1.monsters[0].canAttack = true;
  const life = state.players.p2.life;
  applyAction(state, 'p1', { type: 'declare_attack', attackerZone: 0, targetZone: 'player' });
  log('combat:direct_attack', state.players.p2.life === life - 1000);
} catch (e) {
  log('combat:direct_attack', false, { error: String(e.message || e) });
}

try {
  const state = fresh('ember_sprite');
  applyAction(state, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, position: 'defense', faceUp: false });
  log('defense:set_facedown', state.players.p1.monsters[0]?.position === 'defense' && !state.players.p1.monsters[0].faceUp);
  applyAction(state, 'p1', { type: 'change_position', zoneIndex: 0 });
  log('defense:flip_to_attack', state.players.p1.monsters[0]?.position === 'attack' && state.players.p1.monsters[0].faceUp);
} catch (e) {
  log('defense:flip', false, { error: String(e.message || e) });
}

try {
  const state = fresh('ember_sprite');
  applyAction(state, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, position: 'attack', faceUp: true });
  applyAction(state, 'p1', { type: 'change_position', zoneIndex: 0 });
  log('defense:faceup_defense', state.players.p1.monsters[0]?.position === 'defense' && state.players.p1.monsters[0].faceUp);
} catch (e) {
  log('defense:faceup', false, { error: String(e.message || e) });
}

// attack face-down defense reveals
try {
  const state = fresh('magma_brute');
  applyAction(state, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, position: 'attack', faceUp: true });
  applyAction(state, 'p1', { type: 'end_turn' });
  // p2 sets defense
  state.players.p2.hand[0] = 'tide_minnow';
  state.phase = 'main';
  applyAction(state, 'p2', { type: 'summon', handIndex: 0, zoneIndex: 0, position: 'defense', faceUp: false });
  applyAction(state, 'p2', { type: 'end_turn' });
  state.players.p1.monsters[0].canAttack = true;
  applyAction(state, 'p1', { type: 'declare_attack', attackerZone: 0, targetZone: 0 });
  // defender destroyed or revealed - if destroyed gone; check log for انكشف or destroy
  const revealed = state.log.some((l) => l.includes('انكشف') || l.includes('دُمّر'));
  log('combat:attack_facedown_reveal', revealed && !state.players.p2.monsters[0]);
} catch (e) {
  log('combat:attack_facedown_reveal', false, { error: String(e.message || e) });
}

console.log('\n=== SUMMARY ===');
console.log('passed', report.passed.length);
console.log('failed', report.failed.length);
if (report.failed.length) {
  console.log('FAILURES:');
  for (const f of report.failed) console.log(' -', f.name, f.detail);
}
process.exit(report.failed.length ? 1 : 0);
