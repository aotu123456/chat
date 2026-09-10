export async function api(path, opts = {}) {
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