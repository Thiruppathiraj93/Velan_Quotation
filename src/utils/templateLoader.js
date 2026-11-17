import waterTankTemplates from '../data/waterTankTemplates';
import septicTankTemplates from '../data/septicTankTemplates';
import roomTemplates from '../data/roomTemplates';
import toiletTemplates from '../data/toiletTemplates';

const templatesByProduct = {
  'Water Tank': waterTankTemplates,
  'Septic Tank': septicTankTemplates,
  'Room': roomTemplates,
  'Toilet': toiletTemplates,
};

export function getTemplates(product) {
  return templatesByProduct[product] || [];
}

export function getTemplate(product, capacity) {
  return getTemplates(product).find((t) => t.capacity === capacity) || null;
}
