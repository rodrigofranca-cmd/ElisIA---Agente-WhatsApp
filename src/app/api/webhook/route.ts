import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/lib/gemini';
import { 
  sendWhatsAppMessage, 
  markMessageAsRead, 
  extractMessageFromWebhook 
} from '@/lib/whatsapp';

/**
 * GET /api/webhook
 * Endpoint para verificação do webhook pelo WhatsApp Cloud API
 * 
 * Quando você configura o webhook no Meta Business Suite,
 * o WhatsApp envia uma requisição GET com:
 * - hub.mode: "subscribe"
 * - hub.challenge: um código de desafio a ser retornado
 * - hub.verify_token: o token de verificação configurado
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  // Log para debug
  console.log('[Webhook Verification] Recebido:', { mode, verifyToken });

  // Verifica se o modo é "subscribe" e se o token corresponde
  if (mode === 'subscribe' && verifyToken === process.env.VERIFY_TOKEN) {
    console.log('[Webhook Verification] Webhook verificado com sucesso!');
    
    // Retorna o challenge como texto puro (necessário para verificação)
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  console.log('[Webhook Verification] Falha na verificação - token inválido');
  
  return NextResponse.json(
    { error: 'Verificação falhou. Token inválido.' },
    { status: 403 }
  );
}

/**
 * POST /api/webhook
 * Endpoint para receber mensagens do WhatsApp Cloud API
 * 
 * Estrutura esperada do webhook:
 * {
 *   "entry": [{
 *     "changes": [{
 *       "value": {
 *         "messages": [{
 *           "from": "5511999999999",
 *           "id": "wamid.xxx",
 *           "text": { "body": "mensagem do usuário" }
 *         }]
 *       }
 *     }]
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log completo do webhook recebido (útil para debug)
    console.log('[Webhook] Mensagem recebida:', JSON.stringify(body, null, 2));

    // Extrai informações da mensagem
    const messageData = extractMessageFromWebhook(body);

    // Se não há mensagem (pode ser status de entrega, etc.)
    if (!messageData) {
      console.log('[Webhook] Nenhuma mensagem de usuário encontrada no payload');
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const { from, message, messageId, name } = messageData;

    console.log(`[Webhook] De: ${name || from} (${from})`);
    console.log(`[Webhook] Mensagem: ${message}`);

    // Ignora mensagens vazias
    if (!message || message.trim() === '') {
      console.log('[Webhook] Mensagem vazia, ignorando');
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    // Marca a mensagem como lida (mostra o "check" azul)
    await markMessageAsRead(messageId);

    // Gera resposta usando o Gemini
    console.log('[Gemini] Gerando resposta...');
    const geminiResponse = await generateResponse(message, from);
    console.log(`[Gemini] Resposta: ${geminiResponse.substring(0, 100)}...`);

    // Envia a resposta de volta para o WhatsApp
    console.log('[WhatsApp] Enviando resposta...');
    const sendResult = await sendWhatsAppMessage(from, geminiResponse);

    if (sendResult.success) {
      console.log('[WhatsApp] Resposta enviada com sucesso!');
      return NextResponse.json({ 
        status: 'success',
        messageId: sendResult.messageId 
      }, { status: 200 });
    } else {
      console.error('[WhatsApp] Erro ao enviar:', sendResult.error);
      return NextResponse.json({ 
        status: 'error',
        error: sendResult.error 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Webhook] Erro ao processar:', error);
    
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
