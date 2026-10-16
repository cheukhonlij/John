// Checks firestore.rules against the Firestore + Auth emulators.
// Run with `bun run test:rules`, which starts the emulators, runs this file and
// stops them again. Exits non-zero if any rule behaves unexpectedly.

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  setDoc,
  setLogLevel,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

setLogLevel('silent');

const PROJECT_ID = 'demo-staff-ops';
const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const client = (name) => {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT_ID, appId: 'demo' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { auth, db };
};

let failures = 0;
const expect = async (label, shouldSucceed, fn) => {
  try {
    await fn();
    if (shouldSucceed) console.log('ok    ', label);
    else {
      failures++;
      console.log('FAIL  ', label, '(was allowed)');
    }
  } catch (err) {
    const denied = String(err.code || err.message).includes('permission');
    if (!shouldSucceed && denied) console.log('ok    ', label, '(denied)');
    else {
      failures++;
      console.log('FAIL  ', label, err.code || err.message);
    }
  }
};

const email = (username) => `${username}@staff.todaysfoodlab.app`;
const profile = (uid, username, role) => ({ uid, username, employeeId: '', role, createdAt: 'test' });

const stranger = client('stranger');
const manager = client('manager');
const staff = client('staff');
const rogue = client('rogue');

await expect('stranger can see whether setup is done', true, () => getDoc(doc(stranger.db, 'config', 'bootstrap')));
await expect('stranger cannot read employees', false, () => getDocs(collection(stranger.db, 'employees')));

const m = await createUserWithEmailAndPassword(manager.auth, email('boss'), 'secret123');
await expect('first account claims manager', true, async () => {
  const batch = writeBatch(manager.db);
  batch.set(doc(manager.db, 'users', m.user.uid), profile(m.user.uid, 'boss', 'manager'));
  batch.set(doc(manager.db, 'config', 'bootstrap'), { by: m.user.uid });
  await batch.commit();
});

const r = await createUserWithEmailAndPassword(rogue.auth, email('rogue'), 'secret123');
await expect('second account cannot claim manager', false, async () => {
  const batch = writeBatch(rogue.db);
  batch.set(doc(rogue.db, 'users', r.user.uid), profile(r.user.uid, 'rogue', 'manager'));
  batch.set(doc(rogue.db, 'config', 'bootstrap'), { by: r.user.uid });
  await batch.commit();
});
await expect('account without a profile cannot read', false, () => getDocs(collection(rogue.db, 'employees')));
await expect('account cannot give itself a staff profile', false, () =>
  setDoc(doc(rogue.db, 'users', r.user.uid), profile(r.user.uid, 'rogue', 'staff'))
);

await expect('manager writes employees', true, () => setDoc(doc(manager.db, 'employees', 'e1'), { id: 'e1' }));
await expect('manager writes shifts', true, () => setDoc(doc(manager.db, 'shifts', 's1'), { id: 's1', date: '2026-10-10' }));
await expect('manager writes approved leave', true, () =>
  setDoc(doc(manager.db, 'leaves', 'l-approved'), { id: 'l-approved', status: 'approved' })
);

const s = await createUserWithEmailAndPassword(staff.auth, email('meiling'), 'secret123');
await expect('manager creates a staff profile', true, () =>
  setDoc(doc(manager.db, 'users', s.user.uid), profile(s.user.uid, 'meiling', 'staff'))
);

await expect('staff reads employees', true, () => getDocs(collection(staff.db, 'employees')));
await expect('staff cannot edit employees', false, () => setDoc(doc(staff.db, 'employees', 'e9'), { id: 'e9' }));
await expect('staff cannot edit shifts', false, () => setDoc(doc(staff.db, 'shifts', 's2'), { id: 's2' }));
await expect('staff cannot edit SOPs', false, () => setDoc(doc(staff.db, 'sops', 'x'), { id: 'x' }));
await expect('staff cannot edit workflow tasks', false, () => setDoc(doc(staff.db, 'workflowTasks', 'x'), { id: 'x' }));
await expect('staff cannot change settings', false, () => setDoc(doc(staff.db, 'config', 'settings'), { companyName: 'x' }));
await expect('staff cannot promote themselves', false, () => updateDoc(doc(staff.db, 'users', s.user.uid), { role: 'manager' }));
await expect('staff ticks workflow', true, () => setDoc(doc(staff.db, 'workflowChecks', 'c1'), { id: 'c1' }));
await expect('staff records a movement with its stock total', true, async () => {
  const batch = writeBatch(staff.db);
  batch.set(doc(staff.db, 'movements', 'mv1'), { id: 'mv1', itemId: 'p1', qty: -3, date: '2026-10-10' });
  batch.set(doc(staff.db, 'stockLevels', 'p1'), { itemId: 'p1', qty: increment(-3) }, { merge: true });
  await batch.commit();
});
await expect('staff cannot delete movements', false, () => deleteDoc(doc(staff.db, 'movements', 'mv1')));
await expect('staff requests leave as pending', true, () =>
  setDoc(doc(staff.db, 'leaves', 'l-pending'), { id: 'l-pending', status: 'pending' })
);
await expect('staff cannot self-approve leave', false, () =>
  setDoc(doc(staff.db, 'leaves', 'l-bad'), { id: 'l-bad', status: 'approved' })
);
await expect('staff cannot approve existing leave', false, () =>
  updateDoc(doc(staff.db, 'leaves', 'l-pending'), { status: 'approved' })
);
await expect('staff cannot delete approved leave', false, () => deleteDoc(doc(staff.db, 'leaves', 'l-approved')));
await expect('staff cancels pending leave', true, () => deleteDoc(doc(staff.db, 'leaves', 'l-pending')));

// ---- Invoice system (開單台): owner only ----
await expect('owner writes an invoice', true, () =>
  setDoc(doc(manager.db, 'invInvoices', 'inv1'), { no: '20261610001', lines: [{ name: 'x', qty: 1, price: 10 }] })
);
await expect('owner writes a customer with prices', true, () =>
  setDoc(doc(manager.db, 'invCustomers', 'c1'), { name: 'Shop', prices: { p1: 9 } })
);
await expect('owner writes items, tickets, settings and counters', true, async () => {
  const batch = writeBatch(manager.db);
  batch.set(doc(manager.db, 'invItems', 'p1'), { name: 'item', price: 22.8 });
  batch.set(doc(manager.db, 'invTickets', 't1'), { customerId: 'c1', qtyPaid: 45 });
  batch.set(doc(manager.db, 'invConfig', 'settings'), { brand: 'x' });
  batch.set(doc(manager.db, 'invCounters', '20261610'), { seq: 1 });
  await batch.commit();
});
await expect('owner reads invoices', true, () => getDocs(collection(manager.db, 'invInvoices')));
await expect('owner reads customers', true, () => getDoc(doc(manager.db, 'invCustomers', 'c1')));

const manager2 = client('manager2');
const m2 = await createUserWithEmailAndPassword(manager2.auth, email('supervisor'), 'secret123');
await expect('owner creates a second manager', true, () =>
  setDoc(doc(manager.db, 'users', m2.user.uid), profile(m2.user.uid, 'supervisor', 'manager'))
);
await expect('second manager still runs staff ops', true, () => setDoc(doc(manager2.db, 'shifts', 's9'), { id: 's9' }));
await expect('second manager cannot read invoices', false, () => getDocs(collection(manager2.db, 'invInvoices')));
await expect('second manager cannot read one invoice', false, () => getDoc(doc(manager2.db, 'invInvoices', 'inv1')));
await expect('second manager cannot read customers', false, () => getDocs(collection(manager2.db, 'invCustomers')));
await expect('second manager cannot read items', false, () => getDocs(collection(manager2.db, 'invItems')));
await expect('second manager cannot write invoices', false, () => setDoc(doc(manager2.db, 'invInvoices', 'x'), { no: 'x' }));
await expect('second manager cannot change counters', false, () => setDoc(doc(manager2.db, 'invCounters', '20261610'), { seq: 99 }));
await expect('second manager cannot take over setup', false, () => setDoc(doc(manager2.db, 'config', 'bootstrap'), { by: m2.user.uid }));
await expect('staff cannot read invoices', false, () => getDocs(collection(staff.db, 'invInvoices')));
await expect('staff cannot read customers', false, () => getDoc(doc(staff.db, 'invCustomers', 'c1')));
await expect('staff cannot read invoice settings', false, () => getDoc(doc(staff.db, 'invConfig', 'settings')));
await expect('staff cannot write tickets', false, () => setDoc(doc(staff.db, 'invTickets', 't2'), { qtyPaid: 1 }));
await expect('stranger cannot read invoices', false, () => getDocs(collection(stranger.db, 'invInvoices')));
await expect('account without a profile cannot read invoices', false, () => getDocs(collection(rogue.db, 'invInvoices')));

await expect('manager disables the staff account', true, () => updateDoc(doc(manager.db, 'users', s.user.uid), { role: 'disabled' }));
await expect('disabled account cannot read', false, () => getDocs(collection(staff.db, 'employees')));

console.log(failures ? `\n${failures} rule check(s) failed` : '\nall rule checks passed');
process.exit(failures ? 1 : 0);
