// Kennisbank search (blog.html): finds articles by a word of their title, excerpt, tag or headings.
// The index blog/search-index.json is made at build time by tools/blog-search-index.mjs; it is fetched on first use.
(function () {
  var form = document.getElementById('blog-search');
  var input = document.getElementById('blog-search-input');
  var box = document.getElementById('blog-search-results');
  if (!form || !input || !box) return;
  var SHOWN = 8, entries = null, failed = false, loading = false, all = false;

  function normalize(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function weigh(field, term, word, part) {
    if (field.indexOf(term) === -1) return 0;
    return (' ' + field).indexOf(' ' + term) !== -1 ? word : part;
  }
  function search(query) {
    var terms = normalize(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    var phrase = terms.join(' '), scored = [];
    entries.forEach(function (e) {
      var title = normalize(e.title), tags = normalize((e.tags || []).join(' ')), heads = normalize((e.headings || []).join(' '));
      var excerpt = normalize(e.excerpt), slug = normalize(e.slug), score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        var s = weigh(title, t, 10, 6) + weigh(tags, t, 5, 3) + weigh(heads, t, 3, 2) + weigh(excerpt, t, 2, 1) + weigh(slug, t, 1, 1);
        if (!s) return;
        score += s;
      }
      if (terms.length > 1 && title.indexOf(phrase) !== -1) score += 8;
      scored.push([score, e]);
    });
    scored.sort(function (a, b) { return b[0] - a[0] || String(b[1].date).localeCompare(String(a[1].date)); });
    return scored.map(function (x) { return x[1]; });
  }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function load() {
    if (entries || loading) return;
    loading = true;
    fetch('/blog/search-index.json')
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (d) { entries = d; render(); })
      .catch(function () { failed = true; render(); })
      .then(function () { loading = false; });
  }
  function render() {
    var q = input.value.trim();
    if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var found = entries ? search(q) : [];
    var text = failed ? 'Zoeken lukt nu niet. Blader hieronder door de artikelen.'
      : !entries ? 'Even zoeken...'
      : found.length ? found.length + (found.length === 1 ? ' artikel' : ' artikelen') + ' gevonden'
      : 'Geen artikel gevonden voor "' + q + '". Probeer een ander woord.';
    var html = '<p class="blog-search-count">' + esc(text) + '</p>';
    var shown = all ? found : found.slice(0, SHOWN);
    if (shown.length) {
      html += '<ul>' + shown.map(function (e) {
        return '<li><a href="/blog/' + esc(e.slug) + '" data-slug="' + esc(e.slug) + '"><span class="blog-search-title">' + esc(e.title) + '</span>'
          + (e.excerpt ? '<span class="blog-search-excerpt">' + esc(e.excerpt) + '</span>' : '') + '</a></li>';
      }).join('') + '</ul>';
    }
    if (!all && found.length > SHOWN) html += '<button type="button" class="blog-search-more">Toon alle ' + found.length + ' artikelen</button>';
    box.innerHTML = html;
  }
  function remember() {
    var url = new URL(window.location.href), q = input.value.trim();
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  input.addEventListener('focus', load);
  input.addEventListener('input', function () { all = false; load(); render(); remember(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; render(); remember(); } });
  box.addEventListener('click', function (e) { if (e.target.closest('.blog-search-more')) { all = true; render(); } });
  var start = new URLSearchParams(window.location.search).get('q');
  if (start) { input.value = start; load(); render(); }
})();
