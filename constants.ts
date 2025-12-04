import { CategoryType, CategoryData } from './types';
import { Shield, ShoppingBag, PiggyBank, Heart } from 'lucide-react';

export const CATEGORIES: Record<CategoryType, CategoryData> = {
  [CategoryType.NEEDS]: {
    type: CategoryType.NEEDS,
    label: 'Nutné výdaje',
    percentage: 0.40,
    color: '#3b82f6', // blue-500
    description: 'Bydlení, jídlo, doprava, poplatky (40%)',
    iconName: 'Shield'
  },
  [CategoryType.WANTS]: {
    type: CategoryType.WANTS,
    label: 'Osobní radosti',
    percentage: 0.30,
    color: '#8b5cf6', // violet-500
    description: 'Zábava, cestování, koníčky, restaurace (30%)',
    iconName: 'ShoppingBag'
  },
  [CategoryType.SAVINGS]: {
    type: CategoryType.SAVINGS,
    label: 'Úspory a investice',
    percentage: 0.20,
    color: '#10b981', // emerald-500
    description: 'Rezerva, penzijní, akcie, splácení dluhů (20%)',
    iconName: 'PiggyBank'
  },
  [CategoryType.GIVING]: {
    type: CategoryType.GIVING,
    label: 'Dary a charita',
    percentage: 0.10,
    color: '#f43f5e', // rose-500
    description: 'Dárky, charita, pomoc ostatním (10%)',
    iconName: 'Heart'
  }
};

export const DEFAULT_CURRENCY = 'CZK';
