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
const ENV_PATH = path.join(process.cwd(), ".env");

// Helper to extract a value directly from .env file as a reliable fallback
function readEnvFileValue(key: string): string {
  try {
    if (fs.existsSync(ENV_PATH)) {
      const raw = fs.readFileSync(ENV_PATH, "utf-8");
      const match = raw.match(new RegExp(`^${key}\\s*=\\s*["']?(.*?)["']?\\s*$`, "m"));
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (_e) {}
  return "";
}

// Helper to write/update key in .env file
function writeEnvFileValue(key: string, value: string) {
  try {
    let content = "";
    if (fs.existsSync(ENV_PATH)) {
      content = fs.readFileSync(ENV_PATH, "utf-8");
    }
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}="${value}"`);
    } else {
      content = content ? `${content.trim()}\n${key}="${value}"\n` : `${key}="${value}"\n`;
    }
    fs.writeFileSync(ENV_PATH, content, "utf-8");
  } catch (_e) {}
}

export function loadServerBotConfig(): ServerBotConfig {
  let parsed: Partial<ServerBotConfig> = {};

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      parsed = JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading bot-config.json:", e);
  }

  const tgToken = parsed.telegramToken || process.env.TELEGRAM_BOT_TOKEN || readEnvFileValue("TELEGRAM_BOT_TOKEN") || "";
  const tgChannel = parsed.telegramChannel || process.env.TELEGRAM_CHANNEL_ID || readEnvFileValue("TELEGRAM_CHANNEL_ID") || "";
  const tgAdmin = parsed.telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || readEnvFileValue("TELEGRAM_ADMIN_CHAT_ID") || "";

  const baleToken = parsed.baleToken || process.env.BALE_BOT_TOKEN || readEnvFileValue("BALE_BOT_TOKEN") || "";
  const baleChannel = parsed.baleChannel || process.env.BALE_CHANNEL_ID || readEnvFileValue("BALE_CHANNEL_ID") || "";
  const baleAdmin = parsed.baleAdminChatId || process.env.BALE_ADMIN_CHAT_ID || readEnvFileValue("BALE_ADMIN_CHAT_ID") || "";

  return {
    telegramToken: tgToken,
    telegramChannel: tgChannel,
    telegramAdminChatId: tgAdmin,
    baleToken: baleToken,
    baleChannel: baleChannel,
    baleAdminChatId: baleAdmin,
    channelTitle: parsed.channelTitle || "آکادمی حسابداری و قوانین مالیاتی ایران",
    channelSignature: parsed.channelSignature || "📢 کانال تخصصی حسابداری ایران",
    autoHashtags: parsed.autoHashtags || "#آموزش_حسابداری #مالیات #سامانه_مودیان",
    simulationMode: parsed.simulationMode ?? false,
  };
}

export function saveServerBotConfig(config: Partial<ServerBotConfig>): ServerBotConfig {
  const current = loadServerBotConfig();
  const updated = { ...current, ...config };

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");

    if (updated.telegramToken) {
      process.env.TELEGRAM_BOT_TOKEN = updated.telegramToken;
      writeEnvFileValue("TELEGRAM_BOT_TOKEN", updated.telegramToken);
    }
    if (updated.telegramChannel) {
      process.env.TELEGRAM_CHANNEL_ID = updated.telegramChannel;
      writeEnvFileValue("TELEGRAM_CHANNEL_ID", updated.telegramChannel);
    }
    if (updated.telegramAdminChatId) {
      process.env.TELEGRAM_ADMIN_CHAT_ID = updated.telegramAdminChatId;
      writeEnvFileValue("TELEGRAM_ADMIN_CHAT_ID", updated.telegramAdminChatId);
    }
    if (updated.baleToken) {
      process.env.BALE_BOT_TOKEN = updated.baleToken;
      writeEnvFileValue("BALE_BOT_TOKEN", updated.baleToken);
    }
    if (updated.baleChannel) {
      process.env.BALE_CHANNEL_ID = updated.baleChannel;
      writeEnvFileValue("BALE_CHANNEL_ID", updated.baleChannel);
    }
    if (updated.baleAdminChatId) {
      process.env.BALE_ADMIN_CHAT_ID = updated.baleAdminChatId;
      writeEnvFileValue("BALE_ADMIN_CHAT_ID", updated.baleAdminChatId);
    }
  } catch (e) {
    console.error("Error writing bot-config.json:", e);
  }
  return updated;
}
