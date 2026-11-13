// 데이터 저장소: 파이어베이스 실시간 데이터베이스 또는 체험 모드(localStorage)
import { firebaseConfig } from './config.js';

const ROOT = 'zombieMath';
let impl = null;
export let MODE = 'local';

function splitPath(p) { return p.split('/').filter(Boolean); }
function getAt(obj, path) {
  let cur = obj;
  for (const k of splitPath(path)) { if (cur == null) return null; cur = cur[k]; }
  return cur === undefined ? null : cur;
}
function setAt(obj, path, val) {
  const keys = splitPath(path);
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (val === null || val === undefined) delete cur[last]; else cur[last] = val;
}
const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));

// ---------- 체험 모드 (같은 브라우저의 탭끼리 연결) ----------
function makeLocal() {
  const KEY = 'zombieMath_demo_state';
  const listeners = new Set();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  let state = load();
  const fire = () => listeners.forEach((l) => l.cb(clone(getAt(state, l.path))));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} fire(); };
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); fire(); } });
  const resolve = (v) => {
    if (v && typeof v === 'object') {
      if (v.__ts) return Date.now();
      for (const k of Object.keys(v)) v[k] = resolve(v[k]);
    }
    return v;
  };
  return {
    TS: { __ts: true },
    watch(path, cb) {
      const l = { path, cb }; listeners.add(l);
      setTimeout(() => cb(clone(getAt(state, path))), 0);
      return () => listeners.delete(l);
    },
    async put(path, val) { state = load(); setAt(state, path, resolve(clone(val))); save(); },
    async patch(path, obj) {
      state = load();
      for (const [k, v] of Object.entries(obj)) setAt(state, path + '/' + k, resolve(clone(v)));
      save();
    },
    async del(path) { state = load(); setAt(state, path, null); save(); },
    async inc(path, n) { state = load(); setAt(state, path, (getAt(state, path) || 0) + n); save(); },
    async tx(path, fn) {
      state = load();
      const nv = fn(clone(getAt(state, path)));
      if (nv === undefined) return { committed: false, value: getAt(state, path) };
      setAt(state, path, resolve(nv)); save();
      return { committed: true, value: clone(getAt(state, path)) };
    },
    presence() { return () => {}; },
  };
}

// ---------- 파이어베이스 ----------
async function makeFirebase(cfg) {
  const V = '10.12.2';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const D = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);
  const app = initializeApp(cfg);
  const db = D.getDatabase(app);
  const r = (p) => D.ref(db, p);
  return {
    TS: D.serverTimestamp(),
    watch(path, cb) { return D.onValue(r(path), (s) => cb(s.val())); },
    put(path, val) { return D.set(r(path), val); },
    patch(path, obj) { return D.update(r(path), obj); },
    del(path) { return D.remove(r(path)); },
    inc(path, n) { return D.set(r(path), D.increment(n)); },
    async tx(path, fn) {
      const res = await D.runTransaction(r(path), (cur) => fn(cur));
      return { committed: res.committed, value: res.snapshot.val() };
    },
    presence(path) {
      let od = null;
      const off = D.onValue(r('.info/connected'), (s) => {
        if (s.val() === true) {
          od = D.onDisconnect(r(path + '/online'));
          od.set(false);
          D.set(r(path + '/online'), true);
        }
      });
      return () => { off(); if (od) od.cancel(); };
    },
  };
}

export async function initDB() {
  if (impl) return impl;
  if (firebaseConfig && firebaseConfig.apiKey) {
    impl = await makeFirebase(firebaseConfig); MODE = 'firebase';
  } else {
    impl = makeLocal(); MODE = 'local';
  }
  return impl;
}

// 모든 경로 앞에 ROOT를 붙여 사용
const P = (p) => ROOT + (p ? '/' + p : '');
export const db = {
  get TS() { return impl.TS; },
  watch: (p, cb) => impl.watch(P(p), cb),
  put: (p, v) => impl.put(P(p), v),
  patch: (p, o) => impl.patch(P(p), o),
  del: (p) => impl.del(P(p)),
  inc: (p, n) => impl.inc(P(p), n),
  tx: (p, fn) => impl.tx(P(p), fn),
  presence: (p) => impl.presence(P(p)),
};
