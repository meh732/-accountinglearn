import React, { useState } from "react";
import {
  X,
  Settings,
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  HelpCircle,
} from "lucide-react";
import { BotConfig } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onSaveConfig: (newConfig: BotConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<BotConfig>({ ...config });
  const [activeTab, setActiveTab] = useState<"credentials" | "branding" | "guide">("credentials");

  // Connection test states
  const [tgTestState, setTgTestState] = useState<{ loading: boolean; result?: any; error?: string }>({
    loading: false,
  });
  const [baleTestState, setBaleTestState] = useState<{ loading: boolean; result?: any; error?: string }>({
    loading: false,
  });

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
                تنظیمات ربات‌های تلگرام و بله
              </h3>
              <p className="text-xs text-slate-400">
                پیکربندی توکن ربات‌ها، آیدی کانال‌ها، امضای پست‌ها و تست اتصال
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
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
          <button
            onClick={() => setActiveTab("credentials")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "credentials"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            توکن‌ها و کانال‌ها
          </button>
          <button
            onClick={() => setActiveTab("branding")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "branding"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            هویت کانال و امضای پست‌ها
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "guide"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>راهنمای ساخت ربات تلگرام و بله</span>
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
            </div>
          )}

          {/* Tab 3: Setup Guide */}
          {activeTab === "guide" && (
            <div className="space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sky-400 flex items-center gap-2">
                  <span>🔹 مرحله ۱: نحوه ساخت ربات در تلگرام</span>
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
                  <span>🔹 مرحله ۲: نحوه ساخت ربات در پیام‌رسان بله (Bale)</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300 pr-2">
                  <li>در اپلیکیشن بله به آیدی <b>@BotFather</b> مراجعه کنید.</li>
                  <li>دستور ساخت ربات جدید را ارسال کنید و نام و آیدی ربات را انتخاب کنید.</li>
                  <li>توکن اختصاصی را دریافت و در کادر توکن بله در پنل بالا وارد کنید.</li>
                  <li>در کانال بله خود، ربات را به عنوان ادمین (با اجازه ارسال پیام) اضافه کنید.</li>
                </ol>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-200">
                💡 <b>نکته مهم:</b> اگر هنوز توکن یا کانال واقعی نساخته‌اید، می‌توانید به راحتی در پنل پست‌ها را مشاهده کرده و ارسال آزمایشی (شبیه‌ساز) را تست کنید.
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
