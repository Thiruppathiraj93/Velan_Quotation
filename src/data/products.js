// Product registry that drives the product selection cards, quotation expiry,
// calculation mode and per-product branching throughout the app.
export const products = [
  {
    name: 'Water Tank',
    image: '/products/water-tank.webp',
    specKey: 'waterTank',
    expiryDays: 10,
    calcMode: 'qtyRateNos',
  },
  {
    name: 'Septic Tank',
    image: '/products/septic-tank.webp',
    specKey: 'septicTank',
    expiryDays: 10,
    calcMode: 'qtyRateNos',
  },
  {
    name: 'Room',
    image: '/products/room.webp',
    specKey: 'room',
    expiryDays: 20,
    calcMode: 'rateNos',
  },
  {
    name: 'Toilet',
    image: '/products/toilet.webp',
    specKey: 'toilet',
    expiryDays: 10,
    calcMode: 'rateNos',
  },
];

export function getProductConfig(name) {
  return products.find((p) => p.name === name) || null;
}
