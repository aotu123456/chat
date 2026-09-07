// ===================== 工具 =====================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e[k] = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

function fmtTime(ts) {
  if (!ts) return '-';
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return '刚刚';
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = `请求失败(${res.status})`;
    try {
      const j = await res.json();
      msg = j.detail?.errors ? j.detail.errors.join('; ') : (j.detail || msg);
    } catch (e) { /* ignore */ }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return res.json();
}

function showView(name) {
  ['sessions', 'create', 'chat'].forEach(v =>
    $(`#view-${v}`).classList.toggle('hidden', v !== name));
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function confirmDialog(title, text) {
  return new Promise(resolve => {
    $('#modal-title').textContent = title;
    $('#modal-text').textContent = text;
    $('#modal-mask').classList.remove('hidden');
    const done = v => {
      $('#modal-mask').classList.add('hidden');
      $('#modal-ok').onclick = $('#modal-cancel').onclick = $('#modal-mask').onclick = null;
      resolve(v);
    };
    $('#modal-ok').onclick = () => done(true);
    $('#modal-cancel').onclick = () => done(false);
    $('#modal-mask').onclick = e => { if (e.target.id === 'modal-mask') done(false); };
  });
}

// ===================== 表单数据工具 =====================
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (o[ks[i]] == null) o[ks[i]] = {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = val;
}
const csvToArr = s => String(s ?? '').split(/[,，;；]/).map(x => x.trim()).filter(Boolean);
const kvToObj = rows => Object.fromEntries(rows.filter(r => r.k && r.k.trim()).map(r => [r.k.trim(), r.v]));
const toInt = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

// ===================== 视图1:存档列表 =====================
function genreClass(g) {
  g = String(g || '');
  if (/奇幻|魔法|龙|骑士/.test(g)) return 'fantasy';
  return '';
}

async function renderSessions() {
  const grid = $('#sessions-grid');
  grid.innerHTML = '';
  let items;
  try {
    items = await api('/api/sessions');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><div class="big-emoji">⚠️</div><div class="empty-title">加载失败</div><div class="empty-desc">${esc(e.message)}</div></div>`;
    return;
  }
  $('#session-total').textContent = items.length ? `共 ${items.length} 个存档` : '';
  if (!items.length) {
    grid.appendChild(el('div', { class: 'empty-state' },
      el('div', { class: 'big-emoji' }, '🏰'),
      el('div', { class: 'empty-title' }, '还没有存档'),
      el('div', { class: 'empty-desc' }, '创建你的第一个世界,书写属于你的冒险故事'),
      el('div', {}, el('button', { class: 'btn primary', onclick: gotoCreate }, '✨ 创建世界')),
    ));
    return;
  }
  for (const s of items) {
    const avatars = (s.avatars || []).slice(0, 4);
    const card = el('div', { class: 'session-card', onclick: () => openSession(s.id) },
      el('div', { class: 'card-top' },
        el('span', { class: 'badge ' + genreClass(s.genre) }, esc(s.genre || '未分类')),
        el('span', { class: 'card-time' }, fmtTime(s.updated_at)),
      ),
      el('div', { class: 'card-title' }, esc(s.name)),
      el('div', { class: 'card-synopsis' }, esc(s.synopsis || '暂无简介')),
      el('hr', { class: 'card-divider' }),
      el('div', { class: 'card-meta' },
        el('div', { class: 'avatar-stack' },
          ...[...avatars, s.player_avatar || '🧙'].map(a => el('span', { class: 'av' }, a)),
          s.character_count > avatars.length ? el('span', { class: 'av plus' }, `+${s.character_count - avatars.length}`) : null,
        ),
        el('span', {}, `👤 ${s.character_count} · 💬 ${s.message_count}`),
      ),
      el('div', { class: 'card-actions' },
        el('button', {
          class: 'btn enter-btn',
          onclick: e => { e.stopPropagation(); openSession(s.id); },
        }, '进入冒险'),
        el('button', {
          class: 'btn del-btn',
          onclick: async e => {
            e.stopPropagation();
            if (await confirmDialog('删除存档', `确认删除「${s.name}」?记忆与对话将一并删除,不可恢复。`)) {
              try { await api('/api/sessions/' + s.id, { method: 'DELETE' }); toast('已删除'); }
              catch (e2) { toast(e2.message); }
              renderSessions();
            }
          },
        }, '删除'),
      ),
    );
    grid.appendChild(card);
  }
}

// ===================== 视图2:新建存档 =====================
function defaultWorld() {
  return {
    name: '', description: '', genre: '', tone: '',
    era: '', time: '中午', season: '', calendar: '',
    locations: [], current_location: '', weather: '晴朗', climate: '',
    races: [], factions: [], laws: '', culture: '',
    magic_system: '', economy: '', history: '', central_conflict: '',
    plot_hooks: [], initial_events: [],
  };
}
function newChar(name = '', avatar = '🎭') {
  return {
    id: '', name, title: '', race: '', occupation: '', age: '', gender: '', avatar,
    public: { appearance: '', speech_style: '', personality: [], public_background: '', public_attributes: [] },
    private: { background: '', goals: [], secrets: '', attributes: [], skills: [], inventory: [] },
    status: { emotion: '', location: '', hp: '', mp: '' },
    relationships: [],
  };
}

const createState = {
  name: '', synopsis: '',
  world: defaultWorld(),
  characters: [],
  player: newChar('', '🧙'),
};

// --- 通用表单行 ---
function bindText(obj, path, ph, tag = 'input') {
  const e = el(tag, { placeholder: ph, rows: tag === 'textarea' ? '2' : undefined });
  e.value = getPath(obj, path) ?? '';
  e.oninput = () => setPath(obj, path, e.value);
  return e;
}
function bindCsv(obj, path, ph) {
  const e = el('input', { placeholder: ph });
  e.value = (getPath(obj, path) || []).join(', ');
  e.oninput = () => setPath(obj, path, csvToArr(e.value));
  return e;
}
function field(label, input, tag) {
  const row = el('div', { class: 'form-row' });
  const l = el('label', {}, label);
  if (tag) l.appendChild(tag);
  row.appendChild(l);
  row.appendChild(input);
  return row;
}
function block(title, ...rows) {
  const b = el('div', { class: 'form-block' }, el('h3', {}, title));
  rows.forEach(r => { if (r) b.appendChild(r); });
  return b;
}
function twoCol(a, b) {
  return el('div', { class: 'form-row two-col' },
    el('div', {}, a), el('div', {}, b));
}
function kvListRows(container, obj, path, keyPh, valPh) {
  const arr = getPath(obj, path);
  const render = () => {
    container.innerHTML = '';
    const list = el('div', { class: 'list-rows' });
    arr.forEach((row, i) => {
      const kIn = el('input', { placeholder: keyPh });
      kIn.value = row.k || '';
      kIn.oninput = () => { row.k = kIn.value; };
      const vIn = el('input', { placeholder: valPh });
      vIn.value = row.v || '';
      vIn.oninput = () => { row.v = vIn.value; };
      const del = el('button', { class: 'btn danger tiny row-del', onclick: () => { arr.splice(i, 1); render(); } }, '✕');
      list.appendChild(el('div', { class: 'list-row' }, kIn, vIn, del));
    });
    container.appendChild(list);
    const add = el('button', { class: 'btn tiny add-row-btn', onclick: () => { arr.push({ k: '', v: '' }); render(); } }, '＋ 添加');
    container.appendChild(add);
  };
  render();
}
function objListRows(container, obj, path, fields, addLabel) {
  const arr = getPath(obj, path);
  const render = () => {
    container.innerHTML = '';
    const list = el('div', { class: 'list-rows' });
    arr.forEach((row, i) => {
      const inputs = fields.map(f => {
        const inp = el('input', { placeholder: f.ph });
        inp.value = row[f.k] ?? '';
        inp.oninput = () => { row[f.k] = inp.value; };
        return inp;
      });
      const del = el('button', { class: 'btn danger tiny row-del', onclick: () => { arr.splice(i, 1); render(); } }, '✕');
      list.appendChild(el('div', { class: 'list-row' }, ...inputs, del));
    });
    container.appendChild(list);
    const add = el('button', { class: 'btn tiny add-row-btn', onclick: () => { arr.push(Object.fromEntries(fields.map(f => [f.k, '']))); render(); } }, `＋ ${addLabel}`);
    container.appendChild(add);
  };
  render();
}

// --- 世界表单(静态输入,绑定一次) ---
function initWorldBindings() {
  const w = createState.world;
  const bind = id => {
    const e = $('#' + id);
    e.value = getPath(w, id.slice(2)) ?? '';
    e.oninput = () => setPath(w, id.slice(2), e.value);
  };
  ['w-name', 'w-description', 'w-genre', 'w-tone', 'w-era', 'w-time', 'w-season',
   'w-calendar', 'w-current-location', 'w-weather', 'w-climate', 'w-races',
   'w-laws', 'w-culture', 'w-magic', 'w-economy', 'w-history', 'w-conflict',
   'w-hooks', 'w-initial-events'].forEach(bind);
  // 逗号分隔字段 → 数组
  ['w-races', 'w-hooks', 'w-initial-events'].forEach(id => {
    $('#' + id).oninput = () => setPath(w, id.slice(2), csvToArr($('#' + id).value));
  });
}

// --- 角色编辑器 ---
function renderCharEditors() {
  const box = $('#char-editors');
  box.innerHTML = '';
  createState.characters.forEach((c, i) => box.appendChild(buildCharEditor(c, i, false)));
  $('#char-count').textContent = `${createState.characters.length} 个`;

  const pBox = $('#player-editor');
  pBox.innerHTML = '';
  pBox.appendChild(buildCharEditor(createState.player, null, true));
}

function buildCharEditor(char, index, isPlayer) {
  const wrap = el('div', { class: 'char-editor' });
  const avatar = el('input', { style: 'width:48px;text-align:center;font-size:18px;padding:4px', maxlength: '4', title: '头像 emoji' });
  avatar.value = char.avatar;
  avatar.oninput = () => { char.avatar = avatar.value; };
  avatar.onclick = e => e.stopPropagation();

  const nameIn = el('input', { style: 'flex:1;min-width:60px', placeholder: '角色名 *' });
  nameIn.value = char.name;
  nameIn.oninput = () => { char.name = nameIn.value; };
  nameIn.onclick = e => e.stopPropagation();

  const toggleBtn = el('button', { class: 'btn tiny ghost' }, '▾');
  const body = el('div', { class: 'char-body' });

  const head = el('div', { class: 'char-head' },
    avatar, nameIn,
    el('span', { class: 'char-sub' }, isPlayer ? '扮演角色 · AI 只见公开信息' : 'NPC'),
    toggleBtn,
    el('button', {
      class: 'btn danger tiny char-del',
      onclick: e => {
        e.stopPropagation();
        if (!isPlayer && confirmDialog('删除角色', `确认删除「${char.name || '未命名'}」?`)) {
          createState.characters.splice(index, 1);
          renderCharEditors();
        }
      },
    }, '🗑'),
  );
  head.onclick = () => {
    const closed = body.classList.toggle('hidden');
    toggleBtn.textContent = closed ? '▸' : '▾';
  };

  // --- 身份 ---
  body.appendChild(block('身份',
    twoCol(field('称号', bindText(char, 'title', '如:圣殿骑士')), field('种族', bindText(char, 'race', '人类/精灵...'))),
    twoCol(field('职业', bindText(char, 'occupation', '骑士/法师...')), field('年龄', bindText(char, 'age', '28'))),
    field('性别', bindText(char, 'gender', '男/女/其他')),
  ));

  // --- 公开区 ---
  const pubTag = el('span', { class: 'visibility-tag public' }, '智能体可见');
  const pubAttrBox = el('div', {});
  kvListRows(pubAttrBox, char.public, 'public_attributes', '键(如:气势)', '值(如:8)');
  body.appendChild(block('公开区(他人可直接感知)',
    field('外貌描述 *', bindText(char, 'public.appearance', '银甲红披风,左颊一道旧疤', 'textarea'), pubTag),
    field('说话风格', bindText(char, 'public.speech_style', '正式庄重,多用敬语')),
    field('性格标签', bindCsv(char, 'public.personality', '忠诚,严肃,固执')),
    field('公开背景', bindText(char, 'public.public_background', '晨曦王国资深骑士')),
    field('外显特征(属性/体型/气势)', pubAttrBox),
  ));

  // --- 私密区 ---
  const priTag = el('span', { class: 'visibility-tag private' }, isPlayer ? 'AI 不可见 ⚠️' : '仅自己知道');
  const priAttrBox = el('div', {});
  kvListRows(priAttrBox, char.private, 'attributes', '键(如:力量)', '值(如:12)');
  const invBox = el('div', {});
  objListRows(invBox, char.private, 'inventory', [{ k: 'name', ph: '物品名' }, { k: 'desc', ph: '描述' }], '添加物品');
  body.appendChild(block('私密区(他人无法感知)',
    field('真实背景', bindText(char, 'private.background', '曾是王太子卫队,因阴谋被贬', 'textarea'), priTag),
    field('目标', bindCsv(char, 'private.goals', '洗清冤屈,重获信任')),
    field('秘密', bindText(char, 'private.secrets', '目击了老国王被毒杀的真相', 'textarea')),
    field('全量属性', priAttrBox),
    field('技能', bindCsv(char, 'private.skills', '剑术,骑术,军略')),
    field('随身物品', invBox),
  ));

  // --- 状态 ---
  body.appendChild(block('初始状态',
    twoCol(field('情绪', bindText(char, 'status.emotion', '坚定')), field('位置', bindText(char, 'status.location', '村庄广场'))),
    twoCol(field('HP', bindText(char, 'status.hp', '100')), field('MP', bindText(char, 'status.mp', '0'))),
  ));

  // --- 关系 ---
  const relBox = el('div', {});
  kvListRows(relBox, char, 'relationships', '角色id', '关系描述');
  body.appendChild(block('与其他角色的关系', relBox));

  wrap.appendChild(head);
  wrap.appendChild(body);
  return wrap;
}

// --- 创建视图初始化与提交 ---
function resetCreateState() {
  createState.name = '';
  createState.synopsis = '';
  Object.assign(createState.world, JSON.parse(JSON.stringify(defaultWorld())));
  createState.characters = [newChar()];
  createState.player = newChar('', '🧙');
  $('#f-session-name').value = '';
  $('#f-synopsis').value = '';
}

function gotoCreate() {
  resetCreateState();
  initWorldBindings();
  // 动态世界列表重建
  objListRows($('#w-locations'), createState.world, 'locations', [{ k: 'name', ph: '地点名' }, { k: 'desc', ph: '描述' }], '添加地点');
  objListRows($('#w-factions'), createState.world, 'factions', [{ k: 'name', ph: '势力名' }, { k: 'desc', ph: '描述' }, { k: 'attitude', ph: '态度' }], '添加势力');
  renderCharEditors();
  $('#create-errors').classList.add('hidden');
  $('#create-errors-foot').classList.add('hidden');
  showView('create');
}

function sanitizeWorld(w) {
  return {
    ...w,
    races: csvToArr(Array.isArray(w.races) ? w.races.join(',') : w.races),
    plot_hooks: csvToArr(Array.isArray(w.plot_hooks) ? w.plot_hooks.join(';') : w.plot_hooks),
    initial_events: csvToArr(Array.isArray(w.initial_events) ? w.initial_events.join(';') : w.initial_events),
  };
}
function sanitizeChar(c) {
  return {
    ...c,
    age: toInt(c.age),
    public: { ...c.public, public_attributes: kvToObj(c.public.public_attributes) },
    private: {
      ...c.private,
      goals: csvToArr(c.private.goals.join(',')),
      skills: csvToArr(c.private.skills.join(',')),
      attributes: kvToObj(c.private.attributes),
    },
    status: { ...c.status, hp: toInt(c.status.hp), mp: toInt(c.status.mp) },
    relationships: kvToObj(c.relationships),
  };
}

function showCreateErrors(errors) {
  const text = errors.map(e => `• ${e}`).join('<br>');
  $('#create-errors').innerHTML = text;
  $('#create-errors-foot').innerHTML = text;
  $('#create-errors').classList.remove('hidden');
  $('#create-errors-foot').classList.remove('hidden');
}

async function submitCreate() {
  const errors = [];
  if (!createState.name.trim()) errors.push('请填写存档名称');
  if (!createState.world.name.trim()) errors.push('请填写世界名称');
  if (!createState.world.history.trim()) errors.push('请填写世界历史背景');
  if (!createState.player.name.trim()) errors.push('请填写你的角色名');
  if (!(createState.player.public.appearance || '').trim()) errors.push('你的角色缺少公开外貌描述');
  if (!createState.characters.length) errors.push('至少需要一个 NPC 角色');
  for (const c of createState.characters) {
    if (!c.name.trim()) { errors.push('存在未命名的角色'); break; }
    if (!(c.public.appearance || '').trim()) errors.push(`角色「${c.name}」缺少公开外貌描述`);
  }
  if (errors.length) { showCreateErrors(errors); return; }

  const payload = {
    name: createState.name.trim(),
    synopsis: createState.synopsis.trim() || createState.world.name.trim(),
    world: sanitizeWorld(createState.world),
    characters: createState.characters.map(sanitizeChar),
    player: sanitizeChar(createState.player),
  };
  const btn = $('#btn-submit-create');
  btn.disabled = true;
  try {
    const res = await api('/api/sessions', { method: 'POST', body: payload });
    toast('存档已创建');
    await openSession(res.id);
  } catch (e) {
    showCreateErrors([e.message]);
    btn.disabled = false;
  }
}

// ===================== 视图3:聊天 =====================
let currentSession = null;
let selectedAgentIds = new Set();
let sending = false;

function renderChatTop() {
  const d = currentSession;
  $('#chat-session-name').textContent = d.name;
  $('#chat-genre').textContent = d.genre || '';
  $('#chat-genre').classList.toggle('hidden', !d.genre);
  $('#chat-player').textContent = `${d.player.avatar || '🧙'} ${d.player.name}`;
  $('#message-input').placeholder = `以「${d.player.name}」的身份说...(Enter 发送)`;
}

function renderWorldPanel() {
  const w = currentSession.world.state;
  const panel = el('div', { class: 'side-panel' },
    el('h3', {}, '🌍 世界状态'),
    el('div', { class: 'world-card' },
      el('div', { class: 'wr' }, el('span', { class: 'k' }, '时间'), el('span', { class: 'v' }, esc(w.time || '-'))),
      el('div', { class: 'wr' }, el('span', { class: 'k' }, '天气'), el('span', { class: 'v' }, esc(w.weather || '-'))),
      el('div', { class: 'wr' }, el('span', { class: 'k' }, '地点'), el('span', { class: 'v' }, esc(w.location || '-'))),
      el('div', { class: 'wr' }, el('span', { class: 'k' }, '事件'), el('span', { class: 'v' }, esc((w.recent_events || []).join('; ') || '无'))),
      el('div', { class: 'wr' }, el('span', { class: 'k' }, '在场'), el('span', { class: 'v' }, esc((w.active_characters || []).join(', ') || '-'))),
    ),
  );
  const old = $('#world-panel');
  if (old) old.replaceWith(panel);
  else $('#chat-sidebar').prepend(panel);
  panel.id = 'world-panel';
}

function renderCharPanel() {
  const panel = el('div', { class: 'side-panel' },
    el('h3', {}, '角色(点击可暂停参与)'),
    ...currentSession.characters.map(c => {
      const st = c.status || {};
      const active = selectedAgentIds.has(c.id);
      const hp = st.hp == null || st.hp === '' ? '' : ` · HP ${st.hp}`;
      const card = el('div', { class: `char-card${active ? '' : ' paused'}` },
        el('span', { class: 'c-avatar' }, c.avatar || '🎭'),
        el('div', { class: 'c-info' },
          el('div', { class: 'c-name' }, esc(c.name)),
          el('div', { class: 'c-status' }, esc(`${st.emotion || ''}${hp} · ${st.location || ''}`.trim() || '状态未知')),
        ),
        el('span', { class: 'c-check' }, active ? '✓' : '✕'),
      );
      card.onclick = () => {
        if (active) selectedAgentIds.delete(c.id);
        else selectedAgentIds.add(c.id);
        renderCharPanel();
      };
      return card;
    }),
    el('h3', { style: 'margin-top:6px' }, '我的角色'),
    el('div', { class: 'char-card' },
      el('span', { class: 'c-avatar' }, currentSession.player.avatar || '🧙'),
      el('div', { class: 'c-info' },
        el('div', { class: 'c-name' }, esc(currentSession.player.name)),
        el('div', { class: 'c-status' }, esc((currentSession.player.status || {}).location || '') || ' '),
      ),
    ),
  );
  const old = $('#char-panel');
  if (old) old.replaceWith(panel);
  else $('#chat-sidebar').appendChild(panel);
  panel.id = 'char-panel';
}

function renderSidebar() {
  renderWorldPanel();
  renderCharPanel();
}

function addChatMsg(role, content, name, avatar) {
  const msgBox = $('#messages');
  const div = el('div', { class: 'msg ' + role });
  if (name) {
    const r = el('span', { class: 'msg-role' }, `${avatar || ''} ${name}`);
    div.appendChild(r);
  }
  if (content) div.appendChild(document.createTextNode(content));
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
  return div;
}

function renderMessages(msgs) {
  const box = $('#messages');
  box.innerHTML = '';
  const agentById = Object.fromEntries(currentSession.characters.map(c => [c.id, c]));
  if (msgs.length) {
    for (const m of msgs) {
      if (m.role === 'user') {
        addChatMsg('user', m.content, m.name || currentSession.player.name, currentSession.player.avatar);
      } else if (agentById[m.role]) {
        addChatMsg('agent', m.content, m.name, agentById[m.role].avatar);
      } else {
        addChatMsg('system', m.content);
      }
    }
  } else {
    box.appendChild(el('div', { class: 'welcome' },
      el('h2', {}, '冒险即将开始'),
      el('p', {}, '和世界中的角色们聊聊吧。'),
    ));
  }
}

async function openSession(sid) {
  showView('chat');
  const d = await api('/api/sessions/' + sid);
  currentSession = d;
  selectedAgentIds = new Set(d.characters.map(c => c.id));
  sending = false;
  $('#send-btn').disabled = false;
  $('#message-input').value = '';
  renderChatTop();
  renderSidebar();
  renderMessages(d.messages || []);
  $('#message-input').focus();
}

let currentAgentMsg = null;
let currentAgentName = '';

function handleSSEEvent(part) {
  const lines = part.split('\n');
  let event = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;
  let data;
  try { data = JSON.parse(dataLines.join('\n')); } catch (e) { return; }

  switch (event) {
    case 'agent_reply': {
      if (!currentAgentMsg || currentAgentName !== data.name) {
        currentAgentName = data.name;
        const agent = currentSession.characters.find(c => c.id === data.agent_id);
        currentAgentMsg = addChatMsg('agent', '', data.name, agent ? agent.avatar : '');
      }
      currentAgentMsg.lastChild.textContent += data.content;
      const box = $('#messages');
      box.scrollTop = box.scrollHeight;
      break;
    }
    case 'world_update':
      currentSession.world.state = data.world;
      renderWorldPanel();
      break;
    case 'error':
      addChatMsg('error', '服务端错误: ' + (data.error || '未知错误'));
      break;
  }
}

async function sendMessage() {
  if (sending || !currentSession) return;
  const text = $('#message-input').value.trim();
  if (!text) return;
  sending = true;
  $('#send-btn').disabled = true;
  currentAgentMsg = null;
  currentAgentName = '';
  const welcome = document.querySelector('.welcome');
  if (welcome) welcome.remove();

  addChatMsg('user', text, currentSession.player.name, currentSession.player.avatar);
  $('#message-input').value = '';

  try {
    const res = await fetch(`/api/sessions/${currentSession.id}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, agent_ids: Array.from(selectedAgentIds) }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) handleSSEEvent(part);
    }
    if (buffer.trim()) handleSSEEvent(buffer);
  } catch (e) {
    addChatMsg('error', '连接失败: ' + e.message);
  }
  sending = false;
  $('#send-btn').disabled = false;
}

async function generateImage() {
  if (!currentSession) return;
  $('#image-btn').disabled = true;
  const tip = addChatMsg('agent', '正在绘制场景图,请稍候...', '🎨 画师');
  try {
    const data = await api(`/api/sessions/${currentSession.id}/image`, { method: 'POST', body: {} });
    tip.remove();
    if (data.success) {
      const div = addChatMsg('agent', '', '🎨 场景图');
      div.appendChild(el('img', { src: data.url, alt: '场景图' }));
    } else {
      addChatMsg('error', '图片生成失败: ' + (data.error || '未知错误'));
    }
  } catch (e) {
    tip.remove();
    addChatMsg('error', '图片生成请求失败: ' + e.message);
  }
  $('#image-btn').disabled = false;
}

// ===================== 事件绑定 =====================
$('#btn-new-session').onclick = gotoCreate;
$('#btn-back-from-create').onclick = () => showView('sessions');
$('#btn-back-to-list').onclick = () => { showView('sessions'); renderSessions(); };
$('#btn-submit-create').onclick = submitCreate;
$('#f-session-name').oninput = () => { createState.name = $('#f-session-name').value; };
$('#f-synopsis').oninput = () => { createState.synopsis = $('#f-synopsis').value; };
$('#btn-add-char').onclick = () => { createState.characters.push(newChar()); renderCharEditors(); };

$('#send-btn').onclick = sendMessage;
$('#message-input').onkeydown = e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
};
$('#image-btn').onclick = generateImage;

$('#btn-delete-session').onclick = async () => {
  if (!currentSession) return;
  if (await confirmDialog('删除存档', `确认删除「${currentSession.name}」?不可恢复。`)) {
    try {
      await api('/api/sessions/' + currentSession.id, { method: 'DELETE' });
      toast('已删除');
      currentSession = null;
      showView('sessions');
      renderSessions();
    } catch (e) { toast(e.message); }
  }
};

$('#chat-session-name').ondblclick = async () => {
  if (!currentSession) return;
  const name = prompt('修改存档名称', currentSession.name);
  if (name && name.trim() && name.trim() !== currentSession.name) {
    try {
      const r = await api('/api/sessions/' + currentSession.id, { method: 'PATCH', body: { name: name.trim() } });
      currentSession.name = r.name;
      $('#chat-session-name').textContent = r.name;
      toast('已改名');
    } catch (e) { toast(e.message); }
  }
};

// 分区折叠
document.querySelectorAll('.form-section .sec-head').forEach(head => {
  head.onclick = () => {
    const sec = head.parentElement;
    sec.classList.toggle('closed');
    const btn = head.querySelector('.sec-toggle');
    if (btn) btn.textContent = sec.classList.contains('closed') ? '展开' : '收起';
  };
});

// ===================== 初始化 =====================
renderSessions();
