import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Legend } from 'recharts';
import { CategoryType, Expense } from '../types';
import { CATEGORIES } from '../constants';
import { Shield, ShoppingBag, PiggyBank, Heart, ChevronLeft, ChevronRight, TrendingUp, X, Search } from 'lucide-react';

interface DashboardProps {
  income: number;
  initialSavings: number;
  currentMonthExpenses: Expense[];
  allExpenses: Expense[];
  currency: string;
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  getIncomeForMonth: (monthKey: string) => number;
}

// Colors for the drill-down pie chart
const DETAIL_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#6366f1', '#ec4899', '#14b8a6'];

const Dashboard: React.FC<DashboardProps> = ({ 
  income, 
  initialSavings,
  currentMonthExpenses, 
  allExpenses,
  currency, 
  currentDate,
  onPrevMonth,
  onNextMonth,
  getIncomeForMonth
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null);
  
  // Calculate totals per category for CURRENT MONTH
  const categoryTotals = currentMonthExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<CategoryType, number>);

  const totalSpent = (Object.values(categoryTotals) as number[]).reduce((a, b) => a + b, 0);
  const remaining = income - totalSpent;

  // Prepare data for Pie Chart
  const pieData = Object.values(CATEGORIES).map(cat => ({
    name: cat.label,
    value: categoryTotals[cat.type] || 0,
    color: cat.color,
    type: cat.type
  })).filter(d => d.value > 0);

  // Prepare data for Bar Chart (Plan vs Reality)
  const barData = Object.values(CATEGORIES).map(cat => ({
    name: cat.label,
    cíl: income * cat.percentage,
    realita: categoryTotals[cat.type] || 0,
    type: cat.type
  }));

  // Calculate Accumulation History
  const expensesByMonth = allExpenses.reduce((acc, curr) => {
    const monthKey = curr.date.substring(0, 7); // YYYY-MM
    acc[monthKey] = (acc[monthKey] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  // Get all unique month keys from expenses + potentially current date if not yet there
  const allMonths = new Set(Object.keys(expensesByMonth));
  allMonths.add(currentDate.toISOString().substring(0, 7));
  const sortedMonths = Array.from(allMonths).sort();

  const trendData = sortedMonths.map(monthKey => {
    const expenses = expensesByMonth[monthKey] || 0;
    const monthIncome = getIncomeForMonth(monthKey);
    const savings = monthIncome - expenses; 
    return {
      date: monthKey,
      savings: savings,
      expenses: expenses,
      income: monthIncome
    };
  });

  let cumulative = initialSavings;
  const accumulationData = trendData.map(d => {
    cumulative += d.savings;
    return {
      ...d,
      cumulative: cumulative
    };
  });

  // --- Drill Down Logic ---
  const getCategoryDetailData = (catType: CategoryType) => {
    const expensesInCategory = currentMonthExpenses.filter(e => e.category === catType);
    
    // Group by description
    const grouped = expensesInCategory.reduce((acc, curr) => {
      // Normalize description (trim, maybe lowercase if needed, but keeping exact for now)
      const desc = curr.description.trim();
      acc[desc] = (acc[desc] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort by value desc
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value);
  };

  const renderCategoryDetailModal = () => {
    if (!selectedCategory) return null;

    const catConfig = CATEGORIES[selectedCategory];
    const detailData = getCategoryDetailData(selectedCategory);
    const totalInCategory = detailData.reduce((sum, item) => sum + item.value, 0);

    // Prepare data for chart (limit to top 6 + others)
    const topItems = detailData.slice(0, 6);
    const otherItems = detailData.slice(6);
    const otherTotal = otherItems.reduce((sum, item) => sum + item.value, 0);
    
    const chartData = [...topItems];
    if (otherTotal > 0) {
      chartData.push({ name: 'Ostatní', value: otherTotal });
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedCategory(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
          
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-center" style={{ backgroundColor: catConfig.color + '10' }}>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl text-white shadow-sm" style={{ backgroundColor: catConfig.color }}>
                {getIcon(catConfig.type)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{catConfig.label}</h2>
                <p className="text-sm text-slate-500">Detail výdajů v tomto měsíci</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedCategory(null)}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {detailData.length === 0 ? (
               <div className="text-center py-10 text-slate-400">
                 <Search size={48} className="mx-auto mb-4 opacity-50" />
                 <p>Žádné výdaje v této kategorii pro vybraný měsíc.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Chart Side */}
                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-4">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DETAIL_COLORS[index % DETAIL_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number) => [`${value.toLocaleString()} ${currency}`, '']}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center mt-2">
                    <p className="text-sm text-slate-500">Celkem v kategorii</p>
                    <p className="text-2xl font-bold text-slate-800">{totalInCategory.toLocaleString()} <span className="text-sm font-normal text-slate-400">{currency}</span></p>
                  </div>
                </div>

                {/* List Side */}
                <div>
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                    Top výdaje
                    <span className="ml-2 text-xs font-normal bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                      {detailData.length} položek
                    </span>
                  </h3>
                  <div className="space-y-3 pr-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {detailData.map((item, index) => {
                      const percent = (item.value / totalInCategory) * 100;
                      return (
                        <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100 group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              className="w-2 h-8 rounded-full shrink-0" 
                              style={{ backgroundColor: index < chartData.length ? DETAIL_COLORS[index % DETAIL_COLORS.length] : '#cbd5e1' }}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 text-sm truncate pr-2" title={item.name}>
                                {item.name}
                              </p>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden w-24">
                                <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: catConfig.color }} />
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-slate-700 text-sm">{item.value.toLocaleString()} {currency}</p>
                            <p className="text-xs text-slate-400">{percent.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getIcon = (type: CategoryType) => {
    switch(type) {
      case CategoryType.NEEDS: return <Shield className="w-5 h-5 text-white" />;
      case CategoryType.WANTS: return <ShoppingBag className="w-5 h-5 text-white" />;
      case CategoryType.SAVINGS: return <PiggyBank className="w-5 h-5 text-white" />;
      case CategoryType.GIVING: return <Heart className="w-5 h-5 text-white" />;
    }
  };

  const monthName = currentDate.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      {renderCategoryDetailModal()}

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <button onClick={onPrevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-slate-800 capitalize">{monthName}</h2>
        <button onClick={onNextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Top Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.values(CATEGORIES).map((cat) => {
          const spent = categoryTotals[cat.type] || 0;
          const target = income * cat.percentage;
          const percentageUsed = target > 0 ? Math.min((spent / target) * 100, 100) : 0;
          const isOver = spent > target;

          return (
            <div 
              key={cat.type} 
              onClick={() => setSelectedCategory(cat.type)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-lg`} style={{ backgroundColor: cat.color }}>
                    {getIcon(cat.type)}
                  </div>
                  <h3 className="font-semibold text-slate-700 text-sm group-hover:text-blue-600 transition-colors">{cat.label}</h3>
                </div>
                <span className="text-xs font-bold text-slate-400">{(cat.percentage * 100).toFixed(0)}%</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className={`text-xl font-bold ${isOver ? 'text-red-500' : 'text-slate-800'}`}>
                    {spent.toLocaleString()} <span className="text-xs font-medium text-slate-400">{currency}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    z {target.toLocaleString()}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : ''}`}
                    style={{ 
                      width: `${percentageUsed}%`, 
                      backgroundColor: isOver ? undefined : cat.color 
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 pt-1 text-right flex items-center justify-end group-hover:text-blue-500">
                  Detail <ChevronRight size={10} className="ml-1" />
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparison Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Plán vs. Realita ({monthName})</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <RechartsTooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value.toLocaleString()} ${currency}`, '']}
                />
                <Bar dataKey="cíl" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={20} name="Cíl" />
                <Bar dataKey="realita" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Realita">
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.realita > entry.cíl ? '#ef4444' : CATEGORIES[entry.type].color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2 w-full text-left">Rozložení výdajů</h3>
          {pieData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    className="cursor-pointer"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                        onClick={() => setSelectedCategory(entry.type)}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                     formatter={(value: number) => [`${value.toLocaleString()} ${currency}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              Žádné výdaje v tomto měsíci
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-4 justify-center">
             <div className="text-center">
                <p className="text-sm text-slate-500">Měsíční bilance</p>
                <p className={`text-xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {remaining > 0 ? '+' : ''}{remaining.toLocaleString()} {currency}
                </p>
             </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Kliknutím na graf zobrazíte detail.</p>
        </div>
      </div>

      {/* Accumulation / Savings Trend Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-2 mb-6">
          <TrendingUp className="text-emerald-500" />
          <h3 className="text-lg font-bold text-slate-800">Vývoj a kumulace úspor</h3>
          <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-medium ml-2">
            Start: {initialSavings.toLocaleString()} {currency}
          </span>
        </div>
        
        {accumulationData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={accumulationData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string, props: any) => {
                     // If name is "Celkové úspory", show the calculated cumulative
                     if (name === "Celkové úspory") return [`${value.toLocaleString()} ${currency}`];
                     return [`${value.toLocaleString()} ${currency}`];
                  }}
                  labelFormatter={(label) => `Období: ${label}`}
                  payload={[{ name: 'Příjem', value: 0 }, { name: 'Výdaje', value: 0 }]} // Dummy for TS, overridden by content
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorSavings)" 
                  name="Celkové úspory"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-xl">
             Zadejte první výdaje v historii, aby se graf vygeneroval.
          </div>
        )}
         <p className="text-xs text-slate-400 mt-4 text-center">
            Graf ukazuje vývoj vašich celkových úspor v čase (Počáteční stav + Kumulované měsíční přebytky dle historie příjmů).
         </p>
      </div>
    </div>
  );
};

export default Dashboard;