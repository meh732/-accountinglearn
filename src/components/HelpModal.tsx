import React from "react";
import { X, HelpCircle, BookOpen, GraduationCap, MessageSquare, Send, ShieldCheck, CheckCircle2 } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                راهنمای جامع ربات کانال حسابداری تلگرام و بله
              </h3>
              <p className="text-xs text-slate-400">
                بررسی ۳ سبک آموزشی درخواستی و راهنمای راه‌اندازی ربات‌ها
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          
          {/* Section 1: The 3 Requested Educational Styles */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>سه سبک تخصصی آموزش حسابداری تعبیه‌شده در سیستم:</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/20 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <BookOpen className="w-4 h-4" />
                  <span>سبک ۱: صفر تا صد ایران</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  سرفصل‌های گام‌به‌گام و منظم از مبانی اولیه، معادله، ماهیت بدهکار/بستانکار، کدینگ، حقوق و دستمزد، بیمه تامین اجتماعی، ارزش افزوده تا سامانه مودیان و تهیه ترازنامه.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/20 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                  <GraduationCap className="w-4 h-4" />
                  <span>سبک ۲: حرفه‌ای و تخصصی</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  مطالب تحلیلی ویژه مدیران مالی و حسابرسان، مقایسه استانداردهای ایران با IFRS، تحلیل DuPont، دادرسی مالیاتی در هیئت‌ها (ماده ۲۳۸، ۲۴۴ و ۲۵۱ مکرر) و ماده ۱۴۱ قانون تجارت.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/20 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <MessageSquare className="w-4 h-4" />
                  <span>سبک ۳: پرسش و پاسخ تعاملی</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  امکان ارسال پست دعوت به طرح سوال در کانال، ثبت سوالات اعضا، نگارش پاسخ توسط ادمین با کمک مشاور هوش مصنوعی و انتشار پاسخ مستند در کانال.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Messenger Integrations */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>پشتیبانی همزمان از تلگرام و پیام‌رسان بله (Bale):</span>
            </h4>
            
            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                <div>
                  <b className="text-sky-300">ربات تلگرام (Telegram Bot API):</b> با قرار دادن توکن ربات از BotFather@ و آیدی عمومی یا عددی کانال (مثلاً hesabdari_iran@) و ارتقای ربات به ادمین کانال با دسترسی ارسال پیام.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <b className="text-emerald-300">ربات پیام‌رسان بله (Bale Bot API):</b> پیام‌رسان بله API رسمی استاندارد مشابه تلگرام دارد. ربات در بله را با BotFather بله ساخته و توکن را در پنل تنظیمات وارد کنید.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Smart Simulation */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-slate-200">حالت شبیه‌ساز (Simulator Mode):</span>
              <p className="text-slate-400 mt-0.5">
                اگر هنوز ربات در تلگرام یا بله نساخته‌اید، می‌توانید بدون هیچ مشکلی از تمامی امکانات پنل، هوش مصنوعی، پیش‌نمایش حباب پیام موبایلی و تولید محتوا استفاده کرده و تست کنید.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            متوجه شدم
          </button>
        </div>

      </div>
    </div>
  );
};
