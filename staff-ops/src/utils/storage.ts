// All data lives in this browser's localStorage. Keys are prefixed so the
// staff app never touches the invoice system's data, even on the same domain.

export const STORAGE_KEYS = {
  SETTINGS: 'todays_ops_settings_v1',
  EMPLOYEES: 'todays_ops_employees_v1',
  SHIFT_TEMPLATES: 'todays_ops_shift_templates_v1',
  ROSTER: 'todays_ops_roster_v1',
  LEAVES: 'todays_ops_leaves_v1',
  HOLIDAYS: 'todays_ops_holidays_v1',
  WORKFLOW_TASKS: 'todays_ops_workflow_tasks_v1',
  WORKFLOW_CHECKS: 'todays_ops_workflow_checks_v1',
  SOPS: 'todays_ops_sops_v1',
  STOCK_ITEMS: 'todays_ops_stock_items_v1',
  MOVEMENTS: 'todays_ops_stock_movements_v1',
} as const;

export const loadStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load ${key} from storage`, e);
  }
  return fallback;
};

export const saveStored = <T,>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to storage`, e);
    alert('儲存失敗：瀏覽器儲存空間可能已滿，請先匯出備份。');
  }
};

export const downloadBackupFile = (backup: unknown) => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `staff_ops_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportBackup = () =>
  downloadBackupFile({
    app: 'todays-staff-ops',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(
      Object.values(STORAGE_KEYS)
        .map((key) => [key, loadStored<unknown>(key, null)])
        .filter(([, value]) => value !== null)
    ),
  });

export const importBackup = (json: string): boolean => {
  try {
    const parsed = JSON.parse(json);
    if (parsed?.app !== 'todays-staff-ops' || typeof parsed.data !== 'object') return false;
    const knownKeys: string[] = Object.values(STORAGE_KEYS);
    Object.entries(parsed.data as Record<string, unknown>).forEach(([key, value]) => {
      if (knownKeys.includes(key)) saveStored(key, value);
    });
    return true;
  } catch (e) {
    console.error('Failed to import backup', e);
    return false;
  }
};

export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
};
