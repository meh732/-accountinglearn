import React, { useState } from "react";
import { BroadcastLog } from "../types";
import { Radio, CheckCircle, Clock, Copy, AlertTriangle, Eye, Send } from "lucide-react";

interface HistoryTabProps {
  logs: BroadcastLog[];
  onResend: (log: BroadcastLog) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ logs, onResend }) => {
  const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (log: BroadcastLog) => {
    navigator.clipboard.writeText(log.fullText);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStyleBadge = (style: BroadcastLog["style"]) => {
    switch (style) {
      case "zero_to_hero":
        return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">سبک ۱: صفر تا صد ایران</span>;
      case "advanced":
        return <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">سبک ۲: حرفه‌ای و تخصصی</span>;
      case "qa":
        return <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">سبک ۳: پرسش و پاسخ</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold">پست دعوت</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              تاریخچه و لاگ ارسال به کانال‌های تلگرام و بله
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              مجموع {logs.length} پست ارسال شده از هر سه سبک آموزشی
            </p>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Clock className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-medium">هنوز هیچ پستی به کانال ارسال نشده است.</p>
          <p className="text-xs text-slate-500">
            از یکی از سه تب آموزشی بالا، یک درس یا پاسخ را انتخاب و به کانال ارسال کنید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Logs List */}
          <div className="lg:col-span-6 space-y-3 max-h-[660px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const isSelected = selectedLog?.id === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all text-right ${
                    isSelected
                      ? "bg-slate-800/90 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {getStyleBadge(log.style)}
                    <span className="text-[11px] text-slate-400">{log.timestamp}</span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 line-clamp-1 mb-1">
                    {log.title}
                  </h4>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {log.contentPreview}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">ارسال به:</span>
                      {log.platforms.map((p) => (
                        <span
                          key={p}
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            p === "telegram"
                              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {p === "telegram" ? "تلگرام" : "بله"}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      {log.status === "simulated" ? (
                        <span className="text-amber-400 font-medium">ارسال در شبیه‌ساز</span>
                      ) : log.status === "success" ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>تحویل موفق</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-medium">خطا</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Log Detail Viewer */}
          <div className="lg:col-span-6">
            {selectedLog ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{selectedLog.title}</h3>
                    <span className="text-xs text-slate-400">{selectedLog.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyText(selectedLog)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedId === selectedLog.id ? "کپی شد!" : "کپی"}</span>
                    </button>
                    <button
                      onClick={() => onResend(selectedLog)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Send className="w-3 h-3 rotate-180" />
                      <span>ارسال مجدد</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 max-h-[500px] overflow-y-auto">
                  <div
                    className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans"
                    dangerouslySetInnerHTML={{ __html: selectedLog.fullText }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
                یک رکورد از ستون سمت راست برای مشاهده جزئیات کامل انتخاب کنید.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
