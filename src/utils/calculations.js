export function itemAmount(qty, rate, nos) {
  return (Number(qty) || 0) * (Number(rate) || 0) * (Number(nos) || 0);
}

export function subTotal(amounts) {
  return amounts.reduce((s, a) => s + (Number(a) || 0), 0);
}

export function gst(sub) {
  return sub * 0.18;
}

export function total(sub, g) {
  return sub + g;
}
