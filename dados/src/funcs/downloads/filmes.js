// Sistema de Assistir Filmes
// Sistema único, diferente de qualquer outro bot
// Criador: Hiudy
// Caso for usar, deixe os créditos!
// <3

import axios from 'axios';
import { parseHTML } from 'linkedom';

// Lista de chaves da API do Google Custom Search
const API_KEYS = [
  "AIzaSyD51LedjJnOulDkA6u8nfmt17cnIlJ7igc",
  "AIzaSyDbQwjgQforqkA-cHt0omRNX4OQsJ3ocvg",
  "AIzaSyA9wPFHMwnkaBLpnLTP9d8lgEoHAsISQN0",
  "AIzaSyB1wjSU3NfUmc32bus34j9BmSDBKTKaEYg",
  "AIzaSyBm0L9hwLyZ9jhV3HGVcNKQ6znG7_zbSoU",
  "AIzaSyAm_B1DHAK_kCVWHPACK1XAe8sVry1Fj0U",
];

// Configuração do Axios com timeout
const axiosInstance = axios.create({
  timeout: 10000, // 10 segundos de timeout
});

/**
 * Busca resultados usando a API do Google Custom Search
 * @param {string} query - Termo de busca
 * @returns {Promise<Array>} - Lista de resultados { title, link }
 */
async function search(query) {
  if (!query || typeof query !== 'string') {
    console.error('Query inválida.');
    return [];
  }

  for (const key of API_KEYS) {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${key}&cx=32a7e8cb9ffc24cd5`;
    try {
      const response = await axiosInstance.get(url);
      const results = response.data.items || [];
      return results.map(item => ({ title: item.title, link: item.link }));
    } catch (error) {
      console.error(`Erro com a chave ${key}:`, error.response?.data?.error?.message || error.message);
    }
  }
  return [];
}

/**
 * Busca informações de um vídeo com base no texto de busca
 * @param {string} texto - Termo de busca para o filme
 * @returns {Promise<Object|null>} - Objeto com { img, name, url } ou null
 */
async function Filmes(texto) {
  if (!texto) {
    console.log('Texto de busca não fornecido.');
    return null;
  }

  const results = await search(texto);
  if (results.length === 0) {
    console.log('Nenhum resultado encontrado.');
    return null;
  }

  for (const result of results) {
    // Verifica se o link é de uma página de vídeo (expande para outros sites se necessário)
    if (result.link.includes('/video/')) {
      try {
        const videoPageResponse = await axiosInstance.get(result.link);
        const { document } = parseHTML(videoPageResponse.data);

        const videoElement = document.querySelector('#tokyvideo_player');
        if (!videoElement) continue;

        const src = videoElement.querySelector('source')?.getAttribute('src');
        const poster = videoElement.getAttribute('poster');
        const dataTitle = videoElement.getAttribute('data-title');
        const tinyUrlResponse = await axios.get(`https://tinyurl.com/api-create.php?url=${src}`);
        const Bah = await axios.get(`https://api.cognima.com.br/api/watch?key=CognimaTeamFreeKey&url=${tinyUrlResponse.data}&name=${dataTitle}&banner=${poster}&description=Buscado Por Nazuna Bot`);
        
        if (poster && dataTitle && src) {
          return {
            img: poster,
            name: dataTitle,
            url: `https://api.cognima.com.br${Bah.data.roomUrl}`,
          };
        }
      } catch (error) {
        console.error(`Erro ao acessar ${result.link}:`, error.message);
      }
    }
  }

  console.log('Nenhum vídeo encontrado.');
  return null;
}

export default Filmes;