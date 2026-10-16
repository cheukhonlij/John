import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, LogOut, Menu, Receipt, X } from 'lucide-react';
import {
  DEFAULT_EMPLOYEES,
  DEFAULT_HOLIDAYS,
  DEFAULT_LEAVES,
  DEFAULT_MOVEMENTS,
  DEFAULT_ROSTER,
  DEFAULT_SHIFT_TEMPLATES,
  DEFAULT_SOPS,
  DEFAULT_STOCK_ITEMS,
  DEFAULT_WORKFLOW_TASKS,
} from './data/defaults';
import { AppData, useCloudAppData, useLocalAppData } from './data/store';
import { useStoredState } from './hooks/useStoredState';
import { cloudEnabled } from './lib/firebase';
import { UserProfile, getOwnerUid, signOutUser, useAuthSession } from './lib/cloud';
import { Dashboard, NavTab } from './components/Dashboard';
import { RosterPlanner } from './components/RosterPlanner';
import { DailyWorkflow } from './components/DailyWorkflow';
import { Inventory, InventoryTab } from './components/Inventory';
import { LeaveManager } from './components/LeaveManager';
import { SOPLibrary } from './components/SOPLibrary';
import { StaffManager } from './components/StaffManager';
import { CloudSettings, LocalSettings } from './components/Settings';
import { ChangePasswordModal, LoadingScreen, LoginScreen, NoAccessScreen } from './components/CloudAuth';
import { Modal, inputClass, primaryButtonClass } from './components/ui';

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
  return cloudEnabled ? <CloudApp /> : <LocalApp />;
}

// ---------- Firebase mode: real accounts, roles enforced by security rules ----------

const CloudApp: React.FC = () => {
  const { user, profile } = useAuthSession();
  if (user === undefined || (user && profile === undefined)) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (!profile || profile.role === 'disabled') return <NoAccessScreen disabled={profile?.role === 'disabled'} />;
  return <CloudSession profile={profile} />;
};

const CloudSession: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const data = useCloudAppData();
  const [changingPassword, setChangingPassword] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const isManager = profile.role === 'manager';
  const me = data.employees.find((e) => e.id === profile.employeeId);

  // 開單台 is for the owner only (the account that did first-time setup).
  useEffect(() => {
    let alive = true;
    if (!isManager) {
      setIsOwner(false);
      return;
    }
    getOwnerUid()
      .then((uid) => {
        if (alive) setIsOwner(uid === profile.uid);
      })
      .catch(() => {
        if (alive) setIsOwner(false);
      });
    return () => {
      alive = false;
    };
  }, [isManager, profile.uid]);

  const controls = (compact: boolean) => (
    <>
      <span className={`text-xs font-black text-slate-500 ${compact ? 'block' : ''}`}>
        {me?.name || profile.username}
        <span className={`ml-2 px-1.5 py-0.5 text-[10px] ${isManager ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-600'}`}>
          {isManager ? '主管' : '員工'}
        </span>
      </span>
      <button onClick={() => setChangingPassword(true)} className="px-3 py-2 border border-slate-200 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:border-slate-900">
        <KeyRound className="w-4 h-4" />
        改密碼
      </button>
      <button onClick={() => signOutUser()} className="px-3 py-2 border border-slate-200 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:border-slate-900">
        <LogOut className="w-4 h-4" />
        登出
      </button>
    </>
  );

  return (
    <>
      <Shell
        data={data}
        isManager={isManager}
        isOwner={isOwner}
        currentUserId={profile.employeeId}
        headerControls={controls(false)}
        mobileControls={<div className="flex flex-wrap items-center gap-2">{controls(true)}</div>}
        settingsPage={
          <CloudSettings
            settings={data.settings}
            employees={data.employees}
            currentUid={profile.uid}
            onSaveSettings={data.saveSettings}
          />
        }
      />
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </>
  );
};

// ---------- Browser-only mode: one shared device, PIN-gated manager mode ----------

// Which staff member is using this device; a per-device convenience, not a login.
const CURRENT_USER_KEY = 'todays_ops_current_user_v1';

const LocalApp: React.FC = () => {
  const data = useLocalAppData();
  // Manager mode lasts until locked or the page reloads.
  const [isManager, setIsManager] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useStoredState<string>(CURRENT_USER_KEY, '');

  const activeEmployees = data.employees.filter((e) => e.isActive);
  const currentUser = activeEmployees.find((e) => e.id === currentUserId);

  const clearRecords = () => {
    data.saveEmployees([]);
    data.saveShifts([]);
    data.saveLeaves([]);
    data.saveChecks([]);
    data.saveMovements([]);
    setCurrentUserId('');
  };

  const resetDemo = () => {
    data.saveEmployees(DEFAULT_EMPLOYEES);
    data.saveTemplates(DEFAULT_SHIFT_TEMPLATES);
    data.saveShifts(DEFAULT_ROSTER);
    data.saveLeaves(DEFAULT_LEAVES);
    data.saveHolidays(DEFAULT_HOLIDAYS);
    data.saveTasks(DEFAULT_WORKFLOW_TASKS);
    data.saveChecks([]);
    data.saveSops(DEFAULT_SOPS);
    data.saveStockItems(DEFAULT_STOCK_ITEMS);
    data.saveMovements(DEFAULT_MOVEMENTS);
  };

  const userPicker = (className: string) => (
    <label className="flex items-center gap-2 text-xs font-black text-slate-500">
      我係
      <select value={currentUser ? currentUserId : ''} onChange={(e) => setCurrentUserId(e.target.value)} className={className}>
        <option value="">（揀名）</option>
        {activeEmployees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  );

  const managerButton = (full: boolean) =>
    isManager ? (
      <button
        onClick={() => setIsManager(false)}
        className={`px-3 py-2 bg-amber-400 text-slate-900 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-300 ${full ? 'w-full' : ''}`}
      >
        <LogOut className="w-4 h-4" />
        主管模式中 · 鎖上
      </button>
    ) : (
      <button
        onClick={() => setPinPromptOpen(true)}
        className={`px-3 py-2 border border-slate-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:border-slate-900 ${full ? 'w-full' : ''}`}
      >
        <Lock className="w-4 h-4" />
        主管模式
      </button>
    );

  return (
    <>
      <Shell
        data={data}
        isManager={isManager}
        currentUserId={currentUser ? currentUserId : ''}
        headerControls={
          <>
            {userPicker('border border-slate-200 px-2 py-1.5 text-sm font-bold text-slate-900 bg-slate-50')}
            {managerButton(false)}
          </>
        }
        mobileControls={
          <div className="space-y-3">
            {userPicker('flex-1 border border-slate-200 px-2 py-2 text-sm font-bold text-slate-900 bg-slate-50')}
            {managerButton(true)}
          </div>
        }
        settingsPage={
          <LocalSettings settings={data.settings} onSaveSettings={data.saveSettings} onClearRecords={clearRecords} onResetDemo={resetDemo} />
        }
      />
      {pinPromptOpen && (
        <PinPrompt
          expectedPin={data.settings.managerPin}
          onClose={() => setPinPromptOpen(false)}
          onSuccess={() => {
            setIsManager(true);
            setPinPromptOpen(false);
          }}
        />
      )}
    </>
  );
};

// ---------- Shared shell: header, navigation and pages ----------

const Shell: React.FC<{
  data: AppData;
  isManager: boolean;
  isOwner?: boolean;
  currentUserId: string;
  headerControls: React.ReactNode;
  mobileControls: React.ReactNode;
  settingsPage: React.ReactNode;
}> = ({ data, isManager, isOwner = false, currentUserId, headerControls, mobileControls, settingsPage }) => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>('stock');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentUser = data.employees.find((e) => e.id === currentUserId);
  const pendingLeaveCount = data.leaves.filter((l) => l.status === 'pending').length;
  const navItems = NAV_ITEMS.filter((n) => !n.managerOnly || isManager);
  const tab = currentTab === 'settings' && !isManager ? 'dashboard' : currentTab;

  const navigate = (next: NavTab, invTab?: InventoryTab) => {
    if (next === 'inventory') setInventoryTab(invTab || 'stock');
    setCurrentTab(next);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <button onClick={() => navigate('dashboard')} className="flex items-center gap-3 cursor-pointer text-left">
            <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black tracking-tighter">TL</div>
            <div>
              <div className="text-lg sm:text-xl font-black tracking-tighter uppercase leading-tight">{data.settings.companyName}</div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">員工營運系統 · Staff Ops</p>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-3">{headerControls}</div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 cursor-pointer">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && <div className="md:hidden px-4 pb-4 border-t border-slate-200 pt-3">{mobileControls}</div>}

        <nav className="max-w-7xl mx-auto px-2 sm:px-6 flex gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`px-3.5 py-3 text-sm font-black whitespace-nowrap border-b-[3px] transition cursor-pointer ${
                tab === item.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-900'
              }`}
            >
              {item.label}
              {item.id === 'leave' && pendingLeaveCount > 0 && (
                <span className="ml-1.5 text-[10px] font-mono bg-amber-400 text-slate-900 px-1.5 py-0.5">{pendingLeaveCount}</span>
              )}
            </button>
          ))}
          {isOwner && (
            <a
              href="/invoice"
              title="只有你睇到呢個分頁"
              className="ml-auto px-3.5 py-3 text-sm font-black whitespace-nowrap border-b-[3px] border-transparent text-slate-400 hover:text-slate-900 flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4" />
              開單台
              <Lock className="w-3 h-3" />
            </a>
          )}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-8 flex-1">
        {!data.ready ? (
          <div className="py-24 flex justify-center text-slate-500 font-black text-sm">載入中…</div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <Dashboard
                employees={data.employees}
                shifts={data.shifts}
                leaves={data.leaves}
                holidays={data.holidays}
                tasks={data.tasks}
                checks={data.checks}
                items={data.stockItems}
                levels={data.levels}
                onNavigate={navigate}
              />
            )}
            {tab === 'roster' && (
              <RosterPlanner
                employees={data.employees}
                shifts={data.shifts}
                templates={data.templates}
                leaves={data.leaves}
                holidays={data.holidays}
                isManager={isManager}
                onSaveShifts={data.saveShifts}
                onSaveTemplates={data.saveTemplates}
                onNeedHistory={data.history?.ensureShiftsFrom}
              />
            )}
            {tab === 'workflow' && (
              <DailyWorkflow
                tasks={data.tasks}
                checks={data.checks}
                sops={data.sops}
                employees={data.employees}
                shifts={data.shifts}
                isManager={isManager}
                currentUserId={currentUserId}
                onSaveTasks={data.saveTasks}
                onSaveChecks={data.saveChecks}
                onNeedHistory={data.history?.ensureChecksFrom}
              />
            )}
            {tab === 'inventory' && (
              <Inventory
                key={inventoryTab}
                initialTab={inventoryTab}
                items={data.stockItems}
                movements={data.movements}
                levels={data.levels}
                history={data.history}
                isManager={isManager}
                currentUserName={currentUser?.name || ''}
                onSaveItems={data.saveStockItems}
                onSaveMovements={data.saveMovements}
              />
            )}
            {tab === 'leave' && (
              <LeaveManager
                employees={data.employees}
                leaves={data.leaves}
                holidays={data.holidays}
                isManager={isManager}
                currentUserId={currentUserId}
                onSaveLeaves={data.saveLeaves}
                onSaveHolidays={data.saveHolidays}
              />
            )}
            {tab === 'sop' && <SOPLibrary sops={data.sops} isManager={isManager} onSaveSops={data.saveSops} />}
            {tab === 'staff' && (
              <StaffManager
                employees={data.employees}
                leaves={data.leaves}
                shifts={data.shifts}
                isManager={isManager}
                onSaveEmployees={data.saveEmployees}
              />
            )}
            {tab === 'settings' && isManager && settingsPage}
          </>
        )}
      </main>
    </div>
  );
};

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
