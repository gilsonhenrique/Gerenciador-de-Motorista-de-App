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
  type: 'uber' | '99' | 'combustivel' | 'gorjeta' | 'entrada' | 'aluguel';
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
        <p className="text-zinc-500 text-sm mb-10 font-medium">Controle seus ganhos e gastos de forma profissional.</p>
        
        <button 
          onClick={signInWithGoogle}
          className="w-full py-4 px-6 bg-white border-2 border-zinc-200 text-zinc-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Entrar com Google
        </button>
        
        <p className="mt-8 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
          Seguro & Confiável • Powered by Firebase
        </p>
      </motion.div>
    </div>
  );
}

// --- Main App Component ---

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
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string, onConfirm: () => void } | null>(null);

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
    const reportsQuery = query(
      collection(db, `users/${user.uid}/reports`),
      orderBy('createdAt', 'desc')
    );
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
      'combustivel': 5,
      'aluguel': 6
    };

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
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

  const totalIncome = filteredTransactions
    .filter(t => ['uber', '99', 'gorjeta', 'entrada'].includes(t.type))
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalExpenses = filteredTransactions
    .filter(t => ['combustivel', 'aluguel'].includes(t.type))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const balance = totalIncome - totalExpenses;

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
        startDate: Timestamp.fromDate(new Date(customRange.start)),
        endDate: Timestamp.fromDate(new Date(customRange.end)),
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const currentCycle = reports.find(r => {
      const startStr = r.startDate.getUTCFullYear() + '-' + String(r.startDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(r.startDate.getUTCDate()).padStart(2, '0');
      const endStr = r.endDate.getUTCFullYear() + '-' + String(r.endDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(r.endDate.getUTCDate()).padStart(2, '0');
      return todayStr >= startStr && todayStr <= endStr;
    });

    if (currentCycle) {
      selectReport(currentCycle);
    } else {
      setActiveReportId(null);
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setCustomRange({
        start: start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0'),
        end: end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0')
      });
    }
  };

  // Auto-select current cycle on load
  useEffect(() => {
    if (reports.length > 0 && !activeReportId) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const currentCycle = reports.find(r => {
        const startStr = r.startDate.getUTCFullYear() + '-' + String(r.startDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(r.startDate.getUTCDate()).padStart(2, '0');
        const endStr = r.endDate.getUTCFullYear() + '-' + String(r.endDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(r.endDate.getUTCDate()).padStart(2, '0');
        return todayStr >= startStr && todayStr <= endStr;
      });

      if (currentCycle) {
        selectReport(currentCycle);
      }
    }
  }, [reports]);

  const generateStandardCycles = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const reportsRef = collection(db, `users/${user.uid}/reports`);
      const snapshot = await getDocs(reportsRef);
      
      // Identify standard cycles to replace them with corrected dates
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const standardCycleNames: string[] = [];
      for (let y of [2025, 2026]) {
        for (let m of monthNames) {
          standardCycleNames.push(`${m}/${y}`);
        }
      }

      // Delete existing standard cycles to ensure clean state with new dates
      const toDelete = snapshot.docs.filter(doc => standardCycleNames.includes(doc.data().name));
      for (const d of toDelete) {
        await deleteDoc(doc(db, `users/${user.uid}/reports/${d.id}`));
      }

      const startDate = new Date(Date.UTC(2025, 11, 20)); // 20/12/2025 (UTC)
      const cyclesToGenerate = 12; // Generate for 1 year
      
      let currentStart = new Date(startDate);
      
      for (let i = 0; i < cyclesToGenerate; i++) {
        const currentEnd = new Date(currentStart);
        currentEnd.setUTCDate(currentStart.getUTCDate() + 29); // 30 days total
        
        const cycleName = `${monthNames[currentStart.getUTCMonth()]}/${currentStart.getUTCFullYear()}`;
        
        await addDoc(reportsRef, {
          userId: user.uid,
          name: cycleName,
          startDate: Timestamp.fromDate(currentStart),
          endDate: Timestamp.fromDate(currentEnd),
          createdAt: serverTimestamp()
        });
        
        currentStart = new Date(currentEnd);
        currentStart.setUTCDate(currentEnd.getUTCDate() + 1);
      }
      
      setAlertMessage('Ciclos atualizados com sucesso! O registro de 19/01 agora estará no ciclo correto.');
    } catch (err) {
      console.error(err);
      setAlertMessage('Erro ao atualizar ciclos.');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = (name: string, startDate: Date, endDate: Date) => {
    const doc = new jsPDF();
    
    const reportTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      return tDate >= start && tDate <= end;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const income = reportTransactions
      .filter(t => ['uber', '99', 'gorjeta', 'entrada'].includes(t.type))
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const expenses = reportTransactions
      .filter(t => ['combustivel', 'aluguel'].includes(t.type))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const balance = income - expenses;

    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Relatório Financeiro', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Nome: ${name}`, 14, 32);
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`, 14, 38);
    
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 45, 182, 30, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text('RESUMO DO PERÍODO', 18, 52);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 128, 0);
    doc.text(`Ganhos Totais: R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 60);
    
    doc.setTextColor(200, 0, 0);
    doc.text(`Gastos Totais: R$ ${expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 67);
    
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text(`Saldo Final: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 75);

    const tableData = reportTransactions.map(t => [
      getLabel(t.type),
      t.weekStart && t.weekEnd 
        ? `${t.description} (${t.weekStart.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${t.weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })})`
        : t.description,
      `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Tipo', 'Descrição', 'Valor']],
      body: tableData,
      headStyles: { fillColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: 85 },
    });

    doc.save(`Relatorio_${name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDownloadCurrentCyclePDF = () => {
    const start = new Date(customRange.start + 'T00:00:00Z');
    const end = new Date(customRange.end + 'T23:59:59Z');
    const name = `Relatorio_${customRange.start}_a_${customRange.end}`;
    generatePDF(name, start, end);
  };

  const openReportModalWithCurrentCycle = () => {
    setReportName(`Relatório ${customRange.start} a ${customRange.end}`);
    setIsReportModalOpen(true);
  };

  const handleMonthSelect = (m: number, y: number) => {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    setCustomRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
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

    let finalDescription = description || selectedType.charAt(0).toUpperCase() + selectedType.slice(1);
    
    if (selectedType === 'combustivel') {
      const km = parseFloat(sanitizedAmount) || 0;
      const price = parseFloat(sanitizedFuelPrice) || 0;
      const kml = parseFloat(kmPerLiter) || 1;
      
      finalAmount = (price / kml) * km;
      finalDescription = `${finalDescription} (KM: ${km})`;
      
      if (fuelPrice) finalDescription = `${finalDescription} (Preço: R$ ${sanitizedFuelPrice}/L)`;
      finalDescription = `${finalDescription} (Consumo: ${kmPerLiter} Km/L)`;
    }

    const payload = {
      userId: user.uid,
      type: selectedType,
      amount: finalAmount,
      description: finalDescription,
      date: Timestamp.fromDate(new Date(date))
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
    }
  };

  const getLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'uber': return 'Uber Diário';
      case '99': return '99 Diário';
      case 'combustivel': return 'Combustível Diário';
      case 'aluguel': return 'Aluguel Diário';
      case 'gorjeta': return 'Gorjetas';
      case 'entrada': return 'Outras Entradas';
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
      <header className="bg-white border-b border-zinc-200 px-6 py-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black tracking-tighter text-zinc-900">FINANÇAS</h1>
            <div className="flex gap-2">
              <button 
                onClick={logout}
                className="p-3 bg-zinc-100 text-zinc-500 rounded-2xl hover:bg-zinc-200 hover:text-zinc-900 transition-all active:scale-95 border border-zinc-200"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Compact Quick Actions */}
          <div className="w-full overflow-x-auto pb-6 no-scrollbar">
            <div className="flex gap-2 px-1">
              <button 
                onClick={() => openModal('uber')}
                className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-slate-800 text-white rounded-2xl shadow-sm hover:bg-slate-900 transition-all active:scale-95 border border-slate-700"
              >
                <span className="text-xs font-black tracking-tighter leading-none mb-1">Uber</span>
                <span className="text-[8px] font-bold opacity-60 uppercase">Diário</span>
              </button>
              
              <button 
                onClick={() => openModal('99')}
                className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-yellow-400 text-zinc-900 rounded-2xl shadow-sm hover:bg-yellow-500 transition-all active:scale-95 border border-yellow-500"
              >
                <span className="text-xs font-black italic tracking-tighter leading-none mb-1">99</span>
                <span className="text-[8px] font-bold opacity-60 uppercase">Diário</span>
              </button>

              <button 
                onClick={() => openModal('combustivel')}
                className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-indigo-500 text-white rounded-2xl shadow-sm hover:bg-indigo-600 transition-all active:scale-95"
              >
                <Fuel className="w-5 h-5 mb-1" />
                <span className="text-[8px] font-bold opacity-60 uppercase">Combust.</span>
              </button>

              <button 
                onClick={() => openModal('gorjeta')}
                className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-emerald-500 text-white rounded-2xl shadow-sm hover:bg-emerald-600 transition-all active:scale-95"
              >
                <DollarSign className="w-5 h-5 mb-1" />
                <span className="text-[8px] font-bold opacity-60 uppercase">Gorjeta</span>
              </button>

              <button 
                onClick={() => openModal('aluguel')}
                className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-orange-500 text-white rounded-2xl shadow-sm hover:bg-orange-600 transition-all active:scale-95"
              >
                <span className="text-xs font-black italic mb-1">M</span>
                <span className="text-[8px] font-bold opacity-60 uppercase">Aluguel</span>
              </button>

              <button 
                onClick={() => openModal('entrada')}
                className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-white text-zinc-900 rounded-2xl shadow-sm hover:bg-zinc-50 transition-all active:scale-95 border border-zinc-100"
              >
                <PlusCircle className="w-5 h-5 mb-1 text-zinc-300" />
                <span className="text-[8px] font-bold opacity-60 uppercase">Outros</span>
              </button>
            </div>
          </div>
          
          <div className="flex flex-col items-center mb-6">
            <button 
              onClick={() => setIsCycleModalOpen(true)}
              className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 mb-6"
            >
              <Calendar className="w-5 h-5" />
              Selecionar Ciclo (Início e Fim)
            </button>

            <div className="w-full overflow-x-auto pb-4 no-scrollbar">
              <div className="flex gap-3 px-1">
                {/* Default/Current Month Card */}
                <button
                  onClick={clearFilter}
                  className={`flex-shrink-0 w-44 p-5 rounded-[24px] border-2 transition-all text-left relative overflow-hidden group ${
                    !activeReportId 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                      : 'bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200 shadow-sm'
                  }`}
                >
                  {!activeReportId && (
                    <motion.div 
                      layoutId="active-glow"
                      className="absolute -right-4 -top-4 w-16 h-16 bg-white/20 rounded-full blur-2xl"
                    />
                  )}
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Atual</p>
                  <p className="text-base font-black leading-tight mb-1">Visão Geral</p>
                  <p className="text-[11px] font-bold opacity-50">
                    {new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </p>
                </button>

                {/* Saved Reports Carousel */}
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => selectReport(report)}
                    className={`flex-shrink-0 w-44 p-5 rounded-[24px] border-2 transition-all text-left relative overflow-hidden group ${
                      activeReportId === report.id 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                        : 'bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200 shadow-sm'
                    }`}
                  >
                    {activeReportId === report.id && (
                      <motion.div 
                        layoutId="active-glow"
                        className="absolute -right-4 -top-4 w-16 h-16 bg-white/20 rounded-full blur-2xl"
                      />
                    )}
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Ciclo</p>
                    <p className="text-base font-black leading-tight mb-1 truncate">{report.name}</p>
                    <p className="text-[11px] font-bold opacity-40">
                      {report.startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {report.endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </button>
                ))}

                {/* Generate Button Card */}
                <button
                  onClick={generateStandardCycles}
                  className="flex-shrink-0 w-44 p-5 rounded-[24px] border-2 border-dashed border-zinc-200 text-zinc-400 hover:border-indigo-300 hover:text-indigo-600 transition-all text-center flex flex-col items-center justify-center gap-2"
                >
                  <PlusCircle className="w-6 h-6" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Gerar Ciclos 30 Dias</p>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-8">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">
                R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleDownloadCurrentCyclePDF}
                className="p-3 bg-zinc-100 text-zinc-900 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 border border-zinc-200"
                title="Baixar PDF do Ciclo"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={openReportModalWithCurrentCycle}
                className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-sm shadow-indigo-100"
                title="Salvar como Relatório"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="p-3 bg-zinc-100 text-zinc-400 rounded-2xl hover:bg-zinc-200 hover:text-zinc-900 transition-all active:scale-95 border border-zinc-200"
                title="Histórico de Relatórios"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <TrendingUp className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wide">Ganhos</span>
              </div>
              <span className="text-xl font-bold text-emerald-700">
                R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <TrendingDown className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wide">Gastos</span>
              </div>
              <span className="text-xl font-bold text-red-700">
                R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
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
          <>
            {/* Transactions List */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Histórico</h2>
                {customRange && (
                  <button 
                    onClick={clearFilter}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
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
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center group-hover:bg-zinc-100 transition-colors">
                                {getIcon(t.type)}
                              </div>
                              <div>
                                <p className="font-bold text-zinc-900 leading-tight mb-0.5">{getLabel(t.type)}</p>
                                <p className="text-xs text-zinc-400 font-medium">
                                  {t.weekStart && t.weekEnd 
                                    ? `${t.weekStart.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${t.weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                                    : t.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </p>
                                {t.description && t.description !== getLabel(t.type) && (
                                  <p className="text-[10px] text-zinc-400 mt-1 italic">{t.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className={`font-bold text-lg tracking-tight ${['combustivel', 'aluguel'].includes(t.type) ? 'text-zinc-900' : 'text-emerald-600'}`}>
                                  {['combustivel', 'aluguel'].includes(t.type) ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleEditTransaction(t)}
                                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all active:bg-zinc-100"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:bg-red-50"
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
          </>
        )}
      </main>

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
                    {editingTransactionId ? 'Editar' : 'Novo'} {selectedType && getLabel(selectedType)}
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
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
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
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePDF(report.name, report.startDate, report.endDate);
                            }}
                            className={`p-2 rounded-xl transition-all ${activeReportId === report.id ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-50 text-zinc-400 hover:text-zinc-900'}`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteReport(report.id);
                            }}
                            className={`p-2 rounded-xl transition-all ${activeReportId === report.id ? 'bg-zinc-800 text-white hover:bg-red-500' : 'bg-zinc-50 text-zinc-400 hover:text-red-600'}`}
                          >
                            <Trash2 className="w-4 h-4" />
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

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsCycleModalOpen(false)}
                    className="w-full py-5 bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    Aplicar
                  </button>
                  <button 
                    onClick={() => {
                      setIsCycleModalOpen(false);
                      openReportModalWithCurrentCycle();
                    }}
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all active:scale-95 shadow-xl"
                  >
                    Salvar Relatório
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
