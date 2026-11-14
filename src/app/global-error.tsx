"use client";

/** آخرین لایه خطا (حتی اگر layout اصلی خطا دهد) — بدون وابستگی به استایل‌ها */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: "Vazirmatn, Tahoma, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#faf7f3", color: "#2a1f27" }}>
        <main style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 20 }}>خطای غیرمنتظره‌ای رخ داد</h1>
          <p style={{ color: "#6b5d66" }}>لطفاً صفحه را دوباره بارگذاری کنید.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 8, border: 0, background: "#5f2c4a", color: "#fff", cursor: "pointer" }}>
            تلاش دوباره
          </button>
        </main>
      </body>
    </html>
  );
}
