/* Everything CUET: one static page, hash routes, data in data/*.json, the student's own data in this browser. */
(() => {
  'use strict';

  const C = window.ECUET_CONFIG || {};
  const P = Object.assign({ assistedForm: 99, csasPro: 499, mentor: 1999, mentorPlus: 2999, seniorCall: 199, bundleMinForms: 5, bundleDiscount: 0.3 }, C.prices || {});
  const KEY = 'ecuet.v1';
  const NTA = 'https://cuet.nta.nic.in/';
  const NTA_UNIS = 'https://cuet.nta.nic.in/participating-universities/';
  const SATHEE = 'https://cuet.iitk.ac.in/sathee-cuet/resources/mock-tests';
  const CATS = ['Central', 'State', 'Deemed', 'Private', 'Government / other'];
  const RES_CATS = ['UR', 'OBC-NCL', 'EWS', 'SC', 'ST', 'PwBD'];
  const COLS = [['dream', 'Dream'], ['target', 'Target'], ['safe', 'Safe']];
  const STATUSES = ['Not started', 'Registered', 'Fee paid', 'Preferences locked', 'Allotted', 'Accepted', 'Admission fee paid'];
  const DOCS = ['Class 10 marksheet (date of birth proof)', 'Class 12 marksheet', 'CUET (UG) scorecard', 'Category certificate (OBC-NCL / SC / ST)', 'EWS certificate valid for this year', 'PwBD certificate', 'Photo and signature in the portal size', 'Photo ID (Aadhaar or other)', 'Domicile certificate (state quota)', 'Transfer / migration certificate', 'Character certificate'];
  const SUBJECTS = ['English', 'Hindi', 'Accountancy', 'Biology', 'Business Studies', 'Chemistry', 'Computer Science / Informatics Practices', 'Economics', 'Geography', 'History', 'Mathematics / Applied Mathematics', 'Physics', 'Political Science', 'Psychology', 'Sociology', 'General Test'];
  const TIER = { merit: { safe: 10, dream: 25 }, subject: { safe: 2.5, dream: 6.25 } };

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const uid = () => Math.random().toString(36).slice(2, 9);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
  const fmtDate = d => new Date(d).toLocaleDateString(S.lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const evDate = e => new Date(/T/.test(e.date) ? e.date : e.date + 'T00:00:00+05:30');
  const ist = (d, o) => d.toLocaleDateString('en-IN', { ...o, timeZone: 'Asia/Kolkata' });
  const iso = d => { const x = new Date(d); return isNaN(x) ? '' : x.toISOString(); };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  /* ---------- state ---------- */
  const defaults = () => ({
    lang: 'en', profile: { name: '', phone: '', email: '', category: 'UR', gender: '', state: '', optIn: {} },
    leadAsked: false, dream: [], customEvents: [], cart: [], promo: '', notified: {}, notify: false,
    marks: [], scores: {}, merit: '', myAllotments: [], compare: []
  });
  let S = load();
  function load() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return defaults(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private window: keep working in memory */ } }

  /* ---------- data ---------- */
  const D = { universities: null, cutoffs: null, events: null, allotments: null, rules: null };
  const FILES = { universities: 'universities.json', cutoffs: 'cutoffs.json', events: 'events.json', allotments: 'allotments.json', rules: 'subject-rules.json' };
  async function loadData() {
    await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
      try { const r = await fetch('data/' + f, { cache: 'no-cache' }); D[k] = r.ok ? await r.json() : null; } catch { D[k] = null; }
    }));
  }
  const unis = () => (D.universities && D.universities.universities) || [];
  const cutRows = () => (D.cutoffs && D.cutoffs.rows) || [];
  const uniById = id => unis().find(u => u.id === id);

  /* ---------- Hindi ---------- */
  const HI = {
    'Home': 'होम', 'Colleges': 'कॉलेज', 'Predictor': 'प्रेडिक्टर', 'Dream List': 'ड्रीम लिस्ट', 'Calendar': 'कैलेंडर', 'Applications': 'आवेदन', 'Tools': 'टूल्स', 'Resources': 'संसाधन', 'Seniors': 'सीनियर्स', 'Community': 'कम्युनिटी', 'Pricing': 'प्राइसिंग',
    'Admission assistant': 'एडमिशन असिस्टेंट', 'Add to Dream List': 'ड्रीम लिस्ट में जोड़ें', 'On your Dream List': 'आपकी ड्रीम लिस्ट में है', 'Details': 'विवरण', 'Compare': 'तुलना करें', 'Apply directly': 'सीधे आवेदन करें', 'Fill via Assistant': 'असिस्टेंट से भरवाएँ',
    'Talk to a senior': 'सीनियर से बात करें', 'Search universities': 'यूनिवर्सिटी खोजें', 'All states': 'सभी राज्य', 'All': 'सभी', 'Dream': 'ड्रीम', 'Target': 'टारगेट', 'Safe': 'सेफ', 'Not eligible': 'पात्र नहीं',
    'Get free deadline alerts': 'मुफ़्त डेडलाइन अलर्ट पाएँ', 'Predict my colleges': 'मेरे कॉलेज बताएँ', 'Find colleges': 'कॉलेज खोजें', 'Next deadlines': 'अगली डेडलाइन', 'days': 'दिन', 'hrs': 'घंटे', 'min': 'मिनट', 'sec': 'सेकंड',
    'Save': 'सेव करें', 'Cancel': 'रद्द करें', 'Remove': 'हटाएँ', 'Share on WhatsApp': 'WhatsApp पर शेयर करें', 'Parent view link': 'पैरेंट व्यू लिंक', 'Print preference sheet': 'प्रेफ़रेंस शीट प्रिंट करें', 'Copy as text': 'टेक्स्ट कॉपी करें',
    'Your category': 'आपकी कैटेगरी', 'Home state': 'गृह राज्य', 'Gender': 'लिंग', 'Your CUET subjects and scores': 'आपके CUET विषय और स्कोर', 'Show colleges': 'कॉलेज दिखाएँ', 'Marks calculator': 'मार्क्स कैलकुलेटर', 'Subject combination checker': 'विषय संयोजन जाँच',
    'Same course at other universities': 'दूसरी यूनिवर्सिटी में यही कोर्स', 'Free · No login': 'मुफ़्त · लॉगिन नहीं', 'Cart': 'कार्ट', 'Checkout': 'चेकआउट', 'Add to cart': 'कार्ट में जोड़ें', 'Total': 'कुल',
    'Document checklist': 'दस्तावेज़ सूची', 'Status': 'स्थिति', 'Deadline': 'अंतिम तिथि', 'Upcoming': 'आने वाले', 'Only my list': 'सिर्फ़ मेरी लिस्ट', 'Download calendar (.ics)': 'कैलेंडर डाउनलोड करें (.ics)', 'Add to Google Calendar': 'Google Calendar में जोड़ें', 'Turn on browser reminders': 'ब्राउज़र रिमाइंडर चालू करें',
    'Add your own deadline': 'अपनी डेडलाइन जोड़ें', 'Expected': 'अनुमानित', 'Official': 'आधिकारिक', 'Last year': 'पिछला साल', 'Source': 'स्रोत', 'Ask': 'पूछें', 'Send': 'भेजें', 'Name': 'नाम', 'Phone': 'फ़ोन', 'Email': 'ईमेल',
    'Predict → shortlist → reminders → apply → track': 'प्रेडिक्ट → शॉर्टलिस्ट → रिमाइंडर → आवेदन → ट्रैक'
  };
  const t = s => (S.lang === 'hi' && HI[s]) || s;

  /* ---------- UI primitives ---------- */
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200);
  }
  const modal = {
    open(html, onMount) { $('#modalBody').innerHTML = html; const d = $('#modal'); if (!d.open) d.showModal(); onMount && onMount($('#modalBody')); },
    close() { const d = $('#modal'); if (d.open) d.close(); }
  };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-act="modal-close"]')) modal.close(); });

  function countdown(iso, big) {
    return big ? `<div class="cd" data-cd="${esc(iso)}" data-big="1"></div>` : `<span class="cd-inline" data-cd="${esc(iso)}"></span>`;
  }
  function tick() {
    const now = Date.now();
    $$('[data-cd]').forEach(el => {
      const ms = new Date(el.dataset.cd) - now;
      if (isNaN(ms)) { el.textContent = ''; return; }
      const done = ms <= 0, a = Math.abs(ms);
      const d = Math.floor(a / 864e5), h = Math.floor(a / 36e5) % 24, m = Math.floor(a / 6e4) % 60, s = Math.floor(a / 1e3) % 60;
      const p = n => String(n).padStart(2, '0');
      if (el.dataset.big) {
        el.classList.toggle('done', done);
        el.innerHTML = done ? `<span>${t('Closed')}</span>` : [[d, 'days'], [p(h), 'hrs'], [p(m), 'min'], [p(s), 'sec']].map(([v, l]) => `<span>${v}<small>${t(l)}</small></span>`).join('');
      } else {
        el.textContent = done ? '⏱ ' + t('Closed') : `⏱ ${d}d ${p(h)}h ${p(m)}m ${p(s)}s`;
      }
    });
  }
  setInterval(tick, 1000);

  /* Sends a sign-up, order or request to the team: form endpoint first, else a prefilled WhatsApp message. */
  async function submit(kind, payload, waText) {
    let sent = false;
    if (C.formEndpoint) {
      try {
        const r = await fetch(C.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ kind, ...payload, at: new Date().toISOString() }) });
        sent = r.ok;
      } catch { sent = false; }
    }
    if (C.whatsapp && waText) { window.open(`https://wa.me/${C.whatsapp}?text=${encodeURIComponent(waText)}`, '_blank', 'noopener'); sent = true; }
    toast(sent ? 'Sent to the Everything CUET team ✓' : 'Saved on this device. Online booking opens soon.');
    return sent;
  }
  const waShare = text => `https://wa.me/?text=${encodeURIComponent(text)}`;

  /* Phone/email is asked only when a student saves a list or turns on reminders, never before results. */
  function askLead(reason, after) {
    const p = S.profile;
    modal.open(`
      <h2>${esc(reason)}</h2>
      <p class="muted">Your list stays saved on this device either way. Leave your number to get WhatsApp, SMS and email reminders for the colleges on it.</p>
      <form id="leadForm" class="stack">
        <div class="form-grid">
          <label>${t('Name')}<input name="name" value="${esc(p.name)}" autocomplete="name"></label>
          <label>${t('Phone')}<input name="phone" value="${esc(p.phone)}" inputmode="tel" autocomplete="tel" pattern="[0-9+ ]{10,15}" placeholder="10-digit mobile"></label>
        </div>
        <label>${t('Email')}<input name="email" type="email" value="${esc(p.email)}" autocomplete="email"></label>
        <div class="chips">
          <label class="check"><input type="checkbox" name="wa" ${p.optIn.wa !== false ? 'checked' : ''}>WhatsApp</label>
          <label class="check"><input type="checkbox" name="sms" ${p.optIn.sms ? 'checked' : ''}>SMS</label>
          <label class="check"><input type="checkbox" name="mail" ${p.optIn.mail !== false ? 'checked' : ''}>Email</label>
        </div>
        <small>Reminders go out 7 days, 48 hours and on the day of each deadline. No spam, no selling your number.</small>
        <div class="row"><button class="btn pri" type="submit">${t('Save')}</button><button class="btn ghost" type="button" data-act="modal-close">Not now</button></div>
      </form>`, el => {
      $('#leadForm', el).addEventListener('submit', async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        Object.assign(S.profile, { name: f.get('name').trim(), phone: f.get('phone').trim(), email: f.get('email').trim(), optIn: { wa: !!f.get('wa'), sms: !!f.get('sms'), mail: !!f.get('mail') } });
        S.leadAsked = true; save(); modal.close();
        if (S.profile.phone || S.profile.email) {
          await submit('alerts', { profile: S.profile, dreamList: S.dream.map(d => `${d.uni} – ${d.course || ''}`) },
            `Hi Everything CUET, please send me deadline alerts.\nName: ${S.profile.name}\nPhone: ${S.profile.phone}\nEmail: ${S.profile.email}\nMy list: ${S.dream.map(d => d.uni).join(', ') || '—'}`);
        }
        after && after();
      });
    });
    S.leadAsked = true; save();
  }

  /* ---------- router ---------- */
  const NAV = [['', 'Home'], ['colleges', 'Colleges'], ['predictor', 'Predictor'], ['dream', 'Dream List'], ['calendar', 'Calendar'], ['applications', 'Applications'], ['tools', 'Tools'], ['resources', 'Resources'], ['seniors', 'Seniors'], ['community', 'Community'], ['pricing', 'Pricing']];
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    return { route: parts[0] || '', arg: parts.slice(1).join('/'), q: new URLSearchParams(qs || '') };
  }
  const ROUTES = {};
  function render() {
    const { route, arg, q } = parseHash();
    document.documentElement.lang = S.lang;
    $('#nav').innerHTML = NAV.map(([r, l]) => `<a href="#/${r}" ${r === route ? 'aria-current="page"' : ''}>${t(l)}</a>`).join('');
    $('#nav').classList.remove('open');
    $('#langBtn').textContent = S.lang === 'hi' ? 'English' : 'हिंदी';
    $('[data-t="bot.title"]').textContent = t('Admission assistant');
    const fn = ROUTES[route] || ROUTES[''];
    // A fresh element each time, so a page's listeners never pile up on re-render.
    const old = $('#view'), view = old.cloneNode(false);
    old.replaceWith(view);
    view.innerHTML = fn(arg, q) || '';
    const mount = ROUTES[route + ':mount'];
    mount && mount(arg, q);
    document.title = (route ? t((NAV.find(n => n[0] === route) || [, ''])[1]) + ' · ' : '') + 'Everything CUET';
    renderFoot(); updateCart(); tick();
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ---------- shared bits ---------- */
  function upcomingEvents(onlyMine) {
    const now = Date.now();
    const evs = [];
    ((D.events && D.events.events) || []).forEach(e => evs.push({ ...e, kind: 'master' }));
    S.customEvents.forEach(e => evs.push({ ...e, kind: 'custom', status: 'yours' }));
    S.dream.filter(d => d.deadline).forEach(d => evs.push({ id: 'dl-' + d.id, title: `${d.uni}${d.course ? ' – ' + d.course : ''}: application deadline`, group: d.uni, date: d.deadline, status: 'yours', kind: 'dream', dreamId: d.id, source: d.portal }));
    const mine = new Set(S.dream.map(d => norm(d.uni)));
    return evs
      .filter(e => !onlyMine || e.kind !== 'master' || e.group === 'NTA' || mine.has(norm(e.group)))
      .map(e => ({ ...e, when: evDate(e) }))
      .sort((a, b) => a.when - b.when)
      .map(e => ({ ...e, past: (e.end ? new Date(e.end + 'T23:59:59+05:30') : e.when) < now }));
  }
  const statusTag = s => ({ official: `<span class="tag safe">${t('Official')}</span>`, expected: `<span class="tag sun">${t('Expected')}</span>`, past: `<span class="tag">${t('Last year')}</span>`, yours: `<span class="tag dream">Yours</span>` }[s] || '');
  function inDream(uniName) { return S.dream.some(d => norm(d.uni) === norm(uniName)); }

  function addToDream(prefill) {
    const p = Object.assign({ col: 'target' }, prefill);
    modal.open(`
      <h2>${t('Add to Dream List')}</h2>
      <form id="dreamForm" class="stack">
        <label>University<input name="uni" required value="${esc(p.uni || '')}" list="uniList" placeholder="Start typing a university"></label>
        <datalist id="uniList">${unis().slice(0, 2000).map(u => `<option value="${esc(u.name)}">`).join('')}</datalist>
        <div class="form-grid">
          <label>College / department<input name="college" value="${esc(p.college || '')}"></label>
          <label>Course<input name="course" value="${esc(p.course || '')}" placeholder="e.g. B.Com (Hons.)"></label>
        </div>
        <div class="form-grid">
          <label>Column<select name="col">${COLS.map(([k, l]) => `<option value="${k}" ${p.col === k ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>
          <label>${t('Deadline')}<input name="deadline" type="datetime-local" value="${esc(p.deadline || '')}"></label>
        </div>
        <div class="form-grid">
          <label>Last-year cutoff<input name="cutoff" inputmode="decimal" value="${esc(p.cutoff ?? '')}"></label>
          <label>Annual fee (₹)<input name="fees" inputmode="numeric" value="${esc(p.fees ?? '')}"></label>
          <label>Hostel<select name="hostel"><option value="">Not sure</option><option value="yes" ${p.hostel === true || p.hostel === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${p.hostel === false || p.hostel === 'no' ? 'selected' : ''}>No</option></select></label>
        </div>
        <label>Application portal link<input name="portal" type="url" value="${esc(p.portal || '')}" placeholder="https://"></label>
        <div class="row"><button class="btn pri" type="submit">${t('Save')}</button><button class="btn ghost" type="button" data-act="modal-close">${t('Cancel')}</button></div>
      </form>`, el => {
      $('#dreamForm', el).addEventListener('submit', e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const u = unis().find(x => norm(x.name) === norm(f.uni));
        S.dream.push({
          id: uid(), uniId: u ? u.id : (p.uniId || ''), uni: f.uni.trim(), college: f.college.trim(), course: f.course.trim(), col: f.col,
          deadline: f.deadline, cutoff: num(f.cutoff), predicted: p.predicted ?? null, gap: p.gap ?? null, eligible: p.eligible ?? null,
          fees: num(f.fees), hostel: f.hostel === 'yes' ? true : f.hostel === 'no' ? false : null, portal: f.portal, status: 0, docs: {}, notes: '', added: Date.now()
        });
        save(); modal.close(); toast('Added to your Dream List ✓'); render();
        if (!S.leadAsked) setTimeout(() => askLead('Save your list and get reminders?'), 400);
      });
    });
  }

  function addCart(item) {
    if (item.type === 'form' && S.cart.some(c => c.type === 'form' && c.label === item.label)) { toast('Already in your cart'); return; }
    if (item.type !== 'form' && S.cart.some(c => c.type === item.type)) { toast('Already in your cart'); return; }
    S.cart.push({ id: uid(), ...item }); save(); updateCart(); toast('Added to cart ✓');
  }
  function cartTotals() {
    const forms = S.cart.filter(c => c.type === 'form');
    const sub = S.cart.reduce((s, c) => s + c.price, 0);
    const bundle = forms.length >= P.bundleMinForms ? Math.round(forms.reduce((s, c) => s + c.price, 0) * P.bundleDiscount) : 0;
    return { sub, bundle, total: sub - bundle, forms: forms.length };
  }
  function updateCart() {
    $('#cartFab').hidden = !S.cart.length;
    $('#cartCount').textContent = S.cart.length;
  }

  /* ---------- predictor engine ---------- */
  function userScoreFor(row) {
    if (row.scoreType === 'subject') {
      const opts = (row.subjects || []).flat();
      const vals = opts.map(s => num(S.scores[s])).filter(v => v != null);
      return vals.length ? Math.max(...vals) : null;
    }
    return num(S.merit) ?? meritAuto();
  }
  function meritAuto() {
    const vals = Object.values(S.scores).map(num).filter(v => v != null).sort((a, b) => b - a).slice(0, 4);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }
  function eligibleFor(row) {
    if (!row.subjects || !row.subjects.length) return null;
    const mine = new Set(Object.keys(S.scores).filter(k => num(S.scores[k]) != null).map(norm));
    return row.subjects.every(any => any.some(s => mine.has(norm(s))));
  }
  function tierOf(gap, type) {
    const th = TIER[type === 'subject' ? 'subject' : 'merit'];
    if (gap >= th.safe) return 'safe';
    if (gap >= 0) return 'target';
    if (gap >= -th.dream) return 'dream';
    return null;
  }
  function predict(opts) {
    const rows = cutRows().filter(r => (r.category || 'UR') === opts.category
      && (!opts.uni || norm(r.university) === norm(opts.uni))
      && (!opts.program || norm(r.program).includes(norm(opts.program))));
    if (!rows.length) return { groups: [], out: 0, total: 0 };
    const latest = Math.max(...rows.map(r => +r.year || 0));
    const byKey = new Map();
    rows.filter(r => (+r.year || 0) === latest).forEach(r => {
      const k = [r.university, r.college, r.program].join('|');
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(r);
    });
    const groups = [];
    let out = 0;
    byKey.forEach(rs => {
      rs.sort((a, b) => (+a.round || 0) - (+b.round || 0));
      const pick = opts.round ? rs.filter(r => String(r.round) === String(opts.round)) : rs;
      if (!pick.length) return;
      const base = pick[pick.length - 1];
      const score = userScoreFor(base);
      if (score == null) return;
      const elig = eligibleFor(base);
      const rounds = rs.map(r => ({ round: r.round, cutoff: +r.cutoff, tier: tierOf(score - r.cutoff, r.scoreType) }));
      const gap = +(score - base.cutoff).toFixed(2);
      const tier = elig === false ? 'bad' : tierOf(gap, base.scoreType);
      if (!tier) { out++; return; }
      groups.push({ ...base, score, gap, tier, eligible: elig, rounds });
    });
    groups.sort((a, b) => b.cutoff - a.cutoff);
    return { groups, out, total: byKey.size, year: latest };
  }
  function roundAdvice(g) {
    if (g.rounds.length < 2) return '';
    const first = g.rounds.findIndex(r => r.tier === 'target' || r.tier === 'safe');
    if (first === 0) return 'Strong from Round 1.';
    if (first > 0) return `Round ${g.rounds[0].round} unlikely; good chance from Round ${g.rounds[first].round}.`;
    return 'Ambitious in every round last year — keep safer options below it.';
  }

  /* ---------- pages ---------- */
  ROUTES[''] = () => {
    const evs = upcomingEvents(false).filter(e => !e.past).slice(0, 3);
    const n = unis().length;
    const counts = (D.universities && D.universities.counts) || {};
    return `
    <section class="hero"><div class="wrap hero-in">
      <div>
        <div class="eyebrow">${t('Free · No login')}</div>
        <h1>Everything you need for <span>CUET admissions</span>, in one place.</h1>
        <p class="lead">Predict your colleges, build a Dream List, get a reminder before every deadline, make your CSAS preference order and get forms filled by our team when you want help.</p>
        <div class="badges"><span>🎯 College predictor</span><span>🏛️ NTA university list</span><span>⏰ Deadline reminders</span><span>📝 ₹${P.assistedForm} assisted filling</span><span>🇮🇳 Hindi + English</span></div>
        <div class="row"><a class="btn pri" href="#/predictor">${t('Predict my colleges')}</a><a class="btn" href="#/colleges">${t('Find colleges')}</a></div>
      </div>
      <form class="card quick" id="heroSearch">
        <h3>${t('Search universities')}</h3>
        <label>University or state<input name="q" placeholder="e.g. Delhi, Banaras, Jamia"></label>
        <label style="margin-top:12px">Type<select name="cat"><option value="">${t('All')}</option>${CATS.map(c => `<option>${c}</option>`).join('')}</select></label>
        <button class="btn pri block" style="margin-top:14px" type="submit">${t('Find colleges')}</button>
        <p class="muted" style="margin:10px 0 0;font-size:.82rem">${n ? `${n} universities from NTA's CUET (UG) ${esc(D.universities.cycle)} list.` : 'University list comes from NTA\'s official participating-universities page.'}</p>
      </form>
    </div></section>

    <section class="section"><div class="wrap">
      <div class="row between"><h2>${t('Next deadlines')}</h2><a href="#/calendar">Full calendar →</a></div>
      ${evs.length ? `<div class="grid g3">${evs.map(e => `
        <div class="card cd-card">
          <div class="row between"><b>${esc(e.title)}</b>${statusTag(e.status)}</div>
          <small>${fmtDate(e.when)} · ${esc(e.group || '')}</small>
          ${countdown(e.when.toISOString(), true)}
          ${e.note ? `<small>${esc(e.note)}</small>` : ''}
        </div>`).join('')}</div>` : `<div class="empty"><b>No upcoming dates yet</b>Add colleges to your Dream List and their deadlines show here.</div>`}
    </div></section>

    <section class="section"><div class="wrap">
      <h2>${t('Predict → shortlist → reminders → apply → track')}</h2>
      <div class="loop">
        <div>${t('Predictor')}<small>Your score, category and subjects → Dream / Target / Safe</small></div>
        <div>${t('Dream List')}<small>One board for every college you want</small></div>
        <div>Reminders<small>7 days, 48 hours and on the day</small></div>
        <div>Apply<small>Yourself, or our team fills it for ₹${P.assistedForm}</small></div>
        <div>Track<small>Status, documents and allotment rounds</small></div>
      </div>
    </div></section>

    <section class="section"><div class="wrap">
      <h2>Free tools</h2>
      <div class="grid g4">
        ${[['predictor', '🎯', 'College predictor', 'DU, BHU, JMI and more. Subject eligibility check and round-wise chances.'],
           ['colleges', '🏛️', 'NTA participating universities', `Every university on NTA's CUET (UG) list${n ? ` — ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}` : ''}.`],
           ['dream', '⭐', 'Dream List + CSAS order', 'Drag colleges into Dream / Target / Safe and print your preference order.'],
           ['calendar', '⏰', 'Deadline calendar', 'Every NTA and university date with live countdowns and reminders.'],
           ['tools/marks', '🧮', t('Marks calculator'), 'Count your score from the answer key: +5 right, −1 wrong.'],
           ['tools/subjects', '✅', t('Subject combination checker'), 'Which CUET subjects does your course need?'],
           ['applications', '📋', 'Application tracker', 'Status for each university and a document checklist.'],
           ['community', '👥', 'Allotment-day tracker', 'See what others got, round by round.']]
          .map(([r, i, h, p]) => `<a class="card tool" href="#/${r}"><span class="ico">${i}</span><h3>${h}</h3><p>${p}</p></a>`).join('')}
      </div>
    </div></section>

    <section class="section"><div class="wrap grid g2">
      <div class="card">
        <div class="eyebrow">Help when you want it</div>
        <h2>Our team fills your forms</h2>
        <p>CUET registration, DU CSAS, BHU, JMI and private-university forms — filled with you, checked twice, before the deadline. ₹${P.assistedForm} a form, ${Math.round(P.bundleDiscount * 100)}% off for ${P.bundleMinForms} or more.</p>
        <div class="row"><a class="btn sun" href="#/pricing">See plans</a><a class="btn" href="#/seniors">${t('Talk to a senior')}</a></div>
      </div>
      <form class="card" id="alertForm">
        <div class="eyebrow">Never miss a deadline</div>
        <h2>${t('Get free deadline alerts')}</h2>
        <div class="form-grid"><label>${t('Name')}<input name="name" value="${esc(S.profile.name)}"></label><label>${t('Phone')}<input name="phone" inputmode="tel" value="${esc(S.profile.phone)}"></label></div>
        <label style="margin-top:12px">${t('Email')}<input name="email" type="email" value="${esc(S.profile.email)}"></label>
        <button class="btn pri" style="margin-top:14px" type="submit">${t('Get free deadline alerts')}</button>
      </form>
    </div></section>

    <section class="section"><div class="wrap">
      <h2>Questions students ask</h2>
      <div class="grid g2">
        ${[['Is it really free?', 'The predictor, university list, Dream List, calendar, calculators and email reminders are free with no login. You pay only if you want our team to fill forms or counsel you.'],
           ['Where does the university list come from?', `From the National Testing Agency's official CUET (UG) participating-universities page (<a href="${NTA_UNIS}" target="_blank" rel="noopener">cuet.nta.nic.in</a>). We don't add or remove universities.`],
           ['Are you part of NTA?', 'No. Everything CUET is an independent student service. Always confirm dates and rules on NTA\'s and each university\'s own website.'],
           ['Where is my Dream List saved?', 'In this browser. Use "Parent view link" to share it, and leave your number if you want reminders on WhatsApp or SMS.']]
          .map(([q, a]) => `<div class="card flat"><h3>${q}</h3><p class="muted" style="margin:0">${a}</p></div>`).join('')}
      </div>
    </div></section>`;
  };
  ROUTES[':mount'] = () => {
    $('#heroSearch').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const q = new URLSearchParams(); if (f.get('q')) q.set('q', f.get('q')); if (f.get('cat')) q.set('cat', f.get('cat'));
      location.hash = '#/colleges?' + q;
    });
    $('#alertForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      Object.assign(S.profile, { name: f.get('name').trim(), phone: f.get('phone').trim(), email: f.get('email').trim() });
      S.leadAsked = true; save();
      if (!S.profile.phone && !S.profile.email) { toast('Add a phone number or email'); return; }
      await submit('alerts', { profile: S.profile }, `Hi Everything CUET, please send me free deadline alerts.\nName: ${S.profile.name}\nPhone: ${S.profile.phone}\nEmail: ${S.profile.email}`);
    });
  };

  /* Colleges: NTA participating universities */
  function ntaPending() {
    return `<div class="notice"><b>The university list is imported from NTA.</b> Everything CUET lists exactly the universities on the National Testing Agency's
      <a href="${NTA_UNIS}" target="_blank" rel="noopener">CUET (UG) participating universities</a> page. The import hasn't run yet, so the list is empty —
      open NTA's page for now. <small>(Site owner: run the "CUET NTA universities import" GitHub Action.)</small></div>`;
  }
  ROUTES.colleges = (arg, q) => {
    const counts = {};
    unis().forEach(u => { counts[u.category] = (counts[u.category] || 0) + 1; });
    const states = [...new Set(unis().map(u => u.state).filter(Boolean))].sort();
    const cat = q.get('cat') || '';
    return `<div class="page"><div class="wrap">
      <div class="page-head">
        <div class="eyebrow">Source: NTA</div>
        <h1>CUET (UG) participating universities</h1>
        <p>Every university, as listed by the National Testing Agency. ${D.universities && D.universities.importedAt ? `CUET (UG) ${esc(D.universities.cycle)} list, updated ${fmtDate(D.universities.importedAt)} from <a href="${esc(D.universities.source)}" target="_blank" rel="noopener">cuet.nta.nic.in</a>.` : ''}</p>
      </div>
      ${unis().length ? '' : ntaPending()}
      <div class="card flat no-print" style="margin:18px 0">
        <div class="form-grid">
          <label>${t('Search universities')}<input id="uq" value="${esc(q.get('q') || '')}" placeholder="Name or state"></label>
          <label>State<select id="ust"><option value="">${t('All states')}</option>${states.map(s => `<option ${q.get('state') === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        </div>
        <div class="chips" style="margin-top:12px" id="ucat">
          <button class="chip ${!cat ? 'on' : ''}" data-cat="">${t('All')} ${unis().length ? `(${unis().length})` : ''}</button>
          ${CATS.map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-cat="${c}">${c}${counts[c] ? ` (${counts[c]})` : ''}</button>`).join('')}
        </div>
      </div>
      <div class="row between no-print" id="cmpBar" style="margin-bottom:12px"></div>
      <div class="grid g3" id="ulist"></div>
      <div class="pager" id="upager"></div>
    </div></div>`;
  };
  ROUTES['colleges:mount'] = (arg, q) => {
    let cat = q.get('cat') || '', page = 0;
    const draw = () => {
      const term = norm($('#uq').value), st = $('#ust').value;
      const list = unis().filter(u => (!cat || u.category === cat) && (!st || u.state === st) && (!term || norm(u.name + ' ' + u.state).includes(term)));
      const per = 24, pages = Math.max(1, Math.ceil(list.length / per));
      page = Math.min(page, pages - 1);
      $('#ulist').innerHTML = list.slice(page * per, page * per + per).map(u => `
        <article class="card uni">
          <div class="meta"><span class="tag">${esc(u.category)}</span>${u.state ? `<span>📍 ${esc(u.state)}</span>` : ''}</div>
          <h3><a href="#/college/${esc(u.id)}" style="color:inherit;text-decoration:none">${esc(u.name)}</a></h3>
          <div class="acts">
            ${inDream(u.name) ? `<span class="tag safe">★ ${t('On your Dream List')}</span>` : `<button class="btn sm pri" data-dream="${esc(u.id)}">＋ ${t('Add to Dream List')}</button>`}
            <a class="btn sm" href="#/college/${esc(u.id)}">${t('Details')}</a>
            <label class="check" style="font-size:.8rem"><input type="checkbox" data-cmp="${esc(u.id)}" ${S.compare.includes(u.id) ? 'checked' : ''}>${t('Compare')}</label>
          </div>
        </article>`).join('') || (unis().length ? `<div class="empty" style="grid-column:1/-1"><b>No match</b>Try another name or state.</div>` : '');
      $('#upager').innerHTML = pages > 1 ? `<button class="btn sm" data-pg="-1" ${page ? '' : 'disabled'}>←</button><span>${page + 1} / ${pages} · ${list.length}</span><button class="btn sm" data-pg="1" ${page < pages - 1 ? '' : 'disabled'}>→</button>` : '';
      $('#cmpBar').innerHTML = S.compare.length ? `<span>${S.compare.length} selected to compare</span><a class="btn sm pri" href="#/tools/compare">${t('Compare')} →</a>` : '';
    };
    $('#uq').addEventListener('input', () => { page = 0; draw(); });
    $('#ust').addEventListener('change', () => { page = 0; draw(); });
    $('#ucat').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      cat = b.dataset.cat; page = 0;
      $$('#ucat .chip').forEach(c => c.classList.toggle('on', c === b)); draw();
    });
    $('#upager').addEventListener('click', e => { const b = e.target.closest('[data-pg]'); if (b) { page += +b.dataset.pg; draw(); window.scrollTo(0, 0); } });
    $('#ulist').addEventListener('click', e => {
      const b = e.target.closest('[data-dream]');
      if (b) { const u = uniById(b.dataset.dream); addToDream({ uni: u.name, uniId: u.id, portal: u.website }); }
    });
    $('#ulist').addEventListener('change', e => {
      const c = e.target.closest('[data-cmp]'); if (!c) return;
      const id = c.dataset.cmp;
      S.compare = c.checked ? [...new Set([...S.compare, id])].slice(-3) : S.compare.filter(x => x !== id);
      save(); draw();
    });
    draw();
  };

  ROUTES.college = id => {
    const u = uniById(id);
    if (!u) return `<div class="page"><div class="wrap"><div class="empty"><b>University not found</b><a href="#/colleges">Back to the list</a></div></div></div>`;
    const rows = cutRows().filter(r => norm(r.university) === norm(u.name));
    const programs = [...new Set(rows.map(r => `${r.college}|${r.program}`))];
    const promo = (C.partnerCodes || []).filter(p => norm(p.college) === norm(u.name));
    const group = (C.groups || []).find(g => norm(g.university) === norm(u.name));
    return `<div class="page"><div class="wrap">
      <a href="#/colleges">← ${t('Colleges')}</a>
      <div class="page-head" style="margin-top:12px">
        <div class="row"><span class="tag">${esc(u.category)} university</span>${u.state ? `<span class="tag sun">📍 ${esc(u.state)}</span>` : ''}</div>
        <h1 style="margin-top:10px">${esc(u.name)}</h1>
        <p class="muted">Listed on NTA's CUET (UG) participating universities — <a href="${esc(u.source)}" target="_blank" rel="noopener">${t('Source')}</a>. Programs, seats and eligibility are on the university's own admission page.</p>
        <div class="row">
          ${inDream(u.name) ? `<a class="btn" href="#/dream">★ ${t('On your Dream List')}</a>` : `<button class="btn pri" data-act="dream-add">＋ ${t('Add to Dream List')}</button>`}
          ${u.website ? `<a class="btn" href="${esc(u.website)}" target="_blank" rel="noopener">${t('Apply directly')} ↗</a>` : ''}
          <button class="btn sun" data-act="assist">${t('Fill via Assistant')} (${inr(P.assistedForm)})</button>
          <a class="btn" href="#/seniors?college=${encodeURIComponent(u.name)}">${t('Talk to a senior')}</a>
        </div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Programs and last cutoffs</h3>
          ${programs.length ? `<div class="table-wrap"><table><tr><th>College</th><th>Program</th><th>Category</th><th>Round</th><th>Cutoff</th></tr>
            ${rows.slice(0, 60).map(r => `<tr><td>${esc(r.college)}</td><td>${esc(r.program)}</td><td>${esc(r.category)}</td><td>${esc(r.round)}</td><td class="num">${esc(r.cutoff)}</td></tr>`).join('')}</table></div>`
            : `<p class="muted">No cutoff data for this university yet. We add round-wise closing scores from official allotment lists only.</p>`}
        </div>
        <div class="stack">
          ${promo.map(p => `<div class="card"><div class="eyebrow">Partner offer</div><h3>${esc(p.saving)}</h3><p>Code <b style="font-family:var(--mono)">${esc(p.code)}</b> <button class="btn sm" data-copy="${esc(p.code)}">Copy</button></p>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Apply with the code ↗</a>` : ''}</div>`).join('')}
          <div class="card"><h3>Student group</h3>${group ? `<a class="btn pri" href="${esc(group.link)}" target="_blank" rel="noopener">Join the ${esc(u.name)} group</a>` : `<p class="muted">No group yet for this university.</p><a class="btn" href="#/community?college=${encodeURIComponent(u.name)}">Ask for one</a>`}</div>
          ${(C.youtubeVideos || []).length ? `<div class="card"><h3>Watch on Everything CUET</h3><iframe style="width:100%;aspect-ratio:16/9;border:0;border-radius:10px" src="https://www.youtube-nocookie.com/embed/${esc(C.youtubeVideos[0])}" title="Everything CUET video" allowfullscreen loading="lazy"></iframe></div>` : ''}
        </div>
      </div>
    </div></div>`;
  };
  ROUTES['college:mount'] = id => {
    const u = uniById(id); if (!u) return;
    $('#view').addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'dream-add') addToDream({ uni: u.name, uniId: u.id, portal: u.website });
      if (a && a.dataset.act === 'assist') addCart({ type: 'form', label: `${u.name} application form`, price: P.assistedForm });
      const c = e.target.closest('[data-copy]');
      if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy); toast('Code copied'); }
    });
  };

  /* Predictor */
  function scoreInputs() {
    const chosen = Object.keys(S.scores);
    return `<div id="scoreRows" class="stack">${chosen.map(s => `
      <div class="row" style="flex-wrap:nowrap"><span style="flex:1;font-weight:600;font-size:.9rem">${esc(s)}</span>
      <input style="width:110px;margin:0" inputmode="decimal" data-score="${esc(s)}" value="${esc(S.scores[s])}" placeholder="out of 250">
      <button class="icon-btn" type="button" data-unscore="${esc(s)}" aria-label="Remove ${esc(s)}">✕</button></div>`).join('')}</div>
      <div class="row" style="margin-top:10px"><input list="subjList" id="addSubj" placeholder="Add a subject" style="flex:1;margin:0"><button class="btn sm" type="button" id="addSubjBtn">＋</button></div>
      <datalist id="subjList">${SUBJECTS.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
  }
  ROUTES.predictor = (arg, q) => {
    const p = S.profile;
    const uniOpts = [...new Set(cutRows().map(r => r.university))].sort();
    return `<div class="page"><div class="wrap">
      <div class="page-head">
        <div class="eyebrow">${t('Free · No login')}</div>
        <h1>CUET college predictor</h1>
        <p>Enter your normalised CUET scores, category and subjects. You get colleges grouped <b>Dream / Target / Safe</b>, the gap to last year's closing score, round-wise chances, and a <b>Not eligible</b> flag when your subjects don't match the course.</p>
      </div>
      <div class="side-layout">
        <form class="card sticky" id="predForm">
          <h3>${t('Your CUET subjects and scores')}</h3>
          ${scoreInputs()}
          <label style="margin-top:14px">Merit score for DU-style courses (out of 1000)<input id="merit" inputmode="decimal" value="${esc(S.merit)}" placeholder="Auto: your best 4 subjects"></label>
          <div class="form-grid" style="margin-top:12px">
            <label>${t('Your category')}<select id="pcat">${RES_CATS.map(c => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label>${t('Gender')}<select id="pgen"><option value="">—</option>${['Female', 'Male', 'Other'].map(g => `<option ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
          </div>
          <label style="margin-top:12px">${t('Home state')}<input id="pstate" value="${esc(p.state)}" placeholder="e.g. Uttar Pradesh"></label>
          <label style="margin-top:12px">University<select id="puni"><option value="">${t('All')}</option>${uniOpts.map(u => `<option ${q.get('uni') === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
          <div class="form-grid" style="margin-top:12px">
            <label>Course<input id="pprog" value="${esc(q.get('program') || '')}" placeholder="e.g. Economics"></label>
            <label>Round<select id="pround"><option value="">${t('All')}</option>${[1, 2, 3, 4, 5].map(r => `<option>${r}</option>`).join('')}</select></label>
          </div>
          <button class="btn pri block" style="margin-top:16px" type="submit">${t('Show colleges')}</button>
          <p class="muted" style="font-size:.78rem;margin:10px 0 0">Safe: ${TIER.merit.safe}+ above the cutoff · Target: at or just above · Dream: up to ${TIER.merit.dream} below (on a 1000 scale; scaled for single-subject scores).</p>
        </form>
        <div id="predOut"></div>
      </div>
    </div></div>`;
  };
  ROUTES['predictor:mount'] = () => {
    const readForm = () => {
      $$('[data-score]').forEach(i => { S.scores[i.dataset.score] = i.value.trim(); });
      S.merit = $('#merit').value.trim();
      Object.assign(S.profile, { category: $('#pcat').value, gender: $('#pgen').value, state: $('#pstate').value.trim() });
      save();
    };
    const out = $('#predOut');
    const show = () => {
      readForm();
      out.onclick = e => { if (e.target.closest('[data-act="alerts"]')) { e.preventDefault(); askLead('Get an alert when the predictor goes live?'); } };
      if (!cutRows().length) {
        out.innerHTML = `<div class="notice info"><b>The predictor is being loaded with official cutoffs.</b> We only use round-wise closing scores from the universities' published allotment lists (DU CSAS, BHU, JMI, JNU, AMU, BBAU first) — no guessed numbers. Your scores are saved; come back soon, or <a href="#/predictor" data-act="alerts">get an alert when it goes live</a>.</div>
          <div class="card" style="margin-top:16px"><h3>While you wait</h3><ul class="ticks"><li><a href="#/tools/marks">Count your marks from the answer key</a></li><li><a href="#/colleges">Browse NTA's participating universities</a> and add them to your Dream List</li><li><a href="#/calendar">See the CUET calendar</a></li></ul></div>`;
        return;
      }
      const res = predict({ category: S.profile.category, uni: $('#puni').value, program: $('#pprog').value.trim(), round: $('#pround').value });
      const merit = num(S.merit) ?? meritAuto();
      if (!Object.keys(S.scores).length && merit == null) { out.innerHTML = `<div class="empty"><b>Add your scores</b>Add each CUET subject and its normalised score on the left.</div>`; return; }
      const by = { dream: [], target: [], safe: [], bad: [] };
      res.groups.forEach(g => by[g.tier].push(g));
      const lim = show.lim || {};
      const section = (k, label, cls) => {
        const list = by[k]; if (!list.length) return '';
        const n = lim[k] || 20;
        return `<h2 style="margin-top:22px">${t(label)} <span class="tag ${cls}">${list.length}</span></h2>
          <div class="table-wrap"><table><tr><th>College · course</th><th>Cutoff ${res.year}</th><th>You</th><th>Gap</th><th>Rounds</th><th></th></tr>
          ${list.slice(0, n).map((g, i) => `<tr>
            <td><b>${esc(g.college)}</b><br><small>${esc(g.program)} · ${esc(g.university)}</small>${g.fees ? `<br><small>${inr(g.fees)}/yr${g.hostel ? ' · hostel' : ''}</small>` : ''}${k === 'bad' ? `<br><small class="tag bad">Needs: ${esc((g.subjects || []).map(a => a.join(' or ')).join(' + '))}</small>` : ''}</td>
            <td class="num">${esc(g.cutoff)}</td><td class="num">${esc(g.score)}</td>
            <td class="num" style="color:var(--${g.gap >= 0 ? 'safe' : 'bad'})">${g.gap >= 0 ? '+' : ''}${g.gap}</td>
            <td>${g.rounds.map(r => `<span class="tag ${r.tier || 'bad'}" title="Round ${esc(r.round)} cutoff ${esc(r.cutoff)}">R${esc(r.round)}</span>`).join(' ')}<br><small>${roundAdvice(g)}</small></td>
            <td><div class="row" style="gap:4px">${k === 'bad' ? '' : `<button class="btn sm pri" data-add="${k}:${i}">＋ ${t('Dream List')}</button>`}
              <a class="btn sm" href="#/seniors?college=${encodeURIComponent(g.college)}">Ask a senior</a>
              <button class="btn sm" data-eq="${esc(g.program)}">Elsewhere</button></div></td></tr>`).join('')}
          </table></div>${list.length > n ? `<button class="btn sm" style="margin-top:8px" data-more="${k}">Show ${Math.min(20, list.length - n)} more</button>` : ''}`;
      };
      const share = `My CUET predictor result (Everything CUET): ${by.safe.length} Safe, ${by.target.length} Target, ${by.dream.length} Dream colleges. Try yours: ${location.href.split('#')[0]}#/predictor`;
      out.innerHTML = `
        <div class="grid g4">
          <div class="card stat"><b style="color:var(--dream)">${by.dream.length}</b><span>${t('Dream')}</span></div>
          <div class="card stat"><b style="color:var(--target)">${by.target.length}</b><span>${t('Target')}</span></div>
          <div class="card stat"><b style="color:var(--safe)">${by.safe.length}</b><span>${t('Safe')}</span></div>
          <div class="card stat"><b style="color:var(--bad)">${by.bad.length}</b><span>${t('Not eligible')} (subjects)</span></div>
        </div>
        <div class="row" style="margin-top:12px"><a class="btn sm" href="${waShare(share)}" target="_blank" rel="noopener">${t('Share on WhatsApp')}</a><span class="muted" style="font-size:.85rem">Merit score used: ${merit ?? '—'} · ${res.out} more courses are out of reach this year.</span></div>
        ${res.groups.length ? '' : `<div class="empty" style="margin-top:16px"><b>No courses in range</b>Try another course, university or round.</div>`}
        ${section('safe', 'Safe', 'safe')}${section('target', 'Target', 'target')}${section('dream', 'Dream', 'dream')}${section('bad', 'Not eligible', 'bad')}
        <p class="muted" style="font-size:.8rem;margin-top:16px">Based on official ${res.year} closing scores. Cutoffs move every year; use this to plan, not as a promise of a seat.</p>`;
      out.onclick = e => {
        const a = e.target.closest('[data-add]');
        if (a) {
          const [k, i] = a.dataset.add.split(':'); const g = by[k][+i];
          addToDream({ uni: g.university, college: g.college, course: g.program, col: k, cutoff: g.cutoff, gap: g.gap, eligible: g.eligible, fees: g.fees, hostel: g.hostel });
        }
        const m = e.target.closest('[data-more]');
        if (m) { show.lim = { ...lim, [m.dataset.more]: (lim[m.dataset.more] || 20) + 20 }; show(); }
        const q = e.target.closest('[data-eq]');
        if (q) location.hash = '#/tools/equivalent?program=' + encodeURIComponent(q.dataset.eq);
      };
    };
    const form = $('#predForm');
    form.addEventListener('submit', e => { e.preventDefault(); show.lim = {}; show(); });
    form.addEventListener('click', e => {
      const r = e.target.closest('[data-unscore]');
      if (r) { readForm(); delete S.scores[r.dataset.unscore]; save(); render(); }
      if (e.target.id === 'addSubjBtn') {
        const v = $('#addSubj').value.trim(); if (!v) return;
        readForm(); if (Object.keys(S.scores).length >= 6) { toast('CUET allows up to 5 subjects plus the General Test'); return; }
        S.scores[v] = S.scores[v] || ''; save(); render();
      }
    });
    show();
  };

  /* Dream List */
  function orderedDream() {
    const ci = Object.fromEntries(COLS.map(([k], i) => [k, i]));
    return [...S.dream].sort((a, b) => ci[a.col] - ci[b.col] || (a.order ?? a.added) - (b.order ?? b.added));
  }
  function dreamCard(d) {
    return `<div class="dcard" draggable="true" data-id="${d.id}">
      <h4>${esc(d.college || d.uni)}</h4>
      <div class="sub">${esc(d.course || 'Course not set')}${d.college ? ` · ${esc(d.uni)}` : ''}</div>
      <dl>
        ${d.cutoff != null ? `<dt>Last cutoff</dt><dd>${esc(d.cutoff)}</dd>` : ''}
        ${d.gap != null ? `<dt>Your gap</dt><dd style="color:var(--${d.gap >= 0 ? 'safe' : 'bad'})">${d.gap >= 0 ? '+' : ''}${esc(d.gap)}</dd>` : ''}
        ${d.eligible != null ? `<dt>Eligible</dt><dd>${d.eligible ? '✅ Subjects match' : '⚠️ Subject mismatch'}</dd>` : ''}
        ${d.fees != null ? `<dt>Fees</dt><dd>${inr(d.fees)}/yr</dd>` : ''}
        ${d.hostel != null ? `<dt>Hostel</dt><dd>${d.hostel ? 'Yes' : 'No'}</dd>` : ''}
        <dt>${t('Status')}</dt><dd>${esc(STATUSES[d.status || 0])}</dd>
      </dl>
      ${d.deadline ? `<div style="margin-bottom:8px">${countdown(iso(d.deadline))}</div>` : ''}
      <div class="acts">
        <button class="btn sm" data-mv="-1" aria-label="Move left">←</button><button class="btn sm" data-mv="1" aria-label="Move right">→</button>
        <button class="btn sm" data-up aria-label="Move up">↑</button>
        <button class="btn sm" data-edit>Edit</button>
        ${d.portal ? `<a class="btn sm" href="${esc(d.portal)}" target="_blank" rel="noopener">Apply ↗</a>` : ''}
        <button class="btn sm" data-assist>₹${P.assistedForm} fill</button>
        <button class="btn sm" data-del aria-label="${t('Remove')}">✕</button>
      </div></div>`;
  }
  ROUTES.dream = () => {
    const list = orderedDream();
    return `<div class="page"><div class="wrap">
      <div class="page-head row between">
        <div><h1>${t('Dream List')}</h1><p>Drag colleges between Dream, Target and Safe. Your CSAS preference order is built from this board: Dream first, Safe last, top to bottom.</p></div>
        <div class="row no-print"><button class="btn pri" data-act="add">＋ Add a college</button></div>
      </div>
      <div class="board no-print">${COLS.map(([k, l]) => {
        const items = list.filter(d => d.col === k);
        return `<section class="col" data-col="${k}"><div class="col-head"><h3>${t(l)}</h3><span class="tag ${k}">${items.length}</span></div>
          ${items.map(dreamCard).join('') || `<div class="empty" style="padding:18px">Drop colleges here</div>`}</section>`;
      }).join('')}</div>

      <div class="card no-print" style="margin-top:22px">
        <div class="row between"><h2 style="margin:0">CSAS preference order</h2>
          <div class="row"><label class="check"><input type="checkbox" id="fHostel">Hostel only</label><label class="row" style="gap:6px">Max fee ₹<input id="fFee" inputmode="numeric" style="width:110px;margin:0"></label></div></div>
        <ol id="prefList" style="margin:14px 0"></ol>
        <div class="row">
          <button class="btn pri" data-act="print">${t('Print preference sheet')}</button>
          <button class="btn" data-act="copy">${t('Copy as text')}</button>
          <a class="btn" id="waList" target="_blank" rel="noopener">${t('Share on WhatsApp')}</a>
          <button class="btn" data-act="parent">${t('Parent view link')}</button>
          <button class="btn sun" data-act="review">CSAS preference review (${inr(P.csasPro)} plan)</button>
        </div>
      </div>
      <div class="print-only"><h1>My CSAS preference order — Everything CUET</h1><p>${esc(S.profile.name)} · ${new Date().toLocaleDateString('en-IN')}</p><ol id="printList"></ol></div>
    </div></div>`;
  };
  ROUTES['dream:mount'] = () => {
    const prefs = () => {
      const hostel = $('#fHostel').checked, max = num($('#fFee').value);
      return orderedDream().filter(d => (!hostel || d.hostel !== false) && (max == null || d.fees == null || d.fees <= max));
    };
    const line = (d, i) => `${i + 1}. ${d.college || d.uni} — ${d.course || 'course not set'}${d.college ? ` (${d.uni})` : ''}`;
    const drawPrefs = () => {
      const p = prefs();
      $('#prefList').innerHTML = p.map(d => `<li><b>${esc(d.college || d.uni)}</b> — ${esc(d.course || 'course not set')} <span class="tag ${d.col}">${t(COLS.find(c => c[0] === d.col)[1])}</span></li>`).join('') || '<li class="muted">Add colleges to your board first.</li>';
      $('#printList').innerHTML = p.map(d => `<li>${esc(d.college || d.uni)} — ${esc(d.course || '')} ${d.college ? `(${esc(d.uni)})` : ''}</li>`).join('');
      $('#waList').href = waShare('My college preference order (Everything CUET):\n' + p.map(line).join('\n'));
    };
    $('#fHostel').addEventListener('change', drawPrefs);
    $('#fFee').addEventListener('input', drawPrefs);
    drawPrefs();

    const view = $('#view');
    view.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        if (a === 'add') addToDream({});
        if (a === 'print') window.print();
        if (a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(prefs().map(line).join('\n')); toast('Copied'); }
        if (a === 'review') { addCart({ type: 'csasPro', label: 'CSAS Pro (preference review + reminders + 5 forms)', price: P.csasPro }); }
        if (a === 'parent') {
          const data = S.dream.map(d => [d.uni, d.college, d.course, d.col, d.deadline, d.status || 0, d.fees]);
          const enc = btoa(unescape(encodeURIComponent(JSON.stringify({ n: S.profile.name, d: data }))));
          const url = `${location.href.split('#')[0]}#/parent?d=${encodeURIComponent(enc)}`;
          modal.open(`<h2>${t('Parent view link')}</h2><p class="muted">A read-only copy of your list, deadlines and status as of now. Share it again after you make changes.</p>
            <input readonly value="${esc(url)}" onclick="this.select()"><div class="row" style="margin-top:12px"><a class="btn pri" href="${waShare('Track my college applications here: ' + url)}" target="_blank" rel="noopener">${t('Share on WhatsApp')}</a><button class="btn" data-act="modal-close">Close</button></div>`);
        }
        return;
      }
      const card = e.target.closest('.dcard'); if (!card) return;
      const d = S.dream.find(x => x.id === card.dataset.id);
      const mv = e.target.closest('[data-mv]');
      if (mv) { const i = COLS.findIndex(c => c[0] === d.col) + +mv.dataset.mv; if (COLS[i]) { d.col = COLS[i][0]; d.order = Date.now(); } }
      else if (e.target.closest('[data-up]')) {
        const same = orderedDream().filter(x => x.col === d.col); const i = same.indexOf(d);
        if (i > 0) { same.forEach((x, j) => { x.order = j; }); d.order = i - 1; same[i - 1].order = i; }
      } else if (e.target.closest('[data-del]')) { if (!confirm(`Remove ${d.college || d.uni}?`)) return; S.dream = S.dream.filter(x => x !== d); }
      else if (e.target.closest('[data-assist]')) { addCart({ type: 'form', label: `${d.uni}${d.course ? ' – ' + d.course : ''} form`, price: P.assistedForm }); return; }
      else if (e.target.closest('[data-edit]')) { editDream(d); return; }
      else return;
      save(); render();
    });
    let dragId = null;
    view.addEventListener('dragstart', e => { const c = e.target.closest('.dcard'); if (c) { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; } });
    view.addEventListener('dragend', e => { const c = e.target.closest('.dcard'); if (c) c.classList.remove('dragging'); $$('.col').forEach(c => c.classList.remove('over')); });
    $$('.col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => {
        e.preventDefault();
        const d = S.dream.find(x => x.id === dragId); if (!d) return;
        const after = [...col.querySelectorAll('.dcard')].find(c => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
        const same = orderedDream().filter(x => x.col === col.dataset.col && x !== d);
        const at = after ? same.findIndex(x => x.id === after.dataset.id) : same.length;
        same.splice(at < 0 ? same.length : at, 0, d);
        d.col = col.dataset.col; same.forEach((x, j) => { x.order = j; });
        save(); render();
      });
    });
  };
  function editDream(d) {
    modal.open(`<h2>Edit ${esc(d.college || d.uni)}</h2>
      <form id="editForm" class="stack">
        <div class="form-grid"><label>College<input name="college" value="${esc(d.college)}"></label><label>Course<input name="course" value="${esc(d.course)}"></label></div>
        <div class="form-grid"><label>${t('Deadline')}<input name="deadline" type="datetime-local" value="${esc(d.deadline)}"></label><label>Last cutoff<input name="cutoff" value="${esc(d.cutoff ?? '')}"></label></div>
        <div class="form-grid"><label>Fees (₹/yr)<input name="fees" value="${esc(d.fees ?? '')}"></label><label>Hostel<select name="hostel"><option value="">Not sure</option><option value="yes" ${d.hostel === true ? 'selected' : ''}>Yes</option><option value="no" ${d.hostel === false ? 'selected' : ''}>No</option></select></label></div>
        <label>Portal link<input name="portal" type="url" value="${esc(d.portal)}"></label>
        <label>Notes<textarea name="notes" rows="3">${esc(d.notes)}</textarea></label>
        <div class="row"><button class="btn pri">${t('Save')}</button><button class="btn ghost" type="button" data-act="modal-close">${t('Cancel')}</button></div>
      </form>`, el => {
      $('#editForm', el).addEventListener('submit', e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        Object.assign(d, { college: f.college.trim(), course: f.course.trim(), deadline: f.deadline, cutoff: num(f.cutoff), fees: num(f.fees), hostel: f.hostel === 'yes' ? true : f.hostel === 'no' ? false : null, portal: f.portal, notes: f.notes });
        save(); modal.close(); render();
      });
    });
  }

  ROUTES.parent = (arg, q) => {
    let data;
    try { data = JSON.parse(decodeURIComponent(escape(atob(q.get('d') || '')))); } catch { data = null; }
    if (!data) return `<div class="page"><div class="wrap"><div class="empty"><b>This link is incomplete</b>Ask for the link again.</div></div></div>`;
    const items = data.d.map(([uni, college, course, col, deadline, status, fees]) => ({ uni, college, course, col, deadline, status, fees }));
    return `<div class="page"><div class="wrap">
      <div class="page-head"><div class="eyebrow">Parent view · read only</div><h1>${esc(data.n || 'Student')}'s college applications</h1><p>Deadlines, fees and status as shared from Everything CUET.</p></div>
      <div class="table-wrap"><table><tr><th>#</th><th>College · course</th><th>List</th><th>${t('Deadline')}</th><th>Fees</th><th>${t('Status')}</th></tr>
      ${items.map((d, i) => `<tr><td>${i + 1}</td><td><b>${esc(d.college || d.uni)}</b><br><small>${esc(d.course || '')} ${d.college ? '· ' + esc(d.uni) : ''}</small></td><td><span class="tag ${esc(d.col)}">${esc(d.col)}</span></td>
        <td>${d.deadline ? `${fmtDate(d.deadline)}<br>${countdown(iso(d.deadline))}` : '—'}</td><td>${d.fees != null ? inr(d.fees) : '—'}</td><td>${esc(STATUSES[d.status] || '')}</td></tr>`).join('')}</table></div>
    </div></div>`;
  };

  /* Calendar and reminders */
  const gcal = e => {
    const d = e.when, p = n => String(n).padStart(2, '0');
    const ymd = x => `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}`;
    const next = new Date(d.getTime() + 864e5);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${ymd(d)}/${ymd(next)}&details=${encodeURIComponent((e.note || '') + (e.source ? '\n' + e.source : '') + '\nvia Everything CUET')}`;
  };
  function downloadIcs(evs) {
    const p = n => String(n).padStart(2, '0');
    const ymd = x => `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}`;
    const escI = s => String(s || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const alarm = tr => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nTRIGGER:${tr}\r\nEND:VALARM`;
    const body = evs.map(e => [
      'BEGIN:VEVENT', `UID:${e.id}@everythingcuet`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;VALUE=DATE:${ymd(e.when)}`, `DTEND;VALUE=DATE:${ymd(new Date(e.when.getTime() + 864e5))}`,
      `SUMMARY:${escI(e.title)}`, `DESCRIPTION:${escI((e.note || '') + (e.source ? ' ' + e.source : ''))}`,
      alarm('-P7D'), alarm('-P2D'), alarm('PT9H'), 'END:VEVENT'].join('\r\n')).join('\r\n');
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Everything CUET//EN\r\nCALSCALE:GREGORIAN\r\n${body}\r\nEND:VCALENDAR\r\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'everything-cuet-deadlines.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  ROUTES.calendar = (arg, q) => {
    const mine = q.get('mine') === '1', past = q.get('past') === '1';
    const evs = upcomingEvents(mine).filter(e => past || !e.past);
    return `<div class="page"><div class="wrap">
      <div class="page-head"><h1>CUET master calendar</h1><p>NTA dates, university portals and your own deadlines in one list. <b>Expected</b> dates are estimates from earlier years until NTA or the university announces them.</p></div>
      <div class="row between no-print" style="margin-bottom:16px">
        <div class="chips"><a class="chip ${!mine ? 'on' : ''}" href="#/calendar${past ? '?past=1' : ''}">${t('All')}</a><a class="chip ${mine ? 'on' : ''}" href="#/calendar?mine=1${past ? '&past=1' : ''}">${t('Only my list')}</a>
          <a class="chip ${past ? 'on' : ''}" href="#/calendar?${mine ? 'mine=1&' : ''}${past ? '' : 'past=1'}">Show past dates</a></div>
        <div class="row"><button class="btn sm" data-act="ics">${t('Download calendar (.ics)')}</button><button class="btn sm" data-act="notify">${S.notify ? '🔔 Reminders on' : t('Turn on browser reminders')}</button><button class="btn sm pri" data-act="alerts">WhatsApp / SMS / email alerts</button></div>
      </div>
      <div class="cal-list">${evs.map(e => `
        <div class="card ev ${e.past ? 'past' : ''}">
          <div class="ev-date"><small>${ist(e.when, { month: 'short' })}</small><b>${ist(e.when, { day: 'numeric' })}</b><small>${ist(e.when, { year: 'numeric' })}</small></div>
          <div><div class="row" style="gap:6px"><b>${esc(e.title)}</b>${statusTag(e.status)}</div>
            <small>${esc(e.group || '')}${e.end ? ` · until ${fmtDate(e.end)}` : ''}${e.note ? ' · ' + esc(e.note) : ''}</small>
            ${e.source ? `<br><small><a href="${esc(e.source)}" target="_blank" rel="noopener">${t('Source')}</a></small>` : ''}
            ${!e.past ? `<div>${countdown(e.when.toISOString())}</div>` : ''}</div>
          <div class="row" style="gap:6px">${!e.past ? `<a class="btn sm" href="${gcal(e)}" target="_blank" rel="noopener">${t('Add to Google Calendar')}</a>` : ''}${e.kind === 'custom' ? `<button class="btn sm" data-delev="${esc(e.id)}">✕</button>` : ''}</div>
        </div>`).join('') || `<div class="empty"><b>Nothing here yet</b>Add your own deadline below, or add colleges with deadlines to your Dream List.</div>`}</div>
      <form class="card no-print" id="evForm" style="margin-top:22px"><h3>${t('Add your own deadline')}</h3>
        <div class="form-grid"><label>What<input name="title" required placeholder="e.g. BHU UET form closes"></label><label>University<input name="group" placeholder="e.g. Banaras Hindu University"></label><label>Date<input name="date" type="date" required></label></div>
        <button class="btn pri" style="margin-top:12px">＋ Add</button></form>
    </div></div>`;
  };
  ROUTES['calendar:mount'] = () => {
    $('#view').addEventListener('click', async e => {
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'ics') { const evs = upcomingEvents(false).filter(x => !x.past); evs.length ? downloadIcs(evs) : toast('No upcoming dates to export'); }
      if (a && a.dataset.act === 'alerts') askLead('Get WhatsApp, SMS and email reminders');
      if (a && a.dataset.act === 'notify') {
        if (!('Notification' in window)) { toast('This browser has no notifications'); return; }
        const perm = await Notification.requestPermission();
        S.notify = perm === 'granted'; save(); render();
        toast(S.notify ? 'Reminders on: 7 days, 48 hours and on the day' : 'Notifications were blocked in this browser');
        if (S.notify && !S.leadAsked) askLead('Also get reminders on your phone?');
      }
      const del = e.target.closest('[data-delev]');
      if (del) { S.customEvents = S.customEvents.filter(x => x.id !== del.dataset.delev); save(); render(); }
    });
    $('#evForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      S.customEvents.push({ id: uid(), title: f.title.trim(), group: f.group.trim(), date: f.date });
      save(); render(); toast('Deadline added');
    });
  };
  /* Shows a reminder 7 days, 48 hours and on the day of each upcoming date, once per stage. */
  function checkReminders() {
    const now = Date.now();
    upcomingEvents(true).filter(e => !e.past && e.status !== 'past').forEach(e => {
      const left = e.when - now;
      const stage = left <= 864e5 ? 'day' : left <= 2 * 864e5 ? '48h' : left <= 7 * 864e5 ? '7d' : null;
      if (!stage || S.notified[e.id + stage]) return;
      S.notified[e.id + stage] = 1;
      const msg = `${e.title}: ${stage === 'day' ? 'today' : stage === '48h' ? 'in 2 days' : 'in a week'} (${fmtDate(e.when)})`;
      toast('⏰ ' + msg);
      if (S.notify && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('Everything CUET', { body: msg }); } catch { /* some mobile browsers need a service worker */ } }
    });
    save();
  }

  /* Applications tracker */
  ROUTES.applications = () => {
    const list = orderedDream();
    return `<div class="page"><div class="wrap">
      <div class="page-head"><h1>Application tracker</h1><p>Tap a step to update each application, and tick documents as you collect them.</p></div>
      ${list.length ? `<div class="grid g2">${list.map(d => {
        const docs = [...DOCS, ...(d.customDocs || [])];
        const have = docs.filter(x => d.docs[x]).length;
        return `<div class="card" data-id="${d.id}">
          <div class="row between"><div><h3 style="margin:0">${esc(d.college || d.uni)}</h3><small>${esc(d.course || '')} ${d.college ? '· ' + esc(d.uni) : ''}</small></div>${d.deadline ? countdown(iso(d.deadline)) : `<button class="btn sm" data-edit>Set deadline</button>`}</div>
          <div class="steps">${STATUSES.map((s, i) => `<button type="button" data-st="${i}" class="${i < (d.status || 0) ? 'done' : i === (d.status || 0) ? 'now' : ''}">${esc(s)}</button>`).join('')}</div>
          <div class="progress"><i style="width:${Math.round(((d.status || 0) / (STATUSES.length - 1)) * 100)}%"></i></div>
          <details style="margin-top:12px"><summary><b>${t('Document checklist')}</b> <span class="tag">${have}/${docs.length}</span></summary>
            <div style="margin-top:8px">${docs.map(x => `<label class="check"><input type="checkbox" data-doc="${esc(x)}" ${d.docs[x] ? 'checked' : ''}>${esc(x)}</label>`).join('')}
            <div class="row" style="margin-top:8px"><input data-newdoc placeholder="Add a document" style="flex:1;margin:0"><button class="btn sm" data-adddoc>＋</button></div></div></details>
          <div class="row" style="margin-top:12px">${d.portal ? `<a class="btn sm" href="${esc(d.portal)}" target="_blank" rel="noopener">Open portal ↗</a>` : ''}<button class="btn sm sun" data-assist>Get it filled · ${inr(P.assistedForm)}</button></div>
        </div>`;
      }).join('')}</div>` : `<div class="empty"><b>No applications yet</b>Add colleges to your <a href="#/dream">Dream List</a> and track them here.</div>`}
    </div></div>`;
  };
  ROUTES['applications:mount'] = () => {
    $('#view').addEventListener('click', e => {
      const card = e.target.closest('[data-id]'); if (!card) return;
      const d = S.dream.find(x => x.id === card.dataset.id);
      const st = e.target.closest('[data-st]');
      if (st) { d.status = +st.dataset.st; save(); render(); }
      if (e.target.closest('[data-edit]')) editDream(d);
      if (e.target.closest('[data-assist]')) addCart({ type: 'form', label: `${d.uni}${d.course ? ' – ' + d.course : ''} form`, price: P.assistedForm });
      if (e.target.closest('[data-adddoc]')) {
        const v = $('[data-newdoc]', card).value.trim(); if (!v) return;
        d.customDocs = [...(d.customDocs || []), v]; save(); render();
      }
    });
    $('#view').addEventListener('change', e => {
      const c = e.target.closest('[data-doc]'); if (!c) return;
      const d = S.dream.find(x => x.id === e.target.closest('[data-id]').dataset.id);
      d.docs[c.dataset.doc] = c.checked; save();
    });
  };

  /* Tools */
  ROUTES.tools = arg => {
    const tab = arg || 'marks';
    const tabs = [['marks', t('Marks calculator')], ['subjects', t('Subject combination checker')], ['compare', 'Compare universities'], ['equivalent', t('Same course at other universities')], ['normalisation', 'Score & percentile guide']];
    return `<div class="page"><div class="wrap">
      <div class="page-head"><h1>CUET tools</h1></div>
      <div class="chips no-print" style="margin-bottom:20px">${tabs.map(([k, l]) => `<a class="chip ${k === tab ? 'on' : ''}" href="#/tools/${k}">${l}</a>`).join('')}</div>
      <div id="toolBody">${(TOOLS[tab] || TOOLS.marks)()}</div>
    </div></div>`;
  };
  const TOOLS = {};
  TOOLS.marks = () => {
    if (!S.marks.length) S.marks = [{ subject: '', right: '', wrong: '' }];
    return `<div class="side-layout">
      <div class="card"><h3>Paper pattern</h3>
        <div class="form-grid"><label>Questions per paper<input id="mq" value="50" inputmode="numeric"></label><label>Marks for right<input id="mr" value="5" inputmode="decimal"></label><label>Marks for wrong<input id="mw" value="-1" inputmode="decimal"></label></div>
        <p class="muted" style="font-size:.82rem;margin:10px 0 0">Set to the CUET (UG) 2025–26 pattern: 50 compulsory questions, +5 for right, −1 for wrong, 0 for unanswered. Check the current NTA information bulletin and change these if the pattern changes.</p></div>
      <div class="card"><h3>Your answers, from the answer key</h3>
        <div id="mrows" class="stack"></div>
        <div class="row" style="margin-top:12px"><button class="btn sm" data-act="mrow">＋ Subject</button><button class="btn sm pri" data-act="mpred">Use in predictor →</button></div>
        <hr><div class="row between"><b>${t('Total')}</b><b id="mtotal" style="font-size:1.5rem"></b></div>
        <p class="muted" style="font-size:.82rem">This is your raw score. NTA publishes normalised scores, which can differ from it when a subject runs in several shifts.</p></div>
    </div>`;
  };
  TOOLS.subjects = () => {
    const rules = (D.rules && D.rules.rules) || [];
    if (!rules.length) return `<div class="notice info"><b>Program rules are being added from each university's admission bulletin.</b> Until then, check the "eligibility" or "programme-specific requirements" table in the university's bulletin. The predictor already flags a course as <b>Not eligible</b> when its official rule is loaded.</div>`;
    return `<div class="side-layout"><div class="card"><label>Course<input id="rq" placeholder="e.g. Economics" list="rlist"></label><datalist id="rlist">${[...new Set(rules.map(r => r.program))].map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <p class="muted" style="font-size:.85rem;margin-top:10px">Your subjects: ${Object.keys(S.scores).map(esc).join(', ') || 'none yet — add them in the predictor'}</p></div><div id="rout"></div></div>`;
  };
  TOOLS.compare = () => {
    const sel = S.compare.map(uniById).filter(Boolean);
    if (!sel.length) return `<div class="empty"><b>Pick up to 3 universities</b>Tick "${t('Compare')}" on the <a href="#/colleges">${t('Colleges')}</a> page.</div>`;
    const rowsFor = u => cutRows().filter(r => norm(r.university) === norm(u.name) && (r.category || 'UR') === S.profile.category);
    const line = (label, f) => `<tr><th style="position:static">${label}</th>${sel.map(u => `<td>${f(u)}</td>`).join('')}</tr>`;
    return `<div class="table-wrap"><table>
      <tr><th style="position:static"></th>${sel.map(u => `<td><b>${esc(u.name)}</b><br><button class="btn sm" data-uncmp="${esc(u.id)}">${t('Remove')}</button></td>`).join('')}</tr>
      ${line('Type', u => esc(u.category))}${line('State', u => esc(u.state || '—'))}
      ${line('Website', u => u.website ? `<a href="${esc(u.website)}" target="_blank" rel="noopener">Open ↗</a>` : '—')}
      ${line(`Courses with cutoffs (${esc(S.profile.category)})`, u => new Set(rowsFor(u).map(r => r.program)).size || '—')}
      ${line('Closing score range', u => { const c = rowsFor(u).map(r => +r.cutoff); return c.length ? `${Math.min(...c)} – ${Math.max(...c)}` : '—'; })}
      ${line('On your Dream List', u => (inDream(u.name) ? '★ Yes' : 'No'))}
      ${line('Student group', u => ((C.groups || []).some(g => norm(g.university) === norm(u.name)) ? 'Yes' : '—'))}
    </table></div>`;
  };
  TOOLS.equivalent = () => {
    const q = parseHash().q.get('program') || '';
    return `<div class="card" style="margin-bottom:16px"><label>Course<input id="eq" value="${esc(q)}" placeholder="e.g. B.Sc (Hons.) Physics"></label></div><div id="eqout"></div>`;
  };
  TOOLS.normalisation = () => `<div class="grid g2">
    <div class="card"><h3>Raw score vs normalised score</h3><p>When a subject is held in several shifts, NTA converts raw scores to normalised scores so that harder and easier shifts are compared fairly. Universities admit on the normalised score shown on your scorecard.</p><p>Use the <a href="#/tools/marks">marks calculator</a> to see your raw score from the answer key, then enter your scorecard's normalised scores in the <a href="#/predictor">predictor</a>.</p></div>
    <div class="card"><h3>Why we don't show a percentile estimate</h3><p>NTA does not publish a marks-to-percentile table for CUET (UG), and any "percentile predictor" without one is a guess. We show your gap to real closing scores instead.</p><p>DU uses a combined merit score built from the subjects its course requires; BHU and JMI often use the score of a single subject. The predictor handles both.</p></div></div>`;

  ROUTES['tools:mount'] = arg => {
    const tab = arg || 'marks';
    if (tab === 'marks') {
      const drawRows = () => {
        const Q = +$('#mq').value || 50, R = +$('#mr').value || 0, W = +$('#mw').value || 0;
        $('#mrows').innerHTML = S.marks.map((m, i) => {
          const r = +m.right || 0, w = +m.wrong || 0, bad = r + w > Q;
          return `<div class="row" data-i="${i}" style="flex-wrap:nowrap;align-items:end">
            <label style="flex:2">Subject<input list="subjList" data-f="subject" value="${esc(m.subject)}"></label>
            <label style="flex:1">Right<input inputmode="numeric" data-f="right" value="${esc(m.right)}"></label>
            <label style="flex:1">Wrong<input inputmode="numeric" data-f="wrong" value="${esc(m.wrong)}"></label>
            <b style="min-width:70px;text-align:right;padding-bottom:10px;color:var(--${bad ? 'bad' : 'ink'})">${bad ? 'Over ' + Q : r * R + w * W}</b>
            <button class="icon-btn" data-rm="${i}" style="margin-bottom:2px" aria-label="Remove">✕</button></div>
            ${bad ? '' : `<small class="muted">${Math.max(0, Q - r - w)} unanswered · out of ${Q * R}</small>`}`;
        }).join('') + `<datalist id="subjList">${SUBJECTS.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
        total();
      };
      const total = () => {
        const R = +$('#mr').value || 0, W = +$('#mw').value || 0;
        $('#mtotal').textContent = S.marks.reduce((s, m) => s + (+m.right || 0) * R + (+m.wrong || 0) * W, 0);
      };
      $('#toolBody').addEventListener('input', e => {
        const f = e.target.dataset.f;
        if (f) { S.marks[+e.target.closest('[data-i]').dataset.i][f] = e.target.value; save(); total(); }
        else if (['mq', 'mr', 'mw'].includes(e.target.id)) drawRows();
      });
      $('#toolBody').addEventListener('change', e => { if (e.target.dataset.f && e.target.dataset.f !== 'subject') drawRows(); });
      $('#toolBody').addEventListener('click', e => {
        const a = e.target.closest('[data-act]'), rm = e.target.closest('[data-rm]');
        if (rm) { S.marks.splice(+rm.dataset.rm, 1); if (!S.marks.length) S.marks.push({ subject: '', right: '', wrong: '' }); save(); drawRows(); }
        if (a && a.dataset.act === 'mrow') { if (S.marks.length >= 6) { toast('CUET allows up to 5 subjects plus the General Test'); return; } S.marks.push({ subject: '', right: '', wrong: '' }); save(); drawRows(); }
        if (a && a.dataset.act === 'mpred') {
          const R = +$('#mr').value || 0, W = +$('#mw').value || 0;
          S.marks.filter(m => m.subject).forEach(m => { S.scores[m.subject] = String((+m.right || 0) * R + (+m.wrong || 0) * W); });
          save(); location.hash = '#/predictor'; toast('Raw scores copied — replace them with your normalised scores when results are out');
        }
      });
      drawRows();
    }
    if (tab === 'subjects' && $('#rq')) {
      const rules = D.rules.rules;
      const draw = () => {
        const term = norm($('#rq').value);
        const mine = new Set(Object.keys(S.scores).map(norm));
        const list = rules.filter(r => !term || norm(r.program).includes(term)).slice(0, 40);
        $('#rout').innerHTML = list.map(r => {
          const ok = (r.subjects || []).every(any => any.some(s => mine.has(norm(s))));
          return `<div class="card" style="margin-bottom:10px"><div class="row between"><b>${esc(r.program)} · ${esc(r.university)}</b><span class="tag ${ok ? 'safe' : 'bad'}">${ok ? '✓ You can apply' : '✗ Missing subjects'}</span></div>
            <p style="margin:8px 0 0">Needs: ${(r.subjects || []).map(any => any.map(s => `<span class="tag ${mine.has(norm(s)) ? 'safe' : ''}">${esc(s)}</span>`).join(' or ')).join(' + ')}</p>${r.source ? `<small><a href="${esc(r.source)}" target="_blank" rel="noopener">${t('Source')}</a></small>` : ''}</div>`;
        }).join('') || '<div class="empty"><b>No course matches</b></div>';
      };
      $('#rq').addEventListener('input', draw); draw();
    }
    if (tab === 'compare') $('#toolBody').addEventListener('click', e => { const b = e.target.closest('[data-uncmp]'); if (b) { S.compare = S.compare.filter(x => x !== b.dataset.uncmp); save(); render(); } });
    if (tab === 'equivalent') {
      const draw = () => {
        const term = norm($('#eq').value);
        if (!cutRows().length) { $('#eqout').innerHTML = `<div class="notice info">Course data comes from official allotment lists and is being added. Check back soon.</div>`; return; }
        if (!term) { $('#eqout').innerHTML = ''; return; }
        const rows = cutRows().filter(r => norm(r.program).includes(term) && (r.category || 'UR') === S.profile.category);
        const best = new Map();
        rows.forEach(r => { const k = r.university + '|' + r.college + '|' + r.program; const b = best.get(k); if (!b || +r.year > +b.year || (+r.year === +b.year && +r.round > +b.round)) best.set(k, r); });
        const list = [...best.values()].sort((a, b) => cmp(a.university, b.university) || b.cutoff - a.cutoff);
        $('#eqout').innerHTML = list.length ? `<div class="table-wrap"><table><tr><th>University</th><th>College</th><th>Course</th><th>Last closing (${esc(S.profile.category)})</th><th></th></tr>
          ${list.map((r, i) => `<tr><td>${esc(r.university)}</td><td>${esc(r.college)}</td><td>${esc(r.program)}</td><td class="num">${esc(r.cutoff)} <small>R${esc(r.round)} ${esc(r.year)}</small></td><td><button class="btn sm" data-eqadd="${i}">＋</button></td></tr>`).join('')}</table></div>` : '<div class="empty"><b>No match</b>Try a shorter course name, e.g. "Physics".</div>';
        $('#eqout').onclick = e => { const b = e.target.closest('[data-eqadd]'); if (b) { const r = list[+b.dataset.eqadd]; addToDream({ uni: r.university, college: r.college, course: r.program, cutoff: r.cutoff, fees: r.fees, hostel: r.hostel }); } };
      };
      $('#eq').addEventListener('input', draw); draw();
    }
  };

  /* Resources */
  ROUTES.resources = () => {
    const rows = cutRows().filter(r => (r.category || 'UR') === S.profile.category);
    const webinars = (C.webinars || []).filter(w => new Date(w.date) > Date.now());
    return `<div class="page"><div class="wrap">
      <div class="page-head"><h1>CUET resources</h1><p>Official links first, then our own guides and videos.</p></div>
      <div class="grid g3">
        <a class="card tool" href="${NTA}" target="_blank" rel="noopener"><span class="ico">🏛️</span><h3>NTA CUET (UG) website</h3><p>Information bulletin, syllabus, registration, admit card, answer key and results.</p></a>
        <a class="card tool" href="${NTA_UNIS}" target="_blank" rel="noopener"><span class="ico">📜</span><h3>Participating universities</h3><p>NTA's official lists — the source of our <a href="#/colleges">college list</a>.</p></a>
        <a class="card tool" href="${SATHEE}" target="_blank" rel="noopener"><span class="ico">📝</span><h3>Free mocks and PYQs (SATHEE, IIT Kanpur)</h3><p>Full mock tests, subject tests and previous-year papers, free from the Government of India's SATHEE platform.</p></a>
      </div>
      <h2 style="margin-top:34px">Exam pattern at a glance</h2>
      <div class="grid g4">
        <div class="card stat"><b>5</b><span>subjects at most, plus the General Test</span></div>
        <div class="card stat"><b>50</b><span>compulsory questions per paper</span></div>
        <div class="card stat"><b>+5 / −1</b><span>right / wrong, 0 if unanswered</span></div>
        <div class="card stat"><b>60 min</b><span>per paper, computer-based</span></div>
      </div>
      <p class="muted" style="font-size:.82rem;margin-top:8px">As per the CUET (UG) 2025–26 pattern. Always check the latest information bulletin on <a href="${NTA}" target="_blank" rel="noopener">cuet.nta.nic.in</a>.</p>
      <h2 style="margin-top:34px">Choosing your subjects</h2>
      <div class="card"><ul class="ticks">
        <li>Pick the course first, then the subjects its eligibility rule asks for — DU and BHU publish them course by course in their bulletins.</li>
        <li>Take the language your target course needs (often English) as one of your subjects.</li>
        <li>Add the General Test if you're considering courses that use it, such as some B.A. programmes and BBA/BMS-type courses.</li>
        <li>Check your choices with the <a href="#/tools/subjects">subject combination checker</a>.</li>
      </ul></div>
      <h2 style="margin-top:34px">Past cutoffs</h2>
      ${rows.length ? `<div class="table-wrap" style="max-height:480px"><table><tr><th>University</th><th>College</th><th>Course</th><th>Round</th><th>Year</th><th>Closing (${esc(S.profile.category)})</th></tr>${rows.slice(0, 300).map(r => `<tr><td>${esc(r.university)}</td><td>${esc(r.college)}</td><td>${esc(r.program)}</td><td>${esc(r.round)}</td><td>${esc(r.year)}</td><td class="num">${esc(r.cutoff)}</td></tr>`).join('')}</table></div>`
        : `<div class="notice info">Round-wise cutoffs from official allotment lists (DU, BHU, JMI, JNU, AMU, BBAU) are being added. <a href="#/" data-act="pdf">Get the cutoff PDF when it's ready</a>.</div>`}
      <div class="grid g2" style="margin-top:34px">
        <div class="card"><h3>Webinars before counselling</h3>${webinars.length ? webinars.map(w => `<p><b>${esc(w.title)}</b><br><small>${fmtDate(w.date)}</small> ${countdown(iso(w.date))}<br><a class="btn sm pri" href="${esc(w.link)}" target="_blank" rel="noopener">Register</a></p>`).join('') : '<p class="muted">Free CSAS and BHU counselling webinars are announced before each portal opens.</p>'}<button class="btn sm" data-act="pdf">Tell me when the next one is</button></div>
        <div class="card"><h3>News and blog</h3>${(C.news || []).length ? `<ul class="ticks">${C.news.slice(0, 8).map(n => `<li><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a> <small>${fmtDate(n.date)}</small></li>`).join('')}</ul>` : `<p class="muted">Official notices are on <a href="${NTA}" target="_blank" rel="noopener">NTA's CUET site</a>. Our updates: <a href="${esc(C.instagram)}" target="_blank" rel="noopener">Instagram</a> · <a href="${esc(C.youtube)}" target="_blank" rel="noopener">YouTube</a>.</p>`}</div>
      </div>
      ${(C.youtubeVideos || []).length ? `<h2 style="margin-top:34px">Watch</h2><div class="grid g3">${C.youtubeVideos.map(v => `<iframe style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px" src="https://www.youtube-nocookie.com/embed/${esc(v)}" title="Everything CUET video" allowfullscreen loading="lazy"></iframe>`).join('')}</div>` : ''}
    </div></div>`;
  };
  ROUTES['resources:mount'] = () => $('#view').addEventListener('click', e => { const a = e.target.closest('[data-act="pdf"]'); if (a) { e.preventDefault(); askLead('Get cutoff PDFs and webinar invites'); } });

  /* Seniors */
  ROUTES.seniors = (arg, q) => {
    const ms = C.mentors || [];
    return `<div class="page"><div class="wrap">
      <div class="page-head"><div class="eyebrow">Vetted · fixed price</div><h1>Talk to a senior from your college</h1>
        <p>A ${inr(P.seniorCall)} call for 20 minutes with a current student — not per-minute billing. Every senior is checked by our team (college ID and admission year) before they take calls.</p></div>
      <div class="side-layout">
        <form class="card sticky" id="srForm"><h3>Book a call</h3>
          <label>College or university<input name="college" required value="${esc(q.get('college') || '')}" list="uniList2"></label>
          <datalist id="uniList2">${unis().slice(0, 2000).map(u => `<option value="${esc(u.name)}">`).join('')}</datalist>
          <label style="margin-top:12px">Course you want<input name="course"></label>
          <label style="margin-top:12px">What do you want to ask?<textarea name="ask" rows="3" placeholder="Hostel, campus life, which college to put first…"></textarea></label>
          <div class="form-grid" style="margin-top:12px"><label>${t('Name')}<input name="name" value="${esc(S.profile.name)}" required></label><label>${t('Phone')}<input name="phone" value="${esc(S.profile.phone)}" inputmode="tel" required></label></div>
          <button class="btn pri block" style="margin-top:14px">Book · ${inr(P.seniorCall)} / 20 min</button>
        </form>
        <div>
          ${ms.length ? `<div class="grid g2">${ms.map(m => `<div class="card"><div class="row between"><h3 style="margin:0">${esc(m.name)}</h3>${m.verified ? '<span class="tag safe">✓ Verified</span>' : ''}</div><p class="muted" style="margin:4px 0">${esc(m.course)} · ${esc(m.college)} · ${esc(m.year || '')}</p><small>${esc(m.languages || '')}</small></div>`).join('')}</div>`
            : `<div class="empty"><b>Seniors are being verified</b>Book a call and we'll match you with a checked student from that college.</div>`}
          <div class="card" style="margin-top:16px"><h3>Are you a student at a CUET university?</h3><p class="muted">Help juniors and earn ${inr(Math.round(P.seniorCall * 0.6))} per call. We verify your college ID first.</p><button class="btn" data-act="mentor">Apply as a senior</button></div>
        </div>
      </div>
    </div></div>`;
  };
  ROUTES['seniors:mount'] = () => {
    $('#srForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      Object.assign(S.profile, { name: f.name, phone: f.phone }); save();
      await submit('senior-call', f, `Hi Everything CUET, I'd like a ${inr(P.seniorCall)} senior call.\nCollege: ${f.college}\nCourse: ${f.course}\nQuestion: ${f.ask}\nName: ${f.name}\nPhone: ${f.phone}`);
    });
    $('#view').addEventListener('click', e => {
      if (!e.target.closest('[data-act="mentor"]')) return;
      modal.open(`<h2>Apply as a senior</h2><form id="mForm" class="stack">
        <div class="form-grid"><label>${t('Name')}<input name="name" required></label><label>${t('Phone')}<input name="phone" required inputmode="tel"></label></div>
        <div class="form-grid"><label>College<input name="college" required></label><label>Course and year<input name="course" required></label></div>
        <label>Languages you speak<input name="languages" placeholder="Hindi, English…"></label>
        <div class="row"><button class="btn pri">Send</button><button class="btn ghost" type="button" data-act="modal-close">${t('Cancel')}</button></div></form>`, el => {
        $('#mForm', el).addEventListener('submit', async ev => {
          ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); modal.close();
          await submit('mentor-application', f, `Hi Everything CUET, I want to mentor juniors.\nName: ${f.name}\nPhone: ${f.phone}\nCollege: ${f.college}\nCourse/year: ${f.course}\nLanguages: ${f.languages}`);
        });
      });
    });
  };

  /* Community: groups + allotment-day tracker */
  ROUTES.community = (arg, q) => {
    const groups = C.groups || [];
    const verified = (D.allotments && D.allotments.rows) || [];
    return `<div class="page"><div class="wrap">
      <div class="page-head"><h1>Community</h1><p>College-wise student groups for doubts and seat updates, and a live allotment-day tracker.</p></div>
      <div class="grid g2">
        <div class="card"><h3>College groups</h3>
          ${groups.length ? `<ul class="ticks">${groups.map(g => `<li><a href="${esc(g.link)}" target="_blank" rel="noopener">${esc(g.university)}</a></li>`).join('')}</ul>` : '<p class="muted">Groups open college by college as students ask for them.</p>'}
          <form id="grpForm" class="row" style="margin-top:12px"><input name="college" required placeholder="College you want a group for" value="${esc(q.get('college') || '')}" style="flex:1;margin:0"><button class="btn">Ask for a group</button></form>
        </div>
        <form class="card" id="alForm"><h3>Allotment day: what did you get?</h3>
          <div class="form-grid"><label>University<input name="university" required></label><label>College<input name="college" required></label></div>
          <div class="form-grid" style="margin-top:10px"><label>Course<input name="program" required></label><label>Category<select name="category">${RES_CATS.map(c => `<option ${S.profile.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
          <div class="form-grid" style="margin-top:10px"><label>Round<input name="round" inputmode="numeric" required></label><label>Your score<input name="score" inputmode="decimal" required></label></div>
          <button class="btn pri" style="margin-top:12px">Share my allotment</button>
          <p class="muted" style="font-size:.8rem;margin:8px 0 0">We check reports before adding them to the public table.</p>
        </form>
      </div>
      <h2 style="margin-top:30px">Allotments reported this year</h2>
      ${verified.length ? `<div class="table-wrap"><table><tr><th>University</th><th>College</th><th>Course</th><th>Category</th><th>Round</th><th>Score</th></tr>${verified.map(r => `<tr><td>${esc(r.university)}</td><td>${esc(r.college)}</td><td>${esc(r.program)}</td><td>${esc(r.category)}</td><td>${esc(r.round)}</td><td class="num">${esc(r.score)}</td></tr>`).join('')}</table></div>`
        : `<div class="empty"><b>The tracker opens on the first allotment day</b>Reports from students show up here, round by round.</div>`}
      ${S.myAllotments.length ? `<h3 style="margin-top:20px">Your reports</h3><ul>${S.myAllotments.map(r => `<li>${esc(r.college)} · ${esc(r.program)} · R${esc(r.round)} · ${esc(r.score)}</li>`).join('')}</ul>` : ''}
    </div></div>`;
  };
  ROUTES['community:mount'] = () => {
    $('#grpForm').addEventListener('submit', async e => { e.preventDefault(); const c = new FormData(e.target).get('college'); await submit('group-request', { college: c, profile: S.profile }, `Hi Everything CUET, please start a student group for ${c}.`); });
    $('#alForm').addEventListener('submit', async e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      S.myAllotments.push(f); save();
      await submit('allotment', f, `Allotment report (Everything CUET)\n${f.university} · ${f.college}\n${f.program} · ${f.category} · Round ${f.round} · Score ${f.score}`);
      render();
    });
  };

  /* Pricing, cart and checkout */
  ROUTES.pricing = () => {
    const codes = C.partnerCodes || [];
    return `<div class="page"><div class="wrap">
      <div class="page-head"><h1>Plans</h1><p>Everything you plan with is free. Pay only when you want our team to do the work.</p></div>
      <div class="grid g4">
        <div class="card price"><h3>Free</h3><div class="amt">₹0</div><ul><li>College predictor</li><li>NTA university list</li><li>Dream List + CSAS order</li><li>Email reminders</li><li>Calculators and resources</li></ul><a class="btn" href="#/predictor">Start free</a></div>
        <div class="card price"><h3>Assisted form</h3><div class="amt">${inr(P.assistedForm)} <small>/ form</small></div><ul><li>One CUET, university or private-college form filled by our team</li><li>Document and photo-size check</li><li>${Math.round(P.bundleDiscount * 100)}% off for ${P.bundleMinForms}+ forms</li></ul><button class="btn sun" data-buy="form">${t('Add to cart')}</button></div>
        <div class="card price pop" data-pop="Most popular"><h3>CSAS Pro</h3><div class="amt">${inr(P.csasPro)}</div><ul><li>Full predictor report, all rounds</li><li>WhatsApp + SMS reminders</li><li>30-minute CSAS preference review call</li><li>Up to 5 forms filled</li></ul><button class="btn pri" data-buy="csasPro">${t('Add to cart')}</button></div>
        <div class="card price"><h3>Admission Mentor</h3><div class="amt">${inr(P.mentor)}<small>–${inr(P.mentorPlus).slice(1)}</small></div><ul><li>Dedicated counsellor from result to final seat</li><li>All forms filled</li><li>Allotment-day support</li></ul><button class="btn" data-buy="mentor">${t('Add to cart')}</button></div>
      </div>
      <div class="grid g2" style="margin-top:22px">
        <div class="card"><h3>What the Admission Mentor plan covers</h3><ul class="ticks">
          <li>A personal preference list for CSAS, BHU and JMI</li><li>Previous-year cutoffs and the seat matrix</li><li>Fee, bond and refund details for each college</li><li>Round-wise strategy: accept, freeze or upgrade</li><li>Document and scholarship guidance</li><li>Help with withdrawal and refund formalities</li><li>Private WhatsApp group for plan members</li></ul></div>
        <div class="card"><h3>Partner-college offers</h3>${codes.length ? codes.map(p => `<p><b>${esc(p.college)}</b> — ${esc(p.saving)}<br>Code <b style="font-family:var(--mono)">${esc(p.code)}</b> <button class="btn sm" data-copy="${esc(p.code)}">Copy</button></p>`).join('') : '<p class="muted">Application-fee discounts from private universities that accept CUET will be listed here.</p>'}</div>
      </div>
      <div id="cartBox" style="margin-top:28px"></div>
    </div></div>`;
  };
  function drawCart() {
    const box = $('#cartBox'); if (!box) return;
    const tt = cartTotals();
    box.innerHTML = `<div class="card" id="cart"><h2>${t('Cart')}</h2>
      ${S.cart.length ? `<div class="table-wrap"><table>${S.cart.map(c => `<tr><td>${esc(c.label)}</td><td class="num">${inr(c.price)}</td><td><button class="btn sm" data-uncart="${c.id}">✕</button></td></tr>`).join('')}
        <tr><td>Subtotal</td><td class="num">${inr(tt.sub)}</td><td></td></tr>
        ${tt.bundle ? `<tr><td>Bundle: ${Math.round(P.bundleDiscount * 100)}% off ${tt.forms} forms</td><td class="num" style="color:var(--safe)">−${inr(tt.bundle)}</td><td></td></tr>` : `<tr><td colspan="3"><small class="muted">Add ${Math.max(0, P.bundleMinForms - tt.forms)} more form(s) to save ${Math.round(P.bundleDiscount * 100)}%.</small></td></tr>`}
        <tr><th style="position:static">${t('Total')}</th><th class="num" style="position:static">${inr(tt.total)}</th><th style="position:static"></th></tr></table></div>
        <form id="coForm" class="stack" style="margin-top:16px"><div class="form-grid">
          <label>${t('Name')}<input name="name" required value="${esc(S.profile.name)}"></label><label>${t('Phone')}<input name="phone" required inputmode="tel" value="${esc(S.profile.phone)}"></label><label>${t('Email')}<input name="email" type="email" value="${esc(S.profile.email)}"></label></div>
          <label>Anything we should know?<textarea name="notes" rows="2"></textarea></label>
          <button class="btn pri">${t('Checkout')} · ${inr(tt.total)}</button>
          <small class="muted">We confirm your order on WhatsApp and share a payment link. Pay only after we confirm.</small></form>`
        : `<p class="muted">Your cart is empty. Add an assisted form from any college page or your Dream List.</p>`}</div>`;
  }
  ROUTES['pricing:mount'] = () => {
    drawCart();
    $('#view').addEventListener('click', e => {
      const b = e.target.closest('[data-buy]');
      if (b) {
        const k = b.dataset.buy;
        if (k === 'form') addCart({ type: 'form', label: `Assisted form ${S.cart.filter(c => c.type === 'form').length + 1}`, price: P.assistedForm });
        if (k === 'csasPro') addCart({ type: 'csasPro', label: 'CSAS Pro (preference review + reminders + 5 forms)', price: P.csasPro });
        if (k === 'mentor') addCart({ type: 'mentor', label: 'Admission Mentor', price: P.mentor });
        drawCart();
      }
      const u = e.target.closest('[data-uncart]');
      if (u) { S.cart = S.cart.filter(c => c.id !== u.dataset.uncart); save(); updateCart(); drawCart(); }
      const c = e.target.closest('[data-copy]');
      if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy); toast('Code copied'); }
    });
    $('#view').addEventListener('submit', async e => {
      if (e.target.id !== 'coForm') return;
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      Object.assign(S.profile, { name: f.name, phone: f.phone, email: f.email }); save();
      const tt = cartTotals();
      const lines = S.cart.map(c => `• ${c.label} — ${inr(c.price)}`).join('\n');
      await submit('order', { ...f, items: S.cart, totals: tt }, `Hi Everything CUET, I'd like to order:\n${lines}\n${tt.bundle ? `Bundle discount: −${inr(tt.bundle)}\n` : ''}Total: ${inr(tt.total)}\nName: ${f.name}\nPhone: ${f.phone}\nEmail: ${f.email}\n${f.notes || ''}`);
    });
    if (parseHash().q.get('cart')) setTimeout(() => $('#cart') && $('#cart').scrollIntoView({ behavior: 'smooth' }), 50);
  };
  $('#cartFab').addEventListener('click', () => { location.hash = '#/pricing?cart=1'; if (parseHash().route === 'pricing') $('#cart') && $('#cart').scrollIntoView({ behavior: 'smooth' }); });

  /* ---------- footer ---------- */
  function renderFoot() {
    $('#foot').innerHTML = `
      <div><div class="logo"><span class="logo-mark">E</span><span class="logo-text"><b>Everything</b> CUET</span></div>
        <p style="margin-top:10px">Predict, shortlist, get reminded and apply — for every university that takes CUET (UG).</p>
        <p style="font-size:.8rem">Independent service, not affiliated with the National Testing Agency or any university. University list from <a style="display:inline" href="${NTA_UNIS}" target="_blank" rel="noopener">NTA</a>. Always confirm dates on the official website.</p></div>
      <div><b>Tools</b>${NAV.slice(1, 7).map(([r, l]) => `<a href="#/${r}">${t(l)}</a>`).join('')}</div>
      <div><b>Follow</b><a href="${esc(C.instagram)}" target="_blank" rel="noopener">Instagram @everythingcuet</a><a href="${esc(C.youtube)}" target="_blank" rel="noopener">YouTube</a>${C.whatsapp ? `<a href="https://wa.me/${esc(C.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<a href="#/pricing">${t('Pricing')}</a><a href="#/seniors">${t('Seniors')}</a></div>`;
  }

  /* ---------- assistant ---------- */
  const bot = { el: $('#bot'), log: $('#botLog') };
  function say(html, me) {
    const m = document.createElement('div'); m.className = 'msg ' + (me ? 'me' : 'bot-m'); m.innerHTML = html;
    bot.log.appendChild(m); bot.log.scrollTop = bot.log.scrollHeight;
  }
  const SUGG = ['Can I get B.Com Hons with 720?', 'When is CUET 2027 registration?', 'Central universities in Uttar Pradesh', 'How is CUET marked?', 'How much does form filling cost?'];
  function botHello() {
    say(`Hi! I answer from Everything CUET's own data — universities from NTA, the calendar, cutoffs and our plans. Try:<div class="sugg" style="margin-top:8px">${SUGG.map(s => `<button type="button" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`);
  }
  function answer(qs) {
    const q = qs.toLowerCase();
    const score = (q.match(/\b(\d{2,4}(?:\.\d+)?)\b/) || [])[1];
    if (score && cutRows().length) {
      const words = norm(q).split(' ').filter(w => w.length > 2 && !/^\d/.test(w) && !['can', 'get', 'with', 'the', 'what', 'which', 'hons', 'score', 'college', 'colleges'].includes(w));
      const rows = cutRows().filter(r => (r.category || 'UR') === S.profile.category && r.scoreType !== 'subject' && words.some(w => norm(r.program + ' ' + r.college + ' ' + r.university).includes(w)));
      if (rows.length) {
        const latest = Math.max(...rows.map(r => +r.year)); const s = +score;
        const best = new Map();
        rows.filter(r => +r.year === latest).forEach(r => { const k = r.college + '|' + r.program; const b = best.get(k); if (!b || +r.round > +b.round) best.set(k, r); });
        const list = [...best.values()].map(r => ({ ...r, gap: +(s - r.cutoff).toFixed(2) })).sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap)).slice(0, 5);
        return `With ${s} (${esc(S.profile.category)}), against ${latest} last-round closing scores:\n` + list.map(r => `• ${esc(r.college)} — ${esc(r.program)}: closed at ${esc(r.cutoff)} → ${r.gap >= 0 ? `<b>${r.gap} above</b>` : `${Math.abs(r.gap)} below`}`).join('\n') + `\n<a href="#/predictor">Open the full predictor →</a>`;
      }
    }
    if (score && /get|chance|admission|seat|milega|hons|college/.test(q)) return `Cutoff data from official allotment lists is still being added, so I can't check that score yet. Meanwhile, <a href="#/predictor">save your scores in the predictor</a> and you'll see results as soon as it's live.`;
    if (/when|date|kab|registration|exam|result|deadline|admit|answer key/.test(q)) {
      const evs = upcomingEvents(false).filter(e => !e.past).slice(0, 4);
      return evs.length ? evs.map(e => `• <b>${esc(e.title)}</b> — ${fmtDate(e.when)}${e.status === 'expected' ? ' (expected, not official yet)' : ''}`).join('\n') + `\n<a href="#/calendar">Full calendar →</a>` : `No upcoming dates are announced yet. <a href="#/calendar">Turn on reminders</a> and we'll tell you.`;
    }
    const cat = CATS.find(c => q.includes(c.toLowerCase().split(' ')[0]));
    const states = [...new Set(unis().map(u => u.state).filter(Boolean))];
    const st = states.find(s => q.includes(s.toLowerCase()));
    if (/universit|college|list/.test(q) && (cat || st)) {
      if (!unis().length) return `NTA's university list is being imported. See it on <a href="${NTA_UNIS}" target="_blank" rel="noopener">cuet.nta.nic.in</a>.`;
      const list = unis().filter(u => (!cat || u.category === cat) && (!st || u.state === st));
      const p = new URLSearchParams(); cat && p.set('cat', cat); st && p.set('state', st);
      return `${list.length} ${cat || ''} universit${list.length === 1 ? 'y' : 'ies'}${st ? ' in ' + esc(st) : ''} on NTA's list:\n${list.slice(0, 6).map(u => '• ' + esc(u.name)).join('\n')}${list.length > 6 ? '\n…' : ''}\n<a href="#/colleges?${p}">See all →</a>`;
    }
    if (/mark|negative|pattern|question|paper|kitne/.test(q)) return `Each paper has 50 compulsory questions in 60 minutes: +5 for a right answer, −1 for a wrong one, 0 if left blank — so 250 per subject (CUET UG 2025–26 pattern; check NTA's bulletin). <a href="#/tools/marks">Count your marks →</a>`;
    if (/price|cost|fee|pay|form fill|assist|plan|kitna/.test(q)) return `• Assisted form: ${inr(P.assistedForm)} each, ${Math.round(P.bundleDiscount * 100)}% off for ${P.bundleMinForms}+\n• CSAS Pro: ${inr(P.csasPro)}\n• Admission Mentor: ${inr(P.mentor)}–${inr(P.mentorPlus).slice(1)}\n• Senior call: ${inr(P.seniorCall)} / 20 min\n<a href="#/pricing">See plans →</a>`;
    if (/senior|alumni|student|mentor/.test(q)) return `Book a ${inr(P.seniorCall)}, 20-minute call with a verified senior: <a href="#/seniors">Talk to a senior →</a>`;
    if (/subject|eligib|combination/.test(q)) return `Use the <a href="#/tools/subjects">subject combination checker</a>; it lists each course's required CUET subjects from the university's bulletin.`;
    if (/csas|preference|order/.test(q)) return `Build your preference order on the <a href="#/dream">Dream List</a> (Dream first, Safe last) and print it. Want an expert to check it? The <a href="#/pricing">CSAS Pro plan</a> includes a 30-minute review.`;
    if (/normal|percentile/.test(q)) return `<a href="#/tools/normalisation">How normalised scores work, and why we don't guess percentiles →</a>`;
    return `I'm not sure about that one. ${C.whatsapp ? `<a href="https://wa.me/${esc(C.whatsapp)}?text=${encodeURIComponent(qs)}" target="_blank" rel="noopener">Ask our team on WhatsApp →</a>` : 'Try asking about dates, colleges, marks or plans.'}`;
  }
  $('#botFab').addEventListener('click', () => { bot.el.hidden = !bot.el.hidden; if (!bot.el.hidden) { if (!bot.log.children.length) botHello(); $('#botIn').focus(); } });
  bot.el.addEventListener('click', e => {
    if (e.target.closest('[data-act="bot-close"]')) bot.el.hidden = true;
    const s = e.target.closest('[data-q]'); if (s) ask(s.dataset.q);
  });
  function ask(qs) { say(esc(qs), true); setTimeout(() => say(answer(qs)), 250); }
  $('#botForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#botIn').value.trim(); if (v) { ask(v); $('#botIn').value = ''; } });

  /* ---------- top bar ---------- */
  $('#langBtn').addEventListener('click', () => { S.lang = S.lang === 'hi' ? 'en' : 'hi'; save(); render(); });
  $('#menuBtn').addEventListener('click', () => { const n = $('#nav'); n.classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', n.classList.contains('open')); });

  HI.Closed = 'बंद'; HI.Seniors = 'सीनियर्स';
  loadData().then(() => { render(); checkReminders(); });
})();
