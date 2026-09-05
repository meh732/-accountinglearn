import React, { useState } from "react";
import {
  DailyQuizItem,
  BotConfig,
  MessengerPlatform,
  LessonItem,
} from "../types";
import {
  HelpCircle,
  Sparkles,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  Radio,
  Share2,
  Copy,
  ExternalLink,
  Smartphone,
  BookOpen,
  Filter,
  Check,
  AlertCircle,
  Eye,
} from "lucide-react";

interface DailyQuizzesTabProps {
  quizzes: DailyQuizItem[];
  lessons: LessonItem[];
  config: BotConfig;
  onSendQuizToChannel: (quiz: DailyQuizItem, platforms: MessengerPlatform[]) => Promise<void>;
  onAddQuiz: (newQuiz: DailyQuizItem) => void;
  onDeleteQuiz: (id: string) => void;
  onOpenMiniAppSimulator: () => void;
}

export const DailyQuizzesTab: React.FC<DailyQuizzesTabProps> = ({
  quizzes,
  lessons,
  config,
  onSendQuizToChannel,
  onAddQuiz,
  onDeleteQuiz,
  onOpenMiniAppSimulator,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // AI Generation State
  const [aiTopic, setAiTopic] = useState("");
  const [aiSelectedLessonId, setAiSelectedLessonId] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  // Manual Creation State
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState<DailyQuizItem["category"]>("مفاهیم پایه");
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualOptions, setManualOptions] = useState<string[]>(["", "", "", ""]);
  const [manualCorrectIndex, setManualCorrectIndex] = useState(0);
  const [manualExplanation, setManualExplanation] = useState("");

  // Sending State
  const [sendingQuizId, setSendingQuizId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Mini App URL
  const studentAppUrl = typeof window !== "undefined"
    ? `${window.location.origin}?view=student`
    : "https://acc-bot.example.com?view=student";

  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(studentAppUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleGenerateWithAi = async () => {
    setIsAiGenerating(true);
    setAiError("");

    try {
      let promptTopic = aiTopic;
      if (!promptTopic && aiSelectedLessonId) {
        const lesson = lessons.find((l) => l.id === aiSelectedLessonId);
        if (lesson) {
          promptTopic = `درس ${lesson.lessonNumber}: ${lesson.title} - ${lesson.summary}`;
        }
      }

      const res = await fetch("/api/generate-accounting-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "daily_quiz",
          topic: promptTopic || "مفاهیم اساسی حسابداری و ثبت سند یا مالیات",
          promptDetails: "یک آزمون چهارگزینه‌ای کاربردی با استناد به قوانین مالیاتی یا استانداردهای ایران",
        }),
      });

      const data = await res.json();
      if (!data.ok || !data.content) {
        throw new Error(data.error || "پاسخی از هوش مصنوعی دریافت نشد.");
      }

      // Parse JSON from markdown or raw text
      let jsonStr = data.content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(jsonStr);

      const newQuiz: DailyQuizItem = {
        id: "quiz-" + Date.now(),
        dayNumber: quizzes.length + 1,
        title: parsed.title || `آزمون روزانه: ${promptTopic.slice(0, 30)}`,
        category: (parsed.category as any) || "مفاهیم پایه",
        question: parsed.question,
        options: parsed.options || ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
        correctOptionIndex: typeof parsed.correctOptionIndex === "number" ? parsed.correctOptionIndex : 0,
        explanation: parsed.explanation || "استناد به استانداردهای حسابداری و مقررات مالیاتی ایران",
        tags: parsed.tags || ["#آزمون_حسابداری", "#تست_روزانه"],
        isCustom: true,
      };

      onAddQuiz(newQuiz);
      setIsAiModalOpen(false);
      setAiTopic("");
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "خطا در استخراج و تحلیل داده‌های هوش مصنوعی");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleCreateManualQuiz = () => {
    if (!manualQuestion || manualOptions.some((o) => !o.trim())) {
      alert("لطفاً صورت سوال و هر ۴ گزینه را تکمیل فرمایید.");
      return;
    }

    const newQuiz: DailyQuizItem = {
      id: "quiz-" + Date.now(),
      dayNumber: quizzes.length + 1,
      title: manualTitle || `آزمون روزانه ${quizzes.length + 1}`,
      category: manualCategory,
      question: manualQuestion,
      options: manualOptions,
      correctOptionIndex: manualCorrectIndex,
      explanation: manualExplanation || "طبق استانداردهای رسمی حسابداری ایران",
      tags: ["#آزمون_حسابداری", "#تست_روزانه"],
      isCustom: true,
    };

    onAddQuiz(newQuiz);
    setIsManualModalOpen(false);
    setManualTitle("");
    setManualQuestion("");
    setManualOptions(["", "", "", ""]);
    setManualExplanation("");
  };

  // Filtered Quizzes
  const filteredQuizzes = quizzes.filter((q) => {
    const matchCat = selectedCategory === "all" || q.category === selectedCategory;
    const matchQuery =
      searchQuery.trim() === "" ||
      q.title.includes(searchQuery) ||
      q.question.includes(searchQuery) ||
      q.explanation.includes(searchQuery);
    return matchCat && matchQuery;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner: WebApp & Channel Member Integration */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/50">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  سامانه آزمون‌های روزانه کانال و مینی‌اپ حسابداری اعضا
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Telegram & Bale WebApp
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                پس از ارسال هر آموزش به کانال، یک آزمون چهارگزینه‌ای به صورت نظرسنجی (Telegram Quiz Poll) منتشر کنید. اعضای کانال می‌توانند مستقیماً وارد مینی‌اپ شده، آزمون آنلاین بدهند، کارنامه دریافت کنند و با نرم‌افزار حسابداری تمرین کنند.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={onOpenMiniAppSimulator}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-900/40"
            >
              <Smartphone className="w-4 h-4" />
              <span>📱 شبیه‌ساز مینی‌اپ اعضا</span>
            </button>

            <button
              onClick={handleCopyAppUrl}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              title="کپی لینک اختصاصی جهت قراردادن در تلگرام یا بیو کانال"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">کپی شد!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>کپی لینک وب‌اپ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: AI Generator, Manual Add, Search & Categories */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        
        {/* Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-900/30 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>تولید آزمون با هوش مصنوعی (AI)</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن آزمون دستی</span>
          </button>
        </div>

        {/* Filter & Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در سوالات و آزمون‌ها..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">همه دسته‌ها ({quizzes.length})</option>
            <option value="مفاهیم پایه">مفاهیم پایه</option>
            <option value="اسناد و دفاتر">اسناد و دفاتر</option>
            <option value="حقوق و دستمزد">حقوق و دستمزد</option>
            <option value="مالیات و مودیان">مالیات و مودیان</option>
            <option value="استانداردها و تحلیل">استانداردها و تحلیل</option>
          </select>
        </div>

      </div>

      {/* Quizzes List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredQuizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 transition-all shadow-lg shadow-slate-950/40"
          >
            <div className="space-y-3">
              {/* Header Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
                    {quiz.dayNumber}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                    {quiz.category}
                  </span>
                </div>

                <button
                  onClick={() => onDeleteQuiz(quiz.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                  title="حذف آزمون"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title & Question */}
              <div>
                <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-snug mb-1.5">
                  {quiz.title}
                </h3>
                <p className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-850 leading-relaxed">
                  {quiz.question}
                </p>
              </div>

              {/* 4 Choices */}
              <div className="space-y-1.5">
                {quiz.options.map((opt, idx) => {
                  const isCorrect = idx === quiz.correctOptionIndex;
                  return (
                    <div
                      key={idx}
                      className={`text-xs p-2.5 rounded-xl border flex items-center gap-2 ${
                        isCorrect
                          ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200 font-semibold"
                          : "bg-slate-950/40 border-slate-850 text-slate-400"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-mono ${
                        isCorrect ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"
                      }`}>
                        {["۱", "۲", "۳", "۴"][idx]}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                          گزینه صحیح ✅
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation note */}
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-850 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 block">💡 استناد قانونی و پاسخ تشریحی:</span>
                <p className="leading-relaxed">{quiz.explanation}</p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">ارسال نظرسنجی:</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={sendingQuizId === quiz.id}
                  onClick={async () => {
                    setSendingQuizId(quiz.id);
                    try {
                      await onSendQuizToChannel(quiz, ["telegram", "bale"]);
                    } finally {
                      setSendingQuizId(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
                  title="ارسال همزمان به کانال‌های تلگرام و بله با دکمه ورود به مینی‌اپ"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingQuizId === quiz.id ? "در حال ارسال..." : "ارسال به کانال"}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Quiz Generator Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  تولید هوشمند آزمون ۴ گزینه‌ای حسابداری
                </h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                بستن
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هوش مصنوعی بر اساس قوانین مالیاتی ایران، استانداردهای حسابداری و سامانه مودیان یک آزمون استاندارد با ۴ گزینه، پاسخ صحیح و توضیح تشریحی تولید خواهد کرد.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  انتخاب درس مرتبط (اختیاری):
                </label>
                <select
                  value={aiSelectedLessonId}
                  onChange={(e) => setAiSelectedLessonId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">بدون انتخاب درس (موضوع دلخواه)</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      درس {l.lessonNumber}: {l.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  یا موضوع سفارشی را بنویسید:
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="مثال: نرخ ارزش افزوده ۱۰٪، ماده ۱۴۱ قانون تجارت، ثبت استهلاک انباشته..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {aiError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                انصراف
              </button>
              <button
                disabled={isAiGenerating}
                onClick={handleGenerateWithAi}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/40 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAiGenerating ? "در حال تولید آزمون..." : "تولید با هوش مصنوعی"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Quiz Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                افزودن دستی آزمون چهارگزینه‌ای
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                بستن
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">عنوان آزمون:</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="مثال: آزمون روزانه ماهیت حساب‌های دائم و موقت"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">دسته‌بندی:</label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="مفاهیم پایه">مفاهیم پایه</option>
                  <option value="اسناد و دفاتر">اسناد و دفاتر</option>
                  <option value="حقوق و دستمزد">حقوق و دستمزد</option>
                  <option value="مالیات و مودیان">مالیات و مودیان</option>
                  <option value="استانداردها و تحلیل">استانداردها و تحلیل</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">متن صورت سوال:</label>
                <textarea
                  rows={3}
                  value={manualQuestion}
                  onChange={(e) => setManualQuestion(e.target.value)}
                  placeholder="متن کامل سوال تستی را اینجا وارد نمایید..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="text-slate-300 block">گزینه‌های پاسخ (گزینه صحیح را تیک بزنید):</label>
                {manualOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct_opt"
                      checked={manualCorrectIndex === i}
                      onChange={() => setManualCorrectIndex(i)}
                      className="accent-emerald-500 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...manualOptions];
                        copy[i] = e.target.value;
                        setManualOptions(copy);
                      }}
                      placeholder={`گزینه ${i + 1}`}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-slate-300 block mb-1">پاسخ تشریحی و استناد قانونی:</label>
                <textarea
                  rows={2}
                  value={manualExplanation}
                  onChange={(e) => setManualExplanation(e.target.value)}
                  placeholder="تشریح پاسخ و اشاره به ماده قانون یا استاندارد..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateManualQuiz}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/40"
              >
                ثبت و ذخیره آزمون
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
