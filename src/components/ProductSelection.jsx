import React from 'react';
import companyDetails from '../data/companyDetails';
import '../styles/selection.css';

export default function ProductSelection({ onSelect }) {
  return (
    <div className="selection">
      <img src={companyDetails.logo} alt="Velan Concast" className="selection-logo" />
      <h1>VELAN CONCAST</h1>
      <p>What do you want to create?</p>
      <button className="big-btn" onClick={() => onSelect('Water Tank')}>WATER TANK</button>
      <button className="big-btn" onClick={() => onSelect('Septic Tank')}>SEPTIC TANK</button>
    </div>
  );
}
