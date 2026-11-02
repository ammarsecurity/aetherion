export type CardType = 'monster' | 'spell' | 'trap';
export type ElementType = 'shadow' | 'light' | 'flame' | 'tide' | 'stone' | 'aether';
export type Position = 'attack' | 'defense';
export type Phase = 'draw' | 'main' | 'battle' | 'end';
export type PlayerId = 'p1' | 'p2';

export type EffectTrigger =
  | 'on_summon'
  | 'on_play'
  | 'on_activate'
  | 'on_destroy'
  | 'on_attack_declare'
  | 'start_turn'
  | 'end_turn';

export type TargetKind =
  | 'self'
  | 'opponent'
  | 'chosen_monster'
  | 'chosen_enemy_monster'
  | 'chosen_ally_monster'
  | 'all_enemy_monsters'
  | 'all_ally_monsters';

export interface EffectOp {
  op:
    | 'draw'
    | 'damage'
    | 'heal'
    | 'buff_stat'
    | 'destroy_target'
    | 'change_position'
    | 'summon_token';
  target?: TargetKind;
  count?: number;
  amount?: number;
  stat?: 'atk' | 'def';
  position?: Position;
  tokenId?: string;
}

export interface EffectCondition {
  op: 'if_control_tag';
  tag: string;
  min?: number;
  owner?: 'self' | 'opponent';
}

export interface CardEffect {
  trigger: EffectTrigger;
  conditions?: EffectCondition[];
  ops: EffectOp[];
  requiresTarget?: boolean;
}

export interface CardDef {
  id: string;
  nameAr: string;
  nameEn: string;
  type: CardType;
  element?: ElementType;
  level?: number;
  atk?: number;
  def?: number;
  tags?: string[];
  textAr: string;
  textEn?: string;
  effects?: CardEffect[];
}

export interface FieldMonster {
  instanceId: string;
  cardId: string;
  position: Position;
  atkBuff: number;
  defBuff: number;
  canAttack: boolean;
  faceUp: boolean;
}

export interface FieldSpellTrap {
  instanceId: string;
  cardId: string;
  faceUp: boolean;
  setThisTurn: boolean;
}

export interface PlayerState {
  id: PlayerId;
  life: number;
  deck: string[];
  hand: string[];
  graveyard: string[];
  monsters: Array<FieldMonster | null>;
  spellTraps: Array<FieldSpellTrap | null>;
  normalSummonUsed: boolean;
  hasDrawn: boolean;
}

export interface GameState {
  matchId: string;
  players: Record<PlayerId, PlayerState>;
  turn: PlayerId;
  phase: Phase;
  turnNumber: number;
  winner: PlayerId | null;
  log: string[];
  pendingTarget: PendingTarget | null;
}

export interface PendingTarget {
  playerId: PlayerId;
  sourceInstanceId?: string;
  sourceCardId: string;
  effectIndex: number;
  reason: 'effect' | 'attack' | 'summon_position';
}

export type GameAction =
  | { type: 'draw' }
  | { type: 'summon'; handIndex: number; zoneIndex: number; position: Position; faceUp?: boolean }
  | { type: 'set_spell_trap'; handIndex: number; zoneIndex: number }
  /** من اليد: handIndex مطلوب. من الساحة (مقلوبة): zoneIndex مطلوب فقط */
  | {
      type: 'activate_spell';
      handIndex?: number;
      zoneIndex?: number;
      targetInstanceId?: string;
    }
  | { type: 'activate_trap'; zoneIndex: number; targetInstanceId?: string }
  | { type: 'change_position'; zoneIndex: number }
  | { type: 'declare_attack'; attackerZone: number; targetZone: number | 'player' }
  | { type: 'go_phase'; phase: Phase }
  | { type: 'end_turn' }
  | { type: 'choose_target'; targetInstanceId: string | null };

export interface PublicPlayerView {
  id: PlayerId;
  life: number;
  deckCount: number;
  handCount: number;
  hand?: string[];
  graveyard: string[];
  monsters: Array<FieldMonster | null>;
  spellTraps: Array<FieldSpellTrap | null>;
  normalSummonUsed: boolean;
}

export interface PublicGameView {
  matchId: string;
  you: PlayerId;
  turn: PlayerId;
  phase: Phase;
  turnNumber: number;
  winner: PlayerId | null;
  log: string[];
  players: Record<PlayerId, PublicPlayerView>;
  pendingTarget: PendingTarget | null;
}
