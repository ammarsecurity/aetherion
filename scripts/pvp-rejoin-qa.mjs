import { io } from '../node_modules/socket.io-client/build/esm/index.js';

const URL = 'http://localhost:8787';
const results = [];
const ok = (n, d) => {
  results.push({ n, ok: true, d });
  console.log('✓', n, d ? JSON.stringify(d) : '');
};
const bad = (n, d) => {
  results.push({ n, ok: false, d });
  console.log('✗', n, d ? JSON.stringify(d) : '');
};

function once(s, e, ms = 8000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout:' + e)), ms);
    s.once(e, (p) => {
      clearTimeout(t);
      res(p);
    });
  });
}
function waitState(s, pred, ms = 8000) {
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

async function main() {
  const cards = await (await fetch(URL + '/api/cards')).json();
  const map = Object.fromEntries(cards.map((c) => [c.id, c]));

  const p1 = io(URL, { transports: ['websocket'], forceNew: true });
  const p2 = io(URL, { transports: ['websocket'], forceNew: true });
  await Promise.all([once(p1, 'connect'), once(p2, 'connect')]);

  // listen for states before emitting join/create to avoid races
  const p1States = [];
  const p2States = [];
  p1.on('state', (s) => p1States.push(s));
  p2.on('state', (s) => p2States.push(s));

  const created = Promise.all([once(p1, 'joined'), waitState(p1, () => true)]);
  p1.emit('create_pvp');
  const [j1] = await created;

  const joined = Promise.all([
    once(p2, 'joined'),
    waitState(p1, (s) => (s.players.p2?.handCount ?? 0) === 5 || s.turnNumber >= 1),
    waitState(p2, (s) => Array.isArray(s.players.p2.hand)),
  ]);
  p2.emit('join_pvp', { code: j1.code });
  const [j2, st1a, st2a] = await joined;
  let st1 = st1a;
  let st2 = st2a;
  ok('joined', { code: j1.code, p2: j2.you });

  const hand = st1.players.p1.hand;
  const mi = hand.findIndex((id) => map[id]?.type === 'monster');
  if (mi < 0) {
    bad('summoned', { hand });
  } else {
    p1.emit('action', {
      type: 'summon',
      handIndex: mi,
      zoneIndex: 0,
      position: 'attack',
      faceUp: true,
    });
    st1 = await waitState(p1, (s) => !!s.players.p1.monsters[0]);
    ok('summoned', {
      monsterId: st1.players.p1.monsters[0].cardId,
      life: st1.players.p1.life,
    });
  }

  const monsterId = st1.players.p1.monsters[0]?.cardId;
  const lifeSnap = st1.players.p1.life;

  // disconnect p2
  p2.disconnect();
  await new Promise((r) => setTimeout(r, 400));

  const p2b = io(URL, { transports: ['websocket'], forceNew: true });
  await once(p2b, 'connect');
  const rejoinState = waitState(
    p2b,
    (s) => !monsterId || s.players.p1.monsters[0]?.cardId === monsterId || !!s.players.p1.monsters[0],
  );
  const rejoinJoined = once(p2b, 'joined');
  p2b.emit('rejoin', { code: j1.code, you: 'p2' });
  const jr = await rejoinJoined;
  st2 = await rejoinState;
  if (jr.you === 'p2' && st2.players.p1.monsters[0]?.cardId === monsterId && st2.players.p1.life === lifeSnap) {
    ok('rejoin_preserves_state', {
      monster: monsterId,
      life: lifeSnap,
    });
  } else {
    bad('rejoin_preserves_state', {
      jr,
      monster: st2.players.p1.monsters[0],
      life: st2.players.p1.life,
      expect: { monsterId, lifeSnap },
    });
  }

  const afterEnd = Promise.all([
    waitState(p1, (s) => s.turn === 'p2'),
    waitState(p2b, (s) => s.turn === 'p2'),
  ]);
  p1.emit('action', { type: 'end_turn' });
  [st1, st2] = await afterEnd;
  ok('play_after_rejoin', { turn: st1.turn, synced: st1.turn === st2.turn });

  const spellIdx = st2.players.p2.hand.findIndex((id) => map[id]?.type === 'spell');
  if (spellIdx >= 0) {
    const sid = st2.players.p2.hand[spellIdx];
    const cont = map[sid]?.tags?.includes('continuous');
    const afterSpell = waitState(p2b, (s) =>
      cont
        ? s.players.p2.spellTraps.some((z) => z?.cardId === sid && z.faceUp)
        : s.players.p2.graveyard.includes(sid),
    );
    p2b.emit('action', {
      type: 'activate_spell',
      handIndex: spellIdx,
      zoneIndex: 0,
    });
    st2 = await afterSpell;
    if (cont) {
      ok('spell_leaves_field', { continuous: true, onField: true });
    } else if (!st2.players.p2.spellTraps[0] && st2.players.p2.graveyard.includes(sid)) {
      ok('spell_leaves_field', { cardId: sid, gy: true });
    } else {
      bad('spell_leaves_field', {
        zones: st2.players.p2.spellTraps,
        gy: st2.players.p2.graveyard,
      });
    }
  } else {
    ok('spell_leaves_field', { skipped: 'no spell' });
  }

  p1.disconnect();
  p2b.disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log('\npassed', results.filter((r) => r.ok).length, 'failed', failed.length);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
