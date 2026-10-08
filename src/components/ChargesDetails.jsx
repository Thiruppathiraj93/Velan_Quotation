import React from 'react';
import { useQuotation } from '../context/QuotationContext';

export default function ChargesDetails() {
  const { form, update } = useQuotation();
  return (
    <section className="card">
      <h2>Charges</h2>

      <label>Transportation Charge</label>
      <div className="charge-row">
        <input type="text" value={form.transportation || ''} onChange={(e) => update({ transportation: e.target.value })} placeholder="e.g. 26000" />
        <div className="charge-options">
          <label className="option-red">
            <input type="radio" name="transportMode" checked={form.transportationMode !== 'client'} onChange={() => update({ transportationMode: 'direct' })} />
            Pay to Direct Party
          </label>
          <label className="option-red">
            <input type="radio" name="transportMode" checked={form.transportationMode === 'client'} onChange={() => update({ transportationMode: 'client' })} />
            Client Scope
          </label>
        </div>
      </div>

      <label>Crane Charge</label>
      <div className="charge-row">
        <input type="text" value={form.crane || ''} onChange={(e) => update({ crane: e.target.value })} placeholder="e.g. 10000" />
        <div className="charge-options">
          <label className="option-red">
            <input type="radio" name="craneMode" checked={form.craneMode !== 'client'} onChange={() => update({ craneMode: 'direct' })} />
            Pay to Direct Party
          </label>
          <label className="option-red">
            <input type="radio" name="craneMode" checked={form.craneMode === 'client'} onChange={() => update({ craneMode: 'client' })} />
            Client Scope
          </label>
        </div>
      </div>

      <div className="charge-options" style={{ marginTop: '10px' }}>
        <label className="option-red">
          <input type="checkbox" checked={!!form.coreCutCharges} onChange={(e) => update({ coreCutCharges: e.target.checked })} />
          Core Cut Charges
        </label>
      </div>
      {form.coreCutCharges && (
        <div>
          <label>Core Cut Charges Amount</label>
          <div className="charge-row">
            <input type="text" value={form.coreCutChargeValue || ''} onChange={(e) => update({ coreCutChargeValue: e.target.value })} placeholder="e.g. 5000" />
            <div className="charge-options">
              <label className="option-red">
                <input type="radio" name="coreCutMode" checked={form.coreCutChargeMode !== 'client'} onChange={() => update({ coreCutChargeMode: 'direct' })} />
                Pay to Direct Party
              </label>
              <label className="option-red">
                <input type="radio" name="coreCutMode" checked={form.coreCutChargeMode === 'client'} onChange={() => update({ coreCutChargeMode: 'client' })} />
                Client Scope
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
