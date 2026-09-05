<div align="center">

# 📊 Accounting Bot Platform for Telegram & Bale (Iran)
### پلتفرم و ربات مدیریت انتشار محتوای آموزش حسابداری برای کانال‌های تلگرام و بله

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-2CA5E0?logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![Bale Messenger](https://img.shields.io/badge/Bale-Bot%20API-00B060)](https://bale.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/meh732/-accountinglearn?style=social)](https://github.com/meh732/-accountinglearn)

<p align="center">
  <b>مدیریت، تولید هوشمند با AI و ارسال ۳ سبک تخصصی آموزش حسابداری ایران به کانال‌های تلگرام و پیام‌رسان بله</b>
  <br />
  دارای اسکریپت نصب تک‌خطی لینوکس به سبک پنل سنایی (3X-UI Style) همراه با ارسال اتوماتیک بکاپ به بات‌های ادمین
</p>

[فارسی](#-راهنمای-فارسی) | [English](#-english-guide) | [نصب سریع](#-دستور-نصب-سریع-به-سبک-پنل-سنایی) | [منوی خط فرمان](#-منوی-مدیریت-خط-فرمان) | [امکانات](#-ویژگیهای-کلیدی)

---

</div>

## 🚀 دستور نصب سریع (به سبک پنل سنایی)
برای نصب، راه‌اندازی و پیکربندی خودکار سرویس بر روی سرور لینوکس (Ubuntu, Debian, CentOS, AlmaLinux)، کافیست دستور تک‌خطی زیر را در ترمینال سرور خود کپی و اجرا کنید:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/meh732/-accountinglearn/master/install.sh)
```

> **نکته:** در صورتی که شاخه اصلی گیت‌هاب شما `main` است، می‌توانید از دستور زیر نیز استفاده نمایید:
```bash
bash <(curl -Ls https://raw.githubusercontent.com/meh732/-accountinglearn/main/install.sh)
```

---

## ⚡ منوی مدیریت خط فرمان (CLI Menu)
پس از اجرای دستور نصب، دستور اختصاصی `accountinglearn` یا `acc-bot` در سیستم شما ثبت می‌شود. در هر زمان و در هر مسیری از ترمینال، تنها با تایپ کلمه زیر منوی تعاملی به سبک پنل سنایی باز می‌شود:

```bash
accountinglearn
```

### 🖥️ نمای منوی ترمینال:
```text
  █████╗  ██████╗ ██████╗  ██████╗ ██╗   ██╗███╗   ██╗████████╗
 ██╔══██╗██╔════╝██╔════╝ ██╔═══██╗██║   ██║████╗  ██║╚══██╔══╝
 ███████║██║     ██║      ██║   ██║██║   ██║██╔██╗ ██║   ██║   
 ██╔══██║██║     ██║      ██║   ██║██║   ██║██║╚██╗██║   ██║   
 ██║  ██║╚██████╗╚██████╗ ╚██████╔╝╚██████╔╝██║ ╚████║   ██║   
 ╚═╝  ╚═╝ ╚═════╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   
================================================================
 Accounting Bot Platform for Telegram & Bale (Iran Standards)  
 Sanaei-Style One-Click Installer & System Management Script    
 Repository: https://github.com/meh732/-accountinglearn.git     
================================================================
 Service Status: ● Running
 Application Directory: /opt/accountinglearn
----------------------------------------------------------------
 1) Install Platform & Systemd Service
 2) Update Platform (Auto-Backup to Telegram/Bale Bots)
 3) Uninstall Platform (Auto-Backup to Telegram/Bale Bots)
----------------------------------------------------------------
 4) Start Service
 5) Stop Service
 6) Restart Service
 7) Check Status & Port
 8) View Realtime Service Logs
----------------------------------------------------------------
 9) Create Instant Backup & Send to Bots Now
 10) Enable Auto-Start on Boot
 11) Disable Auto-Start on Boot
----------------------------------------------------------------
 0) Exit
```

---

## 📦 پشتیبان‌گیری اتوماتیک و ارسال به بات‌ها (Auto-Backup)
یکی از مهم‌ترین قابلیت‌های این اسکریپت و پنل، **ارسال خودکار فایل پشتیبان به بات‌های تلگرام و بله ادمین** است:

1. **هنگام آپدیت (`Update`):** قبل از دریافت کد جدید و بیلد، آرشیو فشرده `.tar.gz` ایجاد شده و با کپشن و تاریخ به پی‌وی ادمین در تلگرام و بله ارسال می‌شود.
2. **هنگام حذف (`Uninstall`):** قبل از حذف سرویس، یک نسخه بکاپ نهایی کامل به بات‌های ادمین دیسپچ می‌شود تا به هیچ وجه اطلاعات از دست نرود.
3. **در پنل وب:** امکان تنظیم زمان‌بندی (روزانه، هفتگی، یا به ازای هر بار انتشار پست جدید در کانال) همراه با دکمه ارسال فوری در دسترس است.

---

## 🌟 ویژگی‌های کلیدی

### ۱. سبک اول: آموزش از صفر تا صد حسابداری ایران
- تدوین گام‌به‌گام منطبق بر نیازهای واقعی بازار کار کشور:
  - معادله اساسی حسابداری، تعریف دارایی، بدهی، سرمایه، درآمد و هزینه
  - مفهوم و منطق ماهیت بدهکار/بستانکار در حسابداری دوطرفه
  - ساختار کدینگ استاندارد ۴ لایه نرم‌افزارهای مالی (گروه، کل، معین، تفصیلی)
  - چرخه کامل ثبت سند حسابداری و دفاتر قانونی روزنامه و کل
  - محاسبات جامع حقوق و دستمزد، جدول معافیت‌های مالیاتی ماده ۸۴ و بیمه ۷٪ و ۲۳٪ تامین اجتماعی
  - مالیات بر ارزش افزوده (VAT) و تکالیف صورت معاملات فصلی ماده ۱۶۹ مکرر
  - کار با سامانه مودیان و پایانه‌های فروشگاهی و صدور صورتحساب الکترونیکی
  - بستن حساب‌های موقت و دائم و تهیه تراز آزمایشی و ترازنامه
- ابزار تولید هوشمند درس جدید بر پایه هوش مصنوعی مطابق استانداردهای حسابداری ایران

### ۲. سبک دوم: آموزش در سطح حرفه‌ای، تخصصی و تحلیلی
- ویژه مدیران مالی، مشاوران مالیاتی و حسابرسان ارشد:
  - مقایسه تحلیلی استانداردهای بین‌المللی IFRS با استانداردهای حسابداری ایران
  - تجزیه و تحلیل پیشرفته صورت‌های مالی با مدل DuPont در شرایط تورمی
  - فنون دفاع و دادرسی مالیاتی در هیئت‌های حل اختلاف (مواد ۲۳۸، ۲۴۴ و ۲۵۱ مکرر ق.م.م)
  - ماده ۱۴۱ قانون تجارت و خروج از شمول ورشکستگی از طریق تجدید ارزیابی دارایی‌ها
  - سیستم بهای تمام شده بر مبنای فعالیت (ABC Costing) و حسابداری صنعتی
- درج مستندات دقیق قانونی و کادر هشدار ریسک مالیاتی/حسابرسی برای هر پست

### ۳. سبک سوم: سیستم تعاملی پرسش و پاسخ (پاسخ‌دهی توسط ادمین)
- **مرحله ۱ (پست دعوت به طرح سوال):** انتشار پست‌های دعوت جذاب به کانال تلگرام و بله تا اعضا سوالات خود را ارسال کنند.
- **مرحله ۲ (صندوق سوالات):** ثبت و مدیریت سوالات با برچسب‌های وضعیت (*در انتظار پاسخ، پیش‌نویس، تایید شده، منتشر شده*).
- **مرحله ۳ (میز کار ادمین):** ادمین می‌تواند پاسخ کارشناسی خود را ثبت کند؛ همچنین دکمه **«پیشنهاد پاسخ با هوش مصنوعی»** پیش‌نویسی مستند به مواد قانون مالیات‌های مستقیم و استانداردهای حسابداری تولید می‌کند تا ادمین آن را ویرایش یا تایید نماید.
- **مرحله ۴ (انتشار در کانال):** ارسال شکیل پرسش و پاسخ به همراه ماده قانونی و نکته کلیدی به کانال‌های تلگرام و بله.

### ۴. پشتیبانی همزمان از تلگرام و پیام‌رسان بله
- اتصال مستقیم به **Telegram Bot API** و **Bale Messenger API**.
- تست زنده اتصال ربات‌ها (`getMe`) جهت بررسی صحت توکن و دسترسی‌های کانال.
- پیش‌نمایش در حباب‌های پیام موبایلی مشابه ظاهر کانال تلگرام و بله پیش از انتشار قطعی.
- حالت شبیه‌ساز (Simulator Mode) جهت تست بدون نیاز به توکن‌های اولیه.

---

## 🛠️ نصب و راه‌اندازی دستی (Manual Installation)

اگر تمایل دارید پروژه را به صورت دستی راه‌اندازی کنید:

```bash
# ۱. کلون کردن مخزن
git clone https://github.com/meh732/-accountinglearn.git /opt/accountinglearn
cd /opt/accountinglearn

# ۲. ایجاد فایل تنظیمات
cp .env.example .env
nano .env

# ۳. نصب پکیج‌ها و کامپایل
npm install
npm run build

# ۴. اجرای برنامه
npm start
```

سپس مرورگر خود را باز کرده و به آدرس `http://YOUR_SERVER_IP:3000` مراجعه نمایید.

---

## ⚙️ متغیرهای محیطی (`.env`)

```env
# کلید API جمینای گوگل جهت تولید خودکار درس‌ها و پیش‌نویس پاسخ سوالات
GEMINI_API_KEY=""

# اطلاعات ربات و کانال تلگرام
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHANNEL_ID="@your_telegram_channel"
TELEGRAM_ADMIN_CHAT_ID=""

# اطلاعات ربات و کانال بله
BALE_BOT_TOKEN=""
BALE_CHANNEL_ID="@your_bale_channel"
BALE_ADMIN_CHAT_ID=""

# پورت اجرای وب پنل (پیش‌فرض: 3000)
PORT=3000
```

---

## 🛡️ دستورات سرویس سیستم (`systemd`)

```bash
# مشاهده وضعیت سرویس
systemctl status accountinglearn

# استارت / استاپ / ری‌استارت
systemctl start accountinglearn
systemctl stop accountinglearn
systemctl restart accountinglearn

# مشاهده لاگ‌های زنده
journalctl -u accountinglearn -f -n 50
```

---

## 🌐 English Guide

### 🚀 One-Line Installation (Sanaei 3X-UI Style)
Run this single command on your Linux server:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/meh732/-accountinglearn/master/install.sh)
```

### ⚡ Global CLI Command
Once installed, manage your application anywhere anytime by running:
```bash
accountinglearn
```

### ✨ Features
- **3 Specialized Iranian Accounting Content Styles:**
  1. *Zero to Hero:* Progressive curriculum covering Iran accounting standards, 4-tier chart of accounts, payroll, social security (7%/23%), VAT, and the National Tax Portal (Samaneh Moudian).
  2. *Advanced & Masterclass:* DuPont ratio analysis, IFRS vs Iran standards, tax dispute boards (Articles 238, 244, 251-Mokarrar), and Article 141 commercial code recapitalization.
  3. *Interactive Q&A System:* Weekly call-for-questions dispatch, questions inbox, admin answering workspace with AI legal citation assistant, and formatted broadcast.
- **Dual Bot Architecture:** Native support for both **Telegram Bot API** and **Bale Messenger API**.
- **Automated Backup on Update & Uninstall:** Automatically zips project files and sends `.tar.gz` directly to Telegram & Bale admin bots.
- **Web Dashboard & Mobile Simulator:** Responsive dashboard with live preview bubbles matching Telegram and Bale clients.

---

## 📄 لایسنس
پروژه تحت لایسنس [MIT](LICENSE) منتشر شده است و استفاده شخصی و تجاری از آن آزاد می‌باشد.

⭐ **در صورت رضایت از پروژه، لطفاً با دادن ستاره (Star) به مخزن گیت‌هاب از توسعه آن حمایت کنید!**
