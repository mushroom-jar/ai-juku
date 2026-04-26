import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

// Send to a specific student's subscriptions
async function sendToStudent(studentId: string, payload: PushPayload) {
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("student_id", studentId);

  if (!subs?.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        // 410 Gone means subscription is no longer valid
        if (typeof err === "object" && err !== null && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return { sent, failed };
}

function verifyAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function sendBulkByTime(currentTime: string) {
  const supabase = await createClient();

  const [{ data: morningPrefs }, { data: eveningPrefs }] = await Promise.all([
    supabase
      .from("notification_prefs")
      .select("student_id")
      .eq("morning_enabled", true)
      .eq("morning_time", currentTime),
    supabase
      .from("notification_prefs")
      .select("student_id")
      .eq("evening_enabled", true)
      .eq("evening_time", currentTime),
  ]);

  let morningSent = 0;
  let eveningSent = 0;

  await Promise.all([
    ...(morningPrefs ?? []).map(async (pref) => {
      const r = await sendToStudent(pref.student_id, {
        title: "おはようございます",
        body: "今日も一歩前に進みましょう。",
        url: "/schedule",
        tag: "morning",
      });
      morningSent += r.sent;
    }),
    ...(eveningPrefs ?? []).map(async (pref) => {
      const r = await sendToStudent(pref.student_id, {
        title: "今日の振り返り",
        body: "今日の学習を記録しておきましょう。",
        url: "/reflection",
        tag: "evening",
      });
      eveningSent += r.sent;
    }),
  ]);

  return { morning: morningSent, evening: eveningSent };
}

// Vercel Cron Jobs use GET
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const nowJst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const currentTime = `${String(nowJst.getHours()).padStart(2, "0")}:${String(nowJst.getMinutes()).padStart(2, "0")}`;

  const result = await sendBulkByTime(currentTime);
  return NextResponse.json(result);
}

// POST: custom/manual sends
export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    type?: "morning" | "evening" | "custom";
    studentId?: string;
    title?: string;
    message?: string;
    url?: string;
  };

  if (body.type === "custom" && body.studentId) {
    const result = await sendToStudent(body.studentId, {
      title: body.title ?? "永愛塾",
      body: body.message ?? "",
      url: body.url ?? "/",
      tag: "custom",
    });
    return NextResponse.json(result);
  }

  const nowJst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const currentTime = `${String(nowJst.getHours()).padStart(2, "0")}:${String(nowJst.getMinutes()).padStart(2, "0")}`;
  const result = await sendBulkByTime(currentTime);
  return NextResponse.json(result);
}
