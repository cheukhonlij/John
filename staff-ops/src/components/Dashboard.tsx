import React from 'react';
import { ArrowRight, CalendarDays, ClipboardCheck, PackageMinus, PackagePlus, Plane } from 'lucide-react';
import { Employee, Holiday, LeaveRecord, RosterShift, StockItem, StockMovement, WorkflowCheck, WorkflowTask } from '../types';
import { STAFF_COLORS } from '../data/defaults';
import { addDays, formatDateZh, formatFullDateZh, formatNumber, todayISO, weekdayOf, WEEKDAY_LABELS } from '../utils/dates';
import { LEAVE_TYPE_LABELS, leaveCoversDate } from '../utils/leave';
import { computeStockLevels, lowStockItems } from '../utils/inventory';
import { tasksForDate } from './DailyWorkflow';
import { InventoryTab } from './Inventory';
import { Panel, StatCard } from './ui';

export type NavTab = 'dashboard' | 'roster' | 'workflow' | 'inventory' | 'leave' | 'sop' | 'staff' | 'settings';

interface DashboardProps {
  employees: Employee[];
  shifts: RosterShift[];
  leaves: LeaveRecord[];
  holidays: Holiday[];
  tasks: WorkflowTask[];
  checks: WorkflowCheck[];
  items: StockItem[];
  movements: StockMovement[];
  onNavigate: (tab: NavTab, inventoryTab?: InventoryTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  employees,
  shifts,
  leaves,
  holidays,
  tasks,
  checks,
  items,
  movements,
  onNavigate,
}) => {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const holidayToday = holidays.find((h) => h.date === today);

  const shiftsOn = (date: string) =>
    shifts
      .filter((s) => s.date === date && empById.get(s.employeeId)?.isActive)
      .sort((a, b) => a.start.localeCompare(b.start));
  const todayShifts = shiftsOn(today);
  const tomorrowShifts = shiftsOn(tomorrow);

  const onLeaveToday = leaves.filter((l) => l.status === 'approved' && leaveCoversDate(l, today));
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');

  const todayTasks = tasksForDate(tasks, today);
  const doneIds = new Set(checks.filter((c) => c.date === today).map((c) => c.taskId));
  const remainingTasks = todayTasks.filter((t) => !doneIds.has(t.id));

  const levels = computeStockLevels(movements);
  const lowStock = lowStockItems(items, levels);

  const upcomingHolidays = holidays.filter((h) => h.date >= today).slice(0, 3);

  const renderShiftList = (list: RosterShift[], empty: string) =>
    list.length === 0 ? (
      <p className="px-5 py-6 text-sm text-slate-400 font-bold">{empty}</p>
    ) : (
      <div className="divide-y divide-slate-100">
        {list.map((s) => {
          const emp = empById.get(s.employeeId)!;
          return (
            <div key={s.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${STAFF_COLORS[emp.color]?.dot || 'bg-slate-400'}`} />
                <span className="font-black">{emp.name}</span>
                <span className="text-xs text-slate-500">{emp.position}</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm">
                  {s.start}–{s.end}
                </span>
                {s.label && <span className="text-xs text-slate-500 ml-2">{s.label}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TODAY</p>
          <h2 className="text-2xl sm:text-3xl font-black mt-1">{formatFullDateZh(today)}</h2>
          {holidayToday && <p className="text-sm font-black text-amber-300 mt-1">法定假日：{holidayToday.name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate('workflow')} className="px-4 py-2.5 bg-white text-slate-900 font-black text-xs flex items-center gap-2 cursor-pointer hover:bg-slate-100">
            <ClipboardCheck className="w-4 h-4" />
            今日流程
          </button>
          <button onClick={() => onNavigate('inventory', 'in')} className="px-4 py-2.5 bg-emerald-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer hover:bg-emerald-600">
            <PackagePlus className="w-4 h-4" />
            入貨
          </button>
          <button onClick={() => onNavigate('inventory', 'out')} className="px-4 py-2.5 bg-blue-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer hover:bg-blue-600">
            <PackageMinus className="w-4 h-4" />
            落貨
          </button>
          <button onClick={() => onNavigate('leave')} className="px-4 py-2.5 border border-slate-600 text-white font-black text-xs flex items-center gap-2 cursor-pointer hover:bg-slate-800">
            <Plane className="w-4 h-4" />
            申請假期
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="今日返工" value={`${new Set(todayShifts.map((s) => s.employeeId)).size} 人`} hint={onLeaveToday.length ? `${onLeaveToday.length} 人放假` : '冇人放假'} onClick={() => onNavigate('roster')} />
        <StatCard
          label="今日流程"
          value={`${todayTasks.length - remainingTasks.length}/${todayTasks.length}`}
          hint={remainingTasks.length ? `仲有 ${remainingTasks.length} 項未做` : todayTasks.length ? '全部完成 ✓' : '今日冇設定工作'}
          tone={todayTasks.length > 0 && remainingTasks.length === 0 ? 'good' : 'default'}
          onClick={() => onNavigate('workflow')}
        />
        <StatCard
          label="要補貨"
          value={lowStock.length}
          hint={lowStock.length ? '低過安全存量' : '存貨正常'}
          tone={lowStock.length ? 'warn' : 'good'}
          onClick={() => onNavigate('inventory')}
        />
        <StatCard
          label="待批假期"
          value={pendingLeaves.length}
          hint={pendingLeaves.length ? '等主管批核' : '冇待批申請'}
          tone={pendingLeaves.length ? 'warn' : 'default'}
          onClick={() => onNavigate('leave')}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel
          title="今日更表"
          actions={
            <button onClick={() => onNavigate('roster')} className="text-xs font-black text-blue-700 flex items-center gap-1 cursor-pointer">
              排更表 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          {renderShiftList(todayShifts, holidayToday ? '今日係法定假日，冇人排更' : '今日冇人排更')}
          {onLeaveToday.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-200 bg-amber-50/50">
              <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">今日放假</p>
              <div className="flex flex-wrap gap-1.5">
                {onLeaveToday.map((l) => (
                  <span key={l.id} className="text-xs font-bold px-2 py-1 bg-amber-100 border border-amber-300 text-amber-900">
                    {empById.get(l.employeeId)?.name || '—'} · {LEAVE_TYPE_LABELS[l.type]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="今日未完成工作"
          actions={
            <button onClick={() => onNavigate('workflow')} className="text-xs font-black text-blue-700 flex items-center gap-1 cursor-pointer">
              打剔 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          {remainingTasks.length === 0 ? (
            <p className="px-5 py-6 text-sm font-bold text-emerald-600">{todayTasks.length ? '今日工作全部完成 ✓' : '今日冇設定工作'}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {remainingTasks.slice(0, 6).map((t) => (
                <div key={t.id} className="px-5 py-2.5 flex items-center gap-3">
                  <span className="font-mono font-black text-sm w-12">{t.time}</span>
                  <span className="font-bold flex-1">{t.title}</span>
                  <span className="text-xs text-slate-500 font-bold">{t.area}</span>
                </div>
              ))}
              {remainingTasks.length > 6 && (
                <p className="px-5 py-2 text-xs text-slate-500 font-bold">…仲有 {remainingTasks.length - 6} 項</p>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="要補貨"
          actions={
            <button onClick={() => onNavigate('inventory')} className="text-xs font-black text-blue-700 flex items-center gap-1 cursor-pointer">
              倉存 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          {lowStock.length === 0 ? (
            <p className="px-5 py-6 text-sm font-bold text-emerald-600">所有貨品都高過安全存量 ✓</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStock.map((i) => {
                const qty = levels.get(i.id) || 0;
                return (
                  <div key={i.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <span className="font-bold">{i.name}</span>
                    <span className={`font-mono font-black text-sm ${qty <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {formatNumber(qty, 3)} / {i.reorderLevel} {i.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title={`聽日更表 · ${formatDateZh(tomorrow)}`}>
          {renderShiftList(tomorrowShifts, '聽日冇人排更')}
          {upcomingHolidays.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                下個法定假日
              </p>
              {upcomingHolidays.map((h) => (
                <div key={h.date} className="text-xs font-bold text-slate-700">
                  <span className="font-mono">{h.date}</span>（{WEEKDAY_LABELS[weekdayOf(h.date)]}）{h.name}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
