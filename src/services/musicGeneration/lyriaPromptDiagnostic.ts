/**
 * BẮT LẤY V3.2 — Lyria Prompt Diagnostic Pipeline
 * 
 * Mục đích:
 * Xác định chính xác nguyên nhân khiến Lyria trả về:
 * "Request blocked for an unspecified policy reason. Please modify your input and retry."
 * 
 * Kiến trúc 3 tầng chuẩn đoán độc lập:
 * - TEST A — MINIMAL MUSIC PROMPT:
 *   Prompt cố định hoàn toàn sạch, an toàn tuyệt đối, KHÔNG có lyrics, KHÔNG reference.
 *   Mục đích: Xác định Lyria API / model / auth / request schema có hoạt động hay không.
 * 
 * - TEST B — MUSIC PROMPT + ORIGINAL GENERATED LYRICS:
 *   Prompt tương tự Test A nhưng bổ sung duy nhất phần lyrics hiện tại của bài hát.
 *   Mục đích: Xác định xem custom lyrics có phải nguyên nhân bị block hay không.
 * 
 * - TEST C — FULL BẮT LẤY PROMPT:
 *   Dùng Music Blueprint hiện tại đầy đủ với định hướng âm nhạc, nhạc cụ, hòa âm và lyrics.
 *   Mục đích: Xác định xem Music Blueprint / Music Direction có chứa nội dung bị từ chối hay không.
 * 
 * RÀNG BUỘC SỐNG CÒN:
 * 1. Diagnostic CHỈ ĐƯỢC PHÉP chạy trên model `lyria-3-clip-preview` (~$0.04).
 *    Tuyệt đối KHÔNG dùng `lyria-3.5` cho diagnostic.
 * 2. KHÔNG DÙNG MOCK — Gọi API thật và ghi nhận trung thực.
 * 3. KHÔNG tự động retry.
 * 4. KHÔNG làm thay đổi Music Blueprint, bản thu gốc hay lyrics của project.
 * 5. Lưu record vào IndexedDB kèm `exactPrompt` và `promptType` (KHÔNG lưu API key).
 */

import {
  AudioIdea,
  MusicBlueprint,
  DiagnosticTestId,
  DiagnosticTestResult,
  GenerationRecord,
  PromptType,
  LYRIA_CLIP_ESTIMATED_COST,
} from '../../types';
import { getStoredApiKey } from '../audioAnalysis/apiKeyStorage';
import { saveGenerationRecord } from '../../lib/db';
import { extractCleanLyrics, buildLyriaPrompt } from './lyriaPromptBuilder';

export const DIAGNOSTIC_MODEL = 'lyria-3-clip-preview';

/**
 * FIXED SAFE PROMPT FOR TEST A
 */
export const TEST_A_MINIMAL_PROMPT = `Create a melancholic Vietnamese pop ballad.
Male vocals.
68 BPM.
G# minor.
Warm piano, soft acoustic guitar, subtle ambient pad.
Simple verse and chorus structure.
No references to real artists, songs, or copyrighted lyrics.`;

/**
 * BUILD TEST B PROMPT: Safe music direction + Project lyrics only
 */
export function buildTestBPrompt(idea: AudioIdea, blueprint?: MusicBlueprint | null): string {
  const lyricsSource = blueprint || idea.lyrics || idea.developedLyric || '';
  const cleanLyrics = extractCleanLyrics(lyricsSource);

  return `Create a melancholic Vietnamese pop ballad.
Male vocals.
68 BPM.
G# minor.
Warm piano, soft acoustic guitar, subtle ambient pad.
Simple verse and chorus structure.

LYRICS:
${cleanLyrics}`;
}

/**
 * BUILD TEST C PROMPT: Full BẮT LẤY Prompt from Music Blueprint
 */
export function buildTestCPrompt(idea: AudioIdea, blueprint: MusicBlueprint): string {
  return buildLyriaPrompt(blueprint, {
    keepMelodyPct: idea.keepMelodyPct ?? 80,
    keepLyricPct: idea.keepLyricPct ?? 70,
    isClip: true, // Diagnostic always tests as 30s preview clip
  });
}

/**
 * Helper to safely convert Base64 to Blob without quality loss
 */
function base64ToBlob(base64Data: string, mimeType: string = 'audio/mp3'): Blob {
  const cleanBase64 = base64Data.replace(/[\r\n\s]/g, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Core Diagnostic Runner: Executes an individual test against Lyria API
 */
export async function runLyriaDiagnosticTest(params: {
  testId: DiagnosticTestId;
  idea: AudioIdea;
  blueprint?: MusicBlueprint | null;
}): Promise<DiagnosticTestResult> {
  const { testId, idea, blueprint } = params;
  const apiKey = getStoredApiKey();

  let testName = '';
  let exactPrompt = '';
  let promptType: PromptType = 'diagnostic-minimal';

  if (testId === 'test_a') {
    testName = 'Test A: Lyria cơ bản (Minimal Prompt, không lyrics)';
    exactPrompt = TEST_A_MINIMAL_PROMPT;
    promptType = 'diagnostic-minimal';
  } else if (testId === 'test_b') {
    testName = 'Test B: Âm nhạc tối giản + Custom Lyrics của dự án';
    exactPrompt = buildTestBPrompt(idea, blueprint);
    promptType = 'diagnostic-with-lyrics';
  } else {
    testName = 'Test C: Toàn bộ Music Blueprint BẮT LẤY';
    if (!blueprint) {
      throw new Error('Cần có Music Blueprint để thực hiện Test C.');
    }
    exactPrompt = buildTestCPrompt(idea, blueprint);
    promptType = 'diagnostic-production';
  }

  const now = Date.now();
  const recordId = `diag_${testId}_${now}_${Math.random().toString(36).substring(2, 6)}`;

  if (!apiKey) {
    const res: DiagnosticTestResult = {
      testId,
      testName,
      outcome: 'error',
      model: DIAGNOSTIC_MODEL,
      exactPrompt,
      timestamp: now,
      errorSummary: 'Chưa có Gemini API Key. Hãy cấu hình API key trong cài đặt.',
      rawErrorDetails: 'Missing API key in client storage',
    };
    return res;
  }

  const interactionsUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';

  try {
    const response = await fetch(interactionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: DIAGNOSTIC_MODEL,
        input: [
          {
            type: 'text',
            text: exactPrompt,
          },
        ],
        response_format: {
          type: 'audio',
        },
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errObj = Array.isArray(errJson) ? errJson[0]?.error : errJson?.error;
      const errMsg = errObj?.message || `HTTP ${response.status} ${response.statusText}`;
      const rawDetails = JSON.stringify(errJson || errMsg, null, 2);

      const isPolicyBlocked =
        errMsg.toLowerCase().includes('policy reason') ||
        errMsg.toLowerCase().includes('request blocked') ||
        errMsg.toLowerCase().includes('safety') ||
        rawDetails.toLowerCase().includes('policy reason');

      const outcome: 'blocked' | 'error' = isPolicyBlocked ? 'blocked' : 'error';
      const errorCode = isPolicyBlocked
        ? 'POLICY_BLOCKED'
        : response.status === 401
        ? 'AUTH'
        : response.status === 403
        ? 'BILLING'
        : 'UNKNOWN';

      // Record to IndexedDB without saving API key
      const record: GenerationRecord = {
        id: recordId,
        projectId: idea.id,
        model: DIAGNOSTIC_MODEL,
        prompt: exactPrompt,
        exactPrompt,
        promptType,
        generationType: 'clip',
        estimatedCost: LYRIA_CLIP_ESTIMATED_COST,
        createdAt: now,
        timestamp: now,
        status: outcome,
        errorCode,
        errorMessage: errMsg,
      };
      await saveGenerationRecord(record);

      return {
        testId,
        testName,
        outcome,
        model: DIAGNOSTIC_MODEL,
        exactPrompt,
        timestamp: now,
        errorSummary: isPolicyBlocked
          ? 'LYRIA TỪ CHỐI PROMPT (Safety / Policy Filter).'
          : `Lỗi kết nối / HTTP ${response.status}: ${errMsg}`,
        rawErrorDetails: rawDetails,
        errorCode,
      };
    }

    // Success response parsing
    const data = await response.json();
    let audioBase64: string | null = null;
    let mimeType = 'audio/mp3';

    if (data.output_audio?.data) {
      audioBase64 = data.output_audio.data;
      if (data.output_audio.mime_type) mimeType = data.output_audio.mime_type;
    }

    if (!audioBase64 && Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (step.type === 'model_output' && Array.isArray(step.content)) {
          for (const item of step.content) {
            if (item.type === 'audio' && item.data) {
              audioBase64 = item.data;
              if (item.mime_type) mimeType = item.mime_type;
              break;
            }
            if (item.inlineData?.data) {
              audioBase64 = item.inlineData.data;
              if (item.inlineData.mimeType) mimeType = item.inlineData.mimeType;
              break;
            }
          }
        }
        if (audioBase64) break;
      }
    }

    let audioBlob: Blob | undefined;
    if (audioBase64) {
      audioBlob = base64ToBlob(audioBase64, mimeType);
    }

    // Save successful test generation record
    const record: GenerationRecord = {
      id: recordId,
      projectId: idea.id,
      model: DIAGNOSTIC_MODEL,
      prompt: exactPrompt,
      exactPrompt,
      promptType,
      generationType: 'clip',
      estimatedCost: LYRIA_CLIP_ESTIMATED_COST,
      createdAt: now,
      timestamp: now,
      status: 'success',
    };
    await saveGenerationRecord(record);

    return {
      testId,
      testName,
      outcome: 'pass',
      model: DIAGNOSTIC_MODEL,
      exactPrompt,
      timestamp: now,
      audioBlob,
      mimeType,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const rawDetails = msg;

    const record: GenerationRecord = {
      id: recordId,
      projectId: idea.id,
      model: DIAGNOSTIC_MODEL,
      prompt: exactPrompt,
      exactPrompt,
      promptType,
      generationType: 'clip',
      estimatedCost: LYRIA_CLIP_ESTIMATED_COST,
      createdAt: now,
      timestamp: now,
      status: 'error',
      errorCode: 'NETWORK',
      errorMessage: msg,
    };
    await saveGenerationRecord(record);

    return {
      testId,
      testName,
      outcome: 'error',
      model: DIAGNOSTIC_MODEL,
      exactPrompt,
      timestamp: now,
      errorSummary: `Lỗi kết nối hoặc ngoại lệ: ${msg}`,
      rawErrorDetails: rawDetails,
      errorCode: 'NETWORK',
    };
  }
}

/**
 * Produce actionable conclusion based on test results adhering to Section 9
 */
export function getDiagnosticConclusion(
  results: Partial<Record<DiagnosticTestId, DiagnosticTestResult | null>>
): {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  summary: string;
  recommendation: string;
} | null {
  const a = results.test_a;
  const b = results.test_b;
  const c = results.test_c;

  if (!a && !b && !c) return null;

  // Case 1: Test A is blocked
  if (a?.outcome === 'blocked') {
    return {
      type: 'error',
      title: 'KẾT LUẬN: LYRIA BLOCKED TỪ TẦNG API / REQUEST GỐC',
      summary: 'Prompt an toàn tối giản hoàn toàn không có lyrics cũng bị từ chối.',
      recommendation: 'KHÔNG sửa lyrics. Hãy kiểm tra lại API request format, quyền hạn tài khoản trên Google Cloud/AI Studio hoặc model status của Lyria.',
    };
  }

  // Case 2: Test A passed, but Test B blocked
  if (a?.outcome === 'pass' && b?.outcome === 'blocked') {
    return {
      type: 'warning',
      title: 'KẾT LUẬN: NGUYÊN NHÂN DO CUSTOM LYRICS',
      summary: 'Test A thành công nhưng Test B (kèm lyrics bài hát) bị Lyria từ chối.',
      recommendation: 'Khả năng cao custom lyrics đang kích hoạt safety / recitation filter (trùng lặp bản quyền hoặc từ ngữ nhạy cảm). Hãy chỉnh sửa hoặc rút gọn ca từ trước khi tạo lại.',
    };
  }

  // Case 3: Test A passed, Test B passed, but Test C blocked
  if (a?.outcome === 'pass' && b?.outcome === 'pass' && c?.outcome === 'blocked') {
    return {
      type: 'warning',
      title: 'KẾT LUẬN: NGUYÊN NHÂN TỪ MUSIC DIRECTION / BLUEPRINT',
      summary: 'Test A và Test B đều PASS, nhưng Full BẮT LẤY Prompt (Test C) bị chặn.',
      recommendation: 'Khả năng cao Music Blueprint (các mô tả về thể loại, phối khí, nhạc cụ hoặc ca từ chi tiết) đang chứa nội dung khiến Lyria từ chối. Hãy điều chỉnh Music Blueprint.',
    };
  }

  // Case 4: All tests passed
  if (a?.outcome === 'pass' && b?.outcome === 'pass' && c?.outcome === 'pass') {
    return {
      type: 'success',
      title: 'KẾT LUẬN: TẤT CẢ CÁC TẦNG ĐỀU HOẠT ĐỘNG HOÀN HẢO',
      summary: 'Cả 3 bài kiểm tra đều được Lyria xử lý thành công không gặp lỗi chính sách.',
      recommendation: 'Bạn có thể tự tin tạo bản nghe thử 30s hoặc bài đầy đủ với Lyria.',
    };
  }

  return null;
}
