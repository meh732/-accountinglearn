export type PostStyle = "zero_to_hero" | "advanced" | "qa" | "call_for_questions";

export type MessengerPlatform = "telegram" | "bale";

export interface BotConfig {
  telegramToken: string;
  telegramChannel: string; // e.g. @acc_iran or -1001234567
  baleToken: string;
  baleChannel: string; // e.g. @acc_iran_bale or chat_id
  channelTitle: string; // e.g. آکادمی حسابداری و مالیات ایران
  channelSignature: string; // e.g. 📢 کانال حسابداری تخصصی: @acc_iran | بله: @acc_iran
  autoHashtags: string; // e.g. #آموزش_حسابداری #مالیات #سامانه_مودیان
  simulationMode: boolean;
  autoBackupEnabled?: boolean;
  autoBackupInterval?: "daily" | "weekly" | "every_publish";
  lastBackupAt?: string;
  telegramAdminChatId?: string; // numeric or @admin
  baleAdminChatId?: string; // numeric or @admin
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
