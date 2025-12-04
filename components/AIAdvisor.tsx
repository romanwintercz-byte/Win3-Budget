import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Expense } from '../types';
import { analyzeBudget } from '../services/geminiService';

interface AIAdvisorProps {
  income: number;
  expenses: Expense[];
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ income, expenses }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setAdvice(null);
    try {
      const result = await analyzeBudget(income, expenses);
      setAdvice(result);
    } catch (error) {
      setAdvice("Nastala chyba při komunikaci s AI.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="text-yellow-400" size={24} />
            <h3 className="text-xl font-bold">AI Finanční Poradce</h3>
          </div>
          {!advice && !isLoading && (
            <button
              onClick={handleAnalyze}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-all backdrop-blur-sm"
            >
              Analyzovat rozpočet
            </button>
          )}
        </div>

        {isLoading && (
          <div className="py-8 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="animate-spin text-indigo-300" size={32} />
            <p className="text-indigo-200 text-sm animate-pulse">Gemini analyzuje vaše finance...</p>
          </div>
        )}

        {advice && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
            <p className="text-indigo-50 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
              {advice}
            </p>
            <div className="mt-4 flex justify-end">
              <button 
                onClick={handleAnalyze}
                className="text-xs text-indigo-300 hover:text-white transition-colors flex items-center"
              >
                <Sparkles size={12} className="mr-1" />
                Aktualizovat analýzu
              </button>
            </div>
          </div>
        )}

        {!advice && !isLoading && (
          <p className="text-indigo-200 text-sm max-w-lg">
            Nechte umělou inteligenci zhodnotit váš rozpočet podle pravidla 40-30-20-10. Získejte personalizované tipy, jak ušetřit nebo lépe rozložit své finance.
          </p>
        )}
      </div>
    </div>
  );
};

export default AIAdvisor;
