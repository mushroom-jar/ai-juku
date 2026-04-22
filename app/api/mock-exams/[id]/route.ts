import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("mock_exams")
    .delete()
    .eq("id", id)
    .in("student_id", (
      await supabase.from("students").select("id").eq("user_id", user.id)
    ).data?.map((s: { id: string }) => s.id) ?? []);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
