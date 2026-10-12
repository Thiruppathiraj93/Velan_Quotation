
import React, { useState } from 'react';
import Home from './pages/Home';
import ProductSelectionPage from './pages/ProductSelectionPage';
import QuotationPage from './pages/QuotationPage';
import { QuotationProvider, useQuotation } from './context/QuotationContext';
import { getTemplate } from './utils/templateLoader';

function Shell() {
  const [screen, setScreen] = useState('splash');
  const [step, setStep] = useState('product');

  const {
    setProduct,
    applyTemplate,
    product,
    setSelectedSpecification,
  } = useQuotation();

  if (screen === 'splash') {
    return (
      <Home
        onDone={() => {
          try {
            const d = JSON.parse(
              localStorage.getItem('velanQuotationDraft') || 'null'
            );

            setScreen(
              d && d.product && d.templateId ? 'editor' : 'select'
            );
          } catch {
            setScreen('select');
          }
        }}
      />
    );
  }

  if (screen === 'select') {
    return (
      <ProductSelectionPage
        step={step}
        product={product}
        onSelectProduct={(p) => {
          setProduct(p);
          setSelectedSpecification('');
          setStep('capacity');
        }}
        onSelectCapacity={({ capacity, specification }) => {
          const t = getTemplate(product, capacity);

          if (t) {
            setSelectedSpecification(specification || '');
            applyTemplate(t);
            setScreen('editor');
          }
        }}
        onBack={() => setStep('product')}
      />
    );
  }

  return (
    <QuotationPage
      onChangeTemplate={() => {
        setScreen('select');
        setStep('capacity');
      }}
    />
  );
}

export default function App() {
  return (
    <QuotationProvider>
      <Shell />
    </QuotationProvider>
  );
}
