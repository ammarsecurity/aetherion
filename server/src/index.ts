import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { loadAllCards } from '@aetherion/cards';
import {
  applyAction,
  chooseAiAction,
  registerCards,
  allCards,
  type GameAction,
} from '@aetherion/game-core';
import './db.js';
import { parseBearer } from './auth.js';
import { authRouter } from './routes/auth.js';
import { decksRouter, getActiveDeckCards } from './routes/decks.js';
import { progressRouter } from './routes/progress.js';
import { RoomManager, type Room } from './rooms.js';

const cards = loadAllCards();
registerCards(cards);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, cards: cards.length, auth: true });
});

app.get('/api/cards', (_req, res) => {
  res.json(allCards().filter((c) => !c.tags?.includes('token')));
});

app.use('/api/auth', authRouter);
app.use('/api/decks', decksRouter);
app.use('/api/progress', progressRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const rooms = new RoomManager(cards);

function pushState(room: Room) {
  const views = rooms.views(room);
  if (room.sockets.p1 && views.p1) {
    io.to(room.sockets.p1).emit('state', views.p1);
  }
  if (room.sockets.p2 && views.p2) {
    io.to(room.sockets.p2).emit('state', views.p2);
  }
  if (room.state.winner) {
    io.to(room.code).emit('game_over', { winner: room.state.winner });
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** تأخيرات مرئية حتى يرى اللاعب كل خطوة للحاسبة */
function delayForAction(action: GameAction): { prePush: number; postPush: number } {
  switch (action.type) {
    case 'declare_attack':
      return { prePush: 520, postPush: 980 };
    case 'summon':
      return { prePush: 0, postPush: 1200 };
    case 'set_spell_trap':
      return { prePush: 0, postPush: 900 };
    case 'activate_spell':
    case 'activate_trap':
      return { prePush: 0, postPush: 1100 };
    case 'change_position':
      return { prePush: 0, postPush: 800 };
    case 'go_phase':
      return { prePush: 0, postPush: 700 };
    case 'end_turn':
      return { prePush: 0, postPush: 550 };
    default:
      return { prePush: 0, postPush: 850 };
  }
}

function emitOpponentAction(room: Room, action: GameAction, actor: string) {
  const payload = { action, actor, at: Date.now() };
  if (room.sockets.p1) io.to(room.sockets.p1).emit('opponent_action', payload);
  if (room.sockets.p2) io.to(room.sockets.p2).emit('opponent_action', payload);
}

/** دور الحاسبة خطوة بخطوة مع بث الحالة بعد كل فعل */
async function runAiSteps(room: Room) {
  if (!rooms.needsAi(room) || !room.aiPlayer) return;
  room.aiBusy = true;
  const aiId = room.aiPlayer;
  try {
    let steps = 0;
    while (!room.state.winner && room.state.turn === aiId && steps < 24) {
      const action = chooseAiAction(room.state, aiId);
      if (!action) break;

      try {
        applyAction(room.state, aiId, action);
      } catch {
        try {
          applyAction(room.state, aiId, { type: 'end_turn' });
        } catch {
          /* ignore */
        }
        rooms.maybeRecordProgress(room);
        pushState(room);
        break;
      }

      emitOpponentAction(room, action, aiId);
      const { prePush, postPush } = delayForAction(action);
      if (prePush > 0) await sleep(prePush);
      rooms.maybeRecordProgress(room);
      pushState(room);
      if (action.type === 'end_turn' || room.state.winner) break;
      if (postPush > 0) await sleep(postPush);
      steps += 1;
    }
  } finally {
    room.aiBusy = false;
  }
}

function userFromSocket(socket: { handshake: { auth?: Record<string, unknown> } }) {
  const token = socket.handshake.auth?.token;
  return parseBearer(typeof token === 'string' ? token : null);
}

function deckForUser(userId?: number) {
  if (!userId) return null;
  return getActiveDeckCards(userId);
}

io.on('connection', (socket) => {
  socket.emit(
    'cards',
    allCards().filter((c) => !c.tags?.includes('token')),
  );

  socket.on('auth', (payload: { token?: string }) => {
    const user = parseBearer(payload?.token ?? null);
    socket.data.user = user;
    socket.emit('auth_ok', { user });
  });

  // Prefer handshake auth; also allow late auth event
  socket.data.user = userFromSocket(socket);

  socket.on('create_ai', () => {
    try {
      const user = socket.data.user ?? userFromSocket(socket);
      const deck = deckForUser(user?.id);
      const room = rooms.createAiRoom(socket.id, user, deck);
      socket.join(room.code);
      socket.emit('joined', { code: room.code, you: 'p1', mode: 'ai' });
      pushState(room);
    } catch (e) {
      socket.emit('error_msg', { message: (e as Error).message });
    }
  });

  socket.on('create_pvp', () => {
    try {
      const user = socket.data.user ?? userFromSocket(socket);
      const deck = deckForUser(user?.id);
      const room = rooms.createPvpRoom(socket.id, user, deck);
      socket.join(room.code);
      socket.emit('joined', { code: room.code, you: 'p1', mode: 'pvp' });
      pushState(room);
    } catch (e) {
      socket.emit('error_msg', { message: (e as Error).message });
    }
  });

  socket.on('join_pvp', (payload: { code?: string }) => {
    try {
      const user = socket.data.user ?? userFromSocket(socket);
      const deck = deckForUser(user?.id);
      const room = rooms.joinPvpRoom(payload.code ?? '', socket.id, user, deck);
      socket.join(room.code);
      socket.emit('joined', { code: room.code, you: 'p2', mode: 'pvp' });
      pushState(room);
      if (room.sockets.p1) io.to(room.sockets.p1).emit('opponent_joined');
    } catch (e) {
      socket.emit('error_msg', { message: (e as Error).message });
    }
  });

  socket.on('rejoin', (payload: { code?: string; you?: 'p1' | 'p2' }) => {
    try {
      const user = socket.data.user ?? userFromSocket(socket);
      const you = payload.you;
      if (!payload.code || (you !== 'p1' && you !== 'p2')) {
        throw new Error('بيانات إعادة الانضمام غير مكتملة');
      }
      const room = rooms.rejoin(payload.code, socket.id, you, user);
      socket.join(room.code);
      socket.emit('joined', { code: room.code, you, mode: room.mode });
      // أرسل الحالة مباشرة لهذا السوكِت ثم ادفع للجميع (يتفادى سباق once)
      const views = rooms.views(room);
      const mine = you === 'p1' ? views.p1 : views.p2;
      if (mine) socket.emit('state', mine);
      pushState(room);
      const other = you === 'p1' ? room.sockets.p2 : room.sockets.p1;
      if (other) io.to(other).emit('opponent_joined');
    } catch (e) {
      socket.emit('error_msg', { message: (e as Error).message });
    }
  });

  socket.on('action', (payload: GameAction) => {
    try {
      const room = rooms.getBySocket(socket.id);
      if (!room) throw new Error('لست في غرفة');
      const pid = rooms.playerIdForSocket(room, socket.id);
      if (!pid) throw new Error('لاعب غير معروف');
      if (room.mode === 'pvp' && (!room.sockets.p1 || !room.sockets.p2)) {
        throw new Error('بانتظار الخصم');
      }
      rooms.apply(room, pid, payload);
      pushState(room);
      void runAiSteps(room);
    } catch (e) {
      socket.emit('error_msg', { message: (e as Error).message });
    }
  });

  socket.on('disconnect', () => {
    const room = rooms.leave(socket.id);
    if (room) {
      io.to(room.code).emit('error_msg', { message: 'انقطع اتصال لاعب' });
    }
  });
});

const PORT = Number(process.env.PORT ?? 8787);
httpServer.listen(PORT, () => {
  console.log(`Aetherion server on http://localhost:${PORT}`);
});
