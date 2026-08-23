import { Invoice, CompanyProfile } from '../types';

export interface PDFExportResult {
  success: boolean;
  filename: string;
  blobUrl?: string;
  dataUrl?: string;
  error?: string;
}

export const formatCurrency = (amount: number, currency: string = 'HK$'): string => {
  return `${currency}${amount.toFixed(2)}`;
};

/**
 * Generate a complete, standalone, high-contrast A4 printable HTML document.
 * Supports both standard Invoice mode and Delivery Note (DO) mode.
 */
export const generateStandaloneInvoiceHtml = (
  invoice: Invoice,
  company: CompanyProfile,
  isDeliveryNote: boolean = false
): string => {
  const cleanCustomer = invoice.customerName || '貴客戶';
  const currency = invoice.currency || company.currency || 'HK$';
  const activeItems = invoice.items.filter((it) => it.qty > 0);
  const docTitleEn = isDeliveryNote ? 'DELIVERY NOTE' : 'INVOICE';
  const docTitleZh = isDeliveryNote ? '出貨單 / 送貨單' : '發票';
  const prefix = isDeliveryNote ? 'DO' : 'INV';

  // Generate table rows based on mode
  const itemsHtml = activeItems.map((item, idx) => {
    const bgClass = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

    if (isDeliveryNote) {
      // DO mode: Hide price & amount, focus on quantity, unit, and item details
      return `
        <tr style="background-color: ${bgClass}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 14px; font-weight: 700; color: #0f172a; font-size: 13px;">
            <div style="font-size: 14px;">${escapeHtml(item.name)}</div>
            ${item.category ? `<div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px;">${escapeHtml(item.category)}</div>` : ''}
          </td>
          <td style="padding: 12px 14px; text-align: center; font-weight: 900; color: #0f172a; font-size: 15px; font-family: monospace;">
            ${item.qty}
          </td>
          <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #475569; font-size: 13px;">
            ${escapeHtml(item.unit || '件')}
          </td>
          <td style="padding: 12px 14px; text-align: center; color: #94a3b8; font-size: 12px;">
            <div style="border-bottom: 1px dashed #cbd5e1; width: 80px; margin: 0 auto; height: 16px;"></div>
          </td>
        </tr>
      `;
    }

    // Invoice mode: show unit price & line amount
    const rateStr = item.rate !== null ? `${currency}${item.rate.toFixed(2)}` : `${currency}0.00`;
    const itemTotalStr = item.rate !== null ? `${currency}${(item.qty * item.rate).toFixed(2)}` : `${currency}0.00`;

    return `
      <tr style="background-color: ${bgClass}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; font-size: 13px;">
          <div>${escapeHtml(item.name)}</div>
          ${item.category ? `<div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px;">${escapeHtml(item.category)}</div>` : ''}
        </td>
        <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: #0f172a; font-size: 13px;">
          ${item.qty} <span style="font-size: 11px; color: #64748b; font-weight: 600;">${escapeHtml(item.unit || '件')}</span>
        </td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #334155; font-size: 13px; font-family: monospace;">
          ${rateStr}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 900; color: #0f172a; font-size: 13px; font-family: monospace;">
          ${itemTotalStr}
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitleZh} ${docTitleEn} #${escapeHtml(invoice.invoiceNumber)} - ${escapeHtml(cleanCustomer)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans TC", "PingFang HK", "Microsoft JhengHei", sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      line-height: 1.5;
      padding: 20px;
    }

    /* Fixed top toolbar for easy printing and saving */
    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      max-width: 800px;
      margin: 0 auto 20px auto;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
      border-radius: 4px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: none;
      cursor: pointer;
      border-radius: 2px;
      transition: all 0.15s ease;
      text-decoration: none;
    }
    .btn-primary {
      background: #10b981;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #059669;
    }
    .btn-secondary {
      background: #334155;
      color: #f8fafc;
    }
    .btn-secondary:hover {
      background: #475569;
    }

    /* A4 Paper Sheet Representation */
    .invoice-page {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px 40px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      position: relative;
    }

    /* Header styling */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .company-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .company-sub {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .company-info {
      font-size: 11px;
      color: #475569;
      line-height: 1.4;
    }

    .invoice-badge-box {
      background: ${isDeliveryNote ? '#1e293b' : '#0f172a'};
      color: #ffffff;
      padding: 16px 20px;
      text-align: right;
      border-radius: 2px;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.05em;
      color: ${isDeliveryNote ? '#38bdf8' : '#10b981'};
      margin-bottom: 4px;
    }
    .invoice-no {
      font-size: 15px;
      font-weight: 800;
      font-family: monospace;
      color: #ffffff;
    }
    .invoice-meta {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
      margin-top: 4px;
    }

    /* Client Box */
    .client-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid ${isDeliveryNote ? '#0284c7' : '#0f172a'};
      padding: 14px 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .section-label {
      font-size: 10px;
      font-weight: 900;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
    }
    .client-detail {
      font-size: 12px;
      color: #334155;
      margin-top: 2px;
    }

    /* Products Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table th {
      background: ${isDeliveryNote ? '#1e293b' : '#0f172a'};
      color: #ffffff;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 10px 12px;
    }

    /* Summary Calculation Block */
    .totals-wrapper {
      display: flex;
      justify-content: ${isDeliveryNote ? 'space-between' : 'flex-end'};
      align-items: center;
      margin-bottom: 24px;
    }
    .totals-table {
      width: 320px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 10px;
      font-size: 13px;
    }
    .totals-label {
      font-weight: 700;
      color: #475569;
      text-align: right;
    }
    .totals-value {
      font-weight: 800;
      font-family: monospace;
      color: #0f172a;
      text-align: right;
    }
    .grand-total-row {
      background: #0f172a;
      color: #ffffff;
    }
    .grand-total-row td {
      padding: 12px 14px;
    }
    .grand-total-label {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #ffffff;
    }
    .grand-total-val {
      font-size: 18px;
      font-weight: 900;
      color: #10b981;
      font-family: monospace;
    }

    /* DO Specific Units Box */
    .do-units-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: inline-flex;
      align-items: center;
      gap: 16px;
      border-radius: 2px;
    }

    /* Footer Grid (Bank / Delivery Signatures) */
    .footer-grid {
      display: grid;
      grid-template-columns: ${isDeliveryNote ? '1fr 1fr' : '1.2fr 0.8fr'};
      gap: 20px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 2px solid #0f172a;
    }
    .bank-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 12px 16px;
      font-size: 11px;
      color: #334155;
    }
    .bank-title {
      font-weight: 900;
      font-size: 11px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.05em;
    }
    .sign-box {
      border: 1px dashed #94a3b8;
      min-height: 100px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 10px 14px;
      background: #fdfdfd;
    }
    .sign-title {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .sign-line {
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
    }

    /* Print media rules */
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .invoice-page {
        border: none !important;
        box-shadow: none !important;
        padding: 10mm 12mm !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>

  <!-- Floating Print & Action Bar (Hidden when printing) -->
  <div class="no-print-toolbar">
    <div style="font-size: 13px; font-weight: 800;">
      📄 ${docTitleZh} #${escapeHtml(invoice.invoiceNumber)} [${escapeHtml(cleanCustomer)}]
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" class="btn btn-primary">
        🖨️ 立即列印 / 另存為 PDF
      </button>
      <button onclick="window.close()" class="btn btn-secondary">
        關閉視窗
      </button>
    </div>
  </div>

  <!-- A4 Document Sheet -->
  <div class="invoice-page" id="invoiceSheet">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top; width: 55%;">
          <div class="company-title">${escapeHtml(company.name || "TODAY'S FOOD LAB")}</div>
          <div class="company-sub">${escapeHtml(company.subTitle || 'Premium Food & Beverage Solutions')}</div>
          <div class="company-info">
            ${company.addressLine1 ? `<div>${escapeHtml(company.addressLine1)}</div>` : ''}
            ${company.addressLine2 ? `<div>${escapeHtml(company.addressLine2)}</div>` : ''}
            ${company.addressLine3 ? `<div>${escapeHtml(company.addressLine3)}</div>` : ''}
            ${company.tel ? `<div>TEL: ${escapeHtml(company.tel)}</div>` : ''}
            ${company.email ? `<div>EMAIL: ${escapeHtml(company.email)}</div>` : ''}
          </div>
        </td>
        <td style="vertical-align: top; width: 45%;">
          <div class="invoice-badge-box">
            <div class="invoice-title">${docTitleEn} ${docTitleZh}</div>
            <div class="invoice-no">#${escapeHtml(invoice.invoiceNumber)}</div>
            <div class="invoice-meta">${isDeliveryNote ? '出貨/送貨日期' : '發票日期'}: ${escapeHtml(invoice.date)}</div>
            ${!isDeliveryNote && invoice.dueDate ? `<div class="invoice-meta">付款期限: ${escapeHtml(invoice.dueDate)}</div>` : ''}
            <div class="invoice-meta" style="color: #38bdf8; text-transform: uppercase;">
              文件類型: ${isDeliveryNote ? 'DELIVERY ORDER' : 'TAX INVOICE'}
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Client & Delivery Section -->
    <div class="client-section">
      <div>
        <div class="section-label">${isDeliveryNote ? 'DELIVER TO / 收貨客戶' : 'BILL TO / 客戶資料'}</div>
        <div class="client-name">
          ${escapeHtml(invoice.customerName || '貴客戶')}
          ${invoice.customerCode ? `<span style="font-size: 12px; color: #64748b;">[${escapeHtml(invoice.customerCode)}]</span>` : ''}
        </div>
        ${invoice.customerPhone ? `<div class="client-detail"><strong>聯絡電話:</strong> ${escapeHtml(invoice.customerPhone)}</div>` : ''}
      </div>
      ${invoice.customerAddress ? `
      <div style="max-width: 340px;">
        <div class="section-label" style="color: #0284c7;">DELIVERY ADDRESS / 指定送貨地址</div>
        <div class="client-detail" style="line-height: 1.4; font-weight: 700; color: #0f172a;">${escapeHtml(invoice.customerAddress)}</div>
      </div>
      ` : ''}
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          ${isDeliveryNote ? `
            <th style="text-align: left; width: 55%;">貨品名稱 / 項目 Description</th>
            <th style="text-align: center; width: 15%;">送貨數量 QTY</th>
            <th style="text-align: center; width: 15%;">包裝單位 Unit</th>
            <th style="text-align: center; width: 15%;">點收核對 Check</th>
          ` : `
            <th style="text-align: left; width: 45%;">貨品名稱 / 項目 Description</th>
            <th style="text-align: center; width: 15%;">數量 QTY</th>
            <th style="text-align: right; width: 20%;">單價 Rate</th>
            <th style="text-align: right; width: 20%;">金額 Amount</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || `<tr><td colspan="${isDeliveryNote ? 4 : 4}" style="text-align:center; padding: 20px; color: #94a3b8;">未有項目</td></tr>`}
      </tbody>
    </table>

    <!-- Totals Summary / Units Badge -->
    ${isDeliveryNote ? `
      <div class="totals-wrapper">
        <div class="do-units-badge">
          <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8;">
            DELIVERY TOTAL UNITS (出貨總件數):
          </span>
          <span style="font-size: 22px; font-weight: 900; font-family: monospace; color: #38bdf8;">
            ${invoice.totalUnits} 件
          </span>
        </div>
        <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">
          ⚠️ 此出貨單僅供點貨簽收，不含價格資訊
        </div>
      </div>
    ` : `
      <div class="totals-wrapper">
        <table class="totals-table">
          <tr>
            <td class="totals-label">總數量 Total Units:</td>
            <td class="totals-value">${invoice.totalUnits}</td>
          </tr>
          <tr>
            <td class="totals-label">小計 Subtotal:</td>
            <td class="totals-value">${formatCurrency(invoice.subtotal, currency)}</td>
          </tr>
          ${invoice.discountAmount > 0 ? `
          <tr>
            <td class="totals-label" style="color: #dc2626;">${escapeHtml(invoice.discountLabel || '折扣優惠 Discount')}:</td>
            <td class="totals-value" style="color: #dc2626;">-${formatCurrency(invoice.discountAmount, currency)}</td>
          </tr>
          ` : ''}
          ${invoice.outstanding > 0 ? `
          <tr>
            <td class="totals-label" style="color: #b45309;">已付/未收訂金 Outstanding:</td>
            <td class="totals-value" style="color: #b45309;">${formatCurrency(invoice.outstanding, currency)}</td>
          </tr>
          ` : ''}
          <tr class="grand-total-row">
            <td class="grand-total-label">應付總額 TOTAL:</td>
            <td class="grand-total-val">${formatCurrency(invoice.total, currency)}</td>
          </tr>
        </table>
      </div>
    `}

    <!-- Footer Grid -->
    ${isDeliveryNote ? `
      <!-- Delivery Note Signature Section -->
      <div class="footer-grid">
        <div class="sign-box">
          <div class="sign-title">🚚 送貨司機 / 派送員 (Delivered By)</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 10px;">
            司機姓名 / 車牌: ________________________
          </div>
          <div class="sign-line">
            <span>送貨員簽署 Signature</span>
            <span>送出時間 Date/Time</span>
          </div>
        </div>

        <div class="sign-box">
          <div class="sign-title">✍️ 收貨人確認及簽收 (Received By)</div>
          <div style="font-size: 10px; color: #475569; margin-top: 4px; line-height: 1.3;">
            以上貨品已點訖無訛，包裝完整。<br>Goods received in good order and condition.
          </div>
          <div class="sign-line" style="margin-top: 12px;">
            <span>客戶簽收 / 蓋印 Customer Stamp & Sign</span>
            <span>簽收日期 Date</span>
          </div>
        </div>
      </div>
    ` : `
      <!-- Standard Invoice Payment & Stamp Section -->
      <div class="footer-grid">
        <div class="bank-box">
          <div class="bank-title">🏦 付款及銀行戶口資料 (Payment Details)</div>
          <div><strong>銀行名稱:</strong> ${escapeHtml(company.bankName || 'HSBC 香港上海滙豐銀行')}</div>
          <div><strong>戶口名稱:</strong> ${escapeHtml(company.accountName || "TODAY'S FOOD LAB")}</div>
          <div><strong>戶口號碼:</strong> <span style="font-family: monospace; font-weight: 800;">${escapeHtml(company.accountNumber || '808-123456-838')}</span></div>
          <div style="margin-top: 6px; font-size: 10px; color: #64748b; line-height: 1.3;">
            ${escapeHtml(invoice.paymentTerms || company.defaultPaymentTerms || '請於收到發票後安排付款。如以轉數快/支票付款，請註明發票編號。')}
          </div>
        </div>
        
        <div class="sign-box" style="justify-content: flex-end; text-align: center;">
          <div class="sign-line" style="justify-content: center; width: 100%;">
            公司蓋印 / 授權簽署 Authorized Signature
          </div>
        </div>
      </div>
    `}

    ${invoice.notes ? `
    <div style="margin-top: 16px; font-size: 11px; color: #475569; background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0;">
      <strong>備註 Notes:</strong> ${escapeHtml(invoice.notes)}
    </div>
    ` : ''}
  </div>

  <script>
    // Auto-trigger print when loaded
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Auto-print error', e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;
};

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Open standalone print window for Invoice or Delivery Note
 */
export const printInvoiceStandalone = (
  invoice: Invoice,
  company: CompanyProfile,
  isDeliveryNote: boolean = false
): { success: boolean; blobUrl?: string; htmlContent?: string } => {
  try {
    const html = generateStandaloneInvoiceHtml(invoice, company, isDeliveryNote);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    // Try opening in new window
    const printWin = window.open(blobUrl, '_blank');
    if (!printWin || printWin.closed || typeof printWin.closed === 'undefined') {
      // If popup was blocked by browser, create an iframe to trigger print
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('iframe print failed', e);
          }
        }, 300);
      };
    }

    return { success: true, blobUrl, htmlContent: html };
  } catch (err) {
    console.error('printInvoiceStandalone error', err);
    return { success: false };
  }
};

/**
 * Direct file download trigger for HTML/Document format (Invoice or DO)
 */
export const downloadInvoiceStandaloneFile = (
  invoice: Invoice,
  company: CompanyProfile,
  isDeliveryNote: boolean = false
): { success: boolean; filename: string; blobUrl: string } => {
  const cleanCustomer = (invoice.customerName || 'Client').replace(/[^\w\u4e00-\u9fa5]/gi, '_');
  const cleanNum = (invoice.invoiceNumber || 'Invoice').replace(/[^\w-]/gi, '_');
  const typeTag = isDeliveryNote ? 'DeliveryNote_DO' : 'Invoice';
  const filename = `${typeTag}_${cleanNum}_${cleanCustomer}.html`;

  const html = generateStandaloneInvoiceHtml(invoice, company, isDeliveryNote);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 1000);

  return { success: true, filename, blobUrl };
};

/**
 * Backward compatible export helper with direct standalone window integration
 */
export const exportInvoiceAsPDF = async (
  elementId: string,
  invoiceNumber: string,
  customerName: string,
  invoiceData?: Invoice,
  companyData?: CompanyProfile,
  isDeliveryNote: boolean = false
): Promise<PDFExportResult> => {
  const cleanCustomer = (customerName || 'Client').replace(/[^\w\u4e00-\u9fa5]/gi, '_');
  const cleanNum = (invoiceNumber || 'Invoice').replace(/[^\w-]/gi, '_');
  const typeTag = isDeliveryNote ? 'DeliveryNote_DO' : 'Invoice';
  const filename = `${typeTag}_${cleanNum}_${cleanCustomer}.html`;

  if (invoiceData && companyData) {
    const res = printInvoiceStandalone(invoiceData, companyData, isDeliveryNote);
    return {
      success: res.success,
      filename,
      blobUrl: res.blobUrl,
    };
  }

  // Fallback: print standard window
  window.print();
  return { success: true, filename };
};

export const exportInvoiceAsPNG = async (
  elementId: string,
  invoiceNumber: string,
  customerName: string
): Promise<{ success: boolean; filename: string; dataUrl?: string }> => {
  const cleanCustomer = (customerName || 'Client').replace(/[^\w\u4e00-\u9fa5]/gi, '_');
  const cleanNum = (invoiceNumber || 'Invoice').replace(/[^\w-]/gi, '_');
  const filename = `Invoice_${cleanNum}_${cleanCustomer}.html`;

  return { success: true, filename };
};

export const copyInvoiceImageToClipboard = async (elementId: string): Promise<boolean> => {
  return false;
};

export const printInvoiceElement = (elementId: string): void => {
  window.print();
};

export const generateWhatsAppShareUrl = (
  invoice: Invoice,
  company: CompanyProfile,
  isDeliveryNote: boolean = false
): string => {
  if (isDeliveryNote) {
    // Delivery Note WhatsApp format (NO prices shown)
    const lines: string[] = [
      `🚚 *${company.name} - 出貨單 / 送貨單 (DELIVERY NOTE)*`,
      `--------------------------------`,
      `📄 *送貨單號:* #${invoice.invoiceNumber}`,
      `📅 *出貨日期:* ${invoice.date}`,
      `👤 *收貨客戶:* ${invoice.customerName} ${invoice.customerCode ? `(${invoice.customerCode})` : ''}`,
      invoice.customerPhone ? `📞 *聯絡電話:* ${invoice.customerPhone}` : '',
      invoice.customerAddress ? `📍 *送貨地址:* ${invoice.customerAddress}` : '',
      `--------------------------------`,
      `📦 *送貨品項清單:*`,
    ];

    invoice.items.forEach(item => {
      if (item.qty > 0) {
        lines.push(`• ${item.name} x ${item.qty} ${item.unit || '件'}`);
      }
    });

    lines.push(`--------------------------------`);
    lines.push(`🔢 *出貨總件數 (Total Units):* ${invoice.totalUnits} 件`);
    lines.push(`📝 *司機備註:* 請收貨人核對數量並簽收。`);
    lines.push(`\n多謝合作！THANK YOU FOR YOUR BUSINESS!`);

    const cleanText = lines.filter(Boolean).join('\n');
    const encodedText = encodeURIComponent(cleanText);

    const phoneDigits = invoice.customerPhone.replace(/\D/g, '');
    if (phoneDigits.length >= 8) {
      const targetNumber = phoneDigits.length === 8 ? `852${phoneDigits}` : phoneDigits;
      return `https://wa.me/${targetNumber}?text=${encodedText}`;
    }

    return `https://wa.me/?text=${encodedText}`;
  }

  // Invoice WhatsApp format (With price calculations)
  const lines: string[] = [
    `🧾 *${company.name} - 發票 INVOICE*`,
    `--------------------------------`,
    `📄 *發票編號:* #${invoice.invoiceNumber}`,
    `📅 *日期:* ${invoice.date}`,
    `👤 *客戶:* ${invoice.customerName} ${invoice.customerCode ? `(${invoice.customerCode})` : ''}`,
    invoice.customerPhone ? `📞 *電話:* ${invoice.customerPhone}` : '',
    invoice.customerAddress ? `📍 *送貨地址:* ${invoice.customerAddress}` : '',
    `--------------------------------`,
    `🛒 *訂購貨品清單:*`,
  ];

  invoice.items.forEach(item => {
    if (item.qty > 0) {
      const itemTotal = item.rate !== null ? (item.qty * item.rate).toFixed(2) : '0.00';
      lines.push(`• ${item.name} x ${item.qty} ${item.unit || ''} @ ${invoice.currency}${item.rate ?? 0} = ${invoice.currency}${itemTotal}`);
    }
  });

  lines.push(`--------------------------------`);
  lines.push(`🔢 *總數量 (Total Units):* ${invoice.totalUnits}`);
  lines.push(`💵 *小計 (Subtotal):* ${formatCurrency(invoice.subtotal, invoice.currency)}`);

  if (invoice.discountAmount > 0) {
    lines.push(`🏷️ *${invoice.discountLabel || '折扣/佣金'}:* -${formatCurrency(invoice.discountAmount, invoice.currency)}`);
  }

  if (invoice.outstanding > 0) {
    lines.push(`⏳ *已付/未收訂金 (Outstanding):* ${formatCurrency(invoice.outstanding, invoice.currency)}`);
  }

  lines.push(`✨ *應付總額 (TOTAL):* *${formatCurrency(invoice.total, invoice.currency)}*`);
  lines.push(`--------------------------------`);
  lines.push(`🏦 *付款資訊:*`);
  lines.push(`戶口名稱: ${company.accountName}`);
  lines.push(`戶口號碼: ${company.bankName} ${company.accountNumber}`);
  lines.push(`\n${company.defaultPaymentTerms.split('\n')[0] || ''}`);
  lines.push(`\n多謝惠顧！THANK YOU FOR YOUR BUSINESS!`);

  const cleanText = lines.filter(Boolean).join('\n');
  const encodedText = encodeURIComponent(cleanText);

  const phoneDigits = invoice.customerPhone.replace(/\D/g, '');
  if (phoneDigits.length >= 8) {
    const targetNumber = phoneDigits.length === 8 ? `852${phoneDigits}` : phoneDigits;
    return `https://wa.me/${targetNumber}?text=${encodedText}`;
  }

  return `https://wa.me/?text=${encodedText}`;
};

export const generateEmailShareUrl = (
  invoice: Invoice,
  company: CompanyProfile,
  isDeliveryNote: boolean = false
): string => {
  if (isDeliveryNote) {
    const subject = encodeURIComponent(`[出貨單 / 送貨單 DO] ${company.name} - #${invoice.invoiceNumber} (${invoice.customerName})`);
    const body = encodeURIComponent(
      `親愛的 ${invoice.customerName}，\n\n隨信附上出貨單 #${invoice.invoiceNumber} 詳情：\n\n` +
      `出貨日期：${invoice.date}\n` +
      `送貨地址：${invoice.customerAddress || '---'}\n` +
      `送貨總件數：${invoice.totalUnits} 件\n\n` +
      `請收貨人於送達時核對並簽收。\n\n` +
      `TODAY'S FOOD LAB\n` +
      `電話：${company.tel}`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  const subject = encodeURIComponent(`[發票 INVOICE] ${company.name} - #${invoice.invoiceNumber} (${invoice.customerName})`);
  const body = encodeURIComponent(
    `親愛的 ${invoice.customerName}，\n\n感謝您的訂單。隨信附上發票 #${invoice.invoiceNumber} 詳情：\n\n` +
    `發票日期：${invoice.date}\n` +
    `訂購件數：${invoice.totalUnits}\n` +
    `應付總額：${formatCurrency(invoice.total, invoice.currency)}\n\n` +
    `匯款戶口：${company.bankName} - ${company.accountName} (${company.accountNumber})\n\n` +
    `${company.defaultPaymentTerms}\n\n` +
    `TODAY'S FOOD LAB\n` +
    `電話：${company.tel}`
  );
  return `mailto:?subject=${subject}&body=${body}`;
};
