import React from 'react';
import { useQuotation } from '../context/QuotationContext';

export default function CustomerDetails() {
  const { form, update } = useQuotation();
  return (
    <section className="card">
      <h2>Customer Details</h2>
      <label>
        Bill To
        <textarea value={form.billTo || ''} onChange={(e) => update({ billTo: e.target.value })} rows={3} />
      </label>
      <label>
        Ship To
        <input type="text" value={form.shipTo || ''} onChange={(e) => update({ shipTo: e.target.value })} />
      </label>
      <label>
        Customer Number
        <input type="text" value={form.customerNumber || ''} onChange={(e) => update({ customerNumber: e.target.value })} />
      </label>
    </section>
  );
}
