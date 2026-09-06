import React, { useState } from "react";
import {
  X,
  Settings,
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertCircle,
  Save,
  HelpCircle,
  Archive,
  Send,
  Download,
  Upload,
  RefreshCw,
  Clock,
  Database,
  Terminal,
  Globe,
} from "lucide-react";
import { BotConfig } from "../types";
import { DeploymentSettingsTab } from "./DeploymentSettingsTab";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onSaveConfig: (newConfig: BotConfig) => void;
  allAppData?: any;
  onRestoreData?: (importedData: any) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  allAppData,
  onRestoreData,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<BotConfig>({
    autoBackupEnabled: true,
    autoBackupInterval: "daily",
    telegramAdminChatId: "",
    baleAdminChatId: "",
    deploymentPort: 3000,
    deploymentDomain: "",
    deploymentEnableSsl: false,
    deploymentSslEmail: "",
    deploymentRedirectHttps: true,
    ...config,
  });

  const [activeTab, setActiveTab] = useState<"credentials" | "branding" | "backup" | "deployment" | "guide">("credentials");

  // Connection test states
  const [tgTestState, setTgTestState] = useState<{ loading: boolean; result?: any; error?: string }>({
    loading: false,
  });
  const [baleTestState, setBaleTestState] = useState<{ loading: boolean; result?: any; error?: string }>({
    loading: false,
  });

  // Backup dispatch state
  const [backupSending, setBackupSending] = useState(false);
  const [backupResult, setBackupResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestTelegram = async () => {
    setTgTestState({ loading: true });
    try {
      const res = await fetch("/api/test-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "telegram",
          token: formData.telegramToken,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTgTestState({ loading: false, result: data.bot });
      } else {
        setTgTestState({ loading: false, error: data.error || "خطا در اتصال به ربات تلگرام" });
      }
    } catch (err: any) {
      setTgTestState({ loading: false, error: err.message || "خطای ارتباط شبکه" });
    }
  };

  const handleTestBale = async () => {
    setBaleTestState({ loading: true });
    try {
      const res = await fetch("/api/test-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "bale",
          token: formData.baleToken,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBaleTestState({ loading: false, result: data.bot });
      } else {
        setBaleTestState({ loading: false, error: data.error || "خطا در اتصال به ربات بله" });
      }
    } catch (err: any) {
      setBaleTestState({ loading: false, error: err.message || "خطای ارتباط شبکه" });
    }
  };

  // Trigger Immediate Backup Dispatch to Bots
  const handleTriggerManualBackup = async () => {
    setBackupSending(true);
    setBackupResult(null);
    try {
      const payloadData = allAppData || {
        config: formData,
        timestamp: new Date().toISOString(),
      };

      const res = await fetch("/api/backup-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: payloadData,
          config: {
            telegramToken: formData.telegramToken,
            telegramAdminChatId: formData.telegramAdminChatId || formData.telegramChannel,
            baleToken: formData.baleToken,
            baleAdminChatId: formData.baleAdminChatId || formData.baleChannel,
          },
          caption: "📦 فایل پشتیبان دستی سیستم حسابداری ایران",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const nowFa = new Date().toLocaleTimeString("fa-IR");
        setFormData((prev) => ({ ...prev, lastBackupAt: nowFa }));
        setBackupResult({
          ok: true,
          message: `بکاپ با موفقیت آماده و به بات‌های تلگرام و بله ادمین ارسال گردید! (${data.filename})`,
        });
      } else {
        setBackupResult({
          ok: false,
          message: data.error || "خطا در ارسال بکاپ به ربات‌ها",
        });
      }
    } catch (err: any) {
      setBackupResult({
        ok: false,
        message: err.message || "خطای شبکه هنگام ارسال بکاپ",
      });
    } finally {
      setBackupSending(false);
    }
  };

  // Download direct local JSON backup
  const handleDownloadBackup = () => {
    const payload = allAppData || { config: formData, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting_bot_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Restore backup from uploaded JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (onRestoreData) {
          onRestoreData(parsed);
          setBackupResult({
            ok: true,
            message: "اطلاعات با موفقیت از فایل پشتیبان بازیابی شد.",
          });
        }
      } catch (err) {
        setBackupResult({
          ok: false,
          message: "فرمت فایل نامعتبر است. فایل JSON معتبر انتخاب کنید.",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    onSaveConfig(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                تنظیمات ربات‌های تلگرام و بله و پشتیبان‌گیری
              </h3>
              <p className="text-xs text-slate-400">
                پیکربندی توکن‌ها، کانال‌ها، امضا، و زمان‌بندی ارسال اتوماتیک بکاپ به بات‌ها
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("credentials")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "credentials"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            توکن‌ها و کانال‌ها
          </button>
          <button
            onClick={() => setActiveTab("branding")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "branding"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            هویت کانال و امضا
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "backup"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span>بکاپ اتوماتیک به بات‌ها</span>
          </button>
          <button
            onClick={() => setActiveTab("deployment")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "deployment"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>پورت اختصاصی، دامنه و SSL</span>
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "guide"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>اسکریپت لینوکس و راهنما</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Tab 1: Credentials */}
          {activeTab === "credentials" && (
            <div className="space-y-6">
              
              {/* Telegram Box */}
              <div className="bg-slate-950/60 border border-sky-500/20 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                      TG
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">پیکربندی ربات تلگرام (Telegram)</h4>
                      <p className="text-[11px] text-slate-400">توکن دریافتی از BotFather@ و آیدی عمومی یا عددی کانال</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={tgTestState.loading || !formData.telegramToken}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs border border-sky-500/30 transition-colors disabled:opacity-40"
                  >
                    {tgTestState.loading ? (
                      <div className="w-3 h-3 border border-sky-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Radio className="w-3 h-3" />
                    )}
                    <span>تست اتصال تلگرام</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      توکن ربات تلگرام (Bot Token):
                    </label>
                    <input
                      type="password"
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      value={formData.telegramToken}
                      onChange={(e) => setFormData({ ...formData, telegramToken: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      آیدی کانال تلگرام (با @ یا عددی):
                    </label>
                    <input
                      type="text"
                      placeholder="@hesabdari_iran یا -100..."
                      value={formData.telegramChannel}
                      onChange={(e) => setFormData({ ...formData, telegramChannel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {tgTestState.result && (
                  <div className="mt-3 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      اتصال با موفقیت برقرار شد: ربات <b>{tgTestState.result.first_name}</b> (@{tgTestState.result.username})
                    </span>
                  </div>
                )}
                {tgTestState.error && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{tgTestState.error}</span>
                  </div>
                )}
              </div>

              {/* Bale Box */}
              <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      بله
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">پیکربندی ربات بله (Bale Messenger)</h4>
                      <p className="text-[11px] text-slate-400">توکن دریافتی از BotFather در پیام‌رسان بله و شناسه کانال</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestBale}
                    disabled={baleTestState.loading || !formData.baleToken}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30 transition-colors disabled:opacity-40"
                  >
                    {baleTestState.loading ? (
                      <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Radio className="w-3 h-3" />
                    )}
                    <span>تست اتصال بله</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      توکن ربات بله (Bale Bot Token):
                    </label>
                    <input
                      type="password"
                      placeholder="1234567890:ABCdef..."
                      value={formData.baleToken}
                      onChange={(e) => setFormData({ ...formData, baleToken: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      آیدی کانال بله (با @ یا عددی):
                    </label>
                    <input
                      type="text"
                      placeholder="@hesabdari_bale"
                      value={formData.baleChannel}
                      onChange={(e) => setFormData({ ...formData, baleChannel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {baleTestState.result && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      اتصال با موفقیت برقرار شد: ربات <b>{baleTestState.result.first_name}</b> (@{baleTestState.result.username})
                    </span>
                  </div>
                )}
                {baleTestState.error && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{baleTestState.error}</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Tab 2: Branding */}
          {activeTab === "branding" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  نام یا عنوان کانال:
                </label>
                <input
                  type="text"
                  value={formData.channelTitle}
                  onChange={(e) => setFormData({ ...formData, channelTitle: e.target.value })}
                  placeholder="آکادمی حسابداری و قوانین مالیاتی ایران"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  امضای پایانی پست‌ها (Watermark & Links):
                </label>
                <textarea
                  rows={3}
                  value={formData.channelSignature}
                  onChange={(e) => setFormData({ ...formData, channelSignature: e.target.value })}
                  placeholder="📢 عضویت در کانال تلگرام: @acc_channel | بله: @acc_bale"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                  dir="rtl"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  این متن به صورت خودکار در انتهای هر پیام ارسالی به کانال درج می‌شود.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  هشتگ‌های پیش‌فرض کانال:
                </label>
                <input
                  type="text"
                  value={formData.autoHashtags}
                  onChange={(e) => setFormData({ ...formData, autoHashtags: e.target.value })}
                  placeholder="#آموزش_حسابداری #مالیات #سامانه_مودیان #قانون_تجارت"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  dir="rtl"
                />
              </div>

              {/* Daily Publishing Plan Mode (New Feature requested by user) */}
              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    🗓️
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">
                      الگوی برنامه انتشار روزانه کانال (Daily Publishing Plan)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      تنظیم تعداد آموزش در روز و دریافت خودکار اخبار و طنز از اینترنت (بدون نیاز به هوش مصنوعی)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between gap-2 transition-all ${
                      formData.dailyPlanMode !== "three_lessons"
                        ? "bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40"
                        : "bg-slate-900 border-slate-800 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="dailyPlanMode"
                          checked={formData.dailyPlanMode !== "three_lessons"}
                          onChange={() => setFormData({ ...formData, dailyPlanMode: "balanced_mix" })}
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-bold text-white">پکیج ۳ تایی متوازن (پیشنهادی)</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-medium">
                        بدون نیاز به AI
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <b>۱ پست آموزشی روزانه</b> + <b>۱ پست خبری حسابداری و مالیاتی از وب</b> + <b>۱ پست فان و طنز آخر شب</b>
                    </p>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between gap-2 transition-all ${
                      formData.dailyPlanMode === "three_lessons"
                        ? "bg-sky-950/40 border-sky-500/60 ring-1 ring-sky-500/40"
                        : "bg-slate-900 border-slate-800 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="dailyPlanMode"
                          checked={formData.dailyPlanMode === "three_lessons"}
                          onChange={() => setFormData({ ...formData, dailyPlanMode: "three_lessons" })}
                          className="text-sky-500 focus:ring-sky-500"
                        />
                        <span className="text-xs font-bold text-white">پکیج ۳ تایی تمام آموزشی</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 font-medium">
                        تخصصی
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <b>۳ پست آموزشی در روز</b> (صبح: درس مفهومی، ظهر: کارگاه سند دوبل، شب: آزمون تستی ۴ گزینه‌ای)
                    </p>
                  </label>
                </div>

                {/* Posting Schedule Times */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      ساعت پست صبح (آموزش):
                    </label>
                    <input
                      type="text"
                      value={formData.morningPostTime || "09:00"}
                      onChange={(e) => setFormData({ ...formData, morningPostTime: e.target.value })}
                      placeholder="09:00"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      ساعت پست ظهر (خبر وب / سند):
                    </label>
                    <input
                      type="text"
                      value={formData.noonPostTime || "14:30"}
                      onChange={(e) => setFormData({ ...formData, noonPostTime: e.target.value })}
                      placeholder="14:30"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      ساعت پست شب (فان و طنز / آزمون):
                    </label>
                    <input
                      type="text"
                      value={formData.eveningPostTime || "22:00"}
                      onChange={(e) => setFormData({ ...formData, eveningPostTime: e.target.value })}
                      placeholder="22:00"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Fun Preference Selector */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span>🎭 نوع و سلیقه طنز آخر شب (پست ساعت {formData.eveningPostTime || "22:00"}):</span>
                    </label>
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      طنز جذاب بدون هوش مصنوعی
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    مشخص کنید پست‌های طنز و رفع خستگی آخر شب بیشتر روی چه سوژه‌هایی تمرکز داشته باشند:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {[
                      {
                        id: "all",
                        title: "✨ ترکیبی و متنوع",
                        desc: "هم طنز جذاب روزمره/زندگی و هم میم‌های حسابداری",
                      },
                      {
                        id: "general",
                        title: "🎭 طنز جذاب روزمره و عادی",
                        desc: "شوخی‌های زندگی، کارمندی، فناوری، خرید و خانواده",
                      },
                      {
                        id: "accounting",
                        title: "☕ طنز تخصصی حسابداری",
                        desc: "اختلاف تراز، اکسل، ممیزی، اسناد مالی و انبارگردانی",
                      },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setFormData({ ...formData, funPreference: opt.id as any })}
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 ${
                          (formData.funPreference || "all") === opt.id
                            ? "bg-amber-500/15 border-amber-500/50 text-amber-200 ring-1 ring-amber-500/30"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-100 flex items-center justify-between">
                          <span>{opt.title}</span>
                          {(formData.funPreference || "all") === opt.id && (
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-relaxed">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Automatic Backup to Bots */}
          {activeTab === "backup" && (
            <div className="space-y-6">
              
              {/* Header Box */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">
                      پشتیبان‌گیری خودکار و ارسال مستقیم به بات‌های تلگرام و بله
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      با فعال بودن این قابلیت، یک نسخه کامل و رمزگذاری‌شده از دروس، مباحث تخصصی، صندوق سوالات و پاسخ‌های ادمین
                      به صورت فایل سندی JSON مستقیماً به پی‌وی ادمین یا کانال پشتیبان ارسال می‌شود.
                    </p>
                  </div>
                </div>
              </div>

              {/* Automation Switches */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">ارسال خودکار بکاپ فعال باشد</span>
                    <span className="text-[11px] text-slate-400">بکاپ‌ها به صورت زمان‌بندی شده به ربات‌ها فرستاده می‌شوند</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoBackupEnabled !== false}
                      onChange={(e) => setFormData({ ...formData, autoBackupEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>دوره تناوب پشتیبان‌گیری خودکار:</span>
                    </label>
                    <select
                      value={formData.autoBackupInterval || "daily"}
                      onChange={(e) => setFormData({ ...formData, autoBackupInterval: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      dir="rtl"
                    >
                      <option value="daily">روزانه (هر ۲۴ ساعت یکبار)</option>
                      <option value="weekly">هفتگی (هر جمعه)</option>
                      <option value="every_publish">بعد از هر بار انتشار پست جدید در کانال</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      آخرین بکاپ ارسال شده:
                    </label>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 flex items-center justify-between">
                      <span>{formData.lastBackupAt ? `${formData.lastBackupAt}` : "هنوز ارسال نشده"}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                  </div>
                </div>

                {/* Specific Admin Chat IDs for Backups */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      شناسه چت یا آیدی ادمین تلگرام (جهت دریافت فایل بکاپ):
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً 123456789 یا @my_admin_id (در صورت خالی بودن به کانال ارسال می‌شود)"
                      value={formData.telegramAdminChatId || ""}
                      onChange={(e) => setFormData({ ...formData, telegramAdminChatId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      شناسه چت یا آیدی ادمین بله (جهت دریافت بکاپ):
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً 123456789 یا @my_bale_admin"
                      value={formData.baleAdminChatId || ""}
                      onChange={(e) => setFormData({ ...formData, baleAdminChatId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Instant Backup & Export/Import Controls */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span>عملیات دستی پشتیبان‌گیری و بازیابی:</span>
                </h5>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleTriggerManualBackup}
                    disabled={backupSending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold transition-all shadow-lg shadow-amber-950/40 disabled:opacity-50"
                  >
                    {backupSending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 rotate-180" />
                    )}
                    <span>ارسال فوری بکاپ به بات‌های تلگرام و بله</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>دانلود فایل پشتیبان (JSON)</span>
                  </button>

                  <label className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>بازیابی از فایل پشتیبان</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {backupResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      backupResult.ok
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {backupResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{backupResult.message}</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Tab 4: Hosting, Custom Port, Domain & SSL */}
          {activeTab === "deployment" && (
            <DeploymentSettingsTab
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {/* Tab 5: Setup Guide & Linux Script */}
          {activeTab === "guide" && (
            <div className="space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              
              {/* Linux Script Commands Callout (Sanaei Style) */}
              <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>دستور نصب سریع تک‌خطی سرور لینوکس (به سبک پنل سنایی)</span>
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                    Sanaei 3X-UI Style
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  با کپی و اجرای دستور تک‌خطی زیر در ترمینال سرور لینوکس (اوبونتو، دبیان، ردهت، سنت‌او‌اس)، پروژه به صورت کامل و خودکار از مخزن رسمی گیت‌هاب کلون شده، دپندنسی‌ها نصب و سرویس پایدار systemd فعال می‌شود:
                </p>
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3 font-mono text-xs text-emerald-300 flex items-center justify-between gap-2 overflow-x-auto" dir="ltr">
                  <span className="select-all">bash &lt;(curl -Ls https://raw.githubusercontent.com/meh732/-accountinglearn/master/install.sh)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("bash <(curl -Ls https://raw.githubusercontent.com/meh732/-accountinglearn/master/install.sh)");
                      alert("دستور تک‌خطی نصب در کلیپ‌بورد کپی شد!");
                    }}
                    className="shrink-0 px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 rounded-lg text-[11px] font-sans transition-colors"
                  >
                    کپی دستور
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-amber-300">⚡ دسترسی آسان با دستور خط فرمان:</p>
                  <p className="text-slate-400">
                    پس از اتمام نصب، فقط با تایپ دستور <code className="text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">accountinglearn</code> در هر کجای ترمینال، منوی مدیریت لینوکسی شبیه به پنل سنایی باز می‌شود.
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-3 font-mono text-xs text-slate-200 space-y-1.5" dir="ltr">
                  <div className="text-emerald-400"># Run Interactive Management Menu anytime:</div>
                  <div className="text-yellow-300">accountinglearn</div>
                  <div className="text-emerald-400 mt-2"># Quick flags:</div>
                  <div>./install.sh --port        # Change Web Panel Port anytime (80, 443, 8080, 5000, etc.)</div>
                  <div>./install.sh --update      # Auto-backups to Telegram/Bale and pulls new updates</div>
                  <div>./install.sh --uninstall   # Auto-backups to Telegram/Bale and cleans service</div>
                  <div>./install.sh --backup      # Creates instant backup and dispatches to bots</div>
                  <div>./install.sh --status      # Checks service state and active port</div>
                </div>
              </div>

              {/* Custom Port Guide */}
              <div className="bg-slate-950 border border-indigo-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-indigo-300 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    <span>تنظیم و نصب روی پورت دلخواه (Custom Port)</span>
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    Port 80 / 443 / 8080 / 5000 / Custom
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  سیستم به طور کامل از نصب و اجرا روی <b>هر پورت دلخواه لینوکسی</b> پشتیبانی می‌کند:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-slate-200 block">۱. هنگام نصب خودکار با اسکریپت:</span>
                    <p className="text-slate-400 leading-relaxed">
                      اسکریپت <code className="text-emerald-300 font-mono">install.sh</code> هنگام نصب از شما پورت دلخواه را سوال می‌کند (پیش‌فرض: ۳۰۰۰). می‌توانید با وارد کردن عدد <code className="text-amber-300 font-mono">80</code> سایت را بدون نیاز به وارد کردن دو نقطه پورت در مرورگر باز کنید!
                    </p>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-slate-200 block">۲. تغییر پورت در هر زمان بعد از نصب:</span>
                    <p className="text-slate-400 leading-relaxed">
                      کافیست در ترمینال دستور <code className="text-amber-300 font-mono">accountinglearn</code> را بزنید و گزینه <b>7 (تغییر پورت پنل)</b> را انتخاب کنید، یا مستقیماً دستور <code className="text-indigo-300 font-mono">accountinglearn --port</code> را اجرا کنید.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl font-mono text-xs text-slate-300 space-y-1" dir="ltr">
                  <span className="text-slate-500 font-sans block text-[11px] mb-1 font-medium">اجرای دستی با خط فرمان Node / NPM:</span>
                  <div><span className="text-emerald-400">npm start -- --port</span> <span className="text-amber-300">8080</span></div>
                  <div><span className="text-emerald-400">APP_PORT</span>=<span className="text-amber-300">80</span> <span className="text-slate-200">node dist/server.cjs</span></div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sky-400 flex items-center gap-2">
                  <span>🔹 نحوه ساخت ربات در تلگرام</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300 pr-2">
                  <li>در تلگرام به آیدی <b>@BotFather</b> پیام دهید.</li>
                  <li>دستور <code>/newbot</code> را ارسال کرده و نام و نام کاربری ربات را تعیین کنید.</li>
                  <li>توکن دریافت شده (API Token) را کپی کرده و در کادر توکن تلگرام بالا قرار دهید.</li>
                  <li>وارد کانال تلگرام خود شوید ➡️ به بخش <b>Administrators</b> بروید ➡️ ربات خود را به عنوان مدیر اضافه کنید و دسترسی <b>Post Messages</b> بدهید.</li>
                </ol>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                  <span>🔹 نحوه ساخت ربات در پیام‌رسان بله (Bale)</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300 pr-2">
                  <li>در اپلیکیشن بله به آیدی <b>@BotFather</b> مراجعه کنید.</li>
                  <li>دستور ساخت ربات جدید را ارسال کنید و نام و آیدی ربات را انتخاب کنید.</li>
                  <li>توکن اختصاصی را دریافت و در کادر توکن بله در پنل بالا وارد کنید.</li>
                  <li>در کانال بله خود، ربات را به عنوان ادمین (با اجازه ارسال پیام) اضافه کنید.</li>
                </ol>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
          >
            انصراف
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره تنظیمات</span>
          </button>
        </div>

      </div>
    </div>
  );
};
