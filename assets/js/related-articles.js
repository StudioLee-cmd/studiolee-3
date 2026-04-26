// Dynamic related articles + simple STUDIOLEE squiggle divider with scroll-linked draw
(function() {
  function init() {
    var section = document.querySelector('.related-articles');
    if (!section) return;

    // ===== ANNIHILATE THE WHITESPACE GAP =====
    var blogDetail = document.querySelector('section.blog-detail, .blog-detail');
    if (blogDetail) {
      blogDetail.style.paddingTop = '1.5rem';
      blogDetail.style.paddingBottom = '0.5rem';
      // Hide ALL closing CTA rows in blog body
      blogDetail.querySelectorAll('.row.mt-5, .row.justify-content-center.mt-5').forEach(function(row) {
        row.style.display = 'none';
      });
      // Kill flex gap
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

    // ===== INJECT SQUIGGLE SVG =====
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'related-squiggle');
    svg.setAttribute('viewBox', '0 0 1200 60');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'display:block;width:100%;height:60px;margin:1rem 0 1rem 0;overflow:visible;position:relative';
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 0 30 Q 24 0 48 30 T 96 30 T 144 30 T 192 30 T 240 30 T 288 30 T 336 30 T 384 30 T 432 30 T 480 30 T 528 30 T 576 30 T 624 30 T 672 30 T 720 30 T 768 30 T 816 30 T 864 30 T 912 30 T 960 30 T 1008 30 T 1056 30 T 1104 30 T 1152 30 T 1200 30');
    path.style.cssText = 'stroke:#C1FF72;stroke-width:2.5;fill:none;stroke-linecap:round;opacity:0.95;vector-effect:non-scaling-stroke';
    svg.appendChild(path);
    section.insertBefore(svg, section.firstChild);

    var pathLength = path.getTotalLength();
    path.style.strokeDasharray = pathLength;
    path.style.strokeDashoffset = pathLength;
    function update() {
      var rect = svg.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var progress = 4 * (1 - rect.top / vh);
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
