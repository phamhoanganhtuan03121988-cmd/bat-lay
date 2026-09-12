/**
 * BẮT LẤY - Personal Use BYOK (Bring Your Own Key) Storage
 * 
 * Manages client-side Gemini API key persistence in browser localStorage.
 * 
 * SECURITY TRANSPARENCY:
 * - Khóa được lưu cục bộ trên thiết bị này (localStorage).
 * - Không lưu trong mã nguồn BẮT LẤY và không commit lên GitHub.
 * - Đây là kiến trúc BYOK cho ứng dụng cá nhân (Personal-use), không phải máy chủ bảo mật tuyệt đối.
 */

const STORAGE_KEY = 'bat_lay_gemini_api_key';

/**
 * Retrieve stored Gemini API key from browser localStorage
 */
export function getStoredApiKey(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    console.warn('Cannot read API key from localStorage:', err);
    return null;
  }
}

/**
 * Save Gemini API key to browser localStorage
 */
export function setStoredApiKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    removeStoredApiKey();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
    // Dispatch custom event to notify components reactively
    window.dispatchEvent(new Event('bat_lay_api_key_updated'));
  } catch (err) {
    console.error('Cannot save API key to localStorage:', err);
    throw new Error('Trình duyệt không cho phép ghi vào bộ nhớ cục bộ.');
  }
}

/**
 * Remove Gemini API key from browser localStorage
 */
export function removeStoredApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('bat_lay_api_key_updated'));
  } catch (err) {
    console.warn('Cannot remove API key from localStorage:', err);
  }
}

/**
 * Check if a valid API key exists
 */
export function hasApiKeyConfigured(): boolean {
  const key = getStoredApiKey();
  return Boolean(key && key.length >= 20);
}

/**
 * Test the user's Gemini API key by making a lightweight test call to Gemini 2.5 Flash
 */
export async function testApiKeyConnection(key: string): Promise<{ success: boolean; message: string }> {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return { success: false, message: 'Vui lòng nhập API Key.' };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(trimmedKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'BẮT LẤY connection test. Please reply with "OK".' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
        },
      }),
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Kết nối thành công với Gemini 2.5 Flash!',
      };
    }

    const errJson = await response.json().catch(() => null);
    const errorMsg = errJson?.error?.message || response.statusText;

    if (response.status === 400) {
      return {
        success: false,
        message: 'API Key không hợp lệ hoặc sai định dạng. Vui lòng kiểm tra lại trên Google AI Studio.',
      };
    } else if (response.status === 403) {
      return {
        success: false,
        message: `Khóa bị từ chối quyền truy cập (403): ${errorMsg}. Hãy kiểm tra xem API key có bị giới hạn sai domain/IP không.`,
      };
    } else if (response.status === 429) {
      return {
        success: false,
        message: 'Tài khoản đã vượt quá hạn mức truy vấn (Rate limit 429). Vui lòng thử lại sau giây lát.',
      };
    }

    return {
      success: false,
      message: `Lỗi kết nối (${response.status}): ${errorMsg}`,
    };
  } catch (networkErr: unknown) {
    console.error('Test connection network error:', networkErr);
    return {
      success: false,
      message: 'Không thể kết nối đến máy chủ Google Gemini. Vui lòng kiểm tra kết nối mạng của bạn.',
    };
  }
}
