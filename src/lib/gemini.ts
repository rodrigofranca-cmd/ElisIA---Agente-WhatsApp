import { GoogleGenerativeAI } from '@google/generative-ai';

// Inicializa o cliente do Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Configuração do modelo
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash',
  systemInstruction: getSystemPrompt()
});

// Nome da loja configurável via variável de ambiente
const STORE_NAME = process.env.STORE_NAME || 'ElisIA Store';

/**
 * Retorna o system prompt completo com as instruções do assistente
 */
function getSystemPrompt(): string {
  return `Você é o ElisIA, o assistente virtual de atendimento e vendas da ${STORE_NAME}. 
Sua missão é atender os clientes de forma rápida, educada e persuasiva, ajudando-os a tirar dúvidas e a finalizar compras pelo WhatsApp.

DIRETRIZES DE COMPORTAMENTO (TOM DE VOZ):
1. Seja amigável, natural e use um tom conversacional.
2. Como você está no WhatsApp, seja SEMPRE conciso. Evite textos longos e blocos de texto gigantes. Separe as ideias em parágrafos curtos.
3. Use emojis para deixar a conversa mais leve, mas sem exageros.
4. Nunca revele que você é uma inteligência artificial desenvolvida pelo Google, apenas diga que é o assistente virtual da ${STORE_NAME}.

REGRAS DE NEGÓCIO E LIMITES:
1. Você só deve responder a perguntas relacionadas aos produtos, serviços e políticas da ${STORE_NAME}. Se o cliente mudar de assunto para temas não relacionados, traga-o educadamente de volta para a venda.
2. NUNCA invente produtos, preços, promoções ou informações de estoque. Se você não souber a resposta ou a informação não estiver na sua base de dados, diga: "Vou verificar essa informação com a nossa equipe humana, um momento."
3. Sempre conduza a conversa para o fechamento da venda ou para a resolução da dúvida atual. Termine suas respostas com uma pergunta que incentive o cliente a continuar, como "Posso confirmar seu pedido?" ou "Qual tamanho você prefere?".

BASE DE CONHECIMENTO DA LOJA (INFORMAÇÕES PARA VOCÊ CONSULTAR):
- O que vendemos: Alimentos e produtos de limpeza
- Horário de Atendimento Humano: Segunda a Sexta, das 7h às 18h
- Retirada local: 3 a 5 dias úteis para a capital
- Política de Troca: Trocas em até 7 dias após o recebimento, com produto em perfeitas condições
- Formas de Pagamento Aceitas: Pix, Cartão de Crédito em até 3x sem juros, dinheiro

ESTRUTURA DE CATÁLOGO (Produtos Disponíveis):
1. Leite Condensado - R$ 10,00 - Leite Moça tradicional, perfeito para sobremesas
2. Sabão OMO - R$ 5,00 - Sabão em pó para lavar roupa com mais facilidade
3. Detergente Ypê - R$ 3,50 - Detergente líquido para louças
4. Amaciante Comfort - R$ 12,00 - Amaciante concentrado para roupas
5. Arroz Tio João - R$ 25,00 - Arroz tipo 1, pacote 5kg
6. Feijão Carioca - R$ 15,00 - Feijão tipo 1, pacote 1kg
7. Óleo de Soja - R$ 8,00 - Óleo vegetal, garrafa 900ml
8. Açúcar Cristal - R$ 6,00 - Açúcar cristal, pacote 1kg
9. Farinha de Trigo - R$ 7,00 - Farinha de trigo especial, pacote 1kg
10. Café Pilão - R$ 18,00 - Café torrado e moído, pacote 500g

(Nota: Caso o cliente pergunte por algo específico que não está aqui, informe que irá consultar o estoque).`;
}

/**
 * Histórico de conversas por usuário (em memória)
 * Em produção, considere usar um banco de dados
 */
const conversationHistory = new Map<string, Array<{ role: 'user' | 'model'; content: string }>>();

/**
 * Gera uma resposta do Gemini baseada na mensagem do usuário
 * @param userMessage - Mensagem enviada pelo usuário
 * @param userId - ID do usuário no WhatsApp para manter contexto
 * @returns Resposta gerada pelo modelo
 */
export async function generateResponse(userMessage: string, userId: string): Promise<string> {
  try {
    // Recupera ou cria histórico de conversa do usuário
    let history = conversationHistory.get(userId) || [];
    
    // Limita o histórico às últimas 10 interações para evitar tokens demais
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // Inicia o chat com o histórico
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }))
    });

    // Envia a mensagem e obtém a resposta
    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const responseText = response.text();

    // Atualiza o histórico
    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'model', content: responseText });
    conversationHistory.set(userId, history);

    return responseText;
  } catch (error) {
    console.error('Erro ao gerar resposta do Gemini:', error);
    
    // Mensagem de fallback em caso de erro
    return 'Desculpe, tive um pequeno problema técnico aqui. 😅\n\nPode tentar novamente? Se preferir, nosso atendimento humano está disponível de segunda a sexta, das 7h às 18h.';
  }
}

/**
 * Limpa o histórico de conversa de um usuário específico
 * @param userId - ID do usuário no WhatsApp
 */
export function clearConversationHistory(userId: string): void {
  conversationHistory.delete(userId);
}

/**
 * Limpa todo o histórico de conversas
 */
export function clearAllConversationHistory(): void {
  conversationHistory.clear();
}
