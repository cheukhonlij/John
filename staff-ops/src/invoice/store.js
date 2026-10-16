// 開單台（發票）資料層：Firestore。
//
// 只有老闆（第一個做「首次設定」嘅帳戶，記錄喺 config/bootstrap.by）睇到同改到呢啲資料；
// 真正把關嘅係 firestore.rules 入面嘅 isOwner()，呢度只係為咗畫面顯示得啱。
// 客戶、價錢同單據只會喺 Firestore，唔會寫入程式碼（程式碼會公開俾人下載）。

import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { cloudEnabled, getFirebase } from '../lib/firebase';

export { cloudEnabled };

export const INV_COLLECTIONS = {
  customers: 'invCustomers',
  items: 'invItems',
  invoices: 'invInvoices',
  tickets: 'invTickets',
};
const COUNTERS = 'invCounters';
const CONFIG = 'invConfig';
const SETTINGS_ID = 'settings';

/**
 * 睇住登入狀態：cb({ state: 'signed-out' | 'not-owner' | 'owner', user })
 */
export function watchOwner(cb) {
  const { auth, db } = getFirebase();
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb({ state: 'signed-out', user: null });
    try {
      const snap = await getDoc(doc(db, 'config', 'bootstrap'));
      const ownerUid = snap.exists() ? snap.data().by : null;
      cb({ state: ownerUid && ownerUid === user.uid ? 'owner' : 'not-owner', user });
    } catch (e) {
      cb({ state: 'not-owner', user, error: e });
    }
  });
}

/** 即時同步所有開單資料。onData({customers, items, invoices, tickets, settings}) */
export function subscribeAll(onData, onError) {
  const { db } = getFirebase();
  const data = { customers: [], items: [], invoices: [], tickets: [], settings: null };
  const loaded = new Set();
  const total = Object.keys(INV_COLLECTIONS).length + 1;
  const emit = (key) => {
    loaded.add(key);
    if (loaded.size >= total) onData({ ...data });
  };
  const unsubs = Object.entries(INV_COLLECTIONS).map(([key, name]) =>
    onSnapshot(
      collection(db, name),
      (snap) => {
        data[key] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        emit(key);
      },
      onError
    )
  );
  unsubs.push(
    onSnapshot(
      doc(db, CONFIG, SETTINGS_ID),
      (snap) => {
        data.settings = snap.exists() ? snap.data() : null;
        emit('settings');
      },
      onError
    )
  );
  return () => unsubs.forEach((u) => u());
}

const clean = (data) => {
  const out = JSON.parse(JSON.stringify(data));
  delete out.id;
  return out;
};

// Firestore 寫入：唔等伺服器回覆（冇網絡都即刻顯示，返到網絡自動同步）。
export function putRecord(kind, id, data) {
  const { db } = getFirebase();
  return setDoc(doc(db, INV_COLLECTIONS[kind], id), clean(data));
}

export function removeRecord(kind, id) {
  const { db } = getFirebase();
  return deleteDoc(doc(db, INV_COLLECTIONS[kind], id));
}

export function putSettings(settings) {
  const { db } = getFirebase();
  return setDoc(doc(db, CONFIG, SETTINGS_ID), clean(settings));
}

/**
 * 派單號：base = YYYYDDMM，同一日內遞增。用 transaction，電腦同手機同時開單都唔會撞號。
 * localMax = 畫面已知嘅同日最大流水號（例如匯入咗嘅舊單）。
 */
export async function nextSequence(base, localMax) {
  const { db } = getFirebase();
  const ref = doc(db, COUNTERS, base);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.exists() ? Number(snap.data().seq) || 0 : 0;
    const seq = Math.max(stored, Number(localMax) || 0) + 1;
    tx.set(ref, { seq });
    return seq;
  });
}

/** 匯入開單台備份（本機版或 Claude 版匯出嘅 .json）。只會新增或覆蓋，唔會刪除。 */
export async function importBackup(payload, onProgress) {
  const { db } = getFirebase();
  const ops = [];
  const asMap = (v) => (Array.isArray(v) ? Object.fromEntries(v.filter((d) => d && d.id).map((d) => [d.id, d])) : v || {});

  Object.entries(INV_COLLECTIONS).forEach(([key, name]) => {
    Object.entries(asMap(payload[key])).forEach(([id, rec]) => {
      ops.push((b) => b.set(doc(db, name, String(id)), clean(rec)));
    });
  });
  if (payload.settings && typeof payload.settings === 'object') {
    ops.push((b) => b.set(doc(db, CONFIG, SETTINGS_ID), clean(payload.settings), { merge: true }));
  }

  // 流水號：取（備份入面嘅計數、備份單據最大號、雲端現有計數）三者最大
  const counters = {};
  Object.entries(payload.counters || {}).forEach(([base, seq]) => {
    counters[base] = Math.max(counters[base] || 0, Number(seq) || 0);
  });
  Object.values(asMap(payload.invoices)).forEach((inv) => {
    const no = String((inv && inv.no) || '');
    if (/^\d{11}$/.test(no)) counters[no.slice(0, 8)] = Math.max(counters[no.slice(0, 8)] || 0, Number(no.slice(8)));
  });
  const existing = await getDocs(collection(db, COUNTERS));
  existing.forEach((d) => {
    if (counters[d.id] !== undefined) counters[d.id] = Math.max(counters[d.id], Number(d.data().seq) || 0);
  });
  Object.entries(counters).forEach(([base, seq]) => ops.push((b) => b.set(doc(db, COUNTERS, base), { seq })));

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
    if (onProgress) onProgress(Math.min(i + 400, ops.length), ops.length);
  }
  return ops.length;
}

/** 匯出全部開單資料，格式同本機版一樣，兩邊可以互相還原。 */
export async function exportBackup() {
  const { db } = getFirebase();
  const out = { app: 'todays-invoice', exportedAt: new Date().toISOString() };
  for (const [key, name] of Object.entries(INV_COLLECTIONS)) {
    const snap = await getDocs(collection(db, name));
    out[key] = {};
    snap.forEach((d) => {
      out[key][d.id] = d.data();
    });
  }
  const s = await getDoc(doc(db, CONFIG, SETTINGS_ID));
  out.settings = s.exists() ? s.data() : {};
  const c = await getDocs(collection(db, COUNTERS));
  out.counters = {};
  c.forEach((d) => {
    out.counters[d.id] = Number(d.data().seq) || 0;
  });
  return out;
}
