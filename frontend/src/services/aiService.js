// Removemos o import do GoogleGenAI para ser universal

function getPdfBasePrompt() {
    return `Você é um especialista em acessibilidade de documentos. Sua tarefa é adaptar o documento fornecido seguindo rigorosamente as regras abaixo. É CRUCIAL que você processe o documento do início ao fim, sem pular nenhuma página. O resultado deve ser o texto adaptado, pronto para ser formatado.

**DIRETRIZ GERAL E FUNDAMENTAL:**
Transcreva literalmente todo o conteúdo de TODAS AS PÁGINAS do arquivo original, sem resumir, abreviar ou omitir qualquer texto.

**PROCESSO DE ADAPTAÇÃO (CONTEÚDO BASE):**
1.  **Extração Literal:** Transcreva 100% do texto do documento, de capa a capa.
2.  **Linearização:** Se houver quadros ou diagramas, converta-os para um formato de texto linear (use títulos e listas).
3.  **Tratamento de Tabelas (NOVA REGRA):** Ao encontrar uma tabela, NÃO a transcreva usando barras \`|\` ou hífens \`-\` para separar colunas. Em vez disso, descreva-a de forma estruturada. Para cada linha da tabela, liste o nome de cada coluna seguido pelo seu respectivo valor.
4.  **Expansão de Siglas:** Expanda todas as abreviações e siglas na primeira vez que aparecerem.
5.  **Exclusão de Cabeçalhos e Rodapés:** Ignore textos que se repetem no topo (cabeçalhos) ou no final (rodapés) de cada página.
6.  **Exclusão de Elementos Meramente Decorativos:** Ignore apenas elementos puramente visuais que não agreguem conteúdo (ex: bordas, linhas divisórias simples, ícones de enfeite).
7.  **Correção de Quebras de Linha e Citações:** Junte palavras e frases que foram divididas em várias linhas.
8.  **Gerenciamento de Citações/Notas de Rodapé:** Identifique todas as notas de rodapé ou citações no texto, remova-as e crie uma seção "**Referências**" ao final.
`;
}

export function getBraillePrompt(customInstructions) {
    let extra = customInstructions?.trim() ? `\n\n**INSTRUÇÕES ADICIONAIS:**\n${customInstructions.trim()}` : '';
    return `${getPdfBasePrompt()}
**VERSÃO BRAILLE (REGRAS ESPECÍFICAS):**
1. **Indicação de Página Original:** Use \`**Página [Número]**\`.
2. **Títulos e Subtítulos:** Marque com \`**\`.
3. **Descrição de Imagens:** Identifique e descreva detalhadamente todas as imagens informativas. Toda descrição DEVE obrigatoriamente começar com o marcador \`**Início de descrição de imagem**\` em uma linha própria e terminar com \`**Fim de descrição de imagem**\` em outra linha própria.
${extra}
PRODUZA APENAS O TEXTO ADAPTADO.`;
}

export function getAltaLegibilidadePrompt(customInstructions) {
    let extra = customInstructions?.trim() ? `\n\n**INSTRUÇÕES ADICIONAIS:**\n${customInstructions.trim()}` : '';
    return `${getPdfBasePrompt()}
**VERSÃO ALTA LEGIBILIDADE (REGRAS ESPECÍFICAS):**
1. **Indicação de Página Original:** NÃO inclua.
2. **Títulos e Subtítulos:** Marque com \`**\`.
3. **Processamento de Imagens:** NÃO descreva as imagens com texto. Use APENAS o marcador \`[IMAGEM_PAGINA_{NUMERO}]\` no local exato onde a imagem aparece no original. O número deve ser o número da página onde a imagem está.
${extra}
PRODUZA APENAS O TEXTO ADAPTADO.`;
}

export async function callUniversalAI({ prompt, fileData, type, customInstructions }) {
    // Agora usamos o backend como proxy seguro
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api' 
        : 'https://saas-teste-dn2u.onrender.com/api';
    const token = localStorage.getItem('ada_token');

    const text = fileData.extractedText || `Este documento contém imagens. Por favor, analise o contexto.`;

    try {
        const response = await fetch(`${API_BASE_URL}/ai/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                text: `${prompt}\n\n${text}`,
                type: type,
                customInstructions: customInstructions,
                file: fileData.data,
                mimeType: fileData.mimeType
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Erro ${response.status}: Falha no processamento via backend.`);
        }

        return response.body;
    } catch (error) {
        console.error('[AI_SERVICE_FRONTEND_ERROR]', error);
        throw error;
    }
}

