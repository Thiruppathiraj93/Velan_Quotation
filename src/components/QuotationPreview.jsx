import React from 'react';
import { useQuotation } from '../context/QuotationContext';
import companyDetails from '../data/companyDetails';
import { toFixed2 } from '../utils/numberFormat';

export default function QuotationPreview() {
  const {
    template, form, expiryDate, capacityDisplayText,
    amount, sub, gstAmt, tot, transportLine, craneLine,
  } = useQuotation();
  if (!template) return null;

  const notes = template.notes;

  return (
    <div id="quotationPdf" className="quotation-page">
      <img src={companyDetails.header} alt="Velan Concast" className="q-header" />
      <h1 className="q-title">Quotation</h1>
      <div className="q-info">
        <div className="q-info-left">
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

      <table className="q-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Description of work</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Nos</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td className="q-desc">
              {String(template.generalDesc || '').split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {/^\s*\d+\.\s+(General|Construction|Materials|Features)/i.test(line) ? (
                    <span className="q-heading-red">{line}</span>
                  ) : (
                    line
                  )}
                  {i < String(template.generalDesc || '').split('\n').length - 1 ? '\n' : null}
                </React.Fragment>
              ))}
            </td>
            <td></td><td></td><td></td><td></td>
          </tr>
          <tr className="q-cap-row">
            <td>1.1</td>
            <td>{capacityDisplayText}</td>
            <td>{form.qty}</td>
            <td>{form.rate}</td>
            <td>{form.nos}</td>
            <td>{toFixed2(amount)}</td>
          </tr>
          <tr>
            <td colSpan={4} rowSpan={1} className="q-sub">Sub Total</td>
            <td></td>
            <td>{toFixed2(sub)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="q-sub">GST 18%</td>
            <td></td>
            <td>{toFixed2(gstAmt)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="q-sub">Total</td>
            <td></td>
            <td>{toFixed2(tot)}</td>
          </tr>
        </tbody>
      </table>

      <div className="q-notes">
        <b>Notes:</b>
        <ol>
          {renderNotes(notes, transportLine, craneLine, form.coreCutCharges, form.coreCutChargeValue, form.coreCutChargeMode)}
        </ol>
      </div>

      <div className="q-bank">
        <b>Company`s Bank Details</b>
        {template.bank.map((b, i) => <div key={i}>{b}</div>)}
      </div>
    </div>
  );
}

function renderNotes(notes, transportLine, craneLine, coreCutCharges, coreCutChargeValue, coreCutChargeMode) {
  // notes array excludes transportation/crane; original order: transport & crane sit between
  // water/electricity note and "All disputes" note in original templates
  const items = [];
  for (const n of notes) {
    items.push({ text: n });
    if (/water and electricity/i.test(n)) {
      items.push({ text: `Transportation – ${transportLine}` });
      items.push({ text: `Crane for unloading and erection – ${craneLine}` });
      if (coreCutCharges) {
        items.push({ text: `Core Cut Charges – ${coreCutChargeMode === 'client' ? 'Client Scope.' : (coreCutChargeValue ? coreCutChargeValue + '/--Pay to direct party.' : '0')}` });
      }
    }
  }
  return items.map((it, i) => {
    const num = i + 1;
    const isRed = num >= 4 && num <= 6;
    return (
      <li key={i} style={isRed ? { color: '#c00000', fontWeight: 'bold' } : undefined}>
        {it.text}
      </li>
    );
  });
}
