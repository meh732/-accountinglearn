export type PostStyle = "zero_to_hero" | "advanced" | "qa" | "call_for_questions" | "daily_quiz" | "accounting_news" | "accounting_fun";

export type MessengerPlatform = "telegram" | "bale";

export type DailyPlanMode = "three_lessons" | "balanced_mix";

export type FunPreference = "all" | "general" | "accounting";

export interface BotConfig {
  telegramToken: string;
  telegramChannel: string; // e.g. @acc_iran or -1001234567
  baleToken: string;
  baleChannel: string; // e.g. @acc_iran_bale or chat_id
  channelTitle: string; // e.g. آکادمی حسابداری و مالیات ایران
  channelSignature: string; // e.g. 📢 کانال حسابداری تخصصی: @acc_iran | بله: @acc_iran
  autoHashtags: string; // e.g. #آموزش_حسابداری #مالیات #سامانه_مودیان
  simulationMode: boolean;
  miniAppUrl?: string; // Optional custom WebApp URL
  dailyPlanMode?: DailyPlanMode; // "three_lessons" (3 educational) vs "balanced_mix" (1 lesson + 1 news + 1 fun)
  funPreference?: FunPreference; // "all" (ترکیبی) | "general" (طنز جذاب عمومی) | "accounting" (طنز تخصصی حسابداری)
  morningPostTime?: string; // default: "09:00"
  noonPostTime?: string; // default: "14:30"
  eveningPostTime?: string; // default: "22:00"
  autoBackupEnabled?: boolean;
  autoBackupInterval?: "daily" | "weekly" | "every_publish";
  lastBackupAt?: string;
  telegramAdminChatId?: string; // numeric or @admin
  baleAdminChatId?: string; // numeric or @admin
  deploymentPort?: number; // custom port, default: 3000
  deploymentDomain?: string; // custom domain, e.g. panel.example.com
  deploymentEnableSsl?: boolean; // optional SSL acquisition with Let's Encrypt
  deploymentSslEmail?: string; // admin email for Certbot notifications
  deploymentRedirectHttps?: boolean; // auto redirect HTTP to HTTPS
}

export interface AccountingNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  pubDate: string;
  category: "سامانه مودیان" | "قوانین مالیاتی" | "حقوق و دستمزد" | "استانداردهای حسابداری" | "بورس و اقتصاد" | string;
  tags: string[];
}

export interface AccountingFunItem {
  id: string;
  title: string;
  content: string;
  type?: "general" | "accounting"; // "general" = طنز جذاب عمومی و روزمره | "accounting" = طنز تخصصی حسابداری
  category: string;
  punchline?: string;
  tags: string[];
}

export interface DailyQuizItem {
  id: string;
  dayNumber: number;
  title: string;
  category: "مفاهیم پایه" | "اسناد و دفاتر" | "حقوق و دستمزد" | "مالیات و مودیان" | "صورت‌های مالی" | "استانداردها و تحلیل";
  question: string;
  options: string[]; // 4 choices
  correctOptionIndex: number; // 0 to 3
  explanation: string; // detailed explanation with standard/legal reference
  relatedLessonId?: string;
  tags: string[];
  publishedPlatforms?: MessengerPlatform[];
  publishedAt?: string;
  isCustom?: boolean;
}

export interface JournalEntryLine {
  id: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

export interface PracticeScenario {
  id: string;
  title: string;
  category: "اصول و اسناد" | "خرید و فروش" | "حقوق و دستمزد" | "مالیات و مودیان" | "پایان سال مالی";
  description: string;
  difficulty: "مبتدی" | "متوسط" | "پیشرفته";
  defaultLines: JournalEntryLine[];
  solutionExplanation: string;
  legalTip: string;
}

export interface StudentTestResult {
  id: string;
  quizId: string;
  quizTitle: string;
  selectedOption: number;
  isCorrect: boolean;
  timestamp: string;
}

export type PostSlotType = "morning" | "noon" | "evening";

export interface DayPostItem {
  id: string;
  slot: PostSlotType;
  slotTitle: string; // "پست صبح (۰۹:۰۰) - آموزش مفهومی" | "پست ظهر (۱۴:۳۰) - کارگاه عملی و سند" | "پست شب (۲۰:۰۰) - آزمون و چالش"
  title: string;
  category: string;
  content: string;
  practicalExample?: string;
  keyRule?: string;
  quizQuestion?: string;
  quizOptions?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  tags: string[];
  isPublished?: boolean;
}

export interface ThreeMonthDayItem {
  id: string;
  dayNumber: number; // 1 to 90
  monthNumber: 1 | 2 | 3;
  weekNumber: number; // 1 to 12
  monthTitle: string;
  weekTitle: string;
  title: string;
  summary: string;
  category: "مفاهیم پایه" | "اسناد و دفاتر" | "حقوق و دستمزد" | "مالیات و مودیان" | "صورت‌های مالی";
  posts: DayPostItem[]; // The 2-3 daily posts
  isPublished?: boolean;
  publishedCount?: number;
}

export interface LessonItem {
  id: string;
  lessonNumber: number;
  title: string;
  category: "مفاهیم پایه" | "اسناد و دفاتر" | "حقوق و دستمزد" | "مالیات و مودیان" | "صورت‌های مالی";
  summary: string;
  content: string;
  practicalExample?: string;
  keyRule: string;
  quizQuestion?: string;
  tags: string[];
  isCustom?: boolean;
  dayNumber?: number;
  monthNumber?: 1 | 2 | 3;
  weekNumber?: number;
  posts?: DayPostItem[];
}

export interface AdvancedTopic {
  id: string;
  title: string;
  category: "استانداردها و IFRS" | "بهای تمام شده و صنعتی" | "دادرسی و قوانین مالیاتی" | "تحلیل صورت‌های مالی";
  summary: string;
  content: string;
  legalReference?: string;
  riskWarning?: string;
  tags: string[];
  isCustom?: boolean;
}

export type QuestionStatus = "pending" | "drafted" | "answered" | "published";

export interface QuestionItem {
  id: string;
  askerName: string;
  askedAt: string;
  category: "مالیات و سامانه مودیان" | "حقوق، دستمزد و بیمه" | "استانداردها و ثبت حسابداری" | "قانون تجارت و شرکت‌ها";
  questionText: string;
  status: QuestionStatus;
  adminAnswer: string;
  aiDraftSuggestion?: string;
  legalCitations?: string;
  goldenTip?: string;
  publishedAt?: string;
  publishedPlatforms?: MessengerPlatform[];
}

export interface BroadcastLog {
  id: string;
  title: string;
  style: PostStyle;
  platforms: MessengerPlatform[];
  contentPreview: string;
  fullText: string;
  timestamp: string;
  status: "success" | "partial" | "failed" | "simulated";
  details?: string;
}
