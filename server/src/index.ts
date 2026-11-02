import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { loadAllCards } from '@aetherion/cards';
import { registerCards, allCards, type GameAction } from '@aetherion/game-core';
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
