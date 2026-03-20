/**
 * Serviço para integração com a API do WhatsApp Cloud
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Envia uma mensagem de texto para um número do WhatsApp
 * @param to - Número de telefone do destinatário (formato: 5511999999999)
 * @param text - Texto da mensagem a ser enviada
 * @returns Resultado da operação
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  const accessToken = process.env.WHATSAPP_TOKEN;

  // Validação das variáveis de ambiente
  if (!phoneNumberId || !accessToken) {
    console.error('Variáveis de ambiente WHATSAPP_PHONE_ID ou WHATSAPP_TOKEN não configuradas');
    return {
      success: false,
      error: 'Configuração do WhatsApp incompleta'
    };
  }

  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: text
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao enviar mensagem WhatsApp:', data);
      return {
        success: false,
        error: data.error?.message || 'Erro desconhecido ao enviar mensagem'
      };
    }

    console.log('Mensagem enviada com sucesso:', data);
    return {
      success: true,
      messageId: data.messages?.[0]?.id
    };
  } catch (error) {
    console.error('Erro na requisição ao WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão com WhatsApp'
    };
  }
}

/**
 * Envia uma mensagem com template (para iniciar conversas)
 * @param to - Número de telefone do destinatário
 * @param templateName - Nome do template aprovado no WhatsApp
 * @param languageCode - Código do idioma (ex: pt_BR)
 * @returns Resultado da operação
 */
export async function sendTemplateMessage(
  to: string, 
  templateName: string, 
  languageCode: string = 'pt_BR'
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  const accessToken = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: 'Configuração do WhatsApp incompleta'
    };
  }

  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Erro ao enviar template'
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão'
    };
  }
}

/**
 * Marca uma mensagem como lida
 * @param messageId - ID da mensagem a ser marcada como lida
 * @returns Resultado da operação
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  const accessToken = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return false;
  }

  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Erro ao marcar mensagem como lida:', error);
    return false;
  }
}

/**
 * Extrai o número de telefone do remetente de um webhook do WhatsApp
 * @param webhookData - Dados recebidos do webhook
 * @returns Objeto com informações extraídas ou null se inválido
 */
export function extractMessageFromWebhook(webhookData: any): {
  from: string;
  message: string;
  messageId: string;
  timestamp: string;
  name?: string;
} | null {
  try {
    const entry = webhookData?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return null;
    }

    // Extrai o texto da mensagem (suporta diferentes tipos)
    let messageText = '';
    if (message.text?.body) {
      messageText = message.text.body;
    } else if (message.button?.text) {
      messageText = message.button.text;
    } else if (message.interactive?.button_reply?.title) {
      messageText = message.interactive.button_reply.title;
    } else if (message.interactive?.list_reply?.title) {
      messageText = message.interactive.list_reply.title;
    }

    // Nome do contato (se disponível)
    const contactName = value?.contacts?.[0]?.profile?.name;

    return {
      from: message.from,
      message: messageText,
      messageId: message.id,
      timestamp: message.timestamp,
      name: contactName
    };
  } catch (error) {
    console.error('Erro ao extrair mensagem do webhook:', error);
    return null;
  }
}
