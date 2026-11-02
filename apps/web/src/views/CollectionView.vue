<script setup lang="ts">
import { onMounted } from 'vue';
import { game } from '../socket';
import GameCard from '../components/GameCard.vue';

onMounted(async () => {
  if (!game.cards.length) await game.fetchCards();
});
</script>

<template>
  <section class="collection">
    <header>
      <div>
        <h1>المجموعة</h1>
        <p>{{ game.cards.length }} بطاقة أصلية</p>
      </div>
      <button class="ghost" @click="game.goHome()">رجوع</button>
    </header>
    <div class="grid">
      <GameCard v-for="card in game.cards" :key="card.id" :card="card" />
    </div>
  </section>
</template>

<style scoped>
.collection {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-3);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

h1 {
  margin: 0;
  color: var(--gold);
}

p {
  margin: 4px 0 0;
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  justify-items: center;
}
</style>
