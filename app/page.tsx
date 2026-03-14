"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";
import FeedbackModal from "../components/FeedbackModal";

type Phase = "start" | "peak" | "finish" | "other";
type RiskLevel = "normal" | "caution" | "danger" | "stop" | null;
type ExpandPanel = "none" | "special" | "photo";

type MeasurementRecord = {
  id: string;
  phase: Phase;
  temperature: number;
  humidity: number;
  wbgt_internal: number | null;
  risk_level: RiskLevel;
  created_at: string;
  client_measured_at: string | null;
  measure_date: string;
  special_note: string | null;
};

const SCHOOL_ID = "7f4ebfa1-7716-4e8a-b94e-cc922bc562f7";
const WATCHER_ID = "5671e22c-6988-4d34-98ae-34e64f7602ab";

const DEFAULT_SCHOOL_NAME = "대구고등학교";
const DEFAULT_REPORTER_NAME = "미입력";

const SPECIAL_NOTE_OPTIONS = [
  "환기장치 고장",
  "휴가 등으로 인원 부족",
  "온열환자 발생",
  "조리량 많음",
  "튀김작업 많음",
  "실내 공기정체",
  "냉방 미작동",
  "기타",
] as const;

function getTodayKstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDisplayTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function phaseLabel(phase: Phase) {
  switch (phase) {
    case "start":
      return "업무시작";
    case "peak":
      return "최대조리";
    case "finish":
      return "마무리작업";
    case "other":
      return "기타";
    default:
      return phase;
  }
}

function riskLabel(risk: RiskLevel) {
  switch (risk) {
    case "normal":
      return "정상";
    case "caution":
      return "주의";
    case "danger":
      return "위험";
    case "stop":
      return "작업중지";
    default:
      return "-";
  }
}

function riskColor(risk: RiskLevel) {
  switch (risk) {
    case "normal":
      return "#15803d";
    case "caution":
      return "#d97706";
    case "danger":
      return "#ef4444";
    case "stop":
      return "#b91c1c";
    default:
      return "#475569";
  }
}

function calcWetBulbStull(tempC: number, rh: number) {
  const tw =
    tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tempC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035;

  return tw;
}

function calcWbgtEstimate(tempC: number, rh: number) {
  const tw = calcWetBulbStull(tempC, rh);
  return Number((0.7 * tw + 0.3 * tempC).toFixed(2));
}

function calcRiskLevel(wbgt: number): RiskLevel {
  if (Number.isNaN(wbgt)) return null;
  if (wbgt < 28) return "normal";
  if (wbgt < 31) return "caution";
  if (wbgt < 33) return "danger";
  return "stop";
}

function buildSpecialNote(
  selectedNotes: string[],
  otherText: string
): string | null {
  const cleaned = selectedNotes.filter(Boolean);
  const hasOther = cleaned.includes("기타");

  const finalNotes = hasOther
    ? cleaned.map((item) =>
        item === "기타" && otherText.trim() ? `기타:${otherText.trim()}` : item
      )
    : cleaned;

  if (finalNotes.length === 0) return null;
  return finalNotes.join(" | ");
}

function getRiskBannerText(risk: RiskLevel) {
  switch (risk) {
    case "danger":
      return "⚠ 위험 수준입니다. 휴식과 작업조정이 필요합니다.";
    case "stop":
      return "⛔ 작업중지 기준입니다. 즉시 보고와 대응이 필요합니다.";
    default:
      return "";
  }
}

export default function Home() {
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL_NAME);
  const [reporterName, setReporterName] = useState(DEFAULT_REPORTER_NAME);

  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [phase, setPhase] = useState<Phase>("start");

  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [otherNoteText, setOtherNoteText] = useState("");
  const [expandedPanel, setExpandedPanel] = useState<ExpandPanel>("none");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [todayRecords, setTodayRecords] = useState<MeasurementRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const [showFeedback, setShowFeedback] = useState(false);
  const [lastMeasurementId, setLastMeasurementId] = useState<string | null>(
    null
  );

  const todayKst = getTodayKstDateString();

  useEffect(() => {
    const savedSchoolName = localStorage.getItem("heatwatch_school_name");
    const savedReporterName = localStorage.getItem("heatwatch_reporter_name");

    if (savedSchoolName) setSchoolName(savedSchoolName);
    if (savedReporterName) setReporterName(savedReporterName);
  }, []);

  const loadTodayRecords = async () => {
    setLoadingRecords(true);

    const { data, error } = await supabase
      .from("measurements")
      .select(
        "id, phase, temperature, humidity, wbgt_internal, risk_level, created_at, client_measured_at, measure_date, special_note"
      )
      .eq("school_id", SCHOOL_ID)
      .eq("measure_date", todayKst)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("오늘 기록 조회 실패:", error);
      setLoadingRecords(false);
      return;
    }

    setTodayRecords((data ?? []) as MeasurementRecord[]);
    setLoadingRecords(false);
  };

  useEffect(() => {
    loadTodayRecords();
  }, []);

  const enteredPhases = useMemo(() => {
    return new Set(
      todayRecords.filter((r) => r.phase !== "other").map((r) => r.phase)
    );
  }, [todayRecords]);

  useEffect(() => {
    if (phase !== "other" && enteredPhases.has(phase)) {
      const nextPhase: Phase =
        !enteredPhases.has("start")
          ? "start"
          : !enteredPhases.has("peak")
          ? "peak"
          : !enteredPhases.has("finish")
          ? "finish"
          : "other";
      setPhase(nextPhase);
    }
  }, [enteredPhases, phase]);

  const tempNum = parseFloat(temperature);
  const humNum = parseFloat(humidity);

  const liveWbgt =
    temperature !== "" &&
    humidity !== "" &&
    !Number.isNaN(tempNum) &&
    !Number.isNaN(humNum)
      ? calcWbgtEstimate(tempNum, humNum)
      : null;

  const liveRisk = liveWbgt !== null ? calcRiskLevel(liveWbgt) : null;
  const liveSpecialNote = buildSpecialNote(selectedNotes, otherNoteText);

  const handleOpenSettings = () => {
    const newSchool = window.prompt("학교명을 입력하세요", schoolName);
    if (newSchool === null) return;

    const newReporter = window.prompt("담당자 이름을 입력하세요", reporterName);
    if (newReporter === null) return;

    const trimmedSchool = newSchool.trim() || DEFAULT_SCHOOL_NAME;
    const trimmedReporter = newReporter.trim() || DEFAULT_REPORTER_NAME;

    setSchoolName(trimmedSchool);
    setReporterName(trimmedReporter);

    localStorage.setItem("heatwatch_school_name", trimmedSchool);
    localStorage.setItem("heatwatch_reporter_name", trimmedReporter);
  };

  const handleSelectPhase = (nextPhase: Phase) => {
    if (nextPhase !== "other" && enteredPhases.has(nextPhase)) return;
    setPhase(nextPhase);
  };

  const toggleSpecialNote = (value: string) => {
    setSelectedNotes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const saveMeasurement = async () => {
    if (!temperature || !humidity) {
      alert("온도와 습도를 입력하세요.");
      return;
    }

    if (phase !== "other" && enteredPhases.has(phase)) {
      alert("오늘 이미 입력한 단계입니다.");
      return;
    }

    const t = parseFloat(temperature);
    const h = parseFloat(humidity);

    if (Number.isNaN(t) || Number.isNaN(h)) {
      alert("온도와 습도를 숫자로 입력하세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("measurements")
      .insert([
        {
          school_id: SCHOOL_ID,
          watcher_id: WATCHER_ID,
          phase,
          temperature: t,
          humidity: h,
          school_name_snapshot: schoolName,
          reporter_name_snapshot: reporterName,
          special_note: liveSpecialNote,
          client_measured_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("저장 실패:", error);
      alert(`저장 실패: ${error.message}`);
      return;
    }

    setMessage("저장 완료 ✓");

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([120, 80, 120]);
    }

    setLastMeasurementId(data.id);
    setShowFeedback(true);

    setTemperature("");
    setHumidity("");
    setSelectedNotes([]);
    setOtherNoteText("");
    setExpandedPanel("none");

    await loadTodayRecords();

    setTimeout(() => setMessage(""), 2000);
  };

  const allCoreDone =
    enteredPhases.has("start") &&
    enteredPhases.has("peak") &&
    enteredPhases.has("finish");

  const photoPanelOpen = expandedPanel === "photo";
  const specialPanelOpen = expandedPanel === "special";

  return (
    <main style={styles.page}>
      <div style={styles.cardCompact}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <div style={styles.logoWrap}>
              <Image
                src="/union-logo.jpg"
                alt="전국교육공무직본부 로고"
                width={58}
                height={58}
                style={styles.logoImage}
                priority
              />
            </div>

            <div>
              <div style={styles.title}>교육공무직본부 폭염대응</div>
              <div style={styles.infoLine}>
                담당자 : {reporterName}({schoolName})
              </div>
            </div>
          </div>

          <button style={styles.settingButton} onClick={handleOpenSettings}>
            설정
          </button>
        </div>
      </div>

      <div style={styles.cardCompact}>
        <div style={styles.sectionTitleRow}>
          <div style={styles.sectionTitle}>오늘 입력기록</div>
          {allCoreDone && <div style={styles.doneBadge}>입력완료</div>}
        </div>

        {loadingRecords ? (
          <div style={styles.emptyMini}>불러오는 중...</div>
        ) : todayRecords.length === 0 ? (
          <div style={styles.emptyMini}>오늘 입력한 기록이 없습니다.</div>
        ) : (
          <div style={styles.recordList}>
            {todayRecords.map((record) => {
              const timeBase = record.client_measured_at || record.created_at;

              return (
                <div key={record.id} style={styles.recordChip}>
                  <span style={styles.recordChipPhase}>
                    {phaseLabel(record.phase)}
                  </span>
                  <span style={styles.recordChipTime}>
                    {getDisplayTime(timeBase)}
                  </span>
                  <span
                    style={{
                      ...styles.recordChipRisk,
                      color: riskColor(record.risk_level),
                    }}
                  >
                    {riskLabel(record.risk_level)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={styles.cardCompact}>
        <div style={styles.sectionTitleRow}>
          <div style={styles.sectionTitle}>작업단계</div>
          <div style={styles.phaseHint}>입력한 단계는 비활성화</div>
        </div>

        <div style={styles.phaseGrid}>
          <button
            type="button"
            onClick={() => handleSelectPhase("start")}
            disabled={enteredPhases.has("start")}
            style={phaseButtonStyle(
              phase === "start",
              enteredPhases.has("start")
            )}
          >
            업무시작
          </button>

          <button
            type="button"
            onClick={() => handleSelectPhase("peak")}
            disabled={enteredPhases.has("peak")}
            style={phaseButtonStyle(
              phase === "peak",
              enteredPhases.has("peak")
            )}
          >
            최대조리
          </button>

          <button
            type="button"
            onClick={() => handleSelectPhase("finish")}
            disabled={enteredPhases.has("finish")}
            style={phaseButtonStyle(
              phase === "finish",
              enteredPhases.has("finish")
            )}
          >
            마무리작업
          </button>

          <button
            type="button"
            onClick={() => handleSelectPhase("other")}
            style={phaseButtonStyle(phase === "other", false)}
          >
            기타
          </button>
        </div>
      </div>

      <div style={styles.cardCompact}>
        <div style={styles.inputStack}>
          <label style={styles.inputCard}>
            <div style={styles.inputTopRow}>
              <span style={styles.inputLabel}>온도</span>
              <span style={styles.inputHint}>직접 입력</span>
            </div>

            <div style={styles.inputInnerRow}>
              <input
                type="text"
                inputMode="decimal"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="온도 입력"
                style={styles.bigInput}
              />
              <div style={styles.inputUnit}>℃</div>
            </div>
          </label>

          <label style={styles.inputCard}>
            <div style={styles.inputTopRow}>
              <span style={styles.inputLabel}>습도</span>
              <span style={styles.inputHint}>직접 입력</span>
            </div>

            <div style={styles.inputInnerRow}>
              <input
                type="text"
                inputMode="decimal"
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                placeholder="습도 입력"
                style={styles.bigInput}
              />
              <div style={styles.inputUnit}>%</div>
            </div>
          </label>
        </div>
      </div>

      <div style={styles.cardCompact}>
        <div style={styles.resultRow}>
          <div style={styles.resultBox}>
            <div style={styles.resultTitle}>WBGT 추정값</div>
            <div style={styles.resultValue}>
              {liveWbgt !== null ? liveWbgt.toFixed(2) : "-"}
            </div>
          </div>

          <div style={styles.resultBox}>
            <div style={styles.resultTitle}>위험도</div>
            <div
              style={{
                ...styles.resultValue,
                color: riskColor(liveRisk),
              }}
            >
              {riskLabel(liveRisk)}
            </div>
          </div>
        </div>

        {(liveRisk === "danger" || liveRisk === "stop") && (
          <div
            style={{
              ...styles.alertBanner,
              borderColor: riskColor(liveRisk),
              color: riskColor(liveRisk),
            }}
          >
            {getRiskBannerText(liveRisk)}
          </div>
        )}
      </div>

      <div style={styles.cardCompact}>
        <button
          type="button"
          onClick={() =>
            setExpandedPanel((prev) =>
              prev === "none" || prev === "photo" ? "special" : "none"
            )
          }
          style={{
            ...styles.expandButton,
            ...(specialPanelOpen ? styles.expandButtonActive : {}),
          }}
        >
          특이사항 입력
        </button>

        <button
          type="button"
          onClick={() =>
            setExpandedPanel((prev) =>
              prev === "none" || prev === "special" ? "photo" : "none"
            )
          }
          style={{
            ...styles.expandButton,
            marginTop: 8,
            ...(photoPanelOpen ? styles.expandButtonActive : {}),
          }}
        >
          사진전송
        </button>

        {specialPanelOpen && (
          <div style={styles.expandPanel}>
            <div style={styles.checkGrid}>
              {SPECIAL_NOTE_OPTIONS.map((item) => {
                const checked = selectedNotes.includes(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleSpecialNote(item)}
                    style={checkButtonStyle(checked)}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {selectedNotes.includes("기타") && (
              <textarea
                value={otherNoteText}
                onChange={(e) => setOtherNoteText(e.target.value)}
                placeholder="기타 내용을 입력하세요"
                style={styles.textarea}
              />
            )}

            {liveSpecialNote && (
              <div style={styles.selectedSummary}>
                선택사항: {liveSpecialNote}
              </div>
            )}
          </div>
        )}

        {photoPanelOpen && (
          <div style={styles.expandPanel}>
            <div style={styles.photoInfoBox}>
              테스트버전에서는 사진전송 UI만 먼저 두었습니다.
              <br />
              실제 업로드는 다음 단계에서 Supabase Storage와 연결하면 됩니다.
            </div>
          </div>
        )}
      </div>

      <button
        onClick={saveMeasurement}
        disabled={saving}
        style={{
          ...styles.saveButton,
          opacity: saving ? 0.82 : 1,
        }}
      >
        {saving ? "저장중..." : "저장하기"}
      </button>

      {message && <div style={styles.successText}>{message}</div>}

      {showFeedback && lastMeasurementId && (
        <FeedbackModal
          measurementId={lastMeasurementId}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "8px 8px 110px",
    background: "#f5faf5",
    minHeight: "100dvh",
    fontFamily:
      "Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif",
  },
  cardCompact: {
    background: "#ffffff",
    border: "1.5px solid #c8ead1",
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  logoWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid #dbe7de",
    flexShrink: 0,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0c7a34",
    lineHeight: 1.25,
    wordBreak: "keep-all",
  },
  infoLine: {
    marginTop: 6,
    fontSize: 14,
    color: "#111827",
    fontWeight: 600,
    lineHeight: 1.3,
    wordBreak: "keep-all",
  },
  settingButton: {
    border: "1.5px solid #16a34a",
    background: "#fff",
    color: "#15803d",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    minHeight: 38,
    flexShrink: 0,
  },
  sectionTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#111827",
    lineHeight: 1.2,
  },
  doneBadge: {
    fontSize: 12,
    fontWeight: 900,
    color: "#15803d",
    background: "#ecfdf3",
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    padding: "4px 8px",
  },
  emptyMini: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    color: "#6b7280",
    fontSize: 14,
  },
  recordList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  recordChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    padding: "5px 9px",
    borderRadius: 999,
    background: "#f7faf8",
    border: "1px solid #dde7df",
    fontSize: 12,
    lineHeight: 1,
  },
  recordChipPhase: {
    fontWeight: 900,
    color: "#111827",
  },
  recordChipTime: {
    fontWeight: 700,
    color: "#2563eb",
  },
  recordChipRisk: {
    fontWeight: 900,
  },
  phaseHint: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 700,
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  inputStack: {
    display: "grid",
    gap: 10,
  },
  inputCard: {
    display: "block",
    border: "2px solid #cad5e2",
    borderRadius: 18,
    background: "#ffffff",
    padding: "10px 12px 8px",
  },
  inputTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  inputLabel: {
    color: "#0b7a33",
    fontWeight: 900,
    fontSize: 16,
  },
  inputHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  inputInnerRow: {
    display: "grid",
    gridTemplateColumns: "1fr 34px",
    alignItems: "center",
    gap: 8,
  },
  bigInput: {
    border: "none",
    outline: "none",
    fontSize: 30,
    fontWeight: 800,
    color: "#0f172a",
    background: "transparent",
    width: "100%",
    textAlign: "right",
    lineHeight: 1.2,
  },
  inputUnit: {
    fontSize: 21,
    fontWeight: 900,
    color: "#111827",
    textAlign: "right",
  },
  resultRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  resultBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 15,
    padding: 10,
    minHeight: 76,
    textAlign: "center",
  },
  resultTitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
    lineHeight: 1.25,
    textAlign: "center",
  },
  resultValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 900,
    color: "#111827",
    lineHeight: 1.1,
    textAlign: "center",
  },
  alertBanner: {
    marginTop: 8,
    border: "1.5px solid",
    borderRadius: 12,
    background: "#fff8f8",
    padding: "9px 10px",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  expandButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1.5px dashed #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
  },
  expandButtonActive: {
    border: "1.5px solid #16a34a",
    background: "#f0fdf4",
    color: "#15803d",
  },
  expandPanel: {
    marginTop: 10,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 10,
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  textarea: {
    width: "100%",
    minHeight: 80,
    marginTop: 10,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    padding: 10,
    fontSize: 14,
    resize: "vertical",
    outline: "none",
  },
  selectedSummary: {
    marginTop: 10,
    fontSize: 13,
    color: "#374151",
    background: "#f8fafc",
    borderRadius: 10,
    padding: "8px 10px",
    lineHeight: 1.4,
  },
  photoInfoBox: {
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    padding: "10px 12px",
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.5,
  },
  saveButton: {
    width: "100%",
    marginTop: 12,
    border: "none",
    background: "#06912f",
    color: "#fff",
    borderRadius: 16,
    minHeight: 58,
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  },
  successText: {
    marginTop: 10,
    textAlign: "center",
    color: "#15803d",
    fontWeight: 900,
    fontSize: 14,
  },
};

function phaseButtonStyle(
  selected: boolean,
  disabled: boolean
): CSSProperties {
  return {
    minHeight: 50,
    borderRadius: 14,
    border: selected ? "1px solid #0aa13a" : "1px solid #d1d5db",
    background: selected ? "#0baa3d" : "#ffffff",
    color: selected ? "#ffffff" : disabled ? "#94a3b8" : "#111827",
    fontSize: 16,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    boxShadow: selected ? "inset 0 -2px 0 rgba(0,0,0,0.08)" : "none",
  };
}

function checkButtonStyle(selected: boolean): CSSProperties {
  return {
    minHeight: 42,
    borderRadius: 12,
    border: selected ? "1px solid #16a34a" : "1px solid #d1d5db",
    background: selected ? "#f0fdf4" : "#ffffff",
    color: selected ? "#166534" : "#111827",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    padding: "8px 10px",
    lineHeight: 1.25,
  };
}