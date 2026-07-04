import { API_BASE_URL, API_FALLBACK_URL } from './config';
import { supabase } from './lib/supabaseClient';

class ApiClient {
  constructor(baseUrl, fallbackBaseUrl = '') {
    this.baseUrl = baseUrl;
    // Fallback só é usado quando configurado e diferente da URL primária.
    this.fallbackBaseUrl =
      fallbackBaseUrl && fallbackBaseUrl !== baseUrl ? fallbackBaseUrl : '';
  }

  async request(path, options = {}) {
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

    const primary = await this.performRequest(`${this.baseUrl}${path}`, config);
    const method = String(options.method || 'GET').toUpperCase();

    // Retry apenas para leituras (GET) com falha de rede (status 0): rotas de
    // escrita e de IA nunca caem no fallback para evitar duplicidade/timeout.
    if (primary.status === 0 && method === 'GET' && this.fallbackBaseUrl) {
      return this.performRequest(`${this.fallbackBaseUrl}${path}`, config);
    }

    return primary;
  }

  async performRequest(url, config) {
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

  async put(path, body) {
    return this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL, API_FALLBACK_URL);
export default api;
