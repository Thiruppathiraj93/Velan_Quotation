import React, { useState } from 'react';
import Home from './pages/Home';
import ProductSelectionPage from './pages/ProductSelectionPage';
import QuotationPage from './pages/QuotationPage';
import { QuotationProvider, useQuotation } from './context/QuotationContext';
import { getTemplate } from './utils/templateLoader';

function Shell() {
  const [screen, setScreen] = useState('splash');
  const [step, setStep] = useState('product'); // product | capacity
  const { setProduct, applyTemplate, product } = useQuotation();

  if (screen === 'splash') {
    return <Home onDone={() => {
      try {
        const d = JSON.parse(localStorage.getItem('velanQuotationDraft') || 'null');
        setScreen(d && d.product && d.templateId ? 'editor' : 'select');
      } catch { setScreen('select'); }
    }} />;
  }

  if (screen === 'select') {
    return (
      <ProductSelectionPage
        step={step}
        product={product}
        onSelectProduct={(p) => { setProduct(p); setStep('capacity'); }}
        onSelectCapacity={(cap) => {
          const t = getTemplate(product, cap);
          if (t) { applyTemplate(t); setScreen('editor'); }
        }}
        onBack={() => setStep('product')}
      />
    );
  }

  return <QuotationPage onChangeTemplate={() => { setScreen('select'); setStep('capacity'); }} />;
}

export default function App() {
  return (
    <QuotationProvider>
      <Shell />
    </QuotationProvider>
  );
}
