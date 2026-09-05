import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

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
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // --- API Routes ---

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasBaleToken: Boolean(process.env.BALE_BOT_TOKEN),
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
            const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cleanChannel,
                text,
                parse_mode: parseMode,
                disable_web_page_preview: false,
              }),
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

      return res.json({
        ok: true,
        content: response.text,
      });
    } catch (err: any) {
      console.error("Gemini Error:", err);
      return res.status(500).json({
        ok: false,
        error: err.message || "خطا در تولید محتوا توسط هوش مصنوعی",
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
