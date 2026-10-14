import { useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import {
  AppSettings,
  Employee,
  Holiday,
  LeaveRecord,
  RosterShift,
  ShiftTemplate,
  SOP,
  StockItem,
  StockMovement,
  WorkflowCheck,
  WorkflowTask,
} from '../types';
import {
  DEFAULT_EMPLOYEES,
  DEFAULT_HOLIDAYS,
  DEFAULT_LEAVES,
  DEFAULT_MOVEMENTS,
  DEFAULT_ROSTER,
  DEFAULT_SETTINGS,
  DEFAULT_SHIFT_TEMPLATES,
  DEFAULT_SOPS,
  DEFAULT_STOCK_ITEMS,
  DEFAULT_WORKFLOW_TASKS,
} from './defaults';
import { useStoredState } from '../hooks/useStoredState';
import { STORAGE_KEYS } from '../utils/storage';
import { addDays, todayISO } from '../utils/dates';
import { computeStockLevels } from '../utils/inventory';
import { COLLECTIONS, StockLevelDoc, stockLevelOps, useCloudCollection, useCloudDoc } from '../lib/cloud';

type Saver<T> = (next: T) => void;

/** Everything the screens read and write, identical in local and cloud mode. */
export interface AppData {
  ready: boolean;
  settings: AppSettings;
  saveSettings: Saver<AppSettings>;
  employees: Employee[];
  saveEmployees: Saver<Employee[]>;
  templates: ShiftTemplate[];
  saveTemplates: Saver<ShiftTemplate[]>;
  shifts: RosterShift[];
  saveShifts: Saver<RosterShift[]>;
  leaves: LeaveRecord[];
  saveLeaves: Saver<LeaveRecord[]>;
  holidays: Holiday[];
  saveHolidays: Saver<Holiday[]>;
  tasks: WorkflowTask[];
  saveTasks: Saver<WorkflowTask[]>;
  checks: WorkflowCheck[];
  saveChecks: Saver<WorkflowCheck[]>;
  sops: SOP[];
  saveSops: Saver<SOP[]>;
  stockItems: StockItem[];
  saveStockItems: Saver<StockItem[]>;
  movements: StockMovement[];
  saveMovements: Saver<StockMovement[]>;
  /** Current quantity per stock item id; an entry exists once an item has records. */
  levels: Map<string, number>;
  /**
   * Cloud mode keeps only recent shifts, ticks and movements live. Screens call
   * these to widen the window when someone looks further back. Local mode
   * always has everything, so it leaves them undefined.
   */
  history?: {
    ensureShiftsFrom: (date: string) => void;
    ensureChecksFrom: (date: string) => void;
    movementsFrom: string;
    loadOlderMovements: () => void;
  };
}

export const useLocalAppData = (): AppData => {
  const [settings, saveSettings] = useStoredState<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [employees, saveEmployees] = useStoredState<Employee[]>(STORAGE_KEYS.EMPLOYEES, DEFAULT_EMPLOYEES);
  const [templates, saveTemplates] = useStoredState<ShiftTemplate[]>(STORAGE_KEYS.SHIFT_TEMPLATES, DEFAULT_SHIFT_TEMPLATES);
  const [shifts, saveShifts] = useStoredState<RosterShift[]>(STORAGE_KEYS.ROSTER, DEFAULT_ROSTER);
  const [leaves, saveLeaves] = useStoredState<LeaveRecord[]>(STORAGE_KEYS.LEAVES, DEFAULT_LEAVES);
  const [holidays, saveHolidays] = useStoredState<Holiday[]>(STORAGE_KEYS.HOLIDAYS, DEFAULT_HOLIDAYS);
  const [tasks, saveTasks] = useStoredState<WorkflowTask[]>(STORAGE_KEYS.WORKFLOW_TASKS, DEFAULT_WORKFLOW_TASKS);
  const [checks, saveChecks] = useStoredState<WorkflowCheck[]>(STORAGE_KEYS.WORKFLOW_CHECKS, []);
  const [sops, saveSops] = useStoredState<SOP[]>(STORAGE_KEYS.SOPS, DEFAULT_SOPS);
  const [stockItems, saveStockItems] = useStoredState<StockItem[]>(STORAGE_KEYS.STOCK_ITEMS, DEFAULT_STOCK_ITEMS);
  const [movements, saveMovements] = useStoredState<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, DEFAULT_MOVEMENTS);
  const levels = useMemo(() => computeStockLevels(movements), [movements]);

  return {
    ready: true,
    settings, saveSettings,
    employees, saveEmployees,
    templates, saveTemplates,
    shifts, saveShifts,
    leaves, saveLeaves,
    holidays, saveHolidays,
    tasks, saveTasks,
    checks, saveChecks,
    sops, saveSops,
    stockItems, saveStockItems,
    movements, saveMovements,
    levels,
  };
};

// How far back cloud mode keeps records live before someone asks for more.
const SHIFT_WINDOW_DAYS = 56; // covers the part-time 4-week hour check
const CHECK_WINDOW_DAYS = 14;
const MOVEMENT_WINDOW_DAYS = 60;

const byKindThenId = (a: StockItem, b: StockItem) =>
  a.kind === b.kind ? 0 : a.kind === 'product' ? -1 : 1;

export const useCloudAppData = (): AppData => {
  const today = todayISO();
  const [shiftsFrom, setShiftsFrom] = useState(addDays(today, -SHIFT_WINDOW_DAYS));
  const [checksFrom, setChecksFrom] = useState(addDays(today, -CHECK_WINDOW_DAYS));
  const [movementsFrom, setMovementsFrom] = useState(addDays(today, -MOVEMENT_WINDOW_DAYS));

  const [settings, saveSettings] = useCloudDoc<AppSettings>(COLLECTIONS.config, 'settings', DEFAULT_SETTINGS);
  const [employees, saveEmployees, r1] = useCloudCollection<Employee>(COLLECTIONS.employees);
  const [templates, saveTemplates, r2] = useCloudCollection<ShiftTemplate>(COLLECTIONS.shiftTemplates);
  const [shifts, saveShifts, r3] = useCloudCollection<RosterShift>(COLLECTIONS.shifts, {
    queries: [[where('date', '>=', shiftsFrom)]],
    queryKey: shiftsFrom,
  });
  const [leaves, saveLeaves, r4] = useCloudCollection<LeaveRecord>(COLLECTIONS.leaves);
  const [holidays, saveHolidays, r5] = useCloudCollection<Holiday>(COLLECTIONS.holidays);
  const [tasks, saveTasks, r6] = useCloudCollection<WorkflowTask>(COLLECTIONS.workflowTasks);
  const [checks, saveChecks, r7] = useCloudCollection<WorkflowCheck>(COLLECTIONS.workflowChecks, {
    queries: [[where('date', '>=', checksFrom)]],
    queryKey: checksFrom,
  });
  const [sops, saveSops, r8] = useCloudCollection<SOP>(COLLECTIONS.sops);
  const [stockItems, saveStockItems, r9] = useCloudCollection<StockItem>(COLLECTIONS.stockItems, {
    sort: byKindThenId,
  });
  // Recent movements for the log, plus any received batch still near its expiry date.
  const [movements, saveMovements, r10] = useCloudCollection<StockMovement>(COLLECTIONS.movements, {
    queries: [[where('date', '>=', movementsFrom)], [where('expiryDate', '>=', addDays(today, -7))]],
    queryKey: movementsFrom,
    extraOps: stockLevelOps,
  });
  const [levelDocs, , r11] = useCloudCollection<StockLevelDoc>(COLLECTIONS.stockLevels);
  const levels = useMemo(
    // Increments can leave float noise (0.1 + 0.2), so round like local mode does.
    () => new Map(levelDocs.map((d) => [d.itemId, Math.round(d.qty * 1000) / 1000])),
    [levelDocs]
  );

  return {
    ready: r1 && r2 && r3 && r4 && r5 && r6 && r7 && r8 && r9 && r10 && r11,
    settings, saveSettings,
    employees, saveEmployees,
    templates, saveTemplates,
    shifts, saveShifts,
    leaves, saveLeaves,
    holidays, saveHolidays,
    tasks, saveTasks,
    checks, saveChecks,
    sops, saveSops,
    stockItems, saveStockItems,
    movements, saveMovements,
    levels,
    history: {
      ensureShiftsFrom: (date) => date < shiftsFrom && setShiftsFrom(date),
      ensureChecksFrom: (date) => date < checksFrom && setChecksFrom(date),
      movementsFrom,
      loadOlderMovements: () => setMovementsFrom(addDays(movementsFrom, -MOVEMENT_WINDOW_DAYS * 3)),
    },
  };
};
