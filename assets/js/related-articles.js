// Dynamic related articles + FAQ auto-converter + STUDIOLEE squiggle divider
(function() {
  // ---------- AUTO-CONVERT FAQ (h2 "Veelgestelde vragen" + h3/p pairs → accordion + JSON-LD) ----------
  function autoConvertFAQ() {
    var blogDetail = document.querySelector('section.blog-detail, .blog-detail');
    if (!blogDetail) return;
    if (blogDetail.querySelector('.faq-timeline')) return; // already has styled FAQ
    if (document.querySelector('script[type="application/ld+json"][data-auto-faq]')) return; // already injected

    var faqHeading = null;
    var h2s = blogDetail.querySelectorAll('h2');
    for (var i = 0; i < h2s.length; i++) {
      var t = h2s[i].textContent.trim().toLowerCase();
      if (t === 'veelgestelde vragen' || t.indexOf('veelgestelde vragen') !== -1 || t.indexOf('frequently asked') !== -1) {
        faqHeading = h2s[i]; break;
      }
    }
    if (!faqHeading) return;

    // Walk siblings: collect h3+p pairs until next h2 or end of parent
    var items = [];
    var node = faqHeading.nextElementSibling;
    while (node && node.tagName !== 'H2') {
      if (node.tagName === 'H3') {
        var question = node.textContent.trim();
        // Collect all <p> nodes immediately following until next h3 or h2
        var ans = node.nextElementSibling;
        var answerParts = [];
        var answerNodes = [];
        while (ans && ans.tagName !== 'H3' && ans.tagName !== 'H2') {
          if (ans.tagName === 'P') {
            answerParts.push(ans.textContent.trim());
            answerNodes.push(ans);
          }
          ans = ans.nextElementSibling;
        }
        if (answerParts.length > 0) {
          items.push({ q: question, a: answerParts.join(' '), qNode: node, aNodes: answerNodes });
        }
        node = ans; // jump past collected nodes
      } else {
        node = node.nextElementSibling;
      }
    }
    if (items.length < 2) return; // not really an FAQ if only 0-1 questions

    // Build accordion DOM
    var wrapper = document.createElement('div');
    wrapper.className = 'faq-timeline auto-faq';
    items.forEach(function(it) {
      var item = document.createElement('div');
      item.className = 'faq-tl-item';
      item.addEventListener('click', function() { this.classList.toggle('open'); });
      var q = document.createElement('div'); q.className = 'faq-tl-q'; q.textContent = it.q;
      var a = document.createElement('div'); a.className = 'faq-tl-a'; a.textContent = it.a;
      item.appendChild(q); item.appendChild(a);
      wrapper.appendChild(item);
    });

    // Insert wrapper before the first question, then remove original q+a nodes
    var firstQNode = items[0].qNode;
    firstQNode.parentNode.insertBefore(wrapper, firstQNode);
    items.forEach(function(it) {
      it.qNode.remove();
      it.aNodes.forEach(function(n) { n.remove(); });
    });

    // Inject FAQPage JSON-LD schema
    var schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": items.map(function(it) {
        return {
          "@type": "Question",
          "name": it.q,
          "acceptedAnswer": { "@type": "Answer", "text": it.a }
        };
      })
    };
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-auto-faq', '1');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  function init() {
    autoConvertFAQ();

    var section = document.querySelector('.related-articles');
    if (!section) return;

    // ---------- ANNIHILATE THE WHITESPACE GAP ----------
    var blogDetail = document.querySelector('section.blog-detail, .blog-detail');
    if (blogDetail) {
      blogDetail.style.paddingBottom = '0.5rem';
      blogDetail.querySelectorAll('.row.mt-5, .row.justify-content-center.mt-5').forEach(function(row) {
        row.style.display = 'none';
      });
      blogDetail.querySelectorAll('.d-flex.flex-column, .d-flex.flex-column.gap-4').forEach(function(fl) {
        fl.style.gap = '0';
      });
    }

    section.style.paddingTop = '0';
    section.style.paddingBottom = '2rem';
    section.style.marginTop = '0';
    section.style.position = 'relative';
    var container = section.querySelector('.container');
    if (container) container.style.paddingTop = '0';
    var h2 = section.querySelector('h2');
    if (h2) { h2.style.marginTop = '1rem'; h2.style.marginBottom = '1rem'; }

    // ---------- INJECT FULL-WIDTH SQUIGGLE SVG (true viewport width) ----------
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'related-squiggle');
    // Wider viewBox so the path extends past 1200 — guarantees the rightmost rendered stroke reaches the screen edge even on ultra-wide displays
    svg.setAttribute('viewBox', '0 0 1200 60');
    svg.setAttribute('preserveAspectRatio', 'none');
    // Force exact viewport-width: position:relative + left:50% + transform:translateX(-50%) is the most reliable full-bleed pattern
    svg.style.cssText = [
      'display:block',
      'width:100vw',
      'max-width:none',
      'height:60px',
      'margin:1rem 0',
      'padding:0',
      'overflow:visible',
      'position:relative',
      'left:50%',
      'right:50%',
      'transform:translateX(-50%)',
      'box-sizing:border-box'
    ].join(';');
    var path = document.createElementNS(SVG_NS, 'path');
    // Path ends at x=1200 (matches viewBox right edge). preserveAspectRatio=none stretches viewBox to fill 100vw width.
    path.setAttribute('d', 'M 0 30 Q 24 0 48 30 T 96 30 T 144 30 T 192 30 T 240 30 T 288 30 T 336 30 T 384 30 T 432 30 T 480 30 T 528 30 T 576 30 T 624 30 T 672 30 T 720 30 T 768 30 T 816 30 T 864 30 T 912 30 T 960 30 T 1008 30 T 1056 30 T 1104 30 T 1152 30 T 1200 30');
    path.style.cssText = 'stroke:#C1FF72;stroke-width:2.5;fill:none;stroke-linecap:round;opacity:0.95;vector-effect:non-scaling-stroke';
    svg.appendChild(path);
    section.insertBefore(svg, section.firstChild);

    var pathLength = path.getTotalLength();
    path.style.strokeDasharray = pathLength;
    path.style.strokeDashoffset = pathLength;

    // rAF-throttled scroll handler for reliability across all scroll inputs
    var ticking = false;
    function compute() {
      var rect = svg.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var progress = 4 * (1 - rect.top / vh);
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      path.style.strokeDashoffset = pathLength * (1 - progress);
      ticking = false;
    }
    function update() {
      if (!ticking) {
        window.requestAnimationFrame(compute);
        ticking = true;
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('load', update); // recompute after fonts/images load
    update();
    // Extra safety: recompute after 100ms in case layout shifts post-paint
    setTimeout(compute, 150);

    // ---------- LOAD RELATED ARTICLES ----------
    var el = document.getElementById('related-articles-grid');
    if (!el) return;
    var currentSlug = el.getAttribute('data-slug');
    var currentCluster = el.getAttribute('data-cluster');
    fetch('/blog/clusters.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var related = data.posts
          .filter(function(p) { return p.cluster === currentCluster && p.slug !== currentSlug; })
          .slice(0, 3);
        if (related.length === 0) {
          related = data.posts.filter(function(p) { return p.slug !== currentSlug; }).slice(0, 3);
        }
        var html = '';
        related.forEach(function(p) {
          var imgHtml = p.image ? '<img src="' + p.image + '" alt="' + p.title + '" style="height:180px;object-fit:cover;width:100%;" loading="lazy">' : '';
          html += '<div class="col-md-4"><a href="/blog/' + p.slug + '" class="text-decoration-none"><div class="card bg-dark border-0 rounded-3 h-100 overflow-hidden">' + imgHtml + '<div class="card-body p-4"><h3 class="text-white fs-5 mb-2">' + p.title + '</h3><p class="text-white text-opacity-50 mb-0 fs-6">Lees meer →</p></div></div></a></div>';
        });
        el.innerHTML = html;
      })
      .catch(function() {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
