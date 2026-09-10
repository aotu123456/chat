export const csvToArr = (s) => String(s ?? '')
  .split(/[,，;；]/)
  .map((x) => x.trim())
  .filter(Boolean);

export const kvToObj = (rows) => Object.fromEntries(
  (rows || [])
    .filter((r) => r && r.k && String(r.k).trim())
    .map((r) => [String(r.k).trim(), r.v]),
);

export const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

export function fmtTime(ts) {
  if (!ts) return '-';
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return '刚刚';
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function genreClass(g) {
  const text = String(g || '');
  if (/奇幻|魔法|龙|骑士/.test(text)) return 'fantasy';
  return '';
}

export function defaultWorld() {
  return {
    name: '', description: '', genre: '', tone: '',
    era: '', time: '中午', season: '', calendar: '',
    locations: [], current_location: '', weather: '晴朗', climate: '',
    races: '', factions: [], laws: '', culture: '',
    magic_system: '', economy: '', history: '', central_conflict: '',
    plot_hooks: '', initial_events: '',
  };
}

export function newChar(name = '', avatar = '🎭') {
  return {
    id: '', name, title: '', race: '', occupation: '', age: '', gender: '', avatar,
    public: {
      appearance: '', speech_style: '', personality: '',
      public_background: '', public_attributes: [],
    },
    private: {
      background: '', goals: '', secrets: '',
      attributes: [], skills: '', inventory: [],
    },
    status: { emotion: '', location: '', hp: '', mp: '' },
    relationships: [],
  };
}

export function setByPath(obj, path, value) {
  const keys = path.split('.');
  const clone = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const next = cursor[key];
    cursor[key] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}

export function sanitizeWorld(w) {
  return {
    ...w,
    races: csvToArr(w.races),
    plot_hooks: csvToArr(w.plot_hooks),
    initial_events: csvToArr(w.initial_events),
  };
}

export function sanitizeChar(c) {
  return {
    ...c,
    age: toInt(c.age),
    public: {
      ...c.public,
      personality: csvToArr(c.public.personality),
      public_attributes: kvToObj(c.public.public_attributes),
    },
    private: {
      ...c.private,
      goals: csvToArr(c.private.goals),
      skills: csvToArr(c.private.skills),
      attributes: kvToObj(c.private.attributes),
    },
    status: {
      ...c.status,
      hp: toInt(c.status.hp),
      mp: toInt(c.status.mp),
    },
    relationships: kvToObj(c.relationships),
  };
}