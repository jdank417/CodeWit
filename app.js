// app.js — consolidated scripts and interactions

// -----------------------------
// Countdown Timer
// -----------------------------
(function countdown() {
  const el = document.getElementById('countdown');
  if (!el) return;
  // Adjust year if needed
  const eventDate = new Date('January 31, 2026 09:00:00').getTime();
  const timer = setInterval(() => {
    const now = Date.now();
    const distance = eventDate - now;
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    if (distance <= 0) {
      clearInterval(timer);
      el.textContent = 'EVENT STARTED';
      return;
    }
    el.textContent = `T-MINUS: ${days}d ${hours}h ${minutes}m`;
  }, 1000);
})();

// -----------------------------
// Binary background with click reactions (horizontal rows)
// -----------------------------
(function binaryBackground() {
  const header = document.querySelector('header');
  const canvas = document.getElementById('binaryCanvas');
  if (!header || !canvas) return;
  const ctx = canvas.getContext('2d');

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0, height = 0;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // Row model
  let rows = [];
  let impulses = []; // click waves for visuals

  function resize() {
    const rect = header.getBoundingClientRect();
    width = Math.floor(rect.width);
    height = Math.floor(rect.height);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initRows();
  }
  window.addEventListener('resize', resize);

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function initRows() {
    rows = [];
    const rowHeight = Math.max(28, Math.min(48, Math.floor(height / 14))); // responsive density
    const count = Math.max(6, Math.floor(height / rowHeight));
    for (let i = 0; i < count; i++) {
      const y = Math.round((i + 0.5) * (height / count));
      const fontSize = rand(22, 36); // larger digits
      const direction = i % 2 === 0 ? 1 : -1; // alternate LTR/RTL
      const baseSpeed = reducedMotion ? 0 : direction * rand(12, 28); // px/sec, slow
      const spacing = Math.max(fontSize * 0.85, 18); // x spacing
      const jitter = rand(0, spacing); // initial phase
      rows.push({ y, fontSize, baseSpeed, spacing, offset: jitter, boost: 0 });
    }
  }

  // Click creates a speed boost wave for nearby rows + a ripple ring visual
  function addImpulse(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const radiusY = 120; // how far in Y affects rows
    rows.forEach(r => {
      const dy = Math.abs(r.y - y);
      if (dy <= radiusY) {
        const amt = 1 - dy / radiusY; // 0..1
        r.boost = Math.min(1.5, r.boost + amt * 1.2); // temporary speed up
      }
    });

    impulses.push({ x, y, radius: 0, life: 1 });

    const hint = document.getElementById('heroHint');
    if (hint) hint.classList.add('hint-hidden');
  }

  header.addEventListener('click', e => addImpulse(e.clientX, e.clientY));
  header.addEventListener('touchstart', e => {
    const t = e.touches && e.touches[0];
    if (t) addImpulse(t.clientX, t.clientY);
  }, { passive: true });

  let lastTime = 0;
  function tick(ts) {
    const dtMs = Math.min(50, ts - lastTime) || 16;
    lastTime = ts;
    const dt = dtMs / 1000; // seconds

    ctx.clearRect(0, 0, width, height);

    const color = '#f0db4f';
    ctx.fillStyle = color;

    // Update and draw rows
    rows.forEach(r => {
      // Apply boost decay
      if (r.boost > 0) r.boost = Math.max(0, r.boost - dt * 0.8);

      // Parallax with scroll (very subtle)
      const scrollParallax = (window.scrollY || window.pageYOffset || 0) * 0.005;

      // Advance offset
      const speed = r.baseSpeed * (1 + r.boost) + scrollParallax * (r.baseSpeed > 0 ? 1 : -1);
      r.offset = (r.offset + speed * dt) % (r.spacing);

      ctx.font = `${r.fontSize}px 'JetBrains Mono', monospace`;

      // Draw characters across the width
      // Determine how many to draw to cover screen + one extra on both sides
      const cols = Math.ceil(width / r.spacing) + 3;
      // Start so that characters wrap nicely
      const startX = -r.spacing + (r.baseSpeed > 0 ? -r.offset : r.offset);
      for (let i = 0; i < cols; i++) {
        const x = startX + i * r.spacing;
        // Base pattern 0/1 alternating by index and row
        const baseChar = (i + Math.floor(r.y)) % 2 === 0 ? '0' : '1';
        let char = baseChar;
        let alpha = 0.6 + 0.4 * ((i % 5) === 0 ? 1 : 0);
        let sizeBump = 0;
        let glow = 0;

        // Check active impulses for shockwave band effects
        if (impulses.length) {
          for (let k = 0; k < impulses.length; k++) {
            const im = impulses[k];
            const dx = x - im.x;
            const dy = r.y - im.y;
            const dist = Math.hypot(dx, dy);
            const band = 24; // thickness of the ring band
            const inBand = Math.abs(dist - im.radius) < band;
            if (inBand) {
              // Flip the bit
              char = baseChar === '0' ? '1' : '0';
              // Amplify visuals based on proximity to ring center
              const proximity = 1 - Math.min(1, Math.abs(dist - im.radius) / band);
              sizeBump = Math.max(sizeBump, proximity * 6);
              glow = Math.max(glow, proximity);
              alpha = Math.min(1, alpha + 0.35 * proximity);
            }
          }
        }

        // Apply glow and render
        ctx.save();
        if (glow > 0) {
          ctx.shadowColor = 'rgba(240,219,79,' + Math.min(0.85, 0.5 + glow * 0.5) + ')';
          ctx.shadowBlur = 8 + glow * 12;
        }
        ctx.globalAlpha = alpha;
        ctx.font = `${r.fontSize + sizeBump}px 'JetBrains Mono', monospace`;
        ctx.fillText(char, x, r.y);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    });

    // Update and draw ripple visuals
    impulses = impulses.filter(im => im.life > 0);
    impulses.forEach(im => {
      im.radius += dtMs * 0.6;
      im.life -= dt * 0.9;
      const a = Math.max(0, Math.min(0.5, im.life));
      ctx.strokeStyle = `rgba(240,219,79,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(im.x, im.y, im.radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    requestAnimationFrame(tick);
  }

  resize();
  requestAnimationFrame(tick);
})();

// -----------------------------
// Scroll reveal for cards
// -----------------------------
(function reveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('reveal-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

  elements.forEach(el => observer.observe(el));
})();

// -----------------------------
// Logo parallax tilt & float
// -----------------------------
(function logoEffects() {
  const header = document.querySelector('header');
  const logo = document.getElementById('heroLogo');
  if (!header || !logo) return;

  let rafId = null;
  let targetRX = 0, targetRY = 0;
  let rx = 0, ry = 0;
  let startTime = performance.now();

  function onMove(e) {
    const rect = header.getBoundingClientRect();
    const clientX = ('touches' in e && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = ('touches' in e && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
    const y = (clientY - rect.top) / rect.height - 0.5;
    const maxTilt = 8; // deg
    targetRY = x * maxTilt;
    targetRX = -y * maxTilt;
    if (!rafId) rafId = requestAnimationFrame(update);
  }

  function onLeave() {
    targetRX = 0; targetRY = 0;
    if (!rafId) rafId = requestAnimationFrame(update);
  }

  function update() {
    rx += (targetRX - rx) * 0.12;
    ry += (targetRY - ry) * 0.12;
    logo.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    if (Math.abs(targetRX - rx) > 0.01 || Math.abs(targetRY - ry) > 0.01) {
      rafId = requestAnimationFrame(update);
    } else {
      rafId = null;
    }
  }

  header.addEventListener('mousemove', onMove);
  header.addEventListener('mouseleave', onLeave);
  header.addEventListener('touchstart', onMove, { passive: true });
  header.addEventListener('touchmove', onMove, { passive: true });
  header.addEventListener('touchend', onLeave);
})();


// -----------------------------
// Card spotlight + tilt (lower sections)
// -----------------------------
(function cardHoverEffects() {
  const cards = document.querySelectorAll('.card');
  if (!cards.length) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (coarse) return; // skip tilt/spotlight on touch devices

  cards.forEach(card => {
    const maxTilt = 6; // degrees

    function onMove(e) {
      const rect = card.getBoundingClientRect();
      const cx = e.clientX;
      const cy = e.clientY;
      const x = (cx - rect.left) / rect.width; // 0..1
      const y = (cy - rect.top) / rect.height; // 0..1

      // spotlight position
      card.style.setProperty('--mx', (x * 100).toFixed(2) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(2) + '%');

      if (!prefersReduced) {
        const ry = (x - 0.5) * maxTilt * 2; // rotateY towards cursor
        const rx = -(y - 0.5) * maxTilt * 2; // rotateX towards cursor
        card.style.setProperty('--rx', rx.toFixed(2));
        card.style.setProperty('--ry', ry.toFixed(2));
      }
    }

    function onLeave() {
      card.style.setProperty('--rx', '0');
      card.style.setProperty('--ry', '0');
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
    }

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });
})();


// -----------------------------
// Team Network (SVG)
// -----------------------------
(function teamNetwork() {
  const container = document.getElementById('teamNetwork');
  if (!container) return;

  const NS = 'http://www.w3.org/2000/svg';
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let members;
  try {
    members = JSON.parse(container.getAttribute('data-members') || '[]');
  } catch (e) {
    members = [];
  }
  if (!members.length) return;

  // Decode any HTML entities that may be present in data-members
  const decodeHTML = (str) => {
    const ta = document.createElement('textarea');
    ta.innerHTML = str;
    return ta.value;
  };
  members = members.map(m => ({
    name: decodeHTML(m.name || ''),
    role: decodeHTML(m.role || '')
  }));

  function create(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(el);
    return el;
  }

  const svg = create('svg', { preserveAspectRatio: 'xMidYMid meet' }, null);
  const linksGroup = create('g', { class: 'links' }, svg);
  const hubGroup = create('g', { class: 'hub' }, svg);
  const nodesGroup = create('g', { class: 'nodes' }, svg);
  container.appendChild(svg);

  let width = 0, height = 0, cx = 0, cy = 0, radius = 0;
  let baseRotation = -Math.PI / 2; // start at top
  const step = (2 * Math.PI) / members.length;
  const nodeAngles = members.map((_, i) => i * step);

  // Hub
  const hubCircle = create('circle', {}, hubGroup);
  const hubText = create('text', { 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, hubGroup);
  hubText.textContent = 'TEAM';
  hubGroup.setAttribute('tabindex', '0');
  hubGroup.setAttribute('role', 'img');
  hubGroup.setAttribute('aria-label', 'Planning team hub');

  const nodeGroups = [];
  const hubLinks = [];

  // Nodes + links
  members.forEach((m, idx) => {
    const g = create('g', { class: 'team-node' }, nodesGroup);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${m.name} — ${m.role}`);

    const c = create('circle', { r: '18' }, g);

    const label = create('text', { 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g);
    const t1 = create('tspan', { x: '0', dy: '-0.2em' }, label); t1.textContent = m.name;
    const t2 = create('tspan', { x: '0', dy: '1.3em' }, label); t2.textContent = m.role;

    const link = create('line', { class: 'team-link' }, linksGroup);

    nodeGroups.push(g);
    hubLinks.push(link);

    function setHighlight(on) {
      if (on) {
        g.classList.add('highlight');
        link.classList.add('highlight');
      } else {
        g.classList.remove('highlight');
        link.classList.remove('highlight');
      }
    }

    g.addEventListener('mouseenter', () => setHighlight(true));
    g.addEventListener('mouseleave', () => setHighlight(false));
    g.addEventListener('focus', () => setHighlight(true));
    g.addEventListener('blur', () => setHighlight(false));
    g.addEventListener('click', () => showTooltip(idx));
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        showTooltip(idx);
      }
    });
  });

  // Tooltip logic
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'team-tooltip';
  tooltipEl.setAttribute('role', 'status');
  tooltipEl.setAttribute('aria-hidden', 'true');
  tooltipEl.innerHTML = '<div class="tt-name"></div><div class="tt-role"></div>';
  container.appendChild(tooltipEl);

  let selectedIndex = -1;

  function renderTooltip() {
    if (selectedIndex < 0) return;
    const m = members[selectedIndex];
    tooltipEl.querySelector('.tt-name').textContent = m.name;
    tooltipEl.querySelector('.tt-role').textContent = m.role;
  }

  function positionTooltip() {
    if (selectedIndex < 0) return;
    const a = baseRotation + nodeAngles[selectedIndex];
    const nx = cx + radius * Math.cos(a);
    const ny = cy + radius * Math.sin(a);
    tooltipEl.style.left = nx + 'px';
    tooltipEl.style.top = ny + 'px';
  }

  function showTooltip(idx) {
    selectedIndex = idx;
    renderTooltip();
    positionTooltip();
    tooltipEl.classList.add('visible');
    tooltipEl.setAttribute('aria-hidden', 'false');
  }

  function hideTooltip() {
    selectedIndex = -1;
    tooltipEl.classList.remove('visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }

  // Hide on background click (but not when clicking a node)
  container.addEventListener('click', (e) => {
    if (e.target.closest('.team-node') || e.target.closest('.team-tooltip')) return;
    hideTooltip();
  });

  // Hide on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  });

  // Also hide when focusing hub
  hubGroup.addEventListener('click', hideTooltip);
  hubGroup.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); hideTooltip(); } });

  function resize() {
    const rect = container.getBoundingClientRect();
    width = Math.max(320, Math.floor(rect.width));
    height = Math.max(260, Math.floor(rect.height));
    cx = width / 2; cy = height / 2;
    radius = Math.min(width, height) * 0.33;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const hubR = Math.max(18, Math.min(24, Math.floor(Math.min(width, height) * 0.04)));
    hubCircle.setAttribute('cx', cx);
    hubCircle.setAttribute('cy', cy);
    hubCircle.setAttribute('r', hubR.toString());
    hubText.setAttribute('x', cx);
    hubText.setAttribute('y', cy);

    updatePositions(0);
  }

  function updatePositions(dt) {
    nodeGroups.forEach((g, i) => {
      const a = baseRotation + nodeAngles[i];
      const nx = cx + radius * Math.cos(a);
      const ny = cy + radius * Math.sin(a);
      g.setAttribute('transform', `translate(${nx},${ny})`);

      const link = hubLinks[i];
      link.setAttribute('x1', cx);
      link.setAttribute('y1', cy);
      link.setAttribute('x2', nx);
      link.setAttribute('y2', ny);
    });
  }

  let lastTs = 0;
  function animate(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    if (!prefersReduced) {
      baseRotation += dt * 0.15; // slow orbit
      updatePositions(dt);
    }
    if (typeof positionTooltip === 'function') positionTooltip();
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  // Initial
  resize();
  requestAnimationFrame(animate);
})();


// -----------------------------
// Subtle hover scramble effect for names
// -----------------------------
(function nameScramble() {
  const els = document.querySelectorAll('.glitch-hover');
  if (!els.length) return;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  els.forEach(el => {
    const original = el.textContent;
    let raf = null;

    function scramble() {
      if (prefersReduced) return;
      const duration = 520;
      const start = performance.now();
      cancelAnimationFrame(raf);

      function frame(ts) {
        const p = Math.min(1, (ts - start) / duration);
        const reveal = Math.floor(original.length * p);
        const out = original.split('').map((ch, idx) => {
          if (idx < reveal || /\s/.test(ch)) return ch;
          return letters[Math.floor(Math.random() * letters.length)];
        }).join('');
        el.textContent = out;
        if (p < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          el.textContent = original;
        }
      }
      raf = requestAnimationFrame(frame);
    }

    el.addEventListener('mouseenter', scramble);
    el.addEventListener('focus', scramble);
  });
})();


// -----------------------------
// Operator cards: expand/collapse on click/keyboard
// -----------------------------
(function operatorCardsExpand() {
  const cards = document.querySelectorAll('.operator-card[aria-controls]');
  if (!cards.length) return;

  function getRegion(card) {
    const id = card.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
    }

  function setExpanded(card, expand) {
    const region = getRegion(card);
    const on = !!expand;
    card.setAttribute('aria-expanded', on ? 'true' : 'false');
    card.classList.toggle('expanded', on);
    if (region) region.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function closeOthers(except) {
    cards.forEach(c => { if (c !== except) setExpanded(c, false); });
  }

  // Initialize ARIA/state coherently
  cards.forEach(card => setExpanded(card, card.getAttribute('aria-expanded') === 'true'));

  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Ignore interactive elements inside
      if (e.target.closest('a, button')) return;
      const expand = card.getAttribute('aria-expanded') !== 'true';
      if (expand) closeOthers(card);
      setExpanded(card, expand);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const expand = card.getAttribute('aria-expanded') !== 'true';
        if (expand) closeOthers(card);
        setExpanded(card, expand);
      }
    });
  });
})();
