import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Sparkles,
  Send,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  HelpCircle,
  FileText,
  Calendar,
  Clock,
  Layers,
  Vote,
  Copy,
  Check,
  Edit3,
  ListFilter,
  Flame,
  Search,
  ArrowRight,
  ExternalLink,
  Newspaper,
  Smile,
  RefreshCw,
  Shuffle,
  ShieldCheck,
  Radio,
  Sliders,
} from "lucide-react";
import {
  ThreeMonthDayItem,
  DayPostItem,
  BotConfig,
  LessonItem,
  AccountingNewsItem,
  AccountingFunItem,
  DailyPlanMode,
} from "../types";
import { monthsMeta, getOrCreateDayItem } from "../data/threeMonthCurriculum";
import {
  formatDayPost,
  formatZeroToHeroPost,
  formatNewsPost,
  formatFunPost,
} from "../utils/telegramFormat";
import {
  verifiedAccountingNews,
  accountingFunPosts,
} from "../data/accountingNewsAndFun";
import { NewsAndFunBankModal } from "./NewsAndFunBankModal";

interface ZeroToHeroTabProps {
  lessons: LessonItem[];
  threeMonthDays: ThreeMonthDayItem[];
  config: BotConfig;
  onSelectForPublish: (title: string, formattedText: string) => void;
  onUpdateDay: (updatedDay: ThreeMonthDayItem) => void;
  onSendQuizToChannel?: (quiz: {
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
    title: string;
  }) => Promise<void>;
}

export const ZeroToHeroTab: React.FC<ZeroToHeroTabProps> = ({
  lessons,
  threeMonthDays,
  config,
  onSelectForPublish,
  onUpdateDay,
  onSendQuizToChannel,
}) => {
  // Plan Mode: "balanced_mix" (1 lesson + 1 internet news + 1 late-night fun) vs "three_lessons" (3 educational)
  const [planMode, setPlanMode] = useState<DailyPlanMode>(
    config.dailyPlanMode || "balanced_mix"
  );

  // Internet News & Late Night Fun State (No AI required)
  const [newsList, setNewsList] = useState<AccountingNewsItem[]>(verifiedAccountingNews);
  const [funList, setFunList] = useState<AccountingFunItem[]>(accountingFunPosts);
  const [currentNewsIndex, setCurrentNewsIndex] = useState<number>(0);
  const [currentFunIndex, setCurrentFunIndex] = useState<number>(0);
  const [isRefreshingNews, setIsRefreshingNews] = useState<boolean>(false);
  const [showNewsBankModal, setShowNewsBankModal] = useState<boolean>(false);

  const [selectedMonth, setSelectedMonth] = useState<1 | 2 | 3>(1);
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = all weeks in month
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [activeSlot, setActiveSlot] = useState<"all" | "morning" | "noon" | "evening">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSlot, setCopiedSlot] = useState<string | null>(null);

  // Fetch Live Internet News and Fun on mount
  useEffect(() => {
    fetchLiveNews();
    fetchLiveFun();
  }, []);

  const fetchLiveNews = async () => {
    setIsRefreshingNews(true);
    try {
      const res = await fetch("/api/accounting-news");
      const data = await res.json();
      if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
        setNewsList(data.items);
      }
    } catch (err) {
      console.warn("Using offline verified accounting news:", err);
    } finally {
      setIsRefreshingNews(false);
    }
  };

  const fetchLiveFun = async () => {
    try {
      const res = await fetch("/api/accounting-fun");
      const data = await res.json();
      if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
        setFunList(data.items);
      }
    } catch (err) {
      console.warn("Using offline accounting fun items:", err);
    }
  };

  const [funFilterType, setFunFilterType] = useState<"all" | "general" | "accounting">(
    config.funPreference || "all"
  );

  const activeFunPool = funList.filter((f) => {
    if (funFilterType === "all") return true;
    return f.type === funFilterType;
  });

  const currentNews = newsList[currentNewsIndex % (newsList.length || 1)] || verifiedAccountingNews[0];
  const currentFun =
    activeFunPool[currentFunIndex % (activeFunPool.length || 1)] ||
    funList[0] ||
    accountingFunPosts[0];

  // AI Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDetails, setAiDetails] = useState("");
  const [aiDayTarget, setAiDayTarget] = useState<number>(1);
  const [aiError, setAiError] = useState("");

  // Edit Post Modal
  const [editingPost, setEditingPost] = useState<{
    dayNumber: number;
    post: DayPostItem;
  } | null>(null);

  // Get current active day
  const currentDay = getOrCreateDayItem(selectedDayNumber, threeMonthDays);

  // Days list for current month & week filter
  const startDay = (selectedMonth - 1) * 30 + 1;
  const endDay = selectedMonth * 30;

  const monthDaysList = Array.from({ length: 30 }, (_, i) => {
    const dNum = startDay + i;
    return getOrCreateDayItem(dNum, threeMonthDays);
  }).filter((d) => {
    if (selectedWeek > 0 && d.weekNumber !== selectedWeek) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.posts.some((p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopyText = (slotId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlot(slotId);
    setTimeout(() => setCopiedSlot(null), 2000);
  };

  const handleGenerateAiPack = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setAiError("");

    try {
      const res = await fetch("/api/generate-accounting-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "three_post_day_pack",
          dayNumber: aiDayTarget,
          topic: aiTopic || currentDay.title,
          promptDetails: aiDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "خطا در تولید پکیج روزانه با هوش مصنوعی");
      }

      if (data.data) {
        const parsed = data.data;
        const updatedPosts: DayPostItem[] = [
          {
            id: `day-${aiDayTarget}-morning`,
            slot: "morning",
            slotTitle: "🌅 پست صبح (ساعت ۰۹:۰۰) - آموزش مفهومی",
            title: parsed.morningPost?.title || `درس صبحگاهی روز ${aiDayTarget}`,
            category: currentDay.category,
            content: parsed.morningPost?.content || "محتوای مفهومی",
            keyRule: parsed.morningPost?.keyRule || "",
            tags: parsed.morningPost?.tags || [`#روز_${aiDayTarget}`, "#آموزش_حسابداری"],
          },
          {
            id: `day-${aiDayTarget}-noon`,
            slot: "noon",
            slotTitle: "☀️ پست ظهر (ساعت ۱۴:۳۰) - کارگاه عملی و ثبت سند",
            title: parsed.noonPost?.title || `کارگاه عملی روز ${aiDayTarget}`,
            category: currentDay.category,
            content: parsed.noonPost?.content || "سناریوی عملی بازار کار",
            practicalExample: parsed.noonPost?.practicalExample || "",
            tags: parsed.noonPost?.tags || [`#روز_${aiDayTarget}`, "#ثبت_سند"],
          },
          {
            id: `day-${aiDayTarget}-evening`,
            slot: "evening",
            slotTitle: "🌙 پست شب (ساعت ۲۰:۰۰) - آزمون و چالش روزانه",
            title: parsed.eveningPost?.title || `آزمون شبانه روز ${aiDayTarget}`,
            category: currentDay.category,
            content: `📊 آزمون تستی روز شماره ${aiDayTarget}:\nجهت ثبت پاسخ در مینی‌اپ و دریافت امتیاز شرکت فرمایید:`,
            quizQuestion: parsed.eveningPost?.question || "سوال تستی روزانه",
            quizOptions: parsed.eveningPost?.options || ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
            correctOptionIndex: parsed.eveningPost?.correctOptionIndex ?? 0,
            explanation: parsed.eveningPost?.explanation || "",
            tags: parsed.eveningPost?.tags || [`#روز_${aiDayTarget}`, "#آزمون_حسابداری"],
          },
        ];

        const newDayItem: ThreeMonthDayItem = {
          ...currentDay,
          dayNumber: aiDayTarget,
          title: parsed.dayTitle || currentDay.title,
          category: parsed.category || currentDay.category,
          posts: updatedPosts,
        };

        onUpdateDay(newDayItem);
        setSelectedDayNumber(aiDayTarget);
        setShowAiModal(false);
      } else {
        throw new Error("داده‌های برگشتی هوش مصنوعی به فرمت مناسب دریافت نشد.");
      }
    } catch (err: any) {
      setAiError(err.message || "خطا در ارتباط با مدل Gemini");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePostEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;

    const updatedPosts = currentDay.posts.map((p) =>
      p.id === editingPost.post.id ? editingPost.post : p
    );

    onUpdateDay({
      ...currentDay,
      posts: updatedPosts,
    });
    setEditingPost(null);
  };

  // Bulk send daily package based on active Plan Mode
  const handlePublishDayPackage = () => {
    if (planMode === "balanced_mix") {
      const morningText = formatDayPost(
        currentDay.dayNumber,
        currentDay.title,
        currentDay.posts[0],
        config
      );
      const noonText = formatNewsPost(currentNews, config);
      const nightText = formatFunPost(currentFun, config);

      const combinedText = [
        `📌 <b>پکیج ۳ نوبتی متوازن کانال (روز شماره ${currentDay.dayNumber})</b>`,
        `🌅 <b>نوبت صبح (آموزش روزانه حسابداری - ساعت ${config.morningPostTime || "09:00"}):</b>\n\n${morningText}`,
        `━━━━━━━━━━━━━━━━━━━━━\n\n📰 <b>نوبت ظهر (اخبار حسابداری و مالیاتی وب - ساعت ${config.noonPostTime || "14:30"}):</b>\n\n${noonText}`,
        `━━━━━━━━━━━━━━━━━━━━━\n\n🌙 <b>نوبت شب (طنز و لبخند حسابداری - ساعت ${config.eveningPostTime || "22:00"}):</b>\n\n${nightText}`,
      ].join("\n\n");

      onSelectForPublish(
        `پکیج متوازن روز ${currentDay.dayNumber} (۱ آموزش + ۱ خبر وب + ۱ طنز آخر شب)`,
        combinedText
      );
    } else {
      const combinedText = currentDay.posts
        .map((p) => formatDayPost(currentDay.dayNumber, currentDay.title, p, config))
        .join("\n\n━━━━━━━━━━━━━━━━━━━━━\n\n");

      onSelectForPublish(
        `پکیج ۳ پستی تمام آموزشی روز ${currentDay.dayNumber}: ${currentDay.title}`,
        combinedText
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: 3-Month Program Architecture & Daily Plan Mode */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                دوره جامع ۳ ماهه صفر تا صد حسابداری بازار کار ایران
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                ۹۰ روز مدون • ۲ تا ۳ پست در روز • ۲۷۰ محتوای کاربردی
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              برنامه انتشار روزانه کانال تلگرام و بله
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
              {planMode === "balanced_mix" ? (
                <>
                  الگوی فعلی: <b className="text-emerald-300">🌅 صبح (۰۹:۰۰):</b> ۱ پست آموزش جامع |{" "}
                  <b className="text-sky-300">📰 ظهر (۱۴:۳۰):</b> ۱ پست خبر حسابداری/مالیاتی از وب (بدون AI) |{" "}
                  <b className="text-amber-300">🌙 شب (۲۲:۰۰):</b> ۱ پست طنز و میم حسابداری (بدون AI).
                </>
              ) : (
                <>
                  الگوی فعلی: <b className="text-emerald-300">🌅 صبح (۰۹:۰۰):</b> درس مفهومی و نظری |{" "}
                  <b className="text-sky-300">☀️ ظهر (۱۴:۳۰):</b> کارگاه عملی و سند دوبل |{" "}
                  <b className="text-amber-300">🌙 شب (۲۰:۰۰):</b> آزمون تستی ۴ گزینه‌ای اعضا.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setShowNewsBankModal(true)}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-amber-300 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border border-amber-500/30 transition-all shadow-md"
              title="مشاهده کل اخبار و طنزهای دریافتی از وب بدون نیاز به هوش مصنوعی"
            >
              <Newspaper className="w-4 h-4 text-amber-400" />
              <span>بانک اخبار و طنز وب ({newsList.length + funList.length})</span>
            </button>
            <button
              onClick={() => {
                setAiDayTarget(selectedDayNumber);
                setAiTopic(currentDay.title);
                setShowAiModal(true);
              }}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all border border-emerald-400/30"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>بازنویسی AI</span>
            </button>
            <button
              onClick={handlePublishDayPackage}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-700 transition-all"
            >
              <Send className="w-4 h-4 text-sky-400" />
              <span>ارسال کل پکیج روز</span>
            </button>
          </div>
        </div>

        {/* Plan Mode Switcher (Balanced Mix vs Three Lessons) */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">نحوه چینش پست‌های روزانه کانال:</span>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setPlanMode("balanced_mix")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                planMode === "balanced_mix"
                  ? "bg-emerald-600 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🌿 پکیج ۳ تایی متوازن</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                planMode === "balanced_mix" ? "bg-slate-950/20 text-slate-950" : "bg-emerald-500/10 text-emerald-300"
              }`}>
                ۱ آموزش + ۱ خبر وب + ۱ طنز (بدون AI)
              </span>
            </button>

            <button
              onClick={() => setPlanMode("three_lessons")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                planMode === "three_lessons"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>📚 پکیج ۳ تایی تمام آموزشی</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                planMode === "three_lessons" ? "bg-black/20 text-white" : "bg-sky-500/10 text-sky-300"
              }`}>
                ۳ درس تخصصی
              </span>
            </button>
          </div>
        </div>

        {/* 3 Master Month Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-800">
          {monthsMeta.map((m) => {
            const isSelected = selectedMonth === m.monthNumber;
            return (
              <button
                key={m.monthNumber}
                onClick={() => {
                  setSelectedMonth(m.monthNumber);
                  setSelectedWeek(0);
                  const firstDayOfMonth = (m.monthNumber - 1) * 30 + 1;
                  setSelectedDayNumber(firstDayOfMonth);
                }}
                className={`p-3.5 rounded-xl text-right transition-all border flex flex-col justify-between gap-2 relative ${
                  isSelected
                    ? "bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/30"
                    : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isSelected
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {m.dayRange}
                  </span>
                  <span className="text-xs text-slate-400">۳۰ روز • ۹۰ پست</span>
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isSelected ? "text-white" : "text-slate-200"}`}>
                    {m.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{m.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Days Navigator & Day Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side (Col 4): Month Days Timeline & Selector */}
        <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>تقویم ۳۰ روزه {monthsMeta[selectedMonth - 1].title.split(":")[0]}</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              روز {startDay} تا {endDay}
            </span>
          </div>

          {/* Search box for days */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در مباحث و سرفصل‌ها..."
              className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Weeks Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedWeek(0)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                selectedWeek === 0
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              تمام ۴ هفته
            </button>
            {monthsMeta[selectedMonth - 1].weeks.map((w) => (
              <button
                key={w.weekNumber}
                onClick={() => setSelectedWeek(w.weekNumber)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  selectedWeek === w.weekNumber
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                هفته {w.weekNumber}
              </button>
            ))}
          </div>

          {/* Days Grid / List */}
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
            {monthDaysList.map((day) => {
              const isSelected = day.dayNumber === selectedDayNumber;
              return (
                <button
                  key={day.dayNumber}
                  onClick={() => setSelectedDayNumber(day.dayNumber)}
                  className={`w-full text-right p-2.5 rounded-xl transition-all border flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-emerald-950/50 border-emerald-500/60 ring-1 ring-emerald-500/40 text-white"
                      : "bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/40 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-emerald-500 text-slate-950 font-mono"
                          : "bg-slate-800 text-slate-300 font-mono"
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{day.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{day.summary}</div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-emerald-400 border border-slate-700">
                      ۳ پست
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side (Col 8): Selected Day 3-Post Package Viewer */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Day Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-bold font-mono">
                  روز شماره {currentDay.dayNumber} از ۹۰
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs">
                  {currentDay.weekTitle}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs">
                  {currentDay.category}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {currentDay.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {currentDay.summary}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setAiDayTarget(currentDay.dayNumber);
                  setAiTopic(currentDay.title);
                  setShowAiModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all"
                title="تولید یا بازنویسی ۳ پست با هوش مصنوعی"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>بازنویسی AI</span>
              </button>
              <button
                onClick={handlePublishDayPackage}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ارسال کل پکیج روز</span>
              </button>
            </div>
          </div>

          {/* Time Slot Filter Pills */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveSlot("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                activeSlot === "all"
                  ? "bg-slate-700 text-white font-bold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {planMode === "balanced_mix" ? "نمایش کل پکیج ۳ بخشی" : "نمایش هر ۳ نوبت روز"}
            </button>
            <button
              onClick={() => setActiveSlot("morning")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                activeSlot === "morning"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>🌅 {planMode === "balanced_mix" ? "آموزش روزانه" : "نوبت صبح"} ({config.morningPostTime || "09:00"})</span>
            </button>
            <button
              onClick={() => setActiveSlot("noon")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                activeSlot === "noon"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{planMode === "balanced_mix" ? "📰 خبر روز از وب (بدون AI)" : "☀️ نوبت ظهر (سند)"} ({config.noonPostTime || "14:30"})</span>
            </button>
            <button
              onClick={() => setActiveSlot("evening")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                activeSlot === "evening"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{planMode === "balanced_mix" ? "🌙 طنز آخر شب (بدون AI)" : "🌙 نوبت شب (آزمون)"} ({config.eveningPostTime || "22:00"})</span>
            </button>
          </div>

          {/* Cards Container */}
          <div className="space-y-4">
            {planMode === "balanced_mix" ? (
              <>
                {/* 1. Daily Educational Lesson Card */}
                {(activeSlot === "all" || activeSlot === "morning") && (() => {
                  const lessonPost = currentDay.posts[0];
                  const formattedLesson = formatDayPost(
                    currentDay.dayNumber,
                    currentDay.title,
                    lessonPost,
                    config
                  );

                  return (
                    <div
                      key="balanced-lesson"
                      className="bg-slate-900 border border-emerald-500/30 bg-gradient-to-b from-slate-900 to-emerald-950/10 rounded-2xl p-5 space-y-4 shadow-md transition-all"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                            <span>🌅 نوبت صبح ({config.morningPostTime || "09:00"}): آموزش روزانه حسابداری</span>
                          </span>
                          <h3 className="text-sm font-bold text-white truncate">
                            {lessonPost.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => handleCopyText("morning-lesson", formattedLesson)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            {copiedSlot === "morning-lesson" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedSlot === "morning-lesson" ? "کپی شد" : "کپی متن"}</span>
                          </button>
                          <button
                            onClick={() => setEditingPost({ dayNumber: currentDay.dayNumber, post: lessonPost })}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                            <span>ویرایش</span>
                          </button>
                          <button
                            onClick={() => onSelectForPublish(`آموزش روز ${currentDay.dayNumber}: ${lessonPost.title}`, formattedLesson)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>ارسال به کانال</span>
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 font-sans">
                        {lessonPost.content}
                      </div>

                      {/* Practical Example */}
                      {lessonPost.practicalExample && (
                        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                            <FileText className="w-4 h-4" />
                            <span>ثبت دفتر روزنامه و مثال کاربردی بازار کار:</span>
                          </div>
                          <pre className="text-xs text-sky-200 font-mono bg-slate-900/90 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap dir-ltr text-right">
                            {lessonPost.practicalExample}
                          </pre>
                        </div>
                      )}

                      {/* Key Rule */}
                      {lessonPost.keyRule && (
                        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
                          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-200/90 leading-relaxed">
                            <b className="text-amber-300">نکته طلایی قانون و بازار کار: </b>
                            {lessonPost.keyRule}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {lessonPost.tags && lessonPost.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {lessonPost.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 2. Internet News Card (Without AI) */}
                {(activeSlot === "all" || activeSlot === "noon") && (() => {
                  const formattedNews = formatNewsPost(currentNews, config);

                  return (
                    <div
                      key="balanced-news"
                      className="bg-slate-900 border border-sky-500/30 bg-gradient-to-b from-slate-900 to-sky-950/10 rounded-2xl p-5 space-y-4 shadow-md transition-all"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                            <span>📰 نوبت ظهر ({config.noonPostTime || "14:30"}): خبر روز حسابداری از اینترنت</span>
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            بدون هوش مصنوعی (وب / RSS)
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => setCurrentNewsIndex((prev) => (prev + 1) % newsList.length)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs flex items-center gap-1 border border-sky-500/20 transition-colors"
                            title="انتخاب خبر دیگر از اینترنت"
                          >
                            <RefreshCw className="w-3 h-3 text-sky-400" />
                            <span>خبر بعدی وب</span>
                          </button>
                          <button
                            onClick={() => setShowNewsBankModal(true)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            <Newspaper className="w-3 h-3 text-amber-400" />
                            <span>بانک اخبار</span>
                          </button>
                          <button
                            onClick={() => handleCopyText("noon-news", formattedNews)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            {copiedSlot === "noon-news" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedSlot === "noon-news" ? "کپی شد" : "کپی"}</span>
                          </button>
                          <button
                            onClick={() => onSelectForPublish(`خبر روز: ${currentNews.title}`, formattedNews)}
                            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>ارسال به کانال</span>
                          </button>
                        </div>
                      </div>

                      {/* News Item Content */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20">
                            {currentNews.category}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {currentNews.pubDate}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white leading-snug">
                          {currentNews.title}
                        </h3>

                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 font-sans">
                          {currentNews.summary}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span>منبع معتبر اینترنتی: <b className="text-slate-200">{currentNews.source}</b></span>
                          </div>

                          {currentNews.sourceUrl && (
                            <a
                              href={currentNews.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:text-sky-300 text-xs flex items-center gap-1 hover:underline"
                            >
                              <span>مشاهده متن در منبع اصلی</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {currentNews.tags && currentNews.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {currentNews.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 3. Late Night Fun Card (Without AI) */}
                {(activeSlot === "all" || activeSlot === "evening") && (() => {
                  const formattedFun = formatFunPost(currentFun, config);

                  return (
                    <div
                      key="balanced-fun"
                      className="bg-slate-900 border border-amber-500/30 bg-gradient-to-b from-slate-900 to-amber-950/10 rounded-2xl p-5 space-y-4 shadow-md transition-all"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                            <span>🌙 نوبت شب ({config.eveningPostTime || "22:00"}): طنز جذاب و رفع خستگی</span>
                          </span>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 shadow-sm ${
                              currentFun.type === "general"
                                ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {currentFun.type === "general" ? "🎭 طنز جذاب روزمره" : "☕ طنز تخصصی حسابداری"}
                          </span>

                          {/* Quick Filter: All vs General vs Accounting */}
                          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                            {[
                              { id: "all", label: "همه طنزها" },
                              { id: "general", label: "🎭 جذاب روزمره" },
                              { id: "accounting", label: "☕ حسابداری" },
                            ].map((f) => (
                              <button
                                key={f.id}
                                onClick={() => {
                                  setFunFilterType(f.id as any);
                                  setCurrentFunIndex(0);
                                }}
                                className={`px-2 py-0.5 rounded-md transition-all font-semibold text-[11px] ${
                                  funFilterType === f.id
                                    ? f.id === "general"
                                      ? "bg-fuchsia-500 text-slate-950 font-bold shadow-sm"
                                      : f.id === "accounting"
                                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                                      : "bg-slate-700 text-white font-bold shadow-sm"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => setCurrentFunIndex((prev) => (prev + 1) % (activeFunPool.length || 1))}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs flex items-center gap-1 border border-amber-500/20 transition-colors"
                            title="شوخی بعدی"
                          >
                            <Shuffle className="w-3 h-3 text-amber-400" />
                            <span>شوخی بعدی</span>
                          </button>
                          <button
                            onClick={() => setShowNewsBankModal(true)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            <Smile className="w-3 h-3 text-amber-400" />
                            <span>بانک طنز</span>
                          </button>
                          <button
                            onClick={() => handleCopyText("night-fun", formattedFun)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            {copiedSlot === "night-fun" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedSlot === "night-fun" ? "کپی شد" : "کپی"}</span>
                          </button>
                          <button
                            onClick={() => onSelectForPublish(`طنز آخر شب: ${currentFun.title}`, formattedFun)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>ارسال به کانال</span>
                          </button>
                        </div>
                      </div>

                      {/* Fun Content */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                                currentFun.type === "general"
                                  ? "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {currentFun.type === "general" ? "🎭 طنز روزمره و عمومی" : "☕ طنز حسابداری و مالی"}
                            </span>
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60">
                              {currentFun.category}
                            </span>
                          </div>
                          <span className="text-sm">{currentFun.type === "general" ? "🎭 ✨" : "☕ 📊"}</span>
                        </div>

                        <h3 className="text-base font-bold text-white leading-snug flex items-center gap-2">
                          <span>{currentFun.title}</span>
                        </h3>

                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 font-sans">
                          {currentFun.content}
                        </div>

                        {currentFun.punchline && (
                          <div
                            className={`text-xs font-medium p-3 rounded-xl flex items-center gap-2 border ${
                              currentFun.type === "general"
                                ? "text-fuchsia-200 bg-fuchsia-950/25 border-fuchsia-500/30"
                                : "text-amber-300 bg-amber-950/30 border-amber-500/30"
                            }`}
                          >
                            <span>💡</span>
                            <span>{currentFun.punchline}</span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {currentFun.tags && currentFun.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {currentFun.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              currentDay.posts
                .filter((p) => (activeSlot === "all" ? true : p.slot === activeSlot))
                .map((post) => {
                const formattedText = formatDayPost(
                  currentDay.dayNumber,
                  currentDay.title,
                  post,
                  config
                );

                const isMorning = post.slot === "morning";
                const isNoon = post.slot === "noon";
                const isEvening = post.slot === "evening";

                return (
                  <div
                    key={post.id}
                    className={`bg-slate-900 border rounded-2xl p-5 space-y-4 shadow-md transition-all ${
                      isMorning
                        ? "border-emerald-500/30 bg-gradient-to-b from-slate-900 to-emerald-950/10"
                        : isNoon
                        ? "border-sky-500/30 bg-gradient-to-b from-slate-900 to-sky-950/10"
                        : "border-amber-500/30 bg-gradient-to-b from-slate-900 to-amber-950/10"
                    }`}
                  >
                    {/* Post Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                            isMorning
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : isNoon
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {post.slotTitle}
                        </span>
                        <h3 className="text-sm font-bold text-white truncate">{post.title}</h3>
                      </div>

                      {/* Post Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleCopyText(post.id, formattedText)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          title="کپی متن کامل پست با هشتگ‌ها"
                        >
                          {copiedSlot === post.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedSlot === post.id ? "کپی شد" : "کپی متن"}</span>
                        </button>

                        <button
                          onClick={() => setEditingPost({ dayNumber: currentDay.dayNumber, post })}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          title="ویرایش متن پست"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                          <span>ویرایش</span>
                        </button>

                        {/* If Evening Quiz: Allow Telegram native Poll send */}
                        {isEvening && post.quizQuestion && onSendQuizToChannel && (
                          <button
                            onClick={() =>
                              onSendQuizToChannel({
                                question: post.quizQuestion!,
                                options: post.quizOptions || ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
                                correctOptionIndex: post.correctOptionIndex ?? 0,
                                explanation: post.explanation || "",
                                title: `آزمون روز شماره ${currentDay.dayNumber}`,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs flex items-center gap-1 font-semibold transition-all"
                            title="ارسال مستقیم نظرسنجی کوییز تلگرام"
                          >
                            <Vote className="w-3.5 h-3.5" />
                            <span>نظرسنجی تلگرام</span>
                          </button>
                        )}

                        <button
                          onClick={() =>
                            onSelectForPublish(
                              `${post.slotTitle}: ${post.title}`,
                              formattedText
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>پیش‌نمایش و ارسال</span>
                        </button>
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                      {post.content}
                    </div>

                    {/* Practical Example Box (for Noon / Morning) */}
                    {post.practicalExample && (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                          <FileText className="w-4 h-4" />
                          <span>ثبت دفتر روزنامه و مثال کاربردی بازار کار:</span>
                        </div>
                        <pre className="text-xs text-sky-200 font-mono bg-slate-900/90 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap dir-ltr text-right">
                          {post.practicalExample}
                        </pre>
                      </div>
                    )}

                    {/* Key Rule Box */}
                    {post.keyRule && (
                      <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
                        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-200/90 leading-relaxed">
                          <b className="text-amber-300">نکته طلایی قانون و بازار کار: </b>
                          {post.keyRule}
                        </div>
                      </div>
                    )}

                    {/* Quiz Question & Options (for Evening) */}
                    {post.quizQuestion && (
                      <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <HelpCircle className="w-4 h-4" />
                          <span>سوال تستی سنجش یادگیری روز {currentDay.dayNumber}:</span>
                        </div>
                        <div className="text-xs sm:text-sm text-white font-medium">
                          {post.quizQuestion}
                        </div>

                        {/* Options */}
                        {post.quizOptions && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {post.quizOptions.map((opt, oIdx) => {
                              const isCorrect = oIdx === post.correctOptionIndex;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
                                    isCorrect
                                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-semibold"
                                      : "bg-slate-900 border-slate-800 text-slate-300"
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isCorrect && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                      پاسخ صحیح
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Explanation */}
                        {post.explanation && (
                          <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                            <b className="text-slate-300">تحلیل و مستند قانونی: </b>
                            {post.explanation}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {post.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* AI Pack Generation Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  تولید هوشمند بسته ۳ پستی با Gemini
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateAiPack} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  روز مورد نظر از دوره ۹۰ روزه:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={aiDayTarget}
                    onChange={(e) => setAiDayTarget(parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                  />
                  <span className="text-xs text-slate-400">
                    (هفته {Math.min(12, Math.ceil(aiDayTarget / 7.5))} • ماه {aiDayTarget <= 30 ? 1 : aiDayTarget <= 60 ? 2 : 3})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  موضوع یا سرفصل آموزشی:
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="مثال: روش میانگین موزون در انبار یا ثبت خرید دارایی مشهود"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  دستورات تکمیلی (اختیاری):
                </label>
                <textarea
                  value={aiDetails}
                  onChange={(e) => setAiDetails(e.target.value)}
                  rows={3}
                  placeholder="مثال: با ارقام ریالی مشخص، اشاره به ماده قانونی ۱۴۸ و سوال تستی چالشی..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {aiError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {aiError}
                </div>
              )}

              <div className="p-3 bg-slate-950 rounded-xl text-xs text-slate-400 space-y-1">
                <p>🔹 هوش مصنوعی همزمان ۳ پست زیر را به صورت خودکار تولید خواهد کرد:</p>
                <ul className="list-disc list-inside text-slate-500 space-y-0.5">
                  <li>🌅 پست صبح: درس مفهومی و نظری استاندارد</li>
                  <li>☀️ پست ظهر: کارگاه عملی همراه با سند دوبل و مبالغ ریالی</li>
                  <li>🌙 پست شب: آزمون ۴ گزینه‌ای و تحلیل مستند قانونی</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>در حال تولید پکیج ۳ پستی...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تولید و ثبت در تقویم</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Single Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-400" />
                <span>ویرایش {editingPost.post.slotTitle}</span>
              </h3>
              <button
                onClick={() => setEditingPost(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePostEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  عنوان پست:
                </label>
                <input
                  type="text"
                  value={editingPost.post.title}
                  onChange={(e) =>
                    setEditingPost({
                      ...editingPost,
                      post: { ...editingPost.post, title: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  متن اصلی پست:
                </label>
                <textarea
                  value={editingPost.post.content}
                  onChange={(e) =>
                    setEditingPost({
                      ...editingPost,
                      post: { ...editingPost.post, content: e.target.value },
                    })
                  }
                  rows={6}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-sans"
                  required
                />
              </div>

              {editingPost.post.practicalExample !== undefined && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    مثال کاربردی و ثبت حسابداری (بدهکار / بستانکار):
                  </label>
                  <textarea
                    value={editingPost.post.practicalExample}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        post: { ...editingPost.post, practicalExample: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-sky-300 font-mono"
                  />
                </div>
              )}

              {editingPost.post.keyRule !== undefined && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    نکته طلایی بازار کار:
                  </label>
                  <input
                    type="text"
                    value={editingPost.post.keyRule}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        post: { ...editingPost.post, keyRule: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300"
                  />
                </div>
              )}

              {editingPost.post.quizQuestion !== undefined && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      سوال تستی روز:
                    </label>
                    <input
                      type="text"
                      value={editingPost.post.quizQuestion}
                      onChange={(e) =>
                        setEditingPost({
                          ...editingPost,
                          post: { ...editingPost.post, quizQuestion: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      تحلیل و استناد قانونی پاسخ:
                    </label>
                    <textarea
                      value={editingPost.post.explanation || ""}
                      onChange={(e) =>
                        setEditingPost({
                          ...editingPost,
                          post: { ...editingPost.post, explanation: e.target.value },
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Web News & Fun Content Bank Modal (Fetched from Internet / RSS without AI) */}
      <NewsAndFunBankModal
        isOpen={showNewsBankModal}
        onClose={() => setShowNewsBankModal(false)}
        newsList={newsList}
        funList={funList}
        config={config}
        onSelectNews={(item) => {
          const idx = newsList.findIndex((n) => n.id === item.id);
          if (idx !== -1) setCurrentNewsIndex(idx);
        }}
        onSelectFun={(item) => {
          const idx = funList.findIndex((f) => f.id === item.id);
          if (idx !== -1) setCurrentFunIndex(idx);
        }}
        onSendToChannel={(title, text) => onSelectForPublish(title, text)}
      />
    </div>
  );
};
