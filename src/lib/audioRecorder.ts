export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
  liveLevels: number[]; // real-time visualizer levels (0..1)
  error: string | null;
}

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioChunks: Blob[] = [];
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private pausedTimeAccumulator: number = 0;
  private pauseStart: number = 0;
  private waveformSamples: number[] = [];
  private mimeType: string = '';

  public onUpdate?: (state: { durationMs: number; liveLevels: number[] }) => void;

  public async start(): Promise<void> {
    this.audioChunks = [];
    this.waveformSamples = [];
    this.pausedTimeAccumulator = 0;

    // Check device capability
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Trình duyệt này không hỗ trợ ghi âm trực tiếp. Hãy mở trang web bằng Safari trên iOS.'
      );
    }

    // Request microphone access ONLY when recording starts
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error(
          'Quyền truy cập Microphone bị từ chối. Trên iPhone Safari: Vào Cài đặt (Settings) > Safari > Microphone > chọn "Hỏi" (Ask) hoặc "Cho phép" (Allow), sau đó tải lại trang.'
        );
      }
      throw new Error(`Không thể khởi động microphone: ${error.message || 'Lỗi thiết bị'}`);
    }

    this.audioStream = stream;

    // Determine Safari-compatible MIME type
    let options: MediaRecorderOptions = {};
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
        this.mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
        this.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
        this.mimeType = 'audio/webm';
      } else {
        this.mimeType = '';
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch {
      // Fallback without explicit options if options failed on older WebKit
      this.mediaRecorder = new MediaRecorder(stream);
      this.mimeType = this.mediaRecorder.mimeType || 'audio/mp4';
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Setup Web Audio Analyser for real-time waveform
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
    } catch (e) {
      console.warn('Web Audio Analyser not supported or failed to init:', e);
    }

    this.mediaRecorder.start(100); // chunk every 100ms
    this.startTime = performance.now();

    this.startVisualizerLoop();
  }

  private startVisualizerLoop() {
    const dataArray = this.analyser ? new Uint8Array(this.analyser.frequencyBinCount) : null;
    let sampleCounter = 0;

    const tick = () => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return;
      }

      let elapsed = 0;
      if (this.mediaRecorder.state === 'recording') {
        elapsed = performance.now() - this.startTime - this.pausedTimeAccumulator;
      } else if (this.mediaRecorder.state === 'paused') {
        elapsed = this.pauseStart - this.startTime - this.pausedTimeAccumulator;
      }

      let liveLevels: number[] = [0.2, 0.3, 0.4, 0.5, 0.3, 0.2];

      if (this.analyser && dataArray && this.mediaRecorder.state === 'recording') {
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate a 12-bar normalized visualizer
        const barCount = 16;
        const step = Math.max(1, Math.floor(dataArray.length / barCount));
        const bars: number[] = [];
        let totalSum = 0;

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i * step] || 0;
          const normalized = Math.min(1, Math.max(0.08, val / 255));
          bars.push(normalized);
          totalSum += normalized;
        }

        liveLevels = bars;

        // Sample for recorded waveform preview every ~120ms
        sampleCounter++;
        if (sampleCounter % 7 === 0) {
          const avg = totalSum / barCount;
          this.waveformSamples.push(Math.min(1, Math.max(0.1, avg)));
          if (this.waveformSamples.length > 50) {
            // Keep up to 50 samples
            this.waveformSamples.shift();
          }
        }
      }

      if (this.onUpdate) {
        this.onUpdate({
          durationMs: Math.max(0, elapsed),
          liveLevels,
        });
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  public pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStart = performance.now();
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.pausedTimeAccumulator += performance.now() - this.pauseStart;
      this.mediaRecorder.resume();
    }
  }

  public async stop(): Promise<{ blob: Blob; durationSec: number; waveform: number[] }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recorder to stop.'));
        return;
      }

      const recorder = this.mediaRecorder;

      recorder.onstop = () => {
        try {
          const mimeType = this.mimeType || recorder.mimeType || 'audio/mp4';
          const blob = new Blob(this.audioChunks, { type: mimeType });
          const totalDurationSec =
            (performance.now() - this.startTime - this.pausedTimeAccumulator) / 1000;

          // Generate at least 25 waveform bars if few samples were captured
          let finalWaveform = [...this.waveformSamples];
          if (finalWaveform.length < 20) {
            finalWaveform = Array.from({ length: 30 }, (_, i) => {
              const sine = Math.sin((i / 30) * Math.PI);
              return Math.max(0.15, Math.min(0.9, sine * 0.7 + (Math.random() * 0.2)));
            });
          }

          this.cleanup();
          resolve({
            blob,
            durationSec: Math.max(0.5, totalDurationSec),
            waveform: finalWaveform,
          });
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      };

      recorder.stop();
    });
  }

  public cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore stop error on cancel
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
