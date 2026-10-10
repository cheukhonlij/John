import React, { useEffect, useState } from 'react';
import { KeyRound, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { Employee } from '../types';
import {
  DEFAULT_HOLIDAYS,
  DEFAULT_SETTINGS,
  DEFAULT_SHIFT_TEMPLATES,
  DEFAULT_SOPS,
  DEFAULT_STOCK_ITEMS,
  DEFAULT_WORKFLOW_TASKS,
} from '../data/defaults';
import {
  COLLECTIONS,
  authErrorMessage,
  changeOwnPassword,
  claimFirstManager,
  isSetupDone,
  isValidUsername,
  seedCollections,
  signIn,
  signOutUser,
} from '../lib/cloud';
import { todayISO } from '../utils/dates';
import { Field, Modal, inputClass, newId, primaryButtonClass, secondaryButtonClass } from './ui';

const AuthCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <div className="bg-white border-2 border-slate-900 shadow-xl w-full max-w-sm p-7 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-slate-900 text-white flex items-center justify-center font-black tracking-tighter">TL</div>
        <div>
          <div className="font-black text-lg tracking-tight uppercase">{DEFAULT_SETTINGS.companyName}</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">員工營運系統</p>
        </div>
      </div>
      <div>
        <h1 className="text-xl font-black">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-medium mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
);

export const LoadingScreen: React.FC<{ label?: string }> = ({ label = '載入中…' }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex items-center gap-3 text-slate-500 font-black text-sm">
      <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
      {label}
    </div>
  </div>
);

export const LoginScreen: React.FC = () => {
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isSetupDone()
      .then((done) => {
        setSetupNeeded(!done);
        if (!done) setMode('setup');
      })
      .catch(() => setSetupNeeded(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('請輸入你嘅姓名');
    if (!isValidUsername(username)) return setError('用戶名要 3–30 個英文字母、數字、. _ -');
    if (password.length < 6) return setError('密碼最少要 6 個字');
    if (password !== confirm) return setError('兩次輸入嘅密碼唔一樣');
    setBusy(true);
    try {
      const employee: Employee = {
        id: newId('emp'),
        name: name.trim(),
        position: '主管',
        employmentType: 'full_time',
        joinDate: todayISO(),
        restDays: [0],
        color: 'blue',
        isActive: true,
      };
      await claimFirstManager(username, password, employee.id);
      // Starter content so the team isn't facing empty screens: the owner's own
      // staff record, plus SOPs, daily workflow, stock list, shifts and holidays.
      await seedCollections([
        { collection: COLLECTIONS.employees, items: [employee] },
        { collection: COLLECTIONS.shiftTemplates, items: DEFAULT_SHIFT_TEMPLATES },
        { collection: COLLECTIONS.holidays, items: DEFAULT_HOLIDAYS },
        { collection: COLLECTIONS.workflowTasks, items: DEFAULT_WORKFLOW_TASKS },
        { collection: COLLECTIONS.sops, items: DEFAULT_SOPS },
        // Sample safety-stock levels would flag everything as low before any real
        // stock is entered, so the manager sets real levels later.
        { collection: COLLECTIONS.stockItems, items: DEFAULT_STOCK_ITEMS.map(({ reorderLevel: _unused, ...item }) => item) },
      ]);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  if (setupNeeded === null) return <LoadingScreen />;

  if (mode === 'setup') {
    return (
      <AuthCard title="首次設定" subtitle="建立第一個主管帳戶。之後同事嘅帳戶由主管喺「設定 → 員工帳戶」開。">
        <form onSubmit={handleSetup} className="space-y-3">
          <Field label="你嘅姓名" required>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="用戶名" required hint="英文字母或數字，例如 john">
            <input className={`${inputClass} font-mono`} autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="密碼" required>
            <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="再輸入一次密碼" required>
            <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
          <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full justify-center`}>
            <ShieldCheck className="w-4 h-4" />
            {busy ? '設定中…' : '建立主管帳戶'}
          </button>
          <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer">
            已經有帳戶？登入
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="登入">
      <form onSubmit={handleLogin} className="space-y-3">
        <Field label="用戶名">
          <input className={`${inputClass} font-mono`} autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </Field>
        <Field label="密碼">
          <input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
        <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full justify-center`}>
          <LogIn className="w-4 h-4" />
          {busy ? '登入中…' : '登入'}
        </button>
        <p className="text-[11px] text-slate-400 font-medium text-center">冇帳戶或者忘記密碼，請搵主管。</p>
        {setupNeeded && (
          <button type="button" onClick={() => setMode('setup')} className="w-full text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer">
            首次設定
          </button>
        )}
      </form>
    </AuthCard>
  );
};

export const NoAccessScreen: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <AuthCard
    title={disabled ? '帳戶已停用' : '帳戶未開通'}
    subtitle={disabled ? '如有需要請搵主管。' : '呢個帳戶未有使用權限，請搵主管喺「設定 → 員工帳戶」開通。'}
  >
    <button onClick={() => signOutUser()} className={`${secondaryButtonClass} w-full justify-center`}>
      <LogOut className="w-4 h-4" />
      登出
    </button>
  </AuthCard>
);

export const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 6) return setError('新密碼最少要 6 個字');
    if (next !== confirm) return setError('兩次輸入嘅新密碼唔一樣');
    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal eyebrow="ACCOUNT" title="改密碼" onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm font-bold text-emerald-700">✓ 密碼已更新。</p>
          <button onClick={onClose} className={`${primaryButtonClass} w-full justify-center`}>
            完成
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="現時密碼">
            <input type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
          </Field>
          <Field label="新密碼">
            <input type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="再輸入一次新密碼">
            <input type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
          <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full justify-center`}>
            <KeyRound className="w-4 h-4" />
            更新密碼
          </button>
        </form>
      )}
    </Modal>
  );
};
