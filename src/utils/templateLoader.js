import waterTankTemplates from '../data/waterTankTemplates';
import septicTankTemplates from '../data/septicTankTemplates';

export function getTemplates(product) {
  return product === 'Water Tank' ? waterTankTemplates : septicTankTemplates;
}

export function getTemplate(product, capacity) {
  return getTemplates(product).find((t) => t.capacity === capacity) || null;
}
