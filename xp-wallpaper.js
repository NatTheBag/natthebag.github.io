/* ═══════════════════════════════════════════════════════════════
   xp-wallpaper.js — pixel-art "Bliss" desktop with bunnies
   ───────────────────────────────────────────────────────
   Draws a low-resolution canvas behind the window chrome and
   scales it up with image-rendering: pixelated, so every edge
   stays chunky.

   No CSS gradients anywhere: the sky and grass are flat colour
   bands blended with an ordered (Bayer) dither — the way a
   256-colour desktop actually did it.

   Bunnies only ever live on this layer. The canvas is
   pointer-events: none and sits below every real UI element, so
   nothing here can cover or interfere with the page.

   ─────────────────────────────────────────────
   TWEAKING
   ─────────────────────────────────────────────
     PIXEL      → screen px per drawn pixel (bigger = chunkier)
     BUNNY_COUNT→ how many bunnies roam the field
     hillY()    → the shape of the hill
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const PIXEL       = 4;   // CSS pixels per art pixel
  const BUNNY_COUNT = 7;

  const canvas = document.createElement('canvas');
  canvas.className = 'xp-wallpaper';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  // offscreen layer for the static scene (sky + hill)
  const scene    = document.createElement('canvas');
  const sceneCtx = scene.getContext('2d');

  let W = 0, H = 0;

  /* ── PALETTES ─────────────────────────────────────────────
     Listed light→dark; the renderer dithers between neighbours. */

  const SKY = [
    [ 30,  92, 190], [ 50, 119, 210], [ 74, 142, 224],
    [102, 166, 234], [140, 192, 243], [182, 216, 248], [216, 235, 252]
  ];

  const GRASS = [
    [134, 198,  62], [113, 178,  47], [ 92, 158,  38],
    [ 74, 137,  30], [ 58, 116,  24], [ 45,  96,  20]
  ];

  // 4x4 ordered dither matrix, normalised 0..1
  const BAYER = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  /* Quantise a ramp into more, closer-spaced bands. Neighbouring
     bands then differ by only a few values, so the dither reads as
     a fine stipple instead of a loud checkerboard. */
  function expand(colors, steps) {
    const out = [];
    for (let i = 0; i < steps; i++) {
      const p = (i / (steps - 1)) * (colors.length - 1);
      const a = Math.floor(p);
      const b = Math.min(colors.length - 1, a + 1);
      const f = p - a;
      out.push([
        Math.round(colors[a][0] + (colors[b][0] - colors[a][0]) * f),
        Math.round(colors[a][1] + (colors[b][1] - colors[a][1]) * f),
        Math.round(colors[a][2] + (colors[b][2] - colors[a][2]) * f)
      ]);
    }
    return out;
  }

  const SKY_BANDS   = expand(SKY,   20);
  const GRASS_BANDS = expand(GRASS, 16);

  /* ── THE HILL ─────────────────────────────────────────────
     Crest high on the left, sloping away to the right. */
  function hillY(x) {
    const t = x / W;
    const d = t - 0.26;
    const bump = Math.exp(-(d * d) / (2 * 0.30 * 0.30));
    return H * 0.56 - H * 0.17 * bump - H * 0.012 * Math.sin(t * 6.2 + 1.1);
  }

  /* Pick a colour from a ramp at position p (0..1), dithering
     between the two nearest bands so the transition is stippled
     rather than smoothly blended. */
  function ramp(colors, p, x, y) {
    const pos  = Math.max(0, Math.min(1, p)) * (colors.length - 1);
    const i    = Math.min(colors.length - 1, Math.floor(pos));
    const frac = pos - i;
    const threshold = BAYER[y & 3][x & 3] / 16;
    const idx = (frac > threshold && i + 1 < colors.length) ? i + 1 : i;
    return colors[idx];
  }

  function buildScene() {
    scene.width  = W;
    scene.height = H;

    const img  = sceneCtx.createImageData(W, H);
    const data = img.data;

    for (let x = 0; x < W; x++) {
      const hy = hillY(x);

      for (let y = 0; y < H; y++) {
        let c;

        if (y < hy) {
          // sky — deepest overhead, palest at the horizon
          c = ramp(SKY_BANDS, y / hy, x, y);
        } else {
          const depth = (y - hy) / Math.max(1, H - hy);
          // the crest catches the light
          c = (y - hy) < 2 ? GRASS_BANDS[0] : ramp(GRASS_BANDS, depth * 1.1, x, y);
        }

        const o = (y * W + x) * 4;
        data[o]     = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    }

    sceneCtx.putImageData(img, 0, 0);
  }

  /* ── SPRITES ──────────────────────────────────────────────
     '.' transparent · 'w' body · 's' shade · 'e' eye         */

  // facing right · long upright ears · cotton tail at the left
  const BUNNY_RUN_A = [
    '.......w.w.',
    '.......w.w.',
    '......www..',
    '.....wwwww.',
    '..wwwwwwew.',
    '.wwwwwwwww.',
    'wwwwwwwwww.',
    '..ww...ww..',
    '..ss...ss..'
  ];

  const BUNNY_RUN_B = [
    '.......w.w.',
    '.......w.w.',
    '......www..',
    '.....wwwww.',
    '..wwwwwwew.',
    '.wwwwwwwww.',
    'wwwwwwwwww.',
    '.w......w..',
    's........s.'
  ];

  const BUNNY_SIT = [
    '.....w.w...',
    '.....w.w...',
    '.....www...',
    '....wwwww..',
    '...wwwwwew.',
    '..wwwwwwww.',
    '..wwwwwwww.',
    '..wwwwwwww.',
    '..ssswwss..'
  ];

  const COATS = [
    { w: '#f5f3ec', s: '#cfc9bd', e: '#2b2b28' },  // white
    { w: '#f5f3ec', s: '#cfc9bd', e: '#2b2b28' },
    { w: '#cbc7be', s: '#9c988d', e: '#2b2b28' },  // grey
    { w: '#b8865a', s: '#8a603a', e: '#241c14' },  // brown
    { w: '#8f7358', s: '#6b543e', e: '#241c14' }   // dark brown
  ];

  const CLOUDS = [
    [
      '.....wwww.......',
      '..wwwwwwwww.....',
      '.wwwwwwwwwwwww..',
      'wwwwwwwwwwwwwww.',
      '.sssssssssssss..'
    ],
    [
      '...www.....',
      '.wwwwwwww..',
      'wwwwwwwwww.',
      '.ssssssss..'
    ],
    [
      '..www...',
      '.wwwwww.',
      '.ssssss.'
    ]
  ];

  const CLOUD_COAT = { w: '#ffffff', s: '#cfe0f2' };

  function drawSprite(sprite, px, py, scale, dir, coat) {
    const cols = sprite[0].length;
    for (let r = 0; r < sprite.length; r++) {
      const row = sprite[r];
      for (let c = 0; c < cols; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        const color = coat[ch];
        if (!color) continue;
        const cx = dir < 0 ? (cols - 1 - c) : c;
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.round(px + cx * scale),
          Math.round(py + r * scale),
          scale, scale
        );
      }
    }
  }

  /* ── ACTORS ───────────────────────────────────────────────── */

  const HOP = [0, -1, -2, -2, -1, 0];   // vertical offset through a hop

  let bunnies = [];
  let clouds  = [];

  function makeBunny(spawnAnywhere) {
    const depth = 0.10 + Math.random() * 0.60;      // 0 = far, 1 = near
    const scale = depth < 0.52 ? 1 : 2;             // a couple of near ones
    const dir   = Math.random() < 0.5 ? 1 : -1;
    return {
      depth, scale, dir,
      x: spawnAnywhere ? Math.random() * W : (dir > 0 ? -12 * scale : W + 12 * scale),
      speed: 10 + depth * 24,
      coat:  COATS[(Math.random() * COATS.length) | 0],
      phase: Math.random(),
      state: 'run',
      timer: 1 + Math.random() * 4
    };
  }

  function makeCloud(spawnAnywhere) {
    const kind = (Math.random() * CLOUDS.length) | 0;
    const sprite = CLOUDS[kind];
    const scale = kind === 0 ? 2 : 1;
    return {
      sprite, scale,
      x: spawnAnywhere ? Math.random() * W : -sprite[0].length * scale,
      y: cloudY(),
      speed: 1.2 + Math.random() * 2.4
    };
  }

  // clouds stay well clear of the hill
  function cloudY() {
    return 3 + Math.random() * Math.max(5, H * 0.22);
  }

  function populate() {
    bunnies = [];
    for (let i = 0; i < BUNNY_COUNT; i++) bunnies.push(makeBunny(true));
    clouds = [];
    for (let i = 0; i < 4; i++) clouds.push(makeCloud(true));
  }

  function updateBunny(b, dt) {
    if (b.state === 'run') {
      b.x += b.dir * b.speed * dt;
      b.phase = (b.phase + dt / 0.38) % 1;
      b.timer -= dt;
      if (b.timer <= 0) {
        b.state = 'sit';
        b.timer = 1.2 + Math.random() * 3;
      }
    } else {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.state = 'run';
        b.timer = 2 + Math.random() * 6;
        if (Math.random() < 0.35) b.dir *= -1;    // change their mind
      }
    }

    // wrap around the field
    const w = 11 * b.scale;
    if (b.x > W + w)  b.x = -w;
    if (b.x < -w - 1) b.x = W + w;
  }

  function drawBunny(b) {
    const hy   = hillY(Math.max(0, Math.min(W - 1, b.x)));
    const feet = hy + b.depth * (H - hy);

    let sprite, lift = 0;
    if (b.state === 'sit') {
      sprite = BUNNY_SIT;
    } else {
      const step = Math.floor(b.phase * HOP.length) % HOP.length;
      lift   = HOP[step] * b.scale;
      sprite = b.phase < 0.5 ? BUNNY_RUN_A : BUNNY_RUN_B;
    }

    const top = feet - sprite.length * b.scale + lift;

    // shadow keeps them planted on the grass
    ctx.fillStyle = 'rgba(20, 50, 12, 0.22)';
    ctx.fillRect(
      Math.round(b.x + b.scale),
      Math.round(feet - b.scale),
      8 * b.scale, b.scale
    );

    drawSprite(sprite, b.x, top, b.scale, b.dir, b.coat);
  }

  /* ── LOOP ─────────────────────────────────────────────────── */

  const reduceMotion = window.matchMedia &&
                       window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render(dt) {
    ctx.drawImage(scene, 0, 0);

    for (const c of clouds) {
      if (dt) {
        c.x += c.speed * dt;
        if (c.x > W) c.x = -c.sprite[0].length * c.scale;
      }
      drawSprite(c.sprite, c.x, c.y, c.scale, 1, CLOUD_COAT);
    }

    for (const b of bunnies) {
      if (dt) updateBunny(b, dt);
      drawBunny(b);
    }
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) || 0;
    last = now;
    render(dt);
    requestAnimationFrame(frame);
  }

  /* ── SETUP ────────────────────────────────────────────────── */

  function resize() {
    const nextW = Math.max(64, Math.ceil(window.innerWidth  / PIXEL));
    const nextH = Math.max(48, Math.ceil(window.innerHeight / PIXEL));
    if (nextW === W && nextH === H) return;

    const scaleX = W ? nextW / W : 1;
    W = nextW;
    H = nextH;
    canvas.width  = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;

    buildScene();

    if (bunnies.length) {
      // keep everyone roughly where they were
      for (const b of bunnies) b.x *= scaleX;
      for (const c of clouds) {
        c.x *= scaleX;
        c.y = Math.min(c.y, cloudY());   // never let a cloud land on the grass
      }
    } else {
      populate();
    }

    render(0);
  }

  /* Resize on the very next frame rather than on a timer — a debounce
     leaves the old, smaller canvas stretched across the new viewport,
     which shows up as a smear of giant pixels while dragging. */
  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      resize();
    });
  });

  resize();
  if (!reduceMotion) requestAnimationFrame(frame);
})();
