import React, { useState, useRef } from 'react';
import { Plus, Trash2, Calendar, Tag, RefreshCw, Copy, Upload, X, Check, FileText, Loader2, AlertCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { CategoryType, Expense } from '../types';
import { CATEGORIES } from '../constants';
import { processBankStatement } from '../services/geminiService';

interface ExpenseTrackerProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onAddExpenses?: (expenses: Omit<Expense, 'id'>[]) => void;
  onUpdateExpense?: (id: string, updates: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
  onCopyRecurring: () => void;
  onUpdateIncome?: (income: number, monthKey: string) => void;
  currentIncome?: number;
  currency: string;
  currentDate: string; // YYYY-MM-DD
  getIncomeForMonth?: (monthKey: string) => number;
}

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ 
  expenses, 
  onAddExpense,
  onAddExpenses, 
  onUpdateExpense,
  onDeleteExpense, 
  onCopyRecurring,
  onUpdateIncome,
  currentIncome = 0,
  currency,
  currentDate,
  getIncomeForMonth
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CategoryType>(CategoryType.NEEDS);
  const [date, setDate] = useState(currentDate);
  const [isRecurring, setIsRecurring] = useState(false);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedData, setImportedData] = useState<Omit<Expense, 'id'>[]>([]);
  const [detectedIncome, setDetectedIncome] = useState<number>(0);
  const [shouldUpdateIncome, setShouldUpdateIncome] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // State for detected month in import
  const [dominantMonth, setDominantMonth] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update internal date state if prop changes (e.g. month switch)
  React.useEffect(() => {
    setDate(currentDate);
  }, [currentDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    onAddExpense({
      description,
      amount: parseFloat(amount),
      category,
      date,
      isRecurring
    });

    setDescription('');
    setAmount('');
    setIsRecurring(false);
    // Keep category and date
  };

  const getDominantMonth = (items: Omit<Expense, 'id'>[]): string => {
    if (items.length === 0) return '';
    const counts: Record<string, number> = {};
    items.forEach(item => {
      const month = item.date.substring(0, 7); // YYYY-MM
      counts[month] = (counts[month] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportError(null);
    setImportedData([]);
    setDetectedIncome(0);
    setDominantMonth('');

    const reader = new FileReader();

    const handleSuccess = (expenses: Omit<Expense, 'id'>[], income: number) => {
       setImportedData(expenses);
       setDetectedIncome(income);
       
       const domMonth = getDominantMonth(expenses);
       setDominantMonth(domMonth);

       // Logic for default checkbox state:
       // If we have a helper to check income for that specific month, use it.
       // Otherwise fall back to currentIncome prop (which is usually current view).
       const incomeForImportMonth = getIncomeForMonth ? getIncomeForMonth(domMonth) : currentIncome;
       
       // Only default to TRUE if income for that month is 0/undefined.
       setShouldUpdateIncome(incomeForImportMonth === 0); 
    };

    if (file.type === 'application/pdf') {
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1];
        try {
          const result = await processBankStatement(base64Data, 'application/pdf');
          handleSuccess(result.expenses, result.detectedIncome);
        } catch (err) {
          console.error(err);
          setImportError("Nepodařilo se zpracovat PDF. Zkontrolujte, zda není soubor poškozený.");
        } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (text) {
          try {
            const result = await processBankStatement(text, 'text/csv');
            handleSuccess(result.expenses, result.detectedIncome);
          } catch (err) {
             console.error(err);
            setImportError("Nepodařilo se zpracovat CSV. Zkontrolujte formát.");
          } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleRemoveImportItem = (index: number) => {
    setImportedData(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateImportItem = (index: number, field: keyof Omit<Expense, 'id'>, value: any) => {
    setImportedData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
  };

  const confirmImport = () => {
    // Update income for the dominant month found in the statement
    if (detectedIncome > 0 && shouldUpdateIncome && onUpdateIncome) {
      // Use dominant month or current view month as fallback
      const targetMonth = dominantMonth || date.substring(0, 7);
      onUpdateIncome(detectedIncome, targetMonth);
    }

    // Add expenses
    if (onAddExpenses && importedData.length > 0) {
      onAddExpenses(importedData);
    }
    
    setIsImportModalOpen(false);
    setImportedData([]);
    setDetectedIncome(0);
    setDominantMonth('');
  };

  const currentMonthExpenses = expenses.filter(e => e.date.startsWith(date.substring(0, 7)));

  // Resolve which income to display in the comparison (modal)
  const incomeToCompare = (getIncomeForMonth && dominantMonth) 
    ? getIncomeForMonth(dominantMonth) 
    : currentIncome;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                 <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <Upload size={20} />
                 </div>
                 <div>
                   <h2 className="text-xl font-bold text-slate-800">Inteligentní Import z Banky</h2>
                   {dominantMonth && (
                     <p className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-1">
                       Detekováno období: {dominantMonth}
                     </p>
                   )}
                 </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {importedData.length === 0 && detectedIncome === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 space-y-6">
                  {isProcessing ? (
                    <>
                      <Loader2 size={48} className="animate-spin text-blue-500" />
                      <p className="text-slate-500 font-medium">AI analyzuje váš výpis (PDF/CSV) a kategorizuje položky...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200">
                        <FileText size={32} className="text-slate-300" />
                      </div>
                      <div className="text-center max-w-md">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Nahrajte výpis z banky</h3>
                        <p className="text-sm text-slate-500 mb-6">
                          Podporujeme <strong>PDF</strong> i <strong>CSV</strong> soubory.
                          Gemini AI přečte dokument, rozpozná příjmy i výdaje a automaticky je zařadí.
                        </p>
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          accept=".csv,.pdf,text/csv,application/pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium flex items-center mx-auto"
                        >
                          <Upload size={18} className="mr-2" />
                          Vybrat soubor (PDF / CSV)
                        </button>
                      </div>
                      {importError && (
                        <div className="flex items-center text-red-500 bg-red-50 px-4 py-2 rounded-lg text-sm">
                          <AlertCircle size={16} className="mr-2" />
                          {importError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                   {/* Income Detection Block */}
                   {detectedIncome > 0 && (
                     <div className="mb-6 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                              <TrendingUp size={20} />
                            </div>
                            <div>
                              <p className="text-sm text-emerald-800 font-medium">
                                Nalezen příjem {dominantMonth ? `pro ${dominantMonth}` : ''}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                {incomeToCompare > 0 && (
                                  <>
                                    <span className="text-slate-500 line-through text-sm" title="Nastaveno v tomto měsíci">{incomeToCompare.toLocaleString()}</span>
                                    <ArrowRight size={14} className="text-slate-400" />
                                  </>
                                )}
                                <p className="text-xl font-bold text-emerald-700">+{detectedIncome.toLocaleString()} {currency}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <label className={`flex items-center gap-3 cursor-pointer select-none bg-white py-2 px-3 rounded-lg border shadow-sm transition-colors ${shouldUpdateIncome ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                          <input 
                            type="checkbox" 
                            checked={shouldUpdateIncome}
                            onChange={(e) => setShouldUpdateIncome(e.target.checked)}
                            className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                          />
                          <span className="text-sm text-slate-700">
                             Aktualizovat rozpočet {dominantMonth ? `na ${dominantMonth}` : ''} částkou <strong>{detectedIncome.toLocaleString()} {currency}</strong>
                          </span>
                        </label>
                        {incomeToCompare > 0 && !shouldUpdateIncome && (
                          <p className="text-xs text-slate-500 mt-2 ml-1">
                            Váš současný rozpočet ({incomeToCompare.toLocaleString()} {currency}) zůstane zachován, pokud pole nezaškrtnete.
                          </p>
                        )}
                     </div>
                   )}

                   <div className="flex justify-between items-center mb-4">
                     <p className="text-sm text-slate-500">
                       Nalezeno <strong>{importedData.length}</strong> výdajů. Zkontrolujte prosím kategorie před uložením.
                     </p>
                     <button 
                       onClick={() => { setImportedData([]); setDetectedIncome(0); }}
                       className="text-xs text-red-500 hover:text-red-700 font-medium"
                     >
                       Zrušit a nahrát jiný
                     </button>
                   </div>
                   
                   <div className="space-y-3">
                     {importedData.map((item, idx) => (
                       <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-colors">
                         <input 
                           type="date" 
                           value={item.date}
                           onChange={(e) => handleUpdateImportItem(idx, 'date', e.target.value)}
                           className="bg-transparent border-none text-sm text-slate-500 w-32 focus:ring-0"
                         />
                         <input 
                           type="text" 
                           value={item.description}
                           onChange={(e) => handleUpdateImportItem(idx, 'description', e.target.value)}
                           className="flex-1 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 text-sm font-medium text-slate-800 focus:outline-none px-1"
                         />
                         <input 
                           type="number" 
                           value={item.amount}
                           onChange={(e) => handleUpdateImportItem(idx, 'amount', parseFloat(e.target.value))}
                           className="w-24 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 text-sm font-bold text-slate-800 focus:outline-none text-right px-1"
                         />
                         <select
                           value={item.category}
                           onChange={(e) => handleUpdateImportItem(idx, 'category', e.target.value)}
                           className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus:ring-2 focus:ring-blue-500 outline-none"
                         >
                            {Object.values(CATEGORIES).map(cat => (
                              <option key={cat.type} value={cat.type}>{cat.label}</option>
                            ))}
                         </select>
                         <button 
                           onClick={() => handleRemoveImportItem(idx)}
                           className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                         >
                           <Trash2 size={14} />
                         </button>
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end space-x-3">
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
              >
                Zavřít
              </button>
              <button 
                onClick={confirmImport}
                disabled={importedData.length === 0 && detectedIncome === 0}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center shadow-lg shadow-blue-200"
              >
                <Check size={18} className="mr-2" />
                Uložit transakce {detectedIncome > 0 && shouldUpdateIncome ? 'a aktualizovat příjem' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit lg:col-span-1">
        <div className="flex justify-between items-center mb-5">
           <h3 className="text-lg font-bold text-slate-800">Přidat výdaj</h3>
           <button 
             onClick={() => setIsImportModalOpen(true)}
             className="text-xs flex items-center text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
             title="Nahrát CSV/PDF z banky"
           >
             <Upload size={12} className="mr-1.5" />
             Import
           </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Popis</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Např. Nájem"
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Částka ({currency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Kategorie</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(CATEGORIES).map((cat) => (
                <button
                  key={cat.type}
                  type="button"
                  onClick={() => setCategory(cat.type)}
                  className={`p-3 rounded-xl text-xs font-medium transition-all text-left flex flex-col justify-center items-start border ${
                    category === cat.type 
                      ? 'border-transparent ring-2 ring-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="mb-1 block">{cat.label}</span>
                  <span className="text-[10px] opacity-70">{(cat.percentage * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Datum</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-600"
                required
              />
            </div>
            <div className="flex items-end">
               <button
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                className={`w-full p-3 rounded-xl border flex items-center justify-center text-sm transition-all ${
                  isRecurring 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
               >
                 <RefreshCw size={16} className={`mr-2 ${isRecurring ? 'animate-spin-slow' : ''}`} />
                 {isRecurring ? 'Pravidelné' : 'Jednorázové'}
               </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 px-1">
             Pokud označíte jako "Pravidelné", budete moci tento výdaj snadno zkopírovat v příštím měsíci.
          </p>

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <Plus size={18} />
            <span>Přidat transakci</span>
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <button
            onClick={onCopyRecurring}
            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2 text-sm"
          >
            <Copy size={16} />
            <span>Načíst pravidelné výdaje</span>
          </button>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            Zkopíruje pravidelné výdaje z historie do aktuálního data.
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
        <h3 className="text-lg font-bold text-slate-800 mb-5">
           Transakce: {new Date(date).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}
        </h3>
        
        {currentMonthExpenses.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>V tomto měsíci zatím žádné transakce.</p>
            <p className="text-sm mt-2">Přidejte výdaj nebo importujte CSV/PDF z banky.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {[...currentMonthExpenses].reverse().map((expense) => {
              const catConfig = CATEGORIES[expense.category];
              return (
                <div key={expense.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group">
                  <div className="flex items-center space-x-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{ backgroundColor: catConfig.color }}
                    >
                      <Tag size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                         <p className="font-semibold text-slate-800 truncate">{expense.description}</p>
                         {expense.isRecurring && (
                           <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center shrink-0">
                             <RefreshCw size={8} className="mr-1"/> Pravidelné
                           </span>
                         )}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center"><Calendar size={12} className="mr-1"/> {expense.date}</span>
                        
                        {/* Inline Category Editor */}
                        {onUpdateExpense ? (
                          <div className="relative">
                            <select
                              value={expense.category}
                              onChange={(e) => onUpdateExpense(expense.id, { category: e.target.value as CategoryType })}
                              className="appearance-none bg-transparent border-none p-0 pr-4 font-medium cursor-pointer focus:ring-0 text-xs"
                              style={{ color: catConfig.color }}
                            >
                              {Object.values(CATEGORIES).map(cat => (
                                <option key={cat.type} value={cat.type}>{cat.label}</option>
                              ))}
                            </select>
                            {/* Tiny down arrow for UX */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: catConfig.color }}>
                                <path d="M6 9l6 6 6-6"/>
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: catConfig.color }} className="font-medium">{catConfig.label}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 pl-2">
                    <span className="font-bold text-slate-800 whitespace-nowrap">
                      - {expense.amount.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
                    </span>
                    <button 
                      onClick={() => onDeleteExpense(expense.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2"
                      title="Smazat"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseTracker;