import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { routeId, status } = await req.json();
  if (!routeId || !["in_progress", "not_started"].includes(status)) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }

  // 本人のルートか確認
  const { data: route } = await supabase
    .from("student_routes")
    .select("id, status, student_id, students!inner(user_id)")
    .eq("id", routeId)
    .single();

  if (!route || (route.students as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // done / completed は変更不可
  if (route.status === "done" || route.status === "completed") {
    return NextResponse.json({ error: "cannot change completed route" }, { status: 400 });
  }

  const { error } = await supabase
    .from("student_routes")
    .update({
      status,
      started_at: status === "in_progress" ? new Date().toISOString() : null,
    })
    .eq("id", routeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
