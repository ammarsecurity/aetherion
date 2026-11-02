<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CardDef } from '../../types';

const props = defineProps<{
  card?: CardDef | null;
  faceDown?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  atk?: number;
  def?: number;
}>();

const emit = defineEmits<{ done: [] }>();
const alive = ref(true);

const label = props.faceDown || !props.card ? '?' : (props.card.nameAr || '?').slice(0, 1);
const hue = props.card?.element === 'flame'
  ? '#ff6b4a'
  : props.card?.element === 'shadow'
    ? '#6b5cff'
    : props.card?.element === 'light'
      ? '#f0c84a'
      : '#5de4ff';

const shards = Array.from({ length: 14 }, (_, i) => {
  const angle = -50 + Math.random() * 100 + (i % 5) * 12;
  const dist = 40 + Math.random() * 90;
  return {
    id: i,
    clip:
      i % 3 === 0
        ? 'polygon(0 0, 100% 0, 55% 100%)'
        : i % 3 === 1
          ? 'polygon(0 0, 100% 35%, 45% 100%, 0 70%)'
          : 'polygon(15% 0, 100% 0, 100% 100%, 0 55%)',
    left: `${(i % 4) * 24}%`,
    top: `${Math.floor(i / 4) * 30}%`,
    width: `${22 + (i % 3) * 4}%`,
    height: `${28 + (i % 2) * 8}%`,
    tx: Math.cos((angle * Math.PI) / 180) * dist,
    ty: Math.sin((angle * Math.PI) / 180) * dist + 36,
    rot: -140 + Math.random() * 280,
    delay: Math.random() * 0.08,
  };
});

onMounted(() => {
  window.setTimeout(() => {
    alive.value = false;
    emit('done');
  }, 820);
});
</script>

<template>
  <div
    v-if="alive"
    class="shatter"
    :style="{
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
    }"
  >
    <div class="flash" />
    <div class="ghost-card" :style="{ background: `linear-gradient(160deg, ${hue}88, #d9e8ff 55%, #8eb6e8)` }">
      <span>{{ label }}</span>
    </div>
    <div
      v-for="s in shards"
      :key="s.id"
      class="shard"
      :style="{
        left: s.left,
        top: s.top,
        width: s.width,
        height: s.height,
        clipPath: s.clip,
        background: `linear-gradient(145deg, ${hue}, #f7fbff 55%, #9ec9f5)`,
        '--tx': `${s.tx}px`,
        '--ty': `${s.ty}px`,
        '--rot': `${s.rot}deg`,
        animationDelay: `${s.delay}s`,
      }"
    />
    <div class="crack" />
  </div>
</template>

<style scoped>
.shatter {
  position: absolute;
  z-index: 50;
  pointer-events: none;
  transform: translate(-50%, -50%);
  overflow: visible;
}

.ghost-card {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 28px;
  font-weight: 900;
  text-shadow: 0 2px 8px rgba(20, 40, 80, 0.45);
  animation: ghost-pop 0.2s ease forwards;
}

.flash {
  position: absolute;
  inset: -16%;
  border-radius: 14px;
  background: radial-gradient(circle, rgba(255, 255, 255, 1), rgba(255, 210, 80, 0.65) 40%, transparent 70%);
  animation: flash-pop 0.4s ease-out forwards;
  z-index: 2;
}

.crack {
  position: absolute;
  inset: 6%;
  z-index: 3;
  background:
    linear-gradient(115deg, transparent 47%, #fff 49.5%, transparent 52%),
    linear-gradient(35deg, transparent 44%, rgba(255, 230, 150, 0.95) 50%, transparent 56%),
    linear-gradient(160deg, transparent 40%, #fff 50%, transparent 60%);
  mix-blend-mode: screen;
  animation: crack-in 0.22s ease-out forwards;
}

.shard {
  position: absolute;
  z-index: 4;
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 6px 12px rgba(20, 40, 80, 0.35);
  animation: shard-fly 0.78s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

@keyframes ghost-pop {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.08);
  }
}

@keyframes flash-pop {
  0% {
    opacity: 1;
    transform: scale(0.8);
  }
  100% {
    opacity: 0;
    transform: scale(1.45);
  }
}

@keyframes crack-in {
  0% {
    opacity: 0;
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes shard-fly {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.5);
  }
}
</style>
