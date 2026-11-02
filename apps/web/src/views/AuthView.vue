<script setup lang="ts">
import { ref } from 'vue';
import { game } from '../socket';

const mode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const displayName = ref('');
const loading = ref(false);
const localError = ref('');

async function submit() {
  localError.value = '';
  loading.value = true;
  try {
    if (mode.value === 'login') await game.login(username.value.trim(), password.value);
    else await game.register(username.value.trim(), password.value, displayName.value.trim() || undefined);
  } catch (e) {
    localError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth">
    <div class="panel box">
      <button class="ghost back" @click="game.goHome()">رجوع</button>
      <h1>{{ mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب' }}</h1>
      <p class="hint">احفظ مجموعاتك وتقدمك عبر الأجهزة</p>

      <label>
        اسم المستخدم
        <input v-model="username" autocomplete="username" />
      </label>
      <label v-if="mode === 'register'">
        الاسم الظاهر
        <input v-model="displayName" placeholder="اختياري" />
      </label>
      <label>
        كلمة المرور
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>

      <button :disabled="loading || !username || password.length < 6" @click="submit">
        {{ loading ? '...' : mode === 'login' ? 'دخول' : 'تسجيل' }}
      </button>

      <button class="ghost" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? 'ما عندك حساب؟ سجّل' : 'عندك حساب؟ ادخل' }}
      </button>

      <p v-if="localError" class="err">{{ localError }}</p>
    </div>
  </section>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-3);
}

.box {
  width: min(420px, 100%);
  padding: var(--space-3);
  display: grid;
  gap: 12px;
}

.back {
  justify-self: start;
  padding: 8px 12px;
}

h1 {
  margin: 0;
  color: var(--gold);
}

.hint {
  margin: 0;
  color: var(--muted);
}

label {
  display: grid;
  gap: 6px;
  text-align: right;
  font-size: 14px;
  color: var(--muted);
}

input {
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  color: var(--text);
  padding: 12px 14px;
}

.err {
  color: var(--danger);
  margin: 0;
}
</style>
