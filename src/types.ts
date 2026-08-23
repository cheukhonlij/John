export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

export type DiscountType = 'amount' | 'percent';

export interface Product {
  id: string;
  name: string;
  category: string;
  defaultRate: number | null;
  unit?: string;
  sku?: string;
  description?: string;
  isArchived?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  code: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  name: string;
  category?: string;
  rate: number | null;
  qty: number;
  unit?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string; // DD/MM/YYYY or YYYY-MM-DD
  dueDate?: string;
  customerId?: string;
  customerName: string;
  customerCode: string;
  customerPhone: string;
  customerAddress: string;
  items: InvoiceItem[];
  totalUnits: number;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountLabel: string;
  discountAmount: number;
  outstanding: number;
  total: number;
  currency: string;
  paymentTerms: string;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  name: string;
  subTitle: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  tel: string;
  email: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  defaultPaymentTerms: string;
  currency: string;
  showStampBox: boolean;
}
