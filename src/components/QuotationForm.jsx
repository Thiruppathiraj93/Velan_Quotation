import React from 'react';
import CustomerDetails from './CustomerDetails';
import QuoteDetails from './QuoteDetails';
import TankDetails from './TankDetails';
import ChargesDetails from './ChargesDetails';
import CalculationSummary from './CalculationSummary';
import RoomDetails from './RoomDetails';
import ToiletDetails from './ToiletDetails';
import { useQuotation } from '../context/QuotationContext';

export default function QuotationForm() {
  const { product } = useQuotation();

  // Room / Toilet quotations: Bill To / Ship To, quote details, Rate & Nos,
  // editable transport/crane charges and totals. Tank capacity inputs do
  // not apply to them.
  if (product === 'Room' || product === 'Toilet') {
    return (
      <div className="form-grid">
        <CustomerDetails />
        <QuoteDetails />
        {product === 'Room' ? <RoomDetails /> : <ToiletDetails />}
        <CalculationSummary />
      </div>
    );
  }

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
