import {
  applyAction,
  buildDefaultDeck,
  createMatch,
  toPublicView,
  type CardDef,
  type GameAction,
  type GameState,
  type PlayerId,
} from '@aetherion/game-core';
import type { AuthUser } from './auth.js';
import { recordMatchResult } from './routes/progress.js';

export type RoomMode = 'ai' | 'pvp';

export interface Room {
  code: string;
  mode: RoomMode;
  state: GameState;
  sockets: Partial<Record<PlayerId, string>>;
  users: Partial<Record<PlayerId, AuthUser>>;
  decks: Partial<Record<PlayerId, string[]>>;
  aiPlayer?: PlayerId;
  /** يمنع تداخل خطوات الحاسبة أو أفعال اللاعب أثناء دورها */
  aiBusy: boolean;
  progressRecorded: boolean;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketRoom = new Map<string, string>();
  private cards: CardDef[];

  constructor(cards: CardDef[]) {
    this.cards = cards;
  }

  private code(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }

  private resolveDeck(deck?: string[] | null): string[] {
    if (deck && deck.length === 40) return [...deck];
    return buildDefaultDeck(this.cards);
  }

  createAiRoom(socketId: string, user?: AuthUser | null, deck?: string[] | null): Room {
    const playerDeck = this.resolveDeck(deck);
    const aiDeck = buildDefaultDeck(this.cards);
    const code = this.code();
    const state = createMatch(code, playerDeck, aiDeck);
    const room: Room = {
      code,
      mode: 'ai',
      state,
      sockets: { p1: socketId },
      users: user ? { p1: user } : {},
      decks: { p1: playerDeck, p2: aiDeck },
      aiPlayer: 'p2',
      aiBusy: false,
      progressRecorded: false,
    };
    this.rooms.set(code, room);
    this.socketRoom.set(socketId, code);
    return room;
  }

  createPvpRoom(socketId: string, user?: AuthUser | null, deck?: string[] | null): Room {
    const playerDeck = this.resolveDeck(deck);
    const placeholder = buildDefaultDeck(this.cards);
    const code = this.code();
    const state = createMatch(code, playerDeck, placeholder);
    const room: Room = {
      code,
      mode: 'pvp',
      state,
      sockets: { p1: socketId },
      users: user ? { p1: user } : {},
      decks: { p1: playerDeck },
      aiBusy: false,
      progressRecorded: false,
    };
    this.rooms.set(code, room);
    this.socketRoom.set(socketId, code);
    return room;
  }

  joinPvpRoom(
    code: string,
    socketId: string,
    user?: AuthUser | null,
    deck?: string[] | null,
  ): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('الغرفة غير موجودة');
    if (room.mode !== 'pvp') throw new Error('ليست غرفة لاعب ضد لاعب');
    if (room.sockets.p2) throw new Error('الغرفة ممتلئة');

    const p1Deck = room.decks.p1 ?? buildDefaultDeck(this.cards);
    const p2Deck = this.resolveDeck(deck);
    room.decks.p2 = p2Deck;
    room.state = createMatch(room.code, p1Deck, p2Deck);
    room.sockets.p2 = socketId;
    if (user) room.users.p2 = user;
    this.socketRoom.set(socketId, room.code);
    return room;
  }

  getBySocket(socketId: string): Room | undefined {
    const code = this.socketRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  playerIdForSocket(room: Room, socketId: string): PlayerId | null {
    if (room.sockets.p1 === socketId) return 'p1';
    if (room.sockets.p2 === socketId) return 'p2';
    return null;
  }

  apply(room: Room, actor: PlayerId, action: GameAction): void {
    if (room.aiBusy) throw new Error('انتظر — الخصم يلعب الآن');
    applyAction(room.state, actor, action);
    this.maybeRecordProgress(room);
  }

  /** هل حان دور الحاسبة بعد آخر تحديث؟ */
  needsAi(room: Room): boolean {
    return (
      room.mode === 'ai' &&
      !!room.aiPlayer &&
      !room.aiBusy &&
      !room.state.winner &&
      room.state.turn === room.aiPlayer
    );
  }

  maybeRecordProgress(room: Room): void {
    if (!room.state.winner || room.progressRecorded) return;
    room.progressRecorded = true;
    const winner = room.state.winner;
    for (const pid of ['p1', 'p2'] as PlayerId[]) {
      if (pid === room.aiPlayer) continue;
      const user = room.users[pid];
      if (!user) continue;
      recordMatchResult(user, pid === winner);
    }
  }

  views(room: Room) {
    return {
      p1: room.sockets.p1 ? toPublicView(room.state, 'p1') : null,
      p2: room.sockets.p2 ? toPublicView(room.state, 'p2') : null,
      spectator: toPublicView(room.state, 'p1'),
    };
  }

  leave(socketId: string): Room | undefined {
    const room = this.getBySocket(socketId);
    if (!room) return undefined;
    this.socketRoom.delete(socketId);
    if (room.sockets.p1 === socketId) delete room.sockets.p1;
    if (room.sockets.p2 === socketId) delete room.sockets.p2;
    if (!room.sockets.p1 && !room.sockets.p2) this.rooms.delete(room.code);
    return room;
  }

  /** إعادة ربط لاعب انقطع اتصاله دون إعادة إنشاء المباراة */
  rejoin(
    code: string,
    socketId: string,
    as: PlayerId,
    user?: AuthUser | null,
  ): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('الغرفة غير موجودة');
    if (as !== 'p1' && as !== 'p2') throw new Error('مقعد غير صالح');
    if (room.sockets[as] && room.sockets[as] !== socketId) {
      throw new Error('المقعد مشغول');
    }
    // إن كان نفس السوكِت في غرفة أخرى، حرّره
    const prev = this.socketRoom.get(socketId);
    if (prev && prev !== room.code) this.leave(socketId);

    room.sockets[as] = socketId;
    if (user) room.users[as] = user;
    this.socketRoom.set(socketId, room.code);
    return room;
  }
}
