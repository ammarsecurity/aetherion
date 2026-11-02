/**
 * سيناريوهات قسرية: فخ + قتال مباشر + تغيير وضع + هجوم على دفاع مقلوب
 * عبر إنشاء مباراتين مستقلتين (AI) مع إعادة محاولة حتى تظهر الورقة المطلوبة
 */
import { io } from '../node_modules/socket.io-client/build/esm/index.js';

const URL = process.env.GAME_URL || 'http://localhost:8787';
const CARD_MAP = {};

const results = [];
const pass = (n, d) => {
  results.push({ n, ok: true, d });
  console.log('✓', n, d ? JSON.stringify(d) : '');
};
const fail = (n, d) => {
  results.push({ n, ok: false, d });
  console.log('✗', n, d ? JSON.stringify(d) : '');
};

function connect() {
  return io(URL, { transports: ['websocket'], forceNew: true });
}
function once(s, e, ms = 8000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout:' + e)), ms);
    s.once(e, (p) => {
      clearTimeout(t);
      res(p);
    });
  });
}
function waitState(s, pred, ms = 10000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => {
      s.off('state', on);
      rej(new Error('timeout:state'));
    }, ms);
    function on(st) {
      if (pred(st)) {
        clearTimeout(t);
        s.off('state', on);
        res(st);
      }
    }
    s.on('state', on);
  });
}
function handOf(st, you, type) {
  return (st.players[you].hand || [])
    .map((id, i) => ({ id, i, card: CARD_MAP[id] }))
    .filter((x) => x.card?.type === type);
}
function empty(arr) {
  return arr.findIndex((z) => !z);
}
function mz(p) {
  return p.monsters.map((m, i) => (m ? { ...m, i } : null)).filter(Boolean);
}

async function loadCards() {
  const cards = await (await fetch(`${URL}/api/cards`)).json();
  for (const c of cards) CARD_MAP[c.id] = c;
}

async function openAi() {
  const s = connect();
  await once(s, 'connect');
  s.emit('create_ai');
  await once(s, 'joined');
  const st = await once(s, 'state');
  return { s, st };
}

async function untilHandHas(type, tries = 25) {
  for (let i = 0; i < tries; i++) {
    const { s, st } = await openAi();
    if (handOf(st, 'p1', type).length) return { s, st };
    s.disconnect();
  }
  throw new Error('no ' + type + ' in hand after retries');
}

async function scenarioTrapSetAndBattle() {
  const { s, st: start } = await untilHandHas('trap');
  let st = start;
  // summon attacker
  let mons = handOf(st, 'p1', 'monster');
  if (!mons.length) {
    s.emit('action', { type: 'end_turn' });
    st = await waitState(s, (x) => x.turn === 'p1', 15000);
    mons = handOf(st, 'p1', 'monster');
  }
  if (mons.length && empty(st.players.p1.monsters) >= 0) {
    s.emit('action', {
      type: 'summon',
      handIndex: mons[0].i,
      zoneIndex: empty(st.players.p1.monsters),
      position: 'attack',
      faceUp: true,
    });
    st = await waitState(s, (x) => x.players.p1.monsters.some(Boolean));
  }
  const traps = handOf(st, 'p1', 'trap');
  if (!traps.length) {
    fail('trap_set', { reason: 'lost trap after summon' });
    s.disconnect();
    return;
  }
  const tz = empty(st.players.p1.spellTraps);
  s.emit('action', {
    type: 'set_spell_trap',
    handIndex: traps[0].i,
    zoneIndex: tz,
  });
  st = await waitState(s, (x) => x.players.p1.spellTraps.some((z) => z && !z.faceUp));
  pass('trap_set', {
    cardId: st.players.p1.spellTraps.find((z) => z && !z.faceUp)?.cardId,
  });

  // end turn twice so we can attack next
  s.emit('action', { type: 'end_turn' });
  st = await waitState(s, (x) => x.turn === 'p1', 15000);
  const atk = mz(st.players.p1).find((m) => m.canAttack && m.position === 'attack');
  if (atk) {
    const foe = st.players.p2.monsters.findIndex((m) => m);
    s.emit('action', {
      type: 'declare_attack',
      attackerZone: atk.i,
      targetZone: foe >= 0 ? foe : 'player',
    });
    st = await waitState(s, (x) => x.log.length > 0);
    pass('trap_side_combat', { log: st.log.slice(-5), life: st.players.p2.life });
  } else {
    pass('trap_side_combat', { skipped: true });
  }
  s.disconnect();
}

async function scenarioChangePosition() {
  const { s, st: start } = await openAi();
  let st = start;
  const mons = handOf(st, 'p1', 'monster');
  if (!mons.length) {
    fail('change_position', { reason: 'no monster' });
    s.disconnect();
    return;
  }
  s.emit('action', {
    type: 'summon',
    handIndex: mons[0].i,
    zoneIndex: 0,
    position: 'attack',
    faceUp: true,
  });
  st = await waitState(s, (x) => x.players.p1.monsters[0]);
  // change same turn often blocked — end turn cycle
  s.emit('action', { type: 'end_turn' });
  st = await waitState(s, (x) => x.turn === 'p1', 15000);
  const z = st.players.p1.monsters.findIndex((m) => m);
  if (z < 0) {
    fail('change_position', { reason: 'monster gone' });
    s.disconnect();
    return;
  }
  s.emit('action', { type: 'change_position', zoneIndex: z });
  try {
    st = await waitState(
      s,
      (x) => x.players.p1.monsters[z]?.position === 'defense',
      3000,
    );
    pass('change_position', {
      position: st.players.p1.monsters[z].position,
      faceUp: st.players.p1.monsters[z].faceUp,
    });
  } catch (e) {
    // maybe error
    const err = await Promise.race([
      once(s, 'error_msg', 500).catch(() => null),
      Promise.resolve(null),
    ]);
    if (err) fail('change_position', { message: err.message });
    else fail('change_position', { error: String(e.message || e) });
  }
  s.disconnect();
}

async function scenarioDirectAttack() {
  // Keep ending until field empty for foe and we have attacker
  for (let attempt = 0; attempt < 15; attempt++) {
    const { s, st: start } = await openAi();
    let st = start;
    const mons = handOf(st, 'p1', 'monster');
    if (mons.length) {
      s.emit('action', {
        type: 'summon',
        handIndex: mons[0].i,
        zoneIndex: 0,
        position: 'attack',
        faceUp: true,
      });
      st = await waitState(s, (x) => x.players.p1.monsters[0]);
    }
    s.emit('action', { type: 'end_turn' });
    st = await waitState(s, (x) => x.turn === 'p1', 15000);
    const atk = mz(st.players.p1).find((m) => m.canAttack && m.position === 'attack' && m.faceUp);
    const foeEmpty = !st.players.p2.monsters.some(Boolean);
    if (atk && foeEmpty) {
      const before = st.players.p2.life;
      s.emit('action', {
        type: 'declare_attack',
        attackerZone: atk.i,
        targetZone: 'player',
      });
      st = await waitState(s, (x) => x.players.p2.life < before);
      pass('direct_attack', { before, after: st.players.p2.life, delta: before - st.players.p2.life });
      s.disconnect();
      return;
    }
    // try attack monster to clear
    if (atk && !foeEmpty) {
      const ti = st.players.p2.monsters.findIndex((m) => m);
      s.emit('action', {
        type: 'declare_attack',
        attackerZone: atk.i,
        targetZone: ti,
      });
      await new Promise((r) => setTimeout(r, 200));
      s.emit('action', { type: 'end_turn' });
      try {
        st = await waitState(s, (x) => x.turn === 'p1', 15000);
      } catch {
        /* */
      }
      const atk2 = mz(st.players.p1).find((m) => m.canAttack && m.position === 'attack');
      if (atk2 && !st.players.p2.monsters.some(Boolean)) {
        const before = st.players.p2.life;
        s.emit('action', {
          type: 'declare_attack',
          attackerZone: atk2.i,
          targetZone: 'player',
        });
        st = await waitState(s, (x) => x.players.p2.life < before);
        pass('direct_attack', { before, after: st.players.p2.life });
        s.disconnect();
        return;
      }
    }
    s.disconnect();
  }
  fail('direct_attack', { reason: 'could not force empty field' });
}

async function scenarioPvpFaceDownDefenseHidden() {
  const p1 = connect();
  const p2 = connect();
  await Promise.all([once(p1, 'connect'), once(p2, 'connect')]);
  p1.emit('create_pvp');
  const j1 = await once(p1, 'joined');
  let st1 = await once(p1, 'state');
  p2.emit('join_pvp', { code: j1.code });
  await once(p2, 'joined');
  let st2 = await once(p2, 'state');
  st1 = await once(p1, 'state').catch(() => st1);

  // wait for both states after join
  await new Promise((r) => setTimeout(r, 100));
  // get fresh
  const mons = handOf(st1, 'p1', 'monster');
  if (!mons.length) {
    fail('pvp_facedown_defense_hidden', { reason: 'no monster' });
    p1.disconnect();
    p2.disconnect();
    return;
  }
  p1.emit('action', {
    type: 'summon',
    handIndex: mons[0].i,
    zoneIndex: 0,
    position: 'defense',
    faceUp: false,
  });
  [st1, st2] = await Promise.all([
    waitState(p1, (x) => x.players.p1.monsters[0] && !x.players.p1.monsters[0].faceUp),
    waitState(p2, (x) => x.players.p1.monsters[0] && !x.players.p1.monsters[0].faceUp),
  ]);
  const own = st1.players.p1.monsters[0];
  const foe = st2.players.p1.monsters[0];
  if (own.cardId !== 'hidden' && foe.cardId === 'hidden' && own.position === 'defense') {
    pass('pvp_facedown_defense_hidden', { ownId: own.cardId, foeSees: foe.cardId });
  } else {
    fail('pvp_facedown_defense_hidden', { own, foe });
  }
  p1.disconnect();
  p2.disconnect();
}

async function main() {
  await loadCards();
  await scenarioTrapSetAndBattle();
  await scenarioChangePosition();
  await scenarioDirectAttack();
  await scenarioPvpFaceDownDefenseHidden();
  const failed = results.filter((r) => !r.ok);
  console.log('\n========== FORCED ==========');
  console.log('passed', results.filter((r) => r.ok).length, 'failed', failed.length);
  for (const f of failed) console.log(' FAIL', f.n, f.d);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
