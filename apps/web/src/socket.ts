import { shallowRef } from 'vue';
import { io, Socket } from 'socket.io-client';
import { api, getToken, setToken, SERVER_URL, type Deck, type Progress, type User } from './api';
import type { CardDef, GameAction, PublicGameView } from './types';

export type Screen = 'home' | 'collection' | 'battle' | 'auth' | 'decks' | 'progress';

/** Bumped on every game emit so Vue views can react without remounting. */
export const gameRevision = shallowRef(0);

class GameClient {
  socket: Socket | null = null;
  cards: CardDef[] = [];
  state: PublicGameView | null = null;
  screen: Screen = 'home';
  roomCode = '';
  mode: 'ai' | 'pvp' | null = null;
  you: 'p1' | 'p2' | null = null;
  error = '';
  message = '';
  user: User | null = null;
  progress: Progress | null = null;
  decks: Deck[] = [];
  listeners = new Set<() => void>();

  async boot() {
    const token = getToken();
    if (token) {
      try {
        const { user } = await api.me();
        this.user = user;
        await this.refreshAccountData();
      } catch {
        setToken(null);
        this.user = null;
      }
    }
    this.emit();
  }

  async refreshAccountData() {
    if (!getToken()) return;
    const [progress, decksRes] = await Promise.all([api.progress(), api.decks()]);
    this.progress = progress;
    this.decks = decksRes.decks;
    this.emit();
  }

  connect() {
    const token = getToken();
    if (this.socket) {
      if (token) this.socket.emit('auth', { token });
      return;
    }
    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 800,
    });
    this.socket.on('cards', (cards: CardDef[]) => {
      this.cards = cards;
      this.emit();
    });
    this.socket.on('joined', (payload: { code: string; you: 'p1' | 'p2'; mode: 'ai' | 'pvp' }) => {
      this.roomCode = payload.code;
      this.you = payload.you;
      this.mode = payload.mode;
      this.screen = 'battle';
      this.message = '';
      this.error = '';
      this.emit();
    });
    this.socket.on('state', (state: PublicGameView) => {
      this.state = state;
      this.error = '';
      this.emit();
    });
    this.socket.on('error_msg', (payload: { message: string }) => {
      this.error = payload.message;
      this.emit();
    });
    this.socket.on('game_over', async () => {
      this.message = '';
      this.emit();
      if (this.user) {
        try {
          await this.refreshAccountData();
        } catch {
          /* ignore */
        }
      }
    });
    this.socket.on('opponent_joined', () => {
      this.message = 'انضم الخصم — ابدأ اللعب';
      this.emit();
    });
    this.socket.on('connect', () => {
      // بعد انقطاع: أعد ربط المقعد دون إعادة إنشاء المباراة
      if (this.screen === 'battle' && this.roomCode && this.you) {
        this.socket?.emit('rejoin', { code: this.roomCode, you: this.you });
      }
    });
    this.socket.on('disconnect', (reason) => {
      if (this.screen === 'battle') {
        this.error = reason === 'io client disconnect' ? '' : 'انقطع الاتصال — جاري إعادة المحاولة…';
        this.emit();
      }
    });
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    gameRevision.value++;
    for (const fn of this.listeners) fn();
  }

  cardMap() {
    return Object.fromEntries(this.cards.map((c) => [c.id, c]));
  }

  async login(username: string, password: string) {
    const { token, user } = await api.login(username, password);
    setToken(token);
    this.user = user;
    await this.refreshAccountData();
    this.screen = 'home';
    this.connect();
    this.socket?.emit('auth', { token });
    this.emit();
  }

  async register(username: string, password: string, displayName?: string) {
    const { token, user } = await api.register(username, password, displayName);
    setToken(token);
    this.user = user;
    await this.refreshAccountData();
    this.screen = 'home';
    this.connect();
    this.socket?.emit('auth', { token });
    this.emit();
  }

  logout() {
    setToken(null);
    this.user = null;
    this.progress = null;
    this.decks = [];
    this.socket?.disconnect();
    this.socket = null;
    this.screen = 'home';
    this.emit();
  }

  createAi() {
    this.connect();
    this.socket?.emit('create_ai');
  }

  createPvp() {
    this.connect();
    this.socket?.emit('create_pvp');
  }

  joinPvp(code: string) {
    this.connect();
    this.socket?.emit('join_pvp', { code });
  }

  action(action: GameAction) {
    this.socket?.emit('action', action);
  }

  goHome() {
    this.screen = 'home';
    this.state = null;
    this.roomCode = '';
    this.you = null;
    this.mode = null;
    this.error = '';
    this.message = '';
    this.emit();
  }

  openCollection() {
    this.connect();
    this.screen = 'collection';
    this.emit();
  }

  openAuth() {
    this.screen = 'auth';
    this.emit();
  }

  openDecks() {
    this.screen = 'decks';
    this.emit();
  }

  openProgress() {
    this.screen = 'progress';
    this.emit();
  }

  async fetchCards() {
    this.cards = await api.cards();
    this.emit();
  }
}

export const game = new GameClient();
