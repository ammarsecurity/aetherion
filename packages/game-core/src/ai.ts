import { getCard } from './cards.js';
import { applyAction, monsterAtk } from './engine.js';
import type { GameAction, GameState, PlayerId, Position } from './types.js';

function other(id: PlayerId): PlayerId {
  return id === 'p1' ? 'p2' : 'p1';
}

export function chooseAiAction(state: GameState, aiId: PlayerId): GameAction | null {
  if (state.winner || state.turn !== aiId) return null;
  const me = state.players[aiId];
  const foe = state.players[other(aiId)];

  if (state.phase === 'main') {
    // Activate a simple spell from hand if possible
    for (let i = 0; i < me.hand.length; i++) {
      const card = getCard(me.hand[i]!);
      if (card.type === 'spell') {
        const empty = me.spellTraps.findIndex((z) => !z);
        try {
          return {
            type: 'activate_spell',
            handIndex: i,
            zoneIndex: empty >= 0 ? empty : undefined,
          };
        } catch {
          /* try next */
        }
      }
    }

    // Summon strongest monster
    if (!me.normalSummonUsed) {
      let bestIdx = -1;
      let bestAtk = -1;
      for (let i = 0; i < me.hand.length; i++) {
        const card = getCard(me.hand[i]!);
        if (card.type === 'monster' && (card.atk ?? 0) > bestAtk) {
          bestAtk = card.atk ?? 0;
          bestIdx = i;
        }
      }
      const zone = me.monsters.findIndex((z) => !z);
      if (bestIdx >= 0 && zone >= 0) {
        const position: Position = bestAtk >= 1400 ? 'attack' : 'defense';
        return {
          type: 'summon',
          handIndex: bestIdx,
          zoneIndex: zone,
          position,
          faceUp: position === 'attack',
        };
      }
    }

    // Set a trap if free zone
    const trapZone = me.spellTraps.findIndex((z) => !z);
    if (trapZone >= 0) {
      for (let i = 0; i < me.hand.length; i++) {
        const card = getCard(me.hand[i]!);
        if (card.type === 'trap') {
          return { type: 'set_spell_trap', handIndex: i, zoneIndex: trapZone };
        }
      }
    }

    return { type: 'go_phase', phase: 'battle' };
  }

  if (state.phase === 'battle') {
    for (let az = 0; az < me.monsters.length; az++) {
      const attacker = me.monsters[az];
      if (!attacker || attacker.position !== 'attack' || !attacker.canAttack) continue;
      const atk = monsterAtk(attacker);

      // Prefer destroying weaker attack-position monsters
      let target: number | 'player' | null = null;
      let best = Infinity;
      for (let tz = 0; tz < foe.monsters.length; tz++) {
        const d = foe.monsters[tz];
        if (!d) continue;
        const dAtk = monsterAtk(d);
        if (d.position === 'attack' && atk > dAtk && dAtk < best) {
          best = dAtk;
          target = tz;
        } else if (d.position === 'defense') {
          const def = (getCard(d.cardId).def ?? 0) + d.defBuff;
          if (atk > def && def < best) {
            best = def;
            target = tz;
          }
        }
      }

      if (target == null && !foe.monsters.some((m) => m)) {
        target = 'player';
      }

      if (target != null) {
        return { type: 'declare_attack', attackerZone: az, targetZone: target };
      }
    }
    return { type: 'end_turn' };
  }

  return { type: 'end_turn' };
}

export function runAiTurn(state: GameState, aiId: PlayerId, maxSteps = 20): GameState {
  let steps = 0;
  while (!state.winner && state.turn === aiId && steps < maxSteps) {
    const action = chooseAiAction(state, aiId);
    if (!action) break;
    try {
      applyAction(state, aiId, action);
    } catch {
      applyAction(state, aiId, { type: 'end_turn' });
      break;
    }
    steps += 1;
    if (action.type === 'end_turn') break;
  }
  return state;
}
