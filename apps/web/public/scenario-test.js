(async () => {
  const report = { errors: [], scenarios: [], console: [] };
  const onErr = (e) => report.console.push(String(e.message || e.reason || e));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', (e) => report.console.push(String(e.reason)));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (name, ok, detail) => report.scenarios.push({ name, ok, detail });
  const guide = () => document.querySelector('.guide')?.textContent || '';
  const lp = () => [...document.querySelectorAll('.lp-value')].map((x) => x.textContent);
  const clickAct = (pred) => {
    const b = [...document.querySelectorAll('.act')].find(pred);
    if (!b || b.disabled) return false;
    b.click();
    return true;
  };
  const handCards = () => [...document.querySelectorAll('.hand-card')];
  const fxSeen = async (ms = 800) => {
    const s = { bolt: 0, shatter: 0, summon: 0, hit: 0, spell: 0 };
    const iv = setInterval(() => {
      if (document.querySelector('.bolt-layer')) s.bolt++;
      if (document.querySelector('.shatter')) s.shatter++;
      if (document.querySelector('.duel-summoning')) s.summon++;
      if (document.querySelector('.duel-hit')) s.hit++;
      if (document.querySelector('.spell-pulse')) s.spell++;
    }, 16);
    await sleep(ms);
    clearInterval(iv);
    return s;
  };

  [...document.querySelectorAll('button')]
    .find((b) => b.textContent.includes('ضد الكمبيوتر'))
    ?.click();
  await sleep(1200);
  if (!document.querySelector('.duel')) {
    log('start_ai', false, 'لم تدخل المبارزة');
    return report;
  }
  log('start_ai', true, { lp: lp(), guide: guide() });

  // Summon
  {
    const monsters = handCards().filter(
      (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
    );
    monsters.sort(
      (a, b) =>
        +(b.innerText.match(/ATK\s*(\d+)/)?.[1] || 0) -
        +(a.innerText.match(/ATK\s*(\d+)/)?.[1] || 0),
    );
    const name = monsters[0]
      ? (monsters[0].click(), monsters[0].querySelector('.name')?.textContent)
      : null;
    await sleep(100);
    const canSum = clickAct(
      (b) => b.textContent.includes('استدعاء') && !b.textContent.includes('وضع') && !b.disabled,
    );
    const fx = await fxSeen(1200);
    const onField = !!document.querySelector('[data-my-monster].filled');
    log('summon_monster', !!(canSum && onField), {
      name,
      canSum,
      onField,
      summonFx: fx.summon > 0,
      guide: guide(),
    });
    if (!onField) report.errors.push('الاستدعاء فشل — لا وحش على الساحة');
    if (canSum && fx.summon === 0) report.errors.push('مؤثر الاستدعاء لم يظهر');
  }

  // Spell
  {
    const beforeLp = lp();
    const beforeHand = handCards().length;
    const spell = handCards().find((c) => c.classList.contains('spell'));
    const name = spell ? (spell.click(), spell.querySelector('.name')?.textContent) : null;
    await sleep(100);
    if (name) {
      const started = clickAct((b) => b.textContent.includes('تعويذة') && !b.disabled);
      const fx = await fxSeen(700);
      const ok =
        started &&
        (handCards().length < beforeHand ||
          lp().join() !== beforeLp.join() ||
          document.querySelectorAll('[data-my-spell].filled').length > 0);
      log('activate_spell', ok, {
        name,
        started,
        spellFx: fx.spell > 0,
        lpBefore: beforeLp,
        lpAfter: lp(),
      });
      if (started && fx.spell === 0) report.errors.push('مؤثر التعويذة لم يظهر');
      if (!started) report.errors.push('زر تفعيل تعويذة معطل رغم اختيار تعويذة: ' + name);
    } else {
      log('activate_spell', true, { skipped: 'لا تعويذة باليد' });
    }
  }

  // Trap
  {
    const trap = handCards().find((c) => c.classList.contains('trap'));
    const name = trap ? (trap.click(), trap.querySelector('.name')?.textContent) : null;
    await sleep(100);
    if (name) {
      const started = clickAct((b) => b.textContent.includes('فخ') && !b.disabled);
      await sleep(400);
      log('set_trap', started, {
        name,
        started,
        setCount: document.querySelectorAll('[data-my-spell].filled').length,
      });
      if (!started) report.errors.push('زر تعيين فخ معطل رغم اختيار فخ');
    } else {
      log('set_trap', true, { skipped: 'لا فخ باليد' });
    }
  }

  // End turn / AI
  {
    const ended = clickAct((b) => b.textContent.includes('إنهاء الدور') && !b.disabled);
    await sleep(3800);
    log('end_turn_ai_cycle', ended && !!document.querySelector('.duel'), {
      ended,
      guide: guide(),
      lp: lp(),
      myMonsters: document.querySelectorAll('[data-my-monster].filled').length,
      foeMonsters: document.querySelectorAll('[data-foe-monster].filled').length,
    });
    if (!document.querySelector('.duel')) report.errors.push('الواجهة اختفت بعد دور الخصم');
  }

  // Battle
  {
    let mine = document.querySelector('[data-my-monster].filled');
    if (!mine) {
      const monsters = handCards().filter(
        (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
      );
      if (monsters[0]) {
        monsters[0].click();
        await sleep(80);
        clickAct((b) => b.textContent.includes('استدعاء') && !b.disabled);
        await sleep(400);
        clickAct((b) => b.textContent.includes('إنهاء الدور') && !b.disabled);
        await sleep(3800);
      }
      mine = document.querySelector('[data-my-monster].filled');
    }
    const foe = document.querySelector('[data-foe-monster].filled');
    if (mine) {
      clickAct((b) => b.textContent.includes('مرحلة القتال') && !b.disabled);
      await sleep(120);
      clickAct(
        (b) => !b.disabled && b.textContent.includes('هجوم') && !b.textContent.includes('مباشر'),
      );
      await sleep(80);
      document
        .querySelector('[data-my-monster].filled')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      await sleep(100);
      const g2 = guide();
      if (foe && g2.includes('خصم')) {
        const p = fxSeen(1500);
        document
          .querySelector('[data-foe-monster].filled')
          ?.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
          );
        const fx = await p;
        log('battle_attack', fx.bolt > 0, {
          bolt: fx.bolt > 0,
          shatter: fx.shatter > 0,
          hit: fx.hit > 0,
          lp: lp(),
          guideAfter: guide(),
        });
        if (fx.bolt === 0) report.errors.push('صاعقة الهجوم لم تظهر');
      } else if (!foe) {
        const canDirect = clickAct((b) => b.textContent.includes('مباشر') && !b.disabled);
        const fx = await fxSeen(1000);
        log('direct_attack', canDirect && fx.bolt > 0, {
          canDirect,
          bolt: fx.bolt > 0,
          lp: lp(),
        });
        if (canDirect && fx.bolt === 0) report.errors.push('صاعقة الهجوم المباشر لم تظهر');
      } else {
        log('battle_attack', false, { guide: g2 });
        report.errors.push('فشل مسار الهجوم: ' + g2);
      }
    } else {
      log('battle_attack', false, { note: 'لا وحش' });
      report.errors.push('لا يوجد وحش للقتال');
    }
  }

  // Destroy spell if available
  {
    if (!guide().includes('دور الخصم')) {
      const destroyCard = handCards().find((c) =>
        (c.querySelector('.name')?.textContent || '').includes('قطع الظل'),
      );
      if (destroyCard) {
        destroyCard.click();
        await sleep(80);
        const started = clickAct((b) => b.textContent.includes('تعويذة') && !b.disabled);
        const fx = await fxSeen(900);
        log('destroy_all_spell', started, {
          started,
          foesLeft: document.querySelectorAll('[data-foe-monster].filled').length,
          shatter: fx.shatter > 0,
        });
      } else {
        log('destroy_all_spell', true, { skipped: true });
      }
    }
  }

  // Survival loop
  {
    let turns = 0;
    let crashed = false;
    let endedMatch = false;
    for (let i = 0; i < 8; i++) {
      if (!document.querySelector('.duel')) {
        crashed = true;
        break;
      }
      const winner = document.querySelector('.banner')?.textContent || '';
      if (winner.includes('انتهت')) {
        endedMatch = true;
        log('match_end', true, { winner, turns: i, lp: lp() });
        break;
      }
      if (!guide().includes('دور الخصم')) {
        const mon = handCards().find(
          (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
        );
        if (mon) {
          mon.click();
          await sleep(50);
          clickAct((b) => b.textContent.includes('استدعاء') && !b.disabled);
          await sleep(250);
        }
        if (clickAct((b) => b.textContent.includes('مرحلة القتال') && !b.disabled)) {
          await sleep(80);
          if (
            clickAct(
              (b) =>
                !b.disabled && b.textContent.includes('هجوم') && !b.textContent.includes('مباشر'),
            )
          ) {
            await sleep(50);
            document
              .querySelector('[data-my-monster].filled')
              ?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
              );
            await sleep(50);
            const f = document.querySelector('[data-foe-monster].filled');
            if (f)
              f.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
              );
            else clickAct((b) => b.textContent.includes('مباشر') && !b.disabled);
            await sleep(900);
          }
        }
        clickAct((b) => b.textContent.includes('إنهاء الدور') && !b.disabled);
        await sleep(3600);
        turns++;
      } else {
        await sleep(1200);
      }
    }
    if (!endedMatch) {
      log('survival_loop', !crashed && !!document.querySelector('.duel'), {
        turns,
        crashed,
        guide: guide(),
        lp: lp(),
      });
      if (crashed) report.errors.push('انهيار الواجهة أثناء اللعب المتكرر');
    }
  }

  // UI sanity
  {
    const inspect = document.querySelector('.inspect');
    const ir = inspect?.getBoundingClientRect();
    const hand = document.querySelector('.hand')?.getBoundingClientRect();
    const guideEl = document.querySelector('.guide')?.getBoundingClientRect();
    const overlapGuideHand = !!(guideEl && hand && guideEl.bottom > hand.top + 8);
    const inspectTooTall = !!(ir && ir.height > 520);
    log('ui_sanity', !overlapGuideHand && !inspectTooTall, {
      inspectH: ir && Math.round(ir.height),
      overlapGuideHand,
      inspectTooTall,
    });
    if (overlapGuideHand) report.errors.push('التلميح يتداخل مع اليد');
    if (inspectTooTall) report.errors.push('لوحة المعاينة طويلة: ' + Math.round(ir.height));
  }

  // Log
  {
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('سجل'))
      ?.click();
    await sleep(120);
    const lines = [...document.querySelectorAll('.actions-wrap .log li')].map((l) => l.textContent);
    log('match_log', lines.length > 0, { count: lines.length, sample: lines.slice(-6) });
    if (lines.length === 0 && document.querySelector('.duel'))
      report.errors.push('سجل المباراة فارغ');
  }

  // Exit
  {
    const exit = document.querySelector('button.exit, button[aria-label=\"خروج\"]');
    exit?.click();
    await sleep(500);
    const home = !!document.querySelector('button') && !document.querySelector('.duel');
    log('exit_home', home, { home });
    if (!home) report.errors.push('الخروج للمبنى الرئيسي فشل');
  }

  window.removeEventListener('error', onErr);
  return report;
})()
