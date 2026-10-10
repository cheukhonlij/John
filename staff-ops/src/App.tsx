import React, { useState } from 'react';
import { Lock, LogOut, Menu, X } from 'lucide-react';
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
} from './types';
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
} from './data/defaults';
import { STORAGE_KEYS } from './utils/storage';
import { useStoredState } from './hooks/useStoredState';
import { Dashboard, NavTab } from './components/Dashboard';
import { RosterPlanner } from './components/RosterPlanner';
import { DailyWorkflow } from './components/DailyWorkflow';
import { Inventory, InventoryTab } from './components/Inventory';
import { LeaveManager } from './components/LeaveManager';
import { SOPLibrary } from './components/SOPLibrary';
import { StaffManager } from './components/StaffManager';
import { Settings } from './components/Settings';
import { Modal, inputClass, primaryButtonClass } from './components/ui';

// Which staff member is using this device; a per-device convenience, not a login.
const CURRENT_USER_KEY = 'todays_ops_current_user_v1';

const NAV_ITEMS: { id: NavTab; label: string; managerOnly?: boolean }[] = [
  { id: 'dashboard', label: '今日' },
  { id: 'roster', label: '排更' },
  { id: 'workflow', label: '每日流程' },
  { id: 'inventory', label: '倉存／入貨落貨' },
  { id: 'leave', label: '假期' },
  { id: 'sop', label: 'SOP' },
  { id: 'staff', label: '員工' },
  { id: 'settings', label: '設定', managerOnly: true },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>('stock');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Manager mode lasts until locked or the page reloads.
  const [isManager, setIsManager] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);

  const [settings, setSettings] = useStoredState<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [employees, setEmployees] = useStoredState<Employee[]>(STORAGE_KEYS.EMPLOYEES, DEFAULT_EMPLOYEES);
  const [templates, setTemplates] = useStoredState<ShiftTemplate[]>(STORAGE_KEYS.SHIFT_TEMPLATES, DEFAULT_SHIFT_TEMPLATES);
  const [shifts, setShifts] = useStoredState<RosterShift[]>(STORAGE_KEYS.ROSTER, DEFAULT_ROSTER);
  const [leaves, setLeaves] = useStoredState<LeaveRecord[]>(STORAGE_KEYS.LEAVES, DEFAULT_LEAVES);
  const [holidays, setHolidays] = useStoredState<Holiday[]>(STORAGE_KEYS.HOLIDAYS, DEFAULT_HOLIDAYS);
  const [tasks, setTasks] = useStoredState<WorkflowTask[]>(STORAGE_KEYS.WORKFLOW_TASKS, DEFAULT_WORKFLOW_TASKS);
  const [checks, setChecks] = useStoredState<WorkflowCheck[]>(STORAGE_KEYS.WORKFLOW_CHECKS, []);
  const [sops, setSops] = useStoredState<SOP[]>(STORAGE_KEYS.SOPS, DEFAULT_SOPS);
  const [stockItems, setStockItems] = useStoredState<StockItem[]>(STORAGE_KEYS.STOCK_ITEMS, DEFAULT_STOCK_ITEMS);
  const [movements, setMovements] = useStoredState<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, DEFAULT_MOVEMENTS);
  const [currentUserId, setCurrentUserId] = useStoredState<string>(CURRENT_USER_KEY, '');

  const activeEmployees = employees.filter((e) => e.isActive);
  const currentUser = activeEmployees.find((e) => e.id === currentUserId);
  const pendingLeaveCount = leaves.filter((l) => l.status === 'pending').length;

  const navigate = (tab: NavTab, invTab?: InventoryTab) => {
    if (tab === 'inventory') setInventoryTab(invTab || 'stock');
    setCurrentTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const lockManager = () => {
    setIsManager(false);
    if (currentTab === 'settings') setCurrentTab('dashboard');
  };

  const clearRecords = () => {
    setEmployees([]);
    setShifts([]);
    setLeaves([]);
    setChecks([]);
    setMovements([]);
    setCurrentUserId('');
  };

  const resetDemo = () => {
    setEmployees(DEFAULT_EMPLOYEES);
    setTemplates(DEFAULT_SHIFT_TEMPLATES);
    setShifts(DEFAULT_ROSTER);
    setLeaves(DEFAULT_LEAVES);
    setHolidays(DEFAULT_HOLIDAYS);
    setTasks(DEFAULT_WORKFLOW_TASKS);
    setChecks([]);
    setSops(DEFAULT_SOPS);
    setStockItems(DEFAULT_STOCK_ITEMS);
    setMovements(DEFAULT_MOVEMENTS);
  };

  const navItems = NAV_ITEMS.filter((n) => !n.managerOnly || isManager);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <button onClick={() => navigate('dashboard')} className="flex items-center gap-3 cursor-pointer text-left">
            <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black tracking-tighter">TL</div>
            <div>
              <div className="text-lg sm:text-xl font-black tracking-tighter uppercase leading-tight">{settings.companyName}</div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">員工營運系統 · Staff Ops</p>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-500">
              我係
              <select
                value={currentUser ? currentUserId : ''}
                onChange={(e) => setCurrentUserId(e.target.value)}
                className="border border-slate-200 px-2 py-1.5 text-sm font-bold text-slate-900 bg-slate-50"
              >
                <option value="">（揀名）</option>
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            {isManager ? (
              <button onClick={lockManager} className="px-3 py-2 bg-amber-400 text-slate-900 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:bg-amber-300">
                <LogOut className="w-4 h-4" />
                主管模式中 · 鎖上
              </button>
            ) : (
              <button onClick={() => setPinPromptOpen(true)} className="px-3 py-2 border border-slate-200 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:border-slate-900">
                <Lock className="w-4 h-4" />
                主管模式
              </button>
            )}
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 cursor-pointer">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden px-4 pb-4 space-y-3 border-t border-slate-200 pt-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-500">
              我係
              <select
                value={currentUser ? currentUserId : ''}
                onChange={(e) => setCurrentUserId(e.target.value)}
                className="flex-1 border border-slate-200 px-2 py-2 text-sm font-bold text-slate-900 bg-slate-50"
              >
                <option value="">（揀名）</option>
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            {isManager ? (
              <button onClick={lockManager} className="w-full px-3 py-2.5 bg-amber-400 text-xs font-black cursor-pointer">
                主管模式中 · 鎖上
              </button>
            ) : (
              <button onClick={() => setPinPromptOpen(true)} className="w-full px-3 py-2.5 border border-slate-300 text-xs font-black cursor-pointer">
                🔒 主管模式
              </button>
            )}
          </div>
        )}

        <nav className="max-w-7xl mx-auto px-2 sm:px-6 flex gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`px-3.5 py-3 text-sm font-black whitespace-nowrap border-b-[3px] transition cursor-pointer ${
                currentTab === item.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-900'
              }`}
            >
              {item.label}
              {item.id === 'leave' && pendingLeaveCount > 0 && (
                <span className="ml-1.5 text-[10px] font-mono bg-amber-400 text-slate-900 px-1.5 py-0.5">{pendingLeaveCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-8 flex-1">
        {currentTab === 'dashboard' && (
          <Dashboard
            employees={employees}
            shifts={shifts}
            leaves={leaves}
            holidays={holidays}
            tasks={tasks}
            checks={checks}
            items={stockItems}
            movements={movements}
            onNavigate={navigate}
          />
        )}
        {currentTab === 'roster' && (
          <RosterPlanner
            employees={employees}
            shifts={shifts}
            templates={templates}
            leaves={leaves}
            holidays={holidays}
            isManager={isManager}
            onSaveShifts={setShifts}
            onSaveTemplates={setTemplates}
          />
        )}
        {currentTab === 'workflow' && (
          <DailyWorkflow
            tasks={tasks}
            checks={checks}
            sops={sops}
            employees={employees}
            shifts={shifts}
            isManager={isManager}
            currentUserId={currentUser ? currentUserId : ''}
            onSaveTasks={setTasks}
            onSaveChecks={setChecks}
          />
        )}
        {currentTab === 'inventory' && (
          <Inventory
            key={inventoryTab}
            initialTab={inventoryTab}
            items={stockItems}
            movements={movements}
            isManager={isManager}
            currentUserName={currentUser?.name || ''}
            onSaveItems={setStockItems}
            onSaveMovements={setMovements}
          />
        )}
        {currentTab === 'leave' && (
          <LeaveManager
            employees={employees}
            leaves={leaves}
            holidays={holidays}
            isManager={isManager}
            currentUserId={currentUser ? currentUserId : ''}
            onSaveLeaves={setLeaves}
            onSaveHolidays={setHolidays}
          />
        )}
        {currentTab === 'sop' && <SOPLibrary sops={sops} isManager={isManager} onSaveSops={setSops} />}
        {currentTab === 'staff' && (
          <StaffManager employees={employees} leaves={leaves} shifts={shifts} isManager={isManager} onSaveEmployees={setEmployees} />
        )}
        {currentTab === 'settings' && isManager && (
          <Settings settings={settings} onSaveSettings={setSettings} onClearRecords={clearRecords} onResetDemo={resetDemo} />
        )}
      </main>

      {pinPromptOpen && (
        <PinPrompt
          expectedPin={settings.managerPin}
          onClose={() => setPinPromptOpen(false)}
          onSuccess={() => {
            setIsManager(true);
            setPinPromptOpen(false);
            setMobileMenuOpen(false);
          }}
        />
      )}
    </div>
  );
}

const PinPrompt: React.FC<{ expectedPin: string; onClose: () => void; onSuccess: () => void }> = ({
  expectedPin,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  return (
    <Modal eyebrow="MANAGER MODE" title="輸入主管密碼" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pin === expectedPin) onSuccess();
          else {
            setError(true);
            setPin('');
          }
        }}
        className="space-y-4"
      >
        <p className="text-xs text-slate-500 font-medium">
          主管模式可以排更、批假、改 SOP、改流程同貨品清單。用完記得撳「鎖上」。
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          className={`${inputClass} font-mono text-center text-2xl tracking-[0.5em]`}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
        />
        {error && <p className="text-xs font-bold text-rose-700">密碼唔啱，請再試。</p>}
        <button type="submit" className={`${primaryButtonClass} w-full justify-center`}>
          確認
        </button>
      </form>
    </Modal>
  );
};
