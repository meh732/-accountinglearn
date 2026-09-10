import React, { useState, useEffect } from "react";
import {
  Clock,
  Play,
  Pause,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Info,
  X,
  Radio,
  Zap,
  Check,
  Flame,
  MessageSquare,
  Smile,
  Newspaper,
  BookOpen,
} from "lucide-react";
import { BotConfig, DailyPlanMode } from "../types";

export interface SchedulerHistoryItem {
  id: string;
  timestamp: string;
  tehranTime: string;
  dayNumber: number;
  slot: "morning" | "noon" | "evening" | "late_night" | "manual";
  slotTitle: string;
  title: string;
  status: "success" | "partial" | "failed" | "simulated";
  telegramStatus?: { ok: boolean; messageId?: number; error?: string };
  baleStatus?: { ok: boolean; messageId?: number; error?: string };
  contentPreview: string;
}

export interface SchedulerStatusData {
  enabled: boolean;
  currentDayNumber: number;
  planMode: DailyPlanMode;
  morningTime: string;
  noonTime: string;
  eveningTime: string;
  lateNightTime: string;
  sendToTelegram: boolean;
  sendToBale: boolean;
  autoAdvanceDay: boolean;
  channelSignature: string;
  autoHashtags: string;
  lastExecutedDate: string;
  executedSlotsToday: string[];
  history: SchedulerHistoryItem[];
  nextScheduledSlot?: {
    slot: string;
    slotTitle: string;
    scheduledTime: string;
    dayNumber: number;
  };
  tehranTimeNow: string;
  hasTelegramToken: boolean;
  hasBaleToken: boolean;
  hasTelegramChannel: boolean;
  hasBaleChannel: boolean;
}

interface AutoPilotSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const AutoPilotSchedulerModal: React.FC<AutoPilotSchedulerModalProps> = ({
  isOpen,
  onClose,
  config,
  onShowToast,
}) => {
  const [statusData, setStatusData] = useState<SchedulerStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triggeringSlot, setTriggeringSlot] = useState<string | null>(null);

  // Form editable states
  const [isEnabled, setIsEnabled] = useState(true);
  const [dayNumber, setDayNumber] = useState(1);
  const [planMode, setPlanMode] = useState<DailyPlanMode>("balanced_mix");
  const [morningTime, setMorningTime] = useState("09:00");
  const [noonTime, setNoonTime] = useState("14:30");
  const [eveningTime, setEveningTime] = useState("20:00");
  const [lateNightTime, setLateNightTime] = useState("22:30");
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Fetch status from server
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/scheduler/status");
      const data = await res.json();
      if (data.ok && data.status) {
        setStatusData(data.status);
        setIsEnabled(data.status.enabled);
        setDayNumber(data.status.currentDayNumber || 1);
        setPlanMode(data.status.planMode || "balanced_mix");
        setMorningTime(data.status.morningTime || "09:00");
        setNoonTime(data.status.noonTime || "14:30");
        setEveningTime(data.status.eveningTime || "20:00");
        setLateNightTime(data.status.lateNightTime || "22:30");
        setAutoAdvance(data.status.autoAdvanceDay !== false);
      }
    } catch (err: any) {
      console.warn("Failed to fetch scheduler status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Save changes to backend scheduler
  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/scheduler/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: isEnabled,
          currentDayNumber: dayNumber,
          planMode,
          morningTime,
          noonTime,
          eveningTime,
          lateNightTime,
          autoAdvanceDay: autoAdvance,
          channelSignature: config.channelSignature,
          autoHashtags: config.autoHashtags,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusData(data.status);
        onShowToast("تنظیمات موتور ارسال خودکار روی سرور با موفقیت ذخیره و اعمال شد.", "success");
      } else {
        onShowToast(data.error || "خطا در ذخیره تنظیمات", "error");
      }
    } catch (err: any) {
      onShowToast(err.message || "خطا در ارتباط با سرور", "error");
    } finally {
      setSaving(false);
    }
  };

  // Immediate Force Trigger for testing
  const handleTriggerNow = async (slot: "morning" | "noon" | "evening" | "late_night") => {
    try {
      setTriggeringSlot(slot);
      const res = await fetch("/api/scheduler/trigger-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          forceDay: dayNumber,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusData(data.status);
        const item = data.item as SchedulerHistoryItem;
        const tgOk = item.telegramStatus?.ok;
        const baleOk = item.baleStatus?.ok;

        if (tgOk && baleOk) {
          onShowToast(`✅ پست نوبت ${getSlotPersianTitle(slot)} با موفقیت به تلگرام و بله ارسال شد!`, "success");
        } else if (tgOk) {
          onShowToast(`✅ پست با موفقیت به کانال تلگرام ارسال شد (پیام: #${item.telegramStatus?.messageId})`, "success");
        } else if (baleOk) {
          onShowToast(`✅ پست با موفقیت به کانال بله ارسال شد.`, "success");
        } else if (item.status === "simulated") {
          onShowToast(`ℹ️ پست در حالت شبیه‌سازی تولید و ثبت شد. (توکن‌ها در تنظیمات وارد شوند)`, "info");
        } else {
          onShowToast(`⚠️ خطا در ارسال: ${item.telegramStatus?.error || item.baleStatus?.error || "بررسی کانال"}`, "error");
        }
      } else {
        onShowToast(data.error || "خطا در اجرای تست ارسال", "error");
      }
    } catch (err: any) {
      onShowToast(err.message || "خطا در برقراری ارتباط با سرور", "error");
    } finally {
      setTriggeringSlot(null);
    }
  };

  const getSlotPersianTitle = (slot: string) => {
    switch (slot) {
      case "morning":
        return "صبح (آموزش صفر تا صد)";
      case "noon":
        return "ظهر (کارگاه عملی / اخبار)";
      case "evening":
        return "شب (آزمون کوئیز)";
      case "late_night":
        return "آخر شب (طنز و رفع خستگی)";
      default:
        return slot;
    }
  };

  const executedSlots = statusData?.executedSlotsToday || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  موتور ارسال خودکار و زمان‌بندی هوشمند ۲۴/۷ (Auto-Pilot Scheduler)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  سرور فعال
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ربات به صورت شبانه‌روزی و اتوماتیک آموزش‌های روزانه، کارگاه، اخبار مالیاتی و آزمون‌ها را به کانال می‌فرستد.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="بروزرسانی وضعیت سرور"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Status & Next Post Highlight Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Active State Card */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              isEnabled
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-amber-500/10 border-amber-500/30"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">وضعیت موتور خودکار</span>
                <span className={`w-2.5 h-2.5 rounded-full ${isEnabled ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-base font-bold ${isEnabled ? "text-emerald-400" : "text-amber-400"}`}>
                  {isEnabled ? "🟢 فعال و در حال اجرا" : "⏸ متوقف شده"}
                </span>
                <button
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    isEnabled
                      ? "bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {isEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isEnabled ? "توقف خودکار" : "روشن کردن"}</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                ساعت سرور به وقت تهران: <b className="text-slate-200">{statusData?.tehranTimeNow || "در حال دریافت..."}</b>
              </div>
            </div>

            {/* 2. Current Day Progress */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300">روز جاری دوره ۳ ماهه</span>
                <span className="text-xs text-sky-400 font-bold">روز {dayNumber} از ۹۰</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="90"
                  value={dayNumber}
                  onChange={(e) => setDayNumber(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <span className="text-sm font-bold text-white px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/30">
                  {dayNumber}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                <span>پیشرفت دوره: {Math.round((dayNumber / 90) * 100)}%</span>
                <span className="text-slate-400">{dayNumber <= 30 ? "ماه ۱: اصول و دفاتر" : dayNumber <= 60 ? "ماه ۲: بازرگانی و حقوق" : "ماه ۳: مالیات و مودیان"}</span>
              </div>
            </div>

            {/* 3. Next Scheduled Post */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300">نوبت بعدی ارسال خودکار</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white truncate">
                {statusData?.nextScheduledSlot?.slotTitle || "آموزش نوبت صبح"}
              </div>
              <div className="text-xs text-emerald-400 font-semibold mt-1">
                ⏰ زمان: {statusData?.nextScheduledSlot?.scheduledTime || "۰۹:۰۰"}
              </div>
            </div>
          </div>

          {/* Quick Force Trigger Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  ⚡ تست و انتشار فوری همین الان به کانال (Force Publish)
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                بدون منتظر ماندن برای ساعت مقرر، می‌توانید هر یک از پست‌های امروز را تست کنید:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              {/* Morning Slot Trigger */}
              <button
                onClick={() => handleTriggerNow("morning")}
                disabled={Boolean(triggeringSlot)}
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800/90 hover:border-amber-500/40 text-right transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>🌅 نوبت صبح ({morningTime})</span>
                  </span>
                  {executedSlots.includes("morning") && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ارسال شده
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 font-medium mt-1 truncate">
                  آموزش صفر تا صد حسابداری
                </div>
                <div className="mt-2.5 text-[11px] font-bold text-amber-400 group-hover:text-amber-300 flex items-center justify-end gap-1">
                  {triggeringSlot === "morning" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>ارسال فوری صبح</span>
                </div>
              </button>

              {/* Noon Slot Trigger */}
              <button
                onClick={() => handleTriggerNow("noon")}
                disabled={Boolean(triggeringSlot)}
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800/90 hover:border-sky-500/40 text-right transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                    <Newspaper className="w-3.5 h-3.5 text-sky-400" />
                    <span>☀️ نوبت ظهر ({noonTime})</span>
                  </span>
                  {executedSlots.includes("noon") && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ارسال شده
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 font-medium mt-1 truncate">
                  {planMode === "balanced_mix" ? "اخبار و بخشنامه‌های مالیاتی" : "کارگاه عملی و سند دوبل"}
                </div>
                <div className="mt-2.5 text-[11px] font-bold text-sky-400 group-hover:text-sky-300 flex items-center justify-end gap-1">
                  {triggeringSlot === "noon" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>ارسال فوری ظهر</span>
                </div>
              </button>

              {/* Evening Slot Trigger */}
              <button
                onClick={() => handleTriggerNow("evening")}
                disabled={Boolean(triggeringSlot)}
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800/90 hover:border-indigo-500/40 text-right transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>🌙 نوبت شب ({eveningTime})</span>
                  </span>
                  {executedSlots.includes("evening") && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ارسال شده
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 font-medium mt-1 truncate">
                  آزمون و کوئیز تستی روزانه
                </div>
                <div className="mt-2.5 text-[11px] font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center justify-end gap-1">
                  {triggeringSlot === "evening" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>ارسال فوری آزمون</span>
                </div>
              </button>

              {/* Late Night Slot Trigger */}
              <button
                onClick={() => handleTriggerNow("late_night")}
                disabled={Boolean(triggeringSlot)}
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800/90 hover:border-pink-500/40 text-right transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-300 flex items-center gap-1">
                    <Smile className="w-3.5 h-3.5 text-pink-400" />
                    <span>✨ آخر شب ({lateNightTime})</span>
                  </span>
                  {executedSlots.includes("late_night") && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ارسال شده
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 font-medium mt-1 truncate">
                  طنز، میم و رفع خستگی حسابداران
                </div>
                <div className="mt-2.5 text-[11px] font-bold text-pink-400 group-hover:text-pink-300 flex items-center justify-end gap-1">
                  {triggeringSlot === "late_night" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>ارسال فوری طنز</span>
                </div>
              </button>
            </div>
          </div>

          {/* Schedule Settings & Timing Form */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>تنظیم ساعت‌های دقیق ارسال روزانه روی سرور</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Morning Time */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <span>🌅 ساعت نوبت صبح:</span>
                </label>
                <input
                  type="time"
                  value={morningTime}
                  onChange={(e) => setMorningTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">آموزش تئوری و مفاهیم روز</p>
              </div>

              {/* Noon Time */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <span>☀️ ساعت نوبت ظهر:</span>
                </label>
                <input
                  type="time"
                  value={noonTime}
                  onChange={(e) => setNoonTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">کارگاه عملی یا اخبار مالیاتی</p>
              </div>

              {/* Evening Time */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <span>🌙 ساعت نوبت شب:</span>
                </label>
                <input
                  type="time"
                  value={eveningTime}
                  onChange={(e) => setEveningTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">آزمون تستی و چالش یادگیری</p>
              </div>

              {/* Late Night Time */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <span>✨ ساعت آخر شب:</span>
                </label>
                <input
                  type="time"
                  value={lateNightTime}
                  onChange={(e) => setLateNightTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">طنز شبانه و رفع خستگی</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Plan Mode Selection */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-medium">الگوی انتشار روزانه:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPlanMode("balanced_mix")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      planMode === "balanced_mix"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🌟 ترکیب هوشمند (آموزش + اخبار + کوئیز + طنز)
                  </button>
                  <button
                    onClick={() => setPlanMode("three_lessons")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      planMode === "three_lessons"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    📚 فشرده آموزشی (۳ درس کامل در روز)
                  </button>
                </div>
              </div>

              {/* Auto advance toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>انتقال خودکار به روز بعد پس از اتمام نوبت‌های روز</span>
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>ذخیره تنظیمات زمان‌بندی روی سرور</span>
              </button>
            </div>
          </div>

          {/* History / Dispatch Logs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>گزارش و لاگ ارسال‌های خودکار سرور</span>
              </h3>
              <span className="text-xs text-slate-400">
                {statusData?.history?.length || 0} ارسال اخیر ثبت شده
              </span>
            </div>

            {(!statusData?.history || statusData.history.length === 0) ? (
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-950 text-center text-xs text-slate-400">
                هنوز هیچ ارسالی توسط موتور خودکار ثبت نشده است. با زدن دکمه‌های «ارسال فوری» در بالا می‌توانید اولین تست را انجام دهید.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {statusData.history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-800/80 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        item.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : item.status === "simulated"
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-200">
                          {item.slotTitle || item.title} (روز {item.dayNumber})
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                      {item.telegramStatus?.ok && (
                        <span className="text-sky-400 font-medium">تلگرام: تایید (ID: {item.telegramStatus.messageId})</span>
                      )}
                      {item.baleStatus?.ok && (
                        <span className="text-emerald-400 font-medium">بله: تایید</span>
                      )}
                      <span className="text-slate-500 font-mono">{item.tehranTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ربات بر روی سرور VPS با سرویس دائم Systemd به صورت مستقل و بدون وقفه اجرا می‌شود.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
