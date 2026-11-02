(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const by = (t) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
  const act = (t) =>
    [...document.querySelectorAll('.act')].find((b) => b.textContent.includes(t) && !b.disabled);

  document.querySelector('button.exit')?.click();
  await sleep(400);
  by('ضد الكمبيوتر')?.click();
  await sleep(1400);

  const spell = [...document.querySelectorAll('.hand-card.spell')][0];
  if (!spell) return { ok: false, reason: 'no spell in hand' };
  spell.click();
  await sleep(80);

  const setBtn = act('تعيين تعويذة');
  setBtn?.click();
  await sleep(900);

  const filled = document.querySelector('[data-my-spell].filled .face');
  const setOk = !!filled?.classList.contains('down') && !!filled?.querySelector('img.back');

  filled?.click();
  await sleep(120);
  const activateBtn = act('تفعيل تعويذة');
  const canActSameTurn = !!activateBtn;
  activateBtn?.click();
  await sleep(900);

  const after = document.querySelector('[data-my-spell].filled .face');
  const activated = after && !after.classList.contains('down');

  document.querySelector('button.exit')?.click();
  return {
    setOk,
    canActSameTurn,
    activated: !!activated,
    ok: setOk && canActSameTurn && !!activated,
  };
})()
