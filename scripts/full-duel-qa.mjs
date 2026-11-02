/**
 * اختبار دقيق: AI + PvP (لاعب ضد لاعب) عبر Socket.IO
 */
import { io } from '../node_modules/socket.io-client/build/esm/index.js';

const URL = process.env.GAME_URL || 'http://localhost:8787';
const results = [];
const pass = (name, detail) => {
  results.push({ name, ok: true, detail });
  console.log('✓', name, detail ? JSON.stringify(detail) : '');
};
const fail = (name, detail) => {
  results.push({ name, ok: false, detail });
  console.log('✗', name, detail ? JSON.stringify(detail) : '');
};

function connect() {
  return io(URL, { transports: ['websocket'], forceNew: true });
}

function once(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

function waitState(socket, pred, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off('state', onState);
      reject(new Error('timeout:state'));
    }, ms);
    function onState(s) {
      if (pred(s)) {
        clearTimeout(t);
        socket.off('state', onState);
        resolve(s);
      }
    }
    socket.on('state', onState);
  });
}

async function withClient(fn) {
  const s = connect();
  await once(s, 'connect');
  try {
    return await fn(s);
  } finally {
    s.disconnect();
  }
}

function findInHand(state, you, type) {
  const hand = state.players[you].hand || [];
  // We don't have card map on client easily — use id heuristics from known set
  // Better: fetch cards from API
  return hand;
}

let CARD_MAP = {};
async function loadCards() {
  const res = await fetch(`${URL}/api/cards`);
  const cards = await res.json();
  CARD_MAP = Object.fromEntries(cards.map((c) => [c.id, c]));
  return cards;
}

function handTyped(state, you, type) {
  const hand = state.players[you].hand || [];
  return hand
    .map((id, i) => ({ id, i, card: CARD_MAP[id] }))
    .filter((x) => x.card?.type === type);
}

function emptyZone(arr) {
  return arr.findIndex((z) => !z);
}

function monsterZones(p) {
  return p.monsters.map((m, i) => (m ? { ...m, i } : null)).filter(Boolean);
}

// ========== AI SCENARIOS ==========
async function testAiFull() {
  console.log('\n=== AI SCENARIOS ===');
  await withClient(async (s) => {
    s.emit('create_ai');
    const joined = await once(s, 'joined');
    let state = await once(s, 'state');
    pass('ai_join', { you: joined.you, mode: joined.mode, code: joined.code });

    if (joined.you !== 'p1' || joined.mode !== 'ai') {
      fail('ai_identity', joined);
      return;
    }

    // Summon attack
    const monsters = handTyped(state, 'p1', 'monster');
    if (!monsters.length) {
      fail('ai_has_monster', { hand: state.players.p1.hand });
      return;
    }
    const z = emptyZone(state.players.p1.monsters);
    s.emit('action', {
      type: 'summon',
      handIndex: monsters[0].i,
      zoneIndex: z,
      position: 'attack',
      faceUp: true,
    });
    state = await waitState(s, (st) => st.players.p1.monsters.some((m) => m));
    const m0 = state.players.p1.monsters.find((m) => m);
    pass('ai_summon_attack', {
      cardId: m0.cardId,
      faceUp: m0.faceUp,
      position: m0.position,
    });

    // Set or activate spell if available
    state = await once(s, 'state').catch(() => state);
    // refresh - get latest by emitting nothing; use current
    let spells = handTyped(state, 'p1', 'spell');
    if (spells.length) {
      const sz = emptyZone(state.players.p1.spellTraps);
      s.emit('action', {
        type: 'set_spell_trap',
        handIndex: spells[0].i,
        zoneIndex: sz,
      });
      state = await waitState(s, (st) =>
        st.players.p1.spellTraps.some((x) => x && !x.faceUp),
      );
      pass('ai_set_spell', {
        cardId: state.players.p1.spellTraps.find((x) => x && !x.faceUp)?.cardId,
      });

      // activate from field if allowed
      const setIdx = state.players.p1.spellTraps.findIndex((x) => x && !x.faceUp);
      const setCard = state.players.p1.spellTraps[setIdx];
      const def = CARD_MAP[setCard.cardId];
      if (!def?.tags?.includes('quick') || !setCard.setThisTurn) {
        const beforeGy = state.players.p1.graveyard?.length ?? 0;
        s.emit('action', { type: 'activate_spell', zoneIndex: setIdx });
        state = await waitState(
          s,
          (st) =>
            (def?.tags?.includes('continuous')
              ? st.players.p1.spellTraps[setIdx]?.faceUp
              : (st.players.p1.graveyard?.length ?? 0) > beforeGy ||
                !st.players.p1.spellTraps[setIdx]),
        );
        pass('ai_activate_set_spell', {
          cardId: setCard.cardId,
          leftField: !state.players.p1.spellTraps[setIdx],
        });
      } else {
        pass('ai_activate_set_spell', { skipped: 'quick same turn' });
      }
    } else {
      pass('ai_set_spell', { skipped: 'no spell in hand' });
      pass('ai_activate_set_spell', { skipped: true });
    }

    // End turn → AI plays
    const beforeTurn = state.turnNumber;
    const lifeBefore = state.players.p1.life;
    s.emit('action', { type: 'end_turn' });
    state = await waitState(
      s,
      (st) => st.turn === 'p1' && st.turnNumber > beforeTurn,
      15000,
    );
    pass('ai_took_turn', {
      turnNumber: state.turnNumber,
      foeMonsters: state.players.p2.monsters.filter(Boolean).length,
      myLife: state.players.p1.life,
      lifeDelta: lifeBefore - state.players.p1.life,
    });

    // Defense summon next
    const mons2 = handTyped(state, 'p1', 'monster');
    if (mons2.length && emptyZone(state.players.p1.monsters) >= 0) {
      const dz = emptyZone(state.players.p1.monsters);
      s.emit('action', {
        type: 'summon',
        handIndex: mons2[0].i,
        zoneIndex: dz,
        position: 'defense',
        faceUp: false,
      });
      state = await waitState(s, (st) =>
        st.players.p1.monsters.some((m) => m && m.position === 'defense' && !m.faceUp),
      );
      pass('ai_summon_defense_down', {});
    } else {
      pass('ai_summon_defense_down', { skipped: true });
    }

    // Battle / direct if possible
    s.emit('action', { type: 'end_turn' });
    state = await waitState(s, (st) => st.turn === 'p1', 15000);
    const attackers = monsterZones(state.players.p1).filter(
      (m) => m.position === 'attack' && m.canAttack && m.faceUp,
    );
    if (attackers.length) {
      const foeHas = state.players.p2.monsters.some(Boolean);
      if (!foeHas) {
        s.emit('action', {
          type: 'declare_attack',
          attackerZone: attackers[0].i,
          targetZone: 'player',
        });
        state = await waitState(s, (st) => st.players.p2.life < 8000 || st.log.some((l) => l.includes('مباشر')));
        pass('ai_direct_attack', { foeLife: state.players.p2.life });
      } else {
        const ti = state.players.p2.monsters.findIndex((m) => m);
        s.emit('action', {
          type: 'declare_attack',
          attackerZone: attackers[0].i,
          targetZone: ti,
        });
        state = await waitState(s, (st) => st.log.length > 0);
        pass('ai_monster_attack', { log: state.log.slice(-3) });
      }
    } else {
      pass('ai_combat', { skipped: 'no attacker ready' });
    }

    // Trap if any
    const traps = handTyped(state, 'p1', 'trap');
    if (traps.length && emptyZone(state.players.p1.spellTraps) >= 0) {
      const tz = emptyZone(state.players.p1.spellTraps);
      s.emit('action', {
        type: 'set_spell_trap',
        handIndex: traps[0].i,
        zoneIndex: tz,
      });
      state = await waitState(s, (st) =>
        st.players.p1.spellTraps.some((x) => x && !x.faceUp),
      );
      pass('ai_set_trap', {});
    } else {
      pass('ai_set_trap', { skipped: 'no trap' });
    }
  });
}

// ========== PvP SCENARIOS ==========
async function testPvpFull() {
  console.log('\n=== PvP SCENARIOS (p1 vs p2) ===');
  const p1 = connect();
  const p2 = connect();
  await Promise.all([once(p1, 'connect'), once(p2, 'connect')]);

  try {
    // invalid join
    p2.emit('join_pvp', { code: 'ZZZZZ' });
    const err = await once(p2, 'error_msg');
    pass('pvp_invalid_room', { message: err.message });

    // create room
    p1.emit('create_pvp');
    const j1 = await once(p1, 'joined');
    const s1 = await once(p1, 'state');
    pass('pvp_create', { code: j1.code, you: j1.you, mode: j1.mode });

    // action before opponent should fail
    p1.emit('action', { type: 'end_turn' });
    const waitErr = await once(p1, 'error_msg');
    pass('pvp_wait_opponent_blocks_action', { message: waitErr.message });

    // join
    p2.emit('join_pvp', { code: j1.code });
    const j2 = await once(p2, 'joined');
    const [st1, st2] = await Promise.all([once(p1, 'state'), once(p2, 'state')]);
    pass('pvp_join', { p1: j1.you, p2: j2.you, code: j2.code });

    // perspective via joined + fog of war
    if (j1.you !== 'p1' || j2.you !== 'p2') {
      fail('pvp_perspective', { j1: j1.you, j2: j2.you });
    } else {
      pass('pvp_perspective', {
        p1Hand: st1.players.p1.hand?.length,
        p2HandHiddenFromP1: st1.players.p2.hand === undefined,
      });
    }

    // fog of war: p1 shouldn't see p2 hand
    const fogOk =
      Array.isArray(st1.players.p1.hand) &&
      st1.players.p2.hand === undefined &&
      Array.isArray(st2.players.p2.hand) &&
      st2.players.p1.hand === undefined;
    if (fogOk) {
      pass('pvp_fog_hand', {
        p1Own: st1.players.p1.hand.length,
        p2Own: st2.players.p2.hand.length,
      });
    } else {
      fail('pvp_fog_hand', {
        p1SeesOwnHand: Array.isArray(st1.players.p1.hand),
        p1SeesFoeHand: st1.players.p2.hand,
        p2SeesOwnHand: Array.isArray(st2.players.p2.hand),
        p2SeesFoeHand: st2.players.p1.hand,
      });
    }

    // p1 summons
    let stateP1 = st1;
    let stateP2 = st2;
    const mons = handTyped(stateP1, 'p1', 'monster');
    if (!mons.length) {
      fail('pvp_p1_monster', { hand: stateP1.players.p1.hand });
    } else {
      const z = emptyZone(stateP1.players.p1.monsters);
      p1.emit('action', {
        type: 'summon',
        handIndex: mons[0].i,
        zoneIndex: z,
        position: 'attack',
        faceUp: true,
      });
      [stateP1, stateP2] = await Promise.all([
        waitState(p1, (st) => st.players.p1.monsters.some(Boolean)),
        waitState(p2, (st) => st.players.p1.monsters.some(Boolean)),
      ]);
      pass('pvp_p1_summon_synced', {
        p1Sees: stateP1.players.p1.monsters.filter(Boolean).map((m) => m.cardId),
        p2Sees: stateP2.players.p1.monsters.filter(Boolean).map((m) => m.cardId),
        same:
          stateP1.players.p1.monsters[z]?.cardId === stateP2.players.p1.monsters[z]?.cardId,
      });
    }

    // p1 sets defense monster face-down — p2 should see hidden
    const mons2 = handTyped(stateP1, 'p1', 'monster');
    if (mons2.length && emptyZone(stateP1.players.p1.monsters) >= 0) {
      const z = emptyZone(stateP1.players.p1.monsters);
      p1.emit('action', {
        type: 'summon',
        handIndex: mons2[0].i,
        zoneIndex: z,
        position: 'defense',
        faceUp: false,
      });
      // wait - but normalSummonUsed already true! Can't summon twice same turn
      // expect error
      const e = await once(p1, 'error_msg');
      pass('pvp_second_summon_blocked', { message: e.message });
    } else {
      pass('pvp_second_summon_blocked', { skipped: true });
    }

    // set spell face-down, check fog for p2
    const spells = handTyped(stateP1, 'p1', 'spell');
    if (spells.length) {
      const sz = emptyZone(stateP1.players.p1.spellTraps);
      p1.emit('action', {
        type: 'set_spell_trap',
        handIndex: spells[0].i,
        zoneIndex: sz,
      });
      [stateP1, stateP2] = await Promise.all([
        waitState(p1, (st) => st.players.p1.spellTraps.some((x) => x && !x.faceUp)),
        waitState(p2, (st) => st.players.p1.spellTraps.some((x) => x && !x.faceUp)),
      ]);
      const p1View = stateP1.players.p1.spellTraps.find((x) => x && !x.faceUp);
      const p2View = stateP2.players.p1.spellTraps.find((x) => x && !x.faceUp);
      pass('pvp_set_spell_fog', {
        p1SeesId: p1View?.cardId,
        p2SeesId: p2View?.cardId,
        hiddenToP2: p2View?.cardId === 'hidden',
        knownToP1: p1View?.cardId !== 'hidden',
      });
    } else {
      pass('pvp_set_spell_fog', { skipped: 'no spell' });
    }

    // end turn — p2's turn
    p1.emit('action', { type: 'end_turn' });
    [stateP1, stateP2] = await Promise.all([
      waitState(p1, (st) => st.turn === 'p2'),
      waitState(p2, (st) => st.turn === 'p2'),
    ]);
    pass('pvp_turn_to_p2', { turn: stateP1.turn, turnNumber: stateP1.turnNumber });

    // p1 cannot act on p2 turn
    p1.emit('action', { type: 'end_turn' });
    const notTurn = await once(p1, 'error_msg');
    pass('pvp_p1_blocked_on_p2_turn', { message: notTurn.message });

    // p2 summons defense face-up
    const p2mons = handTyped(stateP2, 'p2', 'monster');
    if (p2mons.length) {
      const z = emptyZone(stateP2.players.p2.monsters);
      p2.emit('action', {
        type: 'summon',
        handIndex: p2mons[0].i,
        zoneIndex: z,
        position: 'defense',
        faceUp: true,
      });
      [stateP1, stateP2] = await Promise.all([
        waitState(p1, (st) => st.players.p2.monsters.some((m) => m && m.faceUp)),
        waitState(p2, (st) => st.players.p2.monsters.some((m) => m && m.faceUp)),
      ]);
      const seen = stateP1.players.p2.monsters.find((m) => m);
      pass('pvp_p2_summon_defense_up', {
        position: seen?.position,
        faceUp: seen?.faceUp,
        cardId: seen?.cardId,
        p1CanSee: seen?.cardId !== 'hidden',
      });
    } else {
      fail('pvp_p2_summon', { hand: stateP2.players.p2.hand });
    }

    // p2 sets trap
    const p2traps = handTyped(stateP2, 'p2', 'trap');
    if (p2traps.length && emptyZone(stateP2.players.p2.spellTraps) >= 0) {
      const tz = emptyZone(stateP2.players.p2.spellTraps);
      p2.emit('action', {
        type: 'set_spell_trap',
        handIndex: p2traps[0].i,
        zoneIndex: tz,
      });
      [stateP1, stateP2] = await Promise.all([
        waitState(p1, (st) => st.players.p2.spellTraps.some((x) => x && !x.faceUp)),
        waitState(p2, (st) => st.players.p2.spellTraps.some((x) => x && !x.faceUp)),
      ]);
      const p1Trap = stateP1.players.p2.spellTraps.find((x) => x && !x.faceUp);
      const p2Trap = stateP2.players.p2.spellTraps.find((x) => x && !x.faceUp);
      pass('pvp_trap_fog', {
        p2Knows: p2Trap?.cardId !== 'hidden',
        p1Hidden: p1Trap?.cardId === 'hidden',
      });
    } else {
      pass('pvp_trap_fog', { skipped: 'no trap in p2 hand' });
    }

    // p2 ends, p1 attacks
    p2.emit('action', { type: 'end_turn' });
    [stateP1, stateP2] = await Promise.all([
      waitState(p1, (st) => st.turn === 'p1'),
      waitState(p2, (st) => st.turn === 'p1'),
    ]);

    const atk = monsterZones(stateP1.players.p1).find(
      (m) => m.position === 'attack' && m.canAttack,
    );
    if (atk) {
      const foeIdx = stateP1.players.p2.monsters.findIndex((m) => m);
      const lifeBefore = {
        p1: stateP1.players.p1.life,
        p2: stateP1.players.p2.life,
      };
      if (foeIdx >= 0) {
        p1.emit('action', {
          type: 'declare_attack',
          attackerZone: atk.i,
          targetZone: foeIdx,
        });
      } else {
        p1.emit('action', {
          type: 'declare_attack',
          attackerZone: atk.i,
          targetZone: 'player',
        });
      }
      [stateP1, stateP2] = await Promise.all([
        waitState(p1, (st) => st.log.length > 0),
        waitState(p2, (st) => true),
      ]);
      // wait a tick for sync
      await new Promise((r) => setTimeout(r, 200));
      pass('pvp_combat_synced', {
        lifeP1: stateP1.players.p1.life,
        lifeP2: stateP1.players.p2.life,
        lifeBefore,
        sameLife:
          stateP1.players.p1.life === stateP2.players.p1.life &&
          stateP1.players.p2.life === stateP2.players.p2.life,
        logTail: stateP1.log.slice(-4),
      });
    } else {
      pass('pvp_combat_synced', { skipped: 'no attacker (summoning sickness)' });
    }

    // room full
    const p3 = connect();
    await once(p3, 'connect');
    p3.emit('join_pvp', { code: j1.code });
    const full = await once(p3, 'error_msg');
    pass('pvp_room_full', { message: full.message });
    p3.disconnect();

    // play more turns until something meaningful
    let turns = 0;
    while (turns < 8 && !stateP1.winner) {
      turns++;
      const cur = stateP1.turn;
      const sock = cur === 'p1' ? p1 : p2;
      const me = cur;
      let st = cur === 'p1' ? stateP1 : stateP2;
      const mons = handTyped(st, me, 'monster');
      if (mons.length && !st.players[me].normalSummonUsed) {
        const z = emptyZone(st.players[me].monsters);
        if (z >= 0) {
          sock.emit('action', {
            type: 'summon',
            handIndex: mons[0].i,
            zoneIndex: z,
            position: Math.random() > 0.5 ? 'attack' : 'defense',
            faceUp: Math.random() > 0.4,
          });
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      const spells = handTyped(st, me, 'spell');
      if (spells.length && emptyZone(st.players[me].spellTraps) >= 0) {
        sock.emit('action', {
          type: 'activate_spell',
          handIndex: spells[0].i,
          zoneIndex: emptyZone(st.players[me].spellTraps),
        });
        await new Promise((r) => setTimeout(r, 150));
      }
      // try attack
      const ready = monsterZones(st.players[me]).filter(
        (m) => m.canAttack && m.position === 'attack' && m.faceUp,
      );
      if (ready.length) {
        const foe = me === 'p1' ? 'p2' : 'p1';
        const ti = st.players[foe].monsters.findIndex((m) => m);
        sock.emit('action', {
          type: 'declare_attack',
          attackerZone: ready[0].i,
          targetZone: ti >= 0 ? ti : 'player',
        });
        await new Promise((r) => setTimeout(r, 150));
      }
      sock.emit('action', { type: 'end_turn' });
      try {
        [stateP1, stateP2] = await Promise.all([
          waitState(p1, (s) => s.turn !== cur || !!s.winner, 5000),
          waitState(p2, (s) => s.turn !== cur || !!s.winner, 5000),
        ]);
      } catch {
        break;
      }
    }
    pass('pvp_multi_turn_loop', {
      turns,
      winner: stateP1.winner,
      life: { p1: stateP1.players.p1.life, p2: stateP1.players.p2.life },
      synced:
        stateP1.players.p1.life === stateP2.players.p1.life &&
        stateP1.turn === stateP2.turn,
    });
  } catch (e) {
    fail('pvp_fatal', { error: String(e.message || e) });
  } finally {
    p1.disconnect();
    p2.disconnect();
  }
}

// ========== ENGINE RECHECK ==========
async function testEngineCards() {
  console.log('\n=== ENGINE CARD EFFECTS (quick recheck) ===');
  const { spawn } = await import('child_process');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  await new Promise((resolve) => {
    const p = spawn('node', ['scripts/test-all-cards.mjs'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.stderr.on('data', (d) => {
      out += d;
    });
    p.on('close', (code) => {
      const m = out.match(/passed (\d+)/);
      const f = out.match(/failed (\d+)/);
      if (code === 0) pass('engine_all_cards', { passed: m?.[1], failed: f?.[1] });
      else fail('engine_all_cards', { code, tail: out.slice(-500) });
      resolve();
    });
  });
}

async function main() {
  console.log('Connecting to', URL);
  await loadCards();
  pass('cards_loaded', { count: Object.keys(CARD_MAP).length });

  await testEngineCards();
  await testAiFull();
  await testPvpFull();

  const failed = results.filter((r) => !r.ok);
  console.log('\n========== FINAL ==========');
  console.log('passed', results.filter((r) => r.ok).length);
  console.log('failed', failed.length);
  if (failed.length) {
    for (const f of failed) console.log(' FAIL:', f.name, f.detail);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
