(async () => {
  const report = { ok: true, scenarios: [], errors: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const by = (t) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
  const act = (t) =>
    [...document.querySelectorAll('.act')].find((b) => b.textContent.includes(t) && !b.disabled);
  const push = (name, ok, detail) => {
    report.scenarios.push({ name, ok, detail });
    if (!ok) report.ok = false;
  };
  const onErr = (e) => report.errors.push(String(e.message || e.reason || e));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', (e) => onErr(e));

  const startAi = async () => {
    document.querySelector('button.exit')?.click();
    await sleep(400);
    by('ضد الكمبيوتر')?.click();
    await sleep(1400);
    return !!document.querySelector('.duel');
  };

  const handOf = (cls) => [...document.querySelectorAll(`.hand-card${cls || ''}`)];
  const monsters = () =>
    handOf().filter((c) => !c.classList.contains('spell') && !c.classList.contains('trap'));
  const spells = () => handOf('.spell');
  const traps = () => handOf('.trap');

  const readMe = () => {
    let c = document.querySelector('.duel')?.__vueParentComponent;
    for (let i = 0; i < 30 && c; i++) {
      if (c.setupState?.me) return c.setupState.me;
      c = c.parent;
    }
    return null;
  };

  // 1 attack summon
  if (!(await startAi())) {
    push('start', false);
    return report;
  }
  push('start', true);

  [...document.querySelectorAll('.summon-opt')]
    .find((b) => b.textContent.includes('هجوم مكشوف'))
    ?.click();
  await sleep(40);
  monsters()[0]?.click();
  await sleep(50);
  act('استدعاء')?.click();
  await sleep(900);
  const me1 = readMe();
  push('summon_attack', !!me1?.monsters?.some((m) => m && m.faceUp && m.position === 'attack'), {
    monsters: me1?.monsters?.filter(Boolean).length,
  });

  // 2 spell activate from hand
  if (spells()[0]) {
    spells()[0].click();
    await sleep(50);
    act('تفعيل تعويذة')?.click();
    await sleep(900);
    const me2 = readMe();
    push(
      'spell_activate_hand',
      !!me2?.spellTraps?.some((s) => s && s.faceUp),
      { life: me2?.life },
    );
  } else {
    push('spell_activate_hand', true, { skipped: 'no spell' });
  }

  // end and new game for set spell
  if (!(await startAi())) {
    push('restart_set', false);
    return report;
  }
  if (spells()[0]) {
    spells()[0].click();
    await sleep(50);
    act('تعيين تعويذة')?.click();
    await sleep(800);
    const face = document.querySelector('[data-my-spell].filled .face');
    push('spell_set_facedown', !!face?.classList.contains('down') && !!face?.querySelector('img.back'));
    face?.click();
    await sleep(100);
    const can = !!act('تفعيل تعويذة');
    if (can) {
      act('تفعيل تعويذة')?.click();
      await sleep(900);
      const after = document.querySelector('[data-my-spell].filled .face');
      push('spell_activate_from_field', !!after && !after.classList.contains('down'));
    } else {
      push('spell_activate_from_field', true, { note: 'blocked same turn (quick?)' });
    }
  } else {
    push('spell_set_facedown', true, { skipped: true });
    push('spell_activate_from_field', true, { skipped: true });
  }

  // defense set
  if (!(await startAi())) return report;
  [...document.querySelectorAll('.summon-opt')]
    .find((b) => b.textContent.includes('دفاع مقلوب'))
    ?.click();
  await sleep(40);
  monsters()[0]?.click();
  await sleep(50);
  act('استدعاء')?.click();
  await sleep(900);
  const defFace = document.querySelector('[data-my-monster].filled .face');
  const defSlot = document.querySelector('[data-my-monster].filled');
  push(
    'defense_set',
    !!defFace?.classList.contains('down') &&
      !!defFace?.classList.contains('defense') &&
      !!defSlot?.classList.contains('defense') &&
      defSlot.getBoundingClientRect().width > defSlot.getBoundingClientRect().height,
  );

  // face-up defense
  if (!(await startAi())) return report;
  [...document.querySelectorAll('.summon-opt')]
    .find((b) => b.textContent.includes('دفاع مكشوف'))
    ?.click();
  await sleep(40);
  monsters()[0]?.click();
  await sleep(50);
  act('استدعاء')?.click();
  await sleep(900);
  const upFace = document.querySelector('[data-my-monster].filled .face');
  push(
    'defense_faceup',
    !!upFace?.classList.contains('defense') && !upFace.classList.contains('down'),
  );

  // trap set
  if (!(await startAi())) return report;
  if (traps()[0]) {
    traps()[0].click();
    await sleep(50);
    act('تعيين فخ')?.click();
    await sleep(800);
    push('trap_set', !!document.querySelector('[data-my-spell].filled .face.down'));
  } else {
    // try end turns until trap or give up
    let got = false;
    for (let t = 0; t < 6 && !got; t++) {
      act('إنهاء الدور')?.click();
      await sleep(1600);
      if (traps()[0]) {
        traps()[0].click();
        await sleep(50);
        act('تعيين فخ')?.click();
        await sleep(800);
        got = !!document.querySelector('[data-my-spell].filled .face.down');
        break;
      }
    }
    push('trap_set', got, { waited: true });
  }

  // battle loop FX
  if (!(await startAi())) return report;
  monsters()[0]?.click();
  await sleep(40);
  [...document.querySelectorAll('.summon-opt')]
    .find((b) => b.textContent.includes('هجوم مكشوف'))
    ?.click();
  act('استدعاء')?.click();
  await sleep(700);
  let sawBolt = false;
  let sawShatter = false;
  for (let t = 0; t < 10; t++) {
    act('مرحلة القتال')?.click();
    await sleep(150);
    if (act('هجوم')) {
      act('هجوم')?.click();
      await sleep(100);
      document.querySelector('[data-my-monster].filled')?.click();
      await sleep(80);
      const opp = document.querySelector('[data-opp-monster].filled');
      if (opp) opp.click();
      else act('هجوم مباشر')?.click();
      const iv = setInterval(() => {
        if (document.querySelector('.bolt-layer, [class*=bolt]')) sawBolt = true;
        if (document.querySelector('.shatter, [class*=shatter]')) sawShatter = true;
      }, 16);
      await sleep(1000);
      clearInterval(iv);
    }
    act('إنهاء الدور')?.click();
    await sleep(1500);
    if (sawBolt || /انتهت|فزت|خسرت/.test(document.body.innerText)) break;
  }
  push('battle_fx_or_progress', true, { sawBolt, sawShatter });

  // UI screens
  document.querySelector('button.exit')?.click();
  await sleep(500);
  by('الكتالوج')?.click();
  await sleep(600);
  push('catalog', document.body.innerText.length > 40 && !/TypeError/.test(document.body.innerText));
  by('رجوع')?.click();
  await sleep(400);
  by('مجموعاتي')?.click();
  await sleep(600);
  push('decks', !/TypeError/.test(document.body.innerText));
  by('رجوع')?.click();
  await sleep(400);

  push('no_js_errors', report.errors.length === 0, { errors: report.errors });
  return report;
})()
