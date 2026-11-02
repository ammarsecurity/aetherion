(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === t || b.textContent.includes(t),
    );

  document.querySelector('button.exit')?.click();
  await sleep(400);
  byText('ضد الكمبيوتر')?.click();
  await sleep(1400);

  const defOpt = [...document.querySelectorAll('.summon-opt')].find((b) =>
    b.textContent.includes('دفاع'),
  );
  defOpt?.click();
  await sleep(50);

  const monsters = [...document.querySelectorAll('.hand-card')].filter(
    (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
  );
  monsters[0]?.click();
  await sleep(80);
  [...document.querySelectorAll('.act')]
    .find((b) => b.textContent.includes('استدعاء') && !b.disabled)
    ?.click();
  await sleep(1000);

  const face = document.querySelector('[data-my-monster].filled .face');
  const cs = face ? getComputedStyle(face) : null;
  let vueM = null;
  let comp = document.querySelector('.duel')?.__vueParentComponent;
  let hops = 0;
  while (comp && hops < 25) {
    const setup = comp.setupState || {};
    if (setup.me?.monsters) {
      vueM = setup.me.monsters.map((m) =>
        m
          ? {
              cardId: m.cardId,
              position: m.position,
              faceUp: m.faceUp,
            }
          : null,
      );
      break;
    }
    comp = comp.parent;
    hops++;
  }

  return {
    defActive: !!defOpt?.classList.contains('active'),
    classes: face ? [...face.classList] : [],
    transform: cs?.transform,
    hasSetTag: !!face?.querySelector('.set-tag'),
    setTagText: face?.querySelector('.set-tag')?.textContent,
    hasBack: !!face?.querySelector('img.back'),
    vueM,
    ok:
      !!face?.classList.contains('defense') &&
      !!vueM?.some((m) => m && m.position === 'defense' && m.faceUp === false) &&
      !!face?.querySelector('.set-tag'),
  };
})()
