// Dynamic related articles — reads clusters.json, shows 3 most recent in same cluster
(function() {
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

  // STUDIOLEE squiggle divider with scroll-linked drawing animation
  var section = document.querySelector('.related-articles');
  if (!section) return;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'related-squiggle');
  svg.setAttribute('viewBox', '0 0 1200 28');
  svg.setAttribute('preserveAspectRatio', 'none');
  var path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M0 14 Q 30 2 60 14 T 120 14 T 180 14 T 240 14 T 300 14 T 360 14 T 420 14 T 480 14 T 540 14 T 600 14 T 660 14 T 720 14 T 780 14 T 840 14 T 900 14 T 960 14 T 1020 14 T 1080 14 T 1140 14 T 1200 14');
  svg.appendChild(path);
  section.insertBefore(svg, section.firstChild);

  var pathLength = path.getTotalLength();
  path.style.strokeDasharray = pathLength;
  path.style.strokeDashoffset = pathLength;

  function updateProgress() {
    var rect = svg.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    // 0 when squiggle bottom enters from below viewport, 1 when squiggle top reaches top of viewport
    var progress = 1 - (rect.top / vh);
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;
    path.style.strokeDashoffset = pathLength * (1 - progress);
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
})();
