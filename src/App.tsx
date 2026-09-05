import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { ZeroToHeroTab } from "./components/ZeroToHeroTab";
import { AdvancedTab } from "./components/AdvancedTab";
import { QATab } from "./components/QATab";
import { HistoryTab } from "./components/HistoryTab";
import { DailyQuizzesTab } from "./components/DailyQuizzesTab";
import { StudentMiniApp } from "./components/StudentMiniApp";
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
  DailyQuizItem,
  PracticeScenario,
  ThreeMonthDayItem,
} from "./types";
import {
  initialLessons,
  initialAdvancedTopics,
  initialQuestions,
} from "./data/curriculumData";
import {
  initialDailyQuizzes,
  initialPracticeScenarios,
} from "./data/quizData";
import { initialThreeMonthCurriculum } from "./data/threeMonthCurriculum";
import { CheckCircle, AlertCircle, Info, Sparkles, Smartphone, ArrowLeft } from "lucide-react";

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

  const [quizzes, setQuizzes] = useState<DailyQuizItem[]>(() => {
    const saved = localStorage.getItem("accounting_bot_quizzes");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialDailyQuizzes;
  });

  const [scenarios, setScenarios] = useState<PracticeScenario[]>(() => {
    const saved = localStorage.getItem("accounting_bot_scenarios");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialPracticeScenarios;
  });

  const [threeMonthDays, setThreeMonthDays] = useState<ThreeMonthDayItem[]>(() => {
    const saved = localStorage.getItem("accounting_bot_3month_days");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error reading 3month days:", e);
      }
    }
    return initialThreeMonthCurriculum;
  });

  const [isMiniAppModalOpen, setIsMiniAppModalOpen] = useState(false);

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
    localStorage.setItem("accounting_bot_quizzes", JSON.stringify(quizzes));
  }, [quizzes]);

  useEffect(() => {
    localStorage.setItem("accounting_bot_scenarios", JSON.stringify(scenarios));
  }, [scenarios]);

  useEffect(() => {
    localStorage.setItem("accounting_bot_history", JSON.stringify(historyLogs));
  }, [historyLogs]);

  useEffect(() => {
    localStorage.setItem("accounting_bot_3month_days", JSON.stringify(threeMonthDays));
  }, [threeMonthDays]);

  const handleUpdateThreeMonthDay = (updatedDay: ThreeMonthDayItem) => {
    setThreeMonthDays((prev) => {
      const idx = prev.findIndex((d) => d.dayNumber === updatedDay.dayNumber);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedDay;
        return next;
      }
      return [...prev, updatedDay];
    });
    showToast(`پکیج روز شماره ${updatedDay.dayNumber} با موفقیت به‌روزرسانی شد.`, "success");
  };

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

      // Auto-Backup dispatch if configured for every publish
      if (config.autoBackupEnabled && config.autoBackupInterval === "every_publish") {
        fetch("/api/backup-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              lessons,
              threeMonthDays,
              topics,
              questions,
              quizzes,
              scenarios,
              config,
              historyLogs: [newLog, ...historyLogs],
              timestamp: new Date().toISOString(),
            },
            config: {
              telegramToken: config.telegramToken,
              telegramAdminChatId: config.telegramAdminChatId || config.telegramChannel,
              baleToken: config.baleToken,
              baleAdminChatId: config.baleAdminChatId || config.baleChannel,
            },
            caption: "📦 بکاپ خودکار پس از انتشار پست جدید در کانال",
          }),
        })
          .then((r) => r.json())
          .then((resData) => {
            if (resData.ok) {
              setConfig((prev) => ({
                ...prev,
                lastBackupAt: new Date().toLocaleTimeString("fa-IR"),
              }));
            }
          })
          .catch((e) => console.error("Auto backup error:", e));
      }
    } catch (err: any) {
      showToast(err.message || "خطا در ارسال پیام", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleRestoreData = (imported: any) => {
    if (imported.lessons && Array.isArray(imported.lessons)) setLessons(imported.lessons);
    if (imported.threeMonthDays && Array.isArray(imported.threeMonthDays)) setThreeMonthDays(imported.threeMonthDays);
    if (imported.topics && Array.isArray(imported.topics)) setTopics(imported.topics);
    if (imported.questions && Array.isArray(imported.questions)) setQuestions(imported.questions);
    if (imported.quizzes && Array.isArray(imported.quizzes)) setQuizzes(imported.quizzes);
    if (imported.scenarios && Array.isArray(imported.scenarios)) setScenarios(imported.scenarios);
    if (imported.historyLogs && Array.isArray(imported.historyLogs)) setHistoryLogs(imported.historyLogs);
    if (imported.config && typeof imported.config === "object") setConfig((prev) => ({ ...prev, ...imported.config }));
    showToast("کلیه اطلاعات، دوره ۳ ماهه، آزمون‌ها و سوالات از فایل بکاپ با موفقیت بازیابی شد.", "success");
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

  const handleAddQuiz = (newQuiz: DailyQuizItem) => {
    setQuizzes((prev) => [newQuiz, ...prev]);
    showToast(`آزمون روز ${newQuiz.dayNumber} با موفقیت ثبت شد.`, "success");
  };

  const handleDeleteQuiz = (id: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    showToast("آزمون با موفقیت حذف گردید.", "info");
  };

  const handleSendQuizToChannel = async (quiz: DailyQuizItem, platforms: MessengerPlatform[]) => {
    setIsSending(true);
    try {
      const studentAppUrl = typeof window !== "undefined"
        ? `${window.location.origin}?view=student`
        : "https://acc-bot.example.com?view=student";

      const res = await fetch("/api/send-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms,
          title: quiz.title,
          question: quiz.question,
          options: quiz.options,
          correctOptionIndex: quiz.correctOptionIndex,
          explanation: quiz.explanation,
          config,
          webAppUrl: studentAppUrl,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "خطا در ارسال آزمون");

      const newLog: BroadcastLog = {
        id: "log-" + Date.now(),
        title: quiz.title,
        style: "daily_quiz",
        platforms,
        contentPreview: quiz.question.slice(0, 100) + "...",
        fullText: `📊 ${quiz.title}\nسوال: ${quiz.question}\nگزینه‌ها:\n${quiz.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n✅ گزینه صحیح: ${quiz.correctOptionIndex + 1}\n💡 استناد: ${quiz.explanation}`,
        timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
        status: config.simulationMode ? "simulated" : "success",
      };

      setHistoryLogs((prev) => [newLog, ...prev]);
      showToast("آزمون و نظرسنجی با موفقیت به کانال تلگرام و بله ارسال شد.", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "خطا در ارسال آزمون به کانال", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleResendLog = (log: BroadcastLog) => {
    setPreviewModal({
      isOpen: true,
      title: log.title,
      formattedText: log.fullText,
    });
  };

  const isUrlStudentMode =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("view") === "student" ||
      new URLSearchParams(window.location.search).get("app") === "student");

  if (isUrlStudentMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-2 sm:p-4 font-['Vazirmatn',sans-serif]" dir="rtl">
        <div className="max-w-4xl w-full mx-auto mb-3 flex items-center justify-between bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl text-xs">
          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" />
            <span>محیط وب‌اپلیکیشن اعضای کانال (Telegram / Bale WebApp)</span>
          </span>
          <a
            href={window.location.pathname}
            className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
          >
            <span>ورود به پنل مدیریت ادمین</span>
            <ArrowLeft className="w-3 h-3" />
          </a>
        </div>
        <StudentMiniApp
          isStandalone
          quizzes={quizzes}
          scenarios={scenarios}
          config={config}
        />
      </div>
    );
  }

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
            threeMonthDays={threeMonthDays}
            config={config}
            onSelectForPublish={handleOpenPreview}
            onUpdateDay={handleUpdateThreeMonthDay}
            onSendQuizToChannel={handleSendQuizToChannel}
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

        {activeTab === "quizzes" && (
          <DailyQuizzesTab
            quizzes={quizzes}
            lessons={lessons}
            config={config}
            onSendQuizToChannel={handleSendQuizToChannel}
            onAddQuiz={handleAddQuiz}
            onDeleteQuiz={handleDeleteQuiz}
            onOpenMiniAppSimulator={() => setIsMiniAppModalOpen(true)}
          />
        )}

        {activeTab === "student_app" && (
          <div className="py-2">
            <div className="flex items-center justify-between mb-4 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>پیش‌نمایش زنده مینی‌اپ حسابداری اعضای کانال (شبیه‌ساز Telegram / Bale WebApp)</span>
              </div>
              <button
                onClick={() => setActiveTab("quizzes")}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
              >
                <span>بازگشت به پنل مدیریت آزمون‌ها</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <StudentMiniApp
              quizzes={quizzes}
              scenarios={scenarios}
              config={config}
            />
          </div>
        )}

        {activeTab === "history" && (
          <HistoryTab logs={historyLogs} onResend={handleResendLog} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500 bg-slate-950">
        سیستم یکپارچه ارسال ۳ سبک آموزش حسابداری و آزمون‌های روزانه به کانال‌های تلگرام و بله | منطبق بر قوانین مالیاتی ایران
      </footer>

      {/* Student Mini App Modal Simulator */}
      {isMiniAppModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[94vh] flex flex-col">
            <StudentMiniApp
              quizzes={quizzes}
              scenarios={scenarios}
              config={config}
              onClose={() => setIsMiniAppModalOpen(false)}
            />
          </div>
        </div>
      )}

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
        allAppData={{
          lessons,
          threeMonthDays,
          topics,
          questions,
          quizzes,
          scenarios,
          config,
          historyLogs,
          exportedAt: new Date().toISOString(),
        }}
        onRestoreData={handleRestoreData}
        onSaveConfig={(newCfg) => {
          setConfig(newCfg);
          showToast("تنظیمات ربات‌ها، کانال‌ها و بکاپ با موفقیت ذخیره شد.", "success");
        }}
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

    </div>
  );
}
