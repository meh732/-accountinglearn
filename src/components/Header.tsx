import React from "react";
import { Send, Settings, ShieldCheck, Sparkles, Radio, HelpCircle } from "lucide-react";
import { BotConfig } from "../types";

interface HeaderProps {
  config: BotConfig;
  onOpenSettings: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  sentCount: number;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onOpenSettings,
  activeTab,
  onTabChange,
  sentCount,
  onOpenHelp,
}) => {
  const isTgConfigured = Boolean(config.telegramToken && config.telegramChannel);
  const isBaleConfigured = Boolean(config.baleToken && config.baleChannel);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Brand & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20 font-bold text-lg">
              ح
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  ربات و پنل مدیریت کانال حسابداری
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  نسخه ایران
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ارسال خودکار و دستی ۳ سبک آموزشی به کانال‌های تلگرام و بله
              </p>
            </div>
          </div>

          {/* Connection Badges & Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Telegram Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                isTgConfigured
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                  : "bg-slate-800/80 border-slate-700 text-slate-400"
              }`}
              title={isTgConfigured ? `کانال: ${config.telegramChannel}` : "توکن یا کانال تنظیم نشده (حالت شبیه‌سازی فعال)"}
            >
              <div className={`w-2 h-2 rounded-full ${isTgConfigured ? "bg-sky-400 animate-pulse" : "bg-slate-500"}`} />
              <span className="font-semibold">تلگرام:</span>
              <span className="truncate max-w-[110px]">{config.telegramChannel || "تنظیم نشده"}</span>
            </div>

            {/* Bale Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                isBaleConfigured
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800/80 border-slate-700 text-slate-400"
              }`}
              title={isBaleConfigured ? `کانال: ${config.baleChannel}` : "توکن یا کانال بله تنظیم نشده"}
            >
              <div className={`w-2 h-2 rounded-full ${isBaleConfigured ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              <span className="font-semibold">بله:</span>
              <span className="truncate max-w-[110px]">{config.baleChannel || "تنظیم نشده"}</span>
            </div>

            {/* Mini App Preview Button */}
            <button
              onClick={() => onTabChange("student_app")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40 transition-all shadow-sm"
              title="مشاهده مستقیم مینی‌اپ اختصاصی اعضای کانال"
            >
              <span>📱 مینی‌اپ اعضا</span>
            </button>

            {/* Help Button */}
            <button
              onClick={onOpenHelp}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
              title="راهنمای راه‌اندازی ربات در تلگرام و بله"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all hover:border-slate-600 shadow-sm"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>تنظیمات ربات‌ها</span>
            </button>
          </div>

        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1.5 sm:gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => onTabChange("zero_to_hero")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "zero_to_hero"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-xs font-bold">۱</span>
            <span>دوره ۳ ماهه صفر تا صد (روزی ۲-۳ پست)</span>
          </button>

          <button
            onClick={() => onTabChange("advanced")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "advanced"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-xs font-bold">۲</span>
            <span>حسابداری حرفه‌ای و تخصصی</span>
          </button>

          <button
            onClick={() => onTabChange("qa")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "qa"
                ? "bg-amber-600 text-white shadow-md shadow-amber-900/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-xs font-bold">۳</span>
            <span>پست‌های پرسش و پاسخ (پاسخ ادمین)</span>
          </button>

          <button
            onClick={() => onTabChange("quizzes")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === "quizzes" || activeTab === "student_app"
                ? "bg-teal-600 text-white shadow-md shadow-teal-900/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-xs font-bold">۴</span>
            <span>آزمون‌های روزانه و مینی‌اپ اعضا</span>
          </button>

          <button
            onClick={() => onTabChange("history")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ml-auto ${
              activeTab === "history"
                ? "bg-slate-700 text-white"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>تاریخچه ارسال‌ها ({sentCount})</span>
          </button>
        </nav>

      </div>
    </header>
  );
};
