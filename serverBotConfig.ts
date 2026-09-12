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
const PERSISTENCE_DIR = path.join(process.cwd(), "data_persistence");
const PERSISTENT_CONFIG_PATH = path.join(PERSISTENCE_DIR, "bot-config.json");
const PERSISTENT_ENV_PATH = path.join(PERSISTENCE_DIR, ".env.bak");

// Ensure persistence directory exists
try {
  if (!fs.existsSync(PERSISTENCE_DIR)) {
    fs.mkdirSync(PERSISTENCE_DIR, { recursive: true });
  }
} catch (_e) {}

// Clean value by removing surrounding quotes and trimming
export function sanitizeValue(val: any): string {
  if (!val) return "";
  return String(val).replace(/^["']|["']$/g, "").trim();
}

// Helper to extract a value directly from .env file as a reliable fallback
function readEnvFileValue(key: string): string {
  try {
    if (fs.existsSync(ENV_PATH)) {
      const raw = fs.readFileSync(ENV_PATH, "utf-8");
      const match = raw.match(new RegExp(`^${key}\\s*=\\s*["']?(.*?)["']?\\s*$`, "m"));
      if (match && match[1]) {
        return sanitizeValue(match[1]);
      }
    }
  } catch (_e) {}

  // Fallback to persistent backup env
  try {
    if (fs.existsSync(PERSISTENT_ENV_PATH)) {
      const raw = fs.readFileSync(PERSISTENT_ENV_PATH, "utf-8");
      const match = raw.match(new RegExp(`^${key}\\s*=\\s*["']?(.*?)["']?\\s*$`, "m"));
      if (match && match[1]) {
        return sanitizeValue(match[1]);
      }
    }
  } catch (_e) {}

  return "";
}

// Helper to write/update key in .env file
function writeEnvFileValue(key: string, value: string) {
  const clean = sanitizeValue(value);
  try {
    let content = "";
    if (fs.existsSync(ENV_PATH)) {
      content = fs.readFileSync(ENV_PATH, "utf-8");
    }
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}="${clean}"`);
    } else {
      content = content ? `${content.trim()}\n${key}="${clean}"\n` : `${key}="${clean}"\n`;
    }
    fs.writeFileSync(ENV_PATH, content, "utf-8");

    // Also mirror to persistent directory
    try {
      fs.writeFileSync(PERSISTENT_ENV_PATH, content, "utf-8");
    } catch (_e) {}
  } catch (_e) {}
}

export function loadServerBotConfig(): ServerBotConfig {
  let parsed: Partial<ServerBotConfig> = {};

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      parsed = JSON.parse(data);
    } else if (fs.existsSync(PERSISTENT_CONFIG_PATH)) {
      // Auto-recover from persistence directory if config was accidentally wiped
      const data = fs.readFileSync(PERSISTENT_CONFIG_PATH, "utf-8");
      parsed = JSON.parse(data);
      fs.writeFileSync(CONFIG_PATH, data, "utf-8");
      console.log("[Persistence] Successfully auto-recovered bot-config.json from persistence directory!");
    }
  } catch (e) {
    console.error("Error reading bot-config.json:", e);
  }

  const tgToken = sanitizeValue(parsed.telegramToken || process.env.TELEGRAM_BOT_TOKEN || readEnvFileValue("TELEGRAM_BOT_TOKEN"));
  const tgChannel = sanitizeValue(parsed.telegramChannel || process.env.TELEGRAM_CHANNEL_ID || readEnvFileValue("TELEGRAM_CHANNEL_ID"));
  const tgAdmin = sanitizeValue(parsed.telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || readEnvFileValue("TELEGRAM_ADMIN_CHAT_ID"));

  const baleToken = sanitizeValue(parsed.baleToken || process.env.BALE_BOT_TOKEN || readEnvFileValue("BALE_BOT_TOKEN"));
  const baleChannel = sanitizeValue(parsed.baleChannel || process.env.BALE_CHANNEL_ID || readEnvFileValue("BALE_CHANNEL_ID"));
  const baleAdmin = sanitizeValue(parsed.baleAdminChatId || process.env.BALE_ADMIN_CHAT_ID || readEnvFileValue("BALE_ADMIN_CHAT_ID"));

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

  // Sanitize all credentials
  updated.telegramToken = sanitizeValue(updated.telegramToken);
  updated.telegramChannel = sanitizeValue(updated.telegramChannel);
  if (updated.telegramAdminChatId) updated.telegramAdminChatId = sanitizeValue(updated.telegramAdminChatId);
  updated.baleToken = sanitizeValue(updated.baleToken);
  updated.baleChannel = sanitizeValue(updated.baleChannel);
  if (updated.baleAdminChatId) updated.baleAdminChatId = sanitizeValue(updated.baleAdminChatId);

  try {
    const jsonStr = JSON.stringify(updated, null, 2);
    fs.writeFileSync(CONFIG_PATH, jsonStr, "utf-8");

    // Mirror to persistent directory so updates can never wipe it
    try {
      fs.writeFileSync(PERSISTENT_CONFIG_PATH, jsonStr, "utf-8");
    } catch (_e) {}

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
