(() => {
  'use strict';
  const KEY = 'dailyFocus.v1';

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd();
  const parseDay = (s) => new Date(s + 'T00:00');
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monday = (d) => { const x = addDays(d, -((d.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
  const dayDiff = (s) => Math.round((parseDay(s) - parseDay(today())) / 864e5);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n) => `<svg class="i"><use href="#i-${n}"/></svg>`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const fmtDay = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => parseDay(s).toLocaleDateString(undefined, o);
  const fmtTime = (hm) => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)}${h < 12 ? 'am' : 'pm'}`; };
  const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); };
  const ago = (ts) => { const m = Math.round((Date.now() - ts) / 6e4); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${plural(h, 'hour')} ago`; const d = Math.round(h / 24); return d < 30 ? `${plural(d, 'day')} ago` : new Date(ts).toLocaleDateString(); };
  const hashIdx = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 6; };
  const attr = (o) => esc(JSON.stringify(o));
  const EMOJI = /\p{Extended_Pictographic}/u;

  // ---------- data ----------
  const blank = () => ({ tasks: [], journal: {}, reminders: [], sessions: [], habits: [], settings: { f: 25, s: 5, l: 15, sound: true } });
  let db;
  try { db = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { db = blank(); }
  function migrate() {
    const d = db;
    d.settings ||= { f: 25, s: 5, l: 15 };
    if (d.settings.sound === undefined) d.settings.sound = true;
    d.profile ||= { name: '', affirmations: '' };
    d.moods ||= {}; d.affPick ||= {};
    d.areas ||= [
      { id: 'a1', name: 'Personal Life', icon: '🧸', art: '🧸 🌷 🕯️', rating: 7 },
      { id: 'a2', name: 'Health & Fitness', icon: '🥗', art: '🥗 🏃‍♀️ 💧', rating: 6 },
      { id: 'a3', name: 'Finance', icon: '💰', art: '💰 🪴 📈', rating: 5 },
      { id: 'a4', name: 'Work / Business', icon: '💼', art: '💻 ☕ 📎', rating: 6 },
      { id: 'a5', name: 'Relationships', icon: '💞', art: '💞 🍰 💌', rating: 8 },
    ];
    d.goals ||= []; d.projects ||= []; d.notes ||= []; d.resources ||= []; d.books ||= []; d.highlights ||= [];
    d.notebooks ||= [
      { id: 'nb1', name: 'Productivity Systems', icon: '🗂️', art: '🗂️ ☕ 📎' },
      { id: 'nb2', name: 'Fleeting Notes', icon: '✏️', art: '✏️ 🍵 💭' },
      { id: 'nb3', name: 'Learning & Knowledge', icon: '📚', art: '📚 🧁 💡' },
      { id: 'nb4', name: 'Personal Notes', icon: '💌', art: '💌 🌸 🕊️' },
    ];
    d.topics ||= [{ id: 'tp1', name: 'Productivity' }, { id: 'tp2', name: 'Organization' }, { id: 'tp3', name: 'Self Development' }];
    // to-do lists from the previous version become projects
    const listNames = [...new Set(d.tasks.filter((t) => t.list).map((t) => t.list))];
    listNames.forEach((name) => {
      const ic = (name.match(EMOJI) || ['📁'])[0];
      const title = name.replace(new RegExp(EMOJI.source, 'gu'), '').replace(/️/g, '').trim() || name;
      const p = { id: uid(), title: title[0].toUpperCase() + title.slice(1), icon: ic, status: 'in progress', areaId: /work|business/i.test(title) ? 'a4' : 'a1', created: Date.now() };
      d.projects.push(p);
      d.tasks.forEach((t) => { if (t.list === name) { t.projectId = p.id; t.date = t.start ? t.date : ''; } });
    });
    d.tasks.forEach((t) => {
      delete t.list;
      if (t.pri === 'high' && t.important === undefined) t.important = true;
      t.created ||= Date.now();
    });
    delete d.lists;
    d.version = 3;
  }
  migrate();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  save();

  const live = (a) => a.filter((x) => !x.archived);
  const byId = (a, id) => a.find((x) => x.id === id);
  const area = (id) => byId(db.areas, id);
  const goal = (id) => byId(db.goals, id);
  const project = (id) => byId(db.projects, id);
  const notebook = (id) => byId(db.notebooks, id);
  const topic = (id) => byId(db.topics, id);
  const book = (id) => byId(db.books, id);
  const art = (x) => String(x.art || x.icon || '✨').split(/\s+/).filter(Boolean);
  const projTasks = (p) => db.tasks.filter((t) => t.projectId === p.id);
  const projArea = (p) => p.areaId || goal(p.goalId)?.areaId || '';
  function projPct(p) {
    if (p.status === 'done') return 100;
    const ts = projTasks(p);
    return ts.length ? Math.round((ts.filter((t) => t.done).length / ts.length) * 100) : 0;
  }
  const goalProjects = (g) => live(db.projects).filter((p) => p.goalId === g.id);
  function goalPct(g) {
    if (g.status === 'achieved') return 100;
    const ps = goalProjects(g);
    return ps.length ? Math.round(avg(ps.map(projPct))) : 0;
  }
  function areaStats(a) {
    const gs = live(db.goals).filter((g) => g.areaId === a.id);
    const ps = live(db.projects).filter((p) => projArea(p) === a.id);
    const pct = gs.length ? avg(gs.map(goalPct)) : ps.length ? avg(ps.map(projPct)) : 0;
    return { goals: gs.filter((g) => g.status !== 'achieved').length, projects: ps.filter((p) => p.status !== 'done').length, pct: Math.round(pct) };
  }
  const openTasks = () => db.tasks.filter((t) => !t.done);
  const isInbox = (t) => !t.done && !t.date && !t.projectId;
  const quadOf = (t) => (t.urgent && t.important ? 1 : t.important ? 2 : t.urgent ? 3 : 4);
  const QUADS = {
    1: { name: 'Do first', sub: 'Urgent and important. Do these today.', e: '🔥', cls: 'q1', f: { urgent: true, important: true } },
    2: { name: 'Schedule', sub: 'Important, not urgent. Plan a time for these.', e: '🗓️', cls: 'q2', f: { urgent: false, important: true } },
    3: { name: 'Delegate', sub: 'Urgent, not important. Hand off or do quickly.', e: '🤝', cls: 'q3', f: { urgent: true, important: false } },
    4: { name: 'Eliminate', sub: 'Neither. Drop these or keep for later.', e: '🫧', cls: 'q4', f: { urgent: false, important: false } },
  };
  const taskSort = (a, b) => a.done - b.done || (a.date || '9999').localeCompare(b.date || '9999') || (a.start || '99').localeCompare(b.start || '99') || quadOf(a) - quadOf(b);

  // ---------- little joys ----------
  let actx;
  function chime(freqs = [880, 1175], vol = 0.04, force = false) {
    if (!db.settings.sound && !force) return;
    try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.1;
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.start(t); o.stop(t + 0.5);
      });
    } catch {}
  }
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3000);
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hearts(el, n = 4) {
    chime();
    if (reduced || !el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const h = document.createElement('div'); h.className = 'heart'; h.textContent = '♥';
      h.style.left = r.left + r.width / 2 - 6 + 'px'; h.style.top = r.top + 'px';
      h.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);
      h.style.animationDelay = `${i * 60}ms`; h.style.fontSize = `${11 + Math.random() * 8}px`;
      document.body.appendChild(h); setTimeout(() => h.remove(), 1300);
    }
  }
  function notify(title, body) {
    chime([880, 880, 1175], 0.15, true); toast(`${title} · ${body}`);
    if ('Notification' in window && Notification.permission === 'granted') { try { new Notification(title, { body }); } catch {} }
  }

  // ---------- UI state ----------
  const ui = { weekStart: monday(new Date()), selDay: today(), notebook: '', topic: '', noteTab: 'all', resType: '', genre: '', capType: 'task', jDate: today(), refocus: '' };

  // ---------- small components ----------
  const tag = (txt, c = 'gray') => `<span class="tag t-${c}">${txt}</span>`;
  const prog = (pct, cls = '') => `<div class="prog ${cls}"><i style="width:${pct}%"></i></div>`;
  const cover = (x, i) => { const [a, b, c] = art(x); return `<div class="gcover bg-${i % 6}"><span class="a">${esc(a)}</span>${b ? `<span class="b">${esc(b)}</span>` : ''}${c ? `<span class="c">${esc(c)}</span>` : ''}</div>`; };
  const chk = (on, act, id, extra = '') => `<button type="button" class="chk ${on ? 'on' : ''} ${extra}" data-act="${act}" data-id="${id}" aria-pressed="${!!on}" aria-label="Done">${on ? icon('tick') : ''}</button>`;
  const btnNew = (ent, label, p = {}, cls = 'btn sm') => `<button type="button" class="${cls}" data-act="new" data-ent="${ent}" data-p="${attr(p)}">${label}</button>`;
  const label = (txt, right = '') => `<div class="label">${txt}<span class="r">${right}</span></div>`;
  const STATUS_TAG = { 'not started': ['Not started', 'red'], 'in progress': ['In progress', 'yellow'], done: ['Complete', 'green'] };
  function dueTag(t) {
    if (t.done) return tag('Done', 'green');
    if (!t.date) return '';
    const d = dayDiff(t.date);
    if (d < 0) return tag(`Overdue · ${fmtDay(t.date)}`, 'red');
    if (d === 0) return tag('Due today!', 'orange');
    if (d === 1) return tag('Tomorrow', 'yellow');
    return tag(fmtDay(t.date), 'gray');
  }
  function quadTags(t) {
    return (t.important ? tag('⭐ important', 'purple') : '') + (t.urgent ? tag('⚡ urgent', 'pink') : '');
  }
  function projLink(t) {
    const p = project(t.projectId);
    return p ? `<a class="meta" href="#/project/${p.id}" style="text-decoration:none">${esc(p.icon || '📁')} ${esc(p.title)}</a>` : '';
  }
  function taskCard(t, { drag = false } = {}) {
    return `<div class="tcard ${t.done ? 'done' : ''}" ${drag ? `draggable="true" data-drag="task" data-id="${t.id}"` : ''}>
      <div class="trow">${chk(t.done, 'toggleTask', t.id)}<span class="tt" data-act="edit" data-ent="task" data-id="${t.id}">${esc(t.text)}</span></div>
      ${projLink(t)}
      <div class="tags">${dueTag(t)}${t.start ? tag(`🕒 ${fmtTime(t.start)}${t.end ? '–' + fmtTime(t.end) : ''}`, 'blue') : ''}${quadTags(t)}</div>
      ${t.done ? '' : `<button type="button" class="mark" data-act="toggleTask" data-id="${t.id}">Mark as completed</button>`}
    </div>`;
  }
  function taskRow(t, { showProj = true } = {}) {
    return `<div class="row-i ${t.done ? 'done' : ''}">${chk(t.done, 'toggleTask', t.id)}
      <span class="tt" data-act="edit" data-ent="task" data-id="${t.id}">${esc(t.text)}</span>
      <span class="tags">${showProj && project(t.projectId) ? tag(esc(project(t.projectId).icon + ' ' + project(t.projectId).title), 'gray') : ''}${dueTag(t)}</span></div>`;
  }
  const cards = (items, fn, empty) => (items.length ? `<div class="gal">${items.map(fn).join('')}</div>` : `<div class="empty c">${empty}</div>`);
  const rows = (items, fn, empty) => (items.length ? `<div class="rows">${items.map(fn).join('')}</div>` : `<div class="empty">${empty}</div>`);

  function weekCal() {
    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(ui.weekStart, i)));
    return `<div class="weekcal">${days.map((k) => {
      const ts = db.tasks.filter((t) => t.date === k).sort(taskSort);
      return `<div class="wcol ${k === today() ? 'today' : ''} ${k === ui.selDay ? 'sel' : ''}">
        <div class="whead" data-act="selDay" data-v="${k}"><span>${fmtDay(k, { weekday: 'short' })}</span><b>${parseDay(k).getDate()}</b></div>
        <div class="wbody">${ts.map((t) => `<div class="wtask ${t.done ? 'done' : ''}">${chk(t.done, 'toggleTask', t.id)}<span data-act="edit" data-ent="task" data-id="${t.id}">${t.start ? `<b style="font-weight:600">${fmtTime(t.start)}</b> ` : ''}${esc(t.text)}</span></div>`).join('')}
        <button type="button" class="wadd" data-act="new" data-ent="task" data-p="${attr({ date: k })}">+ add</button></div></div>`;
    }).join('')}</div>`;
  }
  const weekNav = () => {
    const s = ui.weekStart, e = addDays(s, 6);
    return `<span class="wnav"><button class="btn ghost sm" data-act="week" data-v="-1" aria-label="Previous week">${icon('left')}</button><span style="font-size:13px;color:var(--muted)">${s.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><button class="btn ghost sm" data-act="week" data-v="1" aria-label="Next week">${icon('right')}</button><button class="btn ghost sm" data-act="week" data-v="0">today</button></span>`;
  };
  function timeline(day) {
    const items = db.tasks.filter((t) => t.start && t.date === day).sort((a, b) => a.start.localeCompare(b.start));
    const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const list = items.map((t) => {
      const isNow = day === today() && !t.done && t.start <= hm && t.end && hm < t.end;
      return `<div class="slot"><div class="t">${fmtTime(t.start)}</div><div class="block ${t.done ? 'done' : ''} ${isNow ? 'now' : ''}">
        ${chk(t.done, 'toggleTask', t.id, 'round')}<div class="grow"><div class="tt" data-act="edit" data-ent="task" data-id="${t.id}">${esc(t.text)}</div><div class="tm">${fmtTime(t.start)}${t.end ? ' – ' + fmtTime(t.end) : ''}${project(t.projectId) ? ' · ' + esc(project(t.projectId).title) : ''}</div></div></div></div>`;
    }).join('');
    const h = Math.min(22, new Date().getHours() + 1);
    return (list || '<div class="empty">No time blocks yet. Plan your day hour by hour.</div>') +
      `<div style="margin-top:6px">${btnNew('task', '+ time block', { date: day, start: `${pad(h)}:00`, end: `${pad(h + 1)}:00` }, 'btn ghost sm')}</div>`;
  }

  function wheelSvg() {
    const as = db.areas, n = as.length;
    if (n < 3) return '<div class="empty">Add at least 3 life areas to see your wheel.</div>';
    const cx = 150, cy = 150, R = 92;
    const pt = (i, r) => { const a = (-90 + (360 * i) / n) * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    const poly = (f) => as.map((_, i) => pt(i, f(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
    let s = `<svg viewBox="-75 20 450 260" role="img" aria-label="Wheel of life: ${as.map((a) => `${esc(a.name)} ${a.rating || 0} of 10`).join(', ')}">`;
    [2, 4, 6, 8, 10].forEach((v) => (s += `<polygon class="ring-l" points="${poly(() => (R * v) / 10)}"/>`));
    as.forEach((_, i) => { const [x, y] = pt(i, R); s += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
    s += `<polygon class="shape" points="${poly((i) => (R * (as[i].rating || 0)) / 10)}"/>`;
    as.forEach((a, i) => {
      const [x, y] = pt(i, (R * (a.rating || 0)) / 10), [lx, ly] = pt(i, R + 16);
      const anchor = lx > cx + 8 ? 'start' : lx < cx - 8 ? 'end' : 'middle';
      s += `<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/><circle class="hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" data-tip="${esc(a.icon + ' ' + a.name)}: ${a.rating || 0}/10"/>`;
      s += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}">${esc(a.icon)} ${esc(a.name)}</text>`;
    });
    return s + '</svg>';
  }
  const ratings = () => db.areas.map((a) => `<label class="rating"><span>${esc(a.icon)} ${esc(a.name)}</span><input type="range" min="0" max="10" value="${a.rating || 0}" data-input="rating" data-id="${a.id}" aria-label="${esc(a.name)} rating"><b id="rv-${a.id}">${a.rating || 0}</b></label>`).join('');
  const wheelCard = () => `<div class="card wheel-card"><h3>🎡 Wheel of Life<span class="r muted" style="font-size:12px;color:var(--muted)">rate each area 0–10</span></h3><div class="wheel-wrap"><div class="wheel" id="wheel">${wheelSvg()}</div><div>${ratings()}</div></div></div>`;

  function habitStreak(h) {
    let n = 0, d = new Date();
    if (!h.days[ymd(d)]) d = addDays(d, -1);
    while (h.days[ymd(d)]) { n++; d = addDays(d, -1); }
    return n;
  }
  function habitRows(withName) {
    if (!db.habits.length) return `<div class="empty">No habits yet. Start with one small habit.</div>`;
    const start = monday(new Date()), t = today();
    return db.habits.map((h, idx) => `<div class="habit"><button type="button" class="h-ic bg-${idx % 6}" data-act="edit" data-ent="habit" data-id="${h.id}" title="Edit ${esc(h.name)}">${esc(h.icon)}</button>
      <div class="h-body"><div class="h-name">${esc(h.name)}<small>${habitStreak(h) ? habitStreak(h) + ' day streak ♡' : ''}</small></div>
      <div class="h-days">${Array.from({ length: 7 }, (_, i) => { const d = addDays(start, i), k = ymd(d), on = !!h.days[k], fut = k > t;
        return `<div class="${fut ? 'fut' : ''}">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}${withName ? ' ' + d.getDate() : ''}<button type="button" class="chk round ${on ? 'on' : ''}" data-act="habitDay" data-id="${h.id}" data-v="${k}" ${fut ? 'disabled' : ''} aria-pressed="${on}" aria-label="${esc(h.name)} on ${k}">${on ? icon('tick') : ''}</button></div>`; }).join('')}</div></div></div>`).join('');
  }

  function areaCard(a, i) {
    const s = areaStats(a);
    return `<div class="gcard" data-act="go" data-to="area/${a.id}">${cover(a, i)}<div class="gbody"><div class="gtitle">${esc(a.icon)} ${esc(a.name)}</div>
      <div class="meta"><span class="k">✨ Current progress</span> ${s.pct}%</div>${prog(s.pct)}
      <div class="meta"><span class="k">🎯 Active goals</span> ${s.goals}</div><div class="meta"><span class="k">🗂️ Active projects</span> ${s.projects}</div></div></div>`;
  }
  function goalCard(g) {
    const pct = goalPct(g), a = area(g.areaId), ps = goalProjects(g);
    return `<div class="card" style="display:flex;flex-direction:column;gap:3px">
      <div class="gtitle" data-act="go" data-to="goal/${g.id}" style="cursor:pointer">${esc(g.icon || '🎯')} ${esc(g.title)}</div>
      ${a ? `<div class="meta">${esc(a.icon)} ${esc(a.name)}</div>` : ''}
      <div class="meta"><span class="k">🎯 Goal progress</span> ${pct}%</div>${prog(pct, g.status === 'achieved' ? 'green' : '')}
      <div class="meta"><span class="k">🗂️ Projects</span> ${ps.length}${g.deadline ? ` · <span class="k">by</span> ${fmtDay(g.deadline, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</div>
      <div class="tags">${g.status === 'achieved' ? tag('Achieved 🏆', 'green') : tag('Active', 'orange')}</div>
      <button type="button" class="mark" data-act="goalDone" data-id="${g.id}">${g.status === 'achieved' ? 'Mark as active again' : 'Mark as achieved'}</button></div>`;
  }
  function projectCard(p) {
    const ts = projTasks(p), done = ts.filter((t) => t.done).length, pct = projPct(p), g = goal(p.goalId), st = STATUS_TAG[p.status] || STATUS_TAG['not started'];
    let due = '';
    if (p.due && p.status !== 'done') { const d = dayDiff(p.due); due = d < 0 ? tag(`${plural(-d, 'day')} overdue`, 'red') : tag(`${plural(d, 'day')} to go`, 'blue'); }
    return `<div class="card" style="display:flex;flex-direction:column;gap:3px">
      <div class="gtitle" data-act="go" data-to="project/${p.id}" style="cursor:pointer">${esc(p.icon || '📁')} ${esc(p.title)}</div>
      ${g ? `<div class="meta">🎯 ${esc(g.title)}</div>` : ''}
      <div class="meta"><span class="k">✓ Related tasks =</span> ${ts.length}</div><div class="meta"><span class="k">✓ Completed tasks =</span> ${done}</div>
      ${prog(pct)}<div class="tags">${tag(st[0], st[1])}${due}</div></div>`;
  }
  function noteCard(n) {
    const nb = notebook(n.notebookId), tp = topic(n.topicId);
    return `<div class="card note" data-act="note" data-id="${n.id}"><div class="gtitle">${n.pinned ? '<span class="pin">📌</span>' : ''}${esc(n.title || 'Untitled')}</div>
      <div class="snip">${esc(n.body || '')}</div>
      <div class="tags">${nb ? tag(esc(nb.icon + ' ' + nb.name), 'orange') : ''}${tp ? tag(esc(tp.name), 'purple') : ''}</div>
      <div class="meta"><span class="k">Last edited ${ago(n.updated || n.created)}</span></div></div>`;
  }
  const BOOK_ST = { 'to read': ['📚 To read', 'gray'], reading: ['📖 Reading', 'orange'], paused: ['⏸ Paused', 'yellow'], finished: ['✅ Finished', 'green'] };
  function bookCard(b, drag = true) {
    const pct = b.pages ? Math.min(100, Math.round(((b.pagesRead || 0) / b.pages) * 100)) : 0;
    return `<div class="tcard" ${drag ? `draggable="true" data-drag="book" data-id="${b.id}"` : ''}>
      <div class="tt" data-act="edit" data-ent="book" data-id="${b.id}">${esc(b.title)}</div>
      ${b.author ? `<div class="meta">${esc(b.author)}</div>` : ''}
      <div class="tags">${b.genre ? tag(esc(b.genre), 'purple') : ''}${b.rating ? tag('★'.repeat(b.rating), 'yellow') : ''}</div>
      ${b.pages ? `${prog(pct, b.status === 'finished' ? 'green' : '')}<div class="meta"><span class="k">${b.status === 'finished' ? `${b.pages} pages` : `${Math.max(0, b.pages - (b.pagesRead || 0))} pages left`}</span></div>` : ''}
      ${b.status === 'reading' ? `<button type="button" class="mark" data-act="bookPage" data-id="${b.id}">Update page</button>` : ''}</div>`;
  }
  const RES_TYPES = { article: '📰', video: '🎬', podcast: '🎧', course: '🎓', tool: '🛠️', book: '📗', other: '🔖' };
  const RES_ST = { 'to review': 'orange', 'in progress': 'yellow', done: 'green' };
  function resourceRow(r) {
    const tp = topic(r.topicId), a = area(r.areaId);
    return `<div class="row-i"><span style="font-size:18px">${RES_TYPES[r.type] || '🔖'}</span>
      <span class="tt" style="font-weight:500">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>` : esc(r.title)}</span>
      <span class="tags">${tp ? tag(esc(tp.name), 'purple') : ''}${a ? tag(esc(a.icon + ' ' + a.name), 'gray') : ''}<button type="button" class="tag t-${RES_ST[r.status] || 'gray'}" style="border:0;cursor:pointer" data-act="resStatus" data-id="${r.id}" title="Change status">${esc(r.status || 'to review')}</button></span>
      <button class="btn ghost sm" data-act="edit" data-ent="resource" data-id="${r.id}" aria-label="Edit">✎</button></div>`;
  }

  // ---------- pages ----------
  const head = (ic, title, sub = '', right = '') => `<div class="phead plain"><div class="ic">${ic}</div><div style="flex:1"><h1>${title}</h1></div>${right}</div>${sub ? `<p class="sub">${sub}</p>` : ''}`;

  function greetingWord() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  const AFFIRMATIONS = [
    'I attract positive energy and repel negativity.', 'I am becoming the best version of myself.', 'Small steps every day add up to big things.',
    'I am proud of how far I have come.', 'My peace is my priority.', 'I am calm, focused and capable.', 'I choose progress over perfection.',
    'I deserve rest as much as I deserve success.', 'I am doing better than I think.', 'Today I will be gentle with myself.', 'I can do hard things.',
    'My dreams are valid.', 'I bloom at my own pace.', 'I finish what I start.', 'Every day I grow a little more.', 'I trust myself to figure it out.',
  ];
  const allAff = () => AFFIRMATIONS.concat((db.profile.affirmations || '').split('\n').map((s) => s.trim()).filter(Boolean));
  const affToday = () => { const l = allAff(), k = today(); return l[(db.affPick[k] ?? hashIdx(k + 'x') * 7 + new Date().getDate()) % l.length]; };
  const MOODS = ['happy ☀️', 'calm 🌿', 'whimsical 🌙', 'motivated ✨', 'productive 💪', 'loved 💗', 'tired 😴', 'anxious 🌧️', 'sad 💧'];

  function dailyReport() {
    const t = today(), name = db.profile.name;
    const due = db.tasks.filter((x) => x.date === t).sort(taskSort);
    const overdue = openTasks().filter((x) => x.date && x.date < t).sort(taskSort);
    const soon = openTasks().filter((x) => x.date && dayDiff(x.date) >= 1 && dayDiff(x.date) <= 3).sort(taskSort);
    const month = t.slice(0, 7), doneMonth = db.tasks.filter((x) => x.done && x.doneAt && ymd(new Date(x.doneAt)).startsWith(month)).length;
    const hDone = db.habits.filter((h) => h.days[t]).length, focus = db.sessions.filter((s) => s.date === t).reduce((a, s) => a + s.min, 0);
    const reading = db.books.filter((b) => b.status === 'reading');
    const li = (x) => `<li>${chk(x.done, 'toggleTask', x.id)}<span class="tt" style="font-weight:400;${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}" data-act="edit" data-ent="task" data-id="${x.id}">${x.start ? fmtTime(x.start) + ' · ' : ''}${esc(x.text)}</span></li>`;
    return `<div class="card report frame">
      <h3>☀️ Daily Update</h3>
      <div class="dt">📅 ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} (Week ${isoWeek(new Date())})</div>
      <p style="margin:6px 0 0">${greetingWord()}${name ? ', ' + esc(name) : ''}! Here's a quick glimpse of your day ✨</p>
      <div class="lbl">To-do list for today</div>
      ${due.length ? `<ul>${due.map(li).join('')}</ul>` : '<div class="empty" style="padding:4px 0">Nothing due today. Add something or enjoy the space ♡</div>'}
      ${overdue.length ? `<div class="lbl">Overdue tasks</div><ul>${overdue.slice(0, 5).map(li).join('')}</ul>` : ''}
      ${soon.length ? `<div class="lbl">Coming up</div><ul>${soon.slice(0, 4).map((x) => li(x).replace('</span></li>', ` <span class="tag t-gray">${fmtDay(x.date, { weekday: 'short' })}</span></span></li>`)).join('')}</ul>` : ''}
      <div class="sum">
        <span>${overdue.length ? `🔔 You have ${plural(overdue.length, 'task')} overdue.` : '🌤️ No overdue tasks. Lovely!'}</span>
        <span>✅ You've finished ${plural(doneMonth, 'task')} this month.</span>
        ${db.habits.length ? `<span>🌱 Habits today: ${hDone}/${db.habits.length}</span>` : ''}
        <span>⏱️ Focused ${focus} min today.</span>
        ${reading.length ? `<span>📖 Reading: ${reading.map((b) => `${esc(b.title)}${b.pages ? ` (${b.pagesRead || 0}/${b.pages})` : ''}`).join(', ')}</span>` : ''}
        ${isInboxCount() ? `<span>📥 ${plural(isInboxCount(), 'item')} waiting in your inbox. <a href="#/tasks/inbox">Sort them</a></span>` : ''}
      </div></div>`;
  }
  const isInboxCount = () => db.tasks.filter(isInbox).length;
  const CAP_TYPES = [['task', '📥 Task'], ['today', '☀️ Today'], ['note', '✏️ Note'], ['goal', '🎯 Goal'], ['resource', '🔗 Resource'], ['book', '📚 Book']];
  const captureBox = (id = 'capIn') => `<form data-submit="capture" autocomplete="off"><input class="in" id="${id}" name="q" placeholder="Capture a thought, task, link or book…" style="width:100%"></form>
    <div class="capture-types">${CAP_TYPES.map(([k, l]) => `<button type="button" class="${ui.capType === k ? 'on' : ''}" data-act="capType" data-v="${k}">${l}</button>`).join('')}</div>`;

  function pDash() {
    const methods = [
      ['para', 'PARA', 'Projects · Areas · Resources · Archive', '🗃️ 🧁 🎀', 0],
      ['tasks/inbox', 'GTD', 'Capture to the inbox, then sort and finish', '📥 🍵 ✨', 1],
      ['tasks/matrix', 'MATRIX', 'Urgent vs important: what to do first', '🧭 🍩 🍓', 3],
    ];
    const goals = live(db.goals).filter((g) => g.status !== 'achieved').slice(0, 4);
    const projs = live(db.projects).filter((p) => p.status !== 'done').slice(0, 5);
    const reading = db.books.filter((b) => b.status === 'reading');
    const m = db.moods[today()];
    return `<div class="cover"><div class="art"><span>🧠</span><span>☕</span><span>📚</span><span>🌷</span><span>🗂️</span><span>🍰</span><span>✨</span></div></div>
      <div class="phead"><div class="ic">🧠</div></div>
      <h1 style="margin-top:6px">Second Brain</h1>
      <p class="sub">Goals. Projects. Tasks. Notes. Resources. Books. <span class="hand">capture it once, find it again ♡</span></p>
      <div class="grid dash-top">
        ${dailyReport()}
        <div class="grid" style="gap:16px">
          <div class="card"><h3>⚡ Quick capture</h3>${captureBox()}</div>
          <div class="card affirm"><div class="lbl2">today's affirmation</div><p>${esc(affToday())}</p>
            <div style="display:flex;gap:6px;align-items:center;margin-top:8px"><button class="btn ghost sm" data-act="affNext">another one ↻</button></div>
            <div class="lbl2" style="margin-top:10px">mood</div><div class="moods">${MOODS.map((x) => `<button type="button" class="${m === x ? 'on' : ''}" data-act="mood" data-v="${x}">${x}</button>`).join('')}</div></div>
        </div>
      </div>
      ${label('Productivity-Methods')}
      <div class="grid g3 methods">${methods.map(([to, t, d, a, i]) => `<div class="gcard method" data-act="go" data-to="${to}">${cover({ art: a }, i)}<div class="gbody"><div class="gtitle">${t}</div><div class="meta">${d}</div></div></div>`).join('')}</div>
      ${label('Life-Areas', `<a class="btn ghost sm" href="#/areas">open</a>`)}
      <div class="gal cov">${db.areas.map(areaCard).join('')}</div>
      <div class="grid g2" style="margin-top:16px">${wheelCard()}
        <div class="card"><h3>🎯 Life goals<span class="r">${btnNew('goal', '+ goal', {}, 'btn ghost sm')}</span></h3>
        ${goals.length ? goals.map((g) => `<div class="row-i" style="flex-wrap:wrap"><span class="tt" data-act="go" data-to="goal/${g.id}">${esc(g.icon || '🎯')} ${esc(g.title)}</span><span class="meta">${goalPct(g)}%</span><div style="flex-basis:100%">${prog(goalPct(g))}</div></div>`).join('') : '<div class="empty">Set a life goal, then link projects to it.</div>'}</div></div>
      ${label("Today's-Schedule", `<a class="btn ghost sm" href="#/tasks">all tasks</a>`)}
      <div class="grid g2"><div class="card"><h3>🕒 ${ui.selDay === today() ? 'Today' : fmtDay(ui.selDay, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>${timeline(ui.selDay)}</div>
        <div class="card"><h3>🌱 Habits<span class="r">${btnNew('habit', '+ habit', {}, 'btn ghost sm')}</span></h3>${habitRows(false)}</div></div>
      ${label('Weekly-Overview', weekNav())}
      ${weekCal()}
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><h3>🗂️ Projects in progress<span class="r">${btnNew('project', '+ project', {}, 'btn ghost sm')}</span></h3>
          ${projs.length ? projs.map((p) => `<div class="row-i" style="flex-wrap:wrap"><span class="tt" data-act="go" data-to="project/${p.id}">${esc(p.icon || '📁')} ${esc(p.title)}</span><span class="meta">${projPct(p)}%</span><div style="flex-basis:100%">${prog(projPct(p))}</div></div>`).join('') : '<div class="empty">No active projects yet.</div>'}</div>
        <div class="card"><h3>📖 Currently reading<span class="r"><a class="btn ghost sm" href="#/library">library</a></span></h3>
          ${reading.length ? reading.map((b) => bookCard(b, false)).join('<div style="height:8px"></div>') : '<div class="empty">No book in progress. Add one to your library.</div>'}</div>
      </div>
      ${label('My-Notebooks', `<a class="btn ghost sm" href="#/notes">all notes</a>`)}
      <div class="gal cov">${db.notebooks.map((nb, i) => `<div class="gcard" data-act="openNotebook" data-id="${nb.id}">${cover(nb, i + 2)}<div class="gbody"><div class="gtitle">${esc(nb.icon)} ${esc(nb.name)}</div><div class="meta"><span class="k">Total notes:</span> ${live(db.notes).filter((n) => n.notebookId === nb.id).length}</div></div></div>`).join('')}</div>`;
  }

  function pTasks(view = 'today') {
    view ||= 'today';
    const t = today();
    const counts = { today: openTasks().filter((x) => x.date && x.date <= t).length, inbox: isInboxCount() };
    const tabs = [['today', '☀️ Today'], ['week', '📅 This week'], ['inbox', '📥 Inbox'], ['matrix', '🧭 Matrix'], ['all', '🗂️ All open'], ['done', '✅ Completed']];
    let body = '';
    if (view === 'today') {
      const overdue = openTasks().filter((x) => x.date && x.date < t).sort(taskSort);
      const due = db.tasks.filter((x) => x.date === t).sort(taskSort);
      body = (overdue.length ? `${label('Overdue')}${cards(overdue, (x) => taskCard(x), '')}` : '') +
        `${label('Due-Today', btnNew('task', '+ task for today', { date: t }))}${cards(due, (x) => taskCard(x), 'Nothing due today. Pull something from your inbox or this week ♡')}`;
    } else if (view === 'week') {
      body = `${label('Weekly-Overview', weekNav())}${weekCal()}
        <div class="grid g2" style="margin-top:16px"><div class="card"><h3>🕒 ${fmtDay(ui.selDay, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>${timeline(ui.selDay)}</div>
        <div class="card"><h3>📋 Tasks on this day</h3>${rows(db.tasks.filter((x) => x.date === ui.selDay && !x.start).sort(taskSort), (x) => taskRow(x), 'No untimed tasks on this day.')}
        <div style="margin-top:6px">${btnNew('task', '+ task', { date: ui.selDay }, 'btn ghost sm')}</div></div></div>`;
    } else if (view === 'inbox') {
      const inbox = db.tasks.filter(isInbox).sort((a, b) => b.created - a.created);
      const projOpts = live(db.projects).filter((p) => p.status !== 'done');
      body = `<div class="steps">${[['1. Capture', 'Dump everything here, fast.'], ['2. Clarify', 'Is it actionable? What is the next step?'], ['3. Organize', 'Give it a date, a project or a matrix spot.'], ['4. Reflect', 'Review your week every Sunday.'], ['5. Engage', 'Work from Today, not from memory.']].map(([a, b]) => `<div class="step"><b>${a}</b>${b}</div>`).join('')}</div>
        <div class="card" style="margin-bottom:16px">${captureBox('inboxIn')}</div>
        ${label(`Inbox · ${inbox.length}`)}
        ${inbox.length ? `<div class="gal wide">${inbox.map((x) => `<div class="tcard"><div class="trow">${chk(false, 'toggleTask', x.id)}<span class="tt" data-act="edit" data-ent="task" data-id="${x.id}">${esc(x.text)}</span></div>
          <div class="meta"><span class="k">captured ${ago(x.created)}</span></div>
          <div class="clarify"><button class="btn sm" data-act="setDate" data-id="${x.id}" data-v="0">☀️ today</button><button class="btn sm" data-act="setDate" data-id="${x.id}" data-v="1">🌙 tomorrow</button>
          <button class="btn sm" data-act="flag" data-id="${x.id}" data-v="important">⭐</button><button class="btn sm" data-act="flag" data-id="${x.id}" data-v="urgent">⚡</button>
          <select class="in" style="padding:3px 6px;font-size:13px" data-change="setProject" data-id="${x.id}"><option value="">📁 project…</option>${projOpts.map((p) => `<option value="${p.id}">${esc(p.icon + ' ' + p.title)}</option>`).join('')}</select>
          <button class="btn ghost sm danger" data-act="del" data-ent="task" data-id="${x.id}" aria-label="Delete">🗑</button></div>
          <div class="tags">${quadTags(x)}</div></div>`).join('')}</div>` : '<div class="empty c">Inbox zero ✨ Everything has a home.</div>'}`;
    } else if (view === 'matrix') {
      const open = openTasks();
      body = `<p class="sub" style="margin-top:0">Drag tasks between boxes on a laptop, or use ⭐ important and ⚡ urgent when editing a task.</p><div class="matrix">${[1, 2, 3, 4].map((q) => {
        const items = open.filter((x) => quadOf(x) === q).sort(taskSort);
        return `<div class="quad ${QUADS[q].cls}" data-drop="quad" data-v="${q}"><h4>${QUADS[q].e} ${QUADS[q].name} <span class="tag t-gray">${items.length}</span><span style="margin-left:auto">${btnNew('task', '+', { ...QUADS[q].f, date: q === 1 ? t : '' }, 'btn ghost sm')}</span></h4><div class="qs">${QUADS[q].sub}</div>
          <div class="rows">${items.map((x) => taskCard(x, { drag: true })).join('') || '<div class="empty">Nothing here.</div>'}</div></div>`;
      }).join('')}</div>`;
    } else if (view === 'all') {
      const open = openTasks().sort(taskSort);
      const groups = [...live(db.projects).filter((p) => open.some((x) => x.projectId === p.id)), null];
      body = groups.map((p) => {
        const items = open.filter((x) => (p ? x.projectId === p.id : !project(x.projectId)));
        if (!items.length) return '';
        return `${label(p ? `${esc(p.icon || '📁')} ${esc(p.title)}` : 'No-Project')}<div class="card">${rows(items, (x) => taskRow(x, { showProj: false }), '')}</div>`;
      }).join('') || '<div class="empty c">No open tasks. You are all caught up ✨</div>';
    } else {
      const done = db.tasks.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 150);
      body = `<div class="card">${rows(done, (x) => taskRow(x), 'Nothing completed yet.')}</div>${done.length ? `<p><button class="btn sm" data-act="clearDone">Clear completed tasks older than 30 days</button></p>` : ''}`;
    }
    return head('✅', 'Tasks', 'Plan and finish urgent tasks. Every task can belong to a project.', btnNew('task', '+ New task', view === 'today' ? { date: t } : {}, 'btn pri')) +
      `<div class="tabs">${tabs.map(([k, l]) => `<a href="#/tasks/${k}" class="${view === k ? 'on' : ''}">${l}${counts[k] ? `<span class="n">${counts[k]}</span>` : ''}</a>`).join('')}</div>${body}`;
  }

  function pProjects(tab = 'active') {
    tab ||= 'active';
    const all = live(db.projects);
    const list = tab === 'all' ? all : tab === 'done' ? all.filter((p) => p.status === 'done') : all.filter((p) => p.status !== 'done');
    return head('🗂️', 'Projects', 'Associate each task with a project, and each project with a goal.', btnNew('project', '+ New project', {}, 'btn pri')) +
      `<div class="tabs">${[['active', 'Active'], ['done', 'Complete'], ['all', 'All projects']].map(([k, l]) => `<a href="#/projects/${k}" class="${tab === k ? 'on' : ''}">${l}<span class="n">${(k === 'all' ? all : k === 'done' ? all.filter((p) => p.status === 'done') : all.filter((p) => p.status !== 'done')).length}</span></a>`).join('')}</div>
      ${list.length ? `<div class="gal">${list.map(projectCard).join('')}</div>` : '<div class="empty c">No projects here yet. A project is any outcome that takes more than one step.</div>'}`;
  }
  function pProject(id) {
    const p = project(id);
    if (!p) return '<div class="empty c">This project no longer exists. <a href="#/projects">Back to projects</a></div>';
    const ts = projTasks(p).sort(taskSort), g = goal(p.goalId), a = area(projArea(p)), st = STATUS_TAG[p.status] || STATUS_TAG['not started'];
    return `<div class="cover small"><div class="art"><span>${esc(p.icon || '📁')}</span><span>☕</span><span>${esc(p.icon || '📁')}</span></div></div>
      <div class="phead"><div class="ic">${esc(p.icon || '📁')}</div></div><h1 style="margin-top:6px">${esc(p.title)}</h1>
      <div class="tags" style="margin:6px 0 10px">${tag(st[0], st[1])}${g ? `<a href="#/goal/${g.id}" class="tag t-purple" style="text-decoration:none">🎯 ${esc(g.title)}</a>` : ''}${a ? `<a href="#/area/${a.id}" class="tag t-gray" style="text-decoration:none">${esc(a.icon + ' ' + a.name)}</a>` : ''}${p.due ? tag('Due ' + fmtDay(p.due), 'blue') : ''}</div>
      <div style="max-width:420px">${prog(projPct(p))}<div class="meta" style="margin-top:4px">${projPct(p)}% · ${ts.filter((t) => t.done).length}/${ts.length} tasks done</div></div>
      ${p.desc ? `<p style="white-space:pre-wrap;color:var(--ink-2)">${esc(p.desc)}</p>` : ''}
      <div class="row" style="display:flex;gap:6px;margin:12px 0;flex-wrap:wrap"><button class="btn sm" data-act="edit" data-ent="project" data-id="${p.id}">✎ Edit</button>
        <button class="btn sm" data-act="projStatus" data-id="${p.id}">${p.status === 'done' ? '↺ Reopen' : '✓ Mark complete'}</button><button class="btn sm" data-act="archive" data-ent="project" data-id="${p.id}">📦 Archive</button></div>
      ${label('Tasks')}
      <div class="card">${rows(ts, (t) => taskRow(t, { showProj: false }), 'No tasks yet. Break this project into small steps.')}
        <form class="add-inline" data-submit="addTask" data-p="${attr({ projectId: p.id })}"><input class="in" id="addTask-${p.id}" name="q" placeholder="Add a task and press Enter…"><button class="btn sm">Add</button></form></div>`;
  }

  function pGoals(tab = 'active') {
    tab ||= 'active';
    const all = live(db.goals), list = tab === 'achieved' ? all.filter((g) => g.status === 'achieved') : all.filter((g) => g.status !== 'achieved');
    return head('🎯', 'Life goals', 'Track goals for each life area. Progress comes from the projects linked to each goal.', btnNew('goal', '+ New goal', {}, 'btn pri')) +
      `<div class="tabs">${[['active', 'Active'], ['achieved', 'Achieved 🏆']].map(([k, l]) => `<a href="#/goals/${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>
      ${list.length ? `<div class="gal">${list.map(goalCard).join('')}</div>` : `<div class="empty c">${tab === 'achieved' ? 'Your achieved goals will live here.' : 'What do you want this year to be about? Add your first goal.'}</div>`}`;
  }
  function pGoal(id) {
    const g = goal(id);
    if (!g) return '<div class="empty c">This goal no longer exists. <a href="#/goals">Back to goals</a></div>';
    const a = area(g.areaId), ps = goalProjects(g);
    return head(esc(g.icon || '🎯'), esc(g.title), '', `<button class="btn sm" data-act="edit" data-ent="goal" data-id="${g.id}">✎ Edit</button>`) +
      `<div class="tags" style="margin-bottom:10px">${g.status === 'achieved' ? tag('Achieved 🏆', 'green') : tag('Active', 'orange')}${a ? `<a href="#/area/${a.id}" class="tag t-gray" style="text-decoration:none">${esc(a.icon + ' ' + a.name)}</a>` : ''}${g.deadline ? tag('by ' + fmtDay(g.deadline, { day: 'numeric', month: 'short', year: 'numeric' }), 'blue') : ''}</div>
      <div style="max-width:420px">${prog(goalPct(g))}<div class="meta" style="margin-top:4px">${goalPct(g)}% complete</div></div>
      ${g.why ? `<div class="card" style="margin-top:14px"><h3>💭 Why this matters</h3><div style="white-space:pre-wrap;color:var(--ink-2)">${esc(g.why)}</div></div>` : ''}
      ${label('Projects', btnNew('project', '+ project for this goal', { goalId: g.id, areaId: g.areaId || '' }))}
      ${ps.length ? `<div class="gal">${ps.map(projectCard).join('')}</div>` : '<div class="empty">Link projects to this goal to track progress.</div>'}
      <p><button class="btn sm" data-act="goalDone" data-id="${g.id}">${g.status === 'achieved' ? '↺ Mark as active' : '🏆 Mark as achieved'}</button> <button class="btn sm" data-act="archive" data-ent="goal" data-id="${g.id}">📦 Archive</button></p>`;
  }

  function pAreas() {
    return head('🌸', 'Life areas', 'Track progress across every part of your life. Each area holds goals, projects, notes and resources.', btnNew('area', '+ New area', { rating: 5 }, 'btn pri')) +
      `<div class="gal cov">${db.areas.map(areaCard).join('')}</div><div style="margin-top:16px;max-width:760px">${wheelCard()}</div>`;
  }
  function pArea(id) {
    const a = area(id);
    if (!a) return '<div class="empty c">This area no longer exists. <a href="#/areas">Back to areas</a></div>';
    const gs = live(db.goals).filter((g) => g.areaId === a.id), ps = live(db.projects).filter((p) => projArea(p) === a.id);
    const ns = live(db.notes).filter((n) => n.areaId === a.id), rs = live(db.resources).filter((r) => r.areaId === a.id), s = areaStats(a);
    const [x, y, z] = art(a);
    return `<div class="cover small"><div class="art"><span>${esc(x)}</span><span>${esc(y || x)}</span><span>${esc(z || x)}</span></div></div>
      <div class="phead"><div class="ic">${esc(a.icon)}</div></div><h1 style="margin-top:6px">${esc(a.name)}</h1>
      <div style="max-width:420px;margin:8px 0">${prog(s.pct)}<div class="meta" style="margin-top:4px">${s.pct}% progress · wheel of life rating ${a.rating || 0}/10</div></div>
      <button class="btn sm" data-act="edit" data-ent="area" data-id="${a.id}">✎ Edit area</button>
      ${label('Goals', btnNew('goal', '+ goal', { areaId: a.id }))}${gs.length ? `<div class="gal">${gs.map(goalCard).join('')}</div>` : '<div class="empty">No goals in this area yet.</div>'}
      ${label('Projects', btnNew('project', '+ project', { areaId: a.id }))}${ps.length ? `<div class="gal">${ps.map(projectCard).join('')}</div>` : '<div class="empty">No projects in this area yet.</div>'}
      ${label('Notes')}${ns.length ? `<div class="gal">${ns.map(noteCard).join('')}</div>` : '<div class="empty">Notes you tag with this area show up here.</div>'}
      ${label('Resources', btnNew('resource', '+ resource', { areaId: a.id }))}<div class="card">${rows(rs, resourceRow, 'Resources you tag with this area show up here.')}</div>`;
  }

  function pNotes() {
    const all = live(db.notes);
    let list = all.filter((n) => (!ui.notebook || n.notebookId === ui.notebook) && (!ui.topic || n.topicId === ui.topic) && (ui.noteTab !== 'pinned' || n.pinned));
    list = list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
    const nb = notebook(ui.notebook);
    return head('📓', 'Notes', 'Notebooks → notes + topics → resources. Keep notebooks for organizing your notes.', `<button class="btn pri" data-act="newNote">+ New note</button>`) +
      `${label('My-Notebooks', btnNew('notebook', '+ notebook', { icon: '📒', art: '📒 🍪' }, 'btn ghost sm'))}
      <div class="gal cov">${db.notebooks.map((n, i) => `<div class="gcard" data-act="openNotebook" data-id="${n.id}" style="${ui.notebook === n.id ? 'outline:2px solid var(--accent)' : ''}">${cover(n, i + 2)}<div class="gbody"><div class="gtitle">${esc(n.icon)} ${esc(n.name)}</div><div class="meta"><span class="k">Total notes:</span> ${all.filter((x) => x.notebookId === n.id).length}</div></div></div>`).join('')}</div>
      ${label(nb ? `${esc(nb.icon)} ${esc(nb.name)}` : 'My-Notes', nb ? `<button class="btn ghost sm" data-act="edit" data-ent="notebook" data-id="${nb.id}">✎ notebook</button><button class="btn ghost sm" data-act="openNotebook" data-id="">show all</button>` : '')}
      <div class="tabs">${[['all', 'All notes'], ['pinned', '📌 Pinned']].map(([k, l]) => `<button class="${ui.noteTab === k ? 'on' : ''}" data-act="noteTab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="chips"><button class="chip ${!ui.topic ? 'on' : ''}" data-act="topicFilter" data-v="">All topics</button>${db.topics.map((t) => `<button class="chip ${ui.topic === t.id ? 'on' : ''}" data-act="topicFilter" data-v="${t.id}">${esc(t.name)}</button>`).join('')}</div>
      ${list.length ? `<div class="gal">${list.map(noteCard).join('')}</div>` : '<div class="empty c">No notes here yet. Capture an idea ✏️</div>'}
      ${label('Topics', btnNew('topic', '+ topic', {}, 'btn ghost sm'))}
      <div class="gal">${db.topics.map((t) => `<div class="card" style="cursor:pointer" data-act="edit" data-ent="topic" data-id="${t.id}"><div class="gtitle">🏷️ ${esc(t.name)}</div><div class="meta"><span class="k">Notes</span> ${all.filter((n) => n.topicId === t.id).length} · <span class="k">Resources</span> ${live(db.resources).filter((r) => r.topicId === t.id).length}</div></div>`).join('')}</div>`;
  }

  function pResources() {
    const list = live(db.resources).filter((r) => (!ui.resType || r.type === ui.resType) && (!ui.topic || r.topicId === ui.topic)).sort((a, b) => (b.created || 0) - (a.created || 0));
    return head('🔗', 'Resources', 'Articles, videos, courses and tools worth keeping. Tag them with a topic to find them again.', btnNew('resource', '+ New resource', { type: 'article', status: 'to review' }, 'btn pri')) +
      `<div class="chips"><button class="chip ${!ui.resType ? 'on' : ''}" data-act="resType" data-v="">All types</button>${Object.entries(RES_TYPES).map(([k, e]) => `<button class="chip ${ui.resType === k ? 'on' : ''}" data-act="resType" data-v="${k}">${e} ${k}</button>`).join('')}</div>
      <div class="chips"><button class="chip ${!ui.topic ? 'on' : ''}" data-act="topicFilter" data-v="">All topics</button>${db.topics.map((t) => `<button class="chip ${ui.topic === t.id ? 'on' : ''}" data-act="topicFilter" data-v="${t.id}">${esc(t.name)}</button>`).join('')}</div>
      <div class="card">${rows(list, resourceRow, 'No resources yet. Save a link with quick capture.')}</div>`;
  }

  function pLibrary(tab = 'books') {
    tab ||= 'books';
    const tabs = [['books', '📚 Books'], ['genres', '🏷️ Genres'], ['highlights', '✨ Highlights'], ['report', '📊 Report']];
    let body = '';
    if (tab === 'books') {
      body = `<div class="kanban">${Object.entries(BOOK_ST).map(([k, [l]]) => {
        const items = db.books.filter((b) => b.status === k);
        return `<div class="kcol" data-drop="book" data-v="${k}"><div class="khead">${l}<span class="n">${items.length}</span><span style="margin-left:auto">${btnNew('book', '+', { status: k }, 'btn ghost sm')}</span></div>${items.map((b) => bookCard(b)).join('')}</div>`;
      }).join('')}</div><p class="sub">Drag books between columns, or open a book to edit it.</p>`;
    } else if (tab === 'genres') {
      const genres = [...new Set(db.books.map((b) => b.genre).filter(Boolean))].sort();
      const gi = { adventure: '🧭', fiction: '📕', productivity: '⚡', philosophy: '🦉', horror: '🕯️', humor: '😂', romance: '💗', 'self-help': '🌱', business: '💼', biography: '👤', fantasy: '🐉', history: '🏛️', science: '🔭', poetry: '🪶' };
      body = `${genres.length ? `<div class="gal">${genres.map((g) => `<div class="card" style="cursor:pointer;${ui.genre === g ? 'outline:2px solid var(--accent)' : ''}" data-act="genre" data-v="${esc(g)}"><div class="gtitle">${gi[g.toLowerCase()] || '📖'} ${esc(g)}</div><div class="meta"><span class="k">Total books =</span> ${db.books.filter((b) => b.genre === g).length}</div></div>`).join('')}</div>` : '<div class="empty c">Give your books a genre to see them grouped here.</div>'}
        ${ui.genre ? `${label(esc(ui.genre))}<div class="gal">${db.books.filter((b) => b.genre === ui.genre).map((b) => bookCard(b, false)).join('')}</div>` : ''}`;
    } else if (tab === 'highlights') {
      const withH = db.books.filter((b) => db.highlights.some((h) => h.bookId === b.id));
      body = `<div style="margin-bottom:12px">${btnNew('highlight', '+ New highlight', { bookId: db.books[0]?.id || '' }, 'btn pri')}</div>` +
        (withH.length ? withH.map((b) => `${label(`📖 ${esc(b.title)}`)}<div class="card">${db.highlights.filter((h) => h.bookId === b.id).sort((x, y) => y.created - x.created).map((h) => `<div class="row-i" style="align-items:flex-start"><span style="color:var(--accent);font-size:20px;line-height:1">❝</span><span class="tt" style="font-weight:400" data-act="edit" data-ent="highlight" data-id="${h.id}">${esc(h.text)}</span><span class="meta" style="white-space:nowrap">${h.page ? 'p. ' + h.page + ' · ' : ''}${new Date(h.created).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>`).join('')}</div>`).join('') : '<div class="empty c">Highlight important quotes from your books and they will be kept here.</div>');
    } else {
      const reading = db.books.filter((b) => b.status === 'reading'), year = String(new Date().getFullYear());
      const finished = db.books.filter((b) => b.status === 'finished'), finYear = finished.filter((b) => (b.finished || '').startsWith(year));
      const pages = db.books.reduce((a, b) => a + (b.status === 'finished' ? (b.pages || 0) : (b.pagesRead || 0)), 0);
      body = `<div class="grid g4">${[[reading.length, 'books in progress'], [finYear.length, `books read in ${year}`], [pages, 'total pages read'], [db.highlights.length, 'highlights saved']].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
        <div class="grid g2" style="margin-top:16px"><div class="card report frame"><h3>📊 Reading stats</h3><div class="dt">📅 ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div class="lbl">Reading summary</div><div class="sum" style="margin-top:4px"><span>→ Books in progress: ${reading.length}</span><span>→ Books read: ${finished.length}</span><span>→ Total pages read: ${pages}</span><span>→ Want to read: ${db.books.filter((b) => b.status === 'to read').length}</span></div></div>
          <div class="card"><h3>📖 Currently reading</h3>${reading.length ? reading.map((b) => bookCard(b, false)).join('<div style="height:8px"></div>') : '<div class="empty">Nothing in progress.</div>'}</div></div>`;
    }
    return head('📚', 'Library', 'Add and track your books, genres, highlights and reading stats.', btnNew('book', '+ New book', { status: 'to read' }, 'btn pri')) +
      `<div class="tabs">${tabs.map(([k, l]) => `<a href="#/library/${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>${body}`;
  }

  function pHabits() {
    return head('🌱', 'Habits', 'Tap a circle to tick off a day. Tap a habit’s icon to edit or remove it.', btnNew('habit', '+ New habit', { icon: '💧' }, 'btn pri')) + `<div class="card">${habitRows(true)}</div>`;
  }

  const J = { grateful: 'I’m grateful for', wins: 'Today’s little wins', lessons: 'What I learned', notes: 'Thoughts' };
  const hasText = (e) => e && (e.grateful || e.wins || e.lessons || e.notes);
  function pJournal() {
    const e = db.journal[ui.jDate] || {};
    const days = Object.keys(db.journal).filter((d) => hasText(db.journal[d])).sort().reverse();
    return head('📖', 'Journal', 'Dear diary. Saves as you type.', `<input type="date" class="in" value="${ui.jDate}" data-change="jDate" aria-label="Journal date">`) +
      `<div class="grid g-journal"><div class="card frame" style="padding:18px 20px">
        <h3 style="font-size:19px">${fmtDay(ui.jDate, { weekday: 'long', day: 'numeric', month: 'long' })}${db.moods[ui.jDate] ? ` · <span style="font-weight:400">${esc(db.moods[ui.jDate])}</span>` : ''}</h3>
        ${Object.entries(J).map(([k, l]) => `<label class="jfield"><span>${l}</span><textarea class="lined" data-input="journal" data-k="${k}" style="${k === 'notes' ? 'min-height:140px' : ''}">${esc(e[k] || '')}</textarea></label>`).join('')}
        <p class="meta" id="jSaved" style="margin:8px 0 0">saves as you type</p></div>
        <div class="card"><h3>🗓️ Past entries</h3>${days.length ? days.map((d) => { const x = db.journal[d]; return `<details class="entry"><summary>${fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${db.moods[d] ? ' · ' + esc(db.moods[d]) : ''}</summary>${Object.entries(J).map(([k, l]) => (x[k] ? `<p><b>${l}</b><br>${esc(x[k])}</p>` : '')).join('')}<button class="link" data-act="jOpen" data-v="${d}">open this day</button></details>`; }).join('') : '<div class="empty">Your first entry is waiting ♡</div>'}</div></div>`;
  }

  // focus timer
  const timer = { mode: 'focus', left: 0, total: 0, endAt: 0, running: false, count: 0, taskId: '', tick: null };
  const CIRC = 2 * Math.PI * 52;
  const minutesFor = (m) => (m === 'focus' ? db.settings.f : m === 'short' ? db.settings.s : db.settings.l);
  function setMode(m) { timer.mode = m; timer.total = timer.left = minutesFor(m) * 60; timer.running = false; clearInterval(timer.tick); drawTimer(); }
  function drawTimer() {
    const s = Math.max(0, Math.round(timer.left)), txt = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    const lbl = { focus: timer.running ? 'you’re doing great' : 'time to focus', short: 'little break ☕', long: 'long break 🌿' }[timer.mode];
    if ($('clock')) {
      $('clock').textContent = txt; $('modeLabel').textContent = lbl;
      $('ringFg').style.strokeDashoffset = CIRC * (1 - timer.left / timer.total);
      $('startBtn').textContent = timer.running ? 'pause' : timer.left < timer.total ? 'resume' : 'start';
      document.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.v === timer.mode));
    }
    $('miniTimer').hidden = !timer.running && timer.left === timer.total;
    $('miniClock').textContent = txt; $('miniLabel').textContent = timer.mode === 'focus' ? 'focus' : 'break';
    document.title = timer.running ? `${txt} · ${timer.mode === 'focus' ? 'focus' : 'break'}` : 'My Second Brain';
  }
  function finish(skipped) {
    clearInterval(timer.tick); timer.running = false;
    if (timer.mode === 'focus') {
      timer.count++;
      const t = byId(db.tasks, timer.taskId), min = Math.round((timer.total - Math.max(0, timer.left)) / 60);
      if (min > 0) db.sessions.push({ date: today(), at: Date.now(), min, task: t ? t.text : '' });
      save();
      if (!skipped) notify('focus session done', 'beautiful work. time for a little break ♡');
      setMode(timer.count % 4 === 0 ? 'long' : 'short');
    } else {
      if (!skipped) notify('break is over', 'ready when you are ♡');
      setMode('focus');
    }
    if (route().page === 'focus') render();
  }
  function startPause() {
    if (timer.running) { timer.running = false; clearInterval(timer.tick); }
    else {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      timer.running = true; timer.endAt = Date.now() + timer.left * 1000;
      timer.tick = setInterval(() => { timer.left = (timer.endAt - Date.now()) / 1000; if (timer.left <= 0) finish(); else drawTimer(); }, 250);
    }
    drawTimer();
  }
  function pFocus() {
    const open = openTasks().filter((t) => !t.date || t.date <= today());
    const ses = db.sessions.filter((s) => s.date === today()), total = ses.reduce((a, s) => a + s.min, 0);
    const week = Array.from({ length: 7 }, (_, i) => ymd(addDays(monday(new Date()), i))).map((d) => db.sessions.filter((s) => s.date === d).reduce((a, s) => a + s.min, 0));
    return head('⏱️', 'Focus', 'One thing at a time. A long break comes after every 4th session.') +
      `<div class="grid g2" style="align-items:start"><div class="card focus">
        <div class="modes">${[['focus', 'focus'], ['short', 'short break'], ['long', 'long break']].map(([k, l]) => `<button type="button" data-act="mode" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" id="ringFg" cx="60" cy="60" r="52" style="stroke-dasharray:${CIRC}"/></svg><div class="in"><div class="clock" id="clock">25:00</div><small class="meta" id="modeLabel" style="justify-content:center">time to focus</small></div></div>
        <div style="display:flex;gap:8px;justify-content:center"><button class="btn pri" id="startBtn" data-act="timer">start</button><button class="btn" data-act="timerReset">reset</button><button class="btn" data-act="timerSkip">skip</button></div></div>
        <div class="grid" style="gap:16px"><div class="card"><label class="fld"><span>Working on</span><select class="in" data-change="focusTask"><option value="">— nothing specific —</option>${open.map((t) => `<option value="${t.id}" ${t.id === timer.taskId ? 'selected' : ''}>${esc(t.text)}</option>`).join('')}</select></label>
          <div class="frow">${[['f', 'Focus (min)'], ['s', 'Short break'], ['l', 'Long break']].map(([k, l]) => `<label class="fld"><span>${l}</span><input class="in" type="number" min="1" max="180" value="${db.settings[k]}" data-change="timerSet" data-k="${k}"></label>`).join('')}</div></div>
        <div class="card"><h3>📈 This week<span class="r meta">${total} min today</span></h3><div style="display:flex;gap:6px;align-items:flex-end;height:90px">${week.map((m, i) => `<div style="flex:1;text-align:center;font-size:11px;color:var(--muted)"><div title="${m} min" style="height:${Math.max(4, Math.min(70, m))}px;background:${i === (new Date().getDay() + 6) % 7 ? 'var(--accent)' : 'var(--peach)'};border-radius:4px 4px 0 0;margin-bottom:3px"></div>${'MTWTFSS'[i]}</div>`).join('')}</div></div>
        <div class="card"><h3>Today's sessions</h3>${ses.length ? `<div class="rows">${ses.slice().reverse().map((s) => `<div class="row-i"><span>💗</span><span class="tt" style="font-weight:400">${esc(s.task || 'focus session')}</span><span class="meta">${s.min} min · ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>`).join('')}</div>` : '<div class="empty">No sessions yet today.</div>'}</div></div></div>`;
  }

  function pPara() {
    const ps = live(db.projects).filter((p) => p.status !== 'done'), rs = live(db.resources);
    const archived = ['projects', 'goals', 'notes', 'resources'].reduce((a, k) => a + db[k].filter((x) => x.archived).length, 0);
    const box = (L, title, desc, list, to, count) => `<div class="card" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:12px;align-items:center"><span class="para-letter">${L}</span><div><div class="gtitle">${title} <span class="tag t-gray">${count}</span></div><div class="meta">${desc}</div></div></div>${list}<a class="btn sm" href="#/${to}" style="align-self:flex-start;text-decoration:none">open ${title.toLowerCase()}</a></div>`;
    return head('🗃️', 'PARA method', 'Organize everything by Projects, Areas, Resources and Archive. Sort by how actionable it is, not by subject.') +
      `<div class="grid g2">${box('P', 'Projects', 'Short-term efforts with a goal and a deadline.', rows(ps.slice(0, 5), (p) => `<div class="row-i"><span class="tt" data-act="go" data-to="project/${p.id}">${esc(p.icon || '📁')} ${esc(p.title)}</span><span class="meta">${projPct(p)}%</span></div>`, 'No active projects.'), 'projects', ps.length)}
      ${box('A', 'Areas', 'Ongoing responsibilities you maintain over time.', rows(db.areas, (a) => `<div class="row-i"><span class="tt" data-act="go" data-to="area/${a.id}">${esc(a.icon)} ${esc(a.name)}</span><span class="meta">${areaStats(a).pct}%</span></div>`, ''), 'areas', db.areas.length)}
      ${box('R', 'Resources', 'Topics and references you may want later.', rows(rs.slice(0, 5), (r) => `<div class="row-i"><span>${RES_TYPES[r.type] || '🔖'}</span><span class="tt" style="font-weight:400" data-act="edit" data-ent="resource" data-id="${r.id}">${esc(r.title)}</span></div>`, 'No resources yet.'), 'resources', rs.length)}
      ${box('A', 'Archive', 'Finished or paused items, out of the way but never lost.', `<div class="meta">${plural(archived, 'archived item')}</div>`, 'archive', archived)}</div>`;
  }

  function pArchive() {
    const sec = (ent, coll, title, name) => {
      const items = db[coll].filter((x) => x.archived);
      return `${label(title)}<div class="card">${rows(items, (x) => `<div class="row-i"><span class="tt" style="font-weight:400">${esc(x.icon || '')} ${esc(x[name] || 'Untitled')}</span><button class="btn sm" data-act="unarchive" data-ent="${ent}" data-id="${x.id}">↺ restore</button><button class="btn ghost sm danger" data-act="del" data-ent="${ent}" data-id="${x.id}">delete</button></div>`, 'Nothing archived.')}</div>`;
    };
    return head('📦', 'Archive', 'Inactive items from the other categories. Restore anything with one click.') +
      sec('project', 'projects', 'Projects', 'title') + sec('goal', 'goals', 'Goals', 'title') + sec('note', 'notes', 'Notes', 'title') + sec('resource', 'resources', 'Resources', 'title');
  }

  // ---------- router ----------
  const PAGES = { '': pDash, tasks: pTasks, projects: pProjects, project: pProject, goals: pGoals, goal: pGoal, areas: pAreas, area: pArea, notes: pNotes, resources: pResources, library: pLibrary, habits: pHabits, journal: pJournal, focus: pFocus, para: pPara, archive: pArchive };
  const TITLES = { '': 'second brain', tasks: 'tasks', projects: 'projects', project: 'project', goals: 'life goals', goal: 'goal', areas: 'life areas', area: 'life area', notes: 'notes', resources: 'resources', library: 'library', habits: 'habits', journal: 'journal', focus: 'focus', para: 'PARA', archive: 'archive' };
  function route() { const h = location.hash.replace(/^#\/?/, ''); const [page = '', arg = ''] = h.split('/'); return { page: PAGES[page] ? page : '', arg: decodeURIComponent(arg) }; }
  const NAV = [
    [null, [['', '🏠', 'Dashboard']]],
    ['plan', [['tasks', '✅', 'Tasks'], ['tasks/week', '📅', 'Weekly overview'], ['projects', '🗂️', 'Projects'], ['goals', '🎯', 'Life goals'], ['areas', '🌸', 'Life areas']]],
    ['knowledge', [['notes', '📓', 'Notes'], ['resources', '🔗', 'Resources'], ['library', '📚', 'Library']]],
    ['wellbeing', [['habits', '🌱', 'Habits'], ['journal', '📖', 'Journal'], ['focus', '⏱️', 'Focus']]],
    ['systems', [['para', '🗃️', 'PARA'], ['tasks/inbox', '📥', 'GTD inbox'], ['tasks/matrix', '🧭', 'Eisenhower matrix'], ['archive', '📦', 'Archive']]],
  ];
  function renderNav() {
    const { page, arg } = route(), cur = page + (arg ? '/' + arg : '');
    const active = (p) => cur === p || (p === 'tasks' && page === 'tasks' && !['week', 'inbox', 'matrix'].includes(arg)) || (p === 'projects' && page === 'project') || (p === 'goals' && page === 'goal') || (p === 'areas' && page === 'area') || (p !== '' && !p.includes('/') && page === p && p !== 'tasks');
    const counts = { tasks: openTasks().filter((t) => t.date && t.date <= today()).length, 'tasks/inbox': isInboxCount() };
    $('nav').innerHTML = NAV.map(([g, items]) => (g ? `<div class="nav-g">${g}</div>` : '') + items.map(([p, e, l]) => `<a href="#/${p}" class="${active(p) ? 'on' : ''}"><span class="e">${e}</span>${l}${counts[p] ? `<small>${counts[p]}</small>` : ''}</a>`).join('')).join('');
    document.querySelectorAll('#bottombar a').forEach((a) => a.classList.toggle('on', a.dataset.r === page));
    $('topTitle').textContent = TITLES[page] || 'my second brain';
    const due = db.reminders.filter((r) => r.at <= Date.now() + 864e5).length;
    $('remCount').textContent = db.reminders.length ? (due ? `${due} soon` : db.reminders.length) : '';
  }
  let lastKey = '';
  function render() {
    const { page, arg } = route(), key = page + '/' + arg, y = key === lastKey ? scrollY : 0;
    $('page').innerHTML = PAGES[page](arg);
    renderNav();
    if (page === 'focus') drawTimer();
    if (key !== lastKey) document.body.classList.remove('drawer');
    lastKey = key;
    scrollTo(0, y);
    if (ui.refocus && $(ui.refocus)) $(ui.refocus).focus();
    ui.refocus = '';
  }
  const commit = () => { save(); render(); };
  window.addEventListener('hashchange', render);

  // ---------- forms ----------
  const areaOpts = () => [['', '—'], ...db.areas.map((a) => [a.id, `${a.icon} ${a.name}`])];
  const goalOpts = () => [['', '—'], ...live(db.goals).map((g) => [g.id, `${g.icon || '🎯'} ${g.title}`])];
  const projOpts = () => [['', '— none (inbox) —'], ...live(db.projects).map((p) => [p.id, `${p.icon || '📁'} ${p.title}`])];
  const topicOpts = () => [['', '—'], ...db.topics.map((t) => [t.id, t.name])];
  const toLocal = (ms) => { const d = new Date(ms); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const GENRES = ['Adventure', 'Fiction', 'Productivity', 'Philosophy', 'Self-help', 'Business', 'Biography', 'Romance', 'Fantasy', 'History', 'Science', 'Horror', 'Humor', 'Poetry'];
  const ENT = {
    task: { coll: 'tasks', label: 'task', make: () => ({ done: false, created: Date.now() }), fields: () => [
      { k: 'text', l: 'Task', t: 'text', req: 1 },
      { row: [{ k: 'date', l: 'Due date', t: 'date' }, { k: 'start', l: 'From (optional)', t: 'time' }, { k: 'end', l: 'To', t: 'time' }] },
      { k: 'projectId', l: 'Project', t: 'select', o: projOpts() },
      { row: [{ k: 'important', l: '⭐ Important', t: 'check' }, { k: 'urgent', l: '⚡ Urgent', t: 'check' }] },
      { k: 'notes', l: 'Notes', t: 'textarea' }] },
    project: { coll: 'projects', label: 'project', make: () => ({ created: Date.now() }), fields: () => [
      { k: 'title', l: 'Project name', t: 'text', req: 1 },
      { row: [{ k: 'icon', l: 'Icon', t: 'text' }, { k: 'status', l: 'Status', t: 'select', o: [['not started', 'Not started'], ['in progress', 'In progress'], ['done', 'Complete']] }, { k: 'due', l: 'Due', t: 'date' }] },
      { row: [{ k: 'goalId', l: 'Goal', t: 'select', o: goalOpts() }, { k: 'areaId', l: 'Life area', t: 'select', o: areaOpts() }] },
      { k: 'desc', l: 'Description', t: 'textarea' }, { k: 'archived', l: '📦 Archived', t: 'check' }],
      defaults: { icon: '📁', status: 'not started' } },
    goal: { coll: 'goals', label: 'goal', make: () => ({ created: Date.now() }), fields: () => [
      { k: 'title', l: 'Goal', t: 'text', req: 1 },
      { row: [{ k: 'icon', l: 'Icon', t: 'text' }, { k: 'areaId', l: 'Life area', t: 'select', o: areaOpts() }, { k: 'deadline', l: 'Target date', t: 'date' }] },
      { k: 'status', l: 'Status', t: 'select', o: [['active', 'Active'], ['achieved', 'Achieved 🏆']] },
      { k: 'why', l: 'Why does this matter to you?', t: 'textarea' }, { k: 'archived', l: '📦 Archived', t: 'check' }],
      defaults: { icon: '🎯', status: 'active' } },
    area: { coll: 'areas', label: 'life area', make: () => ({}), fields: () => [
      { k: 'name', l: 'Area name', t: 'text', req: 1 },
      { row: [{ k: 'icon', l: 'Icon', t: 'text' }, { k: 'rating', l: 'Wheel of life rating (0–10)', t: 'number', min: 0, max: 10 }] },
      { k: 'art', l: 'Cover emojis (separate with spaces)', t: 'text' }], defaults: { icon: '✨', art: '✨ 🌷', rating: 5 } },
    resource: { coll: 'resources', label: 'resource', make: () => ({ created: Date.now() }), fields: () => [
      { k: 'title', l: 'Title', t: 'text', req: 1 }, { k: 'url', l: 'Link', t: 'url' },
      { row: [{ k: 'type', l: 'Type', t: 'select', o: Object.keys(RES_TYPES).map((k) => [k, `${RES_TYPES[k]} ${k}`]) }, { k: 'status', l: 'Status', t: 'select', o: Object.keys(RES_ST).map((k) => [k, k]) }] },
      { row: [{ k: 'topicId', l: 'Topic', t: 'select', o: topicOpts() }, { k: 'areaId', l: 'Life area', t: 'select', o: areaOpts() }] },
      { k: 'notes', l: 'Notes', t: 'textarea' }, { k: 'archived', l: '📦 Archived', t: 'check' }], defaults: { type: 'article', status: 'to review' } },
    book: { coll: 'books', label: 'book', make: () => ({ created: Date.now() }), fields: () => [
      { k: 'title', l: 'Title', t: 'text', req: 1 }, { row: [{ k: 'author', l: 'Author', t: 'text' }, { k: 'genre', l: 'Genre', t: 'text', list: GENRES }] },
      { row: [{ k: 'status', l: 'Status', t: 'select', o: Object.entries(BOOK_ST).map(([k, [l]]) => [k, l]) }, { k: 'rating', l: 'Rating', t: 'select', o: [['', '—'], ['1', '★'], ['2', '★★'], ['3', '★★★'], ['4', '★★★★'], ['5', '★★★★★']] }] },
      { row: [{ k: 'pages', l: 'Total pages', t: 'number', min: 0 }, { k: 'pagesRead', l: 'Current page', t: 'number', min: 0 }] },
      { row: [{ k: 'started', l: 'Started', t: 'date' }, { k: 'finished', l: 'Finished', t: 'date' }] }], defaults: { status: 'to read' },
      post: (v) => { v.rating = v.rating ? +v.rating : 0; if (v.status === 'reading' && !v.started) v.started = today(); if (v.status === 'finished') { v.finished ||= today(); if (v.pages) v.pagesRead = v.pages; } } },
    highlight: { coll: 'highlights', label: 'highlight', make: () => ({ created: Date.now() }), fields: () => [
      { k: 'bookId', l: 'Book', t: 'select', o: db.books.map((b) => [b.id, b.title]), req: 1 }, { k: 'text', l: 'Quote or note', t: 'textarea', req: 1 }, { k: 'page', l: 'Page', t: 'number', min: 0 }] },
    notebook: { coll: 'notebooks', label: 'notebook', make: () => ({}), fields: () => [{ k: 'name', l: 'Notebook name', t: 'text', req: 1 }, { row: [{ k: 'icon', l: 'Icon', t: 'text' }, { k: 'art', l: 'Cover emojis', t: 'text' }] }], defaults: { icon: '📒', art: '📒 🍪' } },
    topic: { coll: 'topics', label: 'topic', make: () => ({}), fields: () => [{ k: 'name', l: 'Topic name', t: 'text', req: 1 }] },
    habit: { coll: 'habits', label: 'habit', make: () => ({ days: {} }), fields: () => [{ k: 'name', l: 'Habit', t: 'text', req: 1 }, { k: 'icon', l: 'Icon', t: 'text' }], defaults: { icon: '🌱' } },
    reminder: { coll: 'reminders', label: 'reminder', make: () => ({}), fields: () => [{ k: 'text', l: 'Remind me to…', t: 'text', req: 1 }, { row: [{ k: 'at', l: 'When', t: 'datetime-local', req: 1 }, { k: 'repeat', l: 'Repeat', t: 'select', o: [['none', 'Once'], ['daily', 'Every day'], ['weekly', 'Every week']] }] }],
      pre: (v) => ({ ...v, at: toLocal(v.at || Date.now() + 36e5) }), post: (v) => { v.at = new Date(v.at).getTime(); askNotif(); } },
  };
  function fieldHtml(f, v) {
    if (f.row) return `<div class="frow">${f.row.map((x) => fieldHtml(x, v)).join('')}</div>`;
    const val = v[f.k] ?? '', id = 'f-' + f.k;
    if (f.t === 'check') return `<label class="checkf"><input type="checkbox" name="${f.k}" ${val ? 'checked' : ''}> ${f.l}</label>`;
    let input;
    if (f.t === 'select') input = `<select class="in" name="${f.k}" id="${id}" ${f.req ? 'required' : ''}>${f.o.map(([k, l]) => `<option value="${esc(k)}" ${String(val) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (f.t === 'textarea') input = `<textarea class="in" name="${f.k}" id="${id}" ${f.req ? 'required' : ''}>${esc(val)}</textarea>`;
    else input = `<input class="in" type="${f.t}" name="${f.k}" id="${id}" value="${esc(val)}" ${f.req ? 'required' : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.list ? `list="${id}-l"` : ''} autocomplete="off">${f.list ? `<datalist id="${id}-l">${f.list.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
    return `<label class="fld"><span>${f.l}</span>${input}</label>`;
  }
  const flat = (fs) => fs.flatMap((f) => (f.row ? f.row : [f]));
  const modal = $('modal');
  function openModal(html, big = false) { modal.className = 'modal' + (big ? ' big' : ''); modal.innerHTML = html; if (!modal.open) modal.showModal(); }
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
  modal.addEventListener('close', () => { if (modal.dataset.dirty) { delete modal.dataset.dirty; commit(); } });
  function openForm(entName, item, preset = {}) {
    const E = ENT[entName], fields = E.fields(), isNew = !item;
    let v = { ...(E.defaults || {}), ...(item || {}), ...preset };
    if (E.pre) v = E.pre(v);
    openModal(`<form method="dialog" id="entForm"><div class="m-head"><h2>${isNew ? 'New' : 'Edit'} ${E.label}</h2><button type="button" class="btn ghost sm" data-close aria-label="Close">✕</button></div>
      <div class="m-body">${fields.map((f) => fieldHtml(f, v)).join('')}</div>
      <div class="m-foot"><span class="l">${isNew ? '' : `<button type="button" class="btn sm danger" id="entDel">Delete</button>`}</span><button type="button" class="btn" data-close>Cancel</button><button class="btn pri">${isNew ? 'Add' : 'Save'}</button></div></form>`);
    const form = $('entForm');
    setTimeout(() => form.querySelector('input:not([type=checkbox]),textarea')?.focus(), 30);
    form.onsubmit = (e) => {
      e.preventDefault();
      const out = {};
      flat(fields).forEach((f) => { const el = form.elements[f.k]; out[f.k] = f.t === 'check' ? el.checked : f.t === 'number' ? (el.value === '' ? '' : +el.value) : el.value.trim(); });
      if (E.post) E.post(out);
      if (isNew) db[E.coll].push({ id: uid(), ...E.make(), ...preset, ...out });
      else Object.assign(item, out);
      modal.close(); commit(); toast(isNew ? `${E.label} added ♡` : 'saved');
    };
    const del = $('entDel');
    if (del) del.onclick = () => { if (confirm(`Delete this ${E.label}? This can't be undone.`)) { removeEnt(entName, item.id); modal.close(); commit(); } };
  }
  function removeEnt(ent, id) {
    const E = ENT[ent] || { coll: 'notes' };
    db[E.coll] = db[E.coll].filter((x) => x.id !== id);
    if (ent === 'project') db.tasks.forEach((t) => { if (t.projectId === id) t.projectId = ''; });
    if (ent === 'goal') db.projects.forEach((p) => { if (p.goalId === id) p.goalId = ''; });
    if (ent === 'area') ['goals', 'projects', 'notes', 'resources'].forEach((k) => db[k].forEach((x) => { if (x.areaId === id) x.areaId = ''; }));
    if (ent === 'topic') ['notes', 'resources'].forEach((k) => db[k].forEach((x) => { if (x.topicId === id) x.topicId = ''; }));
    if (ent === 'notebook') db.notes.forEach((n) => { if (n.notebookId === id) n.notebookId = db.notebooks[0]?.id || ''; });
    if (ent === 'book') db.highlights = db.highlights.filter((h) => h.bookId !== id);
  }
  const collOf = (ent) => (ent === 'note' ? 'notes' : ENT[ent].coll);

  function openNote(n) {
    const sel = (name, opts, val) => `<select class="in" name="${name}" style="padding:4px 8px;font-size:13px">${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(val || '') === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    openModal(`<form method="dialog" id="noteForm"><div class="m-head"><span class="meta" id="noteSaved">${n.updated ? 'edited ' + ago(n.updated) : 'new note'}</span><span style="flex:1"></span><button type="button" class="btn ghost sm" data-close aria-label="Close">✕</button></div>
      <div class="m-body"><input class="note-title" name="title" placeholder="Untitled" value="${esc(n.title)}">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px">${sel('notebookId', db.notebooks.map((x) => [x.id, `${x.icon} ${x.name}`]), n.notebookId)}${sel('topicId', [['', '🏷️ no topic'], ...db.topics.map((t) => [t.id, '🏷️ ' + t.name])], n.topicId)}${sel('areaId', [['', '🌸 no area'], ...db.areas.map((a) => [a.id, `${a.icon} ${a.name}`])], n.areaId)}
      <label class="checkf" style="margin:0"><input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}> 📌 pin</label></div>
      <textarea class="note-body" name="body" placeholder="Start writing…">${esc(n.body)}</textarea></div>
      <div class="m-foot"><span class="l"><button type="button" class="btn sm danger" id="noteDel">Delete</button><button type="button" class="btn sm" id="noteArc">📦 Archive</button></span><button class="btn pri">Done</button></div></form>`, true);
    const f = $('noteForm');
    const sync = () => {
      n.title = f.elements.title.value; n.body = f.elements.body.value; n.notebookId = f.elements.notebookId.value; n.topicId = f.elements.topicId.value; n.areaId = f.elements.areaId.value; n.pinned = f.elements.pinned.checked;
      n.updated = Date.now();
      if (!db.notes.includes(n)) db.notes.push(n);
      save(); modal.dataset.dirty = '1'; $('noteSaved').textContent = 'saved ♡';
    };
    f.addEventListener('input', sync); f.addEventListener('change', sync);
    f.onsubmit = (e) => { e.preventDefault(); if (db.notes.includes(n) && !n.title.trim() && !n.body.trim()) db.notes = db.notes.filter((x) => x !== n); modal.close(); commit(); };
    $('noteDel').onclick = () => { if (!db.notes.includes(n) || confirm('Delete this note?')) { db.notes = db.notes.filter((x) => x !== n); modal.close(); commit(); } };
    $('noteArc').onclick = () => { sync(); n.archived = true; modal.close(); commit(); toast('note archived'); };
    setTimeout(() => (n.title ? f.elements.body : f.elements.title).focus(), 30);
  }
  const newNote = (preset = {}) => openNote({ id: uid(), title: '', body: '', notebookId: ui.notebook || db.notebooks[0]?.id || '', topicId: ui.topic || '', created: Date.now(), ...preset });

  function capture(type, text) {
    text = text.trim(); if (!text) return;
    const isUrl = /^https?:\/\//i.test(text);
    if (type === 'task') db.tasks.push({ id: uid(), text, done: false, created: Date.now() });
    else if (type === 'today') db.tasks.push({ id: uid(), text, date: today(), done: false, created: Date.now() });
    else if (type === 'note') db.notes.push({ id: uid(), title: text.slice(0, 80), body: text.length > 80 ? text : '', notebookId: (db.notebooks.find((n) => /fleeting/i.test(n.name)) || db.notebooks[0] || {}).id || '', created: Date.now(), updated: Date.now() });
    else if (type === 'goal') db.goals.push({ id: uid(), title: text, icon: '🎯', status: 'active', created: Date.now() });
    else if (type === 'resource') db.resources.push({ id: uid(), title: isUrl ? text.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 70) : text, url: isUrl ? text : '', type: /youtu|vimeo/i.test(text) ? 'video' : 'article', status: 'to review', created: Date.now() });
    else if (type === 'book') db.books.push({ id: uid(), title: text, status: 'to read', created: Date.now() });
    const where = { task: 'inbox 📥', today: 'today ☀️', note: 'fleeting notes ✏️', goal: 'life goals 🎯', resource: 'resources 🔗', book: 'your library 📚' }[type];
    toast(`captured to ${where}`); chime();
  }
  function openCapture() {
    openModal(`<div class="m-head"><h2>⚡ Quick capture</h2><button type="button" class="btn ghost sm" data-close aria-label="Close">✕</button></div><div class="m-body" style="padding-bottom:18px">${captureBox('capModal')}<p class="meta" style="margin-top:10px">Press Enter to save. Tasks go to your GTD inbox so you can sort them later.</p></div>`);
    setTimeout(() => $('capModal')?.focus(), 30);
  }

  function openSearch() {
    openModal(`<div class="m-head"><h2>🔎 Search everything</h2><button type="button" class="btn ghost sm" data-close aria-label="Close">✕</button></div><div class="m-body" style="padding-bottom:16px"><input class="in" id="q" placeholder="Tasks, notes, projects, books, highlights…" style="width:100%" autocomplete="off"><div class="search-res" id="qres"></div></div>`);
    const q = $('q'), res = $('qres');
    const run = () => {
      const s = q.value.trim().toLowerCase();
      if (!s) { res.innerHTML = '<div class="empty">Type to search across your whole second brain.</div>'; return; }
      const hit = (x) => String(x || '').toLowerCase().includes(s);
      const out = [];
      db.tasks.filter((t) => hit(t.text) || hit(t.notes)).forEach((t) => out.push(['✅', t.text, 'task', `data-act="edit" data-ent="task" data-id="${t.id}"`]));
      db.projects.filter((p) => hit(p.title) || hit(p.desc)).forEach((p) => out.push([p.icon || '📁', p.title, 'project', `data-act="go" data-to="project/${p.id}"`]));
      db.goals.filter((g) => hit(g.title) || hit(g.why)).forEach((g) => out.push([g.icon || '🎯', g.title, 'goal', `data-act="go" data-to="goal/${g.id}"`]));
      db.notes.filter((n) => hit(n.title) || hit(n.body)).forEach((n) => out.push(['📝', n.title || 'Untitled', 'note', `data-act="note" data-id="${n.id}"`]));
      db.resources.filter((r) => hit(r.title) || hit(r.url) || hit(r.notes)).forEach((r) => out.push([RES_TYPES[r.type] || '🔖', r.title, 'resource', `data-act="edit" data-ent="resource" data-id="${r.id}"`]));
      db.books.filter((b) => hit(b.title) || hit(b.author)).forEach((b) => out.push(['📚', b.title, 'book', `data-act="edit" data-ent="book" data-id="${b.id}"`]));
      db.highlights.filter((h) => hit(h.text)).forEach((h) => out.push(['✨', h.text.slice(0, 80), 'highlight', `data-act="edit" data-ent="highlight" data-id="${h.id}"`]));
      Object.entries(db.journal).filter(([, e]) => hit(JSON.stringify(e))).forEach(([d]) => out.push(['📖', fmtDay(d, { day: 'numeric', month: 'short', year: 'numeric' }), 'journal', `data-act="jOpen" data-v="${d}"`]));
      res.innerHTML = out.length ? out.slice(0, 40).map(([e, t, k, a]) => `<button type="button" ${a}><span>${esc(e)}</span><span>${esc(t)}</span><small>${k}</small></button>`).join('') : '<div class="empty">No matches.</div>';
    };
    q.oninput = run; run(); setTimeout(() => q.focus(), 30);
  }

  function askNotif() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
  function openReminders() {
    const items = db.reminders.slice().sort((a, b) => a.at - b.at);
    const perm = !('Notification' in window) ? 'This browser can’t show notifications; you’ll hear a chime while this page is open.' : Notification.permission === 'granted' ? 'Notifications are on. Keep this tab open (it can be in the background).' : Notification.permission === 'denied' ? 'Notifications are blocked in browser settings; you’ll still hear a chime while this page is open.' : 'Allow notifications so reminders reach you in other tabs.';
    openModal(`<div class="m-head"><h2>⏰ Reminders</h2><button type="button" class="btn ghost sm" data-close aria-label="Close">✕</button></div>
      <div class="m-body"><p class="meta">${perm}</p>${'Notification' in window && Notification.permission === 'default' ? '<button class="btn sm" data-act="notifPerm">Turn on notifications</button>' : ''}
      ${rows(items, (r) => `<div class="row-i"><span>⏰</span><span class="tt" style="font-weight:400" data-act="edit" data-ent="reminder" data-id="${r.id}">${esc(r.text)}<br><small class="meta">${new Date(r.at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${r.repeat !== 'none' ? ' · ' + (r.repeat === 'daily' ? 'every day' : 'every week') : ''}</small></span><button class="btn ghost sm danger" data-act="del" data-ent="reminder" data-id="${r.id}" aria-label="Delete">✕</button></div>`, 'No reminders yet.')}</div>
      <div class="m-foot"><button class="btn" data-close>Close</button>${btnNew('reminder', '+ New reminder', { repeat: 'none' }, 'btn pri')}</div>`);
  }
  function openSettings() {
    openModal(`<div class="m-head"><h2>⚙️ Settings & backup</h2><button type="button" class="btn ghost sm" data-close aria-label="Close">✕</button></div>
      <div class="m-body"><label class="fld"><span>Your name (for the daily report)</span><input class="in" id="setName" value="${esc(db.profile.name)}" maxlength="24"></label>
      <label class="checkf"><input type="checkbox" id="setSound" ${db.settings.sound ? 'checked' : ''}> Soft sounds</label>
      <label class="fld"><span>My own affirmations (one per line)</span><textarea class="in" id="setAff">${esc(db.profile.affirmations || '')}</textarea></label>
      <p class="meta">Everything is saved in this browser only. Export a backup now and then, and import it to move to another device.</p>
      <div style="display:flex;gap:6px;margin-bottom:8px"><button class="btn sm" data-act="export">⬇ Export backup</button><label class="btn sm" style="cursor:pointer">⬆ Import backup<input type="file" id="importFile" accept="application/json" hidden></label></div></div>
      <div class="m-foot"><button class="btn pri" data-close>Done</button></div>`);
    $('setName').oninput = (e) => { db.profile.name = e.target.value.trim(); save(); modal.dataset.dirty = '1'; };
    $('setSound').onchange = (e) => { db.settings.sound = e.target.checked; save(); chime(); };
    $('setAff').oninput = (e) => { db.profile.affirmations = e.target.value; save(); modal.dataset.dirty = '1'; };
    $('importFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || !Array.isArray(data.tasks)) throw new Error();
        if (!confirm('Replace everything in this browser with the backup?')) return;
        localStorage.setItem(KEY, JSON.stringify(data)); location.reload();
      } catch { toast('that file isn’t a backup from this app'); }
    };
  }

  // ---------- events ----------
  const A = {
    go: (el) => { modal.open && modal.close(); location.hash = '#/' + el.dataset.to; },
    drawer: () => document.body.classList.toggle('drawer'),
    capture: () => openCapture(),
    search: () => openSearch(),
    reminders: () => openReminders(),
    settings: () => openSettings(),
    notifPerm: () => Notification.requestPermission().then(openReminders),
    new: (el) => openForm(el.dataset.ent, null, JSON.parse(el.dataset.p || '{}')),
    edit: (el) => { const it = byId(db[collOf(el.dataset.ent)], el.dataset.id); if (it) openForm(el.dataset.ent, it); },
    del: (el) => { if (confirm('Delete this for good?')) { removeEnt(el.dataset.ent, el.dataset.id); if (modal.open && el.closest('dialog')) { save(); openReminders(); render(); } else commit(); } },
    archive: (el) => { const it = byId(db[collOf(el.dataset.ent)], el.dataset.id); it.archived = true; toast('moved to archive 📦'); commit(); if (route().page === el.dataset.ent) history.back(); },
    unarchive: (el) => { byId(db[collOf(el.dataset.ent)], el.dataset.id).archived = false; toast('restored ♡'); commit(); },
    toggleTask: (el) => {
      const t = byId(db.tasks, el.dataset.id); if (!t) return;
      t.done = !t.done; t.doneAt = t.done ? Date.now() : 0;
      if (t.done) hearts(el);
      commit();
      if (t.done && t.date === today() && db.tasks.filter((x) => x.date === today()).every((x) => x.done)) toast('everything for today is done · so proud of you ♡');
    },
    setDate: (el) => { const t = byId(db.tasks, el.dataset.id); t.date = ymd(addDays(new Date(), +el.dataset.v)); toast(+el.dataset.v ? 'moved to tomorrow 🌙' : 'moved to today ☀️'); commit(); },
    flag: (el) => { const t = byId(db.tasks, el.dataset.id); t[el.dataset.v] = !t[el.dataset.v]; commit(); },
    clearDone: () => { const cut = Date.now() - 30 * 864e5; const n = db.tasks.length; db.tasks = db.tasks.filter((t) => !(t.done && (t.doneAt || 0) < cut)); toast(`cleared ${plural(n - db.tasks.length, 'task')}`); commit(); },
    selDay: (el) => { ui.selDay = el.dataset.v; render(); },
    week: (el) => { const v = +el.dataset.v; ui.weekStart = v ? addDays(ui.weekStart, 7 * v) : monday(new Date()); if (!v) ui.selDay = today(); render(); },
    habitDay: (el) => { const h = byId(db.habits, el.dataset.id), k = el.dataset.v; if (h.days[k]) delete h.days[k]; else { h.days[k] = true; hearts(el, 3); } commit(); },
    goalDone: (el) => { const g = goal(el.dataset.id); g.status = g.status === 'achieved' ? 'active' : 'achieved'; if (g.status === 'achieved') { hearts(el, 8); toast('goal achieved 🏆 you did it!'); } commit(); },
    projStatus: (el) => { const p = project(el.dataset.id); p.status = p.status === 'done' ? 'in progress' : 'done'; if (p.status === 'done') hearts(el, 6); commit(); },
    resStatus: (el) => { const r = byId(db.resources, el.dataset.id), order = Object.keys(RES_ST); r.status = order[(order.indexOf(r.status) + 1) % order.length]; commit(); },
    capType: (el) => { ui.capType = el.dataset.v; document.querySelectorAll('.capture-types button').forEach((b) => b.classList.toggle('on', b.dataset.v === ui.capType)); el.closest('.card,.m-body')?.querySelector('input')?.focus(); },
    affNext: () => { const l = allAff(), k = today(); const cur = allAff().indexOf(affToday()); db.affPick = { [k]: (cur + 1) % l.length }; commit(); },
    mood: (el) => { db.moods[today()] = db.moods[today()] === el.dataset.v ? '' : el.dataset.v; commit(); },
    note: (el) => { const n = byId(db.notes, el.dataset.id); if (n) openNote(n); },
    newNote: () => newNote(),
    openNotebook: (el) => { ui.notebook = ui.notebook === el.dataset.id ? '' : el.dataset.id; if (route().page !== 'notes') location.hash = '#/notes'; else render(); },
    noteTab: (el) => { ui.noteTab = el.dataset.v; render(); },
    topicFilter: (el) => { ui.topic = el.dataset.v; render(); },
    resType: (el) => { ui.resType = el.dataset.v; render(); },
    genre: (el) => { ui.genre = ui.genre === el.dataset.v ? '' : el.dataset.v; render(); },
    bookPage: (el) => {
      const b = book(el.dataset.id), v = prompt(`What page are you on in "${b.title}"?`, b.pagesRead || 0);
      if (v === null || v === '' || isNaN(+v)) return;
      b.pagesRead = Math.max(0, +v);
      if (b.pages && b.pagesRead >= b.pages) { b.status = 'finished'; b.finished = today(); b.pagesRead = b.pages; hearts(el, 8); toast(`finished "${b.title}" 🎉`); }
      commit();
    },
    jOpen: (el) => { ui.jDate = el.dataset.v; modal.open && modal.close(); if (route().page !== 'journal') location.hash = '#/journal'; else render(); },
    mode: (el) => setMode(el.dataset.v),
    timer: () => startPause(),
    timerReset: () => setMode(timer.mode),
    timerSkip: () => finish(true),
    export: () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `second-brain-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
    },
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { modal.close(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    e.preventDefault();
    A[el.dataset.act]?.(el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-submit]'); if (!f) return;
    e.preventDefault();
    const q = f.elements.q, text = q.value.trim(); if (!text) return;
    if (f.dataset.submit === 'capture') { capture(ui.capType, text); q.value = ''; save(); ui.refocus = q.id; if (modal.open) modal.dataset.dirty = '1'; else render(); }
    else if (f.dataset.submit === 'addTask') { db.tasks.push({ id: uid(), text, done: false, created: Date.now(), ...JSON.parse(f.dataset.p || '{}') }); ui.refocus = q.id; commit(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    const k = el.dataset.change;
    if (k === 'setProject') { const t = byId(db.tasks, el.dataset.id); t.projectId = el.value; toast('filed into the project 📁'); commit(); }
    else if (k === 'jDate') { ui.jDate = el.value || today(); render(); }
    else if (k === 'focusTask') timer.taskId = el.value;
    else if (k === 'timerSet') { db.settings[el.dataset.k] = Math.max(1, +el.value || 1); save(); if (!timer.running) setMode(timer.mode); }
    else if (k === 'rating') commit();
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]'); if (!el) return;
    if (el.dataset.input === 'journal') {
      (db.journal[ui.jDate] ||= {})[el.dataset.k] = el.value; save();
      if ($('jSaved')) $('jSaved').textContent = 'saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' ♡';
    } else if (el.dataset.input === 'rating') {
      const a = area(el.dataset.id); a.rating = +el.value; save();
      document.querySelectorAll(`#rv-${a.id}`).forEach((x) => (x.textContent = a.rating));
      document.querySelectorAll('#wheel').forEach((w) => (w.innerHTML = wheelSvg()));
    }
  });
  // drag and drop for the matrix and the book board
  document.addEventListener('dragstart', (e) => { const el = e.target.closest('[data-drag]'); if (!el) return; e.dataTransfer.setData('text/plain', el.dataset.drag + ':' + el.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
  document.addEventListener('dragover', (e) => { const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); });
  document.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    const z = e.target.closest('[data-drop]'); if (!z) return;
    e.preventDefault(); z.classList.remove('over');
    const [kind, id] = (e.dataTransfer.getData('text/plain') || '').split(':');
    if (kind === 'task' && z.dataset.drop === 'quad') { Object.assign(byId(db.tasks, id), QUADS[z.dataset.v].f); commit(); }
    if (kind === 'book' && z.dataset.drop === 'book') { const b = book(id); b.status = z.dataset.v; ENT.book.post(b); commit(); }
  });
  // wheel tooltips
  document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); const tip = $('tip'); if (!el) { tip.hidden = true; return; } tip.textContent = el.dataset.tip; tip.hidden = false; const r = el.getBoundingClientRect(); tip.style.left = r.left + r.width / 2 + 'px'; tip.style.top = r.top + 'px'; });
  // shortcuts: N capture, / search
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || modal.open) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); } return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); openCapture(); }
    else if (e.key === '/') { e.preventDefault(); openSearch(); }
  });

  function checkReminders() {
    const now = Date.now(); let changed = false;
    db.reminders.slice().forEach((r) => {
      if (r.at > now) return;
      notify('reminder ♡', r.text); changed = true;
      if (r.repeat === 'none') db.reminders = db.reminders.filter((x) => x !== r);
      else { const step = (r.repeat === 'daily' ? 1 : 7) * 864e5; while (r.at <= now) r.at += step; }
    });
    if (changed) { save(); if (!modal.open) render(); }
  }

  setMode('focus');
  render();
  checkReminders();
  setInterval(checkReminders, 15000);
  let day = today();
  setInterval(() => { if (today() !== day) { if (ui.selDay === day) ui.selDay = today(); if (ui.jDate === day) ui.jDate = today(); day = today(); ui.weekStart = monday(new Date()); } if (!modal.open && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) render(); }, 60000);
})();
