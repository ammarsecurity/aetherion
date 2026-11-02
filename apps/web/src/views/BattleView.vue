<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { game, gameRevision } from '../socket';
import type { CardDef, Position } from '../types';
import DuelCardFace from '../components/duel/DuelCardFace.vue';
import ZoneSlot from '../components/duel/ZoneSlot.vue';
import PlayerBadge from '../components/duel/PlayerBadge.vue';
import PhaseBar from '../components/duel/PhaseBar.vue';
import ActionPanel from '../components/duel/ActionPanel.vue';
import AttackBolt from '../components/duel/AttackBolt.vue';
import CardShatter from '../components/duel/CardShatter.vue';
import { bindSfxUnlock, duelSfx } from '../audio/duelSfx';
import '../styles/duel.css';

type ShatterItem = {
  id: number;
  card: CardDef | null;
  faceDown?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  atk?: number;
  def?: number;
};

type ZoneRect = { x: number; y: number; w: number; h: number };

type FieldSnap = {
  myMonsters: Array<
    { instanceId: string; cardId: string; atk: number; def: number; rect: ZoneRect | null } | null
  >;
  foeMonsters: Array<
    { instanceId: string; cardId: string; atk: number; def: number; rect: ZoneRect | null } | null
  >;
  mySpells: Array<{ instanceId: string; cardId: string; rect: ZoneRect | null } | null>;
  foeSpells: Array<{ instanceId: string; cardId: string; rect: ZoneRect | null } | null>;
};

const selectedHand = ref<number | null>(null);
const selectedHandCardId = ref<string | null>(null);
const selectedAttacker = ref<number | null>(null);
const selectedField = ref<number | null>(null);
const selectedSpellZone = ref<number | null>(null);
const attackMode = ref(false);
type SummonMode = 'attack' | 'defense_up' | 'defense_down';
const summonMode = ref<SummonMode>('attack');
const summonPos = computed<Position>(() =>
  summonMode.value === 'attack' ? 'attack' : 'defense',
);
const summonFaceUp = computed(() => summonMode.value !== 'defense_down');
const logOpen = ref(false);
const inspectId = ref<string | null>(null);
/** فتح قائمة المقبرة: أنا أو الخصم */
const gyOpen = ref<'me' | 'foe' | null>(null);
const sfxMuted = ref(duelSfx.muted);
const hint = ref('اختر بطاقة من يدك ثم استدعِ أو فعّل');
const prevHandCount = ref<number | null>(null);
const prevPhase = ref<string | null>(null);
const prevWinner = ref<string | null>(null);
const prevFoeMonsterIds = ref<string[]>([]);
let sfxDestroyBurst = 0;
const summonFxZone = ref<number | null>(null);
const hitFxZone = ref<number | null>(null);
const spellFx = ref(false);
const directFx = ref(false);
const fieldRef = ref<HTMLElement | null>(null);
const attackBusy = ref(false);
const bolt = ref<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  kind: 'monster' | 'direct';
  key: number;
} | null>(null);
const aimLine = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
/** هدف التصويب الحالي من وحوش الخصم (عند المرور بالماوس) */
const aimTargetZone = ref<number | null>(null);
const shatters = ref<ShatterItem[]>([]);
const prevField = ref<FieldSnap | null>(null);
let shatterSeq = 0;
const lpFlashMe = ref(false);
const lpFlashFoe = ref(false);
const prevLife = ref<{ me: number; foe: number } | null>(null);
const prevMonsterIds = ref<string[]>([]);

const map = computed(() => {
  void gameRevision.value;
  return game.cardMap();
});
const state = computed(() => {
  void gameRevision.value;
  return game.state;
});
const me = computed(() => (state.value ? state.value.players[state.value.you] : null));
const foe = computed(() => {
  if (!state.value) return null;
  const id = state.value.you === 'p1' ? 'p2' : 'p1';
  return state.value.players[id];
});
const myTurn = computed(
  () => !!(state.value && state.value.turn === state.value.you && !state.value.winner),
);
const inMain = computed(() => state.value?.phase === 'main');
const inBattle = computed(() => state.value?.phase === 'battle');

const inspectCard = computed<CardDef | null>(() => {
  if (!inspectId.value) return null;
  return map.value[inspectId.value] ?? null;
});

const gyList = computed(() => {
  if (!gyOpen.value) return [] as string[];
  const raw =
    gyOpen.value === 'me' ? me.value?.graveyard ?? [] : foe.value?.graveyard ?? [];
  return [...raw].reverse();
});

const gyTitle = computed(() =>
  gyOpen.value === 'foe' ? 'مقبرة الخصم' : 'مقبرتك',
);

const currentHandIndex = computed(() => {
  if (!me.value?.hand || !selectedHandCardId.value) return null;
  // Prefer remembered index if it still matches (handles duplicates)
  if (
    selectedHand.value != null &&
    me.value.hand[selectedHand.value] === selectedHandCardId.value
  ) {
    return selectedHand.value;
  }
  const idx = me.value.hand.indexOf(selectedHandCardId.value);
  return idx >= 0 ? idx : null;
});

const selectedHandCard = computed(() => {
  if (currentHandIndex.value == null || !me.value?.hand) return null;
  return map.value[me.value.hand[currentHandIndex.value] ?? ''] ?? null;
});

const emptyMonsterZone = computed(() => me.value?.monsters.findIndex((z) => !z) ?? -1);
const emptySpellZone = computed(() => me.value?.spellTraps.findIndex((z) => !z) ?? -1);

const canSummon = computed(
  () =>
    myTurn.value &&
    inMain.value &&
    !me.value?.normalSummonUsed &&
    selectedHandCard.value?.type === 'monster' &&
    emptyMonsterZone.value >= 0,
);

const canSpellFromHand = computed(
  () =>
    myTurn.value &&
    inMain.value &&
    selectedHandCard.value?.type === 'spell' &&
    emptySpellZone.value >= 0,
);

const canSetSpell = computed(
  () =>
    myTurn.value &&
    inMain.value &&
    selectedHandCard.value?.type === 'spell' &&
    emptySpellZone.value >= 0,
);

const canSetTrap = computed(
  () =>
    myTurn.value &&
    inMain.value &&
    selectedHandCard.value?.type === 'trap' &&
    emptySpellZone.value >= 0,
);

const selectedFieldSpell = computed(() => {
  if (selectedSpellZone.value == null || !me.value) return null;
  return me.value.spellTraps[selectedSpellZone.value] ?? null;
});

/** تفعيل تعويذة/فخ مقلوب على الساحة حسب النوع */
const canActivateSet = computed(() => {
  if (!myTurn.value || selectedSpellZone.value == null || !selectedFieldSpell.value) return false;
  const st = selectedFieldSpell.value;
  if (st.faceUp) return false;
  const card = map.value[st.cardId];
  if (!card) return false;
  if (card.type === 'trap') {
    return !st.setThisTurn;
  }
  if (card.type === 'spell') {
    if (card.tags?.includes('quick')) {
      // سريعة: بعد دور التعيين، يمكن في الرئيسية أو القتال
      return !st.setThisTurn && (inMain.value || inBattle.value);
    }
    // عادية / مستمرة: من الساحة في الرئيسية (حتى نفس الدور)
    return inMain.value;
  }
  return false;
});

const canSpell = computed(() => canSpellFromHand.value || canActivateSet.value);

const canBattlePhase = computed(() => myTurn.value && inMain.value);

const hasAttackerReady = computed(
  () => !!me.value?.monsters.some((m) => m && m.position === 'attack' && m.canAttack),
);

const canAttack = computed(
  () => myTurn.value && (inBattle.value || inMain.value) && hasAttackerReady.value,
);

const canDirect = computed(() => {
  if (!myTurn.value || !inBattle.value || selectedAttacker.value == null || !foe.value) return false;
  const atk = me.value?.monsters[selectedAttacker.value];
  if (!atk || !atk.canAttack || atk.position !== 'attack') return false;
  return !foe.value.monsters.some((m) => m);
});

const canEnd = computed(() => myTurn.value);

const canChangePos = computed(() => {
  if (!myTurn.value || !inMain.value || selectedField.value == null || !me.value) return false;
  return !!me.value.monsters[selectedField.value];
});

const modeLabel = computed(() => (game.mode === 'ai' ? 'ضد الكمبيوتر' : `غرفة ${game.roomCode}`));

const statusHint = computed(() => {
  void gameRevision.value;
  if (game.error) return game.error;
  if (game.message) return game.message;
  if (!myTurn.value) return 'دور الخصم...';
  if (attackMode.value) {
    if (selectedAttacker.value == null) return 'اختر وحشك المهاجم من الساحة';
    if (foe.value?.monsters.some((m) => m)) return 'اختر وحش الخصم للهجوم';
    return 'لا يوجد وحوش للخصم — اضغط «هجوم مباشر»';
  }
  if (inBattle.value) {
    const hasMonster = !!me.value?.monsters.some((m) => m);
    if (!hasMonster) return 'لا يوجد وحش على ساحتك — أنهِ الدور أو انتظر الدور القادم للاستدعاء';
    if (!hasAttackerReady.value) {
      const onlySick = me.value?.monsters.some(
        (m) => m && m.position === 'attack' && !m.canAttack,
      );
      if (onlySick) return 'الوحوش المستدعاة هذا الدور لا تهاجم — أنهِ الدور';
      return 'لا يوجد وحش جاهز للهجوم — أنهِ الدور';
    }
    return 'اضغط «هجوم» ثم اختر المهاجم والهدف';
  }
  if (canSummon.value) return 'اضغط «استدعاء» أو انقر خانة وحش فارغة';
  if (canActivateSet.value) return 'ورقة مقلوبة محددة — اضغط «تفعيل»';
  if (canSpellFromHand.value) return 'اضغط «تفعيل تعويذة» أو «تعيين تعويذة»';
  if (canSetTrap.value) return 'اضغط «تعيين فخ» أو انقر خانة فارغة';
  if (inMain.value && me.value?.normalSummonUsed) {
    return 'تم الاستدعاء لهذا الدور — فعّل تعويذة أو انتقل للقتال';
  }
  if (inMain.value) return 'اختر بطاقة من يدك ثم استدعِ أو فعّل';
  return hint.value || 'تابع المبارزة';
});

function toggleSfx() {
  sfxMuted.value = duelSfx.toggleMute();
}

function openGy(who: 'me' | 'foe') {
  const list = who === 'me' ? me.value?.graveyard : foe.value?.graveyard;
  if (!list?.length) {
    duelSfx.play('error');
    hint.value = who === 'me' ? 'مقبرتك فارغة' : 'مقبرة الخصم فارغة';
    gyOpen.value = null;
    return;
  }
  duelSfx.play('gy');
  gyOpen.value = who;
  const top = list[list.length - 1];
  if (top) peekCard(top);
  hint.value = who === 'me' ? 'مقبرتك' : 'مقبرة الخصم';
}

function pickGyCard(id: string) {
  peekCard(id);
}

function cardOf(id: string) {
  return map.value[id];
}

function atkOf(m: { cardId: string; atkBuff: number }) {
  return (map.value[m.cardId]?.atk ?? 0) + m.atkBuff;
}

function defOf(m: { cardId: string; defBuff: number }) {
  return (map.value[m.cardId]?.def ?? 0) + m.defBuff;
}

function clearHandSelection() {
  selectedHand.value = null;
  selectedHandCardId.value = null;
}

/** معاينة على اللوحة الجانبية فقط — بدون تكبير عائم */
function peekCard(cardId?: string | null) {
  if (!cardId || cardId === 'hidden') return;
  inspectId.value = cardId;
}

function onFoeSpell(zone: number) {
  const s = foe.value?.spellTraps[zone];
  if (!s) return;
  if (!s.faceUp || s.cardId === 'hidden') {
    hint.value = 'ورقة مقلوبة للخصم';
    return;
  }
  peekCard(s.cardId);
  const card = map.value[s.cardId];
  hint.value = card
    ? `${card.nameAr} — ${card.type === 'spell' ? 'تعويذة' : 'فخ'} مكشوفة للخصم`
    : 'ورقة مكشوفة';
}

function selectHand(i: number) {
  const id = me.value?.hand?.[i];
  if (!id) return;
  duelSfx.play('select');
  selectedHand.value = i;
  selectedHandCardId.value = id;
  inspectId.value = id;
  attackMode.value = false;
  selectedAttacker.value = null;
  selectedField.value = null;
  const card = map.value[id];
  if (card?.type === 'monster') hint.value = 'وحش محدد — اضغط استدعاء أو خانة فارغة';
  else if (card?.type === 'spell') {
    selectedSpellZone.value = null;
    hint.value = 'تعويذة محددة — تفعيل مكشوف أو تعيين مقلوب';
  } else {
    selectedSpellZone.value = null;
    hint.value = 'فخ محدد — اضغط تعيين فخ';
  }
}

function summonTo(zone: number) {
  if (!canSummon.value && !(selectedHandCard.value?.type === 'monster' && myTurn.value && inMain.value)) {
    hint.value = me.value?.normalSummonUsed
      ? 'تم استخدام الاستدعاء العادي لهذا الدور'
      : 'اختر وحشاً من يدك أولاً';
    return;
  }
  const handIndex = currentHandIndex.value;
  if (handIndex == null) {
    hint.value = 'اختر وحشاً من يدك أولاً';
    return;
  }
  if (!myTurn.value || !inMain.value) {
    hint.value = 'الاستدعاء فقط في مرحلتك الرئيسية';
    return;
  }
  if (me.value?.normalSummonUsed) {
    hint.value = 'تم استخدام الاستدعاء العادي لهذا الدور';
    return;
  }
  if (me.value?.monsters[zone]) {
    hint.value = 'الخانة مشغولة';
    return;
  }
  const cardId = me.value?.hand?.[handIndex];
  if (!cardId || map.value[cardId]?.type !== 'monster') {
    hint.value = 'البطاقة المحددة ليست وحشاً';
    return;
  }

  const targetZone = zone;
  const faceUp = summonFaceUp.value;
  game.action({
    type: 'summon',
    handIndex,
    zoneIndex: targetZone,
    position: summonPos.value,
    faceUp,
  });
  clearHandSelection();
  hint.value = 'تم إرسال الاستدعاء';
  // انتظر ظهور البطاقة من السيرفر ثم شغّل مؤثر الاستدعاء
  const started = Date.now();
  const waitSummon = window.setInterval(() => {
    if (me.value?.monsters[targetZone]) {
      summonFxZone.value = targetZone;
      window.clearInterval(waitSummon);
      window.setTimeout(() => {
        if (summonFxZone.value === targetZone) summonFxZone.value = null;
      }, 1100);
    } else if (Date.now() - started > 2500) {
      window.clearInterval(waitSummon);
    }
  }, 40);
}

function summonSelected() {
  const zone = emptyMonsterZone.value;
  if (zone < 0) {
    hint.value = 'لا توجد خانة وحش فارغة';
    return;
  }
  summonTo(zone);
}

function setOrActivateOnZone(zone: number) {
  const handIndex = currentHandIndex.value;
  if (handIndex == null || !myTurn.value || !inMain.value) {
    hint.value = 'اختر تعويذة/فخاً من يدك أولاً';
    return;
  }
  const cardId = me.value?.hand?.[handIndex];
  const card = map.value[cardId ?? ''];
  if (!card || (card.type !== 'spell' && card.type !== 'trap')) {
    hint.value = 'البطاقة ليست تعويذة أو فخاً';
    return;
  }
  if (me.value?.spellTraps[zone]) {
    hint.value = 'الخانة مشغولة';
    return;
  }
  // النقر على خانة فارغة = تعيين مقلوب (تعويذة أو فخ)
  game.action({ type: 'set_spell_trap', handIndex, zoneIndex: zone });
  duelSfx.play('set');
  clearHandSelection();
  hint.value = card.type === 'spell' ? 'تم تعيين التعويذة مقلوبة' : 'تم تعيين الفخ';
}

function activateSelectedSpell() {
  // تفعيل ورقة مقلوبة على الساحة
  if (canActivateSet.value && selectedSpellZone.value != null) {
    const st = selectedFieldSpell.value;
    const card = st ? map.value[st.cardId] : null;
    spellFx.value = true;
    if (card?.type === 'trap') {
      game.action({ type: 'activate_trap', zoneIndex: selectedSpellZone.value });
      duelSfx.play('trap');
      hint.value = 'تم تفعيل الفخ';
    } else {
      game.action({ type: 'activate_spell', zoneIndex: selectedSpellZone.value });
      duelSfx.play('spell');
      hint.value = 'تم تفعيل التعويذة من الساحة';
    }
    selectedSpellZone.value = null;
    window.setTimeout(() => {
      spellFx.value = false;
    }, 550);
    return;
  }

  const handIndex = currentHandIndex.value;
  if (handIndex == null || !canSpellFromHand.value) {
    hint.value = 'اختر تعويذة من يدك أو ورقة مقلوبة على الساحة';
    return;
  }
  const zone = emptySpellZone.value;
  if (zone < 0) {
    hint.value = 'لا توجد خانة تعويذة فارغة على الساحة';
    return;
  }
  spellFx.value = true;
  game.action({
    type: 'activate_spell',
    handIndex,
    zoneIndex: zone,
  });
  duelSfx.play('spell');
  clearHandSelection();
  hint.value = 'تم تفعيل التعويذة مكشوفة';
  window.setTimeout(() => {
    spellFx.value = false;
  }, 550);
}

function setSelectedSpell() {
  const handIndex = currentHandIndex.value;
  const zone = emptySpellZone.value;
  if (handIndex == null || !canSetSpell.value || zone < 0) {
    hint.value = 'اختر تعويذة وتأكد من وجود خانة فارغة';
    return;
  }
  game.action({ type: 'set_spell_trap', handIndex, zoneIndex: zone });
  duelSfx.play('set');
  clearHandSelection();
  hint.value = 'تم تعيين التعويذة مقلوبة';
}

function setSelectedTrap() {
  const handIndex = currentHandIndex.value;
  const zone = emptySpellZone.value;
  if (handIndex == null || !canSetTrap.value || zone < 0) {
    hint.value = 'اختر فخاً وتأكد من وجود خانة فارغة';
    return;
  }
  game.action({ type: 'set_spell_trap', handIndex, zoneIndex: zone });
  duelSfx.play('set');
  clearHandSelection();
  hint.value = 'تم تعيين الفخ';
}

function pickMySpellTrap(zone: number) {
  const s = me.value?.spellTraps[zone];
  if (!s) {
    setOrActivateOnZone(zone);
    return;
  }
  duelSfx.play('select');
  selectedField.value = null;
  selectedSpellZone.value = zone;
  clearHandSelection();
  if (s.cardId !== 'hidden') inspectId.value = s.cardId;
  const card = map.value[s.cardId];
  if (s.faceUp) {
    hint.value = card ? `${card.nameAr} — مفعّلة على الساحة` : 'ورقة مفعّلة';
    return;
  }
  if (card?.type === 'trap' && s.setThisTurn) {
    hint.value = 'فخ مقلوب — يُفعَّل من الدور القادم';
  } else if (card?.type === 'spell' && card.tags?.includes('quick') && s.setThisTurn) {
    hint.value = 'تعويذة سريعة مقلوبة — تُفعَّل من الدور القادم';
  } else {
    hint.value = 'ورقة مقلوبة — اضغط «تفعيل تعويذة» لتفعيلها';
  }
}

function readyAttackerZones(): number[] {
  if (!me.value) return [];
  return me.value.monsters
    .map((m, i) => (m && m.position === 'attack' && m.canAttack ? i : -1))
    .filter((i) => i >= 0);
}

/** إذا مهاجم واحد فقط — اختَره مباشرة لتسريع الهجوم */
function armSingleAttacker(): boolean {
  const zones = readyAttackerZones();
  if (zones.length !== 1) return false;
  selectedAttacker.value = zones[0];
  selectedField.value = zones[0];
  attackMode.value = true;
  hint.value = foe.value?.monsters.some((x) => x)
    ? 'اختر هدف الخصم'
    : 'اضغط «هجوم مباشر»';
  void nextTick().then(updateAimLine);
  return true;
}

function enableAttackMode() {
  if (!hasAttackerReady.value) {
    duelSfx.play('error');
    hint.value = 'لا يوجد وحش جاهز للهجوم (المستدعى هذا الدور لا يهاجم)';
    return;
  }
  if (inMain.value) {
    game.action({ type: 'go_phase', phase: 'battle' });
    duelSfx.play('phase');
  } else {
    duelSfx.play('aim');
  }
  attackMode.value = true;
  selectedAttacker.value = null;
  clearHandSelection();
  if (armSingleAttacker()) return;
  hint.value = 'اختر وحشك المهاجم من الساحة';
}

function pickMyMonster(zone: number) {
  const m = me.value?.monsters[zone];
  if (!m) {
    if (selectedHandCard.value?.type === 'monster') {
      summonTo(zone);
    } else {
      hint.value = 'اختر وحشاً من اليد ثم انقر الخانة';
    }
    return;
  }
  // صاحب الوحش يعرف هويته حتى لو مقلوب على الساحة
  if (m.cardId !== 'hidden') inspectId.value = m.cardId;
  if (attackMode.value || inBattle.value) {
    if (m.position !== 'attack') {
      hint.value = 'هذا الوحش في وضع دفاع ولا يهاجم';
      return;
    }
    if (!m.canAttack) {
      hint.value = 'هذا الوحش لا يمكنه الهجوم الآن';
      return;
    }
    selectedAttacker.value = zone;
    selectedField.value = zone;
    attackMode.value = true;
    duelSfx.play('select');
    hint.value = foe.value?.monsters.some((x) => x)
      ? 'اختر هدف الخصم — ستنطلق صاعقة نحو الهدف'
      : 'اضغط هجوم مباشر';
    void nextTick().then(updateAimLine);
    return;
  }
  selectedField.value = zone;
  clearHandSelection();
  if (!m.faceUp) {
    hint.value = 'وحش مقلوب (ضهر الكارت) — اضغط «تغيير الوضع» لقلبه إلى هجوم';
  } else if (m.position === 'attack') {
    hint.value = 'وحش محدد — يمكنك تحويله إلى دفاع مكشوف (بالعرض)';
  } else {
    hint.value = 'دفاع مكشوف — يمكنك تحويله إلى هجوم';
  }
}

function changeSelectedPosition() {
  if (selectedField.value == null || !canChangePos.value) {
    hint.value = 'اختر وحشاً من ساحتك أولاً';
    return;
  }
  const zone = selectedField.value;
  const m = me.value?.monsters[zone];
  game.action({ type: 'change_position', zoneIndex: zone });
  duelSfx.play('set');
  if (!m?.faceUp) hint.value = 'تم قلب الوحش إلى هجوم مكشوف';
  else if (m.position === 'attack') hint.value = 'تم التحويل إلى دفاع مكشوف';
  else hint.value = 'تم التحويل إلى هجوم';
}

watch(
  [
    selectedAttacker,
    attackMode,
    aimTargetZone,
    () => foe.value?.monsters.map((m) => m?.instanceId).join(),
  ],
  () => {
    void nextTick().then(updateAimLine);
  },
);

function zoneRect(selector: string): ZoneRect | null {
  const field = fieldRef.value;
  const el = field?.querySelector(selector) as HTMLElement | null;
  if (!field || !el) return null;
  const fr = field.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - fr.left,
    y: r.top + r.height / 2 - fr.top,
    w: Math.max(r.width, 72),
    h: Math.max(r.height, 100),
  };
}

function zoneCenter(selector: string) {
  const r = zoneRect(selector);
  if (!r) return null;
  return { x: r.x, y: r.y };
}

function firstFilledFoeZone(): number | null {
  if (!foe.value) return null;
  const i = foe.value.monsters.findIndex((m) => !!m);
  return i >= 0 ? i : null;
}

function setAimTarget(zone: number | null) {
  if (!attackMode.value || selectedAttacker.value == null) return;
  if (zone != null && !foe.value?.monsters[zone]) return;
  if (aimTargetZone.value !== zone) duelSfx.play('aim');
  aimTargetZone.value = zone;
  updateAimLine();
}

function clearAimTarget() {
  aimTargetZone.value = null;
  updateAimLine();
}

function updateAimLine() {
  if (!attackMode.value || selectedAttacker.value == null) {
    aimLine.value = null;
    return;
  }
  const from = zoneCenter(`[data-my-monster="${selectedAttacker.value}"]`);
  if (!from) {
    aimLine.value = null;
    return;
  }

  const preferred =
    aimTargetZone.value != null && foe.value?.monsters[aimTargetZone.value]
      ? aimTargetZone.value
      : firstFilledFoeZone();

  if (preferred == null) {
    // لا وحوش — صوّب لأعلى الساحة (هجوم مباشر)
    if (fieldRef.value) {
      const fr = fieldRef.value.getBoundingClientRect();
      aimLine.value = { x1: from.x, y1: from.y, x2: fr.width * 0.5, y2: 22 };
    } else {
      aimLine.value = null;
    }
    return;
  }

  const to = zoneCenter(`[data-foe-monster="${preferred}"]`);
  if (!to) {
    aimLine.value = null;
    return;
  }
  aimLine.value = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

async function playBoltTo(fromSel: string, toSel: string, kind: 'monster' | 'direct') {
  await nextTick();
  const from = zoneCenter(fromSel);
  let to = zoneCenter(toSel);
  if (!from || !to) return false;
  // هجوم مباشر: اضرب أعلى الساحة بقوة (اتجاه حياة الخصم)
  if (kind === 'direct' && fieldRef.value) {
    const fr = fieldRef.value.getBoundingClientRect();
    to = { x: fr.width * 0.5, y: 18 };
  }
  aimLine.value = null;
  bolt.value = {
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    active: true,
    kind,
    key: Date.now(),
  };
  await new Promise((r) => window.setTimeout(r, kind === 'direct' ? 480 : 320));
  bolt.value = null;
  return true;
}

function predictAttackShatter(
  attacker: { cardId: string; position: string; atkBuff: number; defBuff: number },
  defender: { cardId: string; position: string; atkBuff: number; defBuff: number },
) {
  const atk = atkOf(attacker);
  const defVal = defender.position === 'defense' ? defOf(defender) : atkOf(defender);
  let killAtk = false;
  let killDef = false;
  if (defender.position === 'attack') {
    if (atk > defVal) killDef = true;
    else if (atk < defVal) killAtk = true;
    else {
      killAtk = true;
      killDef = true;
    }
  } else if (atk > defVal) {
    killDef = true;
  }
  return { killAtk, killDef, atk, defVal };
}

async function onEnemyMonster(zone: number) {
  const m = foe.value?.monsters[zone];
  if (m?.faceUp && m.cardId !== 'hidden') inspectId.value = m.cardId;
  else if (m && !m.faceUp) {
    inspectId.value = null;
    if (!attackMode.value) hint.value = 'وحش مقلوب للخصم — هاجمه لكشفه';
  }

  // تسريع: في مرحلة القتال أو وضع الهجوم، مهاجم واحد يُختار تلقائياً
  if (selectedAttacker.value == null && (attackMode.value || inBattle.value)) {
    attackMode.value = true;
    armSingleAttacker();
  }

  if (!inBattle.value) {
    if (m && hasAttackerReady.value) {
      hint.value = 'اضغط «مرحلة القتال» أو «هجوم» أولاً';
    }
    return;
  }

  if (selectedAttacker.value == null) {
    if (m?.faceUp || m) {
      hint.value = hasAttackerReady.value
        ? 'اختر وحشك المهاجم ثم اضغط هدف الخصم'
        : 'لا يوجد مهاجم جاهز';
    }
    return;
  }
  if (attackBusy.value) return;
  attackBusy.value = true;
  const attackerZone = selectedAttacker.value;
  const fromSel = `[data-my-monster="${attackerZone}"]`;
  const toSel = `[data-foe-monster="${zone}"]`;
  const atkSnap = me.value?.monsters[attackerZone];
  const defSnap = foe.value?.monsters[zone];
  if (!atkSnap || !defSnap) {
    attackBusy.value = false;
    return;
  }
  const atkRect = zoneRect(fromSel);
  const defRect = zoneRect(toSel);
  const prediction = predictAttackShatter(atkSnap, defSnap);
  hitFxZone.value = zone;
  hint.value = 'هجوم!';

  // نفّذ الهجوم فوراً — التأثير بالتوازي (بدون انتظار الصاعقة)
  duelSfx.play('attack');
  game.action({
    type: 'declare_attack',
    attackerZone,
    targetZone: zone,
  });
  selectedAttacker.value = null;
  aimTargetZone.value = null;
  aimLine.value = null;

  void playBoltTo(fromSel, toSel, 'monster').then(() => {
    hitFxZone.value = null;
  });

  window.setTimeout(() => {
    if (prediction.killAtk) {
      pushShatter({
        cardId: atkSnap.cardId,
        atk: prediction.atk,
        def: defOf(atkSnap),
        rect: atkRect,
      });
    }
    if (prediction.killDef) {
      pushShatter({
        cardId: defSnap.cardId,
        atk: atkOf(defSnap),
        def: prediction.defVal,
        rect: defRect,
      });
    }
  }, 160);

  window.setTimeout(() => {
    attackBusy.value = false;
    if (hasAttackerReady.value) {
      attackMode.value = true;
      if (!armSingleAttacker()) {
        hint.value = 'يمكنك اختيار مهاجم آخر';
      }
    } else {
      attackMode.value = false;
      hint.value = 'تم الهجوم';
    }
  }, 180);
}

async function directAttack() {
  if (selectedAttacker.value == null) {
    if (!armSingleAttacker()) {
      hint.value = 'اختر وحشك المهاجم أولاً';
      return;
    }
  }
  if (!canDirect.value) {
    hint.value = 'الهجوم المباشر غير متاح';
    return;
  }
  if (attackBusy.value || selectedAttacker.value == null) return;
  attackBusy.value = true;
  const attackerZone = selectedAttacker.value;
  const fromSel = `[data-my-monster="${attackerZone}"]`;
  hint.value = 'هجوم مباشر!';
  directFx.value = true;
  lpFlashFoe.value = true;
  duelSfx.play('direct');

  game.action({
    type: 'declare_attack',
    attackerZone,
    targetZone: 'player',
  });
  selectedAttacker.value = null;
  attackMode.value = false;
  aimTargetZone.value = null;
  aimLine.value = null;

  void playBoltTo(fromSel, '[data-direct-target]', 'direct').finally(() => {
    directFx.value = false;
    lpFlashFoe.value = false;
  });

  window.setTimeout(() => {
    attackBusy.value = false;
  }, 200);
  hint.value = 'ضربة مباشرة على حياة الخصم!';
}

function goBattle() {
  if (!canBattlePhase.value) return;
  game.action({ type: 'go_phase', phase: 'battle' });
  duelSfx.play('phase');
  clearHandSelection();
  if (hasAttackerReady.value) {
    attackMode.value = true;
    if (!armSingleAttacker()) {
      hint.value = 'مرحلة القتال — اختر وحشاً للهجوم';
    }
  } else {
    attackMode.value = false;
    hint.value = 'لا يوجد مهاجم جاهز — أنهِ الدور';
  }
}

function endTurn() {
  if (!canEnd.value) return;
  attackMode.value = false;
  selectedAttacker.value = null;
  selectedField.value = null;
  selectedSpellZone.value = null;
  clearHandSelection();
  hint.value = 'انتهى دورك';
  duelSfx.play('endTurn');
  game.action({ type: 'end_turn' });
}

watch(
  () => me.value?.hand?.join('|'),
  () => {
    if (selectedHandCardId.value && currentHandIndex.value == null) {
      clearHandSelection();
    } else if (currentHandIndex.value != null) {
      selectedHand.value = currentHandIndex.value;
    }
  },
);

function snapshotField(): FieldSnap | null {
  if (!me.value || !foe.value) return null;
  return {
    myMonsters: me.value.monsters.map((m, i) =>
      m
        ? {
            instanceId: m.instanceId,
            cardId: m.cardId,
            atk: atkOf(m),
            def: defOf(m),
            rect: zoneRect(`[data-my-monster="${i}"]`),
          }
        : null,
    ),
    foeMonsters: foe.value.monsters.map((m, i) =>
      m
        ? {
            instanceId: m.instanceId,
            cardId: m.cardId,
            atk: atkOf(m),
            def: defOf(m),
            rect: zoneRect(`[data-foe-monster="${i}"]`),
          }
        : null,
    ),
    mySpells: me.value.spellTraps.map((s, i) =>
      s
        ? {
            instanceId: s.instanceId,
            cardId: s.cardId !== 'hidden' ? s.cardId : 'hidden',
            rect: zoneRect(`[data-my-spell="${i}"]`),
          }
        : null,
    ),
    foeSpells: foe.value.spellTraps.map((s, i) =>
      s
        ? {
            instanceId: s.instanceId,
            cardId: s.cardId !== 'hidden' ? s.cardId : 'hidden',
            rect: zoneRect(`[data-foe-spell="${i}"]`),
          }
        : null,
    ),
  };
}

const recentShatterKeys = new Set<string>();

function pushShatter(opts: {
  cardId: string;
  atk?: number;
  def?: number;
  rect: ZoneRect | null;
}) {
  const field = fieldRef.value;
  if (!field) return false;
  const fr = field.getBoundingClientRect();
  const rect = opts.rect ?? {
    x: fr.width * 0.5,
    y: fr.height * 0.45,
    w: 96,
    h: 134,
  };

  const key = `${opts.cardId}:${Math.round(rect.x)}:${Math.round(rect.y)}`;
  if (recentShatterKeys.has(key)) return false;
  recentShatterKeys.add(key);
  window.setTimeout(() => recentShatterKeys.delete(key), 500);

  const faceDown = opts.cardId === 'hidden';
  const card = faceDown ? null : map.value[opts.cardId] ?? null;
  const id = ++shatterSeq;
  shatters.value = [
    ...shatters.value,
    {
      id,
      card,
      faceDown: faceDown || !card,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      atk: opts.atk,
      def: opts.def,
    },
  ];
  // دفعة صوت واحدة لو انكسرت عدة أوراق بنفس اللحظة
  const now = Date.now();
  if (now - sfxDestroyBurst > 90) {
    duelSfx.play('destroy');
    sfxDestroyBurst = now;
  }
  return true;
}

function removeShatter(id: number) {
  shatters.value = shatters.value.filter((s) => s.id !== id);
}

function shatterDiffFromPrev() {
  const prev = prevField.value;
  if (!prev || !me.value || !foe.value) return;

  for (let i = 0; i < 3; i++) {
    const prevMine = prev.myMonsters[i];
    const nextMine = me.value.monsters[i];
    if (prevMine && (!nextMine || nextMine.instanceId !== prevMine.instanceId)) {
      pushShatter({
        cardId: prevMine.cardId,
        atk: prevMine.atk,
        def: prevMine.def,
        rect: prevMine.rect || zoneRect(`[data-my-monster="${i}"]`),
      });
    }
    const prevFoe = prev.foeMonsters[i];
    const nextFoe = foe.value.monsters[i];
    if (prevFoe && (!nextFoe || nextFoe.instanceId !== prevFoe.instanceId)) {
      pushShatter({
        cardId: prevFoe.cardId,
        atk: prevFoe.atk,
        def: prevFoe.def,
        rect: prevFoe.rect || zoneRect(`[data-foe-monster="${i}"]`),
      });
    }
    const prevMs = prev.mySpells[i];
    const nextMs = me.value.spellTraps[i];
    if (prevMs && (!nextMs || nextMs.instanceId !== prevMs.instanceId)) {
      pushShatter({
        cardId: prevMs.cardId,
        rect: prevMs.rect || zoneRect(`[data-my-spell="${i}"]`),
      });
    }
    const prevFs = prev.foeSpells[i];
    const nextFs = foe.value.spellTraps[i];
    if (prevFs && (!nextFs || nextFs.instanceId !== prevFs.instanceId)) {
      pushShatter({
        cardId: prevFs.cardId,
        rect: prevFs.rect || zoneRect(`[data-foe-spell="${i}"]`),
      });
    }
  }
}

watch(
  () =>
    [
      me.value?.life,
      foe.value?.life,
      me.value?.monsters?.map((m) => m?.instanceId ?? '-').join('|'),
      foe.value?.monsters?.map((m) => m?.instanceId ?? '-').join('|'),
      me.value?.spellTraps?.map((s) => s?.instanceId ?? '-').join('|'),
      foe.value?.spellTraps?.map((s) => s?.instanceId ?? '-').join('|'),
    ] as const,
  async () => {
    if (!me.value || !foe.value) return;
    if (prevLife.value) {
      if (me.value.life < prevLife.value.me) {
        lpFlashMe.value = true;
        duelSfx.play('damage');
        window.setTimeout(() => {
          lpFlashMe.value = false;
        }, 650);
      } else if (me.value.life > prevLife.value.me) {
        duelSfx.play('heal');
      }
      if (foe.value.life < prevLife.value.foe) {
        lpFlashFoe.value = true;
        duelSfx.play('hit');
        window.setTimeout(() => {
          lpFlashFoe.value = false;
        }, 650);
      } else if (foe.value.life > prevLife.value.foe) {
        duelSfx.play('heal');
      }
    }
    prevLife.value = { me: me.value.life, foe: foe.value.life };

    const ids = me.value.monsters.filter(Boolean).map((m) => m!.instanceId);
    const newborn = ids.find((id) => !prevMonsterIds.value.includes(id));
    if (newborn) {
      const z = me.value.monsters.findIndex((m) => m?.instanceId === newborn);
      if (z >= 0) {
        const born = me.value.monsters[z];
        duelSfx.play(born?.faceUp ? 'summon' : 'set');
        void nextTick(() => {
          summonFxZone.value = z;
          window.setTimeout(() => {
            if (summonFxZone.value === z) summonFxZone.value = null;
          }, 1100);
        });
      }
    }
    prevMonsterIds.value = ids;

    const foeIds = foe.value.monsters.filter(Boolean).map((m) => m!.instanceId);
    const foeNew = foe.value.monsters.find(
      (m) => m && !prevFoeMonsterIds.value.includes(m.instanceId),
    );
    if (foeNew) duelSfx.play(foeNew.faceUp ? 'summon' : 'set');
    prevFoeMonsterIds.value = foeIds;

    // Shatter first using previous snapshot rects (works for AI destroys too)
    shatterDiffFromPrev();
    await nextTick();
    prevField.value = snapshotField();
  },
  { deep: true },
);

watch(
  () => me.value?.hand?.[0],
  (id) => {
    if (id && !inspectId.value) inspectId.value = id;
  },
  { immediate: true },
);

watch(myTurn, (turn) => {
  if (turn) {
    attackMode.value = false;
    selectedAttacker.value = null;
    selectedField.value = null;
    selectedSpellZone.value = null;
    hint.value = 'دورك — اختر بطاقة من اليد';
    duelSfx.play('phase');
  }
});

watch(
  () => me.value?.handCount ?? me.value?.hand?.length ?? 0,
  (n) => {
    if (prevHandCount.value != null && n > prevHandCount.value) {
      duelSfx.play('draw');
    }
    prevHandCount.value = n;
  },
);

watch(
  () => state.value?.phase ?? null,
  (phase) => {
    if (phase && prevPhase.value && phase !== prevPhase.value) {
      duelSfx.play('phase');
    }
    prevPhase.value = phase;
  },
);

watch(
  () => state.value?.winner ?? null,
  (w) => {
    if (!w || w === prevWinner.value) return;
    prevWinner.value = w;
    duelSfx.play(w === state.value?.you ? 'win' : 'lose');
  },
);

watch(
  () => game.error,
  (err) => {
    if (err) duelSfx.play('error');
  },
);

onMounted(() => {
  bindSfxUnlock();
  sfxMuted.value = duelSfx.muted;
});

onUnmounted(() => {
  /* AudioContext يبقى مشتركاً بين الشاشات */
});
</script>

<template>
  <section
    v-if="state && me && foe"
    class="duel"
    :class="{ 'spell-pulse': spellFx, 'direct-strike': directFx }"
  >
    <div class="bg" aria-hidden="true" />
    <div v-if="directFx" class="direct-overlay" aria-hidden="true">
      <div class="direct-flash" />
      <p class="direct-banner">هجوم مباشر!</p>
    </div>

    <header class="top">
      <PlayerBadge name="المنافس" :life="foe.life" side="opponent" :flash="lpFlashFoe" />
      <div class="meta" role="toolbar" aria-label="حالة المباراة">
        <span class="pill mode" :title="modeLabel">
          <span class="pill-dot" aria-hidden="true" />
          <span class="mode-full">{{ modeLabel }}</span>
          <span class="mode-short">{{ game.mode === 'ai' ? 'آلي' : 'غرفة' }}</span>
        </span>
        <span class="pill turn" :title="`الدور ${state.turnNumber}`">
          <span class="pill-kicker">الدور</span>
          <span class="pill-num">{{ state.turnNumber }}</span>
        </span>
        <button
          class="sfx-btn"
          type="button"
          :aria-pressed="sfxMuted"
          :aria-label="sfxMuted ? 'تشغيل الصوت' : 'كتم الصوت'"
          :title="sfxMuted ? 'تشغيل الصوت' : 'كتم الصوت'"
          @click="toggleSfx"
        >
          <span aria-hidden="true">{{ sfxMuted ? '🔇' : '🔊' }}</span>
        </button>
        <button class="exit" type="button" aria-label="خروج" @click="game.goHome()">
          <span class="exit-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
              <path
                d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M13 16l4-4-4-4M9 12h8"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="exit-label">خروج</span>
        </button>
      </div>
    </header>

    <div class="layout">
      <aside class="inspect panel-glass" :class="{ 'inspect-live': !!inspectCard }">
        <DuelCardFace
          v-if="inspectCard"
          :card="inspectCard"
          :atk="inspectCard.atk"
          :def="inspectCard.def"
        />
        <p v-else class="hint">اختر بطاقة للمعاينة</p>
        <div class="summon-mode summon-mode--side">
          <span class="summon-mode-label">وضع الاستدعاء</span>
          <div class="summon-toggle summon-toggle--3" role="group" aria-label="وضع الاستدعاء">
            <button
              type="button"
              class="summon-opt"
              :class="{ active: summonMode === 'attack' }"
              @click="summonMode = 'attack'"
            >
              <span class="opt-ico" aria-hidden="true">⚔</span>
              هجوم مكشوف
            </button>
            <button
              type="button"
              class="summon-opt"
              :class="{ active: summonMode === 'defense_up' }"
              @click="summonMode = 'defense_up'"
            >
              <span class="opt-ico" aria-hidden="true">🛡</span>
              دفاع مكشوف
            </button>
            <button
              type="button"
              class="summon-opt"
              :class="{ active: summonMode === 'defense_down' }"
              @click="summonMode = 'defense_down'"
            >
              <span class="opt-ico" aria-hidden="true">🂠</span>
              دفاع مقلوب
            </button>
          </div>
        </div>
      </aside>

      <div class="arena">
        <div class="opp-hand">
          <div
            v-for="n in foe.handCount"
            :key="'oh' + n"
            class="mini-back"
            :style="{ transform: `rotate(${(n - (foe.handCount + 1) / 2) * 4}deg)` }"
          >
            <img src="/duel/card-back.jpg" alt="" />
          </div>
        </div>

        <div class="board">
          <div class="pile-col opp-piles">
            <button
              type="button"
              class="deck opp-deck"
              title="مجموعة الخصم"
              aria-label="مجموعة الخصم"
            >
              <img src="/duel/card-back.jpg" alt="" />
              <span>{{ foe.deckCount }}</span>
            </button>
            <button
              type="button"
              class="grave opp-grave"
              :class="{ empty: !(foe.graveyard?.length) }"
              title="مقبرة الخصم"
              aria-label="مقبرة الخصم"
              @click="openGy('foe')"
            >
              <span class="grave-stack" aria-hidden="true">
                <i /><i /><i />
              </span>
              <span class="grave-label">مقبرة</span>
              <span class="grave-count">{{ foe.graveyard?.length ?? 0 }}</span>
            </button>
          </div>

          <div ref="fieldRef" class="field">
            <div class="direct-target" data-direct-target aria-hidden="true" />

            <svg v-if="aimLine" class="aim-layer" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="aim-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#7af0ff" stop-opacity="0.25" />
                  <stop offset="55%" stop-color="#5de4ff" stop-opacity="0.95" />
                  <stop offset="100%" stop-color="#ff7a6a" stop-opacity="1" />
                </linearGradient>
                <marker
                  id="aim-head"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L10,5 L0,10 Z" fill="#ff7a6a" />
                </marker>
              </defs>
              <line
                :x1="aimLine.x1"
                :y1="aimLine.y1"
                :x2="aimLine.x2"
                :y2="aimLine.y2"
                class="aim-line-glow"
              />
              <line
                :x1="aimLine.x1"
                :y1="aimLine.y1"
                :x2="aimLine.x2"
                :y2="aimLine.y2"
                class="aim-line"
                marker-end="url(#aim-head)"
              />
              <circle :cx="aimLine.x1" :cy="aimLine.y1" r="7" class="aim-origin" />
              <circle :cx="aimLine.x2" :cy="aimLine.y2" r="10" class="aim-lock" />
              <circle :cx="aimLine.x2" :cy="aimLine.y2" r="4" class="aim-lock-core" />
            </svg>

            <AttackBolt
              v-if="bolt?.active"
              :key="bolt.key"
              :x1="bolt.x1"
              :y1="bolt.y1"
              :x2="bolt.x2"
              :y2="bolt.y2"
              :active="bolt.active"
              :kind="bolt.kind"
            />

            <CardShatter
              v-for="s in shatters"
              :key="s.id"
              :card="s.card"
              :face-down="s.faceDown"
              :x="s.x"
              :y="s.y"
              :w="s.w"
              :h="s.h"
              :atk="s.atk"
              :def="s.def"
              @done="removeShatter(s.id)"
            />

            <div class="row">
              <ZoneSlot
                v-for="(s, i) in foe.spellTraps"
                :key="'fs' + i"
                kind="spell"
                :filled="!!s"
                :data-foe-spell="i"
                class="spell-zone"
                :class="{ readable: !!(s && s.faceUp && s.cardId !== 'hidden') }"
                @click="onFoeSpell(i)"
              >
                <DuelCardFace
                  v-if="s"
                  class="zone-face"
                  :class="{ 'can-peek': s.faceUp && s.cardId !== 'hidden' }"
                  :card="s.faceUp && s.cardId !== 'hidden' ? cardOf(s.cardId) : null"
                  :face-down="!s.faceUp || s.cardId === 'hidden'"
                  compact
                  @mouseenter="peekCard(s.faceUp ? s.cardId : null)"
                />
                <span
                  v-if="s?.faceUp && s.cardId !== 'hidden' && cardOf(s.cardId)"
                  class="zone-caption"
                >
                  {{ cardOf(s.cardId)?.nameAr }}
                </span>
              </ZoneSlot>
            </div>
            <div class="row">
              <ZoneSlot
                v-for="(m, i) in foe.monsters"
                :key="'fm' + i"
                kind="monster"
                :filled="!!m"
                :data-foe-monster="i"
                :highlight="
                  attackMode &&
                  selectedAttacker != null &&
                  !!m &&
                  (aimTargetZone === i || (aimTargetZone == null && i === firstFilledFoeZone()))
                "
                :defense="m?.position === 'defense'"
                :class="{
                  'is-target':
                    attackMode && selectedAttacker != null && !!m && aimTargetZone === i,
                  'is-target-soft':
                    attackMode &&
                    selectedAttacker != null &&
                    !!m &&
                    aimTargetZone !== i,
                }"
                @click="onEnemyMonster(i)"
                @mouseenter="
                  () => {
                    if (m) {
                      peekCard(m.faceUp ? m.cardId : null);
                      setAimTarget(i);
                    }
                  }
                "
                @mouseleave="clearAimTarget"
              >
                <DuelCardFace
                  v-if="m"
                  class="zone-face"
                  :class="{ 'can-peek': m.faceUp && m.cardId !== 'hidden' }"
                  :card="m.faceUp ? cardOf(m.cardId) : null"
                  :face-down="!m.faceUp"
                  compact
                  :position="m.position"
                  :atk="m.faceUp ? atkOf(m) : undefined"
                  :def="m.faceUp ? defOf(m) : undefined"
                  :hit="hitFxZone === i"
                />
              </ZoneSlot>
            </div>

            <PhaseBar :phase="state.phase" :your-turn="myTurn" />

            <div class="row">
              <ZoneSlot
                v-for="(m, i) in me.monsters"
                :key="'mm' + i"
                kind="monster"
                :filled="!!m"
                :data-my-monster="i"
                :highlight="
                  (canSummon && !m) ||
                  (attackMode && !!m && m.canAttack && m.position === 'attack') ||
                  (!attackMode && inMain && selectedField === i && !!m)
                "
                :defense="m?.position === 'defense'"
                :class="{ charging: selectedAttacker === i }"
                @click="pickMyMonster(i)"
              >
                <DuelCardFace
                  v-if="m"
                  class="zone-face"
                  :class="{ 'can-peek': m.faceUp && m.cardId !== 'hidden' }"
                  :card="m.faceUp ? cardOf(m.cardId) : null"
                  :face-down="!m.faceUp"
                  compact
                  :position="m.position"
                  :atk="m.faceUp ? atkOf(m) : undefined"
                  :def="m.faceUp ? defOf(m) : undefined"
                  :summoning="summonFxZone === i"
                  :selected="selectedAttacker === i || selectedField === i"
                  @mouseenter="peekCard(m.faceUp ? m.cardId : null)"
                />
              </ZoneSlot>
            </div>
            <div class="row">
              <ZoneSlot
                v-for="(s, i) in me.spellTraps"
                :key="'ms' + i"
                kind="spell"
                :filled="!!s"
                :data-my-spell="i"
                class="spell-zone"
                :class="{ readable: !!(s && s.faceUp) }"
                :highlight="
                  ((canSetSpell || canSetTrap) && !s) || selectedSpellZone === i
                "
                @click="pickMySpellTrap(i)"
              >
                <DuelCardFace
                  v-if="s"
                  class="zone-face"
                  :class="{ 'can-peek': s.cardId !== 'hidden' }"
                  :card="s.faceUp && s.cardId !== 'hidden' ? cardOf(s.cardId) : null"
                  :face-down="!s.faceUp"
                  compact
                  :selected="selectedSpellZone === i"
                  @mouseenter="peekCard(s.cardId !== 'hidden' ? s.cardId : null)"
                />
                <span
                  v-if="s?.faceUp && s.cardId !== 'hidden' && cardOf(s.cardId)"
                  class="zone-caption"
                >
                  {{ cardOf(s.cardId)?.nameAr }}
                </span>
              </ZoneSlot>
            </div>
          </div>

          <div class="pile-col my-piles">
            <button
              type="button"
              class="grave my-grave"
              :class="{ empty: !(me.graveyard?.length) }"
              title="مقبرتك"
              aria-label="مقبرتك"
              @click="openGy('me')"
            >
              <span class="grave-stack" aria-hidden="true">
                <i /><i /><i />
              </span>
              <span class="grave-label">مقبرة</span>
              <span class="grave-count">{{ me.graveyard?.length ?? 0 }}</span>
            </button>
            <button
              type="button"
              class="deck my-deck"
              title="مجموعتك"
              aria-label="مجموعتك"
            >
              <img src="/duel/card-back.jpg" alt="" />
              <span>{{ me.deckCount }}</span>
            </button>
          </div>
        </div>

        <Teleport to="body">
          <div
            v-if="gyOpen"
            class="gy-overlay"
            @click.self="gyOpen = null"
          >
            <div class="gy-panel" role="dialog" :aria-label="gyTitle">
              <header class="gy-head">
                <strong>{{ gyTitle }}</strong>
                <span class="gy-n">{{ gyList.length }}</span>
                <button type="button" class="gy-close" @click="gyOpen = null">إغلاق</button>
              </header>
              <div class="gy-grid">
                <button
                  v-for="(id, i) in gyList"
                  :key="id + '-' + i"
                  type="button"
                  class="gy-card"
                  :class="{ active: inspectId === id }"
                  @click="pickGyCard(id)"
                >
                  <DuelCardFace
                    :card="cardOf(id)"
                    :atk="cardOf(id)?.atk"
                    :def="cardOf(id)?.def"
                  />
                </button>
              </div>
            </div>
          </div>
        </Teleport>
      </div>

      <div class="hand-dock">
        <div class="summon-mode summon-mode--dock">
          <span class="summon-mode-label">وضع الاستدعاء</span>
          <div class="summon-toggle summon-toggle--3" role="group" aria-label="وضع الاستدعاء">
            <button
              type="button"
              class="summon-opt"
              :class="{ active: summonMode === 'attack' }"
              @click="summonMode = 'attack'"
            >
              <span class="opt-ico" aria-hidden="true">⚔</span>
              هجوم مكشوف
            </button>
            <button
              type="button"
              class="summon-opt"
              :class="{ active: summonMode === 'defense_up' }"
              @click="summonMode = 'defense_up'"
            >
              <span class="opt-ico" aria-hidden="true">🛡</span>
              دفاع مكشوف
            </button>
            <button
              type="button"
              class="summon-opt"
              :class="{ active: summonMode === 'defense_down' }"
              @click="summonMode = 'defense_down'"
            >
              <span class="opt-ico" aria-hidden="true">🂠</span>
              دفاع مقلوب
            </button>
          </div>
        </div>
        <p class="guide">{{ statusHint }}</p>
        <div class="hand" aria-label="يدك">
          <DuelCardFace
            v-for="(id, i) in me.hand || []"
            :key="id + '-' + i"
            class="hand-card"
            :card="cardOf(id)"
            compact
            :selected="currentHandIndex === i"
            :style="{ '--i': i - ((me.hand?.length || 1) - 1) / 2 }"
            @click="selectHand(i)"
            @mouseenter="peekCard(id)"
          />
        </div>
      </div>

      <div class="actions-wrap">
        <ActionPanel
          :can-summon="canSummon"
          :can-spell="canSpell"
          :can-set-spell="canSetSpell"
          :can-set-trap="canSetTrap"
          :can-change-pos="canChangePos"
          :can-battle-phase="canBattlePhase"
          :can-attack="canAttack"
          :can-direct="canDirect"
          :can-end="canEnd"
          :attack-mode="attackMode"
          :log-open="logOpen"
          @summon="summonSelected"
          @spell="activateSelectedSpell"
          @set-spell="setSelectedSpell"
          @set-trap="setSelectedTrap"
          @change-pos="changeSelectedPosition"
          @attack="enableAttackMode"
          @battle-phase="goBattle"
          @direct="directAttack"
          @end-turn="endTurn"
          @toggle-log="logOpen = !logOpen"
        />
        <div v-if="logOpen" class="log panel-glass">
          <ul v-if="state.log.length">
            <li v-for="(line, i) in state.log" :key="i">{{ line }}</li>
          </ul>
          <p v-else class="log-empty">لا أحداث بعد في هذا الدور</p>
        </div>
      </div>
    </div>

    <footer class="bottom">
      <PlayerBadge name="أنت" :life="me.life" side="player" :flash="lpFlashMe" />
      <p v-if="state.winner" class="banner">
        {{ state.winner === state.you ? 'انتهت المباراة — فوزك' : 'انتهت المباراة — خسارة' }}
      </p>
    </footer>
  </section>
  <section v-else class="loading">جاري تحميل الساحة...</section>
</template>

<style scoped>
.duel {
  position: relative;
  height: 100vh;
  overflow: hidden;
  color: var(--duel-ink);
  font-family: Cairo, system-ui, sans-serif;
  display: flex;
  flex-direction: column;
}

.bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(170, 210, 250, 0.28), rgba(255, 255, 255, 0.18)),
    url('/duel/arena-bg.jpg') center / cover no-repeat;
  filter: saturate(1.05);
  z-index: 0;
}

.top,
.bottom,
.layout {
  position: relative;
  z-index: 1;
}

.top {
  direction: ltr;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 16px 0;
  gap: 12px;
}

.top :deep(.hud),
.meta {
  direction: rtl;
}

.meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: nowrap;
  flex: 0 1 auto;
  min-width: 0;
  justify-content: flex-end;
  padding: 5px;
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(232, 242, 255, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow:
    0 8px 18px rgba(40, 90, 160, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}

.mode-short {
  display: none;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #eef5ff);
  border: 1px solid #c5d8f3;
  box-shadow: 0 1px 0 #d7e4f7, inset 0 1px 0 rgba(255, 255, 255, 0.95);
  color: #1f5fbf;
  font-weight: 800;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  flex: 0 0 auto;
}

.pill.mode .pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #9dffc2, #22c55e 55%, #15803d);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2), 0 0 8px rgba(34, 197, 94, 0.45);
  flex: 0 0 auto;
}

.pill.turn {
  color: #5b6f8c;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), #e8eef8);
  border-color: #d0dceb;
  gap: 5px;
}

.pill-kicker {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.85;
}

.pill-num {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: linear-gradient(180deg, #5aa4ff, #2f73e8);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  box-shadow: 0 2px 0 #1f5fbf;
}

.sfx-btn {
  appearance: none;
  border: none;
  border-radius: 999px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.82);
  color: #1d2a44;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(20, 40, 80, 0.18);
  transition: transform 0.12s ease, filter 0.12s ease;
}

.sfx-btn:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.sfx-btn[aria-pressed='true'] {
  background: rgba(30, 45, 70, 0.82);
  color: #fff;
}

.exit {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 7px 12px 7px 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(180deg, #3a4d6d, #1d2a44);
  color: #fff;
  font-weight: 800;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 0 #0f172a, 0 6px 12px rgba(20, 35, 60, 0.25);
  transition: transform 0.12s ease, filter 0.12s ease;
}

.exit:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.exit:active {
  transform: translateY(1px);
  box-shadow: 0 1px 0 #0f172a;
}

.exit-ico {
  display: grid;
  place-items: center;
  opacity: 0.92;
}

.layout {
  direction: ltr;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 200px;
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    'inspect arena actions'
    '. hand .';
  gap: 10px 16px;
  padding: 6px 20px 0;
  align-items: start;
  justify-content: center;
  flex: 1;
  min-height: 0;
  width: min(100%, 1480px);
  margin-inline: auto;
}

.inspect {
  grid-area: inspect;
  align-self: start;
  width: 100%;
  max-width: 200px;
  transition: box-shadow 0.2s ease, outline-color 0.2s ease;
}

.inspect-live {
  outline: 2px solid rgba(93, 228, 255, 0.75);
  box-shadow: 0 0 0 4px rgba(93, 228, 255, 0.2), var(--duel-shadow);
}

.arena {
  grid-area: arena;
  align-self: stretch;
  min-height: 0;
  position: relative;
}

.hand-dock {
  grid-area: hand;
  direction: rtl;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0;
  justify-self: center;
  width: min(100%, 760px);
  padding: 4px 0 2px;
  overflow: visible;
}

.actions-wrap {
  grid-area: actions;
  display: grid;
  gap: 8px;
  justify-items: stretch;
  align-content: start;
  align-self: start;
  padding-top: 0;
  z-index: 4;
  width: 100%;
  max-width: 200px;
}

.inspect,
.actions-wrap,
.arena {
  direction: rtl;
}

.panel-glass {
  background: var(--duel-panel);
  border-radius: 16px;
  box-shadow: var(--duel-shadow);
  backdrop-filter: blur(8px);
}

.inspect {
  padding: 10px;
  display: grid;
  gap: 10px;
  align-content: start;
  height: auto;
}

.hint {
  margin: 0;
  color: var(--duel-muted);
  font-size: 13px;
  text-align: center;
  padding: 24px 8px;
}

.summon-mode {
  display: grid;
  gap: 8px;
}

.summon-mode--dock {
  display: none;
  width: min(100%, 280px);
  margin-inline: auto;
}

.summon-mode-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--duel-muted);
  text-align: center;
}

.summon-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 5px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(236, 244, 255, 0.92));
  border: 1.5px solid #9ec2ef;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.summon-toggle--3 {
  grid-template-columns: 1fr;
}

.summon-opt {
  appearance: none;
  border: 1.5px solid transparent;
  border-radius: 10px;
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
  color: #5b6b88;
  background: transparent;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.summon-opt .opt-ico {
  font-size: 15px;
  line-height: 1;
}

.summon-opt.active {
  color: #1f5fbf;
  background: linear-gradient(180deg, #ffffff, #e8f3ff);
  border-color: #6aa4ef;
  box-shadow: 0 2px 0 #c9dbf5, 0 6px 12px rgba(60, 120, 200, 0.15);
}

.summon-opt:not(.active):hover {
  color: #2f73e8;
  background: rgba(255, 255, 255, 0.65);
}

.arena {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  align-items: center;
  min-height: 0;
  height: 100%;
  width: 100%;
  position: relative;
}

.opp-hand {
  display: flex;
  justify-content: center;
  min-height: 54px;
  gap: 2px;
}

.mini-back {
  width: 42px;
  aspect-ratio: var(--card-ratio);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 6px 12px rgba(20, 40, 80, 0.25);
  transform-origin: bottom center;
}

.mini-back img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.board {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr) 68px;
  gap: 12px;
  align-items: center;
  width: min(100%, 680px);
  perspective: 900px;
  overflow: visible;
}

.pile-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  align-self: stretch;
}

.opp-piles {
  justify-content: flex-start;
  padding-top: 8px;
}

.my-piles {
  justify-content: flex-end;
  padding-bottom: 8px;
}

.field {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 12px 10px;
  border-radius: 20px;
  overflow: visible;
  background:
    radial-gradient(circle at 50% 50%, rgba(120, 190, 255, 0.18), transparent 58%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(180, 210, 245, 0.18));
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.2), var(--duel-shadow);
  transform: rotateX(6deg);
  transform-style: preserve-3d;
}

.direct-target {
  position: absolute;
  top: 4px;
  left: 50%;
  width: 24px;
  height: 24px;
  transform: translateX(-50%);
  pointer-events: none;
  opacity: 0;
}

.direct-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  display: grid;
  place-items: center;
}

.direct-flash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 12%, rgba(255, 60, 40, 0.55), transparent 42%),
    linear-gradient(180deg, rgba(255, 40, 40, 0.28), transparent 55%);
  animation: direct-flash 1.05s ease-out forwards;
}

.direct-banner {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 14px 28px;
  border-radius: 16px;
  font-size: clamp(22px, 4vw, 36px);
  font-weight: 900;
  letter-spacing: 0.04em;
  color: #fff8e8;
  text-shadow:
    0 2px 0 #8a1010,
    0 0 24px rgba(255, 60, 40, 0.85);
  background: linear-gradient(180deg, #ff5a3a, #c41818 55%, #8a0c0c);
  border: 2px solid rgba(255, 230, 160, 0.85);
  box-shadow:
    0 0 0 4px rgba(255, 80, 40, 0.25),
    0 16px 40px rgba(120, 20, 10, 0.45);
  animation: direct-banner 1.05s cubic-bezier(0.2, 1.4, 0.4, 1) forwards;
  transform: translateY(-18%);
}

.duel.direct-strike {
  animation: direct-shake 0.55s ease-in-out;
}

@keyframes direct-flash {
  0% {
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes direct-banner {
  0% {
    opacity: 0;
    transform: translateY(-8%) scale(0.7);
  }
  25% {
    opacity: 1;
    transform: translateY(-18%) scale(1.08);
  }
  70% {
    opacity: 1;
    transform: translateY(-18%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-28%) scale(1.05);
  }
}

@keyframes direct-shake {
  0%,
  100% {
    transform: translate(0, 0);
  }
  20% {
    transform: translate(-4px, 2px);
  }
  40% {
    transform: translate(5px, -3px);
  }
  60% {
    transform: translate(-3px, 3px);
  }
  80% {
    transform: translate(3px, -2px);
  }
}

.aim-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 15;
  overflow: visible;
}

.aim-line-glow {
  stroke: rgba(93, 228, 255, 0.35);
  stroke-width: 8;
  stroke-linecap: round;
  filter: blur(1.5px);
}

.aim-line {
  stroke: url(#aim-grad);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-dasharray: 14 10;
  animation: aim-dash 0.55s linear infinite;
  filter: drop-shadow(0 0 4px rgba(93, 228, 255, 0.8));
}

.aim-origin {
  fill: #5de4ff;
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 2;
  filter: drop-shadow(0 0 8px #5de4ff);
}

.aim-lock {
  fill: none;
  stroke: rgba(255, 122, 106, 0.9);
  stroke-width: 2.5;
  filter: drop-shadow(0 0 8px rgba(255, 100, 90, 0.75));
  animation: aim-lock-pulse 0.9s ease-in-out infinite;
}

.aim-lock-core {
  fill: #ff7a6a;
  filter: drop-shadow(0 0 6px #ff7a6a);
}

.field :deep(.charging .frame) {
  box-shadow:
    0 0 0 3px rgba(93, 228, 255, 0.95),
    0 0 24px rgba(93, 228, 255, 0.75);
  animation: charge-pulse 0.75s ease-in-out infinite;
}

.field :deep(.is-target .frame) {
  box-shadow: 0 0 0 3px rgba(255, 120, 100, 0.95), 0 0 20px rgba(255, 100, 90, 0.55);
}

.field :deep(.is-target-soft .frame) {
  box-shadow: 0 0 0 1px rgba(255, 160, 140, 0.45);
}

@keyframes aim-dash {
  to {
    stroke-dashoffset: -48;
  }
}

@keyframes aim-lock-pulse {
  0%,
  100% {
    r: 10;
    opacity: 1;
  }
  50% {
    r: 14;
    opacity: 0.65;
  }
}

@keyframes charge-pulse {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.25);
  }
}

.row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  justify-items: center;
  align-items: center;
  min-height: calc(112px / (2.5 / 3.5));
  overflow: visible;
}

/* مساحة لاسم التعويذة تحت الخانة */
.row:has(.zone-caption) {
  padding-bottom: 14px;
  margin-bottom: 2px;
}

.row :deep(.slot) {
  --slot-short: min(100%, 112px);
  width: var(--slot-short);
  max-width: none;
}

.row :deep(.slot.defense) {
  width: calc(var(--slot-short) / (2.5 / 3.5));
}

.zone-face {
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.zone-face.can-peek {
  pointer-events: auto;
  cursor: pointer;
}

.deck,
.grave {
  position: relative;
  width: 68px;
  aspect-ratio: var(--card-ratio);
  border-radius: 10px;
  box-shadow: var(--duel-shadow);
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.deck img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 10px;
  pointer-events: none;
}

.deck span,
.grave-count {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  z-index: 2;
  min-width: 28px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(20, 40, 80, 0.82);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  box-shadow: 0 2px 6px rgba(10, 25, 50, 0.35);
  pointer-events: none;
}

.grave {
  overflow: hidden;
  background: linear-gradient(165deg, #3a2a5c 0%, #1c2438 70%);
  border: 1.5px solid rgba(170, 150, 220, 0.55);
}

.grave.empty {
  opacity: 0.65;
}

.grave-stack {
  position: absolute;
  inset: 10px 8px 22px;
  pointer-events: none;
}

.grave-stack i {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  border: 1px solid rgba(220, 210, 255, 0.35);
  background:
    linear-gradient(145deg, rgba(120, 90, 180, 0.45), rgba(40, 50, 80, 0.55)),
    #2a3348;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
}

.grave-stack i:nth-child(1) {
  transform: translate(-3px, -3px) rotate(-4deg);
  opacity: 0.55;
}

.grave-stack i:nth-child(2) {
  transform: translate(2px, -1px) rotate(3deg);
  opacity: 0.75;
}

.grave-stack i:nth-child(3) {
  transform: none;
  opacity: 1;
}

.grave-label {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  font-size: 9px;
  font-weight: 800;
  color: #efe8ff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  white-space: nowrap;
}

.grave-count {
  background: rgba(70, 40, 120, 0.9);
}


.guide {
  margin: 0;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #1d4f9c;
  font-size: 13px;
  font-weight: 700;
  box-shadow: var(--duel-shadow);
  max-width: min(100%, 520px);
  text-align: center;
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  line-height: 1.35;
}

.hand {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 6px;
  flex: 0 0 auto;
  height: 148px;
  padding: 18px 8px 0;
  width: 100%;
  position: relative;
  z-index: 2;
  overflow: visible;
  box-sizing: border-box;
}

.hand-card {
  width: 94px;
  flex: 0 0 auto;
  transform: rotate(calc(var(--i) * 3.5deg));
  transform-origin: bottom center;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.hand-card.selected {
  transform: translateY(-12px) scale(1.06) rotate(calc(var(--i) * 2deg));
  z-index: 5;
  filter: drop-shadow(0 6px 12px rgba(40, 120, 200, 0.3));
}

@media (hover: hover) and (pointer: fine) {
  .hand-card:hover,
  .hand-card.selected:hover {
    transform: translateY(-10px) scale(1.05) rotate(calc(var(--i) * 2deg));
    z-index: 6;
    filter: drop-shadow(0 6px 12px rgba(20, 40, 80, 0.22));
  }

  /* إطار خفيف بدون filter يسبب وميض */
  .field :deep(.zone-face.can-peek:hover) {
    outline: 2px solid rgba(93, 228, 255, 0.85);
    outline-offset: 1px;
  }
}

.field :deep(.spell-zone) {
  position: relative;
  z-index: 1;
}

.field :deep(.zone-face.can-peek) {
  cursor: pointer;
}

.zone-caption {
  position: absolute;
  left: 50%;
  bottom: -16px;
  transform: translateX(-50%);
  z-index: 4;
  max-width: 118%;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(12, 28, 58, 0.78);
  color: #f4f8ff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  box-shadow: 0 4px 10px rgba(10, 30, 60, 0.35);
}

.log {
  width: 188px;
  max-height: 140px;
  overflow: auto;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--duel-muted);
}

.log ul {
  margin: 0;
  padding: 0 14px 0 0;
}

.log-empty {
  margin: 0;
  opacity: 0.75;
  font-size: 12px;
}

.bottom {
  direction: ltr;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 16px 10px;
  flex-wrap: wrap;
}

.bottom :deep(.badge),
.banner {
  direction: rtl;
}

.banner {
  margin: 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--duel-shadow);
  font-weight: 700;
}

.banner.err {
  color: var(--duel-danger);
}

.loading {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #9ec9f5;
  color: var(--duel-ink);
  font-family: Cairo, system-ui, sans-serif;
}

.spell-pulse .field {
  animation: duel-spell-burst 0.7s ease-out;
  filter: saturate(1.15) brightness(1.05);
}

@media (min-width: 1500px) {
  .layout {
    grid-template-columns: 220px minmax(0, 1fr) 210px;
    width: min(100%, 1600px);
  }

  .board {
    width: min(100%, 760px);
    grid-template-columns: 76px minmax(0, 1fr) 76px;
  }

  .row {
    min-height: calc(124px / (2.5 / 3.5));
  }

  .row :deep(.slot) {
    --slot-short: min(100%, 124px);
  }

  .hand-card {
    width: 102px;
  }

  .hand {
    height: 148px;
  }
}

@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 170px minmax(0, 1fr) 180px;
    gap: 8px 12px;
    padding: 4px 12px 0;
  }

  .board {
    width: min(100%, 580px);
    grid-template-columns: 56px minmax(0, 1fr) 56px;
  }

  .row {
    min-height: calc(96px / (2.5 / 3.5));
  }

  .row :deep(.slot) {
    --slot-short: min(100%, 96px);
  }

  .hand-card {
    width: 82px;
  }
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 150px minmax(0, 1fr) 168px;
  }

  .inspect,
  .actions-wrap {
    max-width: none;
  }

  .hand-card {
    width: 76px;
  }
}

@media (max-width: 980px) {
  .duel {
    height: 100dvh;
    overflow: hidden;
  }

  .top {
    padding: 6px 8px 0;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
  }

  .top :deep(.hud) {
    min-width: 0;
    transform: scale(0.9);
    transform-origin: top right;
  }

  .meta {
    gap: 4px;
    padding: 3px;
    max-width: none;
    flex: 0 0 auto;
  }

  .mode-full {
    display: none;
  }

  .mode-short {
    display: inline;
  }

  .pill {
    padding: 6px 8px;
    font-size: 11px;
    gap: 4px;
  }

  .pill.mode .pill-dot {
    width: 7px;
    height: 7px;
  }

  .pill-kicker {
    display: none;
  }

  .pill.turn {
    padding: 4px;
  }

  .pill-num {
    min-width: 22px;
    height: 22px;
    font-size: 11px;
    box-shadow: 0 1px 0 #1f5fbf;
  }

  .exit {
    padding: 6px;
    font-size: 11px;
    gap: 0;
    width: 30px;
    height: 30px;
    justify-content: center;
  }

  .exit-label {
    display: none;
  }

  .layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(220px, 1.35fr) auto auto;
    grid-template-areas:
      'arena'
      'hand'
      'actions';
    gap: 4px;
    padding: 0 6px;
    min-height: 0;
    width: 100%;
    max-width: none;
    align-items: stretch;
  }

  .inspect {
    display: none;
  }

  .summon-mode--dock {
    display: grid;
    gap: 4px;
    width: min(100%, 360px);
    margin-inline: auto;
  }

  .summon-mode--dock .summon-mode-label {
    font-size: 11px;
    white-space: nowrap;
    margin: 0;
  }

  .summon-mode--dock .summon-toggle--3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .summon-mode--dock .summon-opt {
    padding: 5px 4px;
    font-size: 10px;
    min-height: 36px;
    gap: 2px;
  }

  .arena {
    min-height: 0;
    overflow: hidden;
    justify-content: flex-start;
    gap: 2px;
  }

  .arena .board {
    width: min(100%, 100%);
    transform-origin: top center;
  }

  .arena :deep(.bar) {
    gap: 4px;
    transform: scale(0.9);
    transform-origin: center;
  }

  .arena :deep(.turn) {
    min-width: 58px;
    min-height: 28px;
    font-size: 11px;
    padding: 4px 10px;
  }

  .arena :deep(.step) {
    font-size: 10px;
    padding: 3px 7px;
  }

  .hand-dock {
    width: 100%;
    max-width: none;
    flex-shrink: 0;
    gap: 4px;
    justify-self: stretch;
    z-index: 5;
  }

  .actions-wrap {
    max-width: none;
    padding-top: 0;
    justify-items: stretch;
    width: 100%;
    z-index: 8;
    padding-bottom: 0;
    flex-shrink: 0;
    max-height: 36dvh;
    overflow: auto;
  }

  .actions-wrap .log {
    width: 100%;
    max-height: 72px;
  }

  .board {
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    width: min(100%, 100%);
    max-width: 400px;
    gap: 4px;
  }

  .field {
    transform: none;
    padding: 4px 3px;
    gap: 3px;
    border-radius: 12px;
  }

  .row {
    gap: 3px;
    min-height: calc(64px / (2.5 / 3.5));
  }

  .row :deep(.slot) {
    --slot-short: min(100%, 64px);
  }

  .opp-hand {
    min-height: 22px;
    margin-bottom: 0;
  }

  .mini-back {
    width: 24px;
  }

  .hand {
    height: auto;
    min-height: 88px;
    width: 100%;
    overflow-x: auto;
    overflow-y: visible;
    justify-content: safe center;
    padding: 8px 2px 2px;
    gap: 5px;
  }

  .hand-card {
    width: 62px;
    transform: rotate(calc(var(--i) * 3deg));
  }

  .hand-card.selected {
    transform: translateY(-10px) scale(1.08) rotate(calc(var(--i) * 2deg));
    z-index: 6;
  }

  @media (hover: hover) and (pointer: fine) {
    .hand-card:hover,
    .hand-card.selected:hover {
      transform: translateY(-10px) scale(1.06) rotate(calc(var(--i) * 2deg));
      z-index: 6;
    }
  }

  .zone-caption {
    font-size: 9px;
    bottom: -14px;
    padding: 1px 5px;
  }

  .guide {
    font-size: 11px;
    padding: 4px 8px;
    max-width: 96%;
    z-index: 6;
  }

  .bottom {
    padding: 2px 8px calc(4px + env(safe-area-inset-bottom));
    gap: 6px;
    flex-shrink: 0;
  }

  .bottom :deep(.hud) {
    min-width: 0;
    transform: scale(0.92);
    transform-origin: bottom right;
  }

  .deck,
  .grave {
    width: 40px;
  }

  .deck span,
  .grave-count {
    font-size: 10px;
    padding: 1px 5px;
  }

  .grave-label {
    font-size: 7px;
    top: 3px;
  }

  .pile-col {
    gap: 6px;
  }
}

@media (max-width: 560px) {
  .meta {
    gap: 3px;
    padding: 2px;
  }

  .pill {
    font-size: 10px;
    padding: 5px 7px;
  }

  .pill-num {
    min-width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .exit {
    width: 28px;
    height: 28px;
    padding: 0;
  }

  .exit-ico svg {
    width: 12px;
    height: 12px;
  }

  .layout {
    grid-template-rows: minmax(200px, 1.3fr) auto auto;
  }

  .arena {
    min-height: 0;
  }

  .board {
    grid-template-columns: 30px minmax(0, 1fr) 30px;
  }

  .deck,
  .grave {
    width: 30px;
  }

  .grave-label {
    display: none;
  }

  .hand-card {
    width: 56px;
  }

  .hand {
    min-height: 78px;
    gap: 4px;
    padding-top: 6px;
  }

  .row {
    min-height: calc(52px / (2.5 / 3.5));
  }

  .row :deep(.slot) {
    --slot-short: min(100%, 52px);
  }

  .summon-mode--dock {
    width: min(100%, 100%);
    gap: 4px;
  }

  .summon-mode--dock .summon-mode-label {
    font-size: 10px;
  }

  .summon-mode--dock .summon-opt {
    padding: 4px 2px;
    font-size: 9px;
    min-height: 34px;
  }

  .summon-mode--dock .opt-ico {
    font-size: 12px;
  }

  .actions-wrap {
    max-height: 30dvh;
  }
}

@media (max-height: 900px) and (max-width: 980px) {
  .arena .board {
    transform: scale(0.84);
    margin-bottom: -10%;
  }
}

@media (max-height: 820px) and (max-width: 980px) {
  .opp-hand {
    display: none;
  }

  .arena .board {
    transform: scale(0.72);
    margin-bottom: -18%;
  }

  .guide {
    font-size: 10px;
    padding: 3px 7px;
  }

  .summon-mode--dock .summon-mode-label {
    display: none;
  }

  .layout {
    grid-template-rows: minmax(190px, 1.4fr) auto auto;
  }

  .hand {
    min-height: 72px;
  }

  .hand-card {
    width: 52px;
  }

  .row {
    min-height: calc(48px / (2.5 / 3.5));
  }

  .row :deep(.slot) {
    --slot-short: min(100%, 48px);
  }

  .actions-wrap {
    max-height: 28dvh;
  }
}

/* هاتف بالعرض: ساحة + أزرار جنب بعض */
@media (max-height: 500px) and (orientation: landscape) {
  .duel {
    height: 100dvh;
    overflow: hidden;
  }

  .top {
    padding: 4px 8px 0;
  }

  .top :deep(.hud) {
    transform: scale(0.82);
    transform-origin: top right;
  }

  .layout {
    grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.95fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      'arena hand'
      'arena actions';
    gap: 4px 8px;
    padding: 0 8px;
    align-items: stretch;
  }

  .inspect {
    display: none;
  }

  .summon-mode--dock {
    display: grid;
    width: min(100%, 100%);
  }

  .summon-mode--dock .summon-mode-label {
    display: none;
  }

  .summon-mode--dock .summon-toggle--3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .summon-mode--dock .summon-opt {
    font-size: 9px;
    padding: 4px 2px;
    min-height: 32px;
  }

  .arena {
    min-height: 0;
    overflow: hidden;
    justify-content: center;
    align-self: stretch;
  }

  .arena .board {
    transform: scale(0.7);
    margin-bottom: -14%;
    max-width: 420px;
  }

  .opp-hand {
    display: none;
  }

  .hand-dock {
    gap: 2px;
    padding-bottom: 0;
    align-self: start;
  }

  .guide {
    display: none;
  }

  .hand {
    min-height: 54px;
    padding-top: 2px;
  }

  .hand-card {
    width: 46px;
  }

  .actions-wrap {
    max-height: none;
    height: auto;
    min-height: 0;
    overflow: auto;
    align-self: stretch;
  }

  .bottom {
    padding: 2px 8px 4px;
  }

  .bottom :deep(.hud) {
    transform: scale(0.82);
    transform-origin: bottom right;
  }
}
</style>

<style>
/* مقبرة — Teleport خارج الـ scoped */
.gy-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(12, 24, 48, 0.45);
  backdrop-filter: blur(3px);
}

.gy-panel {
  width: min(560px, 100%);
  max-height: min(78vh, 640px);
  display: flex;
  flex-direction: column;
  padding: 14px 16px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 18px 50px rgba(10, 30, 60, 0.35);
  color: #1a2a44;
  font-family: Cairo, system-ui, sans-serif;
}

.gy-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 15px;
}

.gy-n {
  margin-inline-end: auto;
  min-width: 24px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(90, 60, 160, 0.14);
  font-size: 12px;
  font-weight: 800;
}

.gy-close {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(30, 60, 120, 0.18);
  background: #f3f6fb;
  color: #1a2a44;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.gy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 12px;
  overflow: auto;
  padding: 2px 4px 6px;
}

.gy-card {
  padding: 0;
  border: 2px solid transparent;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.gy-card:hover {
  transform: translateY(-2px);
}

.gy-card.active {
  border-color: #3aa0ff;
  box-shadow: 0 0 0 3px rgba(58, 160, 255, 0.25);
}

.gy-card .face {
  width: 100%;
  pointer-events: none;
}
</style>
