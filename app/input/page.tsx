"use client";

import { useEffect, useState } from "react";

export default function InputPage() {
  const [message, setMessage] = useState("불러오는 중...");
  const [debugUrl, setDebugUrl] = useState("");
  const [debugKeyHead, setDebugKeyHead] = useState("");

  useEffect(() => {
    testFetch();
  }, []);

  async function testFetch() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    setDebugUrl(url);
    setDebugKeyHead(key ? key.slice(0, 20) : "(없음)");

    try {
      const res = await fetch(`${url}/rest/v1/schools?select=id,school_name,branch_name`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      setMessage(`HTTP 상태: ${res.status}`);

      const text = await res.text();
      console.log("REST 응답:", text);
    } catch (err) {
      console.error("직접 fetch 오류:", err);
      setMessage(`직접 fetch 예외: ${err instanceof Error ? err.toString() : String(err)}`);
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <h1>학교 급식실 폭염 입력</h1>
      <p>{message}</p>

      <div style={{ marginTop: 16, padding: 12, background: "#f5f5f5" }}>
        <div><strong>URL:</strong> {debugUrl}</div>
        <div><strong>KEY 앞부분:</strong> {debugKeyHead}</div>
      </div>
    </main>
  );
}