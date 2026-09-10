import React, { useState, useEffect } from "react";
import {
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  Award,
  Search,
  RefreshCw,
  Trash2,
  Download,
  Eye,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Send,
  HelpCircle,
  ExternalLink,
  Flame,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { BotConfig } from "../types";

interface LeaderboardUser {
  rank: number;
  userId: number;
  name: string;
  username: string;
  totalScore: number;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  streakDays: number;
  lastActiveAt: string;
}

interface BotStatsResponse {
  totalUsers: number;
  totalAnswersAcrossBot: number;
  totalCorrectAcrossBot: number;
  averageAccuracy: number;
  leaderboard: LeaderboardUser[];
}

interface UserDetailRecord {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  firstSeenAt: string;
  lastActiveAt: string;
  totalScore: number;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  streakDays: number;
  rank: number;
  accuracy: number;
  answers: Record<
    string,
    {
      quizId: string;
      dayNumber: number;
      question: string;
      selectedOptionIndex: number;
      correctOptionIndex: number;
      isCorrect: boolean;
      answeredAt: string;
      attempts: number;
    }
  >;
}

interface BotQuizUsersTabProps {
  config: BotConfig;
  onOpenSchedulerModal?: () => void;
}

export const BotQuizUsersTab: React.FC<BotQuizUsersTabProps> = ({ config }) => {
  const [stats, setStats] = useState<BotStatsResponse | null>(null);
  const [botUsername, setBotUsername] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Live In-Bot Simulator State
  const [simDay, setSimDay] = useState<number>(1);
  const [simSelectedOption, setSimSelectedOption] = useState<number | null>(null);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simSubmitting, setSimSubmitting] = useState<boolean>(false);

  // Sync menu state
  const [syncingMenu, setSyncingMenu] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSyncMenu = async () => {
    setSyncingMenu(true);
    setSyncNotice(null);
    try {
      const res = await fetch("/api/bot/sync-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: config.telegramToken }),
      });
      const data = await res.json();
      if (data.ok) {
        setSyncNotice({
          ok: true,
          message: `✅ منوی ربات تلگرام، مربع منو در نوار پیام و ۷ دستور اصلی فعال شدند! هم‌اکنون در ربات تلگرام دستور /start را ارسال کنید تا گزینه‌ها بالا بیایند.`,
        });
        if (data.username) setBotUsername(data.username);
      } else {
        setSyncNotice({
          ok: false,
          message: data.error || "خطا در ارتباط با تلگرام. لطفاً ابتدا توکن ربات را در بخش تنظیمات وارد فرمایید.",
        });
      }
    } catch (e: any) {
      setSyncNotice({ ok: false, message: e.message || "خطای ارتباط با سرور" });
    } finally {
      setSyncingMenu(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bot-users/stats");
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
        if (data.botUsername) setBotUsername(data.botUsername);
      }
    } catch (err) {
      console.error("Error fetching bot users stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleInspectUser = async (userId: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/bot-users/details/${userId}`);
      const data = await res.json();
      if (data.ok && data.user) {
        setSelectedUserDetail(data.user);
      }
    } catch (err) {
      console.error("Error fetching user details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResetUser = async (userId: number) => {
    if (!confirm(`آیا از بازنشانی سوابق و امتیازات کاربر ${userId} اطمینان دارید؟`)) return;
    try {
      const res = await fetch("/api/bot-users/reset-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.ok) {
        if (selectedUserDetail?.userId === userId) {
          setSelectedUserDetail(null);
        }
        fetchStats();
      }
    } catch (err) {
      console.error("Error resetting user:", err);
    }
  };

  const handleResetAllUsers = async () => {
    if (!confirm("⚠️ توجه: آیا از پاکسازی تمامی سوابق و کارنامه‌های همه کاربران اطمینان دارید؟")) return;
    try {
      const res = await fetch("/api/bot-users/reset-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedUserDetail(null);
        fetchStats();
      }
    } catch (err) {
      console.error("Error resetting all users:", err);
    }
  };

  const handleSimulateAnswer = async (optIdx: number) => {
    setSimSubmitting(true);
    setSimSelectedOption(optIdx);
    try {
      const res = await fetch("/api/bot-interactive/simulate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: 98765432,
          dayNumber: simDay,
          selectedOptionIndex: optIdx,
          userInfo: {
            firstName: "کاربر تستی",
            username: "test_user_iran",
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSimResult(data.result);
        fetchStats();
      }
    } catch (err) {
      console.error("Error in simulated quiz answer:", err);
    } finally {
      setSimSubmitting(false);
    }
  };

  const handleExportData = () => {
    if (!stats) return;
    const jsonStr = JSON.stringify(stats, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting_bot_quiz_users_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLeaderboard = (stats?.leaderboard || []).filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      String(u.userId).includes(q)
    );
  });

  return (
    <div className="space-y-8" id="bot-quiz-users-panel">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              سامانه آزمون‌های تستی تعاملی داخل ربات با دکمه‌های شیشه‌ای
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              کارنامه، امتیازات و رتبه‌بندی کاربران ربات
            </h2>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl leading-relaxed">
              هر دانش‌پذیر می‌تواند با ارسال دستور <code className="bg-indigo-950 px-2 py-0.5 rounded border border-indigo-700/50 text-indigo-300 font-mono">/start</code> یا <code className="bg-indigo-950 px-2 py-0.5 rounded border border-indigo-700/50 text-indigo-300 font-mono">/quiz</code> در ربات، آزمون‌های دوره ۹۰ روزه را با <b>دکمه‌های شیشه‌ای (Inline Buttons)</b> پاسخ دهد و کارنامه اختصاصی با امتیاز و رتبه دریافت کند.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSyncMenu}
              disabled={syncingMenu}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-bold transition shadow-md active:scale-95 disabled:opacity-60"
            >
              <Sparkles className={`w-4 h-4 ${syncingMenu ? "animate-spin" : "text-sky-200"}`} />
              راه‌اندازی منو و دکمه چت در تلگرام
            </button>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
              بروزرسانی زنده
            </button>
            <button
              onClick={handleExportData}
              disabled={!stats || stats.totalUsers === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-md active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              خروجی JSON
            </button>
          </div>
        </div>

        {syncNotice && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              syncNotice.ok
                ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-200"
                : "bg-rose-950/70 border-rose-500/50 text-rose-200"
            }`}
          >
            {syncNotice.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed font-medium">{syncNotice.message}</span>
          </div>
        )}

        {/* Bot Username & Deep-link Indicator */}
        {botUsername ? (
          <div className="mt-6 pt-4 border-t border-indigo-800/30 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>ربات متصل تلگرام:</span>
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-bold text-white bg-indigo-900/60 px-2.5 py-1 rounded-lg border border-indigo-700/50 hover:bg-indigo-800 transition inline-flex items-center gap-1.5"
              >
                @{botUsername}
                <ExternalLink className="w-3 h-3 text-indigo-300" />
              </a>
            </div>
            <div className="text-slate-400">
              لینک شروع مستقیم آزمون امروز: <code className="text-indigo-300">https://t.me/{botUsername}?start=quiz_1</code>
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-4 border-t border-indigo-800/30 text-xs text-amber-300 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>توکن ربات تلگرام تنظیم شده است و موتور دریافت پاسخ‌ها (Long-Polling) در پس‌زمینه فعال است.</span>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">کل کاربران و دانش‌پذیران</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-3">{stats?.totalUsers || 0}</div>
          <div className="text-xs text-slate-500 mt-1">حساب‌های کاربری فعال در ربات</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">آزمون‌های حل شده</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-3">{stats?.totalAnswersAcrossBot || 0}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats?.totalCorrectAcrossBot || 0} پاسخ صحیح ثبت‌شده
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">میانگین دقت و تسلط</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-3">{stats?.averageAccuracy || 0}٪</div>
          <div className="text-xs text-slate-500 mt-1">درصد پاسخ‌های درست به کل</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">مجموع امتیازات اعطا شده</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400 mt-3">
            {(stats?.totalCorrectAcrossBot || 0) * 10}
          </div>
          <div className="text-xs text-slate-500 mt-1">۱۰ امتیاز به ازای هر پاسخ صحیح</div>
        </div>
      </div>

      {/* Main Grid: Simulator & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left/Main Column: Leaderboard & User Records (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  جدول رتبه‌بندی نخبگان و شرکت‌کنندگان ربات
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  لیست شرکت‌کنندگان به ترتیب بیشترین امتیاز و بالاترین درصد قبولی
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="جستجو بر اساس نام یا آیدی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 font-bold border-b border-slate-700">
                    <th className="py-3 px-3">رتبه</th>
                    <th className="py-3 px-3">کاربر</th>
                    <th className="py-3 px-3 text-center">امتیاز</th>
                    <th className="py-3 px-3 text-center">پاسخ‌ها</th>
                    <th className="py-3 px-3 text-center">دقت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        {loading ? (
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                            در حال دریافت اطلاعات...
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p>هیچ کاربری در آزمون‌ها شرکت نکرده است.</p>
                            <p className="text-slate-400 text-xs">
                              از بخش شبیه‌ساز روبرو می‌توانید آزمون تستی بزنید یا در ربات تلگرام آزمون دهید.
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLeaderboard.map((u) => {
                      const medal =
                        u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : u.rank === 3 ? "🥉" : `#${u.rank}`;
                      return (
                        <tr
                          key={u.userId}
                          className="hover:bg-slate-800/50 transition cursor-pointer"
                          onClick={() => handleInspectUser(u.userId)}
                        >
                          <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                            <span className="text-base">{medal}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">{u.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.username}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-amber-400 whitespace-nowrap">
                            {u.totalScore} ⭐️
                          </td>
                          <td className="py-3 px-3 text-center text-slate-300 whitespace-nowrap">
                            <span className="text-emerald-400 font-semibold">{u.correctCount}</span>
                            {" / "}
                            <span className="text-slate-400">{u.totalAnswered}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                u.accuracy >= 80
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : u.accuracy >= 50
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              }`}
                            >
                              {u.accuracy}٪
                            </span>
                          </td>
                          <td className="py-3 px-3 text-left">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleInspectUser(u.userId)}
                                title="مشاهده ریز کارنامه"
                                className="p-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/40 transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleResetUser(u.userId)}
                                title="بازنشانی کاربر"
                                className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/30 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            {filteredLeaderboard.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800">
                <span>نمایش {filteredLeaderboard.length} کاربر ثبت‌شده</span>
                <button
                  onClick={handleResetAllUsers}
                  className="text-rose-400 hover:text-rose-300 transition text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  پاکسازی کامل تمام کارنامه‌ها
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Telegram In-Bot Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                شبیه‌ساز زنده آزمون در تلگرام (دکمه‌های شیشه‌ای)
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              دقیقاً عملکرد پیام و دکمه‌های شیشه‌ای ربات تلگرام را تست کنید. با کلیک روی هر گزینه، امتیاز، وضعیت صحیح/غلط و تحلیل تشریحی بلافاصله ثبت می‌شود:
            </p>

            {/* Day Selector */}
            <div className="flex items-center justify-between gap-3 mb-4 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <span className="text-xs font-bold text-slate-300">انتخاب روز آزمون:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = Math.max(1, simDay - 1);
                    setSimDay(next);
                    setSimResult(null);
                    setSimSelectedOption(null);
                  }}
                  disabled={simDay <= 1}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-indigo-300 font-mono px-2 py-1 bg-indigo-950 rounded border border-indigo-800/50">
                  روز {simDay} از ۹۰
                </span>
                <button
                  onClick={() => {
                    const next = Math.min(90, simDay + 1);
                    setSimDay(next);
                    setSimResult(null);
                    setSimSelectedOption(null);
                  }}
                  disabled={simDay >= 90}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Telegram Message Simulation Container */}
            <div className="bg-[#17212b] border border-[#232e3c] rounded-2xl p-4 shadow-inner text-white font-sans text-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-[#232e3c] pb-2 text-[11px] text-[#708499]">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
                  🤖
                </div>
                <div>
                  <span className="font-bold text-white">ربات آموزش و آزمون حسابداری</span>
                  <span className="text-[10px] text-emerald-400 mr-2">bot</span>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-2 text-slate-200 leading-relaxed">
                <div className="font-bold text-amber-300 text-sm">
                  🏆 آزمون تستی روز شماره {simDay}
                </div>
                <div className="text-slate-400 text-[11px]">
                  📚 سرفصل روز {simDay} از دوره سه ماهه صفر تا صد
                </div>
                <div className="p-3 rounded-xl bg-[#232e3c]/60 border border-[#2b3a4a] text-slate-100 font-medium">
                  {simDay === 1
                    ? "در صورتی که شرکتی بابت خرید مواد اولیه به ارزش ۲۰۰ میلیون ریال، ۵۰ میلیون نقد بپردازد و مابقی را تعهد نماید، معادله اساسی حسابداری چگونه تغییر می‌کند؟"
                    : simDay === 2
                    ? "در ثبت سند هزینه حقوق فروردین‌ماه، حق بیمه سهم کارگر (۷٪) در کدام سمت سند و تحت چه عنوانی ثبت می‌شود؟"
                    : simDay === 3
                    ? "طبق قانون مالیات بر ارزش افزوده و پایانه‌های فروشگاهی ایران، نرخ ارزش افزوده استاندارد و مهلت تایید فاکتور در کارپوشه چند روز است؟"
                    : `صورت سوال تستی استاندارد روز ${simDay} دوره حسابداری ایران`}
                </div>
              </div>

              {/* Result Banner if submitted */}
              {simResult && (
                <div
                  className={`p-3 rounded-xl border ${
                    simResult.isCorrect
                      ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-200"
                      : "bg-rose-950/50 border-rose-700/60 text-rose-200"
                  }`}
                >
                  <div className="font-bold flex items-center gap-2 text-xs">
                    {simResult.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ✅ آفرین! پاسخ شما کاملاً صحیح است (+۱۰ امتیاز)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400" />
                        ❌ متاسفانه پاسخ شما نادرست بود (گزینه {simResult.correctOptionIndex + 1} صحیح است)
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-300 leading-relaxed border-t border-slate-700/40 pt-2">
                    💡 <b>تحلیل تشریحی و استناد قانونی:</b>
                    <br />
                    {simResult.explanation}
                  </p>
                </div>
              )}

              {/* Telegram Inline Keyboard (دکمه‌های شیشه‌ای رنگی با بکگراند شیشه‌ای) */}
              <div className="space-y-2 pt-2">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>{simResult ? "عملیات شیشه‌ای پس از پاسخ:" : "👇 دکمه‌های شیشه‌ای پاسخ به سوال:"}</span>
                  <span className="text-[9px] text-indigo-300 font-mono">Inline Glass Buttons</span>
                </div>

                {!simResult ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { idx: 0, text: "🔵 ۱) گزینه یک", bg: "bg-gradient-to-r from-sky-900/70 to-blue-800/80 border-sky-500/40 text-sky-100 hover:from-sky-800 hover:to-blue-700" },
                      { idx: 1, text: "🟢 ۲) گزینه دو", bg: "bg-gradient-to-r from-emerald-900/70 to-teal-800/80 border-emerald-500/40 text-emerald-100 hover:from-emerald-800 hover:to-teal-700" },
                      { idx: 2, text: "🟡 ۳) گزینه سه", bg: "bg-gradient-to-r from-amber-900/70 to-orange-900/80 border-amber-500/40 text-amber-100 hover:from-amber-800 hover:to-orange-700" },
                      { idx: 3, text: "🟣 ۴) گزینه چهار", bg: "bg-gradient-to-r from-purple-900/70 to-indigo-900/80 border-purple-500/40 text-purple-100 hover:from-purple-800 hover:to-indigo-700" },
                    ].map((btn) => (
                      <button
                        key={btn.idx}
                        disabled={simSubmitting}
                        onClick={() => handleSimulateAnswer(btn.idx)}
                        className={`py-2.5 px-3 rounded-xl font-medium text-xs text-center transition shadow-lg backdrop-blur-md border active:scale-95 active:brightness-110 flex items-center justify-center gap-1.5 ${btn.bg}`}
                      >
                        <span>{btn.text}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const next = Math.max(1, simDay - 1);
                          setSimDay(next);
                          setSimResult(null);
                          setSimSelectedOption(null);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-700/80 hover:from-slate-700 hover:to-slate-600 text-slate-100 font-medium text-xs text-center transition border border-slate-600/50 shadow"
                      >
                        ⬅️ روز قبلی ({simDay - 1})
                      </button>
                      <button
                        onClick={() => {
                          const next = Math.min(90, simDay + 1);
                          setSimDay(next);
                          setSimResult(null);
                          setSimSelectedOption(null);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-700/80 hover:from-slate-700 hover:to-slate-600 text-slate-100 font-medium text-xs text-center transition border border-slate-600/50 shadow"
                      >
                        ➡️ روز بعدی ({simDay + 1})
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSimResult(null);
                          setSimSelectedOption(null);
                        }}
                        className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-950/70 to-orange-950/80 hover:from-amber-900 hover:to-orange-900 text-amber-200 font-medium text-xs text-center transition border border-amber-600/40 shadow"
                      >
                        🔄 حل مجدد همین آزمون
                      </button>
                      <button
                        onClick={() => {
                          alert(`کارنامه شما: ${simResult?.isCorrect ? "۱۰" : "۰"} امتیاز ثبت شده.`);
                        }}
                        className="py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-950/70 to-teal-950/80 hover:from-emerald-900 hover:to-teal-900 text-emerald-200 font-medium text-xs text-center transition border border-emerald-600/40 shadow"
                      >
                        🏆 کارنامه و رتبه من
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Persistent Chat Bar & Bottom Menu Simulation (مربع منو پایین چت تلگرام) */}
              <div className="pt-3 border-t border-[#232e3c] space-y-2">
                <div className="flex items-center justify-between text-[10px] text-[#708499]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    <span>مربع منو و کیبورد همیشگی نوار چت تلگرام</span>
                  </span>
                  <span className="text-[9px] bg-[#232e3c] px-1.5 py-0.5 rounded text-slate-300 font-mono">
                    Persistent Keyboard
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-[#0e1621] border border-[#232e3c]">
                  <button
                    onClick={() => {
                      setSimDay(1);
                      setSimResult(null);
                      setSimSelectedOption(null);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-[#242f3d] hover:bg-[#2b3a4a] text-slate-200 text-[11px] font-medium transition text-center shadow-sm border border-[#2c3b4e] active:scale-95"
                  >
                    📝 آزمون تستی امروز
                  </button>
                  <button
                    onClick={() => {
                      if (selectedUserDetail) {
                        alert(`کارنامه کاربر ${selectedUserDetail.firstName}: امتیاز ${selectedUserDetail.totalScore}`);
                      } else {
                        alert("کارنامه: امتیاز کل شما ۱۰ امتیاز است.");
                      }
                    }}
                    className="py-1.5 px-2 rounded-lg bg-[#242f3d] hover:bg-[#2b3a4a] text-slate-200 text-[11px] font-medium transition text-center shadow-sm border border-[#2c3b4e] active:scale-95"
                  >
                    🏆 کارنامه و رتبه من
                  </button>
                  <button
                    onClick={() => {
                      setSimDay(1);
                      setSimResult(null);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-[#242f3d] hover:bg-[#2b3a4a] text-slate-200 text-[11px] font-medium transition text-center shadow-sm border border-[#2c3b4e] active:scale-95"
                  >
                    📚 بانک ۹۰ آزمون دوره
                  </button>
                  <button
                    onClick={() => {
                      alert("جدول نخبگان: مشاهده ۱۰ رتبه برتر کانال");
                    }}
                    className="py-1.5 px-2 rounded-lg bg-[#242f3d] hover:bg-[#2b3a4a] text-slate-200 text-[11px] font-medium transition text-center shadow-sm border border-[#2c3b4e] active:scale-95"
                  >
                    🥇 جدول نخبگان
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-indigo-400">کارنامه اختصاصی دانش‌پذیر</div>
                <h3 className="text-xl font-black text-white mt-1">
                  {selectedUserDetail.firstName} {selectedUserDetail.lastName || ""}
                </h3>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  آیدی تلگرام: {selectedUserDetail.userId} {selectedUserDetail.username ? `(@${selectedUserDetail.username})` : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Scorecard KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400">امتیاز کل</div>
                  <div className="text-xl font-black text-amber-400 mt-1">{selectedUserDetail.totalScore}</div>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400">رتبه در کانال</div>
                  <div className="text-xl font-black text-indigo-400 mt-1">رتبه {selectedUserDetail.rank}</div>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400">درصد دقت</div>
                  <div className="text-xl font-black text-emerald-400 mt-1">{selectedUserDetail.accuracy}٪</div>
                </div>
              </div>

              {/* Answers History */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  ریز پاسخ‌های ثبت‌شده به آزمون‌های روزانه
                </h4>

                {Object.keys(selectedUserDetail.answers || {}).length === 0 ? (
                  <div className="p-6 bg-slate-800/40 rounded-xl text-center text-xs text-slate-500">
                    هنوز پاسخی توسط این کاربر ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(Object.values(selectedUserDetail.answers) as Array<UserDetailRecord["answers"][string]>)
                      .sort((a, b) => a.dayNumber - b.dayNumber)
                      .map((ans) => (
                        <div
                          key={ans.dayNumber}
                          className={`p-3.5 rounded-xl border text-xs ${
                            ans.isCorrect
                              ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-200"
                              : "bg-rose-950/30 border-rose-800/40 text-rose-200"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                              {ans.isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400" />
                              )}
                              آزمون روز {ans.dayNumber}: {ans.isCorrect ? "پاسخ صحیح (+۱۰ امتیاز)" : "پاسخ نادرست"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(ans.answeredAt).toLocaleDateString("fa-IR")}
                            </span>
                          </div>
                          <div className="text-slate-300 text-[11px] mt-2 leading-relaxed">
                            {ans.question}
                          </div>
                          <div className="text-[11px] mt-2 pt-2 border-t border-slate-700/40 flex items-center gap-3 text-slate-400">
                            <span>گزینه انتخابی: {ans.selectedOptionIndex + 1}</span>
                            <span>گزینه صحیح: {ans.correctOptionIndex + 1}</span>
                            <span>تعداد تلاش: {ans.attempts || 1}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                onClick={() => handleResetUser(selectedUserDetail.userId)}
                className="px-4 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                بازنشانی کارنامه این کاربر
              </button>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
