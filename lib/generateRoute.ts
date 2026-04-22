import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subject } from "@/lib/types";

// 2026年度 武田塾ルート
const ROUTE_ORDER: Partial<Record<Subject, string[]>> = {
  english: [
    "大岩のいちばんはじめの英文法",
    "システム英単語",
    "英文法ポラリス1",
    "動画でわかる英文法 読解入門編",
    "The Rules 1",
    "The Rules 2",
    "英語長文ポラリス1",
    "英文法ポラリス2",
    "読解のための英文法が面白いほどわかる本",
    "The Rules 3",
    "英語長文ポラリス2",
    "ポレポレ英文読解プロセス50",
    "The Rules 4",
    "英語長文ポラリス3",
  ],
  math: [
    "やさしい高校数学（数IA）",
    "入門問題精講 数学IA",
    "数学スーパークイック 1A",
    "数学スーパークイック 2B",
    "基礎問題精講 数学IA",
    "基礎問題精講 数学IIB",
    "基礎問題精講 数学IIIC",
    "絶対に出せない必須101題 数学",
    "数学重要事項完全習得編（赤）",
    "数学重要事項実戦向上編（青）",
    "解放のエウレカ 数学",
    "青チャート 数学IA（例題）",
    "青チャート 数学IIB（例題）",
    "青チャート 数学IIIC（例題）",
    "入試の核心 数学（標準編）",
    "解放のセオリー 数学",
    "良問プラチカ 数学IAIIB",
    "良問プラチカ 数学III",
    "ハイレベル理系数学",
  ],
  physics: [
    "漆原の物理が面白いほどわかる本",
    "宇宙一わかりやすい高校物理（力学・波動）",
    "宇宙一わかりやすい高校物理（電磁気・熱・原子）",
    "物理のエッセンス（力学・波動）",
    "物理のエッセンス（電磁気・熱・原子）",
    "良問の風 物理",
    "名問の森 物理（力学・熱・波動）",
    "名問の森 物理（電磁気・原子）",
    "難問題の系統とその解き方（難系）",
  ],
  chemistry: [
    "宇宙一わかりやすい高校化学（理論）",
    "ゼロから始める化学",
    "岡野の化学が初歩からしっかりわかる",
    "リードLightノート 化学",
    "化学入門問題精講",
    "化学基礎問題精講",
    "鎌田の理論化学の講義",
    "化学の良問問題集",
    "化学重要問題集（A問題）",
    "化学標準問題精講",
    "化学重要問題集（A+B問題）",
    "化学の新演習",
  ],
};

export async function generateRoute(
  serviceClient: SupabaseClient,
  studentId: string,
  student: { current_level: number; target_level: number; subjects: string[] }
): Promise<{ ok: boolean; count?: number; error?: string }> {
  // 既存ルートを削除（再生成）
  await serviceClient.from("student_routes").delete().eq("student_id", studentId);

  const { data: allBooks } = await serviceClient
    .from("books")
    .select("id, title, subject, level");

  if (!allBooks) return { ok: false, error: "books not found" };

  const bookMap = new Map(allBooks.map((b) => [`${b.subject}::${b.title}`, b]));

  const subjects = student.subjects as Subject[];
  const fromLevel = student.current_level;
  const toLevel = student.target_level;

  const routeEntries: { student_id: string; book_id: string; step_order: number; status: string }[] = [];
  let stepOrder = 1;

  for (const subject of subjects) {
    const titles = ROUTE_ORDER[subject] ?? [];
    for (const title of titles) {
      const book = bookMap.get(`${subject}::${title}`);
      if (!book) continue;
      if (book.level < fromLevel || book.level > toLevel) continue;
      routeEntries.push({
        student_id: studentId,
        book_id: book.id,
        step_order: stepOrder++,
        status: "not_started",
      });
    }
  }

  if (routeEntries.length === 0) return { ok: false, error: "no books for this level range" };

  routeEntries[0].status = "in_progress";

  const { error } = await serviceClient.from("student_routes").insert(routeEntries);
  if (error) return { ok: false, error: error.message };

  return { ok: true, count: routeEntries.length };
}
