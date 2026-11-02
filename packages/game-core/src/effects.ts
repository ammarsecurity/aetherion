import { getCard, tryGetCard } from './cards.js';
import type {
  CardEffect,
  EffectCondition,
  EffectOp,
  FieldMonster,
  GameState,
  PlayerId,
  TargetKind,
} from './types.js';

function other(id: PlayerId): PlayerId {
  return id === 'p1' ? 'p2' : 'p1';
}

function countTag(state: GameState, owner: PlayerId, tag: string): number {
  return state.players[owner].monsters.filter((m) => {
    if (!m) return false;
    const card = getCard(m.cardId);
    return card.tags?.includes(tag);
  }).length;
}

export function conditionsMet(
  state: GameState,
  owner: PlayerId,
  conditions: EffectCondition[] | undefined,
): boolean {
  if (!conditions?.length) return true;
  for (const c of conditions) {
    if (c.op === 'if_control_tag') {
      const who = c.owner === 'opponent' ? other(owner) : owner;
      const n = countTag(state, who, c.tag);
      if (n < (c.min ?? 1)) return false;
    }
  }
  return true;
}

function resolveMonsterTargets(
  state: GameState,
  owner: PlayerId,
  kind: TargetKind | undefined,
  chosenInstanceId?: string | null,
): FieldMonster[] {
  const self = state.players[owner];
  const foe = state.players[other(owner)];

  switch (kind) {
    case 'chosen_monster':
    case 'chosen_enemy_monster':
    case 'chosen_ally_monster': {
      if (!chosenInstanceId) return [];
      const pools =
        kind === 'chosen_enemy_monster'
          ? foe.monsters
          : kind === 'chosen_ally_monster'
            ? self.monsters
            : [...self.monsters, ...foe.monsters];
      return pools.filter((m): m is FieldMonster => !!m && m.instanceId === chosenInstanceId);
    }
    case 'all_enemy_monsters':
      return foe.monsters.filter((m): m is FieldMonster => !!m);
    case 'all_ally_monsters':
      return self.monsters.filter((m): m is FieldMonster => !!m);
    default:
      return [];
  }
}

function findMonster(state: GameState, instanceId: string): { owner: PlayerId; zone: number; monster: FieldMonster } | null {
  for (const pid of ['p1', 'p2'] as PlayerId[]) {
    const zone = state.players[pid].monsters.findIndex((m) => m?.instanceId === instanceId);
    if (zone >= 0) {
      return { owner: pid, zone, monster: state.players[pid].monsters[zone]! };
    }
  }
  return null;
}

function destroyMonster(state: GameState, instanceId: string, log: string[]): void {
  const found = findMonster(state, instanceId);
  if (!found) return;
  const card = getCard(found.monster.cardId);
  state.players[found.owner].monsters[found.zone] = null;
  state.players[found.owner].graveyard.push(found.monster.cardId);
  log.push(`دُمّر ${card.nameAr}`);
}

function nextInstanceId(state: GameState, prefix: string): string {
  return `${prefix}_${state.turnNumber}_${Math.random().toString(36).slice(2, 8)}`;
}

export function applyOps(
  state: GameState,
  owner: PlayerId,
  ops: EffectOp[],
  chosenInstanceId?: string | null,
): void {
  const log = state.log;
  for (const op of ops) {
    switch (op.op) {
      case 'draw': {
        const count = op.count ?? 1;
        const who = op.target === 'opponent' ? other(owner) : owner;
        for (let i = 0; i < count; i++) {
          const p = state.players[who];
          if (!p.deck.length) {
            state.winner = other(who);
            log.push(`${who} لا يمكنه السحب وخسر`);
            return;
          }
          p.hand.push(p.deck.shift()!);
        }
        log.push(`${who === owner ? 'سحبت' : 'سحب الخصم'} ${count} ورقة`);
        break;
      }
      case 'damage': {
        const who = op.target === 'self' ? owner : other(owner);
        const amount = op.amount ?? 0;
        state.players[who].life = Math.max(0, state.players[who].life - amount);
        log.push(`ضرر ${amount} على ${who}`);
        if (state.players[who].life <= 0) state.winner = other(who);
        break;
      }
      case 'heal': {
        const who = op.target === 'opponent' ? other(owner) : owner;
        const amount = op.amount ?? 0;
        state.players[who].life += amount;
        log.push(`شفاء ${amount} لـ ${who}`);
        break;
      }
      case 'buff_stat': {
        const monsters = resolveMonsterTargets(state, owner, op.target ?? 'chosen_ally_monster', chosenInstanceId);
        for (const m of monsters) {
          if (op.stat === 'def') m.defBuff += op.amount ?? 0;
          else m.atkBuff += op.amount ?? 0;
        }
        if (monsters.length) log.push(`تعزيز إحصائيات (${op.stat ?? 'atk'} ${op.amount ?? 0})`);
        break;
      }
      case 'destroy_target': {
        if (op.target === 'all_enemy_monsters' || op.target === 'all_ally_monsters') {
          const monsters = resolveMonsterTargets(state, owner, op.target, chosenInstanceId);
          for (const m of monsters) destroyMonster(state, m.instanceId, log);
        } else if (chosenInstanceId) {
          destroyMonster(state, chosenInstanceId, log);
        }
        break;
      }
      case 'change_position': {
        const monsters = resolveMonsterTargets(
          state,
          owner,
          op.target ?? 'chosen_ally_monster',
          chosenInstanceId,
        );
        for (const m of monsters) {
          m.position = op.position ?? (m.position === 'attack' ? 'defense' : 'attack');
        }
        break;
      }
      case 'summon_token': {
        const tokenId = op.tokenId ?? 'aether_token';
        if (!tryGetCard(tokenId)) break;
        const zones = state.players[owner].monsters;
        const empty = zones.findIndex((z) => !z);
        if (empty < 0) break;
        zones[empty] = {
          instanceId: nextInstanceId(state, 'tok'),
          cardId: tokenId,
          position: 'attack',
          atkBuff: 0,
          defBuff: 0,
          canAttack: false,
          faceUp: true,
        };
        log.push(`استدعاء رمزي: ${getCard(tokenId).nameAr}`);
        break;
      }
    }
  }
}

export function runEffects(
  state: GameState,
  owner: PlayerId,
  cardId: string,
  trigger: CardEffect['trigger'],
  chosenInstanceId?: string | null,
): void {
  const card = getCard(cardId);
  const effects = (card.effects ?? []).filter((e) => e.trigger === trigger);
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]!;
    if (!conditionsMet(state, owner, effect.conditions)) continue;
    applyOps(state, owner, effect.ops, chosenInstanceId);
    if (state.winner) return;
  }
}

export function effectNeedsTarget(cardId: string, trigger: CardEffect['trigger']): boolean {
  const card = getCard(cardId);
  return (card.effects ?? [])
    .filter((e) => e.trigger === trigger)
    .some((e) => {
      if (e.requiresTarget) return true;
      return e.ops.some((op) =>
        ['chosen_monster', 'chosen_enemy_monster', 'chosen_ally_monster'].includes(op.target ?? ''),
      );
    });
}
