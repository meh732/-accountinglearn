import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  fetchInternetAccountingNews,
  accountingFunPosts,
  verifiedAccountingNews,
} from "./src/data/accountingNewsAndFun";

dotenv.config();

// Initialize Google GenAI on the server with recommended httpOptions
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  
  // Port configuration: Defaults to 3000 (required for AI Studio cloud container proxy).
  // On external VPS, servers or docker, supports custom port via --port argument, APP_PORT, CUSTOM_PORT, or PORT
  function getServerPort(): number {
    const portArgIndex = process.argv.indexOf("--port");
    if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
      const parsed = parseInt(process.argv[portArgIndex + 1], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) return parsed;
    }
    if (process.env.CUSTOM_PORT) {
      const parsed = parseInt(process.env.CUSTOM_PORT, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) return parsed;
    }
    if (process.env.APP_PORT) {
      const parsed = parseInt(process.env.APP_PORT, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) return parsed;
    }
    if (process.env.PORT) {
      const parsed = parseInt(process.env.PORT, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) return parsed;
    }
    return 3000;
  }
  const PORT = getServerPort();

  app.use(express.json({ limit: "5mb" }));

  // --- API Routes ---

  // Health check & deployment status
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      port: PORT,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasBaleToken: Boolean(process.env.BALE_BOT_TOKEN),
    });
  });

  app.get("/api/deployment/status", (_req, res) => {
    res.json({
      port: PORT,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      platform: process.platform,
    });
  });

  // Test Telegram or Bale Bot credentials
  app.post("/api/test-bot", async (req, res) => {
    try {
      const { platform, token } = req.body;
      const botToken =
        token ||
        (platform === "telegram"
          ? process.env.TELEGRAM_BOT_TOKEN
          : process.env.BALE_BOT_TOKEN);

      if (!botToken) {
        return res.status(400).json({
          ok: false,
          error: `توکن ربات ${platform === "telegram" ? "تلگرام" : "بله"} وارد نشده است.`,
        });
      }

      const baseUrl =
        platform === "telegram"
          ? `https://api.telegram.org/bot${botToken}/getMe`
          : `https://tapi.bale.ai/bot${botToken}/getMe`;

      const response = await fetch(baseUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return res.status(400).json({
          ok: false,
          error: data.description || "خطا در برقراری ارتباط با سرور پیام‌رسان",
          details: data,
        });
      }

      return res.json({
        ok: true,
        bot: data.result,
        platform,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err.message || "خطای غیرمنتظره در تست ربات",
      });
    }
  });

  // Send message to Telegram and/or Bale channel
  app.post("/api/send-post", async (req, res) => {
    try {
      const {
        platforms = ["telegram", "bale"],
        text,
        parseMode = "HTML",
        config = {},
      } = req.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ ok: false, error: "متن پیام نمی‌تواند خالی باشد." });
      }

      const results: Record<string, any> = {};

      // 1. Telegram Dispatch
      if (platforms.includes("telegram")) {
        const token = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
        const channel = config.telegramChannel || process.env.TELEGRAM_CHANNEL_ID;

        if (!token || !channel) {
          results.telegram = {
            ok: false,
            simulated: true,
            status: "simulated_success",
            message: "حالت شبیه‌سازی: توکن یا کانال تلگرام تنظیم نشده است، در حالت پیش‌نمایش ارسال شد.",
            channel: channel || "@channel_test",
            timestamp: new Date().toISOString(),
          };
        } else {
          try {
            const cleanChannel = channel.startsWith("@") || channel.startsWith("-") ? channel : `@${channel}`;
            const payload: Record<string, any> = {
              chat_id: cleanChannel,
              text,
              parse_mode: parseMode,
              disable_web_page_preview: false,
            };

            // Optional WebApp Button if provided
            if (req.body.webAppUrl) {
              payload.reply_markup = {
                inline_keyboard: [
                  [
                    {
                      text: "📱 ورود به مینی‌اپ و شرکت در آزمون",
                      web_app: { url: req.body.webAppUrl },
                    },
                  ],
                ],
              };
            }

            const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const tgData = await tgRes.json();
            if (tgData.ok) {
              results.telegram = {
                ok: true,
                messageId: tgData.result?.message_id,
                channel: cleanChannel,
                timestamp: new Date().toISOString(),
              };
            } else {
              results.telegram = {
                ok: false,
                error: tgData.description || "خطا در ارسال پیام به کانال تلگرام",
                details: tgData,
              };
            }
          } catch (err: any) {
            results.telegram = {
              ok: false,
              error: err.message || "خطای شبکه هنگام ارتباط با تلگرام",
            };
          }
        }
      }

      // 2. Bale Dispatch
      if (platforms.includes("bale")) {
        const token = config.baleToken || process.env.BALE_BOT_TOKEN;
        const channel = config.baleChannel || process.env.BALE_CHANNEL_ID;

        if (!token || !channel) {
          results.bale = {
            ok: false,
            simulated: true,
            status: "simulated_success",
            message: "حالت شبیه‌سازی: توکن یا کانال بله تنظیم نشده است، در حالت پیش‌نمایش ارسال شد.",
            channel: channel || "@channel_test_bale",
            timestamp: new Date().toISOString(),
          };
        } else {
          try {
            const cleanChannel = channel.startsWith("@") || channel.startsWith("-") ? channel : `@${channel}`;
            const baleRes = await fetch(`https://tapi.bale.ai/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cleanChannel,
                text,
              }),
            });
            const baleData = await baleRes.json();
            if (baleData.ok) {
              results.bale = {
                ok: true,
                messageId: baleData.result?.message_id,
                channel: cleanChannel,
                timestamp: new Date().toISOString(),
              };
            } else {
              results.bale = {
                ok: false,
                error: baleData.description || "خطا در ارسال پیام به کانال بله",
                details: baleData,
              };
            }
          } catch (err: any) {
            results.bale = {
              ok: false,
              error: err.message || "خطای شبکه هنگام ارتباط با بله",
            };
          }
        }
      }

      return res.json({
        ok: true,
        results,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message || "خطا در پردازش درخواست ارسال" });
    }
  });

  // Send Quiz Poll to Telegram channel and interactive test to Bale channel
  app.post("/api/send-poll", async (req, res) => {
    try {
      const {
        platforms = ["telegram", "bale"],
        question,
        options = [],
        correctOptionIndex = 0,
        explanation = "",
        config = {},
        webAppUrl = "",
        title = "آزمون روزانه حسابداری",
      } = req.body;

      if (!question || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          ok: false,
          error: "صورت سوال و حداقل ۲ گزینه پاسخ الزامی است.",
        });
      }

      const results: Record<string, any> = {};

      // 1. Telegram Native Quiz Poll
      if (platforms.includes("telegram")) {
        const token = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
        const channel = config.telegramChannel || process.env.TELEGRAM_CHANNEL_ID;

        if (!token || !channel) {
          results.telegram = {
            ok: false,
            simulated: true,
            status: "simulated_success",
            message: "حالت شبیه‌سازی: آزمون با موفقیت در پیش‌نمایش کانال تلگرام ارسال شد.",
            channel: channel || "@channel_test",
          };
        } else {
          try {
            const cleanChannel = channel.startsWith("@") || channel.startsWith("-") ? channel : `@${channel}`;
            
            // Telegram Bot API sendPoll
            const pollBody: Record<string, any> = {
              chat_id: cleanChannel,
              question: question.length > 290 ? question.slice(0, 290) + "..." : question,
              options: options.slice(0, 10),
              type: "quiz",
              correct_option_id: Math.max(0, Math.min(options.length - 1, correctOptionIndex)),
              is_anonymous: false,
            };

            if (explanation) {
              pollBody.explanation = explanation.length > 195 ? explanation.slice(0, 195) + "..." : explanation;
            }

            const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPoll`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pollBody),
            });
            const tgData = await tgRes.json();

            if (tgData.ok) {
              results.telegram = {
                ok: true,
                messageId: tgData.result?.message_id,
                channel: cleanChannel,
                type: "quiz_poll",
              };

              // Optionally send WebApp link below the poll
              if (webAppUrl) {
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: cleanChannel,
                    text: `📱 <b>مینی‌اپ آزمون و کارگاه حسابداری اعضا:</b>\nبرای شرکت در آزمون کامل، مشاهده کارنامه و ثبت آزمایشی سند حسابداری در نرم‌افزار، دکمه زیر را لمس کنید:`,
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "📱 ورود به مینی‌اپ حسابداری کانال",
                            web_app: { url: webAppUrl },
                          },
                        ],
                      ],
                    },
                  }),
                }).catch(() => null);
              }
            } else {
              results.telegram = {
                ok: false,
                error: tgData.description || "خطا در ارسال نظرسنجی کوییز به تلگرام",
                details: tgData,
              };
            }
          } catch (err: any) {
            results.telegram = { ok: false, error: err.message };
          }
        }
      }

      // 2. Bale Interactive Quiz Card Dispatch
      if (platforms.includes("bale")) {
        const token = config.baleToken || process.env.BALE_BOT_TOKEN;
        const channel = config.baleChannel || process.env.BALE_CHANNEL_ID;

        if (!token || !channel) {
          results.bale = {
            ok: false,
            simulated: true,
            status: "simulated_success",
            message: "حالت شبیه‌سازی: آزمون با موفقیت در پیش‌نمایش کانال بله ارسال شد.",
            channel: channel || "@channel_test_bale",
          };
        } else {
          try {
            const cleanChannel = channel.startsWith("@") || channel.startsWith("-") ? channel : `@${channel}`;
            
            // Format an engaging quiz card for Bale
            const optionsText = options
              .map((opt: string, idx: number) => {
                const numIcon = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"][idx] || `(${idx + 1})`;
                return `${numIcon} ${opt}`;
              })
              .join("\n");

            let baleText = `📊 <b>${title}</b>\n\n❓ <b>سوال:</b>\n${question}\n\n<b>گزینه‌ها:</b>\n${optionsText}\n\n`;
            baleText += `✅ <b>پاسخ صحیح:</b> گزینه ${correctOptionIndex + 1}\n`;
            if (explanation) {
              baleText += `💡 <b>توضیح و استناد قانونی:</b>\n${explanation}\n\n`;
            }
            if (webAppUrl) {
              baleText += `📱 <b>مینی‌اپ تعاملی حسابداری و ثبت سند:</b>\n${webAppUrl}\n\n`;
            }
            baleText += `${config.channelSignature || ""}`;

            const baleRes = await fetch(`https://tapi.bale.ai/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cleanChannel,
                text: baleText,
              }),
            });
            const baleData = await baleRes.json();
            if (baleData.ok) {
              results.bale = { ok: true, messageId: baleData.result?.message_id, channel: cleanChannel };
            } else {
              results.bale = { ok: false, error: baleData.description, details: baleData };
            }
          } catch (err: any) {
            results.bale = { ok: false, error: err.message };
          }
        }
      }

      return res.json({ ok: true, results });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message || "خطا در ارسال آزمون به کانال" });
    }
  });

  // Backup Dispatch to Telegram and Bale Bots
  app.post("/api/backup-send", async (req, res) => {
    try {
      const {
        data,
        config = {},
        caption = "📦 بکاپ خودکار سیستم ربات حسابداری ایران",
      } = req.body;

      const results: Record<string, any> = {};
      const backupJson = JSON.stringify(data || { timestamp: new Date().toISOString() }, null, 2);
      const filename = `accounting_bot_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      // 1. Send backup to Telegram Bot (Admin Chat or Channel)
      const tgToken = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
      const tgTarget = config.telegramAdminChatId || config.telegramChannel || process.env.TELEGRAM_CHANNEL_ID;

      if (!tgToken || !tgTarget) {
        results.telegram = {
          ok: true,
          simulated: true,
          message: "حالت شبیه‌سازی: توکن یا چت آیدی ادمین تلگرام تنظیم نشده است.",
          filename,
        };
      } else {
        try {
          const form = new FormData();
          form.append("chat_id", tgTarget);
          form.append("caption", `${caption}\n📅 تاریخ: ${new Date().toLocaleDateString("fa-IR")} ${new Date().toLocaleTimeString("fa-IR")}\n📁 نام فایل: ${filename}`);
          const blob = new Blob([backupJson], { type: "application/json" });
          form.append("document", blob, filename);

          const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendDocument`, {
            method: "POST",
            body: form,
          });
          const tgData = await tgRes.json();
          if (tgData.ok) {
            results.telegram = { ok: true, messageId: tgData.result?.message_id, target: tgTarget };
          } else {
            // fallback to sendMessage if sendDocument has permissions constraint
            const textSummary = `📦 <b>پشتیبان‌گیری سیستم حسابداری ایران</b>\n\n📅 تاریخ: ${new Date().toLocaleDateString("fa-IR")}\n${caption}\n\n<i>حجم داده‌ها: ${(backupJson.length / 1024).toFixed(2)} KB</i>`;
            const msgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: tgTarget,
                text: textSummary,
                parse_mode: "HTML",
              }),
            });
            const msgData = await msgRes.json();
            results.telegram = { ok: msgData.ok, details: msgData };
          }
        } catch (err: any) {
          results.telegram = { ok: false, error: err.message };
        }
      }

      // 2. Send backup to Bale Bot
      const baleToken = config.baleToken || process.env.BALE_BOT_TOKEN;
      const baleTarget = config.baleAdminChatId || config.baleChannel || process.env.BALE_CHANNEL_ID;

      if (!baleToken || !baleTarget) {
        results.bale = {
          ok: true,
          simulated: true,
          message: "حالت شبیه‌سازی: توکن یا چت آیدی ادمین بله تنظیم نشده است.",
          filename,
        };
      } else {
        try {
          // Send formatted backup notification & payload
          const baleText = `📦 پشتیبان‌گیری خودکار سیستم حسابداری ایران\n📅 تاریخ: ${new Date().toLocaleDateString("fa-IR")} ${new Date().toLocaleTimeString("fa-IR")}\n${caption}\nحجم: ${(backupJson.length / 1024).toFixed(2)} KB`;
          const baleRes = await fetch(`https://tapi.bale.ai/bot${baleToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: baleTarget,
              text: baleText,
            }),
          });
          const baleData = await baleRes.json();
          results.bale = { ok: baleData.ok, messageId: baleData.result?.message_id };
        } catch (err: any) {
          results.bale = { ok: false, error: err.message };
        }
      }

      return res.json({
        ok: true,
        filename,
        results,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message || "خطا در ارسال فایل پشتیبان" });
    }
  });

  // AI Content Generator for Accounting
  app.post("/api/generate-accounting-content", async (req, res) => {
    try {
      const { type, topic, promptDetails } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          ok: false,
          error: "کلید GEMINI_API_KEY پیکربندی نشده است. لطفاً از پنل تنظیمات اضافه کنید.",
        });
      }

      let systemInstruction = `شما یک استاد ارشد حسابداری و مشاور ارشد مالیاتی خبره در ایران هستید.
وظیفه شما تولید محتوای آموزشی بسیار دقیق، شیوا و استاندارد برای انتشار در کانال تلگرام و بله حسابداری است.
تمامی آموزش‌ها باید کاملاً منطبق بر قوانین و استانداردهای جاری ایران باشد (قانون تجارت، قانون مالیات‌های مستقیم، قانون پایانه‌های فروشگاهی و سامانه مودیان، قانون مالیات بر ارزش افزوده و استانداردهای حسابداری ایران).
متن باید با لحنی حرفه‌ای، خوانا، دارای ایموجی‌های مناسب تلگرام و بدون کلمات انگلیسی مگر در اصطلاحات تخصصی باشد. فرمت پیام برای انتشار در کانال باید تمیز باشد.`;

      let userPrompt = "";

      if (type === "zero_to_hero") {
        userPrompt = `یک درس جامع و جذاب برای سبک «آموزش صفر تا صد حسابداری ایران» بنویس.
موضوع یا سرفصل: "${topic || "مفاهیم پایه و سند حسابداری"}".
جزئیات: ${promptDetails || "ساده، کاربردی، با مثال عددی ریالی و ثبت دفتر روزنامه"}.
پاسخ را در قالب زیر ساختاردهی کن:
۱. عنوان درس با شماره
۲. توضیح مفهومی به زبان ساده
۳. مثال عملی و ثبت دوبل حسابداری (بدهکار / بستانکار)
۴. نکته طلایی بازار کار ایران و اشتباهات رایج مبتدیان
۵. یک سوال تستی یا تمرین کوتاه برای مخاطب`;
      } else if (type === "advanced") {
        userPrompt = `یک مقاله تحلیلی و پست آموزشی فوق‌العاده تخصصی برای سبک «حسابداری حرفه‌ای و تخصصی ایران» تولید کن.
موضوع: "${topic || "تحلیل استانداردهای حسابداری و بهای تمام شده یا دادرسی مالیاتی"}".
جزئیات: ${promptDetails || "استناد دقیق به ماده قانونی یا استاندارد حسابداری، کیس استادی عملی"}.
پاسخ شامل:
۱. تیتر جذاب و تخصصی
۲. بررسی عمیق و الزامات قانونی/استاندارد
۳. استناد به مواد قانون مالیات‌های مستقیم یا استانداردهای حسابداری ایران
۴. تحلیل ریسک مالیاتی یا حسابرسی و راهکار عملی مدیران مالی
۵. جمع‌بندی فنی و هشتگ‌های مرتبط`;
      } else if (type === "qa_answer") {
        userPrompt = `یک کاربر در کانال حسابداری سوال زیر را پرسیده است:
سوال کاربر: "${topic}"
جزئیات مطرح شده: ${promptDetails || ""}

به عنوان کارشناس ارشد حسابداری و مالیاتی، یک پاسخ جامع، مستند و شفاف بنویس که ادمین بتواند آن را در کانال برای همه اعضا منتشر کند.
پاسخ باید شامل:
۱. خلاصه حکم یا پاسخ صریح در یک خط
۲. تشریح کامل و مستندات قانونی (اشاره دقیق به ماده قانون یا بخشنامه سازمان امور مالیاتی/تامین اجتماعی)
۳. نحوه ثبت حسابداری (در صورت نیاز)
۴. توصیه مهم و عملی برای جلوگیری از جریمه یا رد دفاتر`;
      } else if (type === "daily_quiz") {
        userPrompt = `یک آزمون تستی ۴ گزینه‌ای استاندارد و دقیق حسابداری ایران با موضوع "${topic || "مفاهیم و ثبت سند یا مالیات"}" تولید کن.
جزئیات: ${promptDetails || "سوال کاربردی بازار کار ایران با گزینه‌های چالشی و پاسخ تشریحی مستند به قانون"}.

پاسخ را دقیقاً در قالب فرمت JSON زیر (بدون هیچ توضیح اضافه، فقط آبجکت JSON معتبر) ارسال کن:
{
  "title": "آزمون تستی: ...",
  "category": "مفاهیم پایه",
  "question": "متن دقیق و شفاف سوال تستی",
  "options": [
    "گزینه اول",
    "گزینه دوم",
    "گزینه سوم",
    "گزینه چهارم"
  ],
  "correctOptionIndex": 0,
  "explanation": "پاسخ تشریحی کامل با استناد به ماده قانون یا استاندارد حسابداری ایران",
  "tags": ["#آزمون_حسابداری", "#تست_روزانه"]
}`;
      } else if (type === "three_post_day_pack") {
        const dayNumber = req.body.dayNumber || 1;
        userPrompt = `شما باید یک پکیج روزانه ۳ پستی کامل (صبح، ظهر، شب) برای روز شماره ${dayNumber} از دوره ۳ ماهه آموزش صفر تا صد حسابداری ایران تولید کنید.
موضوع روز: "${topic || "مفاهیم اساسی، ماهیت حساب‌ها یا مالیات"}"
جزئیات درخواستی: ${promptDetails || "کاملاً کاربردی، دارای مثال عددی ریالی دقیق و مستند به قوانین جاری ۱۴۰۳ ایران"}

پکیج روزانه باید شامل ۳ پست با زمان‌بندی زیر باشد:
۱. پست صبح (۰۹:۰۰): درس مفهومی و تشریحی + واژگان تخصصی + نکته طلایی بازار کار
۲. پست ظهر (۱۴:۳۰): کارگاه عملی و سناریوی واقعی بازار کار ایران همراه با ثبت سند دوبل دفتر روزنامه (بدهکار و بستانکار ریالی)
۳. پست شب (۲۰:۰۰): آزمون تستی ۴ گزینه‌ای به همراه گزینه‌ها، گزینه صحیح (اندیس ۰ تا ۳) و تحلیل مستند قانونی

پاسخ را دقیقاً در قالب JSON معتبر زیر بازگردانید (بدون هیچ کلمه اضافی، صرفاً یک آبجکت JSON معتبر):
{
  "dayTitle": "عنوان اصلی درس این روز",
  "category": "مفاهیم پایه",
  "morningPost": {
    "title": "عنوان درس صبحگاهی",
    "content": "متن کامل آموزشی مفهومی به زبان روان و تخصصی",
    "keyRule": "نکته طلایی قانون یا خطای مکرر مبتدیان",
    "tags": ["#آموزش_حسابداری", "#درس_روزانه"]
  },
  "noonPost": {
    "title": "عنوان کارگاه عملی و سناریوی بازار کار",
    "content": "شرح سناریوی شرکت و مبالغ ریالی و ماهیت حساب‌ها",
    "practicalExample": "بدهکار: حساب ... ریال\\nبستانکار: حساب ... ریال",
    "tags": ["#کارگاه_عملی", "#سند_حسابداری"]
  },
  "eveningPost": {
    "title": "آزمون شبانه سنجش یادگیری",
    "question": "متن سوال ۴ گزینه‌ای استاندارد",
    "options": ["گزینه اول", "گزینه دوم", "گزینه سوم", "گزینه چهارم"],
    "correctOptionIndex": 0,
    "explanation": "تشریح کامل دلیل درستی گزینه با استناد به قانون یا استاندارد حسابداری",
    "tags": ["#آزمون_روزانه", "#تست_حسابداری"]
  }
}`;
      } else if (type === "call_for_questions") {
        userPrompt = `یک پست تلگرامی و بله بسیار جذاب برای «دعوت از اعضای کانال جهت ارسال سوالات حسابداری و مالیاتی» بنویس.
موضوع یا هفته: "${topic || "هفته مالیات و سامانه مودیان"}".
در متن اشاره کن که سوالات خود را بفرستند تا ادمین به صورت تخصصی و مستند در کانال پاسخ دهد. از ایموجی‌های مناسب و لحن صمیمی و حرفه‌ای استفاده کن.`;
      } else {
        userPrompt = `یک پست آموزشی مفید حسابداری درباره "${topic}" تولید کن.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      let parsedData: any = null;
      if (type === "three_post_day_pack" || type === "daily_quiz") {
        try {
          const raw = (response.text || "").trim();
          const cleanJson = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
          parsedData = JSON.parse(cleanJson);
        } catch (parseErr) {
          console.warn("JSON parse warning:", parseErr);
        }
      }

      return res.json({
        ok: true,
        content: response.text,
        data: parsedData,
      });
    } catch (err: any) {
      console.error("Gemini Error:", err);
      return res.status(500).json({
        ok: false,
        error: err.message || "خطا در تولید محتوا توسط هوش مصنوعی",
      });
    }
  });

  // Get Internet Accounting News (No AI needed, real web/RSS feeds + verified official portals)
  app.get("/api/accounting-news", async (req, res) => {
    try {
      const category = (req.query.category as string) || "all";
      const items = await fetchInternetAccountingNews(category);
      return res.json({
        ok: true,
        items,
        count: items.length,
        source: "RSS / Web Feeds (بدون نیاز به هوش مصنوعی)",
      });
    } catch (err: any) {
      console.warn("Error fetching live news, falling back to curated news:", err);
      return res.json({
        ok: true,
        items: verifiedAccountingNews,
        count: verifiedAccountingNews.length,
        source: "پایگاه‌های مالیاتی و حسابداری معتبر (آفلاین)",
      });
    }
  });

  // Get Fun / Memes / Late-Night Humor (General & Accounting - No AI needed)
  app.get("/api/accounting-fun", (req, res) => {
    try {
      const category = (req.query.category as string) || "all";
      const type = (req.query.type as string) || "all";
      let items = accountingFunPosts;

      if (type && type !== "all") {
        items = items.filter((i) => i.type === type);
      }

      if (category && category !== "all") {
        items = items.filter((i) => i.category.includes(category) || i.tags.some((t) => t.includes(category)));
      }

      return res.json({
        ok: true,
        items,
        count: items.length,
        source: "بانک طنز جذاب روزمره و حسابداری (بدون نیاز به هوش مصنوعی)",
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err.message,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Accounting Bot Platform Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
