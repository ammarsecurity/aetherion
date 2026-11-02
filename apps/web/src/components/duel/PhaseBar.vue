<script setup lang="ts">
import { computed } from 'vue';
import type { Phase } from '../../types';

const props = defineProps<{
  phase: Phase;
  yourTurn?: boolean;
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
  <div class="bar" :class="{ foe: yourTurn === false }">
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
  justify-content: stretch;
  width: 100%;
  pointer-events: none;
  direction: rtl;
}

.bar.foe {
  opacity: 0.72;
}

.steps {
  list-style: none;
  margin: 0;
  padding: 3px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3px;
  width: 100%;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.step {
  min-width: 0;
  padding: 7px 6px;
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
  overflow: hidden;
  text-overflow: ellipsis;
}

.step.done {
  background: linear-gradient(180deg, #8eb0dc, #5a84bf);
  color: rgba(255, 255, 255, 0.85);
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
  .step {
    padding: 6px 4px;
    font-size: 10px;
  }
}

@media (max-width: 420px) {
  .step {
    padding: 5px 2px;
    font-size: 9px;
  }
}
</style>
