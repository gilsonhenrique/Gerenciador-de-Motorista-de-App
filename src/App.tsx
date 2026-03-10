/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Fuel, 
  PlusCircle, 
  History, 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  Wallet,
  X,
  Pencil,
  Trash2,
  DollarSign,
  FileText,
  Calendar,
  Download
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
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Custom Range State
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [reportName, setReportName] = useState('');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
    fetchReports();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      const data = await response.json();
      setTransactions(data.map((t: any) => ({ 
        ...t, 
        date: new Date(t.date),
        weekStart: t.weekStart ? new Date(t.weekStart) : undefined,
        weekEnd: t.weekEnd ? new Date(t.weekEnd) : undefined
      })));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports');
      const data = await response.json();
      setReports(data.map((r: any) => ({
        ...r,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        createdAt: new Date(r.createdAt)
      })));
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    if (customRange) {
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return tDate >= start && tDate <= end;
    }
    return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
  });

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
    if (!reportName || !customRange) return;

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          startDate: customRange.start,
          endDate: customRange.end
        })
      });
      const newReport = await response.json();
      setReports([{
        ...newReport,
        startDate: new Date(newReport.startDate),
        endDate: new Date(newReport.endDate),
        createdAt: new Date(newReport.createdAt)
      }, ...reports]);
      setIsReportModalOpen(false);
      setReportName('');
    } catch (error) {
      console.error('Error saving report:', error);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (window.confirm('Excluir este relatório salvo?')) {
      try {
        await fetch(`/api/reports/${id}`, { method: 'DELETE' });
        setReports(reports.filter(r => r.id !== id));
        if (activeReportId === id) {
          setActiveReportId(null);
          setCustomRange(null);
        }
      } catch (error) {
        console.error('Error deleting report:', error);
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

  const generatePDF = (report: Report) => {
    const doc = new jsPDF();
    
    // Filter transactions for this report
    const reportTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      const start = new Date(report.startDate);
      const end = new Date(report.endDate);
      end.setHours(23, 59, 59, 999);
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
    doc.text(`Nome: ${report.name}`, 14, 32);
    doc.text(`Período: ${report.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${report.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`, 14, 38);
    
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
      t.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      getLabel(t.type),
      t.description,
      `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Data', 'Tipo', 'Descrição', 'Valor']],
      body: tableData,
      headStyles: { fillColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: 85 },
    });

    doc.save(`Relatorio_${report.name.replace(/\s+/g, '_')}.pdf`);
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
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !amount) return;

    const isWeekly = selectedType === 'uber' || selectedType === '99';

    try {
      if (editingTransactionId) {
        const response = await fetch(`/api/transactions/${editingTransactionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selectedType,
            amount: parseFloat(amount),
            description: description || selectedType.charAt(0).toUpperCase() + selectedType.slice(1),
            date: date,
            weekStart: isWeekly ? weekStart : null,
            weekEnd: isWeekly ? weekEnd : null
          })
        });
        const updatedTransaction = await response.json();
        setTransactions(transactions.map(t => 
          t.id === editingTransactionId 
            ? { 
                ...updatedTransaction, 
                date: new Date(updatedTransaction.date),
                weekStart: updatedTransaction.weekStart ? new Date(updatedTransaction.weekStart) : undefined,
                weekEnd: updatedTransaction.weekEnd ? new Date(updatedTransaction.weekEnd) : undefined
              }
            : t
        ));
      } else {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selectedType,
            amount: parseFloat(amount),
            description: description || selectedType.charAt(0).toUpperCase() + selectedType.slice(1),
            date: date,
            weekStart: isWeekly ? weekStart : null,
            weekEnd: isWeekly ? weekEnd : null
          })
        });
        const newTransaction = await response.json();
        setTransactions([{ 
          ...newTransaction, 
          date: new Date(newTransaction.date),
          weekStart: newTransaction.weekStart ? new Date(newTransaction.weekStart) : undefined,
          weekEnd: newTransaction.weekEnd ? new Date(newTransaction.weekEnd) : undefined
        }, ...transactions]);
      }
      closeModal();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
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
    setDate(getLocalToday());
    setSelectedType(null);
    setEditingTransactionId(null);
  };

  const handleEditTransaction = (t: Transaction) => {
    setSelectedType(t.type);
    setAmount(t.amount.toString());
    setDescription(t.description);
    setWeekStart(t.weekStart ? t.weekStart.toISOString().split('T')[0] : '');
    setWeekEnd(t.weekEnd ? t.weekEnd.toISOString().split('T')[0] : '');
    setDate(t.date.toISOString().split('T')[0]);
    setEditingTransactionId(t.id);
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      try {
        await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        setTransactions(transactions.filter(t => t.id !== id));
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
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
      case 'combustivel': return 'Combustível';
      case 'aluguel': return 'Aluguel Movida';
      case 'gorjeta':
      case 'entrada': return 'Gorjetas';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180 text-zinc-400" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-zinc-900">
                {customRange ? 'Período Personalizado' : months[selectedMonth]}
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                {customRange 
                  ? `${new Date(customRange.start + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${new Date(customRange.end + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                  : selectedYear
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

          <h1 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">
            {customRange ? 'Saldo do Período' : 'Saldo do Mês'}
          </h1>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-4xl font-bold tracking-tight">
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            {customRange && (
              <button 
                onClick={clearFilter}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-900 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpar Filtro
              </button>
            )}
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
              <span className="font-bold">Combustível</span>
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
              <span className="font-bold">Aluguel Carro</span>
            </button>
          </div>
        </section>

        {/* Reports Section */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Relatórios Salvos</h2>
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="p-2.5 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-all shadow-md active:scale-90"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {reports.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Nenhum relatório salvo ainda.</p>
            ) : (
              reports.map((r) => (
                <div 
                  key={r.id}
                  className={`flex-shrink-0 p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 min-w-[160px] ${
                    activeReportId === r.id 
                      ? 'bg-zinc-900 border-zinc-900 text-white' 
                      : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400'
                  }`}
                  onClick={() => selectReport(r)}
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-xl ${activeReportId === r.id ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          generatePDF(r);
                        }}
                        className={`p-2.5 rounded-xl transition-all shadow-sm ${
                          activeReportId === r.id 
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                            : 'bg-zinc-100 text-zinc-600 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                        title="Baixar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReport(r.id);
                        }}
                        className={`p-2.5 rounded-xl transition-all shadow-sm ${
                          activeReportId === r.id 
                            ? 'bg-white/10 text-white/40 hover:bg-red-500 hover:text-white' 
                            : 'bg-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold truncate">{r.name}</h4>
                    <p className={`text-[10px] ${activeReportId === r.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {r.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - {r.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                  </div>
                </div>
              ))
            )}
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
          
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Carregando atividades...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 bg-zinc-100/50 rounded-3xl border border-dashed border-zinc-300">
                <History className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Nenhuma atividade registrada em {months[selectedMonth]}.</p>
              </div>
            ) : (
              filteredTransactions.map((t) => (
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
                      <p className="text-xs text-zinc-400">
                        {t.weekStart && t.weekEnd ? (
                          `Semana: ${t.weekStart.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${t.weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                        ) : (
                          t.date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        )}
                      </p>
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
              ))
            )}
          </div>
        </section>
      </main>

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
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl"
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
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl"
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
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full text-4xl font-bold tracking-tight border-none focus:ring-0 p-0 placeholder:text-zinc-200"
                  />
                </div>

                {(selectedType === 'uber' || selectedType === '99') ? (
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
