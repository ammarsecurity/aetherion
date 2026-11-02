(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === t || b.textContent.includes(t),
    );

  const rectOf = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return { hidden: true };
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

  const visibleOverlap = (a, b) => {
    if (!a || !b || a.hidden || b.hidden || a.w < 4 || b.w < 4) return false;
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
    return x * y > 80;
  };

  document.querySelector('button.exit')?.click();
  await sleep(350);
  byText('ضد الكمبيوتر')?.click();
  await sleep(1200);

  const monsters = [...document.querySelectorAll('.hand-card')].filter(
    (c) => !c.classList.contains('spell') && !c.classList.contains('trap'),
  );
  monsters[0]?.click();
  await sleep(50);
  [...document.querySelectorAll('.act')]
    .find((b) => b.textContent.includes('استدعاء') && !b.disabled)
    ?.click();
  await sleep(600);

  const vw = innerWidth;
  const vh = innerHeight;
  const issues = [];
  const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (docW > vw + 2) issues.push(`h_overflow:+${docW - vw}`);

  const field = rectOf('.field');
  const hand = rectOf('.hand');
  const guide = rectOf('.guide');
  const actions = rectOf('.actions-wrap');
  const dockSummon = rectOf('.summon-mode--dock');
  const sideSummon = rectOf('.summon-mode--side');
  const meta = rectOf('.meta');
  const bottom = rectOf('.bottom');
  const top = rectOf('.top');
  const arena = rectOf('.arena');

  const summonVisible =
    (dockSummon && !dockSummon.hidden && dockSummon.w > 20) ||
    (sideSummon && !sideSummon.hidden && sideSummon.w > 20);
  if (!summonVisible) issues.push('summon_mode_missing');

  if (visibleOverlap(guide, hand)) issues.push('overlap:guide_hand');
  if (visibleOverlap(hand, actions)) issues.push('overlap:hand_actions');
  if (visibleOverlap(guide, actions)) issues.push('overlap:guide_actions');
  if (bottom && hand && visibleOverlap(bottom, hand)) issues.push('overlap:bottom_hand');

  // arena should not be crushed; field may clip — use visible portion
  if (arena && !arena.hidden && arena.h < 140) issues.push(`arena_too_short:${arena.h}`);
  if (field && arena && !field.hidden) {
    const visH = Math.min(field.bottom, arena.bottom) - Math.max(field.y, arena.y);
    if (visH < 120) issues.push(`field_visible_short:${Math.round(visH)}`);
    // clipped field overlapping hand is OK only if clipped away
    const visField = {
      ...field,
      bottom: Math.min(field.bottom, arena.bottom),
      h: Math.min(field.bottom, arena.bottom) - field.y,
    };
    if (hand && visibleOverlap(visField, hand)) issues.push('overlap:field_hand');
    if (guide && visibleOverlap(visField, guide)) issues.push('overlap:field_guide');
  }

  const zones = [...document.querySelectorAll('.slot')].map((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  const minZone = zones.length ? Math.min(...zones.map((z) => z.w)) : 0;
  if (minZone && minZone < 30) issues.push(`zone_narrow:${minZone}`);

  const hands = [...document.querySelectorAll('.hand-card')].map((el) =>
    Math.round(el.getBoundingClientRect().width),
  );
  if (hands.length && Math.min(...hands) < 44) issues.push(`hand_narrow:${Math.min(...hands)}`);

  // meta not overflowing viewport
  if (meta && !meta.hidden && meta.right > vw + 2) issues.push('meta_right_overflow');
  if (meta && !meta.hidden && meta.x < -2) issues.push('meta_left_overflow');

  // LP badges
  const badges = [...document.querySelectorAll('.hud')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      t: el.innerText.slice(0, 30).replace(/\s+/g, ' '),
      x: Math.round(r.x),
      right: Math.round(r.right),
      w: Math.round(r.width),
    };
  });
  for (const b of badges) {
    if (b.x < -2 || b.right > vw + 4) issues.push('badge_overflow');
  }

  document.querySelector('button.exit')?.click();
  await sleep(300);

  return {
    vw,
    vh,
    issues,
    ok: issues.length === 0,
    field,
    hand,
    guide,
    actions,
    dockSummon,
    sideSummon,
    arena,
    meta,
    top,
    bottom,
    minZone,
    handMinW: hands.length ? Math.min(...hands) : null,
    badges,
    summonVisible,
  };
})()
