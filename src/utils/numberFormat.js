export function toFixed2(n) {
  const v = Number(n);
  return isNaN(v) ? '0.00' : v.toFixed(2);
}

export function formatCommas(v) {
  const num = String(v).replace(/[^0-9.]/g, '');
  if (!num) return '';
  const [int, dec] = num.split('.');
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${g}.${dec}` : g;
}

export function num(v) {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
