import type { CardDef } from './types.js';

const registry = new Map<string, CardDef>();

export function registerCards(cards: CardDef[]): void {
  for (const card of cards) {
    registry.set(card.id, card);
  }
}

export function clearCards(): void {
  registry.clear();
}

export function getCard(id: string): CardDef {
  const card = registry.get(id);
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}

export function tryGetCard(id: string): CardDef | undefined {
  return registry.get(id);
}

export function allCards(): CardDef[] {
  return [...registry.values()];
}

export function validateCardDef(card: CardDef): string[] {
  const errors: string[] = [];
  if (!card.id) errors.push('id required');
  if (!card.nameAr) errors.push(`${card.id}: nameAr required`);
  if (!card.type) errors.push(`${card.id}: type required`);
  if (!card.textAr) errors.push(`${card.id}: textAr required`);

  if (card.type === 'monster') {
    if (card.atk == null) errors.push(`${card.id}: atk required for monster`);
    if (card.def == null) errors.push(`${card.id}: def required for monster`);
    if (card.level == null) errors.push(`${card.id}: level required for monster`);
  }

  const allowedOps = new Set([
    'draw',
    'damage',
    'heal',
    'buff_stat',
    'destroy_target',
    'change_position',
    'summon_token',
  ]);

  for (const effect of card.effects ?? []) {
    for (const op of effect.ops) {
      if (!allowedOps.has(op.op)) {
        errors.push(`${card.id}: unknown op ${op.op}`);
      }
    }
  }

  return errors;
}

export function validateCardList(cards: CardDef[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.id)) errors.push(`duplicate id: ${card.id}`);
    seen.add(card.id);
    errors.push(...validateCardDef(card));
  }
  return errors;
}
