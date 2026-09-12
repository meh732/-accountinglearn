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

const CANDIDATE_DIRS = [
  process.cwd(),
  path.join(process.cwd(), "data_persistence"),
  "/opt/accountinglearn",
  "/var/www/accountinglearn",
  "/root/-accountinglearn",
  "/root/accountinglearn",
  path.resolve(process.cwd(), ".."),
];

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

// Helper to extract a value directly from .env file as a reliable fallback across all paths
function readEnvFileValue(key: string): string {
  const envPaths = [
    ENV_PATH,
    PERSISTENT_ENV_PATH,
    "/opt/accountinglearn/.env",
    "/var/www/accountinglearn/.env",
    "/root/-accountinglearn/.env",
  ];

  for (const p of envPaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const match = raw.match(new RegExp(`^${key}\\s*=\\s*["']?(.*?)["']?\\s*$`, "m"));
        if (match && match[1]) {
          const val = sanitizeValue(match[1]);
          if (val) return val;
        }
      }
    } catch (_e) {}
  }

  return "";
}

// Helper to write/update key in .env file across all available dirs
function writeEnvFileValue(key: string, value: string) {
  const clean = sanitizeValue(value);
  const targetEnvs = [
    ENV_PATH,
    PERSISTENT_ENV_PATH,
    "/opt/accountinglearn/.env",
    "/var/www/accountinglearn/.env",
    "/root/-accountinglearn/.env",
  ];

  for (const p of targetEnvs) {
    try {
      const parentDir = path.dirname(p);
      if (fs.existsSync(parentDir)) {
        let content = "";
        if (fs.existsSync(p)) {
          content = fs.readFileSync(p, "utf-8");
        }
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(content)) {
          content = content.replace(regex, `${key}="${clean}"`);
        } else {
          content = content ? `${content.trim()}\n${key}="${clean}"\n` : `${key}="${clean}"\n`;
        }
        fs.writeFileSync(p, content, "utf-8");
      }
    } catch (_e) {}
  }
}

export function loadServerBotConfig(): ServerBotConfig {
  let parsed: Partial<ServerBotConfig> = {};

  const configCandidates = [
    CONFIG_PATH,
    PERSISTENT_CONFIG_PATH,
    "/opt/accountinglearn/bot-config.json",
    "/var/www/accountinglearn/bot-config.json",
    "/root/-accountinglearn/bot-config.json",
  ];

  for (const cPath of configCandidates) {
    try {
      if (fs.existsSync(cPath)) {
        const data = fs.readFileSync(cPath, "utf-8");
        const obj = JSON.parse(data);
        if (obj && (obj.telegramToken || obj.telegramChannel || obj.baleToken || obj.baleChannel)) {
          parsed = { ...parsed, ...obj };
          break;
        }
      }
    } catch (_e) {}
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

  const jsonStr = JSON.stringify(updated, null, 2);

  const writeTargetPaths = [
    CONFIG_PATH,
    PERSISTENT_CONFIG_PATH,
    "/opt/accountinglearn/bot-config.json",
    "/var/www/accountinglearn/bot-config.json",
    "/root/-accountinglearn/bot-config.json",
  ];

  for (const tPath of writeTargetPaths) {
    try {
      const parentDir = path.dirname(tPath);
      if (fs.existsSync(parentDir)) {
        fs.writeFileSync(tPath, jsonStr, "utf-8");
      }
    } catch (_e) {}
  }

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

  return updated;
}
