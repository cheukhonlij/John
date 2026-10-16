import { useCallback, useEffect, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  User,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  QueryConstraint,
  WriteBatch,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { firebaseConfig, getFirebase } from './firebase';
import { StockMovement } from '../types';
import { STORAGE_KEYS } from '../utils/storage';

// ---------- Collections ----------

export const COLLECTIONS = {
  employees: 'employees',
  shiftTemplates: 'shiftTemplates',
  shifts: 'shifts',
  leaves: 'leaves',
  holidays: 'holidays',
  workflowTasks: 'workflowTasks',
  workflowChecks: 'workflowChecks',
  sops: 'sops',
  stockItems: 'stockItems',
  movements: 'movements',
  stockLevels: 'stockLevels',
  users: 'users',
  config: 'config',
} as const;

// Backups use the same localStorage keys in both modes, so a browser-only
// backup can be restored into the cloud and vice versa.
export const BACKUP_KEY_TO_COLLECTION: Record<string, string> = {
  [STORAGE_KEYS.EMPLOYEES]: COLLECTIONS.employees,
  [STORAGE_KEYS.SHIFT_TEMPLATES]: COLLECTIONS.shiftTemplates,
  [STORAGE_KEYS.ROSTER]: COLLECTIONS.shifts,
  [STORAGE_KEYS.LEAVES]: COLLECTIONS.leaves,
  [STORAGE_KEYS.HOLIDAYS]: COLLECTIONS.holidays,
  [STORAGE_KEYS.WORKFLOW_TASKS]: COLLECTIONS.workflowTasks,
  [STORAGE_KEYS.WORKFLOW_CHECKS]: COLLECTIONS.workflowChecks,
  [STORAGE_KEYS.SOPS]: COLLECTIONS.sops,
  [STORAGE_KEYS.STOCK_ITEMS]: COLLECTIONS.stockItems,
  [STORAGE_KEYS.MOVEMENTS]: COLLECTIONS.movements,
};

/** Document id for a record; holidays are keyed by date, everything else by id. */
export const docIdOf = (collectionName: string, item: Record<string, unknown>): string =>
  String(collectionName === COLLECTIONS.holidays ? item.date : item.id);

const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = (v as Record<string, unknown>)[k];
            return acc;
          }, {})
      : v
  );

export const reportWriteError = (err: unknown) => {
  console.error(err);
  const code = (err as { code?: string })?.code;
  alert(code === 'permission-denied' ? '儲存失敗：你冇權限做呢個改動。' : '儲存失敗，請檢查網絡後再試。');
};

const commitInChunks = async (ops: ((batch: WriteBatch) => void)[]) => {
  const { db } = getFirebase();
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
};

export interface CollectionChange<T> {
  added: T[];
  changed: [T, T][];
  removed: T[];
}

interface CloudCollectionOptions<T> {
  /** Union of these queries is kept live; omit to listen to the whole collection. */
  queries?: QueryConstraint[][];
  /** Re-subscribes when this changes (e.g. a widened date window). */
  queryKey?: string;
  sort?: (a: T, b: T) => number;
  /** Extra writes committed alongside the records, e.g. stock level totals. */
  extraOps?: (change: CollectionChange<T>) => ((batch: WriteBatch) => void)[];
}

/**
 * Live Firestore collection exposed with the same "save the whole array" API
 * the screens use in local mode. Saving diffs against the records this render
 * saw, so records another device added in the meantime are never deleted.
 */
export const useCloudCollection = <T extends object>(name: string, options: CloudCollectionOptions<T> = {}) => {
  const { queries, queryKey = '', sort, extraOps } = options;
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const { db } = getFirebase();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const queryList = queries && queries.length ? queries : [[]];
    const parts: Map<string, T>[] = queryList.map(() => new Map());
    const loaded = new Set<number>();
    const unsubscribes = queryList.map((constraints, i) =>
      onSnapshot(
        query(collection(db, name), ...constraints),
        (snap) => {
          const part = new Map<string, T>();
          snap.forEach((d) => part.set(d.id, d.data() as T));
          parts[i] = part;
          loaded.add(i);
          const merged = new Map<string, T>();
          parts.forEach((p) => p.forEach((v, k) => merged.set(k, v)));
          const list = Array.from(merged.entries())
            .sort(([a], [b]) => naturalCompare(a, b))
            .map(([, v]) => v);
          setItems(sort ? list.sort(sort) : list);
          if (loaded.size === queryList.length) setReady(true);
        },
        (err) => {
          // A refused listener stops for good, e.g. if it started a moment before
          // a new account's access landed, so try again shortly.
          console.error(`Listening to ${name} failed`, err);
          setReady(true);
          if (attempt < 5) retryTimer = setTimeout(() => setAttempt((a) => a + 1), 2000 * (attempt + 1));
        }
      )
    );
    return () => {
      clearTimeout(retryTimer);
      unsubscribes.forEach((u) => u());
    };
    // queries are rebuilt every render; queryKey says when they actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, queryKey, attempt]);

  const saveAll = useCallback(
    (next: T[]) => {
      const { db } = getFirebase();
      const idOf = (item: T) => docIdOf(name, item as Record<string, unknown>);
      const prevMap = new Map(items.map((i) => [idOf(i), i]));
      const nextMap = new Map(next.map((i) => [idOf(i), i]));
      const change: CollectionChange<T> = { added: [], changed: [], removed: [] };
      nextMap.forEach((item, id) => {
        const prev = prevMap.get(id);
        if (!prev) change.added.push(item);
        else if (stableStringify(prev) !== stableStringify(item)) change.changed.push([prev, item]);
      });
      prevMap.forEach((item, id) => {
        if (!nextMap.has(id)) change.removed.push(item);
      });

      const ops: ((batch: WriteBatch) => void)[] = [
        ...[...change.added, ...change.changed.map(([, n]) => n)].map((item) => (batch: WriteBatch) =>
          batch.set(doc(db, name, idOf(item)), item)
        ),
        ...change.removed.map((item) => (batch: WriteBatch) => batch.delete(doc(db, name, idOf(item)))),
        ...(extraOps ? extraOps(change) : []),
      ];
      if (ops.length) commitInChunks(ops).catch(reportWriteError);
    },
    [items, name, extraOps]
  );

  return [items, saveAll, ready] as const;
};

export const useCloudDoc = <T extends object>(collectionName: string, id: string, fallback: T) => {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const { db } = getFirebase();
    return onSnapshot(doc(db, collectionName, id), (snap) => {
      if (snap.exists()) setValue({ ...fallback, ...(snap.data() as T) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, id]);
  const save = useCallback(
    (next: T) => {
      const { db } = getFirebase();
      setDoc(doc(db, collectionName, id), next).catch(reportWriteError);
    },
    [collectionName, id]
  );
  return [value, save] as const;
};

// ---------- Stock levels ----------
// Totals live in stockLevels/{itemId} ({ itemId, qty }) and move with every
// stock movement, so devices only need recent movements, not the full history.

export interface StockLevelDoc {
  itemId: string;
  qty: number;
}

export const stockLevelOps = (change: CollectionChange<StockMovement>) => {
  const { db } = getFirebase();
  const delta = new Map<string, number>();
  const add = (itemId: string, qty: number) => delta.set(itemId, (delta.get(itemId) || 0) + qty);
  change.added.forEach((m) => add(m.itemId, m.qty));
  change.removed.forEach((m) => add(m.itemId, -m.qty));
  change.changed.forEach(([prev, next]) => {
    add(prev.itemId, -prev.qty);
    add(next.itemId, next.qty);
  });
  return Array.from(delta.entries())
    .filter(([, d]) => d !== 0)
    .map(([itemId, d]) => (batch: WriteBatch) =>
      batch.set(doc(db, COLLECTIONS.stockLevels, itemId), { itemId, qty: increment(d) }, { merge: true })
    );
};

/** Rebuilds every stock total from the full movement history (manager tool). */
export const recomputeStockLevels = async () => {
  const { db } = getFirebase();
  const [movementsSnap, levelsSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.movements)),
    getDocs(collection(db, COLLECTIONS.stockLevels)),
  ]);
  const totals = new Map<string, number>();
  movementsSnap.forEach((d) => {
    const m = d.data() as StockMovement;
    totals.set(m.itemId, (totals.get(m.itemId) || 0) + m.qty);
  });
  const ops: ((batch: WriteBatch) => void)[] = [];
  totals.forEach((qty, itemId) =>
    ops.push((batch) =>
      batch.set(doc(db, COLLECTIONS.stockLevels, itemId), { itemId, qty: Math.round(qty * 1000) / 1000 })
    )
  );
  levelsSnap.forEach((d) => {
    if (!totals.has(d.id)) ops.push((batch) => batch.delete(d.ref));
  });
  await commitInChunks(ops);
  return totals.size;
};

// ---------- Backup ----------

export const exportCloudBackup = async () => {
  const { db } = getFirebase();
  const entries = await Promise.all(
    Object.entries(BACKUP_KEY_TO_COLLECTION).map(async ([key, name]) => {
      const snap = await getDocs(collection(db, name));
      return [key, snap.docs.map((d) => d.data())] as const;
    })
  );
  const settingsSnap = await getDoc(doc(db, COLLECTIONS.config, 'settings'));
  return {
    app: 'todays-staff-ops',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      ...Object.fromEntries(entries),
      ...(settingsSnap.exists() ? { [STORAGE_KEYS.SETTINGS]: settingsSnap.data() } : {}),
    },
  };
};

/** Writes backup records into Firestore (adds or overwrites by id; nothing is deleted). */
export const importBackupToCloud = async (json: string): Promise<number> => {
  const { db } = getFirebase();
  const parsed = JSON.parse(json);
  if (parsed?.app !== 'todays-staff-ops' || typeof parsed.data !== 'object') throw new Error('bad backup');
  const ops: ((batch: WriteBatch) => void)[] = [];
  Object.entries(parsed.data as Record<string, unknown>).forEach(([key, value]) => {
    const name = BACKUP_KEY_TO_COLLECTION[key];
    if (!name || !Array.isArray(value)) return;
    value.forEach((item: Record<string, unknown>) => {
      const id = docIdOf(name, item);
      if (id && id !== 'undefined') ops.push((batch) => batch.set(doc(db, name, id), item));
    });
  });
  await commitInChunks(ops);
  await recomputeStockLevels();
  return ops.length;
};

// ---------- Accounts ----------

export type UserRole = 'manager' | 'staff' | 'disabled';

export interface UserProfile {
  uid: string;
  username: string;
  employeeId: string;
  role: UserRole;
  createdAt: string;
}

// Staff sign in with a username; Firebase Auth needs an email, so usernames
// map onto this placeholder domain (no email is ever sent to it).
const STAFF_EMAIL_DOMAIN = 'staff.todaysfoodlab.app';

export const normaliseUsername = (username: string) => username.trim().toLowerCase();

export const usernameToEmail = (username: string) => {
  const u = normaliseUsername(username);
  return u.includes('@') ? u : `${u}@${STAFF_EMAIL_DOMAIN}`;
};

export const isValidUsername = (username: string) => /^[a-z0-9._-]{3,30}$/.test(normaliseUsername(username));

export const authErrorMessage = (err: unknown): string => {
  const code = (err as { code?: string })?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return '用戶名或密碼唔啱';
  if (code.includes('email-already-in-use')) return '呢個用戶名已經有人用';
  if (code.includes('weak-password')) return '密碼最少要 6 個字';
  if (code.includes('too-many-requests')) return '試得太多次，請稍後再試';
  if (code.includes('network')) return '網絡有問題，請檢查連線';
  if (code.includes('permission-denied')) return '冇權限做呢個動作';
  return '發生錯誤，請再試';
};

export const useAuthSession = () => {
  // undefined = still loading
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(getFirebase().auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setProfile(user === null ? null : undefined);
      return;
    }
    setProfile(undefined);
    return onSnapshot(
      doc(getFirebase().db, COLLECTIONS.users, user.uid),
      { includeMetadataChanges: true },
      (snap) => {
        // Only trust what the server has confirmed: right after first-time
        // setup the profile exists locally before the rules can see it.
        if (snap.metadata.hasPendingWrites || (!snap.exists() && snap.metadata.fromCache)) return;
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      },
      () => setProfile(null)
    );
  }, [user]);

  return { user, profile };
};

export const signIn = (username: string, password: string) =>
  signInWithEmailAndPassword(getFirebase().auth, usernameToEmail(username), password);

export const signOutUser = () => signOut(getFirebase().auth);

export const changeOwnPassword = async (currentPassword: string, newPassword: string) => {
  const user = getFirebase().auth.currentUser;
  if (!user?.email) throw new Error('not signed in');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
};

export const isSetupDone = async () =>
  (await getDoc(doc(getFirebase().db, COLLECTIONS.config, 'bootstrap'))).exists();

/**
 * The owner is the account that did first-time setup. Only the owner sees the
 * invoice page (開單台); firestore.rules (isOwner) is what actually enforces it.
 */
export const getOwnerUid = async (): Promise<string | null> => {
  const snap = await getDoc(doc(getFirebase().db, COLLECTIONS.config, 'bootstrap'));
  const by: unknown = snap.exists() ? snap.data().by : null;
  return typeof by === 'string' ? by : null;
};

/**
 * First-time setup: creates the owner's login and claims the manager role.
 * Security rules allow this exactly once (while config/bootstrap is absent).
 */
export const claimFirstManager = async (username: string, password: string, employeeId: string) => {
  const { auth, db } = getFirebase();
  const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
  const profile: UserProfile = {
    uid: cred.user.uid,
    username: normaliseUsername(username),
    employeeId,
    role: 'manager',
    createdAt: new Date().toISOString(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.users, cred.user.uid), profile);
  batch.set(doc(db, COLLECTIONS.config, 'bootstrap'), { by: cred.user.uid, at: profile.createdAt });
  await batch.commit();
};

/** Seeds records as the signed-in manager (used right after first-time setup). */
export const seedCollections = async (records: { collection: string; items: object[] }[]) => {
  const { db } = getFirebase();
  const ops: ((batch: WriteBatch) => void)[] = [];
  records.forEach(({ collection: name, items }) =>
    items.forEach((item) =>
      ops.push((batch) => batch.set(doc(db, name, docIdOf(name, item as Record<string, unknown>)), item))
    )
  );
  await commitInChunks(ops);
};

let accountAdminAuth: ReturnType<typeof initializeAuth> | null = null;

/**
 * Creates a login for a staff member without signing the manager out: the
 * account is created through a second, in-memory Firebase app instance.
 */
export const createStaffAccount = async (username: string, password: string, employeeId: string, role: UserRole) => {
  const { db, useEmulator } = getFirebase();
  if (!accountAdminAuth) {
    const secondary = getApps().find((a) => a.name === 'account-admin') || initializeApp(firebaseConfig, 'account-admin');
    accountAdminAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
    if (useEmulator) connectAuthEmulator(accountAdminAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  const cred = await createUserWithEmailAndPassword(accountAdminAuth, usernameToEmail(username), password);
  const profile: UserProfile = {
    uid: cred.user.uid,
    username: normaliseUsername(username),
    employeeId,
    role,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, COLLECTIONS.users, cred.user.uid), profile);
  await signOut(accountAdminAuth);
  return profile;
};

export const updateUserRole = (uid: string, role: UserRole) =>
  updateDoc(doc(getFirebase().db, COLLECTIONS.users, uid), { role });

export const updateUserEmployee = (uid: string, employeeId: string) =>
  updateDoc(doc(getFirebase().db, COLLECTIONS.users, uid), { employeeId });
