/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Settings,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function App() {
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
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [fuelPrice, setFuelPrice] = useState('');
  const [kmPerLiter, setKmPerLiter] = useState('10');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<Settings>({
    cycleStartDay: 24,
    cycleDuration: 30,
    referenceDate: new Date('2025-06-24T00:00:00Z')
  });
  
  // Custom Range State
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [reportName, setReportName] = useState('');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error(`Falha ao carregar dados: ${response.status}`);
      }
      const data = await response.json();
      
      setTransactions(data.transactions.map((t: any) => ({ 
        ...t, 
        date: new Date(t.date),
        weekStart: t.weekStart ? new Date(t.weekStart) : undefined,
        weekEnd: t.weekEnd ? new Date(t.weekEnd) : undefined
      })));

      setReports(data.reports.map((r: any) => ({
        ...r,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        createdAt: new Date(r.createdAt)
      })));

      if (data.settings) {
        const fetchedSettings = {
          ...data.settings,
          referenceDate: new Date(data.settings.referenceDate)
        };
        setSettings(fetchedSettings);
        setTempSettings(fetchedSettings);
      }
      setIsDirty(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Erro ao conectar com o servidor. Tente recarregar a página.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          reports,
          settings
        })
      });
      if (!response.ok) throw new Error('Falha ao sincronizar');
      const data = await response.json();
      setIsDirty(false);
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');
      alert(`Banco de dados salvo com sucesso!\nData: ${dateStr}\nCaminho: ${data.path}`);
    } catch (error) {
      console.error('Sync error:', error);
      alert('Erro ao salvar dados. Tente novamente.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(tempSettings);
    setIsDirty(true);
    setIsSettingsModalOpen(false);
  };

  const getCycleRange = (date: Date, cycleSettings: Settings) => {
    const ref = new Date(cycleSettings.referenceDate);
    ref.setUTCHours(0, 0, 0, 0);
    
    const target = new Date(date);
    target.setUTCHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - ref.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const cycleIndex = Math.floor(diffDays / cycleSettings.cycleDuration);
    
    const start = new Date(ref);
    start.setUTCDate(ref.getUTCDate() + (cycleIndex * cycleSettings.cycleDuration));
    
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + cycleSettings.cycleDuration - 1);
    
    return { start, end };
  };

  const filteredTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    if (customRange) {
      const start = new Date(customRange.start + 'T00:00:00Z');
      const end = new Date(customRange.end + 'T23:59:59Z');
      return tDate >= start && tDate <= end;
    }
    
    if (settings && settings.cycleStartDay !== 1) {
      const baseDate = new Date(selectedYear, selectedMonth, 15);
      const { start: cycleStart, end: cycleEnd } = getCycleRange(baseDate, settings);
      
      // Strict comparison: start of cycle (00:00:00) to end of cycle (23:59:59)
      const s = new Date(cycleStart);
      s.setUTCHours(0, 0, 0, 0);
      const e = new Date(cycleEnd);
      e.setUTCHours(23, 59, 59, 999);
      
      return tDate >= s && tDate <= e;
    }

    return tDate.getUTCMonth() === selectedMonth && tDate.getUTCFullYear() === selectedYear;
  });

  const groupedTransactions = useMemo(() => {
    const groups: { [key: number]: { label: string, transactions: Transaction[] } } = {};
    
    let cycleStart: Date | null = null;
    if (settings && settings.cycleStartDay !== 1 && !customRange) {
      const baseDate = new Date(selectedYear, selectedMonth, 15);
      const range = getCycleRange(baseDate, settings);
      cycleStart = range.start;
    }

    filteredTransactions.forEach(t => {
      let weekIndex: number;
      let label: string;

      if (cycleStart) {
        const tDate = new Date(t.date);
        tDate.setUTCHours(0,0,0,0);
        const diff = tDate.getTime() - cycleStart.getTime();
        weekIndex = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
        
        const wStart = new Date(cycleStart);
        wStart.setUTCDate(cycleStart.getUTCDate() + (weekIndex * 7));
        const wEnd = new Date(wStart);
        wEnd.setUTCDate(wStart.getUTCDate() + 6);
        
        label = `Semana ${weekIndex + 1}`;
      } else {
        const d = new Date(t.date);
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        const ws = new Date(d);
        ws.setUTCDate(diff);
        ws.setUTCHours(0,0,0,0);
        
        weekIndex = ws.getTime();
        label = `Semana de ${ws.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
      }
      
      if (!groups[weekIndex]) {
        groups[weekIndex] = { label, transactions: [] };
      }
      groups[weekIndex].transactions.push(t);
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
      .map(Number)
      .sort((a, b) => b - a)
      .map(index => ({
        weekKey: index.toString(),
        weekLabel: groups[index].label,
        transactions: groups[index].transactions.sort((a, b) => {
          const orderA = typeOrder[a.type] || 99;
          const orderB = typeOrder[b.type] || 99;
          if (orderA !== orderB) return orderA - orderB;
          return b.amount - a.amount; // Sort by amount if same type
        })
      }));
  }, [filteredTransactions, settings, selectedMonth, selectedYear, customRange]);

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

  const handleAddReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportName || !customRange) return;

    const newReport: Report = {
      id: Math.random().toString(36).substr(2, 9),
      name: reportName,
      startDate: new Date(customRange.start),
      endDate: new Date(customRange.end),
      createdAt: new Date()
    };

    setReports([newReport, ...reports]);
    setIsDirty(true);
    setIsReportModalOpen(false);
    setReportName('');
  };

  const handleDeleteReport = (id: string) => {
    if (window.confirm('Excluir este relatório salvo?')) {
      setReports(reports.filter(r => r.id !== id));
      setIsDirty(true);
      if (activeReportId === id) {
        setActiveReportId(null);
        setCustomRange(null);
      }
    }
  };

  const selectReport = (report: Report) => {
    setActiveReportId(report.id);
    setCustomRange({
      start: report.startDate.toISOString().split('T')[0],
      end: report.endDate.toISOString().split('T')[0]
    });
  };

  const clearFilter = () => {
    setActiveReportId(null);
    setCustomRange(null);
  };

  const generatePDF = (name: string, startDate: Date, endDate: Date) => {
    const doc = new jsPDF();
    
    // Filter transactions for this range
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

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Relatório Financeiro', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Nome: ${name}`, 14, 32);
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`, 14, 38);
    
    // Summary Box
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 45, 182, 30, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text('RESUMO DO PERÍODO', 18, 52);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 128, 0); // Green
    doc.text(`Ganhos Totais: R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 60);
    
    doc.setTextColor(200, 0, 0); // Red
    doc.text(`Gastos Totais: R$ ${expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 67);
    
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text(`Saldo Final: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 75);

    // Table
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
    let start, end, name;
    if (customRange) {
      start = new Date(customRange.start + 'T00:00:00Z');
      end = new Date(customRange.end + 'T23:59:59Z');
      name = `Relatorio_Personalizado`;
    } else if (settings && settings.cycleStartDay !== 1) {
      const range = getCycleRange(new Date(selectedYear, selectedMonth, 15), settings);
      start = range.start;
      end = range.end;
      name = `Ciclo_de_${months[selectedMonth]}_${selectedYear}`;
    } else {
      start = new Date(selectedYear, selectedMonth, 1);
      end = new Date(selectedYear, selectedMonth + 1, 0);
      name = `${months[selectedMonth]}_${selectedYear}`;
    }
    generatePDF(name, start, end);
  };

  const openReportModalWithCurrentCycle = () => {
    if (customRange) {
      // already set
    } else if (settings && settings.cycleStartDay !== 1) {
      const range = getCycleRange(new Date(selectedYear, selectedMonth, 15), settings);
      setCustomRange({
        start: range.start.toISOString().split('T')[0],
        end: range.end.toISOString().split('T')[0]
      });
      setReportName(`Ciclo de ${months[selectedMonth]}`);
    } else {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0);
      setCustomRange({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      });
      setReportName(`${months[selectedMonth]} ${selectedYear}`);
    }
    setIsReportModalOpen(true);
  };

  const handlePrevMonth = () => {
    clearFilter();
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    clearFilter();
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !amount) return;

    const isWeekly = selectedType === 'uber' || selectedType === '99' || selectedType === 'aluguel' || selectedType === 'combustivel';

    const sanitizedAmount = amount.replace(',', '.');
    const sanitizedFuelPrice = fuelPrice.replace(',', '.');

    let finalAmount = parseFloat(sanitizedAmount);
    if (isNaN(finalAmount)) {
      alert('Por favor, insira um valor válido.');
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

    if (editingTransactionId) {
      setTransactions(transactions.map(t => 
        t.id === editingTransactionId 
          ? { 
              ...t,
              type: selectedType,
              amount: finalAmount,
              description: finalDescription,
              date: new Date(date),
              weekStart: isWeekly && weekStart ? new Date(weekStart) : undefined,
              weekEnd: isWeekly && weekEnd ? new Date(weekEnd) : undefined
            }
          : t
      ));
    } else {
      const newTransaction: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        type: selectedType,
        amount: finalAmount,
        description: finalDescription,
        date: new Date(date),
        weekStart: isWeekly && weekStart ? new Date(weekStart) : undefined,
        weekEnd: isWeekly && weekEnd ? new Date(weekEnd) : undefined
      };
      setTransactions([newTransaction, ...transactions]);
    }
    setIsDirty(true);
    closeModal();
  };

  const openModal = (type: Transaction['type']) => {
    setSelectedType(type);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setAmount('');
    setDescription('');
    setWeekStart('');
    setWeekEnd('');
    setFuelPrice('');
    setKmPerLiter('10');
    setDate(getLocalToday());
    setSelectedType(null);
    setEditingTransactionId(null);
  };

  const handleEditTransaction = (t: Transaction) => {
    setSelectedType(t.type);
    setWeekStart(t.weekStart ? t.weekStart.toISOString().split('T')[0] : '');
    setWeekEnd(t.weekEnd ? t.weekEnd.toISOString().split('T')[0] : '');
    setDate(t.date.toISOString().split('T')[0]);
    
    // Try to extract fuel price and KM from description if it exists
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
      
      // Clean description for editing
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

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      setTransactions(transactions.filter(t => t.id !== id));
      setIsDirty(true);
    }
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
      case 'uber': return 'Uber Semanal';
      case '99': return '99 Semanal';
      case 'combustivel': return 'Combustível Semanal';
      case 'aluguel': return 'Aluguel Semanal';
      case 'gorjeta': return 'Gorjetas';
      case 'entrada': return 'Outras Entradas';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black tracking-tighter text-zinc-900">FINANÇAS</h1>
            <div className="flex gap-2">
              {isDirty && (
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={`flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all active:scale-95 shadow-md ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Save className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`} /> 
                  {isSyncing ? 'Salvando...' : 'Salvar no Banco'}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-zinc-900">
                {customRange 
                  ? 'Período Personalizado' 
                  : (settings && settings.cycleStartDay !== 1 
                      ? `Ciclo de ${months[selectedMonth]}` 
                      : months[selectedMonth])
                }
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                {customRange 
                  ? `${new Date(customRange.start + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${new Date(customRange.end + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                  : (settings && settings.cycleStartDay !== 1
                      ? `${getCycleRange(new Date(selectedYear, selectedMonth, 15), settings).start.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${getCycleRange(new Date(selectedYear, selectedMonth, 15), settings).end.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                      : selectedYear)
                }
              </p>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </button>
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
                className="p-3 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
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
        {error && (
          <div className="mb-6 p-6 bg-red-50 border border-red-100 rounded-3xl text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-red-900 font-bold mb-1">Erro de Conexão</h3>
            <p className="text-red-600/70 text-xs mb-4">{error}</p>
            <button 
              onClick={() => fetchAllData()}
              className="w-full py-3 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Tentar Novamente
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
            <p className="text-sm text-zinc-500 font-medium">Carregando dados...</p>
          </div>
        ) : (
          <>
            {/* Quick Actions Grid */}
            <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-2 gap-[10px]">
            <button 
              onClick={() => openModal('uber')}
              className="flex flex-col items-center justify-center p-6 bg-black text-white rounded-[5px] text-[16px] shadow-sm hover:opacity-90 transition-all active:scale-95 group border border-zinc-800"
            >
              <div className="flex items-center justify-center mb-2">
                <span className="text-3xl font-bold tracking-tighter leading-none">Uber</span>
              </div>
              <span className="font-bold">Uber Semanal</span>
            </button>
            
            <button 
              onClick={() => openModal('99')}
              className="flex flex-col items-center justify-center p-6 bg-[#FFD200] text-black rounded-[5px] text-[16px] shadow-sm hover:opacity-90 transition-all active:scale-95 group border border-yellow-500"
            >
              <div className="flex items-center justify-center mb-2">
                <span className="text-3xl font-black italic tracking-tighter leading-none">99</span>
              </div>
              <span className="font-bold">99 Semanal</span>
            </button>

            <button 
              onClick={() => openModal('combustivel')}
              className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-[5px] text-[16px] shadow-sm hover:opacity-90 transition-all active:scale-95 group"
            >
              <Fuel className="w-8 h-8 mb-2" />
              <span className="font-bold">Combustível Semanal</span>
            </button>

            <button 
              onClick={() => openModal('gorjeta')}
              className="flex flex-col items-center justify-center p-6 bg-emerald-600 text-white rounded-[5px] text-[16px] shadow-sm hover:opacity-90 transition-all active:scale-95 group"
            >
              <div className="flex items-center gap-1 mb-2">
                <DollarSign className="w-8 h-8" />
              </div>
              <span className="font-bold">Gorjetas</span>
            </button>

            <button 
              onClick={() => openModal('aluguel')}
              className="flex flex-col items-center justify-center p-6 bg-[#FF6600] text-white rounded-[5px] text-[16px] shadow-sm hover:opacity-90 transition-all active:scale-95 group border border-orange-700"
            >
              <div className="flex items-center justify-center mb-2">
                <span className="text-3xl font-black italic tracking-tighter leading-none">MOVIDA</span>
              </div>
              <span className="font-bold">Aluguel Semanal</span>
            </button>

            <button 
              onClick={() => openModal('entrada')}
              className="flex flex-col items-center justify-center p-6 bg-zinc-100 text-zinc-900 rounded-[5px] text-[16px] shadow-sm hover:bg-zinc-200 transition-all active:scale-95 group border border-zinc-300"
            >
              <div className="flex items-center gap-1 mb-2">
                <PlusCircle className="w-8 h-8 text-zinc-600" />
              </div>
              <span className="font-bold">Outras Entradas</span>
            </button>
          </div>
        </section>

        {/* Monthly Activity */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {customRange ? 'Atividades do Período' : `Atividades de ${months[selectedMonth]}`}
            </h2>
            <History className="w-5 h-5 text-zinc-400" />
          </div>
          
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Carregando atividades...</p>
              </div>
            ) : groupedTransactions.length === 0 ? (
              <div className="text-center py-12 bg-zinc-100/50 rounded-3xl border border-dashed border-zinc-300">
                <History className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Nenhuma atividade registrada em {months[selectedMonth]}.</p>
              </div>
            ) : (
              groupedTransactions.map((group) => (
                <div key={group.weekKey} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {group.weekLabel}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {group.transactions.map((t) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={t.id} 
                        className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center shadow-inner border border-zinc-100">
                            {getIcon(t.type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm">{t.description}</h3>
                            {t.weekStart && t.weekEnd && (
                              <p className="text-[10px] text-zinc-400 font-medium">
                                {t.weekStart.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a {t.weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleEditTransaction(t)}
                              className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all active:scale-90"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <span className={`font-bold text-sm ${['combustivel', 'aluguel'].includes(t.type) ? 'text-red-600' : 'text-emerald-600'}`}>
                            {['combustivel', 'aluguel'].includes(t.type) ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Backup & Tools */}
        <section className="mt-12 pt-8 border-t border-zinc-200">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Segurança e Dados</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white p-6 rounded-[24px] border border-zinc-200 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-2">Configurações de Ciclo</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Defina o dia de início e a duração do seu ciclo de fechamento mensal.
              </p>
              <button 
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full py-4 px-6 bg-zinc-100 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95 border border-zinc-200 flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" /> Configurar Ciclo
              </button>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">
              Banco de Dados Local • SQLite Gratuito
            </p>
          </div>
        </section>
          </>
        )}
      </main>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Relatórios Salvos</h2>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {reports.length === 0 ? (
                  <p className="text-center py-10 text-zinc-400 italic">Nenhum relatório salvo ainda.</p>
                ) : (
                  reports.map((r) => (
                    <div 
                      key={r.id}
                      className="p-4 rounded-2xl border border-zinc-200 bg-white flex items-center justify-between hover:border-zinc-400 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-zinc-100 text-zinc-500 rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">{r.name}</h4>
                          <p className="text-xs text-zinc-500">
                            {r.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - {r.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => generatePDF(r.name, r.startDate, r.endDate)}
                          className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
                          title="Baixar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteReport(r.id)}
                          className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Configurações de Ciclo</h2>
                <button 
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Dia de Início</label>
                  <input 
                    type="number" 
                    min="1"
                    max="31"
                    required
                    value={tempSettings.cycleStartDay}
                    onChange={(e) => setTempSettings({ ...tempSettings, cycleStartDay: parseInt(e.target.value) })}
                    className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Duração do Ciclo (Dias)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={tempSettings.cycleDuration}
                    onChange={(e) => setTempSettings({ ...tempSettings, cycleDuration: parseInt(e.target.value) })}
                    className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Data de Referência</label>
                  <input 
                    type="date" 
                    required
                    value={tempSettings.referenceDate.toISOString().split('T')[0]}
                    onChange={(e) => setTempSettings({ ...tempSettings, referenceDate: new Date(e.target.value) })}
                    className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all active:scale-[0.98]"
                >
                  Salvar Configurações
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Novo Relatório</h2>
                <button 
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddReport} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Nome do Relatório</label>
                  <input 
                    type="text" 
                    required
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="Ex: Primeira Quinzena de Março"
                    className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Data Início</label>
                    <input 
                      type="date" 
                      required
                      value={customRange?.start || ''}
                      onChange={(e) => setCustomRange(prev => ({ start: e.target.value, end: prev?.end || '' }))}
                      className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Data Fim</label>
                    <input 
                      type="date" 
                      required
                      value={customRange?.end || ''}
                      onChange={(e) => setCustomRange(prev => ({ start: prev?.start || '', end: e.target.value }))}
                      className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all active:scale-[0.98]"
                >
                  Salvar Relatório
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">
                  {editingTransactionId ? 'Editar Registro' : 'Novo Registro'}: {selectedType && getLabel(selectedType)}
                </h2>
                <button 
                  onClick={closeModal}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

            <form onSubmit={handleAddTransaction} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    {selectedType === 'combustivel' ? 'Kilometros / Semana' : 'Valor (R$)'}
                  </label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    required
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={selectedType === 'combustivel' ? "Ex: 500" : "0,00"}
                    className="w-full text-4xl font-bold tracking-tight border-none focus:ring-0 p-0 placeholder:text-zinc-200"
                  />
                </div>

                {(selectedType === 'uber' || selectedType === '99' || selectedType === 'aluguel' || selectedType === 'combustivel') ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Início (Segunda)</label>
                      <input 
                        type="date" 
                        required
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                        className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Fim (Domingo)</label>
                      <input 
                        type="date" 
                        required
                        value={weekEnd}
                        onChange={(e) => setWeekEnd(e.target.value)}
                        className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Data</label>
                    <input 
                      type="date" 
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                )}

                {selectedType === 'combustivel' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Valor do Litro (R$)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        required
                        value={fuelPrice}
                        onChange={(e) => setFuelPrice(e.target.value)}
                        placeholder="0,000"
                        className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Km/litro</label>
                      <select 
                        value={kmPerLiter}
                        onChange={(e) => setKmPerLiter(e.target.value)}
                        className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all appearance-none"
                      >
                        {Array.from({ length: 30 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Descrição (Opcional)</label>
                  <input 
                    type="text" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Corrida longa, Posto Shell..."
                    className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all active:scale-[0.98]"
                >
                  {editingTransactionId ? 'Salvar Alterações' : 'Confirmar Registro'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
