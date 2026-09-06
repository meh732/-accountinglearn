import React, { useState, useEffect } from "react";
import {
  Globe,
  Server,
  Lock,
  Copy,
  Check,
  Download,
  Terminal,
  FileCode,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { BotConfig } from "../types";
import {
  generateNginxConfig,
  generateDockerCompose,
  generateSystemdService,
  generateInstallOneLiner,
  generateStandAloneScript,
} from "../utils/deploymentGenerator";

interface DeploymentSettingsTabProps {
  formData: BotConfig;
  setFormData: React.Dispatch<React.SetStateAction<BotConfig>>;
}

export const DeploymentSettingsTab: React.FC<DeploymentSettingsTabProps> = ({
  formData,
  setFormData,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [selectedConfigTab, setSelectedConfigTab] = useState<"nginx" | "docker" | "systemd" | "script">("nginx");
  const [serverHealth, setServerHealth] = useState<{ port?: number; uptime?: number; ok?: boolean } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const currentPort = formData.deploymentPort || 3000;
  const currentDomain = formData.deploymentDomain || "";
  const enableSsl = Boolean(formData.deploymentEnableSsl);
  const sslEmail = formData.deploymentSslEmail || "";
  const redirectHttps = formData.deploymentRedirectHttps ?? true;

  // Check current server status
  const fetchServerStatus = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch("/api/deployment/status");
      if (res.ok) {
        const data = await res.json();
        setServerHealth({ port: data.port, uptime: data.uptimeSeconds, ok: true });
      } else {
        setServerHealth({ port: 3000, ok: true });
      }
    } catch {
      setServerHealth({ port: 3000, ok: true });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchServerStatus();
  }, []);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedType(null);
    }, 2500);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const deploymentOptions = {
    port: currentPort,
    domain: currentDomain,
    enableSsl,
    sslEmail,
    redirectHttps,
  };

  const dynamicOneLiner = generateInstallOneLiner(deploymentOptions);
  const nginxConfig = generateNginxConfig(deploymentOptions);
  const dockerCompose = generateDockerCompose(deploymentOptions);
  const systemdService = generateSystemdService(currentPort);
  const standaloneScript = generateStandAloneScript(deploymentOptions);

  const portPresets = [
    { label: "پیش‌فرض (3000)", value: 3000 },
    { label: "وب عادی (80)", value: 80 },
    { label: "پورت 8080", value: 8080 },
    { label: "پورت 5000", value: 5000 },
    { label: "امن SSL (443)", value: 443 },
    { label: "پورت 8443", value: 8443 },
  ];

  return (
    <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
      
      {/* Top Status & Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/40 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>پیکربندی هاستینگ، پورت اختصاصی، دامنه و SSL</span>
            </h4>
          </div>
          <p className="text-xs text-slate-400">
            امکان تغییر پورت سرور داخلی، اتصال به دامنه شخصی و اخذ خودکار گواهینامه معتبر SSL با Let's Encrypt و Certbot.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs flex items-center gap-2 font-mono">
            <span className="text-slate-400">پورت فعال سرور:</span>
            <span className="text-emerald-400 font-bold">
              {serverHealth?.port || currentPort}
            </span>
          </div>
          <button
            type="button"
            onClick={fetchServerStatus}
            disabled={loadingHealth}
            title="بروزرسانی وضعیت"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid: 1. Port Setting + 2. Domain & SSL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Section 1: Custom Port */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-slate-200 text-xs sm:text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>۱. تنظیم پورت دلخواه (Custom Port)</span>
            </h5>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
              Port: {currentPort}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            شماره پورتی که می‌خواهید وب‌اپلیکیشن روی سرور اختصاصی یا VPS شما روی آن اجرا شود:
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              شماره پورت (بین ۱ تا ۶۵۵۳۵):
            </label>
            <input
              type="number"
              min={1}
              max={65535}
              value={currentPort}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setFormData((prev) => ({
                  ...prev,
                  deploymentPort: isNaN(val) ? 3000 : val,
                }));
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 text-slate-100 font-mono text-sm tracking-wide focus:outline-none transition-colors"
              placeholder="3000"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 font-medium block">
              انتخاب سریع پورت‌های متداول:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {portPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, deploymentPort: preset.value }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                    currentPort === preset.value
                      ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 font-bold"
                      : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <p className="text-slate-300 font-medium">💡 نکته پورت ۸۰ یا ۴۴۳:</p>
            <p>
              اگر پورت را <b>80</b> بگذارید، پنل مستقیماً با وارد کردن IP یا دامنه (بدون نوشتن :3000) باز می‌شود. همچنین با Nginx می‌توانید پورت داخلی را ۳۰۰۰ نگه داشته و Nginx ترافیک پورت ۸۰/۴۴۳ را به آن بفرستد.
            </p>
          </div>
        </div>

        {/* Section 2: Custom Domain & Let's Encrypt SSL */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-slate-200 text-xs sm:text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>۲. اتصال دامنه و گواهینامه SSL</span>
            </h5>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                enableSsl
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {enableSsl ? "SSL Active 🔒" : "SSL Optional"}
            </span>
          </div>

          {/* Domain Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              نام دامنه یا زیردامنه اختصاصی:
            </label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                value={currentDomain}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, deploymentDomain: e.target.value.trim() }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-slate-100 font-mono text-xs focus:outline-none transition-colors"
                placeholder="acc.example.com یا panel.hesabdar.ir"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              رکورد <b>A</b> دامنه را در کلودفلر یا پنل DNS خود روی آی‌پی سرور ست کنید.
            </p>
          </div>

          {/* SSL Toggle */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableSsl}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deploymentEnableSsl: e.target.checked,
                  }))
                }
                className="mt-1 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>اخذ خودکار گواهینامه امنیتی SSL رایگان (Let's Encrypt / Certbot)</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  سایت با پروتکل امن <b>https://</b> و قفل سبز معتبر باز می‌شود و هر ۹۰ روز به صورت کاملاً خودکار تمدید می‌گردد.
                </p>
              </div>
            </label>

            {enableSsl && (
              <div className="space-y-3 pr-6 pl-1 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    ایمیل مدیر سرور (جهت دریافت اطلاعیه‌های تمدید Let's Encrypt):
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={sslEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, deploymentSslEmail: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-slate-100 font-mono text-xs focus:outline-none transition-colors"
                    placeholder="admin@example.com (اختیاری)"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={redirectHttps}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        deploymentRedirectHttps: e.target.checked,
                      }))
                    }
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>ریدایرکت خودکار ترافیک HTTP به HTTPS (توصیه شده)</span>
                </label>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Section 3: Live One-Liner Bash Command with Selected Flags */}
      <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-5 space-y-3 shadow-lg shadow-emerald-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="font-bold text-emerald-400 text-xs sm:text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>دستور تک‌خطی هوشمند نصب روی سرور لینوکس (با پورت و دامنه انتخابی شما)</span>
          </h4>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
            Auto-Configured One-Liner
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          با کپی و اجرای دستور زیر در ترمینال لینوکس (اوبونتو / دبیان / سنت‌او‌اس)، پروژه با پورت{" "}
          <span className="text-amber-300 font-mono font-bold">{currentPort}</span>
          {currentDomain && (
            <>
              ، دامنه <span className="text-emerald-300 font-mono font-bold">{currentDomain}</span>
            </>
          )}
          {enableSsl && " و گواهینامه SSL خودکار"} نصب و فعال می‌شود:
        </p>

        <div
          className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 font-mono text-xs text-emerald-300 flex items-center justify-between gap-3 overflow-x-auto"
          dir="ltr"
        >
          <span className="select-all break-all whitespace-pre-wrap">{dynamicOneLiner}</span>
          <button
            type="button"
            onClick={() => copyToClipboard(dynamicOneLiner, "oneliner")}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-sans font-bold transition-all shadow shadow-emerald-950"
          >
            {copiedType === "oneliner" ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>کپی دستور</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <span>⚡ دسترسی به منوی تعاملی لینوکس در هر زمان بعد از نصب:</span>
          <code className="text-amber-300 bg-slate-900 px-2 py-0.5 rounded font-mono border border-slate-800">
            accountinglearn
          </code>
        </div>
      </div>

      {/* Section 4: Generated Production Configuration Files (Nginx, Docker, Systemd, Shell) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h5 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-sky-400" />
              <span>فایل‌های آماده پیکربندی سرور (تولید زنده براساس ورودی‌های بالا)</span>
            </h5>
            <p className="text-[11px] text-slate-400">
              می‌توانید کانفیگ‌ها را مشاهده، کپی یا مستقیماً دانلود نمایید:
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedConfigTab("nginx")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedConfigTab === "nginx"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Nginx Config
            </button>
            <button
              type="button"
              onClick={() => setSelectedConfigTab("docker")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedConfigTab === "docker"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Docker Compose
            </button>
            <button
              type="button"
              onClick={() => setSelectedConfigTab("systemd")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedConfigTab === "systemd"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Systemd Service
            </button>
            <button
              type="button"
              onClick={() => setSelectedConfigTab("script")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedConfigTab === "script"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Standalone Script (.sh)
            </button>
          </div>
        </div>

        {/* Code Content & Action Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-mono text-[11px] text-slate-500">
              {selectedConfigTab === "nginx" && "/etc/nginx/sites-available/accountinglearn"}
              {selectedConfigTab === "docker" && "docker-compose.yml"}
              {selectedConfigTab === "systemd" && "/etc/systemd/system/accountinglearn.service"}
              {selectedConfigTab === "script" && "setup-server.sh"}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const content =
                    selectedConfigTab === "nginx"
                      ? nginxConfig
                      : selectedConfigTab === "docker"
                      ? dockerCompose
                      : selectedConfigTab === "systemd"
                      ? systemdService
                      : standaloneScript;
                  copyToClipboard(content, selectedConfigTab);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors border border-slate-700"
              >
                {copiedType === selectedConfigTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی کد</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedConfigTab === "nginx") {
                    downloadFile("nginx-accounting.conf", nginxConfig);
                  } else if (selectedConfigTab === "docker") {
                    downloadFile("docker-compose.yml", dockerCompose);
                  } else if (selectedConfigTab === "systemd") {
                    downloadFile("accountinglearn.service", systemdService);
                  } else {
                    downloadFile("setup-server.sh", standaloneScript);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>دانلود فایل</span>
              </button>
            </div>
          </div>

          <div
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto overflow-x-auto leading-relaxed select-all"
            dir="ltr"
          >
            <pre className="whitespace-pre-wrap">
              {selectedConfigTab === "nginx" && nginxConfig}
              {selectedConfigTab === "docker" && dockerCompose}
              {selectedConfigTab === "systemd" && systemdService}
              {selectedConfigTab === "script" && standaloneScript}
            </pre>
          </div>
        </div>
      </div>

      {/* Section 5: Step-by-Step Guide for Domain, Port & SSL */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h5 className="font-bold text-slate-200 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>مراحل گام‌به‌گام اتصال دامنه و اخذ SSL در سرور:</span>
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="font-bold text-amber-300 block">گام اول: تنظیم DNS</span>
            <p className="text-slate-400 leading-relaxed">
              در پنل مدیریت دامنه خود (مثل Cloudflare یا ابرآروان)، یک رکورد <b>A</b> با نام دلخواه (مثلاً <code className="text-slate-200 font-mono">acc</code>) ایجاد کرده و مقدار آن را به IP سرور لینوکس خود ارجاع دهید.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="font-bold text-sky-300 block">گام دوم: اجرای نصب با فلگ‌ها</span>
            <p className="text-slate-400 leading-relaxed">
              دستور تک‌خطی هوشمند بالا را در ترمینال سرور اجرا کنید تا تمام سرویس‌های لینوکسی، Nginx و Certbot به صورت خودکار نصب و فعال شوند.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="font-bold text-emerald-300 block">گام سوم: تمدید و نگهداری</span>
            <p className="text-slate-400 leading-relaxed">
              گواهینامه SSL توسط کرون‌جاب لینوکس هر ۹۰ روز یکبار به صورت کاملاً خودکار تمدید می‌شود و نیازی به هیچ اقدام دستی نخواهید داشت.
            </p>
          </div>
        </div>
      </div>

      {/* Section 6: Troubleshooting & ERR_CONNECTION_REFUSED Fix */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <h5 className="font-bold text-xs sm:text-sm">
            راهنمای حل خطای «This site can’t be reached / ERR_CONNECTION_REFUSED» در مرورگر
          </h5>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          اگر آدرس سرور (مثلاً <code className="text-amber-300 font-mono">http://45.144.48.211:{currentPort}</code>) در مرورگر باز نمی‌شود، علت یکی از موارد زیر است:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <span>۱. فایروال پنل هاستینگ ابری (Cloud Firewall / Security Group)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              در پنل مدیریت سرور خود (هتزنر، دیجیتال‌اوشن، ابرآروان، پارس‌پک یا AWS)، به بخش <b>Firewall / Security Groups</b> بروید و یک پورت ورودی (Inbound TCP) روی شماره پورت <b className="text-slate-200 font-mono">{currentPort}</b> اضافه کنید.
            </p>
          </div>

          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-sky-300 font-bold">
              <span>۲. اجرای ابزار عیب‌یابی و باز کردن فایروال سرور</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              در ترمینال سرور خود دستور زیر را اجرا کنید تا فایروال لینوکس (UFW / iptables) به صورت خودکار باز شده و وضعیت سرویس بررسی شود:
            </p>
            <code className="block bg-slate-950 p-2 rounded text-emerald-300 font-mono text-[11px] select-all" dir="ltr">
              sudo ufw allow {currentPort}/tcp && accountinglearn --diagnose
            </code>
          </div>
        </div>
      </div>

    </div>
  );
};
