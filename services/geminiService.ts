import { GoogleGenAI, Type } from "@google/genai";
import { Expense, CategoryType } from '../types';
import { CATEGORIES } from '../constants';

// Helper function to safely get the API Key in different environments
const getApiKey = (): string | undefined => {
  // 1. Try Vite environment (Standard for Vercel/React deployments)
  // This must be checked first and explicitly for VITE_API_KEY
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore ReferenceError if import.meta is not available
  }

  // 2. Try standard process.env (AI Studio, Webpack)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }

  return undefined;
};

// Lazy initialization helper
const getGeminiClient = () => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.error("SmartBudget Error: API Key not found.");
    throw new Error("API Key missing (VITE_API_KEY)");
  }

  return new GoogleGenAI({ apiKey: apiKey });
};

export const analyzeBudget = async (
  income: number,
  expenses: Expense[]
): Promise<string> => {
  try {
    const ai = getGeminiClient();

    // Aggregate expenses for context
    const summary = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<CategoryType, number>);

    const totalSpent = Object.values(summary).reduce((a, b) => a + b, 0);

    const prompt = `
      Jsi zkušený finanční poradce specializující se na metodu 40-30-20-10.
      
      Analýzuj následující měsíční rozpočet uživatele:
      
      Čistý příjem: ${income} CZK
      Celkem utraceno: ${totalSpent} CZK
      
      Rozdělení dle kategorií (Skutečnost vs Cíl):
      1. Nutné výdaje (Cíl 40% = ${income * 0.4}): Utraceno ${summary[CategoryType.NEEDS] || 0}
      2. Osobní radosti (Cíl 30% = ${income * 0.3}): Utraceno ${summary[CategoryType.WANTS] || 0}
      3. Úspory (Cíl 20% = ${income * 0.2}): Utraceno ${summary[CategoryType.SAVINGS] || 0}
      4. Dary/Charita (Cíl 10% = ${income * 0.1}): Utraceno ${summary[CategoryType.GIVING] || 0}
      
      Poskytni stručné, motivační a konkrétní hodnocení v českém jazyce.
      Pokud uživatel překračuje limity v některé kategorii, dej mu specifickou radu.
      Pokud uživatel spoří málo, zdůrazni důležitost úspor.
      Formátuj odpověď jako čistý text bez Markdown nadpisů, maximálně 3 krátké odstavce.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Nepodařilo se vygenerovat radu.";
  } catch (error: any) {
    console.error("Gemini Analyze Error:", error);
    // Vracíme přesnou chybu do UI, aby uživatel viděl, co je špatně
    return `CHYBA AI: ${error.message || error.toString()}`;
  }
};

interface ImportResult {
  expenses: Omit<Expense, 'id'>[];
  detectedIncome: number;
}

export const processBankStatement = async (
  data: string, 
  mimeType: string = 'text/csv'
): Promise<ImportResult> => {
  try {
    const ai = getGeminiClient();
    const parts: any[] = [];

    // Instructions common for both text and PDF
    const systemInstruction = `
      Jsi expertní AI parser bankovních výpisů. Tvým úkolem je s vysokou přesností extrahovat transakce a ROZLIŠIT PŘÍJMY OD VÝDAJŮ.
      
      PRAVIDLA PRO DETEKCI PŘÍJMU (INCOME):
      1. Hledej explicitní znaky "+" nebo sloupce "Kredit" / "Credit" / "Příjem".
      2. Hledej klíčová slova v popisu, která jasně indikují PŘÍJEM:
         - "Mzda", "Výplata", "Odměna", "Plat", "Vklad", "Připsáno", "Příchozí úhrada", "Důchod", "Mateřská".
      3. "Úrok", "Kreditní úrok", "Interest payment", "Bonus", "Cashback" -> Toto JE PŘÍJEM (INCOME).
      4. Pokud transakce vypadá jako pravidelná mzda (vysoká částka, název firmy), je to INCOME.
      
      DŮLEŽITÉ: CO NENÍ PŘÍJEM (IGNOROVAT - NENÍ TO ANI EXPENSE, ANI INCOME):
      1. "Splátka kreditní karty" - toto je technicky "příjem" na účet kreditky, ale pro uživatele je to jen vyrovnání dluhu.
      2. "Převod z vlastního účtu", "Vlastní prostředky", "Spořící účet - převod" - přesun peněz mezi vlastními účty NENÍ příjem (ani na běžném, ani na spořícím účtu).
      3. "Vratka", "Storno", "Refund" - toto je jen korekce.
      --> Tyto položky do výstupu JSON vůbec nezařazuj, nebo je označ kategorií 'IGNORE' (kterou pak filtr odstraní), ale hlavně ne jako INCOME.
      
      PRAVIDLA PRO DETEKCI VÝDAJE (EXPENSE):
      1. Hledej explicitní znaky "-" nebo sloupce "Debet" / "Debit" / "Výdaj" / "Částka".
      2. Většina položek typu "Platba kartou", "Nákup", "Výběr z bankomatu", "Odchozí úhrada" jsou výdaje.
      3. "Daň z úroku" (Tax) je EXPENSE.
      
      OSTATNÍ PRAVIDLA:
      1. Částky vždy převáděj na absolutní kladné číslo (pro INCOME i EXPENSE).
      2. Datum naformátuj striktně jako YYYY-MM-DD.
      3. Pro výdaje (EXPENSE) odhadni kategorii:
       - NEEDS: Nájem, Hypotéka, Bydlení, Energie, Voda, Supermarkety (Lidl, Kaufland...), Lékárna, Benzín/Nafta, Pojištění, Daň z úroku.
       - WANTS: Restaurace, Kavárny, Netflix, Kino, Elektronika, Oblečení, Zábava.
       - SAVINGS: Penzijní připojištění, Investice (Portu, XTB), Převod na spořící účet (Odchozí platba na spoření).
       - GIVING: Charita, Dary.
      4. Pro příjmy (INCOME) nastav kategorii na null.
    `;

    if (mimeType === 'application/pdf') {
      // PDF Handling
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: data // Base64 string
        }
      });
      parts.push({ text: "Analyzuj tento bankovní výpis v PDF. Rozlišuj běžný vs. spořící účet. Úroky jsou příjem, vlastní převody ignoruj." });
    } else {
      // CSV / Text Handling
      const textSample = data.length > 30000 ? data.substring(0, 30000) : data;
      parts.push({ text: `Zde jsou data z CSV/Textu:\n${textSample}\n\nAnalyzuj řádky. Úroky jsou příjem. Vlastní převody ignoruj.` });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: parts
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE', 'IGNORE'] },
              category: { type: Type.STRING, enum: [CategoryType.NEEDS, CategoryType.WANTS, CategoryType.SAVINGS, CategoryType.GIVING], nullable: true }
            },
            required: ["description", "amount", "date", "type"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return { expenses: [], detectedIncome: 0 };
    
    const parsed = JSON.parse(jsonText);
    
    const expenses: Omit<Expense, 'id'>[] = [];
    let detectedIncome = 0;

    parsed.forEach((item: any) => {
      // Filter out IGNORE types (internal transfers)
      if (item.type === 'IGNORE') return;

      if (item.type === 'INCOME') {
        detectedIncome += item.amount;
      } else {
        expenses.push({
          description: item.description,
          amount: item.amount,
          category: item.category as CategoryType || CategoryType.NEEDS, // Default if null
          date: item.date,
          isRecurring: false
        });
      }
    });

    return { expenses, detectedIncome };

  } catch (error: any) {
    console.error("Gemini Parse Error:", error);
    // Propagace konkrétní chyby
    throw new Error(`CHYBA AI: ${error.message || error.toString()}`);
  }
};
