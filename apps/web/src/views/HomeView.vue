<script setup lang="ts">
import { ref } from 'vue';
import { game } from '../socket';

const joinCode = ref('');

function join() {
  if (!joinCode.value.trim()) return;
  game.joinPvp(joinCode.value.trim().toUpperCase());
}
</script>

<template>
  <section class="home">
    <div class="hero panel">
      <div class="account">
        <template v-if="game.user">
          <span>{{ game.user.displayName }} · {{ game.progress?.wins ?? 0 }} فوز</span>
          <button class="ghost tiny" @click="game.logout()">خروج</button>
        </template>
        <button v-else class="ghost tiny" @click="game.openAuth()">حسابي</button>
      </div>

      <p class="eyebrow">عالم البطاقات</p>
      <h1>أثيريون</h1>
      <p class="tagline">وحوش أصلية · تعويذات جديدة · قتال عربي مودرن</p>
      <div class="actions">
        <button @click="game.createAi()">ضد الكمبيوتر</button>
        <button class="gold" @click="game.createPvp()">إنشاء غرفة أونلاين</button>
        <button class="ghost" @click="game.openDecks()">مجموعاتي</button>
        <button class="ghost" @click="game.openCollection()">الكتالوج</button>
        <button class="ghost" @click="game.openProgress()">التقدم</button>
      </div>
      <div class="join">
        <input v-model="joinCode" placeholder="رمز الغرفة" maxlength="6" />
        <button class="ghost" @click="join">انضمام</button>
      </div>
      <p v-if="game.error" class="err">{{ game.error }}</p>
    </div>
  </section>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-3);
}

.hero {
  width: min(640px, 100%);
  padding: var(--space-4);
  text-align: center;
  position: relative;
}

.account {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 8px;
}

button.tiny {
  padding: 6px 10px;
  font-size: 13px;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  letter-spacing: 0.08em;
  font-size: 13px;
}

h1 {
  margin: 8px 0 0;
  font-size: clamp(42px, 8vw, 64px);
  line-height: 1.1;
  color: var(--gold);
}

.tagline {
  color: var(--muted);
  margin: 12px 0 28px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.join {
  margin-top: 24px;
  display: flex;
  gap: 8px;
  justify-content: center;
}

input {
  width: 160px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  color: var(--text);
  padding: 12px 14px;
  text-align: center;
  letter-spacing: 0.12em;
}

.err {
  color: var(--danger);
  margin-top: 16px;
}
</style>
