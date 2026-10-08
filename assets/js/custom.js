// STUDIOLEE-BOOKING-CONTEXT:START
/* StudioLee booking context. No cookies, fingerprinting or contact data. */
(function () {
  'use strict';
  function decorate(href, page, title, referrer) {
    var link;
    try { link = new URL(href, page); } catch (_) { return href; }
    if (!/^(www\.|app\.)?cal\.com$/.test(link.hostname) ||
        !/^\/studiolee(?:\/|$)/.test(link.pathname)) return href;
    var origin = new URL(page);
    var context = {
      'source-site': origin.hostname,
      'source-page': origin.origin + origin.pathname,
      'source-topic': String(title || '').slice(0, 250)
    };
    try {
      var ref = new URL(referrer);
      if (ref.hostname !== origin.hostname) context['source-referrer'] = ref.hostname;
    } catch (_) { /* No referrer is unknown, not a guessed channel. */ }
    Object.keys(context).forEach(function (key) {
      if (context[key]) link.searchParams.set(key, context[key]);
    });
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      if (!link.searchParams.has(key) && origin.searchParams.has(key)) {
        link.searchParams.set(key, origin.searchParams.get(key));
      }
    });
    return link.href;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { decorate: decorate };
  if (typeof document === 'undefined') return;
  function update(a) {
    var href = a.getAttribute('href');
    if (!href) return;
    var next = decorate(href, location.href, document.title, document.referrer);
    if (next !== href) a.setAttribute('href', next);
  }
  function scan() { document.querySelectorAll('a[href*="cal.com/studiolee"]').forEach(update); }
  scan();
  document.addEventListener('click', function (event) {
    var a = event.target.closest && event.target.closest('a[href]');
    if (a) update(a);
  }, true);
  document.addEventListener('auxclick', function (event) {
    var a = event.target.closest && event.target.closest('a[href]');
    if (a) update(a);
  }, true);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
}());
// STUDIOLEE-BOOKING-CONTEXT:END

$(function () {

    // Header Scroll
    $(window).scroll(function () {
        if ($(window).scrollTop() >= 60) {
            $("header").addClass("fixed-header");
        } else {
            $("header").removeClass("fixed-header");
        }
    });


    // Featured Owl Carousel
    $('.featured-projects-slider .owl-carousel').owlCarousel({
        center: true,
        loop: true,
        margin: 30,
        nav: false,
        dots: false,
        autoplay: true,
        autoplayTimeout: 5000,
        autoplayHoverPause: false,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 2
            },
            1000: {
                items: 3
            },
            1200: {
                items: 4
            }
        }
    })


    // Count
    $('.count').each(function () {
		$(this).prop('Counter', 0).animate({
			Counter: $(this).text()
		}, {
			duration: 1000,
			easing: 'swing',
			step: function (now) {
				$(this).text(Math.ceil(now));
			}
		});
	});

});


// Aos — bewust BUITEN het $(function () { ... }) hierboven.
// Elk [data-aos]-element staat via aos.css op opacity:0 en wordt pas zichtbaar als AOS z'n class zet.
// Stond AOS.init() als laatste regel BINNEN dat blok, dan haalde een fout erboven (owl.carousel die
// niet laadt, een selector die verdwijnt) de init nooit en bleef de HELE pagina onzichtbaar. Dat is
// hier al een keer live gebeurd (05-04, commit 84375f58 "scrollToTopBtn JS crashes, AOS never inits").
// Los blok = een fout hierboven kan de reveal niet meer meenemen.
(function () {
	function toonAlles() {
		// Vangnet: geen AOS = de content gewoon tonen, zonder animatie. Zonder data-aos matcht de
		// opacity:0-regel uit aos.css niet meer. Dit is exact wat AOS' eigen disable() doet.
		var els = document.querySelectorAll('[data-aos]');
		for (var i = 0; i < els.length; i++) {
			els[i].removeAttribute('data-aos');
		}
	}

	function startAos() {
		if (typeof AOS === 'undefined') {
			toonAlles();
			return;
		}
		try {
			AOS.init({
				once: true,
			});
		} catch (e) {
			toonAlles();
			return;
		}
		// AOS bevriest de element-offsets op DOMContentLoaded en hangt er geen load-listener naast.
		// Beelden en webfonts landen daarna en verschuiven de layout eronder vandaan (gemeten: -48 tot
		// -217px). Een refresh na load herijkt de trigger-punten.
		window.addEventListener('load', function () {
			AOS.refresh();
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', startAos);
	} else {
		startAos();
	}
})();
