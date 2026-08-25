(function(){
  var KEY = 'nightDeepSpace';
  var canvas, ctx, w = 0, h = 0, dpr = 1, raf = 0, running = false;
  var stars = [], dust = [], meteors = [];
  var t0 = performance.now();
  var grainCanvas = null, grainReady = false;
  var focal = 500; // perspective constant, recomputed on resize() from h

  // ── Battery/perf: this layer is a passive ambient background, not an
  // interactive scene — it never needs full 60fps, and it should never run
  // at all while the app isn't actually visible. Two cheap wins account for
  // most of the drain: (1) stop the rAF loop entirely on tab/app background
  // instead of quietly painting off-screen pixels every frame, (2) cap the
  // frame rate on phones (desktop stays smooth/uncapped). A third, bigger
  // win below (sprite-based star rendering) removes the per-star gradient
  // allocations that were the actual CPU/GC cost, not just skip frames.
  var isMobile = false;
  var _mobileFrameMs = 33; // ~30fps target on phones; desktop uncapped
  var _lastDrawT = 0;
  var _pageHidden = (typeof document !== 'undefined' && document.hidden);

  // ── Explore camera — 360 look-around (drag) + forward/back travel (scroll/pinch) ──
  // Stars live at real 3D world positions (X,Y,Z ahead of the camera). Looking
  // around rotates the whole field into camera space before projecting (a true
  // spherical look, not a flat 2D pan). Traveling forward/back moves the camera
  // along Z; stars that pass behind get silently respawned far ahead (and vice
  // versa going backward) so the field is effectively infinite in every
  // direction — there's nothing to "run out of", so nothing ever skips/pops.
  var cam = {
    yaw: 0, pitch: 0,           // look direction, radians
    yawVel: 0, pitchVel: 0,     // angular momentum from drag flicks
    travelZ: 0,                 // accumulated forward distance
    travelVel: 0                // current forward/back speed (eased, not instant)
  };
  var NEAR_Z = 4;

  // Warp toggle: when on, travelVel is continuously eased toward WARP_SPEED
  // instead of decaying to zero — same easing math stepCamera() already
  // uses for scroll/pinch impulses, just given a standing target instead of
  // a one-off nudge, so it feels like the same "hold the scroll key down"
  // acceleration, sustained indefinitely.
  var _warpOn = false;
  var WARP_SPEED = 210;
  var WARP_EASE = 0.045; // lower = slower spin-up to full speed
  var WARP_KEY = 'synapses_deepspace_warp'; // persists across app close/reopen
  // Same "hold scroll down" cruise as warp, just aimed at a much lower
  // resting target — this is what's always running by default so the scene
  // has a constant, barely-there forward drift instead of sitting dead
  // still until someone touches warp or scroll. Also what a manual
  // scroll/pinch impulse settles back down to afterward, instead of
  // decaying all the way to a full stop.
  var IDLE_SPEED = 6;
  var IDLE_EASE = 0.03;
  // Mobile compensation: dt-based travel is frame-rate independent (the
  // 30fps cap just makes it choppier, not slower), but focal/screen-size
  // math means identical world-space speed covers fewer visible pixels on
  // a smaller, closer, higher-density phone screen — same motion, less
  // perceived distance covered. Only bumps the idle (non-warp) creep;
  // warp speed is left alone since it already reads fine on mobile.
  var MOBILE_SPEED_MULT = 1.8;

  // ISOTROPIC FIELD: stars/dust are spawned in a cube of fixed radius
  // centered on the camera's current position (0,0,travelZ), the same
  // radius in every axis (x, y, AND z). This is the actual fix for the
  // "empty in some directions, crowded in others" bug — the earlier model
  // spawned a box stretched way out along the Z axis (FAR_Z=900,
  // BEHIND_Z=500) but only WORLD_HALF=1500 sideways, so looking forward (Z)
  // showed a full field while turning 90° to look sideways (X) showed
  // almost nothing — direction-dependent density. A cube with the same
  // radius on every axis has uniform point density in every direction by
  // construction, so panning/turning/looking-around always shows roughly
  // the same star count.
  var STAR_FIELD_R = 600;
  var DUST_FIELD_R = 300;

  // A field with equal density in all directions only shows a fraction of
  // its total population inside the camera's actual field of view at any
  // moment (the rest is behind you, to the sides, etc — same as a real sky,
  // you only ever see part of it). This multiplier inflates the raw counts
  // so the portion actually on-screen lands back near the original flat
  // field's density, instead of looking sparse. (Verified against the
  // real projection math — mult=8 keeps ~400 stars / ~50 dust motes
  // on-screen consistently across a full 360° turn.)
  var DENSITY_MULT = 8;

  // Typical distance from camera to a spawned particle (half the cube
  // radius) — used to normalize proximity-based size/brightness so a
  // particle at its typical depth renders the same size as it did in the
  // original flat, non-zoom star field.
  var STAR_BASE_Z = STAR_FIELD_R * 0.5;
  var DUST_BASE_Z = DUST_FIELD_R * 0.5;
  var _dragging = false, _dragLastX = 0, _dragLastY = 0, _dragMoved = false;
  var _dragStartX = 0, _dragStartY = 0, _dragArmed = false, _dragStartT = 0; // dead-zone: real drag only after crossing PAN_THRESHOLD *and* MIN_HOLD_MS
  var _dragVX = 0, _dragVY = 0; // recent drag speed, for release momentum
  var _pinchStartDist = 0, _pinchLastDist = 0;
  var _camResetT = 0, _camResetting = false;
  var _camFrom = { yaw: 0, pitch: 0 };
  // Dust-lane band gradient is expensive to rebuild (5 color stops) and its
  // values only ever depend on h — cache it and only rebuild on resize()
  // instead of recreating it 60x/sec in frame(). Rebuilding every frame was
  // adding avoidable per-frame cost that showed up as stutter/flicker during
  // the opacity fade-in.
  var bandGradient = null;
  // Real elapsed-time delta drives star drift between frames.
  var _lastFrameT = 0;
  var _resizeDebounceTimer = null;
  // Band reveals via a growing CLIP region (sweeps outward from center),
  // not by animating its own alpha. Its gradient stops are close together
  // (0.03/0.045/0.028) — if alpha changes every frame, the browser has to
  // re-dither those close values differently each time, which is what read
  // as shaky/glitchy/pixelated. A clip only changes *how much* of a fixed,
  // never-changing gradient is visible, so nothing ever gets re-dithered —
  // it just draws itself outward like a beam extending, cleanly.
  var _bandStartT = 0, BAND_REVEAL_MS = 650;
  // #deepSpaceLayer fades opacity over 1.6s in CSS (see the #deepSpaceLayer
  // rule) — this timer matches that so stop() can defer wiping the canvas
  // until after the fade finishes, instead of clearing it instantly.
  var _stopClearTimer = null;

  // Per-page state: "Ask me anything" (empty chat starter) and "LLM chat"
  // (once a conversation is going) are actually the SAME section (#sec-chat)
  // just with #chatEmptyState shown vs hidden — so scope on that, not on
  // _currentViewId, or both states collapse onto one shared key.
  function currentScope(){
    try{
      var view = (typeof _currentViewId !== 'undefined' && _currentViewId) ? _currentViewId : (localStorage.getItem('synapses_last_section') || 'sec-welcome');
      if(view === 'sec-chat'){
        var es = document.getElementById('chatEmptyState');
        var empty = !es || !es.classList.contains('hidden');
        return empty ? 'sec-chat-ask' : 'sec-chat-llm';
      }
      return view;
    }catch(e){ return 'sec-welcome'; }
  }
  function scopedKey(scope){ return KEY + ':' + scope; }
  // One-time migration: the old build had a single global switch. Carry its
  // value forward into the scopes that actually used it so nothing changes
  // for existing users — from here on each scope tracks its own.
  function migrateLegacy(){
    try{
      var legacy = localStorage.getItem(KEY);
      if(legacy === null) return;
      ['sec-welcome','sec-chat-ask','sec-chat-llm'].forEach(function(scope){
        if(localStorage.getItem(scopedKey(scope)) === null) localStorage.setItem(scopedKey(scope), legacy);
      });
      localStorage.removeItem(KEY);
    }catch(e){}
  }
  // Standalone embed: always on, no theme/toggle system to defer to.
  function isOn(scope){ return true; }
  function isNight(){ return true; }
  function active(){ return true; }

  function setOn(on){
    try{ localStorage.setItem(scopedKey(currentScope()), on ? '1' : '0'); }catch(e){}
    syncDom();
    if(on && isNight()) start(); else if(!active()) stop();
    updateMenuUi();
  }
  function toggle(){ setOn(!isOn()); }

  // #chatEmptyState's hidden class flips in a dozen different places in the
  // app (send message, new chat, open recent chat, etc). Rather than hook
  // every call site, just watch the element itself and re-sync whenever its
  // empty/active state actually changes.
  var _watchedEmptyStateEl = null, _lastEmptyStateHidden = null;
  function watchChatEmptyState(){
    var es = document.getElementById('chatEmptyState');
    if(!es || es === _watchedEmptyStateEl) return;
    _watchedEmptyStateEl = es;
    _lastEmptyStateHidden = es.classList.contains('hidden');
    var mo = new MutationObserver(function(){
      var nowHidden = es.classList.contains('hidden');
      if(nowHidden !== _lastEmptyStateHidden){
        _lastEmptyStateHidden = nowHidden;
        onThemeChange();
      }
    });
    mo.observe(es, { attributes: true, attributeFilter: ['class'] });
  }


  // Fade-in stays slow (matches the greeting text's entrance pace), but
  // fade-out was using the same 1.6s and felt sluggish — snappier on the way
  // out. Kept in sync with the deferred canvas-clear timer in stop() below.
  var FADE_IN_MS = 1600, FADE_OUT_MS = 400;
  function syncDom(){
    try{
      var layer = document.getElementById('deepSpaceLayer');
      var on = active();
      if(layer) layer.style.transitionDuration = (on ? FADE_IN_MS : FADE_OUT_MS) + 'ms';
      if(on) document.documentElement.classList.add('deep-space-on');
      else document.documentElement.classList.remove('deep-space-on');
    }catch(e){}
  }

  function bakeGrain(){
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = 256; grainCanvas.height = 256;
    var gctx = grainCanvas.getContext('2d');
    var img = gctx.createImageData(256, 256);
    var d = img.data;
    for(var i = 0; i < d.length; i += 4){
      var v = (Math.random() * 255) | 0;
      d[i] = d[i+1] = d[i+2] = v;
      d[i+3] = 18 + (Math.random() * 22) | 0;
    }
    gctx.putImageData(img, 0, 0);
    grainReady = true;
  }

  // ── Pre-baked star/dust sprites ──
  // drawSoftStar() used to call ctx.createRadialGradient() + fill() for
  // EVERY star, EVERY frame (hundreds of times, 30-60x/sec) — allocating a
  // fresh gradient object each call. That constant allocation is exactly
  // the kind of thing that (a) burns CPU/battery for no visual gain, since
  // the gradient shape never actually changes, and (b) triggers frequent
  // GC pauses, which is what read as the occasional stutter/hitch — most
  // noticeable during warp when more stars are streaming past at once.
  // Fix: bake the gradient once per color variant into a small offscreen
  // canvas, then every frame just drawImage() that sprite scaled to size,
  // using globalAlpha to control brightness. globalAlpha multiplies the
  // sprite's own per-pixel alpha, so a sprite baked at full alpha and drawn
  // with globalAlpha=aVal produces IDENTICAL output to the old
  // createRadialGradient(...,aVal) call — same stops, same ratios — just
  // without re-allocating a gradient object 60 times a second.
  var starSprite = { warm: null, cool: null };
  var dustSprite = null;
  var spritesReady = false;
  var SPRITE_SIZE = 128, SPRITE_R = 64;
  function bakeSoftSprite(c0, c1){
    var sc = document.createElement('canvas');
    sc.width = sc.height = SPRITE_SIZE;
    var sctx = sc.getContext('2d');
    var g = sctx.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R);
    g.addColorStop(0, 'rgba(' + c0 + ',1)');
    g.addColorStop(0.18, 'rgba(' + c0 + ',0.45)');
    g.addColorStop(0.45, 'rgba(' + c1 + ',0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(SPRITE_R, SPRITE_R, SPRITE_R, 0, Math.PI * 2);
    sctx.fill();
    return sc;
  }
  function bakeStarSprites(){
    starSprite.warm = bakeSoftSprite('235,238,248', '200,205,220');
    starSprite.cool = bakeSoftSprite('210,222,245', '170,185,215');
    var dc = document.createElement('canvas');
    dc.width = dc.height = SPRITE_SIZE;
    var dctx = dc.getContext('2d');
    var dg = dctx.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R);
    dg.addColorStop(0, 'rgba(180,195,220,1)');
    dg.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = dg;
    dctx.beginPath();
    dctx.arc(SPRITE_R, SPRITE_R, SPRITE_R, 0, Math.PI * 2);
    dctx.fill();
    dustSprite = dc;
    spritesReady = true;
  }

  function buildBandGradient(){
    if(!ctx) return;
    var band = ctx.createLinearGradient(0, -h * 0.1, 0, h * 0.1);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.4, 'rgba(150,165,200,0.03)');
    band.addColorStop(0.5, 'rgba(180,195,220,0.045)');
    band.addColorStop(0.6, 'rgba(150,165,200,0.028)');
    band.addColorStop(1, 'rgba(0,0,0,0)');
    bandGradient = band;
  }

  function resize(){
    if(!canvas) return;
    // Size off the layer container, not the window — this is what lets the
    // same engine work both as a full-page fixed background AND as a
    // section-scoped banner (e.g. absolutely positioned inside a shorter
    // <section>). For a full-page fixed layer the container IS the
    // viewport, so this is a no-op change there.
    var host = canvas.parentElement;
    var rect = host ? host.getBoundingClientRect() : null;
    w = (rect && rect.width) ? rect.width : window.innerWidth;
    h = (rect && rect.height) ? rect.height : window.innerHeight;
    isMobile = window.innerWidth <= 768;
    // Battery: full retina (2x) density quadruples the pixels this canvas
    // has to fill every frame for detail nobody's scrutinizing on an
    // ambient background. Desktop keeps the existing 2x cap; phones are
    // capped lower (1.5x) — still crisp, meaningfully less GPU/CPU work.
    dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    focal = h * 0.9;
    buildBandGradient();
    seed();
  }

  function seed(){
    stars = [];
    dust = [];
    meteors = [];
    var area = w * h;
    // Density scales with area; floor lowered from 280→150 so phones
    // (~329k px²) land near their natural ~117 count instead of being
    // forced up to desktop-sized density. But most desktop screens sail
    // well past this floor naturally (a laptop lands ~4000+ after
    // DENSITY_MULT), while phones sit right at the bottom of the range —
    // so mobile reads visibly sparser at a glance, especially parked/idle
    // where there's no streak-trail to fill the frame. Mobile gets its
    // own higher floor to close that gap without touching desktop.
    var nStars = Math.round(Math.min(900, Math.max(isMobile ? 270 : 150, Math.floor(area / 2800))) * DENSITY_MULT);
    var i;
    for(i = 0; i < nStars; i++){
      var bright = Math.random();
      // depth 0 = far (soft/dim), 1 = mid, 2 = near (slightly sharper)
      var depth = bright > 0.94 ? 2 : (bright > 0.55 ? 1 : 0);
      var baseR = bright > 0.97 ? (1.2 + Math.random() * 1.3)
        : (bright > 0.85 ? 0.75 + Math.random() * 0.55 : 0.3 + Math.random() * 0.5);
      var baseA = bright > 0.97 ? 0.42 + Math.random() * 0.28
        : (bright > 0.7 ? 0.18 + Math.random() * 0.22 : 0.06 + Math.random() * 0.12);
      // Soft halo size — far stars blurrier so they sit *in* the void
      var soft = depth === 0 ? (5.5 + Math.random() * 3)
        : (depth === 1 ? (3.8 + Math.random() * 1.8) : (2.6 + Math.random() * 1.2));
      // Depth-scaled drift: near stars stream past faster than far ones —
      // real motion parallax for a viewpoint actually moving through space.
      var driftSpeed = depth === 2 ? (2.4 + Math.random() * 2.6)
        : (depth === 1 ? (0.6 + Math.random() * 0.9) : (0.1 + Math.random() * 0.16));
      var driftAng = Math.random() * Math.PI * 2;
      stars.push({
        // Real 3D world position around the camera's current travel spot —
        // an isotropic cube (same radius x/y/z), so density stays even in
        // every look direction instead of being stretched forward-only.
        wx: (Math.random() * 2 - 1) * STAR_FIELD_R,
        wy: (Math.random() * 2 - 1) * STAR_FIELD_R,
        wz: cam.travelZ + (Math.random() * 2 - 1) * STAR_FIELD_R,
        r: baseR,
        a: baseA * (depth === 0 ? 0.75 : 1),
        soft: soft,
        depth: depth,
        cool: Math.random() > 0.78,
        // Gentle ambient drift still runs sideways in world space (independent
        // of camera travel) so the field never looks perfectly static even
        // while parked.
        vx: Math.cos(driftAng) * driftSpeed * 0.4,
        vy: Math.sin(driftAng) * driftSpeed * 0.4,
        flareAt: 0
      });
    }
    // sort far → near so we can paint with haze between
    stars.sort(function(a, b){ return a.depth - b.depth; });

    // Dust used to be a flat 55 regardless of screen size — ~6x denser
    // per pixel on phones than desktop. Now scales with area, same idea
    // as nStars above (mobile ~15, desktop caps at 55).
    var nDust = Math.round(Math.min(55, Math.max(15, Math.floor(area / 22000))) * DENSITY_MULT);
    for(i = 0; i < nDust; i++){
      dust.push({
        wx: (Math.random() * 2 - 1) * DUST_FIELD_R,
        wy: (Math.random() * 2 - 1) * DUST_FIELD_R,
        wz: cam.travelZ + (Math.random() * 2 - 1) * DUST_FIELD_R,
        r: 0.5 + Math.random() * 1.4,
        a: 0.02 + Math.random() * 0.05,
        vx: (Math.random() - 0.5) * 0.01,
        vy: (Math.random() - 0.5) * 0.006,
        soft: 3 + Math.random() * 2
      });
    }
  }

  // Rotates a world-space point into camera space (yaw then pitch) and
  // perspective-projects it to screen coordinates. Returns null if the point
  // sits behind the camera plane (nothing to draw / would otherwise pop).
  function project(wx, wy, wz){
    var dz = wz - cam.travelZ;
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var x1 = wx * cy + dz * sy;
    var z1 = -wx * sy + dz * cy;
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var y2 = wy * cp + z1 * sp;
    var z2 = -wy * sp + z1 * cp;
    if(z2 < 0.08) return null; // behind the camera's view
    var scale = focal / z2;
    return {
      sx: w * 0.5 + x1 * scale,
      sy: h * 0.5 + y2 * scale,
      z: z2,
      scale: scale,
      // Fade in over the last bit before the camera plane instead of a hard
      // cutoff, so stars entering/leaving the visible hemisphere as you look
      // around never pop — they ease in/out.
      edgeFade: Math.min(1, (z2 - 0.08) / 0.35)
    };
  }

  // Same rotation as project(), but for a fixed direction rather than a
  // world position with distance — used for things treated as effectively
  // infinitely far away (the dust-lane band), so panning slides them
  // laterally the way turning your head really does, instead of the fake
  // "spin around the screen center" a flat 2D rotate produces.
  function projectDir(dx, dy, dz){
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var x1 = dx * cy + dz * sy;
    var z1 = -dx * sy + dz * cy;
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var y2 = dy * cp + z1 * sp;
    var z2 = -dy * sp + z1 * cp;
    if(z2 < 0.05) return null;
    return {
      sx: w * 0.5 + (x1 / z2) * focal,
      sy: h * 0.5 + (y2 / z2) * focal,
      edgeFade: Math.min(1, (z2 - 0.05) / 0.25)
    };
  }

  // The dust-lane band is a great circle — the set of directions in the
  // plane through the camera spanned by BAND_A and BAND_T. The gnomonic
  // projection project()/projectDir() already use maps ANY great circle to
  // a perfectly straight line in screen space (this is a real property of
  // that projection, not an approximation) — so instead of sampling points
  // along what we assumed was a curve (attempt #1: visible seams between
  // segments; attempt #2: still fighting the same non-problem), we derive
  // that line directly and exactly from the plane's normal vector, rotated
  // into camera space the same way every direction vector already is.
  // This also fixes the original bug for a different reason than either
  // retry did: the old code anchored everything to ONE projected point
  // (BAND_A, "straight ahead") and returned early — killing the whole band
  // — the instant that single point rotated out of view, even though the
  // rest of the same line could still be on screen. Deriving the line from
  // the plane normal has no such single point of failure.
  var BAND_TILT = -0.26;
  var BAND_A = { x: 0, y: 0, z: 1 };                                   // straight ahead
  function computeBandNormal(tilt){
    var bt = { x: Math.cos(tilt), y: Math.sin(tilt), z: 0 };
    // Plane normal = BAND_A × tangent (band's great circle is every
    // direction perpendicular to this).
    return {
      x: BAND_A.y * bt.z - BAND_A.z * bt.y,
      y: BAND_A.z * bt.x - BAND_A.x * bt.z,
      z: BAND_A.x * bt.y - BAND_A.y * bt.x
    };
  }
  var BAND_N = computeBandNormal(BAND_TILT);
  function drawBand(bandEase){
    if(bandEase <= 0 || !bandGradient) return;
    var bandN = BAND_N;
    // Rotate the plane normal into camera space — identical rotation math
    // to projectDir(), just without the final divide-by-z (we don't need a
    // point yet, only the rotated normal, to derive the line's equation).
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var x1 = bandN.x * cy + bandN.z * sy;
    var z1 = -bandN.x * sy + bandN.z * cy;
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var y2 = bandN.y * cp + z1 * sp;
    var z2 = -bandN.y * sp + z1 * cp;
    var a = x1, b = y2, c = z2; // rotated normal, same axis order as project()/projectDir()
    // Screen-space line: a*sx + b*sy + C = 0, derived from the plane
    // equation a*X + b*Y + c = 0 where X=(sx-w/2)/focal, Y=(sy-h/2)/focal.
    var C = c * focal - a * (w * 0.5) - b * (h * 0.5);
    var magSq = a * a + b * b;
    if(magSq < 1e-8) return; // camera looking straight along the band's own normal — edge-on/invisible, correctly nothing to draw

    // Point on the line closest to screen center — used as the anchor for
    // the "reveal sweeps outward from center" grow-in animation.
    var t = -(a * (w * 0.5) + b * (h * 0.5) + C) / magSq;
    var px = w * 0.5 + t * a, py = h * 0.5 + t * b;
    var mag = Math.sqrt(magSq);
    var angle = Math.atan2(a / mag, -b / mag); // direction along the line = perpendicular to the normal (a,b)

    var diag = Math.sqrt(w * w + h * h);
    var halfLen = diag * 2 * bandEase; // grows outward from center as bandEase eases 0→1; generous margin so it always reaches every corner even if the anchor point itself is off-canvas
    if(halfLen <= 0) return;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = bandGradient;
    ctx.fillRect(-halfLen, -h * 0.12, halfLen * 2, h * 0.24);
    ctx.restore();
  }

  // Advances camera physics: angular momentum from a drag flick decays with
  // friction (real "look around and it drifts to a stop"), and travel speed
  // eases toward its target rather than jumping, so scroll/pinch never
  // produces a visible skip — just continuous acceleration/deceleration.
  function stepCamera(now, dt){
    if(dt <= 0) return;

    if(_camResetting){
      var rt = Math.min(1, (now - _camResetT) / 500);
      var re = 1 - Math.pow(1 - rt, 3); // ease-out cubic
      cam.yaw = _camFrom.yaw * (1 - re);
      cam.pitch = _camFrom.pitch * (1 - re);
      if(rt >= 1){ _camResetting = false; cam.yawVel = 0; cam.pitchVel = 0; }
    } else if(!_dragging){
      cam.yaw += cam.yawVel * dt;
      cam.pitch += cam.pitchVel * dt;
      var friction = Math.pow(0.02, dt); // exponential decay, framerate-independent
      cam.yawVel *= friction;
      cam.pitchVel *= friction;
      if(Math.abs(cam.yawVel) < 0.001) cam.yawVel = 0;
      if(Math.abs(cam.pitchVel) < 0.001) cam.pitchVel = 0;
    }
    var PITCH_LIMIT = 1.35;
    if(cam.pitch > PITCH_LIMIT) cam.pitch = PITCH_LIMIT;
    if(cam.pitch < -PITCH_LIMIT) cam.pitch = -PITCH_LIMIT;

    // Forward/back travel: velocity eases toward a target rather than the
    // position jumping — this is what makes the dive feel continuous
    // instead of stepped. Target is IDLE_SPEED at rest (a slow ambient
    // creep, always running so the scene never looks frozen) or WARP_SPEED
    // once warp is toggled on — same easing curve either way, warp just
    // sets a much higher target.
    cam.travelZ += cam.travelVel * dt;
    if(_warpOn){
      // Sustained auto-cruise: ease toward a standing target speed instead
      // of decaying toward zero, so it keeps accelerating on its own like
      // the user is holding scroll-up, then holds steady at WARP_SPEED.
      cam.travelVel += (WARP_SPEED - cam.travelVel) * Math.min(1, WARP_EASE * dt * 60);
    } else {
      // Mobile-only bump: same idle creep mechanism, just a higher resting
      // target on phones to compensate for focal/screen-size math making
      // identical world-space speed cover fewer visible pixels there.
      // Warp is untouched — it's already fast enough to read clearly.
      var _idleTarget = isMobile ? IDLE_SPEED * MOBILE_SPEED_MULT : IDLE_SPEED;
      cam.travelVel += (_idleTarget - cam.travelVel) * Math.min(1, IDLE_EASE * dt * 60);
    }
  }

  function toggleWarp(){
    _warpOn = !_warpOn;
    try{ localStorage.setItem(WARP_KEY, _warpOn ? '1' : '0'); }catch(e){}
    updateMenuUi();
  }

  function spawnMeteor(){
    if(meteors.length > 0) return;
    if(Math.random() > 0.0035) return;
    var x = Math.random() * w * 0.7 + w * 0.1;
    var y = Math.random() * h * 0.35;
    meteors.push({
      x: x, y: y,
      vx: 2.2 + Math.random() * 2.4,
      vy: 1.1 + Math.random() * 1.4,
      life: 1,
      decay: 0.022 + Math.random() * 0.012,
      len: 22 + Math.random() * 28
    });
  }

  // Soft blob only — never a hard disc (that's what made them look stickers).
  // Uses the pre-baked sprite (see bakeStarSprites above) instead of building
  // a fresh gradient per star per frame — same visual output, far cheaper.
  function drawSoftStar(s, a, rx, ry, R){
    var sprite = s.cool ? starSprite.cool : starSprite.warm;
    if(!sprite){ return; } // sprites always baked before start() runs frame()
    ctx.globalAlpha = a;
    ctx.drawImage(sprite, rx - R, ry - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
  }

  // Respawns a star/dust particle far ahead of (or, if traveling backward,
  // Respawns a star/dust particle far ahead of the camera's current travel
  // position (used once it's drifted too far behind), or — traveling
  // backward — brings one back in close behind instead. Either way it's a
  // fresh random lateral spot, always outside the visible range so the swap
  // is invisible. Between these two triggers, particles now spend real time
  // both ahead of AND behind the camera as you travel, so turning around
  // shows a trailing field instead of an empty gap.
  function respawnAhead(p, isDust){
    var R = isDust ? DUST_FIELD_R : STAR_FIELD_R;
    p.wz = cam.travelZ + R * (0.85 + Math.random() * 0.15);
    p.wx = (Math.random() * 2 - 1) * R;
    p.wy = (Math.random() * 2 - 1) * R;
  }
  function respawnBehindTravel(p, isDust){
    var R = isDust ? DUST_FIELD_R : STAR_FIELD_R;
    p.wz = cam.travelZ - R * (0.85 + Math.random() * 0.15);
    p.wx = (Math.random() * 2 - 1) * R;
    p.wy = (Math.random() * 2 - 1) * R;
  }

  function renderStar(s, t, dt){
    // Slow ambient lateral drift in world space, independent of camera travel.
    s.wx += s.vx * dt;
    s.wy += s.vy * dt;
    if(s.wx < -STAR_FIELD_R) s.wx = STAR_FIELD_R; else if(s.wx > STAR_FIELD_R) s.wx = -STAR_FIELD_R;
    if(s.wy < -STAR_FIELD_R) s.wy = STAR_FIELD_R; else if(s.wy > STAR_FIELD_R) s.wy = -STAR_FIELD_R;

    var relZ = s.wz - cam.travelZ;
    if(relZ < -STAR_FIELD_R) { respawnAhead(s, false); return; }
    if(relZ > STAR_FIELD_R + 40) { respawnBehindTravel(s, false); return; }

    var p = project(s.wx, s.wy, s.wz);
    if(!p) return;
    if(p.sx < -80 || p.sx > w + 80 || p.sy < -80 || p.sy > h + 80) return;

    // Proximity drives both size and brightness — closer reads as bigger and
    // brighter, exactly like actually approaching it. Normalized around
    // STAR_BASE_Z (the field's average spawn distance) so a star sitting at
    // its "typical" depth renders at prox≈1 — i.e. the same size/brightness
    // as the original flat (non-zoom) star field — with only a mild boost/
    // dip as it passes nearer or farther, rather than the raw focal/z ratio
    // which could swing stars up to 2.6x bigger or shrink them arbitrarily.
    var prox = Math.min(1.6, Math.max(0.65,
      (STAR_BASE_Z + focal * 0.12) / (p.z + focal * 0.12)));

    // No atmosphere out here, so no scintillation/sparkle — real stars in
    // space burn as steady, unwavering points of light. Brightness stays
    // fixed; only the closest, brightest stars ever get a genuine flare,
    // and rarely — a handful across the whole field per minute, not a
    // constant flicker.
    var aVal = s.a * prox;
    if(s.depth === 2){
      if(!s.flareAt && Math.random() < 0.000004) s.flareAt = t;
      if(s.flareAt){
        var age = t - s.flareAt;
        if(age > 0.6) s.flareAt = 0;
        else aVal *= 1 + Math.sin((age / 0.6) * Math.PI) * 1.6;
      }
    }
    aVal *= p.edgeFade;
    if(aVal <= 0.015) return;

    drawSoftStar(s, aVal, p.sx, p.sy, s.r * s.soft * prox);
  }

  function frame(now){
    if(!running || !ctx) return;
    raf = requestAnimationFrame(frame);

    // Battery: this is an ambient background, not something anyone is
    // tracking frame-by-frame — cap it to ~30fps on phones (desktop stays
    // uncapped/smooth). Halving the draw calls roughly halves this layer's
    // share of battery drain with no perceptible visual cost.
    if(isMobile && _lastDrawT && (now - _lastDrawT) < _mobileFrameMs) return;
    _lastDrawT = now;

    var dt = _lastFrameT ? Math.min((now - _lastFrameT) / 1000, 0.1) : 0;
    _lastFrameT = now;

    stepCamera(now, dt);

    ctx.clearRect(0, 0, w, h);

    // True void base (slightly lifted so stars can sink into it)
    ctx.fillStyle = '#010103';
    ctx.fillRect(0, 0, w, h);

    // Flat void — no center glow layers here (they read as a visible circle
    // against pure black). Stars/dust/haze below carry all the depth cues.

    // Soft galactic dust lane — a fixed feature out on the sky dome, properly
    // projected through the 3D camera (see drawBand/projectDir) so panning
    // slides it across the screen instead of spinning it. Reveal still eases
    // in via bandEase on first activation.
    var bandT = Math.min(1, (now - _bandStartT) / BAND_REVEAL_MS);
    var bandEase = 1 - Math.pow(1 - bandT, 3); // ease-out cubic
    drawBand(bandEase);

    var t = (now - t0) / 1000;
    var si;

    // ── FAR stars (soft, embedded) ──
    for(si = 0; si < stars.length; si++){
      if(stars[si].depth !== 0) continue;
      renderStar(stars[si], t, dt);
    }

    // ── MID stars ──
    for(si = 0; si < stars.length; si++){
      if(stars[si].depth !== 1) continue;
      renderStar(stars[si], t, dt);
    }
    // Dust lives between mid and near — soft blobs only
    dust.forEach(function(d){
      d.wx += d.vx; d.wy += d.vy;
      if(d.wx < -DUST_FIELD_R) d.wx = DUST_FIELD_R; else if(d.wx > DUST_FIELD_R) d.wx = -DUST_FIELD_R;
      if(d.wy < -DUST_FIELD_R) d.wy = DUST_FIELD_R; else if(d.wy > DUST_FIELD_R) d.wy = -DUST_FIELD_R;

      var relZ = d.wz - cam.travelZ;
      if(relZ < -DUST_FIELD_R){ respawnAhead(d, true); return; }
      if(relZ > DUST_FIELD_R + 40){ respawnBehindTravel(d, true); return; }

      var dp = project(d.wx, d.wy, d.wz);
      if(!dp) return;
      if(dp.sx < -60 || dp.sx > w + 60 || dp.sy < -60 || dp.sy > h + 60) return;

      var dprox = Math.min(1.5, Math.max(0.65,
        (DUST_BASE_Z + focal * 0.15) / (dp.z + focal * 0.15)));
      var da = d.a * dprox * dp.edgeFade;
      if(da <= 0.008) return;
      var R = d.r * d.soft * dprox;
      if(dustSprite){
        ctx.globalAlpha = da;
        ctx.drawImage(dustSprite, dp.sx - R, dp.sy - R, R * 2, R * 2);
        ctx.globalAlpha = 1;
      }
    });

    // ── NEAR stars (a bit tighter glow, still soft) ──
    for(si = 0; si < stars.length; si++){
      if(stars[si].depth !== 2) continue;
      renderStar(stars[si], t, dt);
    }

    spawnMeteor();
    for(var mi = meteors.length - 1; mi >= 0; mi--){
      var m = meteors[mi];
      m.x += m.vx; m.y += m.vy; m.life -= m.decay;
      if(m.life <= 0 || m.x > w + 40 || m.y > h + 40){ meteors.splice(mi, 1); continue; }
      var mg = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * (m.len / 9), m.y - m.vy * (m.len / 9));
      mg.addColorStop(0, 'rgba(230,235,250,' + (0.55 * m.life) + ')');
      mg.addColorStop(0.4, 'rgba(180,195,220,' + (0.18 * m.life) + ')');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = mg;
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * (m.len / 9), m.y - m.vy * (m.len / 9));
      ctx.stroke();
    }

    // Light film grain only — keeps stars integrated, no dark tunnel.
    // Skipped during warp: it's a ~dozen extra drawImage calls tiling the
    // whole screen every frame, and at warp speed the streaking stars
    // already dominate the frame — the grain isn't perceptible but its
    // cost still is, right when frame time is already under the most
    // pressure (most stars/dust respawning per frame as they stream past).
    if(grainReady && grainCanvas && !_warpOn){
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.globalCompositeOperation = 'overlay';
      var px, py;
      for(py = 0; py < h; py += 256){
        for(px = 0; px < w; px += 256){
          ctx.drawImage(grainCanvas, px, py);
        }
      }
      ctx.restore();
    }
  }

  // How many times start() has retried waiting for the canvas to exist —
  // guards against a runaway retry loop if the host page never adds one.
  var _startRetries = 0;
  var _START_RETRY_MAX = 100; // ~10s at 100ms
  function start(){
    // Cancel any pending deferred clear from a very recent stop() — toggling
    // back on quickly shouldn't have its fresh frame wiped out from under it.
    if(_stopClearTimer){ clearTimeout(_stopClearTimer); _stopClearTimer = null; }
    if(running) return;
    canvas = document.getElementById('deepSpaceCanvas');
    if(!canvas){
      // The host markup (e.g. a React tree using createRoot().render(), which
      // commits its initial DOM asynchronously) may not have mounted the
      // canvas yet even after window 'load' fires — that's a real race, not
      // just a slow-network edge case. Retry briefly instead of silently
      // giving up and leaving the layer blank forever.
      if(_startRetries < _START_RETRY_MAX){
        _startRetries++;
        setTimeout(start, 100);
      }
      return;
    }
    _startRetries = 0;
    ctx = canvas.getContext('2d');
    if(!grainReady) bakeGrain();
    if(!spritesReady) bakeStarSprites();
    running = true;
    // Restore warp on/off from last session — stop() always zeroes _warpOn
    // in memory, so without this, reopening the app (or switching back into
    // true black) would silently drop warp even though the user left it on.
    try{ _warpOn = localStorage.getItem(WARP_KEY) === '1'; }catch(e){}
    updateMenuUi();
    _lastFrameT = 0;
    _lastDrawT = 0;
    _bandStartT = performance.now();
    resize();
    cancelAnimationFrame(raf);
    if(!_pageHidden) raf = requestAnimationFrame(frame);
  }
  function stop(){
    running = false;
    _warpOn = false;
    cam.travelVel = 0;
    cancelAnimationFrame(raf);
    // Don't wipe the canvas right away — #deepSpaceLayer's container fades
    // opacity over 1.6s in CSS. If we clear the stars/aurora glow here,
    // there's nothing left for that opacity fade to actually show, so it
    // just fades an already-blank canvas and the whole thing reads as an
    // abrupt cut instead of a graceful fade. Leave the last frame in place
    // and only wipe it once the CSS fade has had time to finish.
    if(_stopClearTimer) clearTimeout(_stopClearTimer);
    _stopClearTimer = setTimeout(function(){
      _stopClearTimer = null;
      if(!running && ctx && w){ ctx.clearRect(0, 0, w, h); }
    }, FADE_OUT_MS + 50);
  }

  // Battery: fully stop the rAF loop (not just let the browser throttle it)
  // whenever the app/tab isn't actually visible — backgrounded, screen off,
  // switched away. Browsers already de-prioritize background rAF, but an
  // explicit pause means zero draw calls (not just infrequent ones) and, on
  // resume, a clean single-frame restart instead of a burst of "catch up"
  // frames with a huge dt. Resuming re-syncs _lastFrameT/_lastDrawT to now
  // so the first frame back doesn't try to simulate the entire time spent
  // hidden in one jump.
  if(typeof document !== 'undefined'){
    document.addEventListener('visibilitychange', function(){
      _pageHidden = document.hidden;
      if(_pageHidden){
        cancelAnimationFrame(raf);
      } else if(running){
        _lastFrameT = 0;
        _lastDrawT = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    });
  }

  function updateMenuUi(){
    var btn = document.getElementById('dsmToggleAurora');
    var st = document.getElementById('dsmAuroraState');
    if(btn && st){
      var on = isOn();
      st.textContent = on ? 'On' : 'Off';
      if(on) btn.classList.add('on'); else btn.classList.remove('on');
    }
    var wbtn = document.getElementById('dsmToggleWarp');
    var wst = document.getElementById('dsmWarpState');
    if(wbtn && wst){
      wst.textContent = _warpOn ? 'On' : 'Off';
      if(_warpOn) wbtn.classList.add('on'); else wbtn.classList.remove('on');
    }
  }

  function hideMenu(){
    var menu = document.getElementById('deepSpaceMenu');
    if(menu) menu.classList.remove('open');
  }
  function showMenu(clientX, clientY){
    var menu = document.getElementById('deepSpaceMenu');
    if(!menu) return;
    updateMenuUi();
    menu.classList.add('open');
    var mw = 240, mh = 145;
    var x = Math.min(clientX, window.innerWidth - mw - 8);
    var y = Math.min(clientY, window.innerHeight - mh - 8);
    if(x < 8) x = 8; if(y < 8) y = 8;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  function onThemeChange(){
    syncDom();
    if(active()) start(); else stop();
    hideMenu();
  }

  // Drag anywhere on the background = look around (spherical, like turning
  // your head). Scroll wheel / pinch = travel forward or backward through
  // space. Listeners live on window (not the canvas) because the canvas sits
  // at z-index:0 behind the whole app shell and would rarely be the actual
  // event target — real buttons/inputs/links/scrollable UI are explicitly
  // excluded below so they keep working untouched.
  var _exploreCameraBound = false;
  function isRealUiTarget(el){
    while(el && el !== document.body){
      if(el.closest && el.closest('button,a,input,textarea,select,[role="button"],[contenteditable="true"],#synPulsePanel,#stickyNotesLayer')) return true;
      var cs = window.getComputedStyle(el);
      if(cs && (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollHeight > el.clientHeight + 2) return true;
      el = el.parentElement;
    }
    return false;
  }
  function pointerXY(e){
    if(e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }
  function pinchDist(e){
    if(!e.touches || e.touches.length < 2) return 0;
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function recenterCamera(){
    if(!active()) return;
    _camFrom.yaw = cam.yaw; _camFrom.pitch = cam.pitch;
    _camResetT = performance.now();
    _camResetting = true;
  }
  // Mobile/touch pointers don't get to drag-pan the camera — they only
  // ever see the initial static framing of the scene. Coarse-pointer check
  // (not UA sniffing) mirrors the pattern already used elsewhere in the
  // file (see the `(hover: hover) and (pointer: fine)` check near line
  // 45539) so it stays consistent with how "is this a mouse" is decided
  // in the rest of the app.
  function isPanBlockedInput(e){
    if(e.pointerType === 'touch' || e.pointerType === 'pen') return true;
    try{
      if(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    }catch(_pm){}
    return false;
  }

  function bindExploreCamera(){
    if(_exploreCameraBound) return;
    _exploreCameraBound = true;

    window.addEventListener('pointerdown', function(e){
      if(!active()) return;
      if(document.body.classList.contains('stem-studio-open')) return;
      if(e.button !== undefined && e.button !== 0) return;
      if(isRealUiTarget(e.target)) return;
      if(isPanBlockedInput(e)) return; // mobile: no pan-drag, first view only
      _dragging = true; _dragMoved = false; _camResetting = false;
      var p = pointerXY(e);
      _dragLastX = p.x; _dragLastY = p.y;
      _dragStartX = p.x; _dragStartY = p.y; _dragArmed = false;
      _dragStartT = performance.now();
      _dragVX = 0; _dragVY = 0;
    }, { passive: true });

    window.addEventListener('pointermove', function(e){
      if(!_dragging || !active()) return;
      var p = pointerXY(e);
      var dx = p.x - _dragLastX, dy = p.y - _dragLastY;
      _dragLastX = p.x; _dragLastY = p.y;
      if(Math.abs(dx) > 1 || Math.abs(dy) > 1) _dragMoved = true;
      // Two independent gates before a drag "arms" and starts rotating the
      // camera: (1) real cumulative movement from the pointerdown spot, and
      // (2) the button/touch has actually been held a beat. A click (or
      // spam-clicking fast across the screen) can occasionally rack up
      // >PAN_THRESHOLD px of incidental movement during its brief down-time,
      // but it essentially can never also clear MIN_HOLD_MS — that's the
      // signal a real, deliberate press-and-drag is happening, not a click.
      if(!_dragArmed){
        var totalDx = p.x - _dragStartX, totalDy = p.y - _dragStartY;
        var PAN_THRESHOLD = 8;
        var MIN_HOLD_MS = 70;
        var movedEnough = Math.abs(totalDx) >= PAN_THRESHOLD || Math.abs(totalDy) >= PAN_THRESHOLD;
        var heldEnough = (performance.now() - _dragStartT) >= MIN_HOLD_MS;
        if(!movedEnough || !heldEnough) return;
        _dragArmed = true;
      }
      var SENS = 0.0032;
      cam.yaw -= dx * SENS;
      cam.pitch -= dy * SENS;
      var PITCH_LIMIT = 1.35;
      if(cam.pitch > PITCH_LIMIT) cam.pitch = PITCH_LIMIT;
      if(cam.pitch < -PITCH_LIMIT) cam.pitch = -PITCH_LIMIT;
      _dragVX = -dx * SENS; _dragVY = -dy * SENS;
    }, { passive: true });

    function endDrag(){
      if(!_dragging) return;
      _dragging = false;
      // Hand off residual drag speed as angular momentum for a natural
      // "flick and it keeps drifting, then settles" release.
      cam.yawVel = Math.max(-6, Math.min(6, _dragVX * 40));
      cam.pitchVel = Math.max(-6, Math.min(6, _dragVY * 40));
    }
    window.addEventListener('pointerup', endDrag, { passive: true });
    window.addEventListener('pointercancel', endDrag, { passive: true });

    window.addEventListener('wheel', function(e){
      if(!active()) return;
      if(document.body.classList.contains('stem-studio-open')) return;
      if(isRealUiTarget(e.target)) return;
      e.preventDefault();
      // Impulse added to velocity (not position) so repeated wheel ticks
      // accelerate/decelerate smoothly via stepCamera()'s easing instead of
      // jumping frame to frame.
      var delta = -e.deltaY * 0.9;
      cam.travelVel = Math.max(-260, Math.min(260, cam.travelVel + delta));
    }, { passive: false });

    window.addEventListener('touchstart', function(e){
      if(!active()) return;
      if(document.body.classList.contains('stem-studio-open')) return;
      if(isRealUiTarget(e.target)) return;
      if(e.touches.length === 2){
        _dragging = false;
        _pinchStartDist = _pinchLastDist = pinchDist(e);
      }
    }, { passive: true });

    window.addEventListener('touchmove', function(e){
      if(!active()) return;
      if(e.touches.length === 2 && _pinchStartDist){
        if(isRealUiTarget(e.target)) return;
        e.preventDefault();
        var d = pinchDist(e);
        var delta = (d - _pinchLastDist) * 3.2;
        _pinchLastDist = d;
        cam.travelVel = Math.max(-260, Math.min(260, cam.travelVel + delta));
      }
    }, { passive: false });

    window.addEventListener('touchend', function(e){
      if(e.touches.length < 2){ _pinchStartDist = 0; _pinchLastDist = 0; }
    }, { passive: true });

    // Double-click / double-tap eases the look direction back to center.
    window.addEventListener('dblclick', function(e){
      if(!active()) return;
      if(document.body.classList.contains('stem-studio-open')) return;
      if(isRealUiTarget(e.target)) return;
      recenterCamera();
    }, { passive: true });
    var _lastTapT = 0;
    window.addEventListener('touchend', function(e){
      if(!active()) return;
      if(isRealUiTarget(e.target)) return;
      var now = Date.now();
      if(now - _lastTapT < 320 && !_dragMoved) recenterCamera();
      _lastTapT = now;
    }, { passive: true });
  }

  function bind(){
    var wrap = document.getElementById('dayNightToggle');
    if(wrap && !wrap._deepSpaceBound){
      wrap._deepSpaceBound = true;
      wrap.addEventListener('contextmenu', function(e){
        // Only when Night (trueblack / OLED) is active — moon side is “home”
        if((localStorage.getItem('_appTheme') || 'trueblack') !== 'trueblack') return;
        e.preventDefault();
        e.stopPropagation();
        showMenu(e.clientX, e.clientY);
      });
      // Long-press fallback (touch)
      var pressT = 0, pressTimer = null;
      wrap.addEventListener('touchstart', function(e){
        if((localStorage.getItem('_appTheme') || 'trueblack') !== 'trueblack') return;
        pressT = Date.now();
        var touch = e.touches && e.touches[0];
        pressTimer = setTimeout(function(){
          if(touch) showMenu(touch.clientX, touch.clientY);
        }, 520);
      }, {passive:true});
      wrap.addEventListener('touchend', function(){ clearTimeout(pressTimer); }, {passive:true});
      wrap.addEventListener('touchmove', function(){ clearTimeout(pressTimer); }, {passive:true});
      wrap.title = 'Toggle day / night · Right-click moon for deep space aurora';
    }
    var tog = document.getElementById('dsmToggleAurora');
    if(tog && !tog._bound){
      tog._bound = true;
      tog.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        toggle();
      });
    }
    var wtog = document.getElementById('dsmToggleWarp');
    if(wtog && !wtog._bound){
      wtog._bound = true;
      wtog.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        toggleWarp();
      });
    }
    document.addEventListener('click', function(e){
      var menu = document.getElementById('deepSpaceMenu');
      if(!menu || !menu.classList.contains('open')) return;
      if(menu.contains(e.target)) return;
      hideMenu();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') hideMenu();
    });
    window.addEventListener('resize', function(){
      if(!running) return;
      // Mobile fires bursts of resize events during layout settling (address
      // bar show/hide, viewport nudges) — often right while the fade-in is
      // playing. Each raw resize() call fully re-seeds every star and
      // rebuilds the band at the new size, so a burst of these mid-fade was
      // rebuilding everything repeatedly and reading as a "shaky" render.
      // Debounce so a burst collapses into a single resize() after things
      // settle, instead of one full rebuild per event.
      clearTimeout(_resizeDebounceTimer);
      _resizeDebounceTimer = setTimeout(function(){
        // Also ignore trivial sub-pixel jitter that isn't a real size
        // change (same browser-chrome-animation cause) — no need to reseed
        // for a few px of noise. Measured off the actual container (see
        // resize()) so this works whether the layer is full-viewport or
        // scoped to a section.
        var host = canvas && canvas.parentElement;
        var rect = host ? host.getBoundingClientRect() : null;
        var nw = (rect && rect.width) ? rect.width : window.innerWidth;
        var nh = (rect && rect.height) ? rect.height : window.innerHeight;
        if(Math.abs(nw - w) < 4 && Math.abs(nh - h) < 4) return;
        resize();
      }, 150);
    });
  }

  window._deepSpaceAurora = { toggle: toggle, set: setOn, isOn: isOn, sync: onThemeChange };
  window.addEventListener('load', function(){
    migrateLegacy();
    bind();
    // NOTE: bindExploreCamera() is intentionally never called in this
    // standalone embed. It attaches window-level wheel/touchmove/pointerdown
    // listeners (drag-to-look, scroll-to-travel) with e.preventDefault() —
    // fine for the full interactive app, but since this embed is always
    // "on" as a passive decorative background, those listeners would hijack
    // scrolling and pinch-zoom across the ENTIRE host page, not just the
    // banner. This is a pure idle-drift background; no camera controls.
    watchChatEmptyState();
    syncDom();
    updateMenuUi();
    if(active()) start();
  });
  // In case script runs after load
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(function(){ bind(); watchChatEmptyState(); syncDom(); updateMenuUi(); if(active()) start(); }, 0);
  }
})();
