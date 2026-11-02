(async () => {
  const out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === t || b.textContent.includes(t),
    );
  const goHome = async () => {
    const exit = document.querySelector('button.exit');
    if (exit) {
      exit.click();
      await sleep(500);
    }
    byText('أثيريون')?.click();
    // click brand / logo area if any, else history back via home buttons
    const homeish = [...document.querySelectorAll('button, a, h1')].find(
      (el) => el.textContent?.trim() === 'أثيريون',
    );
    homeish?.click?.();
    await sleep(400);
    // if still not home, force click nothing — use router via clicking nothing
    if (!document.body.innerText.includes('ضد الكمبيوتر')) {
      // try clicking any back
      byText('رجوع')?.click();
      byText('الرئيسية')?.click();
      await sleep(400);
    }
  };

  // Catalog
  byText('الكتالوج')?.click();
  await sleep(800);
  out.push({
    screen: 'catalog',
    ok: document.body.innerText.length > 40 && !/TypeError|Cannot read/.test(document.body.innerText),
    snippet: document.body.innerText.slice(0, 120).replace(/\s+/g, ' '),
  });
  byText('رجوع')?.click();
  await sleep(500);
  if (!document.body.innerText.includes('ضد الكمبيوتر')) {
    byText('الرئيسية')?.click();
    await sleep(400);
  }
  // Decks
  byText('مجموعاتي')?.click();
  await sleep(800);
  out.push({
    screen: 'decks',
    ok: !/TypeError|undefined is not|Cannot read/.test(document.body.innerText),
    snippet: document.body.innerText.slice(0, 120).replace(/\s+/g, ' '),
  });
  byText('رجوع')?.click();
  await sleep(500);
  if (!document.body.innerText.includes('ضد الكمبيوتر')) {
    byText('الرئيسية')?.click();
    await sleep(400);
  }
  // Progress
  byText('التقدم')?.click();
  await sleep(800);
  out.push({
    screen: 'progress',
    ok: document.body.innerText.length > 20 && !/TypeError|Cannot read/.test(document.body.innerText),
    snippet: document.body.innerText.slice(0, 120).replace(/\s+/g, ' '),
  });
  byText('رجوع')?.click();
  await sleep(500);
  if (!document.body.innerText.includes('ضد الكمبيوتر')) {
    byText('الرئيسية')?.click();
    await sleep(400);
  }

  // Create room
  byText('إنشاء غرفة')?.click();
  await sleep(1800);
  out.push({
    screen: 'create_room',
    inBattle: !!document.querySelector('.duel'),
    meta: (document.querySelector('.meta')?.innerText || '').slice(0, 80),
    guide: (document.querySelector('.guide')?.textContent || '').slice(0, 80),
    err: /TypeError|Cannot read|undefined/.test(document.body.innerText),
  });
  document.querySelector('button.exit')?.click();
  await sleep(700);
  out.push({
    afterExitRoom: {
      home: document.body.innerText.includes('ضد الكمبيوتر'),
      duelGone: !document.querySelector('.duel'),
    },
  });

  // Defense summon
  byText('ضد الكمبيوتر')?.click();
  await sleep(1400);
  const defOpt = [...document.querySelectorAll('.summon-opt')].find((b) =>
    b.textContent.includes('دفاع'),
  );
  defOpt?.click();
  await sleep(100);
  const monsters = [...document.querySelectorAll('.hand-card')].filter(
    (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
  );
  monsters[0]?.click();
  await sleep(100);
  [...document.querySelectorAll('.act')]
    .find((b) => b.textContent.includes('استدعاء') && !b.disabled)
    ?.click();
  await sleep(1000);
  const filled = document.querySelector('[data-my-monster].filled');
  const fieldText = filled?.innerText || '';
  out.push({
    defenseSummon: {
      defClicked: !!defOpt,
      defActive: !!defOpt?.classList.contains('active'),
      onField: !!filled,
      fieldText: fieldText.slice(0, 120).replace(/\s+/g, ' '),
      hasDefHint: /دفاع|DEF|وضع الدفاع/i.test(fieldText + (document.body.innerText || '')),
    },
  });

  // Trap if available
  const trap = [...document.querySelectorAll('.hand-card.trap')][0];
  if (trap) {
    trap.click();
    await sleep(80);
    [...document.querySelectorAll('.act')]
      .find((b) => (b.textContent.includes('تفعيل') || b.textContent.includes('وضع')) && !b.disabled)
      ?.click();
    await sleep(700);
    out.push({
      trap: {
        tried: true,
        onField: !!document.querySelector('[data-my-spell].filled, [data-my-trap].filled, .zone.spell.filled, .zone.trap.filled'),
      },
    });
  } else {
    out.push({ trap: { tried: false, reason: 'no trap in opening hand' } });
  }

  document.querySelector('button.exit')?.click();
  await sleep(500);
  out.push({ done: true, finalHome: document.body.innerText.includes('ضد الكمبيوتر') });
  return out;
})()
