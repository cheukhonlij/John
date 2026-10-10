import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Plus,
  Printer,
  Settings2,
  Trash2,
} from 'lucide-react';
import { Employee, Holiday, LeaveRecord, RosterShift, ShiftTemplate } from '../types';
import { STAFF_COLORS } from '../data/defaults';
import {
  WEEKDAY_LABELS,
  addDays,
  dateRange,
  formatDateZh,
  formatHours,
  parseISODate,
  shiftHours,
  startOfWeek,
  todayISO,
  weekdayOf,
} from '../utils/dates';
import { LEAVE_TYPE_LABELS, continuousContractCheck } from '../utils/leave';
import {
  Field,
  Modal,
  PageHeader,
  WeekdayPicker,
  inputClass,
  newId,
  primaryButtonClass,
  printPage,
  secondaryButtonClass,
} from './ui';

interface RosterPlannerProps {
  employees: Employee[];
  shifts: RosterShift[];
  templates: ShiftTemplate[];
  leaves: LeaveRecord[];
  holidays: Holiday[];
  isManager: boolean;
  onSaveShifts: (shifts: RosterShift[]) => void;
  onSaveTemplates: (templates: ShiftTemplate[]) => void;
  /** Asks for shifts from this date to be loaded (cloud mode keeps a window). */
  onNeedHistory?: (from: string) => void;
}

const cellKey = (employeeId: string, date: string) => `${employeeId}_${date}`;

/** Active staff, full-time first, otherwise in the order they were added. */
export const sortEmployeesForRoster = (employees: Employee[]) => {
  const active = employees.filter((e) => e.isActive);
  return [
    ...active.filter((e) => e.employmentType === 'full_time'),
    ...active.filter((e) => e.employmentType === 'part_time'),
  ];
};

export const RosterPlanner: React.FC<RosterPlannerProps> = ({
  employees,
  shifts,
  templates,
  leaves,
  holidays,
  isManager,
  onSaveShifts,
  onSaveTemplates,
  onNeedHistory,
}) => {
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));

  // The part-time check looks three weeks back from the week on screen.
  useEffect(() => {
    onNeedHistory?.(addDays(weekStart, -21));
  }, [weekStart, onNeedHistory]);
  const [editingCell, setEditingCell] = useState<{ employeeId: string; date: string } | null>(null);
  const [weekFillFor, setWeekFillFor] = useState<Employee | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const days = dateRange(weekStart, addDays(weekStart, 6));
  const weekEnd = days[6];
  const staff = sortEmployeesForRoster(employees);
  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));

  const shiftMap = useMemo(() => {
    const map = new Map<string, RosterShift[]>();
    shifts
      .filter((s) => s.date >= weekStart && s.date <= weekEnd)
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((s) => {
        const key = cellKey(s.employeeId, s.date);
        map.set(key, [...(map.get(key) || []), s]);
      });
    return map;
  }, [shifts, weekStart, weekEnd]);

  const leaveMap = useMemo(() => {
    const map = new Map<string, LeaveRecord>();
    leaves
      .filter((l) => l.status !== 'rejected' && l.startDate <= weekEnd && l.endDate >= weekStart)
      .forEach((l) => {
        dateRange(l.startDate > weekStart ? l.startDate : weekStart, l.endDate < weekEnd ? l.endDate : weekEnd).forEach(
          (d) => {
            const key = cellKey(l.employeeId, d);
            // An approved leave wins over a pending one on the same day.
            if (!map.has(key) || l.status === 'approved') map.set(key, l);
          }
        );
      });
    return map;
  }, [leaves, weekStart, weekEnd]);

  const weekLabel = (() => {
    const s = parseISODate(weekStart);
    const e = parseISODate(weekEnd);
    return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 – ${e.getMonth() + 1}月${e.getDate()}日`;
  })();

  const handleCopyLastWeek = () => {
    const prevStart = addDays(weekStart, -7);
    const prevShifts = shifts.filter(
      (s) => s.date >= prevStart && s.date < weekStart && staff.some((e) => e.id === s.employeeId)
    );
    if (prevShifts.length === 0) return alert('上星期冇更表可以複製。');
    const copies = prevShifts
      .map((s) => ({ ...s, id: newId('rs'), date: addDays(s.date, 7) }))
      .filter((s) => !shiftMap.has(cellKey(s.employeeId, s.date)));
    if (copies.length === 0) return alert('本週已經排好，冇空格需要複製。');
    if (confirm(`將上星期嘅 ${copies.length} 更複製到本週空格？（已排嘅格唔會改）`)) {
      onSaveShifts([...shifts, ...copies]);
    }
  };

  const handleClearWeek = () => {
    const count = shifts.filter((s) => s.date >= weekStart && s.date <= weekEnd).length;
    if (count === 0) return;
    if (confirm(`確定清除本週全部 ${count} 更？`)) {
      onSaveShifts(shifts.filter((s) => s.date < weekStart || s.date > weekEnd));
    }
  };

  const dailyHeadcount = days.map(
    (d) => staff.filter((e) => shiftMap.has(cellKey(e.id, d))).length
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="WEEKLY ROSTER"
        title="排更表"
        subtitle={isManager ? '撳格仔就可以排更；兼職同事會顯示近 4 星期工時（468 規則）。' : '查看每星期返工時間。如需調更請搵主管。'}
        actions={
          <>
            {isManager && (
              <>
                <button onClick={handleCopyLastWeek} className={secondaryButtonClass}>
                  <Copy className="w-4 h-4" />
                  複製上週
                </button>
                <button onClick={handleClearWeek} className={secondaryButtonClass}>
                  <Eraser className="w-4 h-4" />
                  清空本週
                </button>
                <button onClick={() => setShowTemplates(true)} className={secondaryButtonClass}>
                  <Settings2 className="w-4 h-4" />
                  更份設定
                </button>
              </>
            )}
            <button onClick={() => printPage('landscape')} className={primaryButtonClass}>
              <Printer className="w-4 h-4" />
              列印
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 shadow-xs p-3 flex items-center justify-between gap-2 no-print">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="p-2 hover:bg-slate-100 cursor-pointer"
          title="上星期"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span className="font-black text-sm sm:text-base">{weekLabel}</span>
          {weekStart !== startOfWeek(today) && (
            <button
              onClick={() => setWeekStart(startOfWeek(today))}
              className="text-[11px] font-black px-2.5 py-1 border border-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer"
            >
              返回本週
            </button>
          )}
          <input
            type="date"
            value={weekStart}
            onChange={(e) => e.target.value && setWeekStart(startOfWeek(e.target.value))}
            className="text-xs font-mono border border-slate-200 px-2 py-1"
          />
        </div>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="p-2 hover:bg-slate-100 cursor-pointer"
          title="下星期"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="print-area bg-white border border-slate-200 shadow-xs">
        <div className="hidden print:block p-2 text-lg font-black">排更表 {weekLabel}</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-900">
                <th className="py-2.5 px-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-36">
                  員工
                </th>
                {days.map((d) => {
                  const holiday = holidayMap.get(d);
                  return (
                    <th
                      key={d}
                      className={`py-2 px-2 text-center border-l border-slate-200 ${d === today ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`font-black text-sm ${holiday || weekdayOf(d) === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {WEEKDAY_LABELS[weekdayOf(d)]} {parseISODate(d).getMonth() + 1}/{parseISODate(d).getDate()}
                      </div>
                      {holiday && <div className="text-[10px] font-bold text-rose-600 leading-tight">{holiday}</div>}
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 border-l border-slate-200 w-28">
                  本週工時
                </th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                    未有在職員工，請先到「員工」新增。
                  </td>
                </tr>
              )}
              {staff.map((emp) => {
                const weekHours = days.reduce(
                  (sum, d) =>
                    sum +
                    (shiftMap.get(cellKey(emp.id, d)) || []).reduce(
                      (s, sh) => s + shiftHours(sh.start, sh.end, sh.breakMinutes),
                      0
                    ),
                  0
                );
                const workDays = days.filter((d) => shiftMap.has(cellKey(emp.id, d))).length;
                const contract =
                  emp.employmentType === 'part_time' ? continuousContractCheck(emp.id, shifts, weekStart) : null;
                return (
                  <tr key={emp.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STAFF_COLORS[emp.color]?.dot || 'bg-slate-400'}`} />
                        <div>
                          <div className="font-black text-slate-900 text-sm">{emp.name}</div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            {emp.employmentType === 'full_time' ? '全職' : '兼職'} · {emp.position}
                          </div>
                        </div>
                      </div>
                      {isManager && (
                        <button
                          onClick={() => setWeekFillFor(emp)}
                          className="mt-1.5 text-[10px] font-black text-blue-700 hover:underline cursor-pointer"
                        >
                          + 整週排更
                        </button>
                      )}
                    </td>
                    {days.map((d) => {
                      const key = cellKey(emp.id, d);
                      const cellShifts = shiftMap.get(key) || [];
                      const leave = leaveMap.get(key);
                      const isRest = emp.restDays.includes(weekdayOf(d));
                      const conflict = leave?.status === 'approved' && cellShifts.length > 0;
                      return (
                        <td
                          key={d}
                          onClick={isManager ? () => setEditingCell({ employeeId: emp.id, date: d }) : undefined}
                          className={`p-1.5 align-top border-l border-slate-100 h-16 ${d === today ? 'bg-blue-50/50' : ''} ${
                            isManager ? 'cursor-pointer hover:bg-slate-100' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            {leave && (
                              <div
                                className={`text-[11px] font-black px-1.5 py-0.5 border text-center ${
                                  leave.status === 'approved'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-white text-amber-700 border-amber-300 border-dashed'
                                }`}
                              >
                                {LEAVE_TYPE_LABELS[leave.type]}
                                {leave.status === 'pending' && '（待批）'}
                              </div>
                            )}
                            {cellShifts.map((s) => (
                              <div
                                key={s.id}
                                className={`px-1.5 py-1 border ${STAFF_COLORS[emp.color]?.chip || STAFF_COLORS.slate.chip}`}
                                title={s.note}
                              >
                                {s.label && <div className="text-[10px] font-black leading-tight">{s.label}</div>}
                                <div className="font-mono font-bold text-[11px] leading-tight">
                                  {s.start}–{s.end}
                                </div>
                                {s.note && <div className="text-[10px] leading-tight truncate">{s.note}</div>}
                              </div>
                            ))}
                            {conflict && (
                              <div className="text-[10px] font-black text-rose-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                放假但有更
                              </div>
                            )}
                            {!leave && cellShifts.length === 0 && isRest && (
                              <div className="text-center text-slate-300 font-black py-2">休</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right align-top border-l border-slate-100">
                      <div className="font-mono font-black text-sm">{formatHours(weekHours)}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{workDays} 日</div>
                      {contract && (
                        <div
                          className={`text-[10px] font-black mt-1 ${contract.qualifies ? 'text-emerald-600' : 'text-amber-600'}`}
                          title={contract.weeks.map((w) => `${w.start}: ${formatHours(w.hours)}`).join('\n')}
                        >
                          4週 {formatHours(contract.total)}
                          {contract.qualifies ? ' ✓' : ' <68'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {staff.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-900">
                  <td className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">當日人手</td>
                  {dailyHeadcount.map((count, i) => (
                    <td key={days[i]} className="py-2 px-2 text-center font-mono font-black border-l border-slate-200">
                      {count} 人
                    </td>
                  ))}
                  <td className="border-l border-slate-200" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {editingCell && (
        <ShiftEditor
          employee={employees.find((e) => e.id === editingCell.employeeId)!}
          date={editingCell.date}
          holidayName={holidayMap.get(editingCell.date)}
          leave={leaveMap.get(cellKey(editingCell.employeeId, editingCell.date))}
          cellShifts={shiftMap.get(cellKey(editingCell.employeeId, editingCell.date)) || []}
          templates={templates}
          onClose={() => setEditingCell(null)}
          onAdd={(shift) => onSaveShifts([...shifts, shift])}
          onRemove={(id) => onSaveShifts(shifts.filter((s) => s.id !== id))}
        />
      )}

      {weekFillFor && (
        <WeekFillModal
          employee={weekFillFor}
          weekStart={weekStart}
          templates={templates}
          onClose={() => setWeekFillFor(null)}
          onApply={(template, weekdays) => {
            const added = days
              .filter((d) => weekdays.includes(weekdayOf(d)))
              .filter((d) => !shiftMap.has(cellKey(weekFillFor.id, d)))
              .filter((d) => leaveMap.get(cellKey(weekFillFor.id, d))?.status !== 'approved')
              .map<RosterShift>((d) => ({
                id: newId('rs'),
                employeeId: weekFillFor.id,
                date: d,
                start: template.start,
                end: template.end,
                breakMinutes: template.breakMinutes,
                label: template.name,
              }));
            onSaveShifts([...shifts, ...added]);
            setWeekFillFor(null);
          }}
        />
      )}

      {showTemplates && (
        <TemplateManager templates={templates} onSave={onSaveTemplates} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
};

const ShiftEditor: React.FC<{
  employee: Employee;
  date: string;
  holidayName?: string;
  leave?: LeaveRecord;
  cellShifts: RosterShift[];
  templates: ShiftTemplate[];
  onClose: () => void;
  onAdd: (shift: RosterShift) => void;
  onRemove: (id: string) => void;
}> = ({ employee, date, holidayName, leave, cellShifts, templates, onClose, onAdd, onRemove }) => {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const addShift = (s: Omit<RosterShift, 'id' | 'employeeId' | 'date'>) => {
    onAdd({ ...s, id: newId('rs'), employeeId: employee.id, date });
    onClose();
  };

  return (
    <Modal eyebrow="EDIT SHIFT" title={`${employee.name} · ${formatDateZh(date)}`} onClose={onClose}>
      {(holidayName || leave || employee.restDays.includes(weekdayOf(date))) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 font-bold space-y-0.5">
          {holidayName && <div>法定假日：{holidayName}</div>}
          {employee.restDays.includes(weekdayOf(date)) && <div>呢日係 {employee.name} 嘅休息日</div>}
          {leave && (
            <div>
              {LEAVE_TYPE_LABELS[leave.type]}（{leave.status === 'approved' ? '已批' : '待批'}）
            </div>
          )}
        </div>
      )}

      {cellShifts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">已排</p>
          {cellShifts.map((s) => (
            <div key={s.id} className="flex items-center justify-between border border-slate-200 p-2.5">
              <div>
                <span className="font-black text-sm">{s.label || '自訂'}</span>
                <span className="font-mono text-sm ml-2">
                  {s.start}–{s.end}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  {formatHours(shiftHours(s.start, s.end, s.breakMinutes))}
                </span>
                {s.note && <div className="text-xs text-slate-500">{s.note}</div>}
              </div>
              <button onClick={() => onRemove(s.id)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">快速排更</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => addShift({ start: t.start, end: t.end, breakMinutes: t.breakMinutes, label: t.name })}
              className="border border-slate-200 hover:border-slate-900 hover:bg-slate-50 p-2 text-left cursor-pointer"
            >
              <div className="font-black text-sm">{t.name}</div>
              <div className="font-mono text-xs text-slate-500">
                {t.start}–{t.end}
              </div>
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addShift({ start, end, breakMinutes, label: label.trim() || undefined, note: note.trim() || undefined });
        }}
        className="space-y-3 border-t border-slate-200 pt-4"
      >
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">自訂時間</p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="開始">
            <input type="time" className={`${inputClass} font-mono`} value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="結束">
            <input type="time" className={`${inputClass} font-mono`} value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
          <Field label="休息(分鐘)">
            <input
              type="number"
              min="0"
              step="15"
              className={`${inputClass} font-mono`}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="名稱（可選）">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例如：送貨" />
          </Field>
          <Field label="備註（可選）">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500 font-bold">工時 {formatHours(shiftHours(start, end, breakMinutes))}</span>
          <button type="submit" className={primaryButtonClass}>
            <Plus className="w-4 h-4" />
            加入
          </button>
        </div>
      </form>
    </Modal>
  );
};

const WeekFillModal: React.FC<{
  employee: Employee;
  weekStart: string;
  templates: ShiftTemplate[];
  onClose: () => void;
  onApply: (template: ShiftTemplate, weekdays: number[]) => void;
}> = ({ employee, weekStart, templates, onClose, onApply }) => {
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');
  const [weekdays, setWeekdays] = useState(
    [1, 2, 3, 4, 5, 6, 0].filter((d) => !employee.restDays.includes(d))
  );
  const template = templates.find((t) => t.id === templateId);

  return (
    <Modal eyebrow="FILL WEEK" title={`${employee.name} · 整週排更`} onClose={onClose}>
      <p className="text-xs text-slate-500 font-medium">
        由 {formatDateZh(weekStart)} 起嘅一星期。已有更或者已批假嘅日子唔會改。
      </p>
      <Field label="更份">
        <select className={inputClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.start}–{t.end}
            </option>
          ))}
        </select>
      </Field>
      <Field label="返工日">
        <WeekdayPicker value={weekdays} onChange={setWeekdays} />
      </Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
        <button onClick={onClose} className={secondaryButtonClass}>
          取消
        </button>
        <button
          disabled={!template || weekdays.length === 0}
          onClick={() => template && onApply(template, weekdays)}
          className={primaryButtonClass}
        >
          <CalendarRange className="w-4 h-4" />
          套用
        </button>
      </div>
    </Modal>
  );
};

const TemplateManager: React.FC<{
  templates: ShiftTemplate[];
  onSave: (templates: ShiftTemplate[]) => void;
  onClose: () => void;
}> = ({ templates, onSave, onClose }) => {
  const [rows, setRows] = useState<ShiftTemplate[]>(templates.map((t) => ({ ...t })));

  const update = (id: string, patch: Partial<ShiftTemplate>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <Modal eyebrow="SHIFT TEMPLATES" title="更份設定" onClose={onClose} wide>
      <p className="text-xs text-slate-500 font-medium">常用更份會喺排更時一撳即用。改呢度唔會影響已經排咗嘅更。</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
            <input className={inputClass} value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
            <input type="time" className={`${inputClass} font-mono w-28`} value={r.start} onChange={(e) => update(r.id, { start: e.target.value })} />
            <input type="time" className={`${inputClass} font-mono w-28`} value={r.end} onChange={(e) => update(r.id, { end: e.target.value })} />
            <input
              type="number"
              min="0"
              step="15"
              title="休息分鐘"
              className={`${inputClass} font-mono w-20`}
              value={r.breakMinutes}
              onChange={(e) => update(r.id, { breakMinutes: Number(e.target.value) || 0 })}
            />
            <button onClick={() => setRows(rows.filter((x) => x.id !== r.id))} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <p className="text-[11px] text-slate-400">欄位：名稱 · 開始 · 結束 · 休息（分鐘）</p>
      </div>
      <div className="flex justify-between gap-2 pt-3 border-t border-slate-200">
        <button
          onClick={() => setRows([...rows, { id: newId('st'), name: '新更份', start: '09:00', end: '18:00', breakMinutes: 60 }])}
          className={secondaryButtonClass}
        >
          <Plus className="w-4 h-4" />
          新增更份
        </button>
        <button
          onClick={() => {
            onSave(rows.filter((r) => r.name.trim()));
            onClose();
          }}
          className={primaryButtonClass}
        >
          儲存
        </button>
      </div>
    </Modal>
  );
};
