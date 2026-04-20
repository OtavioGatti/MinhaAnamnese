import { API_BASE_URL } from './config';
import { supabase } from './lib/supabaseClient';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token || null;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
    const config = {
      ...options,
      headers: requestHeaders,
    };

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get('content-type') || '';
      const json = contentType.includes('application/json')
        ? await response.json()
        : {};

      if ('success' in json) {
        return {
          ...json,
          status: response.status,
        };
      }

      if (!response.ok) {
        return {
          success: false,
          data: null,
          status: response.status,
          error: json.erro || json.error || 'Erro na requisição',
        };
      }

      return {
        success: true,
        data: json,
        status: response.status,
        error: null,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        status: 0,
        error: err.message || 'Erro de conexão com o servidor',
      };
    }
  }

  async get(path) {
    return this.request(path, { method: 'GET' });
  }

  async post(path, body) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
