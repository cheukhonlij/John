import React from 'react';
import { Invoice, CompanyProfile } from '../types';
import { formatCurrency } from '../utils/pdfExport';

interface InvoicePreviewProps {
  invoice: Invoice;
  company: CompanyProfile;
  hideZeroItems?: boolean;
  containerId?: string;
  isPrintOnly?: boolean;
  isDeliveryNote?: boolean;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  invoice,
  company,
  hideZeroItems = true,
  containerId = 'invoiceContainer',
  isPrintOnly = false,
  isDeliveryNote = false,
}) => {
  const displayItems = hideZeroItems
    ? invoice.items.filter((item) => item.qty > 0)
    : invoice.items;

  return (
    <div
      id={containerId}
      className={`print-area bg-white text-black p-6 sm:p-8 shadow-xl rounded-sm border border-gray-200 w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between text-xs sm:text-sm leading-tight relative select-text ${
        isPrintOnly ? '' : 'mx-auto'
      }`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Top Section */}
      <div>
        {/* Black Header Banner */}
        <div className="mb-4">
          <div className="invoice-brand-header bg-black text-white p-3.5 sm:p-4 text-center rounded-xs shadow-xs">
            <h1 className="text-2xl sm:text-3xl font-black tracking-widest font-mono uppercase leading-none">
              {company.name || "TODAY'S"}
            </h1>
            <div className="text-xs sm:text-sm font-semibold tracking-widest mt-1 border-t border-neutral-700 pt-1 text-neutral-200">
              {company.subTitle || 'F O O D   L A B'}
            </div>
          </div>
        </div>

        {/* Company Info & Invoice Metadata Row */}
        <div className="flex justify-between items-start mb-4 text-[11px] sm:text-xs border-b border-gray-300 pb-3 gap-3">
          {/* Left: Company Details */}
          <div className="space-y-0.5 max-w-[62%] text-gray-800">
            <p className="font-bold text-xs sm:text-sm tracking-wide text-black">
              {company.name}
            </p>
            {company.addressLine1 && <p>{company.addressLine1}</p>}
            {company.addressLine2 && <p>{company.addressLine2}</p>}
            {company.addressLine3 && (
              <p className="font-sans text-gray-700">{company.addressLine3}</p>
            )}
            <div className="pt-0.5 flex items-center gap-3 text-gray-800">
              {company.tel && (
                <p>
                  <span className="font-semibold text-black">Tel:</span> {company.tel}
                </p>
              )}
              {company.email && (
                <p>
                  <span className="font-semibold text-black">Email:</span> {company.email}
                </p>
              )}
            </div>
          </div>

          {/* Right: Tag Box (Invoice or Delivery Note) */}
          <div className="text-right space-y-1 shrink-0">
            <h2 className={`text-lg sm:text-xl font-black tracking-wider uppercase ${isDeliveryNote ? 'text-blue-700' : 'text-black'}`}>
              {isDeliveryNote ? 'DELIVERY NOTE 送貨單' : 'INVOICE 發票'}
            </h2>
            <div className="inline-block text-left bg-gray-50 border border-gray-300 p-2 rounded-xs min-w-[160px]">
              <div className="flex justify-between py-0.5 border-b border-gray-200">
                <span className="font-semibold text-gray-600 pr-2">
                  {isDeliveryNote ? 'DELIVERY DATE:' : 'DATE:'}
                </span>
                <span className="font-mono font-medium text-black">{invoice.date || '---'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="font-semibold text-gray-600 pr-2">
                  {isDeliveryNote ? 'D.O. #:' : 'INVOICE #:'}
                </span>
                <span className="font-mono font-bold text-black">{invoice.invoiceNumber || '---'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bill / Deliver To Customer Card */}
        <div className={`mb-4 p-3 rounded-xs border flex justify-between items-start text-xs ${
          isDeliveryNote ? 'bg-blue-50/60 border-blue-200' : 'bg-gray-50/90 border-gray-200'
        }`}>
          <div className="space-y-0.5 max-w-[70%]">
            <span className="font-bold text-gray-600 uppercase tracking-wider block text-[10px]">
              {isDeliveryNote ? 'DELIVER TO (收貨客戶):' : 'BILL TO (客戶資料):'}
            </span>
            <div className="text-sm font-bold text-black flex items-center gap-2 flex-wrap">
              <span>{invoice.customerName || '未指定客戶 (Walk-in Customer)'}</span>
              {invoice.customerCode && (
                <span className="text-xs font-medium text-gray-700 bg-gray-200 px-1.5 py-0.2 rounded-xs">
                  {invoice.customerCode}
                </span>
              )}
            </div>
            {invoice.customerAddress && (
              <div className="text-gray-900 text-[11px] pt-0.5 font-medium">
                <span className="font-bold text-gray-700">送貨地址: </span>
                <span>{invoice.customerAddress}</span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            {invoice.customerPhone && (
              <div className="text-xs">
                <span className="text-gray-600 font-semibold">Phone: </span>
                <span className="font-mono text-black font-medium">{invoice.customerPhone}</span>
              </div>
            )}
            {isDeliveryNote ? (
              <div className="mt-1 no-print">
                <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  🚚 出貨單模式 (無價格)
                </span>
              </div>
            ) : invoice.status && (
              <div className="mt-1 no-print">
                <span
                  className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    invoice.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : invoice.status === 'issued'
                      ? 'bg-blue-100 text-blue-800'
                      : invoice.status === 'overdue'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {invoice.status === 'paid'
                    ? 'PAID 已付款'
                    : invoice.status === 'issued'
                    ? 'ISSUED 已發出'
                    : invoice.status === 'overdue'
                    ? 'OVERDUE 逾期'
                    : 'DRAFT 草稿'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full invoice-table text-left border-collapse text-xs mb-3">
            <thead>
              <tr className="text-black uppercase text-[10.5px] tracking-wider border-b-2 border-black bg-gray-100/80">
                <th className="py-2 px-2.5">DESCRIPTION (貨品名稱)</th>
                <th className="py-2 px-2.5 text-center w-24">QTY (數量)</th>
                {isDeliveryNote ? (
                  <>
                    <th className="py-2 px-2.5 text-center w-24">UNIT (單位)</th>
                    <th className="py-2 px-2.5 text-center w-28">CHECK (點收核對)</th>
                  </>
                ) : (
                  <>
                    <th className="py-2 px-2.5 text-right w-24">RATE (單價)</th>
                    <th className="py-2 px-2.5 text-right w-28">AMOUNT (金額)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400 italic">
                    尚未選擇任何貨品
                  </td>
                </tr>
              ) : (
                displayItems.map((item, idx) => {
                  const qty = item.qty || 0;
                  const rate = item.rate;
                  const amount = rate !== null && qty > 0 ? qty * rate : 0;
                  const isQtyPositive = qty > 0;

                  return (
                    <tr
                      key={item.id || idx}
                      className={`border-b border-gray-200 ${
                        isQtyPositive
                          ? 'font-medium text-black hover:bg-gray-50/50'
                          : 'text-gray-400'
                      }`}
                    >
                      <td className="py-2 px-2.5 text-black">
                        <span className="font-bold text-sm">{item.name}</span>
                        {item.category && (
                          <span className="text-[10px] text-gray-500 uppercase ml-2 font-medium">
                            [{item.category}]
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-2.5 text-center font-mono font-black text-black text-sm">
                        {isQtyPositive
                          ? Number.isInteger(qty)
                            ? qty
                            : qty.toFixed(2)
                          : '-'}
                        {!isDeliveryNote && item.unit && (
                          <span className="text-[10px] text-gray-500 font-normal ml-1">
                            {item.unit}
                          </span>
                        )}
                      </td>

                      {isDeliveryNote ? (
                        <>
                          <td className="py-2 px-2.5 text-center font-medium text-gray-700">
                            {item.unit || '件'}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <div className="w-5 h-5 border-2 border-gray-400 mx-auto rounded-xs"></div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-2.5 text-right font-mono text-black">
                            {rate !== null ? formatCurrency(rate, invoice.currency) : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-black">
                            {rate !== null
                              ? formatCurrency(amount, invoice.currency)
                              : `${invoice.currency}0.00`}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-auto pt-3 border-t-2 border-black">
        {isDeliveryNote ? (
          /* Delivery Note Bottom Summary & Signatures */
          <div>
            <div className="flex justify-between items-center bg-blue-50/80 p-3 rounded-xs border border-blue-200 mb-4">
              <div>
                <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider block">
                  DELIVERY TOTAL UNITS (出貨總件數)
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-blue-950">
                  {invoice.totalUnits} <span className="text-xs font-bold font-sans text-blue-800">件 / 包裝</span>
                </span>
              </div>
              <div className="text-right text-[11px] text-gray-600 font-medium">
                貨品請於交付時當面點訖確認
              </div>
            </div>

            {/* DO Signature Section */}
            <div className="grid grid-cols-2 gap-4 text-xs pt-2">
              <div className="border border-dashed border-gray-400 p-3 rounded-xs flex flex-col justify-between h-24 bg-gray-50/50">
                <span className="font-bold text-black uppercase text-[11px]">
                  🚚 送貨司機 / 派送員 (Driver Signature)
                </span>
                <div className="border-t border-gray-400 pt-1 text-[10px] text-gray-600 flex justify-between">
                  <span>司機簽名 Signature</span>
                  <span>送出時間 Date/Time</span>
                </div>
              </div>

              <div className="border border-dashed border-gray-400 p-3 rounded-xs flex flex-col justify-between h-24 bg-gray-50/50">
                <span className="font-bold text-black uppercase text-[11px]">
                  ✍️ 收貨客戶確認及蓋印 (Received & Confirmed By)
                </span>
                <div className="border-t border-gray-400 pt-1 text-[10px] text-gray-600 flex justify-between">
                  <span>客戶簽收 Customer Stamp</span>
                  <span>簽收日期 Date</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Invoice Bottom Summary */
          <div>
            <div className="flex justify-between items-start gap-4">
              {/* Total Units Badge */}
              <div className="bg-gray-100/90 p-2.5 rounded-xs border border-gray-300 inline-block min-w-[140px]">
                <span className="text-[10px] font-bold text-gray-600 uppercase block tracking-wider">
                  TOTAL UNITS (總件數)
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-black">
                  {invoice.totalUnits}
                </span>
              </div>

              {/* Calculations Table */}
              <div className="w-64 sm:w-72 space-y-1 text-xs">
                <div className="flex justify-between py-0.5 border-b border-gray-200 font-medium">
                  <span className="text-gray-600">SUBTOTAL (小計)</span>
                  <span className="font-mono font-bold text-black">
                    {formatCurrency(invoice.subtotal, invoice.currency)}
                  </span>
                </div>

                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-gray-200 text-rose-700">
                    <span className="font-medium">{invoice.discountLabel || 'Discount / Commission'}</span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(invoice.discountAmount, invoice.currency)}
                    </span>
                  </div>
                )}

                {invoice.outstanding > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-gray-200 text-gray-700">
                    <span className="font-medium">OUTSTANDING (已付/訂金)</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(invoice.outstanding, invoice.currency)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 border-b-2 border-black text-sm font-black text-black">
                  <span>TOTAL (應付總額)</span>
                  <span className="font-mono text-base sm:text-lg">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Notes & Bank Account Information */}
            <div className="mt-4 pt-3 border-t border-gray-300 text-xs text-gray-800 leading-relaxed flex justify-between items-end">
              <div className="whitespace-pre-line font-medium text-black max-w-[75%]">
                {invoice.paymentTerms || company.defaultPaymentTerms}
              </div>

              {company.showStampBox && (
                <div className="border border-dashed border-gray-400 p-2 text-center rounded-xs w-28 h-20 flex flex-col justify-between items-center text-[9px] text-gray-500 shrink-0">
                  <span>公司蓋印 / 簽署</span>
                  <span className="text-[8px] text-gray-400">Authorized Signature</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
