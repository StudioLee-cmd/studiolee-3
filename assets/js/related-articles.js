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
})();
