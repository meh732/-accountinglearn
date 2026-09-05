import React, { useState } from "react";
import {
  X,
  Newspaper,
  Smile,
  RefreshCw,
  Search,
  Copy,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { AccountingNewsItem, AccountingFunItem, BotConfig } from "../types";
import { formatNewsPost, formatFunPost } from "../utils/telegramFormat";

interface NewsAndFunBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsList: AccountingNewsItem[];
  funList: AccountingFunItem[];
  config: BotConfig;
  onSelectForPublish: (title: string, formattedText: string) => void;
  onRefreshNews: () => Promise<void>;
  isRefreshingNews: boolean;
}

export const NewsAndFunBankModal: React.FC<NewsAndFunBankModalProps> = ({
  isOpen,
  onClose,
  newsList,
  funList,
  config,
  onSelectForPublish,
  onRefreshNews,
  isRefreshingNews,
}) => {
  const [activeTab, setActiveTab] = useState<"news" | "fun">("news");
  const [newsCategory, setNewsCategory] = useState<string>("all");
  const [funTypeFilter, setFunTypeFilter] = useState<"all" | "general" | "accounting">("all");
  const [funCategory, setFunCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredNews = newsList.filter((item) => {
    if (newsCategory !== "all" && !item.category.includes(newsCategory)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredFun = funList.filter((item) => {
    if (funTypeFilter !== "all" && item.type !== funTypeFilter) return false;
    if (funCategory !== "all" && !item.category.includes(funCategory)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.punchline && item.punchline.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              {activeTab === "news" ? <Newspaper className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  بانک اخبار وب و طنزهای جذاب (روزمره و حسابداری)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  بدون نیاز به هوش مصنوعی (100% رایگان از وب)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                دریافت مستقیم از سایت‌های معتبر اقتصادی کشور و گلچین طنزهای جذاب روزمره، کارمندی و حسابداری
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher & Toolbar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Main Tabs */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab("news");
                setSearchQuery("");
              }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === "news"
                  ? "bg-emerald-600 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>اخبار و بخشنامه‌های وب ({newsList.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("fun");
                setSearchQuery("");
              }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === "fun"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>طنز و شوخی‌های آخر شب ({funList.length})</span>
            </button>
          </div>

          {/* Search and Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === "news" ? "جستجو در اخبار و بخشنامه‌ها..." : "جستجو در شوخی‌ها و میم‌ها..."}
                className="w-full pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {activeTab === "news" && (
              <button
                onClick={onRefreshNews}
                disabled={isRefreshingNews}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                title="دریافت آخرین اخبار از فید RSS اینترنت"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingNews ? "animate-spin" : ""}`} />
                <span>{isRefreshingNews ? "در حال دریافت..." : "رفرش آنلاین"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Categories & Filter Bar */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 text-xs">
          {activeTab === "news" ? (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              <span className="text-[11px] text-slate-400 font-semibold shrink-0 ml-1">دسته‌بندی خبر:</span>
              {[
                { id: "all", label: "همه اخبار" },
                { id: "سامانه مودیان", label: "سامانه مودیان" },
                { id: "قوانین مالیاتی", label: "قوانین و بخشنامه‌های مالیاتی" },
                { id: "حقوق و دستمزد", label: "حقوق و قانون کار" },
                { id: "استاندارد", label: "استانداردهای حسابداری" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNewsCategory(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors shrink-0 ${
                    newsCategory === c.id
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Fun Type Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
                <span className="text-[11px] text-slate-400 font-semibold shrink-0 ml-1">نوع طنز:</span>
                {[
                  { id: "all", label: "✨ همه طنزها", count: funList.length },
                  {
                    id: "general",
                    label: "🎭 طنز جذاب روزمره و عمومی",
                    count: funList.filter((f) => f.type === "general").length,
                  },
                  {
                    id: "accounting",
                    label: "☕ طنز تخصصی حسابداری",
                    count: funList.filter((f) => f.type === "accounting").length,
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setFunTypeFilter(t.id as any);
                      setFunCategory("all");
                    }}
                    className={`px-3 py-1 rounded-lg text-xs transition-all shrink-0 font-bold flex items-center gap-1.5 ${
                      funTypeFilter === t.id
                        ? t.id === "general"
                          ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm"
                          : t.id === "accounting"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                        : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className="text-[10px] opacity-75 px-1.5 py-0.2 rounded-full bg-slate-900/80 font-mono">
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Sub-Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5 border-t border-slate-800/40">
                <span className="text-[11px] text-slate-500 shrink-0 ml-1">موضوع:</span>
                {(funTypeFilter === "general"
                  ? [
                      { id: "all", label: "همه عمومی‌ها" },
                      { id: "طنز جذاب روزمره", label: "زندگی روزمره و فامیل" },
                      { id: "طنز فناوری و کارمندی", label: "کارمندی، جلسات و هوش مصنوعی" },
                      { id: "طنز خرید و اینترنت", label: "خرید آنلاین و اینستاگرام" },
                    ]
                  : funTypeFilter === "accounting"
                  ? [
                      { id: "all", label: "همه حسابداری‌ها" },
                      { id: "بستن حساب‌ها", label: "بستن حساب‌ها و تراز" },
                      { id: "شوخی ممیزی", label: "شوخی‌های ممیزی و مالیات" },
                      { id: "دیالوگ مدیر", label: "دیالوگ مدیر و حسابدار" },
                      { id: "میم و خاطرات", label: "میم، اکسل و انبارگردانی" },
                      { id: "دانشجویی", label: "دانشجویی و بدهکار/بستانکار" },
                    ]
                  : [
                      { id: "all", label: "همه موضوعات" },
                      { id: "طنز جذاب روزمره", label: "طنز روزمره" },
                      { id: "طنز فناوری و کارمندی", label: "فناوری و جلسات" },
                      { id: "بستن حساب‌ها", label: "تراز و حسابداری" },
                      { id: "شوخی ممیزی", label: "ممیزی و مالیات" },
                      { id: "دیالوگ مدیر", label: "مدیر و حسابدار" },
                    ]
                ).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFunCategory(c.id)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] transition-colors shrink-0 ${
                      funCategory === c.id
                        ? "bg-slate-700 text-white font-bold"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === "news" ? (
            filteredNews.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                هیچ خبری با این عبارت یافت نشد.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNews.map((item) => {
                  const formatted = formatNewsPost(item, config);
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {item.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{item.pubDate}</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-100 leading-snug">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                          {item.summary}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px] flex items-center gap-1">
                          <Radio className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{item.source}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                              title="مشاهده منبع در سایت"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleCopy(item.id, formatted)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="کپی متن کامل خبر"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onSelectForPublish(item.title, formatted);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm"
                          >
                            <Send className="w-3 h-3" />
                            <span>ارسال به کانال</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredFun.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              هیچ مطلبی با این فیلتر یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFun.map((item) => {
                const formatted = formatFunPost(item, config);
                const isGeneral = item.type === "general";
                return (
                  <div
                    key={item.id}
                    className={`bg-slate-950/70 border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all ${
                      isGeneral
                        ? "border-slate-800/90 hover:border-fuchsia-500/40 hover:bg-slate-950/90"
                        : "border-slate-800 hover:border-amber-500/40 hover:bg-slate-950/90"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isGeneral
                                ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {isGeneral ? "🎭 طنز جذاب روزمره" : "☕ طنز حسابداری"}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-sm">{isGeneral ? "🎭 ✨" : "☕ 📊"}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                        <span>{item.title}</span>
                      </h4>
                      <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                        {item.content}
                      </div>
                      {item.punchline && (
                        <div
                          className={`text-[11px] font-medium italic p-2 rounded-lg border ${
                            isGeneral
                              ? "text-fuchsia-300/90 bg-fuchsia-950/20 border-fuchsia-500/20"
                              : "text-amber-300/90 bg-amber-950/20 border-amber-500/20"
                          }`}
                        >
                          💡 {item.punchline}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[10px] text-slate-400">
                            {t}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(item.id, formatted)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="کپی متن کامل طنز"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            onSelectForPublish(item.title, formatted);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          <span>ارسال به کانال</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
