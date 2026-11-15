/* The page sticker: one draggable sticker per service page, shared by every page that has one.
   A page declares it with <script src="/assets/js/page-sticker.js" data-sticker="/assets/images/stickers/<name>.webp" defer></script>.
   It is placed only on free space: the script reads where the page's text, images, buttons and cards are
   in the first screens and picks the largest size that fits beside them, never on top of them.
   Where no free spot exists (a narrow phone hero), it does not appear rather than hide content. */
(function () {
  var me = document.currentScript;
  var url = me && me.getAttribute('data-sticker');
  if (!url) return;

  var GAP = 14;           // free margin kept around content
  var STEP = 12;          // grid step of the search, px
  var moved = false;      // once the visitor drags it, the visitor decides where it is

  var el = document.createElement('div');
  el.id = 'pageSticker';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:98;cursor:grab;display:none;opacity:0;' +
    'filter:drop-shadow(0 6px 18px rgba(0,0,0,0.3));transform:rotate(-6deg);transition:filter 0.3s,transform 0.3s,opacity 0.5s;touch-action:none;';
  el.innerHTML = '<img src="' + url + '" alt="" style="width:100%;height:100%;object-fit:contain;pointer-events:none;">';

  function boxes(limitY) {
    var out = [], vw = window.innerWidth, vh = window.innerHeight, sy = window.scrollY, sx = window.scrollX;
    // where a box will rest: entrance animations (AOS, hero reveals) still hold content shifted by a
    // translate when this runs, so each box is measured without its own and its ancestors' translation
    var cache = new Map();
    function shift(node) {
      if (!node || node === document.body || node.nodeType !== 1) return [0, 0];
      if (cache.has(node)) return cache.get(node);
      var up = shift(node.parentElement), tf = getComputedStyle(node).transform, dx = 0, dy = 0;
      if (tf && tf !== 'none') {
        var m = tf.match(/matrix(3d)?\(([^)]+)\)/);
        if (m) { var v = m[2].split(',').map(parseFloat); if (m[1]) { dx = v[12]; dy = v[13]; } else { dx = v[4]; dy = v[5]; } }
      }
      var res = [up[0] + dx, up[1] + dy]; cache.set(node, res); return res;
    }
    function add(r, node) {
      if (r.width < 2 || r.height < 2) return;
      var s = shift(node), left = r.left - s[0] + sx, top = r.top - s[1] + sy;
      if (top > limitY || top + r.height < 0) return;
      out.push([left - GAP, top - GAP, left + r.width + GAP, top + r.height + GAP]);
    }
    // every line of visible text
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || el.contains(p) || p.closest('script,style,noscript,template,.menu-dropdown,[hidden]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var range = document.createRange(), n;
    while ((n = walker.nextNode())) {
      range.selectNodeContents(n);
      var rs = range.getClientRects();
      for (var i = 0; i < rs.length; i++) add(rs[i], n.parentElement);
    }
    // media, controls and cards. A picture or a video is never free space, however large (a hero photo with logos in
    // it is content); only plain page containers that fill the screen are not obstacles
    var big = vw * vh * 0.45;
    var els = document.body.querySelectorAll('img,svg,video,canvas,iframe,picture,button,a,input,select,textarea,figure,iconify-icon,[class*="card"],[class*="btn"],li,blockquote,table');
    for (var j = 0; j < els.length; j++) {
      var e = els[j];
      if (el.contains(e) || e.closest('.menu-dropdown')) continue;
      var r = e.getBoundingClientRect();
      var media = /^(IMG|VIDEO|CANVAS|IFRAME|PICTURE)$/.test(e.tagName);
      if (!media && r.width * r.height > big) continue;
      var cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      add(r, cs.position === 'fixed' ? null : e);
    }
    // anything with its own visible surface (a coloured panel, a bordered box) counts too
    var all = document.body.querySelectorAll('div,section,section>*,aside,form');
    for (var k = 0; k < all.length; k++) {
      var d = all[k];
      if (el.contains(d) || d.closest('.menu-dropdown,header')) continue;
      var rr = d.getBoundingClientRect();
      if (rr.width < 24 || rr.height < 24) continue;
      var st = getComputedStyle(d);
      if (st.backgroundImage !== 'none' && st.backgroundImage.indexOf('url(') >= 0) { add(rr, d); continue; } // a background picture is content too
      if (rr.width * rr.height > big) continue;
      var bg = st.backgroundColor, hasBg = bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg);
      if (hasBg || parseFloat(st.borderTopWidth) > 0 || st.backgroundImage !== 'none') add(rr, d);
    }
    // the seam between two sections: a sticker half on each reads as misplaced
    var secs = document.querySelectorAll('section,footer');
    for (var q = 0; q < secs.length; q++) {
      var sr = secs[q].getBoundingClientRect();
      if (sr.height < 40) continue;
      var stop = sr.top + sy;
      if (stop > 0 && stop < limitY) out.push([0, stop - GAP, vw + sx, stop + GAP]);
    }
    return out;
  }

  function free(x, y, s, obs) {
    var m = s * 0.06; // the sticker is drawn rotated, its box reaches a little beyond its square
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (x - m < o[2] && x + s + m > o[0] && y - m < o[3] && y + s + m > o[1]) return false;
    }
    return true;
  }

  function place(keepIfFree) {
    if (moved) return;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var mobile = vw < 768;
    var sizes = mobile ? [180, 150, 128, 112, 96] : [260, 220, 190, 160, 136];
    var header = document.querySelector('header');
    var top0 = (header ? header.getBoundingClientRect().bottom + window.scrollY : 0) + 8;
    var docH = document.documentElement.scrollHeight;
    // first the opening screen, then the next one
    var bands = [[top0, Math.min(docH, vh)], [vh, Math.min(docH, vh * 2)]];
    var obs = boxes(vh * 2 + 40);
    // a layout change (an icon set or an image arriving late) only moves the sticker when its spot is taken
    if (keepIfFree && el.style.display !== 'none' && el.getAttribute('data-placed') !== 'none') {
      var cs0 = parseFloat(el.style.width);
      if (free(parseFloat(el.style.left), parseFloat(el.style.top), cs0, obs)) return;
    }
    for (var b = 0; b < bands.length; b++) {
      for (var si = 0; si < sizes.length; si++) {
        var s = sizes[si];
        // right side first (where the sticker always sat), top to bottom
        for (var y = bands[b][0]; y + s <= bands[b][1]; y += STEP) {
          var edge = Math.ceil(s * 0.06) + 8;
          for (var x = vw - s - edge; x >= edge; x -= STEP) {
            if (free(x, y, s, obs)) {
              el.style.width = el.style.height = s + 'px';
              el.style.left = x + 'px';
              el.style.top = y + 'px';
              el.style.display = '';
              requestAnimationFrame(function () { el.style.opacity = '1'; });
              el.setAttribute('data-placed', s + '@' + Math.round(x) + ',' + Math.round(y));
              return;
            }
          }
        }
      }
    }
    el.style.display = 'none';
    el.setAttribute('data-placed', 'none');
  }

  // dragging: pointer events cover mouse, pen and touch (long press on touch, so scrolling stays scrolling)
  var dragging = false, offX = 0, offY = 0, pressTimer = null, startX = 0, startY = 0;
  function grab(cx, cy) {
    dragging = true; moved = true;
    var r = el.getBoundingClientRect();
    offX = cx - r.left; offY = cy - r.top;
    el.style.position = 'fixed'; el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
    el.style.transition = 'none'; el.style.cursor = 'grabbing';
    el.style.filter = 'drop-shadow(0 14px 40px rgba(0,0,0,0.5))';
    el.style.transform = 'rotate(-2deg) scale(1.08)';
    if (navigator.vibrate && el._touch) navigator.vibrate(30);
  }
  function drop() {
    dragging = false;
    var l = parseFloat(el.style.left), t = parseFloat(el.style.top);
    el.style.position = 'absolute';
    el.style.left = (l + window.scrollX) + 'px'; el.style.top = (t + window.scrollY) + 'px';
    el.style.cursor = 'grab'; el.style.transition = 'filter 0.3s, transform 0.3s';
    el.style.filter = 'drop-shadow(0 6px 18px rgba(0,0,0,0.3))';
    el.style.transform = 'rotate(-6deg) scale(1)';
  }
  el.addEventListener('pointerdown', function (e) {
    startX = e.clientX; startY = e.clientY;
    el._touch = e.pointerType === 'touch';
    if (el._touch) {
      el.style.touchAction = 'pan-y';
      pressTimer = setTimeout(function () { el.style.touchAction = 'none'; grab(startX, startY); }, 400);
    } else { grab(e.clientX, e.clientY); e.preventDefault(); }
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) {
      if (pressTimer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) { clearTimeout(pressTimer); pressTimer = null; }
      return;
    }
    el.style.left = (e.clientX - offX) + 'px'; el.style.top = (e.clientY - offY) + 'px';
    el.style.transform = 'rotate(' + ((e.clientX - offX) * 0.02 - 4) + 'deg) scale(1.08)';
  });
  el.addEventListener('touchmove', function (e) { if (dragging) e.preventDefault(); }, { passive: false });
  window.addEventListener('pointerup', function () { clearTimeout(pressTimer); pressTimer = null; if (dragging) drop(); });
  window.addEventListener('pointercancel', function () { clearTimeout(pressTimer); pressTimer = null; if (dragging) drop(); });
  el.addEventListener('mouseenter', function () { if (!dragging) { el.style.transform = 'rotate(-3deg) scale(1.06)'; } });
  el.addEventListener('mouseleave', function () { if (!dragging) { el.style.transform = 'rotate(-6deg) scale(1)'; } });

  function start() {
    document.body.appendChild(el);
    var go = function () { place(); };
    // placed once the layout has settled: fonts in, images sized, entrance animations started
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var loaded = new Promise(function (r) { if (document.readyState === 'complete') r(); else window.addEventListener('load', r); });
    Promise.all([fonts, loaded]).then(function () {
      setTimeout(go, 300);
      if (window.ResizeObserver) {
        var rt = null;
        new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(function () { place(true); }, 250); }).observe(document.body);
      }
    });
    document.addEventListener('studiolee:layout-moved', function () { setTimeout(go, 320); });
    var t = null, w = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === w) return; // a phone's address bar, not a new width
      w = window.innerWidth; clearTimeout(t); t = setTimeout(go, 200);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
