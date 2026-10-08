import React from 'react';
import QuotationForm from '../components/QuotationForm';
import QuotationPreview from '../components/QuotationPreview';
import PdfButton from '../components/PdfButton';
import { useQuotation } from '../context/QuotationContext';

export default function QuotationPage({ onChangeTemplate }) {
  const { clearDraft, restoreDraft, saveDraft, template, product } = useQuotation();
  return (
    <div className="page">
      <div className="page-header">
        <h1>{product} — {template?.capacity}</h1>
        <div className="actions">
          <button className="link-btn" onClick={onChangeTemplate}>← Change Template</button>
          <button className="link-btn" onClick={() => saveDraft()}>Save Draft</button>
          <button className="link-btn" onClick={() => restoreDraft()}>Restore Draft</button>
          <button className="link-btn" onClick={() => clearDraft()}>Clear Draft</button>
        </div>
      </div>
      <div className="split">
        <div className="left">
          <QuotationForm />
          <div className="actions">
            <button className="primary-btn" onClick={() => document.getElementById('quotationPdf')?.scrollIntoView({ behavior: 'smooth' })}>Preview</button>
            <PdfButton />
          </div>
        </div>
        <div className="right">
          <h2 className="preview-title">Live Preview</h2>
          <QuotationPreview />
        </div>
      </div>
    </div>
  );
}
