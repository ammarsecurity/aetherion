import { Router } from 'express';
import { allCards, validateDeck } from '@aetherion/game-core';
import { db, type DeckRow } from '../db.js';
import { authRequired, type AuthedRequest } from '../auth.js';

export const decksRouter = Router();

function parseDeck(row: DeckRow) {
  return {
    id: row.id,
    name: row.name,
    cardIds: JSON.parse(row.card_ids) as string[],
    isActive: !!row.is_active,
    updatedAt: row.updated_at,
  };
}

decksRouter.get('/', authRequired, (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM decks WHERE user_id = ? ORDER BY is_active DESC, updated_at DESC')
    .all(req.user!.id) as DeckRow[];
  res.json({ decks: rows.map(parseDeck) });
});

decksRouter.post('/', authRequired, (req: AuthedRequest, res) => {
  const name = String(req.body?.name ?? 'مجموعتي').trim() || 'مجموعتي';
  const cardIds = req.body?.cardIds as string[] | undefined;
  if (!Array.isArray(cardIds)) {
    res.status(400).json({ message: 'cardIds مطلوبة' });
    return;
  }
  const errors = validateDeck(cardIds, allCards());
  if (errors.length) {
    res.status(400).json({ message: errors[0], errors });
    return;
  }

  const count = (
    db.prepare('SELECT COUNT(*) as c FROM decks WHERE user_id = ?').get(req.user!.id) as { c: number }
  ).c;
  const makeActive = count === 0 || !!req.body?.isActive;

  if (makeActive) {
    db.prepare('UPDATE decks SET is_active = 0 WHERE user_id = ?').run(req.user!.id);
  }

  const info = db
    .prepare(
      `INSERT INTO decks (user_id, name, card_ids, is_active, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .run(req.user!.id, name, JSON.stringify(cardIds), makeActive ? 1 : 0);

  const row = db.prepare('SELECT * FROM decks WHERE id = ?').get(Number(info.lastInsertRowid)) as DeckRow;
  res.status(201).json({ deck: parseDeck(row) });
});

decksRouter.put('/:id', authRequired, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?').get(id, req.user!.id) as
    | DeckRow
    | undefined;
  if (!existing) {
    res.status(404).json({ message: 'المجموعة غير موجودة' });
    return;
  }

  const name = req.body?.name != null ? String(req.body.name).trim() || existing.name : existing.name;
  const cardIds = (req.body?.cardIds as string[] | undefined) ?? (JSON.parse(existing.card_ids) as string[]);
  const errors = validateDeck(cardIds, allCards());
  if (errors.length) {
    res.status(400).json({ message: errors[0], errors });
    return;
  }

  if (req.body?.isActive) {
    db.prepare('UPDATE decks SET is_active = 0 WHERE user_id = ?').run(req.user!.id);
  }

  db.prepare(
    `UPDATE decks SET name = ?, card_ids = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`,
  ).run(
    name,
    JSON.stringify(cardIds),
    req.body?.isActive ? 1 : existing.is_active,
    id,
    req.user!.id,
  );

  const row = db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as DeckRow;
  res.json({ deck: parseDeck(row) });
});

decksRouter.post('/:id/activate', authRequired, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?').get(id, req.user!.id) as
    | DeckRow
    | undefined;
  if (!existing) {
    res.status(404).json({ message: 'المجموعة غير موجودة' });
    return;
  }
  db.prepare('UPDATE decks SET is_active = 0 WHERE user_id = ?').run(req.user!.id);
  db.prepare(`UPDATE decks SET is_active = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
  const row = db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as DeckRow;
  res.json({ deck: parseDeck(row) });
});

decksRouter.delete('/:id', authRequired, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?').run(id, req.user!.id);
  if (!info.changes) {
    res.status(404).json({ message: 'المجموعة غير موجودة' });
    return;
  }
  res.json({ ok: true });
});

export function getActiveDeckCards(userId: number): string[] | null {
  const row = db
    .prepare('SELECT * FROM decks WHERE user_id = ? AND is_active = 1 LIMIT 1')
    .get(userId) as DeckRow | undefined;
  if (!row) return null;
  return JSON.parse(row.card_ids) as string[];
}
