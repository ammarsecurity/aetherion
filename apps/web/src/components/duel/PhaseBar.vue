<script setup lang="ts">
import { computed } from 'vue';
import type { Phase } from '../../types';

const props = defineProps<{
  phase: Phase;
  yourTurn: boolean;
}>();

const phases: { id: Phase; label: string }[] = [
  { id: 'draw', label: 'سحب' },
  { id: 'main', label: 'استدعاء' },
  { id: 'battle', label: 'قتال' },
  { id: 'end', label: 'نهاية' },
];

const phaseIndex = computed(() => phases.findIndex((p) => p.id === props.phase));
</script>

<template>
  <div class="bar" :class="{ foe: !yourTurn }">
    <div class="turn" :class="{ on: yourTurn }">
      <span>{{ yourTurn ? 'دورك' : 'دور الخصم' }}</span>
    </div>

    <ol class="steps" aria-label="مراحل الدور">
      <li
        v-for="(p, i) in phases"
        :key="p.id"
        class="step"
        :class="{
          active: phase === p.id,
          done: i < phaseIndex,
        }"
      >
        {{ p.label }}
      </li>
    </ol>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
  flex-wrap: wrap;
  direction: rtl;
}

.turn {
  flex: 0 0 auto;
  min-width: 76px;
  min-height: 36px;
  display: grid;
  place-items: center;
  padding: 6px 14px;
  color: #fff;
  font-weight: 900;
  font-size: 13px;
  white-space: nowrap;
  background: linear-gradient(180deg, #6eb0ff, #2f73e8 60%, #1f5fbf);
  clip-path: polygon(12% 0, 88% 0, 100% 50%, 88% 100%, 12% 100%, 0 50%);
  box-shadow:
    0 0 0 2px #f0c14b,
    0 6px 12px rgba(40, 100, 200, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  text-shadow: 0 1px 0 rgba(20, 50, 100, 0.3);
}

.turn.on {
  background: linear-gradient(180deg, #8ec8ff, #3d8dff 55%, #2468d4);
  box-shadow:
    0 0 0 2px #ffd56a,
    0 0 14px rgba(80, 170, 255, 0.5),
    0 6px 12px rgba(40, 100, 200, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.turn:not(.on) {
  background: linear-gradient(180deg, #9aadc4, #5d718c 60%, #44566f);
  box-shadow:
    0 0 0 2px #c5d0de,
    0 4px 10px rgba(40, 60, 90, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.steps {
  list-style: none;
  margin: 0;
  padding: 3px;
  display: flex;
  align-items: stretch;
  gap: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(220, 235, 255, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow:
    0 6px 14px rgba(40, 90, 160, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.step {
  flex: 0 0 auto;
  min-width: 58px;
  padding: 7px 12px;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
  line-height: 1.2;
  background: linear-gradient(180deg, #5b94e2, #2f67c8);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  text-shadow: 0 1px 0 rgba(15, 40, 90, 0.25);
}

.step.done {
  background: linear-gradient(180deg, #8eb0dc, #5a84bf);
  color: rgba(255, 255, 255, 0.8);
}

.step.active {
  color: #fff;
  background: linear-gradient(180deg, #a6dbff, #4ea2ff 50%, #2f73e8);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.65),
    0 3px 10px rgba(60, 150, 255, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

@media (max-width: 700px) {
  .bar {
    gap: 6px;
  }

  .step {
    min-width: 46px;
    padding: 6px 9px;
    font-size: 10px;
  }

  .turn {
    min-width: 64px;
    min-height: 32px;
    padding: 5px 12px;
    font-size: 11px;
  }
}

@media (max-width: 420px) {
  .step {
    min-width: 40px;
    padding: 5px 7px;
    font-size: 9px;
  }

  .turn {
    font-size: 10px;
    padding: 4px 10px;
  }
}
</style>
