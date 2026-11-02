import { Router } from 'express';
import { db } from '../db.js';
import {
  authRequired,
  ensureProgress,
  hashPassword,
  signToken,
  toPublicUser,
  verifyPassword,
  type AuthedRequest,
} from '../auth.js';

export const authRouter = Router();

authRouter.post('/register', (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const displayName = String(req.body?.displayName ?? username).trim() || username;

  if (!/^[a-zA-Z0-9_\u0600-\u06FF]{3,20}$/.test(username)) {
    res.status(400).json({ message: 'اسم المستخدم 3–20 حرفاً (عربي/إنجليزي/أرقام/_ )' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: 'كلمة المرور 6 أحرف على الأقل' });
    return;
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    res.status(409).json({ message: 'اسم المستخدم مستخدم مسبقاً' });
    return;
  }

  const info = db
    .prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)')
    .run(username, hashPassword(password), displayName);
  const userId = Number(info.lastInsertRowid);
  ensureProgress(userId);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as import('../db.js').UserRow;
  const user = toPublicUser(row);
  res.status(201).json({ token: signToken(user), user });
});

authRouter.post('/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | import('../db.js').UserRow
    | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    return;
  }
  ensureProgress(row.id);
  const user = toPublicUser(row);
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', authRequired, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as
    | import('../db.js').UserRow
    | undefined;
  if (!row) {
    res.status(404).json({ message: 'المستخدم غير موجود' });
    return;
  }
  ensureProgress(row.id);
  res.json({ user: toPublicUser(row) });
});
