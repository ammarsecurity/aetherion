<script setup lang="ts">
import { computed } from 'vue';
import type { CardDef } from '../../types';

const props = withDefaults(
  defineProps<{
    card?: CardDef | null;
    faceDown?: boolean;
    /** معيَّن مقلوب لكن صاحبه يشوف الوجه */
    setHidden?: boolean;
    compact?: boolean;
    selected?: boolean;
    summoning?: boolean;
    hit?: boolean;
    atk?: number;
    def?: number;
    position?: 'attack' | 'defense';
  }>(),
  {
    faceDown: false,
    setHidden: false,
    compact: false,
    selected: false,
    summoning: false,
    hit: false,
  },
);

defineEmits<{ click: [] }>();

const elementLabel: Record<string, string> = {
  shadow: 'ظل',
  light: 'نور',
  flame: 'لهب',
  tide: 'مد',
  stone: 'صخر',
  aether: 'أثير',
};

const elementHue: Record<string, string> = {
  shadow: '#6b5cff',
  light: '#f0c84a',
  flame: '#ff6b4a',
  tide: '#3aa0ff',
  stone: '#a89b7e',
  aether: '#5de4ff',
};

const artGradient = computed(() => {
  const el = props.card?.element || 'aether';
  const hue = elementHue[el] || '#5de4ff';
  return `linear-gradient(160deg, ${hue}55, #d9e8ff 45%, #8eb6e8)`;
});

const stars = computed(() => '★'.repeat(Math.min(props.card?.level ?? 0, 8)));
</script>

<template>
  <article
    class="face"
    :class="{
      compact,
      selected,
      'duel-summoning': summoning,
      'duel-hit': hit,
      spell: card?.type === 'spell',
      trap: card?.type === 'trap',
      defense: position === 'defense',
      down: faceDown,
      'set-hidden': setHidden && !faceDown,
    }"
    @click="$emit('click')"
  >
    <template v-if="faceDown || !card">
      <img class="back" src="/duel/card-back.jpg" alt="" />
    </template>
    <template v-else>
      <span v-if="setHidden" class="set-tag" aria-label="معيّنة">معيّنة</span>
      <header>
        <span class="name">{{ card.nameAr }}</span>
        <span class="attr" :style="{ background: elementHue[card.element || 'aether'] }">
          <span class="attr-full">{{ elementLabel[card.element || 'aether'] || '•' }}</span>
          <span class="attr-mini" aria-hidden="true">{{
            (elementLabel[card.element || 'aether'] || '•').slice(0, 1)
          }}</span>
        </span>
      </header>
      <div v-if="card.type === 'monster'" class="stars">
        <span class="stars-full">{{ stars }}</span>
        <span class="stars-mini" aria-hidden="true">Lv{{ card.level ?? 0 }}</span>
      </div>
      <div v-else class="kind">{{ card.type === 'spell' ? 'تعويذة' : 'فخ' }}</div>
      <div class="art" :style="{ background: artGradient }">
        <span class="glyph">{{ (card.nameAr || '?').slice(0, 1) }}</span>
      </div>
      <p class="text">{{ card.textAr }}</p>
      <footer v-if="card.type === 'monster'">
        <span class="stat">
          <em>ATK</em>
          {{ atk ?? card.atk ?? 0 }}
        </span>
        <span class="stat">
          <em>DEF</em>
          {{ def ?? card.def ?? 0 }}
        </span>
      </footer>
      <div v-else class="kind-foot">{{ card.type === 'spell' ? 'تعويذة' : 'فخ' }}</div>
    </template>
  </article>
</template>

<style scoped>
.face {
  position: relative;
  container-type: inline-size;
  aspect-ratio: var(--card-ratio);
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #f7fbff, #e7eef8);
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: var(--duel-shadow);
  color: var(--duel-ink);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  transform-style: preserve-3d;
}

.face:hover:not(.compact) {
  transform: translateY(-3px);
}

.face.selected {
  outline: 3px solid var(--duel-cyan);
  box-shadow: 0 0 0 3px rgba(93, 228, 255, 0.35), var(--duel-shadow);
}

/*
  دفاع: الإطار صار بالعرض؛ الكارت بنفس الحجم يُدار 90° بدون تصغير.
  عرض الكارت = ارتفاع الإطار، ارتفاعه = عرض الإطار.
*/
.face.defense {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(100% * (2.5 / 3.5));
  height: calc(100% / (2.5 / 3.5));
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center center;
  z-index: 1;
}

.face.defense:hover:not(.compact) {
  transform: translate(-50%, -50%) rotate(90deg) translateY(-2px);
}

.face.defense.selected {
  transform: translate(-50%, -50%) rotate(90deg);
}

.face.defense.duel-summoning {
  animation: duel-summon-rise-defense 0.85s ease-out;
}

.face.defense.duel-hit {
  animation: duel-hit-defense 0.45s ease-in-out;
}

.set-tag {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 2;
  padding: 1px 5px;
  border-radius: 6px;
  font-size: 8px;
  font-weight: 800;
  color: #fff;
  background: rgba(30, 60, 120, 0.82);
  pointer-events: none;
}

.compact .set-tag {
  font-size: 7px;
  padding: 0 4px;
  top: 2px;
  left: 2px;
}

.face.spell {
  border-color: #7ad0ff;
}

.face.trap {
  border-color: #c9a0ff;
}

.face.compact {
  border-width: 1.5px;
  border-radius: 8px;
}

.back {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 3px;
  padding: 5px 6px 0;
  min-width: 0;
  flex: 0 0 auto;
}

.name {
  font-size: 11px;
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.attr {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #fff;
  font-size: 8px;
  display: grid;
  place-items: center;
  font-weight: 700;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
}

.attr-mini {
  display: none;
}

.stars,
.kind {
  padding: 0 6px;
  font-size: 9px;
  color: var(--duel-gold-deep);
  letter-spacing: 1px;
  flex: 0 0 auto;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
}

.stars-mini {
  display: none;
  letter-spacing: 0;
  font-weight: 800;
}

.kind {
  color: var(--duel-blue-deep);
  font-weight: 700;
}

.art {
  margin: 3px 6px;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  display: grid;
  place-items: center;
}

.glyph {
  font-size: 28px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 2px 8px rgba(20, 40, 80, 0.35);
  line-height: 1;
}

.text {
  margin: 0;
  padding: 2px 6px;
  font-size: 8px;
  line-height: 1.25;
  color: var(--duel-muted);
  height: 2.5em;
  overflow: hidden;
  flex: 0 0 auto;
}

footer {
  display: flex;
  justify-content: space-between;
  gap: 2px;
  padding: 3px 6px 5px;
  font-size: 9px;
  font-weight: 800;
  color: var(--duel-ink);
  background: rgba(255, 255, 255, 0.55);
  flex: 0 0 auto;
  min-width: 0;
}

.stat {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  white-space: nowrap;
  min-width: 0;
}

.stat em {
  font-style: normal;
  font-size: 0.78em;
  opacity: 0.72;
  font-weight: 700;
}

.kind-foot {
  display: none;
  padding: 3px 4px 4px;
  text-align: center;
  font-size: 8px;
  font-weight: 800;
  color: var(--duel-blue-deep);
  background: rgba(255, 255, 255, 0.55);
  flex: 0 0 auto;
}

/* —— compact / hand & field slots —— */
.compact header {
  padding: 3px 4px 0;
}

.compact .name {
  font-size: 9px;
  font-weight: 800;
}

.compact .attr {
  width: 14px;
  height: 14px;
  font-size: 7px;
}

.compact .stars,
.compact .kind {
  padding: 0 4px;
  font-size: 8px;
  letter-spacing: 0.2px;
}

.compact.spell .kind,
.compact.trap .kind {
  display: block;
  font-weight: 800;
}

.compact .art {
  margin: 2px 3px;
  border-radius: 4px;
}

.compact .glyph {
  font-size: 16px;
}

.compact .text {
  display: none;
}

.compact footer {
  padding: 2px 3px 3px;
  font-size: 7px;
}

.compact .stat em {
  font-size: 0.7em;
}

@container (max-width: 72px) {
  .compact header {
    padding: 2px 3px 0;
  }

  .compact .name {
    font-size: 8px;
  }

  .compact .attr {
    width: 12px;
    height: 12px;
  }

  .attr-full {
    display: none;
  }

  .attr-mini {
    display: block;
  }

  .stars-full,
  .compact > .kind {
    display: none;
  }

  .stars-mini {
    display: inline;
  }

  .compact .stars {
    font-size: 7px;
    padding: 0 3px;
  }

  .compact .glyph {
    font-size: 14px;
  }

  .compact footer {
    font-size: 6.5px;
    padding: 1px 2px 2px;
  }

  .compact .stat em {
    display: none;
  }

  .compact.spell .kind-foot,
  .compact.trap .kind-foot {
    display: block;
    font-size: 7px;
    padding: 2px 2px 3px;
  }
}
</style>
