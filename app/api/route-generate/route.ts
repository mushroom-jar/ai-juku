import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateRoute } from "@/lib/generateRoute";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { studentId } = await req.json();

  const { data: student } = await supabase
    .from("students")
    .select("id, current_level, target_level, subjects")
    .eq("id", studentId)
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });

  const serviceClient = await createServiceClient();
  const result = await generateRoute(serviceClient, studentId, student);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, count: result.count });
}
