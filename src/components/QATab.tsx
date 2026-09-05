import React, { useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Send,
  Plus,
  CheckCircle,
  Clock,
  User,
  Shield,
  HelpCircle,
  Lightbulb,
  Radio,
  FileCheck,
  Edit3,
} from "lucide-react";
import { QuestionItem, BotConfig, QuestionStatus } from "../types";
import { formatQAPost, formatCallForQuestionsPost } from "../utils/telegramFormat";

interface QATabProps {
  questions: QuestionItem[];
  config: BotConfig;
  onSelectForPublish: (title: string, formattedText: string) => void;
  onUpdateQuestion: (updated: QuestionItem) => void;
  onAddQuestion: (newQ: QuestionItem) => void;
}

export const QATab: React.FC<QATabProps> = ({
  questions,
  config,
  onSelectForPublish,
  onUpdateQuestion,
  onAddQuestion,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"questions" | "call_for_questions">("questions");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(questions[0]?.id || "");
  const [statusFilter, setStatusFilter] = useState<string>("همه");

  // Call for questions generator state
  const [callTopic, setCallTopic] = useState("مسائل مالیاتی، سامانه مودیان، حقوق و دستمزد و ثبت دفاتر");
  const [isGeneratingCallPost, setIsGeneratingCallPost] = useState(false);
  const [customCallPostText, setCustomCallPostText] = useState("");

  // New question form state
  const [showNewQModal, setShowNewQModal] = useState(false);
  const [newAsker, setNewAsker] = useState("");
  const [newCat, setNewCat] = useState<QuestionItem["category"]>("مالیات و سامانه مودیان");
  const [newText, setNewText] = useState("");

  // Admin answering workspace state
  const currentQuestion = questions.find((q) => q.id === selectedQuestionId) || questions[0];
  const [adminAnswerText, setAdminAnswerText] = useState(currentQuestion?.adminAnswer || "");
  const [legalRef, setLegalRef] = useState(currentQuestion?.legalCitations || "");
  const [goldenTip, setGoldenTip] = useState(currentQuestion?.goldenTip || "");
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [aiError, setAiError] = useState("");

  // Sync state when selected question changes
  React.useEffect(() => {
    if (currentQuestion) {
      setAdminAnswerText(currentQuestion.adminAnswer || "");
      setLegalRef(currentQuestion.legalCitations || "");
      setGoldenTip(currentQuestion.goldenTip || "");
      setAiError("");
    }
  }, [currentQuestion?.id]);

  const filteredQuestions = questions.filter((q) => {
    if (statusFilter === "همه") return true;
    return q.status === statusFilter;
  });

  // Handle Admin Save Answer
  const handleSaveAnswer = (status: QuestionStatus) => {
    if (!currentQuestion) return;
    const updated: QuestionItem = {
      ...currentQuestion,
      adminAnswer: adminAnswerText,
      legalCitations: legalRef,
      goldenTip: goldenTip,
      status: status,
    };
    onUpdateQuestion(updated);
  };

  // Handle AI Drafting Assistance
  const handleAiDraftSuggestion = async () => {
    if (!currentQuestion) return;
    setIsAiDrafting(true);
    setAiError("");

    try {
      const res = await fetch("/api/generate-accounting-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "qa_answer",
          topic: currentQuestion.questionText,
          promptDetails: `دسته‌بندی: ${currentQuestion.category}. با استناد صریح به مواد قانون مالیات‌های مستقیم، تامین اجتماعی، استانداردهای حسابداری ایران و سامانه مودیان.`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "خطا در دریافت پیشنهاد هوش مصنوعی");
      }

      setAdminAnswerText(data.content);
      if (!legalRef) {
        setLegalRef("بر اساس قوانین جاری مالیاتی و استانداردهای حسابداری رسمی مصوب سازمان حسابرسی");
      }
    } catch (err: any) {
      setAiError(err.message || "خطا در پاسخ هوش مصنوعی");
    } finally {
      setIsAiDrafting(false);
    }
  };

  // Publish Q&A Post to Channel
  const handlePublishQAPost = () => {
    if (!currentQuestion) return;
    // ensure current values are captured
    const qToPublish: QuestionItem = {
      ...currentQuestion,
      adminAnswer: adminAnswerText,
      legalCitations: legalRef,
      goldenTip: goldenTip,
      status: "published",
      publishedAt: new Date().toLocaleDateString("fa-IR"),
    };
    onUpdateQuestion(qToPublish);

    const formatted = formatQAPost(qToPublish, config);
    onSelectForPublish(`پاسخ به سوال: ${qToPublish.questionText.slice(0, 40)}...`, formatted);
  };

  // Publish Call for questions post
  const handlePublishCallPost = () => {
    const text = customCallPostText || formatCallForQuestionsPost(callTopic, config);
    onSelectForPublish(`دعوت به ارسال سوالات: ${callTopic}`, text);
  };

  // Generate Custom Call Post with AI
  const handleGenerateCallPostWithAi = async () => {
    setIsGeneratingCallPost(true);
    try {
      const res = await fetch("/api/generate-accounting-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "call_for_questions",
          topic: callTopic,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCustomCallPostText(data.content);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingCallPost(false);
    }
  };

  const handleAddNewQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    const newQ: QuestionItem = {
      id: `q-${Date.now()}`,
      askerName: newAsker.trim() || "کاربر کانال",
      askedAt: new Date().toLocaleDateString("fa-IR"),
      category: newCat,
      questionText: newText.trim(),
      status: "pending",
      adminAnswer: "",
    };

    onAddQuestion(newQ);
    setSelectedQuestionId(newQ.id);
    setShowNewQModal(false);
    setNewAsker("");
    setNewText("");
  };

  const getStatusBadge = (status: QuestionStatus) => {
    switch (status) {
      case "published":
        return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">منتشر شده در کانال</span>;
      case "answered":
        return <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium">پاسخ‌داده شده (آماده ارسال)</span>;
      case "drafted":
        return <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-medium">پیش‌نویس</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-medium">در انتظار پاسخ ادمین</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-l from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/20 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  سبک سوم: سیستم تعاملی پرسش و پاسخ (پاسخ توسط ادمین)
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                  {questions.length} پرسش ثبت شده
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                فرآیند کامل دو مرحله‌ای: ارسال پست دعوت به طرح سوال به کانال تلگرام و بله، سپس دریافت و مدیریت سوالات،
                پاسخ‌دهی دقیق توسط ادمین (با امکان پیش‌نویس هوش مصنوعی و استناد قانونی)، و در نهایت انتشار شکیل پاسخ در کانال.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewQModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت سوال جدید دستی</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs: Questions Inbox vs Call for Questions */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-800 pt-3">
          <button
            onClick={() => setActiveSubTab("questions")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === "questions"
                ? "bg-amber-600 text-white"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>صندوق سوالات و میز کار ادمین ({questions.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("call_for_questions")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === "call_for_questions"
                ? "bg-amber-600 text-white"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>مرحله اول: ارسال پست «دعوت به طرح سوال» به کانال</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Call for Questions Post Generator */}
      {activeSubTab === "call_for_questions" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-400" />
                <span>تنظیم و ارسال پست دعوت به طرح سوال به اعضای کانال</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                این پست را در کانال منتشر کنید تا اعضا سوالات و چالش‌های حسابداری و مالیاتی خود را بفرستند.
              </p>
            </div>

            <button
              onClick={handlePublishCallPost}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30 whitespace-nowrap"
            >
              <Send className="w-4 h-4 rotate-180" />
              <span>پیش‌نمایش و ارسال پست دعوت به کانال</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  موضوع یا محور سوالات این نوبت:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={callTopic}
                    onChange={(e) => setCallTopic(e.target.value)}
                    placeholder="مثلاً: چالش‌های ارسال صورتحساب در سامانه مودیان، لیست حقوق و دستمزد، تکالیف فصلی"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    dir="rtl"
                  />
                  <button
                    onClick={handleGenerateCallPostWithAi}
                    disabled={isGeneratingCallPost}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تولید متن با هوش مصنوعی</span>
                  </button>
                </div>
              </div>

              {/* Ready presets */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5">قالب‌های سریع:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "سامانه مودیان و پایانه‌های فروشگاهی",
                    "مالیات حقوق، بیمه تامین اجتماعی و قانون کار",
                    "بستن حساب‌های پایان سال و اظهارنامه عملکرد",
                    "ارزش افزوده و استرداد مالیاتی",
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setCallTopic(preset)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live preview of the call post */}
            <div className="lg:col-span-6 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 text-xs text-slate-400">
                <span className="font-semibold text-slate-300">پیش‌نمایش پست دعوت:</span>
                <span className="text-[10px] text-amber-400">آماده ارسال</span>
              </div>
              <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {customCallPostText || formatCallForQuestionsPost(callTopic, config)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Questions Queue & Admin Answering Workspace */}
      {activeSubTab === "questions" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Questions List & Filters */}
          <div className="lg:col-span-4 space-y-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {["همه", "pending", "drafted", "answered", "published"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                    statusFilter === s
                      ? "bg-amber-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s === "همه"
                    ? "همه"
                    : s === "pending"
                    ? "در انتظار"
                    : s === "drafted"
                    ? "پیش‌نویس"
                    : s === "answered"
                    ? "پاسخ داده"
                    : "منتشر شده"}
                </button>
              ))}
            </div>

            {/* Questions List */}
            <div className="space-y-2.5 max-h-[660px] overflow-y-auto pr-1">
              {filteredQuestions.map((q) => {
                const isSelected = q.id === currentQuestion?.id;
                return (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQuestionId(q.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all text-right ${
                      isSelected
                        ? "bg-amber-950/40 border-amber-500/50 shadow-md ring-1 ring-amber-500/30"
                        : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <User className="w-3 h-3" />
                        <span className="font-semibold text-slate-300">{q.askerName}</span>
                      </div>
                      {getStatusBadge(q.status)}
                    </div>
                    <p className="text-xs text-slate-200 font-medium line-clamp-2 mb-2 leading-relaxed">
                      «{q.questionText}»
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{q.category}</span>
                      <span>{q.askedAt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Admin Answering Workspace */}
          <div className="lg:col-span-8">
            {currentQuestion ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[640px]">
                
                <div>
                  {/* Question Info Header */}
                  <div className="pb-4 border-b border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                          {currentQuestion.category}
                        </span>
                        <span className="text-xs text-slate-400">طرح شده توسط: {currentQuestion.askerName} ({currentQuestion.askedAt})</span>
                      </div>
                      {getStatusBadge(currentQuestion.status)}
                    </div>
                    
                    {/* User Question Highlight */}
                    <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-3.5 mt-2">
                      <div className="text-xs text-amber-400 font-bold mb-1 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>متن سوال کاربر:</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                        «{currentQuestion.questionText}»
                      </p>
                    </div>
                  </div>

                  {/* Admin Workspace Form */}
                  <div className="py-4 space-y-4">
                    
                    {/* Admin Answer Box */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>پاسخ کارشناسی و رسمی ادمین:</span>
                        </label>

                        {/* AI Drafting Button */}
                        <button
                          type="button"
                          onClick={handleAiDraftSuggestion}
                          disabled={isAiDrafting}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-colors disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isAiDrafting ? "در حال استخراج مواد قانونی..." : "💡 پیشنهاد پاسخ با هوش مصنوعی (استناد به قوانین)"}</span>
                        </button>
                      </div>

                      <textarea
                        rows={6}
                        value={adminAnswerText}
                        onChange={(e) => setAdminAnswerText(e.target.value)}
                        placeholder="پاسخ صریح و مستند خود را به عنوان ادمین بنویسید (یا از دکمه پیشنهاد هوش مصنوعی استفاده کرده و آن را ویرایش کنید)..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500 leading-relaxed resize-y"
                        dir="rtl"
                      />
                    </div>

                    {aiError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                        {aiError}
                      </div>
                    )}

                    {/* Legal Citation and Golden Tip in 2 Cols */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-amber-400" />
                          <span>مستند قانونی / شماره ماده قانون:</span>
                        </label>
                        <input
                          type="text"
                          value={legalRef}
                          onChange={(e) => setLegalRef(e.target.value)}
                          placeholder="مثلاً: ماده ۱۳۱ ق.م.م، بخشنامه ۲۰۰/۱۴۰۲/۵ یا دادنامه دیوان"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          dir="rtl"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-amber-400" />
                          <span>توصیه یا نکته کلیدی ادمین:</span>
                        </label>
                        <input
                          type="text"
                          value={goldenTip}
                          onChange={(e) => setGoldenTip(e.target.value)}
                          placeholder="مثلاً: قبل از ابطال حتماً با خریدار هماهنگ کنید تا در سقف فروش لحاظ نشود"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          dir="rtl"
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Footer Actions: Save Draft & Publish */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveAnswer("drafted")}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      ذخیره به عنوان پیش‌نویس
                    </button>
                    <button
                      onClick={() => handleSaveAnswer("answered")}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      تایید پاسخ ادمین
                    </button>
                  </div>

                  <button
                    onClick={handlePublishQAPost}
                    disabled={!adminAnswerText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                  >
                    <Send className="w-4 h-4 rotate-180" />
                    <span>پیش‌نمایش و انتشار پست در کانال</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                یک سوال را برای پاسخ‌دهی و انتشار انتخاب کنید.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Add New Question Modal */}
      {showNewQModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  ثبت سوال دریافتی از اعضای کانال
                </h3>
              </div>
              <button
                onClick={() => setShowNewQModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  نام یا عنوان مطرح‌کننده (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: آقای کاظمی (حسابدار شرکت پیمانکاری) یا کاربر تلگرام"
                  value={newAsker}
                  onChange={(e) => setNewAsker(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  دسته‌بندی موضوع سوال:
                </label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  dir="rtl"
                >
                  <option value="مالیات و سامانه مودیان">مالیات و سامانه مودیان</option>
                  <option value="حقوق، دستمزد و بیمه">حقوق، دستمزد و بیمه</option>
                  <option value="استانداردها و ثبت حسابداری">استانداردها و ثبت حسابداری</option>
                  <option value="قانون تجارت و شرکت‌ها">قانون تجارت و شرکت‌ها</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  متن کامل سوال کاربر:
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="متن سوال ارسالی عضو کانال را اینجا وارد کنید..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                  dir="rtl"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewQModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                >
                  ثبت در صندوق سوالات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
