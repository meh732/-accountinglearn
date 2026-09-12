import fs from "fs";
import path from "path";
import os from "os";

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

const PERSISTENCE_DIR = path.join(process.cwd(), "data_persistence");
const CONFIG_PATH = path.join(process.cwd(), "bot-config.json");
const ENV_PATH = path.join(process.cwd(), ".env");
const PERSISTENT_CONFIG_PATH = path.join(PERSISTENCE_DIR, "bot-config.json");
const PERSISTENT_ENV_PATH = path.join(PERSISTENCE_DIR, ".env.bak");

// System-wide permanent storage paths (survive git pull, git reset, and repo directory re-cloning)
const SYSTEM_PERSISTENT_DIRS = [
  PERSISTENCE_DIR,
  "/etc/accountinglearn",
  "/var/lib/accountinglearn",
  path.join(os.homedir(), ".accountinglearn"),
  "/opt/accountinglearn_data",
  "/root/.accountinglearn",
];

// Ensure all persistent directories exist
for (const dir of SYSTEM_PERSISTENT_DIRS) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (_e) {}
}

const ALL_CONFIG_PATHS = [
  CONFIG_PATH,
  PERSISTENT_CONFIG_PATH,
  "/etc/accountinglearn/bot-config.json",
  "/var/lib/accountinglearn/bot-config.json",
  path.join(os.homedir(), ".accountinglearn", "bot-config.json"),
  "/opt/accountinglearn_data/bot-config.json",
  "/opt/accountinglearn/bot-config.json",
  "/var/www/accountinglearn/bot-config.json",
  "/root/-accountinglearn/bot-config.json",
  "/root/accountinglearn/bot-config.json",
];

const ALL_ENV_PATHS = [
  ENV_PATH,
  PERSISTENT_ENV_PATH,
  "/etc/accountinglearn/.env",
  "/var/lib/accountinglearn/.env",
  path.join(os.homedir(), ".accountinglearn", ".env"),
  "/opt/accountinglearn_data/.env",
  "/opt/accountinglearn/.env",
  "/var/www/accountinglearn/.env",
  "/root/-accountinglearn/.env",
  "/root/accountinglearn/.env",
];

// Clean value by removing surrounding quotes and trimming
export function sanitizeValue(val: any): string {
  if (!val) return "";
  return String(val).replace(/^["']|["']$/g, "").trim();
}

// Helper to extract a value directly from .env files across all system paths
function readEnvFileValue(key: string): string {
  for (const p of ALL_ENV_PATHS) {
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
  for (const p of ALL_ENV_PATHS) {
    try {
      const parentDir = path.dirname(p);
      if (!fs.existsSync(parentDir)) {
        try { fs.mkdirSync(parentDir, { recursive: true }); } catch (_e) {}
      }
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
  let merged: Partial<ServerBotConfig> = {};

  // 1. Read from ALL config files and merge (non-destructive: non-empty values take precedence)
  for (const cPath of ALL_CONFIG_PATHS) {
    try {
      if (fs.existsSync(cPath)) {
        const data = fs.readFileSync(cPath, "utf-8");
        const obj = JSON.parse(data);
        if (obj && typeof obj === "object") {
          for (const [k, v] of Object.entries(obj)) {
            const clean = sanitizeValue(v);
            if (clean !== "" && !(merged as any)[k]) {
              (merged as any)[k] = clean;
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 2. Supplement from environment variables & .env files
  const tgToken = sanitizeValue(merged.telegramToken || process.env.TELEGRAM_BOT_TOKEN || readEnvFileValue("TELEGRAM_BOT_TOKEN"));
  const tgChannel = sanitizeValue(merged.telegramChannel || process.env.TELEGRAM_CHANNEL_ID || readEnvFileValue("TELEGRAM_CHANNEL_ID"));
  const tgAdmin = sanitizeValue(merged.telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || readEnvFileValue("TELEGRAM_ADMIN_CHAT_ID"));

  const baleToken = sanitizeValue(merged.baleToken || process.env.BALE_BOT_TOKEN || readEnvFileValue("BALE_BOT_TOKEN"));
  const baleChannel = sanitizeValue(merged.baleChannel || process.env.BALE_CHANNEL_ID || readEnvFileValue("BALE_CHANNEL_ID"));
  const baleAdmin = sanitizeValue(merged.baleAdminChatId || process.env.BALE_ADMIN_CHAT_ID || readEnvFileValue("BALE_ADMIN_CHAT_ID"));

  const finalConfig: ServerBotConfig = {
    telegramToken: tgToken,
    telegramChannel: tgChannel,
    telegramAdminChatId: tgAdmin,
    baleToken: baleToken,
    baleChannel: baleChannel,
    baleAdminChatId: baleAdmin,
    channelTitle: merged.channelTitle || "آکادمی حسابداری و قوانین مالیاتی ایران",
    channelSignature: merged.channelSignature || "📢 کانال تخصصی حسابداری ایران",
    autoHashtags: merged.autoHashtags || "#آموزش_حسابداری #مالیات #سامانه_مودیان",
    simulationMode: merged.simulationMode ?? false,
  };

  // 3. Auto-Heal: If config in working directory is missing any value found elsewhere, sync it immediately
  try {
    const jsonStr = JSON.stringify(finalConfig, null, 2);
    if (!fs.existsSync(CONFIG_PATH) || (tgToken && !fs.readFileSync(CONFIG_PATH, "utf-8").includes(tgToken))) {
      fs.writeFileSync(CONFIG_PATH, jsonStr, "utf-8");
    }
  } catch (_e) {}

  return finalConfig;
}

export function saveServerBotConfig(config: Partial<ServerBotConfig>): ServerBotConfig {
  const current = loadServerBotConfig();
  
  // Create non-destructive merged update
  const updated: ServerBotConfig = { ...current };

  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      const clean = sanitizeValue(value);
      (updated as any)[key] = clean;
    }
  }

  const jsonStr = JSON.stringify(updated, null, 2);

  // Write to ALL target paths and system backup directories
  for (const tPath of ALL_CONFIG_PATHS) {
    try {
      const parentDir = path.dirname(tPath);
      if (!fs.existsSync(parentDir)) {
        try { fs.mkdirSync(parentDir, { recursive: true }); } catch (_e) {}
      }
      if (fs.existsSync(parentDir)) {
        fs.writeFileSync(tPath, jsonStr, "utf-8");
      }
    } catch (_e) {}
  }

  // Update in-memory environment variables and disk .env files
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
