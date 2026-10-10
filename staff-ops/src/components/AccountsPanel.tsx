import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Employee } from '../types';
import {
  COLLECTIONS,
  UserProfile,
  UserRole,
  authErrorMessage,
  createStaffAccount,
  isValidUsername,
  reportWriteError,
  updateUserEmployee,
  updateUserRole,
  useCloudCollection,
} from '../lib/cloud';
import { Field, Panel, inputClass, primaryButtonClass } from './ui';

const ROLE_LABELS: Record<UserRole, string> = {
  manager: '主管',
  staff: '員工',
  disabled: '已停用',
};

export const AccountsPanel: React.FC<{ employees: Employee[]; currentUid: string }> = ({ employees, currentUid }) => {
  const [users] = useCloudCollection<UserProfile>(COLLECTIONS.users);
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const activeEmployees = employees.filter((e) => e.isActive);
  const linkedIds = new Set(users.filter((u) => u.role !== 'disabled').map((u) => u.employeeId));
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name || '（未連結員工）';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!employeeId) return setError('請揀員工');
    if (!isValidUsername(username)) return setError('用戶名要 3–30 個英文字母、數字、. _ -');
    if (password.length < 6) return setError('密碼最少要 6 個字');
    setBusy(true);
    try {
      const profile = await createStaffAccount(username, password, employeeId, role);
      setMessage(`已開帳戶：${profile.username}（${employeeName(employeeId)}）。請將用戶名同密碼交俾同事，佢登入後可以自己改密碼。`);
      setUsername('');
      setPassword('');
      setEmployeeId('');
      setRole('staff');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="員工帳戶">
      <div className="p-5 space-y-5">
        <form onSubmit={handleCreate} className="space-y-3 border border-slate-200 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">開新帳戶</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="員工" required>
              <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">揀員工…</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {linkedIds.has(emp.id) ? '（已有帳戶）' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="權限">
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="staff">員工</option>
                <option value="manager">主管</option>
              </select>
            </Field>
            <Field label="用戶名" required hint="英文字母或數字，例如 meiling">
              <input className={`${inputClass} font-mono`} autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="初始密碼" required hint="最少 6 個字">
              <input className={`${inputClass} font-mono`} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>
          {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
          {message && <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5">✓ {message}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={primaryButtonClass}>
              <UserPlus className="w-4 h-4" />
              {busy ? '開緊…' : '開帳戶'}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">用戶名</th>
                <th className="py-2.5 px-3">員工</th>
                <th className="py-2.5 px-3">權限</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.uid} className={u.role === 'disabled' ? 'opacity-50' : ''}>
                  <td className="py-2.5 px-3 font-mono font-bold">{u.username}</td>
                  <td className="py-2.5 px-3">
                    <select
                      className="text-sm font-bold border border-slate-200 px-2 py-1 bg-white"
                      value={u.employeeId}
                      onChange={(e) => updateUserEmployee(u.uid, e.target.value).catch(reportWriteError)}
                    >
                      {!employees.some((emp) => emp.id === u.employeeId) && <option value={u.employeeId}>（未連結）</option>}
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.uid === currentUid ? (
                      <span className="text-xs font-black">{ROLE_LABELS[u.role]}（你自己）</span>
                    ) : (
                      <select
                        className="text-sm font-bold border border-slate-200 px-2 py-1 bg-white"
                        value={u.role}
                        onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole).catch(reportWriteError)}
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          同事忘記密碼：將舊帳戶改做「已停用」，再幫佢開一個新用戶名。同事登入後可以喺頁頂「改密碼」。
        </p>
      </div>
    </Panel>
  );
};
