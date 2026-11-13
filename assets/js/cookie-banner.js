/* Cookie consent for the chat (LeadConnector), the one part of the site that places cookies.
   The question is a bar at the very top of the page, in space each page reserves before its first paint (the html class
   cb-ask, set in the page's head while no answer is stored; the bar's look is in styles.css). It pushes the page down
   instead of lying over it, so it covers nothing and nothing jumps. The fixed header sits under the bar until the bar has
   scrolled away. Accepteren loads the chat; Weigeren keeps it off. The choice stays in localStorage "cookie_consent". */
(function () {
  var root = document.documentElement, c = null;
  try { c = localStorage.getItem('cookie_consent'); } catch (e) {}
  function loadHL() {
    var el = document.querySelector('[data-widget-id]');
    var wid = el ? el.getAttribute('data-widget-id') : '';
    if (!wid) return;
    if (document.querySelector("script[src*='leadconnectorhq']")) return;
    var s = document.createElement('script');
    s.src = 'https://widgets.leadconnectorhq.com/loader.js';
    s.setAttribute('data-resources-url', 'https://widgets.leadconnectorhq.com/chat-widget/loader.js');
    s.setAttribute('data-widget-id', wid);
    document.head.appendChild(s);
    quietPrompt();
  }
  // The chat waits closed, as its button, until the visitor opens it: its greeting bubble ("Vragen over ...") would
  // otherwise open by itself and lie over the page while scrolling.
  function quietPrompt() {
    var tries = 0, t = setInterval(function () {
      var w = document.querySelector('chat-widget'), r = w && w.shadowRoot;
      if (r && r.querySelector('.lc_text-widget')) {
        if (!r.getElementById('sl-quiet')) {
          var st = document.createElement('style'); st.id = 'sl-quiet';
          st.textContent = '.lc_text-widget--prompt{display:none!important}';
          r.appendChild(st);
        }
        if (++tries > 60) clearInterval(t); // keep it on while the widget settles (it re-renders once or twice)
      } else if (++tries > 120) clearInterval(t);
    }, 250);
  }
  if (c === 'accepted') { root.classList.remove('cb-ask'); loadHL(); return; }
  if (c === 'declined') { root.classList.remove('cb-ask'); return; }
  root.classList.add('cb-ask'); // a page whose head lacks the early line still reserves the space here

  var d = document.createElement('div');
  d.id = 'cb';
  d.setAttribute('role', 'region');
  d.setAttribute('aria-label', 'Cookies');
  d.innerHTML = '<div><img src="/assets/images/cookie.png" alt=""><p>We gebruiken cookies voor onze chatfunctie. Lees ons <a href="/privacy">privacybeleid</a>.</p>' +
    '<div class="cb-b"><button type="button" id="cb-no">Weigeren</button><button type="button" id="cb-yes">Accepteren</button></div></div>';

  function mount() {
    document.body.insertBefore(d, document.body.firstChild);
    var header = document.querySelector('header.position-fixed');
    function sync() { if (header) header.style.setProperty('top', Math.max(0, d.offsetHeight - window.scrollY) + 'px', 'important'); }
    function close(choice) {
      try { localStorage.setItem('cookie_consent', choice); } catch (e) {}
      window.removeEventListener('scroll', sync); window.removeEventListener('resize', sync);
      // fold the bar away: page, header and bar move together, then the reserved space is released
      root.classList.add('cb-leaving');
      if (header) header.style.removeProperty('top');
      root.style.setProperty('--cb-h', '0px');
      setTimeout(function () {
        d.remove();
        root.classList.remove('cb-ask', 'cb-leaving');
        root.style.removeProperty('--cb-h');
        document.dispatchEvent(new CustomEvent('studiolee:layout-moved'));
      }, 300);
      if (choice === 'accepted') loadHL();
    }
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    document.getElementById('cb-yes').onclick = function () { close('accepted'); };
    document.getElementById('cb-no').onclick = function () { close('declined'); };
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
