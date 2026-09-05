import React, { useState } from "react";
import { BookOpen, Sparkles, Send, Plus, Tag, CheckCircle2, ChevronLeft, Lightbulb, HelpCircle, FileText } from "lucide-react";
import { LessonItem, BotConfig } from "../types";
import { formatZeroToHeroPost } from "../utils/telegramFormat";

interface ZeroToHeroTabProps {
  lessons: LessonItem[];
  config: BotConfig;
  onSelectForPublish: (title: string, formattedText: string) => void;
  onAddLesson: (newLesson: LessonItem) => void;
}

export const ZeroToHeroTab: React.FC<ZeroToHeroTabProps> = ({
  lessons,
  config,
  onSelectForPublish,
  onAddLesson,
}) => {
  const [selectedLessonId, setSelectedLessonId] = useState<string>(lessons[0]?.id || "");
  const [selectedCategory, setSelectedCategory] = useState<string>("همه");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDetails, setAiDetails] = useState("");
  const [genError, setGenError] = useState("");

  const categories = ["همه", "مفاهیم پایه", "اسناد و دفاتر", "حقوق و دستمزد", "مالیات و مودیان", "صورت‌های مالی"];

  const filteredLessons = lessons.filter((l) =>
    selectedCategory === "همه" ? true : l.category === selectedCategory
  );

  const currentLesson = lessons.find((l) => l.id === selectedLessonId) || lessons[0];

  const handleGenerateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;

    setIsGenerating(true);
    setGenError("");

    try {
      const res = await fetch("/api/generate-accounting-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "zero_to_hero",
          topic: aiTopic,
          promptDetails: aiDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "خطا در برقراری ارتباط با سرور");
      }

      const generatedContent = data.content;

      // Create new lesson item
      const nextNum = Math.max(...lessons.map((l) => l.lessonNumber), 0) + 1;
      const newLesson: LessonItem = {
        id: `custom-lesson-${Date.now()}`,
        lessonNumber: nextNum,
        title: aiTopic,
        category: "اسناد و دفاتر",
        summary: `آموزش تخصصی ${aiTopic} منطبق بر قوانین و ثبت‌های حسابداری ایران`,
        content: generatedContent,
        keyRule: "ثبت صحیح بر اساس استانداردهای حسابداری ایران و ضوابط ماده ۱۴۸ ق.م.م",
        tags: ["#آموزش_صفر_تا_صد", "#حسابداری_ایران", `#${aiTopic.replace(/\s+/g, "_")}`],
        isCustom: true,
      };

      onAddLesson(newLesson);
      setSelectedLessonId(newLesson.id);
      setShowAiModal(false);
      setAiTopic("");
      setAiDetails("");
    } catch (err: any) {
      setGenError(err.message || "خطا در تولید درس توسط هوش مصنوعی");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishClick = (lesson: LessonItem) => {
    const formatted = formatZeroToHeroPost(lesson, config);
    onSelectForPublish(`درس ${lesson.lessonNumber}: ${lesson.title}`, formatted);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-l from-emerald-900/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  سبک اول: آموزش گام‌به‌گام از صفر تا صد حسابداری ایران
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  {lessons.length} درس آماده
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                مجموعه منسجم و شماره‌گذاری‌شده برای مخاطبان کانال از سطح مبتدی تا کارشناس مالی شامل قوانین تجارت،
                ماهیت حساب‌ها، فرمول‌های حقوق و دستمزد، بیمه تامین اجتماعی، مالیات ارزش افزوده و سامانه مودیان.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>تولید درس جدید با هوش مصنوعی</span>
          </button>
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 mt-5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Lessons Syllabus List */}
        <div className="lg:col-span-4 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {filteredLessons.map((lesson) => {
            const isSelected = lesson.id === currentLesson?.id;
            return (
              <div
                key={lesson.id}
                onClick={() => setSelectedLessonId(lesson.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all text-right ${
                  isSelected
                    ? "bg-emerald-950/40 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30"
                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                    درس {lesson.lessonNumber}
                  </span>
                  <span className="text-[10px] text-slate-500">{lesson.category}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 line-clamp-1 mb-1">
                  {lesson.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {lesson.summary}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected Lesson Detail & Actions */}
        <div className="lg:col-span-8">
          {currentLesson ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[580px]">
              
              <div>
                {/* Lesson Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                        درس شماره {currentLesson.lessonNumber}
                      </span>
                      <span className="text-xs text-slate-400">سرفصل: {currentLesson.category}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-100">
                      {currentLesson.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handlePublishClick(currentLesson)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 whitespace-nowrap"
                  >
                    <Send className="w-4 h-4 rotate-180" />
                    <span>پیش‌نمایش و ارسال به کانال</span>
                  </button>
                </div>

                {/* Lesson Body Content */}
                <div className="py-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <div className="whitespace-pre-wrap">{currentLesson.content}</div>

                  {currentLesson.practicalExample && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2 text-xs">
                        <FileText className="w-4 h-4" />
                        <span>مثال کاربردی و ثبت دفاتر:</span>
                      </div>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-black/30 p-2.5 rounded-lg border border-white/5" dir="rtl">
                        {currentLesson.practicalExample}
                      </pre>
                    </div>
                  )}

                  {currentLesson.keyRule && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-200">
                      <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold text-xs mb-0.5 text-amber-300">نکته طلایی بازار کار:</div>
                        <p className="text-xs leading-relaxed">{currentLesson.keyRule}</p>
                      </div>
                    </div>
                  )}

                  {currentLesson.quizQuestion && (
                    <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3.5 flex items-start gap-2.5 text-sky-200">
                      <HelpCircle className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold text-xs mb-0.5 text-sky-300">چالش و سوال انتهای درس:</div>
                        <p className="text-xs leading-relaxed">{currentLesson.quizQuestion}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Lesson Footer / Tags */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center flex-wrap gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {currentLesson.tags.map((t, idx) => (
                    <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500">
                  آماده قالب‌بندی خودکار تلگرام و بله
                </span>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              یک درس را برای مشاهده و ارسال انتخاب کنید.
            </div>
          )}
        </div>

      </div>

      {/* AI Lesson Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  تولید درس صفر تا صد با هوش مصنوعی
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  موضوع یا مبحث حسابداری مدنظر:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: روش‌های محاسبه استهلاک طبق ماده ۱۴۹، حسابداری تنخواه، ثبت اسناد دریافتنی واخواستی"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  توضیحات و نیازمندی‌های خاص (اختیاری):
                </label>
                <textarea
                  rows={3}
                  placeholder="مثلاً: تمرکز روی ثبت‌های دوبل، مثال ریالی با ارقام واقعی، اشاره به آخرین بخشنامه مالیاتی"
                  value={aiDetails}
                  onChange={(e) => setAiDetails(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
                  dir="rtl"
                />
              </div>

              {genError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {genError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !aiTopic.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>در حال تولید متن درس...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>تولید و افزودن به درس‌ها</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
