/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Save,
  Car, 
  Fuel, 
  PlusCircle, 
  History, 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Wallet,
  X,
  Pencil,
  Trash2,
  DollarSign,
  FileText,
  Calendar,
  Download,
  Settings as SettingsIcon,
  AlertCircle,
  RefreshCw,
  LogOut,
  LogIn,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  handleFirestoreError, 
  OperationType,
  Timestamp
} from './firebase';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  query, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

// --- Types ---

interface Transaction {
  id: string;
  type: 'uber' | '99' | 'combustivel' | 'gorjeta' | 'entrada' | 'aluguel' | 'saida';
  amount: number;
  date: Date;
  description: string;
  weekStart?: Date;
  weekEnd?: Date;
}

interface Report {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

interface Settings {
  cycleStartDay: number;
  cycleDuration: number;
  referenceDate: Date;
}

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<any, any> {
  state: any = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Erro de permissão: ${parsed.operationType} em ${parsed.path}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-zinc-200 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 mb-2">Ops! Algo deu errado</h1>
            <p className="text-zinc-500 text-sm mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Login Component ---

function Login() {
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login error caught:", err);
      const errorCode = err?.code || '';
      const errorMessage = err?.message || '';

      if (errorCode === 'auth/popup-blocked' || errorMessage.includes('popup-blocked') || errorMessage.includes('popup blocked')) {
        setError('O login popup foi bloqueado pelo seu navegador. Por favor, permita popups/cookies para este site ou utilize o botão abaixo para abrir em uma nova aba.');
      } else if (errorCode === 'auth/cancelled-popup-request' || errorCode === 'auth/popup-closed-by-user' || errorMessage.includes('cancelled-popup-request')) {
        setError('A janela de login do Google foi fechada ou cancelada antes da conclusão do login.');
      } else if (errorMessage.includes('Pending promise was never set')) {
        setError('Ocorreu um conflito temporário no login do Firebase. Por favor, clique abaixo para abrir em uma nova aba e tentar novamente de forma direta.');
      } else {
        setError(`Erro ao autenticar: ${err.message || 'Tente novamente.'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openInNewTab = () => {
    try {
      window.open(window.location.href, '_blank');
    } catch (e) {
      console.error("Failed to open window:", e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-zinc-100 text-center"
      >
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
          <Wallet className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-zinc-900 mb-2">FINANÇAS DRIVER</h1>
        <p className="text-zinc-500 text-sm mb-8 font-medium">Controle seus ganhos e gastos de forma profissional.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-left">
            <div className="flex items-start gap-2.5 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1">Aviso de Login</p>
                <p className="text-xs text-red-600 leading-relaxed font-medium">{error}</p>
              </div>
            </div>
            <button
              onClick={openInNewTab}
              type="button"
              className="mt-3 w-full py-2.5 px-4 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              Abrir em Nova Aba
            </button>
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={isLoggingIn}
          type="button"
          className={`w-full py-4 px-6 bg-white border-2 border-zinc-200 text-zinc-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95 shadow-sm cursor-pointer ${
            isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isLoggingIn ? (
            <>
              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </>
          )}
        </button>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button 
            onClick={openInNewTab}
            type="button"
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 underline underline-offset-4 flex items-center gap-1.5 cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
            Está em um iframe? Abra em nova aba
          </button>
        </div>
        
        <p className="mt-8 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
          Seguro & Confiável • Powered by Firebase
        </p>
      </motion.div>
    </div>
  );
}

// --- Main App Component ---

const parseUTCDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const getLocalToday = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<Transaction['type'] | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [fuelPrice, setFuelPrice] = useState('');
  const [kmPerLiter, setKmPerLiter] = useState('10');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: `${new Date().getFullYear()}-01-01`,
    end: `${new Date().getFullYear()}-12-31`
  });
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(() => {
    const saved = localStorage.getItem('isDesktopLayout');
    return saved ? JSON.parse(saved) : false;
  });

  const toggleLayout = () => {
    const newVal = !isDesktopLayout;
    setIsDesktopLayout(newVal);
    localStorage.setItem('isDesktopLayout', JSON.stringify(newVal));
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (!user) {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    setIsLoading(true);

    // Transactions Listener
    const transQuery = query(
      collection(db, `users/${user.uid}/transactions`),
      orderBy('date', 'desc')
    );
    const unsubTrans = onSnapshot(transQuery, (snapshot) => {
      const transData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
          weekStart: data.weekStart instanceof Timestamp ? data.weekStart.toDate() : (data.weekStart ? new Date(data.weekStart) : undefined),
          weekEnd: data.weekEnd instanceof Timestamp ? data.weekEnd.toDate() : (data.weekEnd ? new Date(data.weekEnd) : undefined),
        } as Transaction;
      });
      setTransactions(transData);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/transactions`);
    });

    // Reports Listener
    const reportsQuery = collection(db, `users/${user.uid}/reports`);
    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : new Date(data.startDate),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate() : new Date(data.endDate),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        } as Report;
      }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime()); // Sort chronologically for carousel
      setReports(reportsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/reports`);
    });

    return () => {
      unsubTrans();
      unsubReports();
    };
  }, [user, isAuthReady]);

  const filteredTransactions = transactions.filter(t => {
    const year = t.date.getUTCFullYear();
    const month = String(t.date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(t.date.getUTCDate()).padStart(2, '0');
    const tDateStr = `${year}-${month}-${day}`;
    return tDateStr >= customRange.start && tDateStr <= customRange.end;
  });

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: { label: string, transactions: Transaction[] } } = {};
    
    filteredTransactions.forEach(t => {
      const d = new Date(t.date);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const label = d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long' });
      
      if (!groups[dateKey]) {
        groups[dateKey] = { label, transactions: [] };
      }
      groups[dateKey].transactions.push(t);
    });
    
    const typeOrder: Record<string, number> = {
      'uber': 1,
      '99': 2,
      'gorjeta': 3,
      'entrada': 4,
      'saida': 5,
      'combustivel': 6,
      'aluguel': 7
    };

    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map(dateKey => ({
        weekKey: dateKey,
        weekLabel: groups[dateKey].label,
        transactions: groups[dateKey].transactions.sort((a, b) => {
          const orderA = typeOrder[a.type] || 99;
          const orderB = typeOrder[b.type] || 99;
          if (orderA !== orderB) return orderA - orderB;
          return b.amount - a.amount;
        })
      }));
  }, [filteredTransactions]);

  const totalIncome = Math.round(filteredTransactions
    .filter(t => ['uber', '99', 'gorjeta', 'entrada'].includes(t.type))
    .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
  
  const totalExpenses = Math.round(filteredTransactions
    .filter(t => ['combustivel', 'aluguel', 'saida'].includes(t.type))
    .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;

  const balance = Math.round((totalIncome - totalExpenses) * 100) / 100;

  const totalUberOnly = useMemo(() => {
    return Math.round(filteredTransactions
      .filter(t => t.type === 'uber')
      .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
  }, [filteredTransactions]);

  const total99Only = useMemo(() => {
    return Math.round(filteredTransactions
      .filter(t => t.type === '99')
      .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
  }, [filteredTransactions]);

  const totalCombustivelOnly = useMemo(() => {
    return Math.round(filteredTransactions
      .filter(t => t.type === 'combustivel')
      .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
  }, [filteredTransactions]);

  const totalRestanteGanhos = useMemo(() => {
    return Math.round(filteredTransactions
      .filter(t => ['gorjeta', 'entrada'].includes(t.type))
      .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
  }, [filteredTransactions]);

  const totalRestanteGastos = useMemo(() => {
    return Math.round(filteredTransactions
      .filter(t => ['aluguel', 'saida'].includes(t.type))
      .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
  }, [filteredTransactions]);

  const totalRestanteNet = useMemo(() => {
    return Math.round((totalRestanteGanhos - totalRestanteGastos) * 100) / 100;
  }, [totalRestanteGanhos, totalRestanteGastos]);

  const uberGrouped = useMemo(() => {
    return groupedTransactions.map(group => ({
      ...group,
      transactions: group.transactions.filter(t => t.type === 'uber')
    })).filter(group => group.transactions.length > 0);
  }, [groupedTransactions]);

  const group99Grouped = useMemo(() => {
    return groupedTransactions.map(group => ({
      ...group,
      transactions: group.transactions.filter(t => t.type === '99')
    })).filter(group => group.transactions.length > 0);
  }, [groupedTransactions]);

  const combustivelGrouped = useMemo(() => {
    return groupedTransactions.map(group => ({
      ...group,
      transactions: group.transactions.filter(t => t.type === 'combustivel')
    })).filter(group => group.transactions.length > 0);
  }, [groupedTransactions]);

  const restanteGrouped = useMemo(() => {
    return groupedTransactions.map(group => ({
      ...group,
      transactions: group.transactions.filter(t => !['uber', '99', 'combustivel'].includes(t.type))
    })).filter(group => group.transactions.length > 0);
  }, [groupedTransactions]);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportName || !customRange) return;

    try {
      await addDoc(collection(db, `users/${user.uid}/reports`), {
        userId: user.uid,
        name: reportName,
        startDate: Timestamp.fromDate(parseUTCDate(customRange.start)),
        endDate: Timestamp.fromDate(parseUTCDate(customRange.end)),
        createdAt: serverTimestamp()
      });
      setIsReportModalOpen(false);
      setReportName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/reports`);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!user) return;
    setConfirmModal({
      message: 'Excluir este relatório salvo?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, `users/${user.uid}/reports/${id}`));
          if (activeReportId === id) {
            setActiveReportId(null);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/reports/${id}`);
        }
        setConfirmModal(null);
      }
    });
  };

  const selectReport = (report: Report) => {
    setActiveReportId(report.id);
    const start = report.startDate.getUTCFullYear() + '-' + String(report.startDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(report.startDate.getUTCDate()).padStart(2, '0');
    const end = report.endDate.getUTCFullYear() + '-' + String(report.endDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(report.endDate.getUTCDate()).padStart(2, '0');
    setCustomRange({
      start,
      end
    });
  };

  const clearFilter = () => {
    setActiveReportId(null);
    const start = `${selectedYear}-01-01`;
    const end = `${selectedYear}-12-31`;
    setCustomRange({
      start,
      end
    });
  };

  // Auto-select current cycle on load
  useEffect(() => {
    if (reports.length > 0 && !hasAutoSelected) {
      if (!activeReportId) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const currentCycle = reports.find(r => {
          if (!r.startDate || !r.endDate) return false;
          const startStr = r.startDate.getUTCFullYear() + '-' + String(r.startDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(r.startDate.getUTCDate()).padStart(2, '0');
          const endStr = r.endDate.getUTCFullYear() + '-' + String(r.endDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(r.endDate.getUTCDate()).padStart(2, '0');
          return todayStr >= startStr && todayStr <= endStr;
        });

        if (currentCycle) {
          selectReport(currentCycle);
        }
      }
      setHasAutoSelected(true);
    }
  }, [reports, hasAutoSelected, activeReportId]);

  const generatePDF = (name: string, startDate: Date, endDate: Date) => {
    const doc = new jsPDF();
    
    const reportTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      return tDate >= start && tDate <= end;
    }).sort((a, b) => {
      const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return timeA - timeB;
    });

    const income = Math.round(reportTransactions
      .filter(t => ['uber', '99', 'gorjeta', 'entrada'].includes(t.type))
      .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
    
    const expenses = Math.round(reportTransactions
      .filter(t => ['combustivel', 'aluguel', 'saida'].includes(t.type))
      .reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;

    const balance = Math.round((income - expenses) * 100) / 100;

    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Relatório Financeiro', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`, 14, 32);
    
    doc.setDrawColor(200);
    doc.setFillColor(245, 247, 250); // Elegant light gray-blue background
    doc.rect(14, 43, 182, 22, 'F');
    
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 120); // Muted slate color for labels
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO DO PERÍODO', 18, 49);
    
    doc.setFontSize(11.5);
    doc.setTextColor(16, 124, 65); // Dark rich green for total gains
    doc.text(`Ganhos: R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 59);
    
    doc.setTextColor(185, 28, 28); // Vibrant deep red for expenses
    doc.text(`Gastos: R$ ${expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 80, 59);
    
    doc.setTextColor(15, 23, 42); // Sophisticated deep slate/black for final balance
    doc.text(`Saldo Final: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 138, 59);
    doc.setFont('helvetica', 'normal');

    // Grouping logic for ENTRADAS
    const incomeTypes = ['uber', '99', 'gorjeta', 'entrada'];
    const incomeRows: any[] = [];
    let incomeTotal = 0;

    incomeTypes.forEach(type => {
      const typeTransactions = reportTransactions.filter(t => t.type === type);
      if (typeTransactions.length === 0) return;

      incomeRows.push([
        {
          content: getLabel(type as any).toUpperCase(),
          colSpan: 4,
          styles: { fillColor: [240, 243, 246], fontStyle: 'bold', textColor: [30, 41, 59] }
        }
      ]);

      let typeSubtotal = 0;
      typeTransactions.forEach(t => {
        const desc = t.weekStart && t.weekEnd 
          ? `${t.description} (${t.weekStart.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${t.weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })})`
          : t.description;

        incomeRows.push([
          t.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
          getLabel(t.type),
          desc,
          `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);
        typeSubtotal += t.amount;
      });

      incomeRows.push([
        {
          content: `Subtotal ${getLabel(type as any)}`,
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] }
        },
        {
          content: `R$ ${typeSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          styles: { fontStyle: 'bold', fillColor: [250, 250, 250] }
        }
      ]);

      incomeTotal += typeSubtotal;
    });

    if (incomeRows.length > 0) {
      incomeRows.push([
        {
          content: 'TOTAL DAS ENTRADAS',
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 238, 220], textColor: [0, 100, 0] }
        },
        {
          content: `R$ ${incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          styles: { fontStyle: 'bold', fillColor: [220, 238, 220], textColor: [0, 100, 0] }
        }
      ]);
    }

    // Grouping logic for SAÍDAS
    const expenseTypes = ['combustivel', 'aluguel', 'saida'];
    const expenseRows: any[] = [];
    let expenseTotal = 0;

    expenseTypes.forEach(type => {
      const typeTransactions = reportTransactions.filter(t => t.type === type);
      if (typeTransactions.length === 0) return;

      expenseRows.push([
        {
          content: getLabel(type as any).toUpperCase(),
          colSpan: 4,
          styles: { fillColor: [246, 240, 240], fontStyle: 'bold', textColor: [59, 30, 30] }
        }
      ]);

      let typeSubtotal = 0;
      typeTransactions.forEach(t => {
        const desc = t.weekStart && t.weekEnd 
          ? `${t.description} (${t.weekStart.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${t.weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })})`
          : t.description;

        expenseRows.push([
          t.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
          getLabel(t.type),
          desc,
          `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);
        typeSubtotal += t.amount;
      });

      expenseRows.push([
        {
          content: `Subtotal ${getLabel(type as any)}`,
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] }
        },
        {
          content: `R$ ${typeSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          styles: { fontStyle: 'bold', fillColor: [250, 250, 250] }
        }
      ]);

      expenseTotal += typeSubtotal;
    });

    if (expenseRows.length > 0) {
      expenseRows.push([
        {
          content: 'TOTAL DAS SAÍDAS',
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [253, 232, 232], textColor: [150, 0, 0] }
        },
        {
          content: `R$ ${expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          styles: { fontStyle: 'bold', fillColor: [253, 232, 232], textColor: [150, 0, 0] }
        }
      ]);
    }

    let currentY = 73;

    // Render Entradas Table
    if (incomeRows.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // zinc-800
      doc.setFont('helvetica', 'bold');
      doc.text('1. ENTRADAS (RECEITAS)', 14, currentY);
      currentY += 6;

      autoTable(doc, {
        startY: currentY,
        head: [['Data', 'Tipo', 'Descrição', 'Valor']],
        body: incomeRows,
        headStyles: { fillColor: [40, 40, 40] },
        margin: { left: 14, right: 14 },
        theme: 'grid',
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text('Nenhuma entrada registrada no período.', 14, currentY);
      currentY += 10;
    }

    // Render Saídas Table
    if (expenseRows.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // zinc-800
      doc.setFont('helvetica', 'bold');
      doc.text('2. SAÍDAS (DESPESAS)', 14, currentY);
      currentY += 6;

      autoTable(doc, {
        startY: currentY,
        head: [['Data', 'Tipo', 'Descrição', 'Valor']],
        body: expenseRows,
        headStyles: { fillColor: [120, 30, 30] }, // Elegant dark red/maroon for expenses
        margin: { left: 14, right: 14 },
        theme: 'grid',
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text('Nenhuma saída registrada no período.', 14, currentY);
      currentY += 10;
    }

    doc.save(`Relatorio_${name.replace(/\s+/g, '_')}.pdf`);
  };

  const generateCSV = (name: string, startDate: Date, endDate: Date) => {
    const reportTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      return tDate >= start && tDate <= end;
    }).sort((a, b) => {
      const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return timeA - timeB;
    });

    const headers = ['Data', 'Tipo', 'Descrição', 'Valor (R$)'];
    const rows = reportTransactions.map(t => [
      t.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      getLabel(t.type),
      t.description.replace(/,/g, ';'), // Avoid CSV issues
      t.amount.toFixed(2).replace('.', ',')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_${name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCurrentCycle = (format: 'pdf' | 'csv') => {
    const start = new Date(customRange.start + 'T00:00:00Z');
    const end = new Date(customRange.end + 'T23:59:59Z');
    const name = `Relatorio_${customRange.start}_a_${customRange.end}`;
    if (format === 'pdf') generatePDF(name, start, end);
    else generateCSV(name, start, end);
  };

  const openReportModalWithCurrentCycle = () => {
    setReportName(`Relatório ${customRange.start} a ${customRange.end}`);
    setIsReportModalOpen(true);
  };

  const handleMonthSelect = (m: number, y: number) => {
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    setCustomRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
    
    // Auto-suggest report name based on month selection
    const monthNamesShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    setReportName(`${monthNamesShort[m]}/${y}`);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedType || !amount) return;

    const sanitizedAmount = amount.replace(',', '.');
    const sanitizedFuelPrice = fuelPrice.replace(',', '.');

    let finalAmount = parseFloat(sanitizedAmount);
    if (isNaN(finalAmount)) {
      setAlertMessage('Por favor, insira um valor válido.');
      return;
    }
    finalAmount = Math.round(finalAmount * 100) / 100;

    let finalDescription = description || (selectedType === 'entrada' ? 'Outras Entradas' : selectedType === 'saida' ? 'Outras Saídas' : selectedType.charAt(0).toUpperCase() + selectedType.slice(1));
    
    if (selectedType === 'combustivel') {
      const km = parseFloat(sanitizedAmount) || 0;
      const price = parseFloat(sanitizedFuelPrice) || 0;
      const kml = parseFloat(kmPerLiter) || 1;
      
      finalAmount = (price / kml) * km;
      finalAmount = Math.round(finalAmount * 100) / 100;
      finalDescription = `${finalDescription} (KM: ${Math.round(km * 100) / 100})`;
      
      if (fuelPrice) finalDescription = `${finalDescription} (Preço: R$ ${parseFloat(sanitizedFuelPrice).toFixed(2).replace('.', ',')}/L)`;
      finalDescription = `${finalDescription} (Consumo: ${kmPerLiter} Km/L)`;
    }

    const payload = {
      userId: user.uid,
      type: selectedType,
      amount: finalAmount,
      description: finalDescription,
      date: Timestamp.fromDate(parseUTCDate(date))
    };

    try {
      if (editingTransactionId) {
        await updateDoc(doc(db, `users/${user.uid}/transactions/${editingTransactionId}`), payload);
      } else {
        await addDoc(collection(db, `users/${user.uid}/transactions`), payload);
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingTransactionId ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/transactions`);
    }
  };

  const openModal = (type: Transaction['type']) => {
    setSelectedType(type);
    
    // Default date to today if within range, otherwise to range start
    const today = getLocalToday();
    if (today >= customRange.start && today <= customRange.end) {
      setDate(today);
    } else {
      setDate(customRange.start);
    }
    
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setAmount('');
    setDescription('');
    setFuelPrice('');
    setKmPerLiter('10');
    setDate(getLocalToday());
    setSelectedType(null);
    setEditingTransactionId(null);
  };

  const handleEditTransaction = (t: Transaction) => {
    setSelectedType(t.type);
    setDate(t.date.toISOString().split('T')[0]);
    
    if (t.type === 'combustivel') {
      const priceMatch = t.description.match(/\(Preço: R\$ (.*?)\/L\)/);
      const kmMatch = t.description.match(/\(Consumo: (.*?) Km\/L\)/);
      const kmDrivenMatch = t.description.match(/\(KM: (.*?)\)/);
      
      if (priceMatch) setFuelPrice(priceMatch[1]);
      if (kmMatch) setKmPerLiter(kmMatch[1]);
      if (kmDrivenMatch) {
        setAmount(kmDrivenMatch[1]);
      } else {
        setAmount(t.amount.toString());
      }
      
      let cleanDesc = t.description;
      if (priceMatch) cleanDesc = cleanDesc.replace(/\s*\(Preço: R\$ (.*?)\/L\)/, '');
      if (kmMatch) cleanDesc = cleanDesc.replace(/\s*\(Consumo: (.*?) Km\/L\)/, '');
      if (kmDrivenMatch) cleanDesc = cleanDesc.replace(/\s*\(KM: (.*?)\)/, '');
      setDescription(cleanDesc);
    } else {
      setAmount(t.amount.toString());
      setDescription(t.description);
    }

    setEditingTransactionId(t.id);
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    setConfirmModal({
      message: 'Tem certeza que deseja excluir este registro?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, `users/${user.uid}/transactions/${id}`));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/transactions/${id}`);
        }
        setConfirmModal(null);
      }
    });
  };

  const getIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'uber': return <Car className="w-7 h-7 text-black" />;
      case '99': return <Car className="w-7 h-7 text-yellow-500" />;
      case 'combustivel': return <Fuel className="w-7 h-7 text-red-500" />;
      case 'aluguel': return (
        <div className="flex items-center justify-center bg-[#FF6600] rounded-lg w-7 h-7">
          <span className="text-white font-black text-[12px] italic">M</span>
        </div>
      );
      case 'gorjeta':
      case 'entrada': return <DollarSign className="w-7 h-7 text-emerald-500" />;
      case 'saida': return <PlusCircle className="w-7 h-7 text-red-500" />;
    }
  };

  const getLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'uber': return 'Uber Diário';
      case '99': return '99 Diário';
      case 'combustivel': return 'Combustível Diário';
      case 'aluguel': return 'Aluguel Diário';
      case 'gorjeta': return 'Gorjetas';
      case 'entrada': return 'Entrada';
      case 'saida': return 'Saída';
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-6 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/95">
        <div className={`${isDesktopLayout ? 'max-w-[1720px]' : 'max-w-md'} mx-auto flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-zinc-900 leading-none">FINANÇAS DRIVER</h1>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Painel de Controle</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* Layout Toggle Button */}
            <button
              onClick={toggleLayout}
              className="p-2.5 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 hover:text-zinc-900 transition-all active:scale-95 border border-zinc-200 flex items-center gap-1.5 font-bold text-xs shadow-sm cursor-pointer"
              title={isDesktopLayout ? "Visualizar no celular" : "Visualizar no PC (Tela Cheia)"}
            >
              {isDesktopLayout ? <Smartphone className="w-4 h-4 text-zinc-600" /> : <Monitor className="w-4 h-4 text-zinc-600" />}
              <span className="hidden sm:inline">
                {isDesktopLayout ? "Modo Celular" : "Modo PC"}
              </span>
            </button>

            <select 
              value={selectedYear}
              onChange={(e) => {
                const y = parseInt(e.target.value);
                setSelectedYear(y);
                if (!activeReportId) {
                  const start = `${y}-01-01`;
                  const end = `${y}-12-31`;
                  setCustomRange({ start, end });
                }
              }}
              className="px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all outline-none shadow-sm cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button 
              onClick={logout}
              className="p-2.5 bg-zinc-100 text-zinc-500 rounded-xl hover:bg-zinc-200 hover:text-red-600 transition-all active:scale-95 border border-zinc-200 shadow-sm cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {isDesktopLayout ? (
        /* ==================== MODERN PC FULL-SCREEN DASHBOARD ==================== */
        <main className="max-w-[1720px] mx-auto px-6 mt-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
              <p className="text-sm text-zinc-500 font-medium">Carregando dados...</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT SIDEBAR PANEL: Financial Summaries & Controls */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Financial Summary Section (Destaque do Saldo & Ganhos/Gastos) */}
                <div className="bg-white p-6 rounded-[32px] border border-zinc-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">Resumo do Período</h3>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      balance >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {balance >= 0 ? 'Saldo Positivo' : 'Saldo Negativo'}
                    </span>
                  </div>

                  {/* Saldo do Período Card with Better Highlighting & Dynamic Colors */}
                  <div className={`p-6 rounded-[24px] border transition-all ${
                    balance >= 0 
                      ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-sm shadow-blue-50/50' 
                      : 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm shadow-rose-50/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Wallet className={`w-5 h-5 ${balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`} />
                      <p className={`text-xs font-bold uppercase tracking-wide ${balance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                        Saldo Atual do Período
                      </p>
                    </div>
                    <span className={`text-4xl font-black tracking-tight block ${balance >= 0 ? 'text-blue-900' : 'text-rose-900'}`}>
                      R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Ganhos vs Gastos Side-by-Side widgets */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-5 rounded-[24px] border border-emerald-100 shadow-sm">
                      <div className="flex items-center gap-2 text-emerald-600 mb-2">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-wide">Ganhos</span>
                      </div>
                      <span className="text-2xl font-black text-emerald-700 block">
                        R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-[10px] text-emerald-600 font-bold mt-1 uppercase tracking-wider">
                        Entradas
                      </p>
                    </div>
                    
                    <div className="bg-red-50 p-5 rounded-[24px] border border-red-100 shadow-sm">
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <TrendingDown className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-wide">Gastos</span>
                      </div>
                      <span className="text-2xl font-black text-red-700 block">
                        R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-[10px] text-red-600 font-bold mt-1 uppercase tracking-wider">
                        Saídas
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Launch & Report Actions Bento Card */}
                <div className="bg-white p-6 rounded-[32px] border border-zinc-200 shadow-sm space-y-6">
                  {/* Modern Quick Launch Grid */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Lançamento Rápido</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => openModal('uber')}
                        className="flex flex-col items-center justify-center py-4 bg-slate-800 text-white rounded-2xl shadow-sm hover:bg-slate-900 transition-all active:scale-95 border border-slate-700 cursor-pointer"
                      >
                        <Car className="w-5 h-5 mb-1 text-white" />
                        <span className="text-[11px] font-black tracking-tighter leading-none">Uber</span>
                      </button>
                      
                      <button 
                        onClick={() => openModal('99')}
                        className="flex flex-col items-center justify-center py-4 bg-yellow-400 text-zinc-900 rounded-2xl shadow-sm hover:bg-yellow-500 transition-all active:scale-95 border border-yellow-500 cursor-pointer"
                      >
                        <Car className="w-5 h-5 mb-1 text-zinc-900" />
                        <span className="text-[11px] font-black italic tracking-tighter leading-none">99</span>
                      </button>

                      <button 
                        onClick={() => openModal('combustivel')}
                        className="flex flex-col items-center justify-center py-4 bg-indigo-500 text-white rounded-2xl shadow-sm hover:bg-indigo-600 transition-all active:scale-95 cursor-pointer"
                      >
                        <Fuel className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-bold">Combustível</span>
                      </button>

                      <button 
                        onClick={() => openModal('gorjeta')}
                        className="flex flex-col items-center justify-center py-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:bg-emerald-600 transition-all active:scale-95 cursor-pointer"
                      >
                        <DollarSign className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-bold">Gorjeta</span>
                      </button>

                      <button 
                        onClick={() => openModal('aluguel')}
                        className="flex flex-col items-center justify-center py-4 bg-orange-500 text-white rounded-2xl shadow-sm hover:bg-orange-600 transition-all active:scale-95 cursor-pointer"
                      >
                        <span className="text-sm font-black italic leading-none mb-1">M</span>
                        <span className="text-[11px] font-bold">Aluguel</span>
                      </button>

                      <button 
                        onClick={() => openModal('saida')}
                        className="flex flex-col items-center justify-center py-4 bg-white text-zinc-900 rounded-2xl shadow-sm hover:bg-zinc-50 transition-all active:scale-95 border border-zinc-200 cursor-pointer"
                      >
                        <PlusCircle className="w-5 h-5 mb-1 text-red-500" />
                        <span className="text-[11px] font-bold">Outros</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions & Exporters */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
                    <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200 flex-1">
                      <button 
                        onClick={() => handleDownloadCurrentCycle('pdf')}
                        className="flex-1 py-2 text-zinc-600 hover:text-zinc-900 hover:bg-white rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
                        title="Baixar PDF"
                      >
                        <FileText className="w-4 h-4" />
                        PDF
                      </button>
                      <div className="w-px h-4 bg-zinc-200 self-center mx-1" />
                      <button 
                        onClick={() => handleDownloadCurrentCycle('csv')}
                        className="flex-1 py-2 text-zinc-600 hover:text-zinc-900 hover:bg-white rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
                        title="Baixar CSV"
                      >
                        <Download className="w-4 h-4" />
                        CSV
                      </button>
                    </div>
                    
                    <button 
                      onClick={openReportModalWithCurrentCycle}
                      className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-sm shadow-indigo-100 flex items-center gap-1.5 font-bold text-xs px-4 cursor-pointer"
                      title="Salvar como Relatório"
                    >
                      <Save className="w-4 h-4" />
                      Salvar
                    </button>
                    <button 
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="p-3 bg-zinc-100 text-zinc-500 rounded-2xl hover:bg-zinc-200 hover:text-zinc-900 transition-all active:scale-95 border border-zinc-200 cursor-pointer"
                      title="Histórico de Relatórios"
                    >
                      <History className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Saved Cycles Bento Card moved to the bottom of the PC dashboard layout */}

              </div>

              {/* RIGHT SIDE: Active Period Banner & Dynamic Transaction Lists */}
              <div className="lg:col-span-9 space-y-6">
                
                {/* Active Period with integrated Report Cycles Carousel */}
                <div className="bg-white border border-zinc-200 p-5 rounded-[32px] shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 text-zinc-900">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100/40">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Período de Análise Ativo</p>
                        <p className="text-base font-black text-zinc-900 leading-tight">
                          {!activeReportId 
                            ? `Geral de 01/01/${selectedYear} a 31/12/${selectedYear}`
                            : `Ciclo: ${reports.find(r => r.id === activeReportId)?.name || 'Personalizado'}`
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {activeReportId && (
                        <button 
                          onClick={clearFilter}
                          className="text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 py-2.5 px-4 rounded-xl border border-zinc-200 transition-all hover:shadow-sm cursor-pointer flex items-center gap-1.5"
                        >
                          Voltar ao Anual
                        </button>
                      )}
                      <button 
                        onClick={() => setIsCycleModalOpen(true)}
                        className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2.5 px-4 rounded-xl transition-all shadow-sm shadow-indigo-100 cursor-pointer flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-4 h-4" /> Criar Ciclo
                      </button>
                    </div>
                  </div>

                  {/* Carousel row */}
                  <div className="pt-3.5 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                        <span>Seus Ciclos de Relatório</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      </p>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider hidden sm:inline">Use Scroll Horizontal ⇄</span>
                    </div>
                    
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5 no-scrollbar scroll-smooth">
                      {/* Annual */}
                      <button
                        onClick={clearFilter}
                        className={`flex-shrink-0 px-4 py-3 rounded-xl border-2 transition-all text-left flex flex-col justify-between w-[180px] cursor-pointer group ${
                          !activeReportId 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-[1.01]' 
                            : 'bg-zinc-50 border-zinc-100 text-zinc-600 hover:bg-white hover:border-indigo-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className={`text-[8px] font-black uppercase tracking-wider ${!activeReportId ? 'text-indigo-200' : 'text-zinc-400'}`}>
                            Visão Geral {selectedYear}
                          </span>
                          {!activeReportId && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </div>
                        <div className="mt-1.5 truncate w-full">
                          <p className={`text-xs font-black truncate leading-tight ${!activeReportId ? 'text-white' : 'text-zinc-800'}`}>
                            Ano Completo
                          </p>
                          <p className={`text-[10px] font-bold mt-0.5 truncate ${!activeReportId ? 'text-indigo-100 opacity-90' : 'text-zinc-400'}`}>
                            01/01 a 31/12
                          </p>
                        </div>
                      </button>

                      {/* Saved Reports */}
                      {reports.map((report) => {
                        const isActive = activeReportId === report.id;
                        return (
                          <button
                            key={report.id}
                            onClick={() => selectReport(report)}
                            className={`flex-shrink-0 px-4 py-3 rounded-xl border-2 transition-all text-left flex flex-col justify-between w-[180px] cursor-pointer group ${
                              isActive 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-[1.01]' 
                                : 'bg-zinc-50 border-zinc-100 text-zinc-600 hover:bg-white hover:border-indigo-200 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start w-full">
                              <span className={`text-[8px] font-black uppercase tracking-wider truncate max-w-[120px] ${isActive ? 'text-indigo-200' : 'text-indigo-400'}`}>
                                Ciclo Gravado
                              </span>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            </div>
                            <div className="mt-1.5 truncate w-full">
                              <p className={`text-xs font-black truncate leading-tight ${isActive ? 'text-white' : 'text-zinc-800'}`}>
                                {report.name}
                              </p>
                              <p className={`text-[10px] font-bold mt-0.5 truncate ${isActive ? 'text-indigo-100 opacity-90' : 'text-zinc-400'}`}>
                                {report.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })} a {report.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 4 Columns Grid for Transactions */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                  
                  {/* CARD 1: UBER */}
                  <div className="bg-white p-5 rounded-[28px] border border-zinc-200 shadow-sm flex flex-col h-[580px]">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center">
                        <Car className="w-4 h-4 text-white" />
                      </div>
                      <h2 className="text-sm font-black text-zinc-800 uppercase tracking-wider">Uber</h2>
                    </div>

                    {/* Highlighted Total */}
                    <div className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl mb-4 flex flex-col justify-between shadow-sm">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Ganhos Uber</span>
                      <span className="text-xl font-black tracking-tight mt-1">
                        R$ {totalUberOnly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Transaction List */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6 no-scrollbar">
                      {uberGrouped.length === 0 ? (
                        <div className="text-center py-16">
                          <p className="text-zinc-400 text-xs font-medium">Nenhum registro de Uber neste período.</p>
                        </div>
                      ) : (
                        uberGrouped.map((group) => (
                          <div key={group.weekKey} className="space-y-3">
                            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                              <span className="bg-zinc-100 text-zinc-600 py-0.5 px-2 rounded font-bold">{group.weekLabel}</span>
                              <div className="h-[1px] flex-1 bg-zinc-100" />
                            </h3>
                            <div className="space-y-2">
                              {group.transactions.map((t) => (
                                <motion.div 
                                  layout
                                  key={t.id}
                                  className="bg-zinc-50/40 p-3 rounded-xl flex items-center justify-between group hover:shadow-sm hover:bg-white transition-all border border-zinc-100"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-zinc-100 shrink-0">
                                      {getIcon(t.type)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-zinc-900 leading-none mb-1 truncate text-xs">{getLabel(t.type)}</p>
                                      {t.description && t.description !== getLabel(t.type) && (
                                        <p className="text-[9px] text-zinc-500 italic truncate max-w-[120px]" title={t.description}>{t.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="text-right">
                                      <p className="font-black text-xs text-emerald-600">
                                        + R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleEditTransaction(t)}
                                        className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-all cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteTransaction(t.id)}
                                        className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* CARD 2: 99 */}
                  <div className="bg-white p-5 rounded-[28px] border border-zinc-200 shadow-sm flex flex-col h-[580px]">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center">
                        <Car className="w-4 h-4 text-zinc-900" />
                      </div>
                      <h2 className="text-sm font-black text-zinc-800 uppercase tracking-wider">99</h2>
                    </div>

                    {/* Highlighted Total */}
                    <div className="bg-yellow-400 border border-yellow-500 text-yellow-950 p-4 rounded-2xl mb-4 flex flex-col justify-between shadow-sm">
                      <span className="text-[10px] font-bold text-yellow-900 uppercase tracking-widest">Total Ganhos 99</span>
                      <span className="text-xl font-black tracking-tight mt-1">
                        R$ {total99Only.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Transaction List */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6 no-scrollbar">
                      {group99Grouped.length === 0 ? (
                        <div className="text-center py-16">
                          <p className="text-zinc-400 text-xs font-medium">Nenhum registro de 99 neste período.</p>
                        </div>
                      ) : (
                        group99Grouped.map((group) => (
                          <div key={group.weekKey} className="space-y-3">
                            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                              <span className="bg-zinc-100 text-zinc-600 py-0.5 px-2 rounded font-bold">{group.weekLabel}</span>
                              <div className="h-[1px] flex-1 bg-zinc-100" />
                            </h3>
                            <div className="space-y-2">
                              {group.transactions.map((t) => (
                                <motion.div 
                                  layout
                                  key={t.id}
                                  className="bg-zinc-50/40 p-3 rounded-xl flex items-center justify-between group hover:shadow-sm hover:bg-white transition-all border border-zinc-100"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-zinc-100 shrink-0">
                                      {getIcon(t.type)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-zinc-900 leading-none mb-1 truncate text-xs">{getLabel(t.type)}</p>
                                      {t.description && t.description !== getLabel(t.type) && (
                                        <p className="text-[9px] text-zinc-500 italic truncate max-w-[120px]" title={t.description}>{t.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="text-right">
                                      <p className="font-black text-xs text-emerald-600">
                                        + R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleEditTransaction(t)}
                                        className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-all cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteTransaction(t.id)}
                                        className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* CARD 3: COMBUSTÍVEL */}
                  <div className="bg-white p-5 rounded-[28px] border border-zinc-200 shadow-sm flex flex-col h-[580px]">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <Fuel className="w-4 h-4 text-red-600" />
                      </div>
                      <h2 className="text-sm font-black text-zinc-800 uppercase tracking-wider">Combustível</h2>
                    </div>

                    {/* Highlighted Total */}
                    <div className="bg-red-50 border border-red-200 text-red-955 p-4 rounded-2xl mb-4 flex flex-col justify-between shadow-sm">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Total Combustível</span>
                      <span className="text-xl font-black tracking-tight mt-1">
                        R$ {totalCombustivelOnly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Transaction List */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6 no-scrollbar">
                      {combustivelGrouped.length === 0 ? (
                        <div className="text-center py-16">
                          <p className="text-zinc-400 text-xs font-medium">Nenhum registro de Combustível neste período.</p>
                        </div>
                      ) : (
                        combustivelGrouped.map((group) => (
                          <div key={group.weekKey} className="space-y-3">
                            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                              <span className="bg-zinc-100 text-zinc-600 py-0.5 px-2 rounded font-bold">{group.weekLabel}</span>
                              <div className="h-[1px] flex-1 bg-zinc-100" />
                            </h3>
                            <div className="space-y-2">
                              {group.transactions.map((t) => (
                                <motion.div 
                                  layout
                                  key={t.id}
                                  className="bg-zinc-50/40 p-3 rounded-xl flex items-center justify-between group hover:shadow-sm hover:bg-white transition-all border border-zinc-100"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-zinc-100 shrink-0">
                                      {getIcon(t.type)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-zinc-900 leading-none mb-1 truncate text-xs">{getLabel(t.type)}</p>
                                      {t.description && t.description !== getLabel(t.type) && (
                                        <p className="text-[9px] text-zinc-500 italic truncate max-w-[120px]" title={t.description}>{t.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="text-right">
                                      <p className="font-black text-xs text-zinc-950">
                                        - R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleEditTransaction(t)}
                                        className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-all cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteTransaction(t.id)}
                                        className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* CARD 4: RESTANTE */}
                  <div className="bg-white p-5 rounded-[28px] border border-zinc-200 shadow-sm flex flex-col h-[580px]">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h2 className="text-sm font-black text-zinc-800 uppercase tracking-wider">Restante</h2>
                    </div>

                    {/* Highlighted Total */}
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-4 flex flex-col justify-between shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Saldo Restante</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          totalRestanteNet >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {totalRestanteNet >= 0 ? 'Saldo +' : 'Saldo -'}
                        </span>
                      </div>
                      <span className={`text-xl font-black tracking-tight ${totalRestanteNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        R$ {totalRestanteNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      
                      <div className="mt-2 pt-2 border-t border-indigo-100/60 flex justify-between items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-zinc-400 uppercase">Ganhos</span>
                          <span className="text-[10px] font-black text-emerald-600">
                            + R$ {totalRestanteGanhos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="w-px h-5 bg-indigo-100/60" />
                        <div className="flex flex-col text-right">
                          <span className="text-[8px] font-bold text-zinc-400 uppercase">Gastos</span>
                          <span className="text-[10px] font-black text-rose-600">
                            - R$ {totalRestanteGastos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction List */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6 no-scrollbar">
                      {restanteGrouped.length === 0 ? (
                        <div className="text-center py-16">
                          <p className="text-zinc-400 text-xs font-medium">Nenhum outro registro neste período.</p>
                        </div>
                      ) : (
                        restanteGrouped.map((group) => (
                          <div key={group.weekKey} className="space-y-3">
                            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                              <span className="bg-zinc-100 text-zinc-600 py-0.5 px-2 rounded font-bold">{group.weekLabel}</span>
                              <div className="h-[1px] flex-1 bg-zinc-100" />
                            </h3>
                            <div className="space-y-2">
                              {group.transactions.map((t) => (
                                <motion.div 
                                  layout
                                  key={t.id}
                                  className="bg-zinc-50/40 p-3 rounded-xl flex items-center justify-between group hover:shadow-sm hover:bg-white transition-all border border-zinc-100"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-zinc-100 shrink-0">
                                      {getIcon(t.type)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-zinc-900 leading-none mb-1 truncate text-xs">{getLabel(t.type)}</p>
                                      {t.description && t.description !== getLabel(t.type) && (
                                        <p className="text-[9px] text-zinc-500 italic truncate max-w-[120px]" title={t.description}>{t.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="text-right">
                                      <p className={`font-black text-xs ${['aluguel', 'saida'].includes(t.type) ? 'text-zinc-950' : 'text-emerald-600'}`}>
                                        {['aluguel', 'saida'].includes(t.type) ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleEditTransaction(t)}
                                        className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-all cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteTransaction(t.id)}
                                        className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}
      </main>
      ) : (
        /* ==================== PERFECT MOBILE-FIRST MOBILE VIEW ==================== */
        <>
          <header className="bg-white border-b border-zinc-200 px-6 pb-8 pt-4">
            <div className="max-w-md mx-auto">
              {/* Compact Quick Actions */}
              <div className="w-full overflow-x-auto pb-6 no-scrollbar">
                <div className="flex gap-2 px-1">
                  <button 
                    onClick={() => openModal('uber')}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-slate-800 text-white rounded-2xl shadow-sm hover:bg-slate-900 transition-all active:scale-95 border border-slate-700 cursor-pointer"
                  >
                    <span className="text-xs font-black tracking-tighter leading-none mb-1">Uber</span>
                    <span className="text-[8px] font-bold opacity-60 uppercase">Diário</span>
                  </button>
                  
                  <button 
                    onClick={() => openModal('99')}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-yellow-400 text-zinc-900 rounded-2xl shadow-sm hover:bg-yellow-500 transition-all active:scale-95 border border-yellow-500 cursor-pointer"
                  >
                    <span className="text-xs font-black italic tracking-tighter leading-none mb-1">99</span>
                    <span className="text-[8px] font-bold opacity-60 uppercase">Diário</span>
                  </button>

                  <button 
                    onClick={() => openModal('combustivel')}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-indigo-500 text-white rounded-2xl shadow-sm hover:bg-indigo-600 transition-all active:scale-95 cursor-pointer"
                  >
                    <Fuel className="w-5 h-5 mb-1" />
                    <span className="text-[8px] font-bold opacity-60 uppercase">Combust.</span>
                  </button>

                  <button 
                    onClick={() => openModal('gorjeta')}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-emerald-500 text-white rounded-2xl shadow-sm hover:bg-emerald-600 transition-all active:scale-95 cursor-pointer"
                  >
                    <DollarSign className="w-5 h-5 mb-1" />
                    <span className="text-[8px] font-bold opacity-60 uppercase">Gorjeta</span>
                  </button>

                  <button 
                    onClick={() => openModal('aluguel')}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-orange-500 text-white rounded-2xl shadow-sm hover:bg-orange-600 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="text-xs font-black italic mb-1">M</span>
                    <span className="text-[8px] font-bold opacity-60 uppercase">Aluguel</span>
                  </button>

                  <button 
                    onClick={() => openModal('saida')}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-white text-zinc-900 rounded-2xl shadow-sm hover:bg-zinc-50 transition-all active:scale-95 border border-zinc-100 cursor-pointer"
                  >
                    <PlusCircle className="w-5 h-5 mb-1 text-red-500" />
                    <span className="text-[8px] font-bold opacity-60 uppercase">Outros</span>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col items-center mb-6">
                <button 
                  onClick={() => setIsCycleModalOpen(true)}
                  className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 mb-6 cursor-pointer"
                >
                  <Calendar className="w-5 h-5" />
                  Selecionar Ciclo (Início e Fim)
                </button>

                <div className="w-full overflow-x-auto pb-4 no-scrollbar">
                  <div className="flex gap-3 px-1">
                    {/* Default/Current Month Card */}
                    <button
                      onClick={clearFilter}
                      className={`flex-shrink-0 w-44 p-5 rounded-[24px] border-2 transition-all text-left relative overflow-hidden group cursor-pointer ${
                        !activeReportId 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                          : 'bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200 shadow-sm'
                      }`}
                    >
                      {!activeReportId && (
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/20 rounded-full blur-2xl animate-pulse" />
                      )}
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Anual</p>
                      <p className="text-base font-black leading-tight mb-1">Visão Geral {selectedYear}</p>
                      <p className="text-[11px] font-bold opacity-50">
                        01/01/{selectedYear} - 31/12/{selectedYear}
                      </p>
                    </button>

                    {/* Saved Reports Carousel */}
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => selectReport(report)}
                        className={`flex-shrink-0 w-44 p-5 rounded-[24px] border-2 transition-all text-left relative overflow-hidden group cursor-pointer ${
                          activeReportId === report.id 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                            : 'bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200 shadow-sm'
                        }`}
                      >
                        {activeReportId === report.id && (
                          <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/20 rounded-full blur-2xl animate-pulse" />
                        )}
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Ciclo</p>
                        <p className="text-base font-black leading-tight mb-1 truncate">{report.name}</p>
                        <p className="text-[11px] font-bold opacity-40">
                          {report.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })} - {report.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resumo Financeiro Mobile (Destaque do Saldo & Ganhos/Gastos) */}
              <div className="mt-8 space-y-4">
                {/* Saldo do Período - Highlighting Blue if Positive, Red/Rose if Negative */}
                <div className={`p-5 rounded-3xl border transition-all ${
                  balance >= 0 
                    ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-sm shadow-blue-50/50' 
                    : 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm shadow-rose-50/50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wallet className={`w-4 h-4 ${balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-wider ${balance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                        Saldo do Período
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      balance >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {balance >= 0 ? 'Positivo' : 'Negativo'}
                    </span>
                  </div>
                  <span className={`text-3xl font-black tracking-tight block ${balance >= 0 ? 'text-blue-900' : 'text-rose-900'}`}>
                    R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Ganhos vs Gastos Side-by-Side Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Ganhos</span>
                    </div>
                    <span className="text-xl font-bold text-emerald-700 block">
                      R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
                    <div className="flex items-center gap-1.5 text-red-600 mb-1">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Gastos</span>
                    </div>
                    <span className="text-xl font-bold text-red-700 block">
                      R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Export / Report Actions Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200 flex-1 shadow-sm">
                    <button 
                      onClick={() => handleDownloadCurrentCycle('pdf')}
                      className="flex-1 py-2 px-2 text-zinc-600 hover:text-zinc-900 hover:bg-white rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                      title="Baixar PDF"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                    <div className="w-px h-4 bg-zinc-200 self-center mx-1" />
                    <button 
                      onClick={() => handleDownloadCurrentCycle('csv')}
                      className="flex-1 py-2 px-2 text-zinc-600 hover:text-zinc-900 hover:bg-white rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                      title="Baixar CSV"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                  </div>
                  <button 
                    onClick={openReportModalWithCurrentCycle}
                    className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-md shadow-indigo-100 cursor-pointer"
                    title="Salvar como Relatório"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsHistoryModalOpen(true)}
                    className="p-3 bg-zinc-100 text-zinc-500 rounded-2xl hover:bg-zinc-200 hover:text-zinc-900 transition-all active:scale-95 border border-zinc-200 shadow-sm cursor-pointer"
                    title="Histórico de Relatórios"
                  >
                    <History className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-md mx-auto px-6 mt-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
                <p className="text-sm text-zinc-500 font-medium">Carregando dados...</p>
              </div>
            ) : (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Histórico</h2>
                  {customRange && (
                    <button 
                      onClick={clearFilter}
                      className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Limpar Filtro
                    </button>
                  )}
                </div>
                
                <div className="space-y-10">
                  {groupedTransactions.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-zinc-100 shadow-sm">
                      <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-6 h-6 text-zinc-300" />
                      </div>
                      <p className="text-zinc-400 text-sm font-medium">Nenhum registro encontrado.</p>
                    </div>
                  ) : (
                    groupedTransactions.map((group) => (
                      <div key={group.weekKey}>
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <div className="h-[1px] flex-1 bg-zinc-100" />
                          {group.weekLabel}
                          <div className="h-[1px] flex-1 bg-zinc-100" />
                        </h3>
                        <div className="space-y-3">
                          {group.transactions.map((t) => (
                            <motion.div 
                              layout
                              key={t.id}
                              className="bg-white p-4 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all border border-zinc-100"
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center group-hover:bg-zinc-100 transition-colors shrink-0">
                                  {getIcon(t.type)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-zinc-900 leading-tight mb-0.5 truncate">{getLabel(t.type)}</p>
                                  <p className="text-xs text-zinc-400 font-medium">
                                    {t.weekStart && t.weekEnd 
                                      ? `${t.weekStart.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${t.weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                                      : t.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                  </p>
                                  {t.description && t.description !== getLabel(t.type) && (
                                    <p className="text-[10px] text-zinc-400 mt-1 italic truncate">{t.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                  <p className={`font-bold text-lg tracking-tight ${['combustivel', 'aluguel', 'saida'].includes(t.type) ? 'text-zinc-900' : 'text-emerald-600'}`}>
                                    {['combustivel', 'aluguel', 'saida'].includes(t.type) ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleEditTransaction(t)}
                                    className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all active:bg-zinc-100 cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteTransaction(t.id)}
                                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:bg-red-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </main>
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
                    {selectedType && getIcon(selectedType)}
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900">
                    {editingTransactionId ? 'Editar' : 'Novo'} {
                      (selectedType === 'entrada' || selectedType === 'saida') 
                      ? 'Lançamento' 
                      : selectedType && getLabel(selectedType)
                    }
                  </h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    {selectedType === 'combustivel' ? 'KM Rodados' : 'Valor (R$)'}
                  </label>
                  <input 
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full text-4xl font-bold tracking-tight text-zinc-900 placeholder:text-zinc-100 focus:outline-none bg-transparent"
                    required
                  />
                </div>

                {(selectedType === 'entrada' || selectedType === 'saida') && (
                  <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
                    <button 
                      type="button"
                      onClick={() => setSelectedType('entrada')}
                      className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                        selectedType === 'entrada' 
                        ? 'bg-emerald-500 text-white shadow-md' 
                        : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Entrada
                    </button>
                    <button 
                      type="button"
                      onClick={() => setSelectedType('saida')}
                      className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                        selectedType === 'saida' 
                        ? 'bg-red-500 text-white shadow-md' 
                        : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Saída
                    </button>
                  </div>
                )}

                {selectedType === 'combustivel' && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Preço/L (R$)</label>
                      <input 
                        type="text"
                        inputMode="decimal"
                        value={fuelPrice}
                        onChange={(e) => setFuelPrice(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-transparent font-bold text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Km/L</label>
                      <input 
                        type="number"
                        value={kmPerLiter}
                        onChange={(e) => setKmPerLiter(e.target.value)}
                        className="w-full bg-transparent font-bold text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Data</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Descrição (Opcional)</label>
                    <input 
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Corrida extra, Bônus..."
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all active:scale-95 shadow-xl mt-4"
                >
                  {editingTransactionId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-zinc-900">Salvar Relatório</h2>
                <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleAddReport} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Nome do Relatório</label>
                  <input 
                    autoFocus
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="Ex: Janeiro 2025"
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                    required
                  />
                </div>

                {customRange && (
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Período</p>
                    <p className="text-sm font-bold text-zinc-900">
                      {new Date(customRange.start + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até {new Date(customRange.end + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all active:scale-95 shadow-xl"
                >
                  Salvar Relatório
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] flex flex-col no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-zinc-900">Relatórios Salvos</h2>
                <div className="flex gap-2">
                  {reports.length > 0 && (
                    <button 
                      onClick={() => {
                        setConfirmModal({
                          message: 'Deseja excluir TODOS os ciclos salvos? Esta ação não pode ser desfeita.',
                          onConfirm: async () => {
                            try {
                              for (const report of reports) {
                                await deleteDoc(doc(db, `users/${user.uid}/reports/${report.id}`));
                              }
                              setAlertMessage('Todos os ciclos foram excluídos.');
                            } catch (err) {
                              handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/reports`);
                            }
                            setConfirmModal(null);
                          }
                        });
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                      <Trash2 className="w-4 h-4" />
                      Limpar Tudo
                    </button>
                  )}
                  <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {reports.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-zinc-400 text-sm font-medium">Nenhum relatório salvo.</p>
                  </div>
                ) : (
                  reports.map(report => (
                    <div 
                      key={report.id}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group ${activeReportId === report.id ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-100 hover:border-zinc-300'}`}
                      onClick={() => {
                        selectReport(report);
                        setIsHistoryModalOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold">{report.name}</h3>
                          <p className={`text-[10px] uppercase font-bold tracking-widest ${activeReportId === report.id ? 'text-zinc-400' : 'text-zinc-400'}`}>
                            {report.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - {report.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePDF(report.name, report.startDate, report.endDate);
                            }}
                            className={`px-2 py-2 rounded-xl transition-all flex items-center gap-1 text-[10px] font-bold ${activeReportId === report.id ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-50 text-zinc-400 hover:text-zinc-900'}`}
                          >
                            <FileText className="w-3 h-3" />
                            PDF
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              generateCSV(report.name, report.startDate, report.endDate);
                            }}
                            className={`px-2 py-2 rounded-xl transition-all flex items-center gap-1 text-[10px] font-bold ${activeReportId === report.id ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-50 text-zinc-400 hover:text-zinc-900'}`}
                          >
                            <Download className="w-3 h-3" />
                            CSV
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteReport(report.id);
                            }}
                            className={`p-2 rounded-xl transition-all ${activeReportId === report.id ? 'bg-zinc-800 text-white hover:bg-red-500' : 'bg-zinc-50 text-zinc-400 hover:text-red-600'}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isCycleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCycleModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-zinc-900">Selecionar Ciclo</h2>
                <button onClick={() => setIsCycleModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Selecionar Mês Fechado</label>
                  <div className="grid grid-cols-2 gap-4">
                    <select 
                      value={selectedMonth}
                      onChange={(e) => {
                        const m = parseInt(e.target.value);
                        setSelectedMonth(m);
                        handleMonthSelect(m, selectedYear);
                      }}
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                    >
                      {months.map((m, i) => (
                        <option key={i} value={i}>{m}</option>
                      ))}
                    </select>
                    <select 
                      value={selectedYear}
                      onChange={(e) => {
                        const y = parseInt(e.target.value);
                        setSelectedYear(y);
                        handleMonthSelect(selectedMonth, y);
                      }}
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                    >
                      {[2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-zinc-400 font-bold tracking-widest">Ou Período Personalizado</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Data de Início</label>
                    <input 
                      type="date"
                      value={customRange.start}
                      onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Data de Fim</label>
                    <input 
                      type="date"
                      value={customRange.end}
                      onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-zinc-400 font-bold tracking-widest">Salvar como Ciclo</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Nome do Ciclo</label>
                  <input 
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="Ex: Jan/2026 ou Semana 1"
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsCycleModalOpen(false)}
                    className="w-full py-5 bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    Visualizar
                  </button>
                  <button 
                    onClick={async (e) => {
                      if (!reportName) {
                        setAlertMessage('Por favor, dê um nome ao ciclo.');
                        return;
                      }
                      await handleAddReport(e as any);
                      setIsCycleModalOpen(false);
                    }}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-100"
                  >
                    Salvar Ciclo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {alertMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setAlertMessage(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl text-center">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-zinc-900" />
              </div>
              <p className="text-zinc-900 font-bold mb-6">{alertMessage}</p>
              <button onClick={() => setAlertMessage(null)} className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold">OK</button>
            </motion.div>
          </div>
        )}

        {confirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl text-center">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-zinc-900 font-bold mb-6">{confirmModal.message}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmModal(null)} className="py-3 bg-zinc-100 text-zinc-900 rounded-xl font-bold">Cancelar</button>
                <button onClick={confirmModal.onConfirm} className="py-3 bg-red-600 text-white rounded-xl font-bold">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
