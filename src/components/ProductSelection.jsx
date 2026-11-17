import React from 'react';
import companyDetails from '../data/companyDetails';
import { products } from '../data/products';
import '../styles/selection.css';

export default function ProductSelection({ onSelect }) {
  return (
    <div className="selection">
      <img src={companyDetails.logo} alt="Velan Concast" className="selection-logo" />
      <h1>VELAN CONCAST</h1>
      <p>What do you want to create?</p>

      <div className="product-grid">
        {products.map((product) => (
          <button
            key={product.name}
            type="button"
            className={`product-card${product.comingSoon ? ' product-card--soon' : ''}`}
            disabled={Boolean(product.comingSoon)}
            onClick={() => !product.comingSoon && onSelect(product.name)}
          >
            <span className="product-card-image">
              <img src={product.image} alt={product.name} />
            </span>
            <span className="product-card-name">{product.name}</span>
            {product.comingSoon && (
              <span className="product-card-soon">Coming Soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
