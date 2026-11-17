import React from 'react';
import { useQuotation } from '../context/QuotationContext';

export default function RoomDetails() {
  const { form, update, setRate } = useQuotation();
  return (
    <section className="card">
      <h2>Room Details</h2>
      <label>
        Rate
        <input type="number" step="0.01" value={form.rate ?? ''} onChange={(e) => setRate(e.target.value)} />
      </label>
      <label>
        Nos
        <input type="number" step="0.01" value={form.nos ?? ''} onChange={(e) => update({ nos: e.target.value })} />
      </label>
      <label>
        Transportation Charge
        <input
          type="text"
          value={form.transportation ?? ''}
          onChange={(e) => update({ transportation: e.target.value })}
          placeholder="e.g. 12000"
        />
      </label>
      <label>
        Crane Charge
        <input
          type="text"
          value={form.crane ?? ''}
          onChange={(e) => update({ crane: e.target.value })}
          placeholder="e.g. 12000"
        />
      </label>
    </section>
  );
}
