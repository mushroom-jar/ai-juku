export type Subject =
  | "math"
  | "physics"
  | "chemistry"
  | "biology"
  | "english"
  | "japanese"
  | "world_history"
  | "japanese_history"
  | "geography"
  | "civics"
  | "information"
  | "other";
export type Plan = "free" | "basic" | "premium";
export type UserRole = "student" | "teacher" | "parent";

export interface Student {
  id: string;
  user_id: string;
  teacher_id: string | null;
  name: string;
  grade: number;
  target_univ: string;
  target_level: number;
  exam_date: string | null;
  current_level: number;
  subjects: Subject[];
  plan: Plan;
  line_user_id: string | null;
  study_style?: string | null;
  available_study_time?: {
    weekday_minutes?: number;
    holiday_minutes?: number;
  } | null;
  biggest_blocker?: string | null;
  strength_subjects?: Subject[];
  weakness_subjects?: Subject[];
  onboarding_summary?: string;
  onboarding_answers?: Record<string, unknown>;
  ai_interview_completed_at?: string | null;
  interview_transcript?: string;
  created_at: string;
}

export interface Teacher {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  subject: Subject;
  category: string;
  level: number;
  level_label: string;
  publisher: string;
  total_problems: number;
}

export interface Problem {
  id: string;
  book_id: string;
  problem_no: number;
  unit: string;
  difficulty: number;
  estimated_min: number;
}

export interface StudentRoute {
  id: string;
  student_id: string;
  book_id: string;
  step_order: number;
  status: "not_started" | "in_progress" | "done";
  started_at: string | null;
  completed_at: string | null;
  books?: Book;
}

export interface WeeklySchedule {
  id: string;
  student_id: string;
  week_start: string;
  is_exam_week: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface DailyTask {
  id: string;
  schedule_id: string;
  date: string;
  book_id: string;
  problem_no_start: number;
  problem_no_end: number;
  status: "pending" | "done" | "skipped";
  completed_at: string | null;
  books?: Book;
}

export interface ProblemRecord {
  id: string;
  student_id: string;
  problem_id: string;
  status: "solved" | "unsolved";
  attempt_count: number;
  last_attempted: string;
  mastered_at: string | null;
  created_at: string;
}

export interface QuestionLog {
  id: string;
  student_id: string;
  asked_at: string;
  image_url: string | null;
  question_text: string;
  ai_response: string;
  subject: Subject | null;
  via: "app" | "line";
}

export interface WeeklySession {
  id: string;
  student_id: string;
  session_date: string;
  review_problem_ids: string[];
  review_results: Record<string, "solved" | "unsolved">;
  checkin_comment: string | null;
  ai_feedback: string | null;
  next_schedule_id: string | null;
  completed_at: string | null;
}

export interface MockExam {
  id: string;
  student_id: string;
  exam_name: string;
  exam_date: string;
  scores: Record<string, { score: number; max: number; deviation?: number }>;
  total_score: number | null;
  total_max: number | null;
  total_deviation: number | null;
  memo: string | null;
  created_at: string;
}

// 科目カラー（全ページ共通）
export const SUBJECT_COLOR: Record<string, string> = {
  math:             "#2563EB",
  physics:          "#F43F5E",
  chemistry:        "#06B6D4",
  biology:          "#059669",
  english:          "#7C3AED",
  japanese:         "#EA580C",
  world_history:    "#D97706",
  japanese_history: "#C2410C",
  geography:        "#0D9488",
  civics:           "#4338CA",
  information:      "#475569",
  other:            "#94A3B8",
};
export const SUBJECT_BG: Record<string, string> = {
  math:             "#EFF6FF",
  physics:          "#FFF1F2",
  chemistry:        "#ECFEFF",
  biology:          "#ECFDF5",
  english:          "#F5F3FF",
  japanese:         "#FFF7ED",
  world_history:    "#FFFBEB",
  japanese_history: "#FFF7ED",
  geography:        "#F0FDFA",
  civics:           "#EEF2FF",
  information:      "#F8FAFC",
  other:            "#F8FAFC",
};
export const SUBJECT_LABEL: Record<string, string> = {
  math:             "数学",
  physics:          "物理",
  chemistry:        "化学",
  biology:          "生物",
  english:          "英語",
  japanese:         "国語",
  world_history:    "世界史",
  japanese_history: "日本史",
  geography:        "地理",
  civics:           "公民",
  information:      "情報",
  other:            "その他",
};

// レベルラベル
export const LEVEL_LABELS: Record<number, string> = {
  1: "基礎・共通テスト",
  2: "日東駒専・産近甲龍",
  3: "MARCH・関関同立",
  4: "早慶・旧帝大",
  5: "東大・京大・医学部",
};
