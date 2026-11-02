import { Router } from 'express';
import { db, type ProgressRow } from '../db.js';
import { authRequired, ensureProgress, type AuthedRequest, type AuthUser } from '../auth.js';

export const progressRouter = Router();

function getProgress(userId: number) {
  ensureProgress(userId);
  return db.prepare('SELECT * FROM progress WHERE user_id = ?').get(userId) as ProgressRow;
}

progressRouter.get('/', authRequired, (req: AuthedRequest, res) => {
  const p = getProgress(req.user!.id);
  res.json({
    wins: p.wins,
    losses: p.losses,
    xp: p.xp,
    matchesPlayed: p.matches_played,
    updatedAt: p.updated_at,
  });
});

export function recordMatchResult(user: AuthUser | null | undefined, won: boolean): void {
  if (!user) return;
  ensureProgress(user.id);
  const xpGain = won ? 50 : 15;
  if (won) {
    db.prepare(
      `UPDATE progress
       SET wins = wins + 1,
           matches_played = matches_played + 1,
           xp = xp + ?,
           updated_at = datetime('now')
       WHERE user_id = ?`,
    ).run(xpGain, user.id);
  } else {
    db.prepare(
      `UPDATE progress
       SET losses = losses + 1,
           matches_played = matches_played + 1,
           xp = xp + ?,
           updated_at = datetime('now')
       WHERE user_id = ?`,
    ).run(xpGain, user.id);
  }
}
