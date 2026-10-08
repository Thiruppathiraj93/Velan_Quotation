import React from 'react';
import { useQuotation } from '../context/QuotationContext';
import { toISODate, fromISODate, todayDisplay } from '../utils/dateUtils';

export default function QuoteDetails() {
  const { form, update, expiryDate } = useQuotation();
  return (
    <section className="card">
      <h2>Quote Details</h2>
      <label>
        Quote No
        <input type="text" value={form.quoteNo || ''} onChange={(e) => update({ quoteNo: e.target.value })} />
      </label>
      <label>
        Quote Given By
        <input type="text" value={form.quoteGivenBy || ''} onChange={(e) => update({ quoteGivenBy: e.target.value })} />
      </label>
      <label>
        Quote Date (DD.MM.YYYY)
        <input
          type="date"
          value={toISODate(form.quoteDate) || toISODate(todayDisplay())}
          onChange={(e) => update({ quoteDate: fromISODate(e.target.value) })}
        />
        <span className="hint">{form.quoteDate || todayDisplay()}</span>
      </label>
      <label>
        Expiry Date
        <input type="text" value={expiryDate} readOnly />
      </label>
    </section>
  );
}
