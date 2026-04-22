import { Suspense } from "react";
import AppLayout from "@/app/components/AppLayout";
import MySensei from "@/app/components/MySensei";

export default function MySenseiPage() {
  return (
    <AppLayout>
      <Suspense>
        <MySensei />
      </Suspense>
    </AppLayout>
  );
}
