export type CardType = 'monster' | 'spell' | 'trap';
export type Position = 'attack' | 'defense';
export type Phase = 'draw' | 'main' | 'battle' | 'end';
export type PlayerId = 'p1' | 'p2';

export interface CardDef {
  id: string;
  nameAr: string;
  nameEn: string;
  type: CardType;
  element?: string;
  level?: number;
  atk?: number;
  def?: number;
  tags?: string[];
  textAr: string;
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
}

export type GameAction =
  | { type: 'draw' }
  | { type: 'summon'; handIndex: number; zoneIndex: number; position: Position; faceUp?: boolean }
  | { type: 'set_spell_trap'; handIndex: number; zoneIndex: number }
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
  | { type: 'end_turn' };
