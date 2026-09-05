import React, { useState } from "react";
import { GraduationCap, Sparkles, Send, Tag, AlertTriangle, ShieldCheck, Bookmark, FileText } from "lucide-react";
import { AdvancedTopic, BotConfig } from "../types";
import { formatAdvancedPost } from "../utils/telegramFormat";

interface AdvancedTabProps {
  topics: AdvancedTopic[];
  config: BotConfig;
  onSelectForPublish: (title: string, formattedText: string) => void;
  onAddTopic: (newTopic: AdvancedTopic) => void;
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
  topics,
  config,
  onSelectForPublish,
  onAddTopic,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id || "");
  const [selectedCategory, setSelectedCategory] = useState<string>("همه");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTitle, setAiTitle] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [genError, setGenError] = useState("");

  const categories = [
    "همه",
    "تحلیل صورت‌های مالی",
    "استانداردها و IFRS",
    "دادرسی و قوانین مالیاتی",
    "بهای تمام شده و صنعتی",
  ];

  const filteredTopics = topics.filter((t) =>
    selectedCategory === "همه" ? true : t.category === selectedCategory
  );

  const currentTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];

  const handleGenerateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTitle.trim()) return;

    setIsGenerating(true);
    setGenError("");

    try {
      const res = await fetch("/api/generate-accounting-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "advanced",
          topic: aiTitle,
          promptDetails: aiPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "خطا در تولید محتوای تخصصی");
      }

      const newTopic: AdvancedTopic = {
        id: `custom-adv-${Date.now()}`,
        title: aiTitle,
        category: "دادرسی و قوانین مالیاتی",
        summary: `بررسی عمیق، تحلیل ریسک و استانداردهای حاکم بر ${aiTitle}`,
        content: data.content,
        legalReference: "قوانین مالیاتی و استانداردهای رسمی مصوب سازمان حسابرسی ایران",
        riskWarning: "عدم رعایت الزامات می‌تواند منجر به جرائم مالیاتی سنگین و عدم پذیرش هزینه‌ها گردد.",
        tags: ["#حسابداری_حرفه_ای", "#تحلیل_تخصصی", `#${aiTitle.replace(/\s+/g, "_")}`],
        isCustom: true,
      };

      onAddTopic(newTopic);
      setSelectedTopicId(newTopic.id);
      setShowAiModal(false);
      setAiTitle("");
      setAiPrompt("");
    } catch (err: any) {
      setGenError(err.message || "خطا در ایجاد پست تخصصی");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishClick = (topic: AdvancedTopic) => {
    const formatted = formatAdvancedPost(topic, config);
    onSelectForPublish(topic.title, formatted);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-l from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  سبک دوم: آموزش حسابداری در سطح حرفه‌ای، تحلیلی و تخصصی
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                  {topics.length} مبحث فوق‌تخصصی
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                ویژه حسابداران ارشد، مدیران مالی، مشاوران مالیاتی و حسابرسان. شامل مقایسه IFRS با استانداردهای ایران،
                تکنیک‌های دفاع در هیئت‌های حل اختلاف مالیاتی، مدل‌های ارزش‌گذاری، هزینه‌یابی صنعتی ABC و ماده ۱۴۱ قانون تجارت.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-900/30 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>تولید مسترکلاس تخصصی جدید</span>
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 mt-5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Topics Sidebar + Article View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Topics List */}
        <div className="lg:col-span-4 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {filteredTopics.map((topic) => {
            const isSelected = topic.id === currentTopic?.id;
            return (
              <div
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all text-right ${
                  isSelected
                    ? "bg-indigo-950/40 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30"
                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {topic.category}
                  </span>
                  {topic.legalReference && (
                    <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                      دارای مستند قانونی
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-200 line-clamp-1 mb-1">
                  {topic.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {topic.summary}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Selected Topic View */}
        <div className="lg:col-span-8">
          {currentTopic ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[580px]">
              <div>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 text-xs font-bold border border-indigo-500/30">
                        سطح پیشرفته و حرفه‌ای
                      </span>
                      <span className="text-xs text-slate-400">{currentTopic.category}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-100">
                      {currentTopic.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handlePublishClick(currentTopic)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-900/30 whitespace-nowrap"
                  >
                    <Send className="w-4 h-4 rotate-180" />
                    <span>پیش‌نمایش و ارسال به کانال</span>
                  </button>
                </div>

                {/* Body Content */}
                <div className="py-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <div className="whitespace-pre-wrap leading-relaxed">{currentTopic.content}</div>

                  {currentTopic.legalReference && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold text-xs mb-1 text-indigo-300">
                          مستندات قانونی و استاندارد مرجع:
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {currentTopic.legalReference}
                        </p>
                      </div>
                    </div>
                  )}

                  {currentTopic.riskWarning && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-2.5 text-rose-200">
                      <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold text-xs mb-0.5 text-rose-300">
                          هشدار ریسک حسابرسی / رد دفاتر:
                        </div>
                        <p className="text-xs leading-relaxed">{currentTopic.riskWarning}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags & Footer */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center flex-wrap gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {currentTopic.tags.map((t, idx) => (
                    <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500">
                  سازگار با فرمت HTML و MarkdownV2
                </span>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              یک مبحث تخصصی را انتخاب کنید.
            </div>
          )}
        </div>

      </div>

      {/* AI Masterclass Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  تولید پست تخصصی با هوش مصنوعی
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  عنوان یا موضوع تخصصی مورد نظر:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: استاندارد ۱۶ تسعیر ارز، ماده ۲۵۱ مکرر ق.م.م، کنترل‌های داخلی COSO، ارزش منصفانه IFRS 13"
                  value={aiTitle}
                  onChange={(e) => setAiTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  دستورالعمل‌ها و نکات کلیدی (اختیاری):
                </label>
                <textarea
                  rows={3}
                  placeholder="مثلاً: مقایسه دقیق با استاندارد حسابداری ایران، اشاره به آیین‌نامه اجرایی و فرمول‌های محاسبه"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
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
                  disabled={isGenerating || !aiTitle.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>در حال نگارش مقاله تخصصی...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>تولید و ثبت در لیست</span>
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
