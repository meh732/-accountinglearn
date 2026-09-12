import fs from "fs";
import path from "path";
import { getOrCreateDayItem, initialThreeMonthCurriculum } from "./src/data/threeMonthCurriculum";
import { initialDailyQuizzes } from "./src/data/quizData";
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

export interface TelegramBotUser {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  firstSeenAt: string;
  lastActiveAt: string;
  totalScore: number; // 10 points per correct quiz
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  streakDays: number;
  answers: Record<string, TelegramQuizAnswer>; // key: dayNumber as string
}

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

// Check if user is recognized as main administrator
export function isBotAdmin(userIdOrChatId: number | string): boolean {
  const cleanId = sanitizeValue(userIdOrChatId);
  if (!cleanId) return false;
  const conf = loadServerBotConfig();
  const envAdmin = sanitizeValue(process.env.TELEGRAM_ADMIN_CHAT_ID);
  const confAdmin = sanitizeValue(conf.telegramAdminChatId);
  return (envAdmin !== "" && cleanId === envAdmin) || (confAdmin !== "" && cleanId === confAdmin);
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
    text += `\n⭐️ <b>امتیاز کل شما:</b> ${user?.totalScore || 0} | 📊 <b>آزمون‌های حل‌شده:</b> ${user?.correctCount || 0} از ${user?.totalAnswered || 0}`;
  } else {
    text += `\n👇 <b>لطفاً یکی از گزینه‌های شیشه‌ای زیر را لمس کنید:</b>`;
  }

  // Inline Keyboard Buttons (دکمه‌های شیشه‌ای رنگی با قابلیت style تلگرام)
  const inlineKeyboard: any[][] = [];

  if (!userAnswer) {
    // 4 option buttons with style colors (primary: آبی, success: سبز, danger: قرمز)
    inlineKeyboard.push([
      { text: `🔵 ۱) گزینه یک`, callback_data: `q_ans:${dayNumber}:0`, style: "primary" },
      { text: `🟢 ۲) گزینه دو`, callback_data: `q_ans:${dayNumber}:1`, style: "success" },
    ]);
    inlineKeyboard.push([
      { text: `🟡 ۳) گزینه سه`, callback_data: `q_ans:${dayNumber}:2`, style: "primary" },
      { text: `🟣 ۴) گزینه چهار`, callback_data: `q_ans:${dayNumber}:3`, style: "danger" },
    ]);
  } else {
    // Nav buttons after answering
    const navRow = [];
    if (dayNumber > 1) {
      navRow.push({ text: `⬅️ روز قبلی (${dayNumber - 1})`, callback_data: `q_show:${dayNumber - 1}`, style: "primary" });
    }
    if (dayNumber < 90) {
      navRow.push({ text: `➡️ روز بعدی (${dayNumber + 1})`, callback_data: `q_show:${dayNumber + 1}`, style: "primary" });
    }
    if (navRow.length > 0) inlineKeyboard.push(navRow);

    inlineKeyboard.push([
      { text: `🔄 حل مجدد همین آزمون 🔁`, callback_data: `q_retake:${dayNumber}`, style: "danger" },
      { text: `📖 مطالعه درس روز ${dayNumber} ☀️`, callback_data: `q_lesson:${dayNumber}`, style: "primary" },
    ]);
  }

  // Utility row with rich icons and background styles
  inlineKeyboard.push([
    { text: `🏆 کارنامه و رتبه من ⭐️`, callback_data: `my_stats`, style: "success" },
    { text: `📚 بانک ۹۰ آزمون ⚡️`, callback_data: `q_page:1`, style: "primary" },
  ]);
  inlineKeyboard.push([
    { text: `🥇 جدول رتبه‌بندی نخبگان 💎`, callback_data: `leaderboard`, style: "primary" },
    { text: `🏠 منوی اصلی ربات 📌`, callback_data: `main_menu`, style: "primary" },
  ]);

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Persistent Reply Keyboard for Telegram Chat Bar (مربع منو در پایین کادر چت)
export const BOT_PERSISTENT_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: "📝 آزمون تستی امروز" }, { text: "🏆 کارنامه و رتبه من" }],
    [{ text: "📚 بانک ۹۰ آزمون دوره" }, { text: "🥇 جدول نخبگان" }],
    [{ text: "📖 درس و آموزش امروز" }, { text: "❓ راهنما و پشتیبانی" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Return persistent reply keyboard customized for role (shows Admin & Backup buttons for admin)
export function getPersistentKeyboardForUser(userIdOrChatId: number | string) {
  if (isBotAdmin(userIdOrChatId)) {
    return {
      keyboard: [
        [{ text: "📝 آزمون تستی امروز" }, { text: "📚 بانک ۹۰ آزمون دوره" }],
        [{ text: "🏆 کارنامه و رتبه من" }, { text: "📖 درس و آموزش امروز" }],
        [{ text: "👑 پنل مدیریت ادمین ⚙️" }, { text: "📦 دریافت آنی بکاپ 💾" }],
        [{ text: "🏠 منوی اصلی ربات" }, { text: "❓ راهنما و پشتیبانی" }],
      ],
      resize_keyboard: true,
      is_persistent: true,
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
        { command: "quiz", description: "📝 آزمون تستی روز جاری" },
        { command: "bank", description: "📚 بانک ۹۰ آزمون دوره" },
        { command: "karname", description: "🏆 کارنامه، امتیاز و رتبه من" },
        { command: "rank", description: "🥇 جدول رتبه‌بندی نخبگان" },
        { command: "lesson", description: "📖 درس و سرفصل آموزشی امروز" },
        { command: "admin", description: "👑 پنل مدیریت و دریافت بکاپ" },
        { command: "backup", description: "📦 دریافت فایل پشتیبان سیستم" },
        { command: "help", description: "❓ راهنما و پشتیبانی" },
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
  text += `به <b>ربات جامع آموزش و آزمون‌های تخصصی حسابداری و مالیات ایران</b> خوش آمدید! 🇮🇷✨\n\n`;
  text += `📌 <b>امکانات سامانه هوشمند:</b>\n`;
  text += `🔹 شرکت در آزمون‌های تستی روزانه دوره ۳ ماهه با دکمه‌های شیشه‌ای رنگی\n`;
  text += `🔹 ثبت خودکار و اختصاصی کارنامه و امتیاز برای حساب کاربری شما\n`;
  text += `🔹 دریافت تحلیل تشریحی با استناد به قوانین مالیاتی و استانداردهای ایران\n`;
  text += `🔹 مشاهده رتبه و رقابت در جدول نخبگان حسابداری کانال\n\n`;
  text += `⭐️ <b>امتیاز فعلی شما:</b> ${user.totalScore} امتیاز | 🎯 <b>حل‌شده:</b> ${user.correctCount} از ${user.totalAnswered}\n\n`;
  if (channelSignature) text += `${channelSignature}\n\n`;
  text += `👇 <b>لطفاً بخش مورد نظر خود را از دکمه‌های زیر یا منوی پایین چت انتخاب کنید:</b>`;

  const inlineKeyboard: any[][] = [];

  if (isBotAdmin(user.userId)) {
    inlineKeyboard.push([
      { text: `👑 پنل مدیریت و دریافت فایل پشتیبان (بکاپ) 📦`, callback_data: `admin_panel`, style: "success" },
    ]);
  }

  inlineKeyboard.push(
    [
      { text: `📝 شروع آزمون تستی امروز 🎯`, callback_data: `q_today`, style: "success" },
    ],
    [
      { text: `📚 بانک جامع ۹۰ آزمون دوره ⚡️`, callback_data: `q_page:1`, style: "primary" },
      { text: `🏆 کارنامه و سوابق من ⭐️`, callback_data: `my_stats`, style: "success" },
    ],
    [
      { text: `🥇 جدول رتبه‌بندی نخبگان 💎`, callback_data: `leaderboard`, style: "primary" },
      { text: `📖 آموزش روز (درس امروز) ☀️`, callback_data: `q_lesson_today`, style: "primary" },
    ],
    [
      { text: `❓ راهنمای دستورات ربات 💡`, callback_data: `help_cmd`, style: "primary" },
    ]
  );

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

// Format Admin Control and Backup Panel
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
      { text: `📦 دریافت آنی فایل کامل بکاپ 💾`, callback_data: `admin_backup` },
    ],
    [
      { text: `📥 راهنمای بازگردانی سریع اطلاعات 🔄`, callback_data: `admin_restore_info` },
    ],
    [
      { text: `☀️ ارسال فوری صبح (۰۹:۰۰)`, callback_data: `admin_post:morning` },
      { text: `🛠 ارسال فوری ظهر (۱۴:۳۰)`, callback_data: `admin_post:noon` },
    ],
    [
      { text: `📝 ارسال فوری عصر (۲۰:۰۰)`, callback_data: `admin_post:evening` },
      { text: `🌙 ارسال فوری شب (۲۲:۳۰)`, callback_data: `admin_post:late_night` },
    ],
    [
      { text: `➕ یک روز جلو (+1)`, callback_data: `admin_day:plus` },
      { text: `➖ یک روز عقب (-1)`, callback_data: `admin_day:minus` },
    ],
    [
      { text: `🔄 ثبت مجدد دکمه منو در تلگرام`, callback_data: `admin_sync_menu` },
      { text: `🏠 منوی اصلی ربات`, callback_data: `main_menu` },
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
      is_persistent: markup.is_persistent ?? true,
      one_time_keyboard: markup.one_time_keyboard ?? false,
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
            { text: `1️⃣ گزینه ۱`, callback_data: `q_ans:${day}:0` },
            { text: `2️⃣ گزینه ۲`, callback_data: `q_ans:${day}:1` },
          ],
          [
            { text: `3️⃣ گزینه ۳`, callback_data: `q_ans:${day}:2` },
            { text: `4️⃣ گزینه ۴`, callback_data: `q_ans:${day}:3` },
          ],
          [
            { text: `🏆 کارنامه من`, callback_data: `my_stats` },
            { text: `📚 بانک ۹۰ آزمون`, callback_data: `q_page:1` },
          ],
          [
            { text: `🏠 منوی اصلی`, callback_data: `main_menu` },
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
        helpText += `🔹 /admin : پنل مدیریت و دریافت بکاپ (مخصوص ادمین)\n`;
        helpText += `🔹 /backup : دریافت فوری فایل بکاپ (مخصوص ادمین)\n\n`;
        helpText += `✨ <i>تمامی آزمون‌ها با دکمه‌های شیشه‌ای تعاملی قابل انجام بوده و سوابق شما اختصاصی ذخیره می‌شود.</i>`;

        const inlineKeyboard = [
          [
            { text: `📝 شروع آزمون`, callback_data: `q_today` },
            { text: `🏠 منوی اصلی`, callback_data: `main_menu` },
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
            { text: `📦 دریافت فایل فعلی بکاپ 💾`, callback_data: `admin_backup` },
            { text: `👑 بازگشت به پنل ادمین`, callback_data: `admin_panel` },
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
            text: `⛔️ <b>دسترسی غیرمجاز:</b> این دستور منحصراً مختص مدیر سامانه حسابداری است.`,
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
        helpText += `🔹 /admin : پنل مدیریت و دریافت بکاپ\n`;
        helpText += `🔹 /backup : دریافت فایل پشتیبان سیستم\n\n`;
        helpText += `✨ <i>تمامی آزمون‌ها با دکمه‌های شیشه‌ای تعاملی قابل انجام بوده و سوابق شما اختصاصی ذخیره می‌شود.</i>`;

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
        } else {
          // On fresh start, pull last 10 updates so pending /start or /menu is processed immediately
          pollBody.offset = -10;
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
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            totalUpdatesCount++;
            processTelegramUpdate(token, update, currentDay).catch((e) =>
              console.error("Error handling update in loop:", e)
            );
          }
        } else if (!data.ok) {
          pollingError = data.description || `Telegram Error ${data.error_code}`;
          if (data.error_code === 409) {
            try {
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
