import {
  LessonItem,
  AdvancedTopic,
  QuestionItem,
  BotConfig,
  DayPostItem,
  AccountingNewsItem,
  AccountingFunItem,
} from "../types";

/**
 * Format an Internet Accounting News Post (No AI required)
 */
export function formatNewsPost(news: AccountingNewsItem, config: BotConfig): string {
  const parts: string[] = [];

  parts.push(`📰 <b>تازه‌های خبری حسابداری، مالیات و اقتصاد ایران</b>`);
  parts.push(`🏷 دسته‌بندی: <i>${news.category}</i>`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  parts.push(`📌 <b>${news.title}</b>`);
  parts.push(`\n${news.summary}`);

  if (news.source) {
    parts.push(`\n🌐 <b>منبع خبر:</b> <code>${news.source}</code>`);
    if (news.sourceUrl) {
      parts.push(`🔗 <a href="${news.sourceUrl}">مشاهده متن کامل خبر در پایگاه منبع</a>`);
    }
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  if (config.channelSignature) {
    parts.push(config.channelSignature);
  }

  const allTags = Array.from(
    new Set([
      ...(news.tags || []),
      "#اخبار_حسابداری",
      "#اخبار_مالیاتی",
      ...(config.autoHashtags ? config.autoHashtags.split(" ").filter(Boolean) : []),
    ])
  ).join(" ");

  if (allTags) {
    parts.push(allTags);
  }

  return parts.join("\n\n");
}

/**
 * Format a Late-Night Humor / Fun Post (General or Accounting - No AI required)
 */
export function formatFunPost(fun: AccountingFunItem, config: BotConfig): string {
  const parts: string[] = [];

  const isGeneral = fun.type === "general";

  if (isGeneral) {
    parts.push(`🌙 <b>طنز و لبخند آخر شب | زنگ خنده و رفع خستگی</b> ✨`);
  } else {
    parts.push(`🌙 <b>طنز و میم تخصصی حسابداری | زنگ خنده آخر شب</b> ☕`);
  }

  parts.push(`🎭 <i>${fun.category}</i>`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  parts.push(`✨ <b>${fun.title}</b>`);
  parts.push(`\n${fun.content}`);

  if (fun.punchline) {
    parts.push(`\n💡 <b>حکمت شبانه:</b>`);
    parts.push(`<blockquote>${fun.punchline}</blockquote>`);
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  if (isGeneral) {
    parts.push(`✨ <i>شبتون پر از آرامش، لبتون خندون و فرداتون سرشار از انرژی مثبت!</i>`);
  } else {
    parts.push(`☕ <i>شبتون آروم و تراز زندگیتون همیشه دقیق و بی‌اختلاف!</i>`);
  }

  if (config.channelSignature) {
    parts.push(config.channelSignature);
  }

  const defaultTags = isGeneral
    ? ["#طنز_شبانه", "#لبخند", "#خستگی_در_کنیم", "#طنز_روزمره"]
    : ["#طنز_حسابداری", "#لبخند_شبانه", "#خستگی_در_کنیم", "#میم_مالی"];

  const allTags = Array.from(
    new Set([
      ...(fun.tags || []),
      ...defaultTags,
      ...(config.autoHashtags ? config.autoHashtags.split(" ").filter(Boolean) : []),
    ])
  ).join(" ");

  if (allTags) {
    parts.push(allTags);
  }

  return parts.join("\n\n");
}

/**
 * Format a Day-Post (Morning, Noon, Evening) for Telegram and Bale
 */
export function formatDayPost(
  dayNumber: number,
  dayTitle: string,
  post: DayPostItem,
  config: BotConfig
): string {
  const parts: string[] = [];

  const slotBadge =
    post.slot === "morning"
      ? "🌅 <b>پست نوبت صبح (ساعت ۰۹:۰۰) - آموزش مفهومی</b>"
      : post.slot === "noon"
      ? "☀️ <b>پست نوبت ظهر (ساعت ۱۴:۳۰) - کارگاه عملی و ثبت سند</b>"
      : "🌙 <b>پست نوبت شب (ساعت ۲۰:۰۰) - آزمون و چالش روزانه</b>";

  parts.push(`📘 <b>دوره جامع ۳ ماهه صفر تا صد حسابداری ایران | روز شماره ${dayNumber}</b>`);
  parts.push(slotBadge);
  parts.push(`📌 <b>${post.title || dayTitle}</b>`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  parts.push(post.content);

  if (post.practicalExample) {
    parts.push(`\n📝 <b>ثبت دفتر روزنامه و مثال ریالی:</b>`);
    parts.push(`<code>${post.practicalExample}</code>`);
  }

  if (post.keyRule) {
    parts.push(`\n💡 <b>نکته طلایی قانون و بازار کار:</b>`);
    parts.push(`<blockquote>${post.keyRule}</blockquote>`);
  }

  if (post.quizQuestion) {
    parts.push(`\n❓ <b>سوال تستی روز:</b>`);
    parts.push(`<blockquote>${post.quizQuestion}</blockquote>`);

    if (post.quizOptions && post.quizOptions.length > 0) {
      parts.push(`<b>گزینه‌ها:</b>`);
      post.quizOptions.forEach((opt, idx) => {
        const icons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
        parts.push(`${icons[idx] || `(${idx + 1})`} ${opt}`);
      });
      parts.push(`\n✍️ <i>پاسخ خود را در کامنت‌ها بنویسید یا برای آزمون زنده وارد مینی‌اپ شوید.</i>`);
    }
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  if (config.channelSignature) {
    parts.push(config.channelSignature);
  }

  const allTags = Array.from(
    new Set([...(post.tags || []), ...(config.autoHashtags ? config.autoHashtags.split(" ").filter(Boolean) : [])])
  ).join(" ");
  if (allTags) {
    parts.push(allTags);
  }

  return parts.join("\n\n");
}

/**
 * Format a Zero-to-Hero Lesson for Telegram and Bale
 */
export function formatZeroToHeroPost(lesson: LessonItem, config: BotConfig): string {
  const parts: string[] = [];

  parts.push(`📘 <b>آموزش گام‌به‌گام حسابداری ایران | درس شماره ${lesson.lessonNumber}</b>`);
  parts.push(`📌 <b>موضوع: ${lesson.title}</b>`);
  parts.push(`📂 سرفصل: <i>${lesson.category}</i>`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  parts.push(lesson.content);

  if (lesson.practicalExample) {
    parts.push(`\n📝 <b>مثال کاربردی و ثبت حسابداری:</b>`);
    parts.push(`<code>${lesson.practicalExample}</code>`);
  }

  if (lesson.keyRule) {
    parts.push(`\n💡 <b>نکته طلایی قانون و بازار کار:</b>`);
    parts.push(`<blockquote>${lesson.keyRule}</blockquote>`);
  }

  if (lesson.quizQuestion) {
    parts.push(`\n❓ <b>تمرین و چالش مخاطبان:</b>`);
    parts.push(`✍️ ${lesson.quizQuestion}`);
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  if (config.channelSignature) {
    parts.push(config.channelSignature);
  }

  const allTags = Array.from(
    new Set([...(lesson.tags || []), ...(config.autoHashtags ? config.autoHashtags.split(" ").filter(Boolean) : [])])
  ).join(" ");
  if (allTags) {
    parts.push(allTags);
  }

  return parts.join("\n\n");
}

/**
 * Format an Advanced & Specialized Accounting post
 */
export function formatAdvancedPost(topic: AdvancedTopic, config: BotConfig): string {
  const parts: string[] = [];

  parts.push(`🎓 <b>حسابداری حرفه‌ای و تخصصی | تحلیل و استانداردهای روز</b>`);
  parts.push(`⚖️ <b>مبحث: ${topic.title}</b>`);
  parts.push(`📂 حوزه: <i>${topic.category}</i>`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  parts.push(topic.content);

  if (topic.legalReference) {
    parts.push(`\n📚 <b>مستندات قانونی و استاندارد مرجع:</b>`);
    parts.push(`<blockquote>${topic.legalReference}</blockquote>`);
  }

  if (topic.riskWarning) {
    parts.push(`\n⚠️ <b>هشدار ریسک مالیاتی / حسابرسی:</b>`);
    parts.push(`<blockquote>${topic.riskWarning}</blockquote>`);
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  if (config.channelSignature) {
    parts.push(config.channelSignature);
  }

  const allTags = Array.from(
    new Set([...(topic.tags || []), ...(config.autoHashtags ? config.autoHashtags.split(" ").filter(Boolean) : [])])
  ).join(" ");
  if (allTags) {
    parts.push(allTags);
  }

  return parts.join("\n\n");
}

/**
 * Format a Question & Answer post
 */
export function formatQAPost(q: QuestionItem, config: BotConfig): string {
  const parts: string[] = [];

  parts.push(`💬 <b>میز پرسش و پاسخ حسابداری و مالیاتی کانال</b>`);
  parts.push(`🏷 دسته‌بندی: <i>${q.category}</i>`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  parts.push(`👤 <b>سوال مطرح شده:</b>`);
  parts.push(`<blockquote>«${q.questionText}»</blockquote>`);

  parts.push(`\n👨‍💼 <b>پاسخ کارشناسی و مستند ادمین:</b>`);
  parts.push(q.adminAnswer || "در انتظار ثبت پاسخ توسط ادمین...");

  if (q.legalCitations) {
    parts.push(`\n⚖️ <b>مستندات قانونی / ماده قانون:</b>`);
    parts.push(`<blockquote>${q.legalCitations}</blockquote>`);
  }

  if (q.goldenTip) {
    parts.push(`\n💡 <b>توصیه کلیدی ادمین:</b>`);
    parts.push(`<blockquote>${q.goldenTip}</blockquote>`);
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(`❓ <i>شما هم سوال یا ابهام مالیاتی و حسابداری دارید؟ سوالات خود را برای ادمین ارسال کنید تا در کانال بررسی و منتشر شود.</i>`);

  if (config.channelSignature) {
    parts.push(`\n${config.channelSignature}`);
  }

  const tags = ["#پرسش_و_پاسخ", "#پاسخ_ادمین", "#مشاوره_مالیاتی", ...(config.autoHashtags ? config.autoHashtags.split(" ").filter(Boolean) : [])];
  parts.push(Array.from(new Set(tags)).join(" "));

  return parts.join("\n\n");
}

/**
 * Format Call for Questions post
 */
export function formatCallForQuestionsPost(topic: string, config: BotConfig): string {
  const parts: string[] = [];

  parts.push(`📢 <b>پست هفتگی پرسش و پاسخ حسابداری و مالیات</b>`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(`همراهان گرامی کانال، با سلام و احترام؛`);
  parts.push(`اگر در زمینه <b>${topic || "مسائل مالیاتی، سامانه مودیان، حقوق و دستمزد یا استانداردهای حسابداری"}</b> سوال، چالش کاری یا ابهامی در شرکت یا کسب‌وکار خود دارید، همین حالا بپرسید.`);
  parts.push(`📩 <b>نحوه ارسال سوال:</b>`);
  parts.push(`کافیست سوال خود را به همراه جزئیات برای ادمین یا ربات پشتیبانی کانال بفرستید.`);
  parts.push(`✅ پاسخ‌های مستند و کاربردی به صورت تفکیک‌شده توسط کارشناس و ادمین در روزهای آینده در کانال منتشر خواهد شد.`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  if (config.channelSignature) {
    parts.push(config.channelSignature);
  }

  parts.push(`#پرسش_و_پاسخ #چالش_حسابداری #مشاوره_رایگان #مالیات`);

  return parts.join("\n\n");
}
