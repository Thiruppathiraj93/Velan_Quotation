import React from 'react';
import ProductSelection from '../components/ProductSelection';
import CapacitySelector from '../components/CapacitySelector';

export default function ProductSelectionPage({ step, product, onSelectProduct, onSelectCapacity, onBack }) {
  if (step === 'capacity') {
    return <CapacitySelector product={product} onSelect={onSelectCapacity} onBack={onBack} />;
  }
  return <ProductSelection onSelect={onSelectProduct} />;
}
