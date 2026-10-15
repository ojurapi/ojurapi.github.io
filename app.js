'use strict';
(function () {
/* ================= utilitaires ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtDate = v => { const d = typeof v === 'number' ? new Date(v) : new Date(v + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtTime = ts => new Date(ts).toLocaleString('fr-CH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const nat = (a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true });
const num = s => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null; };
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }

/* ================= données ================= */
const KEY = 'ruchier.v1';
const EMPTY = () => ({ apiaries: [], hives: [], supers: [], queens: [], logs: [], tasks: [], seq: 1, lastBackup: 0 });
let db = load();
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.hives)) return Object.assign(EMPTY(), d); } catch (e) { /* ignore */ }
  return EMPTY();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('⚠ Impossible d’enregistrer (stockage plein ?)'); } }
const uid = () => String(db.seq++);
const A = id => db.apiaries.find(x => x.id === id);
const H = id => db.hives.find(x => x.id === id);
const Q = id => db.queens.find(x => x.id === id);
const S = id => db.supers.find(x => x.id === id);
const hiveByCode = c => db.hives.find(h => h.code === String(c));
const superByCode = c => db.supers.find(s => s.code === String(c));
const queenByCode = c => db.queens.find(q => q.code === String(c));
const QCOL = { 1: ['blanc', '#f4f4f4'], 2: ['jaune', '#f2d21b'], 3: ['rouge', '#d33a2c'], 4: ['vert', '#3a9d4a'], 0: ['bleu', '#2f6fd0'] };
const qcolor = y => (y ? QCOL[(+y) % 5] : null);
const qLabel = q => q.code + (q.year ? ' (' + q.year + ')' : '');
const STATUS = [['active', 'Active'], ['hivernage', 'Hivernage'], ['morte', 'Morte'], ['vendue', 'Vendue']];
const LOGTYPES = ['Visite', 'Nourrissement', 'Traitement', 'Pose de hausse', 'Division / essaim', 'Reine', 'Récolte', 'Transhumance', 'Hivernage', 'Autre'];

function addLog(hiveId, type, note) { db.logs.push({ id: uid(), ts: Date.now(), hiveId, type, note: note || '' }); }
function newHive(code, o = {}) {
  const h = { id: uid(), code: String(code), apiaryId: o.apiaryId || '', status: 'active', queenId: '', flag: false, note: o.note || '', created: Date.now() };
  db.hives.push(h); return h;
}
function newSuper(code) { const s = { id: uid(), code: String(code), hiveId: '', since: '' }; db.supers.push(s); return s; }
function nextCode(list) { const n = list.map(x => parseInt(x.code, 10)).filter(Number.isFinite); return String((n.length ? Math.max(...n) : 0) + 1); }
function removeHive(h) {
  db.hives = db.hives.filter(x => x.id !== h.id);
  db.logs = db.logs.filter(l => l.hiveId !== h.id);
  db.supers.forEach(s => { if (s.hiveId === h.id) s.hiveId = ''; });
}

/* ================= feuilles & formulaires ================= */
function openSheet(html) { const o = $('#overlay'); o.innerHTML = '<div class="sheet">' + html + '</div>'; o.hidden = false; o.onclick = e => { if (e.target === o) closeSheet(); }; }
function closeSheet() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; }
function fieldHtml(f) {
  const v = f.value == null ? '' : f.value;
  const nm = 'name="' + f.name + '"';
  if (f.type === 'select') return '<label>' + esc(f.label) + '</label><select ' + nm + '>' + f.options.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  if (f.type === 'textarea') return '<label>' + esc(f.label) + '</label><textarea ' + nm + '>' + esc(v) + '</textarea>';
  if (f.type === 'checkbox') return '<label class="chk"><input type="checkbox" ' + nm + (v ? ' checked' : '') + '> ' + esc(f.label) + '</label>';
  return '<label>' + esc(f.label) + '</label><input ' + nm + ' type="' + (f.type || 'text') + '" value="' + esc(v) + '"' + (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ' autocomplete="off">';
}
function form(o) {
  openSheet('<h3>' + esc(o.title) + '</h3><form id="f">' + o.fields.map(fieldHtml).join('') + (o.extra || '') +
    '<div class="btns"><button type="button" data-close>Annuler</button><button class="primary">' + esc(o.submit || 'Enregistrer') + '</button></div></form>');
  $('#f').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target), v = {};
    o.fields.forEach(f => { v[f.name] = f.type === 'checkbox' ? fd.has(f.name) : String(fd.get(f.name) == null ? '' : fd.get(f.name)).trim(); });
    if (o.onSubmit(v) !== false) closeSheet();
  };
}
const apiaryOptions = (none = '— Aucun —') => [['', none]].concat(db.apiaries.slice().sort((a, b) => nat(a.name, b.name)).map(a => [a.id, a.name]));
const queenOptions = (none = '— Aucune —') => [['', none]].concat(db.queens.slice().sort((a, b) => nat(a.code, b.code)).map(q => [q.id, qLabel(q) + (q.lineage ? ' · ' + q.lineage : '')]));
const hiveOptions = (none = '— Aucune —') => [['', none]].concat(db.hives.slice().sort((a, b) => nat(a.code, b.code)).map(h => [h.id, 'Ruche ' + h.code]));

function showQr(text, label) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  openSheet('<h3>' + esc(label) + '</h3><div style="text-align:center"><div class="qr">' + qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) + '</div><p class="hint">' + esc(text) + '</p></div><div class="btns"><button data-close>Fermer</button><button class="primary" data-act="printOne" data-text="' + esc(text) + '" data-label="' + esc(label) + '">Imprimer</button></div>');
}
function labelsHtml(items) {
  return '<div class="labels">' + items.map(it => {
    const qr = qrcode(0, 'M'); qr.addData(it.text); qr.make();
    return '<div class="label">' + qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true }) + '<div>' + esc(it.label) + '</div></div>';
  }).join('') + '</div>';
}
function printItems(items) {
  const p = $('#printSheet'); p.innerHTML = labelsHtml(items); p.hidden = false;
  setTimeout(() => { window.print(); }, 80);
}

/* ================= éléments d'interface ================= */
function statusBadge(h) {
  if (h.status === 'hivernage') return '<span class="badge ok">Hivernage</span>';
  if (h.status === 'morte') return '<span class="badge off">Morte</span>';
  if (h.status === 'vendue') return '<span class="badge off">Vendue</span>';
  return '';
}
function hiveItem(h) {
  const a = A(h.apiaryId), q = Q(h.queenId), c = q && qcolor(q.year);
  return '<a class="item" href="#/ruche/' + h.id + '"><div class="grow"><div class="t">Ruche ' + esc(h.code) + ' ' + (h.flag ? '<span class="badge warn">⚑ à voir</span>' : '') + statusBadge(h) + '</div><div class="s">' +
    (a ? esc(a.name) : 'Sans rucher') + (q ? ' · ' + (c ? '<span class="dot" style="background:' + c[1] + '"></span> ' : '') + 'reine ' + esc(qLabel(q)) : '') +
    '</div></div><span class="chev">›</span></a>';
}
const empty = (t, s) => '<div class="empty"><b>' + t + '</b>' + (s || '') + '</div>';
function mapSvg(list) {
  const pts = list.filter(a => a.lat != null && a.lng != null);
  if (!pts.length) return '';
  const k = Math.cos(pts[0].lat * Math.PI / 180);
  const xs = pts.map(a => a.lng * k), ys = pts.map(a => -a.lat);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const W = 600, Hh = 300, P = 60, dx = maxx - minx, dy = maxy - miny;
  const sc = Math.min(dx > 0 ? (W - 2 * P) / dx : Infinity, dy > 0 ? (Hh - 2 * P) / dy : Infinity);
  const f = Number.isFinite(sc) ? sc : 1;
  const ox = (W - dx * f) / 2, oy = (Hh - dy * f) / 2;
  const dots = pts.map((a, i) => {
    const x = ox + (xs[i] - minx) * f, y = oy + (ys[i] - miny) * f, n = db.hives.filter(h => h.apiaryId === a.id).length;
    return '<a href="#/rucher/' + a.id + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="13" fill="#d99a1c" stroke="#7a4f00" stroke-width="2"/><text x="' + x.toFixed(1) + '" y="' + (y + 4.5).toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#2b1d00">' + n + '</text><text x="' + x.toFixed(1) + '" y="' + (y + 31).toFixed(1) + '" text-anchor="middle" font-size="14" fill="currentColor">' + esc(a.name.length > 16 ? a.name.slice(0, 15) + '…' : a.name) + '</text></a>';
  }).join('');
  return '<svg class="map" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Plan schématique des ruchers"><text x="14" y="24" font-size="13" fill="currentColor" opacity=".6">N ↑</text>' + dots + '</svg><p class="hint">Plan schématique (fonctionne hors ligne). Le nombre indique les ruches du rucher.</p>';
}

/* ================= vues ================= */
const ui = { q: '', ap: '', st: '' };
const VIEWS = {};

VIEWS.accueil = () => {
  const live = db.hives.filter(h => h.status !== 'morte' && h.status !== 'vendue');
  const flagged = live.filter(h => h.flag).sort((a, b) => nat(a.code, b.code));
  const tasks = db.tasks.filter(t => !t.done).sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1).slice(0, 5);
  const logs = db.logs.slice(-6).reverse();
  let html = '';
  if (!db.apiaries.length && !db.hives.length) {
    html += '<div class="card"><b>Bienvenue 🐝</b><ol><li>Créez un <a href="#/ruchers">rucher</a></li><li>Ajoutez vos <a href="#/ruches">ruches</a> (plusieurs d’un coup possible)</li><li>Imprimez les <a href="#/etiquettes">étiquettes QR</a> et collez-les</li><li>Scannez-les au rucher pour tout enregistrer</li></ol><p class="hint">Tout reste enregistré sur ce téléphone, rien n’est envoyé sur internet.</p></div>';
  }
  html += '<div class="grid"><div class="stat"><b>' + db.apiaries.length + '</b><span>ruchers</span></div><div class="stat"><b>' + live.length + '</b><span>ruches actives</span></div><div class="stat"><b>' + db.supers.length + '</b><span>hausses</span></div><div class="stat"><b>' + db.tasks.filter(t => !t.done).length + '</b><span>tâches ouvertes</span></div></div>';
  html += '<h2>Ruches à surveiller</h2>' + (flagged.length ? flagged.map(hiveItem).join('') : '<div class="hint">Aucune ruche signalée. Activez ⚑ sur la fiche d’une ruche pour la retrouver ici.</div>');
  html += '<h2>Tâches à venir</h2>' + (tasks.length ? tasks.map(taskItem).join('') : '<div class="hint">Rien de prévu.</div>');
  if (logs.length) html += '<h2>Dernières interventions</h2>' + logs.map(l => { const h = H(l.hiveId); return '<div class="log"><b>' + (h ? 'Ruche ' + esc(h.code) : '—') + '</b> · ' + esc(l.type) + (l.note ? ' — ' + esc(l.note) : '') + ' <small>(' + fmtTime(l.ts) + ')</small></div>'; }).join('');
  return { title: "O Jur'Api", html };
};

VIEWS.ruchers = () => {
  const list = db.apiaries.slice().sort((a, b) => nat(a.name, b.name));
  let html = list.length ? mapSvg(list) : '';
  html += list.length ? '<h2>Mes ruchers</h2>' + list.map(a => {
    const n = db.hives.filter(h => h.apiaryId === a.id && h.status !== 'morte' && h.status !== 'vendue').length;
    return '<a class="item" href="#/rucher/' + a.id + '"><div class="grow"><div class="t">' + esc(a.name) + '</div><div class="s">' + n + ' ruche' + (n > 1 ? 's' : '') + (a.lat != null ? ' · position enregistrée' : '') + '</div></div><span class="chev">›</span></a>';
  }).join('') : empty('Aucun rucher', 'Touchez « + Rucher » pour créer le premier.');
  return { title: 'Ruchers', html, actions: '<button data-act="addApiary">+ Rucher</button>' };
};

VIEWS.rucher = id => {
  const a = A(id);
  if (!a) return { title: 'Rucher', back: '#/ruchers', html: empty('Rucher introuvable') };
  const hives = db.hives.filter(h => h.apiaryId === a.id).sort((x, y) => nat(x.code, y.code));
  const tasks = db.tasks.filter(t => t.apiaryId === a.id).sort((x, y) => (x.done - y.done));
  let html = '<div class="card">' + (a.notes ? '<div>' + esc(a.notes).replace(/\n/g, '<br>') + '</div>' : '<div class="hint">Pas de notes.</div>');
  if (a.lat != null && a.lng != null) {
    html += '<div class="hint">📍 ' + a.lat.toFixed(5) + ', ' + a.lng.toFixed(5) + '</div><div class="actions"><a class="btn small" href="geo:' + a.lat + ',' + a.lng + '?q=' + a.lat + ',' + a.lng + '(' + encodeURIComponent(a.name) + ')">Ouvrir dans l’appli carte</a><a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + a.lat + ',' + a.lng + '">Itinéraire</a></div>';
  }
  html += '</div><div class="actions"><button class="primary small" data-act="addHive" data-ap="' + a.id + '">+ Ruche ici</button><button class="small" data-act="addTask" data-ap="' + a.id + '">+ Tâche</button><button class="small" data-act="editApiary" data-id="' + a.id + '">Modifier</button><button class="small danger" data-act="delApiary" data-id="' + a.id + '">Supprimer</button></div>';
  html += '<h2>Ruches (' + hives.length + ')</h2>' + (hives.length ? hives.map(hiveItem).join('') : '<div class="hint">Aucune ruche ici.</div>');
  html += '<h2>Tâches</h2>' + (tasks.length ? tasks.map(taskItem).join('') : '<div class="hint">Aucune tâche.</div>');
  return { title: a.name, back: '#/ruchers', html };
};

VIEWS.ruches = () => {
  const html = '<input id="q" type="search" placeholder="Rechercher un numéro…" value="' + esc(ui.q) + '"><div class="actions"><select id="fap" style="flex:1">' +
    [['', 'Tous les ruchers']].concat(apiaryOptions().slice(1)).concat([['__none', 'Sans rucher']]).map(o => '<option value="' + esc(o[0]) + '"' + (ui.ap === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
    '</select><select id="fst" style="flex:1">' + [['', 'Tous états'], ['flag', '⚑ À surveiller'], ['active', 'Actives'], ['hivernage', 'Hivernage'], ['morte', 'Mortes'], ['vendue', 'Vendues']].map(o => '<option value="' + o[0] + '"' + (ui.st === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div><div id="hlist"></div>';
  return {
    title: 'Ruches', html, actions: '<button data-act="addHive">+ Ruche</button>',
    after() {
      const fill = () => {
        const q = ui.q.toLowerCase();
        const list = db.hives.filter(h => (!q || h.code.toLowerCase().includes(q)) &&
          (!ui.ap || (ui.ap === '__none' ? !h.apiaryId : h.apiaryId === ui.ap)) &&
          (!ui.st || (ui.st === 'flag' ? h.flag : h.status === ui.st))).sort((a, b) => nat(a.code, b.code));
        $('#hlist').innerHTML = list.length ? '<div class="hint">' + list.length + ' ruche' + (list.length > 1 ? 's' : '') + '</div>' + list.map(hiveItem).join('') : (db.hives.length ? empty('Aucun résultat') : empty('Aucune ruche', 'Touchez « + Ruche » pour en ajouter (plusieurs d’un coup possible).'));
      };
      $('#q').oninput = e => { ui.q = e.target.value; fill(); };
      $('#fap').onchange = e => { ui.ap = e.target.value; fill(); };
      $('#fst').onchange = e => { ui.st = e.target.value; fill(); };
      fill();
    }
  };
};

VIEWS.ruche = id => {
  const h = H(id);
  if (!h) return { title: 'Ruche', back: '#/ruches', html: empty('Ruche introuvable') };
  const a = A(h.apiaryId), q = Q(h.queenId), c = q && qcolor(q.year);
  const supers = db.supers.filter(s => s.hiveId === h.id).sort((x, y) => nat(x.code, y.code));
  const logs = db.logs.filter(l => l.hiveId === h.id).sort((x, y) => y.ts - x.ts);
  let html = '<div class="card"><div class="row"><div class="grow"><div class="t">' + (a ? '<a href="#/rucher/' + a.id + '">' + esc(a.name) + '</a>' : 'Sans rucher') + '</div><div class="s hint">' + (STATUS.find(s => s[0] === h.status) || [0, h.status])[1] + '</div></div>' + (h.flag ? '<span class="badge warn">⚑ à voir</span>' : '') + '</div>';
  html += '<div style="margin-top:8px">' + (q ? (c ? '<span class="dot" style="background:' + c[1] + '"></span> ' : '') + 'Reine <b>' + esc(qLabel(q)) + '</b>' + (q.lineage ? ' · ' + esc(q.lineage) : '') : '<span class="hint">Pas de reine associée</span>') + '</div>';
  if (h.note) html += '<div style="margin-top:8px">' + esc(h.note).replace(/\n/g, '<br>') + '</div>';
  html += '</div><div class="actions"><button class="primary small" data-act="addLog" data-id="' + h.id + '">+ Intervention</button><button class="small" data-act="toggleFlag" data-id="' + h.id + '">' + (h.flag ? '⚐ Retirer le signal' : '⚑ À surveiller') + '</button><button class="small" data-act="moveHive" data-id="' + h.id + '">Déplacer</button><button class="small" data-act="hiveQr" data-id="' + h.id + '">QR</button><button class="small" data-act="editHive" data-id="' + h.id + '">Modifier</button><button class="small danger" data-act="delHive" data-id="' + h.id + '">Supprimer</button></div>';
  html += '<h2>Hausses (' + supers.length + ')</h2>' + (supers.length ? supers.map(s => '<div class="item"><div class="grow"><div class="t">Hausse ' + esc(s.code) + '</div><div class="s">' + (s.since ? 'depuis le ' + fmtDate(s.since) : '') + '</div></div><button class="small" data-act="unlinkSuper" data-id="' + s.id + '">Retirer</button></div>').join('') : '<div class="hint">Aucune hausse.</div>');
  html += '<div class="actions"><button class="small" data-act="addSuperTo" data-id="' + h.id + '">+ Ajouter une hausse</button></div>';
  html += '<h2>Journal</h2>' + (logs.length ? '<div class="tl">' + logs.map(l => '<div class="e"><b>' + esc(l.type) + '</b> <small>' + fmtTime(l.ts) + '</small>' + (l.note ? '<div>' + esc(l.note).replace(/\n/g, '<br>') + '</div>' : '') + '</div>').join('') + '</div>' : '<div class="hint">Aucune intervention enregistrée.</div>');
  return { title: 'Ruche ' + h.code, back: '#/ruches', html };
};

function taskItem(t) {
  const a = A(t.apiaryId), late = !t.done && t.due && t.due < today();
  return '<div class="item' + (t.done ? ' done' : '') + '"><input type="checkbox" style="width:22px;height:22px" data-act="toggleTask" data-id="' + t.id + '"' + (t.done ? ' checked' : '') + '><div class="grow" data-act="editTask" data-id="' + t.id + '"><div class="t">' + esc(t.text) + '</div><div class="s">' + (a ? esc(a.name) : 'Général') + (t.due ? ' · ' + (late ? '<span class="badge warn">en retard</span> ' : '') + fmtDate(t.due) : '') + '</div></div></div>';
}
VIEWS.taches = () => {
  const open = db.tasks.filter(t => !t.done).sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1);
  const done = db.tasks.filter(t => t.done).slice(-15).reverse();
  let html = open.length ? open.map(taskItem).join('') : empty('Aucune tâche en cours');
  if (done.length) html += '<h2>Terminées</h2>' + done.map(taskItem).join('');
  return { title: 'Tâches', back: '#/plus', html, actions: '<button data-act="addTask">+ Tâche</button>' };
};

VIEWS.reines = () => {
  const list = db.queens.slice().sort((a, b) => nat(a.code, b.code));
  const html = list.length ? list.map(q => {
    const c = qcolor(q.year), h = db.hives.find(x => x.queenId === q.id), m = Q(q.motherId), n = db.queens.filter(x => x.motherId === q.id).length;
    return '<div class="item" data-act="editQueen" data-id="' + q.id + '"><div class="grow"><div class="t">' + (c ? '<span class="dot" style="background:' + c[1] + '"></span> ' : '') + esc(q.code) + (q.year ? ' · ' + q.year : '') + '</div><div class="s">' + (h ? 'Ruche ' + esc(h.code) : 'Pas en ruche') + (q.lineage ? ' · ' + esc(q.lineage) : '') + (m ? ' · mère ' + esc(m.code) : '') + (n ? ' · ' + n + ' fille' + (n > 1 ? 's' : '') : '') + '</div></div><span class="chev">›</span></div>';
  }).join('') + '<p class="hint">Code couleur international : 1/6 blanc · 2/7 jaune · 3/8 rouge · 4/9 vert · 5/0 bleu.</p>' : empty('Aucune reine', 'Ajoutez vos reines pour suivre leurs lignées.');
  return { title: 'Reines', back: '#/plus', html, actions: '<button data-act="addQueen">+ Reine</button>' };
};

VIEWS.hausses = () => {
  const list = db.supers.slice().sort((a, b) => nat(a.code, b.code));
  const html = list.length ? list.map(s => { const h = H(s.hiveId); return '<div class="item" data-act="editSuper" data-id="' + s.id + '"><div class="grow"><div class="t">Hausse ' + esc(s.code) + '</div><div class="s">' + (h ? 'sur ruche ' + esc(h.code) : 'libre') + '</div></div><span class="chev">›</span></div>'; }).join('') : empty('Aucune hausse', 'Ajoutez-les ici ou scannez-les en mode « Récolte ».');
  return { title: 'Hausses', back: '#/plus', html, actions: '<button data-act="addSupers">+ Hausses</button>' };
};

VIEWS.etiquettes = () => {
  const html = '<div class="card"><label>Type</label><select id="lt"><option value="H">Ruches</option><option value="S">Hausses</option></select><div class="grid"><div><label>Du numéro</label><input id="l1" type="number" min="1" value="1" inputmode="numeric"></div><div><label>Au numéro</label><input id="l2" type="number" min="1" value="12" inputmode="numeric"></div></div><div class="actions"><button class="primary" data-act="makeLabels">Générer</button></div><p class="hint">Imprimez (ou « Enregistrer en PDF »), plastifiez, collez sur la ruche ou la hausse. Maximum 200 étiquettes à la fois.</p></div><div id="lprev"></div>';
  return { title: 'Étiquettes QR', back: '#/plus', html };
};

VIEWS.plus = () => {
  const days = db.lastBackup ? Math.floor((Date.now() - db.lastBackup) / 86400000) : null;
  let html = '';
  if (db.hives.length && (days === null || days > 30)) html += '<div class="card"><b>💾 Pensez à sauvegarder</b><div class="hint">' + (days === null ? 'Aucune sauvegarde faite.' : 'Dernière sauvegarde il y a ' + days + ' jours.') + ' Les données ne sont que sur ce téléphone.</div><div class="actions"><button class="primary small" data-act="backup">Sauvegarder maintenant</button></div></div>';
  html += '<h2>Gestion</h2><a class="item" href="#/taches"><div class="grow t">Tâches</div><span class="chev">›</span></a><a class="item" href="#/reines"><div class="grow t">Reines & lignées</div><span class="chev">›</span></a><a class="item" href="#/hausses"><div class="grow t">Hausses</div><span class="chev">›</span></a><a class="item" href="#/etiquettes"><div class="grow t">Étiquettes QR à imprimer</div><span class="chev">›</span></a>';
  html += '<h2>Exporter pour Excel (CSV)</h2><div class="actions">' + ['ruches', 'ruchers', 'hausses', 'reines', 'journal', 'taches'].map(k => '<button class="small" data-act="exportCsv" data-k="' + k + '">' + k + '</button>').join('') + '</div><p class="hint">Fichiers CSV (séparateur « ; », accents conservés) : s’ouvrent directement dans Excel ou LibreOffice. Sur téléphone, le menu de partage permet de les envoyer par e-mail.</p>';
  html += '<h2>Sauvegarde complète</h2><div class="actions"><button data-act="backup">Exporter (.json)</button><button data-act="importPick">Restaurer…</button></div><input type="file" id="imp" accept=".json,application/json" hidden>';
  html += '<h2>Application</h2><div class="actions" id="inst"></div><p class="hint" id="instHint">Sur iPhone : Safari → Partager → « Sur l’écran d’accueil ». Sur Android : menu ⋮ → « Installer l’application ».</p>';
  html += '<h2>Zone dangereuse</h2><div class="actions"><button class="danger small" data-act="wipe">Effacer toutes les données</button></div>';
  return {
    title: 'Plus', html,
    after() {
      $('#imp').onchange = e => importFile(e.target.files[0]);
      if (deferredInstall) $('#inst').innerHTML = '<button class="primary" data-act="install">Installer O Jur\'Api</button>';
    }
  };
};

/* ---- scan ---- */
const scan = { mode: 'open', target: '', hive: '', pending: [], last: '', lastT: 0, log: [], stream: null, timer: null, canvas: null };
const MODES = [['open', 'Fiche'], ['queen', 'Reine'], ['harvest', 'Récolte'], ['move', 'Transhumance'], ['winter', 'Hivernage']];
const MODE_HELP = {
  open: 'Scannez le QR d’une ruche pour ouvrir sa fiche.',
  queen: 'Choisissez (ou scannez) une reine, puis scannez les ruches qui la contiennent.',
  harvest: 'Scannez la ruche, puis chaque hausse récoltée : elles sont reliées à cette ruche.',
  move: 'Choisissez le rucher de destination, puis scannez chaque ruche déplacée.',
  winter: 'Choisissez le rucher d’hivernage, puis scannez chaque ruche concernée.'
};
VIEWS.scan = () => {
  let ctx = '';
  if (scan.mode === 'queen') ctx = '<label>Reine</label><select id="scanTarget">' + queenOptions('— Choisir —').map(o => '<option value="' + esc(o[0]) + '"' + (scan.target === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  if (scan.mode === 'move' || scan.mode === 'winter') ctx = '<label>' + (scan.mode === 'move' ? 'Rucher de destination' : 'Rucher d’hivernage') + '</label><select id="scanTarget">' + apiaryOptions('— Choisir —').map(o => '<option value="' + esc(o[0]) + '"' + (scan.target === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  const html = '<div class="seg">' + MODES.map(m => '<button class="' + (scan.mode === m[0] ? 'on' : '') + '" data-act="scanMode" data-m="' + m[0] + '">' + m[1] + '</button>').join('') + '</div><p class="hint">' + MODE_HELP[scan.mode] + '</p>' + ctx +
    '<div id="scanCtx" class="hint"></div><div class="video" style="margin-top:10px"><video id="cam" playsinline muted></video><div class="aim"></div></div><div class="actions"><button class="primary" id="camBtn" data-act="camToggle">Activer la caméra</button></div>' +
    '<label>Ou saisissez le numéro (12 = ruche, S12 = hausse, Q3 = reine)</label><div class="row"><input id="manual" inputmode="text" placeholder="12" autocomplete="off"><button data-act="manualGo">OK</button></div><h2>Historique</h2><div id="scanLog"></div>';
  return {
    title: 'Scanner', html,
    after() {
      const t = $('#scanTarget'); if (t) t.onchange = e => { scan.target = e.target.value; };
      $('#manual').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ACT.manualGo(); } };
      paintScan();
    }
  };
};
function paintScan() {
  const l = $('#scanLog'); if (!l) return;
  l.innerHTML = scan.log.length ? scan.log.map(x => '<div class="log">' + (x.warn ? '⚠ ' : '✓ ') + esc(x.msg) + '</div>').join('') : '<div class="hint">Rien de scanné pour l’instant.</div>';
  const c = $('#scanCtx');
  if (c) {
    if (scan.mode === 'harvest') { const h = H(scan.hive); c.innerHTML = 'Ruche courante : <b>' + (h ? h.code : '—') + '</b>' + (scan.pending.length ? ' · ' + scan.pending.length + ' hausse(s) en attente' : '') + ' <button class="small" data-act="scanReset">Réinitialiser</button>'; } else c.innerHTML = '';
  }
}
function scanLog(msg, warn) { scan.log.unshift({ msg, warn: !!warn }); scan.log = scan.log.slice(0, 25); paintScan(); toast(msg); }
function parseCode(raw) {
  const t = String(raw).trim();
  let m = /^RCH:([HSQ]):(.+)$/i.exec(t); if (m) return { t: m[1].toUpperCase(), code: m[2].trim() };
  m = /^([HSQ])\s*[-:]?\s*(\w+)$/i.exec(t); if (m && /^[SQ]/i.test(m[1])) return { t: m[1].toUpperCase(), code: m[2] };
  if (/^\w+$/.test(t)) return { t: 'H', code: t };
  return null;
}
function linkSuper(s, h) {
  if (s.hiveId === h.id) return false;
  s.hiveId = h.id; s.since = today(); addLog(h.id, 'Récolte', 'Hausse ' + s.code + ' récoltée'); return true;
}
function handleScan(raw, force) {
  const p = parseCode(raw);
  if (!p) { scanLog('Code non reconnu : ' + raw, true); return; }
  const key = p.t + ':' + p.code, now = Date.now();
  if (!force && key === scan.last && now - scan.lastT < 3000) { scan.lastT = now; return; }
  scan.last = key; scan.lastT = now;
  try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) { /* ignore */ }
  const m = scan.mode;
  if (p.t === 'H') {
    const needA = m === 'move' || m === 'winter';
    if (needA && !A(scan.target)) { scanLog('Choisissez d’abord le rucher', true); return; }
    if (m === 'queen' && !Q(scan.target)) { scanLog('Choisissez d’abord la reine', true); return; }
    let h = hiveByCode(p.code), created = false;
    if (!h) { h = newHive(p.code, { apiaryId: needA ? scan.target : '' }); created = true; }
    const tag = created ? ' (nouvelle ruche)' : '';
    if (m === 'open') { save(); location.hash = '#/ruche/' + h.id; if (created) toast('Ruche ' + h.code + ' créée'); return; }
    if (m === 'queen') { const q = Q(scan.target); h.queenId = q.id; addLog(h.id, 'Reine', 'Reine ' + qLabel(q) + ' associée'); scanLog('Ruche ' + h.code + ' ← reine ' + qLabel(q) + tag); }
    if (m === 'harvest') { scan.hive = h.id; let n = 0; scan.pending.forEach(sid => { const s = S(sid); if (s && linkSuper(s, h)) n++; }); scan.pending = []; scanLog('Ruche ' + h.code + ' sélectionnée' + (n ? ' · ' + n + ' hausse(s) liée(s)' : '') + tag); }
    if (m === 'move') { const a = A(scan.target); h.apiaryId = a.id; if (h.status === 'hivernage') h.status = 'active'; addLog(h.id, 'Transhumance', 'Déplacée vers ' + a.name); scanLog('Ruche ' + h.code + ' → ' + a.name + tag); }
    if (m === 'winter') { const a = A(scan.target); h.apiaryId = a.id; h.status = 'hivernage'; addLog(h.id, 'Hivernage', 'Hivernage à ' + a.name); scanLog('Ruche ' + h.code + ' hivernage à ' + a.name + tag); }
  } else if (p.t === 'S') {
    let s = superByCode(p.code); if (!s) s = newSuper(p.code);
    if (m === 'harvest') {
      const h = H(scan.hive);
      if (h) { scanLog(linkSuper(s, h) ? 'Hausse ' + s.code + ' → ruche ' + h.code : 'Hausse ' + s.code + ' déjà liée à la ruche ' + h.code); } else { scan.pending.push(s.id); scanLog('Hausse ' + s.code + ' en attente : scannez sa ruche'); }
    } else { const h = H(s.hiveId); scanLog('Hausse ' + s.code + (h ? ' sur la ruche ' + h.code : ' (libre)')); }
  } else if (p.t === 'Q') {
    const q = queenByCode(p.code) || queenByCode(String(raw).trim());
    if (!q) { scanLog('Reine ' + p.code + ' inconnue', true); return; }
    if (m === 'queen') { scan.target = q.id; const t = $('#scanTarget'); if (t) t.value = q.id; scanLog('Reine ' + qLabel(q) + ' sélectionnée'); } else { const h = db.hives.find(x => x.queenId === q.id); scanLog('Reine ' + qLabel(q) + (h ? ' dans la ruche ' + h.code : ' (pas en ruche)')); }
  }
  save(); paintScan();
}
async function startCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Caméra indisponible (HTTPS requis). Utilisez la saisie manuelle.'); return; }
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    const v = $('#cam'); if (!v) { stopCam(); return; }
    v.srcObject = scan.stream; await v.play();
    const b = $('#camBtn'); if (b) b.textContent = 'Arrêter la caméra';
    tick();
  } catch (e) { scan.stream = null; toast('Caméra refusée ou absente (' + (e.name || 'erreur') + ')'); }
}
function tick() {
  if (!scan.stream) return;
  const v = $('#cam');
  if (v && v.readyState >= 2 && v.videoWidth) {
    const c = scan.canvas || (scan.canvas = document.createElement('canvas')), sc = Math.min(1, 640 / v.videoWidth);
    c.width = Math.round(v.videoWidth * sc); c.height = Math.round(v.videoHeight * sc);
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(v, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height), r = window.jsQR(d.data, c.width, c.height, { inversionAttempts: 'dontInvert' });
    if (r && r.data) handleScan(r.data);
  }
  scan.timer = setTimeout(tick, 140);
}
function stopCam() {
  clearTimeout(scan.timer);
  if (scan.stream) { scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; }
  const b = $('#camBtn'); if (b) b.textContent = 'Activer la caméra';
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCam(); });

/* ================= formulaires métier ================= */
function apiaryForm(a) {
  const isNew = !a; a = a || {};
  form({
    title: isNew ? 'Nouveau rucher' : 'Modifier le rucher',
    fields: [{ name: 'name', label: 'Nom', value: a.name }, { name: 'lat', label: 'Latitude', value: a.lat == null ? '' : a.lat, inputmode: 'decimal' }, { name: 'lng', label: 'Longitude', value: a.lng == null ? '' : a.lng, inputmode: 'decimal' }, { name: 'notes', label: 'Notes (accès, floraison…)', type: 'textarea', value: a.notes }],
    extra: '<div class="actions"><button type="button" class="small" data-act="pickMap">🗺 Choisir sur la carte</button><button type="button" class="small" data-act="geoFill">📍 Ma position</button></div>',
    onSubmit(v) {
      if (!v.name) { toast('Donnez un nom au rucher'); return false; }
      if (isNew) { a = { id: uid() }; db.apiaries.push(a); }
      Object.assign(a, { name: v.name, lat: num(v.lat), lng: num(v.lng), notes: v.notes });
      save(); render(true); if (isNew) toast('Rucher créé');
    }
  });
}
function hiveForm(apiaryId) {
  if (!db.apiaries.length) { toast('Créez d’abord un rucher'); location.hash = '#/ruchers'; return; }
  form({
    title: 'Nouvelle(s) ruche(s)',
    fields: [{ name: 'code', label: 'Numéro (de la première)', value: nextCode(db.hives), inputmode: 'numeric' }, { name: 'count', label: 'Combien en créer ?', type: 'number', value: 1, min: 1, max: 100, inputmode: 'numeric' }, { name: 'apiaryId', label: 'Rucher', type: 'select', options: apiaryOptions(), value: apiaryId || '' }, { name: 'note', label: 'Note', type: 'textarea' }],
    onSubmit(v) {
      const n = Math.max(1, Math.min(100, parseInt(v.count, 10) || 1)), start = parseInt(v.code, 10);
      if (!v.code) { toast('Indiquez un numéro'); return false; }
      if (n > 1 && !Number.isFinite(start)) { toast('Numéro numérique requis pour en créer plusieurs'); return false; }
      const codes = n > 1 ? Array.from({ length: n }, (_, i) => String(start + i)) : [v.code];
      const dup = codes.find(c => hiveByCode(c)); if (dup) { toast('La ruche ' + dup + ' existe déjà'); return false; }
      codes.forEach(c => newHive(c, { apiaryId: v.apiaryId, note: v.note }));
      save(); render(true); toast(n + ' ruche' + (n > 1 ? 's' : '') + ' créée' + (n > 1 ? 's' : ''));
    }
  });
}
function editHiveForm(h) {
  form({
    title: 'Ruche ' + h.code,
    fields: [{ name: 'code', label: 'Numéro', value: h.code }, { name: 'apiaryId', label: 'Rucher', type: 'select', options: apiaryOptions(), value: h.apiaryId }, { name: 'status', label: 'État', type: 'select', options: STATUS, value: h.status }, { name: 'queenId', label: 'Reine', type: 'select', options: queenOptions(), value: h.queenId }, { name: 'flag', label: '⚑ À surveiller', type: 'checkbox', value: h.flag }, { name: 'note', label: 'Note', type: 'textarea', value: h.note }],
    onSubmit(v) {
      if (!v.code) { toast('Numéro requis'); return false; }
      const o = hiveByCode(v.code); if (o && o.id !== h.id) { toast('Ce numéro existe déjà'); return false; }
      Object.assign(h, { code: v.code, apiaryId: v.apiaryId, status: v.status, queenId: v.queenId, flag: v.flag, note: v.note });
      save(); render(true);
    }
  });
}
function logForm(h) {
  form({
    title: 'Intervention · ruche ' + h.code,
    fields: [{ name: 'type', label: 'Type', type: 'select', options: LOGTYPES.map(t => [t, t]) }, { name: 'note', label: 'Notes (couvain, réserves, comportement…)', type: 'textarea' }, { name: 'flag', label: '⚑ Marquer à surveiller', type: 'checkbox', value: h.flag }],
    onSubmit(v) { addLog(h.id, v.type, v.note); h.flag = v.flag; save(); render(true); toast('Intervention enregistrée'); }
  });
}
function queenForm(q) {
  const isNew = !q; q = q || {};
  const mothers = [['', '— Inconnue —']].concat(db.queens.filter(x => x.id !== q.id).map(x => [x.id, qLabel(x)]));
  form({
    title: isNew ? 'Nouvelle reine' : 'Reine ' + q.code,
    fields: [{ name: 'code', label: 'Identifiant / nom', value: q.code }, { name: 'year', label: 'Année de naissance', value: q.year || '', inputmode: 'numeric' }, { name: 'lineage', label: 'Lignée / souche', value: q.lineage }, { name: 'motherId', label: 'Mère', type: 'select', options: mothers, value: q.motherId || '' }, { name: 'note', label: 'Note', type: 'textarea', value: q.note }],
    extra: isNew ? '' : '<div class="actions"><button type="button" class="small" data-act="queenQr" data-id="' + q.id + '">QR</button><button type="button" class="small danger" data-act="delQueen" data-id="' + q.id + '">Supprimer</button></div>',
    onSubmit(v) {
      if (!v.code) { toast('Identifiant requis'); return false; }
      const o = queenByCode(v.code); if (o && o.id !== q.id) { toast('Cet identifiant existe déjà'); return false; }
      if (isNew) { q = { id: uid() }; db.queens.push(q); }
      Object.assign(q, { code: v.code, year: parseInt(v.year, 10) || '', lineage: v.lineage, motherId: v.motherId, note: v.note });
      save(); render(true);
    }
  });
}
function taskForm(t, apiaryId) {
  const isNew = !t; t = t || {};
  form({
    title: isNew ? 'Nouvelle tâche' : 'Modifier la tâche',
    fields: [{ name: 'text', label: 'Tâche', value: t.text }, { name: 'apiaryId', label: 'Rucher', type: 'select', options: apiaryOptions('— Général —'), value: t.apiaryId || apiaryId || '' }, { name: 'due', label: 'Échéance', type: 'date', value: t.due || '' }],
    extra: isNew ? '' : '<div class="actions"><button type="button" class="small danger" data-act="delTask" data-id="' + t.id + '">Supprimer</button></div>',
    onSubmit(v) {
      if (!v.text) { toast('Décrivez la tâche'); return false; }
      if (isNew) { t = { id: uid(), done: false }; db.tasks.push(t); }
      Object.assign(t, { text: v.text, apiaryId: v.apiaryId, due: v.due });
      save(); render(true);
    }
  });
}
function superForm(s) {
  form({
    title: 'Hausse ' + s.code,
    fields: [{ name: 'code', label: 'Numéro', value: s.code }, { name: 'hiveId', label: 'Sur la ruche', type: 'select', options: hiveOptions('— Libre —'), value: s.hiveId }],
    extra: '<div class="actions"><button type="button" class="small danger" data-act="delSuper" data-id="' + s.id + '">Supprimer</button></div>',
    onSubmit(v) {
      if (!v.code) { toast('Numéro requis'); return false; }
      const o = superByCode(v.code); if (o && o.id !== s.id) { toast('Ce numéro existe déjà'); return false; }
      s.code = v.code; if (s.hiveId !== v.hiveId) s.since = v.hiveId ? today() : ''; s.hiveId = v.hiveId; save(); render(true);
    }
  });
}

/* ================= choix d'une position sur la carte ================= */
let leafletP = null;
function ensureLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletP) return leafletP;
  leafletP = new Promise((res, rej) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'lib/leaflet/leaflet.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = 'lib/leaflet/leaflet.js'; s.onload = () => res(); s.onerror = () => { leafletP = null; rej(new Error('leaflet')); };
    document.head.appendChild(s);
  });
  return leafletP;
}
async function openMapPicker() {
  const f = $('#f');
  if (!f || !f.elements.lat || $('#mapPicker')) return;
  try { await ensureLeaflet(); } catch (e) { toast('Carte indisponible'); return; }
  const lat0 = num(f.elements.lat.value), lng0 = num(f.elements.lng.value);
  let c = [46.8, 8.2], z = 7;
  if (lat0 != null && lng0 != null) { c = [lat0, lng0]; z = 15; } else {
    const a = db.apiaries.find(x => x.lat != null && x.lng != null);
    if (a) { c = [a.lat, a.lng]; z = 11; }
  }
  const box = document.createElement('div'); box.id = 'mapPicker';
  box.innerHTML = '<div class="mp-bar"><button type="button" data-mp="cancel">✕ Annuler</button><form class="mp-search"><input type="search" placeholder="Rechercher un lieu…" autocomplete="off"><button>🔍</button></form></div>' +
    '<div class="mp-wrap"><div class="mp-map" id="mpMap"></div><div class="mp-pin" aria-hidden="true"><svg viewBox="0 0 24 34" width="36" height="51"><path d="M12 1C5.9 1 1 5.9 1 12c0 8.3 11 21 11 21s11-12.700 11-21C23 5.9 18.100 1 12 1z" fill="#d93025" stroke="#7a1410" stroke-width="1.500"/><circle cx="12" cy="12" r="4.200" fill="#fff"/></svg></div></div>' +
    '<div class="mp-foot"><div class="mp-coords"></div><div class="mp-hint">Déplacez la carte : la position est celle du repère rouge. Touchez la carte pour recentrer.</div><div class="mp-btns"><button type="button" data-mp="gps">📍 Ma position</button><button type="button" class="primary" data-mp="ok">Valider cette position</button></div></div>';
  document.body.appendChild(box);
  const map = L.map('mpMap', { zoomControl: true }).setView(c, z);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  let warned = false;
  tiles.on('tileerror', () => { if (!warned) { warned = true; toast('Fond de carte indisponible (hors ligne ?). Saisissez les coordonnées à la main.'); } });
  if (navigator.onLine === false) { warned = true; toast('Hors ligne : la carte ne peut pas se charger.'); }
  const coords = box.querySelector('.mp-coords');
  const upd = () => { const p = map.getCenter(); coords.textContent = p.lat.toFixed(5) + ', ' + p.lng.toFixed(5); };
  map.on('move', upd); upd();
  map.on('click', e => map.panTo(e.latlng));
  setTimeout(() => map.invalidateSize(), 60);
  box._map = map;
  const close = () => { map.remove(); box.remove(); };
  box.querySelector('.mp-search').onsubmit = async e => {
    e.preventDefault();
    const q = e.target.querySelector('input').value.trim(); if (!q) return;
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(q));
      const j = await r.json();
      if (j && j[0]) map.setView([parseFloat(j[0].lat), parseFloat(j[0].lon)], 15); else toast('Lieu introuvable');
    } catch (err) { toast('Recherche impossible (hors ligne ?)'); }
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-mp]'); if (!b) return;
    if (b.dataset.mp === 'cancel') close();
    if (b.dataset.mp === 'gps') {
      if (!navigator.geolocation) { toast('Position indisponible'); return; }
      toast('Recherche de la position…');
      navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 17), () => toast('Position refusée ou indisponible'), { enableHighAccuracy: true, timeout: 15000 });
    }
    if (b.dataset.mp === 'ok') {
      const p = map.getCenter(), cur = $('#f');
      if (cur && cur.elements.lat) { cur.elements.lat.value = p.lat.toFixed(6); cur.elements.lng.value = p.lng.toFixed(6); }
      close(); toast('Position choisie');
    }
  });
}

/* ================= export / import ================= */
function csvText(rows) { return '﻿' + rows.map(r => r.map(c => { c = String(c == null ? '' : c); return /[;"\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';')).join('\r\n'); }
const EXPORTS = {
  ruches: () => [['Numéro', 'Rucher', 'État', 'À surveiller', 'Reine', 'Année reine', 'Lignée', 'Nb hausses', 'Note']].concat(db.hives.slice().sort((a, b) => nat(a.code, b.code)).map(h => { const a = A(h.apiaryId), q = Q(h.queenId); return [h.code, a ? a.name : '', (STATUS.find(s => s[0] === h.status) || [0, h.status])[1], h.flag ? 'oui' : '', q ? q.code : '', q ? q.year : '', q ? q.lineage : '', db.supers.filter(s => s.hiveId === h.id).length, h.note]; })),
  ruchers: () => [['Nom', 'Latitude', 'Longitude', 'Nb ruches', 'Notes']].concat(db.apiaries.map(a => [a.name, a.lat == null ? '' : a.lat, a.lng == null ? '' : a.lng, db.hives.filter(h => h.apiaryId === a.id).length, a.notes])),
  hausses: () => [['Numéro', 'Ruche', 'Depuis']].concat(db.supers.slice().sort((a, b) => nat(a.code, b.code)).map(s => { const h = H(s.hiveId); return [s.code, h ? h.code : '', s.since || '']; })),
  reines: () => [['Identifiant', 'Année', 'Couleur', 'Lignée', 'Mère', 'Ruche', 'Note']].concat(db.queens.map(q => { const c = qcolor(q.year), m = Q(q.motherId), h = db.hives.find(x => x.queenId === q.id); return [q.code, q.year, c ? c[0] : '', q.lineage, m ? m.code : '', h ? h.code : '', q.note]; })),
  journal: () => [['Date', 'Ruche', 'Rucher', 'Type', 'Note']].concat(db.logs.slice().sort((a, b) => a.ts - b.ts).map(l => { const h = H(l.hiveId), a = h && A(h.apiaryId); return [new Date(l.ts).toLocaleString('fr-CH'), h ? h.code : '', a ? a.name : '', l.type, l.note]; })),
  taches: () => [['Tâche', 'Rucher', 'Échéance', 'Faite']].concat(db.tasks.map(t => { const a = A(t.apiaryId); return [t.text, a ? a.name : '', t.due || '', t.done ? 'oui' : '']; }))
};
async function saveFile(name, text, mime) {
  const file = new File([text], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function importFile(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.hives) || !Array.isArray(d.apiaries)) throw new Error('format');
      if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
      db = Object.assign(EMPTY(), d); save(); render(true); toast('Sauvegarde restaurée');
    } catch (e) { toast('Fichier de sauvegarde invalide'); }
  };
  r.readAsText(f);
}

/* ================= actions (délégation) ================= */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const i = $('#inst'); if (i) i.innerHTML = '<button class="primary" data-act="install">Installer O Jur\'Api</button>'; });
const ACT = {
  addApiary() { apiaryForm(); },
  editApiary(el) { apiaryForm(A(el.dataset.id)); },
  delApiary(el) {
    const a = A(el.dataset.id); if (!a || !confirm('Supprimer le rucher « ' + a.name + ' » ? Les ruches restent, sans rucher.')) return;
    db.hives.forEach(h => { if (h.apiaryId === a.id) h.apiaryId = ''; }); db.tasks.forEach(t => { if (t.apiaryId === a.id) t.apiaryId = ''; });
    db.apiaries = db.apiaries.filter(x => x.id !== a.id); save(); location.hash = '#/ruchers';
  },
  pickMap() { openMapPicker(); },
  geoFill() {
    if (!navigator.geolocation) { toast('Position indisponible'); return; }
    toast('Recherche de la position…');
    navigator.geolocation.getCurrentPosition(p => { const f = $('#f'); if (!f) return; f.elements.lat.value = p.coords.latitude.toFixed(6); f.elements.lng.value = p.coords.longitude.toFixed(6); toast('Position renseignée'); }, () => toast('Position refusée ou indisponible'), { enableHighAccuracy: true, timeout: 15000 });
  },
  addHive(el) { hiveForm(el && el.dataset.ap); },
  editHive(el) { editHiveForm(H(el.dataset.id)); },
  delHive(el) { const h = H(el.dataset.id); if (!h || !confirm('Supprimer la ruche ' + h.code + ' et son journal ?')) return; removeHive(h); save(); location.hash = '#/ruches'; },
  toggleFlag(el) { const h = H(el.dataset.id); h.flag = !h.flag; save(); render(true); },
  moveHive(el) {
    const h = H(el.dataset.id);
    form({ title: 'Déplacer la ruche ' + h.code, fields: [{ name: 'apiaryId', label: 'Vers le rucher', type: 'select', options: apiaryOptions(), value: h.apiaryId }], submit: 'Déplacer', onSubmit(v) { if (v.apiaryId === h.apiaryId) return; const a = A(v.apiaryId); h.apiaryId = v.apiaryId; addLog(h.id, 'Transhumance', a ? 'Déplacée vers ' + a.name : 'Retirée du rucher'); save(); render(true); } });
  },
  hiveQr(el) { const h = H(el.dataset.id); showQr('RCH:H:' + h.code, 'Ruche ' + h.code); },
  queenQr(el) { const q = Q(el.dataset.id); showQr('RCH:Q:' + q.code, 'Reine ' + q.code); },
  printOne(el) { closeSheet(); printItems([{ text: el.dataset.text, label: el.dataset.label }]); },
  addLog(el) { logForm(H(el.dataset.id)); },
  addSuperTo(el) {
    const h = H(el.dataset.id);
    form({ title: 'Ajouter une hausse à la ruche ' + h.code, fields: [{ name: 'code', label: 'Numéro de la hausse', inputmode: 'numeric' }], submit: 'Ajouter', onSubmit(v) { if (!v.code) { toast('Numéro requis'); return false; } let s = superByCode(v.code); if (!s) s = newSuper(v.code); s.hiveId = h.id; s.since = today(); addLog(h.id, 'Pose de hausse', 'Hausse ' + s.code); save(); render(true); } });
  },
  unlinkSuper(el) { const s = S(el.dataset.id), h = H(s.hiveId); s.hiveId = ''; s.since = ''; if (h) addLog(h.id, 'Pose de hausse', 'Hausse ' + s.code + ' retirée'); save(); render(true); },
  addSupers() {
    form({ title: 'Nouvelles hausses', fields: [{ name: 'code', label: 'Numéro de la première', value: nextCode(db.supers), inputmode: 'numeric' }, { name: 'count', label: 'Combien ?', type: 'number', value: 1, min: 1, max: 200 }], onSubmit(v) { const n = Math.max(1, Math.min(200, parseInt(v.count, 10) || 1)), s0 = parseInt(v.code, 10); if (!Number.isFinite(s0)) { toast('Numéro numérique requis'); return false; } const codes = Array.from({ length: n }, (_, i) => String(s0 + i)); const d = codes.find(c => superByCode(c)); if (d) { toast('La hausse ' + d + ' existe déjà'); return false; } codes.forEach(newSuper); save(); render(true); } });
  },
  editSuper(el) { superForm(S(el.dataset.id)); },
  delSuper(el) { const s = S(el.dataset.id); if (!confirm('Supprimer la hausse ' + s.code + ' ?')) return; db.supers = db.supers.filter(x => x.id !== s.id); save(); closeSheet(); render(true); },
  addQueen() { queenForm(); },
  editQueen(el) { queenForm(Q(el.dataset.id)); },
  delQueen(el) { const q = Q(el.dataset.id); if (!confirm('Supprimer la reine ' + q.code + ' ?')) return; db.hives.forEach(h => { if (h.queenId === q.id) h.queenId = ''; }); db.queens.forEach(x => { if (x.motherId === q.id) x.motherId = ''; }); db.queens = db.queens.filter(x => x.id !== q.id); save(); closeSheet(); render(true); },
  addTask(el) { taskForm(null, el && el.dataset && el.dataset.ap); },
  editTask(el) { taskForm(db.tasks.find(t => t.id === el.dataset.id)); },
  toggleTask(el) { const t = db.tasks.find(x => x.id === el.dataset.id); t.done = el.checked; save(); render(true); },
  delTask(el) { db.tasks = db.tasks.filter(t => t.id !== el.dataset.id); save(); closeSheet(); render(true); },
  makeLabels() {
    const type = $('#lt').value, a = parseInt($('#l1').value, 10), b = parseInt($('#l2').value, 10);
    if (!(a >= 1) || !(b >= a)) { toast('Plage invalide'); return; }
    if (b - a + 1 > 200) { toast('Maximum 200 étiquettes'); return; }
    const items = []; for (let i = a; i <= b; i++) items.push({ text: 'RCH:' + type + ':' + i, label: (type === 'H' ? 'Ruche ' : 'Hausse ') + i });
    window.__labels = items;
    $('#lprev').innerHTML = '<div class="actions"><button class="primary" data-act="printLabels">Imprimer / PDF (' + items.length + ')</button></div>' + labelsHtml(items.slice(0, 8)).replace('class="labels"', 'class="labels" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"') + (items.length > 8 ? '<p class="hint">Aperçu des 8 premières.</p>' : '');
  },
  printLabels() { printItems(window.__labels || []); },
  exportCsv(el) { const k = el.dataset.k; saveFile(k + '.csv', csvText(EXPORTS[k]()), 'text/csv'); },
  backup() { db.lastBackup = Date.now(); save(); saveFile('ojurapi-sauvegarde-' + today() + '.json', JSON.stringify(db), 'application/json'); render(true); },
  importPick() { $('#imp').click(); },
  wipe() { if (confirm("Effacer TOUTES les données de O Jur'Api sur ce téléphone ?") && confirm('Vraiment tout effacer ? Action irréversible.')) { db = EMPTY(); save(); render(true); toast('Données effacées'); } },
  install() { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } },
  scanMode(el) { const was = !!scan.stream; scan.mode = el.dataset.m; scan.target = ''; scan.pending = []; render(true); if (was) startCam(); },
  scanReset() { scan.hive = ''; scan.pending = []; paintScan(); },
  camToggle() { if (scan.stream) stopCam(); else startCam(); },
  manualGo() { const i = $('#manual'); if (!i || !i.value.trim()) return; handleScan(i.value, true); i.value = ''; }
};
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { closeSheet(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const f = ACT[el.dataset.act]; if (f) { e.stopPropagation(); f(el); }
});
document.addEventListener('change', e => { const el = e.target; if (el.tagName === 'INPUT' && el.dataset.act) ACT[el.dataset.act](el); });

/* ================= routeur ================= */
const TABS = { accueil: 'accueil', ruchers: 'ruchers', rucher: 'ruchers', ruches: 'ruches', ruche: 'ruches', scan: 'scan', plus: 'plus', taches: 'plus', reines: 'plus', hausses: 'plus', etiquettes: 'plus' };
function render(keepScroll) {
  stopCam();
  const parts = (location.hash || '#/accueil').replace(/^#\//, '').split('/');
  const route = VIEWS[parts[0]] ? parts[0] : 'accueil';
  const out = VIEWS[route](parts[1]) || {};
  const y = window.scrollY;
  $('#title').innerHTML = (out.back ? '<a class="back" href="' + out.back + '">‹</a> ' : '') + esc(out.title || "O Jur'Api");
  $('#topActions').innerHTML = out.actions || '';
  $('#view').innerHTML = out.html || '';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === TABS[route]));
  if (out.after) out.after();
  window.scrollTo(0, keepScroll === true ? y : 0);
}
window.addEventListener('hashchange', () => { closeSheet(); render(false); });
window.addEventListener('afterprint', () => { const p = $('#printSheet'); p.hidden = true; p.innerHTML = ''; });

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
window.Ruchier = { get db() { return db; }, ACT, handleScan, scan, render, EXPORTS, csvText, parseCode };
render(false);
})();
