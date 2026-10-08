import React from 'react';
import CustomerDetails from './CustomerDetails';
import QuoteDetails from './QuoteDetails';
import TankDetails from './TankDetails';
import ChargesDetails from './ChargesDetails';
import CalculationSummary from './CalculationSummary';

export default function QuotationForm() {
  return (
    <div className="form-grid">
      <CustomerDetails />
      <QuoteDetails />
      <TankDetails />
      <ChargesDetails />
      <CalculationSummary />
    </div>
  );
}
