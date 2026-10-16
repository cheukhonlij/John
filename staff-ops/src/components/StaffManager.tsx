import React, { useState } from 'react';
import { AlertCircle, Check, Plus, Search, Trash2 } from 'lucide-react';
import { Employee, EmploymentType, LeaveRecord, RosterShift } from '../types';
import { STAFF_COLORS } from '../data/defaults';
import { WEEKDAY_LABELS, formatNumber, startOfWeek, todayISO } from '../utils/dates';
import { annualLeaveSummary, completedMonths, continuousContractCheck } from '../utils/leave';
import {
  ChoiceSelect,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  TabBar,
  WeekdayPicker,
  inputClass,
  newId,
  primaryButtonClass,
  secondaryButtonClass,
} from './ui';

interface StaffManagerProps {
  employees: Employee[];
  leaves: LeaveRecord[];
  shifts: RosterShift[];
  positions: string[];
  isManager: boolean;
  onSaveEmployees: (employees: Employee[]) => void;
  onSavePositions: (positions: string[]) => void;
}

type StaffFilter = 'active' | 'full_time' | 'part_time' | 'inactive';

const emptyForm = (): Employee => ({
  id: '',
  name: '',
  position: '',
  employmentType: 'full_time',
  phone: '',
  joinDate: todayISO(),
  restDays: [0],
  extraAnnualLeave: 0,
  color: 'blue',
  isActive: true,
  notes: '',
});

export const serviceLabel = (joinDate: string, asOf: string) => {
  const months = completedMonths(joinDate, asOf);
  const years = Math.floor(months / 12);
  return years > 0 ? `${years}年${months % 12}個月` : `${months}個月`;
};

export const StaffManager: React.FC<StaffManagerProps> = ({
  employees,
  leaves,
  shifts,
  positions,
  isManager,
  onSaveEmployees,
  onSavePositions,
}) => {
  const today = todayISO();
  const [filter, setFilter] = useState<StaffFilter>('active');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Employee | null>(null);
  const [error, setError] = useState('');

  const counts = {
    active: employees.filter((e) => e.isActive).length,
    full_time: employees.filter((e) => e.isActive && e.employmentType === 'full_time').length,
    part_time: employees.filter((e) => e.isActive && e.employmentType === 'part_time').length,
    inactive: employees.filter((e) => !e.isActive).length,
  };

  const visible = employees.filter((e) => {
    const matchesFilter =
      filter === 'inactive' ? !e.isActive : e.isActive && (filter === 'active' || e.employmentType === filter);
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const setField = <K extends keyof Employee>(key: K, value: Employee[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const openNew = () => {
    setError('');
    setForm(emptyForm());
  };

  const handleTypeChange = (type: EmploymentType) => {
    if (!form) return;
    // Part-timers are rostered day by day, so they get no fixed weekly rest day.
    setForm({ ...form, employmentType: type, restDays: type === 'part_time' ? [] : form.restDays.length ? form.restDays : [0] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.name.trim()) return setError('請輸入員工姓名');
    if (!form.joinDate) return setError('請輸入入職日期');

    const cleaned: Employee = {
      ...form,
      name: form.name.trim(),
      position: form.position.trim(),
      phone: form.phone?.trim(),
      notes: form.notes?.trim(),
    };
    // A position typed in with 新增職位 joins the list for next time.
    const before = employees.find((emp) => emp.id === cleaned.id)?.position;
    if (cleaned.position && cleaned.position !== before && !positions.includes(cleaned.position)) {
      onSavePositions([...positions, cleaned.position]);
    }
    if (cleaned.id) {
      onSaveEmployees(employees.map((emp) => (emp.id === cleaned.id ? cleaned : emp)));
    } else {
      onSaveEmployees([...employees, { ...cleaned, id: newId('emp') }]);
    }
    setForm(null);
  };

  const handleDelete = (emp: Employee) => {
    if (confirm(`確定刪除「${emp.name}」？\n（佢嘅更表同假期紀錄會保留；如果只係離職，建議改為「已離職」。）`)) {
      onSaveEmployees(employees.filter((e) => e.id !== emp.id));
    }
  };

  const thisWeek = startOfWeek(today);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="STAFF DIRECTORY"
        title="員工資料"
        subtitle="全職／兼職員工、入職日期及休息日。年假按入職年資自動計算。（呢個系統唔記錄人工）"
        actions={
          isManager && (
            <button onClick={openNew} className={primaryButtonClass}>
              <Plus className="w-4 h-4 text-emerald-400" />
              新增員工
            </button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <TabBar
          tabs={[
            { id: 'active' as const, label: '在職', count: counts.active },
            { id: 'full_time' as const, label: '全職', count: counts.full_time },
            { id: 'part_time' as const, label: '兼職', count: counts.part_time },
            { id: 'inactive' as const, label: '已離職', count: counts.inactive },
          ]}
          active={filter}
          onChange={setFilter}
        />
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋姓名或職位…"
            className={`${inputClass} pl-11 h-full`}
          />
        </div>
      </div>

      <Panel title={`員工 (${visible.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">姓名 / 職位</th>
                <th className="py-3 px-4">類別</th>
                <th className="py-3 px-4">入職 / 年資</th>
                <th className="py-3 px-4">休息日</th>
                <th className="py-3 px-4">年假 / 工時</th>
                {isManager && <th className="py-3 px-5 text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="未有員工" hint="撳「新增員工」開始輸入" />
                  </td>
                </tr>
              ) : (
                visible.map((emp) => {
                  const al = annualLeaveSummary(emp, leaves, today);
                  const contract =
                    emp.employmentType === 'part_time' ? continuousContractCheck(emp.id, shifts, thisWeek) : null;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STAFF_COLORS[emp.color]?.dot || 'bg-slate-400'}`} />
                          <div>
                            <div className="font-black text-slate-900">{emp.name}</div>
                            <div className="text-xs text-slate-500 font-medium">
                              {emp.position}
                              {emp.phone && <span className="font-mono"> · {emp.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 border ${
                            emp.employmentType === 'full_time'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {emp.employmentType === 'full_time' ? '全職' : '兼職'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-slate-900">{emp.joinDate}</div>
                        <div className="text-xs text-slate-500">{serviceLabel(emp.joinDate, today)}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-700">
                        {emp.restDays.length ? emp.restDays.map((d) => `星期${WEEKDAY_LABELS[d]}`).join('、') : '按更表'}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-slate-900">
                          年假餘 <span className={`font-mono ${al.balance < 0 ? 'text-rose-600' : ''}`}>{formatNumber(al.balance)}</span> / {al.entitlement} 日
                        </div>
                        {al.serviceYears < 1 && (
                          <div className="text-slate-400">首年累積中：約 {al.proRataAccrued} 日</div>
                        )}
                        {contract && (
                          <div className={contract.qualifies ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            近4週 {formatNumber(contract.total, 1)}h {contract.qualifies ? '✓ 連續性合約' : '（未達 68h）'}
                          </div>
                        )}
                      </td>
                      {isManager && (
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setError('');
                              setForm({ ...emp });
                            }}
                            className="px-2.5 py-1 text-xs font-black text-slate-900 hover:bg-slate-900 hover:text-white transition cursor-pointer border border-slate-200"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleDelete(emp)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {form && (
        <Modal
          eyebrow={form.id ? 'EDIT STAFF' : 'NEW STAFF'}
          title={form.id ? `編輯員工：${form.name}` : '新增員工'}
          onClose={() => setForm(null)}
          wide
        >
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="姓名" required>
                <input className={inputClass} value={form.name} onChange={(e) => setField('name', e.target.value)} autoFocus />
              </Field>
              <Field label="職位">
                <ChoiceSelect
                  value={form.position}
                  options={positions}
                  onChange={(position) => setField('position', position)}
                  placeholder="揀職位…"
                  newLabel="＋ 新增職位…"
                />
              </Field>
              <Field label="僱用類別" required>
                <div className="grid grid-cols-2 gap-2">
                  {(['full_time', 'part_time'] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={`py-2.5 text-xs font-black border transition cursor-pointer ${
                        form.employmentType === type
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-900'
                      }`}
                    >
                      {type === 'full_time' ? '全職' : '兼職'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="電話">
                <input className={`${inputClass} font-mono`} value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} />
              </Field>
              <Field label="入職日期" required hint="用嚟計年資、年假同病假累積">
                <input
                  type="date"
                  className={`${inputClass} font-mono`}
                  value={form.joinDate}
                  onChange={(e) => setField('joinDate', e.target.value)}
                />
              </Field>
              <Field
                label="每週休息日"
                hint={form.employmentType === 'part_time' ? '兼職通常唔設固定休息日，按更表返工' : '請年假時，休息日唔會計入假期日數'}
              >
                <WeekdayPicker value={form.restDays} onChange={(days) => setField('restDays', days)} />
              </Field>
              <Field label="公司額外年假（日／年）" hint="喺法定年假以外，公司額外俾嘅日數">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={`${inputClass} font-mono`}
                  value={form.extraAnnualLeave ?? 0}
                  onChange={(e) => setField('extraAnnualLeave', Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="更表顏色">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STAFF_COLORS).map(([key, c]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setField('color', key)}
                      title={c.label}
                      className={`w-8 h-8 border-2 transition cursor-pointer flex items-center justify-center ${
                        form.color === key ? 'border-slate-900' : 'border-transparent'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full ${c.dot}`} />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="狀態">
                <select
                  className={inputClass}
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setField('isActive', e.target.value === 'active')}
                >
                  <option value="active">在職</option>
                  <option value="inactive">已離職</option>
                </select>
              </Field>
            </div>
            <Field label="備註">
              <input className={inputClass} value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
            </Field>
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>
                取消
              </button>
              <button type="submit" className={primaryButtonClass}>
                <Check className="w-4 h-4" />
                {form.id ? '儲存' : '新增'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
