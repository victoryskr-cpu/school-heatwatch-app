"use client";

import { useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";

type FeedbackModalProps = {
  measurementId: string;
  onClose: () => void;
};

export default function FeedbackModal({
  measurementId,
  onClose,
}: FeedbackModalProps) {
  const [deviceType, setDeviceType] = useState("");
  const [phoneModel, setPhoneModel] = useState("");
  const [inputIssue, setInputIssue] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const sendFeedback = async () => {
    setSending(true);

    const { error } = await supabase.from("test_feedback").insert([
      {
        measurement_id: measurementId,
        device_type: deviceType || null,
        phone_model: phoneModel.trim() || null,
        input_issue: inputIssue || null,
        comment: comment.trim() || null,
      },
    ]);

    setSending(false);

    if (error) {
      console.error("테스트 의견 저장 실패:", error);
      alert(`의견 저장 실패: ${error.message}`);
      return;
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(120);
    }

    alert("의견이 전송되었습니다.");
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>테스트 의견 보내기</div>
        <div style={styles.desc}>
          앱 사용 후 느낀 점을 간단히 남겨주세요.
        </div>

        <div style={styles.block}>
          <div style={styles.label}>사용 기기</div>
          <div style={styles.radioGroup}>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="deviceType"
                value="아이폰"
                checked={deviceType === "아이폰"}
                onChange={(e) => setDeviceType(e.target.value)}
              />
              <span>아이폰</span>
            </label>

            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="deviceType"
                value="안드로이드"
                checked={deviceType === "안드로이드"}
                onChange={(e) => setDeviceType(e.target.value)}
              />
              <span>안드로이드</span>
            </label>
          </div>
        </div>

        <div style={styles.block}>
          <div style={styles.label}>휴대폰 모델</div>
          <input
            type="text"
            value={phoneModel}
            onChange={(e) => setPhoneModel(e.target.value)}
            placeholder="예: 갤럭시 S23, 아이폰13"
            style={styles.input}
          />
        </div>

        <div style={styles.block}>
          <div style={styles.label}>입력 사용성</div>
          <div style={styles.radioGroupColumn}>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="inputIssue"
                value="입력 편함"
                checked={inputIssue === "입력 편함"}
                onChange={(e) => setInputIssue(e.target.value)}
              />
              <span>입력 편함</span>
            </label>

            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="inputIssue"
                value="숫자 입력 불편"
                checked={inputIssue === "숫자 입력 불편"}
                onChange={(e) => setInputIssue(e.target.value)}
              />
              <span>숫자 입력 불편</span>
            </label>

            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="inputIssue"
                value="화면 잘림"
                checked={inputIssue === "화면 잘림"}
                onChange={(e) => setInputIssue(e.target.value)}
              />
              <span>화면 잘림</span>
            </label>
          </div>
        </div>

        <div style={styles.block}>
          <div style={styles.label}>기타 의견</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="불편한 점이나 개선 의견을 적어주세요."
            style={styles.textarea}
          />
        </div>

        <button
          type="button"
          onClick={sendFeedback}
          disabled={sending}
          style={{
            ...styles.button,
            opacity: sending ? 0.8 : 1,
          }}
        >
          {sending ? "전송중..." : "의견 보내기"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
    boxSizing: "border-box",
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
    border: "1px solid #dbe7de",
    boxSizing: "border-box",
  },
  title: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0c7a34",
    lineHeight: 1.25,
  },
  desc: {
    marginTop: 6,
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.45,
  },
  block: {
    marginTop: 16,
    width: "100%",
    boxSizing: "border-box",
  },
  label: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 8,
  },
  radioGroup: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  radioGroupColumn: {
    display: "grid",
    gap: 8,
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#111827",
    fontWeight: 600,
  },
  input: {
    display: "block",
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    background: "#fff",
    boxSizing: "border-box",
  },
  textarea: {
    display: "block",
    width: "100%",
    minHeight: 110,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    resize: "vertical",
    background: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    minHeight: 54,
    marginTop: 20,
    border: "none",
    borderRadius: 14,
    background: "#06912f",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    boxSizing: "border-box",
  },
};