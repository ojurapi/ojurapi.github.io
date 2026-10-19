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
const EMPTY = () => ({ apiaries: [], hives: [], supers: [], queens: [], logs: [], tasks: [], feeds: [{ id: 'f1', name: 'Sirop 50/50' }, { id: 'f2', name: 'Sirop 70/30' }, { id: 'f3', name: 'Candi' }, { id: 'f4', name: 'Pâte protéinée' }], treatments: [{ id: 't1', name: 'Dégouttement' }, { id: 't2', name: 'Lange A/O' }, { id: 't3', name: 'Sublimation' }], seq: 1, lastBackup: 0, homeOrder: null, homeHidden: null });
let db = load();
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.hives)) { const r = Object.assign(EMPTY(), d); (r.feeds || []).forEach(f => { if (f.name === 'Sirop 3:2') f.name = 'Sirop 70/30'; }); return r; } } catch (e) { /* ignore */ }
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
const KINDS = [['ruche', 'Ruche'], ['ruchette', 'Ruchette'], ['nuc', 'Nuc']];
const kindLabel = h => (KINDS.find(k => k[0] === h.kind) || KINDS[0])[1];
const hn = h => kindLabel(h) + ' ' + h.code;
const STATUS = [['active', 'Active'], ['hivernage', 'Hivernage'], ['morte', 'Morte'], ['vendue', 'Vendue']];
const LOGTYPES = ['Visite', 'Ajout', 'Changement de reine', 'Perte', 'Nourrissement', 'Traitement', 'Pose de hausse', 'Division / essaim', 'Reine', 'Récolte', 'Transhumance', 'Hivernage', 'Autre'];

const LOGICONS = { 'Sortie d’hivernage': '🌤️', 'Visite': '👀', 'Ajout': '➕', 'Changement de reine': '👑', 'Perte': '✖️', 'Nourrissement': '🥣', 'Traitement': '💊', 'Pose de hausse': '📦', 'Division / essaim': '🔀', 'Reine': '👑', 'Récolte': '🍯', 'Transhumance': '🚚', 'Hivernage': '❄️', 'Autre': '⋯' };
const AJOUTS = [['gaufre', 'Cadre gaufré', 'Cadres gaufrés'], ['construit', 'Cadre construit', 'Cadres construits'], ['males', 'Cadre à mâles', 'Cadres à mâles'], ['partition', 'Partition', 'Partitions']];
const pad2 = n => String(n).padStart(2, '0');
const toLocalInput = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const fromLocalInput = x => { const t = x ? new Date(x).getTime() : NaN; return Number.isFinite(t) ? t : Date.now(); };
const whenField = ts => ({ name: 'when', label: 'Date et heure', type: 'datetime-local', value: toLocalInput(ts || Date.now()) });
function addLog(hiveId, type, note, data, ts) {
  const l = { id: uid(), ts: ts || Date.now(), hiveId, type, note: note || '' };
  if (data) l.data = data;
  db.logs.push(l);
}
const isTodo = l => l.type === 'Opération à faire';
function logDetail(l) {
  const d = l.data; if (!d) return '';
  let s = '';
  if (d.reine) s += '<span class="badge ' + (d.reine === 'ok' ? 'ok' : 'warn') + '">Reine ' + (d.reine === 'ok' ? 'OK' : 'KO') + '</span>';
  if (d.pontes) s += '<span class="badge ' + (d.pontes === 'ok' ? 'ok' : 'warn') + '">Pontes ' + (d.pontes === 'ok' ? 'OK' : 'KO') + '</span>';
  if (d.ajout) s += AJOUTS.filter(a => d.ajout[a[0]]).map(a => '+' + d.ajout[a[0]] + ' ' + (d.ajout[a[0]] > 1 ? a[2] : a[1]).toLowerCase()).join(' · ');
  return s ? '<div>' + s + '</div>' : '';
}
function newHive(code, o = {}) {
  const h = { id: uid(), code: String(code), kind: o.kind || 'ruche', apiaryId: o.apiaryId || '', status: 'active', queenId: '', flag: false, note: o.note || '', created: Date.now() };
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
  if (f.type === 'html') return f.html;
  if (f.type === 'hidden') return '<input type="hidden" name="' + f.name + '" value="' + esc(f.value == null ? '' : f.value) + '">';
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
    o.fields.forEach(f => { if (f.type === 'html') return; v[f.name] = f.type === 'checkbox' ? fd.has(f.name) : String(fd.get(f.name) == null ? '' : fd.get(f.name)).trim(); });
    if (o.onSubmit(v) !== false) closeSheet();
  };
}
const apiaryOptions = (none = '— Aucun —') => [['', none]].concat(db.apiaries.slice().sort((a, b) => nat(a.name, b.name)).map(a => [a.id, a.name]));
const queenOptions = (none = '— Aucune —') => [['', none]].concat(db.queens.slice().sort((a, b) => nat(a.code, b.code)).map(q => [q.id, qLabel(q) + (q.lineage ? ' · ' + q.lineage : '')]));
const hiveOptions = (none = '— Aucune —') => [['', none]].concat(db.hives.slice().sort((a, b) => nat(a.code, b.code)).map(h => [h.id, hn(h)]));

function showQr(text, label) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  openSheet('<h3>' + esc(label) + '</h3><div style="text-align:center"><div class="qr">' + qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) + '</div><p class="hint">' + esc(text) + '</p></div><div class="btns"><button data-close>Fermer</button><button class="primary" data-act="printOne" data-text="' + esc(text) + '" data-label="' + esc(label) + '">Imprimer</button></div>');
}
const LAYOUTS = { 20: [4, 5], 15: [3, 5], 12: [3, 4], 10: [2, 5], 8: [2, 4], 6: [2, 3], 4: [2, 2], 2: [1, 2], 1: [1, 1] };
function labelsHtml(items, per, preview) {
  const lay = LAYOUTS[per] || LAYOUTS[20], n = lay[0] * lay[1], pages = [];
  for (let i = 0; i < items.length; i += n) pages.push(items.slice(i, i + n));
  return pages.map(pg => '<div class="labels" style="--cols:' + lay[0] + ';--rows:' + lay[1] + '"' + (preview ? ' data-prev="1"' : '') + '>' + pg.map(it => {
    const qr = qrcode(0, 'M'); qr.addData(it.text); qr.make();
    return '<div class="label"><div class="qrw">' + qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true }) + '</div><div class="lt">' + esc(it.label) + '</div></div>';
  }).join('') + '</div>').join('');
}
function labelPer() { try { return parseInt(localStorage.getItem('ojurapi.labelPer'), 10) || 20; } catch (e) { return 20; } }
function printItems(items, per) {
  const p = $('#printSheet'); p.innerHTML = labelsHtml(items, per || labelPer()); p.hidden = false;
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
  return '<a class="item" href="#/ruche/' + h.id + '"><div class="grow"><div class="t">' + esc(hn(h)) + ' ' + (h.flag ? '<span class="badge warn">⚑ à voir</span>' : '') + statusBadge(h) + '</div><div class="s">' +
    (a ? apDot(a) + esc(a.name) : 'Sans rucher') + (q ? ' · ' + (c ? '<span class="dot" style="background:' + c[1] + '"></span> ' : '') + 'reine ' + esc(qLabel(q)) : '') +
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
const ui = { q: '', ap: '', st: '', homeEdit: false };
const VIEWS = {};
const MODE_ICONS = { open: ['scan', '#a86f00'], visit: ['visit', '#2f7d4f'], queen: ['queen', '#8e44ad'], harvest: ['harvest', '#d99a1c'], move: ['move', '#2f5bea'], winter: ['winter', '#1b8fb3'], feed: ['feed', '#0e9f6e'], treat: ['treat', '#be185d'], loss: ['loss', '#b42318'], todo: ['todo', '#e5702a'] };

/* ================= couleurs de ruchers, icônes et tuiles ================= */
const ACOLORS = [['', 'Aucune'], ['red', 'Rouge'], ['green', 'Vert'], ['yellow', 'Jaune'], ['blue', 'Bleu']];
const ACOL = { red: '#d93025', green: '#1e9e46', yellow: '#f2c200', blue: '#2f5bea' };
const apDot = a => (a && a.color ? '<span class="dot" style="background:' + ACOL[a.color] + '"></span> ' : '');
const apBand = a => (a && a.color ? '<div class="band" style="background:' + ACOL[a.color] + ';color:' + (a.color === 'yellow' ? '#2b1d00' : '#fff') + '">' + esc(a.name) + '</div>' : '');
const ICONS = {
  scan: '<path d="M6 24H42"/><path d="M9 11V37M15 11V37M22 11V37M28 11V37M34 11V37M39 11V37" opacity=".55"/>',
  visit: '<rect x="11" y="8" width="26" height="33" rx="4"/><rect x="18" y="4" width="12" height="7" rx="2"/><path d="M17 20H31M17 27H31M17 34H25"/>',
  harvest: '<path d="M24 6C24 6 11 20 11 29a13 13 0 0 0 26 0C37 20 24 6 24 6Z"/><path d="M18 30a6 6 0 0 0 6 6" opacity=".6"/>',
  queen: '<path d="M8 35L11 16L19 25L24 12L29 25L37 16L40 35Z"/><path d="M8 41H40"/>',
  move: '<path d="M24 43C24 43 12 30 12 20a12 12 0 0 1 24 0C36 30 24 43 24 43Z"/><circle cx="24" cy="20" r="4.5"/>',
  winter: '<path d="M24 5V43M7.5 14.5L40.5 33.5M7.5 33.5L40.5 14.5"/><path d="M19 8L24 12L29 8M19 40L24 36L29 40" opacity=".7"/>',
  loss: '<circle cx="24" cy="24" r="17"/><path d="M16 16L32 32M32 16L16 32"/>',
  feed: '<path d="M17 7H31M19 7V15L12 23V39a4 4 0 0 0 4 4H32a4 4 0 0 0 4-4V23L29 15V7"/><path d="M12 30H36"/><path d="M20 37H28"/>',
  todo: '<path d="M13 43V7"/><path d="M13 9H38L32 18L38 27H13"/>',
  hives: '<path d="M24 5L40 14V34L24 43L8 34V14Z"/><path d="M8 14L24 23L40 14M24 23V43" opacity=".6"/>',
  ruchers: '<path d="M5 13L17 8L31 13L43 8V35L31 40L17 35L5 40Z"/><path d="M17 8V35M31 13V40" opacity=".6"/>',
  tasks: '<path d="M8 13L12 17L19 9M8 29L12 33L19 25"/><path d="M26 14H40M26 30H40"/>',
  supers: '<rect x="8" y="8" width="32" height="13" rx="3"/><rect x="8" y="27" width="32" height="13" rx="3"/><path d="M16 14H32M16 33H32" opacity=".6"/>',
  settings: '<circle cx="24" cy="24" r="7"/><path d="M24 5V11M24 37V43M5 24H11M37 24H43M10.6 10.6L14.8 14.8M33.2 33.2L37.4 37.4M10.6 37.4L14.8 33.2M33.2 14.8L37.4 10.6"/>',
  labels: '<rect x="7" y="7" width="13" height="13" rx="2"/><rect x="28" y="7" width="13" height="13" rx="2"/><rect x="7" y="28" width="13" height="13" rx="2"/><path d="M28 28H33V33H28ZM36 36H41V41H36ZM36 28H41M28 36V41"/>'
};
ICONS.treat = '<path d="M32 6L42 16M37 11L20 28V34H26L43 17"/><path d="M20 34L12 42"/><path d="M10 18C10 18 5.5 23.5 5.5 27a4.5 4.5 0 0 0 9 0C14.5 23.5 10 18 10 18Z"/>';
ICONS.plus = '<circle cx="24" cy="24" r="17"/><path d="M24 15V33M15 24H33"/>';
ICONS.split = '<path d="M24 42V26M24 26L12 14M24 26L36 14"/><circle cx="12" cy="10" r="4"/><circle cx="36" cy="10" r="4"/>';
ICONS.other = '<circle cx="11" cy="24" r="2.5"/><circle cx="24" cy="24" r="2.5"/><circle cx="37" cy="24" r="2.5"/>';
const LOGICON = { 'Visite': ['visit', '#2f7d4f'], 'Ajout': ['plus', '#a86f00'], 'Changement de reine': ['queen', '#8e44ad'], 'Reine': ['queen', '#8e44ad'], 'Perte': ['loss', '#b42318'], 'Nourrissement': ['feed', '#0e9f6e'], 'Traitement': ['treat', '#be185d'], 'Pose de hausse': ['supers', '#0f766e'], 'Division / essaim': ['split', '#2f5bea'], 'Récolte': ['harvest', '#d99a1c'], 'Transhumance': ['move', '#2f5bea'], 'Hivernage': ['winter', '#1b8fb3'], 'Autre': ['other', '#57534e'] };
const logIcon = t => { const d = LOGICON[t] || LOGICON.Autre; return '<span class="ico" style="--c:' + d[1] + '"><svg viewBox="0 0 48 48" aria-hidden="true">' + ICONS[d[0]] + '</svg></span>'; };
const TILE_DEFS = [
  { k: 'open', kind: 'scan', icon: 'scan', label: 'Scanner', color: '#a86f00', target: 'open' },
  { k: 'visit', kind: 'scan', icon: 'visit', label: 'Visite', color: '#2f7d4f', target: 'visit' },
  { k: 'harvest', kind: 'scan', icon: 'harvest', label: 'Récolte', color: '#d99a1c', target: 'harvest' },
  { k: 'queen', kind: 'scan', icon: 'queen', label: 'Reine', color: '#8e44ad', target: 'queen' },
  { k: 'move', kind: 'scan', icon: 'move', label: 'Transhumer', color: '#2f5bea', target: 'move' },
  { k: 'winter', kind: 'scan', icon: 'winter', label: 'Hivernage', color: '#1b8fb3', target: 'winter' },
  { k: 'feed', kind: 'scan', icon: 'feed', label: 'Nourrissement', color: '#0e9f6e', target: 'feed' },
  { k: 'treat', kind: 'scan', icon: 'treat', label: 'Traitement', color: '#be185d', target: 'treat' },
  { k: 'loss', kind: 'scan', icon: 'loss', label: 'Perte', color: '#b42318', target: 'loss' },
  { k: 'todo', kind: 'scan', icon: 'todo', label: 'À faire', color: '#e5702a', target: 'todo' },
  { k: 'hives', kind: 'nav', icon: 'hives', label: 'Ruches', color: '#a86f00', target: '#/ruches', badge: 'flag' },
  { k: 'ruchers', kind: 'nav', icon: 'ruchers', label: 'Ruchers', color: '#3f8a4f', target: '#/ruchers' },
  { k: 'tasks', kind: 'nav', icon: 'tasks', label: 'Tâches', color: '#5b6b7a', target: '#/taches', badge: 'tasks' },
  { k: 'labels', kind: 'nav', icon: 'labels', label: 'Étiquettes', color: '#c2410c', target: '#/etiquettes' },
  { k: 'supers', kind: 'nav', icon: 'supers', label: 'Hausses', color: '#0f766e', target: '#/hausses' },
  { k: 'settings', kind: 'nav', icon: 'settings', label: 'Réglages', color: '#57534e', target: '#/plus' },
  { k: 'queens', kind: 'nav', icon: 'queen', label: 'Reines & lignées', color: '#7c3aed', target: '#/reines' }
];
const DEFAULT_HIDDEN = ['queens'];
function homeKeys() {
  const all = TILE_DEFS.map(t => t.k), ord = (Array.isArray(db.homeOrder) ? db.homeOrder : []).filter((k, i, a) => all.includes(k) && a.indexOf(k) === i);
  all.forEach(k => { if (!ord.includes(k)) ord.push(k); });
  return ord;
}
const homeHidden = () => (Array.isArray(db.homeHidden) ? db.homeHidden : DEFAULT_HIDDEN);
function tileInner(icon, label, badge) {
  return '<span class="ti"><svg viewBox="0 0 48 48" aria-hidden="true">' + ICONS[icon] + '</svg>' + (badge ? '<b class="bdg">' + badge + '</b>' : '') + '</span><span>' + esc(label) + '</span>';
}
function tile(kind, key, label, color, target, badge) {
  const inner = tileInner(key, label, badge);
  return kind === 'scan'
    ? '<button type="button" class="tile" style="--c:' + color + '" data-act="goScan" data-m="' + target + '">' + inner + '</button>'
    : '<a class="tile" style="--c:' + color + '" href="' + target + '">' + inner + '</a>';
}
function tilesHtml(flaggedCount, openTasks, editing) {
  const hidden = homeHidden();
  const keys = homeKeys().filter(k => editing || !hidden.includes(k));
  return '<div class="tiles' + (editing ? ' editing' : '') + '">' + keys.map(k => {
    const t = TILE_DEFS.find(x => x.k === k), off = hidden.includes(k);
    if (editing) return '<div class="tile edit' + (off ? ' off' : '') + '" data-key="' + k + '" style="--c:' + t.color + '"><span class="grip" title="Glisser pour déplacer">⠿</span><button type="button" class="tbtn" data-act="toggleTile" data-k="' + k + '" aria-label="' + (off ? 'Afficher' : 'Masquer') + '">' + (off ? '＋' : '✕') + '</button>' + tileInner(t.icon, t.label, 0) + '</div>';
    return tile(t.kind, t.icon, t.label, t.color, t.target, t.badge === 'flag' ? flaggedCount : t.badge === 'tasks' ? openTasks : 0);
  }).join('') + '</div>';
}

VIEWS.accueil = () => {
  const live = db.hives.filter(h => h.status !== 'morte' && h.status !== 'vendue');
  const flagged = live.filter(h => h.flag).sort((a, b) => nat(a.code, b.code));
  const tasks = db.tasks.filter(t => !t.done).sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1).slice(0, 5);
  const logs = db.logs.slice().sort((a, b) => b.ts - a.ts).slice(0, 6);
  if (ui.homeEdit) return { title: 'Personnaliser', html: '<p class="hint">Faites glisser la poignée ⠿ d’une tuile pour la déplacer. ✕ masque une tuile, ＋ la remet.</p>' + tilesHtml(0, 0, true) + '<div class="actions"><button class="primary" data-act="homeEditDone">✓ Terminé</button><button data-act="homeReset">Rétablir l’ordre d’origine</button></div>', actions: '<button data-act="homeEditDone">✓ Terminé</button>' };
  let html = '';
  if (!db.apiaries.length && !db.hives.length) {
    html += '<div class="card"><b>Bienvenue 🐝</b><ol><li>Créez un <a href="#/ruchers">rucher</a></li><li>Ajoutez vos <a href="#/ruches">ruches</a> (plusieurs d’un coup possible)</li><li>Imprimez les <a href="#/etiquettes">étiquettes QR</a> et collez-les</li><li>Scannez-les au rucher pour tout enregistrer</li></ol><p class="hint">Tout reste enregistré sur ce téléphone, rien n’est envoyé sur internet.</p></div>';
  }
  html += tilesHtml(flagged.length, db.tasks.filter(t => !t.done).length);
  html += '<h2>Ruches à surveiller</h2>' + (flagged.length ? flagged.map(hiveItem).join('') : '<div class="hint">Aucune ruche signalée. Activez ⚑ sur la fiche d’une ruche pour la retrouver ici.</div>');
  html += '<h2>Tâches à venir</h2>' + (tasks.length ? tasks.map(taskItem).join('') : '<div class="hint">Rien de prévu.</div>');
  if (logs.length) html += '<h2>Dernières interventions</h2>' + logs.map(l => { const h = H(l.hiveId); return '<div class="log edl' + (isTodo(l) ? ' todo' : '') + '" data-act="editLog" data-id="' + l.id + '"><b>' + (h ? 'Ruche ' + esc(h.code) : '—') + '</b> · ' + esc(l.type) + (l.note ? ' — ' + esc(l.note) : '') + ' <small>(' + fmtTime(l.ts) + ')</small>' + logDetail(l) + '</div>'; }).join('');
  return { title: "O Jur'Api", html, actions: '<button data-act="homeEdit">✎ Personnaliser</button>' };
};

VIEWS.ruchers = () => {
  const list = db.apiaries.slice().sort((a, b) => nat(a.name, b.name));
  let html = list.length ? mapSvg(list) : '';
  html += list.length ? '<h2>Mes ruchers</h2>' + list.map(a => {
    const n = db.hives.filter(h => h.apiaryId === a.id && h.status !== 'morte' && h.status !== 'vendue').length;
    return '<a class="item" href="#/rucher/' + a.id + '"><div class="grow"><div class="t">' + apDot(a) + esc(a.name) + '</div><div class="s">' + n + ' ruche' + (n > 1 ? 's' : '') + (a.lat != null ? ' · position enregistrée' : '') + '</div></div><span class="chev">›</span></a>';
  }).join('') : empty('Aucun rucher', 'Touchez « + Rucher » pour créer le premier.');
  return { title: 'Ruchers', html, actions: '<button data-act="addApiary">+ Rucher</button>' };
};

VIEWS.rucher = id => {
  const a = A(id);
  if (!a) return { title: 'Rucher', back: '#/ruchers', html: empty('Rucher introuvable') };
  const hives = db.hives.filter(h => h.apiaryId === a.id).sort((x, y) => nat(x.code, y.code));
  const tasks = db.tasks.filter(t => t.apiaryId === a.id).sort((x, y) => (x.done - y.done));
  let html = apBand(a) + '<div class="card">' + (a.notes ? '<div>' + esc(a.notes).replace(/\n/g, '<br>') + '</div>' : '<div class="hint">Pas de notes.</div>');
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
  if (h.flag && h.todo) html += '<div style="margin-top:8px"><span class="badge warn">À faire</span> ' + esc(h.todo).replace(/\n/g, '<br>') + '</div>';
  html += '</div><div class="actions"><button class="primary small" data-act="addLog" data-id="' + h.id + '">+ Intervention</button><button class="small" data-act="toggleFlag" data-id="' + h.id + '">' + (h.flag ? '⚐ Retirer le signal' : '⚑ À surveiller') + '</button><button class="small" data-act="moveHive" data-id="' + h.id + '">Déplacer</button><button class="small" data-act="hiveQr" data-id="' + h.id + '">QR</button><button class="small" data-act="editHive" data-id="' + h.id + '">Modifier</button><button class="small danger" data-act="delHive" data-id="' + h.id + '">Supprimer</button></div>';
  html += '<h2>Hausses (' + supers.length + ')</h2>' + (supers.length ? supers.map(s => '<div class="item"><div class="grow"><div class="t">Hausse ' + esc(s.code) + '</div><div class="s">' + (s.since ? 'depuis le ' + fmtDate(s.since) : '') + '</div></div><button class="small" data-act="unlinkSuper" data-id="' + s.id + '">Retirer</button></div>').join('') : '<div class="hint">Aucune hausse.</div>');
  html += '<div class="actions"><button class="small" data-act="addSuperTo" data-id="' + h.id + '">+ Ajouter une hausse</button></div>';
  html += '<h2>Journal</h2>' + (logs.length ? '<div class="tl">' + logs.map(l => '<div class="e edl' + (isTodo(l) ? ' todo' : '') + '" data-act="editLog" data-id="' + l.id + '"><b>' + esc(l.type) + '</b> <small>' + fmtTime(l.ts) + '</small>' + logDetail(l) + (l.note ? '<div>' + esc(l.note).replace(/\n/g, '<br>') + '</div>' : '') + '</div>').join('') + '</div>' : '<div class="hint">Aucune intervention enregistrée.</div>');
  if (logs.length) html += '<p class="hint">Touchez une ligne pour modifier sa date, son heure ou sa note.</p>';
  return { title: hn(h), back: '#/ruches', html };
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
  const html = '<div class="card"><label>Type</label><select id="lt"><option value="H">Ruches</option><option value="S">Hausses</option></select><div class="grid"><div><label>Du numéro</label><input id="l1" type="number" min="1" value="1" inputmode="numeric"></div><div><label>Au numéro</label><input id="l2" type="number" min="1" value="12" inputmode="numeric"></div></div><label>Étiquettes par feuille A4 (moins = plus grosses)</label><select id="lper">'+[20,15,12,10,8,6,4,2,1].map(n=>'<option value="'+n+'"'+(labelPer()===n?' selected':'')+'>'+n+(n===20?' (petites)':n===1?' (plein page)':'')+'</option>').join('')+'</select><div class="actions"><button class="primary" data-act="makeLabels">Générer</button></div><p class="hint">Imprimez (ou « Enregistrer en PDF »), plastifiez, collez sur la ruche ou la hausse. Maximum 200 étiquettes à la fois.</p></div><div id="lprev"></div>';
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
const scan = { wact: 'in', manualOff: false, mode: 'open', target: '', hive: '', pending: [], batch: [], last: '', lastT: 0, log: [], stream: null, timer: null, canvas: null };
const MODES = [['open', 'Fiche'], ['visit', 'Visite'], ['queen', 'Reine'], ['harvest', 'Récolte'], ['move', 'Transhumance'], ['winter', 'Hivernage'], ['feed', 'Nourrir'], ['treat', 'Traitement'], ['loss', 'Perte'], ['todo', 'À faire']];
const MODE_HELP = {
  open: 'Scannez le QR d’une ruche pour ouvrir sa fiche.',
  queen: 'Choisissez (ou scannez) une reine, puis scannez les ruches qui la contiennent.',
  harvest: 'Scannez la ruche, puis chaque hausse récoltée : elles sont reliées à cette ruche.',
  move: 'Scannez toutes les ruches à déplacer, appuyez sur « Valider », puis choisissez le rucher de destination.',
  feed: 'Scannez toutes les ruches nourries, appuyez sur « Valider », puis choisissez le(s) nourrissement(s).',
  treat: 'Scannez toutes les ruches traitées, appuyez sur « Valider », puis choisissez le(s) traitement(s) (ou créez-en un).',
  winter: 'Choisissez « Hivernage » (avec le rucher d’hivernage) ou « Sortie d’hivernage » (rucher d’arrivée facultatif), puis scannez chaque ruche.',
  visit: 'Scannez une ruche : le formulaire d’intervention s’ouvre (reine OK/KO, pontes OK/KO, ajouts de cadres).',
  loss: 'Scannez chaque ruche perdue. Une ruche en hivernage est notée « morte en hivernage ».',
  todo: 'Scannez une ruche pour y noter une opération à faire (elle ressortira dans « À surveiller »).'
};
VIEWS.scan = () => {
  let ctx = '';
  if (scan.mode === 'queen') ctx = '<label>Reine</label><select id="scanTarget">' + queenOptions('— Choisir —').map(o => '<option value="' + esc(o[0]) + '"' + (scan.target === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  if (scan.mode === 'winter') ctx = '<label>Action</label><select id="scanAct"><option value="in"' + (scan.wact === 'in' ? ' selected' : '') + '>Hivernage</option><option value="out"' + (scan.wact === 'out' ? ' selected' : '') + '>Sortie d’hivernage</option></select><label>' + (scan.wact === 'out' ? 'Rucher d’arrivée (facultatif)' : 'Rucher d’hivernage') + '</label><select id="scanTarget">' + apiaryOptions(scan.wact === 'out' ? '— Inchangé —' : '— Choisir —').map(o => '<option value="' + esc(o[0]) + '"' + (scan.target === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  const modeName = (MODES.find(m => m[0] === scan.mode) || ['', ''])[1];
  const tilesH = '<h2>Choisir l’action</h2><div class="tiles tiles3">' + MODES.map(m => '<button class="tile ' + (scan.mode === m[0] ? 'on' : '') + '" data-act="scanMode" data-m="' + m[0] + '" style="--c:' + MODE_ICONS[m[0]][1] + '"><span class="ti"><svg viewBox="0 0 48 48" aria-hidden="true">' + ICONS[MODE_ICONS[m[0]][0]] + '</svg></span>' + m[1] + '</button>').join('') + '</div>';
  const html = '<div class="modebar"><b>' + esc(modeName) + '</b></div><p class="hint">' + MODE_HELP[scan.mode] + '</p>' + ctx +
    '<div id="scanCtx" class="hint"></div><div class="video" style="margin-top:10px"><video id="cam" playsinline muted></video><div class="aim"></div></div><div class="actions"><button class="primary" id="camBtn" data-act="camToggle">Activer la caméra</button></div>' +
    '<label>Ou saisissez le numéro (12 = ruche, S12 = hausse, Q3 = reine)</label><div class="row"><input id="manual" inputmode="text" placeholder="12" autocomplete="off"><button data-act="manualGo">OK</button></div>' + tilesH + '<h2>Historique</h2><div id="scanLog"></div>';
  return {
    title: 'Scanner', html,
    after() {
      const t = $('#scanTarget'); if (t) t.onchange = e => { scan.target = e.target.value; };
      const wa = $('#scanAct'); if (wa) wa.onchange = e => { scan.wact = e.target.value; scan.target = ''; render(true); };
      if (!scan.manualOff) setTimeout(() => { if (!scan.stream && (location.hash || '').startsWith('#/scan')) startCam(); }, 150);
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
    if (scan.mode === 'harvest') { const h = H(scan.hive); c.innerHTML = 'Ruche courante : <b>' + (h ? h.code : '—') + '</b>' + (scan.pending.length ? ' · ' + scan.pending.length + ' hausse(s) en attente' : '') + ' <button class="small" data-act="scanReset">Réinitialiser</button>'; } else if (scan.mode === 'move' || scan.mode === 'feed' || scan.mode === 'treat') c.innerHTML = batchHtml(); else c.innerHTML = '';
  }
}
function batchHtml() {
  const hs = scan.batch.map(H).filter(Boolean);
  if (!hs.length) return '<div class="hint">Aucune ruche scannée pour l’instant.</div>';
  return '<div class="batch"><b>' + hs.length + ' ruche' + (hs.length > 1 ? 's' : '') + ' :</b><div class="chips">' + hs.map(h => '<span class="chip">' + esc(h.code) + '<button type="button" data-act="batchDel" data-id="' + h.id + '" aria-label="Retirer">✕</button></span>').join('') + '</div>' +
    '<div class="actions"><button class="primary" data-act="batchOk">Valider (' + hs.length + ')</button><button data-act="batchClear">Vider</button></div></div>';
}
function batchHives() { scan.batch = scan.batch.filter(id => H(id)); return scan.batch.map(H); }
function moveBatchForm() {
  const hs = batchHives(); if (!hs.length) { toast('Scannez d’abord des ruches'); return; }
  form({
    title: 'Déplacer ' + hs.length + ' ruche' + (hs.length > 1 ? 's' : ''), submit: 'Déplacer',
    fields: [{ type: 'html', html: '<div class="hint">Ruches : ' + hs.map(h => esc(h.code)).join(', ') + '</div>' }, whenField(), { name: 'apiaryId', label: 'Vers quel emplacement (rucher) ?', type: 'select', options: apiaryOptions('— Choisir —'), value: '' }],
    onSubmit(v) {
      const a = A(v.apiaryId); if (!a) { toast('Choisissez le rucher de destination'); return false; }
      hs.forEach(h => { h.apiaryId = a.id; if (h.status === 'hivernage') h.status = 'active'; addLog(h.id, 'Transhumance', 'Déplacée vers ' + a.name, null, fromLocalInput(v.when)); });
      scan.batch = []; scanLog(hs.length + ' ruche' + (hs.length > 1 ? 's' : '') + ' → ' + a.name); save(); paintScan();
    }
  });
}
const PRODS = {
  feed: { list: 'feeds', type: 'Nourrissement', pre: 'feed_', nw: 'newfeed', noun: 'nourrissement', given: 'Nourrissement(s) donné(s)', ph: 'ex. Sirop 1:1, Nourrisseur Boardman', key: 'feeds', delAct: 'feedDel', newAct: 'feedNew', done: 'nourrie' },
  treat: { list: 'treatments', type: 'Traitement', pre: 'trt_', nw: 'newtrt', noun: 'traitement', given: 'Traitement(s) appliqué(s)', ph: 'ex. Acide formique, Apivar', key: 'treatments', delAct: 'trtDel', newAct: 'trtNew', done: 'traitée' }
};
function prodNames(k, el, create) {
  const c = PRODS[k]; db[c.list] = db[c.list] || [];
  const names = db[c.list].filter(f => el[c.pre + f.id] && el[c.pre + f.id].checked).map(f => f.name);
  const nn = el[c.nw] ? el[c.nw].value.trim() : '';
  if (nn && create) {
    let ex = db[c.list].find(f => f.name.toLowerCase() === nn.toLowerCase());
    if (!ex) { ex = { id: uid(), name: nn }; db[c.list].push(ex); }
    if (!names.includes(ex.name)) names.push(ex.name);
  }
  return names;
}
function prodBatchForm(k, st) {
  const c = PRODS[k], hs = batchHives(); if (!hs.length) { toast('Scannez d’abord des ruches'); return; }
  st = st || {}; db[c.list] = db[c.list] || []; const chk = st.checked || [];
  const list = db[c.list].length ? db[c.list].map(f => '<div class="feedrow"><label class="chk"><input type="checkbox" name="' + c.pre + f.id + '"' + (chk.includes(f.id) ? ' checked' : '') + '> ' + esc(f.name) + '</label><button type="button" class="small danger" data-act="' + c.delAct + '" data-id="' + f.id + '" aria-label="Supprimer de la liste">🗑</button></div>').join('') : '<div class="hint">Aucun ' + c.noun + ' : créez-en un ci-dessous.</div>';
  form({
    title: c.type + ' · ' + hs.length + ' ruche' + (hs.length > 1 ? 's' : ''), submit: 'Enregistrer',
    fields: [{ type: 'html', html: '<div class="hint">Ruches : ' + hs.map(h => esc(h.code)).join(', ') + '</div><label>' + c.given + '</label><div class="feedlist">' + list + '</div><label>Créer un nouveau ' + c.noun + '</label><div class="row"><input name="' + c.nw + '" placeholder="' + esc(c.ph) + '" autocomplete="off"><button type="button" data-act="' + c.newAct + '">＋ Créer</button></div>' },
      whenField(st.when ? fromLocalInput(st.when) : 0),
      { name: 'qty', label: 'Quantité par ruche (facultatif, ex. 2 L, 500 g)', value: st.qty || '' }, { name: 'note', label: 'Note', type: 'textarea', value: st.note || '' }],
    onSubmit(v) {
      const names = prodNames(k, $('#f').elements, false);
      if (!names.length) { toast('Choisissez au moins un ' + c.noun); return false; }
      const ts = fromLocalInput(v.when);
      hs.forEach(h => addLog(h.id, c.type, names.join(' + ') + (v.qty ? ' — ' + v.qty : '') + (v.note ? '\n' + v.note : ''), { [c.key]: names, qty: v.qty }, ts));
      scan.batch = []; scanLog(hs.length + ' ruche' + (hs.length > 1 ? 's' : '') + ' ' + c.done + (hs.length > 1 ? 's' : '') + ' : ' + names.join(' + ')); save(); paintScan();
    }
  });
  const nf = $('#f').elements[c.nw]; if (nf) nf.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ACT[c.newAct](); } };
}
function prodState(k) {
  const c = PRODS[k], el = $('#f').elements; return { checked: (db[c.list] || []).filter(f => el[c.pre + f.id] && el[c.pre + f.id].checked).map(f => f.id), qty: el.qty.value, note: el.note.value, when: el.when.value };
}
function prodNew(k) {
  const c = PRODS[k], st = prodState(k), name = $('#f').elements[c.nw].value.trim();
  if (!name) { toast('Écrivez le nom du ' + c.noun); return; }
  db[c.list] = db[c.list] || [];
  if (db[c.list].some(f => f.name.toLowerCase() === name.toLowerCase())) { toast('Ce ' + c.noun + ' existe déjà'); return; }
  const f = { id: uid(), name }; db[c.list].push(f); st.checked.push(f.id); save(); prodBatchForm(k, st);
}
function prodDel(k, el) {
  const c = PRODS[k], st = prodState(k), f = (db[c.list] || []).find(x => x.id === el.dataset.id);
  if (!f || !confirm('Supprimer « ' + f.name + ' » de la liste ? (le journal est conservé)')) return;
  db[c.list] = db[c.list].filter(x => x.id !== f.id); st.checked = st.checked.filter(i => i !== f.id); save(); prodBatchForm(k, st);
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
    const needA = m === 'winter' && scan.wact === 'in';
    if (needA && !A(scan.target)) { scanLog('Choisissez d’abord le rucher', true); return; }
    if (m === 'queen' && !Q(scan.target)) { scanLog('Choisissez d’abord la reine', true); return; }
    let h = hiveByCode(p.code), created = false;
    if (!h) { h = newHive(p.code, { apiaryId: m === 'winter' ? scan.target : '' }); created = true; }
    const tag = created ? ' (nouvelle ruche)' : '';
    if (m === 'open') { save(); location.hash = '#/ruche/' + h.id; if (created) toast(hn(h) + ' créée'); return; }
    if (m === 'visit') { save(); location.hash = '#/ruche/' + h.id; setTimeout(() => logForm(h), 80); return; }
    if (m === 'todo') { save(); logTodo(h); return; }
    if (m === 'loss') { const wi = h.status === 'hivernage'; h.status = 'morte'; h.flag = false; h.todo = ''; addLog(h.id, wi ? 'Morte en hivernage' : 'Perte', ''); scanLog(hn(h) + (wi ? ' morte en hivernage' : ' perdue') + tag); }
    if (m === 'queen') { const q = Q(scan.target), prev = h.queenId && h.queenId !== q.id ? Q(h.queenId) : null; h.queenId = q.id; addLog(h.id, prev ? 'Changement de reine' : 'Reine', prev ? qLabel(prev) + ' → ' + qLabel(q) : 'Reine ' + qLabel(q) + ' associée'); scanLog(hn(h) + ' ← reine ' + qLabel(q) + tag); }
    if (m === 'harvest') { scan.hive = h.id; let n = 0; scan.pending.forEach(sid => { const s = S(sid); if (s && linkSuper(s, h)) n++; }); scan.pending = []; scanLog(hn(h) + ' sélectionnée' + (n ? ' · ' + n + ' hausse(s) liée(s)' : '') + tag); }
    if (m === 'move' || m === 'feed' || m === 'treat') { if (scan.batch.includes(h.id)) scanLog(hn(h) + ' déjà dans la liste', true); else { scan.batch.push(h.id); scanLog(hn(h) + ' ajoutée (' + scan.batch.length + ')' + tag); } }
    if (m === 'winter' && scan.wact === 'out') { const a = A(scan.target); if (a) h.apiaryId = a.id; h.status = 'active'; addLog(h.id, 'Sortie d’hivernage', a ? 'Sortie d’hivernage vers ' + a.name : 'Sortie d’hivernage'); scanLog(hn(h) + ' sortie d’hivernage' + (a ? ' → ' + a.name : '') + tag); }
    else if (m === 'winter') { const a = A(scan.target); h.apiaryId = a.id; h.status = 'hivernage'; addLog(h.id, 'Hivernage', 'Hivernage à ' + a.name); scanLog(hn(h) + ' hivernage à ' + a.name + tag); }
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
  if (scan.stream) return;
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
    fields: [{ name: 'name', label: 'Nom', value: a.name }, { name: 'color', label: 'Couleur du rucher', type: 'select', options: ACOLORS, value: a.color || '' }, { name: 'lat', label: 'Latitude', value: a.lat == null ? '' : a.lat, inputmode: 'decimal' }, { name: 'lng', label: 'Longitude', value: a.lng == null ? '' : a.lng, inputmode: 'decimal' }, { name: 'notes', label: 'Notes (accès, floraison…)', type: 'textarea', value: a.notes }],
    extra: '<div class="actions"><button type="button" class="small" data-act="pickMap">🗺 Choisir sur la carte</button><button type="button" class="small" data-act="geoFill">📍 Ma position</button></div>',
    onSubmit(v) {
      if (!v.name) { toast('Donnez un nom au rucher'); return false; }
      if (isNew) { a = { id: uid() }; db.apiaries.push(a); }
      Object.assign(a, { name: v.name, color: v.color, lat: num(v.lat), lng: num(v.lng), notes: v.notes });
      save(); render(true); if (isNew) toast('Rucher créé');
    }
  });
}
function hiveForm(apiaryId) {
  if (!db.apiaries.length) { toast('Créez d’abord un rucher'); location.hash = '#/ruchers'; return; }
  form({
    title: 'Nouvelle(s) ruche(s) / ruchette(s) / nuc(s)',
    fields: [{ name: 'code', label: 'Numéro (de la première)', value: nextCode(db.hives), inputmode: 'numeric' }, { name: 'count', label: 'Combien en créer ?', type: 'number', value: 1, min: 1, max: 100, inputmode: 'numeric' }, { name: 'kind', label: 'Type', type: 'select', options: KINDS, value: 'ruche' }, { name: 'apiaryId', label: 'Rucher', type: 'select', options: apiaryOptions(), value: apiaryId || '' }, { name: 'note', label: 'Note', type: 'textarea' }],
    onSubmit(v) {
      const n = Math.max(1, Math.min(100, parseInt(v.count, 10) || 1)), start = parseInt(v.code, 10);
      if (!v.code) { toast('Indiquez un numéro'); return false; }
      if (n > 1 && !Number.isFinite(start)) { toast('Numéro numérique requis pour en créer plusieurs'); return false; }
      const codes = n > 1 ? Array.from({ length: n }, (_, i) => String(start + i)) : [v.code];
      const dup = codes.find(c => hiveByCode(c)); if (dup) { toast('La ruche ' + dup + ' existe déjà'); return false; }
      codes.forEach(c => newHive(c, { apiaryId: v.apiaryId, note: v.note, kind: v.kind }));
      save(); render(true); toast(n + ' ' + (KINDS.find(k => k[0] === v.kind) || KINDS[0])[1].toLowerCase() + (n > 1 ? 's' : '') + ' créé' + (v.kind === 'nuc' ? '' : 'e') + (n > 1 ? 's' : ''));
    }
  });
}
function editHiveForm(h) {
  form({
    title: hn(h),
    fields: [{ name: 'code', label: 'Numéro', value: h.code }, { name: 'kind', label: 'Type', type: 'select', options: KINDS, value: h.kind || 'ruche' }, { name: 'apiaryId', label: 'Rucher', type: 'select', options: apiaryOptions(), value: h.apiaryId }, { name: 'status', label: 'État', type: 'select', options: STATUS, value: h.status }, { name: 'queenId', label: 'Reine', type: 'select', options: queenOptions(), value: h.queenId }, { name: 'flag', label: '⚑ À surveiller', type: 'checkbox', value: h.flag }, { name: 'note', label: 'Note', type: 'textarea', value: h.note }],
    onSubmit(v) {
      if (!v.code) { toast('Numéro requis'); return false; }
      const o = hiveByCode(v.code); if (o && o.id !== h.id) { toast('Ce numéro existe déjà'); return false; }
      Object.assign(h, { code: v.code, kind: v.kind, apiaryId: v.apiaryId, status: v.status, queenId: v.queenId, flag: v.flag, note: v.note });
      save(); render(true);
    }
  });
}
function applyQueenChoice(h, el, v) {
  const code = el.qnew_code.value.trim();
  let q = null;
  if (code) { if (queenByCode(code)) { toast('La reine « ' + code + ' » existe déjà : choisissez-la dans la liste'); return false; } }
  else if (el.qpick.value) q = Q(el.qpick.value);
  if (!code && !q) { toast('Choisissez une reine ou créez-en une'); return false; }
  if (q) {
    if (q.id === h.queenId) { toast('Cette reine est déjà dans la ruche'); return false; }
    const other = db.hives.find(x => x.queenId === q.id && x.id !== h.id);
    if (other) { toast('La reine ' + q.code + ' est déjà dans la ruche ' + other.code); return false; }
  }
  const created = !q;
  if (created) { q = { id: uid(), code, year: parseInt(el.qnew_year.value, 10) || '', lineage: el.qnew_lineage.value.trim(), motherId: el.qnew_mother.value, note: '' }; db.queens.push(q); }
  const prev = Q(h.queenId);
  h.queenId = q.id;
  addLog(h.id, v.type, (prev ? qLabel(prev) + ' → ' : 'Reine ') + qLabel(q) + (created ? ' (nouvelle reine)' : '') + (v.note ? '\n' + v.note : ''), null, fromLocalInput(v.when));
  h.flag = v.flag; save(); render(true); toast(created ? 'Reine créée et placée dans la ruche' : 'Reine placée dans la ruche');
  return true;
}
function logForm(h) {
  const tri = (name, label) => '<div class="trirow"><span>' + label + '</span><div class="tri" data-tri="' + name + '"><button type="button" data-v="ok">✓ OK</button><button type="button" data-v="ko">✕ KO</button></div><input type="hidden" name="' + name + '" value=""></div>';
  const typeTiles = '<label>Type d’intervention</label><div class="typegrid">' + LOGTYPES.map((t, i) => '<button type="button" class="' + (i === 0 ? 'on' : '') + '" data-type="' + t + '">' + logIcon(t) + '' + t + '</button>').join('') + '</div>';
  const optsHtml = arr => arr.map(o => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>').join('');
  const curQ = Q(h.queenId);
  const qbox = '<div id="lg-reine" class="lgbox" hidden>' +
    '<div class="hint" style="margin:6px 0">' + (curQ ? 'Reine actuelle : <b>' + esc(qLabel(curQ)) + '</b>' : 'Aucune reine dans cette ruche') + '</div>' +
    '<label>Reine existante</label><select name="qpick">' + optsHtml(queenOptions('— Choisir —').filter(o => o[0] !== h.queenId)) + '</select>' +
    '<button type="button" class="block addq" data-qnew="1">＋ Créer une nouvelle reine</button>' +
    '<div id="qnew" hidden><div class="hint">La nouvelle reine sera créée (elle apparaît dans « Reines & lignées ») puis placée dans cette ruche.</div>' +
    '<label>Identifiant / nom</label><input name="qnew_code" autocomplete="off">' +
    '<label>Année de naissance</label><input name="qnew_year" inputmode="numeric" value="' + new Date().getFullYear() + '">' +
    '<label>Lignée / souche</label><input name="qnew_lineage" autocomplete="off">' +
    '<label>Mère</label><select name="qnew_mother">' + optsHtml(queenOptions('— Inconnue —')) + '</select></div></div>';
  const prodList = k => { const c = PRODS[k]; db[c.list] = db[c.list] || []; return '<label>' + c.given + '</label><div class="feedlist">' + db[c.list].map(f => '<label class="chk"><input type="checkbox" name="' + c.pre + f.id + '"> ' + esc(f.name) + '</label>').join('') + '</div><label>Créer un nouveau ' + c.noun + ' (facultatif, ajouté à la liste)</label><input name="' + c.nw + '" placeholder="' + esc(c.ph) + '" autocomplete="off">'; };
  const extra = '<div id="lg-feed" class="lgbox" hidden>' + prodList('feed') + '</div><div id="lg-treat" class="lgbox" hidden>' + prodList('treat') + '</div>' +
    '<div id="lg-pqty" class="lgbox" hidden><label>Quantité (facultatif, ex. 2 L, 500 g)</label><input name="pqty" autocomplete="off"></div>' +
    '<div id="lg-move" class="lgbox" hidden><label>Vers quel rucher ?</label><select name="mv_ap">' + optsHtml(apiaryOptions('— Choisir —')) + '</select></div>' +
    '<div id="lg-winter" class="lgbox" hidden><label>Action</label><select name="wi_act"><option value="in">Hivernage</option><option value="out">Sortie d’hivernage</option></select><label>Rucher (obligatoire pour l’hivernage, facultatif pour la sortie)</label><select name="wi_ap">' + optsHtml(apiaryOptions('— Choisir —')) + '</select></div>' +
    '<div id="lg-loss" class="lgbox hint" hidden>La ruche sera marquée morte (« morte en hivernage » si elle hivernait).</div>' +
    '<div id="lg-super" class="lgbox" hidden><label>Numéros de hausses (facultatif, ex. 12, 13)</label><input name="sup_codes" autocomplete="off"></div>';
  const html = qbox + extra + '<div id="lg-visite" class="lgbox">' + tri('reine', 'Reine') + tri('pontes', 'Pontes') + '</div>' +
    '<div id="lg-ajout" class="lgbox" hidden>' + AJOUTS.map(a => '<div class="step"><span>' + a[1] + '</span><button type="button" data-step="-1" data-for="' + a[0] + '">−</button><input name="aj_' + a[0] + '" type="number" min="0" max="99" value="0" inputmode="numeric"><button type="button" data-step="1" data-for="' + a[0] + '">+</button></div>').join('') + '</div>';
  form({
    title: 'Intervention · ruche ' + h.code,
    fields: [{ name: 'type', type: 'hidden', value: 'Visite' }, { type: 'html', html: typeTiles }, { type: 'html', html }, whenField(), { name: 'note', label: 'Notes (couvain, réserves, comportement…)', type: 'textarea' }, { name: 'flag', label: '⚑ Marquer à surveiller', type: 'checkbox', value: h.flag }],
    onSubmit(v) {
      const el = $('#f').elements, data = {};
      if (v.type === 'Changement de reine' || v.type === 'Reine') return applyQueenChoice(h, el, v);
      if (v.type === 'Visite') { if (el.reine.value) data.reine = el.reine.value; if (el.pontes.value) data.pontes = el.pontes.value; }
      if (v.type === 'Ajout') {
        const aj = {}; AJOUTS.forEach(a => { const n = parseInt(el['aj_' + a[0]].value, 10) || 0; if (n > 0) aj[a[0]] = Math.min(n, 99); });
        if (!Object.keys(aj).length && !v.note) { toast('Indiquez au moins un élément ajouté'); return false; }
        if (Object.keys(aj).length) data.ajout = aj;
      }
      const ts = fromLocalInput(v.when); let type = v.type, note = v.note;
      const nl = (txt) => txt + (v.note ? '\n' + v.note : '');
      if (type === 'Nourrissement' || type === 'Traitement') {
        const k = type === 'Traitement' ? 'treat' : 'feed', c = PRODS[k], names = prodNames(k, el, true);
        if (!names.length) { toast('Choisissez ou créez un ' + c.noun); return false; }
        data[c.key] = names; const q = el.pqty.value.trim(); if (q) data.qty = q;
        note = nl(names.join(' + ') + (q ? ' — ' + q : ''));
      }
      if (type === 'Transhumance') {
        const a = A(el.mv_ap.value); if (!a) { toast('Choisissez le rucher de destination'); return false; }
        h.apiaryId = a.id; if (h.status === 'hivernage') h.status = 'active'; note = nl('Déplacée vers ' + a.name);
      }
      if (type === 'Hivernage') {
        const out = el.wi_act.value === 'out', a = A(el.wi_ap.value);
        if (!out && !a) { toast('Choisissez le rucher d’hivernage'); return false; }
        if (a) h.apiaryId = a.id; h.status = out ? 'active' : 'hivernage'; type = out ? 'Sortie d’hivernage' : 'Hivernage';
        note = nl(type + (a ? (out ? ' vers ' : ' à ') + a.name : ''));
      }
      if (type === 'Perte') { const wi = h.status === 'hivernage'; h.status = 'morte'; h.todo = ''; v.flag = false; if (wi) type = 'Morte en hivernage'; }
      if (type === 'Pose de hausse' || type === 'Récolte') {
        const codes = el.sup_codes.value.split(/[\s,;]+/).filter(Boolean);
        if (codes.length) { codes.forEach(cd => { const sp = superByCode(cd) || newSuper(cd); sp.hiveId = h.id; sp.since = today(); }); data.supers = codes; note = nl('Hausse' + (codes.length > 1 ? 's' : '') + ' ' + codes.join(', ')); }
      }
      addLog(h.id, type, note, Object.keys(data).length ? data : null, ts); h.flag = v.flag; save(); render(true); toast('Intervention enregistrée');
    }
  });
  const f = $('#f');
  const PANELS = { 'Visite': ['lg-visite'], 'Ajout': ['lg-ajout'], 'Changement de reine': ['lg-reine'], 'Reine': ['lg-reine'], 'Nourrissement': ['lg-feed', 'lg-pqty'], 'Traitement': ['lg-treat', 'lg-pqty'], 'Transhumance': ['lg-move'], 'Hivernage': ['lg-winter'], 'Perte': ['lg-loss'], 'Pose de hausse': ['lg-super'], 'Récolte': ['lg-super'] };
  const sync = () => { const t = f.elements.type.value, on = PANELS[t] || []; ['lg-visite', 'lg-ajout', 'lg-reine', 'lg-feed', 'lg-treat', 'lg-pqty', 'lg-move', 'lg-winter', 'lg-loss', 'lg-super'].forEach(id => { $('#' + id).hidden = !on.includes(id); }); };
  sync();
  f.addEventListener('click', e => {
    const tt = e.target.closest('[data-type]');
    if (tt) { f.elements.type.value = tt.dataset.type; f.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b === tt)); sync(); return; }
    const tb = e.target.closest('.tri button');
    if (tb) {
      const g = tb.closest('.tri'), inp = f.elements[g.dataset.tri];
      inp.value = inp.value === tb.dataset.v ? '' : tb.dataset.v;
      g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === inp.value));
      return;
    }
    const nq = e.target.closest('[data-qnew]');
    if (nq) { const b = $('#qnew'); b.hidden = !b.hidden; nq.textContent = b.hidden ? '＋ Créer une nouvelle reine' : '− Annuler la nouvelle reine'; if (b.hidden) f.elements.qnew_code.value = ''; else f.elements.qnew_code.focus(); return; }
    const sb = e.target.closest('[data-step]');
    if (sb) { const i = f.elements['aj_' + sb.dataset.for]; i.value = Math.max(0, Math.min(99, (parseInt(i.value, 10) || 0) + parseInt(sb.dataset.step, 10))); }
  });
}
function editLogForm(id) {
  const l = db.logs.find(x => x.id === id); if (!l) return; const h = H(l.hiveId);
  form({
    title: l.type + (h ? ' · ' + hn(h) : ''),
    fields: [whenField(l.ts), { name: 'note', label: 'Note', type: 'textarea', value: l.note }],
    extra: '<div class="actions"><button type="button" class="small danger" data-act="delLog" data-id="' + l.id + '">Supprimer cette entrée</button></div>',
    onSubmit(v) { l.ts = fromLocalInput(v.when); l.note = v.note; save(); render(true); toast('Journal mis à jour'); }
  });
}
function logTodo(h) {
  form({
    title: 'Opération à faire · ruche ' + h.code,
    fields: [{ name: 'todo', label: 'Quoi faire ? (ex. à traiter, trop de varroas)', type: 'textarea', value: h.todo || '' }, whenField()],
    onSubmit(v) { if (!v.todo) { toast('Décrivez l’opération'); return false; } h.todo = v.todo; h.flag = true; addLog(h.id, 'Opération à faire', v.todo, null, fromLocalInput(v.when)); save(); render(true); toast('Opération notée'); }
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
  ruches: () => [['Numéro', 'Type', 'Rucher', 'État', 'À surveiller', 'Reine', 'Année reine', 'Lignée', 'Nb hausses', 'Note']].concat(db.hives.slice().sort((a, b) => nat(a.code, b.code)).map(h => { const a = A(h.apiaryId), q = Q(h.queenId); return [h.code, kindLabel(h), a ? a.name : '', (STATUS.find(s => s[0] === h.status) || [0, h.status])[1], h.flag ? 'oui' : '', q ? q.code : '', q ? q.year : '', q ? q.lineage : '', db.supers.filter(s => s.hiveId === h.id).length, h.note]; })),
  ruchers: () => [['Nom', 'Latitude', 'Longitude', 'Nb ruches', 'Notes']].concat(db.apiaries.map(a => [a.name, a.lat == null ? '' : a.lat, a.lng == null ? '' : a.lng, db.hives.filter(h => h.apiaryId === a.id).length, a.notes])),
  hausses: () => [['Numéro', 'Ruche', 'Depuis']].concat(db.supers.slice().sort((a, b) => nat(a.code, b.code)).map(s => { const h = H(s.hiveId); return [s.code, h ? h.code : '', s.since || '']; })),
  reines: () => [['Identifiant', 'Année', 'Couleur', 'Lignée', 'Mère', 'Ruche', 'Note']].concat(db.queens.map(q => { const c = qcolor(q.year), m = Q(q.motherId), h = db.hives.find(x => x.queenId === q.id); return [q.code, q.year, c ? c[0] : '', q.lineage, m ? m.code : '', h ? h.code : '', q.note]; })),
  journal: () => [['Date', 'Ruche', 'Rucher', 'Type', 'Reine', 'Pontes', 'Cadres gaufrés', 'Cadres construits', 'Cadres à mâles', 'Partitions', 'Note']].concat(db.logs.slice().sort((a, b) => a.ts - b.ts).map(l => { const h = H(l.hiveId), a = h && A(h.apiaryId), d = l.data || {}, aj = d.ajout || {}; return [new Date(l.ts).toLocaleString('fr-CH'), h ? h.code : '', a ? a.name : '', l.type, d.reine ? d.reine.toUpperCase() : '', d.pontes ? d.pontes.toUpperCase() : '', aj.gaufre || '', aj.construit || '', aj.males || '', aj.partition || '', l.note]; })),
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
  toggleFlag(el) { const h = H(el.dataset.id); h.flag = !h.flag; if (!h.flag) h.todo = ''; save(); render(true); },
  moveHive(el) {
    const h = H(el.dataset.id);
    form({ title: 'Déplacer la ruche ' + h.code, fields: [{ name: 'apiaryId', label: 'Vers le rucher', type: 'select', options: apiaryOptions(), value: h.apiaryId }], submit: 'Déplacer', onSubmit(v) { if (v.apiaryId === h.apiaryId) return; const a = A(v.apiaryId); h.apiaryId = v.apiaryId; addLog(h.id, 'Transhumance', a ? 'Déplacée vers ' + a.name : 'Retirée du rucher'); save(); render(true); } });
  },
  hiveQr(el) { const h = H(el.dataset.id); showQr('RCH:H:' + h.code, hn(h)); },
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
    const items = []; for (let i = a; i <= b; i++) items.push({ text: 'RCH:' + type + ':' + i, label: type === 'H' ? (hiveByCode(i) ? hn(hiveByCode(i)) : 'Ruche ' + i) : 'Hausse ' + i });
    window.__labels = items; const per = parseInt($('#lper').value, 10) || 20; try { localStorage.setItem('ojurapi.labelPer', per); } catch (e) {}
    $('#lprev').innerHTML = '<div class="actions"><button class="primary" data-act="printLabels">Imprimer / PDF (' + items.length + ')</button></div>' + labelsHtml(items.slice(0, Math.min(per, 6)), per, true) + '<p class="hint">Aperçu' + (items.length > 6 ? ' des premières étiquettes' : '') + ' — ' + per + ' par feuille A4, ' + Math.ceil(items.length / per) + ' feuille(s).</p>';
  },
  printLabels() { printItems(window.__labels || [], parseInt($('#lper') && $('#lper').value, 10) || labelPer()); },
  exportCsv(el) { const k = el.dataset.k; saveFile(k + '.csv', csvText(EXPORTS[k]()), 'text/csv'); },
  backup() { db.lastBackup = Date.now(); save(); saveFile('ojurapi-sauvegarde-' + today() + '.json', JSON.stringify(db), 'application/json'); render(true); },
  importPick() { $('#imp').click(); },
  wipe() { if (confirm("Effacer TOUTES les données de O Jur'Api sur ce téléphone ?") && confirm('Vraiment tout effacer ? Action irréversible.')) { db = EMPTY(); save(); render(true); toast('Données effacées'); } },
  install() { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } },
  scanMode(el) { scan.mode = el.dataset.m; scan.target = ''; scan.pending = []; scan.batch = []; render(false); },
  homeEdit() { ui.homeEdit = true; render(false); },
  homeEditDone() { ui.homeEdit = false; render(false); },
  homeReset() { db.homeOrder = null; db.homeHidden = null; save(); render(true); toast('Ordre d’origine rétabli'); },
  toggleTile(el) { const k = el.dataset.k, a = homeHidden().slice(), i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.push(k); db.homeHidden = a; save(); render(true); },
  goScan(el) { scan.mode = el.dataset.m; scan.target = ''; scan.pending = []; scan.batch = []; scan.hive = ''; if (location.hash === '#/scan') render(false); else location.hash = '#/scan'; },
  batchDel(el) { scan.batch = scan.batch.filter(id => id !== el.dataset.id); paintScan(); },
  batchClear() { scan.batch = []; paintScan(); },
  batchOk() { if (scan.mode === 'move') moveBatchForm(); else if (scan.mode === 'treat') prodBatchForm('treat'); else prodBatchForm('feed'); },
  feedNew() { prodNew('feed'); },
  trtNew() { prodNew('treat'); },
  feedDel(el) { prodDel('feed', el); },
  trtDel(el) { prodDel('treat', el); },
  editLog(el) { editLogForm(el.dataset.id); },
  delLog(el) { const l = db.logs.find(x => x.id === el.dataset.id); if (!l || !confirm('Supprimer cette entrée du journal ?')) return; db.logs = db.logs.filter(x => x.id !== l.id); save(); closeSheet(); render(true); },
  scanReset() { scan.hive = ''; scan.pending = []; paintScan(); },
  camToggle() { if (scan.stream) { scan.manualOff = true; stopCam(); } else { scan.manualOff = false; startCam(); } },
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
window.addEventListener('hashchange', () => { closeSheet(); scan.manualOff = false; render(false); });
window.addEventListener('afterprint', () => { const p = $('#printSheet'); p.hidden = true; p.innerHTML = ''; });

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
/* glisser-déposer des tuiles (poignée ⠿, souris ou doigt) */
let drag = null;
document.addEventListener('pointerdown', e => {
  const g = e.target.closest && e.target.closest('.tiles.editing .grip'); if (!g) return;
  const t = g.closest('.tile'); drag = { t, box: t.parentNode }; t.classList.add('dragging');
  try { g.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (e.clientY > window.innerHeight - 120) window.scrollBy(0, 14); else if (e.clientY < 130) window.scrollBy(0, -14);
  const el = document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null, over = el && el.closest ? el.closest('.tile.edit') : null;
  if (!over || over === drag.t || over.parentNode !== drag.box) return;
  const kids = [...drag.box.children];
  if (kids.indexOf(drag.t) < kids.indexOf(over)) over.after(drag.t); else over.before(drag.t);
});
function endDrag() {
  if (!drag) return;
  drag.t.classList.remove('dragging');
  db.homeOrder = [...drag.box.querySelectorAll('.tile.edit')].map(x => x.dataset.key);
  drag = null; save();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

window.Ruchier = { homeKeys, get db() { return db; }, ACT, handleScan, scan, render, EXPORTS, csvText, parseCode };
render(false);
})();
