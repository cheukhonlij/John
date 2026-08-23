import { Customer, Product, Invoice, CompanyProfile } from '../types';
import { DEFAULT_PRODUCTS, DEFAULT_CUSTOMERS, DEFAULT_INVOICES, DEFAULT_COMPANY } from '../data/defaultData';

const STORAGE_KEYS = {
  PRODUCTS: 'todays_invoice_products_v1',
  CUSTOMERS: 'todays_invoice_customers_v1',
  INVOICES: 'todays_invoice_invoices_v1',
  COMPANY: 'todays_invoice_company_v1',
};

export const getStoredProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load products from storage', e);
  }
  return DEFAULT_PRODUCTS;
};

export const saveStoredProducts = (products: Product[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to save products to storage', e);
  }
};

export const getStoredCustomers = (): Customer[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load customers from storage', e);
  }
  return DEFAULT_CUSTOMERS;
};

export const saveStoredCustomers = (customers: Customer[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  } catch (e) {
    console.error('Failed to save customers to storage', e);
  }
};

export const getStoredInvoices = (): Invoice[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load invoices from storage', e);
  }
  return DEFAULT_INVOICES;
};

export const saveStoredInvoices = (invoices: Invoice[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  } catch (e) {
    console.error('Failed to save invoices to storage', e);
  }
};

export const getStoredCompany = (): CompanyProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPANY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load company profile from storage', e);
  }
  return DEFAULT_COMPANY;
};

export const saveStoredCompany = (company: CompanyProfile) => {
  try {
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(company));
  } catch (e) {
    console.error('Failed to save company profile to storage', e);
  }
};

export const exportAllDataBackup = () => {
  const data = {
    products: getStoredProducts(),
    customers: getStoredCustomers(),
    invoices: getStoredInvoices(),
    company: getStoredCompany(),
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todays_food_lab_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importDataBackup = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);
    if (data.products && Array.isArray(data.products)) {
      saveStoredProducts(data.products);
    }
    if (data.customers && Array.isArray(data.customers)) {
      saveStoredCustomers(data.customers);
    }
    if (data.invoices && Array.isArray(data.invoices)) {
      saveStoredInvoices(data.invoices);
    }
    if (data.company) {
      saveStoredCompany(data.company);
    }
    return true;
  } catch (e) {
    console.error('Failed to import backup', e);
    return false;
  }
};
