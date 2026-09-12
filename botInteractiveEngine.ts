import fs from "fs";
import path from "path";
import { getOrCreateDayItem, initialThreeMonthCurriculum } from "./src/data/threeMonthCurriculum";
import { initialDailyQuizzes } from "./src/data/quizData";
import { practicalJournalScenarios, JournalScenario, JournalArticle, getJournalScenario } from "./src/data/journalScenarios";
import { loadServerBotConfig, saveServerBotConfig, sanitizeValue } from "./serverBotConfig";
import { getSchedulerStatus, updateSchedulerConfig, executeSlot } from "./serverScheduler";

export interface TelegramQuizAnswer {
  quizId: string;
  dayNumber: number;
  question: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
  answeredAt: string;
  attempts: number;
}

export interface TelegramJournalAnswer {
  scenarioId: string;
  isCorrect: boolean;
  score: number;
  answeredAt: string;
}

export interface TelegramBotUser {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  firstSeenAt: string;
  lastActiveAt: string;
  totalScore: number; // 10 points per quiz + 20 points per journal entry
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  streakDays: number;
  answers: Record<string, TelegramQuizAnswer>; // key: dayNumber as string
  journalAnswers?: Record<string, TelegramJournalAnswer>; // key: scenarioId as string
}

export interface UserSessionState {
  mode: "none" | "awaiting_feedback" | "journal_active" | "admin_replying";
  scenarioId?: string;
  draftArticles?: { accountName: string; side: "debit" | "credit"; amount: number }[];
  replyToUserId?: number;
  lastUpdated: number;
}

export const userSessionStates = new Map<number, UserSessionState>();


export interface BotUserDatabase {
  users: Record<string, TelegramBotUser>; // key: userId as string
  lastUpdated: string;
}

const DB_PATH = path.join(process.cwd(), "users-quiz-data.json");
const PERSISTENCE_DIR = path.join(process.cwd(), "data_persistence");
const PERSISTENCE_DB_PATH = path.join(PERSISTENCE_DIR, "users-quiz-data.json");

// Ensure persistence directory exists
try {
  if (!fs.existsSync(PERSISTENCE_DIR)) {
    fs.mkdirSync(PERSISTENCE_DIR, { recursive: true });
  }
} catch (_e) {}

// Load database from disk with persistence recovery
function loadUserDatabase(): BotUserDatabase {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(raw);
    } else if (fs.existsSync(PERSISTENCE_DB_PATH)) {
      const raw = fs.readFileSync(PERSISTENCE_DB_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      fs.writeFileSync(DB_PATH, raw, "utf-8");
      console.log("[Persistence] Successfully auto-recovered users-quiz-data.json from data_persistence!");
      return parsed;
    }
  } catch (err) {
    console.warn("Could not read users-quiz-data.json, creating initial:", err);
  }
  return {
    users: {},
    lastUpdated: new Date().toISOString(),
  };
}

// Save database to disk and mirror to persistence directory
function saveUserDatabase(db: BotUserDatabase) {
  try {
    db.lastUpdated = new Date().toISOString();
    const str = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_PATH, str, "utf-8");
    try {
      fs.writeFileSync(PERSISTENCE_DB_PATH, str, "utf-8");
    } catch (_e) {}
  } catch (err) {
    console.error("Failed to save users-quiz-data.json:", err);
  }
}

let dbInstance: BotUserDatabase = loadUserDatabase();

// Helper to check if any admin ID has been configured
export function hasConfiguredAdmin(): boolean {
  const conf = loadServerBotConfig();
  const envAdmin = sanitizeValue(process.env.TELEGRAM_ADMIN_CHAT_ID);
  const confAdmin = sanitizeValue(conf.telegramAdminChatId);
  return envAdmin !== "" || confAdmin !== "";
}

// Check if user is recognized as main administrator with automatic first-user claim
export function isBotAdmin(userIdOrChatId: number | string): boolean {
  const cleanId = sanitizeValue(userIdOrChatId);
  if (!cleanId) return false;
  const conf = loadServerBotConfig();
  const envAdmin = sanitizeValue(process.env.TELEGRAM_ADMIN_CHAT_ID);
  const confAdmin = sanitizeValue(conf.telegramAdminChatId);

  // 1. Direct match with env or config
  if ((envAdmin !== "" && cleanId === envAdmin) || (confAdmin !== "" && cleanId === confAdmin)) {
    return true;
  }

  // 2. Match with comma-separated or space-separated list of admin IDs
  const allAdminIds = [
    ...(envAdmin ? envAdmin.split(/[,;\s]+/) : []),
    ...(confAdmin ? confAdmin.split(/[,;\s]+/) : []),
  ].map((s) => s.trim()).filter(Boolean);

  if (allAdminIds.includes(cleanId)) {
    return true;
  }

  // 3. Auto-claim: If NO admin ID is configured anywhere yet, claim this user as the primary admin
  if (allAdminIds.length === 0) {
    console.log(`[AutoAdmin] No admin configured. Automatically granting and saving primary admin to User ID: ${cleanId}`);
    try {
      process.env.TELEGRAM_ADMIN_CHAT_ID = cleanId;
      saveServerBotConfig({
        ...conf,
        telegramAdminChatId: cleanId,
      });
    } catch (e) {
      console.warn("[AutoAdmin] Could not save auto-claimed admin config:", e);
    }
    return true;
  }

  return false;
}

// Generate snapshot and send full backup file directly to Telegram chat
export async function sendBackupToChat(
  token: string,
  chatId: number | string,
  captionPrefix?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const scheduler = getSchedulerStatus();
    const conf = loadServerBotConfig();
    const backupData = {
      system: "Accounting Bot Iran Platform",
      version: "3.5.0",
      createdAt: new Date().toISOString(),
      shamsiDate: new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "medium" }).format(new Date()),
      config: conf,
      env: {
        PORT: process.env.PORT || 3000,
        TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
        TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
        BALE_CHANNEL_ID: process.env.BALE_CHANNEL_ID,
        BALE_ADMIN_CHAT_ID: process.env.BALE_ADMIN_CHAT_ID,
      },
      scheduler: {
        currentDayNumber: scheduler.currentDayNumber,
        enabled: scheduler.enabled,
        planMode: scheduler.planMode,
        morningTime: scheduler.morningTime,
        noonTime: scheduler.noonTime,
        eveningTime: scheduler.eveningTime,
        lateNightTime: scheduler.lateNightTime,
      },
      usersDatabase: dbInstance,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const fileName = `accounting_bot_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    // Also persist local file in backups directory
    try {
      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, fileName), jsonStr, "utf-8");
    } catch (_e) {}

    const formData = new FormData();
    const blob = new Blob([jsonStr], { type: "application/json" });
    formData.append("chat_id", String(chatId));
    formData.append("document", blob, fileName);
    formData.append(
      "caption",
      `${captionPrefix || "📦"} <b>فایل پشتیبان کامل سیستم حسابداری ایران</b>\n` +
      `📅 تاریخ: ${new Intl.DateTimeFormat("fa-IR").format(new Date())}\n` +
      `👥 کاربران عضو ربات: ${Object.keys(dbInstance.users).length} نفر\n` +
      `📖 روز جاری دوره: روز ${scheduler.currentDayNumber} از ۹۰\n` +
      `⚙️ شامل کلیه تنظیمات، کارنامه‌ها، امتیازات و زمان‌بندی.\n\n` +
      `💡 <b>راهنمای بازگردانی:</b> هر زمان مایل به بازگردانی بودید، کافیست همین فایل را در همین چت برای ربات ارسال (یا فوروارد) فرمایید!`
    );
    formData.append("parse_mode", "HTML");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30000),
    });
    const resData = await res.json();
    return { ok: Boolean(resData.ok), error: resData.description };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// Restore entire system from parsed backup JSON
export async function restoreSystemFromBackup(data: any): Promise<{ ok: boolean; message: string; usersCount: number }> {
  try {
    let usersCount = 0;
    // 1. Restore users database
    if (data.usersDatabase?.users && typeof data.usersDatabase.users === "object") {
      dbInstance = {
        users: data.usersDatabase.users,
        lastUpdated: new Date().toISOString(),
      };
      saveUserDatabase(dbInstance);
      usersCount = Object.keys(dbInstance.users).length;
    } else if (data.users && typeof data.users === "object") {
      dbInstance = {
        users: data.users,
        lastUpdated: new Date().toISOString(),
      };
      saveUserDatabase(dbInstance);
      usersCount = Object.keys(dbInstance.users).length;
    }

    // 2. Restore bot config
    if (data.config && typeof data.config === "object") {
      saveServerBotConfig(data.config);
    }

    // 3. Restore scheduler day number
    if (data.scheduler?.currentDayNumber) {
      updateSchedulerConfig({ currentDayNumber: data.scheduler.currentDayNumber });
    }

    // 4. Save a copy to backups folder
    try {
      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, `restored_${Date.now()}.json`), JSON.stringify(data, null, 2), "utf-8");
    } catch (_e) {}

    return {
      ok: true,
      message: `بازگردانی با موفقیت انجام شد. اطلاعات ${usersCount} کاربر، کارنامه‌ها و تنظیمات کانال با موفقیت بازیابی شدند.`,
      usersCount,
    };
  } catch (e: any) {
    return { ok: false, message: e.message || "خطا در پردازش فایل پشتیبان", usersCount: 0 };
  }
}

// In-memory helper to get or create a user
export function getOrCreateBotUser(
  userId: number,
  userInfo?: { firstName?: string; lastName?: string; username?: string }
): TelegramBotUser {
  const key = String(userId);
  if (!dbInstance.users[key]) {
    dbInstance.users[key] = {
      userId,
      firstName: userInfo?.firstName || "کاربر ناشناس",
      lastName: userInfo?.lastName || "",
      username: userInfo?.username || "",
      firstSeenAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      totalScore: 0,
      totalAnswered: 0,
      correctCount: 0,
      wrongCount: 0,
      streakDays: 1,
      answers: {},
    };
    saveUserDatabase(dbInstance);
  } else {
    let changed = false;
    if (userInfo?.firstName && dbInstance.users[key].firstName !== userInfo.firstName) {
      dbInstance.users[key].firstName = userInfo.firstName;
      changed = true;
    }
    if (userInfo?.lastName && dbInstance.users[key].lastName !== userInfo.lastName) {
      dbInstance.users[key].lastName = userInfo.lastName;
      changed = true;
    }
    if (userInfo?.username && dbInstance.users[key].username !== userInfo.username) {
      dbInstance.users[key].username = userInfo.username;
      changed = true;
    }
    dbInstance.users[key].lastActiveAt = new Date().toISOString();
    if (changed) {
      saveUserDatabase(dbInstance);
    }
  }
  return dbInstance.users[key];
}

// Record a user's answer to a quiz
export function recordQuizAnswer(
  userId: number,
  dayNumber: number,
  selectedOptionIndex: number,
  userInfo?: { firstName?: string; lastName?: string; username?: string }
): {
  user: TelegramBotUser;
  isCorrect: boolean;
  correctOptionIndex: number;
  explanation: string;
  pointsEarned: number;
  isFirstAttempt: boolean;
} {
  const user = getOrCreateBotUser(userId, userInfo);
  const dayItem = getOrCreateDayItem(dayNumber, initialThreeMonthCurriculum);
  const eveningPost = dayItem.posts.find((p) => p.slotTitle.includes("شب") || p.quizQuestion) || dayItem.posts[2];

  const question = eveningPost?.quizQuestion || "سوال آزمون روز";
  const options = eveningPost?.quizOptions || ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"];
  const correctOptionIndex = typeof eveningPost?.correctOptionIndex === "number" ? eveningPost.correctOptionIndex : 0;
  const explanation = eveningPost?.explanation || "توضیحات تشریحی و استناد قانونی ثبت شده است.";

  const isCorrect = selectedOptionIndex === correctOptionIndex;
  const key = String(dayNumber);
  const existingAnswer = user.answers[key];
  const isFirstAttempt = !existingAnswer;

  let pointsEarned = 0;

  if (isFirstAttempt) {
    user.totalAnswered += 1;
    if (isCorrect) {
      user.correctCount += 1;
      pointsEarned = 10;
      user.totalScore += pointsEarned;
    } else {
      user.wrongCount += 1;
    }
  } else {
    // If updating previous wrong answer to correct
    if (!existingAnswer.isCorrect && isCorrect) {
      user.wrongCount = Math.max(0, user.wrongCount - 1);
      user.correctCount += 1;
      pointsEarned = 10;
      user.totalScore += pointsEarned;
    }
  }

  user.answers[key] = {
    quizId: `quiz-day-${dayNumber}`,
    dayNumber,
    question,
    selectedOptionIndex,
    correctOptionIndex,
    isCorrect,
    answeredAt: new Date().toISOString(),
    attempts: (existingAnswer?.attempts || 0) + 1,
  };

  user.lastActiveAt = new Date().toISOString();
  saveUserDatabase(dbInstance);

  return {
    user,
    isCorrect,
    correctOptionIndex,
    explanation,
    pointsEarned,
    isFirstAttempt,
  };
}

// Get all users summary / leaderboard
export function getAllBotUsersStats() {
  const userList = Object.values(dbInstance.users);
  const sorted = [...userList].sort((a, b) => b.totalScore - a.totalScore || b.correctCount - a.correctCount);

  const totalUsers = sorted.length;
  const totalAnswersAcrossBot = sorted.reduce((sum, u) => sum + u.totalAnswered, 0);
  const totalCorrectAcrossBot = sorted.reduce((sum, u) => sum + u.correctCount, 0);
  const averageAccuracy = totalAnswersAcrossBot > 0 ? Math.round((totalCorrectAcrossBot / totalAnswersAcrossBot) * 100) : 0;

  return {
    totalUsers,
    totalAnswersAcrossBot,
    totalCorrectAcrossBot,
    averageAccuracy,
    leaderboard: sorted.slice(0, 50).map((u, index) => ({
      rank: index + 1,
      userId: u.userId,
      name: `${u.firstName} ${u.lastName || ""}`.trim(),
      username: u.username ? `@${u.username}` : "بدون یوزرنیم",
      totalScore: u.totalScore,
      totalAnswered: u.totalAnswered,
      correctCount: u.correctCount,
      wrongCount: u.wrongCount,
      accuracy: u.totalAnswered > 0 ? Math.round((u.correctCount / u.totalAnswered) * 100) : 0,
      streakDays: u.streakDays,
      lastActiveAt: u.lastActiveAt,
    })),
  };
}

// Get specific user details with rank
export function getUserDetails(userId: number) {
  const user = dbInstance.users[String(userId)];
  if (!user) return null;

  const userList = Object.values(dbInstance.users);
  const sorted = [...userList].sort((a, b) => b.totalScore - a.totalScore || b.correctCount - a.correctCount);
  const rank = sorted.findIndex((u) => u.userId === userId) + 1;

  return {
    ...user,
    rank: rank || 1,
    accuracy: user.totalAnswered > 0 ? Math.round((user.correctCount / user.totalAnswered) * 100) : 0,
  };
}

// Reset specific user data
export function resetBotUser(userId: number) {
  const key = String(userId);
  if (dbInstance.users[key]) {
    dbInstance.users[key].totalScore = 0;
    dbInstance.users[key].totalAnswered = 0;
    dbInstance.users[key].correctCount = 0;
    dbInstance.users[key].wrongCount = 0;
    dbInstance.users[key].answers = {};
    saveUserDatabase(dbInstance);
    return true;
  }
  return false;
}

// Reset entire database
export function resetAllBotUsers() {
  dbInstance = {
    users: {},
    lastUpdated: new Date().toISOString(),
  };
  saveUserDatabase(dbInstance);
  return true;
}

// ---------------------------------------------------------------------------
// TELEGRAM MESSAGE FORMATTERS & INLINE KEYBOARDS
// ---------------------------------------------------------------------------

// Format Quiz Message for a specific day
export function formatQuizMessage(dayNumber: number, user?: TelegramBotUser) {
  const dayItem = getOrCreateDayItem(dayNumber, initialThreeMonthCurriculum);
  const eveningPost = dayItem.posts.find((p) => p.slotTitle.includes("شب") || p.quizQuestion) || dayItem.posts[2];
  const noonPost = dayItem.posts.find((p) => p.slotTitle.includes("ظهر") || p.practicalExample) || dayItem.posts[1];

  const question = eveningPost?.quizQuestion || "سوال آزمون روز یافت نشد.";
  const options = eveningPost?.quizOptions || ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"];
  const category = dayItem.category || "مفاهیم پایه حسابداری";

  const userAnswer = user?.answers[String(dayNumber)];

  let text = `🏆 <b>آزمون تستی روز شماره ${dayNumber}</b>\n`;
  text += `📚 <b>سرفصل:</b> ${dayItem.title}\n`;
  text += `🏷 <b>دسته:</b> ${category}\n\n`;
  text += `❓ <b>صورت سوال:</b>\n${question}\n\n`;

  const colorMarkers = ["🔵", "🟢", "🟡", "🟣"];
  options.forEach((opt, idx) => {
    let mark = "";
    if (userAnswer) {
      if (idx === userAnswer.correctOptionIndex) {
        mark = " ✅ <b>(پاسخ صحیح)</b>";
      } else if (idx === userAnswer.selectedOptionIndex && !userAnswer.isCorrect) {
        mark = " ❌ <b>(انتخاب شما)</b>";
      }
    }
    text += `${colorMarkers[idx] || "🔹"} ${opt}${mark}\n`;
  });

  if (userAnswer) {
    text += `\n━━━━━━━━━━━━━━━\n`;
    if (userAnswer.isCorrect) {
      text += `🎯 <b>وضعیت:</b> ✅ <b>پاسخ شما کاملاً صحیح بود (+۱۰ امتیاز)</b>\n`;
    } else {
      text += `🎯 <b>وضعیت:</b> ❌ <b>پاسخ شما نادرست بود (گزینه ${userAnswer.correctOptionIndex + 1} صحیح است)</b>\n`;
    }
    if (eveningPost?.explanation) {
      text += `💡 <b>تحلیل تشریحی و استناد قانونی:</b>\n<blockquote>${eveningPost.explanation}</blockquote>\n`;
    }
    if (noonPost?.practicalExample) {
      text += `\n📑 <b>سند حسابداری و آرتیکل دوبل این مبحث:</b>\n<blockquote>${noonPost.practicalExample}</blockquote>\n`;
    }
    text += `\n⭐️ <b>امتیاز کل شما:</b> ${user?.totalScore || 0} | 📊 <b>آزمون‌های حل‌شده:</b> ${user?.correctCount || 0} از ${user?.totalAnswered || 0}`;
  } else {
    text += `\n👇 <b>لطفاً یکی از گزینه‌های شیشه‌ای زیر را لمس کنید:</b>`;
  }

  // Inline Keyboard Buttons
  const inlineKeyboard: any[][] = [];

  if (!userAnswer) {
    // 4 option buttons ONLY with clean layout
    inlineKeyboard.push([
      { text: `1️⃣ گزینه ۱`, callback_data: `q_ans:${dayNumber}:0`, style: "primary" },
      { text: `2️⃣ گزینه ۲`, callback_data: `q_ans:${dayNumber}:1`, style: "primary" },
    ]);
    inlineKeyboard.push([
      { text: `3️⃣ گزینه ۳`, callback_data: `q_ans:${dayNumber}:2`, style: "primary" },
      { text: `4️⃣ گزینه ۴`, callback_data: `q_ans:${dayNumber}:3`, style: "primary" },
    ]);
  } else {
    // Navigation & Review Buttons after answering
    const navRow = [];
    if (dayNumber > 1) {
      navRow.push({ text: `⬅️ آزمون روز قبل (${dayNumber - 1})`, callback_data: `q_show:${dayNumber - 1}`, style: "primary" });
    }
    if (dayNumber < 90) {
      navRow.push({ text: `آزمون روز بعد (${dayNumber + 1}) ➡️`, callback_data: `q_show:${dayNumber + 1}`, style: "primary" });
    }
    if (navRow.length > 0) inlineKeyboard.push(navRow);

    inlineKeyboard.push([
      { text: `🔄 حل مجدد همین آزمون 🔁`, callback_data: `q_retake:${dayNumber}`, style: "danger" },
      { text: `📖 مطالعه درس روز ${dayNumber} ☀️`, callback_data: `q_lesson:${dayNumber}`, style: "primary" },
    ]);
  }

  // Quick navigation row
  inlineKeyboard.push([
    { text: `📚 بانک ۹۰ آزمون تستی ⚡️`, callback_data: `q_page:1`, style: "primary" },
    { text: `📑 کارگاه ۹۰ سند حسابداری ✍️`, callback_data: `sanad_page:1`, style: "success" },
  ]);
  inlineKeyboard.push([
    { text: `🏆 کارنامه و رتبه من ⭐️`, callback_data: `my_stats`, style: "success" },
    { text: `🥇 جدول نخبگان 💎`, callback_data: `leaderboard`, style: "primary" },
  ]);
  inlineKeyboard.push([
    { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
  ]);

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format Daily Journal Entry & Accounting Voucher Message (سند حسابداری روزانه)
export function formatDailySanadMessage(dayNumber: number, user?: TelegramBotUser) {
  const dayItem = getOrCreateDayItem(dayNumber, initialThreeMonthCurriculum);
  const noonPost = dayItem.posts.find((p) => p.slotTitle.includes("ظهر") || p.practicalExample) || dayItem.posts[1];
  const morningPost = dayItem.posts[0];

  let text = `📑 <b>سند حسابداری و ثبت دوبل استاندارد (روز شماره ${dayNumber})</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📚 <b>سرفصل آموزشی:</b> ${dayItem.title}\n`;
  text += `🏷 <b>دسته:</b> ${dayItem.category || "حسابداری و مالیات"}\n\n`;

  text += `📖 <b>شرح رویداد مالی و سناریوی بازار کار:</b>\n<blockquote>${noonPost?.content || dayItem.summary}</blockquote>\n\n`;

  if (noonPost?.practicalExample) {
    text += `📜 <b>ثبت سند حسابداری دوبل در دفاتر قانونی:</b>\n<blockquote>${noonPost.practicalExample}</blockquote>\n\n`;
  }

  if (morningPost?.keyRule) {
    text += `💡 <b>نکته طلایی و استاندارد مربوطه:</b>\n<blockquote>${morningPost.keyRule}</blockquote>\n\n`;
  }

  text += `👇 برای سنجش یادگیری خود، در آزمون تستی همین روز شرکت کنید یا وارد کارگاه عملی ۹۰ سناریو شوید:`;

  const inlineKeyboard: any[][] = [];

  // Direct action buttons
  inlineKeyboard.push([
    { text: `📝 شرکت در آزمون تستی روز ${dayNumber} 🎯`, callback_data: `q_show:${dayNumber}`, style: "success" },
  ]);
  inlineKeyboard.push([
    { text: `✍️ ورود به کارگاه ۹۰ سند حسابداری 📑`, callback_data: `sanad_page:1`, style: "success" },
    { text: `📖 مطالعه کامل درس روز ${dayNumber} ☀️`, callback_data: `q_lesson:${dayNumber}`, style: "primary" },
  ]);

  // Sanad navigation row
  const navRow: any[] = [];
  if (dayNumber > 1) {
    navRow.push({ text: `⬅️ سند روز ${dayNumber - 1}`, callback_data: `q_sanad:${dayNumber - 1}`, style: "primary" });
  }
  if (dayNumber < 90) {
    navRow.push({ text: `سند روز ${dayNumber + 1} ➡️`, callback_data: `q_sanad:${dayNumber + 1}`, style: "primary" });
  }
  if (navRow.length > 0) inlineKeyboard.push(navRow);

  inlineKeyboard.push([
    { text: `📚 بانک ۹۰ آزمون ⚡️`, callback_data: `q_page:1`, style: "primary" },
    { text: `🏆 کارنامه من ⭐️`, callback_data: `my_stats`, style: "success" },
  ]);
  inlineKeyboard.push([
    { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
  ]);

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Persistent Reply Keyboard for Telegram Chat Bar (منوی زیر کادر چت با دسترسی آسان به ثبت سند و انتقادات)
export const BOT_PERSISTENT_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: "📝 آزمون تستی امروز" }, { text: "📑 کارگاه ثبت سند دستی ✍️" }],
    [{ text: "📚 بانک ۹۰ آزمون دوره" }, { text: "🏆 کارنامه و رتبه من" }],
    [{ text: "📖 درس و آموزش امروز" }, { text: "📩 انتقاد، پیشنهاد و نظرات" }],
    [{ text: "🥇 جدول نخبگان" }, { text: "❓ راهنما و دستورات" }],
  ],
  resize_keyboard: true,
  is_persistent: false,
  one_time_keyboard: true,
};

// Return persistent reply keyboard customized for role (shows Admin & Backup buttons for admin)
export function getPersistentKeyboardForUser(userIdOrChatId: number | string) {
  if (isBotAdmin(userIdOrChatId)) {
    return {
      keyboard: [
        [{ text: "📝 آزمون تستی امروز" }, { text: "📑 کارگاه ثبت سند دستی ✍️" }],
        [{ text: "📚 بانک ۹۰ آزمون دوره" }, { text: "🏆 کارنامه و رتبه من" }],
        [{ text: "📖 درس و آموزش امروز" }, { text: "📩 انتقاد، پیشنهاد و نظرات" }],
        [{ text: "👑 پنل مدیریت ادمین ⚙️" }, { text: "📦 دریافت آنی بکاپ 💾" }],
        [{ text: "🏠 منوی اصلی ربات" }, { text: "❓ راهنما و دستورات" }],
      ],
      resize_keyboard: true,
      is_persistent: false,
      one_time_keyboard: true,
    };
  }
  return BOT_PERSISTENT_REPLY_KEYBOARD;
}

// Initialize Telegram Bot Commands and Chat Menu Button
export async function initializeBotCommands(token: string) {
  try {
    // 1. Delete webhook to ensure getUpdates is unblocked and conflict-free
    try {
      await callTelegramApi(token, "deleteWebhook", { drop_pending_updates: false });
    } catch (delErr) {
      console.warn("deleteWebhook warning:", delErr);
    }

    // 2. Register bot commands
    await callTelegramApi(token, "setMyCommands", {
      commands: [
        { command: "start", description: "🏠 منوی اصلی و شروع ربات" },
        { command: "sanad", description: "📑 کارگاه عملی ثبت سند دستی" },
        { command: "quiz", description: "📝 آزمون تستی روز جاری" },
        { command: "bank", description: "📚 بانک ۹۰ آزمون دوره" },
        { command: "karname", description: "🏆 کارنامه، امتیاز و رتبه من" },
        { command: "rank", description: "🥇 جدول رتبه‌بندی نخبگان" },
        { command: "lesson", description: "📖 درس و سرفصل آموزشی امروز" },
        { command: "feedback", description: "📩 ارسال انتقاد، نظر یا پیشنهاد به ادمین" },
        { command: "admin", description: "👑 پنل مدیریت و دریافت بکاپ" },
        { command: "backup", description: "📦 دریافت فایل پشتیبان سیستم" },
        { command: "help", description: "❓ راهنما و دستورات" },
      ],
    });

    // 3. Register persistent chat bar Menu button (square/pill button next to message field)
    await callTelegramApi(token, "setChatMenuButton", {
      menu_button: { type: "commands" },
    });

    // 4. Cache connected bot details
    const meRes = await callTelegramApi(token, "getMe", {});
    if (meRes.ok && meRes.result?.username) {
      botUsername = meRes.result.username;
      console.log(`✅ Telegram Bot Connected: @${botUsername} (${meRes.result.first_name}) - Commands & Menu button registered!`);
    }

    return { ok: true, username: botUsername };
  } catch (err: any) {
    console.warn("Failed to set Telegram bot commands:", err);
    return { ok: false, error: err.message };
  }
}

// Format Paginated Quizzes Directory
export function formatQuizPageMessage(pageNum: number, user?: TelegramBotUser) {
  const pageSize = 10;
  const totalDays = 90;
  const totalPages = Math.ceil(totalDays / pageSize);
  const currentPage = Math.max(1, Math.min(totalPages, pageNum));
  const startDay = (currentPage - 1) * pageSize + 1;
  const endDay = Math.min(totalDays, startDay + pageSize - 1);

  let text = `📚 <b>بانک ۹۰ روز آزمون‌های تخصصی حسابداری ایران</b>\n`;
  text += `صفحه ${currentPage} از ${totalPages} (روزهای ${startDay} تا ${endDay})\n\n`;
  text += `💡 روی شماره هر روز کلیک کنید تا سوال تستی همان روز با دکمه شیشه‌ای باز شود:\n`;
  text += `راهنما: 🟢 حل‌شده صحیح | 🔴 پاسخ اشتباه | 🔵 حل‌نشده\n\n`;

  const inlineKeyboard: any[][] = [];
  let currentRow: any[] = [];

  for (let d = startDay; d <= endDay; d++) {
    const ans = user?.answers[String(d)];
    let statusIcon = "⚪️";
    let btnStyle: "primary" | "success" | "danger" = "primary";
    if (ans) {
      if (ans.isCorrect) {
        statusIcon = "✅";
        btnStyle = "success";
      } else {
        statusIcon = "❌";
        btnStyle = "danger";
      }
    }
    currentRow.push({
      text: `${statusIcon} روز ${d}`,
      callback_data: `q_show:${d}`,
      style: btnStyle,
    });

    if (currentRow.length === 2) {
      inlineKeyboard.push(currentRow);
      currentRow = [];
    }
  }
  if (currentRow.length > 0) {
    inlineKeyboard.push(currentRow);
  }

  // Pagination navigation row
  const paginationRow: any[] = [];
  if (currentPage > 1) {
    paginationRow.push({ text: `⬅️ صفحه قبل`, callback_data: `q_page:${currentPage - 1}`, style: "primary" });
  }
  paginationRow.push({ text: `📄 ص ${currentPage}/${totalPages}`, callback_data: `noop` });
  if (currentPage < totalPages) {
    paginationRow.push({ text: `صفحه بعد ➡️`, callback_data: `q_page:${currentPage + 1}`, style: "primary" });
  }
  inlineKeyboard.push(paginationRow);

  // Bottom action buttons with color styles
  inlineKeyboard.push([
    { text: `📝 آزمون امروز 🎯`, callback_data: `q_today`, style: "success" },
    { text: `🏆 کارنامه من ⭐️`, callback_data: `my_stats`, style: "success" },
  ]);
  inlineKeyboard.push([
    { text: `🥇 جدول نخبگان 💎`, callback_data: `leaderboard`, style: "primary" },
    { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
  ]);

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format User Performance Card Message
export function formatUserStatsMessage(user: TelegramBotUser) {
  const details = getUserDetails(user.userId);
  const accuracy = user.totalAnswered > 0 ? Math.round((user.correctCount / user.totalAnswered) * 100) : 0;
  const rank = details?.rank || 1;

  let text = `👤 <b>کارنامه و سوابق آموزشی حسابداری</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🏷 <b>نام:</b> ${user.firstName} ${user.lastName || ""}\n`;
  if (user.username) text += `🆔 <b>یوزرنیم:</b> @${user.username}\n`;
  text += `🔢 <b>شناسه عددی:</b> <code>${user.userId}</code>\n\n`;

  text += `⭐️ <b>امتیاز کل شما:</b> ${user.totalScore} امتیاز\n`;
  text += `🏅 <b>رتبه شما در بین اعضا:</b> رتبه ${rank}\n`;
  text += `🎯 <b>تعداد آزمون‌های پاسخ‌داده‌شده:</b> ${user.totalAnswered} از ۹۰ آزمون\n`;
  text += `✅ <b>پاسخ‌های صحیح:</b> ${user.correctCount} سوال\n`;
  text += `❌ <b>پاسخ‌های نادرست:</b> ${user.wrongCount} سوال\n`;
  text += `📊 <b>درصد دقت و تسلط:</b> ${accuracy}٪\n`;
  text += `🕒 <b>آخرین فعالیت:</b> ${new Date(user.lastActiveAt).toLocaleDateString("fa-IR")} ${new Date(user.lastActiveAt).toLocaleTimeString("fa-IR")}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👇 برای ادامه تمرین و ارتقای رتبه، یکی از گزینه‌های زیر را انتخاب کنید:`;

  const inlineKeyboard = [
    [
      { text: `📝 شروع آزمون امروز 🎯`, callback_data: `q_today`, style: "success" },
      { text: `📚 بانک ۹۰ آزمون ⚡️`, callback_data: `q_page:1`, style: "primary" },
    ],
    [
      { text: `🥇 جدول رتبه‌بندی نخبگان 💎`, callback_data: `leaderboard`, style: "primary" },
      { text: `🏠 بازگشت به منوی اصلی 📌`, callback_data: `main_menu`, style: "primary" },
    ],
  ];

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format Leaderboard Message
export function formatLeaderboardMessage(currentUserId: number) {
  const stats = getAllBotUsersStats();
  let text = `🏆 <b>جدول رتبه‌بندی و نخبگان حسابداری کانال</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👥 کل شرکت‌کنندگان: ${stats.totalUsers} نفر\n`;
  text += `🎯 کل سوالات پاسخ‌داده‌شده: ${stats.totalAnswersAcrossBot}\n`;
  text += `📊 میانگین دقت کل: ${stats.averageAccuracy}٪\n\n`;

  if (stats.leaderboard.length === 0) {
    text += `هنوز کاربری در آزمون‌ها شرکت نکرده است. اولین نفری باشید که آزمون می‌دهد!\n`;
  } else {
    stats.leaderboard.slice(0, 10).forEach((u) => {
      const isMe = u.userId === currentUserId;
      const medal = u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : u.rank === 3 ? "🥉" : `[${u.rank}]`;
      const meTag = isMe ? " ⬅️ (شما)" : "";
      text += `${medal} <b>${u.name}</b>${meTag}\n`;
      text += `   ⭐️ ${u.totalScore} امتیاز | ✅ ${u.correctCount}/${u.totalAnswered} (${u.accuracy}٪)\n`;
    });
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👇 برای حل آزمون‌های بیشتر دکمه زیر را لمس کنید:`;

  const inlineKeyboard = [
    [
      { text: `📝 شروع آزمون امروز 🎯`, callback_data: `q_today`, style: "success" },
      { text: `🏆 کارنامه اختصاصی من ⭐️`, callback_data: `my_stats`, style: "success" },
    ],
    [
      { text: `📚 بانک ۹۰ آزمون دوره ⚡️`, callback_data: `q_page:1`, style: "primary" },
      { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
    ],
  ];

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format Main Welcome Menu
export function formatMainMenuMessage(user: TelegramBotUser, channelSignature?: string) {
  let text = `👋 سلام <b>${user.firstName}</b> عزیز،\n`;
  text += `به <b>سامانه جامع آموزش، آزمون و کارگاه ثبت سند حسابداری ایران</b> خوش آمدید! 🇮🇷✨\n\n`;
  text += `📌 <b>بخش‌های تخصصی و مجزای سامانه:</b>\n`;
  text += `۱️⃣ <b>📝 بانک ۹۰ آزمون تستی ۴ گزینه‌ای:</b> سوالات مفهومی استانداردها و قوانین مالیاتی با کلید تصادفی\n`;
  text += `۲️⃣ <b>📑 کارگاه ۹۰ آزمون ثبت سند دستی (دوبل):</b> سناریوهای واقعی از اسناد ساده تا پیشرفته شرکتی (چک، حقوق، وام، مالیات و بستن حساب‌ها)\n`;
  text += `۳️⃣ <b>🏆 کارنامه، امتیاز و رتبه‌بندی نخبگان:</b> ثبت هوشمند نمرات و سطح تسلط شما\n`;
  text += `۴️⃣ <b>📩 صندوق انتقادات و پیشنهادات:</b> ارتباط مستقیم با مدیریت کانال\n\n`;
  text += `⭐️ <b>امتیاز کل شما:</b> ${user.totalScore} امتیاز | 🎯 <b>تست‌های حل‌شده:</b> ${user.correctCount} از ${user.totalAnswered}\n\n`;
  if (channelSignature) text += `${channelSignature}\n\n`;
  text += `👇 <b>لطفاً بخش مورد نظر خود را انتخاب فرمایید:</b>`;

  const inlineKeyboard: any[][] = [];

  if (isBotAdmin(user.userId)) {
    inlineKeyboard.push([
      { text: `👑 🟢 پنل مدیریت و دریافت بکاپ 📦 🟢`, callback_data: `admin_panel`, style: "success" },
    ]);
  }

  inlineKeyboard.push(
    [
      { text: `📝 🟢 شروع آزمون تستی امروز 🎯`, callback_data: `q_today`, style: "success" },
      { text: `📑 🟢 کارگاه ثبت سند دستی ✍️`, callback_data: `sanad_page:1`, style: "success" },
    ],
    [
      { text: `📚 🔵 بانک ۹۰ آزمون تستی ⚡️`, callback_data: `q_page:1`, style: "primary" },
      { text: `📂 🔵 بانک ۹۰ سناریوی سند 📜`, callback_data: `sanad_page:1`, style: "primary" },
    ],
    [
      { text: `🏆 🟡 کارنامه و سوابق من ⭐️`, callback_data: `my_stats`, style: "success" },
      { text: `🥇 🟣 جدول نخبگان و رتبه‌بندی 💎`, callback_data: `leaderboard`, style: "primary" },
    ],
    [
      { text: `📖 🟠 درس و آموزش امروز ☀️`, callback_data: `q_lesson_today`, style: "primary" },
      { text: `📩 🟣 انتقاد، پیشنهاد و نظرات 💬`, callback_data: `feedback_start`, style: "primary" },
    ],
    [
      { text: `💡 🔵 راهنمای دستورات ربات ❓`, callback_data: `help_cmd`, style: "primary" },
    ]
  );

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// ---------------------------------------------------------------------------
// MANUAL JOURNAL ENTRY WORKSHOP & FEEDBACK LOGIC
// ---------------------------------------------------------------------------

export function formatTomansFa(val: number): string {
  return Number(val).toLocaleString("fa-IR") + " تومان";
}

// Format Journal Voucher Diagram (شمای سند دستی با تفکیک آرتیکل‌های بدهکار و بستانکار)
export function formatJournalVoucherDiagram(
  lines: { accountName: string; side: "debit" | "credit"; amount: number }[],
  isBalanced: boolean,
  totalDebit: number,
  totalCredit: number,
  isCorrect?: boolean
): string {
  if (!lines || lines.length === 0) {
    return `<i>(هنوز ردیف یا آرتیکلی به این سند اضافه نشده است)</i>\n`;
  }

  let out = `<b>📜 شمای سند حسابداری تنظیمی:</b>\n`;
  out += `<pre>\n`;
  out += `┌───┬─────────────────────────┬───────────────┬───────┐\n`;
  out += `│رد │ شرح حساب / معین         │ بدهکار (تومان)│بستانکار│\n`;
  out += `├───┼─────────────────────────┼───────────────┼───────┤\n`;

  lines.forEach((l, idx) => {
    const rIdx = (idx + 1).toString().padEnd(2);
    const acc = (l.side === "debit" ? "🔹 " : "  🔸 ") + l.accountName;
    const shortAcc = acc.length > 22 ? acc.slice(0, 20) + ".." : acc.padEnd(23);
    const debStr = l.side === "debit" ? l.amount.toLocaleString("en-US").padEnd(13) : "-".padEnd(13);
    const credStr = l.side === "credit" ? l.amount.toLocaleString("en-US").padEnd(7) : "-";
    out += `│${rIdx} │ ${shortAcc} │ ${debStr} │${credStr}│\n`;
  });

  out += `├───┴─────────────────────────┼───────────────┼───────┤\n`;
  out += `│ جمع کل بدهکار: ${totalDebit.toLocaleString("en-US")} ت\n`;
  out += `│ جمع کل بستانکار: ${totalCredit.toLocaleString("en-US")} ت\n`;
  out += `│ تراز سند: ${isBalanced ? "✅ تراز است (موازنه)" : "❌ نامتراز (اختلاف: " + Math.abs(totalDebit - totalCredit).toLocaleString("en-US") + " ت)"}\n`;
  if (isCorrect !== undefined) {
    out += `│ نتیجه بررسی: ${isCorrect ? "✅ ثبت کاملاً صحیح (+۲۰ امتیاز)" : "❌ نیاز به بازبینی و اصلاح آرتیکل‌ها"}\n`;
  }
  out += `└─────────────────────────────────────────────────────┘\n`;
  out += `</pre>`;
  return out;
}

// Evaluate Journal Submission
export function evaluateJournalSubmission(
  scenario: JournalScenario,
  userArticles: { accountName: string; side: "debit" | "credit"; amount: number }[]
) {
  let totalDebit = 0;
  let totalCredit = 0;
  userArticles.forEach((a) => {
    if (a.side === "debit") totalDebit += a.amount;
    else totalCredit += a.amount;
  });

  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  let allMatched = true;
  if (userArticles.length < scenario.requiredArticles.length) {
    allMatched = false;
  } else {
    for (const req of scenario.requiredArticles) {
      const found = userArticles.find((u) => {
        const sideMatches = u.side === req.side;
        const amountMatches = Math.abs(u.amount - req.amount) < 100;
        const nameMatches =
          u.accountName === req.accountName ||
          req.synonyms.some((s) => u.accountName.toLowerCase().includes(s.toLowerCase()));
        return sideMatches && amountMatches && nameMatches;
      });
      if (!found) {
        allMatched = false;
        break;
      }
    }
  }

  const isCorrect = isBalanced && allMatched;

  return {
    isBalanced,
    isCorrect,
    totalDebit,
    totalCredit,
    articleCount: userArticles.length,
    requiredCount: scenario.requiredArticles.length,
  };
}

// Record Journal Success & Update User Total Score
export function recordJournalSuccess(
  userId: number,
  scenarioId: string,
  userMeta: { firstName: string; lastName?: string; username?: string }
): { isFirstTimeCorrect: boolean; user: TelegramBotUser } {
  const db = loadUserDatabase();
  const user = getOrCreateBotUser(userId, userMeta);

  if (!user.journalAnswers) user.journalAnswers = {};

  const prevAnswer = user.journalAnswers[scenarioId];
  let isFirstTimeCorrect = false;

  if (!prevAnswer || !prevAnswer.isCorrect) {
    isFirstTimeCorrect = true;
    user.totalScore = (user.totalScore || 0) + 20; // 20 points for correct journal entry
  }

  user.journalAnswers[scenarioId] = {
    scenarioId,
    isCorrect: true,
    score: 20,
    answeredAt: new Date().toISOString(),
  };

  user.lastActiveAt = new Date().toISOString();
  saveUserDatabase(db);

  return { isFirstTimeCorrect, user };
}

// Parse Free Text Journal Entry typed by user
export function parseFreeTextJournalEntry(text: string, scenario: JournalScenario) {
  const clean = text.replace(/[،,]/g, " ").replace(/\r/g, "");
  const rawLines = clean.split(/[\n;/|]+/).map((s) => s.trim()).filter((s) => s.length > 0);

  const parsedArticles: { accountName: string; side: "debit" | "credit"; amount: number }[] = [];

  for (const line of rawLines) {
    let side: "debit" | "credit" = "debit";
    const lower = line.toLowerCase();
    if (
      lower.includes("بستانکار") ||
      lower.includes("بس:") ||
      lower.includes("بس ") ||
      lower.includes("بستان") ||
      lower.includes("credit") ||
      lower.includes("cr")
    ) {
      side = "credit";
    } else if (
      lower.includes("بدهکار") ||
      lower.includes("بد:") ||
      lower.includes("بد ") ||
      lower.includes("بده") ||
      lower.includes("debit") ||
      lower.includes("dr")
    ) {
      side = "debit";
    }

    let amount = 0;
    const enDigits = line.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

    const millionMatch = enDigits.match(/(\d+(?:\.\d+)?)\s*(?:میلیون|میلیارد|م|m)/i);
    if (millionMatch) {
      const mult = line.includes("میلیارد") ? 1000000000 : 1000000;
      amount = Math.round(parseFloat(millionMatch[1]) * mult);
    } else {
      const digitsMatch = enDigits.replace(/\s/g, "").match(/(\d{4,})/);
      if (digitsMatch) {
        amount = parseInt(digitsMatch[1], 10);
      }
    }

    let matchedAccountName = "";
    for (const req of scenario.requiredArticles) {
      if (req.synonyms.some((syn) => line.includes(syn) || syn.includes(line.slice(0, 10)))) {
        matchedAccountName = req.accountName;
        break;
      }
    }
    if (!matchedAccountName) {
      for (const opt of scenario.suggestedButtonOptions) {
        if (opt.synonyms.some((syn) => line.includes(syn))) {
          matchedAccountName = opt.name;
          break;
        }
      }
    }
    if (!matchedAccountName) {
      matchedAccountName = line.replace(/بدهکار|بستانکار|بد|بس|:|toman|تومان|\d+/g, "").trim() || "سایر حساب‌ها";
    }

    if (amount === 0) {
      const matchingReq = scenario.requiredArticles.find((r) => r.accountName === matchedAccountName || r.side === side);
      if (matchingReq) amount = matchingReq.amount;
    }

    parsedArticles.push({
      accountName: matchedAccountName,
      side,
      amount,
    });
  }

  return parsedArticles;
}

// Format Journal Scenario Message (شامل متن سناریو، فاکتور، دکمه‌های آرتیکل و شمای سند)
export function formatJournalScenarioMessage(
  scenarioId: string,
  user?: TelegramBotUser,
  draftArticles: { accountName: string; side: "debit" | "credit"; amount: number }[] = [],
  evaluationResult?: { isBalanced: boolean; isCorrect: boolean; totalDebit: number; totalCredit: number }
) {
  const scenario = getJournalScenario(scenarioId);
  const isSolved = user?.journalAnswers?.[scenario.id]?.isCorrect || user?.journalAnswers?.[`sc-${scenario.scenarioNumber}`]?.isCorrect;

  let text = `📑 <b>کارگاه عملی ثبت سند حسابداری دستی (سناریو شماره ${scenario.scenarioNumber} از ۹۰)</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🏷 <b>موضوع:</b> ${scenario.title}\n`;
  text += `🎯 <b>دسته‌بندی:</b> ${scenario.category} | ⚡️ <b>سطح:</b> ${scenario.difficulty}\n`;
  if (isSolved) {
    text += `✅ <b>وضعیت حل:</b> شما قبلاً این سند را به صورت صحیح ثبت و امتیاز آن را دریافت کرده‌اید ⭐️\n`;
  }
  text += `\n📖 <b>شرح رویداد مالی / فاکتور کسب‌وکار:</b>\n`;
  text += `<blockquote>${scenario.story}</blockquote>\n`;

  // Draw current draft or evaluation table
  let totalDebit = 0;
  let totalCredit = 0;
  draftArticles.forEach((a) => {
    if (a.side === "debit") totalDebit += a.amount;
    else totalCredit += a.amount;
  });
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  if (draftArticles.length > 0) {
    text += `\n${formatJournalVoucherDiagram(
      draftArticles,
      evaluationResult ? evaluationResult.isBalanced : isBalanced,
      totalDebit,
      totalCredit,
      evaluationResult ? evaluationResult.isCorrect : undefined
    )}\n`;
  }

  if (evaluationResult) {
    if (evaluationResult.isCorrect) {
      text += `🎉 <b>تبریک! سند حسابداری شما کاملاً صحیح، متوازن و طبق استانداردهای حسابداری است. (+۲۰ امتیاز)</b>\n\n`;
      text += `💡 <b>تحلیل علمی و علل بدهکار/بستانکار شدن حساب‌ها:</b>\n<blockquote>${scenario.explanation}</blockquote>\n\n`;
      text += `⚡️ <b>نکته مالیاتی / قانون تجارت:</b>\n<blockquote>${scenario.standardTip}</blockquote>\n`;
    } else {
      text += `❌ <b>سند شما نیاز به اصلاح دارد:</b>\n`;
      if (!evaluationResult.isBalanced) {
        text += `⚠️ جمع ستون بدهکار با بستانکار تراز نیست (قانون تعادل سند دوبل).\n`;
      } else {
        text += `⚠️ مبالغ تراز است اما سرفصل‌های انتخابی یا طرفین بدهکار/بستانکار منطبق بر رویداد نیست.\n`;
      }
      text += `💡 <i>می‌توانید با دکمه «🔄 ریست و تلاش مجدد» سند را ویرایش کنید یا دکمه «👁 پاسخ تشریحی» را لمس کنید.</i>\n`;
    }
  } else if (draftArticles.length === 0) {
    text += `✍️ <b>روش‌های ثبت سند:</b>\n`;
    text += `۱️⃣ <b>تایپ در چت:</b> می‌توانید سند را به صورت متن در همین چت ارسال کنید. مثال:\n`;
    text += `<code>بدهکار: اثاثه ۵۰ میلیون\nبستانکار: بانک ۲۰ میلیون\nبستانکار: چک ۳۰ میلیون</code>\n\n`;
    text += `۲️⃣ <b>دکمه‌های شیشه‌ای:</b> یا با لمس دکمه‌های رنگی زیر آرتیکل‌های مورد نظر را اضافه و سپس دکمه بررسی را لمس کنید.\n`;
  }

  // Build inline keyboard
  const inlineKeyboard: any[][] = [];

  // Options row for quick adding
  const optionButtons: any[] = [];
  scenario.suggestedButtonOptions.forEach((opt, idx) => {
    const sideFa = opt.suggestedSide === "debit" ? "بد" : "بس";
    const amountStr = (opt.amount / 1000000).toString() + "M";
    optionButtons.push({
      text: `➕ ${sideFa}: ${opt.name.slice(0, 12)} (${amountStr})`,
      callback_data: `sanad_add:${scenario.id}:${opt.suggestedSide}:${idx}`,
      style: opt.suggestedSide === "debit" ? "primary" : "success",
    });
  });

  // Group option buttons in rows of 2
  for (let i = 0; i < optionButtons.length; i += 2) {
    inlineKeyboard.push(optionButtons.slice(i, i + 2));
  }

  // Action buttons
  if (draftArticles.length > 0) {
    inlineKeyboard.push([
      { text: `✅ بررسی و ثبت نهایی سند ⚖️`, callback_data: `sanad_eval:${scenario.id}`, style: "success" },
      { text: `🔄 پاک‌کردن و ریست سند 🔁`, callback_data: `sanad_reset:${scenario.id}`, style: "danger" },
    ]);
  }

  inlineKeyboard.push([
    { text: `👁 مشاهده پاسخ تشریحی و استاندارد 💡`, callback_data: `sanad_solution:${scenario.id}`, style: "primary" },
  ]);

  // Navigation rows for 90 scenarios
  const navRow: any[] = [];
  const currentNum = scenario.scenarioNumber;
  if (currentNum > 1) {
    navRow.push({ text: `⬅️ سناریوی ${currentNum - 1}`, callback_data: `sanad_view:sc-${currentNum - 1}`, style: "primary" });
  }
  if (currentNum < 90) {
    navRow.push({ text: `سناریوی ${currentNum + 1} ➡️`, callback_data: `sanad_view:sc-${currentNum + 1}`, style: "primary" });
  }
  if (navRow.length > 0) inlineKeyboard.push(navRow);

  const pageForThis = Math.ceil(currentNum / 10);
  inlineKeyboard.push([
    { text: `📚 بانک ۹۰ سناریوی کارگاه ⚡️`, callback_data: `sanad_page:${pageForThis}`, style: "primary" },
    { text: `🏆 کارنامه من ⭐️`, callback_data: `my_stats`, style: "success" },
  ]);
  inlineKeyboard.push([
    { text: `🏠 بازگشت به منوی اصلی 📌`, callback_data: `main_menu`, style: "primary" },
  ]);

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format Journal Scenarios List (فهرست ۹۰ سناریوی کاربردی کارگاه سند با صفحه‌بندی)
export function formatJournalListMessage(pageNum: number = 1, user?: TelegramBotUser) {
  const pageSize = 10;
  const totalScenarios = 90;
  const totalPages = Math.ceil(totalScenarios / pageSize);
  const currentPage = Math.max(1, Math.min(totalPages, pageNum));
  const startNum = (currentPage - 1) * pageSize + 1;
  const endNum = Math.min(totalScenarios, startNum + pageSize - 1);

  let text = `📑 <b>کارگاه و بانک ۹۰ آزمون عملی ثبت سند حسابداری</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📄 صفحه ${currentPage} از ${totalPages} (سناریوهای ${startNum} تا ${endNum})\n\n`;
  text += `💡 شامل انواع ثبت‌های شرکت از اسناد معمولی تا پیشرفته:\n`;
  text += `🔹 ثبت چک‌های صیادی، واگذاری، وصول، خرج کردن و برگشت چک\n`;
  text += `🔹 ثبت حقوق و دستمزد، بیمه ۷٪ و ۲۳٪، مالیات حقوق و مساعده\n`;
  text += `🔹 ثبت وام و تسهیلات بانکی، بهره تحقق‌نیافته و اقساط\n`;
  text += `🔹 خرید و فروش، بهای تمام‌شده، انبارداری، استهلاک دارایی\n`;
  text += `🔹 مالیات ارزش افزوده ۱۰٪، تهاتر فصلی، عملکرد و بستن حساب‌ها\n\n`;
  text += `راهنما: 🟢 حل‌شده صحیح (+۲۰ امتیاز) | 🔵 حل‌نشده\n`;
  text += `👇 <b>سناریوی مورد نظر را جهت ورود به کارگاه انتخاب فرمایید:</b>\n`;

  const inlineKeyboard: any[][] = [];

  for (let n = startNum; n <= endNum; n++) {
    const sc = getJournalScenario(n);
    const isSolved = user?.journalAnswers?.[sc.id]?.isCorrect || user?.journalAnswers?.[`sc-${n}`]?.isCorrect;
    const statusIcon = isSolved ? "✅" : "🔵";
    const statusText = isSolved ? "(حل‌شده)" : "";
    inlineKeyboard.push([
      {
        text: `${statusIcon} سناریو ${n}: ${sc.title.slice(0, 32)} ${statusText}`,
        callback_data: `sanad_view:${sc.id}`,
        style: isSolved ? "success" : "primary",
      },
    ]);
  }

  // Pagination navigation row
  const paginationRow: any[] = [];
  if (currentPage > 1) {
    paginationRow.push({ text: `⬅️ صفحه قبل`, callback_data: `sanad_page:${currentPage - 1}`, style: "primary" });
  }
  paginationRow.push({ text: `📄 ص ${currentPage}/${totalPages}`, callback_data: `sanad_page:${currentPage}` });
  if (currentPage < totalPages) {
    paginationRow.push({ text: `صفحه بعد ➡️`, callback_data: `sanad_page:${currentPage + 1}`, style: "primary" });
  }
  inlineKeyboard.push(paginationRow);

  // Quick categories
  inlineKeyboard.push([
    { text: `🌱 ماه ۱: چک و دارایی (۱-۳۰)`, callback_data: `sanad_page:1`, style: "primary" },
    { text: `🏢 ماه ۲: حقوق و وام (۳۱-۶۰)`, callback_data: `sanad_page:4`, style: "primary" },
  ]);
  inlineKeyboard.push([
    { text: `📊 ماه ۳: مالیات و بستن (۶۱-۹۰)`, callback_data: `sanad_page:7`, style: "primary" },
    { text: `🏆 کارنامه من ⭐️`, callback_data: `my_stats`, style: "success" },
  ]);
  inlineKeyboard.push([
    { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
  ]);

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format Feedback Start Prompt
export function formatFeedbackPromptMessage() {
  let text = `📩 <b>صندوق انتقادات، پیشنهادات و نظرات شما</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💬 کاربران گرامی، نظرات، پیشنهادات، گزارش خطا و سوالات شما مستقیماً برای مدیر کانال ارسال می‌گردد.\n\n`;
  text += `✍️ <b>لطفاً پیام، نظر یا انتقاد خود را در قالب یک متن در همین چت تایپ و ارسال فرمایید:</b>\n`;
  text += `<i>(برای انصراف دکمه زیر را لمس کنید)</i>`;

  const inlineKeyboard = [
    [{ text: `❌ انصراف و بازگشت به منو`, callback_data: `main_menu`, style: "danger" }],
  ];

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

export function formatAdminPanelMessage(fromId: number | string) {
  const stats = getAllBotUsersStats();
  const scheduler = getSchedulerStatus();
  const conf = loadServerBotConfig();

  let text = `👑 <b>پنل مدیریت سامانه آموزش و آزمون حسابداری</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🤖 <b>ربات متصل:</b> @${botUsername || "AccountingBot"}\n`;
  text += `📢 <b>کانال تلگرام:</b> ${conf.telegramChannel || "تنظیم نشده"}\n`;
  text += `👥 <b>تعداد کاربران ثبت‌شده در ربات:</b> <b>${stats.totalUsers}</b> نفر\n`;
  text += `🎯 <b>تست‌های ثبت‌شده در دیتابیس:</b> <b>${stats.totalAnswersAcrossBot}</b> سوال\n`;
  text += `📅 <b>روز جاری دوره ۳ ماهه:</b> روز <b>${scheduler.currentDayNumber}</b> از ۹۰\n`;
  text += `⏰ <b>وضعیت انتشار خودکار:</b> ${scheduler.enabled ? "🟢 فعال (۴ نوبت در روز)" : "🔴 غیرفعال"}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👇 <b>دستورات مدیریتی، ارسال فوری و بکاپ:</b>`;

  const inlineKeyboard = [
    [
      { text: `🟢 📦 دریافت آنی فایل کامل بکاپ 💾 🟢`, callback_data: `admin_backup`, style: "success" },
    ],
    [
      { text: `🔵 📥 راهنمای بازگردانی سریع اطلاعات 🔄 🔵`, callback_data: `admin_restore_info`, style: "primary" },
    ],
    [
      { text: `🟡 ☀️ ارسال فوری صبح (۰۹:۰۰)`, callback_data: `admin_post:morning`, style: "primary" },
      { text: `🟠 🛠 ارسال فوری ظهر (۱۴:۳۰)`, callback_data: `admin_post:noon`, style: "primary" },
    ],
    [
      { text: `🟣 📝 ارسال فوری عصر (۲۰:۰۰)`, callback_data: `admin_post:evening`, style: "primary" },
      { text: `🔵 🌙 ارسال فوری شب (۲۲:۳۰)`, callback_data: `admin_post:late_night`, style: "primary" },
    ],
    [
      { text: `🟩 ➕ یک روز جلو (+1)`, callback_data: `admin_day:plus`, style: "success" },
      { text: `🟥 ➖ یک روز عقب (-1)`, callback_data: `admin_day:minus`, style: "danger" },
    ],
    [
      { text: `💎 🔄 ثبت مجدد دکمه منو در تلگرام`, callback_data: `admin_sync_menu`, style: "primary" },
      { text: `🏡 🏠 منوی اصلی ربات`, callback_data: `main_menu`, style: "primary" },
    ],
  ];

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format Daily Theory Lesson
export function formatLessonMessage(dayNumber: number) {
  const dayItem = getOrCreateDayItem(dayNumber, initialThreeMonthCurriculum);
  const morningPost = dayItem.posts[0];
  const noonPost = dayItem.posts[1];

  let text = `📖 <b>آموزش روز شماره ${dayNumber}: ${dayItem.title}</b>\n`;
  text += `🏷 <b>دسته:</b> ${dayItem.category}\n\n`;
  text += `☀️ <b>بخش اول: درس نظری</b>\n`;
  text += `${morningPost?.content || "محتوای درس"}\n\n`;

  if (morningPost?.keyRule) {
    text += `⚡️ <b>نکته طلایی بازار کار:</b>\n<blockquote>${morningPost.keyRule}</blockquote>\n\n`;
  }

  if (noonPost) {
    text += `━━━━━━━━━━━━━━━\n`;
    text += `🏢 <b>بخش دوم: کارگاه عملی و ثبت سند</b>\n`;
    text += `${noonPost.content}\n\n`;
    if (noonPost.practicalExample) {
      text += `📋 <b>ثبت دفتر روزنامه:</b>\n<code>${noonPost.practicalExample}</code>\n\n`;
    }
  }

  const inlineKeyboard = [
    [
      { text: `📝 شرکت در آزمون تستی روز ${dayNumber} 🎯`, callback_data: `q_show:${dayNumber}`, style: "success" },
    ],
    [
      { text: `📚 بانک آزمون‌ها ⚡️`, callback_data: `q_page:1`, style: "primary" },
      { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
    ],
  ];

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// ---------------------------------------------------------------------------
// TELEGRAM BOT LONG POLLING & UPDATE HANDLER ENGINE
// ---------------------------------------------------------------------------

let isPollingActive = false;
let pollingAbortController: AbortController | null = null;
let lastUpdateId = 0;
let botUsername = "";

// Helper to sanitize reply markup for Telegram Bot API specification
function cleanTelegramReplyMarkup(markup: any): any {
  if (!markup) return markup;
  if (markup.inline_keyboard && Array.isArray(markup.inline_keyboard)) {
    return {
      inline_keyboard: markup.inline_keyboard.map((row: any[]) =>
        row.map((btn: any) => {
          const clean: Record<string, any> = { text: String(btn.text || "") };
          if (btn.url) clean.url = String(btn.url);
          if (btn.callback_data !== undefined) clean.callback_data = String(btn.callback_data);
          if (btn.web_app) clean.web_app = btn.web_app;
          if (btn.style) clean.style = String(btn.style);
          return clean;
        })
      ),
    };
  }
  if (markup.keyboard && Array.isArray(markup.keyboard)) {
    return {
      keyboard: markup.keyboard.map((row: any[]) =>
        row.map((btn: any) => ({ text: typeof btn === "string" ? btn : String(btn.text || "") }))
      ),
      resize_keyboard: markup.resize_keyboard ?? true,
      is_persistent: markup.is_persistent ?? false,
      one_time_keyboard: markup.one_time_keyboard ?? true,
    };
  }
  return markup;
}

// Telegram API Caller Helper with HTML parse fallback, markup sanitization, and timeout
async function callTelegramApi(token: string, method: string, payload: Record<string, any>) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const cleanPayload = { ...payload };
  if (cleanPayload.reply_markup) {
    cleanPayload.reply_markup = cleanTelegramReplyMarkup(cleanPayload.reply_markup);
  }

  try {
    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanPayload),
      signal: AbortSignal.timeout(15000),
    });
    let data = await res.json();

    // Retry without parse_mode if Telegram rejected HTML entities
    if (!data.ok && typeof data.description === "string" && data.description.includes("can't parse entities") && cleanPayload.text) {
      console.warn(`[TelegramApi] HTML parse failed, falling back to plain text for ${method}`);
      const plainText = cleanPayload.text.replace(/<[^>]*>/g, "");
      const fallbackPayload = {
        ...cleanPayload,
        text: plainText,
        parse_mode: undefined,
      };
      delete fallbackPayload.parse_mode;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackPayload),
        signal: AbortSignal.timeout(15000),
      });
      data = await res.json();
    }

    if (!data.ok) {
      console.warn(`[TelegramApi] Method '${method}' responded with error:`, data.description || data);
    }

    return data;
  } catch (err: any) {
    console.error(`[TelegramApi] Error calling ${method}:`, err.message || err);
    return { ok: false, description: err.message || "خطای ارتباط با سرور تلگرام" };
  }
}

// Process a single Telegram Update (Message or CallbackQuery)
export async function processTelegramUpdate(token: string, update: any, currentDayNumber: number = 1) {
  try {
    // 1. Handle Callback Query (دکمه‌های شیشه‌ای)
    if (update.callback_query) {
      const cq = update.callback_query;
      const callbackId = cq.id;
      const data: string = cq.data || "";
      const from = cq.from;
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;

      const user = getOrCreateBotUser(from.id, {
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
      });

      // Handle no-op button
      if (data === "noop") {
        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
        });
        return;
      }

      // Handle Answer Click (q_ans:DAY:OPT)
      if (data.startsWith("q_ans:")) {
        const parts = data.split(":");
        const day = parseInt(parts[1], 10) || 1;
        const opt = parseInt(parts[2], 10) || 0;

        const result = recordQuizAnswer(from.id, day, opt, {
          firstName: from.first_name,
          lastName: from.last_name,
          username: from.username,
        });

        // Popup notification
        const alertText = result.isCorrect
          ? `✅ آفرین! پاسخ شما کاملاً صحیح است (+۱۰ امتیاز) ⭐️`
          : `❌ متاسفانه پاسخ شما نادرست بود. تحلیل تشریحی را در متن پیام بخوانید.`;

        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: alertText,
          show_alert: true,
        });

        // Edit the message with updated status, explanation, and navigation buttons
        const updatedMsg = formatQuizMessage(day, result.user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: updatedMsg.text,
          parse_mode: "HTML",
          reply_markup: updatedMsg.reply_markup,
        });
        return;
      }

      // Retake quiz of a specific day
      if (data.startsWith("q_retake:")) {
        const day = parseInt(data.split(":")[1], 10) || 1;
        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: `آماده حل مجدد آزمون روز ${day}`,
        });

        // Render clean quiz without prior answers view
        const dayItem = getOrCreateDayItem(day, initialThreeMonthCurriculum);
        const eveningPost = dayItem.posts.find((p) => p.slotTitle.includes("شب") || p.quizQuestion) || dayItem.posts[2];
        const question = eveningPost?.quizQuestion || "سوال آزمون روز";
        const options = eveningPost?.quizOptions || ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"];

        let text = `🏆 <b>آزمون تستی روز شماره ${day} (حل مجدد)</b>\n`;
        text += `📚 <b>سرفصل:</b> ${dayItem.title}\n\n`;
        text += `❓ <b>صورت سوال:</b>\n${question}\n\n`;
        const optionEmojis = ["۱️⃣", "۲️⃣", "۳️⃣", "۴️⃣"];
        options.forEach((opt, idx) => {
          text += `${optionEmojis[idx]} ${opt}\n`;
        });
        text += `\n👇 <b>لطفاً گزینه صحیح را لمس کنید:</b>`;

        const inlineKeyboard = [
          [
            { text: `1️⃣ گزینه ۱`, callback_data: `q_ans:${day}:0`, style: "primary" },
            { text: `2️⃣ گزینه ۲`, callback_data: `q_ans:${day}:1`, style: "primary" },
          ],
          [
            { text: `3️⃣ گزینه ۳`, callback_data: `q_ans:${day}:2`, style: "primary" },
            { text: `4️⃣ گزینه ۴`, callback_data: `q_ans:${day}:3`, style: "primary" },
          ],
          [
            { text: `📑 کارگاه ثبت سند ✍️`, callback_data: `sanad_list`, style: "success" },
            { text: `🏆 کارنامه من ⭐️`, callback_data: `my_stats`, style: "success" },
          ],
          [
            { text: `📚 بانک ۹۰ آزمون ⚡️`, callback_data: `q_page:1`, style: "primary" },
            { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
          ],
        ];

        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return;
      }

      // ---------------------------------------------------------------
      // JOURNAL WORKSHOP CALLBACKS (ثبت سند دستی تعاملی ۹۰ سناریو)
      // ---------------------------------------------------------------

      // Show list of 90 journal scenarios with pagination
      if (data === "sanad_list" || data.startsWith("sanad_page:")) {
        const page = data.startsWith("sanad_page:") ? parseInt(data.split(":")[1], 10) || 1 : 1;
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const listMsg = formatJournalListMessage(page, user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: listMsg.text,
          parse_mode: "HTML",
          reply_markup: listMsg.reply_markup,
        });
        return;
      }

      // View specific journal scenario (sanad_view:SCENARIO_ID)
      if (data.startsWith("sanad_view:")) {
        const scenarioId = data.split(":")[1];
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        
        userSessionStates.set(from.id, {
          mode: "journal_active",
          scenarioId,
          draftArticles: [],
          lastUpdated: Date.now(),
        });

        const scenarioMsg = formatJournalScenarioMessage(scenarioId, user, []);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: scenarioMsg.text,
          parse_mode: "HTML",
          reply_markup: scenarioMsg.reply_markup,
        });
        return;
      }

      // Add article to draft voucher via inline buttons (sanad_add:SCENARIO_ID:SIDE:IDX)
      if (data.startsWith("sanad_add:")) {
        const parts = data.split(":");
        const scenarioId = parts[1];
        const side = parts[2] as "debit" | "credit";
        const idx = parseInt(parts[3], 10) || 0;

        const scenario = getJournalScenario(scenarioId);
        const opt = scenario.suggestedButtonOptions[idx] || scenario.suggestedButtonOptions[0];

        let sess = userSessionStates.get(from.id);
        if (!sess || sess.scenarioId !== scenarioId) {
          sess = {
            mode: "journal_active",
            scenarioId,
            draftArticles: [],
            lastUpdated: Date.now(),
          };
          userSessionStates.set(from.id, sess);
        }

        if (!sess.draftArticles) sess.draftArticles = [];
        sess.draftArticles.push({
          accountName: opt.name,
          side: side,
          amount: opt.amount,
        });
        sess.lastUpdated = Date.now();

        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: `➕ ردیف ${side === "debit" ? "بدهکار" : "بستانکار"} (${opt.name}) به سند افزوده شد.`,
        });

        const scenarioMsg = formatJournalScenarioMessage(scenarioId, user, sess.draftArticles);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: scenarioMsg.text,
          parse_mode: "HTML",
          reply_markup: scenarioMsg.reply_markup,
        });
        return;
      }

      // Reset draft articles (sanad_reset:SCENARIO_ID)
      if (data.startsWith("sanad_reset:")) {
        const scenarioId = data.split(":")[1];
        const sess = userSessionStates.get(from.id);
        if (sess) {
          sess.draftArticles = [];
          sess.lastUpdated = Date.now();
        }

        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: "🔄 پیش‌نویس سند پاک شد.",
        });

        const scenarioMsg = formatJournalScenarioMessage(scenarioId, user, []);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: scenarioMsg.text,
          parse_mode: "HTML",
          reply_markup: scenarioMsg.reply_markup,
        });
        return;
      }

      // Evaluate draft voucher (sanad_eval:SCENARIO_ID)
      if (data.startsWith("sanad_eval:")) {
        const scenarioId = data.split(":")[1];
        const scenario = getJournalScenario(scenarioId);
        const sess = userSessionStates.get(from.id);
        const articles = sess?.draftArticles || [];

        if (articles.length === 0) {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "⚠️ لطفاً ابتدا با دکمه‌های بالا یا تایپ در چت حداقل یک ردیف به سند اضافه فرمایید.",
            show_alert: true,
          });
          return;
        }

        const evalRes = evaluateJournalSubmission(scenario, articles);

        if (evalRes.isCorrect) {
          const recRes = recordJournalSuccess(from.id, scenario.id, {
            firstName: from.first_name,
            lastName: from.last_name,
            username: from.username,
          });

          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: `🎉 تبریک! سند حسابداری کاملاً صحیح و تراز است (+۲۰ امتیاز) ⭐️`,
            show_alert: true,
          });

          const scenarioMsg = formatJournalScenarioMessage(scenarioId, recRes.user, articles, evalRes);
          await callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: scenarioMsg.text,
            parse_mode: "HTML",
            reply_markup: scenarioMsg.reply_markup,
          });
          return;
        } else {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: evalRes.isBalanced
              ? "❌ سند متوازن است اما طرفین حساب یا مبالغ نیاز به اصلاح دارد."
              : "❌ سند نامتراز است. جمع بدهکار با بستانکار برابر نیست!",
            show_alert: true,
          });

          const scenarioMsg = formatJournalScenarioMessage(scenarioId, user, articles, evalRes);
          await callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: scenarioMsg.text,
            parse_mode: "HTML",
            reply_markup: scenarioMsg.reply_markup,
          });
          return;
        }
      }

      // Show full solution & standard voucher for scenario (sanad_solution:SCENARIO_ID)
      if (data.startsWith("sanad_solution:")) {
        const scenarioId = data.split(":")[1];
        const scenario = getJournalScenario(scenarioId);
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });

        let solText = `💡 <b>پاسخ استاندارد و سند دوبل سناریو ${scenario.scenarioNumber}: ${scenario.title}</b>\n`;
        solText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        solText += `${formatJournalVoucherDiagram(
          scenario.requiredArticles,
          true,
          scenario.requiredArticles.filter((a) => a.side === "debit").reduce((s, a) => s + a.amount, 0),
          scenario.requiredArticles.filter((a) => a.side === "credit").reduce((s, a) => s + a.amount, 0),
          true
        )}\n`;
        solText += `📖 <b>تحلیل علمی رویداد:</b>\n<blockquote>${scenario.explanation}</blockquote>\n\n`;
        solText += `⚡️ <b>نکته کاربردی استانداردهای حسابداری و قانون تجارت:</b>\n<blockquote>${scenario.standardTip}</blockquote>\n`;

        const pageForThis = Math.ceil(scenario.scenarioNumber / 10);
        const inlineKeyboard = [
          [
            { text: `✍️ تلاش مجدد برای ثبت این سند`, callback_data: `sanad_view:${scenario.id}`, style: "success" },
            { text: `📚 سایر سناریوهای کارگاه`, callback_data: `sanad_page:${pageForThis}`, style: "primary" },
          ],
          [
            { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
          ],
        ];

        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: solText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return;
      }

      // ---------------------------------------------------------------
      // FEEDBACK & ADMIN MESSAGING CALLBACKS (انتقادات و پیشنهادات)
      // ---------------------------------------------------------------

      // Start feedback prompt
      if (data === "feedback_start") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        userSessionStates.set(from.id, {
          mode: "awaiting_feedback",
          lastUpdated: Date.now(),
        });
        const promptMsg = formatFeedbackPromptMessage();
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: promptMsg.text,
          parse_mode: "HTML",
          reply_markup: promptMsg.reply_markup,
        });
        return;
      }

      // Admin reply to specific user feedback (admin_reply:USER_ID)
      if (data.startsWith("admin_reply:")) {
        const targetUserId = parseInt(data.split(":")[1], 10);
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "⛔️ دسترسی غیرمجاز.",
            show_alert: true,
          });
          return;
        }

        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        userSessionStates.set(from.id, {
          mode: "admin_replying",
          replyToUserId: targetUserId,
          lastUpdated: Date.now(),
        });

        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: `✍️ <b>پاسخ به کاربر:</b> <code>${targetUserId}</code>\nلطفاً متن پاسخ خود را در همین چت تایپ و ارسال فرمایید تا مستقیماً به پیوی کاربر فرستاده شود:`,
          parse_mode: "HTML",
        });
        return;
      }

      // Show specific day quiz (q_show:DAY)
      if (data.startsWith("q_show:")) {
        const day = parseInt(data.split(":")[1], 10) || 1;
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const quizMsg = formatQuizMessage(day, user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: quizMsg.text,
          parse_mode: "HTML",
          reply_markup: quizMsg.reply_markup,
        });
        return;
      }

      // Show paginated quizzes page (q_page:PAGE)
      if (data.startsWith("q_page:")) {
        const page = parseInt(data.split(":")[1], 10) || 1;
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const pageMsg = formatQuizPageMessage(page, user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: pageMsg.text,
          parse_mode: "HTML",
          reply_markup: pageMsg.reply_markup,
        });
        return;
      }

      // Show today's quiz
      if (data === "q_today") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const quizMsg = formatQuizMessage(currentDayNumber, user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: quizMsg.text,
          parse_mode: "HTML",
          reply_markup: quizMsg.reply_markup,
        });
        return;
      }

      // Show lesson for a day
      if (data.startsWith("q_lesson:")) {
        const day = parseInt(data.split(":")[1], 10) || 1;
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const lessonMsg = formatLessonMessage(day);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: lessonMsg.text,
          parse_mode: "HTML",
          reply_markup: lessonMsg.reply_markup,
        });
        return;
      }

      // Show daily accounting journal entry & voucher (q_sanad:DAY)
      if (data.startsWith("q_sanad:")) {
        const day = parseInt(data.split(":")[1], 10) || 1;
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const sanadMsg = formatDailySanadMessage(day, user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: sanadMsg.text,
          parse_mode: "HTML",
          reply_markup: sanadMsg.reply_markup,
        });
        return;
      }

      if (data === "q_lesson_today") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const lessonMsg = formatLessonMessage(currentDayNumber);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: lessonMsg.text,
          parse_mode: "HTML",
          reply_markup: lessonMsg.reply_markup,
        });
        return;
      }

      // Show User Stats
      if (data === "my_stats") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const statsMsg = formatUserStatsMessage(user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: statsMsg.text,
          parse_mode: "HTML",
          reply_markup: statsMsg.reply_markup,
        });
        return;
      }

      // Show Leaderboard
      if (data === "leaderboard") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const lbMsg = formatLeaderboardMessage(from.id);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: lbMsg.text,
          parse_mode: "HTML",
          reply_markup: lbMsg.reply_markup,
        });
        return;
      }

      // Return to Main Menu
      if (data === "main_menu") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        const menuMsg = formatMainMenuMessage(user);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: menuMsg.text,
          parse_mode: "HTML",
          reply_markup: menuMsg.reply_markup,
        });
        return;
      }

      // Help command
      if (data === "help_cmd") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        let helpText = `❓ <b>راهنمای دستورات ربات حسابداری:</b>\n\n`;
        helpText += `🔹 /start : شروع و منوی اصلی ربات\n`;
        helpText += `🔹 /quiz : باز کردن آزمون تستی روز جاری\n`;
        helpText += `🔹 /bank : مشاهده بانک ۹۰ روز آزمون دوره\n`;
        helpText += `🔹 /stats یا /karname : مشاهده کارنامه، درصد قبولی و رتبه\n`;
        helpText += `🔹 /rank : جدول رتبه‌بندی نخبگان و برترین‌های کانال\n`;
        helpText += `🔹 /lesson : مشاهده آموزش مفهومی و سند دوبل روز\n`;
        helpText += `🔹 /sanad : کارگاه تعاملی ثبت سند دستی حسابداری\n`;
        helpText += `🔹 /feedback : ارسال انتقادات، پیشنهادات و نظرات به ادمین\n`;
        helpText += `🔹 /admin : پنل مدیریت و دریافت بکاپ (مخصوص ادمین)\n`;
        helpText += `🔹 /backup : دریافت فوری فایل بکاپ (مخصوص ادمین)\n\n`;
        helpText += `✨ <i>تمامی آزمون‌ها و کارگاه ثبت سند با دکمه‌های شیشه‌ای تعاملی قابل انجام بوده و سوابق شما اختصاصی ذخیره می‌شود.</i>`;

        const inlineKeyboard = [
          [
            { text: `📝 شروع آزمون امروز 🎯`, callback_data: `q_today`, style: "success" },
            { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
          ],
        ];

        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: helpText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return;
      }

      // Admin Panel Callback
      if (data === "admin_panel") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "⛔️ این بخش منحصراً مخصوص مدیر اصلی سامانه است.",
            show_alert: true,
          });
          return;
        }
        const panelMsg = formatAdminPanelMessage(from.id);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: panelMsg.text,
          parse_mode: "HTML",
          reply_markup: panelMsg.reply_markup,
        });
        return;
      }

      // Admin Backup Download Callback
      if (data === "admin_backup") {
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "⛔️ دسترسی غیرمجاز.",
            show_alert: true,
          });
          return;
        }
        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: "📦 در حال تولید فایل پشتیبان و ارسال...",
        });
        await sendBackupToChat(token, chatId);
        return;
      }

      // Admin Restore Info Callback
      if (data === "admin_restore_info") {
        await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackId });
        let restoreGuide = `📥 <b>راهنمای بازگردانی سریع اطلاعات و کارنامه‌ها:</b>\n\n`;
        restoreGuide += `۱️⃣ هر زمان مایل به بازگردانی بودید، کافیست فایل بکاپ (با پسوند <code>.json</code>) را در همین چت برای ربات <b>ارسال (یا فوروارد)</b> فرمایید.\n\n`;
        restoreGuide += `۲️⃣ ربات به صورت هوشمند ساختار دیتابیس، کاربران، کارنامه‌ها و تنظیمات را اعتبارسنجی نموده و در یک ثانیه سیستم را بازیابی می‌کند.\n\n`;
        restoreGuide += `🛡 <b>سیستم محافظت خودکار:</b> یک نسخه پشتیبان از تمام کارنامه‌ها و تنظیمات به صورت دائمی در مسیر <code>data_persistence/</code> نیز ذخیره است و با آپدیت‌های بعدی هرگز پاک نخواهد شد!`;

        const inlineKeyboard = [
          [
            { text: `🟢 📦 دریافت فایل فعلی بکاپ 💾 🟢`, callback_data: `admin_backup`, style: "success" },
            { text: `👑 🔵 بازگشت به پنل ادمین ⚙️ 🔵`, callback_data: `admin_panel`, style: "primary" },
          ],
        ];

        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: restoreGuide,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return;
      }

      // Admin Post Slot Immediate Execution
      if (data.startsWith("admin_post:")) {
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "⛔️ دسترسی غیرمجاز.",
            show_alert: true,
          });
          return;
        }
        const slot = data.split(":")[1] as "morning" | "noon" | "evening" | "late_night";
        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: `🚀 در حال ارسال پست ${slot} به کانال...`,
        });
        try {
          const res = await executeSlot(slot, { manual: true });
          const isOk = res.status === "success" || res.status === "partial";
          await callTelegramApi(token, "sendMessage", {
            chat_id: chatId,
            text: isOk
              ? `✅ <b>پست «${res.slotTitle}» با موفقیت در کانال منتشر شد!</b>\n📅 روز دوره: روز ${res.dayNumber}\n⏱ تاریخ: ${res.tehranTime}`
              : `⚠️ <b>خطا در ارسال پست به کانال:</b> ${res.telegramStatus?.error || "بررسی کنید ربات ادمین کانال با حق ارسال پیام باشد."}`,
            parse_mode: "HTML",
          });
        } catch (e: any) {
          await callTelegramApi(token, "sendMessage", {
            chat_id: chatId,
            text: `❌ خطا در اجرای اسلات: ${e.message}`,
          });
        }
        return;
      }

      // Admin Day Number Navigation
      if (data.startsWith("admin_day:")) {
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "⛔️ دسترسی غیرمجاز.",
            show_alert: true,
          });
          return;
        }
        const action = data.split(":")[1];
        const curr = getSchedulerStatus().currentDayNumber;
        const next = action === "plus" ? (curr >= 90 ? 1 : curr + 1) : (curr <= 1 ? 90 : curr - 1);
        updateSchedulerConfig({ currentDayNumber: next });
        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: `📅 روز دوره به روز ${next} تغییر یافت.`,
        });
        const panelMsg = formatAdminPanelMessage(from.id);
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: panelMsg.text,
          parse_mode: "HTML",
          reply_markup: panelMsg.reply_markup,
        });
        return;
      }

      // Admin Re-sync Menu
      if (data === "admin_sync_menu") {
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "⛔️ دسترسی غیرمجاز.",
            show_alert: true,
          });
          return;
        }
        await callTelegramApi(token, "answerCallbackQuery", {
          callback_query_id: callbackId,
          text: "🔄 در حال ثبت دستورات و منو در سرور تلگرام...",
        });
        const initRes = await initializeBotCommands(token);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: initRes.ok
            ? `✅ <b>منوی ربات و دستورات با موفقیت در تلگرام به‌روزرسانی شد!</b>\nدکمه Menu کنار کادر چت و کیبورد سریع فعال است.`
            : `❌ خطا در ثبت منو: ${initRes.error}`,
          parse_mode: "HTML",
          reply_markup: getPersistentKeyboardForUser(from.id),
        });
        return;
      }
    }

    // 2. Handle Incoming Message (چت متنی کاربر با ربات)
    if (update.message) {
      const msg = update.message;
      const text = (msg.text || "").trim();
      const from = msg.from;
      const chatId = msg.chat.id;

      if (!from) return;

      console.log(`[TelegramBot] Incoming message from @${from.username || from.id} (${from.first_name}) in chat ${chatId}: "${text}"`);

      const user = getOrCreateBotUser(from.id, {
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
      });

      // Document Upload Handling (Restore from Backup JSON)
      if (msg.document) {
        if (isBotAdmin(from.id)) {
          const doc = msg.document;
          const fileName = (doc.file_name || "").toLowerCase();
          if (fileName.endsWith(".json") || doc.mime_type === "application/json") {
            await callTelegramApi(token, "sendMessage", {
              chat_id: chatId,
              text: `⏳ <b>در حال دانلود و اعتبارسنجی فایل پشتیبان...</b>`,
              parse_mode: "HTML",
            });
            try {
              const fileInfo = await callTelegramApi(token, "getFile", { file_id: doc.file_id });
              if (fileInfo.ok && fileInfo.result?.file_path) {
                const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
                const fileRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(30000) });
                const fileText = await fileRes.text();
                const parsedData = JSON.parse(fileText);
                const restoreRes = await restoreSystemFromBackup(parsedData);

                await callTelegramApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: restoreRes.ok
                    ? `✅ <b>فایل پشتیبان با موفقیت بازگردانی شد!</b>\n\n` +
                      `👥 <b>تعداد کاربران فعال‌شده:</b> ${restoreRes.usersCount} نفر\n` +
                      `📅 <b>روز دوره:</b> روز ${getSchedulerStatus().currentDayNumber} از ۹۰\n` +
                      `⚙️ تمامی تنظیمات و کارنامه‌ها بدون افت کیفیت فعال گردیدند.`
                    : `❌ <b>خطا در بازیابی:</b> ${restoreRes.message}`,
                  parse_mode: "HTML",
                  reply_markup: getPersistentKeyboardForUser(from.id),
                });
                return;
              } else {
                await callTelegramApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `❌ خطا در دریافت مسیر فایل از تلگرام: ${fileInfo.description || "مسیر نامعتبر"}`,
                });
                return;
              }
            } catch (err: any) {
              await callTelegramApi(token, "sendMessage", {
                chat_id: chatId,
                text: `❌ خطا در خواندن یا پردازش فایل JSON: ${err.message}`,
              });
              return;
            }
          }
        }
      }

      // Check current user active session state
      let sess = userSessionStates.get(from.id);

      // Handle Awaiting Feedback state
      if (sess?.mode === "awaiting_feedback" && text && !text.startsWith("/")) {
        userSessionStates.set(from.id, { mode: "none", lastUpdated: Date.now() });

        const adminId = loadServerBotConfig().telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
        if (adminId) {
          let adminNotice = `📩 <b>پیام جدید در صندوق انتقادات و پیشنهادات:</b>\n`;
          adminNotice += `━━━━━━━━━━━━━━━━━━━━\n`;
          adminNotice += `👤 <b>فرستنده:</b> ${from.first_name} ${from.last_name || ""}\n`;
          if (from.username) adminNotice += `🏷 <b>آیدی:</b> @${from.username}\n`;
          adminNotice += `🔢 <b>شناسه عددی کاربر:</b> <code>${from.id}</code>\n`;
          adminNotice += `📅 <b>زمان:</b> ${new Date().toLocaleTimeString("fa-IR")}\n`;
          adminNotice += `━━━━━━━━━━━━━━━━━━━━\n`;
          adminNotice += `💬 <b>متن پیام/پیشنهاد:</b>\n<blockquote>${text}</blockquote>\n\n`;
          adminNotice += `👇 برای ارسال پاسخ به این کاربر، دکمه زیر را لمس فرمایید:`;

          const inlineKeyboard = [
            [{ text: `✍️ پاسخ مستقیم به کاربر (${from.first_name})`, callback_data: `admin_reply:${from.id}`, style: "primary" }],
          ];

          await callTelegramApi(token, "sendMessage", {
            chat_id: adminId,
            text: adminNotice,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: inlineKeyboard },
          });
        }

        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: `✅ <b>پیام و نظر ارزشمند شما با موفقیت به مدیریت کانال ارسال شد.</b>\nاز همراهی و توجه شما صمیمانه سپاسگزاریم! 🌸`,
          parse_mode: "HTML",
          reply_markup: getPersistentKeyboardForUser(from.id),
        });
        return;
      }

      // Handle Admin Replying to Feedback state
      if (sess?.mode === "admin_replying" && sess.replyToUserId && isBotAdmin(from.id) && text && !text.startsWith("/")) {
        const targetUserId = sess.replyToUserId;
        userSessionStates.set(from.id, { mode: "none", lastUpdated: Date.now() });

        let replyMsg = `📩 <b>پاسخ مدیریت کانال حسابداری و مالیات به نظر/پیام شما:</b>\n`;
        replyMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
        replyMsg += `<blockquote>${text}</blockquote>\n\n`;
        replyMsg += `🌸 با آرزوی موفقیت روزافزون شما در یادگیری حسابداری`;

        const sendRes = await callTelegramApi(token, "sendMessage", {
          chat_id: targetUserId,
          text: replyMsg,
          parse_mode: "HTML",
        });

        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: sendRes.ok
            ? `✅ <b>پاسخ شما با موفقیت برای کاربر ارسال شد.</b> (شناسه: <code>${targetUserId}</code>)`
            : `❌ خطا در ارسال پاسخ: ${sendRes.description || "نامشخص"}`,
          parse_mode: "HTML",
          reply_markup: getPersistentKeyboardForUser(from.id),
        });
        return;
      }

      // Handle Free Text Journal Entry (e.g. بدهکار: اثاثه ۵۰ میلیون / بستانکار: بانک ۲۰ م)
      const hasJournalKeywords =
        text.includes("بدهکار") ||
        text.includes("بستانکار") ||
        text.includes("بد:") ||
        text.includes("بس:") ||
        text.includes("بد ") ||
        text.includes("بس ");

      if ((sess?.mode === "journal_active" || hasJournalKeywords) && text && !text.startsWith("/")) {
        const activeScenarioId = sess?.scenarioId || "sc-1";
        const scenario = getJournalScenario(activeScenarioId);

        const parsedArticles = parseFreeTextJournalEntry(text, scenario);
        if (parsedArticles.length > 0) {
          if (!sess) {
            sess = { mode: "journal_active", scenarioId: scenario.id, draftArticles: [], lastUpdated: Date.now() };
          }
          sess.draftArticles = parsedArticles;
          userSessionStates.set(from.id, sess);

          const evalRes = evaluateJournalSubmission(scenario, parsedArticles);

          if (evalRes.isCorrect) {
            const recRes = recordJournalSuccess(from.id, scenario.id, {
              firstName: from.first_name,
              lastName: from.last_name,
              username: from.username,
            });

            const scenarioMsg = formatJournalScenarioMessage(scenario.id, recRes.user, parsedArticles, evalRes);
            await callTelegramApi(token, "sendMessage", {
              chat_id: chatId,
              text: scenarioMsg.text,
              parse_mode: "HTML",
              reply_markup: scenarioMsg.reply_markup,
            });
            return;
          } else {
            const scenarioMsg = formatJournalScenarioMessage(scenario.id, user, parsedArticles, evalRes);
            await callTelegramApi(token, "sendMessage", {
              chat_id: chatId,
              text: scenarioMsg.text,
              parse_mode: "HTML",
              reply_markup: scenarioMsg.reply_markup,
            });
            return;
          }
        }
      }

      // Handle /start (with optional deep-linking: /start quiz_5)
      if (text.startsWith("/start")) {
        const parts = text.split(" ");
        if (parts.length > 1 && parts[1].startsWith("quiz_")) {
          const dayNum = parseInt(parts[1].replace("quiz_", ""), 10) || currentDayNumber;
          const quizMsg = formatQuizMessage(dayNum, user);
          await callTelegramApi(token, "sendMessage", {
            chat_id: chatId,
            text: quizMsg.text,
            parse_mode: "HTML",
            reply_markup: quizMsg.reply_markup,
          });
          return;
        }

        if (parts.length > 1 && (parts[1] === "rank" || parts[1] === "leaderboard")) {
          const lbMsg = formatLeaderboardMessage(from.id);
          await callTelegramApi(token, "sendMessage", {
            chat_id: chatId,
            text: lbMsg.text,
            parse_mode: "HTML",
            reply_markup: lbMsg.reply_markup,
          });
          return;
        }

        if (parts.length > 1 && (parts[1] === "bank" || parts[1] === "quizzes")) {
          const pageMsg = formatQuizPageMessage(1, user);
          await callTelegramApi(token, "sendMessage", {
            chat_id: chatId,
            text: pageMsg.text,
            parse_mode: "HTML",
            reply_markup: pageMsg.reply_markup,
          });
          return;
        }

        // Ensure chat menu button is explicitly set for this user chat
        try {
          await callTelegramApi(token, "setChatMenuButton", {
            chat_id: chatId,
            menu_button: { type: "commands" },
          });
        } catch (_e) {}

        // Send persistent keyboard first to place menu button in chat bar
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: `✨ <b>منوی دسترسی سریع ربات فعال شد.</b>\nمی‌توانید از دکمه‌های زیر کادر چت یا دکمه‌های شیشه‌ای زیر استفاده نمایید:`,
          parse_mode: "HTML",
          reply_markup: getPersistentKeyboardForUser(from.id),
        });

        const menuMsg = formatMainMenuMessage(user);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: menuMsg.text,
          parse_mode: "HTML",
          reply_markup: menuMsg.reply_markup,
        });
        return;
      }

      // Handle /id or /myid (نمایش شناسه عددی کاربر جهت تنظیم در پنل)
      if (text === "/id" || text === "/myid" || text === "شناسه من" || text === "آیدی من") {
        const isAdmin = isBotAdmin(from.id);
        let idMsg = `🆔 <b>شناسه عددی تلگرام شما:</b> <code>${from.id}</code>\n`;
        idMsg += `👤 <b>نام:</b> ${from.first_name} ${from.last_name || ""}\n`;
        if (from.username) idMsg += `🏷 <b>نام‌کاربری:</b> @${from.username}\n`;
        idMsg += `🛡 <b>سطح دسترسی:</b> ${isAdmin ? "👑 مدیر سامانه (Admin)" : "👤 کاربر عادی"}\n\n`;
        if (!isAdmin) {
          idMsg += `💡 اگر شما مالک/مدیر سامانه هستید، این شناسه عددی (<code>${from.id}</code>) را در <b>پنل وب -> تنظیمات -> شناسه ادمین تلگرام</b> وارد نمایید یا دستور <code>/claim</code> را ارسال فرمایید.`;
        }
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: idMsg,
          parse_mode: "HTML",
          reply_markup: getPersistentKeyboardForUser(from.id),
        });
        return;
      }

      // Handle /claim (Claim admin rights if not claimed or for owner)
      if (text === "/claim" || text === "/claim_admin") {
        const conf = loadServerBotConfig();
        process.env.TELEGRAM_ADMIN_CHAT_ID = String(from.id);
        saveServerBotConfig({
          ...conf,
          telegramAdminChatId: String(from.id),
        });
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: `👑 <b>تبریک! شناسه شما (<code>${from.id}</code>) به عنوان مدیر کل سامانه حسابداری تأیید شد.</b>\n\nاکنون می‌توانید از دستور <code>/admin</code> یا دکمه «پنل مدیریت» در کیبورد استفاده کنید.`,
          parse_mode: "HTML",
          reply_markup: getPersistentKeyboardForUser(from.id),
        });
        return;
      }

      // Handle Admin Panel trigger (/admin or keyboard button)
      if (
        text === "/admin" ||
        text === "👑 پنل مدیریت ادمین ⚙️" ||
        text === "پنل مدیریت ادمین" ||
        text === "پنل مدیریت" ||
        text === "ادمین" ||
        text === "مدیریت"
      ) {
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "sendMessage", {
            chat_id: chatId,
            text:
              `⛔️ <b>دسترسی غیرمجاز:</b> این دستور مختص مدیر سامانه حسابداری است.\n\n` +
              `🔢 <b>شناسه عددی تلگرام شما:</b> <code>${from.id}</code>\n\n` +
              `💡 <b>راهنمای فعال‌سازی ادمین:</b>\n` +
              `۱️⃣ در پنل وب به بخش <b>تنظیمات -> توکن‌ها و کانال‌ها</b> بروید و شناسه <code>${from.id}</code> را در کادر <b>شناسه ادمین تلگرام</b> ذخیره کنید.\n` +
              `۲️⃣ یا دستور <code>/claim</code> را در همین چت ارسال نمایید.`,
            parse_mode: "HTML",
            reply_markup: getPersistentKeyboardForUser(from.id),
          });
          return;
        }
        const panelMsg = formatAdminPanelMessage(from.id);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: panelMsg.text,
          parse_mode: "HTML",
          reply_markup: panelMsg.reply_markup,
        });
        return;
      }

      // Handle Backup trigger (/backup or keyboard button)
      if (
        text === "/backup" ||
        text === "📦 دریافت آنی بکاپ 💾" ||
        text === "دریافت آنی بکاپ" ||
        text === "دریافت بکاپ" ||
        text === "پشتیبان" ||
        text === "بکاپ"
      ) {
        if (!isBotAdmin(from.id)) {
          await callTelegramApi(token, "sendMessage", {
            chat_id: chatId,
            text: `⛔️ <b>دسترسی غیرمجاز:</b> دریافت فایل پشتیبان منحصراً مختص مدیر سامانه است.`,
            parse_mode: "HTML",
            reply_markup: getPersistentKeyboardForUser(from.id),
          });
          return;
        }
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: `⏳ <b>در حال آماده‌سازی و ارسال فایل پشتیبان جامع سیستم...</b>`,
          parse_mode: "HTML",
        });
        await sendBackupToChat(token, chatId);
        return;
      }

      // Handle /menu or "منوی اصلی"
      if (
        text === "/menu" ||
        text === "/main" ||
        text === "منوی اصلی" ||
        text === "منو" ||
        text === "خانه" ||
        text === "شروع" ||
        text === "🏠 منوی اصلی" ||
        text === "🏠 منوی اصلی ربات 📌" ||
        text === "منوی اصلی ربات"
      ) {
        try {
          await callTelegramApi(token, "setChatMenuButton", {
            chat_id: chatId,
            menu_button: { type: "commands" },
          });
        } catch (_e) {}

        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: `🏠 <b>منوی اصلی ربات حسابداری:</b>`,
          parse_mode: "HTML",
          reply_markup: getPersistentKeyboardForUser(from.id),
        });

        const menuMsg = formatMainMenuMessage(user);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: menuMsg.text,
          parse_mode: "HTML",
          reply_markup: menuMsg.reply_markup,
        });
        return;
      }

      // Handle /sanad or "📑 کارگاه ثبت سند دستی ✍️"
      if (
        text.startsWith("/sanad") ||
        text === "📑 کارگاه ثبت سند دستی ✍️" ||
        text === "کارگاه ثبت سند دستی" ||
        text === "ثبت سند دستی" ||
        text === "ثبت سند" ||
        text === "سند دستی" ||
        text === "کارگاه سند" ||
        text === "سند"
      ) {
        const parts = text.split(" ");
        if (parts.length > 1) {
          const scIdOrNum = parts[1].trim();
          const num = parseInt(scIdOrNum.replace("sc-", ""), 10);
          if (num >= 1 && num <= 90) {
            const scenario = getJournalScenario(num);
            userSessionStates.set(from.id, {
              mode: "journal_active",
              scenarioId: scenario.id,
              draftArticles: [],
              lastUpdated: Date.now(),
            });
            const scMsg = formatJournalScenarioMessage(scenario.id, user, []);
            await callTelegramApi(token, "sendMessage", {
              chat_id: chatId,
              text: scMsg.text,
              parse_mode: "HTML",
              reply_markup: scMsg.reply_markup,
            });
            return;
          }
        }

        const listMsg = formatJournalListMessage(1, user);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: listMsg.text,
          parse_mode: "HTML",
          reply_markup: listMsg.reply_markup,
        });
        return;
      }

      // Handle /feedback or "📩 انتقاد، پیشنهاد و نظرات"
      if (
        text === "/feedback" ||
        text === "/nazar" ||
        text === "/pishnahad" ||
        text === "📩 انتقاد، پیشنهاد و نظرات" ||
        text === "انتقاد، پیشنهاد و نظرات" ||
        text === "انتقادات و پیشنهادات" ||
        text === "انتقاد و پیشنهاد" ||
        text === "انتقادات" ||
        text === "انتقاد" ||
        text === "پیشنهاد" ||
        text === "نظرات" ||
        text === "نقد"
      ) {
        userSessionStates.set(from.id, {
          mode: "awaiting_feedback",
          lastUpdated: Date.now(),
        });
        const promptMsg = formatFeedbackPromptMessage();
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: promptMsg.text,
          parse_mode: "HTML",
          reply_markup: promptMsg.reply_markup,
        });
        return;
      }

      // Handle /quiz or "📝 آزمون تستی امروز" or similar
      if (
        text === "/quiz" ||
        text === "/azmoon" ||
        text === "/test" ||
        text === "📝 آزمون تستی امروز" ||
        text === "آزمون تستی امروز" ||
        text === "آزمون امروز" ||
        text === "آزمون" ||
        text === "کوییز"
      ) {
        const quizMsg = formatQuizMessage(currentDayNumber, user);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: quizMsg.text,
          parse_mode: "HTML",
          reply_markup: quizMsg.reply_markup,
        });
        return;
      }

      // Handle /bank or "📚 بانک ۹۰ آزمون دوره"
      if (
        text === "/bank" ||
        text === "/allquizzes" ||
        text === "📚 بانک ۹۰ آزمون دوره" ||
        text === "بانک ۹۰ آزمون" ||
        text === "بانک آزمون" ||
        text === "بانک"
      ) {
        const pageMsg = formatQuizPageMessage(1, user);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: pageMsg.text,
          parse_mode: "HTML",
          reply_markup: pageMsg.reply_markup,
        });
        return;
      }

      // Handle /karname or /stats or "🏆 کارنامه و رتبه من"
      if (
        text === "/stats" ||
        text === "/karname" ||
        text === "/score" ||
        text === "🏆 کارنامه و رتبه من" ||
        text === "کارنامه و رتبه من" ||
        text === "کارنامه من" ||
        text === "کارنامه" ||
        text === "امتیاز من" ||
        text === "امتیاز"
      ) {
        const statsMsg = formatUserStatsMessage(user);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: statsMsg.text,
          parse_mode: "HTML",
          reply_markup: statsMsg.reply_markup,
        });
        return;
      }

      // Handle /rank or /leaderboard or "🥇 جدول نخبگان"
      if (
        text === "/rank" ||
        text === "/leaderboard" ||
        text === "🥇 جدول نخبگان" ||
        text === "جدول نخبگان" ||
        text === "جدول رتبه‌بندی" ||
        text === "رتبه بندی" ||
        text === "رتبه"
      ) {
        const lbMsg = formatLeaderboardMessage(from.id);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: lbMsg.text,
          parse_mode: "HTML",
          reply_markup: lbMsg.reply_markup,
        });
        return;
      }

      // Handle /lesson or "📖 درس و آموزش امروز"
      if (
        text.startsWith("/lesson") ||
        text === "📖 درس و آموزش امروز" ||
        text === "درس و آموزش امروز" ||
        text === "درس امروز" ||
        text === "آموزش امروز" ||
        text === "آموزش" ||
        text === "درس"
      ) {
        let dayNum = currentDayNumber;
        const parts = text.split(" ");
        if (parts.length > 1) {
          const parsed = parseInt(parts[1], 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 90) dayNum = parsed;
        }
        const lessonMsg = formatLessonMessage(dayNum);
        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: lessonMsg.text,
          parse_mode: "HTML",
          reply_markup: lessonMsg.reply_markup,
        });
        return;
      }

      // Handle /help or "❓ راهنما و پشتیبانی"
      if (
        text === "/help" ||
        text === "❓ راهنما و پشتیبانی" ||
        text === "راهنما و پشتیبانی" ||
        text === "راهنما" ||
        text === "پشتیبانی"
      ) {
        let helpText = `❓ <b>راهنمای دستورات و منوی ربات حسابداری:</b>\n\n`;
        helpText += `🔹 /start : منوی اصلی و فعال‌سازی کیبورد\n`;
        helpText += `🔹 /quiz : باز کردن آزمون تستی روز جاری\n`;
        helpText += `🔹 /bank : مشاهده بانک ۹۰ روز آزمون دوره\n`;
        helpText += `🔹 /karname : مشاهده کارنامه، درصد قبولی و رتبه\n`;
        helpText += `🔹 /rank : جدول رتبه‌بندی نخبگان و برترین‌ها\n`;
        helpText += `🔹 /lesson : مشاهده آموزش مفهومی و سند دوبل روز\n`;
        helpText += `🔹 /sanad : کارگاه تعاملی ثبت سند دستی حسابداری\n`;
        helpText += `🔹 /feedback : ارسال انتقادات، پیشنهادات و نظرات به ادمین\n`;
        helpText += `🔹 /admin : پنل مدیریت و دریافت بکاپ\n`;
        helpText += `🔹 /backup : دریافت فایل پشتیبان سیستم\n\n`;
        helpText += `✨ <i>تمامی آزمون‌ها و کارگاه ثبت سند با دکمه‌های شیشه‌ای تعاملی قابل انجام بوده و سوابق شما اختصاصی ذخیره می‌شود.</i>`;

        const inlineKeyboard = [
          [
            { text: `📝 شروع آزمون امروز 🎯`, callback_data: `q_today` },
            { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu` },
          ],
        ];

        await callTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: helpText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return;
      }

      // Default response -> Show Main Menu with Persistent Keyboard
      await callTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `✨ <b>منوی اصلی ربات:</b>`,
        parse_mode: "HTML",
        reply_markup: getPersistentKeyboardForUser(from.id),
      });

      const menuMsg = formatMainMenuMessage(user);
      await callTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: menuMsg.text,
        parse_mode: "HTML",
        reply_markup: menuMsg.reply_markup,
      });
    }
  } catch (err: any) {
    console.error("Error processing telegram update:", err);
  }
}

let pollingError = "";
let lastActiveTimestamp = "";
let totalUpdatesCount = 0;

// Start Long Polling Engine for Telegram Bot with Supervisor
export function startTelegramLongPolling(tokenGetter: () => string, dayNumberGetter: () => number) {
  if (isPollingActive) return;
  isPollingActive = true;
  pollingAbortController = new AbortController();

  console.log("⚡ Starting Telegram Bot Interactive Long-Polling Engine for In-Bot Quizzes...");

  async function pollLoop() {
    let commandsRegistered = false;

    while (isPollingActive) {
      const token = sanitizeValue(tokenGetter() || loadServerBotConfig().telegramToken);
      if (!token) {
        pollingError = "توکن تلگرام تنظیم نشده است";
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      try {
        // Register Telegram Bot commands and menu button once
        if (!commandsRegistered) {
          try {
            await callTelegramApi(token, "deleteWebhook", { drop_pending_updates: false });
          } catch (_w) {}
          const initRes = await initializeBotCommands(token);
          if (initRes.ok) {
            commandsRegistered = true;
            pollingError = "";
          } else {
            pollingError = initRes.error || "خطا در ثبت منو";
          }
        }

        // Ensure we have bot username
        if (!botUsername) {
          try {
            const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
            const meData = await meRes.json();
            if (meData.ok && meData.result?.username) {
              botUsername = meData.result.username;
              console.log(`🤖 Telegram Bot Connected: @${botUsername}`);
            }
          } catch (e) {
            // ignore
          }
        }

        const pollBody: Record<string, any> = {
          timeout: 20,
          allowed_updates: ["message", "callback_query"],
        };
        if (lastUpdateId > 0) {
          pollBody.offset = lastUpdateId + 1;
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pollBody),
          signal: AbortSignal.timeout(35000),
        });
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          pollingError = "";
          lastActiveTimestamp = new Date().toISOString();
          const currentDay = dayNumberGetter();
          if (data.result.length > 0) {
            console.log(`[TelegramPolling] Received ${data.result.length} update(s) from Telegram.`);
          }
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            totalUpdatesCount++;
            processTelegramUpdate(token, update, currentDay).catch((e) =>
              console.error("[TelegramPolling] Error handling update:", e)
            );
          }
        } else if (!data.ok) {
          pollingError = data.description || `Telegram Error ${data.error_code}`;
          console.warn(`[TelegramPolling] getUpdates failed (${data.error_code}): ${pollingError}`);
          if (data.error_code === 409) {
            try {
              console.log("[TelegramPolling] 409 Conflict detected. Re-deleting webhook to restore polling...");
              await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
            } catch (ignore) {}
          }
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          pollingError = err.message || "خطای اتصال به سرور تلگرام";
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  async function supervisor() {
    while (isPollingActive) {
      try {
        await pollLoop();
      } catch (fatal) {
        console.error("[TelegramPolling] Unexpected loop failure, auto-restarting in 2s:", fatal);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  supervisor();
}

// Notify token changed or re-register menu
export async function notifyBotTokenChanged(newToken?: string) {
  const token = (newToken || loadServerBotConfig().telegramToken || "").trim();
  if (!token) return { ok: false, error: "توکن تلگرام موجود نیست." };

  try {
    const res = await initializeBotCommands(token);
    if (res.ok) {
      pollingError = "";
    }
    // Restart polling abort controller if active to break out of any idle sleep
    if (pollingAbortController) {
      pollingAbortController.abort();
      pollingAbortController = new AbortController();
    }
    return res;
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// Get comprehensive status of telegram bot engine
export function getTelegramBotStatus() {
  const currentToken = loadServerBotConfig().telegramToken;
  return {
    isPollingActive,
    botUsername,
    hasToken: Boolean(currentToken),
    tokenPrefix: currentToken ? currentToken.slice(0, 10) + "..." : "",
    pollingError,
    lastActiveTimestamp,
    totalUpdatesCount,
  };
}

// Stop long polling
export function stopTelegramLongPolling() {
  isPollingActive = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
}

export function getBotUsername(): string {
  return botUsername;
}
