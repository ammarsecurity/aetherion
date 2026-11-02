(async () => {
  const out = { errors: [], screens: [], console: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === t || b.textContent.includes(t),
    );
  const hasJsError = () => /TypeError|Cannot read|undefined is not|ReferenceError/.test(document.body.innerText);

  // Join invalid room
  document.querySelector('button.exit')?.click();
  await sleep(400);
  const input = document.querySelector('input[placeholder*="رمز"]');
  if (input) {
    input.focus();
    input.value = 'ZZZZ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Vue v-model needs InputEvent
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'ZZZZ' }));
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(input, 'ZZZZ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  byText('انضمام')?.click();
  await sleep(1200);
  out.screens.push({
    joinInvalid: {
      bodyHasErrorMsg: /غرفة|غير|خطأ|موجود|انضمام/i.test(document.body.innerText),
      duel: !!document.querySelector('.duel'),
      snippet: document.body.innerText.slice(0, 200).replace(/\s+/g, ' '),
      jsError: hasJsError(),
    },
  });

  // Auth
  byText('حسابي')?.click();
  await sleep(700);
  out.screens.push({
    auth: {
      ok: !hasJsError() && document.body.innerText.length > 20,
      snippet: document.body.innerText.slice(0, 140).replace(/\s+/g, ' '),
    },
  });
  byText('رجوع')?.click();
  await sleep(400);

  // Full duel: change position after summon attack, end phases, attack direct
  byText('ضد الكمبيوتر')?.click();
  await sleep(1400);

  // summon attack
  const atkOpt = [...document.querySelectorAll('.summon-opt')].find((b) =>
    b.textContent.includes('هجوم'),
  );
  atkOpt?.click();
  await sleep(40);
  const monsters = [...document.querySelectorAll('.hand-card')].filter(
    (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
  );
  monsters[0]?.click();
  await sleep(60);
  [...document.querySelectorAll('.act')]
    .find((b) => b.textContent.includes('استدعاء') && !b.disabled)
    ?.click();
  await sleep(900);

  // change position
  const face = document.querySelector('[data-my-monster].filled .face');
  face?.click();
  await sleep(100);
  const changeBtn = [...document.querySelectorAll('.act, button')].find(
    (b) => b.textContent.includes('تغيير') || b.textContent.includes('وضع'),
  );
  changeBtn?.click();
  await sleep(700);
  const afterChange = document.querySelector('[data-my-monster].filled .face');
  out.screens.push({
    changePosition: {
      beforeWasAttack: face ? !face.classList.contains('defense') : null,
      afterDefense: !!afterChange?.classList.contains('defense'),
      changeBtn: !!changeBtn,
      changeBtnText: changeBtn?.textContent?.trim()?.slice(0, 40),
    },
  });

  // Set spell/trap if any
  const st = [...document.querySelectorAll('.hand-card.spell, .hand-card.trap')][0];
  if (st) {
    st.click();
    await sleep(60);
    const setBtn = [...document.querySelectorAll('.act')].find(
      (b) =>
        (b.textContent.includes('تعيين') ||
          b.textContent.includes('تفعيل') ||
          b.textContent.includes('فخ')) &&
        !b.disabled,
    );
    setBtn?.click();
    await sleep(800);
    out.screens.push({
      setST: {
        tried: true,
        btn: setBtn?.textContent?.trim()?.slice(0, 40),
        filledZones: document.querySelectorAll(
          '[data-my-spell].filled, .slot.spell.filled, .slot.trap.filled',
        ).length,
      },
    });
  } else {
    out.screens.push({ setST: { tried: false } });
  }

  // End turn repeatedly until we can battle or match ends / 12 turns
  let turns = 0;
  let sawBolt = false;
  let sawShatter = false;
  let matchEnd = false;
  while (turns < 14 && !matchEnd) {
    turns++;
    // try battle phase
    const battle = [...document.querySelectorAll('button, .phase-btn, .phase')].find(
      (b) => b.textContent.trim() === 'قتال' || b.textContent.includes('مرحلة القتال'),
    );
    // click phase pills
    [...document.querySelectorAll('.phase-bar button, .phases button, [class*=phase] button')].forEach(
      (b) => {
        if (/قتال|معركة|battle/i.test(b.textContent) && !b.disabled) b.click();
      },
    );
    await sleep(200);

    // attack
    const atkBtn = [...document.querySelectorAll('.act')].find(
      (b) => b.textContent.includes('هجوم') && !b.disabled,
    );
    if (atkBtn) {
      atkBtn.click();
      await sleep(150);
      const target =
        document.querySelector('[data-opp-monster].filled') ||
        document.querySelector('.opp-lp, .badge.opp, [data-direct]');
      // click enemy monster or direct
      const oppM = document.querySelector('[data-opp-monster].filled');
      if (oppM) oppM.click();
      else {
        // try direct attack button / opponent badge
        document.querySelector('.player-badge.opp, .badge-opp, [data-player="opp"]')?.click();
        [...document.querySelectorAll('button')].find((b) => b.textContent.includes('مباشر'))?.click();
      }
      await sleep(900);
      if (document.querySelector('.bolt, .attack-bolt, [class*=Bolt]')) sawBolt = true;
      if (document.querySelector('.shatter, [class*=shatter], [class*=Shatter]')) sawShatter = true;
    }

    const end = [...document.querySelectorAll('.act, button')].find(
      (b) =>
        (b.textContent.includes('إنهاء') || b.textContent.includes('نهاية الدور')) && !b.disabled,
    );
    end?.click();
    await sleep(1600);

    if (document.querySelector('.match-end, .result, .duel-end') || /انتهت|فزت|خسرت|تعادل/.test(document.body.innerText)) {
      matchEnd = true;
    }
    // if AI took over and we're waiting, just wait
    if (!document.querySelector('.duel')) break;
  }

  out.screens.push({
    longDuel: {
      turns,
      matchEnd,
      stillInDuel: !!document.querySelector('.duel'),
      lp: document.querySelector('.meta')?.innerText?.slice(0, 120),
      jsError: hasJsError(),
      guide: document.querySelector('.guide')?.textContent,
    },
  });

  // Inspect panel size
  document.querySelector('[data-my-monster].filled .face, .hand-card')?.click();
  await sleep(200);
  const inspect = document.querySelector('.inspect, .card-inspect, aside.detail');
  out.screens.push({
    inspect: inspect
      ? { h: inspect.getBoundingClientRect().height, w: inspect.getBoundingClientRect().width }
      : null,
  });

  document.querySelector('button.exit')?.click();
  await sleep(400);
  out.screens.push({ home: document.body.innerText.includes('ضد الكمبيوتر') });
  out.ok = out.screens.every((s) => {
    const v = Object.values(s)[0];
    if (v && typeof v === 'object' && 'jsError' in v) return !v.jsError;
    if (v && typeof v === 'object' && 'ok' in v) return v.ok !== false;
    return true;
  });
  return out;
})()
