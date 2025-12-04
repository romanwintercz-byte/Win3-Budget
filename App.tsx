import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LayoutDashboard, Wallet, Settings, LogOut, Save } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ExpenseTracker from './components/ExpenseTracker';
import AIAdvisor from './components/AIAdvisor';
import { Expense } from './types';
import { DEFAULT_CURRENCY } from './constants';

const App: React.FC = () => {
  // State for Income History: Record<"YYYY-MM", number>
  const [incomeHistory, setIncomeHistory] = useState<Record<string, number>>(() => {
    const savedHistory = localStorage.getItem('budget_income_history');
    if (savedHistory) {
      return JSON.parse(savedHistory);
    }
    // Migration for old version: convert single income to a default entry
    const oldIncome = localStorage.getItem('budget_income');
    return oldIncome ? { 'default': parseFloat(oldIncome) } : {};
  });

  const [initialSavings, setInitialSavings] = useState<number>(() => {
    const saved = localStorage.getItem('budget_initial_savings');
    return saved ? parseFloat(saved) : 0;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('budget_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'settings'>('dashboard');
  
  // Helper to format date as YYYY-MM
  const getMonthKey = (date: Date) => date.toISOString().substring(0, 7);
  // Helper to format date as YYYY-MM-DD
  const getDayKey = (date: Date) => date.toISOString().substring(0, 10);

  // Logic to get income for a specific month (with fallback to previous months)
  const getIncomeForMonth = (monthKey: string): number => {
    // 1. Try exact match
    if (incomeHistory[monthKey] !== undefined) {
      return incomeHistory[monthKey];
    }
    
    // 2. Try 'default' key (migration or base)
    if (incomeHistory['default'] !== undefined && Object.keys(incomeHistory).length === 1) {
       return incomeHistory['default'];
    }

    // 3. Find the closest previous month
    const sortedKeys = Object.keys(incomeHistory).sort();
    const pastKeys = sortedKeys.filter(k => k < monthKey && k !== 'default');
    
    if (pastKeys.length > 0) {
      return incomeHistory[pastKeys[pastKeys.length - 1]];
    }

    // 4. Fallback to default or 0
    return incomeHistory['default'] || 0;
  };

  const currentMonthKey = getMonthKey(currentDate);
  const currentIncome = getIncomeForMonth(currentMonthKey);
  const [showIncomeModal, setShowIncomeModal] = useState(Object.keys(incomeHistory).length === 0);

  // Form states for Settings
  const [settingsIncome, setSettingsIncome] = useState(currentIncome.toString());
  const [settingsSavings, setSettingsSavings] = useState(initialSavings.toString());

  // Update settings input when switching months
  useEffect(() => {
    setSettingsIncome(currentIncome.toString());
  }, [currentIncome, currentDate]);

  useEffect(() => {
    localStorage.setItem('budget_income_history', JSON.stringify(incomeHistory));
  }, [incomeHistory]);

  useEffect(() => {
    localStorage.setItem('budget_initial_savings', initialSavings.toString());
    setSettingsSavings(initialSavings.toString());
  }, [initialSavings]);

  useEffect(() => {
    localStorage.setItem('budget_expenses', JSON.stringify(expenses));
  }, [expenses]);

  const handleAddExpense = (newExpense: Omit<Expense, 'id'>) => {
    const expense: Expense = { ...newExpense, id: uuidv4() };
    setExpenses(prev => [...prev, expense]);
  };

  const handleAddExpenses = (newExpenses: Omit<Expense, 'id'>[]) => {
    const expensesWithIds = newExpenses.map(e => ({ ...e, id: uuidv4() }));
    setExpenses(prev => [...prev, ...expensesWithIds]);
  };

  const handleUpdateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateIncome = (amount: number, monthKey: string) => {
    setIncomeHistory(prev => ({
      ...prev,
      [monthKey]: amount
    }));
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const newIncome = parseFloat(settingsIncome);
    const newSavings = parseFloat(settingsSavings);

    if (!isNaN(newIncome) && newIncome > 0) {
      handleUpdateIncome(newIncome, currentMonthKey);
    }
    if (!isNaN(newSavings)) {
      setInitialSavings(newSavings);
    }
    alert(`Nastavení pro ${currentMonthKey} bylo uloženo.`);
  };

  const copyRecurringExpenses = () => {
    const currentKey = getMonthKey(currentDate);
    const distinctRecurring = new Map<string, Expense>();
    
    expenses.forEach(exp => {
      if (exp.isRecurring && !exp.date.startsWith(currentKey)) {
        distinctRecurring.set(`${exp.description}-${exp.amount}`, exp);
      }
    });

    const newExpenses: Expense[] = [];
    const existingCurrentMonthDescriptions = new Set(
      expenses
        .filter(e => e.date.startsWith(currentKey))
        .map(e => `${e.description}-${e.amount}`)
    );

    distinctRecurring.forEach((exp) => {
      const key = `${exp.description}-${exp.amount}`;
      if (!existingCurrentMonthDescriptions.has(key)) {
        newExpenses.push({
          ...exp,
          id: uuidv4(),
          date: getDayKey(currentDate), 
        });
      }
    });

    if (newExpenses.length > 0) {
      setExpenses(prev => [...prev, ...newExpenses]);
      alert(`Načteno ${newExpenses.length} pravidelných plateb.`);
    } else {
      alert("Nebyly nalezeny žádné nové pravidelné platby k importu.");
    }
  };

  const currentMonthExpenses = expenses.filter(e => e.date.startsWith(currentMonthKey));

  const resetData = () => {
    if(window.confirm('Opravdu chcete vymazat všechna data?')) {
      setIncomeHistory({});
      setInitialSavings(0);
      setExpenses([]);
      localStorage.clear();
      window.location.reload();
    }
  };

  if (showIncomeModal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Wallet size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Vítejte ve SmartBudget</h1>
          <p className="text-slate-500 mb-8">Než začneme, nastavte si prosím základní finanční údaje.</p>
          
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            // Save initial income as default and current month
            const initialInc = parseFloat(settingsIncome) || 0;
            const todayKey = getMonthKey(new Date());
            setIncomeHistory({ 'default': initialInc, [todayKey]: initialInc });
            setShowIncomeModal(false); 
          }} className="space-y-4 text-left">
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Čistý měsíční příjem</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-400 font-medium text-sm">{DEFAULT_CURRENCY}</span>
                <input 
                  type="number" 
                  min="0"
                  value={settingsIncome}
                  onChange={(e) => setSettingsIncome(e.target.value)}
                  className="w-full pl-14 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold text-slate-800"
                  placeholder="30000"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Počáteční stav úspor (nepovinné)</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-400 font-medium text-sm">{DEFAULT_CURRENCY}</span>
                <input 
                  type="number" 
                  min="0"
                  value={initialSavings === 0 ? '' : initialSavings}
                  onChange={(e) => setInitialSavings(parseFloat(e.target.value) || 0)}
                  className="w-full pl-14 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold text-slate-800"
                  placeholder="0"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium transition-colors mt-4"
            >
              Začít plánovat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-row md:flex-col items-center py-4 md:py-8 sticky top-0 z-20 h-auto md:h-screen">
        <div className="hidden lg:flex items-center space-x-2 px-6 mb-10 w-full">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">40</div>
          <span className="text-lg font-bold tracking-tight">SmartBudget</span>
        </div>
        
        {/* Mobile Logo */}
        <div className="lg:hidden md:mb-8 px-4 md:px-0">
           <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">40+</div>
        </div>

        <nav className="flex-1 w-full flex md:flex-col justify-center md:justify-start space-x-4 md:space-x-0 md:space-y-2 px-2 md:px-4">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center p-3 rounded-xl transition-all w-full ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <LayoutDashboard size={22} />
            <span className="hidden lg:block ml-3">Přehled</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center p-3 rounded-xl transition-all w-full ${activeTab === 'expenses' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Wallet size={22} />
            <span className="hidden lg:block ml-3">Výdaje</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center p-3 rounded-xl transition-all w-full ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Settings size={22} />
            <span className="hidden lg:block ml-3">Nastavení</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab === 'dashboard' && 'Přehled rozpočtu'}
              {activeTab === 'expenses' && 'Správa výdajů'}
              {activeTab === 'settings' && 'Nastavení'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {activeTab === 'settings' 
                ? 'Globální nastavení aplikace' 
                : currentDate.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })
              }
            </p>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="space-y-8 animate-fade-in">
          
          {activeTab === 'dashboard' && (
            <>
              <AIAdvisor income={currentIncome} expenses={currentMonthExpenses} />
              <Dashboard 
                income={currentIncome} 
                initialSavings={initialSavings}
                currentMonthExpenses={currentMonthExpenses} 
                allExpenses={expenses}
                currency={DEFAULT_CURRENCY}
                currentDate={currentDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                getIncomeForMonth={getIncomeForMonth}
              />
            </>
          )}

          {activeTab === 'expenses' && (
            <ExpenseTracker 
              expenses={expenses} 
              onAddExpense={handleAddExpense}
              onAddExpenses={handleAddExpenses}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense} 
              onCopyRecurring={copyRecurringExpenses}
              onUpdateIncome={handleUpdateIncome}
              currentIncome={currentIncome}
              currency={DEFAULT_CURRENCY}
              currentDate={getDayKey(currentDate)}
              getIncomeForMonth={getIncomeForMonth}
            />
          )}

          {activeTab === 'settings' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               
               {/* Financial Settings */}
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                 <h3 className="text-lg font-bold mb-6 flex items-center">
                    <Wallet className="mr-2 text-blue-500" size={20} />
                    Finanční nastavení
                 </h3>
                 <form onSubmit={handleSaveSettings} className="space-y-5">
                    <div className="bg-blue-50 p-4 rounded-xl mb-4 text-sm text-blue-800">
                      Úpravy příjmu zde se aplikují na aktuálně vybraný měsíc: <strong>{currentMonthKey}</strong> a všechny následující, které nemají vlastní nastavení.
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Měsíční příjem ({DEFAULT_CURRENCY})</label>
                      <input 
                        type="number" 
                        value={settingsIncome}
                        onChange={(e) => setSettingsIncome(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Počáteční stav úspor ({DEFAULT_CURRENCY})</label>
                      <input 
                        type="number" 
                        value={settingsSavings}
                        onChange={(e) => setSettingsSavings(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Částka, od které se odvíjí graf kumulace úspor (Startovní čára).</p>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-medium transition-colors flex items-center justify-center"
                    >
                      <Save size={18} className="mr-2" />
                      Uložit nastavení pro {currentMonthKey}
                    </button>
                 </form>
               </div>

               {/* Data Management */}
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-fit">
                 <h3 className="text-lg font-bold mb-4 flex items-center text-red-600">
                    <LogOut className="mr-2" size={20} />
                    Reset aplikace
                 </h3>
                 <p className="text-slate-500 mb-6 text-sm">
                   Veškerá data jsou uložena pouze ve vašem prohlížeči. 
                 </p>
                 
                 <button 
                  onClick={resetData}
                  className="w-full flex items-center justify-center px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-100 font-medium"
                 >
                   Vymazat všechna data
                 </button>
               </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;