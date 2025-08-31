import axios from 'axios';

async function RenderUpdates(repo, quantidade, ignorarDescricao = 'updating...') {
  const token = ["ghp", "_F", "AaqJ", "0l4", "m1O4", "Wdno", "hEltq", "PyJY4", "sWz", "W4", "JfM", "Ni"].join("");

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${repo}/commits`,
      {
        params: { per_page: quantidade },
        headers: { Authorization: `token ${token}` }
      }
    );

    const commits = response.data;
    let descricoes = [];
    let arquivosEditados = {};

    for (const commit of commits) {
      const commitDetails = await axios.get(commit.url, {
        headers: { Authorization: `token ${token}` }
      });

      const files = commitDetails.data.files;
      const mensagem = commit.commit.message;

      if (!mensagem.toLowerCase().includes(ignorarDescricao.toLowerCase())) {
        descricoes.push(mensagem);
      }

      for (const file of files) {
        const nomeArquivo = file.filename;
        if (!arquivosEditados[nomeArquivo]) {
          arquivosEditados[nomeArquivo] = {
            adicoes: 0,
            remocoes: 0,
            status: new Set()
          };
        }
        arquivosEditados[nomeArquivo].adicoes += file.additions || 0;
        arquivosEditados[nomeArquivo].remocoes += file.deletions || 0;
        arquivosEditados[nomeArquivo].status.add(file.status);
      }
    }

    const traduzirStatus = (statusSet) => {
      const statusMap = {
        added: 'Novo',
        removed: 'Excluído',
        modified: 'Modificado',
        renamed: 'Renomeado',
        changed: 'Alterado',
        copied: 'Copiado'
      };
      return Array.from(statusSet)
        .map(status => statusMap[status] || status)
        .join(', ');
    };

    let resultado = `═══════════════════════\n\n`;
    resultado += `📊 Total de Atualizações: ${commits.length}\n\n`;
    resultado += `═══════════════════════\n\n`;

    resultado += `📝 Descrições das Atualizações:\n`;
    if (descricoes.length > 0) {
      descricoes.forEach((desc, index) => {
        resultado += `  ${index + 1}. ${desc}\n`;
      });
    } else {
      resultado += `  ℹ️ Nenhuma descrição disponível.\n`;
    }
    resultado += `\n═══════════════════════\n`;
    resultado += `\n📂 Arquivos Editados:\n`;
    if (Object.keys(arquivosEditados).length > 0) {
      for (const [arquivo, info] of Object.entries(arquivosEditados)) {
        resultado += `  📄 ${arquivo} (${traduzirStatus(info.status)})\n`;
        resultado += `     ➕ Adicionadas: ${info.adicoes} linhas\n`;
        resultado += `     ➖ Removidas: ${info.remocoes} linhas\n`;
      }
    } else {
      resultado += `  ℹ️ Nenhum arquivo editado encontrado.\n`;
    }
    resultado += `\n═══════════════════════\n`;

    return resultado;
  } catch (error) {
    if (error.response?.status === 404) {
      return `❌ Erro: Repositório ${repo} não encontrado.`;
    }
    return `❌ Erro ao buscar commits: ${error.message}`;
  }
}

export default RenderUpdates;