(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === t || b.textContent.includes(t),
    );
  const readMon = () => {
    let c = document.querySelector('.duel')?.__vueParentComponent;
    for (let i = 0; i < 30 && c; i++) {
      if (c.setupState?.me?.monsters) {
        return c.setupState.me.monsters
          .map((m) =>
            m ? { cardId: m.cardId, position: m.position, faceUp: m.faceUp } : null,
          )
          .filter(Boolean);
      }
      c = c.parent;
    }
    return [];
  };
  const faceInfo = () => {
    const f = document.querySelector('[data-my-monster].filled .face');
    return {
      classes: f ? [...f.classList] : [],
      setTag: !!f?.querySelector('.set-tag'),
      back: !!f?.querySelector('img.back'),
      transform: f ? getComputedStyle(f).transform : null,
    };
  };
  const pickMode = (label) => {
    [...document.querySelectorAll('.summon-opt')]
      .find((b) => b.textContent.includes(label))
      ?.click();
  };
  const summonOne = async (label) => {
    document.querySelector('button.exit')?.click();
    await sleep(400);
    byText('ضد الكمبيوتر')?.click();
    await sleep(1300);
    pickMode(label);
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
    return { mode: label, mon: readMon()[0] || null, face: faceInfo() };
  };

  const a = await summonOne('هجوم مكشوف');
  const b = await summonOne('دفاع مكشوف');
  const c = await summonOne('دفاع مقلوب');
  document.querySelector('button.exit')?.click();

  return {
    attack: a,
    defUp: b,
    defDown: c,
    ok:
      a.mon?.position === 'attack' &&
      a.mon?.faceUp === true &&
      !a.face.classes.includes('defense') &&
      b.mon?.position === 'defense' &&
      b.mon?.faceUp === true &&
      b.face.classes.includes('defense') &&
      !b.face.setTag &&
      c.mon?.position === 'defense' &&
      c.mon?.faceUp === false &&
      c.face.classes.includes('defense') &&
      c.face.setTag === true,
  };
})()
