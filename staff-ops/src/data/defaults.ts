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
  WorkflowTask,
} from '../types';
import { addDays, startOfWeek, todayISO } from '../utils/dates';

// Sample operational data. Roster, leave and stock samples are placed around
// the current week so a fresh install has something meaningful to show.

export const STAFF_POSITIONS = ['廚房主管', '生產', '包裝', '倉務及送貨', '行政'];

export const WORKFLOW_AREAS = ['開工準備', '生產', '包裝', '倉務', '出貨', '清潔', '行政'];

export const SOP_CATEGORIES = ['食物安全', '生產', '倉務', '出貨', '清潔', '行政'];

export const STOCK_CATEGORIES = [
  '即食雞胸',
  '即食雞胸肉丸',
  '熟食及小食',
  '蕃薯及蔬菜',
  '甜品',
  '便當',
  '肉類原料',
  '蔬菜原料',
  '醬料及調味',
  '包裝物料',
  '其他',
];

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: "TODAY'S FOOD LAB",
  managerPin: '1234',
};

// Tailwind needs literal class names, so every colour option is spelt out here.
export const STAFF_COLORS: Record<string, { chip: string; dot: string; label: string }> = {
  blue: { chip: 'bg-blue-50 text-blue-900 border-blue-200', dot: 'bg-blue-500', label: '藍' },
  emerald: { chip: 'bg-emerald-50 text-emerald-900 border-emerald-200', dot: 'bg-emerald-500', label: '綠' },
  amber: { chip: 'bg-amber-50 text-amber-900 border-amber-200', dot: 'bg-amber-500', label: '橙' },
  rose: { chip: 'bg-rose-50 text-rose-900 border-rose-200', dot: 'bg-rose-500', label: '紅' },
  violet: { chip: 'bg-violet-50 text-violet-900 border-violet-200', dot: 'bg-violet-500', label: '紫' },
  cyan: { chip: 'bg-cyan-50 text-cyan-900 border-cyan-200', dot: 'bg-cyan-500', label: '青' },
  slate: { chip: 'bg-slate-100 text-slate-900 border-slate-300', dot: 'bg-slate-500', label: '灰' },
};

export const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'e1', name: '陳大文', position: '廚房主管', employmentType: 'full_time', phone: '9123 4567',
    joinDate: '2021-03-01', restDays: [0], extraAnnualLeave: 2, color: 'blue', isActive: true,
  },
  {
    id: 'e2', name: '李美玲', position: '生產', employmentType: 'full_time', phone: '9234 5678',
    joinDate: '2024-08-15', restDays: [0], color: 'emerald', isActive: true,
  },
  {
    id: 'e3', name: '黃志強', position: '倉務及送貨', employmentType: 'full_time', phone: '9345 6789',
    joinDate: '2025-11-03', restDays: [0], color: 'amber', isActive: true,
  },
  {
    id: 'e4', name: '張嘉欣', position: '包裝', employmentType: 'part_time', phone: '6123 4567',
    joinDate: '2026-02-02', restDays: [], color: 'rose', isActive: true,
  },
  {
    id: 'e5', name: '何俊傑', position: '倉務及送貨', employmentType: 'part_time', phone: '6234 5678',
    joinDate: '2026-06-08', restDays: [], color: 'violet', isActive: true,
  },
];

export const DEFAULT_SHIFT_TEMPLATES: ShiftTemplate[] = [
  { id: 'st1', name: '早更', start: '07:00', end: '16:00', breakMinutes: 60 },
  { id: 'st2', name: '正常更', start: '09:00', end: '18:00', breakMinutes: 60 },
  { id: 'st3', name: '晏更', start: '12:00', end: '21:00', breakMinutes: 60 },
  { id: 'st4', name: '兼職早', start: '08:00', end: '13:00', breakMinutes: 0 },
  { id: 'st5', name: '兼職晏', start: '13:00', end: '18:00', breakMinutes: 0 },
];

// Statutory holidays under the Employment Ordinance (15 days in 2026 and 2027).
// A holiday that falls on a rest day is given on the next working day.
export const DEFAULT_HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: '一月一日' },
  { date: '2026-02-17', name: '農曆年初一' },
  { date: '2026-02-18', name: '農曆年初二' },
  { date: '2026-02-19', name: '農曆年初三' },
  { date: '2026-04-05', name: '清明節' },
  { date: '2026-04-06', name: '復活節星期一' },
  { date: '2026-05-01', name: '勞動節' },
  { date: '2026-05-24', name: '佛誕' },
  { date: '2026-06-19', name: '端午節' },
  { date: '2026-07-01', name: '香港特別行政區成立紀念日' },
  { date: '2026-09-26', name: '中秋節翌日' },
  { date: '2026-10-01', name: '國慶日' },
  { date: '2026-10-18', name: '重陽節' },
  { date: '2026-12-25', name: '聖誕節（或 12月22日冬至，由僱主選擇）' },
  { date: '2026-12-26', name: '聖誕節後第一個周日' },
  { date: '2027-01-01', name: '一月一日' },
  { date: '2027-02-06', name: '農曆年初一' },
  { date: '2027-02-08', name: '農曆年初三' },
  { date: '2027-02-09', name: '農曆年初四' },
  { date: '2027-03-29', name: '復活節星期一' },
  { date: '2027-04-05', name: '清明節' },
  { date: '2027-05-01', name: '勞動節' },
  { date: '2027-05-13', name: '佛誕' },
  { date: '2027-06-09', name: '端午節' },
  { date: '2027-07-01', name: '香港特別行政區成立紀念日' },
  { date: '2027-09-16', name: '中秋節翌日' },
  { date: '2027-10-01', name: '國慶日' },
  { date: '2027-10-08', name: '重陽節' },
  { date: '2027-12-25', name: '聖誕節（或 12月22日冬至，由僱主選擇）' },
  { date: '2027-12-27', name: '聖誕節後第一個周日' },
];

const THIS_WEEK = startOfWeek(todayISO());

const buildSampleRoster = (): RosterShift[] => {
  const shifts: RosterShift[] = [];
  const add = (employeeId: string, date: string, t: ShiftTemplate) =>
    shifts.push({
      id: `rs_${employeeId}_${date}`,
      employeeId,
      date,
      start: t.start,
      end: t.end,
      breakMinutes: t.breakMinutes,
      label: t.name,
    });
  const [early, normal, , ptAm, ptPm] = DEFAULT_SHIFT_TEMPLATES;

  // Three weeks back (for the part-time 4-week hour check) through next week.
  for (let w = -3; w <= 1; w++) {
    const monday = addDays(THIS_WEEK, w * 7);
    for (let i = 0; i < 6; i++) {
      const date = addDays(monday, i);
      add('e1', date, early);
      add('e2', date, normal);
      add('e3', date, normal);
    }
    [0, 2, 4].forEach((i) => add('e4', addDays(monday, i), ptAm));
    if (w % 2 === 0) add('e4', addDays(monday, 5), ptAm);
    [1, 3, 5].forEach((i) => add('e5', addDays(monday, i), ptPm));
  }
  return shifts;
};

export const DEFAULT_ROSTER: RosterShift[] = buildSampleRoster();

export const DEFAULT_LEAVES: LeaveRecord[] = [
  {
    id: 'lv1', employeeId: 'e2', type: 'annual', startDate: addDays(THIS_WEEK, 10), endDate: addDays(THIS_WEEK, 11),
    days: 2, status: 'approved', reason: '旅行', createdAt: new Date().toISOString(),
  },
  {
    id: 'lv2', employeeId: 'e1', type: 'sick', startDate: addDays(THIS_WEEK, -12), endDate: addDays(THIS_WEEK, -12),
    days: 1, status: 'approved', reason: '發燒，已交醫生紙', createdAt: new Date().toISOString(),
  },
  {
    id: 'lv3', employeeId: 'e3', type: 'annual', startDate: addDays(THIS_WEEK, 17), endDate: addDays(THIS_WEEK, 17),
    days: 1, status: 'pending', reason: '私人事務', createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_SOPS: SOP[] = [
  {
    id: 'sop1', code: 'SOP-001', title: '個人衛生及開工前準備', category: '食物安全', version: '1.0',
    owner: '廚房主管', updatedAt: '2026-10-01',
    purpose: '確保所有員工進入生產區前符合衛生要求，防止食物受污染。',
    steps: [
      { id: 's1', text: '換上乾淨工作服，戴好帽同口罩，頭髮要完全包住。' },
      { id: 's2', text: '除下手錶、戒指等飾物；指甲剪短，唔可以塗指甲油。' },
      { id: 's3', text: '用梘液洗手最少 20 秒，抹乾先入生產區。', caution: '有肚瀉、發燒或手部傷口未包好，要通知主管，唔可以處理食物。' },
      { id: 's4', text: '檢查雪櫃（0–4°C）同冰格（-18°C 或以下）溫度並記錄。', caution: '溫度超出範圍即刻通知主管。' },
      { id: 's5', text: '用消毒劑清潔工作枱、砧板同刀具。' },
    ],
  },
  {
    id: 'sop2', code: 'SOP-002', title: '即食雞胸生產流程', category: '生產', version: '1.0',
    owner: '廚房主管', updatedAt: '2026-10-01',
    purpose: '統一即食雞胸由解凍到入倉嘅做法，確保品質一致及食物安全。',
    steps: [
      { id: 's1', text: '由冰格取出所需份量雞胸，放雪櫃（0–4°C）解凍。', caution: '唔可以放室溫解凍。' },
      { id: 's2', text: '修走筋膜同脂肪，按規格分切及秤重。' },
      { id: 's3', text: '按配方落醃料，標示口味同醃製時間，放返雪櫃。' },
      { id: 's4', text: '煮至中心溫度 75°C 或以上，用探針溫度計檢查並記錄。', caution: '每批都要測溫，未達標唔可以出爐。' },
      { id: 's5', text: '迅速冷卻（冰水浴或急凍），盡快降至 4°C 以下。' },
      { id: 's6', text: '真空包裝，檢查封口冇漏氣。' },
      { id: 's7', text: '貼標籤：品名、口味、生產日期、此日期前食用、批次。' },
      { id: 's8', text: '放入雪櫃或冰格，並喺系統「倉存 → 入貨」記錄生產數量。' },
    ],
  },
  {
    id: 'sop3', code: 'SOP-003', title: '收貨檢查程序', category: '倉務', version: '1.0',
    owner: '倉務及送貨', updatedAt: '2026-10-01',
    purpose: '確保供應商送嚟嘅原料數量、溫度同品質符合要求。',
    steps: [
      { id: 's1', text: '核對送貨單同訂單：品名、數量、規格。' },
      { id: 's2', text: '檢查溫度（冷凍 -18°C 或以下、冷藏 0–4°C）同包裝完整。', caution: '溫度唔合格或包裝破損要拒收，並影相記錄。' },
      { id: 's3', text: '檢查屆滿日期，避免收到過短期貨。' },
      { id: 's4', text: '按「先入先出」上架，新貨放後面。' },
      { id: 's5', text: '喺系統「倉存 → 入貨」輸入數量、批次同到期日。' },
      { id: 's6', text: '送貨單交行政存檔。' },
    ],
  },
  {
    id: 'sop4', code: 'SOP-004', title: '執貨、落貨及送貨程序', category: '出貨', version: '1.0',
    owner: '倉務及送貨', updatedAt: '2026-10-01',
    purpose: '確保客戶收到正確數量嘅貨品，運送期間保持冷藏。',
    steps: [
      { id: 's1', text: '按當日發票或訂單執貨，核對品名同數量。' },
      { id: 's2', text: '用保溫箱加冰袋裝貨，冷藏貨品保持 4°C 以下。' },
      { id: 's3', text: '由第二位同事覆核數量，喺送貨單簽名。' },
      { id: 's4', text: '喺系統「倉存 → 落貨」揀返對應發票出貨，扣減存貨。' },
      { id: 's5', text: '送到後請客戶簽收，並影相留底。' },
      { id: 's6', text: '返公司後交返簽收單同收款（如有）。' },
    ],
  },
  {
    id: 'sop5', code: 'SOP-005', title: '收工清潔程序', category: '清潔', version: '1.0',
    owner: '廚房主管', updatedAt: '2026-10-01',
    purpose: '保持生產環境清潔，預防蟲鼠及交叉污染。',
    steps: [
      { id: 's1', text: '清理所有食物殘渣；剩餘原料蓋好、標示日期後放返雪櫃。' },
      { id: 's2', text: '用清潔劑洗淨工作枱、砧板、刀具同器具，再用消毒劑消毒。' },
      { id: 's3', text: '清潔地面同去水位，倒垃圾並換垃圾袋。' },
      { id: 's4', text: '再記錄一次雪櫃同冰格溫度。' },
      { id: 's5', text: '熄爐具、電器同水喉，最後離開嘅同事鎖門。' },
    ],
  },
  {
    id: 'sop6', code: 'SOP-006', title: '盤點程序', category: '倉務', version: '1.0',
    owner: '倉務及送貨', updatedAt: '2026-10-01',
    purpose: '定期核對實物同系統存貨，及早發現損耗或記錄錯誤。',
    steps: [
      { id: 's1', text: '盤點期間暫停入貨同落貨，或記低盤點開始時間。' },
      { id: 's2', text: '兩人一組：一人點數，一人記錄。' },
      { id: 's3', text: '喺系統「倉存 → 盤點」逐項輸入實際數量。' },
      { id: 's4', text: '差異超過 5% 要重新點算，並由主管確認原因。', caution: '唔好為咗對數而直接改數，要搵出原因。' },
      { id: 's5', text: '過期或損壞貨品用「損耗」記錄，並按程序棄置。' },
    ],
  },
  {
    id: 'sop7', code: 'SOP-007', title: '請假及排更程序', category: '行政', version: '1.0',
    owner: '行政', updatedAt: '2026-10-01',
    purpose: '令請假同排更有清晰程序，確保每日有足夠人手。',
    steps: [
      { id: 's1', text: '年假最少提前 7 日申請（緊急情況除外）。' },
      { id: 's2', text: '病假要喺當日開工前通知主管，並提交醫生證明。' },
      { id: 's3', text: '主管喺系統「假期」輸入並批核申請。' },
      { id: 's4', text: '每個星期五前排好下星期更表，並通知員工。' },
      { id: 's5', text: '留意兼職同事每 4 星期工時：合共 68 小時或以上即屬連續性合約（「468」規則）。' },
    ],
  },
];

const MON_SAT = [1, 2, 3, 4, 5, 6];

export const DEFAULT_WORKFLOW_TASKS: WorkflowTask[] = [
  { id: 'wf1', time: '07:00', title: '開門，檢查雪櫃及冰格溫度並記錄', area: '開工準備', ownerRole: '廚房主管', weekdays: MON_SAT, sopId: 'sop1' },
  { id: 'wf2', time: '07:15', title: '個人衛生檢查，清潔消毒工作枱', area: '開工準備', ownerRole: '全體', weekdays: MON_SAT, sopId: 'sop1' },
  { id: 'wf3', time: '07:30', title: '睇今日訂單／發票，安排生產同落貨數量', area: '行政', ownerRole: '廚房主管', weekdays: MON_SAT },
  { id: 'wf4', time: '08:00', title: '雞胸解凍檢查、修筋分切', area: '生產', ownerRole: '生產', weekdays: MON_SAT, sopId: 'sop2' },
  { id: 'wf5', time: '09:30', title: '醃製及煮製（每批測中心溫度）', area: '生產', ownerRole: '生產', weekdays: MON_SAT, sopId: 'sop2' },
  { id: 'wf6', time: '11:00', title: '冷卻、真空包裝及貼標籤', area: '包裝', ownerRole: '包裝', weekdays: MON_SAT, sopId: 'sop2' },
  { id: 'wf7', time: '12:00', title: '生產入倉，系統記錄入貨', area: '倉務', ownerRole: '倉務及送貨', weekdays: MON_SAT, sopId: 'sop2' },
  { id: 'wf8', time: '13:00', title: '供應商收貨檢查', area: '倉務', ownerRole: '倉務及送貨', weekdays: [2, 4], sopId: 'sop3' },
  { id: 'wf9', time: '14:00', title: '執貨、覆核及落貨', area: '出貨', ownerRole: '倉務及送貨', weekdays: MON_SAT, sopId: 'sop4' },
  { id: 'wf10', time: '15:00', title: '送貨及客戶簽收', area: '出貨', ownerRole: '倉務及送貨', weekdays: MON_SAT, sopId: 'sop4' },
  { id: 'wf11', time: '16:00', title: '檢查低存量，跟進落單補貨', area: '倉務', ownerRole: '廚房主管', weekdays: [1, 3, 5] },
  { id: 'wf12', time: '16:00', title: '排好下星期更表', area: '行政', ownerRole: '行政', weekdays: [5], sopId: 'sop7' },
  { id: 'wf13', time: '16:00', title: '每週盤點重點貨品', area: '倉務', ownerRole: '倉務及送貨', weekdays: [6], sopId: 'sop6' },
  { id: 'wf14', time: '16:30', title: '收工清潔及消毒', area: '清潔', ownerRole: '全體', weekdays: MON_SAT, sopId: 'sop5' },
  { id: 'wf15', time: '17:00', title: '記錄收工溫度、熄電熄水、鎖門', area: '清潔', ownerRole: '廚房主管', weekdays: MON_SAT, sopId: 'sop5' },
];

// Finished goods mirror the invoice catalogue by name and unit only (no prices).
export const DEFAULT_STOCK_ITEMS: StockItem[] = [
  { id: 'p1', kind: 'product', name: '招牌原味,即食雞胸', category: '即食雞胸', unit: '包', reorderLevel: 80 },
  { id: 'p2', kind: 'product', name: '蒜味香草,即食雞胸', category: '即食雞胸', unit: '包' },
  { id: 'p3', kind: 'product', name: '秘製黑椒,即食雞胸', category: '即食雞胸', unit: '包', reorderLevel: 80 },
  { id: 'p4', kind: 'product', name: '日式照燒,即食雞胸', category: '即食雞胸', unit: '包', reorderLevel: 60 },
  { id: 'p5', kind: 'product', name: '泰式香辣,即食雞胸', category: '即食雞胸', unit: '包' },
  { id: 'p6', kind: 'product', name: '四川麻辣,即食雞胸', category: '即食雞胸', unit: '包' },
  { id: 'p7', kind: 'product', name: '田園香草、即食雞胸', category: '即食雞胸', unit: '包' },
  { id: 'p8', kind: 'product', name: '風味沙薑,即食雞胸', category: '即食雞胸', unit: '包', reorderLevel: 30 },
  { id: 'p9', kind: 'product', name: '惹味孜然,即食雞胸', category: '即食雞胸', unit: '包' },
  { id: 'p10', kind: 'product', name: '越式香茅、即食雞胸', category: '即食雞胸', unit: '包' },
  { id: 'p12', kind: 'product', name: '即食雞胸肉丸 原味', category: '即食雞胸肉丸', unit: '包', reorderLevel: 20 },
  { id: 'p13', kind: 'product', name: '即食雞胸肉丸 四川麻辣', category: '即食雞胸肉丸', unit: '包' },
  { id: 'p14', kind: 'product', name: '即食雞胸肉丸 黑松露', category: '即食雞胸肉丸', unit: '包' },
  { id: 'p15', kind: 'product', name: '牛腱', category: '熟食及小食', unit: '包' },
  { id: 'p16', kind: 'product', name: '醉翼', category: '熟食及小食', unit: '包' },
  { id: 'p19', kind: 'product', name: '醉雞腎 150g', category: '熟食及小食', unit: '包' },
  { id: 'p21', kind: 'product', name: '麻辣雞腎 150g', category: '熟食及小食', unit: '包' },
  { id: 'p26', kind: 'product', name: '烤日本蕃薯、紅春香', category: '蕃薯及蔬菜', unit: '件' },
  { id: 'p28', kind: 'product', name: '紅天使蕃薯(280g)', category: '蕃薯及蔬菜', unit: '包' },
  { id: 'p30', kind: 'product', name: '焗南瓜片', category: '蕃薯及蔬菜', unit: '包', reorderLevel: 30 },
  { id: 'p33', kind: 'product', name: '紅天使蕃薯蓉慕斯', category: '甜品', unit: '杯' },
  { id: 'p44', kind: 'product', name: '有營Lunch Box', category: '便當', unit: '個' },
  { id: 'm1', kind: 'material', name: '急凍雞胸肉', category: '肉類原料', unit: 'kg', reorderLevel: 50, supplier: '凍肉供應商' },
  { id: 'm2', kind: 'material', name: '紅春香番薯', category: '蔬菜原料', unit: 'kg', reorderLevel: 20, supplier: '蔬果供應商' },
  { id: 'm3', kind: 'material', name: '南瓜', category: '蔬菜原料', unit: 'kg', reorderLevel: 10, supplier: '蔬果供應商' },
  { id: 'm4', kind: 'material', name: '醃料（混合香料）', category: '醬料及調味', unit: 'kg', reorderLevel: 5 },
  { id: 'm5', kind: 'material', name: '真空包裝袋', category: '包裝物料', unit: '個', reorderLevel: 500 },
  { id: 'm6', kind: 'material', name: '產品標籤', category: '包裝物料', unit: '張', reorderLevel: 500 },
  { id: 'm7', kind: 'material', name: '冰袋', category: '包裝物料', unit: '個', reorderLevel: 30 },
];

const sampleMovement = (
  id: string,
  dayOffset: number,
  type: StockMovement['type'],
  itemId: string,
  qty: number,
  extra: Partial<StockMovement> = {}
): StockMovement => {
  const item = DEFAULT_STOCK_ITEMS.find((i) => i.id === itemId)!;
  return {
    id,
    date: addDays(THIS_WEEK, dayOffset),
    type,
    itemId,
    itemName: item.name,
    unit: item.unit,
    qty,
    createdAt: new Date().toISOString(),
    ...extra,
  };
};

export const DEFAULT_MOVEMENTS: StockMovement[] = [
  sampleMovement('mv1', -7, 'in', 'm1', 120, { partner: '凍肉供應商', batchNo: 'CB-0901', expiryDate: addDays(THIS_WEEK, 80) }),
  sampleMovement('mv2', -7, 'in', 'm5', 2000, { partner: '包裝供應商' }),
  sampleMovement('mv3', -7, 'in', 'm6', 2000, { partner: '印刷公司' }),
  sampleMovement('mv4', -7, 'in', 'm7', 60),
  sampleMovement('mv19', -7, 'in', 'm3', 25, { partner: '蔬果供應商' }),
  sampleMovement('mv20', -7, 'in', 'm4', 12, { partner: '香料供應商' }),
  sampleMovement('mv5', -6, 'in', 'm2', 15, { partner: '蔬果供應商', expiryDate: addDays(THIS_WEEK, 8) }),
  sampleMovement('mv6', -6, 'in', 'p1', 300, { partner: '自家生產', batchNo: 'B-P1-01', expiryDate: addDays(THIS_WEEK, 60) }),
  sampleMovement('mv7', -6, 'in', 'p3', 200, { partner: '自家生產', batchNo: 'B-P3-01', expiryDate: addDays(THIS_WEEK, 60) }),
  sampleMovement('mv8', -6, 'in', 'p4', 150, { partner: '自家生產', batchNo: 'B-P4-01', expiryDate: addDays(THIS_WEEK, 60) }),
  sampleMovement('mv9', -6, 'in', 'p8', 80, { partner: '自家生產' }),
  sampleMovement('mv10', -6, 'in', 'p12', 60, { partner: '自家生產' }),
  sampleMovement('mv11', -6, 'in', 'p30', 100, { partner: '自家生產' }),
  sampleMovement('mv12', -6, 'out', 'm1', -85, { note: '生產用料' }),
  sampleMovement('mv13', -6, 'out', 'm5', -790, { note: '生產用料' }),
  sampleMovement('mv14', -6, 'out', 'm6', -790, { note: '生產用料' }),
  sampleMovement('mv15', -4, 'out', 'p1', -180, { partner: '金二少冰室', refNo: 'DO-0528' }),
  sampleMovement('mv16', -4, 'out', 'p8', -65, { partner: '台沐' }),
  sampleMovement('mv17', -3, 'waste', 'p30', -4, { note: '包裝漏氣' }),
  sampleMovement('mv18', -1, 'count', 'p3', -2, { countedQty: 198, note: '每週盤點' }),
];
