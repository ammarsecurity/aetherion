import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { db, type UserRow } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aetherion-dev-secret-change-me';
const TOKEN_TTL = '30d';

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
};

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, username: user.username, displayName: user.displayName },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, JWT_SECRET) as {
    sub: number;
    username: string;
    displayName: string;
  };
  return {
    id: Number(payload.sub),
    username: payload.username,
    displayName: payload.displayName,
  };
}

export function toPublicUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
  };
}

export function ensureProgress(userId: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO progress (user_id, wins, losses, xp, matches_played)
     VALUES (?, 0, 0, 0, 0)`,
  ).run(userId);
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'يلزم تسجيل الدخول' });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ message: 'جلسة غير صالحة' });
  }
}

export function authOptional(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      /* ignore */
    }
  }
  next();
}

export function parseBearer(token?: string | null): AuthUser | null {
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
