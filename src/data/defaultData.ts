import { Customer, Product, Invoice, CompanyProfile } from '../types';

export const DEFAULT_COMPANY: CompanyProfile = {
  name: "TODAY'S FOOD LAB",
  subTitle: "F O O D   L A B",
  addressLine1: "Unit 1503, 15/F, Wing Fung Industrial Building,",
  addressLine2: "40-50 Sha Tsui Road, Tsuen Wan, New Territories.",
  addressLine3: "新界荃灣沙咀道40-50號,榮豐工業大廈,15樓3室",
  tel: "2555 1368",
  email: "todaysfoodlab@gmail.com",
  bankName: "HSBC",
  accountName: "Today's Limited",
  accountNumber: "023-621196-838",
  defaultPaymentTerms: `P.s A 50% deposit is required for order confirmation.
Please make payment to HSBC acc: Today's Limited 023-621196-838
THANK YOU FOR YOUR BUSINESS!`,
  currency: "HK$",
  showStampBox: true,
};

export const PRODUCT_CATEGORIES = [
  "即食雞胸",
  "即食雞胸肉丸",
  "熟食及小食",
  "蕃薯及蔬菜",
  "甜品",
  "套裝及優惠",
  "便當",
  "服務及其他"
];

export const DEFAULT_PRODUCTS: Product[] = [
  // 即食雞胸系列
  { id: "p1", name: "招牌原味,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p2", name: "蒜味香草,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p3", name: "秘製黑椒,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p4", name: "日式照燒,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p5", name: "泰式香辣,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p6", name: "四川麻辣,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p7", name: "田園香草、即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p8", name: "風味沙薑,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p9", name: "惹味孜然,即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p10", name: "越式香茅、即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },
  { id: "p11", name: "MsRabbit.即食雞胸", category: "即食雞胸", defaultRate: 13.00, unit: "包" },

  // 即食雞胸肉丸系列
  { id: "p12", name: "即食雞胸肉丸 原味", category: "即食雞胸肉丸", defaultRate: 28.00, unit: "包" },
  { id: "p13", name: "即食雞胸肉丸 四川麻辣", category: "即食雞胸肉丸", defaultRate: 28.00, unit: "包" },
  { id: "p14", name: "即食雞胸肉丸 黑松露", category: "即食雞胸肉丸", defaultRate: 28.00, unit: "包" },

  // 熟食及小食系列
  { id: "p15", name: "牛腱", category: "熟食及小食", defaultRate: 32.00, unit: "包" },
  { id: "p16", name: "醉翼", category: "熟食及小食", defaultRate: 36.00, unit: "包" },
  { id: "p17", name: "醉豬手", category: "熟食及小食", defaultRate: 35.00, unit: "包" },
  { id: "p18", name: "花雕酒醉雞腎", category: "熟食及小食", defaultRate: 40.00, unit: "包" },
  { id: "p19", name: "醉雞腎 150g", category: "熟食及小食", defaultRate: 30.00, unit: "包" },
  { id: "p20", name: "醉雞腎 250g", category: "熟食及小食", defaultRate: 48.00, unit: "包" },
  { id: "p21", name: "麻辣雞腎 150g", category: "熟食及小食", defaultRate: 30.00, unit: "包" },
  { id: "p22", name: "麻辣雞腎 250g", category: "熟食及小食", defaultRate: 45.00, unit: "包" },
  { id: "p23", name: "辣腸 250g", category: "熟食及小食", defaultRate: 38.00, unit: "包" },
  { id: "p24", name: "麻辣涼拌,金錢肚 250g", category: "熟食及小食", defaultRate: 65.00, unit: "包" },
  { id: "p25", name: "麻辣涼拌,金錢肚 150g", category: "熟食及小食", defaultRate: 42.00, unit: "包" },

  // 蕃薯及蔬菜系列
  { id: "p26", name: "烤日本蕃薯、紅春香", category: "蕃薯及蔬菜", defaultRate: 21.00, unit: "件" },
  { id: "p27", name: "紅春香(S size 1Kg)", category: "蕃薯及蔬菜", defaultRate: 60.00, unit: "kg" },
  { id: "p28", name: "紅天使蕃薯(280g)", category: "蕃薯及蔬菜", defaultRate: 17.50, unit: "包" },
  { id: "p29", name: "紅天使番薯(1Kg)", category: "蕃薯及蔬菜", defaultRate: 28.00, unit: "kg" },
  { id: "p30", name: "焗南瓜片", category: "蕃薯及蔬菜", defaultRate: 10.00, unit: "包" },
  { id: "p31", name: "焗南瓜片(150g)", category: "蕃薯及蔬菜", defaultRate: 12.00, unit: "包" },

  // 甜品
  { id: "p32", name: "紅天使蕃薯 Cheese Cake", category: "甜品", defaultRate: 98.00, unit: "個" },
  { id: "p33", name: "紅天使蕃薯蓉慕斯", category: "甜品", defaultRate: 20.00, unit: "杯" },
  { id: "p34", name: "紅天使蕃薯蓉慕斯杯原味(100g)", category: "甜品", defaultRate: 15.00, unit: "杯" },
  { id: "p35", name: "紅天使蕃薯蓉慕斯杯朱古力(100g)", category: "甜品", defaultRate: 15.00, unit: "杯" },
  { id: "p36", name: "紅天使蕃薯蓉慕斯杯綠茶(100g)", category: "甜品", defaultRate: 15.00, unit: "杯" },

  // 套裝及特別項目
  { id: "p37", name: "28件即食雞胸套裝", category: "套裝及優惠", defaultRate: 544.00, unit: "套" },
  { id: "p38", name: "14件即食雞胸套裝", category: "套裝及優惠", defaultRate: 288.00, unit: "套" },
  { id: "p39", name: "即食雞胸肉丸試食套裝", category: "套裝及優惠", defaultRate: 99.00, unit: "套" },
  { id: "p40", name: "即食雞胸&雞肉丸試食套裝", category: "套裝及優惠", defaultRate: 239.00, unit: "套" },
  { id: "p41", name: "福袋", category: "套裝及優惠", defaultRate: 280.00, unit: "套" },
  { id: "p42", name: "麻辣涼拌套裝", category: "套裝及優惠", defaultRate: 158.00, unit: "套" },
  { id: "p43", name: "花雕酒醉套裝", category: "套裝及優惠", defaultRate: 108.00, unit: "套" },
  { id: "p44", name: "有營Lunch Box $49", category: "便當", defaultRate: 49.00, unit: "個" },
  { id: "p45", name: "有營Lunch Box $54", category: "便當", defaultRate: 54.00, unit: "個" },
  { id: "p46", name: "Defect Chicken Breast", category: "服務及其他", defaultRate: 0.00, unit: "件" },
  { id: "p47", name: "Form Board Share", category: "服務及其他", defaultRate: 527.00, unit: "項" },
  { id: "p48", name: "Delivery Charge 運費", category: "服務及其他", defaultRate: 55.00, unit: "次" },
  { id: "p49", name: "南瓜咖哩汁牛脷牛肋條", category: "熟食及小食", defaultRate: 58.00, unit: "份" }
];

export const DEFAULT_CUSTOMERS: Customer[] = [
  { id: "c1", name: "Mary", code: "UN", phone: "64095115", address: "", createdAt: "2026-04-10" },
  { id: "c2", name: "Pick and Match", code: "PM", phone: "Ging 62893834", address: "香港九龍觀塘興業街", createdAt: "2026-05-01" },
  { id: "c3", name: "Soulstar", code: "SS", phone: "Paris 96918123", address: "中環威靈頓街", createdAt: "2026-05-15" },
  { id: "c4", name: "GMC", code: "GMC", phone: "King 98462061", address: "尖沙咀廣東道", createdAt: "2026-06-01" },
  { id: "c5", name: "台沐", code: "Kokoyu", phone: "Otto +852 92733330", address: "北角匯二期109號鋪", createdAt: "2026-06-15" },
  { id: "c6", name: "日之苑", code: "Ninoen", phone: "Otto 92733330", address: "灣仔軒尼詩道", createdAt: "2026-06-20" },
  { id: "c7", name: "RabbitFit+", code: "RF", phone: "93870434", address: "旺角彌敦道562 5/F", createdAt: "2026-05-05" },
  { id: "c8", name: "金二少冰室", code: "KM", phone: "Issac Chau 67710322", address: "九龍柯士甸道地下71號", createdAt: "2026-05-28" },
  { id: "c9", name: "Ourhkmall", code: "OHM", phone: "94544247", address: "紅磡 民裕街32號榮業大廈10H", createdAt: "2026-01-02" },
  { id: "c10", name: "Time To Gold", code: "TTG", phone: "楊小姐 95040906", address: "北角錦屏街26號幸福大樓地下dl舖", createdAt: "2026-05-27" }
];

export const DEFAULT_INVOICES: Invoice[] = [
  {
    id: "inv-20260420-001",
    invoiceNumber: "20262004001",
    date: "20/4/2026",
    customerId: "c1",
    customerName: "Mary",
    customerCode: "UN",
    customerPhone: "64095115",
    customerAddress: "",
    items: [
      { id: "item-1", productId: "p26", name: "烤日本蕃薯、紅春香", rate: 21.00, qty: 15, unit: "件" }
    ],
    totalUnits: 15,
    subtotal: 315.00,
    discountType: "amount",
    discountValue: 0,
    discountLabel: "Commission",
    discountAmount: 0,
    outstanding: 0,
    total: 315.00,
    currency: "HK$",
    paymentTerms: DEFAULT_COMPANY.defaultPaymentTerms,
    status: "paid",
    createdAt: "2026-04-20T10:30:00Z",
    updatedAt: "2026-04-20T10:30:00Z"
  },
  {
    id: "inv-20260601-002",
    invoiceNumber: "20260106002",
    date: "1/6/2026",
    customerId: "c2",
    customerName: "Pick and Match",
    customerCode: "PM",
    customerPhone: "Ging 62893834",
    customerAddress: "香港九龍觀塘興業街",
    items: [
      { id: "item-2-1", productId: "p7", name: "田園香草、即食雞胸", rate: 18.00, qty: 25, unit: "包" },
      { id: "item-2-2", productId: "p2", name: "蒜味香草,即食雞胸", rate: 18.00, qty: 15, unit: "包" },
      { id: "item-2-3", productId: "p3", name: "秘製黑椒,即食雞胸", rate: 18.00, qty: 38, unit: "包" },
      { id: "item-2-4", productId: "p6", name: "四川麻辣,即食雞胸", rate: 18.00, qty: 20, unit: "包" },
      { id: "item-2-5", productId: "p8", name: "風味沙薑,即食雞胸", rate: 18.00, qty: 25, unit: "包" },
      { id: "item-2-6", productId: "p9", name: "惹味孜然,即食雞胸", rate: 18.00, qty: 15, unit: "包" },
      { id: "item-2-7", productId: "p10", name: "越式香茅、即食雞胸", rate: 18.00, qty: 15, unit: "包" },
      { id: "item-2-8", productId: "p46", name: "Defect Chicken Breast", rate: 0.00, qty: 11, unit: "件" },
      { id: "item-2-9", productId: "p47", name: "Form Board Share", rate: 527.00, qty: 0.5, unit: "項" }
    ],
    totalUnits: 164.5,
    subtotal: 3014.50,
    discountType: "percent",
    discountValue: 40,
    discountLabel: "Commission 40%",
    discountAmount: 1205.80,
    outstanding: 0,
    total: 1808.70,
    currency: "HK$",
    paymentTerms: DEFAULT_COMPANY.defaultPaymentTerms,
    status: "paid",
    createdAt: "2026-06-01T14:15:00Z",
    updatedAt: "2026-06-01T14:15:00Z"
  },
  {
    id: "inv-20260528-001",
    invoiceNumber: "20262805001",
    date: "28/5/2026",
    customerId: "c8",
    customerName: "金二少冰室",
    customerCode: "KM",
    customerPhone: "Issac Chau 67710322",
    customerAddress: "九龍柯士甸道地下71號",
    items: [
      { id: "item-8-1", productId: "p1", name: "招牌原味,即食雞胸", rate: 9.00, qty: 300, unit: "包" }
    ],
    totalUnits: 300,
    subtotal: 2700.00,
    discountType: "amount",
    discountValue: 0,
    discountLabel: "Commission",
    discountAmount: 0,
    outstanding: 0,
    total: 2700.00,
    currency: "HK$",
    paymentTerms: DEFAULT_COMPANY.defaultPaymentTerms,
    status: "issued",
    createdAt: "2026-05-28T09:00:00Z",
    updatedAt: "2026-05-28T09:00:00Z"
  },
  {
    id: "inv-20260630-001",
    invoiceNumber: "20263006001",
    date: "30/6/2026",
    customerId: "c5",
    customerName: "台沐",
    customerCode: "Kokoyu",
    customerPhone: "Otto +852 92733330",
    customerAddress: "北角匯二期109號鋪",
    items: [
      { id: "item-5-1", productId: "p3", name: "秘製黑椒,即食雞胸", rate: 11.00, qty: 30, unit: "包" },
      { id: "item-5-2", productId: "p4", name: "日式照燒,即食雞胸", rate: 11.00, qty: 75, unit: "包" },
      { id: "item-5-3", productId: "p5", name: "泰式香辣,即食雞胸", rate: 11.00, qty: 8, unit: "包" },
      { id: "item-5-4", productId: "p8", name: "風味沙薑,即食雞胸", rate: 11.00, qty: 65, unit: "包" },
      { id: "item-5-5", productId: "p29", name: "紅天使番薯(1Kg)", rate: 28.00, qty: 8, unit: "kg" },
      { id: "item-5-6", productId: "p30", name: "焗南瓜片", rate: 10.00, qty: 70, unit: "包" }
    ],
    totalUnits: 256,
    subtotal: 2902.00,
    discountType: "amount",
    discountValue: 0,
    discountLabel: "Discount",
    discountAmount: 0,
    outstanding: 0,
    total: 2902.00,
    currency: "HK$",
    paymentTerms: DEFAULT_COMPANY.defaultPaymentTerms,
    status: "issued",
    createdAt: "2026-06-30T16:20:00Z",
    updatedAt: "2026-06-30T16:20:00Z"
  }
];
