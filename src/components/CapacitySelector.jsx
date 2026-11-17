
import React, { useState } from 'react';
import { getTemplates } from '../utils/templateLoader';
import { specifications } from '../data/specification';
import { getProductConfig } from '../data/products';
import '../styles/selection.css';

export default function CapacitySelector({
  product,
  onSelect,
  onBack,
}) {
  const list = getTemplates(product) || [];

  const [capacity, setCapacity] = useState('');
  const [specification, setSpecification] = useState('');

  const isWaterTank = product === 'Water Tank';
  const isRoom = product === 'Room';
  const isToilet = product === 'Toilet';
  // Room and Toilet attach their matching spec PDF automatically from the
  // selected size/type (there is no specification dropdown for them).
  const isAutoSpec = isRoom || isToilet;

  const specList = isAutoSpec
    ? isRoom
      ? specifications.room
      : specifications.toilet
    : isWaterTank
      ? specifications.waterTank
      : specifications.septicTank;

  // Extract capacity number, for example "10450 Lit" -> "10450"
  const capacityNumber = String(capacity).match(/\d+/)?.[0] || '';

  // Match quotation capacity with its corresponding specification capacity.
  // Room sizes and Toilet variants match their specification exactly
  // (no mapping needed).
  const specCapacityMap = isAutoSpec
    ? {}
    : isWaterTank
      ? {
          '6100': '6100',
          '8400': '8400',
          '10450': '10000',
          '11550': '11550',
          '15300': '15300',
          '20000': '20000',
          '26434': '26000',
          '34000': '34000',
          '50602': '50000',
        }
      : {
          '6100': '6100',
          '8400': '8400',
          '11550': '11500',
          '15300': '15300',
          '26400': '',
          '34000': '34000',
        };

  const targetSpecCapacity = isAutoSpec
    ? capacity
    : specCapacityMap[capacityNumber] ?? capacityNumber;

  // Only show specifications that match the selected capacity.
  const matchingSpecs = capacity && targetSpecCapacity
    ? specList.filter(
        (spec) =>
          String(spec.capacity).trim() ===
          String(targetSpecCapacity).trim()
      )
    : [];

  const handleCapacityChange = (e) => {
    setCapacity(e.target.value);
    setSpecification('');
  };

  const handleContinue = () => {
    if (!capacity) {
      alert(
        isToilet
          ? 'Please select a type.'
          : isRoom
            ? 'Please select a size.'
            : 'Please select a capacity.'
      );
      return;
    }

    // Room / Toilet: the matching specification is attached automatically
    // from the selected size or type (no specification dropdown).
    if (isAutoSpec) {
      const matchedSpec = specList.find(
        (spec) =>
          String(spec.capacity).trim() === String(capacity).trim()
      );
      onSelect({
        capacity,
        specification: matchedSpec ? matchedSpec.file : '',
      });
      return;
    }

    const selectedSpec = matchingSpecs.find(
      (spec) => spec.file === specification
    );

    onSelect({
      capacity,
      specification: selectedSpec ? selectedSpec.file : '',
    });
  };

  return (
    <div className="selection">
      <h1>{product?.toUpperCase() || 'SELECT PRODUCT'}</h1>

      <p>
        {isToilet
          ? `Select ${product} Type`
          : isRoom
            ? `Select ${product} Size`
            : `Select ${product} Capacity`}
      </p>

      {/* Capacity dropdown */}
      <select
        className="capacity-select"
        value={capacity}
        onChange={handleCapacityChange}
      >
        <option value="">
          {isToilet
            ? 'Select Type ▼'
            : isRoom
              ? 'Select Size ▼'
              : 'Select Capacity ▼'}
        </option>

        {list.map((template) => (
          <option
            key={template.id ?? template.capacity}
            value={template.capacity}
          >
            {template.capacity}
          </option>
        ))}
      </select>

      {/* Specification dropdown (not shown for Room / Toilet: attached automatically) */}
      {!isAutoSpec && (
        <>
          <p>Select Specification PDF</p>

          <select
            className="capacity-select"
            value={specification}
            disabled={!capacity || matchingSpecs.length === 0}
            onChange={(e) => setSpecification(e.target.value)}
          >
            <option value="">No specification PDF</option>

            {matchingSpecs.map((spec) => (
              <option key={spec.file} value={spec.file}>
                {spec.label}
              </option>
            ))}
          </select>
        </>
      )}

      {!isAutoSpec && capacity && matchingSpecs.length === 0 && (
        <p>
          Matching specification not available. You can still
          generate the quotation without a specification.
        </p>
      )}

      <button
        className="primary-btn"
        onClick={handleContinue}
        disabled={!capacity}
      >
        Continue →
      </button>

      <button className="link-btn" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
