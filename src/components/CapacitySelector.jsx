import React from 'react';
import { getTemplates } from '../utils/templateLoader';
import '../styles/selection.css';

export default function CapacitySelector({ product, onSelect, onBack }) {
  const list = getTemplates(product);
  return (
    <div className="selection">
      <h1>{product.toUpperCase()}</h1>
      <p>Select {product} Capacity</p>
      <select className="capacity-select" onChange={(e) => e.target.value && onSelect(e.target.value)} defaultValue="">
        <option value="" disabled>Select Capacity ▼</option>
        {list.map((t) => (
          <option key={t.id} value={t.capacity}>{t.capacity}</option>
        ))}
      </select>
      <button className="link-btn" onClick={onBack}>← Back</button>
    </div>
  );
}
