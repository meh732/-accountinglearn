import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { ZeroToHeroTab } from "./components/ZeroToHeroTab";
import { AdvancedTab } from "./components/AdvancedTab";
import { QATab } from "./components/QATab";
import { HistoryTab } from "./components/HistoryTab";
import { ChannelPreviewModal } from "./components/ChannelPreviewModal";
import { SettingsModal } from "./components/SettingsModal";
import { HelpModal } from "./components/HelpModal";
import {
  LessonItem,
  AdvancedTopic,
  QuestionItem,
  BotConfig,
  BroadcastLog,
  MessengerPlatform,
} from "./types";
import {
  initialLessons,
  initialAdvancedTopics,
  initialQuestions,
} from "./data/curriculumData";
import { CheckCircle, AlertCircle, Info, Sparkles } from "lucide-react";

export default function App() {
  // --- Persistent State ---
  const [config, setConfig] = useState<BotConfig>(() => {
    const saved = localStorage.getItem("accounting_bot_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      telegramToken: "",
      telegramChannel: "@hesabdari_iran_channel",
      baleToken: "",
      baleChannel: "@hesabdari_bale_channel",
      channelTitle: "آکادمی حسابداری و قوانین مالیاتی ایران",
      channelSignature: "📢 عضویت در کانال حسابداری: @hesabdari_iran_channel | بله: @hesabdari_bale_channel",
      autoHashtags: "#آموزش_حسابداری #مالیات #سامانه_مودیان",
      simulationMode: true,
    };
  });

  const [lessons, setLessons] = useState<LessonItem[]>(() => {
    const saved = localStorage.getItem("accounting_bot_lessons");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialLessons;
  });

  const [topics, setTopics] = useState<AdvancedTopic[]>(() => {
    const saved = localStorage.getItem("accounting_bot_topics");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialAdvancedTopics;
  });

  const [questions, setQuestions] = useState<QuestionItem[]>(() => {
    const saved = localStorage.getItem("accounting_bot_questions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialQuestions;
  });

  const [historyLogs, setHistoryLogs] = useState<BroadcastLog[]>(() => {
    const saved = localStorage.getItem("accounting_bot_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: "log-1",
        title: "درس شماره ۱: مفاهیم اساسی، معادله حسابداری و ارکان مالی در ایران",
        style: "zero_to_hero",
        platforms: ["telegram", "bale"],
        contentPreview: "در علم حسابداری، تمام رویدادهای مالی یک واحد اقتصادی بر اساس معادله اساسی تجزیه و تحلیل می‌شوند...",
        fullText: "📘 آموزش گام‌به‌گام حسابداری ایران | درس شماره ۱\nمفاهیم اساسی، معادله حسابداری و ارکان مالی...",
        timestamp: "امروز - ۱۰:۱۵",
        status: "simulated",
      },
      {
        id: "log-2",
        title: "پاسخ به سوال: رد صورتحساب در سامانه مودیان و تکلیف اعتبار",
        style: "qa",
        platforms: ["telegram"],
        contentPreview: "در صورتی که صورتحساب الکترونیکی در کارپوشه سامانه مودیان توسط خریدار رد شود...",
        fullText: "💬 میز پرسش و پاسخ حسابداری و مالیاتی کانال\nسوال مطرح شده: رد فاکتور در سامانه مودیان...",
        timestamp: "دیروز - ۱۸:۳۰",
        status: "simulated",
      },
    ];
  });

  // UI Navigation State
  const [activeTab, setActiveTab] = useState<string>("zero_to_hero");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Preview & Send Modal State
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    formattedText: string;
  }>({
    isOpen: false,
    title: "",
    formattedText: "",
  });
  const [isSending, setIsSending] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem("accounting_bot_config", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem("accounting_bot_lessons", JSON.stringify(lessons));
  }, [lessons]);

  useEffect(() => {
    localStorage.setItem("accounting_bot_topics", JSON.stringify(topics));
  }, [topics]);

  useEffect(() => {
    localStorage.setItem("accounting_bot_questions", JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    localStorage.setItem("accounting_bot_history", JSON.stringify(historyLogs));
  }, [historyLogs]);

  // Handlers
  const handleOpenPreview = (title: string, formattedText: string) => {
    setPreviewModal({
      isOpen: true,
      title,
      formattedText,
    });
  };

  const handleSendToChannels = async (platforms: MessengerPlatform[], text: string) => {
    setIsSending(true);
    try {
      const res = await fetch("/api/send-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms,
          text,
          parseMode: "HTML",
          config: {
            telegramToken: config.telegramToken,
            telegramChannel: config.telegramChannel,
            baleToken: config.baleToken,
            baleChannel: config.baleChannel,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "خطا در ارسال پست به کانال‌ها");
      }

      // Record to history
      const newLog: BroadcastLog = {
        id: `broadcast-${Date.now()}`,
        title: previewModal.title || "پست ارسالی به کانال",
        style: activeTab as any,
        platforms,
        contentPreview: text.replace(/<[^>]*>/g, "").slice(0, 120) + "...",
        fullText: text,
        timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
        status:
          data.results?.telegram?.simulated || data.results?.bale?.simulated
            ? "simulated"
            : "success",
      };

      setHistoryLogs((prev) => [newLog, ...prev]);

      const targetNames = platforms.map((p) => (p === "telegram" ? "تلگرام" : "بله")).join(" و ");
      showToast(
        `پست با موفقیت به کانال ${targetNames} ارسال شد! ${
          newLog.status === "simulated" ? "(در حالت شبیه‌ساز)" : ""
        }`,
        "success"
      );

      setPreviewModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      showToast(err.message || "خطا در ارسال پیام", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleAddLesson = (newLesson: LessonItem) => {
    setLessons((prev) => [newLesson, ...prev]);
    showToast(`درس جدید "${newLesson.title}" با موفقیت اضافه شد.`, "success");
  };

  const handleAddTopic = (newTopic: AdvancedTopic) => {
    setTopics((prev) => [newTopic, ...prev]);
    showToast(`مبحث تخصصی "${newTopic.title}" با موفقیت ثبت شد.`, "success");
  };

  const handleUpdateQuestion = (updated: QuestionItem) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    showToast("تغییرات سوال و پاسخ ادمین با موفقیت ذخیره شد.", "info");
  };

  const handleAddQuestion = (newQ: QuestionItem) => {
    setQuestions((prev) => [newQ, ...prev]);
    showToast("سوال جدید از کاربر با موفقیت در صندوق ثبت گردید.", "success");
  };

  const handleResendLog = (log: BroadcastLog) => {
    setPreviewModal({
      isOpen: true,
      title: log.title,
      formattedText: log.fullText,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200 font-['Vazirmatn',sans-serif]" dir="rtl">
      
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold border ${
              toast.type === "success"
                ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50"
                : toast.type === "error"
                ? "bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-950/50"
                : "bg-slate-900/90 text-sky-200 border-sky-500/40 shadow-slate-950/50"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <Info className="w-4 h-4 text-sky-400" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main App Navigation Header */}
      <Header
        config={config}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sentCount={historyLogs.length}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === "zero_to_hero" && (
          <ZeroToHeroTab
            lessons={lessons}
            config={config}
            onSelectForPublish={handleOpenPreview}
            onAddLesson={handleAddLesson}
          />
        )}

        {activeTab === "advanced" && (
          <AdvancedTab
            topics={topics}
            config={config}
            onSelectForPublish={handleOpenPreview}
            onAddTopic={handleAddTopic}
          />
        )}

        {activeTab === "qa" && (
          <QATab
            questions={questions}
            config={config}
            onSelectForPublish={handleOpenPreview}
            onUpdateQuestion={handleUpdateQuestion}
            onAddQuestion={handleAddQuestion}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab logs={historyLogs} onResend={handleResendLog} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500 bg-slate-950">
        سیستم یکپارچه ارسال ۳ سبک آموزش حسابداری به کانال‌های تلگرام و بله | منطبق بر استانداردهای حسابداری و قوانین مالیاتی ایران
      </footer>

      {/* Channel Preview & Final Send Modal */}
      <ChannelPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal((prev) => ({ ...prev, isOpen: false }))}
        title={previewModal.title}
        formattedText={previewModal.formattedText}
        config={config}
        onSend={handleSendToChannels}
        isSending={isSending}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={(newCfg) => {
          setConfig(newCfg);
          showToast("تنظیمات ربات‌ها و کانال‌ها با موفقیت ذخیره شد.", "success");
        }}
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

    </div>
  );
}
