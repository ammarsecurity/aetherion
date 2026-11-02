(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === t || b.textContent.includes(t),
    );

  const rectOf = (sel) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
    };
  };

  const overlaps = (a, b) => {
    if (!a || !b) return false;
    return !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
  };

  const measure = (label) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const issues = [];
    const duel = !!document.querySelector('.duel');
    const home = !!document.querySelector('.home');

    // overflow
    const docW = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const docH = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    if (docW > vw + 2) issues.push(`horizontal_overflow:${docW - vw}px`);

    // clipped / out of viewport elements of interest
    const checks = [
      '.meta',
      '.guide',
      '.hand-rail',
      '.hand',
      '.actions-wrap',
      '.action-panel',
      '.field',
      '.inspect',
      '.card-inspect',
      'aside.inspect',
      '.top',
      '.bottom',
      '.phase-bar',
      '.summon-mode',
      '.player-badge',
      '.banner',
      '.hero',
      '.actions',
      '.join',
    ];

    const metrics = {};
    for (const sel of checks) {
      const r = rectOf(sel);
      if (!r) continue;
      metrics[sel] = r;
      if (r.x < -2) issues.push(`${sel}:left_clip`);
      if (r.right > vw + 2) issues.push(`${sel}:right_overflow`);
      if (r.w < 8 && r.h < 8) issues.push(`${sel}:tiny`);
      if (r.h > vh * 0.85 && sel.includes('inspect')) issues.push(`${sel}:too_tall`);
    }

    // hand cards
    const hands = [...document.querySelectorAll('.hand-card')].map((el) => rectOf(el));
    if (hands.length) {
      metrics.handCards = {
        count: hands.length,
        minW: Math.min(...hands.map((h) => h.w)),
        maxW: Math.max(...hands.map((h) => h.w)),
        minH: Math.min(...hands.map((h) => h.h)),
        bottoms: hands.map((h) => h.bottom),
      };
      if (metrics.handCards.minW < 36) issues.push('hand_card_too_narrow');
      if (hands.some((h) => h.bottom > vh + 4)) issues.push('hand_below_viewport');
      if (hands.some((h) => h.y < 0)) issues.push('hand_above_viewport');
    }

    // zone slots
    const zones = [...document.querySelectorAll('.slot')].map((el) => rectOf(el));
    if (zones.length) {
      metrics.zones = {
        count: zones.length,
        minW: Math.min(...zones.map((z) => z.w)),
        minH: Math.min(...zones.map((z) => z.h)),
        avgW: Math.round(zones.reduce((s, z) => s + z.w, 0) / zones.length),
      };
      if (metrics.zones.minW < 40) issues.push('zone_too_small');
      if (metrics.zones.minH < 50) issues.push('zone_too_short');
    }

    // act buttons readable?
    const acts = [...document.querySelectorAll('.act')].map((el) => {
      const r = rectOf(el);
      const cs = getComputedStyle(el);
      return { w: r?.w, h: r?.h, font: cs.fontSize, pad: cs.padding };
    });
    if (acts.length) {
      metrics.acts = {
        count: acts.length,
        minH: Math.min(...acts.map((a) => a.h || 99)),
        font: acts[0]?.font,
      };
      if (metrics.acts.minH < 28) issues.push('act_btn_too_short');
    }

    // overlaps of critical duel pieces
    const guide = rectOf('.guide');
    const hand = rectOf('.hand') || rectOf('.hand-rail');
    const field = rectOf('.field');
    const actions = rectOf('.actions-wrap') || rectOf('.action-panel');
    const meta = rectOf('.meta');
    const top = rectOf('.top');
    const bottom = rectOf('.bottom');
    const inspect =
      rectOf('.inspect') || rectOf('.card-inspect') || rectOf('aside.detail');

    if (guide && hand && overlaps(guide, hand)) issues.push('overlap:guide_hand');
    if (guide && field && overlaps(guide, field)) issues.push('overlap:guide_field');
    if (hand && actions && overlaps(hand, actions) && vw >= 900)
      issues.push('overlap:hand_actions');
    if (meta && top) {
      // meta should be inside top area roughly
    }
    if (inspect && field && overlaps(inspect, field) && inspect.h > 200)
      issues.push('overlap:inspect_field_large');
    if (bottom && hand && overlaps(bottom, hand)) issues.push('overlap:bottom_hand');

    // text overflow in meta
    const metaEl = document.querySelector('.meta');
    if (metaEl) {
      const scrollW = metaEl.scrollWidth;
      const clientW = metaEl.clientWidth;
      if (scrollW > clientW + 4) issues.push('meta_text_overflow');
      metrics.metaScroll = { scrollW, clientW };
    }

    // summon mode
    const summon = rectOf('.summon-mode');
    if (summon && summon.right > vw + 2) issues.push('summon_mode_overflow');

    // badge LP near edge
    const badges = [...document.querySelectorAll('.player-badge, .badge')].map((el) => ({
      text: el.innerText.slice(0, 40).replace(/\s+/g, ' '),
      r: rectOf(el),
    }));
    metrics.badges = badges;
    for (const b of badges) {
      if (b.r && (b.r.x < 0 || b.r.right > vw + 2)) issues.push('badge_edge_overflow');
    }

    return {
      label,
      vw,
      vh,
      duel,
      home,
      docW,
      docH,
      issues,
      metrics: {
        meta: metrics['.meta'],
        guide: metrics['.guide'],
        hand: metrics['.hand'] || metrics['.hand-rail'],
        field: metrics['.field'],
        actions: metrics['.actions-wrap'] || metrics['.action-panel'],
        inspect: metrics['.inspect'] || metrics['.card-inspect'],
        top: metrics['.top'],
        bottom: metrics['.bottom'],
        phase: metrics['.phase-bar'],
        summon: metrics['.summon-mode'],
        hero: metrics['.hero'],
        handCards: metrics.handCards,
        zones: metrics.zones,
        acts: metrics.acts,
        metaScroll: metrics.metaScroll,
        badges: metrics.badges,
      },
    };
  };

  // Ensure home first
  document.querySelector('button.exit')?.click();
  await sleep(400);

  const report = { sizes: [] };

  // Caller will change viewport externally; this measures current + plays duel
  const homeM = measure('home');
  report.sizes.push(homeM);

  byText('ضد الكمبيوتر')?.click();
  await sleep(1400);
  if (!document.querySelector('.duel')) {
    report.error = 'failed to enter duel';
    return report;
  }

  // quick summon for realistic layout
  const monsters = [...document.querySelectorAll('.hand-card')].filter(
    (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
  );
  monsters[0]?.click();
  await sleep(60);
  [...document.querySelectorAll('.act')]
    .find((b) => b.textContent.includes('استدعاء') && !b.disabled)
    ?.click();
  await sleep(700);

  // open inspect via field card
  document.querySelector('[data-my-monster].filled .face')?.click();
  await sleep(200);

  report.sizes.push(measure('duel_with_card'));

  // open log
  [...document.querySelectorAll('.act, .log, button')]
    .find((b) => b.textContent.includes('سجل'))
    ?.click();
  await sleep(200);
  report.sizes.push(measure('duel_log_open'));

  document.querySelector('button.exit')?.click();
  await sleep(400);
  report.sizes.push(measure('home_after'));

  report.ok = report.sizes.every((s) => s.issues.length === 0);
  report.allIssues = report.sizes.flatMap((s) =>
    s.issues.map((i) => `${s.label}@${s.vw}x${s.vh}:${i}`),
  );
  return report;
})()
