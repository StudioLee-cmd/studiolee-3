// Dynamic related articles + STUDIOLEE squiggle divider with scroll-linked draw animation
(function() {
  function init() {
    var section = document.querySelector('.related-articles');
    if (!section) return;

    // ===== KILL THE WHITESPACE GAP via inline styles (bypasses any CSS caching/specificity) =====
    var blogDetail = document.querySelector('section.blog-detail, .blog-detail');
    if (blogDetail) {
      blogDetail.style.paddingBottom = '0';

      // Hide the legacy "Klaar om te groeien" CTA (the one without rounded-4)
      var ctaRows = blogDetail.querySelectorAll('.row.justify-content-center.mt-5');
      for (var i = 0; i < ctaRows.length; i++) {
        var box = ctaRows[i].querySelector('.bg-dark.p-5');
        if (box && !box.classList.contains('rounded-4')) {
          ctaRows[i].style.display = 'none';
        } else if (box && box.classList.contains('rounded-4')) {
          // Compact the custom CTA
          ctaRows[i].style.marginTop = '1rem';
          ctaRows[i].style.marginBottom = '0';
          box.style.padding = window.innerWidth >= 768 ? '2rem' : '1.5rem';
        }
      }
    }

    section.style.paddingTop = '0';
    section.style.paddingBottom = '2.5rem';
    section.style.marginTop = '0';
    section.style.position = 'relative';
    var h2 = section.querySelector('h2');
    if (h2) { h2.style.marginTop = '0'; h2.style.marginBottom = '1.25rem'; }

    // ===== INJECT FULL-WIDTH SQUIGGLE SVG =====
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'related-squiggle');
    svg.setAttribute('viewBox', '0 0 1200 28');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'display:block;width:100%;height:36px;margin:0 0 1.25rem 0;overflow:visible';
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M0 14 Q 30 2 60 14 T 120 14 T 180 14 T 240 14 T 300 14 T 360 14 T 420 14 T 480 14 T 540 14 T 600 14 T 660 14 T 720 14 T 780 14 T 840 14 T 900 14 T 960 14 T 1020 14 T 1080 14 T 1140 14 T 1200 14');
    path.style.cssText = 'stroke:#C1FF72;stroke-width:2.5;fill:none;stroke-linecap:round;opacity:0.95;transition:stroke-dashoffset 0.05s linear;vector-effect:non-scaling-stroke';
    svg.appendChild(path);
    section.insertBefore(svg, section.firstChild);

    // ===== SCROLL-LINKED DRAW =====
    var pathLength = path.getTotalLength();
    path.style.strokeDasharray = pathLength;
    path.style.strokeDashoffset = pathLength;
    function update() {
      var rect = svg.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var progress = 1 - (rect.top / vh);
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      path.style.strokeDashoffset = pathLength * (1 - progress);
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();

    // ===== LOAD RELATED ARTICLES =====
    var el = document.getElementById('related-articles-grid');
    if (!el) return;
    var currentSlug = el.getAttribute('data-slug');
    var currentCluster = el.getAttribute('data-cluster');
    fetch('/blog/clusters.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var related = data.posts
          .filter(function(p) { return p.cluster === currentCluster && p.slug !== currentSlug; })
          .sort(function(a, b) { return new Date(b.date) - new Date(a.date); })
          .slice(0, 3);
        if (related.length === 0) { el.innerHTML = '<p class="text-muted">Geen gerelateerde artikelen gevonden.</p>'; return; }
        var html = '';
        related.forEach(function(p) {
          var imgUrl = '/images/blog/' + p.slug + '.png';
          var imgHtml = '<div style="background:url(' + imgUrl + ') center/cover no-repeat;height:200px"></div>';
          html += '<div class="col-md-6 col-lg-4"><a href="/blog/' + p.slug + '" class="text-decoration-none"><div class="card bg-dark border-0 rounded-3 h-100 overflow-hidden">' + imgHtml + '<div class="card-body p-4"><h3 class="text-white fs-5 mb-2">' + p.title + '</h3><p class="text-white text-opacity-50 mb-0 fs-6">Lees meer →</p></div></div></a></div>';
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
