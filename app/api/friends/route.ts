import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type StudentRow = { id: string; name: string; target_univ: string | null };

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("students").select("id, name").eq("user_id", user.id).single();
  if (!me) return NextResponse.json({ error: "not found" }, { status: 404 });

  const service = await createServiceClient();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  const { data: relations } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`)
    .order("created_at", { ascending: false });

  const relationRows = (relations ?? []) as FriendshipRow[];
  const relatedIds = Array.from(
    new Set(
      relationRows.flatMap((row) => [row.requester_id, row.addressee_id]).filter((id) => id !== me.id)
    )
  );

  let relatedStudents: StudentRow[] = [];
  if (relatedIds.length > 0) {
    const { data } = await service.from("students").select("id, name, target_univ").in("id", relatedIds);
    relatedStudents = (data ?? []) as StudentRow[];
  }
  const studentMap = new Map(relatedStudents.map((student) => [student.id, student]));

  const friends = relationRows
    .filter((row) => row.status === "accepted")
    .map((row) => {
      const otherId = row.requester_id === me.id ? row.addressee_id : row.requester_id;
      const other = studentMap.get(otherId);
      return {
        friendshipId: row.id,
        id: otherId,
        name: other?.name ?? "ユーザー",
        targetUniv: other?.target_univ ?? null,
      };
    });

  const incoming = relationRows
    .filter((row) => row.status === "pending" && row.addressee_id === me.id)
    .map((row) => ({
      friendshipId: row.id,
      id: row.requester_id,
      name: studentMap.get(row.requester_id)?.name ?? "ユーザー",
      targetUniv: studentMap.get(row.requester_id)?.target_univ ?? null,
      createdAt: row.created_at,
    }));

  const outgoingIds = relationRows
    .filter((row) => row.status === "pending" && row.requester_id === me.id)
    .map((row) => row.addressee_id);

  let suggestions: StudentRow[] = [];
  if (q) {
    const excludedIds = new Set([me.id, ...relatedIds]);
    const { data } = await service
      .from("students")
      .select("id, name, target_univ")
      .ilike("name", `%${q}%`)
      .limit(12);
    suggestions = ((data ?? []) as StudentRow[]).filter((student) => !excludedIds.has(student.id));
  }

  return NextResponse.json({
    me,
    friends,
    incoming,
    outgoingIds,
    suggestions,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!me) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { addresseeId } = await req.json();
  if (!addresseeId || addresseeId === me.id) {
    return NextResponse.json({ error: "invalid addressee" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: reverse } = await service
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`and(requester_id.eq.${me.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${me.id})`)
    .maybeSingle();

  if (reverse?.status === "accepted") {
    return NextResponse.json({ error: "already friends" }, { status: 400 });
  }

  if (reverse?.status === "pending") {
    return NextResponse.json({ error: "request already exists" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({ requester_id: me.id, addressee_id: addresseeId, status: "pending" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ friendshipId: data.id });
}
