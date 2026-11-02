(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === t || b.textContent.includes(t),
    );
  document.querySelector('button.exit')?.click();
  await sleep(500);
  byText('ضد الكمبيوتر')?.click();
  await sleep(1400);

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
  await sleep(1000);

  const faceBefore = document.querySelector('[data-my-monster].filled .face');
  const beforeDef = !!faceBefore?.classList.contains('defense');
  faceBefore?.click();
  await sleep(120);
  const changeBtn = [...document.querySelectorAll('.act')].find((b) =>
    b.textContent.includes('تغيير الوضع'),
  );
  const enabled = changeBtn && !changeBtn.disabled;
  changeBtn?.click();
  await sleep(900);
  const faceAfter = document.querySelector('[data-my-monster].filled .face');
  const afterDef = !!faceAfter?.classList.contains('defense');

  // toggle back
  faceAfter?.click();
  await sleep(80);
  const changeBtn2 = [...document.querySelectorAll('.act')].find(
    (b) => b.textContent.includes('تغيير الوضع') && !b.disabled,
  );
  changeBtn2?.click();
  await sleep(800);
  const faceFinal = document.querySelector('[data-my-monster].filled .face');
  const finalDef = !!faceFinal?.classList.contains('defense');

  document.querySelector('button.exit')?.click();
  await sleep(400);

  return {
    beforeDef,
    changeEnabled: !!enabled,
    afterDef,
    toggledBack: finalDef === beforeDef,
    finalDef,
    ok: !beforeDef && !!enabled && afterDef && finalDef === false,
  };
})()
