<script setup lang="ts">
import { onMounted } from 'vue';
import { game } from '../socket';

onMounted(async () => {
  if (game.user) await game.refreshAccountData();
});
</script>

<template>
  <section class="progress">
    <header>
      <h1>التقدم</h1>
      <button class="ghost" @click="game.goHome()">رجوع</button>
    </header>

    <div v-if="!game.user" class="panel box">
      <p>سجّل دخولك لتتبع انتصاراتك وXP.</p>
      <button @click="game.openAuth()">تسجيل الدخول</button>
    </div>

    <div v-else class="panel box">
      <p class="name">{{ game.user.displayName }} <span>@{{ game.user.username }}</span></p>
      <div class="stats">
        <div><strong>{{ game.progress?.wins ?? 0 }}</strong><span>فوز</span></div>
        <div><strong>{{ game.progress?.losses ?? 0 }}</strong><span>خسارة</span></div>
        <div><strong>{{ game.progress?.xp ?? 0 }}</strong><span>XP</span></div>
        <div><strong>{{ game.progress?.matchesPlayed ?? 0 }}</strong><span>مباريات</span></div>
      </div>
      <p class="muted">المجموعة النشطة: {{ game.decks.find(d => d.isActive)?.name || 'الافتراضية' }}</p>
    </div>
  </section>
</template>

<style scoped>
.progress {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-3);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h1 {
  margin: 0;
  color: var(--gold);
}

.box {
  padding: var(--space-3);
}

.name {
  margin: 0 0 20px;
  font-size: 20px;
}

.name span {
  color: var(--muted);
  font-size: 14px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stats div {
  background: var(--bg-soft);
  border-radius: 12px;
  padding: 16px 8px;
  text-align: center;
  display: grid;
  gap: 4px;
}

.stats strong {
  font-size: 24px;
  color: var(--accent);
}

.stats span {
  color: var(--muted);
  font-size: 13px;
}

.muted {
  color: var(--muted);
  margin-top: 16px;
}

@media (max-width: 600px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
