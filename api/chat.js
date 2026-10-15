import { ALLOWED_GEMINI_MODEL_IDS, DEFAULT_GEMINI_MODEL } from "../shared/geminiModels.js";

const ALLOWED_MODELS = new Set(ALLOWED_GEMINI_MODEL_IDS);
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function readText(parts = []) {
  return parts
    .map((part) => (!part.thought && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function toGeminiContents(messages = []) {
  return messages
    .filter((message) => message?.content?.trim())
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content.trim() }]
    }));
}

async function readJsonPayload(fetchResponse) {
  const text = await fetchResponse.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function withStatusCode(status, message) {
  return `${status}: ${message}`;
}

function sendError(response, status, message) {
  return response.status(status).json({
    error: withStatusCode(status, message),
    statusCode: status
  });
}

function getGeminiErrorMessage(status, payload) {
  if (status === 503) {
    return "Gemini 무료 API 서버가 일시적으로 사용 불가 상태입니다. Google 서버 과부하, 트래픽 폭주 또는 시스템 점검 중일 수 있으니 잠시 후 다시 시도해 주세요.";
  }

  return payload?.error?.message ?? "Gemini 응답을 가져오지 못했습니다.";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendError(response, 405, "POST 요청만 지원합니다.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendError(response, 500, "서버에 GEMINI_API_KEY가 설정되어 있지 않습니다.");
  }

  const { model = process.env.GEMINI_DEFAULT_MODEL ?? DEFAULT_GEMINI_MODEL, messages } = request.body ?? {};
  if (!ALLOWED_MODELS.has(model)) {
    return sendError(response, 400, "지원하지 않는 Gemini 모델입니다.");
  }

  if (!Array.isArray(messages) || messages.some((message) =>
    !message || typeof message.content !== "string" || !["user", "assistant"].includes(message.role)
  )) {
    return sendError(response, 400, "messages는 user 또는 assistant 역할과 문자열 content를 가진 배열이어야 합니다.");
  }

  const contents = toGeminiContents(messages);
  if (contents.length === 0) {
    return sendError(response, 400, "전송할 메시지가 없습니다.");
  }

  let geminiResponse;
  try {
    geminiResponse = await fetch(
      `${GEMINI_ENDPOINT}/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 8192
          }
        })
      }
    );
  } catch {
    return sendError(
      response,
      503,
      "Gemini API에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 잠시 후 다시 시도해 주세요."
    );
  }

  const payload = await readJsonPayload(geminiResponse);
  if (!geminiResponse.ok) {
    return sendError(response, geminiResponse.status, getGeminiErrorMessage(geminiResponse.status, payload));
  }

  const answer = readText(payload?.candidates?.[0]?.content?.parts);
  if (!answer) {
    return sendError(response, 502, "Gemini가 빈 응답을 반환했습니다.");
  }

  return response.status(200).json({ answer });
}
