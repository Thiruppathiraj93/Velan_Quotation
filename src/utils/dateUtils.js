export function parseDisplayDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

export function toDisplayDate(d) {
  if (!d || isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function addDays(display, days) {
  const d = parseDisplayDate(display);
  if (!d) return '';
  d.setDate(d.getDate() + days);
  return toDisplayDate(d);
}

export function todayDisplay() {
  return toDisplayDate(new Date());
}

export function toISODate(display) {
  const m = String(display || '').match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function fromISODate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}.${m}.${y}`;
}
