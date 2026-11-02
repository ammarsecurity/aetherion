<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { game } from '../socket';
import GameCard from '../components/GameCard.vue';

const name = ref('مجموعتي');
const selected = ref<string[]>([]);
const editingId = ref<number | null>(null);
const saving = ref(false);
const localError = ref('');
const localOk = ref('');

const counts = computed(() => {
  const map = new Map<string, number>();
  for (const id of selected.value) map.set(id, (map.get(id) ?? 0) + 1);
  return map;
});

onMounted(async () => {
  if (!game.cards.length) await game.fetchCards();
  if (game.user) await game.refreshAccountData();
  const active = game.decks.find((d) => d.isActive) || game.decks[0];
  if (active) loadDeck(active.id);
});

function loadDeck(id: number) {
  const d = game.decks.find((x) => x.id === id);
  if (!d) return;
  editingId.value = d.id;
  name.value = d.name;
  selected.value = [...d.cardIds];
  localError.value = '';
  localOk.value = '';
}

function addCard(id: string) {
  if (selected.value.length >= 40) return;
  if ((counts.value.get(id) ?? 0) >= 3) return;
  selected.value = [...selected.value, id];
}

function removeOne(id: string) {
  const i = selected.value.lastIndexOf(id);
  if (i < 0) return;
  const next = [...selected.value];
  next.splice(i, 1);
  selected.value = next;
}

async function save(asActive = true) {
  if (!game.user) {
    game.openAuth();
    return;
  }
  localError.value = '';
  localOk.value = '';
  saving.value = true;
  try {
    await api.saveDeck({
      id: editingId.value ?? undefined,
      name: name.value,
      cardIds: selected.value,
      isActive: asActive,
    });
    await game.refreshAccountData();
    const active = game.decks.find((d) => d.isActive) || game.decks[0];
    if (active) {
      editingId.value = active.id;
    }
    localOk.value = 'تم الحفظ';
  } catch (e) {
    localError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function activate(id: number) {
  await api.activateDeck(id);
  await game.refreshAccountData();
  loadDeck(id);
  localOk.value = 'تم تفعيل المجموعة';
}

function newDeck() {
  editingId.value = null;
  name.value = 'مجموعتي';
  selected.value = [];
  localOk.value = '';
  localError.value = '';
}
</script>

<template>
  <section class="decks">
    <header>
      <div>
        <h1>بناء المجموعة</h1>
        <p>{{ selected.length }} / 40 · حد أقصى 3 لكل بطاقة</p>
      </div>
      <div class="actions">
        <button class="ghost" @click="newDeck">جديدة</button>
        <button class="ghost" @click="game.goHome()">رجوع</button>
      </div>
    </header>

    <p v-if="!game.user" class="warn">سجّل دخولك لحفظ المجموعة. <button class="ghost" @click="game.openAuth()">دخول</button></p>

    <div v-if="game.decks.length" class="saved">
      <button
        v-for="d in game.decks"
        :key="d.id"
        class="ghost"
        :class="{ active: editingId === d.id }"
        @click="loadDeck(d.id)"
      >
        {{ d.name }}{{ d.isActive ? ' ★' : '' }}
      </button>
      <button
        v-if="editingId"
        class="ghost"
        @click="activate(editingId)"
      >
        تفعيل
      </button>
    </div>

    <div class="toolbar panel">
      <input v-model="name" placeholder="اسم المجموعة" />
      <button :disabled="saving || selected.length !== 40" @click="save(true)">
        {{ saving ? '...' : 'حفظ وتفعيل' }}
      </button>
    </div>

    <p v-if="localError" class="err">{{ localError }}</p>
    <p v-if="localOk" class="ok">{{ localOk }}</p>

    <h2>المختارة</h2>
    <div class="chips">
      <button v-for="id in [...counts.keys()]" :key="id" class="chip" @click="removeOne(id)">
        {{ game.cardMap()[id]?.nameAr || id }} ×{{ counts.get(id) }}
      </button>
    </div>

    <h2>الكتالوج</h2>
    <div class="grid">
      <div v-for="card in game.cards" :key="card.id" class="cell">
        <GameCard :card="card" compact @click="addCard(card.id)" />
        <small>{{ counts.get(card.id) || 0 }}/3</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.decks {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-3);
}

header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

h1, h2 {
  margin: 0;
  color: var(--gold);
}

h2 {
  margin-top: 24px;
  margin-bottom: 12px;
  font-size: 18px;
}

p {
  margin: 4px 0 0;
  color: var(--muted);
}

.actions {
  display: flex;
  gap: 8px;
}

.saved {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}

.saved .active {
  border-color: var(--accent);
  color: var(--accent);
}

.toolbar {
  display: flex;
  gap: 10px;
  padding: 12px;
  margin-bottom: 8px;
}

input {
  flex: 1;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  color: var(--text);
  padding: 12px 14px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  background: var(--bg-soft);
  color: var(--text);
  border: 1px solid var(--line);
  padding: 8px 12px;
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  justify-items: center;
}

.cell {
  display: grid;
  gap: 4px;
  justify-items: center;
}

.err { color: var(--danger); }
.ok { color: var(--ok); }
.warn { color: var(--gold); margin: 12px 0; }
</style>
