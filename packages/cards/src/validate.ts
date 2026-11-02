import { validateCardList } from '@aetherion/game-core';
import { loadAllCards } from './index.js';

const cards = loadAllCards();
const errors = validateCardList(cards);

if (errors.length) {
  console.error('Card validation failed:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log(`OK: ${cards.length} cards validated`);
