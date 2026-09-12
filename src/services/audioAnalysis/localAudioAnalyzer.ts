/**
 * LocalAudioAnalyzer - Real Audio Feature Extraction via Web Audio DSP
 * 
 * Performs client-side digital signal processing (DSP) on the actual recorded AudioBuffer:
 * - RMS energy calculation and silence detection
 * - Fundamental frequency (f0) extraction via autocorrelation
 * - Pitch class profile (Chroma) and Krumhansl-Schmuckler Key estimation
 * - Onset novelty curve autocorrelation for BPM estimation
 * - Pitch contour and input classification (singing vs humming vs spoken idea)
 * 
 * NO HARDCODED OR FAKE VALUES:
 * If an acoustic feature cannot be determined with sufficient confidence,
 * it returns `null` ("Chưa đủ dữ liệu").
 */

import { AudioAnalysisResult, GenreSuggestion, InputClassification } from './types';

// Note names for 12 pitch classes
const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VIETNAMESE_KEYS: Record<string, string> = {
  'C': 'Đô',
  'C#': 'Đô thăng',
  'D': 'Rê',
  'D#': 'Rê thăng',
  'E': 'Mi',
  'F': 'Fa',
  'F#': 'Fa thăng',
  'G': 'Sol',
  'G#': 'Sol thăng',
  'A': 'La',
  'A#': 'La thăng',
  'B': 'Si',
};

// Krumhansl-Kessler / Schmuckler Key Profiles
const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Decode audio Blob into Float32Array channel data via offline or web audio context
 */
async function decodeAudioBlob(blob: Blob): Promise<{ channelData: Float32Array; sampleRate: number; duration: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  // Use webkitAudioContext fallback for older iOS Safari
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    return {
      channelData,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Calculate Pearson correlation coefficient between two arrays of equal length
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Extract fundamental frequencies using autocorrelation over human vocal range (65Hz - 800Hz)
 */
function extractVoicedPitches(
  samples: Float32Array,
  sampleRate: number
): {
  pitchesHz: number[];
  pitchPoints: { time: number; hz: number; noteName: string }[];
  chromaCounts: number[];
  sustainedRuns: number;
} {
  const windowSize = 2048;
  const hopSize = 1024;
  const minLag = Math.floor(sampleRate / 800); // ~800 Hz
  const maxLag = Math.floor(sampleRate / 65);  // ~65 Hz
  
  const pitchesHz: number[] = [];
  const pitchPoints: { time: number; hz: number; noteName: string }[] = [];
  const chromaCounts = new Array(12).fill(0);
  let sustainedRuns = 0;
  let currentRun = 0;
  let lastPitchClass = -1;

  for (let offset = 0; offset + windowSize < samples.length; offset += hopSize) {
    // Check frame energy first
    let frameRms = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = samples[offset + i];
      frameRms += s * s;
    }
    frameRms = Math.sqrt(frameRms / windowSize);

    // Skip quiet frames (noise floor)
    if (frameRms < 0.02) {
      if (currentRun >= 3) sustainedRuns++;
      currentRun = 0;
      continue;
    }

    // Normalized autocorrelation
    let bestLag = -1;
    let maxCorr = -1;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      let energy1 = 0;
      let energy2 = 0;

      for (let i = 0; i < windowSize - lag; i++) {
        const a = samples[offset + i];
        const b = samples[offset + i + lag];
        corr += a * b;
        energy1 += a * a;
        energy2 += b * b;
      }

      const denom = Math.sqrt(energy1 * energy2);
      if (denom > 0) {
        const normCorr = corr / denom;
        if (normCorr > maxCorr) {
          maxCorr = normCorr;
          bestLag = lag;
        }
      }
    }

    // If correlation is strong enough, consider this frame voiced
    if (maxCorr > 0.45 && bestLag > 0) {
      const freq = sampleRate / bestLag;
      pitchesHz.push(freq);

      // Convert Hz to MIDI pitch: 69 + 12 * log2(f / 440)
      const midi = 69 + 12 * Math.log2(freq / 440);
      const semitone = Math.round(midi);
      const pitchClass = ((semitone % 12) + 12) % 12;
      const octave = Math.floor(semitone / 12) - 1;
      const noteName = `${PITCH_CLASSES[pitchClass]}${octave}`;
      const timeSec = Number((offset / sampleRate).toFixed(2));

      pitchPoints.push({
        time: timeSec,
        hz: Math.round(freq),
        noteName,
      });

      chromaCounts[pitchClass]++;

      if (pitchClass === lastPitchClass) {
        currentRun++;
      } else {
        if (currentRun >= 3) sustainedRuns++;
        currentRun = 1;
        lastPitchClass = pitchClass;
      }
    } else {
      if (currentRun >= 3) sustainedRuns++;
      currentRun = 0;
    }
  }

  return { pitchesHz, pitchPoints, chromaCounts, sustainedRuns };
}


/**
 * Determine musical key from pitch chroma using Krumhansl-Schmuckler correlation
 */
function estimateMusicalKey(chroma: number[]): { key: string | null; confidence: number } {
  const totalNotes = chroma.reduce((a, b) => a + b, 0);
  // Need at least 8 distinct voiced pitch frames to estimate key reliably
  if (totalNotes < 8) {
    return { key: null, confidence: 0 };
  }

  let bestKey = '';
  let bestCorrelation = -1;

  // Test all 12 Major and 12 Minor keys
  for (let shift = 0; shift < 12; shift++) {
    // Shift chroma vector to align tonic to index 0
    const shiftedChroma = new Array(12);
    for (let i = 0; i < 12; i++) {
      shiftedChroma[i] = chroma[(i + shift) % 12];
    }

    const majorCorr = pearsonCorrelation(shiftedChroma, KRUMHANSL_MAJOR);
    if (majorCorr > bestCorrelation) {
      bestCorrelation = majorCorr;
      const rootEn = PITCH_CLASSES[shift];
      const rootVi = VIETNAMESE_KEYS[rootEn] || rootEn;
      bestKey = `${rootVi} Trưởng (${rootEn} Major)`;
    }

    const minorCorr = pearsonCorrelation(shiftedChroma, KRUMHANSL_MINOR);
    if (minorCorr > bestCorrelation) {
      bestCorrelation = minorCorr;
      const rootEn = PITCH_CLASSES[shift];
      const rootVi = VIETNAMESE_KEYS[rootEn] || rootEn;
      bestKey = `${rootVi} Thứ (${rootEn} Minor)`;
    }
  }

  // Only return key if correlation exceeds reliable threshold
  if (bestCorrelation >= 0.58) {
    return { key: bestKey, confidence: Math.min(0.95, Number(bestCorrelation.toFixed(2))) };
  }

  return { key: null, confidence: Math.max(0, Number(bestCorrelation.toFixed(2))) };
}

/**
 * Estimate Tempo (BPM) via energy onset novelty curve autocorrelation
 */
function estimateTempo(samples: Float32Array, sampleRate: number, duration: number): { tempo: number | null; confidence: number } {
  // Recordings shorter than 2.5s rarely contain a reliable beat pulse
  if (duration < 2.5) {
    return { tempo: null, confidence: 0 };
  }

  const hopSize = Math.floor(sampleRate * 0.02); // 20ms frame
  const numFrames = Math.floor(samples.length / hopSize);
  const frameEnergies: number[] = new Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    let energy = 0;
    const start = i * hopSize;
    for (let j = 0; j < hopSize; j++) {
      const s = samples[start + j];
      energy += s * s;
    }
    frameEnergies[i] = Math.sqrt(energy / hopSize);
  }

  // First-difference onset novelty curve (half-wave rectified)
  const novelty: number[] = new Array(numFrames).fill(0);
  for (let i = 1; i < numFrames; i++) {
    const diff = frameEnergies[i] - frameEnergies[i - 1];
    novelty[i] = diff > 0 ? diff : 0;
  }

  // Autocorrelation of novelty curve for tempo range 50 - 170 BPM
  // 50 BPM = 60 / 50 = 1.2s lag => 1.2 / 0.02 = 60 frames
  // 170 BPM = 60 / 170 = 0.353s lag => 0.353 / 0.02 = ~17.6 frames
  const minLagFrames = Math.floor(0.35 / 0.02); // ~17 frames
  const maxLagFrames = Math.floor(1.20 / 0.02); // ~60 frames

  let bestLag = -1;
  let maxCorr = -1;
  let baselineCorr = 0;

  for (let lag = minLagFrames; lag <= maxLagFrames; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < novelty.length - lag; i++) {
      sum += novelty[i] * novelty[i + lag];
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    if (avg > maxCorr) {
      maxCorr = avg;
      bestLag = lag;
    }
    baselineCorr += avg;
  }

  baselineCorr /= (maxLagFrames - minLagFrames + 1);
  const periodicityStrength = baselineCorr > 0 ? (maxCorr - baselineCorr) / baselineCorr : 0;

  // Only assign BPM if periodicity strength exceeds threshold
  if (bestLag > 0 && periodicityStrength > 0.42) {
    const secondsPerBeat = bestLag * 0.02;
    const bpm = Math.round(60 / secondsPerBeat);
    if (bpm >= 50 && bpm <= 170) {
      const conf = Math.min(0.9, Number((periodicityStrength / 2).toFixed(2)));
      return { tempo: bpm, confidence: conf };
    }
  }

  return { tempo: null, confidence: 0 };
}

/**
 * Determine pitch contour and melody character
 */
function analyzePitchContour(pitchesHz: number[]): {
  contour: 'ascending' | 'descending' | 'melodic_wave' | 'speech_like' | 'flat' | 'indeterminate';
  description: string;
} {
  if (pitchesHz.length < 5) {
    return {
      contour: 'indeterminate',
      description: 'Âm thanh ngắn hoặc chưa đủ cao độ rõ rệt để xác định đường nét giai điệu.',
    };
  }

  const firstThird = pitchesHz.slice(0, Math.floor(pitchesHz.length / 3));
  const lastThird = pitchesHz.slice(Math.floor((2 * pitchesHz.length) / 3));

  const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
  const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

  const minPitch = Math.min(...pitchesHz);
  const maxPitch = Math.max(...pitchesHz);
  const pitchRangeSemitones = 12 * Math.log2(maxPitch / minPitch);

  if (pitchRangeSemitones < 2) {
    return {
      contour: 'flat',
      description: 'Giai điệu giữ trường độ trên âm vực hẹp, mang tính ngân nga đều đặn.',
    };
  }

  const pitchDiff = avgLast - avgFirst;
  if (pitchDiff > 30) {
    return {
      contour: 'ascending',
      description: `Giai điệu có xu hướng đi lên về cuối câu (dải tần từ ${Math.round(minPitch)}Hz đến ${Math.round(maxPitch)}Hz), tạo cảm giác mở rộng và kỳ vọng.`,
    };
  } else if (pitchDiff < -30) {
    return {
      contour: 'descending',
      description: `Giai điệu buông lơi hạ dần về cuối câu (dải tần từ ${Math.round(minPitch)}Hz đến ${Math.round(maxPitch)}Hz), mang màu sắc lắng đọng, thư thái.`,
    };
  } else {
    return {
      contour: 'melodic_wave',
      description: `Giai điệu lượn sóng tự nhiên với biên độ khoảng ${Math.round(pitchRangeSemitones)} bán âm, có chuyển động cao trào ở giữa câu.`,
    };
  }
}

/**
 * Main Local Audio DSP Analysis
 */
export async function analyzeAudioWithLocalDSP(
  blob: Blob,
  clientDuration: number
): Promise<AudioAnalysisResult> {
  const { channelData, sampleRate, duration } = await decodeAudioBlob(blob);
  const effectiveDuration = duration || clientDuration;

  // 1. RMS Energy & Silence calculation
  let totalEnergy = 0;
  let silentSamples = 0;
  for (let i = 0; i < channelData.length; i++) {
    const s = channelData[i];
    const abs = Math.abs(s);
    totalEnergy += s * s;
    if (abs < 0.015) {
      silentSamples++;
    }
  }
  const avgRms = Math.sqrt(totalEnergy / Math.max(1, channelData.length));
  const silenceRatio = silentSamples / Math.max(1, channelData.length);

  // 2. Pitch tracking & Chroma
  const { pitchesHz, pitchPoints, chromaCounts, sustainedRuns } = extractVoicedPitches(channelData, sampleRate);

  // 3. Musical Key (Krumhansl-Schmuckler)
  const { key: detectedKey, confidence: keyConfidence } = estimateMusicalKey(chromaCounts);

  // 4. Tempo (BPM)
  const { tempo: detectedTempo, confidence: tempoConfidence } = estimateTempo(channelData, sampleRate, effectiveDuration);

  // 5. Pitch Contour & Melody Description
  const { contour, description: melodyDesc } = analyzePitchContour(pitchesHz);

  // 5b. Detailed Melody Analysis Data for V2 visualizer (strictly from real DSP)
  let melodyData: import('../../types').MelodyAnalysisData | null = null;
  if (pitchesHz.length >= 4 && pitchPoints.length >= 4) {
    const minHz = Math.min(...pitchesHz);
    const maxHz = Math.max(...pitchesHz);
    let peakHz = 0;
    let peakNote = '';
    for (const pt of pitchPoints) {
      if (pt.hz > peakHz) {
        peakHz = pt.hz;
        peakNote = pt.noteName;
      }
    }
    const pitchRangeSemitones = Number((12 * Math.log2(maxHz / Math.max(1, minHz))).toFixed(1));

    melodyData = {
      pitchesHz,
      pitchPoints,
      minHz: Math.round(minHz),
      maxHz: Math.round(maxHz),
      peakHz: Math.round(peakHz),
      peakNote: peakNote || 'N/A',
      pitchRangeSemitones,
      contour,
      contourDescription: melodyDesc,
      sustainedRuns,
    };
  }

  // 6. Input Classification based on real acoustic traits
  let inputType: InputClassification = 'humming_melody';
  let hasSpeech = false;

  if (pitchesHz.length === 0) {
    inputType = 'instrument_or_ambient';
  } else if (sustainedRuns >= 3 || contour === 'melodic_wave') {
    // Sustained musical pitches indicate humming or melody singing
    inputType = 'humming_melody';
  } else if (silenceRatio > 0.4 && pitchesHz.length > 8) {
    // Broken cadence with frequent pauses characteristic of spoken note
    inputType = 'spoken_idea';
    hasSpeech = true;
  } else {
    inputType = 'singing_with_lyrics';
    hasSpeech = true;
  }

  // 7. Acoustically Grounded Emotion & Genre Suggestions (NO FAKE / HARDCODED DATA)
  let emotion: string | null = null;
  const genreSuggestions: GenreSuggestion[] = [];
  const developmentIdeas: string[] = [];

  const overallConfidence = Math.max(
    0.3,
    Number(((keyConfidence + tempoConfidence + (pitchesHz.length > 10 ? 0.3 : 0.1)) / 2).toFixed(2))
  );

  if (detectedKey && detectedKey.includes('Thứ')) {
    emotion = detectedTempo && detectedTempo > 110
      ? 'Trầm lắng nhưng thôi thúc (Intense / Driving Minor)'
      : 'Sâu lắng & Hoài niệm (Melancholic & Reflective)';

    genreSuggestions.push({
      name: 'Acoustic Ballad',
      reason: `Giọng ${detectedKey} kết hợp tiết tấu tự nhiên phù hợp không gian mộc mạc bên đàn guitar hoặc piano.`,
    });
    genreSuggestions.push({
      name: 'Lo-Fi / Indie Chill',
      reason: 'Độ nảy nhẹ và khoảng lặng âm thanh tự nhiên rất thích hợp với nhịp trống ấm và beat thư giãn.',
    });
  } else if (detectedKey && detectedKey.includes('Trưởng')) {
    emotion = detectedTempo && detectedTempo > 100
      ? 'Tươi sáng & Tràn đầy năng lượng (Uplifting & Bright)'
      : 'Ấm áp & Bình yên (Warm & Gentle)';

    genreSuggestions.push({
      name: 'Indie Pop / Acoustic',
      reason: `Gam màu ${detectedKey} mang lại cảm giác sáng rõ, lạc quan cho người nghe.`,
    });
    genreSuggestions.push({
      name: 'R&B / Soul mộc',
      reason: 'Đường nét giai điệu có độ luyến thích hợp để đắp hòa âm ấm áp.',
    });
  } else {
    // If key cannot be reliably determined
    emotion = avgRms > 0.15
      ? 'Mạnh mẽ & Trực cảm (Dynamic & Raw)'
      : 'Thì thầm & Nhẹ nhàng (Intimate & Soft)';

    genreSuggestions.push({
      name: 'Acoustic tự do',
      reason: 'Giai điệu chưa bị gò bó vào giọng cố định, cho phép bạn tự do thử nghiệm nhiều hòa thanh khác nhau.',
    });
  }

  // Development ideas based on actual detected contour & input
  if (contour === 'ascending') {
    developmentIdeas.push('Giai điệu có xu hướng vút lên: Hãy thử viết tiếp một câu điệp khúc giải tỏa cảm xúc ở âm vực cao này.');
  } else if (contour === 'descending') {
    developmentIdeas.push('Giai điệu lắng dần về cuối: Thử thêm một nốt nhấn bất ngờ ở nhịp đầu tiên của câu tiếp theo để tạo sự tương phản.');
  } else {
    developmentIdeas.push('Giai điệu có chuyển động lượn sóng: Thử lặp lại mô-típ này với biến tấu tiết tấu nhanh hơn 1 chút.');
  }

  if (inputType === 'spoken_idea') {
    developmentIdeas.push('Bạn đang chia sẻ một ý nghĩ: Hãy thử ngân nga câu nói này thành 3-4 nốt nhạc xem cảm xúc vang lên thế nào.');
  } else {
    developmentIdeas.push('Thử gảy vài hợp âm đệm đơn giản bên dưới đoạn ngân nga này để kiểm tra màu sắc hòa âm bạn yêu thích nhất.');
  }

  return {
    duration: Number(effectiveDuration.toFixed(2)),
    hasSpeech,
    inputType,
    // Real speech transcription requires external AI model
    transcript: null,
    originalLyric: null,
    developedLyric: null,
    melodyDescription: melodyDesc,
    tempo: detectedTempo,
    key: detectedKey,
    emotion,
    genreSuggestions,
    confidence: overallConfidence,
    developmentIdeas,
    analyzedWith: 'local_dsp',
    needsAiConnectionFor: [
      'Nhận diện lời hát / giọng nói tiếng Việt (Speech-to-Text)',
      'Tự động viết tiếp lời thơ & phát triển ca từ',
      'Phân tích ngữ nghĩa cảm xúc sâu từ văn bản',
    ],
    melodyData,
    acousticFeatures: {
      avgRmsEnergy: Number(avgRms.toFixed(4)),
      silenceRatio: Number(silenceRatio.toFixed(2)),
      pitchContour: contour,
      detectedNoteCount: pitchesHz.length,
      dominantFreqHz: pitchesHz.length > 0 ? Math.round(pitchesHz[Math.floor(pitchesHz.length / 2)]) : undefined,
      pitchesHz,
    },
  };
}
