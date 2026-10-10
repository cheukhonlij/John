import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, Plus, Trash2, X } from 'lucide-react';
import { Employee, Holiday, LeaveRecord, LeaveStatus, LeaveType } from '../types';
import { STAFF_COLORS } from '../data/defaults';
import { formatDateZh, formatNumber, todayISO, weekdayOf, WEEKDAY_LABELS } from '../utils/dates';
import {
  LEAVE_STATUS_LABELS,
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  MAX_SICK_DAYS,
  annualLeaveSummary,
  countLeaveDays,
  sickLeaveSummary,
} from '../utils/leave';
import { serviceLabel } from './StaffManager';
import {
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  TabBar,
  inputClass,
  newId,
  primaryButtonClass,
  secondaryButtonClass,
} from './ui';

interface LeaveManagerProps {
  employees: Employee[];
  leaves: LeaveRecord[];
  holidays: Holiday[];
  isManager: boolean;
  currentUserId: string;
  onSaveLeaves: (leaves: LeaveRecord[]) => void;
  onSaveHolidays: (holidays: Holiday[]) => void;
}

type LeaveTab = 'records' | 'balances' | 'holidays';

const STATUS_BADGE: Record<LeaveStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-300',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  rejected: 'bg-slate-100 text-slate-500 border-slate-300 line-through',
};

export const LeaveManager: React.FC<LeaveManagerProps> = ({
  employees,
  leaves,
  holidays,
  isManager,
  currentUserId,
  onSaveLeaves,
  onSaveHolidays,
}) => {
  const today = todayISO();
  const [tab, setTab] = useState<LeaveTab>('records');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [form, setForm] = useState<LeaveRecord | null>(null);

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name || '（已刪除員工）';
  const activeEmployees = employees.filter((e) => e.isActive);
  const pendingCount = leaves.filter((l) => l.status === 'pending').length;

  const visibleLeaves = leaves
    .filter((l) => statusFilter === 'all' || l.status === statusFilter)
    .filter((l) => employeeFilter === 'all' || l.employeeId === employeeFilter)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const openNew = () => {
    const defaultEmployee = activeEmployees.find((e) => e.id === currentUserId) || activeEmployees[0];
    if (!defaultEmployee) return alert('請先新增員工。');
    setForm({
      id: '',
      employeeId: defaultEmployee.id,
      type: 'annual',
      startDate: today,
      endDate: today,
      days: countLeaveDays(today, today, defaultEmployee.restDays, holidays),
      status: isManager ? 'approved' : 'pending',
      reason: '',
      createdAt: '',
    });
  };

  const setStatus = (id: string, status: LeaveStatus) =>
    onSaveLeaves(leaves.map((l) => (l.id === id ? { ...l, status } : l)));

  const handleDelete = (leave: LeaveRecord) => {
    const verb = leave.status === 'pending' && !isManager ? '取消' : '刪除';
    if (confirm(`確定${verb} ${employeeName(leave.employeeId)} 嘅${LEAVE_TYPE_LABELS[leave.type]}（${leave.startDate}）？`)) {
      onSaveLeaves(leaves.filter((l) => l.id !== leave.id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="LEAVE MANAGEMENT"
        title="假期"
        subtitle="申請及批核假期、按《僱傭條例》計算年假同病假結餘、法定假日表。"
        actions={
          <button onClick={openNew} className={primaryButtonClass}>
            <Plus className="w-4 h-4 text-emerald-400" />
            {isManager ? '新增假期' : '申請假期'}
          </button>
        }
      />

      <TabBar
        tabs={[
          { id: 'records' as const, label: '申請及紀錄', count: pendingCount || undefined },
          { id: 'balances' as const, label: '假期結餘' },
          { id: 'holidays' as const, label: '法定假日' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'records' && (
        <Panel
          title={`假期紀錄 (${visibleLeaves.length})`}
          actions={
            <>
              <select className="text-xs font-bold border border-slate-200 px-2 py-1.5" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | LeaveStatus)}>
                <option value="all">全部狀態</option>
                <option value="pending">待批</option>
                <option value="approved">已批</option>
                <option value="rejected">已拒</option>
              </select>
              <select className="text-xs font-bold border border-slate-200 px-2 py-1.5" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                <option value="all">全部員工</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </>
          }
        >
          {visibleLeaves.length === 0 ? (
            <EmptyState title="冇假期紀錄" />
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleLeaves.map((l) => {
                const emp = employees.find((e) => e.id === l.employeeId);
                return (
                  <div key={l.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${STAFF_COLORS[emp?.color || 'slate']?.dot}`} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black">{employeeName(l.employeeId)}</span>
                          <span className="text-xs font-black bg-slate-900 text-white px-2 py-0.5">{LEAVE_TYPE_LABELS[l.type]}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 border ${STATUS_BADGE[l.status]}`}>
                            {LEAVE_STATUS_LABELS[l.status]}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-700 mt-0.5">
                          {formatDateZh(l.startDate)}
                          {l.endDate !== l.startDate && ` – ${formatDateZh(l.endDate)}`}
                          <span className="font-mono ml-2">{formatNumber(l.days)} 日</span>
                        </div>
                        {l.reason && <div className="text-xs text-slate-500">{l.reason}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isManager && l.status === 'pending' && (
                        <>
                          <button onClick={() => setStatus(l.id, 'approved')} className="px-2.5 py-1 text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            批准
                          </button>
                          <button onClick={() => setStatus(l.id, 'rejected')} className="px-2.5 py-1 text-xs font-black border border-slate-300 hover:bg-slate-100 cursor-pointer flex items-center gap-1">
                            <X className="w-3.5 h-3.5" />
                            拒絕
                          </button>
                        </>
                      )}
                      {isManager && (
                        <button onClick={() => setForm({ ...l })} className="px-2.5 py-1 text-xs font-black border border-slate-200 hover:bg-slate-900 hover:text-white cursor-pointer">
                          編輯
                        </button>
                      )}
                      {(isManager || l.status === 'pending') && (
                        <button onClick={() => handleDelete(l)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title={isManager ? '刪除' : '取消申請'}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {tab === 'balances' && <BalancesTab employees={activeEmployees} leaves={leaves} today={today} />}

      {tab === 'holidays' && <HolidaysTab holidays={holidays} isManager={isManager} onSave={onSaveHolidays} />}

      {form && (
        <LeaveForm
          initial={form}
          employees={form.id ? employees : activeEmployees}
          leaves={leaves}
          holidays={holidays}
          isManager={isManager}
          onClose={() => setForm(null)}
          onSubmit={(record) => {
            if (record.id) {
              onSaveLeaves(leaves.map((l) => (l.id === record.id ? record : l)));
            } else {
              onSaveLeaves([{ ...record, id: newId('lv'), createdAt: new Date().toISOString() }, ...leaves]);
            }
            setForm(null);
          }}
        />
      )}
    </div>
  );
};

const LeaveForm: React.FC<{
  initial: LeaveRecord;
  employees: Employee[];
  leaves: LeaveRecord[];
  holidays: Holiday[];
  isManager: boolean;
  onClose: () => void;
  onSubmit: (record: LeaveRecord) => void;
}> = ({ initial, employees, leaves, holidays, isManager, onClose, onSubmit }) => {
  const [form, setForm] = useState<LeaveRecord>(initial);
  const [halfDay, setHalfDay] = useState(initial.days === 0.5);
  const [error, setError] = useState('');
  const employee = employees.find((e) => e.id === form.employeeId);

  const autoDays = useMemo(() => {
    if (!employee || form.endDate < form.startDate) return 0;
    if (halfDay && form.startDate === form.endDate) return 0.5;
    return countLeaveDays(form.startDate, form.endDate, employee.restDays, holidays);
  }, [employee, form.startDate, form.endDate, halfDay, holidays]);

  // Recalculate the day count whenever the inputs that drive it change.
  const update = (patch: Partial<LeaveRecord>) => {
    const next = { ...form, ...patch };
    if (next.endDate < next.startDate) next.endDate = next.startDate;
    const emp = employees.find((e) => e.id === next.employeeId);
    if (emp && ('startDate' in patch || 'endDate' in patch || 'employeeId' in patch)) {
      next.days =
        halfDay && next.startDate === next.endDate ? 0.5 : countLeaveDays(next.startDate, next.endDate, emp.restDays, holidays);
    }
    setForm(next);
  };

  const otherLeaves = leaves.filter((l) => l.id !== form.id);
  const annual = employee && form.type === 'annual' ? annualLeaveSummary(employee, otherLeaves, form.startDate) : null;
  const sick = employee && form.type === 'sick' ? sickLeaveSummary(employee, otherLeaves, form.startDate) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return setError('請揀員工');
    if (form.endDate < form.startDate) return setError('結束日期唔可以早過開始日期');
    if (!(form.days > 0)) return setError('假期日數要大過 0（揀咗嘅日子可能全部係休息日或法定假日）');
    onSubmit({ ...form, reason: form.reason?.trim() });
  };

  return (
    <Modal eyebrow={form.id ? 'EDIT LEAVE' : 'LEAVE REQUEST'} title={form.id ? '編輯假期' : isManager ? '新增假期' : '申請假期'} onClose={onClose}>
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="員工" required>
            <select className={inputClass} value={form.employeeId} onChange={(e) => update({ employeeId: e.target.value })}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="假期類別" required>
            <select className={inputClass} value={form.type} onChange={(e) => update({ type: e.target.value as LeaveType })}>
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="由" required>
            <input type="date" className={`${inputClass} font-mono`} value={form.startDate} onChange={(e) => e.target.value && update({ startDate: e.target.value })} />
          </Field>
          <Field label="至" required>
            <input type="date" className={`${inputClass} font-mono`} value={form.endDate} min={form.startDate} onChange={(e) => e.target.value && update({ endDate: e.target.value })} />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {form.startDate === form.endDate && (
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer pb-2.5">
              <input
                type="checkbox"
                checked={halfDay}
                onChange={(e) => {
                  setHalfDay(e.target.checked);
                  setForm({
                    ...form,
                    days: e.target.checked
                      ? 0.5
                      : employee
                      ? countLeaveDays(form.startDate, form.endDate, employee.restDays, holidays)
                      : form.days,
                  });
                }}
              />
              半日
            </label>
          )}
          <Field label="日數" hint={`自動計算：${formatNumber(autoDays)} 日（已扣休息日及法定假日）`} className="flex-1">
            <input
              type="number"
              min="0"
              step="0.5"
              className={`${inputClass} font-mono`}
              value={form.days}
              onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
            />
          </Field>
        </div>

        {annual && (
          <div className={`text-xs p-3 border font-bold ${form.days > annual.balance ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            本假期年（{annual.leaveYearStart} 起）年假：應有 {annual.entitlement} 日，已放 {formatNumber(annual.used)} 日，
            待批 {formatNumber(annual.pending)} 日，餘 {formatNumber(annual.balance)} 日。
            {form.days > annual.balance && ' ⚠ 申請日數超過餘額。'}
            {annual.serviceYears < 1 && ' （未滿一年：法例上要做滿 12 個月先有第一份年假）'}
          </div>
        )}
        {sick && (
          <div className={`text-xs p-3 border font-bold ${form.days > sick.balance ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            累積有薪病假餘額：{formatNumber(sick.balance)} 日。
            {form.days > sick.balance && ' ⚠ 超出餘額部分屬無薪病假。'}
            {' '}連續 4 日或以上病假（並有醫生證明）先需支付疾病津貼。
          </div>
        )}

        <Field label="原因／備註">
          <input className={inputClass} value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>

        {isManager && (
          <Field label="狀態">
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeaveStatus })}>
              <option value="pending">待批</option>
              <option value="approved">已批</option>
              <option value="rejected">已拒</option>
            </select>
          </Field>
        )}
        {!isManager && <p className="text-xs text-slate-500 font-bold">提交後狀態為「待批」，主管批核後會喺排更表顯示。</p>}

        <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            取消
          </button>
          <button type="submit" className={primaryButtonClass}>
            <Check className="w-4 h-4" />
            {form.id ? '儲存' : isManager ? '新增' : '提交申請'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const BalancesTab: React.FC<{ employees: Employee[]; leaves: LeaveRecord[]; today: string }> = ({
  employees,
  leaves,
  today,
}) => (
  <div className="space-y-4">
    <Panel title={`假期結餘（截至 ${formatDateZh(today)}）`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
            <tr>
              <th className="py-3 px-5">員工</th>
              <th className="py-3 px-3">年資</th>
              <th className="py-3 px-3">本假期年</th>
              <th className="py-3 px-3 text-right">法定年假</th>
              <th className="py-3 px-3 text-right">公司額外</th>
              <th className="py-3 px-3 text-right">已放</th>
              <th className="py-3 px-3 text-right">待批</th>
              <th className="py-3 px-3 text-right">年假餘額</th>
              <th className="py-3 px-5 text-right">有薪病假餘額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => {
              const al = annualLeaveSummary(emp, leaves, today);
              const sl = sickLeaveSummary(emp, leaves, today);
              return (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="py-3 px-5">
                    <div className="font-black">{emp.name}</div>
                    <div className="text-xs text-slate-500">{emp.employmentType === 'full_time' ? '全職' : '兼職'} · 入職 {emp.joinDate}</div>
                  </td>
                  <td className="py-3 px-3 text-xs font-bold">{serviceLabel(emp.joinDate, today)}</td>
                  <td className="py-3 px-3 text-xs font-mono">
                    {al.leaveYearStart}
                    <br />至 {al.leaveYearEnd}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {al.statutory}
                    {al.serviceYears < 1 && <div className="text-[10px] text-slate-400 font-sans">累積中 ~{al.proRataAccrued}</div>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{al.extra}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatNumber(al.used)}</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-600">{al.pending ? formatNumber(al.pending) : '—'}</td>
                  <td className={`py-3 px-3 text-right font-mono font-black text-base ${al.balance < 0 ? 'text-rose-600' : ''}`}>
                    {formatNumber(al.balance)}
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-black">
                    {formatNumber(sl.balance)}
                    <div className="text-[10px] text-slate-400 font-sans font-normal">已用 {formatNumber(sl.used)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
    <div className="bg-white border border-slate-200 p-5 text-xs text-slate-600 space-y-1.5 font-medium">
      <p className="font-black text-slate-900 uppercase tracking-widest text-[10px]">計算規則（香港《僱傭條例》）</p>
      <p>• 年假：做滿第 1、2 年各有 7 日，之後每多做一年加 1 日，最多 14 日。做滿一年先有，喺之後 12 個月內放。「本假期年」由最近一個入職周年日起計。</p>
      <p>• 有薪病假：首 12 個月每做滿 1 個月累積 2 日，之後每月 4 日，最多累積 {MAX_SICK_DAYS} 日。</p>
      <p>• 兼職要符合「連續性合約」（2026 年 1 月 18 日起：每 4 星期合共工作 68 小時或以上）先享有以上權益。排更頁會顯示兼職近 4 星期工時。</p>
      <p>• 計算只供參考，以勞工處最新指引為準。</p>
    </div>
  </div>
);

const HolidaysTab: React.FC<{
  holidays: Holiday[];
  isManager: boolean;
  onSave: (holidays: Holiday[]) => void;
}> = ({ holidays, isManager, onSave }) => {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const years = Array.from(new Set(holidays.map((h) => h.date.slice(0, 4)))).sort();
  const today = todayISO();

  return (
    <div className="space-y-4">
      {isManager && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!date || !name.trim()) return;
            onSave([...holidays.filter((h) => h.date !== date), { date, name: name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
            setDate('');
            setName('');
          }}
          className="bg-white border border-slate-200 p-4 flex flex-col sm:flex-row gap-2"
        >
          <input type="date" className={`${inputClass} font-mono sm:w-44`} value={date} onChange={(e) => setDate(e.target.value)} required />
          <input className={inputClass} placeholder="假日名稱，例如：清明節" value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit" className={primaryButtonClass}>
            <Plus className="w-4 h-4" />
            加入
          </button>
        </form>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {years.map((year) => (
          <Panel key={year} title={`${year} 年法定假日`}>
            <div className="divide-y divide-slate-100">
              {holidays
                .filter((h) => h.date.startsWith(year))
                .map((h) => (
                  <div key={h.date} className={`px-5 py-2.5 flex items-center justify-between ${h.date < today ? 'opacity-50' : ''}`}>
                    <div>
                      <span className="font-mono font-bold text-sm">{h.date}</span>
                      <span className="text-xs text-slate-500 ml-2">星期{WEEKDAY_LABELS[weekdayOf(h.date)]}</span>
                      <div className="text-sm font-bold">{h.name}</div>
                    </div>
                    {isManager && (
                      <button
                        onClick={() => confirm(`刪除 ${h.date} ${h.name}？`) && onSave(holidays.filter((x) => x.date !== h.date))}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </Panel>
        ))}
      </div>
      <p className="text-xs text-slate-500 font-medium bg-white border border-slate-200 p-4">
        法定假日如適逢員工休息日，須喺翌日（非休息日、非假日）補假。2026 年起法定假日增至 15 日（新增復活節星期一）。日期請每年對照勞工處公佈。
      </p>
    </div>
  );
};
