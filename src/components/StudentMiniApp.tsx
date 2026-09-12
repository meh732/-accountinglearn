import React, { useState } from "react";
import {
  DailyQuizItem,
  PracticeScenario,
  JournalEntryLine,
  StudentTestResult,
  BotConfig,
} from "../types";
import {
  CheckCircle2,
  XCircle,
  Award,
  BookOpen,
  Calculator,
  FileSpreadsheet,
  Plus,
  Trash2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Share2,
  ShieldAlert,
  Clock,
  RotateCcw,
  Layers,
  ChevronRight,
  Send,
  ExternalLink,
} from "lucide-react";

interface StudentMiniAppProps {
  quizzes: DailyQuizItem[];
  scenarios: PracticeScenario[];
  config: BotConfig;
  onClose?: () => void;
  isStandalone?: boolean;
}

export const StudentMiniApp: React.FC<StudentMiniAppProps> = ({
  quizzes,
  scenarios,
  config,
  onClose,
  isStandalone = false,
}) => {
  const [activeMiniTab, setActiveMiniTab] = useState<"quiz" | "practice" | "payroll" | "moudian">("quiz");

  // --- Quiz Engine State ---
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id || "");
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<StudentTestResult[]>(() => {
    const saved = localStorage.getItem("student_test_results");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const activeQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];

  const handleSelectOption = (quizId: string, optionIndex: number) => {
    if (userAnswers[quizId] !== undefined) return; // already answered

    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    const isCorrect = optionIndex === quiz.correctOptionIndex;
    setUserAnswers((prev) => ({ ...prev, [quizId]: optionIndex }));
    setRevealedExplanations((prev) => ({ ...prev, [quizId]: true }));

    const newResult: StudentTestResult = {
      id: "res-" + Date.now(),
      quizId,
      quizTitle: quiz.title,
      selectedOption: optionIndex,
      isCorrect,
      timestamp: new Date().toLocaleTimeString("fa-IR"),
    };

    const updated = [newResult, ...testResults.filter((r) => r.quizId !== quizId)];
    setTestResults(updated);
    localStorage.setItem("student_test_results", JSON.stringify(updated));
  };

  const handleResetQuiz = (quizId: string) => {
    setUserAnswers((prev) => {
      const copy = { ...prev };
      delete copy[quizId];
      return copy;
    });
    setRevealedExplanations((prev) => {
      const copy = { ...prev };
      delete copy[quizId];
      return copy;
    });
  };

  // --- Accounting Practice Voucher State ---
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0]?.id || "");
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const [voucherLines, setVoucherLines] = useState<JournalEntryLine[]>(() => {
    return activeScenario ? activeScenario.defaultLines : [];
  });

  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    isBalanced: boolean;
    difference: number;
    feedback: string;
  } | null>(null);

  const handleSelectScenario = (sc: PracticeScenario) => {
    setSelectedScenarioId(sc.id);
    setVoucherLines(sc.defaultLines);
    setValidationResult(null);
  };

  const handleAddVoucherLine = () => {
    const newLine: JournalEntryLine = {
      id: "line-" + Date.now(),
      accountCode: "1101",
      accountName: "حساب جدید",
      description: "شرح رویداد مالی",
      debit: 0,
      credit: 0,
    };
    setVoucherLines((prev) => [...prev, newLine]);
  };

  const handleRemoveVoucherLine = (id: string) => {
    setVoucherLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleUpdateVoucherLine = (id: string, field: keyof JournalEntryLine, val: any) => {
    setVoucherLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        return { ...line, [field]: val };
      })
    );
  };

  const totalDebit = voucherLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = voucherLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isVoucherBalanced = totalDebit > 0 && totalDebit === totalCredit;
  const voucherDiff = Math.abs(totalDebit - totalCredit);

  const handleValidateVoucher = () => {
    if (!isVoucherBalanced) {
      setValidationResult({
        tested: true,
        isBalanced: false,
        difference: voucherDiff,
        feedback: `سند تراز نیست! اختلاف بدهکار و بستانکار مبلغ ${voucherDiff.toLocaleString("fa-IR")} ریال است. طبق اصل تعادل حسابداری دوطرفه در ایران، جمع بدهکار باید دقیقاً برابر بستانکار باشد.`,
      });
    } else {
      setValidationResult({
        tested: true,
        isBalanced: true,
        difference: 0,
        feedback: `آفرین! سند با موفقیت تراز شد. جمع سند: ${totalDebit.toLocaleString("fa-IR")} ریال. استانداردهای ثبت دوطرفه دفاتر قانونی رعایت شده است.`,
      });
    }
  };

  // --- Payroll Calculator State ---
  const [baseSalary, setBaseSalary] = useState<number>(75000000); // 75 million Rials base
  const [housingAllowance, setHousingAllowance] = useState<number>(9000000); // 9 million Rials
  const [foodAllowance, setFoodAllowance] = useState<number>(14000000); // 14 million Rials
  const [overtimeHours, setOvertimeHours] = useState<number>(10);
  const [hourlyRate, setHourlyRate] = useState<number>(450000);

  const grossEarnings = baseSalary + housingAllowance + foodAllowance + overtimeHours * hourlyRate;
  const workerInsurance = Math.round(grossEarnings * 0.07); // 7% worker share
  const employerInsurance = Math.round(grossEarnings * 0.23); // 23% employer share (20% social + 3% unemployment)
  // Article 84 tax threshold (120 million per month simplified)
  const taxableSalary = Math.max(0, grossEarnings - 120000000);
  const taxSalary = Math.round(taxableSalary * 0.1); // 10% rate on excess
  const netPayable = grossEarnings - workerInsurance - taxSalary;

  // --- Moudian VAT Simulator State ---
  const [invoiceItemPrice, setInvoiceItemPrice] = useState<number>(50000000); // 50m
  const [invoiceQuantity, setInvoiceQuantity] = useState<number>(2);
  const [discountAmount, setDiscountAmount] = useState<number>(5000000); // 5m
  const subtotalBeforeVat = Math.max(0, invoiceItemPrice * invoiceQuantity - discountAmount);
  const vatRate = 0.1; // 10% standard VAT
  const vatAmount = Math.round(subtotalBeforeVat * vatRate);
  const grandTotal = subtotalBeforeVat + vatAmount;

  // Scores
  const correctCount = testResults.filter((r) => r.isCorrect).length;
  const totalAnswered = testResults.length;
  const scorePercent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  return (
    <div className={`flex flex-col bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden font-['Vazirmatn',sans-serif] ${isStandalone ? "min-h-screen" : "max-w-4xl mx-auto"}`} dir="rtl">
      
      {/* Mini App Top Navigation & Telegram/Bale Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 px-4 py-3.5 border-b border-emerald-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/30">
            📱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                مینی‌اپ حسابداری اعضای کانال
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                نسخه اعضا (دانشجو)
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/80">
              {config.channelTitle || "آکادمی حسابداری و قوانین مالیاتی ایران"}
            </p>
          </div>
        </div>

        {/* User Score Badge */}
        <div className="flex items-center gap-2.5">
          <div className="bg-slate-950/70 border border-emerald-500/40 rounded-xl px-3 py-1 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <div className="text-right">
              <div className="text-[10px] text-slate-400">کارنامه من:</div>
              <div className="text-xs font-bold text-emerald-300">
                {scorePercent}٪ <span className="text-[10px] text-slate-400">({correctCount}/{totalAnswered})</span>
              </div>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="بستن شبیه‌ساز"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Mini App Bottom/Top Tabs (Telegram WebApp Look) */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveMiniTab("quiz")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeMiniTab === "quiz"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/40"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>📝 آزمون‌های روزانه ({quizzes.length})</span>
        </button>

        <button
          onClick={() => setActiveMiniTab("practice")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeMiniTab === "practice"
              ? "bg-teal-600 text-white shadow-md shadow-teal-900/40"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>📊 کارگاه ثبت سند دوبل</span>
        </button>

        <button
          onClick={() => setActiveMiniTab("payroll")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeMiniTab === "payroll"
              ? "bg-sky-600 text-white shadow-md shadow-sky-900/40"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>🧮 ماشین‌حساب حقوق و بیمه</span>
        </button>

        <button
          onClick={() => setActiveMiniTab("moudian")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeMiniTab === "moudian"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>🧾 فاکتور سامانه مودیان ۱۰٪</span>
        </button>
      </div>

      {/* Main Mini App Body */}
      <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">

        {/* ================================================================= */}
        {/* TAB 1: QUIZ & TESTS ENGINE                                       */}
        {/* ================================================================= */}
        {activeMiniTab === "quiz" && (
          <div className="space-y-5">
            {/* Quiz Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {quizzes.map((q, idx) => {
                const isAnswered = userAnswers[q.id] !== undefined;
                const result = testResults.find((r) => r.quizId === q.id);
                const isSelected = q.id === selectedQuizId;

                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuizId(q.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                      isSelected
                        ? "bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span>روز {q.dayNumber || idx + 1}</span>
                    {isAnswered && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Current Active Quiz Card */}
            {activeQuiz ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                      {activeQuiz.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      روز شماره {activeQuiz.dayNumber}
                    </span>
                  </div>

                  {userAnswers[activeQuiz.id] !== undefined && (
                    <button
                      onClick={() => handleResetQuiz(activeQuiz.id)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>پاسخ مجدد</span>
                    </button>
                  )}
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-100 leading-relaxed">
                  {activeQuiz.title}
                </h3>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  {activeQuiz.question}
                </div>

                {/* 4 Choices */}
                <div className="space-y-2.5 pt-1">
                  {activeQuiz.options.map((optionText, optIndex) => {
                    const isSelected = userAnswers[activeQuiz.id] === optIndex;
                    const isAnswered = userAnswers[activeQuiz.id] !== undefined;
                    const isCorrect = optIndex === activeQuiz.correctOptionIndex;

                    let btnStyle = "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300";
                    if (isAnswered) {
                      if (isCorrect) {
                        btnStyle = "bg-emerald-950/80 border-emerald-500/80 text-emerald-200 font-bold";
                      } else if (isSelected) {
                        btnStyle = "bg-rose-950/80 border-rose-500/80 text-rose-200";
                      } else {
                        btnStyle = "bg-slate-900/50 border-slate-850 text-slate-500 opacity-60";
                      }
                    }

                    return (
                      <button
                        key={optIndex}
                        disabled={isAnswered}
                        onClick={() => handleSelectOption(activeQuiz.id, optIndex)}
                        className={`w-full p-3.5 rounded-xl border text-right text-xs sm:text-sm flex items-start gap-3 transition-all ${btnStyle}`}
                      >
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isAnswered && isCorrect
                            ? "bg-emerald-500 text-slate-950"
                            : isAnswered && isSelected
                            ? "bg-rose-500 text-white"
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {["۱", "۲", "۳", "۴"][optIndex]}
                        </span>
                        <span className="flex-1 leading-relaxed">{optionText}</span>
                        {isAnswered && isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        {isAnswered && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Box when answered */}
                {revealedExplanations[activeQuiz.id] && (
                  <div className={`p-4 rounded-xl border text-xs sm:text-sm leading-relaxed space-y-2 animate-in fade-in duration-200 ${
                    userAnswers[activeQuiz.id] === activeQuiz.correctOptionIndex
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                      : "bg-amber-950/40 border-amber-500/30 text-amber-200"
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      <HelpCircle className="w-4 h-4" />
                      <span>پاسخ تشریحی و استناد به قوانین حسابداری ایران:</span>
                    </div>
                    <p className="text-slate-300">{activeQuiz.explanation}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeQuiz.tags?.map((t, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-900/90 text-slate-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                آزمونی در دسترس نیست.
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: JOURNAL VOUCHER PRACTICE SIMULATOR                         */}
        {/* ================================================================= */}
        {activeMiniTab === "practice" && (
          <div className="space-y-5">
            {/* Scenario Chooser */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <span>انتخاب سناریوی واقعی بازار کار جهت تمرین صدور سند:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {scenarios.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => handleSelectScenario(sc)}
                    className={`p-3 rounded-xl border text-right text-xs transition-all ${
                      sc.id === selectedScenarioId
                        ? "bg-teal-950/80 border-teal-500 text-teal-200 font-bold shadow-lg shadow-teal-950/50"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-teal-400">
                        {sc.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        سطح: {sc.difficulty}
                      </span>
                    </div>
                    <p className="line-clamp-2">{sc.title}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario Story */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5 leading-relaxed">
              <span className="font-bold text-teal-400">شرح رویداد مالی در شرکت:</span>
              <p>{activeScenario.description}</p>
            </div>

            {/* Journal Voucher Table Simulator */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-200 text-xs sm:text-sm">
                    برگه سند حسابداری (Journal Voucher)
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    شماره سند: ۱۰۱
                  </span>
                </div>

                <button
                  onClick={handleAddVoucherLine}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/40 text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن ردیف</span>
                </button>
              </div>

              {/* Editable Voucher Rows */}
              <div className="space-y-2 overflow-x-auto">
                <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 px-2 pb-1 border-b border-slate-800">
                  <span className="col-span-2">کد حساب</span>
                  <span className="col-span-3">نام حساب کل / معین</span>
                  <span className="col-span-3">شرح ردیف سند</span>
                  <span className="col-span-2 text-center text-emerald-400">بدهکار (ریال)</span>
                  <span className="col-span-2 text-center text-rose-400">بستانکار (ریال)</span>
                </div>

                {voucherLines.map((line) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-900/80 p-2 rounded-xl border border-slate-850 text-xs"
                  >
                    <input
                      type="text"
                      value={line.accountCode}
                      onChange={(e) => handleUpdateVoucherLine(line.id, "accountCode", e.target.value)}
                      placeholder="کد"
                      className="col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 font-mono text-xs focus:outline-none focus:border-teal-500"
                    />

                    <input
                      type="text"
                      value={line.accountName}
                      onChange={(e) => handleUpdateVoucherLine(line.id, "accountName", e.target.value)}
                      placeholder="عنوان حساب"
                      className="col-span-3 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                    />

                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => handleUpdateVoucherLine(line.id, "description", e.target.value)}
                      placeholder="شرح"
                      className="col-span-3 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-teal-500"
                    />

                    <input
                      type="number"
                      value={line.debit || ""}
                      onChange={(e) => handleUpdateVoucherLine(line.id, "debit", Number(e.target.value) || 0)}
                      placeholder="0"
                      className="col-span-2 bg-slate-950 border border-emerald-900/60 rounded-lg px-2 py-1 text-emerald-300 font-mono text-xs text-center focus:outline-none focus:border-emerald-500"
                    />

                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        value={line.credit || ""}
                        onChange={(e) => handleUpdateVoucherLine(line.id, "credit", Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full bg-slate-950 border border-rose-900/60 rounded-lg px-2 py-1 text-rose-300 font-mono text-xs text-center focus:outline-none focus:border-rose-500"
                      />
                      {voucherLines.length > 2 && (
                        <button
                          onClick={() => handleRemoveVoucherLine(line.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
                          title="حذف ردیف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total & Balance Indicator */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-400">جمع بدهکار: </span>
                    <span className="font-bold font-mono text-emerald-400">{totalDebit.toLocaleString("fa-IR")}</span> ریال
                  </div>
                  <div>
                    <span className="text-slate-400">جمع بستانکار: </span>
                    <span className="font-bold font-mono text-rose-400">{totalCredit.toLocaleString("fa-IR")}</span> ریال
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                    isVoucherBalanced
                      ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/40"
                      : "bg-rose-950/90 text-rose-300 border border-rose-500/40"
                  }`}>
                    {isVoucherBalanced ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>سند کاملاً تراز است</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>اختلاف: {voucherDiff.toLocaleString("fa-IR")} ریال</span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleValidateVoucher}
                    className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-colors shadow-md shadow-teal-900/30"
                  >
                    بررسی و ثبت سند
                  </button>
                </div>
              </div>

              {/* Validation Result Box */}
              {validationResult && (
                <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 animate-in fade-in duration-200 ${
                  validationResult.isBalanced
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                    : "bg-rose-950/40 border-rose-500/30 text-rose-200"
                }`}>
                  <p className="font-bold">{validationResult.feedback}</p>
                  <div className="text-slate-300 border-t border-slate-800/60 pt-2 space-y-1">
                    <p className="font-semibold text-teal-300">💡 پاسخ استاندارد و تحلیل رویداد:</p>
                    <p>{activeScenario.solutionExplanation}</p>
                    <p className="text-amber-300 font-mono text-[11px] pt-1">
                      نکته طلایی قانون: {activeScenario.legalTip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: PAYROLL & TAX CALCULATOR                                  */}
        {/* ================================================================= */}
        {activeMiniTab === "payroll" && (
          <div className="space-y-5">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
              <h3 className="text-sm sm:text-base font-bold text-sky-400 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-sky-400" />
                <span>ماشین‌حساب آنلاین حقوق، بیمه تامین اجتماعی و مالیات حقوق (ایران)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">حقوق پایه ماهانه (ریال):</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                    {baseSalary.toLocaleString("fa-IR")} ریال
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">حق مسکن و بن خواربار (ریال):</label>
                  <input
                    type="number"
                    value={housingAllowance + foodAllowance}
                    onChange={(e) => {
                      const total = Number(e.target.value) || 0;
                      setHousingAllowance(Math.round(total * 0.4));
                      setFoodAllowance(Math.round(total * 0.6));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                    {(housingAllowance + foodAllowance).toLocaleString("fa-IR")} ریال
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">ساعات اضافه کاری در ماه:</label>
                  <input
                    type="number"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">نرخ هر ساعت اضافه کاری (ریال):</label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Calculated Outputs */}
              <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <span className="text-slate-300 font-semibold">ناخالص دریافتی و مشمول بیمه:</span>
                  <span className="font-bold text-sky-300 font-mono">{grossEarnings.toLocaleString("fa-IR")} ریال</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-0.5">بیمه سهم کارگر (۷٪ کسر از حقوق):</span>
                    <span className="font-bold text-rose-400 font-mono">{workerInsurance.toLocaleString("fa-IR")} ریال</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-0.5">بیمه سهم کارفرما (۲۳٪ تامین اجتماعی):</span>
                    <span className="font-bold text-amber-400 font-mono">{employerInsurance.toLocaleString("fa-IR")} ریال</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-0.5">مالیات حقوق ماهانه (ماده ۸۴ ق.م.م):</span>
                    <span className="font-bold text-amber-300 font-mono">{taxSalary.toLocaleString("fa-IR")} ریال</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-500/50">
                    <span className="text-slate-400 block mb-0.5">خالص پرداختی نهایی به پرسنل:</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm">{netPayable.toLocaleString("fa-IR")} ریال</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: SAMANEH MOUDIAN & 10% VAT CALCULATOR                      */}
        {/* ================================================================= */}
        {activeMiniTab === "moudian" && (
          <div className="space-y-5">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
              <h3 className="text-sm sm:text-base font-bold text-indigo-400 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>شبیه‌ساز صدور صورتحساب الکترونیکی سامانه مودیان و ارزش افزوده ۱۰٪</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">قیمت واحد کالا/خدمت (ریال):</label>
                  <input
                    type="number"
                    value={invoiceItemPrice}
                    onChange={(e) => setInvoiceItemPrice(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">تعداد یا مقدار:</label>
                  <input
                    type="number"
                    value={invoiceQuantity}
                    onChange={(e) => setInvoiceQuantity(Number(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">مبلغ تخفیف (ریال):</label>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Electronic Invoice Preview Card */}
              <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">الگوی صورتحساب: نوع ۱ (فروش)</span>
                  <span className="text-emerald-400 font-bold">نرخ مالیات بر ارزش افزوده: ۱۰٪</span>
                </div>

                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span>مبلغ کل قبل از تخفیف:</span>
                    <span>{(invoiceItemPrice * invoiceQuantity).toLocaleString("fa-IR")} ریال</span>
                  </div>
                  <div className="flex justify-between text-amber-400">
                    <span>تخفیفات اعمال‌شده:</span>
                    <span>{discountAmount.toLocaleString("fa-IR")} ریال</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-100">
                    <span>مبلغ پس از کسر تخفیف (مبنای ارزش افزوده):</span>
                    <span>{subtotalBeforeVat.toLocaleString("fa-IR")} ریال</span>
                  </div>
                  <div className="flex justify-between text-indigo-300 font-bold">
                    <span>مالیات و عوارض ارزش افزوده (۱۰٪):</span>
                    <span>{vatAmount.toLocaleString("fa-IR")} ریال</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold text-sm pt-2 border-t border-slate-800">
                    <span>مجموع صورتحساب الکترونیکی:</span>
                    <span>{grandTotal.toLocaleString("fa-IR")} ریال</span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500 font-sans border-t border-slate-850">
                  💡 صورتحساب فوق پس از ارسال از طریق شرکت معتمد یا نرم‌افزار حسابداری، دارای ۲۱ روز مهلت تایید توسط خریدار در کارپوشه سامانه مودیان خواهد بود.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Mini App Footer */}
      <div className="bg-slate-950 border-t border-slate-800/80 px-4 py-2.5 text-center text-[11px] text-slate-500">
        سیستم مینی‌اپ حسابداری کانال‌های تلگرام و بله • مناسب اجرای مستقیم در تلگرام (Telegram WebApp)
      </div>

    </div>
  );
};
