/* Walkthrough: plays real screens of the dashboard step by step.
   Markup: <figure class="wt" data-wt="<scene>" data-wt-src="/path/to/frames/"> with a <script type="application/json" class="wt-data">
   {"d":[{"src","cursor":{x,y}|null,"focus":[x,y,w,h]|null,"caption"}],"m":[...]}</script>.
   Desktop plays the d frames zoomed to their focus; phones play the m frames, panned to where the pointer goes.
   Plays while in view, pauses on hover or focus, never moves on its own for reduced motion (then the step buttons lead). */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = window.matchMedia('(max-width: 767.98px)');
  var STEP = 3600, GLIDE = 900;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function setup(fig) {
    var data; try { data = JSON.parse(fig.querySelector('.wt-data').textContent); } catch (e) { return; }
    var base = fig.getAttribute('data-wt-src') || '';
    var screen = fig.querySelector('.wt-screen'), cap = fig.querySelector('.wt-cap'), dots = fig.querySelector('.wt-steps');
    var stage = el('div', 'wt-stage'); screen.appendChild(stage);
    var pointer = el('span', 'wt-pointer', '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><i class="wt-ripple"></i>');
    var layer = el('div', 'wt-layer'); screen.appendChild(layer); layer.appendChild(pointer);
    var mark = el('span', 'wt-mark'); layer.appendChild(mark);
    var mode = null, frames = [], imgs = [], i = 0, timer = null, playing = false, inView = false, held = false;

    function build() {
      var m = narrow.matches ? 'm' : 'd';
      if (m === mode) return; mode = m; frames = data[m] || data.d; stage.innerHTML = ''; imgs = [];
      fig.classList.toggle('wt-is-m', m === 'm');
      frames.forEach(function (f, k) {
        var wrap = el('div', 'wt-frame'); var img = new Image();
        img.alt = ''; img.decoding = 'async'; img.loading = k ? 'lazy' : 'eager'; img.dataset.src = base + f.src;
        wrap.appendChild(img); stage.appendChild(wrap); imgs.push(wrap);
      });
      dots.innerHTML = '';
      frames.forEach(function (f, k) {
        var b = el('button', 'wt-dot'); b.type = 'button';
        b.setAttribute('aria-label', 'Stap ' + (k + 1) + ': ' + f.caption);
        b.innerHTML = '<span class="wt-dot-n">' + (k + 1) + '</span><span class="wt-dot-t">' + f.caption + '</span><i class="wt-dot-bar"></i>';
        b.addEventListener('click', function () { show(k, true); held = true; stop(); });
        dots.appendChild(b);
      });
      show(Math.min(i, frames.length - 1), true);
    }

    function load(k) { var im = imgs[k] && imgs[k].firstChild; if (im && !im.src) im.src = im.dataset.src; }

    function view(k) {
      var f = frames[k], wrap = imgs[k], im = wrap.firstChild;
      if (mode === 'd' && f.focus) {
        var s = Math.min(100 / f.focus[2], 100 / f.focus[3], 1.8);
        var cx = f.focus[0] + f.focus[2] / 2, cy = f.focus[1] + f.focus[3] / 2;
        var tx = Math.max(Math.min(50 - cx, (s - 1) * 50 / s), -(s - 1) * 50 / s), ty = Math.max(Math.min(50 - cy, (s - 1) * 50 / s), -(s - 1) * 50 / s);
        im.style.transform = 'scale(' + s + ') translate(' + tx + '%,' + ty + '%)';
        return { s: s, tx: tx, ty: ty };
      }
      if (mode === 'm') {
        var y = f.cursor ? f.cursor.y : 0, pan = Math.max(0, Math.min(y - 40, 100 - 100 * (stage.clientHeight / Math.max(1, im.clientHeight || stage.clientHeight))));
        im.style.transform = 'translateY(' + (-pan * (im.clientHeight || 0) / 100) + 'px)';
        return { s: 1, tx: 0, ty: 0, py: pan };
      }
      im.style.transform = ''; return { s: 1, tx: 0, ty: 0 };
    }

    function place(k, v) {
      var f = frames[k]; if (!f.cursor) { pointer.classList.remove('on'); mark.classList.remove('on'); return; }
      var x = f.cursor.x, y = f.cursor.y;
      if (mode === 'd') { x = 50 + (x - 50 + v.tx) * v.s; y = 50 + (y - 50 + v.ty) * v.s; }
      if (mode === 'm') { var im = imgs[k].firstChild; y = (y - (v.py || 0)) * (im.clientHeight || stage.clientHeight) / stage.clientHeight; }
      pointer.style.left = x + '%'; pointer.style.top = y + '%'; mark.style.left = x + '%'; mark.style.top = y + '%';
      pointer.classList.add('on'); mark.classList.remove('on');
      clearTimeout(pointer._t); pointer.classList.remove('click');
      pointer._t = setTimeout(function () { pointer.classList.add('click'); mark.classList.add('on'); }, reduce ? 0 : GLIDE);
    }

    function show(k, now) {
      i = (k + frames.length) % frames.length; load(i); load((i + 1) % frames.length);
      imgs.forEach(function (w, n) { w.classList.toggle('is-on', n === i); });
      var v = view(i); place(i, v);
      cap.textContent = frames[i].caption; cap.setAttribute('data-n', (i < 9 ? '0' : '') + (i + 1));
      [].forEach.call(dots.children, function (d, n) { d.classList.toggle('is-on', n === i); d.setAttribute('aria-current', n === i ? 'step' : 'false'); d.classList.toggle('is-run', n === i && playing && !reduce); });
      fig.style.setProperty('--wt-step', STEP + 'ms');
    }

    function tick() { show(i + 1); timer = setTimeout(tick, STEP); }
    function play() { if (reduce || playing || held || !inView) return; playing = true; show(i); timer = setTimeout(tick, STEP); }
    function stop() { playing = false; clearTimeout(timer); [].forEach.call(dots.children, function (d) { d.classList.remove('is-run'); }); }

    fig.addEventListener('mouseenter', stop); fig.addEventListener('mouseleave', function () { if (!held) play(); });
    fig.addEventListener('focusin', stop);
    narrow.addEventListener ? narrow.addEventListener('change', build) : narrow.addListener(build);
    window.addEventListener('resize', function () { show(i, true); });
    fig.addEventListener('wt:show', function () { i = 0; held = false; show(0, true); inView = true; stop(); play(); });
    fig.addEventListener('wt:hide', function () { stop(); });
    build();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { inView = e.isIntersecting; if (inView) { imgs.forEach(function (w, n) { if (n < 2) load(n); }); play(); } else stop(); }); }, { threshold: 0.35 }).observe(fig);
    } else { inView = true; play(); }
    imgs.forEach(function (w) { w.firstChild.addEventListener('load', function () { if (w.classList.contains('is-on')) show(i, true); }); });
  }

  function tabs(list) {
    var ts = [].slice.call(list.querySelectorAll('[role="tab"]'));
    function pick(tab, focus) {
      ts.forEach(function (x) {
        var on = x === tab, panel = document.getElementById(x.getAttribute('aria-controls'));
        x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
        if (panel) { panel.hidden = !on; var f = panel.querySelector('figure.wt'); if (f) f.dispatchEvent(new Event(on ? 'wt:show' : 'wt:hide')); }
      });
      if (focus) tab.focus();
    }
    ts.forEach(function (x, n) {
      x.addEventListener('click', function () { pick(x); });
      x.addEventListener('keydown', function (e) {
        var k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); pick(ts[(n + k + ts.length) % ts.length], true); }
      });
    });
  }
  function init() { [].forEach.call(document.querySelectorAll('figure.wt'), setup); [].forEach.call(document.querySelectorAll('.wt-tabs[role="tablist"]'), tabs); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
