import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!me) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { friendshipId, action } = await req.json();
  if (!friendshipId || !["accepted", "declined"].includes(action)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("friendships")
    .update({ status: action, responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .eq("addressee_id", me.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
