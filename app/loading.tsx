import AppLayout from "@/app/components/AppLayout";

export default function Loading() {
  return (
    <AppLayout>
      <div style={{ padding: "20px 16px 96px" }}>
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              height: 84,
              borderRadius: 24,
              background: "linear-gradient(90deg, rgba(226,232,240,0.9), rgba(241,245,249,0.95), rgba(226,232,240,0.9))",
              opacity: 0.9,
            }}
          />
          <div
            style={{
              height: 420,
              borderRadius: 28,
              background: "linear-gradient(90deg, rgba(226,232,240,0.7), rgba(248,250,252,0.95), rgba(226,232,240,0.7))",
              opacity: 0.82,
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}
