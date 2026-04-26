"use client";

import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

type OrgStudent = {
  id: string;
  name: string;
  grade: number;
  target_univ: string | null;
  current_level: number;
  xp: number;
  subjects: string[];
  weekMinutes: number;
  lastActiveAt: string | null;
  daysSinceActive: number | null;
  needsAttention: boolean;
};

type Organization = {
  id: string;
  name: string;
  type: string;
};

type DashboardData = {
  org?: Organization;
  students?: OrgStudent[];
  memberRole?: string;
  error?: string;
};

type SpecialInvite = {
  id: string;
  code: string;
  plan: "basic" | "premium";
  free_months: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  status: "active" | "inactive" | "expired";
  note: string | null;
  created_at: string;
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours}時間${remain}分` : `${hours}時間`;
}

function formatDate(value: string | null) {
  if (!value) return "未記録";
  return new Date(value).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function attentionLabel(daysSinceActive: number | null) {
  if (daysSinceActive === null) return "最近の活動なし";
  if (daysSinceActive >= 7) return `${daysSinceActive}日未活動`;
  if (daysSinceActive >= 3) return `${daysSinceActive}日停滞`;
  return "活動中";
}

function attentionTone(daysSinceActive: number | null, needsAttention: boolean) {
  if (needsAttention && daysSinceActive !== null && daysSinceActive >= 7) {
    return { background: "#FEF2F2", text: "#B91C1C", border: "#FECACA" };
  }
  if (needsAttention) {
    return { background: "#FFFBEB", text: "#D97706", border: "#FDE68A" };
  }
  return { background: "#F0FDF4", text: "#059669", border: "#A7F3D0" };
}

export default function OrgPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // 招待管理
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [invites, setInvites] = useState<SpecialInvite[]>([]);
  const [inviteListLoading, setInviteListLoading] = useState(false);
  const [invitePlan, setInvitePlan] = useState<"basic" | "premium">("basic");
  const [inviteMonths, setInviteMonths] = useState(3);
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpires, setInviteExpires] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // 個別無料付与
  const [grantStudentId, setGrantStudentId] = useState("");
  const [grantPlan, setGrantPlan] = useState<"basic" | "premium">("basic");
  const [grantMonths, setGrantMonths] = useState(3);
  const [grantNote, setGrantNote] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/org/dashboard");
    if (response.status === 401 || response.status === 403) {
      router.push("/login");
      return;
    }
    const json = (await response.json()) as DashboardData;
    setData(json);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    if (!showAddModal) return;
    const timeoutId = window.setTimeout(() => {
      emailRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timeoutId);
  }, [showAddModal]);

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail.trim()) return;

    setAddLoading(true);
    setAddError("");

    const response = await fetch("/api/org/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail.trim() }),
    });

    const json = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      setAddError(json.error ?? "生徒の追加に失敗しました。");
      setAddLoading(false);
      return;
    }

    setAddEmail("");
    setShowAddModal(false);
    setAddLoading(false);
    await load();
  }

  async function handleRemoveStudent(studentId: string, name: string) {
    const confirmed = window.confirm(`${name} さんを一覧から外しますか？`);
    if (!confirmed) return;

    await fetch("/api/org/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });

    await load();
  }

  async function loadInvites() {
    setInviteListLoading(true);
    const res = await fetch("/api/admin/special-invites");
    const json = await res.json() as { invites?: SpecialInvite[] };
    setInvites(json.invites ?? []);
    setInviteListLoading(false);
  }

  async function handleToggleInviteSection() {
    const next = !showInviteSection;
    setShowInviteSection(next);
    if (next && invites.length === 0) await loadInvites();
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteCreating(true);
    setInviteError("");
    const res = await fetch("/api/admin/special-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: invitePlan,
        free_months: inviteMonths,
        max_uses: inviteMaxUses,
        expires_at: inviteExpires || null,
        note: inviteNote || null,
      }),
    });
    const json = await res.json() as { invite?: SpecialInvite; error?: string };
    if (!res.ok) { setInviteError(json.error ?? "作成に失敗しました。"); setInviteCreating(false); return; }
    setInvites((prev) => [json.invite!, ...prev]);
    setInviteNote("");
    setInviteCreating(false);
  }

  async function handleDeactivate(inviteId: string) {
    await fetch(`/api/admin/special-invites/${inviteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });
    setInvites((prev) => prev.map((inv) => inv.id === inviteId ? { ...inv, status: "inactive" as const } : inv));
  }

  async function handleManualGrant(e: React.FormEvent) {
    e.preventDefault();
    setGrantLoading(true);
    setGrantMsg("");
    const res = await fetch("/api/admin/manual-grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: grantStudentId, plan: grantPlan, months: grantMonths, note: grantNote || undefined }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    setGrantMsg(res.ok ? "付与しました。" : (json.error ?? "失敗しました。"));
    setGrantLoading(false);
    if (res.ok) { setGrantStudentId(""); setGrantNote(""); }
  }

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
      </div>
    );
  }

  const students = data?.students ?? [];
  const attentionStudents = students.filter((student) => student.needsAttention);
  const filteredStudents = students.filter((student) => {
    if (!search.trim()) return true;
    return student.name.includes(search) || (student.target_univ ?? "").includes(search);
  });

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <Link href="/" style={logoStyle}>
            <span style={logoBadgeStyle}>AI</span>
            <span style={logoTextStyle}>永愛塾</span>
          </Link>
          <div style={headerRightStyle}>
            {data?.org && (
              <span style={orgNameStyle}>
                <Building2 size={13} />
                {data.org.name}
              </span>
            )}
            <span style={headerRoleStyle}>
              <Users size={14} />
              塾・学校ダッシュボード
            </span>
          </div>
        </div>
      </header>

      {showAddModal && (
        <div style={modalOverlayStyle} onClick={() => setShowAddModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeadStyle}>
              <p style={modalHeadingStyle}>生徒を追加</p>
              <button onClick={() => setShowAddModal(false)} style={iconButtonStyle}>
                <X size={16} />
              </button>
            </div>
            <p style={modalBodyStyle}>
              生徒のメールアドレスを入力すると、この組織の管理対象として一覧に追加できます。
            </p>
            <form onSubmit={handleAddStudent} style={modalFormStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>生徒のメールアドレス</span>
                <input
                  ref={emailRef}
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  required
                  placeholder="student@example.com"
                  style={inputStyle}
                />
              </label>
              {addError && <p style={errorStyle}>{addError}</p>}
              <button type="submit" disabled={addLoading} style={submitButtonStyle(addLoading)}>
                {addLoading ? "追加中..." : "生徒を追加"}
              </button>
            </form>
          </div>
        </div>
      )}

      <main style={mainStyle}>
        {attentionStudents.length > 0 && (
          <section style={attentionCardStyle}>
            <div style={attentionHeadStyle}>
              <AlertTriangle size={16} color="#D97706" />
              <span style={attentionTitleStyle}>要注意の生徒が {attentionStudents.length} 人います</span>
            </div>
            <div style={attentionListStyle}>
              {attentionStudents.map((student) => {
                const tone = attentionTone(student.daysSinceActive, student.needsAttention);
                return (
                  <Link key={student.id} href={`/org/students/${student.id}`} style={attentionRowStyle}>
                    <div style={attentionStudentStyle}>
                      <div style={avatarStyle}>{student.name.charAt(0)}</div>
                      <div>
                        <p style={rowTitleStyle}>{student.name}</p>
                        <p style={rowMetaStyle}>学年 {student.grade} / {student.target_univ ?? "志望校未設定"}</p>
                      </div>
                    </div>
                    <div style={attentionMetaStyle}>
                      <span style={{ ...attentionPillStyle, background: tone.background, color: tone.text, border: `1px solid ${tone.border}` }}>
                        {attentionLabel(student.daysSinceActive)}
                      </span>
                      <ChevronRight size={16} color="#94A3B8" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section style={cardStyle}>
          <div style={sectionHeadStyle}>
            <div>
              <p style={sectionEyebrowStyle}>生徒一覧</p>
              <h1 style={sectionTitleStyle}>登録生徒 {students.length} 人</h1>
            </div>
            <div style={toolbarStyle}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="名前や志望校で検索"
                style={searchInputStyle}
              />
              {data?.memberRole === "admin" && (
                <button onClick={() => { setAddError(""); setShowAddModal(true); }} style={addButtonStyle}>
                  <Plus size={14} />
                  生徒を追加
                </button>
              )}
            </div>
          </div>

          {students.length === 0 ? (
            <div style={emptyStateStyle}>
              <p style={emptyStateTextStyle}>
                まだ生徒が紐づいていません。生徒のメールアドレスを追加して、管理一覧を作りましょう。
              </p>
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {["生徒", "学年", "志望校", "今週の勉強時間", "最終活動日", "状況", "詳細", ...(data?.memberRole === "admin" ? ["削除"] : [])].map((heading) => (
                      <th key={heading} style={thStyle}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const tone = attentionTone(student.daysSinceActive, student.needsAttention);
                    return (
                      <tr key={student.id} style={trStyle}>
                        <td style={tdStyle}>
                          <div style={studentCellStyle}>
                            <div style={avatarStyle}>{student.name.charAt(0)}</div>
                            <span style={studentNameCellStyle}>{student.name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}><span style={gradeTagStyle}>学年 {student.grade}</span></td>
                        <td style={tdStyle}><span style={plainTextStyle}>{student.target_univ ?? "未設定"}</span></td>
                        <td style={tdStyle}>
                          <div style={timeCellStyle}>
                            <Clock size={13} color="#3157B7" />
                            <span style={timeValueStyle}>{formatMinutes(student.weekMinutes)}</span>
                          </div>
                        </td>
                        <td style={tdStyle}><span style={plainTextStyle}>{formatDate(student.lastActiveAt)}</span></td>
                        <td style={tdStyle}>
                          <span style={{ ...attentionPillStyle, background: tone.background, color: tone.text, border: `1px solid ${tone.border}` }}>
                            {attentionLabel(student.daysSinceActive)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <Link href={`/org/students/${student.id}`} style={detailLinkStyle}>
                            詳細
                            <ChevronRight size={12} />
                          </Link>
                        </td>
                        {data?.memberRole === "admin" && (
                          <td style={tdStyle}>
                            <button
                              onClick={() => void handleRemoveStudent(student.id, student.name)}
                              style={removeButtonStyle}
                              title="一覧から外す"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── 招待管理 ── */}
        <section style={inviteSectionStyle}>
          <button onClick={() => void handleToggleInviteSection()} style={inviteToggleBtnStyle}>
            <span style={{ fontWeight: 900, fontSize: 14 }}>招待・無料付与の管理</span>
            <ChevronRight size={16} style={{ transform: showInviteSection ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {showInviteSection && (
            <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
              {/* コード発行フォーム */}
              <div style={inviteCardStyle}>
                <p style={inviteCardTitleStyle}>特別招待コードを発行</p>
                <form onSubmit={(e) => void handleCreateInvite(e)} style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={inviteFieldStyle}>
                      <span style={inviteLabelStyle}>プラン</span>
                      <select value={invitePlan} onChange={(e) => setInvitePlan(e.target.value as "basic" | "premium")} style={inviteInputStyle}>
                        <option value="basic">AIパートナー</option>
                        <option value="premium">永愛塾</option>
                      </select>
                    </label>
                    <label style={inviteFieldStyle}>
                      <span style={inviteLabelStyle}>無料期間</span>
                      <select value={inviteMonths} onChange={(e) => setInviteMonths(Number(e.target.value))} style={inviteInputStyle}>
                        <option value={1}>1ヶ月</option>
                        <option value={3}>3ヶ月</option>
                        <option value={12}>12ヶ月</option>
                      </select>
                    </label>
                    <label style={inviteFieldStyle}>
                      <span style={inviteLabelStyle}>使用上限</span>
                      <input type="number" min={1} max={100} value={inviteMaxUses} onChange={(e) => setInviteMaxUses(Number(e.target.value))} style={inviteInputStyle} />
                    </label>
                    <label style={inviteFieldStyle}>
                      <span style={inviteLabelStyle}>有効期限（任意）</span>
                      <input type="date" value={inviteExpires} onChange={(e) => setInviteExpires(e.target.value)} style={inviteInputStyle} />
                    </label>
                  </div>
                  <label style={inviteFieldStyle}>
                    <span style={inviteLabelStyle}>メモ（任意）</span>
                    <input value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} style={inviteInputStyle} placeholder="誰向けか、用途など" />
                  </label>
                  {inviteError && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{inviteError}</p>}
                  <button type="submit" disabled={inviteCreating} style={inviteSubmitBtnStyle(inviteCreating)}>
                    {inviteCreating ? "発行中..." : "コードを発行"}
                  </button>
                </form>
              </div>

              {/* 発行済みコード一覧 */}
              <div style={inviteCardStyle}>
                <p style={inviteCardTitleStyle}>発行済みコード一覧</p>
                {inviteListLoading ? (
                  <p style={{ fontSize: 13, color: "#94A3B8" }}>読み込み中...</p>
                ) : invites.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#94A3B8" }}>まだコードがありません</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {invites.map((inv) => (
                      <div key={inv.id} style={inviteRowStyle}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 900, color: "#1E293B" }}>{inv.code}</span>
                            <span style={inviteBadgeStyle(inv.status)}>{inv.status === "active" ? "有効" : "無効"}</span>
                            <span style={{ fontSize: 11, color: "#64748B" }}>{inv.plan === "premium" ? "永愛塾" : "AIパートナー"} {inv.free_months}ヶ月</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                            使用: {inv.used_count}/{inv.max_uses}
                            {inv.expires_at && ` · 期限: ${new Date(inv.expires_at).toLocaleDateString("ja-JP")}`}
                            {inv.note && ` · ${inv.note}`}
                          </div>
                        </div>
                        {inv.status === "active" && (
                          <button onClick={() => void handleDeactivate(inv.id)} style={inviteDeactivateBtnStyle}>
                            無効化
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 個別無料付与 */}
              <div style={inviteCardStyle}>
                <p style={inviteCardTitleStyle}>個別に無料付与する</p>
                <form onSubmit={(e) => void handleManualGrant(e)} style={{ display: "grid", gap: 12 }}>
                  <label style={inviteFieldStyle}>
                    <span style={inviteLabelStyle}>生徒を選択</span>
                    <select value={grantStudentId} onChange={(e) => setGrantStudentId(e.target.value)} required style={inviteInputStyle}>
                      <option value="">-- 生徒を選ぶ --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={inviteFieldStyle}>
                      <span style={inviteLabelStyle}>プラン</span>
                      <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value as "basic" | "premium")} style={inviteInputStyle}>
                        <option value="basic">AIパートナー</option>
                        <option value="premium">永愛塾</option>
                      </select>
                    </label>
                    <label style={inviteFieldStyle}>
                      <span style={inviteLabelStyle}>無料期間</span>
                      <select value={grantMonths} onChange={(e) => setGrantMonths(Number(e.target.value))} style={inviteInputStyle}>
                        <option value={1}>1ヶ月</option>
                        <option value={3}>3ヶ月</option>
                        <option value={12}>12ヶ月</option>
                      </select>
                    </label>
                  </div>
                  <label style={inviteFieldStyle}>
                    <span style={inviteLabelStyle}>メモ（任意）</span>
                    <input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} style={inviteInputStyle} placeholder="理由や備考など" />
                  </label>
                  {grantMsg && <p style={{ margin: 0, fontSize: 12, color: grantMsg === "付与しました。" ? "#059669" : "#DC2626", fontWeight: 700 }}>{grantMsg}</p>}
                  <button type="submit" disabled={grantLoading || !grantStudentId} style={inviteSubmitBtnStyle(grantLoading || !grantStudentId)}>
                    {grantLoading ? "付与中..." : "無料付与する"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F7F7F5",
};

const loadingStyle: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid #E2E8F0",
  borderTop: "3px solid #7C3AED",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid #E8E8E4",
};

const headerInnerStyle: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "0 16px",
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const logoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
};

const logoBadgeStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "#1E293B",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
};

const logoTextStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#1E293B",
};

const headerRightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const orgNameStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 13,
  fontWeight: 700,
  color: "#475569",
};

const headerRoleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: "#7C3AED",
  background: "#F5F3FF",
  padding: "6px 10px",
  borderRadius: 999,
};

const mainStyle: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "20px 16px 80px",
  display: "grid",
  gap: 14,
};

const inviteSectionStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  padding: "16px 20px",
};
const inviteToggleBtnStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  color: "#1E293B",
};
const inviteCardStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  padding: "16px 18px",
};
const inviteCardTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 13,
  fontWeight: 900,
  color: "#0F172A",
};
const inviteFieldStyle: CSSProperties = { display: "grid", gap: 4 };
const inviteLabelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748B" };
const inviteInputStyle: CSSProperties = {
  minHeight: 38,
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  background: "#fff",
  padding: "0 10px",
  fontSize: 13,
  color: "#0F172A",
  width: "100%",
  boxSizing: "border-box",
};
const inviteSubmitBtnStyle = (disabled: boolean): CSSProperties => ({
  minHeight: 40,
  borderRadius: 999,
  border: "none",
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #7C3AED, #A78BFA)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
  cursor: disabled ? "default" : "pointer",
});
const inviteRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fff",
  border: "1px solid #E2E8F0",
};
const inviteBadgeStyle = (status: string): CSSProperties => ({
  fontSize: 10,
  fontWeight: 800,
  padding: "2px 8px",
  borderRadius: 999,
  background: status === "active" ? "#DCFCE7" : "#F1F5F9",
  color: status === "active" ? "#059669" : "#94A3B8",
});
const inviteDeactivateBtnStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  color: "#DC2626",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};

const attentionCardStyle: CSSProperties = {
  background: "#FFFBEB",
  border: "1px solid #FDE68A",
  borderRadius: 18,
  padding: "16px 18px",
  display: "grid",
  gap: 12,
};

const attentionHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const attentionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#92400E",
};

const attentionListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const attentionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#fff",
  borderRadius: 12,
  padding: "12px 14px",
  textDecoration: "none",
  border: "1px solid #FDE68A",
  gap: 12,
};

const attentionStudentStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const attentionMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 18,
  padding: "16px 18px",
  display: "grid",
  gap: 14,
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const sectionEyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#94A3B8",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: "#0F172A",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const searchInputStyle: CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  padding: "0 14px",
  fontSize: 14,
  color: "#0F172A",
  background: "#FAFAFA",
  minWidth: 220,
};

const addButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "#7C3AED",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const emptyStateStyle: CSSProperties = {
  padding: "40px 20px",
  background: "#F8FAFC",
  borderRadius: 12,
};

const emptyStateTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#64748B",
  textAlign: "center",
  lineHeight: 1.8,
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 800,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid #F1F5F9",
  whiteSpace: "nowrap",
};

const trStyle: CSSProperties = {
  borderBottom: "1px solid #F8FAFC",
};

const tdStyle: CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
};

const studentCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const avatarStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "#EEF4FF",
  color: "#3157B7",
  fontSize: 14,
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const studentNameCellStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#0F172A",
};

const gradeTagStyle: CSSProperties = {
  padding: "3px 8px",
  borderRadius: 6,
  background: "#F1F5F9",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
};

const plainTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#475569",
};

const timeCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const timeValueStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#3157B7",
};

const attentionPillStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  display: "inline-block",
};

const detailLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 12,
  fontWeight: 800,
  color: "#7C3AED",
  textDecoration: "none",
};

const removeButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid #FCA5A5",
  background: "#FEF2F2",
  color: "#DC2626",
  cursor: "pointer",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.5)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: "28px 24px",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
};

const modalHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const modalHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
  color: "#0F172A",
};

const iconButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#64748B",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalBodyStyle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 13,
  color: "#64748B",
  lineHeight: 1.6,
};

const modalFormStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const inputStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  background: "#FAFAFA",
  padding: "0 14px",
  fontSize: 14,
  color: "#0F172A",
  width: "100%",
  boxSizing: "border-box",
};

const submitButtonStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  border: "none",
  background: disabled ? "#CBD5E1" : "#7C3AED",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  cursor: disabled ? "default" : "pointer",
});

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#DC2626",
  fontSize: 13,
  fontWeight: 700,
};

const rowTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
  color: "#0F172A",
};

const rowMetaStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#64748B",
};
