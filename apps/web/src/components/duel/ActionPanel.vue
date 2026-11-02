<script setup lang="ts">
defineProps<{
  canSummon: boolean;
  canSpell: boolean;
  canSetSpell: boolean;
  canSetTrap: boolean;
  canChangePos: boolean;
  canBattlePhase: boolean;
  canAttack: boolean;
  canDirect: boolean;
  canEnd: boolean;
  attackMode: boolean;
  logOpen: boolean;
}>();

defineEmits<{
  summon: [];
  spell: [];
  setSpell: [];
  setTrap: [];
  changePos: [];
  battlePhase: [];
  attack: [];
  direct: [];
  endTurn: [];
  toggleLog: [];
}>();
</script>

<template>
  <aside class="action-panel">
    <div class="panel-body">
      <button class="act" :disabled="!canSummon" @click="$emit('summon')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
        </span>
        <span>استدعاء</span>
      </button>

      <button class="act" :disabled="!canSpell" @click="$emit('spell')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2z"/></svg>
        </span>
        <span>تفعيل تعويذة</span>
      </button>

      <button class="act" :disabled="!canSetSpell" @click="$emit('setSpell')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2z"/></svg>
        </span>
        <span>تعيين تعويذة</span>
      </button>

      <button class="act" :disabled="!canSetTrap" @click="$emit('setTrap')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4zm0 2.2L6 8v4.1c0 3.6 2.3 6.1 6 6.7 3.7-.6 6-3.1 6-6.7V8l-6-2.8z"/></svg>
        </span>
        <span>تعيين فخ</span>
      </button>

      <button class="act" :disabled="!canChangePos" @click="$emit('changePos')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 5a7 7 0 100 14 7 7 0 000-14zm-1 3h2v2.2l1.8 1.8-1.4 1.4L11 11.4V8zm0 8h2v2h-2v-2z"/></svg>
        </span>
        <span>تغيير الوضع</span>
      </button>

      <button class="act" :disabled="!canBattlePhase" @click="$emit('battlePhase')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 5a7 7 0 100 14 7 7 0 000-14zm0 2a5 5 0 110 10 5 5 0 010-10zm-1 2h2v3h3v2h-3v3h-2v-3H8v-2h3V9z"/></svg>
        </span>
        <span>مرحلة القتال</span>
      </button>

      <button class="act" :class="{ armed: attackMode }" :disabled="!canAttack" @click="$emit('attack')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8.5 3l2 2-1.2 1.2 3.5 3.5L16 6.5 18 8.5l-3.2 3.2 3.5 3.5L19.5 14l2 2-5 5-2-2 1.2-1.2-3.5-3.5L8.7 18.8 10 20l-2 2-5-5 2-2 1.2 1.2 3.5-3.5L6.5 8 8.5 6l3.2 3.2 3.5-3.5L14 4.5l2-2 5 5z"/></svg>
        </span>
        <span>{{ attackMode ? 'اختر هدفاً' : 'هجوم' }}</span>
      </button>

      <button class="act" :disabled="!canDirect" @click="$emit('direct')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M4 12h12.2l-3.6-3.6L14 7l6 6-6 6-1.4-1.4 3.6-3.6H4v-2z"/></svg>
        </span>
        <span>هجوم مباشر</span>
      </button>

      <button class="act end" :disabled="!canEnd" @click="$emit('endTurn')">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6 6h2v12H6V6zm4.5 0l8 6-8 6V6zm2 3.2v5.6L15.8 12 12.5 9.2z"/></svg>
        </span>
        <span>إنهاء الدور</span>
      </button>
    </div>

    <button class="log" @click="$emit('toggleLog')">
      <span class="ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M5 4h14a1 1 0 011 1v14l-4-2-4 2-4-2-4 2V5a1 1 0 011-1zm1 2v10.1l2.2-1.1L12 16l3.8-1.9 2.2 1.1V6H6z"/></svg>
      </span>
      <span>سجل المباراة {{ logOpen ? '▾' : '▴' }}</span>
    </button>
  </aside>
</template>

<style scoped>
.action-panel {
  width: 100%;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff, #f3f8ff);
  border: 2px solid #4f8fe8;
  box-shadow:
    0 10px 24px rgba(35, 80, 150, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.act {
  appearance: none;
  width: 100%;
  border: 1.5px solid #c5d6ef;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #f7fbff);
  color: #1f5fbf;
  font-weight: 800;
  font-size: 14px;
  padding: 11px 12px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 2px 0 #d7e4f7;
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
}

.act:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: #7eb0f0;
  box-shadow: 0 4px 0 #d0def3;
}

.act:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 1px 0 #d7e4f7;
}

.act.armed {
  border-color: #3dbfff;
  box-shadow: 0 0 0 3px rgba(61, 191, 255, 0.25), 0 2px 0 #d7e4f7;
  background: linear-gradient(180deg, #f0fbff, #e5f6ff);
}

.act:disabled {
  color: #9aa8bd;
  background: linear-gradient(180deg, #f2f4f7, #e8ecf2);
  border-color: #d5dbe6;
  box-shadow: none;
  cursor: not-allowed;
}

.act.end {
  margin-top: 4px;
  justify-content: center;
  min-height: 52px;
  color: #5a3d08;
  border: none;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffe9a3, #f0c14b 55%, #e0a82d);
  box-shadow:
    0 4px 0 #2f5fad,
    0 8px 16px rgba(40, 90, 180, 0.22);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
}

.act.end:hover:not(:disabled) {
  box-shadow:
    0 5px 0 #2f5fad,
    0 10px 18px rgba(40, 90, 180, 0.25);
}

.act.end:active:not(:disabled) {
  box-shadow: 0 2px 0 #2f5fad;
}

.act.end:disabled {
  color: #a8956a;
  background: linear-gradient(180deg, #efe2b8, #d9c48a);
  box-shadow: 0 3px 0 #8fa4c4;
}

.log {
  appearance: none;
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 11px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
  color: #fff;
  background: linear-gradient(180deg, #3d78d6, #2457b0);
  box-shadow: 0 3px 0 #1a3f86, 0 8px 14px rgba(30, 70, 140, 0.25);
}

.log:hover {
  filter: brightness(1.05);
}

.ico {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  color: inherit;
  flex: 0 0 auto;
}

@media (max-width: 980px) {
  .action-panel {
    width: 100%;
    max-width: none;
    gap: 6px;
  }

  .panel-body {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding: 8px;
    border-radius: 14px;
  }

  .act {
    font-size: 11px;
    padding: 7px 4px;
    justify-content: center;
    text-align: center;
    flex-direction: column;
    gap: 2px;
    min-height: 44px;
    border-radius: 10px;
    box-shadow: 0 1px 0 #d7e4f7;
  }

  .act .ico {
    width: 16px;
    height: 16px;
  }

  .act .ico :deep(svg),
  .act .ico svg {
    width: 14px;
    height: 14px;
  }

  .act.end {
    grid-column: 1 / -1;
    flex-direction: row;
    min-height: 40px;
    margin-top: 0;
    font-size: 13px;
  }

  .log {
    margin-top: 0;
    padding: 8px;
    font-size: 12px;
    border-radius: 10px;
    box-shadow: 0 2px 0 #1a3f86;
  }
}

@media (max-width: 560px) {
  .panel-body {
    padding: 6px;
    gap: 5px;
  }

  .act {
    min-height: 40px;
    font-size: 10px;
    padding: 5px 2px;
  }

  .act.end {
    min-height: 36px;
  }
}
</style>
