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
  await sleep(1200);

  // Read Vue/socket state if exposed
  let statePos = null;
  let stateMonsters = null;
  try {
    // find game via __vue_app__ or window
    const app = document.querySelector('#app')?.__vue_app__;
    const provides = app?._context?.provides;
    // fallback: walk component tree
    const root = document.querySelector('#app');
    const vn = root?.__vueParentComponent || root?._vnode;
  } catch (_) {}

  // Check DOM class on field card
  const face = document.querySelector('[data-my-monster].filled .face');
  const hasDefenseClass = !!face?.classList.contains('defense');
  const rotated = face ? getComputedStyle(face).transform : null;
  const footerBefore = face
    ? getComputedStyle(face.querySelector('footer') || face, '::before').content
    : null;

  // Try to peek socket module state via custom event / global
  // Inspect hand selection message + any data attrs
  const zone = document.querySelector('[data-my-monster].filled');

  // Pull from last socket-ish: scan for script that exposes game
  let monstersFromWindow = null;
  for (const k of Object.keys(window)) {
    try {
      const v = window[k];
      if (v && v.state && v.state.players) {
        monstersFromWindow = v.state.players;
        break;
      }
    } catch (_) {}
  }

  // Use CDP-accessible: read from BattleView via selecting element and vue instance
  let vuePos = null;
  let vueMonsters = null;
  const battleEl = document.querySelector('.duel');
  let comp = battleEl?.__vueParentComponent;
  // walk up
  let hops = 0;
  while (comp && hops < 20) {
    const setup = comp.setupState || comp.ctx || {};
    if (setup.me && setup.me.monsters) {
      vueMonsters = setup.me.monsters.map((m) =>
        m ? { cardId: m.cardId, position: m.position, canAttack: m.canAttack } : null,
      );
      vuePos = setup.summonPos;
      break;
    }
    if (comp.ctx?.me?.monsters) {
      vueMonsters = comp.ctx.me.monsters.map((m) =>
        m ? { cardId: m.cardId, position: m.position } : null,
      );
      break;
    }
    comp = comp.parent;
    hops++;
  }

  // Also try pinia/reactive from #app
  const appComp = document.querySelector('#app')?.__vueParentComponent;
  let gameScreen = null;

  return {
    defClicked: !!defOpt,
    defActive: !!defOpt?.classList.contains('active'),
    hasDefenseClass,
    transform: rotated,
    footerBefore,
    vuePos,
    vueMonsters,
    zoneHtml: zone?.outerHTML?.slice(0, 300),
    faceClasses: face ? [...face.classList] : [],
    logTail: [...document.querySelectorAll('.log li, .log-line, .duel-log li')]
      .slice(-5)
      .map((el) => el.textContent?.trim()),
  };
})()
