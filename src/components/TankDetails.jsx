import React from 'react';
import { useQuotation } from '../context/QuotationContext';

export default function TankDetails() {
  const { form, update, setRate, setTankCapacity } = useQuotation();
  return (
    <section className="card">
      <h2>Tank Details</h2>
      <label>
        Tank Capacity (Qty)
        <input type="number" value={form.qty} onChange={(e) => setTankCapacity(e.target.value)} />
      </label>
      <label>
        Rate
        <input type="number" step="0.01" value={form.rate} onChange={(e) => setRate(e.target.value)} />
      </label>
      <label>
        Nos
        <input type="number" step="0.01" value={form.nos} onChange={(e) => update({ nos: e.target.value })} />
      </label>
    </section>
  );
}
