import fs from "fs";
import path from "path";

export interface ServerBotConfig {
  telegramToken: string;
  telegramChannel: string;
  telegramAdminChatId?: string;
  baleToken: string;
  baleChannel: string;
  baleAdminChatId?: string;
  channelTitle?: string;
  channelSignature?: string;
  autoHashtags?: string;
  simulationMode?: boolean;
}

const CONFIG_PATH = path.join(process.cwd(), "bot-config.json");

export function loadServerBotConfig(): ServerBotConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(data);
      return {
        telegramToken: parsed.telegramToken || process.env.TELEGRAM_BOT_TOKEN || "",
        telegramChannel: parsed.telegramChannel || process.env.TELEGRAM_CHANNEL_ID || "",
        telegramAdminChatId: parsed.telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || "",
        baleToken: parsed.baleToken || process.env.BALE_BOT_TOKEN || "",
        baleChannel: parsed.baleChannel || process.env.BALE_CHANNEL_ID || "",
        baleAdminChatId: parsed.baleAdminChatId || process.env.BALE_ADMIN_CHAT_ID || "",
        channelTitle: parsed.channelTitle || "آکادمی حسابداری و قوانین مالیاتی ایران",
        channelSignature: parsed.channelSignature || "📢 کانال تخصصی حسابداری ایران",
        autoHashtags: parsed.autoHashtags || "#آموزش_حسابداری #مالیات #سامانه_مودیان",
        simulationMode: parsed.simulationMode ?? false,
      };
    }
  } catch (e) {
    console.error("Error reading bot-config.json:", e);
  }

  return {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramChannel: process.env.TELEGRAM_CHANNEL_ID || "",
    telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || "",
    baleToken: process.env.BALE_BOT_TOKEN || "",
    baleChannel: process.env.BALE_CHANNEL_ID || "",
    baleAdminChatId: process.env.BALE_ADMIN_CHAT_ID || "",
    channelTitle: "آکادمی حسابداری و قوانین مالیاتی ایران",
    channelSignature: "📢 کانال تخصصی حسابداری ایران",
    autoHashtags: "#آموزش_حسابداری #مالیات #سامانه_مودیان",
    simulationMode: false,
  };
}

export function saveServerBotConfig(config: Partial<ServerBotConfig>): ServerBotConfig {
  const current = loadServerBotConfig();
  const updated = { ...current, ...config };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
    if (updated.telegramToken) {
      process.env.TELEGRAM_BOT_TOKEN = updated.telegramToken;
    }
    if (updated.telegramChannel) {
      process.env.TELEGRAM_CHANNEL_ID = updated.telegramChannel;
    }
    if (updated.baleToken) {
      process.env.BALE_BOT_TOKEN = updated.baleToken;
    }
    if (updated.baleChannel) {
      process.env.BALE_CHANNEL_ID = updated.baleChannel;
    }
  } catch (e) {
    console.error("Error writing bot-config.json:", e);
  }
  return updated;
}
