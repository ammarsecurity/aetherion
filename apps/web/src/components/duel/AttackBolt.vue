<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  kind?: 'monster' | 'direct';
}>();

const isDirect = computed(() => props.kind === 'direct');

const mid = computed(() => {
  const mx = (props.x1 + props.x2) / 2;
  const my = (props.y1 + props.y2) / 2;
  const dx = props.x2 - props.x1;
  const dy = props.y2 - props.y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const bend = isDirect.value ? 48 : 22;
  return { x: mx + nx * bend, y: my + ny * bend };
});

const boltPath = computed(() => {
  const { x1, y1, x2, y2 } = props;
  const c = mid.value;
  const amp = isDirect.value ? 18 : 10;
  const j1x = x1 + (c.x - x1) * 0.28 + amp;
  const j1y = y1 + (c.y - y1) * 0.28 - amp * 0.8;
  const j2x = x1 + (c.x - x1) * 0.5 - amp * 1.2;
  const j2y = y1 + (c.y - y1) * 0.5 + amp;
  const j3x = c.x + (x2 - c.x) * 0.35 + amp * 0.7;
  const j3y = c.y + (y2 - c.y) * 0.35 - amp;
  const j4x = c.x + (x2 - c.x) * 0.7 - amp * 0.5;
  const j4y = c.y + (y2 - c.y) * 0.7 + amp * 0.6;
  return `M ${x1} ${y1} L ${j1x} ${j1y} L ${j2x} ${j2y} L ${c.x} ${c.y} L ${j3x} ${j3y} L ${j4x} ${j4y} L ${x2} ${y2}`;
});

const beamPath = computed(
  () => `M ${props.x1} ${props.y1} Q ${mid.value.x} ${mid.value.y} ${props.x2} ${props.y2}`,
);

const slashLeft = computed(() => {
  const { x2, y2 } = props;
  return `M ${x2 - 52} ${y2 - 28} L ${x2 + 18} ${y2 + 36}`;
});
const slashRight = computed(() => {
  const { x2, y2 } = props;
  return `M ${x2 + 48} ${y2 - 32} L ${x2 - 22} ${y2 + 34}`;
});

const uid = `bolt-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <svg
    v-if="active"
    class="bolt-layer"
    :class="{ direct: isDirect }"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <filter :id="`${uid}-glow`" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur :stdDeviation="isDirect ? 7 : 4.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter :id="`${uid}-bloom`" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="10" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <radialGradient :id="`${uid}-impact`" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fffef0" stop-opacity="1" />
        <stop
          offset="30%"
          :stop-color="isDirect ? '#ff4d4d' : '#ffe566'"
          stop-opacity="0.95"
        />
        <stop
          offset="100%"
          :stop-color="isDirect ? '#c41010' : '#ff7a18'"
          stop-opacity="0"
        />
      </radialGradient>
      <linearGradient :id="`${uid}-beam`" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.2" />
        <stop offset="50%" :stop-color="isDirect ? '#ff3030' : '#5de4ff'" stop-opacity="1" />
        <stop offset="100%" stop-color="#fff" stop-opacity="0.2" />
      </linearGradient>
    </defs>

    <!-- هجوم مباشر: موجة صدمة + شعاع عريض -->
    <template v-if="isDirect">
      <circle
        class="shockwave"
        :cx="x1"
        :cy="y1"
        r="12"
        :filter="`url(#${uid}-bloom)`"
      />
      <path
        class="beam mega-aura"
        :d="beamPath"
        :filter="`url(#${uid}-bloom)`"
      />
      <path class="beam mega" :d="beamPath" :filter="`url(#${uid}-glow)`" />
      <path class="beam mega-core" :d="beamPath" />
      <path class="zap mega-outer" :d="boltPath" :filter="`url(#${uid}-glow)`" />
      <path class="zap mega" :d="boltPath" />
      <path class="zap mega-hot" :d="boltPath" />

      <circle class="spark mega-spark" r="14" :filter="`url(#${uid}-glow)`">
        <animateMotion dur="0.45s" fill="freeze" :path="beamPath" />
      </circle>
      <circle class="spark mega-spark trail" r="9" :filter="`url(#${uid}-glow)`">
        <animateMotion dur="0.5s" begin="0.06s" fill="freeze" :path="beamPath" />
      </circle>

      <path class="slash" :d="slashLeft" :filter="`url(#${uid}-glow)`" />
      <path class="slash alt" :d="slashRight" :filter="`url(#${uid}-glow)`" />

      <circle class="impact mega-impact" :cx="x2" :cy="y2" r="10" :fill="`url(#${uid}-impact)`" />
      <circle class="impact-ring mega-ring" :cx="x2" :cy="y2" r="14" />
      <circle class="impact-ring mega-ring delay" :cx="x2" :cy="y2" r="14" />
    </template>

    <template v-else>
      <path class="beam aura" :d="beamPath" :filter="`url(#${uid}-glow)`" />
      <path class="beam" :d="beamPath" :filter="`url(#${uid}-glow)`" />
      <path class="beam core" :d="beamPath" />
      <path class="zap outer" :d="boltPath" :filter="`url(#${uid}-glow)`" />
      <path class="zap" :d="boltPath" />
      <path class="zap hot" :d="boltPath" />
      <circle class="spark" r="9" :filter="`url(#${uid}-glow)`">
        <animateMotion dur="0.55s" fill="freeze" :path="beamPath" />
      </circle>
      <circle class="impact" :cx="x2" :cy="y2" r="8" :fill="`url(#${uid}-impact)`" />
      <circle class="impact-ring" :cx="x2" :cy="y2" r="10" />
    </template>
  </svg>
</template>

<style scoped>
.bolt-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 40;
  overflow: visible;
}

.beam.aura {
  fill: none;
  stroke: rgba(255, 170, 40, 0.35);
  stroke-width: 18;
  stroke-linecap: round;
  animation: fade-bolt 0.75s ease forwards;
}

.beam {
  fill: none;
  stroke: rgba(60, 140, 255, 0.75);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 10 12;
  animation: dash-flow 0.55s linear forwards, fade-bolt 0.75s ease forwards;
}

.beam.core {
  stroke: #fff8d6;
  stroke-width: 3.5;
  stroke-dasharray: none;
}

.zap {
  fill: none;
  stroke: #fffef5;
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
  animation: zap-draw 0.32s ease-out forwards, fade-bolt 0.75s ease forwards;
  stroke-dasharray: 620;
  stroke-dashoffset: 620;
}

.zap.outer {
  stroke: #2f73e8;
  stroke-width: 9;
  opacity: 0.9;
}

.zap.hot {
  stroke: #ffd24a;
  stroke-width: 2;
  opacity: 0.95;
}

.spark {
  fill: #ffe566;
  stroke: #fff;
  stroke-width: 2;
  animation: fade-bolt 0.75s ease forwards;
}

.impact {
  animation: impact-pop 0.55s ease-out forwards;
}

.impact-ring {
  fill: none;
  stroke: #ffb020;
  stroke-width: 3;
  animation: ring-pop 0.55s ease-out forwards;
}

/* —— Direct attack —— */
.beam.mega-aura {
  fill: none;
  stroke: rgba(255, 40, 40, 0.45);
  stroke-width: 42;
  stroke-linecap: round;
  animation: fade-direct 1.05s ease forwards;
}

.beam.mega {
  fill: none;
  stroke: #ff3b3b;
  stroke-width: 16;
  stroke-linecap: round;
  stroke-dasharray: 14 10;
  animation: dash-flow 0.45s linear forwards, fade-direct 1.05s ease forwards;
  filter: drop-shadow(0 0 12px #ff2020);
}

.beam.mega-core {
  fill: none;
  stroke: #fff6e8;
  stroke-width: 6;
  stroke-linecap: round;
  animation: fade-direct 1.05s ease forwards;
}

.zap.mega-outer {
  stroke: #b01010;
  stroke-width: 16;
  opacity: 0.85;
  animation: zap-draw 0.28s ease-out forwards, fade-direct 1.05s ease forwards;
  stroke-dasharray: 720;
  stroke-dashoffset: 720;
}

.zap.mega {
  stroke: #ffe0a0;
  stroke-width: 5;
  animation: zap-draw 0.28s ease-out forwards, fade-direct 1.05s ease forwards;
  stroke-dasharray: 720;
  stroke-dashoffset: 720;
}

.zap.mega-hot {
  stroke: #fff;
  stroke-width: 2.5;
  animation: zap-draw 0.28s ease-out forwards, fade-direct 1.05s ease forwards;
  stroke-dasharray: 720;
  stroke-dashoffset: 720;
}

.spark.mega-spark {
  fill: #ffd0a0;
  stroke: #fff;
  stroke-width: 3;
  animation: fade-direct 1.05s ease forwards;
}

.spark.mega-spark.trail {
  fill: #ff5050;
  opacity: 0.85;
}

.slash {
  fill: none;
  stroke: #fff;
  stroke-width: 5;
  stroke-linecap: round;
  opacity: 0;
  animation: slash-cut 0.55s 0.28s ease-out forwards;
  filter: drop-shadow(0 0 8px #ff3030);
}

.slash.alt {
  stroke: #ffb0b0;
  stroke-width: 3.5;
  animation-delay: 0.34s;
}

.impact.mega-impact {
  animation: impact-direct 0.85s 0.22s ease-out forwards;
}

.impact-ring.mega-ring {
  fill: none;
  stroke: #ff4040;
  stroke-width: 5;
  animation: ring-direct 0.85s 0.22s ease-out forwards;
}

.impact-ring.mega-ring.delay {
  stroke: #ffe0a0;
  animation-delay: 0.34s;
}

.shockwave {
  fill: rgba(255, 80, 40, 0.55);
  animation: shock-burst 0.7s ease-out forwards;
}

@keyframes zap-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes dash-flow {
  from {
    stroke-dashoffset: 48;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes fade-bolt {
  0%,
  60% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes fade-direct {
  0%,
  55% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes impact-pop {
  0% {
    r: 6;
    opacity: 1;
  }
  70% {
    r: 34;
    opacity: 0.9;
  }
  100% {
    r: 48;
    opacity: 0;
  }
}

@keyframes ring-pop {
  0% {
    r: 8;
    opacity: 1;
    stroke-width: 4;
  }
  100% {
    r: 42;
    opacity: 0;
    stroke-width: 1;
  }
}

@keyframes impact-direct {
  0% {
    r: 10;
    opacity: 1;
  }
  40% {
    r: 56;
    opacity: 1;
  }
  100% {
    r: 110;
    opacity: 0;
  }
}

@keyframes ring-direct {
  0% {
    r: 12;
    opacity: 1;
    stroke-width: 6;
  }
  100% {
    r: 96;
    opacity: 0;
    stroke-width: 1;
  }
}

@keyframes slash-cut {
  0% {
    opacity: 0;
    stroke-dasharray: 120;
    stroke-dashoffset: 120;
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    stroke-dasharray: 120;
    stroke-dashoffset: 0;
  }
}

@keyframes shock-burst {
  0% {
    r: 8;
    opacity: 0.9;
  }
  100% {
    r: 70;
    opacity: 0;
  }
}
</style>
