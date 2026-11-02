<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    life: number;
    side: 'player' | 'opponent';
    flash?: boolean;
  }>(),
  { flash: false },
);
</script>

<template>
  <div class="hud" :class="[side, { hit: flash }]" role="status">
    <div class="portrait" aria-hidden="true">
      <span class="ring" />
      <span class="face">{{ side === 'player' ? 'أ' : 'م' }}</span>
    </div>

    <div class="info">
      <div class="nameplate">{{ name }}</div>
      <div class="lp-wrap">
        <span class="lp-tag">LP</span>
        <span class="lp-value" :class="{ 'duel-lp-flash': flash }">{{ life }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud {
  --accent: #2f73e8;
  --accent-deep: #1d4f9c;
  --lp: #2563d8;
  --glow: rgba(70, 150, 255, 0.35);
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 196px;
  padding: 8px 12px 8px 20px;
  color: #fff;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 92%, #fff), var(--accent-deep));
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%);
  box-shadow:
    0 8px 18px var(--glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.28);
  direction: rtl;
}

.hud.opponent {
  --accent: #e85a5a;
  --accent-deep: #b83232;
  --lp: #ffe1e1;
  --glow: rgba(220, 70, 70, 0.35);
}

.hud.player {
  --accent: #4ea2ff;
  --accent-deep: #1f5fbf;
  --lp: #eaf4ff;
  --glow: rgba(70, 150, 255, 0.35);
}

.hud.hit {
  animation: hud-hit 0.7s ease-out;
}

.hud.hit .lp-value {
  animation: lp-hit-pulse 0.7s ease-out;
}

@keyframes hud-hit {
  0%,
  100% {
    filter: brightness(1);
    box-shadow: 0 8px 18px var(--glow), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }
  30% {
    filter: brightness(1.35);
    box-shadow:
      0 0 0 4px rgba(255, 220, 120, 0.65),
      0 0 28px rgba(255, 80, 40, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
}

@keyframes lp-hit-pulse {
  0% {
    transform: skewX(-6deg) scale(1);
  }
  35% {
    transform: skewX(-6deg) scale(1.28);
    color: #fff;
  }
  100% {
    transform: skewX(-6deg) scale(1);
  }
}

.portrait {
  position: relative;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
}

.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(145deg, #fff, rgba(255, 255, 255, 0.35));
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55), 0 4px 10px rgba(0, 0, 0, 0.18);
}

.face {
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 18px;
  color: #fff;
  background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 70%, #fff), var(--accent-deep));
}

.info {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding-left: 2px;
}

.nameplate {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lp-wrap {
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
  gap: 6px;
  line-height: 1;
  padding-left: 2px;
}

.lp-tag {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.9;
  flex: 0 0 auto;
}

.lp-value {
  font-size: 22px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: var(--lp);
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.25),
    0 0 10px rgba(255, 255, 255, 0.2);
  transform: skewX(-6deg);
  transform-origin: right center;
  display: inline-block;
  padding-left: 4px;
}

@media (max-width: 560px) {
  .hud {
    min-width: 168px;
    padding: 6px 10px 6px 16px;
    gap: 8px;
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .portrait,
  .ring {
    width: 38px;
    height: 38px;
  }

  .face {
    width: 32px;
    height: 32px;
    font-size: 15px;
  }

  .lp-value {
    font-size: 18px;
    padding-left: 3px;
  }

  .nameplate {
    font-size: 12px;
  }
}
</style>
