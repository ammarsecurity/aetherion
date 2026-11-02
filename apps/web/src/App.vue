<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { game, gameRevision } from './socket';
import HomeView from './views/HomeView.vue';
import CollectionView from './views/CollectionView.vue';
import BattleView from './views/BattleView.vue';
import AuthView from './views/AuthView.vue';
import DecksView from './views/DecksView.vue';
import ProgressView from './views/ProgressView.vue';

/** Remount only non-battle screens (keeps duel FX alive across state updates). */
const menuTick = shallowRef(0);
let unsub: (() => void) | undefined;

const screen = computed(() => {
  void gameRevision.value;
  return game.screen;
});

onMounted(async () => {
  unsub = game.subscribe(() => {
    if (game.screen !== 'battle') menuTick.value++;
  });
  await game.boot();
});

onUnmounted(() => unsub?.());
</script>

<template>
  <main>
    <BattleView v-if="screen === 'battle'" />
    <template v-else>
      <div :key="menuTick">
        <HomeView v-if="screen === 'home'" />
        <AuthView v-else-if="screen === 'auth'" />
        <DecksView v-else-if="screen === 'decks'" />
        <ProgressView v-else-if="screen === 'progress'" />
        <CollectionView v-else-if="screen === 'collection'" />
      </div>
    </template>
  </main>
</template>
