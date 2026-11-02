<script setup lang="ts">
withDefaults(
  defineProps<{
    kind: 'monster' | 'spell';
    filled?: boolean;
    highlight?: boolean;
    defense?: boolean;
  }>(),
  { filled: false, highlight: false, defense: false },
);

defineEmits<{ click: [] }>();
</script>

<template>
  <button
    class="slot"
    type="button"
    :class="{ filled, highlight, defense, monster: kind === 'monster', spell: kind === 'spell' }"
    @click="$emit('click')"
  >
    <div class="frame">
      <slot />
      <span v-if="!$slots.default" class="icon" aria-hidden="true">
        {{ kind === 'monster' ? '⚔' : '✦' }}
      </span>
    </div>
  </button>
</template>

<style scoped>
.slot {
  /* هجوم: إطار بالطول */
  --slot-short: min(100%, 108px);
  width: var(--slot-short);
  aspect-ratio: var(--card-ratio);
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  justify-self: center;
  align-self: center;
  transition: width 0.18s ease, aspect-ratio 0.18s ease;
  position: relative;
  overflow: visible;
}

/* دفاع: إطار بالعرض — نفس مقاس الكارت (الضلع القصير ثابت) */
.slot.defense {
  width: calc(var(--slot-short) / (2.5 / 3.5));
  max-width: none;
  aspect-ratio: calc(3.5 / 2.5);
}

.frame {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  border: 2px dashed var(--duel-slot-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(120, 170, 230, 0.16)),
    var(--duel-slot);
  box-shadow: inset 0 0 18px rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
  position: relative;
  overflow: visible;
}

.filled .frame {
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.55);
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.defense .frame {
  border-radius: 10px;
}

.defense.filled .frame {
  border-color: rgba(90, 140, 220, 0.75);
}

.highlight .frame {
  border-color: var(--duel-cyan);
  box-shadow: 0 0 0 2px rgba(93, 228, 255, 0.35), 0 0 18px rgba(93, 228, 255, 0.35);
}

.icon {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 2px 8px rgba(30, 60, 120, 0.35);
}
</style>
