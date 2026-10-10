// ===== Staff, roster & leave =====
// No pay data lives in this system: every staff member can open it.

export type EmploymentType = 'full_time' | 'part_time';

export interface Employee {
  id: string;
  name: string;
  position: string;
  employmentType: EmploymentType;
  phone?: string;
  joinDate: string; // YYYY-MM-DD
  restDays: number[]; // weekly rest days, 0 = Sunday ... 6 = Saturday
  extraAnnualLeave?: number; // company days on top of the statutory entitlement
  color: string; // key of STAFF_COLORS
  isActive: boolean;
  notes?: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  start: string; // HH:mm
  end: string; // HH:mm
  breakMinutes: number;
}

export interface RosterShift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  breakMinutes: number;
  label?: string;
  note?: string;
}

export type LeaveType =
  | 'annual'
  | 'sick'
  | 'statutory'
  | 'compensation'
  | 'no_pay'
  | 'maternity'
  | 'paternity'
  | 'other';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRecord {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason?: string;
  createdAt: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

// ===== Daily workflow & SOP =====

export interface WorkflowTask {
  id: string;
  time: string; // HH:mm
  title: string;
  area: string;
  ownerRole?: string;
  weekdays: number[]; // days the task runs, 0 = Sunday
  sopId?: string;
  notes?: string;
}

export interface WorkflowCheck {
  id: string; // `${date}_${taskId}`
  date: string;
  taskId: string;
  doneBy?: string; // employee id
  doneAt: string; // ISO timestamp
}

export interface SOPStep {
  id: string;
  text: string;
  caution?: string;
}

export interface SOP {
  id: string;
  code: string;
  title: string;
  category: string;
  version: string;
  purpose: string;
  owner?: string;
  steps: SOPStep[];
  updatedAt: string;
}

// ===== Inventory =====
// Stock items carry names and units only — selling prices stay in the invoice system.

export type StockItemKind = 'product' | 'material';

export interface StockItem {
  id: string;
  kind: StockItemKind; // 成品 or 原材料／物料
  name: string;
  category: string;
  unit: string;
  reorderLevel?: number;
  supplier?: string;
  isArchived?: boolean;
}

export type StockMovementType = 'in' | 'out' | 'waste' | 'count';

export interface StockMovement {
  id: string;
  date: string; // YYYY-MM-DD
  type: StockMovementType;
  itemId: string;
  itemName: string;
  unit: string;
  qty: number; // signed change to stock; for 'count' it is counted minus system quantity
  countedQty?: number;
  partner?: string; // supplier or customer
  refNo?: string; // delivery note / order number
  batchNo?: string;
  expiryDate?: string;
  operator?: string;
  note?: string;
  createdAt: string;
}

export interface AppSettings {
  companyName: string;
  managerPin: string;
}
