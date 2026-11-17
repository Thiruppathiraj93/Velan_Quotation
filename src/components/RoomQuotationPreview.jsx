import React from 'react';
import { useQuotation } from '../context/QuotationContext';
import companyDetails from '../data/companyDetails';
import { toFixed2 } from '../utils/numberFormat';
import { deriveCharge, chargeRuns } from '../utils/roomCharges';
import '../styles/room-preview.css';

// One formatted text run from the Room Excel cells (bold / colour / underline).
function runStyle(run) {
  const style = {};
  if (run.b) style.fontWeight = 'bold';
  if (run.c) style.color = run.c;
  if (run.u) style.textDecoration = 'underline';
  return style;
}

function renderRuns(runs, keyPrefix) {
  return (runs || []).map((run, i) => (
    <span key={`${keyPrefix}-${i}`} style={runStyle(run)}>
      {run.t}
    </span>
  ));
}

export default function RoomQuotationPreview() {
  const { template, form, expiryDate, amount, sub, gstAmt, tot } = useQuotation();
  if (!template) return null;

  const notes = template.notes || [];
  const bank = template.bank || [];

  // Notes 5/6 (Transportation / Erection crane) reflect the editable charge
  // inputs; an empty input keeps the original Excel note verbatim.
  const transportCharge = deriveCharge(template, 'transportation');
  const craneCharge = deriveCharge(template, 'crane');
  const displayNotes = notes.map((runs, i) => {
    if (transportCharge && i === transportCharge.index) {
      return chargeRuns(transportCharge, form.transportation) || runs;
    }
    if (craneCharge && i === craneCharge.index) {
      return chargeRuns(craneCharge, form.crane) || runs;
    }
    return runs;
  });

  // The Excel item cell stores "Room 1" + a long padding-space run + dimensions.
  // The padding is rendered as layout (label left, dimensions right).
  const itemParts = String(template.itemText || '').split(/\s{2,}/);
  const itemLabel = (itemParts[0] || '').trim();
  const itemDims = (itemParts[1] || '').trim();

  return (
    <div id="quotationPdf" className="quotation-page room-page">
      <img src={companyDetails.header} alt="Velan Concast" className="q-header" />
      <h1 className="q-title">Quotation</h1>

      <div className="q-info room-info">
        <div className="q-info-left room-info-left">
          <div className="q-field"><span className="q-label">Bill to</span><span className="q-colon">:</span><span className="q-val">{form.billTo}</span></div>
          <div className="q-field"><span className="q-label">Ship to</span><span className="q-colon">:</span><span className="q-val">{form.shipTo}</span></div>
        </div>
        <div className="q-info-right">
          <div className="q-field"><span className="q-label">Quote No</span><span className="q-colon">:</span><span className="q-val">{form.quoteNo}</span></div>
          <div className="q-field"><span className="q-label">Quote Given By</span><span className="q-colon">:</span><span className="q-val">{form.quoteGivenBy}</span></div>
          <div className="q-field"><span className="q-label">Quote Date</span><span className="q-colon">:</span><span className="q-val">{form.quoteDate}</span></div>
          <div className="q-field"><span className="q-label">Expiry Date</span><span className="q-colon">:</span><span className="q-val">{expiryDate}</span></div>
          <div className="q-field"><span className="q-label">Customer Number</span><span className="q-colon">:</span><span className="q-val">{form.customerNumber}</span></div>
        </div>
      </div>

      {/* Room table: S.No | Description of work | Rate | nos | Amount */}
      <table className="q-table room-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Description of work</th>
            <th>Rate</th>
            <th>nos</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td className="q-desc room-desc">
              {renderRuns(template.generalDesc, 'd')}
            </td>
            <td></td><td></td><td></td>
          </tr>
          <tr className="room-item-row">
            <td>1</td>
            <td className="room-item">
              <span className="room-item-label">{itemLabel}</span>
              <span className="room-item-dims">{itemDims}</span>
            </td>
            <td>{toFixed2(form.rate)}</td>
            <td>{toFixed2(form.nos)}</td>
            <td>{toFixed2(amount)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="q-sub">Sub Total</td>
            <td>{toFixed2(sub)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="q-sub">GST 18%</td>
            <td>{toFixed2(gstAmt)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="q-sub">Total</td>
            <td>{toFixed2(tot)}</td>
          </tr>
        </tbody>
      </table>

      <div className="q-notes room-notes">
        <span className="room-notes-title">Notes:</span>
        <ol>
          {displayNotes.map((runs, i) => (
            <li key={i}>
              {renderRuns(Array.isArray(runs) ? runs : [{ t: String(runs) }], `n${i}`)}
            </li>
          ))}
        </ol>
      </div>

      <div className="q-bank room-bank">
        <div className="room-bank-title">{template.bankTitle || 'Company`s Bank Details'}</div>
        {bank.map((b, i) => (
          <div key={i}>{b}</div>
        ))}
      </div>
    </div>
  );
}
