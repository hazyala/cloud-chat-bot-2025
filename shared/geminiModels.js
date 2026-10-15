export const GEMINI_MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tag: "고성능",
    note: "복잡한 질의와 코드 보조에 적합"
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    tag: "기본",
    note: "빠른 응답과 가벼운 작업에 적합"
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash-Lite",
    tag: "안정",
    note: "검증된 경량 멀티모달 모델"
  }
];

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const ALLOWED_GEMINI_MODEL_IDS = GEMINI_MODELS.map((model) => model.id);
