import React, { useState } from 'react';
import generateQuotationPdf from '../pdf/generateQuotationPdf';
import { useQuotation } from '../context/QuotationContext';

export default function PdfButton() {
  const { form } = useQuotation();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try { await generateQuotationPdf(form.quoteNo); } finally { setBusy(false); }
  };
  return <button className="primary-btn" onClick={onClick} disabled={busy}>{busy ? 'Generating…' : 'Generate PDF'}</button>;
}
