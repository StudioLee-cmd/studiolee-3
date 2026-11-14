// /gratis-gesprek: every 'gratis gesprek' button of the site lands here. The visitor leaves an e-mail address first and
// then picks a moment in the agenda (cal.com), the address already filled in. Only the live site sends the address to
// the demo lead route; a preview never writes a real lead.
(function () {
  'use strict';
  var form = document.getElementById('gesprekForm');
  if (!form) return;
  var err = form.querySelector('.gesprek-error');
  var agenda = document.querySelector('.gesprek-agenda');
  var LIVE = /^(www\.)?studiolee\.nl$/.test(location.hostname);
  var params = new URLSearchParams(location.search);
  var from = params.get('van') || '';
  try { var ref = new URL(document.referrer); if (ref.hostname === location.hostname && ref.pathname !== location.pathname) from = from || ref.pathname; } catch (_) { /* no referrer */ }
  var duur = params.get('duur') === '15' ? '15' : '30';
  var boek = Array.prototype.slice.call(document.querySelectorAll('.gesprek-boek'));
  if (duur === '15') boek.reverse().forEach(function (a) { a.parentNode.insertBefore(a, a.parentNode.querySelector('.gesprek-boek')); });

  function open(email, note) {
    form.hidden = true;
    boek.forEach(function (a) {
      try {
        var u = new URL(a.getAttribute('href'), location.href);
        u.searchParams.set('email', email);
        if (from) u.searchParams.set('source-from', from);
        a.setAttribute('href', u.href);
      } catch (_) { /* keep the plain link */ }
    });
    if (note) agenda.querySelector('.gesprek-agenda-tekst').textContent += note;
    agenda.hidden = false;
    var first = agenda.querySelector('.gesprek-boek');
    if (first) first.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    var email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Vul een geldig e-mailadres in.'; form.email.focus(); return; }
    if (!form.consent_contact.checked) { err.textContent = 'Zet het vinkje, dan mogen we je over het gesprek mailen.'; return; }
    var btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Even geduld...';
    var lead = { email: email, site: 'studiolee.nl', niche: 'studiolee', source: 'studiolee_gratis_gesprek', page: from || location.pathname,
      duration: duur, website: form.website.value, consent_contact: true, consent_promotion: false,
      consent_text: 'Ja, STUDIOLEE mag me mailen over dit gesprek.', consent_version: 'studiolee-gratis-gesprek-2026-11-14' };
    if (!LIVE) { open(email, ' (Voorbeeld: niets verstuurd.)'); return; }
    fetch('https://n8n.aireclamestudio.nl/webhook/eigen-site-demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); open(email, ''); })
      .catch(function () { btn.disabled = false; btn.textContent = 'Verder naar de agenda'; err.textContent = 'Versturen lukte niet. Probeer het opnieuw, of kies hieronder direct een moment.'; open(email, ''); form.hidden = false; });
  });
}());
