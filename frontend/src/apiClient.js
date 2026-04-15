import { API_BASE_URL } from './config';

/**
 * Cliente API padronizado para comunicação com o backend
 * Retorna sempre { success, data, error }
 */

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Método genérico para requisições fetch
   * @param {string} path - Caminho da rota
   * @param {object} options - Opções do fetch
   * @returns {Promise<{success: boolean, data: any, error: string|null}>}
   */
  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const json = await response.json();

      // Se a resposta já estiver no formato padronizado
      if ('success' in json) {
        return json;
      }

      // Compatibilidade com respostas antigas
      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: json.erro || json.error || 'Erro na requisição',
        };
      }

      return {
        success: true,
        data: json,
        error: null,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err.message || 'Erro de conexão com o servidor',
      };
    }
  }

  /**
   * GET simplificado
   */
  async get(path) {
    return this.request(path, { method: 'GET' });
  }

  /**
   * POST simplificado
   */
  async post(path, body) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
