import React, { useEffect, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, ListChecks, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { Employee, RosterShift, SOP, WorkflowCheck, WorkflowTask } from '../types';
import { STAFF_COLORS, WORKFLOW_AREAS } from '../data/defaults';
import { WEEKDAY_LABELS, addDays, formatFullDateZh, todayISO, weekdayOf } from '../utils/dates';
import { SOPViewer } from './SOPLibrary';
import {
  ChoiceSelect,
  EmptyState,
  Field,
  Modal,
  PageHeader,
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
  const [editingTask, setEditingTask] = useState<WorkflowTask | null>(null);
  const [viewingSop, setViewingSop] = useState<SOP | null>(null);

  const dayTasks = tasksForDate(tasks, date);
  const visibleTasks = dayTasks.filter((t) => area === 'all' || t.area === area);
  const checkMap = new Map(checks.filter((c) => c.date === date).map((c) => [c.taskId, c]));
  const doneCount = dayTasks.filter((t) => checkMap.has(t.id)).length;
  const percent = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;
  const onDuty = shifts
    .filter((s) => s.date === date)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => ({ shift: s, employee: employees.find((e) => e.id === s.employeeId) }))
    .filter((x): x is { shift: RosterShift; employee: Employee } => !!x.employee);
  const areasToday = Array.from(new Set(dayTasks.map((t) => t.area)));

  const employeeName = (id?: string) => employees.find((e) => e.id === id)?.name;

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
    setEditingTask(null);
  };

  const blankTask = (): WorkflowTask => ({
    id: '',
    time: '09:00',
    title: '',
    area: WORKFLOW_AREAS[0],
    ownerRole: '',
    weekdays: [1, 2, 3, 4, 5, 6],
    sopId: '',
    notes: '',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DAILY WORKFLOW"
        title="每日工作流程"
        subtitle="按時間做嘅每日工作清單。做完撳一下打剔，系統會記低邊個幾點做。"
        actions={
          <>
            {isManager && (
              <button onClick={() => setManageMode(!manageMode)} className={secondaryButtonClass}>
                {manageMode ? <ListChecks className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                {manageMode ? '返回清單' : '管理流程'}
              </button>
            )}
            {!manageMode && (
              <button onClick={() => printPage('portrait')} className={primaryButtonClass}>
                <Printer className="w-4 h-4" />
                列印清單
              </button>
            )}
          </>
        }
      />

      {manageMode && isManager ? (
        <Panel
          title={`全部流程項目 (${tasks.length})`}
          actions={
            <button onClick={() => setEditingTask(blankTask())} className={primaryButtonClass}>
              <Plus className="w-4 h-4 text-emerald-400" />
              新增項目
            </button>
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
                        <div className="font-black">{t.area}</div>
                        <div className="text-slate-500">{t.ownerRole}</div>
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
      ) : (
        <>
          <div className="bg-white border border-slate-200 shadow-xs p-3 flex items-center justify-between gap-2 no-print">
            <button onClick={() => setDate(addDays(date, -1))} className="p-2 hover:bg-slate-100 cursor-pointer" title="前一日">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <span className="font-black text-sm sm:text-base">{formatFullDateZh(date)}</span>
              {date !== today && (
                <button onClick={() => setDate(today)} className="text-[11px] font-black px-2.5 py-1 border border-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer">
                  返回今日
                </button>
              )}
            </div>
            <button onClick={() => setDate(addDays(date, 1))} className="p-2 hover:bg-slate-100 cursor-pointer" title="後一日">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 no-print">
            <div className="bg-white border border-slate-200 shadow-xs p-5 lg:col-span-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">完成進度</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black font-mono">{doneCount}/{dayTasks.length}</span>
                <span className="text-sm font-black text-slate-500">{percent}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 mt-3">
                <div className={`h-full transition-all ${percent === 100 ? 'bg-emerald-500' : 'bg-slate-900'}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
            <div className="bg-white border border-slate-200 shadow-xs p-5 lg:col-span-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">當日返工</p>
              {onDuty.length === 0 ? (
                <p className="text-sm text-slate-400 font-bold mt-2">更表冇人返工</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {onDuty.map(({ shift, employee }) => (
                    <span key={shift.id} className={`text-xs font-bold px-2 py-1 border ${STAFF_COLORS[employee.color]?.chip || STAFF_COLORS.slate.chip}`}>
                      {employee.name} <span className="font-mono">{shift.start}–{shift.end}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {areasToday.length > 1 && (
            <div className="flex flex-wrap gap-2 no-print">
              {['all', ...areasToday].map((a) => (
                <button
                  key={a}
                  onClick={() => setArea(a)}
                  className={`text-xs px-3 py-1.5 font-black transition cursor-pointer ${area === a ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-900'}`}
                >
                  {a === 'all' ? '全部' : a}
                </button>
              ))}
            </div>
          )}

          <div className="print-area bg-white border border-slate-200 shadow-xs">
            <div className="hidden print:block p-3 border-b-2 border-black">
              <div className="text-lg font-black">每日工作清單 · {formatFullDateZh(date)}</div>
              <div className="text-xs">當日返工：{onDuty.map((x) => x.employee.name).join('、') || '—'}</div>
            </div>
            {visibleTasks.length === 0 ? (
              <EmptyState title="呢日冇設定工作" hint={isManager ? '撳「管理流程」新增' : undefined} />
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleTasks.map((task) => {
                  const check = checkMap.get(task.id);
                  const sop = sops.find((s) => s.id === task.sopId);
                  return (
                    <div key={task.id} className={`flex items-center gap-4 px-4 sm:px-5 py-3.5 ${check ? 'bg-emerald-50/50' : ''}`}>
                      <button
                        onClick={() => toggle(task)}
                        className={`w-9 h-9 shrink-0 border-2 flex items-center justify-center transition cursor-pointer ${
                          check ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-slate-900'
                        }`}
                        title={check ? '取消打剔' : '完成'}
                      >
                        {check && <Check className="w-5 h-5" />}
                      </button>
                      <span className="hidden print:inline text-xl">{check ? '☑' : '☐'}</span>
                      <div className="font-mono font-black text-sm w-12 shrink-0">{task.time}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold ${check ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs">
                          <span className="font-black text-slate-500">{task.area}</span>
                          {task.ownerRole && <span className="text-slate-400">· {task.ownerRole}</span>}
                          {task.notes && <span className="text-slate-400">· {task.notes}</span>}
                          {sop && (
                            <button onClick={() => setViewingSop(sop)} className="inline-flex items-center gap-1 font-black text-blue-700 hover:underline cursor-pointer">
                              <BookOpen className="w-3 h-3" />
                              {sop.code}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        {check ? (
                          <span className="font-bold text-emerald-700">
                            {employeeName(check.doneBy) || '已完成'}
                            <span className="font-mono ml-1">{formatTime(check.doneAt)}</span>
                          </span>
                        ) : (
                          <span className="hidden print:inline">完成人：________</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {!currentUserId && (
            <p className="text-xs text-amber-700 font-bold no-print">提示：喺頁頂揀「我係」，打剔時就會記低係邊個做。</p>
          )}
        </>
      )}

      {editingTask && (
        <TaskForm task={editingTask} sops={sops} positions={positions} onClose={() => setEditingTask(null)} onSave={saveTask} />
      )}
      {viewingSop && <SOPViewer sop={viewingSop} onClose={() => setViewingSop(null)} />}
    </div>
  );
};

const TaskForm: React.FC<{
  task: WorkflowTask;
  sops: SOP[];
  positions: string[];
  onClose: () => void;
  onSave: (task: WorkflowTask) => void;
}> = ({ task, sops, positions, onClose, onSave }) => {
  const [form, setForm] = useState<WorkflowTask>(task);
  const set = (patch: Partial<WorkflowTask>) => setForm({ ...form, ...patch });

  return (
    <Modal eyebrow="WORKFLOW ITEM" title={task.id ? '編輯流程項目' : '新增流程項目'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim() || form.weekdays.length === 0) return;
          onSave({ ...form, title: form.title.trim(), ownerRole: form.ownerRole?.trim(), sopId: form.sopId || undefined });
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
            <input className={inputClass} list="wf-areas" value={form.area} onChange={(e) => set({ area: e.target.value })} />
            <datalist id="wf-areas">
              {WORKFLOW_AREAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
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
