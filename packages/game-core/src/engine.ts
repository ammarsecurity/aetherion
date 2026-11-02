import { getCard } from './cards.js';
import { effectNeedsTarget, runEffects } from './effects.js';
import type {
  CardDef,
  GameAction,
  GameState,
  Phase,
  PlayerId,
  PlayerState,
  Position,
  PublicGameView,
} from './types.js';

const ZONE_COUNT = 3;
const START_LIFE = 8000;
const START_HAND = 5;

function other(id: PlayerId): PlayerId {
  return id === 'p1' ? 'p2' : 'p1';
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function emptyZones<T>(): Array<T | null> {
  return Array.from({ length: ZONE_COUNT }, () => null);
}

function createPlayer(id: PlayerId, deck: string[], rng?: () => number): PlayerState {
  const shuffled = shuffle(deck, rng);
  return {
    id,
    life: START_LIFE,
    deck: shuffled.slice(START_HAND),
    hand: shuffled.slice(0, START_HAND),
    graveyard: [],
    monsters: emptyZones(),
    spellTraps: emptyZones(),
    normalSummonUsed: false,
    hasDrawn: true,
  };
}

export function createMatch(
  matchId: string,
  deckP1: string[],
  deckP2: string[],
  rng?: () => number,
): GameState {
  return {
    matchId,
    players: {
      p1: createPlayer('p1', deckP1, rng),
      p2: createPlayer('p2', deckP2, rng),
    },
    turn: 'p1',
    phase: 'main',
    turnNumber: 1,
    winner: null,
    log: ['بدأت المباراة — دور اللاعب 1'],
    pendingTarget: null,
  };
}

export function monsterAtk(m: { cardId: string; atkBuff: number }): number {
  return (getCard(m.cardId).atk ?? 0) + m.atkBuff;
}

export function monsterDef(m: { cardId: string; defBuff: number }): number {
  return (getCard(m.cardId).def ?? 0) + m.defBuff;
}

function drawOne(state: GameState, pid: PlayerId): void {
  const p = state.players[pid];
  if (!p.deck.length) {
    state.winner = other(pid);
    state.log.push(`${pid} نفدت أوراقه وخسر`);
    return;
  }
  p.hand.push(p.deck.shift()!);
}

function ensureTurn(state: GameState, actor: PlayerId): void {
  if (state.winner) throw new Error('انتهت المباراة');
  if (state.turn !== actor) throw new Error('ليس دورك');
}

function nextInstanceId(state: GameState, prefix: string): string {
  return `${prefix}_${state.turnNumber}_${Math.random().toString(36).slice(2, 8)}`;
}

function clearResolvedSpellsAndTraps(state: GameState, pid: PlayerId): void {
  const p = state.players[pid];
  for (let i = 0; i < p.spellTraps.length; i++) {
    const st = p.spellTraps[i];
    if (!st || !st.faceUp) continue;
    const card = getCard(st.cardId);
    if (card.tags?.includes('continuous')) continue;
    if (card.type === 'spell' || card.type === 'trap') {
      p.spellTraps[i] = null;
      p.graveyard.push(st.cardId);
      state.log.push(`${card.nameAr} غادرت الساحة`);
    }
  }
}

function beginTurn(state: GameState, pid: PlayerId): void {
  const p = state.players[pid];
  p.normalSummonUsed = false;
  p.hasDrawn = false;
  for (const m of p.monsters) {
    if (m) m.canAttack = true;
  }
  for (const s of p.spellTraps) {
    if (s) s.setThisTurn = false;
  }
  state.phase = 'draw';
  drawOne(state, pid);
  p.hasDrawn = true;
  state.phase = 'main';
  state.log.push(`دور ${pid} — سحب ورقة`);
}

export function applyAction(state: GameState, actor: PlayerId, action: GameAction): GameState {
  if (state.winner) return state;

  switch (action.type) {
    case 'draw': {
      ensureTurn(state, actor);
      if (state.phase !== 'draw') throw new Error('ليس وقت السحب');
      if (state.players[actor].hasDrawn) throw new Error('تم السحب مسبقاً');
      drawOne(state, actor);
      state.players[actor].hasDrawn = true;
      state.phase = 'main';
      break;
    }
    case 'summon': {
      ensureTurn(state, actor);
      if (state.phase !== 'main') throw new Error('الاستدعاء في المرحلة الرئيسية فقط');
      const p = state.players[actor];
      if (p.normalSummonUsed) throw new Error('تم الاستدعاء العادي لهذا الدور');
      const cardId = p.hand[action.handIndex];
      if (!cardId) throw new Error('ورقة غير موجودة في اليد');
      const card = getCard(cardId);
      if (card.type !== 'monster') throw new Error('ليست وحشاً');
      if (action.zoneIndex < 0 || action.zoneIndex >= ZONE_COUNT) throw new Error('منطقة غير صالحة');
      if (p.monsters[action.zoneIndex]) throw new Error('المنطقة مشغولة');
      p.hand.splice(action.handIndex, 1);
      // هجوم دائماً مكشوف؛ دفاع: faceUp true = مكشوف، false/غير ممرَّر = مقلوب
      const resolvedFaceUp =
        action.position === 'attack'
          ? true
          : typeof action.faceUp === 'boolean'
            ? action.faceUp
            : false;
      const monster = {
        instanceId: nextInstanceId(state, 'm'),
        cardId,
        position: action.position,
        atkBuff: 0,
        defBuff: 0,
        canAttack: false,
        faceUp: resolvedFaceUp,
      };
      p.monsters[action.zoneIndex] = monster;
      p.normalSummonUsed = true;
      if (action.position === 'attack') {
        state.log.push(`${actor} استدعى ${card.nameAr}`);
      } else if (resolvedFaceUp) {
        state.log.push(`${actor} استدعى ${card.nameAr} في دفاع مكشوف`);
      } else {
        state.log.push(`${actor} عيّن وحشاً في دفاع مقلوب`);
      }
      // المقلوب لا يفعّل تأثيرات الاستدعاء
      if (resolvedFaceUp) {
        if (effectNeedsTarget(cardId, 'on_summon')) {
          // auto-run without target if possible; otherwise skip targeting UX for MVP simple effects
        }
        runEffects(state, actor, cardId, 'on_summon');
      }
      break;
    }
    case 'set_spell_trap': {
      ensureTurn(state, actor);
      if (state.phase !== 'main') throw new Error('التعيين في المرحلة الرئيسية فقط');
      const p = state.players[actor];
      const cardId = p.hand[action.handIndex];
      if (!cardId) throw new Error('ورقة غير موجودة');
      const card = getCard(cardId);
      if (card.type !== 'spell' && card.type !== 'trap') throw new Error('ليست تعويذة/فخ');
      if (p.spellTraps[action.zoneIndex]) throw new Error('المنطقة مشغولة');
      p.hand.splice(action.handIndex, 1);
      p.spellTraps[action.zoneIndex] = {
        instanceId: nextInstanceId(state, 'st'),
        cardId,
        faceUp: false,
        setThisTurn: true,
      };
      state.log.push(`${actor} عيّن ورقة`);
      break;
    }
    case 'activate_spell': {
      ensureTurn(state, actor);
      if (state.phase !== 'main' && state.phase !== 'battle') {
        throw new Error('لا يمكن تفعيل التعويذة الآن');
      }
      const p = state.players[actor];

      // تفعيل تعويذة مقلوبة على الساحة
      if (action.handIndex == null && action.zoneIndex != null) {
        const st = p.spellTraps[action.zoneIndex];
        if (!st) throw new Error('لا توجد ورقة في الخانة');
        if (st.faceUp) throw new Error('التعويذة مفعّلة مسبقاً');
        const card = getCard(st.cardId);
        if (card.type !== 'spell') throw new Error('ليست تعويذة');
        // السريعة لا تُفعَّل بنفس دور التعيين
        if (card.tags?.includes('quick') && st.setThisTurn) {
          throw new Error('التعويذة السريعة لا تُفعَّل في نفس دور التعيين');
        }
        // العادية/المستمرة: تفعيل في الرئيسية فقط من الساحة
        if (!card.tags?.includes('quick') && state.phase !== 'main') {
          throw new Error('تفعيل هذه التعويذة في المرحلة الرئيسية فقط');
        }
        st.faceUp = true;
        st.setThisTurn = false;
        state.log.push(`${actor} فعّل ${card.nameAr}`);
        runEffects(state, actor, st.cardId, 'on_play', action.targetInstanceId);
        runEffects(state, actor, st.cardId, 'on_activate', action.targetInstanceId);
        clearResolvedSpellsAndTraps(state, actor);
        break;
      }

      // تفعيل من اليد → تظهر مكشوفة فوراً
      if (state.phase !== 'main') throw new Error('تفعيل التعاويذ من اليد في الرئيسية');
      if (action.handIndex == null) throw new Error('ورقة غير موجودة');
      const cardId = p.hand[action.handIndex];
      if (!cardId) throw new Error('ورقة غير موجودة');
      const card = getCard(cardId);
      if (card.type !== 'spell') throw new Error('ليست تعويذة');

      let zone =
        action.zoneIndex != null && !p.spellTraps[action.zoneIndex]
          ? action.zoneIndex
          : p.spellTraps.findIndex((z) => !z);
      if (zone < 0) throw new Error('لا توجد خانة تعويذة فارغة');

      p.hand.splice(action.handIndex, 1);
      p.spellTraps[zone] = {
        instanceId: nextInstanceId(state, 'st'),
        cardId,
        faceUp: true,
        setThisTurn: false,
      };
      state.log.push(`${actor} فعّل ${card.nameAr}`);
      runEffects(state, actor, cardId, 'on_play', action.targetInstanceId);
      runEffects(state, actor, cardId, 'on_activate', action.targetInstanceId);
      clearResolvedSpellsAndTraps(state, actor);
      break;
    }
    case 'activate_trap': {
      const p = state.players[actor];
      const st = p.spellTraps[action.zoneIndex];
      if (!st) throw new Error('لا يوجد فخ');
      const card = getCard(st.cardId);
      if (card.type !== 'trap') throw new Error('ليست فخاً');
      if (st.faceUp) throw new Error('الفخ مفعّل مسبقاً');
      if (st.setThisTurn) throw new Error('لا يمكن تفعيل فخ في نفس دور التعيين');
      st.faceUp = true;
      state.log.push(`${actor} فعّل الفخ ${card.nameAr}`);
      runEffects(state, actor, st.cardId, 'on_activate', action.targetInstanceId);
      clearResolvedSpellsAndTraps(state, actor);
      break;
    }
    case 'change_position': {
      ensureTurn(state, actor);
      if (state.phase !== 'main') throw new Error('تغيير الوضعية في الرئيسية');
      const m = state.players[actor].monsters[action.zoneIndex];
      if (!m) throw new Error('لا يوجد وحش');
      if (!m.faceUp) {
        // قلب من دفاع مقلوب → هجوم مكشوف
        m.faceUp = true;
        m.position = 'attack';
        state.log.push(`${actor} قلب ${getCard(m.cardId).nameAr} إلى هجوم`);
      } else if (m.position === 'attack') {
        m.position = 'defense';
        state.log.push(`${actor} غيّر ${getCard(m.cardId).nameAr} إلى دفاع مكشوف`);
      } else {
        m.position = 'attack';
        state.log.push(`${actor} غيّر ${getCard(m.cardId).nameAr} إلى هجوم`);
      }
      break;
    }
    case 'declare_attack': {
      ensureTurn(state, actor);
      if (state.phase !== 'battle' && state.phase !== 'main') {
        // allow going to battle implicitly
      }
      if (state.phase === 'main') state.phase = 'battle';
      if (state.phase !== 'battle') throw new Error('ليس وقت القتال');
      const attacker = state.players[actor].monsters[action.attackerZone];
      if (!attacker || attacker.position !== 'attack') throw new Error('المهاجم غير صالح');
      if (!attacker.canAttack) throw new Error('لا يمكن لهذا الوحش الهجوم');
      attacker.canAttack = false;
      const atk = monsterAtk(attacker);
      const foe = state.players[other(actor)];

      if (action.targetZone === 'player') {
        if (foe.monsters.some((m) => m)) throw new Error('يوجد وحوش للخصم');
        foe.life = Math.max(0, foe.life - atk);
        state.log.push(`هجوم مباشر بـ ${atk}`);
        if (foe.life <= 0) state.winner = actor;
        break;
      }

      const defender = foe.monsters[action.targetZone];
      if (!defender) throw new Error('الهدف غير موجود');
      // كشف الوحش المقلوب عند الهجوم عليه
      if (!defender.faceUp) {
        defender.faceUp = true;
        state.log.push(`انكشف ${getCard(defender.cardId).nameAr}`);
      }
      const defVal =
        defender.position === 'defense' ? monsterDef(defender) : monsterAtk(defender);

      if (defender.position === 'attack') {
        if (atk > defVal) {
          foe.life = Math.max(0, foe.life - (atk - defVal));
          foe.monsters[action.targetZone] = null;
          foe.graveyard.push(defender.cardId);
          state.log.push(`دُمّر ${getCard(defender.cardId).nameAr}`);
          if (foe.life <= 0) state.winner = actor;
        } else if (atk < defVal) {
          state.players[actor].life = Math.max(0, state.players[actor].life - (defVal - atk));
          state.players[actor].monsters[action.attackerZone] = null;
          state.players[actor].graveyard.push(attacker.cardId);
          state.log.push(`دُمّر المهاجم ${getCard(attacker.cardId).nameAr}`);
          if (state.players[actor].life <= 0) state.winner = other(actor);
        } else {
          foe.monsters[action.targetZone] = null;
          foe.graveyard.push(defender.cardId);
          state.players[actor].monsters[action.attackerZone] = null;
          state.players[actor].graveyard.push(attacker.cardId);
          state.log.push('تدمير متبادل');
        }
      } else {
        if (atk > defVal) {
          foe.monsters[action.targetZone] = null;
          foe.graveyard.push(defender.cardId);
          state.log.push(`دُمّر ${getCard(defender.cardId).nameAr} (دفاع)`);
        } else if (atk < defVal) {
          state.players[actor].life = Math.max(
            0,
            state.players[actor].life - (defVal - atk),
          );
          state.log.push(`ارتداد دفاعي ${defVal - atk}`);
          if (state.players[actor].life <= 0) state.winner = other(actor);
        } else {
          state.log.push('الهجوم صُدّ');
        }
      }
      break;
    }
    case 'go_phase': {
      ensureTurn(state, actor);
      const order: Phase[] = ['draw', 'main', 'battle', 'end'];
      const cur = order.indexOf(state.phase);
      const next = order.indexOf(action.phase);
      if (next < cur) throw new Error('لا يمكن الرجوع لمرحلة سابقة');
      state.phase = action.phase;
      state.log.push(`المرحلة: ${action.phase}`);
      if (action.phase === 'end') {
        applyAction(state, actor, { type: 'end_turn' });
      }
      break;
    }
    case 'end_turn': {
      ensureTurn(state, actor);
      state.phase = 'end';
      clearResolvedSpellsAndTraps(state, actor);
      const next = other(actor);
      state.turn = next;
      state.turnNumber += 1;
      beginTurn(state, next);
      break;
    }
    case 'choose_target': {
      // reserved for future targeting UX
      break;
    }
  }

  return state;
}

export function toPublicView(state: GameState, you: PlayerId): PublicGameView {
  const mapPlayer = (pid: PlayerId) => {
    const p = state.players[pid];
    return {
      id: pid,
      life: p.life,
      deckCount: p.deck.length,
      handCount: p.hand.length,
      hand: pid === you ? [...p.hand] : undefined,
      graveyard: [...p.graveyard],
      monsters: p.monsters.map((m) => {
        if (!m) return null;
        if (pid === you || m.faceUp) return { ...m };
        return {
          ...m,
          cardId: 'hidden',
        };
      }),
      spellTraps: p.spellTraps.map((s) => {
        if (!s) return null;
        if (pid === you || s.faceUp) return { ...s };
        return {
          ...s,
          cardId: 'hidden',
        };
      }),
      normalSummonUsed: p.normalSummonUsed,
    };
  };

  return {
    matchId: state.matchId,
    you,
    turn: state.turn,
    phase: state.phase,
    turnNumber: state.turnNumber,
    winner: state.winner,
    log: state.log.slice(-12),
    players: {
      p1: mapPlayer('p1'),
      p2: mapPlayer('p2'),
    },
    pendingTarget: state.pendingTarget,
  };
}

export function buildDefaultDeck(cards: CardDef[]): string[] {
  const monsters = cards.filter((c) => c.type === 'monster' && !c.tags?.includes('token'));
  const spells = cards.filter((c) => c.type === 'spell');
  const traps = cards.filter((c) => c.type === 'trap');
  const deck: string[] = [];

  for (const c of monsters.slice(0, 14)) {
    deck.push(c.id, c.id);
  }
  while (deck.length < 28 && monsters.length) {
    deck.push(monsters[deck.length % monsters.length]!.id);
  }
  for (const c of spells.slice(0, 6)) deck.push(c.id, c.id);
  for (const c of traps.slice(0, 4)) deck.push(c.id);

  while (deck.length < 40) {
    const pool = monsters.length ? monsters : cards;
    deck.push(pool[deck.length % pool.length]!.id);
  }
  return deck.slice(0, 40);
}

/** Validate a 40-card deck: known cards, no tokens, max 3 copies each. */
export function validateDeck(cardIds: string[], known: CardDef[]): string[] {
  const errors: string[] = [];
  const byId = new Map(known.map((c) => [c.id, c]));
  if (cardIds.length !== 40) errors.push('المجموعة يجب أن تكون 40 ورقة');

  const counts = new Map<string, number>();
  for (const id of cardIds) {
    const card = byId.get(id);
    if (!card) {
      errors.push(`بطاقة غير معروفة: ${id}`);
      continue;
    }
    if (card.tags?.includes('token')) errors.push(`لا يمكن إضافة رموز: ${id}`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > 3) errors.push(`أكثر من 3 نسخ من ${id}`);
  }
  return errors;
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}
