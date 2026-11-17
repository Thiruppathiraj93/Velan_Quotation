import React from 'react';
import { useQuotation } from '../context/QuotationContext';
import companyDetails from '../data/companyDetails';
import { toFixed2 } from '../utils/numberFormat';
import { deriveCharge, chargeRuns } from '../utils/roomCharges';
import '../styles/toilet-preview.css';

// One formatted text run from the Toilet Excel cells (bold / colour).
function runStyle(run) {
  const style = {};
  if (run.b) style.fontWeight = 'bold';
  if (run.c) style.color = run.c;
  return style;
}

function renderRuns(runs, keyPrefix) {
  return (runs || []).map((run, i) => (
    <span key={`${keyPrefix}-${i}`} style={runStyle(run)}>
      {run.t}
    </span>
  ));
}

// Excel accounting number format ("_ * #,##0.00_ ") shown with the grouping
// of the source Excels: 1,00,000.00 (Indian lakh/crore system).
function fmtAccounting(n) {
  const s = toFixed2(n);
  const dot = s.indexOf('.');
  const int = dot === -1 ? s : s.slice(0, dot);
  const dec = dot === -1 ? '' : s.slice(dot);
  if (int.replace(/^-/, '').length <= 3) return s;
  const neg = int.startsWith('-') ? '-' : '';
  const digits = neg ? int.slice(1) : int;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg}${rest},${last3}${dec}`;
}

// Rate cell: European sheet uses the accounting format, Indian sheet uses
// plain "0.00" (both taken from the workbook number formats).
function fmtRate(n, format) {
  if (format === 'accounting') return fmtAccounting(n);
  if (format === 'plain2') return toFixed2(n);
  return String(n);
}

export default function ToiletQuotationPreview() {
  const { template, form, amount, sub, gstAmt, tot } = useQuotation();
  if (!template) return null;

  // QTY uses the General format (raw number), RATE per template number
  // format, AMOUNT / totals always use the accounting format.
  const qtyText = form.nos == null ? '' : String(form.nos);
  const rateText =
    form.rate == null || form.rate === ''
      ? ''
      : fmtRate(Number(form.rate) || 0, template.rateFormat);

  const descRows = template.descRows || [];
  const lastDescIndex = descRows.length - 1;
  const billLines = String(form.billTo || '').split('\n');

  // Notes 5/6 (Transport / Crane charges) reflect the editable charge
  // inputs; an empty input keeps the original Excel note verbatim.
  const transportCharge = deriveCharge(template, ['transport charges', 'transportation']);
  const craneCharge = deriveCharge(template, 'crane');
  const displayNotes = (template.notes || []).map((note, i) => {
    if (transportCharge && i === transportCharge.index) {
      return chargeRuns(transportCharge, form.transportation) || note;
    }
    if (craneCharge && i === craneCharge.index) {
      return chargeRuns(craneCharge, form.crane) || note;
    }
    return note;
  });

  // The European sheet starts the Total label at column A, the Indian sheet
  // at column B; Subtotal / 18% GST labels merge B:D in both sheets.
  const totalFromA = template.totalFromCol === 'A';

  const totalsRow = (label, value, bold, fromA) => (
    <tr key={label}>
      {fromA ? (
        <td colSpan={4} className="toilet-total-label">{label}</td>
      ) : (
        <>
          <td></td>
          <td colSpan={3} className="toilet-total-label">{label}</td>
        </>
      )}
      <td className="toilet-num"></td>
      <td className="toilet-amount" style={bold ? { fontWeight: 'bold' } : undefined}>
        {value}
      </td>
    </tr>
  );

  return (
    <div id="quotationPdf" className="quotation-page toilet-page">
      {/* Excel A1:G7 — the Velan Concast letterhead image (identical in
          both Toilet Excels) */}
      <img src={companyDetails.toiletHeader} alt="Velan Concast" className="toilet-header" />

      <div className="q-info toilet-info">
        <div className="toilet-info-left">
          <div className="toilet-to">To,</div>
          <div className="toilet-billto">
            {billLines.map((line, i) => (
              <div key={i} className={i === 0 ? 'toilet-name' : 'toilet-addr'}>
                {line}
              </div>
            ))}
          </div>
        </div>
        <div className="toilet-info-right">
          <div>{form.quoteDate}</div>
          <div>Quotation No:{form.quoteNo}</div>
          <div>{form.customerNumber}</div>
        </div>
      </div>

      {/* Excel title row (merged A:F, bold, red "(Skelt Only)" tail).
          titleRuns is stored as a row of cells -> flatten to one run list. */}
      <div className="toilet-title">
        {renderRuns((template.titleRuns || []).flat(), 'title')}
      </div>

      <table className="q-table toilet-table">
        <thead>
          <tr>
            {(template.headers || []).map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
            <td className="toilet-item-title">{template.itemTitle}</td>
            <td></td><td></td><td></td><td></td>
          </tr>

          {descRows.map((runs, i) => {
            const isLast = i === lastDescIndex;
            return (
              <tr key={`d${i}`}>
                <td></td>
                <td className="toilet-desc">{renderRuns(runs, `d${i}`)}</td>
                {isLast ? (
                  <>
                    <td style={{ textAlign: template.qtyAlign }}>{qtyText}</td>
                    <td style={{ textAlign: template.unitAlign }}>{template.unit}</td>
                    <td className="toilet-num">{rateText}</td>
                    <td className="toilet-num">{fmtAccounting(amount)}</td>
                  </>
                ) : (
                  <>
                    <td></td><td></td><td></td><td></td>
                  </>
                )}
              </tr>
            );
          })}

          {totalsRow('Subtotal', fmtAccounting(sub), template.amountBold?.sub, false)}
          {totalsRow('18% GST', fmtAccounting(gstAmt), template.amountBold?.gst, false)}
          {totalsRow('Total', fmtAccounting(tot), template.amountBold?.total, totalFromA)}
        </tbody>
      </table>

      <div className="q-notes toilet-notes">
        <span className="toilet-notes-title">Note:</span>
        <ol>
          {displayNotes.map((note, i) => {
            // A charge note is replaced by a run list; everything else stays
            // the original single run object (with its optional Excel size).
            const runs = Array.isArray(note) ? note : [note];
            const sz = Array.isArray(note) ? undefined : note.sz;
            return (
              <li
                key={i}
                // Excel note 7 is set in 18pt while notes 1-6 are 20pt.
                style={sz ? { fontSize: `${(sz * 0.85).toFixed(1)}px` } : undefined}
              >
                {renderRuns(runs, `n${i}`)}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Excel A34:E40 — the bank-details image after the notes (the Excel
          stores the bank block as a picture, not as cells) */}
      <img src={companyDetails.toiletBank} alt="Company`s Bank Details" className="toilet-bank" />
    </div>
  );
}
