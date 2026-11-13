/* Chat consent, asked when the chat is wanted.
   The site sets no cookies of its own; only the chat (LeadConnector) does. So instead of a banner over the
   page on arrival, the visitor sees one small chat button in the corner, where the chat itself sits once it
   runs. A tap asks for the chat's cookies right there; yes loads and opens the chat, no closes the question.
   Nothing covers the page's content on arrival. Consent stays in localStorage "cookie_consent" as before. */
(function () {
  var KEY = 'cookie_consent';
  var c = null;
  try { c = localStorage.getItem(KEY); } catch (e) {}
  var host = document.querySelector('[data-widget-id]');
  var wid = host ? host.getAttribute('data-widget-id') : '';

  function loadHL(open) {
    if (!wid || document.querySelector("script[src*='leadconnectorhq']")) return;
    var s = document.createElement('script');
    s.src = 'https://widgets.leadconnectorhq.com/loader.js';
    s.setAttribute('data-resources-url', 'https://widgets.leadconnectorhq.com/chat-widget/loader.js');
    s.setAttribute('data-widget-id', wid);
    document.head.appendChild(s);
    if (!open) return;
    var tries = 0, t = setInterval(function () {
      var w = window.leadConnector && window.leadConnector.chatWidget;
      if (w && typeof w.openWidget === 'function') { clearInterval(t); try { w.openWidget(); } catch (e) {} }
      else if (++tries > 40) clearInterval(t);
    }, 250);
  }
  if (c === 'accepted') { loadHL(false); return; }
  if (!wid) return; // a page without the chat asks nothing

  var st = document.createElement('style');
  st.textContent =
    '#cb{position:fixed;right:16px;bottom:16px;z-index:1040;font-family:Outfit,sans-serif}' +
    '#cb-open{width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:#141419;color:#C1FF72;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.3);transition:transform .2s}' +
    '#cb-open:hover,#cb-open:focus-visible{transform:scale(1.06)}' +
    '#cb-open:focus-visible,#cb button:focus-visible{outline:2px solid #C1FF72;outline-offset:3px}' +
    '#cb-ask{position:absolute;right:0;bottom:64px;width:min(320px,calc(100vw - 32px));background:#141419;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.4);color:rgba(255,255,255,.85);font-size:14px;line-height:1.5}' +
    '#cb-ask[hidden]{display:none}' +
    '#cb-ask p{margin:0 0 12px}#cb-ask a{color:#C1FF72;text-decoration:underline}' +
    '#cb-ask div{display:flex;gap:8px}#cb-ask div button{flex:1;border-radius:100px;font-size:14px;padding:9px 12px;cursor:pointer}' +
    '#cb-no{background:transparent;color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.18)}' +
    '#cb-yes{background:#C1FF72;color:#0a0a0f;border:none;font-weight:700}' +
    '#cb{transition:transform .3s ease,opacity .3s ease}#cb.cb-away{transform:translateY(90px);opacity:0;pointer-events:none}' +
    '@media print{#cb{display:none}}';
  document.head.appendChild(st);

  var d = document.createElement('div');
  d.id = 'cb';
  d.innerHTML =
    '<div id="cb-ask" role="dialog" aria-labelledby="cb-q" hidden>' +
      '<p id="cb-q">Voor de chat gebruiken we cookies van ons chatsysteem. Lees ons <a href="/privacy">privacybeleid</a>.</p>' +
      '<div><button type="button" id="cb-no">Niet nu</button><button type="button" id="cb-yes">Start de chat</button></div>' +
    '</div>' +
    '<button type="button" id="cb-open" aria-expanded="false" aria-controls="cb-ask" aria-label="Chat met ons">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
    '</button>';
  function mount() {
    document.body.appendChild(d);
    var ask = document.getElementById('cb-ask'), open = document.getElementById('cb-open');
    function show(on) { ask.hidden = !on; open.setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) document.getElementById('cb-yes').focus(); }
    open.onclick = function () { show(ask.hidden); };
    document.getElementById('cb-yes').onclick = function () {
      try { localStorage.setItem(KEY, 'accepted'); } catch (e) {}
      d.remove(); loadHL(true);
    };
    document.getElementById('cb-no').onclick = function () {
      try { localStorage.setItem(KEY, 'declined'); } catch (e) {}
      show(false); open.focus();
    };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ask.hidden) { show(false); open.focus(); } });
    // On a phone the text runs to the screen edge, so the button steps aside while the visitor reads on
    // (scrolling down) and comes back when they scroll up, stop near the end, or are at the top.
    var lastY = window.scrollY, ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var y = window.scrollY, narrow = window.innerWidth < 768;
        var end = y + window.innerHeight > document.documentElement.scrollHeight - window.innerHeight * 0.6;
        var away = d.classList.contains('cb-away');
        if (!narrow || !ask.hidden || y <= 80 || end) away = false;
        else if (y > lastY + 4) away = true;
        else if (y < lastY - 4) away = false;
        d.classList.toggle('cb-away', away);
        lastY = y;
      });
    }, { passive: true });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
