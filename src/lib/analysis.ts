import { AudioAnalysisProvider, AudioAnalysisResult } from '../types';

/**
 * MockAudioAnalysisProvider
 * Provides intelligent, musically evocative mock analysis results for spontaneous audio ideas
 * without calling any paid external APIs.
 */
export class MockAudioAnalysisProvider implements AudioAnalysisProvider {
  async analyzeAudio(_blob: Blob, duration: number): Promise<AudioAnalysisResult> {
    // Simulate brief processing time (600ms)
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Diverse musical mock palettes
    const mockPalettes: AudioAnalysisResult[] = [
      {
        transcript: 'Gió qua hiên nhà, một chiều buông nắng vàng phai...',
        originalLyric: 'Gió qua hiên nhà, một chiều buông nắng vàng phai...\nCó ai đợi chờ, tiếng mưa rơi nhẹ ngoài song.',
        developedLyric: 'Gió khẽ lùa qua song thưa, chiều buông từng vạt nắng tàn phai,\nNgồi đếm từng giọt rơi tí tách, ngỡ bóng ai về trong sớm mai.\nMột nốt trầm buông lơi giữa phố vắng,\nĐể lại chút dư hương ngọt ngào dở dang.',
        emotion: 'Hoài niệm & Trầm lắng (Nostalgic & Mellow)',
        bpm: 76,
        musicalKey: 'Mi Thứ (E Minor)',
        melodyDescription: 'Giai điệu lượn sóng ngũ cung nhẹ nhàng, âm khu trung, tiết tấu lửng đặc trưng của Ballad.',
        suggestedGenres: ['Acoustic Indie', 'Lo-Fi Chill', 'Vietnamese Ballad'],
      },
      {
        transcript: 'Từng nhịp bước chân trên phố đông, ta tìm về miền bình yên...',
        originalLyric: 'Từng nhịp bước chân trên phố đông, ta tìm về miền bình yên.\nNhững ánh đèn đường soi bóng nghiêng.',
        developedLyric: 'Giữa phố dài người xe hối hả, bước chân ta nhẹ tìm về bình yên,\nÁnh đèn vàng nhạt nhòa trong mắt biếc, khẽ ru câu hò quên muộn phiền.\nGiai điệu này ngân vang như lời hẹn ước,\nĐi qua bao thăng trầm vẫn giữ trọn tim trong.',
        emotion: 'Tươi sáng & Hy vọng (Hopeful & Uplifting)',
        bpm: 98,
        musicalKey: 'Đô Trưởng (C Major)',
        melodyDescription: 'Giai điệu tươi vui, nảy nhịp Syncopation, khoảng âm thanh thoát phù hợp Pop hoặc R&B.',
        suggestedGenres: ['City Pop', 'Neo Soul', 'Indie Pop'],
      },
      {
        transcript: 'Đêm nay mưa rơi lặng lẽ, ai nhớ ai...',
        originalLyric: 'Đêm nay mưa rơi lặng lẽ, ai nhớ ai giữa khoảng trời riêng.',
        developedLyric: 'Đêm nay mưa rơi từng giọt lặng lẽ rớt qua thềm,\nAi ngồi đợi ai giữa khoảng trời chênh chao không tên.\nTiếng đàn ngân lên giữa căn phòng vắng,\nHỏi trăng đầu ngõ có còn vương vấn.',
        emotion: 'Sâu lắng & Da diết (Poetic & Intimate)',
        bpm: 68,
        musicalKey: 'La Thứ (A Minor)',
        melodyDescription: 'Âm hưởng Blues/Ballad da diết, nốt kéo dài tạo độ ngân cảm xúc cao.',
        suggestedGenres: ['Jazz Ballad', 'Ambient Folk', 'Piano Acoustic'],
      },
    ];

    // Pick a palette deterministically or based on duration
    const index = Math.floor(duration * 10) % mockPalettes.length;
    return mockPalettes[index];
  }
}

/**
 * GeminiAudioAnalysisProvider
 * Placeholder architecture for future server-side / Gemini 2.0 Flash Audio Multimodal API.
 * Currently disabled to avoid unnecessary paid API calls as instructed.
 */
export class GeminiAudioAnalysisProvider implements AudioAnalysisProvider {
  async analyzeAudio(blob: Blob, duration: number): Promise<AudioAnalysisResult> {
    // When ready, this will invoke a server endpoint (e.g. /api/analyze-audio)
    // passing the audio buffer to Gemini Multimodal Audio analysis.
    // For now, gracefully fall back to Mock provider.
    const mock = new MockAudioAnalysisProvider();
    return mock.analyzeAudio(blob, duration);
  }
}

// Active provider instance
export const defaultAudioAnalyzer: AudioAnalysisProvider = new MockAudioAnalysisProvider();
