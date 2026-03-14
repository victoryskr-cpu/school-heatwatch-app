"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type School = {
  id: string;
  name: string;
  region?: string;
};

type MeasurementRow = {
  id: string;
  school_id: string;
  measured_at: string;
  input_phase: string;
  temperature: number | null;
  humidity: number | null;
  wbgt: number | null;
  notes: string | null;
  schools?: {
    name: string;
    region?: string;
  } | null;
};

export default function AdminPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    setLoading(true);

    const [{ data: schoolData, error: schoolError }, { data: measurementData, error: measurementError }] =
      await Promise.all([
        supabase.from("schools").select("id, name, region"),
        supabase
          .from("measurements")
          .select(`
            id,
            school_id,
            measured_at,
            input_phase,
            temperature,
            humidity,
            wbgt,
            notes,
            schools (
              name,
              region
            )
          `)
          .order("measured_at", { ascending: false })
          .limit(200),
      ]);

    if (schoolError) console.error(schoolError);
    if (measurementError) console.error(measurementError);

    setSchools(schoolData || []);
    setMeasurements((measurementData as MeasurementRow[]) || []);
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  const todaySchoolIds = useMemo(() => {
    const ids = new Set<string>();
    measurements.forEach((m) => {
      if (m.measured_at.slice(0, 10) === today) {
        ids.add(m.school_id);
      }
    });
    return ids;
  }, [measurements, today]);

  const missingSchools = useMemo(() => {
    return schools.filter((school) => !todaySchoolIds.has(school.id));
  }, [schools, todaySchoolIds]);

  const avgTemperature = useMemo(() => {
    const values = measurements
      .filter((m) => m.temperature !== null)
      .map((m) => Number(m.temperature));
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [measurements]);

  const dangerRows = useMemo(() => {
    return measurements.filter((m) => {
      const t = m.temperature ?? 0;
      const w = m.wbgt ?? 0;
      return t >= 35 || w >= 28;
    });
  }, [measurements]);

  if (loading) {
    return <main style={{ padding: 24 }}>불러오는 중...</main>;
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
        관리자 대시보드
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <Card title="등록 학교 수" value={`${schools.length}개`} />
        <Card title="전체 측정 건수" value={`${measurements.length}건`} />
        <Card title="오늘 입력 학교 수" value={`${todaySchoolIds.size}개`} />
        <Card
          title="평균 온도"
          value={avgTemperature !== null ? `${avgTemperature.toFixed(1)}℃` : "-"}
        />
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          위험 의심 측정값
        </h2>
        {dangerRows.length === 0 ? (
          <p>없음</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>학교</Th>
                <Th>시각</Th>
                <Th>시점</Th>
                <Th>온도</Th>
                <Th>습도</Th>
                <Th>WBGT</Th>
              </tr>
            </thead>
            <tbody>
              {dangerRows.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <Td>{row.schools?.name || row.school_id}</Td>
                  <Td>{formatDateTime(row.measured_at)}</Td>
                  <Td>{phaseLabel(row.input_phase)}</Td>
                  <Td>{row.temperature ?? "-"}</Td>
                  <Td>{row.humidity ?? "-"}</Td>
                  <Td>{row.wbgt ?? "-"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          오늘 미입력 학교
        </h2>
        {missingSchools.length === 0 ? (
          <p>모든 학교 입력 완료</p>
        ) : (
          <ul>
            {missingSchools.map((school) => (
              <li key={school.id}>
                {school.region ? `[${school.region}] ` : ""}
                {school.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          최근 입력 목록
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>학교</Th>
              <Th>시각</Th>
              <Th>시점</Th>
              <Th>온도</Th>
              <Th>습도</Th>
              <Th>WBGT</Th>
              <Th>특이사항</Th>
            </tr>
          </thead>
          <tbody>
            {measurements.slice(0, 30).map((row) => (
              <tr key={row.id}>
                <Td>{row.schools?.name || row.school_id}</Td>
                <Td>{formatDateTime(row.measured_at)}</Td>
                <Td>{phaseLabel(row.input_phase)}</Td>
                <Td>{row.temperature ?? "-"}</Td>
                <Td>{row.humidity ?? "-"}</Td>
                <Td>{row.wbgt ?? "-"}</Td>
                <Td>{row.notes || "-"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        borderBottom: "1px solid #ddd",
        padding: "10px 8px",
        background: "#f7f7f7",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        borderBottom: "1px solid #eee",
        padding: "10px 8px",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

function phaseLabel(value: string) {
  switch (value) {
    case "start":
      return "업무 시작";
    case "peak":
      return "피크 조리";
    case "finish":
      return "마무리";
    case "extra":
      return "추가 입력";
    default:
      return value;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}