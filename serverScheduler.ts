import fs from "fs";
import path from "path";
import { getOrCreateDayItem, initialThreeMonthCurriculum } from "./src/data/threeMonthCurriculum";
import {
  verifiedAccountingNews,
  accountingFunPosts,
} from "./src/data/accountingNewsAndFun";
import {
  formatDayPost,
  formatNewsPost,
  formatFunPost,
} from "./src/utils/telegramFormat";
import { BotConfig, DailyPlanMode } from "./src/types";
import { getBotUsername } from "./botInteractiveEngine";
import { loadServerBotConfig } from "./serverBotConfig";

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

export interface SchedulerState {
  enabled: boolean;
  currentDayNumber: number; // 1 to 90
  planMode: DailyPlanMode; // "balanced_mix" | "three_lessons"
  morningTime: string; // default "09:00"
  noonTime: string; // default "14:30"
  eveningTime: string; // default "20:00"
  lateNightTime: string; // default "22:30"
  sendToTelegram: boolean;
  sendToBale: boolean;
  autoAdvanceDay: boolean;
  channelSignature: string;
  autoHashtags: string;
  lastExecutedDate: string;
  executedSlotsToday: string[];
  history: SchedulerHistoryItem[];
  lastRunTimestamp?: string;
  nextScheduledSlot?: {
    slot: string;
    slotTitle: string;
    scheduledTime: string;
    dayNumber: number;
  };
}

const STATE_FILE = path.join(process.cwd(), "scheduler-state.json");

// Default initial state
const defaultState: SchedulerState = {
  enabled: true,
  currentDayNumber: 1,
  planMode: "balanced_mix",
  morningTime: "09:00",
  noonTime: "14:30",
  eveningTime: "20:00",
  lateNightTime: "22:30",
  sendToTelegram: true,
  sendToBale: true,
  autoAdvanceDay: true,
  channelSignature: "📢 کانال تخصصی آموزش حسابداری و مالیات ایران",
  autoHashtags: "#آموزش_حسابداری #مالیات #سامانه_مودیان #قوانین_مالیاتی",
  lastExecutedDate: "",
  executedSlotsToday: [],
  history: [],
};

let schedulerState: SchedulerState = loadState();
let tickerInterval: NodeJS.Timeout | null = null;

function loadState(): SchedulerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    }
  } catch (err) {
    console.warn("[Scheduler] Warning reading state file, using defaults:", err);
  }
  return { ...defaultState };
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(schedulerState, null, 2), "utf8");
  } catch (err) {
    console.error("[Scheduler] Error saving state file:", err);
  }
}

// Get current date & time in Tehran Time (Asia/Tehran)
export function getTehranDateTime(): { date: string; time: string; full: string } {
  const now = new Date();
  try {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    return { date, time, full: `${date} ${time}` };
  } catch (_e) {
    // Fallback if ICU timezone data is unavailable
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date(now.getTime() + 3.5 * 3600 * 1000);
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    return { date, time, full: `${date} ${time}` };
  }
}

// Calculate the next upcoming slot and time
export function computeNextSlot(state: SchedulerState) {
  const { time } = getTehranDateTime();
  const slots = [
    { slot: "morning", slotTitle: "آموزش نوبت صبح (صفر تا صد حسابداری)", time: state.morningTime || "09:00" },
    { slot: "noon", slotTitle: state.planMode === "balanced_mix" ? "اخبار و کارگاه عملی ظهر" : "کارگاه عملی و ثبت سند ظهر", time: state.noonTime || "14:30" },
    { slot: "evening", slotTitle: "آزمون و تست شبانه حسابداری", time: state.eveningTime || "20:00" },
    { slot: "late_night", slotTitle: "طنز و نکات انگیزشی آخر شب", time: state.lateNightTime || "22:30" },
  ];

  for (const s of slots) {
    if (s.time > time && !state.executedSlotsToday.includes(s.slot)) {
      return {
        slot: s.slot,
        slotTitle: s.slotTitle,
        scheduledTime: s.time,
        dayNumber: state.currentDayNumber,
      };
    }
  }

  // If all today's slots passed, next is tomorrow morning
  return {
    slot: "morning",
    slotTitle: "آموزش نوبت صبح فردا (صفر تا صد حسابداری)",
    scheduledTime: `فردا ساعت ${state.morningTime || "09:00"}`,
    dayNumber: state.autoAdvanceDay ? (state.currentDayNumber % 90) + 1 : state.currentDayNumber,
  };
}

// Prepare the text and metadata for a specific slot
export function getSlotContent(
  slot: "morning" | "noon" | "evening" | "late_night",
  dayNumber: number,
  planMode: DailyPlanMode,
  configOverrides?: Partial<BotConfig>
): { title: string; formattedText: string; slotTitle: string } {
  const dayItem = getOrCreateDayItem(dayNumber, initialThreeMonthCurriculum);
  const botConfig: BotConfig = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramChannel: process.env.TELEGRAM_CHANNEL_ID || "",
    baleToken: process.env.BALE_BOT_TOKEN || "",
    baleChannel: process.env.BALE_CHANNEL_ID || "",
    channelTitle: "آکادمی حسابداری و مالیات ایران",
    channelSignature: schedulerState.channelSignature,
    autoHashtags: schedulerState.autoHashtags,
    simulationMode: false,
    ...configOverrides,
  };

  if (slot === "morning") {
    const post = dayItem.posts.find((p) => p.slot === "morning") || dayItem.posts[0];
    const formattedText = formatDayPost(dayNumber, dayItem.title, post, botConfig);
    return {
      title: `درس صبح: ${post.title || dayItem.title}`,
      formattedText,
      slotTitle: "🌅 نوبت صبح: آموزش مفاهیم صفر تا صد حسابداری",
    };
  }

  if (slot === "noon") {
    if (planMode === "balanced_mix") {
      // Balanced mix: Internet / Real Accounting News + Practical takeaway
      const newsIndex = (dayNumber - 1) % verifiedAccountingNews.length;
      const news = verifiedAccountingNews[newsIndex];
      const formattedText = formatNewsPost(news, botConfig);
      return {
        title: `اخبار مالیاتی: ${news.title}`,
        formattedText,
        slotTitle: "📰 نوبت ظهر: تازه‌های خبری و بخشنامه‌های مالیاتی",
      };
    } else {
      // Three lessons: Practical Journal entry
      const post = dayItem.posts.find((p) => p.slot === "noon") || dayItem.posts[1] || dayItem.posts[0];
      const formattedText = formatDayPost(dayNumber, dayItem.title, post, botConfig);
      return {
        title: `کارگاه ظهر: ${post.title || dayItem.title}`,
        formattedText,
        slotTitle: "☀️ نوبت ظهر: کارگاه عملی و ثبت سند دوبل",
      };
    }
  }

  if (slot === "evening") {
    const post = dayItem.posts.find((p) => p.slot === "evening") || dayItem.posts[2] || dayItem.posts[0];
    const formattedText = formatDayPost(dayNumber, dayItem.title, post, botConfig);
    return {
      title: `آزمون شبانه: ${post.title || dayItem.title}`,
      formattedText,
      slotTitle: "🌙 نوبت شب: آزمون تستی و چالش یادگیری",
    };
  }

  // late_night: Fun & Memes
  const funIndex = (dayNumber - 1) % accountingFunPosts.length;
  const fun = accountingFunPosts[funIndex];
  const formattedText = formatFunPost(fun, botConfig);
  return {
    title: `طنز شبانه: ${fun.title}`,
    formattedText,
    slotTitle: "✨ زنگ آخر شب: طنز، لبخند و رفع خستگی حسابداران",
  };
}

// Helper to format/clean Telegram Channel ID or Username
export function cleanTelegramChannel(raw?: string): string {
  if (!raw) return "";
  let ch = raw.trim();
  // Strip URL if user pasted full t.me link
  ch = ch.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, "");
  // If numeric ID (positive or negative)
  if (/^-?\d+$/.test(ch)) {
    // If it's a positive 9-10 digit number that is meant for supergroup/channel, ensure -100 prefix if needed
    if (!ch.startsWith("-") && ch.length >= 9) {
      return `-100${ch}`;
    }
    return ch;
  }
  // Strip leading @ and prepend clean @
  ch = ch.replace(/^@+/, "");
  return `@${ch}`;
}

// Helper to clean Bale Channel
export function cleanBaleChannel(raw?: string): string {
  if (!raw) return "";
  let ch = raw.trim();
  ch = ch.replace(/^(https?:\/\/)?(www\.)?ble\.ir\//i, "");
  if (/^-?\d+$/.test(ch)) {
    return ch;
  }
  ch = ch.replace(/^@+/, "");
  return `@${ch}`;
}

// Ensure Telegram inline keyboard markup strictly adheres to Telegram Bot API specification with style support
function sanitizeTelegramReplyMarkup(markup: any): any {
  if (!markup || !markup.inline_keyboard) return markup;
  return {
    inline_keyboard: markup.inline_keyboard.map((row: any[]) =>
      row.map((btn: any) => {
        const cleanBtn: Record<string, any> = { text: String(btn.text) };
        if (btn.url) cleanBtn.url = btn.url;
        if (btn.callback_data) cleanBtn.callback_data = btn.callback_data;
        if (btn.web_app) cleanBtn.web_app = btn.web_app;
        if (btn.style) cleanBtn.style = String(btn.style);
        return cleanBtn;
      })
    ),
  };
}

// Translate common Telegram Bot errors to clear actionable Persian advice
function translateTelegramError(desc: string, channel: string): string {
  if (desc.includes("chat not found")) {
    return `کانال با آیدی (${channel}) یافت نشد! اگر کانال عمومی است نام کاربری (مثلاً @mychannel) و اگر خصوصی است شناسه عددی با پیشوند -100 را وارد کنید.`;
  }
  if (desc.includes("bot is not a member") || desc.includes("not an administrator") || desc.includes("have no rights to send a message")) {
    return `ربات به عنوان مدیر (ادمین) در کانال عضو نشده است! لطفاً به تنظیمات کانال رفته و ربات را با دسترسی «ارسال پیام» مدیر (Administrator) نمایید.`;
  }
  if (desc.includes("Unauthorized") || desc.includes("Not Found")) {
    return `توکن ربات تلگرام نامعتبر است. لطفاً توکن دریافتی از @BotFather را مجدداً بررسی نمایید.`;
  }
  if (desc.includes("can't parse entities")) {
    return `خطای نگارشی در تگ‌های متن پیام ارسالی.`;
  }
  return desc;
}

// Dispatch message to Telegram & Bale Channels
export async function dispatchToChannels(
  text: string,
  options?: {
    telegramToken?: string;
    telegramChannel?: string;
    baleToken?: string;
    baleChannel?: string;
    replyMarkup?: any;
  }
): Promise<{
  telegram: { ok: boolean; messageId?: number; error?: string; simulated?: boolean };
  bale: { ok: boolean; messageId?: number; error?: string; simulated?: boolean };
}> {
  const serverConfig = loadServerBotConfig();
  const tgToken = (options?.telegramToken || serverConfig.telegramToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const rawTgChannel = (options?.telegramChannel || serverConfig.telegramChannel || process.env.TELEGRAM_CHANNEL_ID || "").trim();
  const baleToken = (options?.baleToken || serverConfig.baleToken || process.env.BALE_BOT_TOKEN || "").trim();
  const rawBaleChannel = (options?.baleChannel || serverConfig.baleChannel || process.env.BALE_CHANNEL_ID || "").trim();

  const tgChannel = cleanTelegramChannel(rawTgChannel);
  const baleChannel = cleanBaleChannel(rawBaleChannel);

  const result = {
    telegram: { ok: false, messageId: undefined as number | undefined, error: undefined as string | undefined, simulated: false },
    bale: { ok: false, messageId: undefined as number | undefined, error: undefined as string | undefined, simulated: false },
  };

  // 1. Telegram Dispatch
  if (tgToken && tgChannel) {
    try {
      const payload: Record<string, any> = {
        chat_id: tgChannel,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      };
      if (options?.replyMarkup) {
        payload.reply_markup = sanitizeTelegramReplyMarkup(options.replyMarkup);
      }

      let tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      let data = await tgRes.json();

      // If Telegram returned "can't parse entities", retry with plain text stripped of HTML tags
      if (!data.ok && typeof data.description === "string" && data.description.includes("can't parse entities")) {
        console.warn("[Scheduler] Telegram HTML entity parse error. Retrying with stripped plain text...");
        const plainText = text.replace(/<[^>]*>/g, "");
        const fallbackPayload = {
          ...payload,
          text: plainText,
          parse_mode: undefined,
        };
        delete fallbackPayload.parse_mode;
        tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fallbackPayload),
          signal: AbortSignal.timeout(15000),
        });
        data = await tgRes.json();
      }

      if (data.ok) {
        result.telegram = { ok: true, messageId: data.result?.message_id, error: undefined, simulated: false };
      } else {
        const translatedErr = translateTelegramError(data.description || "خطای ارسال در تلگرام", tgChannel);
        result.telegram = { ok: false, messageId: undefined, error: translatedErr, simulated: false };
      }
    } catch (err: any) {
      result.telegram = { ok: false, messageId: undefined, error: err.message || "خطای ارتباط با سرور تلگرام (بررسی فیلترینگ یا اینترنت سرور)", simulated: false };
    }
  } else {
    result.telegram = {
      ok: true,
      messageId: undefined,
      simulated: true,
      error: "توکن یا کانال تلگرام تنظیم نشده است (حالت شبیه‌سازی).",
    };
  }

  // 2. Bale Dispatch
  if (baleToken && baleChannel) {
    try {
      const baleRes = await fetch(`https://tapi.bale.ai/bot${baleToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: baleChannel,
          text: text,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await baleRes.json();
      if (data.ok) {
        result.bale = { ok: true, messageId: data.result?.message_id, error: undefined, simulated: false };
      } else {
        result.bale = { ok: false, messageId: undefined, error: data.description || "خطای ارسال در بله", simulated: false };
      }
    } catch (err: any) {
      result.bale = { ok: false, messageId: undefined, error: err.message || "خطای ارتباط با سرور بله", simulated: false };
    }
  } else {
    result.bale = {
      ok: true,
      messageId: undefined,
      simulated: true,
      error: "توکن یا کانال بله تنظیم نشده است (حالت شبیه‌سازی).",
    };
  }

  // 3. Admin Notification (if Telegram admin configured)
  const tgAdmin = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (tgToken && tgAdmin) {
    try {
      const alertText = `🔔 <b>گزارش ربات خودکار حسابداری ایران</b>\n✅ پست با موفقیت به کانال ارسال گردید.\n📅 زمان: ${new Date().toLocaleDateString("fa-IR")} ${new Date().toLocaleTimeString("fa-IR")}`;
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgAdmin,
          text: alertText,
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    } catch (_e) {}
  }

  return result;
}

// Execute a single scheduled slot
export async function executeSlot(
  slot: "morning" | "noon" | "evening" | "late_night",
  options?: { forceDay?: number; manual?: boolean }
): Promise<SchedulerHistoryItem> {
  const day = options?.forceDay || schedulerState.currentDayNumber;
  const { title, formattedText, slotTitle } = getSlotContent(slot, day, schedulerState.planMode);
  const { date, time } = getTehranDateTime();

  console.log(`[Scheduler] 🚀 Publishing slot "${slot}" for Day ${day} at ${time} Tehran Time...`);

  let replyMarkup: any = undefined;
  const botUser = getBotUsername();
  if (botUser) {
    if (slot === "evening") {
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: "🎯 شرکت در آزمون تستی داخل ربات با ثبت کارنامه ⭐️",
              url: `https://t.me/${botUser}?start=quiz_${day}`,
              style: "success",
            },
          ],
          [
            {
              text: "🏆 رتبه‌بندی نخبگان حسابداری 🥇",
              url: `https://t.me/${botUser}?start=rank`,
              style: "primary",
            },
            {
              text: "📚 بانک ۹۰ آزمون تخصصی ⚡️",
              url: `https://t.me/${botUser}?start=bank`,
              style: "primary",
            },
          ],
        ],
      };
    } else if (slot === "morning" || slot === "noon") {
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: `📝 آزمون تستی و تمرین درس امروز (روز ${day}) 🎯`,
              url: `https://t.me/${botUser}?start=quiz_${day}`,
              style: "success",
            },
          ],
          [
            {
              text: "🤖 ورود به ربات جامع آموزش و آزمون ⚡️",
              url: `https://t.me/${botUser}?start=main`,
              style: "primary",
            },
          ],
        ],
      };
    }
  }

  const dispatchResult = await dispatchToChannels(formattedText, { replyMarkup });

  let status: SchedulerHistoryItem["status"] = "success";
  if (dispatchResult.telegram.simulated && dispatchResult.bale.simulated) {
    status = "simulated";
  } else if (!dispatchResult.telegram.ok && !dispatchResult.bale.ok) {
    status = "failed";
  } else if (!dispatchResult.telegram.ok || !dispatchResult.bale.ok) {
    status = "partial";
  }

  const historyItem: SchedulerHistoryItem = {
    id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    tehranTime: `${date} ${time}`,
    dayNumber: day,
    slot: options?.manual ? "manual" : slot,
    slotTitle,
    title,
    status,
    telegramStatus: dispatchResult.telegram,
    baleStatus: dispatchResult.bale,
    contentPreview: formattedText.substring(0, 180) + "...",
  };

  // Record slot in today's executions
  if (!options?.manual) {
    if (!schedulerState.executedSlotsToday.includes(slot)) {
      schedulerState.executedSlotsToday.push(slot);
    }
  }

  // Prepend to history (keep max 50)
  schedulerState.history = [historyItem, ...(schedulerState.history || [])].slice(0, 50);
  schedulerState.lastRunTimestamp = new Date().toISOString();

  // If evening or late_night slot completed, advance the day for tomorrow!
  if (
    schedulerState.autoAdvanceDay &&
    (slot === "evening" || slot === "late_night") &&
    !options?.manual
  ) {
    const nextDay = (schedulerState.currentDayNumber % 90) + 1;
    console.log(`[Scheduler] 📅 Advancing to Day ${nextDay} for next publishing cycle.`);
    schedulerState.currentDayNumber = nextDay;
  }

  saveState();
  return historyItem;
}

// The background ticker that runs every 30 seconds
function runSchedulerTick() {
  if (!schedulerState.enabled) return;

  const { date, time } = getTehranDateTime();

  // Reset daily executed slots on a new day
  if (schedulerState.lastExecutedDate !== date) {
    console.log(`[Scheduler] 🌅 New day detected (${date} Tehran Time). Resetting daily slots.`);
    schedulerState.lastExecutedDate = date;
    schedulerState.executedSlotsToday = [];
    saveState();
  }

  const morningTime = schedulerState.morningTime || "09:00";
  const noonTime = schedulerState.noonTime || "14:30";
  const eveningTime = schedulerState.eveningTime || "20:00";
  const lateNightTime = schedulerState.lateNightTime || "22:30";

  // Check Morning Slot
  if (time === morningTime && !schedulerState.executedSlotsToday.includes("morning")) {
    executeSlot("morning").catch((err) => console.error("[Scheduler] Error in morning slot:", err));
  }

  // Check Noon Slot
  if (time === noonTime && !schedulerState.executedSlotsToday.includes("noon")) {
    executeSlot("noon").catch((err) => console.error("[Scheduler] Error in noon slot:", err));
  }

  // Check Evening Slot
  if (time === eveningTime && !schedulerState.executedSlotsToday.includes("evening")) {
    executeSlot("evening").catch((err) => console.error("[Scheduler] Error in evening slot:", err));
  }

  // Check Late Night Slot
  if (time === lateNightTime && !schedulerState.executedSlotsToday.includes("late_night")) {
    executeSlot("late_night").catch((err) => console.error("[Scheduler] Error in late-night slot:", err));
  }
}

// Start the 24/7 background scheduler engine
export function startSchedulerEngine() {
  if (tickerInterval) {
    clearInterval(tickerInterval);
  }

  console.log("[Scheduler] 🟢 Initializing 24/7 Auto-Pilot Background Publisher...");
  console.log(`[Scheduler] ⏰ Schedule (Tehran Time): Morning: ${schedulerState.morningTime || "09:00"} | Noon: ${schedulerState.noonTime || "14:30"} | Evening: ${schedulerState.eveningTime || "20:00"} | Night: ${schedulerState.lateNightTime || "22:30"}`);
  console.log(`[Scheduler] 📖 Current Course Day: Day ${schedulerState.currentDayNumber} of 90`);

  // Run ticker every 30 seconds
  tickerInterval = setInterval(runSchedulerTick, 30000);
}

// Get full scheduler status for API
export function getSchedulerStatus(): SchedulerState & {
  tehranTimeNow: string;
  hasTelegramToken: boolean;
  hasBaleToken: boolean;
  hasTelegramChannel: boolean;
  hasBaleChannel: boolean;
} {
  const { full } = getTehranDateTime();
  const next = computeNextSlot(schedulerState);

  return {
    ...schedulerState,
    nextScheduledSlot: next,
    tehranTimeNow: full,
    hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasBaleToken: Boolean(process.env.BALE_BOT_TOKEN),
    hasTelegramChannel: Boolean(process.env.TELEGRAM_CHANNEL_ID),
    hasBaleChannel: Boolean(process.env.BALE_CHANNEL_ID),
  };
}

// Update scheduler configuration
export function updateSchedulerConfig(updates: Partial<SchedulerState>): SchedulerState {
  schedulerState = {
    ...schedulerState,
    ...updates,
  };
  saveState();
  console.log("[Scheduler] ⚙️ Configuration updated. Active state:", schedulerState.enabled);
  return getSchedulerStatus();
}
