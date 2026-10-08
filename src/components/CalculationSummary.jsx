import React from 'react';
import { useQuotation } from '../context/QuotationContext';
import { toFixed2 } from '../utils/numberFormat';

export default function CalculationSummary() {
  const { amount, sub, gstAmt, tot } = useQuotation();
  return (
    <section className="card">
      <h2>Calculation Summary</h2>
      <div className="row"><span>Amount</span><b>{toFixed2(amount)}</b></div>
      <div className="row"><span>Sub Total</span><b>{toFixed2(sub)}</b></div>
      <div className="row"><span>GST 18%</span><b>{toFixed2(gstAmt)}</b></div>
      <div className="row total"><span>Total</span><b>{toFixed2(tot)}</b></div>
    </section>
  );
}
