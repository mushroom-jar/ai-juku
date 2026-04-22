import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { routeId, concurrent } = await req.json();
  if (!routeId || typeof concurrent !== "boolean") {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }

  // 本人のルートか確認
  const { data: route } = await supabase
    .from("student_routes")
    .select("id, students!inner(user_id)")
    .eq("id", routeId)
    .single();

  if (!route || (route.students as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("student_routes")
    .update({ concurrent })
    .eq("id", routeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
