import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Inicializa Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const STORE_NAME = 'ElisIA Store'

// System prompt
const SYSTEM_PROMPT = `Você é o ElisIA, assistente virtual da ${STORE_NAME}.
Seja amigável, conciso e use emojis.
Catálogo: Leite Condensado R$10, Sabão OMO R$5, Detergente Ypê R$3,50, Arroz Tio João R$25, Feijão R$15.
Pagamento: Pix, Cartão 3x s/j, Dinheiro.
Entrega: 3-5 dias úteis. Trocas em 7 dias.
Horário: Seg-Sex 7h-18h.`

// Histórico de conversas
const conversations = new Map<string, Array<{role: string, content: string}>>()

// GET - Verificação do webhook
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const token = searchParams.get('hub.verify_token')

  console.log('Webhook verification:', { mode, token })

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified!')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST - Receber mensagens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received webhook:', JSON.stringify(body, null, 2))

    // Extrair dados da mensagem
    const entry = body?.entry?.[0]?.changes?.[0]?.value
    const message = entry?.messages?.[0]

    if (!message) {
      return NextResponse.json({ status: 'ignored' })
    }

    const from = message.from
    const text = message.text?.body || ''

    if (!text) {
      return NextResponse.json({ status: 'ignored' })
    }

    console.log(`Message from ${from}: ${text}`)

    // Gerar resposta com Gemini
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT
    })

    // Recuperar histórico
    let history = conversations.get(from) || []
    
    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role as 'user' | 'model',
        parts: [{ text: h.content }]
      }))
    })

    const result = await chat.sendMessage(text)
    const responseText = result.response.text()

    // Salvar no histórico
    history.push({ role: 'user', content: text })
    history.push({ role: 'model', content: responseText })
    if (history.length > 20) history = history.slice(-20)
    conversations.set(from, history)

    console.log(`Response: ${responseText}`)

    // Enviar resposta para WhatsApp
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: responseText }
        })
      }
    )

    const whatsappResult = await whatsappResponse.json()
    console.log('WhatsApp response:', whatsappResult)

    // Marcar como lida
    await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: message.id
        })
      }
    )

    return NextResponse.json({ status: 'success' })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
