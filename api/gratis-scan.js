// De gratis scan van /gratis-scan: leest de openbare homepage, robots.txt en sitemap van het adres dat een bezoeker
// invult en geeft per punt van de free-scan-lijst terug wat er te zien was (true, false of null = niet te lezen).
// De uitleg per punt en het onderdeel dat het oplost staan op de pagina zelf; hier komt alleen de meting vandaan.
// Er wordt niets opgeslagen en niets doorgestuurd: geen e-mail, geen lead, geen log van het adres.
'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');

const UA = 'Mozilla/5.0 (compatible; StudioLeeScan/1.0; +https://www.studiolee.nl/gratis-scan)';
const PAGE_BYTES = 2500000;
const SIDE_BYTES = 1500000;
const BLOCKED_TLD = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|onion|arpa)$/i;
const HITS = new Map(); // per instantie: hoogstens 12 scans per minuut per bezoeker

class ScanError extends Error {
  constructor(status, reason, message) { super(message); this.status = status; this.reason = reason; }
}

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const x = String(ip).toLowerCase();
  if (x === '::' || x === '::1') return true;
  if (x.startsWith('::ffff:')) return privateIp(x.slice(7));
  return /^(fc|fd|fe[89ab]|ff|64:ff9b)/.test(x);
}

async function assertPublic(host) {
  if (!host || net.isIP(host) || BLOCKED_TLD.test(host) || !/^([a-z0-9-]+\.)+[a-z0-9-]{2,}$/i.test(host)) {
    throw new ScanError(400, 'adres', 'Dat lijkt geen openbaar website-adres.');
  }
  let found;
  try {
    found = await Promise.race([dns.lookup(host, { all: true, verbatim: true }),
      new Promise((resolve) => setTimeout(() => resolve([]), 2500))]);
  } catch (e) { found = []; }
  if (!found.length) throw new ScanError(422, 'onbekend', 'Dit adres bestaat niet of is nu niet te vinden.');
  if (found.some((r) => privateIp(r.address))) throw new ScanError(400, 'adres', 'Dat lijkt geen openbaar website-adres.');
}

async function readLimited(res, limit) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { parts.push(value.slice(0, value.length - (size - limit))); try { await reader.cancel(); } catch (e) { /* klaar */ } break; }
    parts.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(parts.map((p) => Buffer.from(p))));
}

async function get(start, { limit, timeout, accept }) {
  let current = start;
  const hops = [];
  for (let hop = 0; hop < 5; hop++) {
    const u = new URL(current);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && !['80', '443'].includes(u.port))) {
      throw new ScanError(400, 'adres', 'Dat lijkt geen openbaar website-adres.');
    }
    await assertPublic(u.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(u.href, { redirect: 'manual', signal: ctrl.signal,
        headers: { 'user-agent': UA, accept, 'accept-language': 'nl-NL,nl;q=0.9,en;q=0.5' } });
      const loc = res.headers.get('location');
      if ([301, 302, 303, 307, 308].includes(res.status) && loc) {
        hops.push(res.status);
        current = new URL(loc, u).href;
        try { await res.body?.cancel(); } catch (e) { /* geen body */ }
        continue;
      }
      const body = await readLimited(res, limit);
      return { status: res.status, url: u.href, type: res.headers.get('content-type') || '', robotsHeader: res.headers.get('x-robots-tag') || '', body, hops };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ScanError(422, 'omleidingen', 'Dit adres stuurt door naar steeds een ander adres.');
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', eacute: 'é', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', egrave: 'è', agrave: 'à', ccedil: 'ç', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '-', mdash: '-', middot: '·', copy: '©', reg: '®', trade: '™' };
function decode(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch (x) { return m; } }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
const clean = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);

function attrs(tag) {
  const out = {};
  tag.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g, (m, k, a, b, c) => { out[k.toLowerCase()] = decode(a ?? b ?? c ?? ''); return ''; });
  return out;
}

function jsonLd(html) {
  const types = [];
  const things = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const t = v['@type'];
    (Array.isArray(t) ? t : t ? [t] : []).forEach((x) => types.push(String(x)));
    if (t) things.push(v);
    Object.values(v).forEach((x) => { if (x && typeof x === 'object') walk(x); });
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch (e) { /* onleesbaar blok telt niet */ }
  }
  return { types, things };
}

const LOCAL_TYPES = /(LocalBusiness|Store|Restaurant|Dentist|Physician|MedicalBusiness|LegalService|Attorney|HomeAndConstructionBusiness|Plumber|Electrician|RoofingContractor|HousePainter|GeneralContractor|Locksmith|MovingCompany|HVACBusiness|AutoRepair|AutomotiveBusiness|BeautySalon|HairSalon|NailSalon|DaySpa|HealthAndBeautyBusiness|ProfessionalService|FinancialService|RealEstateAgent|TravelAgency|FoodEstablishment|LodgingBusiness|SportsActivityLocation|EntertainmentBusiness|ChildCare|DryCleaningOrLaundry|EmergencyService|EmploymentAgency|GovernmentOffice|Library|RecyclingCenter|SelfStorage|ShoppingCenter|TouristInformationCenter|VeterinaryCare|AnimalShelter|MedicalClinic|Optician|Pharmacy)/;

function page(html, url) {
  const head = html.split(/<\/head>/i)[0];
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const meta = (k) => { const m = metas.find((a) => (a.name || a.property || '').toLowerCase() === k); return m ? (m.content || '').trim() : null; };
  const title = clean((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const text = clean(body);
  const h1 = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => clean(m[1]));
  const heads = [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => clean(m[2]));
  const host = new URL(url).hostname.replace(/^www\./, '');
  const links = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: attrs(m[1]).href || '', text: clean(m[2]) }));
  const internal = new Set();
  for (const l of links) {
    try {
      const u = new URL(l.href, url);
      if (/^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, '') === host && (u.pathname !== new URL(url).pathname)) internal.add(u.pathname.replace(/\/$/, '') || '/');
    } catch (e) { /* geen link */ }
  }
  const ld = jsonLd(html);
  return { head, metas, meta, title, body, text, h1, heads, links, internal, ld, host,
    lang: (html.match(/<html\b[^>]*\blang\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '',
    robots: [meta('robots'), meta('googlebot')].filter(Boolean).join(' ').toLowerCase() };
}

function robotsRules(txt) {
  const groups = [];
  let cur = null; let lastWasAgent = false;
  const sitemaps = [];
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(); const v = m[2].trim();
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase()); lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (k === 'sitemap') sitemaps.push(v);
      else if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ k, path: v });
    }
  }
  const groupFor = (agent) => groups.find((g) => g.agents.some((a) => a !== '*' && agent.includes(a))) || groups.find((g) => g.agents.includes('*'));
  const blocksAll = (agent) => {
    const g = groupFor(agent.toLowerCase());
    if (!g) return false;
    const dis = g.rules.some((r) => r.k === 'disallow' && (r.path === '/' || r.path === '/*'));
    const allow = g.rules.some((r) => r.k === 'allow' && (r.path === '/' || r.path === '/*' || r.path === '/$'));
    return dis && !allow;
  };
  return { blocksAll, sitemaps };
}

const NL_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const day = (d) => `${d.getUTCDate()} ${NL_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

async function sitemap(origin, rules) {
  const tried = [...rules.sitemaps.slice(0, 2), origin + '/sitemap.xml', origin + '/sitemap_index.xml'];
  for (const href of [...new Set(tried)]) {
    let r;
    try { r = await get(href, { limit: SIDE_BYTES, timeout: 3500, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' }); } catch (e) { continue; }
    if (r.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(r.body)) continue;
    let mods = [...r.body.matchAll(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/gi)].map((m) => new Date(m[1])).filter((d) => !isNaN(d));
    const urls = (r.body.match(/<loc>/gi) || []).length;
    if (/<sitemapindex\b/i.test(r.body) && !mods.length) {
      const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
      const pick = locs.find((l) => /post|blog|artikel|nieuws|news/i.test(l)) || locs[0];
      if (pick) {
        try {
          const c = await get(pick, { limit: SIDE_BYTES, timeout: 3000, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' });
          if (c.status === 200) mods = [...c.body.matchAll(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/gi)].map((m) => new Date(m[1])).filter((d) => !isNaN(d));
        } catch (e) { /* zonder datums */ }
      }
    }
    return { found: true, url: r.url, urls, mods };
  }
  return { found: false, mods: [] };
}

const PHONE = /(?:\+31|0031|\b0)[\s.-]?(?:\(0\)[\s.-]?)?[1-9](?:[\s.-]?\d){7,8}\b/;
const POSTCODE = /\b[1-9]\d{3}\s?(?!SA|SD|SS)[A-Z]{2}\b/;

function measure(p, res, rob, map) {
  const s = {};
  const set = (id, value, note) => { s[id] = { value, note }; };
  const lower = p.text.toLowerCase();
  const hrefs = p.links.map((l) => l.href.toLowerCase());
  const thin = p.text.length < 400 && p.internal.size < 3;

  set('status_200', res.status === 200, res.status === 200
    ? (res.hops.length ? `je adres stuurt ${res.hops.length} keer door en geeft dan een normale pagina` : 'je pagina geeft direct een normale pagina (status 200)')
    : `je pagina gaf status ${res.status}`);
  set('https', res.url.startsWith('https://'), `adres na het openen: ${res.url}`);
  set('title_aanwezig', !!p.title, p.title ? `titel: "${cut(p.title, 90)}"` : 'er staat geen titel in de broncode');
  set('title_lengte', p.title.length >= 15 && p.title.length <= 65, `de titel is ${p.title.length} tekens`);
  const desc = p.meta('description') || '';
  set('meta_aanwezig', !!desc, desc ? `omschrijving: "${cut(desc, 120)}"` : 'er staat geen omschrijving (meta-description) in de broncode');
  set('meta_lengte', desc.length >= 50 && desc.length <= 165, `de omschrijving is ${desc.length} tekens`);
  set('h1_aanwezig', p.h1.length === 1, !p.h1.length ? 'de pagina heeft geen hoofdkop (H1)' : p.h1.length === 1 ? `de hoofdkop is "${cut(p.h1[0], 90)}"` : `de pagina heeft ${p.h1.length} hoofdkoppen`);
  set('koppen_structuur', p.heads.length >= 3, `${p.heads.length} ${p.heads.length === 1 ? 'kop' : 'koppen'} op de pagina`);
  const og = ['og:title', 'og:description', 'og:image'].filter((k) => p.meta(k));
  set('og_tags', og.length === 3, og.length ? `deelgegevens: ${og.join(', ')}` : 'geen deelgegevens (og:title, og:description, og:image)');
  set('taal_attribuut', !!p.lang, p.lang ? `taal: ${p.lang}` : 'de taal is niet vastgelegd');
  const vp = p.meta('viewport');
  set('viewport', !!vp, vp ? `viewport: ${cut(vp, 60)}` : 'er staat geen viewport in de broncode');
  set('interne_links', thin ? null : p.internal.size >= 5, `${p.internal.size} links naar andere pagina's van je site`);

  const noindex = /noindex/.test(p.robots) || /noindex/i.test(res.robotsHeader);
  const blocked = rob.read && rob.rules.blocksAll('googlebot');
  const index = [];
  if (noindex) index.push('de pagina vraagt Google haar niet op te nemen (noindex)');
  if (blocked) index.push('robots.txt houdt Google buiten de hele site');
  if (!map.found) index.push('ik vond geen sitemap');
  set('indexeerbaarheid', !rob.read && !noindex && map.found ? null : !index.length,
    index.length ? index.join('; ') : `geen noindex, robots.txt laat Google toe en de sitemap staat op ${map.url ? new URL(map.url).pathname : '/sitemap.xml'}`);

  if (map.found && map.mods.length) {
    const newest = new Date(Math.max(...map.mods));
    const same = map.mods.length >= 5 && map.mods.every((d) => d.toISOString().slice(0, 10) === map.mods[0].toISOString().slice(0, 10));
    const fresh = Date.now() - newest.getTime() <= 365 * 864e5;
    set('publicatie_ritme', same ? null : fresh, same ? `je sitemap geeft alle ${map.mods.length} pagina's dezelfde datum, dus daar is het ritme niet uit te lezen` : `de nieuwste datum in je sitemap is ${day(newest)}`);
  } else {
    set('publicatie_ritme', null, map.found ? 'je sitemap noemt geen datums' : 'ik vond geen sitemap');
  }

  const hasTel = hrefs.some((h) => h.startsWith('tel:'));
  const phoneText = PHONE.test(p.text.replace(/ /g, ' '));
  const hasMail = hrefs.some((h) => h.startsWith('mailto:')) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(p.text);
  const hasWa = hrefs.some((h) => /wa\.me|api\.whatsapp|whatsapp\.com/.test(h));
  const hasForm = /<form\b/i.test(p.body) && (/<textarea\b/i.test(p.body) || /type\s*=\s*["']?(email|tel)/i.test(p.body));
  const contactLink = p.links.some((l) => /contact|offerte|afspraak/i.test(l.href + ' ' + l.text));
  const ACTION = /(offerte|afspraak|contact|bel\b|bellen|plan\b|boek|aanvra|vraag\b.*\baan|probeer|bestel|reserveer|start|gratis|neem contact|stuur)/i;
  const actions = p.links.filter((l) => ACTION.test(l.text)).length + (p.body.match(/<button\b[^>]*>([\s\S]*?)<\/button>/gi) || []).filter((b) => ACTION.test(clean(b))).length;
  set('cta_aanwezig', thin ? null : (actions > 0 || hasTel || hasForm), actions ? `${actions} knop${actions === 1 ? '' : 'pen'} of link${actions === 1 ? '' : 's'} om iets te doen (zoals contact, offerte of afspraak)` : hasTel || hasForm ? 'geen knop met een duidelijke actie, wel een telefoonlink of formulier' : 'geen knop of link om te bellen, te mailen of iets aan te vragen');
  const routes = [hasTel || phoneText ? 'bellen' : null, hasMail ? 'mailen' : null, hasWa ? 'WhatsApp' : null, hasForm ? 'een formulier' : (contactLink ? 'een contactpagina' : null)].filter(Boolean);
  set('contactroutes', thin ? null : routes.length >= 2, routes.length ? `contact kan via ${routes.join(', ')}` : 'ik vond geen manier om contact op te nemen');
  const reviewWords = /(review|beoordeling|recensie|sterren|★|klanten zeggen|klanten over|tevreden klanten|ervaringen van|wat klanten|klantervaring|testimonial|\b\d[,.]\d\s*\/\s*(5|10)\b|google reviews|kiyoh|trustpilot|feedback company)/i;
  const rating = p.ld.things.some((t) => t.aggregateRating || t.review);
  set('sociale_bewijskracht', thin ? null : reviewWords.test(p.text) || rating, reviewWords.test(p.text) || rating ? 'er staan klantreacties of beoordelingen op de pagina' : 'geen klantreacties, beoordelingen of sterren in de tekst');
  set('autoriteit_signalen', thin ? null : /(portfolio|projecten|cases?\b|referenties|ons werk|mijn werk|jaar ervaring|jaren ervaring|sinds (19|20)\d\d|certific|keurmerk|erkend|gecertificeerd|lid van|aangesloten bij)/i.test(p.text),
    /(portfolio|projecten|cases?\b|referenties|ons werk|mijn werk|jaar ervaring|jaren ervaring|sinds (19|20)\d\d|certific|keurmerk|erkend|gecertificeerd|lid van|aangesloten bij)/i.test(p.text) ? 'er staan voorbeelden van werk, ervaring of keurmerken' : 'geen voorbeelden van werk, ervaring of keurmerken in de tekst');
  const kvk = /\b(kvk|k\.v\.k\.|kamer van koophandel)\b/i.test(p.text);
  const terms = p.links.some((l) => /voorwaarden|privacy/i.test(l.href + ' ' + l.text));
  const addr = POSTCODE.test(p.text) || p.ld.things.some((t) => t.address);
  const trust = [kvk ? 'KVK' : null, terms ? 'voorwaarden of privacy' : null, addr ? 'een adres' : null].filter(Boolean);
  set('vertrouwen_zakelijk', thin ? null : trust.length >= 2, trust.length ? `op de pagina: ${trust.join(', ')}` : 'geen adres, KVK of voorwaarden op de pagina');
  const price = /€\s?\d|\beur\s?\d|\d\s?euro\b|\bprijs|\bprijzen|\btarie(f|ven)|\bkosten\b/i.test(p.text) || p.links.some((l) => /prijs|prijzen|tarie/i.test(l.href + ' ' + l.text));
  set('prijs_transparantie', thin ? null : price, price ? 'er staat iets over prijs of kosten, of een link naar je tarieven' : 'nergens een prijs, tarief of link naar prijzen');
  const video = /<video\b/i.test(p.body) || /<iframe\b[^>]*src\s*=\s*["'][^"']*(youtube|youtube-nocookie|vimeo|wistia|vidyard|loom)\./i.test(p.body) || /data-(youtube|video|vimeo)/i.test(p.body);
  set('video_aanwezig', thin ? null : video, video ? 'er staat een video op de pagina' : 'geen video op de pagina');

  const faqLd = p.ld.types.some((t) => /FAQPage/i.test(t));
  const qHeads = p.heads.filter((h) => /\?\s*$/.test(h)).length;
  set('faq_structuur', thin ? null : faqLd || qHeads >= 2 || /(veelgestelde vragen|veel gestelde vragen|\bfaq\b)/i.test(p.text),
    faqLd ? 'er staat een FAQ in de code' : qHeads >= 2 ? `${qHeads} koppen die een vraag stellen` : /(veelgestelde vragen|\bfaq\b)/i.test(p.text) ? 'er staat een blok met veelgestelde vragen' : 'geen vragen met antwoorden op de pagina');
  const articles = [...p.internal].filter((x) => /(blog|nieuws|kennisbank|kennis|artikel|tips|inspiratie|weetjes|advies)/i.test(x));
  set('eigen_artikelen', thin ? null : articles.length > 0, articles.length ? `links naar ${articles.slice(0, 2).join(' en ')}` : 'geen link naar een blog, kennisbank of artikelen');
  const org = p.ld.types.filter((t) => /Organization|Corporation|Product|Brand/.test(t) || LOCAL_TYPES.test(t));
  set('schema_organization', org.length > 0, org.length ? `bedrijfsgegevens in de code: ${[...new Set(org)].slice(0, 3).join(', ')}` : 'geen bedrijfsgegevens in de code (Organization of LocalBusiness)');
  if (rob.read) {
    const shut = ['GPTBot', 'ClaudeBot', 'PerplexityBot'].filter((a) => rob.rules.blocksAll(a));
    set('ai_crawlers_toegelaten', shut.length === 0, shut.length ? `robots.txt weert ${shut.join(', ')}` : 'robots.txt laat GPTBot, ClaudeBot en PerplexityBot binnen');
  } else {
    set('ai_crawlers_toegelaten', null, 'je robots.txt was niet te lezen');
  }

  set('adres_of_plaats', thin ? null : addr, addr ? 'er staat een adres of postcode op de pagina' : 'geen adres of postcode op de pagina');
  set('telefoonnummer', thin ? null : hasTel || phoneText, hasTel ? 'er staat een klikbaar telefoonnummer' : phoneText ? 'er staat een telefoonnummer (niet klikbaar)' : 'geen telefoonnummer op de pagina');
  const area = /(werkgebied|regio\b|in de regio|in en rond|in en om|omgeving\b|en omstreken|actief in|servicegebied|heel nederland|door heel|landelijk)/i.test(p.text);
  set('werkgebied', thin ? null : area, area ? 'het werkgebied of de regio wordt genoemd' : 'het werkgebied of de regio wordt niet genoemd');
  const hoursLd = p.ld.things.some((t) => t.openingHours || t.openingHoursSpecification);
  const hours = hoursLd || /(openingstijden|geopend|bereikbaar (van|op|tussen)|\b(ma|maandag)\b\s*(t\/m|tot|-|–)\s*\b(vr|vrijdag|za|zaterdag)\b|\d{1,2}[:.]\d{2}\s*(-|–|tot)\s*\d{1,2}[:.]\d{2})/i.test(p.text);
  set('openingstijden', thin ? null : hours, hours ? 'er staan openingstijden of bereikbaarheidstijden' : 'geen openingstijden of bereikbaarheidstijden op de pagina');
  const localLd = p.ld.things.filter((t) => [].concat(t['@type'] || []).some((x) => LOCAL_TYPES.test(String(x))));
  const fullLocal = localLd.some((t) => t.address && (t.openingHours || t.openingHoursSpecification));
  set('schema_lokaal', fullLocal, fullLocal ? 'lokale bedrijfsgegevens met adres en openingstijden in de code' : localLd.length ? 'lokale bedrijfsgegevens in de code, maar zonder adres of openingstijden' : 'geen lokale bedrijfsgegevens (LocalBusiness) in de code');
  return { signals: s, thin };
}

function target(input) {
  let v = String(input || '').trim();
  if (!v || v.length > 300 || /\s/.test(v)) throw new ScanError(400, 'adres', 'Vul het adres van je website in, bijvoorbeeld jouwbedrijf.nl.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'https://' + v;
  let u;
  try { u = new URL(v); } catch (e) { throw new ScanError(400, 'adres', 'Dat lijkt geen website-adres. Probeer het zo: jouwbedrijf.nl.'); }
  if (!/^https?:$/.test(u.protocol)) throw new ScanError(400, 'adres', 'Dat lijkt geen website-adres. Probeer het zo: jouwbedrijf.nl.');
  u.hash = '';
  return u;
}

function limited(req) {
  const who = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'onbekend';
  const now = Date.now();
  const hits = (HITS.get(who) || []).filter((t) => now - t < 60000);
  hits.push(now);
  HITS.set(who, hits);
  if (HITS.size > 5000) HITS.clear();
  return hits.length > 12;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, reason: 'methode', message: 'Gebruik het formulier op /gratis-scan.' }); }
  if (limited(req)) return res.status(429).json({ ok: false, reason: 'te-vaak', message: 'Dat waren veel scans in korte tijd. Probeer het over een minuut opnieuw.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const u = target(body.website);
    let res1;
    try {
      res1 = await get(u.href, { limit: PAGE_BYTES, timeout: 7000, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' });
    } catch (e) {
      if (e instanceof ScanError) throw e;
      if (u.protocol === 'https:') {
        try { res1 = await get(u.href.replace(/^https:/, 'http:'), { limit: PAGE_BYTES, timeout: 5000, accept: 'text/html,*/*;q=0.5' }); } catch (e2) { res1 = null; }
      }
      if (!res1) throw new ScanError(502, 'onbereikbaar', `Ik kon ${u.hostname} niet openen. Klopt het adres, en staat de site online?`);
    }
    if ([401, 403, 429, 503].includes(res1.status)) {
      throw new ScanError(502, 'geweigerd', `${u.hostname} liet mijn scan niet binnen (status ${res1.status}). Dat doen sommige beveiligingen bij elke onbekende bezoeker.`);
    }
    if (!/html|xml/i.test(res1.type) && !/<html|<body|<head/i.test(res1.body.slice(0, 3000))) {
      throw new ScanError(422, 'geen-pagina', `Op ${u.hostname} staat geen gewone webpagina die ik kan lezen.`);
    }
    const final = new URL(res1.url);
    const origin = final.origin;
    const robots = await get(origin + '/robots.txt', { limit: 300000, timeout: 3000, accept: 'text/plain,*/*;q=0.5' }).catch(() => null);
    const rob = { read: !!robots && (robots.status === 200 || robots.status === 404 || robots.status === 410), rules: robotsRules(robots && robots.status === 200 ? robots.body : '') };
    const map = await sitemap(origin, rob.rules).catch(() => ({ found: false, mods: [] }));
    const p = page(res1.body, res1.url);
    const m = measure(p, res1, rob, map);
    return res.status(200).json({ ok: true, target: res1.url, host: final.hostname.replace(/^www\./, ''), read_at: new Date().toISOString(),
      read: ['de broncode van je pagina', rob.read ? 'je robots.txt' : null, map.found ? 'je sitemap' : null].filter(Boolean),
      thin: m.thin, signals: m.signals });
  } catch (e) {
    if (e instanceof ScanError) return res.status(e.status).json({ ok: false, reason: e.reason, message: e.message });
    return res.status(500).json({ ok: false, reason: 'fout', message: 'Er ging iets mis bij het lezen van je site. Probeer het zo nog een keer.' });
  }
};

module.exports.measure = measure;
module.exports.page = page;
module.exports.robotsRules = robotsRules;
module.exports.privateIp = privateIp;
