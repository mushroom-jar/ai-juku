"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/app/components/AppLayout";
import { Check, Search, UserPlus, Users, X } from "lucide-react";

type FriendItem = {
  friendshipId: string;
  id: string;
  name: string;
  targetUniv: string | null;
  createdAt?: string;
};

type FriendsResponse = {
  me: { id: string; name: string };
  friends: FriendItem[];
  incoming: FriendItem[];
  outgoingIds: string[];
  suggestions: Array<{ id: string; name: string; target_univ: string | null }>;
};

export default function FriendsPage() {
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const loadFriends = useCallback(async (search = "") => {
    const suffix = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/friends${suffix}`, { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFriends();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFriends]);

  async function handleSearch() {
    setSearching(true);
    await loadFriends(query.trim());
  }

  async function sendRequest(addresseeId: string) {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresseeId }),
    });
    await loadFriends(query.trim());
  }

  async function respond(friendshipId: string, action: "accepted" | "declined") {
    await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action }),
    });
    await loadFriends(query.trim());
  }

  const friendCount = useMemo(() => data?.friends.length ?? 0, [data]);

  return (
    <AppLayout>
      <div style={{ padding: "28px 24px 80px", display: "grid", gap: 20 }}>
        <section style={heroStyle}>
          <div style={{ maxWidth: 720 }}>
            <div style={chipStyle}><Users size={13} strokeWidth={2.4} /> friends</div>
            <h1 style={titleStyle}>友達と一緒に勉強を続ける</h1>
            <p style={subtitleStyle}>友達申請、承認、友達一覧までここで管理できます。友達のタイムラインや勉強時間ランキングにもつながります。</p>
          </div>
          <div style={statWrapStyle}>
            <StatCard label="友達" value={`${friendCount}人`} note="accepted" />
            <StatCard label="申請" value={`${data?.incoming.length ?? 0}件`} note="incoming" />
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={searchBoxStyle}>
              <Search size={16} strokeWidth={2.2} color="#64748B" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前で友達を探す" style={searchInputStyle} />
            </div>
            <button onClick={() => void handleSearch()} style={searchButtonStyle}>{searching ? "検索中..." : "探す"}</button>
          </div>

          {query.trim() ? (
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              {(data?.suggestions ?? []).length > 0 ? (
                data!.suggestions.map((student) => (
                  <div key={student.id} style={rowStyle}>
                    <div>
                      <div style={rowNameStyle}>{student.name}</div>
                      {student.target_univ ? <div style={rowMetaStyle}>志望校: {student.target_univ}</div> : null}
                    </div>
                    <button onClick={() => void sendRequest(student.id)} disabled={data?.outgoingIds.includes(student.id)} style={actionButtonStyle}>
                      <UserPlus size={15} strokeWidth={2.2} />
                      {data?.outgoingIds.includes(student.id) ? "申請中" : "友達申請"}
                    </button>
                  </div>
                ))
              ) : (
                <Empty text="見つかる候補がまだありません。名前を少し変えて探してみてください。" />
              )}
            </div>
          ) : null}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <section style={panelStyle}>
            <SectionTitle title="申請が届いています" subtitle="承認すると友達ランキングや友達タイムラインに出てきます" />
            <div style={{ display: "grid", gap: 10 }}>
              {(data?.incoming ?? []).length > 0 ? data!.incoming.map((friend) => (
                <div key={friend.friendshipId} style={rowStyle}>
                  <div>
                    <div style={rowNameStyle}>{friend.name}</div>
                    {friend.targetUniv ? <div style={rowMetaStyle}>志望校: {friend.targetUniv}</div> : null}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => void respond(friend.friendshipId, "accepted")} style={acceptButtonStyle}><Check size={14} strokeWidth={2.4} /> 承認</button>
                    <button onClick={() => void respond(friend.friendshipId, "declined")} style={declineButtonStyle}><X size={14} strokeWidth={2.4} /> 断る</button>
                  </div>
                </div>
              )) : <Empty text="今は友達申請は届いていません。" />}
            </div>
          </section>

          <section style={panelStyle}>
            <SectionTitle title="友達一覧" subtitle="友達だけの勉強時間ランキングやタイムラインに使われます" />
            <div style={{ display: "grid", gap: 10 }}>
              {(data?.friends ?? []).length > 0 ? data!.friends.map((friend) => (
                <div key={friend.id} style={rowStyle}>
                  <div>
                    <div style={rowNameStyle}>{friend.name}</div>
                    {friend.targetUniv ? <div style={rowMetaStyle}>志望校: {friend.targetUniv}</div> : null}
                  </div>
                  <div style={friendBadgeStyle}>friend</div>
                </div>
              )) : <Empty text="まだ友達はいません。気になる相手を探してみよう。" />}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{title}</div><div style={{ marginTop: 4, fontSize: 13, color: "#64748B" }}>{subtitle}</div></div>;
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <div style={statCardStyle}><div style={{ fontSize: 11, color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{value}</div><div style={{ marginTop: 4, fontSize: 11, color: "#94A3B8" }}>{note}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <div style={{ borderRadius: 18, padding: "16px 18px", background: "#F8FAFC", border: "1px dashed rgba(148, 163, 184, 0.24)", fontSize: 13, color: "#64748B", lineHeight: 1.8 }}>{text}</div>;
}

const heroStyle: CSSProperties = { borderRadius: 28, padding: "24px", background: "linear-gradient(135deg, #F8FBFF 0%, #FFFFFF 58%, #F8FAFC 100%)", border: "1px solid rgba(148, 163, 184, 0.16)", boxShadow: "0 22px 48px rgba(15, 23, 42, 0.06)", display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" };
const chipStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 800 };
const titleStyle: CSSProperties = { margin: "14px 0 0", fontSize: 30, lineHeight: 1.15, fontWeight: 900, color: "#0F172A" };
const subtitleStyle: CSSProperties = { margin: "10px 0 0", maxWidth: 620, fontSize: 14, lineHeight: 1.8, color: "#475569" };
const statWrapStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: 10, minWidth: "min(100%, 280px)" };
const statCardStyle: CSSProperties = { borderRadius: 20, border: "1px solid rgba(148, 163, 184, 0.14)", background: "#FFFFFF", padding: "14px 16px" };
const panelStyle: CSSProperties = { borderRadius: 24, padding: 20, background: "#FFFFFF", border: "1px solid rgba(148, 163, 184, 0.16)", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)" };
const searchBoxStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 240, borderRadius: 16, border: "1px solid rgba(148, 163, 184, 0.18)", background: "#F8FAFC", padding: "0 12px" };
const searchInputStyle: CSSProperties = { flex: 1, height: 44, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#0F172A" };
const searchButtonStyle: CSSProperties = { height: 44, padding: "0 18px", borderRadius: 14, border: "none", background: "#0F172A", color: "#FFFFFF", fontSize: 14, fontWeight: 800, cursor: "pointer" };
const rowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(148, 163, 184, 0.14)" };
const rowNameStyle: CSSProperties = { fontSize: 14, fontWeight: 900, color: "#0F172A" };
const rowMetaStyle: CSSProperties = { marginTop: 4, fontSize: 12, color: "#64748B" };
const actionButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 14px", borderRadius: 12, border: "none", background: "#1D4ED8", color: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer" };
const acceptButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 12, border: "none", background: "#059669", color: "#FFFFFF", fontSize: 12, fontWeight: 800, cursor: "pointer" };
const declineButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.2)", background: "#FFFFFF", color: "#475569", fontSize: 12, fontWeight: 800, cursor: "pointer" };
const friendBadgeStyle: CSSProperties = { padding: "5px 9px", borderRadius: 999, background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 800, textTransform: "uppercase" };
