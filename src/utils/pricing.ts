import { Invoice } from '../types';

export interface CustomerProductPriceInfo {
  productName: string;
  productId?: string;
  lastRate: number;
  lastInvoiceNumber: string;
  lastDate: string;
  orderCount: number;
}

/**
 * Scan all historical invoices to extract the most recent transaction price
 * and price history for each product sold to a specific customer.
 */
export const getCustomerPriceHistory = (
  invoices: Invoice[],
  customerId?: string,
  customerName?: string,
  customerCode?: string
): Map<string, CustomerProductPriceInfo> => {
  const priceMap = new Map<string, CustomerProductPriceInfo>();

  if (!customerId && !customerName && !customerCode) {
    return priceMap;
  }

  // Filter invoices for this customer, sorted by createdAt/date descending (newest first)
  const customerInvoices = invoices.filter((inv) => {
    if (customerId && inv.customerId === customerId) return true;
    if (customerCode && inv.customerCode && inv.customerCode.trim().toLowerCase() === customerCode.trim().toLowerCase()) return true;
    if (customerName && inv.customerName && inv.customerName.trim().toLowerCase() === customerName.trim().toLowerCase()) return true;
    return false;
  }).sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime() || 0;
    const timeB = new Date(b.createdAt || b.date).getTime() || 0;
    return timeB - timeA;
  });

  customerInvoices.forEach((inv) => {
    inv.items.forEach((item) => {
      if (item.rate !== null && item.qty > 0) {
        const key = item.name.trim().toLowerCase();
        if (!priceMap.has(key)) {
          priceMap.set(key, {
            productName: item.name,
            productId: item.productId,
            lastRate: item.rate,
            lastInvoiceNumber: inv.invoiceNumber,
            lastDate: inv.date,
            orderCount: 1,
          });
        } else {
          const existing = priceMap.get(key)!;
          existing.orderCount += 1;
        }
      }
    });
  });

  return priceMap;
};

/**
 * Get all product price histories for a customer as an array
 */
export const getCustomerPriceHistoryList = (
  invoices: Invoice[],
  customerId?: string,
  customerName?: string,
  customerCode?: string
): CustomerProductPriceInfo[] => {
  const map = getCustomerPriceHistory(invoices, customerId, customerName, customerCode);
  return Array.from(map.values());
};
