/* route.js: walks an explainer built in the page (clusters/content/motion/route/). One figure per route:
     <figure class="rt" data-route data-edges='[["a","b"],["b","c",{"warn":1,"label":"spoed"}]]' data-sum="...">
       ... <ol class="rt-map"> <li class="rt-step" data-id="a" data-step="1"> ... <span class="rt-say">sentence</span></li> ...
   It draws the lines between steps from their boxes (so the same route follows the wide and the phone layout), and
   walks the steps in order once the figure is in view: the line to the step fills with a travelling dot, the step
   lights, its sentence stands numbered under the route. Pointing at or tapping a step shows that step and holds the walk.
   With reduced motion nothing moves: every step stays lit and a step is shown when pointed at.
   window.NorthstarRoute.start(figure) starts one figure (a framework calls it after render); plain pages start by themselves. */
(function () {
  if (window.NorthstarRoute) return;
  var STEP = 2700, HOLD = 3400, TRAVEL = 700, NS = 'http://www.w3.org/2000/svg';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function el(tag, cls, parent) { var e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); parent.appendChild(e); return e; }
  function rect(node, base) { var r = node.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, cx: r.left - base.left + r.width / 2, cy: r.top - base.top + r.height / 2 }; }
  function curve(a, b) {
    var dx = b.cx - a.cx, dy = b.cy - a.cy, p0, p3, horiz;
    // side by side (their rows overlap) -> left/right sides; otherwise top/bottom
    // rows overlap -> sides; columns overlap -> top/bottom; diagonal -> the longer way
    var rows = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 12, cols = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 12;
    horiz = Math.abs(dx) > 4 && (rows || (!cols && Math.abs(dx) > Math.abs(dy)));
    if (horiz) {
      p0 = [dx > 0 ? a.x + a.w : a.x, a.cy]; p3 = [dx > 0 ? b.x : b.x + b.w, b.cy];
      var k = Math.max(16, Math.abs(p3[0] - p0[0]) / 2) * (dx > 0 ? 1 : -1);
      return 'M' + p0 + 'C' + [p0[0] + k, p0[1]] + ' ' + [p3[0] - k, p3[1]] + ' ' + p3;
    }
    p0 = [a.cx, dy > 0 ? a.y + a.h : a.y]; p3 = [b.cx, dy > 0 ? b.y : b.y + b.h];
    var m = Math.max(12, Math.abs(p3[1] - p0[1]) / 2) * (dy > 0 ? 1 : -1);
    return 'M' + p0 + 'C' + [p0[0], p0[1] + m] + ' ' + [p3[0], p3[1] - m] + ' ' + p3;
  }

  function start(fig) {
    if (!fig || fig.__route) return; fig.__route = true;
    var map = fig.querySelector('.rt-map'), steps = [].slice.call(fig.querySelectorAll('.rt-step[data-step]'));
    if (!map || !steps.length) return;
    var byId = {}, edges = [], order = [], idx = -1, timer = null, held = false, inView = false, frame = 0;
    steps.forEach(function (s) { byId[s.getAttribute('data-id') || s.getAttribute('data-step')] = s; var n = +s.getAttribute('data-step'); if (order.indexOf(n) < 0) order.push(n); s.tabIndex = 0; });
    order.sort(function (a, b) { return a - b; });
    try { JSON.parse(fig.getAttribute('data-edges') || '[]').forEach(function (e) { if (byId[e[0]] && byId[e[1]]) edges.push({ a: byId[e[0]], b: byId[e[1]], o: e[2] || {} }); }); } catch (err) { /* a broken edge list leaves the steps standing */ }
    var svg = el('svg', 'rt-lines', map); svg.setAttribute('aria-hidden', 'true'); map.insertBefore(svg, map.firstChild);
    var dot = el('circle', '', svg); dot.setAttribute('r', 5); dot.style.opacity = 0;
    edges.forEach(function (e) {
      e.base = el('path', 'rt-base', svg); e.on = el('path', 'rt-on' + (e.o.warn ? ' rt-w' : ''), svg);
      if (e.o.label) { e.lab = document.createElement('span'); e.lab.className = 'rt-elabel' + (e.o.warn ? ' rt-w' : ''); e.lab.textContent = e.o.label; e.lab.setAttribute('aria-hidden', 'true'); map.appendChild(e.lab); }
    });
    svg.appendChild(dot);
    var now = document.createElement('p'); now.className = 'rt-now'; now.setAttribute('aria-live', 'off');
    now.innerHTML = '<span class="rt-now-n"></span><span class="rt-now-t"></span>';
    (fig.querySelector('.rt-hint') || map).insertAdjacentElement(fig.querySelector('.rt-hint') ? 'beforebegin' : 'afterend', now);
    var nowN = now.firstChild, nowT = now.lastChild;
    function say(n) { return steps.filter(function (s) { return +s.getAttribute('data-step') === n; }).map(function (s) { var t = s.querySelector('.rt-say'); return t ? t.textContent : ''; }).join(' '); }

    function draw() {
      var base = map.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + base.width + ' ' + base.height);
      edges.forEach(function (e) {
        var d = curve(rect(e.a, base), rect(e.b, base)); e.base.setAttribute('d', d); e.on.setAttribute('d', d);
        e.len = e.on.getTotalLength(); e.on.style.strokeDasharray = e.len; if (!e.lit) e.on.style.strokeDashoffset = e.len;
        if (e.lab) { var p = e.on.getPointAtLength(e.len * 0.5); e.lab.style.left = p.x + 'px'; e.lab.style.top = p.y + 'px'; }
      });
      // the sentence bar keeps the height of its longest sentence, so the page does not jump while it walks
      fig.style.setProperty('--rt-now-h', '0px'); var h = 0; order.forEach(function (n) { nowT.textContent = say(n); h = Math.max(h, now.offsetHeight); }); if (fig.getAttribute('data-sum')) { nowT.textContent = fig.getAttribute('data-sum'); h = Math.max(h, now.offsetHeight); }
      fig.style.setProperty('--rt-now-h', h + 'px'); show(idx, true);
    }
    function light(e, on, animate) {
      e.lit = on; e.on.style.transition = animate ? '' : 'none'; e.on.style.strokeDashoffset = on ? 0 : e.len;
      if (e.lab) e.lab.classList.toggle('is-on', on);
    }
    function travel(list) {
      cancelAnimationFrame(frame); if (!list.length || reduce) { dot.style.opacity = 0; return; }
      var t0 = performance.now();
      (function go(t) {
        var k = Math.min(1, (t - t0) / TRAVEL), u = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, e = list[0], p = e.on.getPointAtLength(e.len * u);
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.style.opacity = k < 1 ? 1 : 0;
        if (k < 1) frame = requestAnimationFrame(go);
      })(t0);
    }
    function show(i, quiet) {
      // i: index into order; -1 = the whole route (all lit, the summary under it)
      var cur = i >= 0 ? order[i] : Infinity, fresh = [];
      steps.forEach(function (s) { var n = +s.getAttribute('data-step'); s.classList.toggle('is-now', n === cur); s.classList.toggle('is-done', n < cur); s.classList.toggle('is-next', n > cur); });
      edges.forEach(function (e) { var nb = +e.b.getAttribute('data-step'), on = nb <= cur; if (on && !e.lit && nb === cur) fresh.push(e); light(e, on, !quiet && on && nb === cur); });
      var warn = i >= 0 && steps.some(function (s) { return +s.getAttribute('data-step') === cur && s.classList.contains('rt-warn'); });
      now.classList.toggle('rt-w', warn);
      nowN.textContent = i >= 0 ? String(i + 1) : '✓'; nowT.textContent = i >= 0 ? say(cur) : (fig.getAttribute('data-sum') || say(order[order.length - 1]));
      if (!quiet) travel(fresh);
    }
    function next() {
      clearTimeout(timer); if (held || !inView || reduce) return;
      if (idx === -1 && fig.__walked) { idx = 0; edges.forEach(function (e) { light(e, false, false); }); }
      else if (idx >= order.length - 1) { idx = -1; fig.__walked = true; show(-1); timer = setTimeout(next, HOLD); return; }
      else idx++;
      show(idx); timer = setTimeout(next, idx === order.length - 1 ? HOLD : STEP);
    }
    function pick(s) { held = true; clearTimeout(timer); idx = order.indexOf(+s.getAttribute('data-step')); show(idx); }
    function release(delay) { clearTimeout(timer); timer = setTimeout(function () { held = false; next(); }, delay); }
    steps.forEach(function (s) {
      s.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') pick(s); });
      s.addEventListener('focus', function () { pick(s); });
      s.addEventListener('click', function () { pick(s); release(8000); });
    });
    fig.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse' && held) release(1400); });
    fig.addEventListener('focusout', function () { if (!fig.contains(document.activeElement)) release(1400); });

    fig.classList.add('is-live'); fig.setAttribute('data-hover', '');
    idx = reduce ? -1 : 0; draw(); show(idx, true);
    if ('ResizeObserver' in window) new ResizeObserver(function () { draw(); }).observe(map); else window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    if (reduce) return;
    idx = -1; fig.__walked = false; show(-1, true);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      es.forEach(function (e) { var was = inView; inView = e.isIntersecting; if (inView && !was) { if (idx === -1 && !fig.__walked) { idx = -1; } next(); } else if (!inView) clearTimeout(timer); });
    }, { threshold: 0.35 }).observe(fig);
    else { inView = true; next(); }
  }
  function all() { [].forEach.call(document.querySelectorAll('figure[data-route]'), start); }
  window.NorthstarRoute = { start: start };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
})();
