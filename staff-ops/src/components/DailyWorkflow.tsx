import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cog,
  GripVertical,
  ListChecks,
  LucideIcon,
  Package,
  Pencil,
  Plus,
  Printer,
  SprayCan,
  Sunrise,
  Trash2,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';
import { Employee, RosterShift, SOP, WorkflowCheck, WorkflowTask } from '../types';
import { STAFF_COLORS, WORKFLOW_AREAS } from '../data/defaults';
import { WEEKDAY_LABELS, addDays, formatFullDateZh, todayISO, weekdayOf } from '../utils/dates';
import { SOPViewer } from './SOPLibrary';
import {
  ChoiceSelect,
  EmptyState,
  Field,
  Modal,
  Panel,
  WeekdayPicker,
  inputClass,
  newId,
  primaryButtonClass,
  printPage,
  secondaryButtonClass,
} from './ui';

interface DailyWorkflowProps {
  tasks: WorkflowTask[];
  checks: WorkflowCheck[];
  sops: SOP[];
  employees: Employee[];
  shifts: RosterShift[];
  positions: string[];
  isManager: boolean;
  currentUserId: string;
  onSaveTasks: (tasks: WorkflowTask[]) => void;
  onSavePositions: (positions: string[]) => void;
  onSaveChecks: (checks: WorkflowCheck[]) => void;
  /** Asks for ticks from this date to be loaded (cloud mode keeps a window). */
  onNeedHistory?: (from: string) => void;
}

export const checkId = (date: string, taskId: string) => `${date}_${taskId}`;

/** 負責崗位 for tasks the whole team shares; not a position of its own. */
const ALL_STAFF = '全體';

export const tasksForDate = (tasks: WorkflowTask[], date: string) =>
  tasks
    .filter((t) => t.weekdays.includes(weekdayOf(date)))
    .sort((a, b) => a.time.localeCompare(b.time));

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ---------- Colours per area ----------

interface AreaStyle {
  head: string;
  card: string;
  tag: string;
  icon: LucideIcon;
}

// Full class names so Tailwind keeps them.
const AREA_STYLES: Record<string, AreaStyle> = {
  開工準備: { head: 'bg-slate-100 text-slate-700', card: 'bg-slate-50 border-slate-200', tag: 'bg-slate-200 text-slate-700', icon: Sunrise },
  生產: { head: 'bg-blue-50 text-blue-800', card: 'bg-blue-50 border-blue-200', tag: 'bg-blue-100 text-blue-800', icon: Cog },
  包裝: { head: 'bg-emerald-50 text-emerald-800', card: 'bg-emerald-50 border-emerald-200', tag: 'bg-emerald-100 text-emerald-800', icon: Package },
  倉務: { head: 'bg-orange-50 text-orange-800', card: 'bg-orange-50 border-orange-200', tag: 'bg-orange-100 text-orange-800', icon: Warehouse },
  出貨: { head: 'bg-violet-50 text-violet-800', card: 'bg-violet-50 border-violet-200', tag: 'bg-violet-100 text-violet-800', icon: Truck },
  清潔: { head: 'bg-cyan-50 text-cyan-800', card: 'bg-cyan-50 border-cyan-200', tag: 'bg-cyan-100 text-cyan-800', icon: SprayCan },
  行政: { head: 'bg-rose-50 text-rose-800', card: 'bg-rose-50 border-rose-200', tag: 'bg-rose-100 text-rose-800', icon: ClipboardList },
};
const OTHER_AREA: AreaStyle = { head: 'bg-slate-100 text-slate-700', card: 'bg-white border-slate-200', tag: 'bg-slate-100 text-slate-700', icon: ListChecks };
const areaStyle = (area: string) => AREA_STYLES[area] || OTHER_AREA;

/** The usual areas first, in their usual order, then any others. */
const orderAreas = (areas: string[]) =>
  Array.from(new Set(areas)).sort((a, b) => {
    const ia = WORKFLOW_AREAS.indexOf(a);
    const ib = WORKFLOW_AREAS.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0 || ib >= 0) return ia >= 0 ? -1 : 1;
    return a.localeCompare(b, 'zh-Hant');
  });

const hourOf = (time: string) => parseInt(time.slice(0, 2), 10) || 0;
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** Moving a task to another hour keeps its minutes: 09:40 dropped on 11:00 becomes 11:40. */
const moveTime = (time: string, hour: number) => `${String(hour).padStart(2, '0')}:${time.slice(3, 5) || '00'}`;

type Placement = { time: string; area: string };

export const DailyWorkflow: React.FC<DailyWorkflowProps> = ({
  tasks,
  checks,
  sops,
  employees,
  shifts,
  positions,
  isManager,
  currentUserId,
  onSaveTasks,
  onSavePositions,
  onSaveChecks,
  onNeedHistory,
}) => {
  const today = todayISO();
  const [date, setDate] = useState(today);

  useEffect(() => {
    onNeedHistory?.(date);
  }, [date, onNeedHistory]);
  const [area, setArea] = useState('all');
  const [manageMode, setManageMode] = useState(false);
  const [arranging, setArranging] = useState(false);
  // Drag-and-drop moves wait here until 儲存時間表.
  const [moves, setMoves] = useState<Record<string, Placement>>({});
  const [editingTask, setEditingTask] = useState<WorkflowTask | null>(null);
  const [viewingSop, setViewingSop] = useState<SOP | null>(null);

  const placed = (t: WorkflowTask): WorkflowTask => (moves[t.id] ? { ...t, ...moves[t.id] } : t);
  const dayTasks = tasksForDate(tasks.map(placed), date);
  const visibleTasks = dayTasks.filter((t) => arranging || area === 'all' || t.area === area);
  const checkMap = new Map(checks.filter((c) => c.date === date).map((c) => [c.taskId, c]));
  const doneCount = dayTasks.filter((t) => checkMap.has(t.id)).length;
  const percent = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;
  const onDuty = shifts
    .filter((s) => s.date === date)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => ({ shift: s, employee: employees.find((e) => e.id === s.employeeId) }))
    .filter((x): x is { shift: RosterShift; employee: Employee } => !!x.employee);
  const areasToday = orderAreas(dayTasks.map((t) => t.area));
  const changedCount = Object.entries(moves).filter(([id, m]) => {
    const t = tasks.find((x) => x.id === id);
    return t && (t.time !== m.time || t.area !== m.area);
  }).length;

  const employeeName = (id?: string) => employees.find((e) => e.id === id)?.name;
  const sopOf = (task: WorkflowTask) => sops.find((s) => s.id === task.sopId);

  const toggle = (task: WorkflowTask) => {
    const id = checkId(date, task.id);
    if (checkMap.has(task.id)) {
      onSaveChecks(checks.filter((c) => c.id !== id));
    } else {
      onSaveChecks([...checks, { id, date, taskId: task.id, doneBy: currentUserId || undefined, doneAt: new Date().toISOString() }]);
    }
  };

  const saveTask = (task: WorkflowTask) => {
    // A role typed in with 新增職位 joins the position list for next time.
    const role = task.ownerRole;
    const before = tasks.find((t) => t.id === task.id)?.ownerRole;
    if (role && role !== ALL_STAFF && role !== before && !positions.includes(role)) {
      onSavePositions([...positions, role]);
    }
    onSaveTasks(task.id && tasks.some((t) => t.id === task.id) ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, { ...task, id: newId('wf') }]);
    // The form already saved this task's time and area, so drop any pending drag for it.
    if (moves[task.id]) {
      const rest = { ...moves };
      delete rest[task.id];
      setMoves(rest);
    }
    setEditingTask(null);
  };

  const blankTask = (time = '09:00', taskArea = WORKFLOW_AREAS[0]): WorkflowTask => {
    const weekdays = [1, 2, 3, 4, 5, 6];
    const day = weekdayOf(date);
    return {
      id: '',
      time,
      title: '',
      area: taskArea,
      ownerRole: '',
      weekdays: weekdays.includes(day) ? weekdays : [...weekdays, day].sort(),
      sopId: '',
      notes: '',
    };
  };

  const moveTask = (id: string, hour: number, toArea: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const now = placed(t);
    setMoves({ ...moves, [id]: { time: moveTime(now.time, hour), area: toArea } });
  };

  const saveArrangement = () => {
    onSaveTasks(tasks.map(placed));
    setMoves({});
    setArranging(false);
  };

  const stopArranging = () => {
    if (changedCount && !confirm(`放棄 ${changedCount} 項未儲存嘅改動？`)) return;
    setMoves({});
    setArranging(false);
  };

  if (manageMode && isManager) {
    return (
      <div className="space-y-6">
        <Panel
          title={`全部流程項目 (${tasks.length})`}
          actions={
            <>
              <button onClick={() => setEditingTask(blankTask())} className={primaryButtonClass}>
                <Plus className="w-4 h-4 text-emerald-400" />
                新增項目
              </button>
              <button onClick={() => setManageMode(false)} className={secondaryButtonClass}>
                <ListChecks className="w-4 h-4" />
                返回時間表
              </button>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">時間</th>
                  <th className="py-3 px-3">工作</th>
                  <th className="py-3 px-3">範疇 / 負責</th>
                  <th className="py-3 px-3">日子</th>
                  <th className="py-3 px-3">SOP</th>
                  <th className="py-3 px-5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...tasks]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-3 px-5 font-mono font-black">{t.time}</td>
                      <td className="py-3 px-3 font-bold">
                        {t.title}
                        {t.notes && <div className="text-xs text-slate-500 font-medium">{t.notes}</div>}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <span className={`font-black px-1.5 py-0.5 ${areaStyle(t.area).tag}`}>{t.area}</span>
                        <div className="text-slate-500 mt-1">{t.ownerRole}</div>
                      </td>
                      <td className="py-3 px-3 text-xs font-bold">
                        {[1, 2, 3, 4, 5, 6, 0].filter((d) => t.weekdays.includes(d)).map((d) => WEEKDAY_LABELS[d]).join(' ')}
                      </td>
                      <td className="py-3 px-3 text-xs font-mono">{sops.find((s) => s.id === t.sopId)?.code || '—'}</td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <button onClick={() => setEditingTask({ ...t })} className="px-2.5 py-1 text-xs font-black border border-slate-200 hover:bg-slate-900 hover:text-white cursor-pointer">
                          編輯
                        </button>
                        <button
                          onClick={() => confirm(`刪除「${t.title}」？`) && onSaveTasks(tasks.filter((x) => x.id !== t.id))}
                          className="p-1 ml-1 text-slate-400 hover:text-rose-600 cursor-pointer align-middle"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {editingTask && (
          <TaskForm task={editingTask} sops={sops} positions={positions} areas={orderAreas([...WORKFLOW_AREAS, ...tasks.map((t) => t.area)])} onClose={() => setEditingTask(null)} onSave={saveTask} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: title, date with arrows, progress, actions */}
      <div className="bg-white border border-slate-200 shadow-xs p-4 sm:p-6 no-print">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-widest">DAILY WORKFLOW</p>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {date === today ? '今日工作時間表' : '工作時間表'}
            </h2>
            <div className="flex items-center gap-1 mt-1 -ml-2">
              <button onClick={() => setDate(addDays(date, -1))} className="p-1.5 hover:bg-slate-100 cursor-pointer" title="前一日">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-slate-600">{formatFullDateZh(date)}</span>
              <button onClick={() => setDate(addDays(date, 1))} className="p-1.5 hover:bg-slate-100 cursor-pointer" title="後一日">
                <ChevronRight className="w-4 h-4" />
              </button>
              {date !== today && (
                <button onClick={() => setDate(today)} className="ml-1 text-[11px] font-black px-2 py-0.5 border border-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer">
                  返回今日
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-600 mr-1">
              已完成 <span className="font-mono font-black text-slate-900">{doneCount}/{dayTasks.length}</span>
            </span>
            {isManager && !arranging && (
              <>
                <button onClick={() => setArranging(true)} className={`${secondaryButtonClass} hidden lg:flex`}>
                  <GripVertical className="w-4 h-4" />
                  編排時間表
                </button>
                <button onClick={() => setManageMode(true)} className={secondaryButtonClass}>
                  <Pencil className="w-4 h-4" />
                  全部項目
                </button>
              </>
            )}
            {arranging && (
              <>
                <button onClick={stopArranging} className={secondaryButtonClass}>
                  <X className="w-4 h-4" />
                  取消
                </button>
                <button onClick={saveArrangement} disabled={!changedCount} className={primaryButtonClass}>
                  <Check className="w-4 h-4" />
                  儲存時間表{changedCount ? `（${changedCount}）` : ''}
                </button>
              </>
            )}
            {!arranging && (
              <button onClick={() => printPage('portrait')} className={`${secondaryButtonClass} hidden lg:flex`}>
                <Printer className="w-4 h-4" />
                列印
              </button>
            )}
          </div>
        </div>
        <div className="h-1.5 bg-slate-100 mt-4">
          <div className={`h-full transition-all ${percent === 100 ? 'bg-emerald-500' : 'bg-slate-900'}`} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {arranging && (
        <p className="text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 p-3 no-print">
          編排中：拖住工序嘅 ⋮⋮ 放去另一格，就可以改時間或者崗位（分鐘唔變）；撳 ✎ 改內容，撳格入面嘅 ＋ 加新工序。
          改動會套用到每個要做呢項工序嘅日子，撳「儲存時間表」先會生效。
        </p>
      )}

      {/* Who is on today, desktop only so phones get to the list at once */}
      {!arranging && onDuty.length > 0 && (
        <div className="hidden lg:flex flex-wrap items-center gap-1.5 no-print">
          <span className="text-[11px] font-black text-slate-500 mr-1">當日返工</span>
          {onDuty.map(({ shift, employee }) => (
            <span key={shift.id} className={`text-xs font-bold px-2 py-1 border ${STAFF_COLORS[employee.color]?.chip || STAFF_COLORS.slate.chip}`}>
              {employee.name} <span className="font-mono">{shift.start}–{shift.end}</span>
            </span>
          ))}
        </div>
      )}

      {!arranging && areasToday.length > 1 && (
        <div className="flex flex-wrap gap-1.5 no-print">
          {['all', ...areasToday].map((a) => (
            <button
              key={a}
              onClick={() => setArea(a)}
              className={`text-xs px-3 py-1.5 font-black transition cursor-pointer border ${
                area === a ? 'bg-slate-900 text-white border-slate-900' : `${a === 'all' ? 'bg-white text-slate-600 border-slate-200' : `${areaStyle(a).tag} border-transparent`} hover:border-slate-900`
              }`}
            >
              {a === 'all' ? '全部' : a}
            </button>
          ))}
        </div>
      )}

      {visibleTasks.length === 0 && !arranging ? (
        <Panel>
          <EmptyState title="呢日冇設定工作" hint={isManager ? '撳「全部項目」新增' : undefined} />
        </Panel>
      ) : (
        <>
          <TimeGrid
            tasks={visibleTasks}
            areas={arranging ? orderAreas([...WORKFLOW_AREAS, ...areasToday]) : orderAreas(visibleTasks.map((t) => t.area))}
            arranging={arranging}
            checkMap={checkMap}
            sopOf={sopOf}
            employeeName={employeeName}
            onToggle={toggle}
            onOpenSop={setViewingSop}
            onEdit={(t) => setEditingTask({ ...t })}
            onAdd={(hour, a) => setEditingTask(blankTask(hourLabel(hour), a))}
            onMove={moveTask}
          />
          <TimeList
            tasks={visibleTasks}
            checkMap={checkMap}
            sopOf={sopOf}
            employeeName={employeeName}
            onToggle={toggle}
            onOpenSop={setViewingSop}
          />
        </>
      )}

      {!currentUserId && (
        <p className="text-xs text-amber-700 font-bold no-print">提示：喺頁頂揀「我係」，打剔時就會記低係邊個做。</p>
      )}

      {/* Paper checklist */}
      <div className="print-area hidden print:block">
        <div className="p-3 border-b-2 border-black">
          <div className="text-lg font-black">每日工作清單 · {formatFullDateZh(date)}</div>
          <div className="text-xs">當日返工：{onDuty.map((x) => x.employee.name).join('、') || '—'}</div>
        </div>
        {visibleTasks.map((task) => {
          const check = checkMap.get(task.id);
          return (
            <div key={task.id} className="flex items-center gap-3 px-3 py-2 border-b border-slate-300 text-sm">
              <span className="text-xl">{check ? '☑' : '☐'}</span>
              <span className="font-mono font-black w-12">{task.time}</span>
              <span className="font-black w-16">{task.area}</span>
              <span className="flex-1">{task.title}</span>
              <span className="text-xs">{check ? `${employeeName(check.doneBy) || '已完成'} ${formatTime(check.doneAt)}` : '完成人：________'}</span>
            </div>
          );
        })}
      </div>

      {editingTask && (
        <TaskForm
          task={editingTask}
          sops={sops}
          positions={positions}
          areas={orderAreas([...WORKFLOW_AREAS, ...tasks.map((t) => t.area)])}
          onClose={() => setEditingTask(null)}
          onSave={saveTask}
        />
      )}
      {viewingSop && <SOPViewer sop={viewingSop} onClose={() => setViewingSop(null)} />}
    </div>
  );
};

// ---------- One task ----------

interface CardProps {
  task: WorkflowTask;
  check?: WorkflowCheck;
  sop?: SOP;
  doneBy?: string;
  onToggle: () => void;
  onOpenSop: () => void;
}

const TaskMeta: React.FC<CardProps & { showTime: boolean }> = ({ task, sop, showTime, onOpenSop }) => (
  <div className="flex flex-wrap items-center gap-1.5 mt-1">
    <span className={`text-[11px] font-black px-1.5 py-0.5 ${areaStyle(task.area).tag}`}>{task.area}</span>
    {showTime && <span className="font-mono text-[11px] font-black text-slate-600">{task.time}</span>}
    {task.ownerRole && <span className="text-[11px] font-bold text-slate-500">{task.ownerRole}</span>}
    {sop && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenSop();
        }}
        className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 hover:underline cursor-pointer"
      >
        <BookOpen className="w-3 h-3" />
        {sop.code}
      </button>
    )}
  </div>
);

const DoneBy: React.FC<{ check?: WorkflowCheck; doneBy?: string }> = ({ check, doneBy }) =>
  check ? (
    <p className="text-[11px] font-bold text-emerald-700 mt-1">
      {doneBy || '已完成'} <span className="font-mono">{formatTime(check.doneAt)}</span>
    </p>
  ) : null;

// ---------- Desktop: hours down, areas across ----------

const TimeGrid: React.FC<{
  tasks: WorkflowTask[];
  areas: string[];
  arranging: boolean;
  checkMap: Map<string, WorkflowCheck>;
  sopOf: (t: WorkflowTask) => SOP | undefined;
  employeeName: (id?: string) => string | undefined;
  onToggle: (t: WorkflowTask) => void;
  onOpenSop: (sop: SOP) => void;
  onEdit: (t: WorkflowTask) => void;
  onAdd: (hour: number, area: string) => void;
  onMove: (id: string, hour: number, area: string) => void;
}> = ({ tasks, areas, arranging, checkMap, sopOf, employeeName, onToggle, onOpenSop, onEdit, onAdd, onMove }) => {
  const [over, setOver] = useState('');
  const hoursUsed = tasks.map((t) => hourOf(t.time));
  const first = hoursUsed.length ? Math.min(...hoursUsed) : 8;
  const last = hoursUsed.length ? Math.max(...hoursUsed) : 17;
  // While arranging, leave an hour either side to drop into.
  const from = arranging ? Math.max(0, first - 1) : first;
  const to = arranging ? Math.min(23, last + 1) : last;
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const columns = `68px repeat(${areas.length}, minmax(150px, 1fr))`;

  return (
    <div className="hidden lg:block bg-white border border-slate-200 shadow-xs overflow-x-auto no-print">
      <div className="grid" style={{ gridTemplateColumns: columns }}>
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-3 text-xs font-black text-slate-500">時間</div>
        {areas.map((a) => {
          const style = areaStyle(a);
          const Icon = style.icon;
          const inArea = tasks.filter((t) => t.area === a);
          const done = inArea.filter((t) => checkMap.has(t.id)).length;
          return (
            <div key={a} className={`border-b border-l border-slate-200 px-2 py-3 flex items-center justify-center gap-1.5 font-black text-sm ${style.head}`}>
              <Icon className="w-4 h-4" />
              {a}
              {inArea.length > 0 && <span className="font-mono text-[11px] opacity-70">{done}/{inArea.length}</span>}
            </div>
          );
        })}
        {hours.map((hour) => (
          <React.Fragment key={hour}>
            <div className="border-b border-slate-100 px-3 py-3 font-mono font-black text-sm text-slate-700">{hourLabel(hour)}</div>
            {areas.map((a) => {
              const key = `${hour}|${a}`;
              const cellTasks = tasks.filter((t) => hourOf(t.time) === hour && t.area === a);
              return (
                <div
                  key={key}
                  data-cell={key}
                  onDragOver={(e) => {
                    if (!arranging) return;
                    e.preventDefault();
                    if (over !== key) setOver(key);
                  }}
                  onDragLeave={() => over === key && setOver('')}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver('');
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) onMove(id, hour, a);
                  }}
                  className={`group border-b border-l border-slate-100 p-1.5 space-y-1.5 min-h-[56px] ${
                    over === key ? 'bg-blue-50 outline-2 outline-dashed outline-blue-400 -outline-offset-4' : ''
                  }`}
                >
                  {cellTasks.map((task) => {
                    const check = checkMap.get(task.id);
                    const sop = sopOf(task);
                    return (
                      <div
                        key={task.id}
                        data-task={task.id}
                        draggable={arranging}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', task.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className={`border p-2 flex items-start gap-1.5 shadow-xs ${areaStyle(task.area).card} ${arranging ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        {arranging && <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-black leading-snug ${check ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</p>
                          <TaskMeta task={task} sop={sop} showTime={!task.time.endsWith(':00')} onToggle={() => onToggle(task)} onOpenSop={() => sop && onOpenSop(sop)} />
                          <DoneBy check={check} doneBy={employeeName(check?.doneBy)} />
                        </div>
                        {arranging ? (
                          <button onClick={() => onEdit(task)} className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer shrink-0" title="改內容">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onToggle(task)}
                            className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center transition cursor-pointer ${
                              check ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 hover:border-slate-900'
                            }`}
                            title={check ? '取消打剔' : '完成'}
                          >
                            {check && <Check className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {arranging && (
                    <button
                      onClick={() => onAdd(hour, a)}
                      className="w-full py-1 text-xs font-black text-slate-400 border border-dashed border-slate-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-900 cursor-pointer"
                      title={`喺 ${hourLabel(hour)} ${a} 加工序`}
                    >
                      ＋
                    </button>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ---------- Phone and tablet: grouped by hour ----------

const TimeList: React.FC<{
  tasks: WorkflowTask[];
  checkMap: Map<string, WorkflowCheck>;
  sopOf: (t: WorkflowTask) => SOP | undefined;
  employeeName: (id?: string) => string | undefined;
  onToggle: (t: WorkflowTask) => void;
  onOpenSop: (sop: SOP) => void;
}> = ({ tasks, checkMap, sopOf, employeeName, onToggle, onOpenSop }) => {
  const hours = Array.from(new Set(tasks.map((t) => hourOf(t.time)))).sort((a, b) => a - b);
  return (
    <div className="lg:hidden space-y-4 no-print">
      {hours.map((hour) => (
        <section key={hour}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full border-2 border-slate-500 bg-white" />
            <span className="font-mono font-black text-slate-800">{hourLabel(hour)}</span>
          </div>
          <div className="ml-1.5 pl-3 border-l-2 border-slate-200 space-y-2">
            {tasks
              .filter((t) => hourOf(t.time) === hour)
              .map((task) => {
                const check = checkMap.get(task.id);
                const sop = sopOf(task);
                return (
                  <div key={task.id} className={`border p-3 flex items-center gap-3 ${areaStyle(task.area).card}`}>
                    <button
                      onClick={() => onToggle(task)}
                      className={`w-10 h-10 shrink-0 border-2 flex items-center justify-center bg-white transition cursor-pointer ${
                        check ? 'bg-emerald-500! border-emerald-500 text-white' : 'border-slate-300'
                      }`}
                      title={check ? '取消打剔' : '完成'}
                    >
                      {check && <Check className="w-6 h-6" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-black leading-snug ${check ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</p>
                      <TaskMeta task={task} sop={undefined} showTime={!task.time.endsWith(':00')} onToggle={() => onToggle(task)} onOpenSop={() => undefined} />
                      <DoneBy check={check} doneBy={employeeName(check?.doneBy)} />
                    </div>
                    {sop && (
                      <button
                        onClick={() => onOpenSop(sop)}
                        className="shrink-0 px-2.5 py-2 bg-white border border-slate-300 text-xs font-black text-slate-700 cursor-pointer"
                      >
                        SOP
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
};

// ---------- Add or change a task ----------

const TaskForm: React.FC<{
  task: WorkflowTask;
  sops: SOP[];
  positions: string[];
  areas: string[];
  onClose: () => void;
  onSave: (task: WorkflowTask) => void;
}> = ({ task, sops, positions, areas, onClose, onSave }) => {
  const [form, setForm] = useState<WorkflowTask>(task);
  const set = (patch: Partial<WorkflowTask>) => setForm({ ...form, ...patch });

  return (
    <Modal eyebrow="WORKFLOW ITEM" title={task.id ? '編輯流程項目' : '新增流程項目'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim() || form.weekdays.length === 0) return;
          onSave({ ...form, title: form.title.trim(), area: form.area.trim() || WORKFLOW_AREAS[0], ownerRole: form.ownerRole?.trim(), sopId: form.sopId || undefined });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="時間" required>
            <input type="time" className={`${inputClass} font-mono`} value={form.time} onChange={(e) => set({ time: e.target.value })} required />
          </Field>
          <Field label="工作內容" required>
            <input className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="範疇">
            <ChoiceSelect value={form.area} options={areas} onChange={(a) => set({ area: a })} placeholder="揀範疇…" newLabel="＋ 新增範疇…" />
          </Field>
          <Field label="負責崗位">
            <ChoiceSelect
              value={form.ownerRole || ''}
              options={[ALL_STAFF, ...positions.filter((p) => p !== ALL_STAFF)]}
              onChange={(ownerRole) => set({ ownerRole })}
              placeholder="（唔指定）"
              newLabel="＋ 新增職位…"
            />
          </Field>
        </div>
        <Field label="邊幾日要做" required>
          <WeekdayPicker value={form.weekdays} onChange={(weekdays) => set({ weekdays })} />
        </Field>
        <Field label="相關 SOP">
          <select className={inputClass} value={form.sopId || ''} onChange={(e) => set({ sopId: e.target.value })}>
            <option value="">（冇）</option>
            {sops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="備註">
          <input className={inputClass} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            取消
          </button>
          <button type="submit" className={primaryButtonClass}>
            <Check className="w-4 h-4" />
            儲存
          </button>
        </div>
      </form>
    </Modal>
  );
};
