export enum CategoryType {
  NEEDS = 'NEEDS',       // 40%
  WANTS = 'WANTS',       // 30%
  SAVINGS = 'SAVINGS',   // 20%
  GIVING = 'GIVING'      // 10%
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: CategoryType;
  date: string;
  isRecurring?: boolean;
}

export interface BudgetConfig {
  income: number;
  currency: string;
}

export interface CategoryData {
  type: CategoryType;
  label: string;
  percentage: number;
  color: string;
  description: string;
  iconName: string;
}

export interface AnalysisResult {
  advice: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
}