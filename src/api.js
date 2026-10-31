import { createClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = !!(URL_ && KEY);
export const sb = configured ? createClient(URL_, KEY, { auth: { persistSession: false } }) : null;

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
export { ls };

function err(e) {
  const m = (e && (e.message || e.details || '')) + '';
  if (m.includes('not_allowed')) return Object.assign(new Error('not_allowed'), { code: 'not_allowed' });
  if (/fetch|network|Failed|Load failed/i.test(m) || !navigator.onLine) return Object.assign(new Error('offline'), { code: 'offline' });
  return Object.assign(new Error(m || 'error'), { code: 'error' });
}
async function rpc(fn, args) {
  if (!sb) throw Object.assign(new Error('not configured'), { code: 'error' });
  let res;
  try { res = await sb.rpc(fn, args); } catch (e) { throw err(e); }
  if (res.error) throw err(res.error);
  return res.data;
}

export const api = {
  createTree: (name) => rpc('create_tree', { p_name: name || '' }),
  openTree: (code) => rpc('open_tree', { p_code: code }),
  savePeople: (code, people) => rpc('save_people', { p_code: code, p_people: people }),
  deletePerson: (code, id) => rpc('delete_person', { p_code: code, p_id: id }),
  renameTree: (code, name) => rpc('rename_tree', { p_code: code, p_name: name }),
  async uploadPhoto(treeId, personId, blob) {
    if (!sb) throw new Error('not configured');
    const path = `${treeId}/${personId}-${Date.now().toString(36)}.jpg`;
    const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) throw err(error);
    return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  },
};

/* ---- outbox: edits made offline are kept and sent when the connection returns ---- */
export function outbox(code) {
  const key = 'ft-outbox-' + code;
  let busy = false;
  const self = {
    list: () => ls.get(key, []),
    push(op) { const l = self.list(); l.push(op); ls.set(key, l); },
    async flush(onRejected) {
      if (busy) return false; busy = true;
      try {
        let l = self.list();
        while (l.length) {
          const op = l[0];
          try {
            if (op.t === 'save') await api.savePeople(code, op.people);
            else if (op.t === 'del') await api.deletePerson(code, op.id);
            else if (op.t === 'name') await api.renameTree(code, op.name);
          } catch (e) {
            if (e.code === 'offline') return false;
            onRejected?.(e, op); // not allowed / bad data: drop it
          }
          l = self.list(); l.shift(); ls.set(key, l);
        }
        return true;
      } finally { busy = false; }
    },
    // replay queued edits over fresh server data so they don't flicker away
    overlay(map, meta) {
      for (const op of self.list()) {
        if (op.t === 'save') for (const p of op.people) map.set(p.id, p);
        else if (op.t === 'del') map.delete(op.id);
        else if (op.t === 'name') meta.name = op.name;
      }
    },
  };
  return self;
}

/* ---- realtime nudge: tell other open copies to reload ---- */
export function liveChannel(treeId, onChange) {
  if (!sb) return { ping() {}, close() {} };
  const ch = sb.channel('tree-' + treeId, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'changed' }, () => onChange()).subscribe();
  return {
    ping() { try { ch.send({ type: 'broadcast', event: 'changed', payload: {} }); } catch {} },
    close() { try { sb.removeChannel(ch); } catch {} },
  };
}
