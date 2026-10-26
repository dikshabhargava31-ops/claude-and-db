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
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private window: keep working in memory */ }
    try { syncSoon(); } catch { /* accounts not started yet */ }
  }

  /* ---------- data ---------- */
  const D = { universities: null, cutoffs: null, events: null, allotments: null, rules: null, official: null, forms: null };
  const FILES = { universities: 'universities.json', cutoffs: 'cutoffs.json', events: 'events.json', allotments: 'allotments.json', rules: 'subject-rules.json', official: 'official.json', forms: 'forms.json' };
  async function loadData() {
    await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
      try { const r = await fetch('data/' + f, { cache: 'no-cache' }); D[k] = r.ok ? await r.json() : null; } catch { D[k] = null; }
    }));
  }
  const unis = () => (D.universities && D.universities.universities) || [];
  const cutRows = () => (D.cutoffs && D.cutoffs.rows) || [];
  const uniById = id => unis().find(u => u.id === id);
  const off = () => D.official || {};
  const forms = () => (D.forms && D.forms.forms) || [];
  const nextDeadline = f => f.deadlines.map(d => ({ ...d, when: evDate(d) })).filter(d => d.when > Date.now()).sort((a, b) => a.when - b.when)[0];
  const formStatus = f => (f.status === 'open' && f.deadlines.length && !nextDeadline(f) ? 'closed' : f.status);
  const FORM_STATUS = { open: ['Open', 'safe'], upcoming: ['Opening soon', 'sun'], closed: ['Closed', 'bad'], check: ['2027 dates not out', ''] };
  const toLocalInput = d => { const x = new Date(d), p = n => String(n).padStart(2, '0'); return isNaN(x) ? '' : `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
  const offRows = k => (off()[k] && off()[k].rows) || [];
  const subjectNames = () => (offRows('subjects').length ? offRows('subjects').map(r => r.subject) : SUBJECTS);
  const firstUrl = s => (String(s || '').match(/https?:\/\/[^\s;]+/) || [''])[0];
  const lakh = n => (n / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' lakh';
  // NTA lists names in capitals; show them in title case, keeping acronyms and initials.
  const ACRONYMS = new Set(['IIT', 'SRM', 'GITAM', 'ICFAI', 'IIS', 'KIET', 'TERI', 'TISS', 'UPES', 'BML', 'CGC', 'CMR', 'DBS', 'DIT', 'GLA', 'HRIT', 'IFTM', 'IILM', 'IIMT', 'ITM', 'JECRC', 'JIS', 'MNR', 'NIIT', 'RNB', 'SGT', 'SMS', 'ICAR', 'NFSU', 'NIFTEM-K', 'HNB', 'DTBU', 'ASBM', 'AKS', 'RV', 'DY', 'NCR', 'AP', 'MP', 'UP', 'BLR', 'HYD', 'CT', 'G', 'D', 'R', 'V', 'II', 'III']);
  const SMALL = new Set(['of', 'and', 'for', 'the', 'in', 'to', 'at']);
  function pretty(name) {
    return String(name || '').toLowerCase().split(/(\s+|[(),/-])/).map((w, i) => {
      const up = w.toUpperCase();
      if (!/[a-z]/.test(w)) return w;
      if (ACRONYMS.has(up) || /\./.test(w)) return up;
      if (i && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }

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
    'Predict → shortlist → reminders → apply → track': 'प्रेडिक्ट → शॉर्टलिस्ट → रिमाइंडर → आवेदन → ट्रैक', 'College forms': 'कॉलेज फ़ॉर्म', 'Reported': 'रिपोर्टेड'
  };
  const t = s => (S.lang === 'hi' && HI[s]) || s;

  /* ---------- UI primitives ---------- */
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200);
  }
  const modal = {
    open(html, onMount) {
      $('#modalBody').onclick = null; $('#modalBody').innerHTML = html; const d = $('#modal'); if (!d.open) d.showModal(); onMount && onMount($('#modalBody')); },
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
    if (sb && user) {
      const { error } = await sb.from('requests').insert({ kind, payload });
      sent = !error;
    }
    if (C.formEndpoint) {
      try {
        const r = await fetch(C.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ kind, ...payload, at: new Date().toISOString() }) });
        sent = r.ok;
      } catch { sent = false; }
    }
    if (C.whatsapp && waText && !sent) { window.open(`https://wa.me/${C.whatsapp}?text=${encodeURIComponent(waText)}`, '_blank', 'noopener'); sent = true; }
    toast(sent ? 'Sent to the Everything CUET team ✓' : 'Saved on this device. Online booking opens soon.');
    return sent;
  }
  const waShare = text => `https://wa.me/?text=${encodeURIComponent(text)}`;

  /* ---------- accounts and leads ----------
     Browsing is open. Saving, reminders, predictor results, bookings and orders ask the student to log in
     (Google or a 6-digit email code through Supabase), then for name, phone and interests: that row is the lead.
     Without Supabase settings in config.js the same steps fall back to a short unverified form. */
  const SBC = C.supabase || {};
  let sb = null, user = null, pending = null, isAdmin = false;
  try {
    if (SBC.url && SBC.anonKey && window.supabase) sb = window.supabase.createClient(SBC.url, SBC.anonKey, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } });
  } catch (err) { console.warn('Supabase did not start', err); sb = null; }
  const loggedIn = () => (sb ? !!user : !!S.profile.phone);
  const profileDone = () => !!(S.profile.name && /\d{10}/.test(String(S.profile.phone).replace(/\D/g, '')));
  const YEARS = ['2026', '2027', '2028'];
  const INTERESTS = ['BA / Liberal arts', 'B.Com / Economics', 'BBA / Management (IPM)', 'B.Sc', 'B.Tech', 'Law', 'Design', 'Not sure yet'];

  function requireLogin(reason, then) {
    if (loggedIn() && profileDone()) { then && then(); return; }
    pending = then || null;
    S.afterLogin = location.hash || '#/'; save();
    modal.open(`<div id="loginBox"></div>`, el => drawLogin($('#loginBox', el), reason));
  }
  /* Kept for the places that used to ask for a phone number: now they log the student in, then send the request. */
  function askLead(reason) {
    requireLogin(reason, () => submit('alerts', { dreamList: S.dream.map(d => d.uni) },
      `Hi Everything CUET, please send me deadline alerts.\nName: ${S.profile.name}\nPhone: ${S.profile.phone}\nMy list: ${S.dream.map(d => d.uni).join(', ') || '—'}`));
  }

  function loginStart(reason) {
    if (!sb) return profileStep(reason, true);
    return `<div class="login">
      <img class="login-logo" src="assets/wordmark-red.png" alt="Everything CUET" width="720" height="325">
      <h2>${esc(reason || 'Log in to Everything CUET')}</h2>
      <p class="muted">Save your colleges, get deadline reminders and track every form. Free.</p>
      <button class="btn block google" data-act="google"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>
      <div class="or"><span>or use your email</span></div>
      <form data-form="email" class="stack">
        <label>Email<input name="email" type="email" required autocomplete="email" value="${esc(S.profile.email)}" placeholder="you@gmail.com"></label>
        <button class="btn pri block" type="submit">Send me a code</button>
      </form>
      <p class="fine">By continuing you agree to get reminders about your colleges. We never sell your number.</p>
    </div>`;
  }
  function codeStep(email) {
    return `<div class="login">
      <h2>Check your email</h2>
      <p class="muted">We sent a 6-digit code to <b>${esc(email)}</b>.</p>
      <form data-form="code" class="stack">
        <input class="otp" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required placeholder="••••••" aria-label="6-digit code">
        <button class="btn pri block" type="submit">Verify</button>
      </form>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn ghost sm" data-act="resend">Resend code</button><button class="btn ghost sm" data-act="back">Change email</button></div>
    </div>`;
  }
  function profileStep(reason, withEmail) {
    const p = S.profile;
    return `<div class="login">
      ${withEmail ? `<img class="login-logo" src="assets/wordmark-red.png" alt="Everything CUET" width="720" height="325">` : ''}
      <h2>${withEmail ? esc(reason || 'Log in to Everything CUET') : 'One last step'}</h2>
      <p class="muted">So we can remind you before every deadline.</p>
      <form data-form="profile" class="stack">
        <label>Full name<input name="name" required autocomplete="name" value="${esc(p.name)}"></label>
        <label>Mobile number<input name="phone" required inputmode="tel" autocomplete="tel" pattern="[+0-9 ]{10,15}" placeholder="10-digit mobile" value="${esc(p.phone)}"></label>
        ${withEmail ? `<label>Email<input name="email" type="email" autocomplete="email" value="${esc(p.email)}"></label>` : ''}
        <div class="form-grid">
          <label>Class 12 year<select name="class12_year">${YEARS.map(y => `<option ${String(p.class12_year || '2027') === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
          <label>${t('Your category')}<select name="category">${RES_CATS.map(c => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        </div>
        <div class="form-grid">
          <label>State<input name="state" value="${esc(p.state)}" placeholder="e.g. Delhi"></label>
          <label>Interested in<select name="interest">${INTERESTS.map(i => `<option ${p.interest === i ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
        </div>
        <label class="check"><input type="checkbox" name="whatsapp_ok" ${p.whatsapp_ok === false ? '' : 'checked'}>Send me reminders on WhatsApp</label>
        <button class="btn pri block" type="submit">${withEmail ? 'Continue' : 'Save and continue'}</button>
      </form>
    </div>`;
  }
  function drawLogin(box, reason, step) {
    step = step || (sb && user ? 'profile' : 'start');
    box.innerHTML = step === 'profile' ? profileStep(reason, !sb) : step.startsWith('code:') ? codeStep(step.slice(5)) : loginStart(reason);
    const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = on ? 'Please wait…' : btn.dataset.label; } };
    box.onclick = async e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'google') {
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
        if (error) toast(error.message);
      }
      if (a.dataset.act === 'back') drawLogin(box, reason, 'start');
      if (a.dataset.act === 'resend') { const { error } = await sb.auth.signInWithOtp({ email: S.profile.email, options: { shouldCreateUser: true } }); toast(error ? error.message : 'New code sent'); }
    };
    box.onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target)), btn = $('button[type=submit]', e.target);
      if (e.target.dataset.form === 'email') {
        busy(btn, true);
        const { error } = await sb.auth.signInWithOtp({ email: f.email.trim(), options: { shouldCreateUser: true } });
        busy(btn, false);
        if (error) { toast(error.message); return; }
        S.profile.email = f.email.trim(); save();
        drawLogin(box, reason, 'code:' + S.profile.email);
      }
      if (e.target.dataset.form === 'code') {
        busy(btn, true);
        const { error } = await sb.auth.verifyOtp({ email: S.profile.email, token: f.code.trim(), type: 'email' });
        busy(btn, false);
        if (error) toast('That code did not work. Check it or resend.');
        // onAuthStateChange takes it from here
      }
      if (e.target.dataset.form === 'profile') {
        if (!/\d{10}/.test(f.phone.replace(/\D/g, ''))) { toast('Enter a 10-digit mobile number'); return; }
        Object.assign(S.profile, { name: f.name.trim(), phone: f.phone.trim(), class12_year: f.class12_year, category: f.category, state: f.state.trim(), interest: f.interest, whatsapp_ok: !!f.whatsapp_ok, optIn: { wa: !!f.whatsapp_ok, mail: true } });
        if (f.email != null) S.profile.email = f.email.trim();
        S.leadAsked = true; save();
        busy(btn, true);
        if (sb && user) { const ok = await syncLead(); if (!ok) { busy(btn, false); toast('Could not save. Check your connection and try again.'); return; } }
        else await submit('lead', { profile: S.profile }, `Hi Everything CUET, I just signed up.\nName: ${S.profile.name}\nPhone: ${S.profile.phone}\nEmail: ${S.profile.email}\nClass 12: ${S.profile.class12_year}\nInterested in: ${S.profile.interest}`);
        finishLogin();
      }
    };
  }
  function finishLogin() {
    const go = S.afterLogin, then = pending;
    pending = null; S.afterLogin = null; save();
    modal.close();
    if (then) { then(); render(); }
    else if (go && go !== location.hash) location.hash = go;
    else render();
    toast(`Welcome${S.profile.name ? ', ' + S.profile.name.split(' ')[0] : ''} ✓`);
  }
  const compactDream = () => S.dream.map(d => ({ uni: d.uni, course: d.course, col: d.col, deadline: d.deadline, status: d.status || 0 }));
  async function syncLead() {
    if (!sb || !user) return false;
    const p = S.profile;
    const { error } = await sb.from('leads').upsert({
      id: user.id, email: user.email || p.email, name: p.name, phone: p.phone, class12_year: p.class12_year, category: p.category, state: p.state,
      interest: p.interest, whatsapp_ok: p.whatsapp_ok !== false, dream_list: compactDream(), source: location.host + location.pathname, updated_at: new Date().toISOString()
    });
    if (error) console.warn('lead not saved', error);
    return !error;
  }
  let syncTimer = null;
  function syncSoon() { if (sb && user && profileDone()) { clearTimeout(syncTimer); syncTimer = setTimeout(syncLead, 1500); } }
  async function onSignedIn() {
    const { data } = await sb.from('leads').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      ['name', 'phone', 'class12_year', 'category', 'state', 'interest', 'whatsapp_ok'].forEach(k => { if (data[k] != null && data[k] !== '') S.profile[k] = data[k]; });
      if (!S.dream.length && Array.isArray(data.dream_list) && data.dream_list.length) {
        S.dream = data.dream_list.map(d => ({ id: uid(), uniId: '', uni: d.uni, college: '', course: d.course || '', col: d.col || 'target', deadline: d.deadline || '', cutoff: null, predicted: null, gap: null, eligible: null, fees: null, hostel: null, portal: '', status: d.status || 0, docs: {}, notes: '', added: Date.now() }));
      }
    }
    S.profile.email = user.email || S.profile.email; save();
    isAdmin = !!(await sb.rpc('is_admin')).data;
    if (!profileDone()) { modal.open(`<div id="loginBox"></div>`, el => drawLogin($('#loginBox', el), '', 'profile')); return; }
    if (S.dream.length) syncSoon();
    if (pending || S.afterLogin) finishLogin(); else render();
  }
  async function initAuth() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    if (/[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + (S.afterLogin || location.hash));
    sb.auth.onAuthStateChange((ev, session) => {
      const was = user; user = session ? session.user : null;
      if (!was && user) setTimeout(onSignedIn, 0);
      if (was && !user) { isAdmin = false; render(); }
    });
    if (user) await onSignedIn();
  }
  async function signOut() {
    if (sb) await sb.auth.signOut();
    S.profile = defaults().profile; S.leadAsked = false; save(); user = null; isAdmin = false;
    toast('Signed out'); location.hash = '#/';
  }

  /* ---------- router ---------- */
  const ico = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const TABS = [['', 'Home', 'home'], ['colleges', 'Colleges', 'cap'], ['dream', 'My List', 'star'], ['calendar', 'Deadlines', 'cal'], ['more', 'More', 'grid']];
  const TAB_OF = { college: 'colleges', forms: 'colleges', applications: 'dream', parent: 'dream', login: 'more', account: 'more', admin: 'more' };
  const TITLES = { '': 'Home', colleges: 'Colleges', forms: 'Colleges', college: 'College', dream: 'My List', applications: 'My List', calendar: 'Deadlines', more: 'More', predictor: 'Find my colleges', tools: 'Tools', resources: 'CUET guide', seniors: 'Talk to a senior', community: 'Community', pricing: 'Plans', parent: 'Parent view', login: 'Log in', account: 'Account', admin: 'Leads' };
  const NAV = Object.entries(TITLES).map(([r, l]) => [r, l]);
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    return { route: parts[0] || '', arg: parts.slice(1).join('/'), q: new URLSearchParams(qs || '') };
  }
  const ROUTES = {};
  function renderTabs(route) {
    const tab = route in TAB_OF ? TAB_OF[route] : TABS.some(x => x[0] === route) ? route : 'more';
    $('#tabs').innerHTML = TABS.map(([r, l, i]) => `<a href="#/${r}" ${r === tab ? 'aria-current="page"' : ''}>${ico(i)}<span>${t(l)}</span>${r === 'dream' && S.dream.length ? `<span class="badge">${S.dream.length}</span>` : ''}</a>`).join('');
  }
  function render() {
    let { route, arg, q } = parseHash();
    if (!ROUTES[route]) route = '';
    document.documentElement.lang = S.lang;
    renderTabs(route);
    const title = t(TITLES[route] || 'Everything CUET');
    $('#barTitle').textContent = route ? title : '';
    $('#langBtn').textContent = S.lang === 'hi' ? 'EN' : 'हि';
    const acct = $('#acctBtn'), inAs = loggedIn() && profileDone();
    acct.href = inAs ? '#/account' : '#/login';
    acct.textContent = inAs ? (S.profile.name || '?')[0].toUpperCase() : 'Log in';
    acct.classList.toggle('me', inAs);
    acct.setAttribute('aria-label', inAs ? 'Your account' : 'Log in');
    $('[data-t="bot.title"]').textContent = t('Admission assistant');
    // A fresh element each time, so a page's listeners never pile up on re-render.
    const old = $('#view'), view = old.cloneNode(false);
    old.replaceWith(view);
    view.innerHTML = ROUTES[route](arg, q) || '';
    const mount = ROUTES[route + ':mount'];
    mount && mount(arg, q);
    document.title = (route ? title + ' · ' : '') + 'Everything CUET';
    renderFoot(); updateCart(); tick();
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  window.addEventListener('scroll', () => $('#bar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });

  /* ---------- shared bits ---------- */
  function upcomingEvents(onlyMine) {
    const now = Date.now();
    const evs = [];
    ((D.events && D.events.events) || []).forEach(e => evs.push({ ...e, kind: 'master' }));
    const sch = off().schedule || {};
    (sch.rows || []).filter(r => r.startDate || r.endDate).forEach((r, i) => evs.push({
      id: 'nta-' + i, title: `CUET (UG) ${off().cycle || ''}: ${r.event}`.replace('  ', ' '), group: 'NTA', kind: 'master', status: 'official',
      date: r.startDate || r.endDate, end: r.startDate ? r.endDate : null, note: r.notes || '', source: firstUrl(sch.source)
    }));
    S.customEvents.forEach(e => evs.push({ ...e, kind: 'custom', status: 'yours' }));
    forms().forEach(f => f.deadlines.forEach((d, i) => evs.push({ id: `form-${f.id}-${i}`, title: `${f.name}: ${d.label}`, group: f.name, date: d.date, status: 'reported', kind: 'master', formId: f.id, note: 'Reported date — confirm on the official site.', source: d.source })));
    const formDates = new Set(forms().flatMap(f => f.deadlines.map(d => norm(f.name) + '|' + evDate(d).getTime())));
    S.dream.filter(d => d.deadline && !formDates.has(norm(d.uni) + '|' + new Date(d.deadline).getTime())).forEach(d => evs.push({ id: 'dl-' + d.id, title: `${d.uni}${d.course ? ' – ' + d.course : ''}: application deadline`, group: d.uni, date: d.deadline, status: 'yours', kind: 'dream', dreamId: d.id, source: d.portal }));
    const mine = new Set(S.dream.map(d => norm(d.uni)));
    return evs
      .filter(e => !onlyMine || e.kind !== 'master' || e.group === 'NTA' || mine.has(norm(e.group)))
      .map(e => ({ ...e, when: evDate(e) }))
      .sort((a, b) => a.when - b.when)
      .map(e => ({ ...e, past: (e.end ? new Date(/T/.test(e.end) ? e.end : e.end + 'T23:59:59+05:30') : e.when) < now }));
  }
  const statusTag = s => ({ reported: `<span class="tag target">${t('Reported')}</span>`, official: `<span class="tag safe">${t('Official')}</span>`, expected: `<span class="tag sun">${t('Expected')}</span>`, past: `<span class="tag">${t('Last year')}</span>`, yours: `<span class="tag dream">Yours</span>` }[s] || '');
  function inDream(uniName) { return S.dream.some(d => norm(d.uni) === norm(uniName)); }

  function addToDream(prefill) {
    if (!(loggedIn() && profileDone())) { requireLogin('Log in to save your list', () => addToDream(prefill)); return; }
    const p = Object.assign({ col: 'target' }, prefill);
    modal.open(`
      <h2>${t('Add to Dream List')}</h2>
      <form id="dreamForm" class="stack">
        <label>University<input name="uni" required value="${esc(p.uni || '')}" list="uniList" placeholder="Start typing a university"></label>
        <datalist id="uniList">${unis().slice(0, 2000).map(u => `<option value="${esc(pretty(u.name))}">`).join('')}</datalist>
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
        if (u) f.uni = pretty(u.name);
        S.dream.push({
          id: uid(), uniId: u ? u.id : (p.uniId || ''), uni: f.uni.trim(), college: f.college.trim(), course: f.course.trim(), col: f.col,
          deadline: f.deadline, cutoff: num(f.cutoff), predicted: p.predicted ?? null, gap: p.gap ?? null, eligible: p.eligible ?? null,
          fees: num(f.fees), hostel: f.hostel === 'yes' ? true : f.hostel === 'no' ? false : null, portal: f.portal, status: 0, docs: {}, notes: '', added: Date.now()
        });
        save(); modal.close(); toast('Added to your Dream List ✓'); render();
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
    $('#cartBtn').hidden = !S.cart.length;
    $('#cartCount').textContent = S.cart.length;
  }
  /* One tap adds a college or form to My List; a second tap removes it. */
  function toggleStar(p, done) {
    const i = S.dream.findIndex(d => norm(d.uni) === norm(p.uni));
    if (i < 0 && !(loggedIn() && profileDone())) { requireLogin('Log in to save your list', () => { toggleStar(p); done && done(); }); return false; }
    if (i >= 0) { S.dream.splice(i, 1); save(); toast('Removed from My List'); }
    else {
      S.dream.push({ id: uid(), uniId: p.uniId || '', uni: p.uni, college: '', course: '', col: p.col || 'target', deadline: p.deadline || '', cutoff: null, predicted: null, gap: null, eligible: null, fees: null, hostel: null, portal: p.portal || '', status: 0, docs: {}, notes: '', added: Date.now() });
      save(); toast('★ Added to My List');
    }
    renderTabs(parseHash().route);
    return i < 0;
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
  const greet = () => { const h = +new Date().toLocaleString('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const daysLeft = d => { const n = Math.ceil((d - Date.now()) / 864e5); return n <= 1 ? (n <= 0 ? 'Today' : '1 day left') : n + ' days left'; };
  function homeStats() {
    const sum = ((off().stats && off().stats.blocks) || [])[0];
    if (!sum) return '';
    const v = name => (sum.rows.find(r => r[0] === name) || [])[2];
    return `<section class="section"><div class="section-head"><h2>CUET ${esc(off().cycle)} in numbers</h2><a href="#/resources">Guide</a></div><div class="stats">
      <div class="stat"><b>${unis().length || v('No. of universities')}</b><span>universities</span></div>
      <div class="stat"><b>${lakh(v('Registered candidates (unique)'))}</b><span>students</span></div>
      <div class="stat"><b>${offRows('subjects').length}</b><span>subjects</span></div>
      <div class="stat"><b>${v('Exam cities')}</b><span>exam cities</span></div></div></section>`;
  }
  ROUTES[''] = () => {
    const upcoming = upcomingEvents(!!S.dream.length).filter(e => !e.past);
    const next = upcoming[0] || upcomingEvents(false).find(e => !e.past);
    const closing = forms().filter(f => formStatus(f) === 'open').map(f => ({ f, nd: nextDeadline(f) })).filter(x => x.nd).sort((a, b) => a.nd.when - b.nd.when).slice(0, 6);
    const name = (S.profile.name || '').split(' ')[0];
    return `<div class="page"><div class="wrap">
      <section class="hello">
        <div class="eyebrow">✦ ${t('Free · No login')}</div>
        <h1>${esc(greet())}${name ? ', ' + esc(name) : ''}</h1>
        <p>Find your college. Never miss a form.</p>
        <form class="search" id="heroSearch" role="search">${ico('search')}<input name="q" placeholder="Search ${unis().length || ''} universities" aria-label="Search colleges"></form>
      </section>
      ${next ? `<a class="card next" href="#/calendar${S.dream.length ? '?mine=1' : ''}" style="color:inherit;text-decoration:none">
        <div class="lbl"><span class="eyebrow" style="margin:0">${S.dream.length ? 'Your next deadline' : 'Next deadline'}</span>${statusTag(next.status)}</div>
        <h3>${esc(next.title)}</h3>
        ${countdown(next.when.toISOString(), true)}
      </a>` : ''}
      <section class="section"><div class="tiles">
        ${[['predictor', 'bolt', 'Find my colleges'], ['forms', 'cap', 'Open forms'], ['dream', 'star', 'My List'], ['tools/marks', 'grid', 'Marks calculator']]
          .map(([r, i, l]) => `<a class="tile" href="#/${r}"><span class="av">${ico(i)}</span>${t(l)}</a>`).join('')}
      </div></section>
      ${closing.length ? `<section class="section"><div class="section-head"><h2>Forms closing soon</h2><a href="#/forms">See all</a></div>
        <div class="hscroll cards">${closing.map(({ f, nd }) => `<a class="card fcard" href="#/forms?open=${esc(f.id)}" style="color:inherit;text-decoration:none">
          <div class="row between"><span class="tag safe">Open</span><span class="days">${daysLeft(nd.when)}</span></div>
          <h3 style="margin:0">${esc(f.name)}</h3><small>${esc(nd.label)} · ${fmtDate(nd.when)}</small></a>`).join('')}</div></section>` : ''}
      ${homeStats()}
      <section class="section"><div class="cta-band"><div><h3>We'll fill your forms</h3><p>${inr(P.assistedForm)} a form · ${Math.round(P.bundleDiscount * 100)}% off on ${P.bundleMinForms}+</p></div><a class="btn white" href="#/pricing">See plans</a></div></section>
      <section class="section"><form class="card" id="alertForm"><h2>${t('Get free deadline alerts')}</h2>
        <div class="form-grid"><label>${t('Phone')}<input name="phone" inputmode="tel" value="${esc(S.profile.phone)}" placeholder="10-digit mobile"></label><label>${t('Email')}<input name="email" type="email" value="${esc(S.profile.email)}"></label></div>
        <button class="btn dark block" style="margin-top:12px" type="submit">Notify me</button></form></section>
    </div></div>`;
  };
  ROUTES[':mount'] = () => {
    $('#heroSearch').addEventListener('submit', e => {
      e.preventDefault();
      const v = String(new FormData(e.target).get('q') || '').trim();
      location.hash = '#/colleges' + (v ? '?q=' + encodeURIComponent(v) : '');
    });
    $('#alertForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (sb) { askLead('Log in to get deadline alerts'); return; }
      const f = new FormData(e.target);
      Object.assign(S.profile, { phone: f.get('phone').trim(), email: f.get('email').trim() });
      if (!S.profile.phone && !S.profile.email) { toast('Add a phone number or email'); return; }
      S.leadAsked = true; save();
      await submit('alerts', { profile: S.profile }, `Hi Everything CUET, please send me free deadline alerts.\nPhone: ${S.profile.phone}\nEmail: ${S.profile.email}`);
    });
  };

  /* Colleges: NTA participating universities, and colleges with their own forms */
  const initials = n => pretty(n).replace(/\b(of|and|the|for|in|university|universities)\b/gi, ' ').split(/[^A-Za-z]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '✦';
  const collegeSeg = active => `<nav class="seg" aria-label="Colleges"><a href="#/colleges" ${active === 'unis' ? 'aria-current="page"' : ''}>Universities <small>${unis().length}</small></a><a href="#/forms" ${active === 'forms' ? 'aria-current="page"' : ''}>Forms 2027 <small>${forms().length}</small></a></nav>`;
  const starBtn = (key, on, label) => `<button class="star-btn ${on ? 'on' : ''}" type="button" data-star="${esc(key)}" aria-pressed="${on}" aria-label="${on ? 'Remove ' : 'Add '}${esc(label)} ${on ? 'from' : 'to'} My List">${ico('star')}</button>`;
  function ntaPending() {
    return `<div class="notice"><span>NTA's university list hasn't been imported yet. <a href="${NTA_UNIS}" target="_blank" rel="noopener">See it on cuet.nta.nic.in</a>.</span></div>`;
  }
  function formSheet(f) {
    const s = formStatus(f), [sl, sc] = FORM_STATUS[s], nd = nextDeadline(f);
    modal.open(`
      <div class="meta row" style="gap:6px;margin-bottom:8px"><span class="tag ${sc}">${sl}</span>${f.acceptsCuet ? '<span class="tag safe">Accepts CUET</span>' : ''}<span class="tag">${esc(f.type)}</span></div>
      <h2 style="margin-bottom:2px">${esc(f.name)}</h2>
      <p class="muted" style="margin:0 0 14px">${esc(f.city)}</p>
      ${nd ? `<div class="card flat cd-card" style="margin-bottom:14px"><div class="row between"><b>${esc(nd.label)}</b><small>${fmtDate(nd.when)}</small></div>${countdown(nd.when.toISOString(), true)}
        <small>${ico('info', 'sm')} Reported date — <a href="${esc(nd.source)}" target="_blank" rel="noopener">source</a>. Confirm on the official site.</small></div>` : ''}
      <p style="margin-bottom:6px"><b>How to get in:</b> ${esc(f.entrance)}</p>
      ${f.note ? `<p class="muted" style="font-size:.88rem">${esc(f.note)}</p>` : ''}
      ${f.deadlines.length > 1 ? `<details style="margin-bottom:12px"><summary class="muted" style="font-weight:700;font-size:.85rem">All dates (${f.deadlines.length})</summary><div class="list" style="margin-top:8px">${f.deadlines.map(d => `<a class="list-row" href="${esc(d.source)}" target="_blank" rel="noopener" style="min-height:52px"><span class="grow"><span class="t">${esc(d.label)}</span></span><small>${fmtDate(evDate(d))}</small></a>`).join('')}</div></details>` : ''}
      <div class="list" style="margin-bottom:14px">${f.links.map(([l, u]) => `<a class="list-row" href="${esc(u)}" target="_blank" rel="noopener" style="min-height:52px"><span class="grow"><span class="t">${esc(l)}</span></span>${ico('out', 'sm chev')}</a>`).join('')}</div>
      <div class="row">
        <button class="btn pri" data-act="fstar">${inDream(f.name) ? '★ On My List' : '☆ Add to My List'}</button>
        ${s !== 'closed' ? `<button class="btn sun" data-act="fassist">We'll fill it · ${inr(P.assistedForm)}</button>` : ''}
      </div>`, el => {
      el.onclick = e => {
        if (e.target.closest('[data-act="fstar"]') && !inDream(f.name) && !(loggedIn() && profileDone())) { requireLogin('Log in to save your list', () => toggleStar({ uni: f.name, portal: f.links[0][1], deadline: nd ? toLocalInput(nd.when) : '', col: 'dream' })); return; }
        if (e.target.closest('[data-act="fstar"]')) { toggleStar({ uni: f.name, portal: f.links[0][1], deadline: nd ? toLocalInput(nd.when) : '', col: 'dream' }); modal.close(); render(); }
        if (e.target.closest('[data-act="fassist"]')) { addCart({ type: 'form', label: `${f.name} application form`, price: P.assistedForm }); modal.close(); }
      };
      tick();
    });
  }
  ROUTES.forms = (arg, q) => {
    const counts = {};
    forms().forEach(f => { const k = formStatus(f); counts[k] = (counts[k] || 0) + 1; });
    return `<div class="page"><div class="wrap">
      ${collegeSeg('forms')}
      <div class="search" style="margin-bottom:12px">${ico('search')}<input id="fq" placeholder="Search forms" aria-label="Search forms"></div>
      <div class="hscroll" id="fst" style="margin-bottom:14px">
        <button class="chip on" data-st="">${t('All')}</button>
        ${Object.entries(FORM_STATUS).filter(([k]) => counts[k]).map(([k, [l]]) => `<button class="chip" data-st="${k}">${l} <b>${counts[k]}</b></button>`).join('')}
        <button class="chip" id="fcuet" aria-pressed="false">Accepts CUET</button>
      </div>
      <div class="grid g3" id="flist" style="align-items:start"></div>
      <p class="muted" style="font-size:.78rem;margin-top:14px">Links go to official sites. Deadlines are reported dates; tap a form to see the source.</p>
    </div></div>`;
  };
  ROUTES['forms:mount'] = (arg, q) => {
    let st = '', cuet = false;
    const order = { open: 0, upcoming: 1, check: 2, closed: 3 };
    const draw = () => {
      const term = norm($('#fq').value);
      const list = forms().filter(f => (!st || formStatus(f) === st) && (!cuet || f.acceptsCuet) && (!term || norm([f.name, f.city, f.type, f.entrance].join(' ')).includes(term)))
        .sort((a, b) => order[formStatus(a)] - order[formStatus(b)] || ((nextDeadline(a) || {}).when || 9e15) - ((nextDeadline(b) || {}).when || 9e15) || cmp(a.name, b.name));
      $('#flist').innerHTML = list.map(f => {
        const s = formStatus(f), [sl, sc] = FORM_STATUS[s], nd = nextDeadline(f);
        return `<article class="card uni" data-form="${esc(f.id)}" tabindex="0" role="button" aria-label="${esc(f.name)}" style="cursor:pointer">
          <div class="meta"><span class="tag ${sc}">${sl}</span>${f.acceptsCuet ? '<span class="tag safe">CUET</span>' : ''}<span style="flex:1"></span>${nd ? `<span class="days">${daysLeft(nd.when)}</span>` : ''}</div>
          <div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:12px"><div class="grow" style="flex:1;min-width:0"><h3>${esc(f.name)}</h3><small>${esc(f.city)}</small></div>${starBtn(f.id, inDream(f.name), f.name)}</div>
          ${nd ? `<small><b style="color:var(--ink)">${esc(nd.label)}</b> · ${fmtDate(nd.when)}</small>` : `<small>${esc(f.type)}</small>`}
        </article>`;
      }).join('') || `<div class="empty" style="grid-column:1/-1"><b>No match</b>Try another search or filter.</div>`;
    };
    $('#fq').addEventListener('input', draw);
    $('#fst').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      if (b.id === 'fcuet') { cuet = !cuet; b.classList.toggle('on', cuet); b.setAttribute('aria-pressed', cuet); }
      else { st = b.dataset.st; $$('#fst [data-st]').forEach(c => c.classList.toggle('on', c === b)); }
      draw();
    });
    const open = e => {
      const card = e.target.closest('[data-form]'); if (!card) return;
      const f = forms().find(x => x.id === card.dataset.form);
      if (e.target.closest('[data-star]')) { const nd = nextDeadline(f); toggleStar({ uni: f.name, portal: f.links[0][1], deadline: nd ? toLocalInput(nd.when) : '', col: 'dream' }); draw(); return; }
      formSheet(f);
    };
    $('#flist').addEventListener('click', open);
    $('#flist').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-form]')) open(e); });
    draw();
    const want = forms().find(f => f.id === q.get('open'));
    if (want) formSheet(want);
  };

  ROUTES.colleges = (arg, q) => {
    const counts = {};
    unis().forEach(u => { counts[u.category] = (counts[u.category] || 0) + 1; });
    const cat = q.get('cat') || '';
    return `<div class="page"><div class="wrap">
      ${collegeSeg('unis')}
      ${unis().length ? '' : ntaPending()}
      <div class="search" style="margin-bottom:12px">${ico('search')}<input id="uq" value="${esc(q.get('q') || '')}" placeholder="${t('Search universities')}" aria-label="${t('Search universities')}"></div>
      <div class="hscroll" id="ucat" style="margin-bottom:14px">
        <button class="chip ${!cat ? 'on' : ''}" data-cat="">${t('All')}</button>
        ${CATS.map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-cat="${c}">${c === 'Government / other' ? 'Govt. & other' : c} <b>${counts[c] || 0}</b></button>`).join('')}
        <button class="chip ${S.compare.length ? '' : 'hide-empty'}" id="cmpBtn" ${S.compare.length ? '' : 'hidden'}>Compare <b>${S.compare.length}</b></button>
      </div>
      <div id="umatch"></div>
      <div class="list" id="ulist"></div>
      <div class="pager" id="upager"></div>
      ${unis().length ? `<p class="muted" style="font-size:.78rem;margin-top:14px">Source: <a href="${esc(D.universities.source)}" target="_blank" rel="noopener">NTA</a> · CUET (UG) ${esc(D.universities.cycle)} list</p>` : ''}
    </div></div>`;
  };
  ROUTES['colleges:mount'] = (arg, q) => {
    let cat = q.get('cat') || '', lim = 40;
    const draw = () => {
      const term = norm($('#uq').value);
      const list = unis().filter(u => (!cat || u.category === cat) && (!term || norm(pretty(u.name) + ' ' + u.name + ' ' + u.state).includes(term)));
      const fm = term ? forms().filter(f => norm(f.name + ' ' + f.city).includes(term)).slice(0, 4) : [];
      $('#umatch').innerHTML = fm.length ? `<div class="section-head" style="margin-top:0"><h3 style="margin:0">Forms</h3><a href="#/forms">All forms</a></div><div class="list" style="margin-bottom:16px">${fm.map(f => `<a class="list-row" href="#/forms?open=${esc(f.id)}"><span class="av">${ico('cap')}</span><span class="grow"><span class="t">${esc(f.name)}</span><span class="s"><span class="tag ${FORM_STATUS[formStatus(f)][1]}">${FORM_STATUS[formStatus(f)][0]}</span></span></span>${ico('right', 'chev')}</a>`).join('')}</div>${list.length ? '<h3>Universities</h3>' : ''}` : '';
      $('#ulist').hidden = !list.length && !!fm.length;
      $('#ulist').innerHTML = list.slice(0, lim).map(u => `
        <div class="list-row">
          <a href="#/college/${esc(u.id)}" style="display:flex;gap:12px;align-items:center;flex:1;min-width:0;color:inherit;text-decoration:none">
            <span class="av">${esc(initials(u.name))}</span>
            <span class="grow"><span class="t">${esc(pretty(u.name))}</span><span class="s">${esc(u.category)}${S.compare.includes(u.id) ? ' · <span class="tag target">Comparing</span>' : ''}</span></span>
          </a>
          ${starBtn(u.id, inDream(pretty(u.name)), pretty(u.name))}
        </div>`).join('') || (unis().length ? `<div class="empty" style="border:0"><b>No match</b>Try another name.</div>` : '');
      $('#upager').innerHTML = list.length > lim ? `<button class="btn" data-more>Show more · ${list.length - lim} left</button>` : (list.length ? `<span>${list.length} universities</span>` : '');
    };
    $('#uq').addEventListener('input', () => { lim = 40; draw(); });
    $('#ucat').addEventListener('click', e => {
      if (e.target.closest('#cmpBtn')) { location.hash = '#/tools/compare'; return; }
      const b = e.target.closest('[data-cat]'); if (!b) return;
      cat = b.dataset.cat; lim = 40;
      $$('#ucat [data-cat]').forEach(c => c.classList.toggle('on', c === b)); draw();
    });
    $('#upager').addEventListener('click', e => { if (e.target.closest('[data-more]')) { lim += 60; draw(); } });
    $('#ulist').addEventListener('click', e => {
      const b = e.target.closest('[data-star]'); if (!b) return;
      const u = uniById(b.dataset.star);
      const on = toggleStar({ uni: pretty(u.name), uniId: u.id, portal: u.website });
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    draw();
  };

  ROUTES.college = id => {
    const u = uniById(id);
    if (!u) return `<div class="page"><div class="wrap"><div class="empty"><b>University not found</b><a href="#/colleges">Back to colleges</a></div></div></div>`;
    const rows = cutRows().filter(r => norm(r.university) === norm(u.name));
    const promo = (C.partnerCodes || []).filter(p => norm(p.college) === norm(u.name));
    const group = (C.groups || []).find(g => norm(g.university) === norm(u.name));
    const name = pretty(u.name), on = inDream(name);
    return `<div class="page"><div class="wrap">
      <section class="hello">
        <div class="eyebrow">✦ ${esc(u.category)} university</div>
        <h1>${esc(name)}</h1>
        <p style="font-size:.85rem">On NTA's CUET (UG) list as “${esc(u.name)}”</p>
        <div class="row">
          <button class="btn pri" data-act="star">${on ? '★ On My List' : '☆ Add to My List'}</button>
          ${u.website ? `<a class="btn" href="${esc(u.website)}" target="_blank" rel="noopener">Website ${ico('out', 'sm')}</a>` : ''}
        </div>
      </section>
      <div class="list section">
        <button class="list-row" data-act="assist"><span class="av">${ico('bolt')}</span><span class="grow"><span class="t">We'll fill your form</span><span class="s">${inr(P.assistedForm)} · checked twice, before the deadline</span></span>${ico('plus', 'chev')}</button>
        <a class="list-row" href="#/seniors?college=${encodeURIComponent(name)}"><span class="av">${ico('chat')}</span><span class="grow"><span class="t">${t('Talk to a senior')}</span><span class="s">${inr(P.seniorCall)} for 20 minutes</span></span>${ico('right', 'chev')}</a>
        ${group ? `<a class="list-row" href="${esc(group.link)}" target="_blank" rel="noopener"><span class="av">${ico('cap')}</span><span class="grow"><span class="t">Join the student group</span></span>${ico('out', 'chev')}</a>`
          : `<a class="list-row" href="#/community?college=${encodeURIComponent(name)}"><span class="av">${ico('cap')}</span><span class="grow"><span class="t">Ask for a student group</span></span>${ico('right', 'chev')}</a>`}
        <button class="list-row" data-act="compare"><span class="av">${ico('grid')}</span><span class="grow"><span class="t">${S.compare.includes(u.id) ? 'In compare' : 'Compare'}</span><span class="s">Side by side with up to 3</span></span>${ico(S.compare.includes(u.id) ? 'check' : 'plus', 'chev')}</button>
      </div>
      ${promo.map(p => `<div class="card section"><div class="eyebrow">Partner offer</div><h3>${esc(p.saving)}</h3><div class="row"><b style="font-size:1.1rem;letter-spacing:.04em">${esc(p.code)}</b><button class="btn sm" data-copy="${esc(p.code)}">Copy</button>${p.url ? `<a class="btn sm pri" href="${esc(p.url)}" target="_blank" rel="noopener">Apply</a>` : ''}</div></div>`).join('')}
      <section class="section"><div class="section-head"><h2>Cutoffs</h2></div>
        ${rows.length ? `<div class="table-wrap"><table><tr><th>Course</th><th>Cat.</th><th>Round</th><th>Cutoff</th></tr>
          ${rows.slice(0, 60).map(r => `<tr><td><b>${esc(r.program)}</b><br><small>${esc(r.college)}</small></td><td>${esc(r.category)}</td><td>${esc(r.round)}</td><td class="num">${esc(r.cutoff)}</td></tr>`).join('')}</table></div>`
          : `<div class="notice"><span>Cutoffs for this university are coming soon, from official allotment lists only.</span></div>`}
      </section>
      ${(C.youtubeVideos || []).length ? `<section class="section"><iframe style="width:100%;aspect-ratio:16/9;border:0;border-radius:18px" src="https://www.youtube-nocookie.com/embed/${esc(C.youtubeVideos[0])}" title="Everything CUET video" allowfullscreen loading="lazy"></iframe></section>` : ''}
    </div></div>`;
  };
  ROUTES['college:mount'] = id => {
    const u = uniById(id); if (!u) return;
    $('#view').addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'star') { toggleStar({ uni: pretty(u.name), uniId: u.id, portal: u.website }); render(); }
      if (a && a.dataset.act === 'assist') addCart({ type: 'form', label: `${pretty(u.name)} application form`, price: P.assistedForm });
      if (a && a.dataset.act === 'compare') {
        S.compare = S.compare.includes(u.id) ? S.compare.filter(x => x !== u.id) : [...S.compare, u.id].slice(-3);
        save(); toast(S.compare.includes(u.id) ? 'Added to compare' : 'Removed from compare'); render();
      }
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
      <datalist id="subjList">${subjectNames().map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
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
    form.addEventListener('submit', e => { e.preventDefault(); show.lim = {}; requireLogin('Log in to see your colleges', () => setTimeout(() => $('#predForm') && $('#predForm').requestSubmit(), 0)); });
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
  const listSeg = active => `<nav class="seg" aria-label="My List"><a href="#/dream" ${active === 'board' ? 'aria-current="page"' : ''}>Board <small>${S.dream.length}</small></a><a href="#/applications" ${active === 'tracker' ? 'aria-current="page"' : ''}>Tracker</a></nav>`;
  const emptyList = () => `<div class="empty"><b>Your list is empty</b>Tap ☆ on any college or form to add it here.
    <div class="row" style="justify-content:center;margin-top:14px"><a class="btn pri" href="#/colleges">Browse colleges</a><a class="btn" href="#/forms">Open forms</a></div></div>`;
  ROUTES.dream = (arg, q) => {
    const list = orderedDream();
    if (!list.length) return `<div class="page"><div class="wrap">${listSeg('board')}${emptyList()}</div></div>`;
    const show = q.get('col') || (COLS.find(([k]) => list.some(d => d.col === k)) || COLS[0])[0];
    return `<div class="page"><div class="wrap">
      ${listSeg('board')}
      <nav class="seg col-tabs no-print">${COLS.map(([k, l]) => `<a href="#/dream?col=${k}" ${k === show ? 'aria-current="page"' : ''}>${t(l)} <small>${list.filter(d => d.col === k).length}</small></a>`).join('')}</nav>
      <div class="board no-print" data-show="${show}">${COLS.map(([k, l]) => {
        const items = list.filter(d => d.col === k);
        return `<section class="col" data-col="${k}"><div class="col-head"><h3>${t(l)}</h3><span class="tag ${k}">${items.length}</span></div>
          ${items.map(dreamCard).join('') || `<div class="empty" style="padding:22px 12px;border:0;background:transparent">Nothing in ${t(l)} yet</div>`}</section>`;
      }).join('')}</div>
      <div class="row no-print" style="margin-top:12px"><button class="btn sm" data-act="add">${ico('plus', 'sm')} Add manually</button></div>

      <section class="section card no-print">
        <div class="section-head"><h2>Preference order</h2><span class="tag">Dream → Safe</span></div>
        <div class="row" style="margin-bottom:6px"><label class="check"><input type="checkbox" id="fHostel">Hostel only</label><label class="row" style="gap:6px">Max fee ₹<input id="fFee" inputmode="numeric" style="width:110px;margin:0;min-height:38px"></label></div>
        <ol id="prefList" style="margin:10px 0 14px;padding-left:22px"></ol>
        <div class="row">
          <button class="btn pri sm" data-act="print">Print</button>
          <button class="btn sm" data-act="copy">Copy</button>
          <a class="btn sm" id="waList" target="_blank" rel="noopener">WhatsApp</a>
          <button class="btn sm" data-act="parent">Parent link</button>
          <button class="btn sm sun" data-act="review">Expert review · ${inr(P.csasPro)}</button>
        </div>
      </section>
      <div class="print-only"><h1>My CSAS preference order — Everything CUET</h1><p>${esc(S.profile.name)} · ${new Date().toLocaleDateString('en-IN')}</p><ol id="printList"></ol></div>
    </div></div>`;
  };
  ROUTES['dream:mount'] = () => {
    if (!$('#prefList')) return;
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
  let calEvents = [];
  ROUTES.calendar = (arg, q) => {
    const mine = q.get('mine') === '1', past = q.get('past') === '1';
    calEvents = upcomingEvents(mine).filter(e => past || !e.past);
    const months = [];
    calEvents.forEach((e, i) => {
      const m = ist(e.when, { month: 'long', year: 'numeric' });
      if (!months.length || months[months.length - 1].m !== m) months.push({ m, items: [] });
      months[months.length - 1].items.push([e, i]);
    });
    const link = (m, p) => `#/calendar?${[m && 'mine=1', p && 'past=1'].filter(Boolean).join('&')}`;
    return `<div class="page"><div class="wrap">
      <div class="hscroll no-print" style="margin-bottom:14px">
        <a class="chip ${!mine ? 'on' : ''}" href="${link(false, past)}">${t('All')}</a>
        <a class="chip ${mine ? 'on' : ''}" href="${link(true, past)}">${t('Only my list')}</a>
        <a class="chip ${past ? 'on' : ''}" href="${link(mine, !past)}">Past dates</a>
        <button class="chip" data-act="add-ev">${ico('plus', 'sm')} Add</button>
      </div>
      <div class="card no-print" style="margin-bottom:18px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span class="av">${ico('cal')}</span>
        <div style="flex:1;min-width:160px"><b>Never miss a date</b><br><small>Reminders 7 days, 2 days and on the day</small></div>
        <div class="row" style="gap:6px"><button class="btn sm" data-act="notify">${S.notify ? '✓ On' : 'This device'}</button><button class="btn sm" data-act="ics">Calendar app</button><button class="btn sm pri" data-act="alerts">WhatsApp</button></div>
      </div>
      ${months.map(({ m, items }) => `<div class="month">${esc(m)}</div><div class="list">${items.map(([e, i]) => `
        <button class="list-row ${e.past ? 'past' : ''}" data-ev="${i}">
          <span class="date-box"><b>${ist(e.when, { day: 'numeric' })}</b><small>${ist(e.when, { month: 'short' })}</small></span>
          <span class="grow"><span class="t">${esc(e.title)}</span><span class="s">${statusTag(e.status)}${!e.past ? `<span class="days">${daysLeft(e.when)}</span>` : ''}</span></span>
          ${ico('right', 'chev')}
        </button>`).join('')}</div>`).join('') || `<div class="empty"><b>Nothing here yet</b>Add colleges with deadlines to My List, or add your own date.</div>`}
    </div></div>`;
  };
  function eventSheet(e) {
    modal.open(`
      <div class="row" style="gap:6px;margin-bottom:8px">${statusTag(e.status)}</div>
      <h2>${esc(e.title)}</h2>
      <p class="muted" style="margin-bottom:12px">${fmtDate(e.when)}${e.end ? ` – ${fmtDate(e.end)}` : ''}${e.group ? ' · ' + esc(e.group) : ''}</p>
      ${!e.past ? `<div style="margin-bottom:14px">${countdown(e.when.toISOString(), true)}</div>` : ''}
      ${e.note ? `<p style="font-size:.9rem">${esc(e.note)}</p>` : ''}
      <div class="row">
        ${!e.past ? `<a class="btn pri" href="${gcal(e)}" target="_blank" rel="noopener">Add to Google Calendar</a>` : ''}
        ${e.source ? `<a class="btn" href="${esc(e.source)}" target="_blank" rel="noopener">${t('Source')} ${ico('out', 'sm')}</a>` : ''}
        ${e.formId ? `<a class="btn" href="#/forms?open=${esc(e.formId)}" data-act="modal-close">See form</a>` : ''}
        ${e.kind === 'custom' ? `<button class="btn" data-delev="${esc(e.id)}">${t('Remove')}</button>` : ''}
      </div>`, el => {
      tick();
      el.onclick = ev => { if (ev.target.closest('[data-delev]')) { S.customEvents = S.customEvents.filter(x => x.id !== e.id); save(); modal.close(); render(); } };
    });
  }
  function addEventSheet() {
    modal.open(`<h2>${t('Add your own deadline')}</h2>
      <form id="evForm" class="stack">
        <label>What<input name="title" required placeholder="e.g. BHU form closes"></label>
        <label>University<input name="group" placeholder="Optional"></label>
        <label>Date<input name="date" type="date" required></label>
        <button class="btn pri block">Add</button>
      </form>`, el => {
      $('#evForm', el).addEventListener('submit', e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        S.customEvents.push({ id: uid(), title: f.title.trim(), group: f.group.trim(), date: f.date });
        save(); modal.close(); render(); toast('Deadline added');
      });
    });
  }
  ROUTES['calendar:mount'] = () => {
    $('#view').addEventListener('click', async e => {
      const ev = e.target.closest('[data-ev]');
      if (ev) { eventSheet(calEvents[+ev.dataset.ev]); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'add-ev') addEventSheet();
      if (a.dataset.act === 'ics') { const evs = upcomingEvents(false).filter(x => !x.past); evs.length ? downloadIcs(evs) : toast('No upcoming dates to export'); }
      if (a.dataset.act === 'alerts') askLead('Get WhatsApp, SMS and email reminders');
      if (a.dataset.act === 'notify') {
        if (!('Notification' in window)) { toast('This browser has no notifications'); return; }
        const perm = await Notification.requestPermission();
        S.notify = perm === 'granted'; save(); render();
        toast(S.notify ? 'Reminders on: 7 days, 2 days and on the day' : 'Notifications are blocked in this browser');
      }
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
      ${listSeg('tracker')}
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
      }).join('')}</div>` : emptyList()}
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
    const tabs = [['marks', t('Marks calculator')], ['fees', 'Application fee'], ['subjects', t('Subject combination checker')], ['compare', 'Compare universities'], ['equivalent', t('Same course at other universities')], ['normalisation', 'Score & percentile guide']];
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
        <p class="muted" style="font-size:.82rem;margin:10px 0 0">Set to the official CUET (UG) 2026 pattern from NTA's information bulletin: 50 compulsory questions, +5 for right, −1 for wrong, 0 for unanswered. Change these if a later bulletin changes the pattern.</p></div>
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
      <tr><th style="position:static"></th>${sel.map(u => `<td><b>${esc(pretty(u.name))}</b><br><button class="btn sm" data-uncmp="${esc(u.id)}">${t('Remove')}</button></td>`).join('')}</tr>
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
  TOOLS.fees = () => {
    const f = off().fees;
    if (!f || !f.rows) return `<div class="notice info">Fee details load from NTA's information bulletin.</div>`;
    return `<div class="side-layout">
      <div class="card"><h3>CUET (UG) ${esc(off().cycle || '')} application fee</h3>
        <label>Category<select id="feeCat">${f.rows.map((r, i) => `<option value="${i}" ${i === (S.profile.category === 'UR' ? 0 : ['OBC-NCL', 'EWS'].includes(S.profile.category) ? 1 : 2) ? 'selected' : ''}>${esc(r[0])}</option>`).join('')}</select></label>
        <label style="margin-top:12px">Number of subjects<select id="feeN">${[1, 2, 3, 4, 5].map(n => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div class="stat" style="margin-top:16px"><b id="feeOut"></b><span>excluding bank charges and GST</span></div></div>
      <div class="card"><div class="table-wrap"><table><tr>${f.header.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${f.rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${i ? inr(c) : esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
        <p class="muted" style="font-size:.82rem;margin-top:10px">${esc(f.note)}. <a href="${esc(firstUrl(f.source))}" target="_blank" rel="noopener">Information bulletin</a></p></div></div>`;
  };
  TOOLS.normalisation = () => `<div class="grid g2">
    <div class="card"><h3>Raw score vs normalised score</h3><p>When a subject is held in several shifts, NTA converts raw scores to normalised scores so that harder and easier shifts are compared fairly. Universities admit on the normalised score shown on your scorecard.</p><p>Use the <a href="#/tools/marks">marks calculator</a> to see your raw score from the answer key, then enter your scorecard's normalised scores in the <a href="#/predictor">predictor</a>.</p></div>
    <div class="card"><h3>Why we don't show a percentile estimate</h3><p>NTA does not publish a marks-to-percentile table for CUET (UG), and any "percentile predictor" without one is a guess. We show your gap to real closing scores instead.</p><p>DU uses a combined merit score built from the subjects its course requires; BHU and JMI often use the score of a single subject. The predictor handles both.</p></div></div>
    ${offRows('subjects').length ? `<h3 style="margin-top:24px">Highest NTA score in each subject, CUET (UG) ${esc(off().cycle)}</h3><div class="table-wrap" style="max-height:420px"><table><tr><th>Code</th><th>Subject</th><th>Appeared</th><th>Highest (of 250)</th></tr>${offRows('subjects').map(r => `<tr><td class="num">${esc(r.code)}</td><td>${esc(r.subject)}</td><td class="num">${Number(r.appeared).toLocaleString('en-IN')}</td><td class="num">${esc(r.highest)}</td></tr>`).join('')}</table></div><p class="muted" style="font-size:.8rem">Source: <a href="${esc(firstUrl(off().subjects.source.split(';').pop()))}" target="_blank" rel="noopener">NTA result press release</a></p>` : ''}`;

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
        }).join('') + `<datalist id="subjList">${subjectNames().map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
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
    if (tab === 'fees' && $('#feeCat')) {
      const calc = () => {
        const r = off().fees.rows[+$('#feeCat').value], n = +$('#feeN').value;
        $('#feeOut').textContent = inr(r[1] + Math.max(0, n - 3) * r[2]);
      };
      $('#feeCat').addEventListener('change', calc); $('#feeN').addEventListener('change', calc); calc();
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
  function officialSections() {
    const o = off(), src = (x, label) => x && x.source ? `<p class="muted" style="font-size:.8rem;margin-top:8px">Source: <a href="${esc(firstUrl(x.source))}" target="_blank" rel="noopener">${label}</a></p>` : '';
    if (!o.pattern) return `<div class="notice info">The exam pattern, fees and subjects load from NTA's information bulletin.</div>`;
    const sum = ((o.stats && o.stats.blocks) || [])[0];
    const stat = name => sum && sum.rows.find(r => r[0] === name);
    const reg = stat('Registered candidates (unique)'), app = stat('Unique candidates appeared');
    const subj = offRows('subjects');
    const types = [...new Set(subj.map(r => r.type))];
    const rulesBy = {};
    offRows('rules').forEach(r => { (rulesBy[r.area] = rulesBy[r.area] || []).push(r.rule); });
    return `
      <h2 style="margin-top:34px">CUET (UG) ${esc(o.cycle)} exam pattern</h2>
      <div class="table-wrap"><table>${offRows('pattern').map(r => `<tr><th style="position:static;width:30%">${esc(r.parameter)}</th><td>${esc(r.detail)}</td></tr>`).join('')}</table></div>
      ${src(o.pattern, 'CUET (UG) ' + esc(o.cycle) + ' Information Bulletin')}
      <h2 style="margin-top:34px">Application fee</h2>
      <div class="table-wrap"><table><tr>${o.fees.header.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${o.fees.rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${i ? inr(c) : esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
      <p class="muted" style="font-size:.8rem;margin-top:8px">${esc(o.fees.note)}. <a href="#/tools/fees">Fee calculator →</a></p>
      <h2 style="margin-top:34px">The ${subj.length} CUET subjects</h2>
      <div class="grid g3">${types.map(tp => `<div class="card"><h3>${esc(tp)} <span class="tag">${subj.filter(r => r.type === tp).length}</span></h3><ul style="margin:0;padding-left:18px;font-size:.9rem">${subj.filter(r => r.type === tp).map(r => `<li><span class="muted" style="font-family:var(--mono)">${esc(r.code)}</span> ${esc(r.subject)}</li>`).join('')}</ul></div>`).join('')}</div>
      ${src({ source: o.subjects.source }, 'NTA syllabus page')}
      ${reg ? `<h2 style="margin-top:34px">CUET (UG) ${esc(o.cycle)} in numbers</h2>
      <div class="grid g4">
        <div class="card stat"><b>${lakh(reg[2])}</b><span>registered (${lakh(reg[1])} in 2025)</span></div>
        <div class="card stat"><b>${lakh(app[2])}</b><span>appeared</span></div>
        <div class="card stat"><b>${esc((stat('No. of universities') || [])[2] ?? unis().length)}</b><span>participating institutions</span></div>
        <div class="card stat"><b>${esc((stat('Exam cities') || [])[2] ?? '')}</b><span>exam cities, ${esc((stat('Exam cities outside India') || [])[2] ?? '')} outside India</span></div>
      </div>
      <details class="card" style="margin-top:12px"><summary><b>All 2025 vs 2026 figures</b></summary>${o.stats.blocks.map(b => `${b.label ? `<h3 style="margin-top:16px">${esc(b.label)}</h3>` : ''}<div class="table-wrap" style="margin-top:8px"><table><tr>${b.header.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${b.rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${typeof c === 'number' ? (/%/.test(b.header[i]) ? (c * 100).toFixed(1) + '%' : c.toLocaleString('en-IN')) : esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`).join('')}</details>
      ${src(o.stats, 'NTA result press release')}` : ''}
      <h2 style="margin-top:34px">Rules to know</h2>
      <div class="grid g2">${Object.entries(rulesBy).map(([a, rs]) => `<div class="card"><h3>${esc(a)}</h3><ul class="ticks">${rs.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`).join('')}</div>
      ${src(o.rules, 'Information Bulletin')}
      <h2 style="margin-top:34px">Official links and helpdesk</h2>
      <div class="table-wrap"><table>${offRows('links').map(r => `<tr><td>${esc(r.item)}</td><td>${/^https?:/.test(r.url || '') ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\//, '').slice(0, 60))}</a>` : /@/.test(r.url || '') ? `<a href="mailto:${esc(r.url)}">${esc(r.url)}</a>` : esc(r.url)}</td><td><small>${esc(r.notes || '')}</small></td></tr>`).join('')}</table></div>`;
  }
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
      ${officialSections()}
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
          <datalist id="uniList2">${unis().slice(0, 2000).map(u => `<option value="${esc(pretty(u.name))}">`).join('')}</datalist>
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
      if (!(loggedIn() && profileDone())) { requireLogin('Log in to book a senior'); return; }
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
    $('#grpForm').addEventListener('submit', async e => { e.preventDefault(); if (!(loggedIn() && profileDone())) { requireLogin('Log in to join a group'); return; } const c = new FormData(e.target).get('college'); await submit('group-request', { college: c, profile: S.profile }, `Hi Everything CUET, please start a student group for ${c}.`); });
    $('#alForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (!(loggedIn() && profileDone())) { requireLogin('Log in to share your allotment'); return; } const f = Object.fromEntries(new FormData(e.target));
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
      if (!(loggedIn() && profileDone())) { requireLogin('Log in to place your order'); return; }
      const f = Object.fromEntries(new FormData(e.target));
      Object.assign(S.profile, { name: f.name, phone: f.phone, email: f.email }); save();
      const tt = cartTotals();
      const lines = S.cart.map(c => `• ${c.label} — ${inr(c.price)}`).join('\n');
      await submit('order', { ...f, items: S.cart, totals: tt }, `Hi Everything CUET, I'd like to order:\n${lines}\n${tt.bundle ? `Bundle discount: −${inr(tt.bundle)}\n` : ''}Total: ${inr(tt.total)}\nName: ${f.name}\nPhone: ${f.phone}\nEmail: ${f.email}\n${f.notes || ''}`);
    });
    if (parseHash().q.get('cart')) setTimeout(() => $('#cart') && $('#cart').scrollIntoView({ behavior: 'smooth' }), 50);
  };

  /* ---------- Log in, account, leads ---------- */
  ROUTES.login = () => {
    if (loggedIn() && profileDone()) return ROUTES.account();
    return `<div class="page"><div class="wrap" style="max-width:440px"><div class="card" id="loginPage"></div></div></div>`;
  };
  ROUTES['login:mount'] = () => { const b = $('#loginPage'); if (b) { S.afterLogin = '#/'; save(); drawLogin(b, 'Log in to Everything CUET', sb && user ? 'profile' : 'start'); } else ROUTES['account:mount'](); };
  ROUTES.account = () => {
    if (!(loggedIn() && profileDone())) return ROUTES.login();
    const p = S.profile;
    return `<div class="page"><div class="wrap" style="max-width:560px">
      <div class="card" style="display:flex;gap:14px;align-items:center">
        <span class="av" style="width:56px;height:56px;font-size:1.3rem;background:var(--red);color:#fff">${esc((p.name || '?')[0].toUpperCase())}</span>
        <div><h2 style="margin:0">${esc(p.name)}</h2><small>${esc(p.email || '')}${p.email ? ' · ' : ''}${esc(p.phone)}</small></div>
      </div>
      <div class="list section">
        <button class="list-row" data-act="edit"><span class="av">${ico('grid')}</span><span class="grow"><span class="t">Edit my details</span><span class="s">Class 12 ${esc(p.class12_year || '')} · ${esc(p.category || '')} · ${esc(p.interest || '')}</span></span>${ico('right', 'chev')}</button>
        <a class="list-row" href="#/dream"><span class="av">${ico('star')}</span><span class="grow"><span class="t">My List</span><span class="s">${S.dream.length} saved${sb ? ' · synced to your account' : ' · on this device'}</span></span>${ico('right', 'chev')}</a>
        ${isAdmin ? `<a class="list-row" href="#/admin"><span class="av">${ico('cap')}</span><span class="grow"><span class="t">Leads</span><span class="s">Everyone who signed up</span></span>${ico('right', 'chev')}</a>` : ''}
        <button class="list-row" data-act="signout"><span class="av">${ico('x')}</span><span class="grow"><span class="t">Sign out</span></span></button>
      </div>
    </div></div>`;
  };
  ROUTES['account:mount'] = () => $('#view').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'signout') signOut();
    if (a.dataset.act === 'edit') { pending = null; S.afterLogin = '#/account'; modal.open(`<div id="loginBox"></div>`, el => drawLogin($('#loginBox', el), '', 'profile')); }
  });
  let leadRows = [];
  ROUTES.admin = () => `<div class="page"><div class="wrap"><div id="adminBox"><div class="empty"><b>Loading leads…</b></div></div></div></div>`;
  ROUTES['admin:mount'] = async () => {
    const box = $('#adminBox');
    if (!sb) { box.innerHTML = `<div class="notice"><span>Connect Supabase in <b>config.js</b> to collect leads in one place. Until then, sign-ups go to WhatsApp or your form endpoint.</span></div>`; return; }
    if (!user) { box.innerHTML = `<div class="empty"><b>Admins only</b><a class="btn pri" href="#/login" style="margin-top:12px">Log in</a></div>`; return; }
    const [{ data: leads, error }, { data: reqs }] = await Promise.all([
      sb.from('leads').select('*').order('created_at', { ascending: false }).limit(5000),
      sb.from('requests').select('*').order('created_at', { ascending: false }).limit(2000)
    ]);
    if (error) { box.innerHTML = `<div class="notice"><span>${esc(error.message)}</span></div>`; return; }
    if (!isAdmin) { box.innerHTML = `<div class="empty"><b>Admins only</b>Add your email to the admins table in Supabase.</div>`; return; }
    leadRows = leads || [];
    const byKind = {};
    (reqs || []).forEach(r => { byKind[r.kind] = (byKind[r.kind] || 0) + 1; });
    const today = leadRows.filter(l => new Date(l.created_at) > Date.now() - 864e5).length;
    box.innerHTML = `
      <div class="stats"><div class="stat"><b>${leadRows.length}</b><span>leads</span></div><div class="stat"><b>${today}</b><span>in the last 24 h</span></div>
        <div class="stat"><b>${byKind.order || 0}</b><span>form-filling orders</span></div><div class="stat"><b>${byKind['senior-call'] || 0}</b><span>senior calls</span></div></div>
      <div class="row section" style="margin-bottom:12px"><div class="search" style="flex:1;min-width:200px">${ico('search')}<input id="lq" placeholder="Search name, phone, email, state"></div><button class="btn pri" data-act="csv">Download CSV</button><button class="btn" data-act="csvreq">Requests CSV</button></div>
      <div class="table-wrap"><table><thead><tr><th>Joined</th><th>Name</th><th>Phone</th><th>Email</th><th>Class 12</th><th>Cat.</th><th>State</th><th>Interest</th><th>List</th><th>WA</th></tr></thead><tbody id="ltb"></tbody></table></div>`;
    const drawRows = () => {
      const term = norm($('#lq').value);
      $('#ltb').innerHTML = leadRows.filter(l => !term || norm([l.name, l.phone, l.email, l.state, l.interest].join(' ')).includes(term)).map(l => `<tr>
        <td><small>${fmtDate(l.created_at)}</small></td><td><b>${esc(l.name)}</b></td><td class="num"><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a></td><td><small>${esc(l.email)}</small></td>
        <td>${esc(l.class12_year)}</td><td>${esc(l.category)}</td><td>${esc(l.state)}</td><td><small>${esc(l.interest)}</small></td><td class="num">${(l.dream_list || []).length}</td><td>${l.whatsapp_ok ? '✓' : ''}</td></tr>`).join('');
    };
    const csv = (rows, cols) => {
      const q = v => `"${String(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v).replace(/"/g, '""')}"`;
      const blob = new Blob(['﻿' + [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `everything-cuet-${cols.includes('kind') ? 'requests' : 'leads'}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    };
    $('#lq').addEventListener('input', drawRows);
    box.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'csv') csv(leadRows, ['created_at', 'name', 'phone', 'email', 'class12_year', 'category', 'state', 'interest', 'whatsapp_ok', 'dream_list']);
      if (a.dataset.act === 'csvreq') csv(reqs || [], ['created_at', 'user_id', 'kind', 'payload']);
    });
    drawRows();
  };

  /* ---------- More ---------- */
  const menuRow = ([r, i, l, d]) => `<a class="list-row" href="${/^https?:/.test(r) ? esc(r) + '" target="_blank" rel="noopener' : '#/' + r}"><span class="av">${ico(i)}</span><span class="grow"><span class="t">${l}</span>${d ? `<span class="s">${d}</span>` : ''}</span>${ico(/^https?:/.test(r) ? 'out' : 'right', 'chev')}</a>`;
  ROUTES.more = () => `<div class="page"><div class="wrap">
    <div class="list" style="margin-bottom:16px">${loggedIn() && profileDone()
      ? `<a class="list-row" href="#/account"><span class="av" style="background:var(--red);color:#fff">${esc((S.profile.name || '?')[0].toUpperCase())}</span><span class="grow"><span class="t">${esc(S.profile.name)}</span><span class="s">${esc(S.profile.email || S.profile.phone)}</span></span>${ico('right', 'chev')}</a>`
      : `<a class="list-row" href="#/login"><span class="av">${ico('star')}</span><span class="grow"><span class="t">Log in or sign up</span><span class="s">Save your list and get reminders</span></span>${ico('right', 'chev')}</a>`}</div>
    <div class="list">${[
      ['predictor', 'bolt', 'Find my colleges', 'Dream, Target and Safe from your scores'],
      ['tools/marks', 'grid', t('Marks calculator'), '+5 / −1 from the answer key'],
      ['tools/fees', 'grid', 'CUET fee calculator', 'By category and number of subjects'],
      ['tools', 'grid', 'More tools', 'Subjects, compare, same course elsewhere'],
      ['resources', 'info', 'CUET guide', 'Pattern, fees, 37 subjects, rules']].map(menuRow).join('')}</div>
    <div class="list section">${[
      ['pricing', 'bolt', 'Plans & form filling', `From ${inr(P.assistedForm)} a form`],
      ['seniors', 'chat', t('Talk to a senior'), `${inr(P.seniorCall)} for 20 minutes`],
      ['community', 'cap', t('Community'), 'Groups and allotment-day tracker']].map(menuRow).join('')}</div>
    <div class="list section">
      <button class="list-row" data-act="lang"><span class="av">अ</span><span class="grow"><span class="t">Language</span><span class="s">${S.lang === 'hi' ? 'हिंदी' : 'English'}</span></span><span class="tag">${S.lang === 'hi' ? 'Switch to English' : 'हिंदी में देखें'}</span></button>
      ${[[C.instagram, 'spark', 'Instagram', '@everythingcuet'], [C.youtube, 'spark', 'YouTube', 'Everything CUET']].filter(x => x[0]).map(menuRow).join('')}
    </div>
    <p class="muted" style="font-size:.78rem;margin-top:16px">Everything CUET is independent and not affiliated with the National Testing Agency or any university. University list from <a href="${NTA_UNIS}" target="_blank" rel="noopener">NTA</a>. Always confirm dates on official websites.</p>
  </div></div>`;
  ROUTES['more:mount'] = () => $('#view').addEventListener('click', e => { if (e.target.closest('[data-act="lang"]')) { S.lang = S.lang === 'hi' ? 'en' : 'hi'; save(); render(); } });

  function renderFoot() {
    $('#railFoot').innerHTML = `<p>Free · no login · not affiliated with NTA</p><p><a href="${esc(C.instagram)}" target="_blank" rel="noopener">Instagram</a> · <a href="${esc(C.youtube)}" target="_blank" rel="noopener">YouTube</a></p>`;
  }

  /* ---------- assistant ---------- */
  const bot = { el: $('#bot'), log: $('#botLog') };
  function say(html, me) {
    const m = document.createElement('div'); m.className = 'msg ' + (me ? 'me' : 'bot-m'); m.innerHTML = html;
    bot.log.appendChild(m); bot.log.scrollTop = bot.log.scrollHeight;
  }
  const SUGG = ['Which college forms are open?', 'Can I get B.Com Hons with 720?', 'When is CUET 2027 registration?', 'List of central universities', 'What is the CUET application fee?', 'How is CUET marked?', 'How much does form filling cost?'];
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
    if (/\bforms?\b|ashoka|christ|flame|ipm|ipmat|private college|apply to|open now/.test(q) && forms().length) {
      const open = forms().filter(f => formStatus(f) === 'open').map(f => ({ f, nd: nextDeadline(f) })).sort((a, b) => ((a.nd || {}).when || 9e15) - ((b.nd || {}).when || 9e15));
      return `${open.length} college forms are open now:\n${open.slice(0, 6).map(({ f, nd }) => `• ${esc(f.name)}${nd ? ` — ${esc(nd.label)} by ${fmtDate(nd.when)} (reported)` : ''}`).join('\n')}\n<a href="#/forms">All college forms →</a>`;
    }
    if (/when|date|kab|registration|exam|result|deadline|admit|answer key/.test(q)) {
      const evs = upcomingEvents(false).filter(e => !e.past).slice(0, 4);
      return evs.length ? evs.map(e => `• <b>${esc(e.title)}</b> — ${fmtDate(e.when)}${e.status === 'expected' ? ' (expected, not official yet)' : ''}`).join('\n') + `\n<a href="#/calendar">Full calendar →</a>` : `No upcoming dates are announced yet. <a href="#/calendar">Turn on reminders</a> and we'll tell you.`;
    }
    const cat = CATS.find(c => q.includes(c.toLowerCase().split(' ')[0]));
    const states = [...new Set(unis().map(u => u.state).filter(Boolean))];
    const st = states.find(s => q.includes(s.toLowerCase()));
    if (/universit|college|list|institut/.test(q) && (cat || st)) {
      if (!unis().length) return `NTA's university list is being imported. See it on <a href="${NTA_UNIS}" target="_blank" rel="noopener">cuet.nta.nic.in</a>.`;
      const list = unis().filter(u => (!cat || u.category === cat) && (!st || u.state === st));
      const p = new URLSearchParams(); cat && p.set('cat', cat); st && p.set('state', st);
      return `${list.length} ${cat || ''} universit${list.length === 1 ? 'y' : 'ies'}${st ? ' in ' + esc(st) : ''} on NTA's list:\n${list.slice(0, 6).map(u => '• ' + esc(pretty(u.name))).join('\n')}${list.length > 6 ? '\n…' : ''}\n<a href="#/colleges?${p}">See all →</a>`;
    }
    if (/mark|negative|pattern|question|paper|kitne/.test(q)) return `Each paper has 50 compulsory questions in 60 minutes: +5 for a right answer, −1 for a wrong one, 0 if left blank — so 250 per subject (official CUET UG ${esc(off().cycle || '2026')} pattern). <a href="#/tools/marks">Count your marks →</a> · <a href="#/resources">Full pattern →</a>`;
    if (/application fee|cuet fee|exam fee|registration fee|form fee/.test(q) && off().fees) return `CUET (UG) ${esc(off().cycle)} application fee:\n${off().fees.rows.map(r => `• ${esc(r[0])}: ${inr(r[1])} for up to 3 subjects, +${inr(r[2])} per extra subject (${inr(r[3])} for 5)`).join('\n')}\n<a href="#/tools/fees">Fee calculator →</a>`;
    if (/helpline|helpdesk|contact|phone number|email nta|nta contact/.test(q) && offRows('links').length) { const h = offRows('links').find(r => /helpdesk email/i.test(r.item)); return h ? `NTA CUET (UG) helpdesk: <a href="mailto:${esc(h.url)}">${esc(h.url)}</a> · ${esc(h.notes || '')}` : `<a href="#/resources">Official links →</a>`; }
    if (/how many|subjects list|which subjects|kitne subject/.test(q) && offRows('subjects').length) return `CUET (UG) ${esc(off().cycle)} has ${offRows('subjects').length} subjects (${[...new Set(offRows('subjects').map(r => r.type))].map(tp => `${offRows('subjects').filter(r => r.type === tp).length} ${tp.toLowerCase()}`).join(', ')}); you can take up to 5. <a href="#/resources">See the list →</a>`;
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

  HI.Closed = 'बंद'; HI.Seniors = 'सीनियर्स';
  Promise.all([loadData(), initAuth().catch(err => console.warn('login unavailable', err))]).then(() => { render(); checkReminders(); });
})();
