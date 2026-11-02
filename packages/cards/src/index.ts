import type { CardDef } from '@aetherion/game-core';
import set1 from '../data/set1.json' with { type: 'json' };

export const SET1_CARDS = set1 as CardDef[];

export function loadAllCards(): CardDef[] {
  return [...SET1_CARDS];
}
