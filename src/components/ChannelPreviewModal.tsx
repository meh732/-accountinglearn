import React, { useState } from "react";
import { X, Send, Eye, Check, AlertCircle, Sparkles, Copy } from "lucide-react";
import { MessengerPlatform, BotConfig } from "../types";

interface ChannelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  formattedText: string;
  config: BotConfig;
  onSend: (platforms: MessengerPlatform[], text: string) => Promise<void>;
  isSending: boolean;
}

export const ChannelPreviewModal: React.FC<ChannelPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  formattedText,
  config,
  onSend,
  isSending,
}) => {
  if (!isOpen) return null;

  const [platforms, setPlatforms] = useState<MessengerPlatform[]>(["telegram", "bale"]);
  const [editedText, setEditedText] = useState(formattedText);
  const [activePreviewTab, setActivePreviewTab] = useState<MessengerPlatform>("telegram");
  const [copied, setCopied] = useState(false);

  // Sync state if initial formatted text changes
  React.useEffect(() => {
    setEditedText(formattedText);
  }, [formattedText]);

  const togglePlatform = (p: MessengerPlatform) => {
    if (platforms.includes(p)) {
      if (platforms.length === 1) return; // keep at least one
      setPlatforms(platforms.filter((item) => item !== p));
    } else {
      setPlatforms([...platforms, p]);
    }
  };

  const handleCopy = () => {
    // Strip simple HTML tags for clipboard plain text
    const plain = editedText
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendClick = () => {
    onSend(platforms, editedText);
  };

  // Convert simple Telegram HTML tags to react-safe elements for realistic bubble display
  const renderBubbleContent = () => {
    return (
      <div
        className="whitespace-pre-wrap text-sm leading-relaxed font-['Vazirmatn',sans-serif]"
        dangerouslySetInnerHTML={{ __html: editedText }}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">پیش‌نمایش و تایید ارسال به کانال</h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Text Editor & Platform Selection */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                مقصد ارسال پیام:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePlatform("telegram")}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                    platforms.includes("telegram")
                      ? "bg-sky-500/10 border-sky-500/40 text-sky-300 ring-1 ring-sky-500/30"
                      : "bg-slate-800/40 border-slate-700 text-slate-400 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                      TG
                    </div>
                    <div className="text-right">
                      <div className="font-bold">کانال تلگرام</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        {config.telegramChannel || "پیش‌فرض / شبیه‌ساز"}
                      </div>
                    </div>
                  </div>
                  {platforms.includes("telegram") && <Check className="w-4 h-4 text-sky-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => togglePlatform("bale")}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                    platforms.includes("bale")
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30"
                      : "bg-slate-800/40 border-slate-700 text-slate-400 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      بله
                    </div>
                    <div className="text-right">
                      <div className="font-bold">کانال بله (Bale)</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        {config.baleChannel || "پیش‌فرض / شبیه‌ساز"}
                      </div>
                    </div>
                  </div>
                  {platforms.includes("bale") && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  متن پیام نهایی (قابل ویرایش):
                </label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? "کپی شد!" : "کپی متن"}</span>
                </button>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={12}
                className="w-full flex-1 rounded-xl bg-slate-950 border border-slate-700 p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50 resize-y leading-relaxed"
                dir="rtl"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                تگ‌های مجاز تلگرام: &lt;b&gt;ضخیم&lt;/b&gt;، &lt;i&gt;ایتالیک&lt;/i&gt;، &lt;code&gt;کد/ثبت سند&lt;/code&gt;، &lt;blockquote&gt;نقل‌قول&lt;/blockquote&gt;
              </p>
            </div>
          </div>

          {/* Right Column: Realistic Messenger Simulator Bubble */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab("telegram")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activePreviewTab === "telegram"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  نمای تلگرام
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab("bale")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activePreviewTab === "bale"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  نمای پیام‌رسان بله
                </button>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                پیش‌نمایش زنده در کانال
              </span>
            </div>

            {/* Messenger Mobile View Screen */}
            <div
              className={`flex-1 rounded-2xl p-4 sm:p-5 border overflow-y-auto min-h-[320px] max-h-[440px] flex flex-col justify-end ${
                activePreviewTab === "telegram"
                  ? "bg-[#0e1621] border-[#242f3d]"
                  : "bg-[#1f2937] border-emerald-950/40"
              }`}
            >
              {/* Channel Header Simulation */}
              <div className="pb-2 mb-3 border-b border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  {config.channelTitle || "کانال تخصصی حسابداری ایران"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {activePreviewTab === "telegram" ? "Telegram Channel" : "Bale Channel"}
                </span>
              </div>

              {/* Message Bubble */}
              <div
                className={`p-4 rounded-2xl shadow-lg border text-right max-w-full ${
                  activePreviewTab === "telegram"
                    ? "bg-[#182533] border-[#2b3c4f] text-[#f5f5f5]"
                    : "bg-[#111827] border-emerald-900/30 text-slate-100"
                }`}
              >
                {renderBubbleContent()}

                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Eye className="w-3 h-3" />
                    <span>۱.۴k بازدید</span>
                  </div>
                  <span>{new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>
              ارسال همزمان به {platforms.map((p) => (p === "telegram" ? "تلگرام" : "بله")).join(" و ")}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex-1 sm:flex-initial"
            >
              انصراف
            </button>

            <button
              onClick={handleSendClick}
              disabled={isSending || platforms.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:pointer-events-none flex-1 sm:flex-initial"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>در حال ارسال به ربات‌ها...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 rotate-180" />
                  <span>ارسال نهایی به کانال ({platforms.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
