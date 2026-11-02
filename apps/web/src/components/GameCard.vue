<script setup lang="ts">
import type { CardDef } from '../types';

defineProps<{
  card: CardDef;
  compact?: boolean;
  selected?: boolean;
}>();

defineEmits<{ click: [] }>();

const elementColor: Record<string, string> = {
  shadow: '#8b7cf8',
  light: '#f5d76e',
  flame: '#ff7a59',
  tide: '#4db7ff',
  stone: '#c2b59b',
  aether: '#2dd4bf',
};
</script>

<template>
  <article
    class="card"
    :class="{ compact, selected }"
    :style="{ '--el': elementColor[card.element || 'aether'] }"
    @click="$emit('click')"
  >
    <header>
      <span class="type">{{ card.type === 'monster' ? 'وحش' : card.type === 'spell' ? 'تعويذة' : 'فخ' }}</span>
      <span v-if="card.level" class="lvl">Lv {{ card.level }}</span>
    </header>
    <h3>{{ card.nameAr }}</h3>
    <p v-if="!compact" class="text">{{ card.textAr }}</p>
    <footer v-if="card.type === 'monster'">
      <span>هجوم {{ card.atk }}</span>
      <span>دفاع {{ card.def }}</span>
    </footer>
  </article>
</template>

<style scoped>
.card {
  aspect-ratio: 2.5 / 3.5;
  width: 140px;
  padding: 12px;
  border-radius: 14px;
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--el) 22%, #121a2b), #121a2b 55%),
    #121a2b;
  border: 1px solid color-mix(in srgb, var(--el) 45%, transparent);
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.card:hover {
  transform: translateY(-4px);
}

.card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim), var(--shadow);
}

.card.compact {
  width: 110px;
  padding: 10px;
}

header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
}

h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
  color: var(--gold);
}

.text {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  flex: 1;
}

footer {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}
</style>
