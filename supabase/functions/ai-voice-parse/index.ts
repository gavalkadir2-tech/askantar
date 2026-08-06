// Bu fonksiyon Supabase'in sunucusunda çalışır — API anahtarı asla
// tarayıcıya inmez. Kullanıcının söylediği/yazdığı Türkçe komutu alır,
// Groq'un ücretsiz, çok hızlı Llama modeline gönderip yapılandırılmış
// (JSON) bir işlem tanımına çevirir. Groq kredi kartı istemez, ücretsiz
// katmanı bu kullanım için fazlasıyla yeterlidir.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, context } = await req.json();
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ action: 'error', message: 'GROQ_API_KEY tanımlı değil' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const farmerNames = (context?.farmerNames || []).join(', ') || '(kayıtlı çiftçi yok)';
    const varietyNames = (context?.varietyNames || []).join(', ') || '(fiyat listesi boş)';
    const today = context?.today || new Date().toISOString().slice(0, 10);

    const systemPrompt = `Sen bir zeytin komisyonculuğu uygulaması için sesli/yazılı komut ayrıştırıcısısın.
Kullanıcının Türkçe cümlesini analiz edip AŞAĞIDAKİ JSON formatlarından TAM OLARAK BİRİNİ döndür.
SADECE JSON döndür — açıklama, markdown, kod bloğu işareti YAZMA. Cevabın ilk karakteri { olmalı.

Kayıtlı çiftçiler: ${farmerNames}
Kayıtlı zeytin türleri: ${varietyNames}
Bugünün tarihi: ${today}

Olası işlem tipleri:
1. Zeytin alımı: {"action":"purchase","farmerName":"...","kg":0,"variety":"...","grade":"...","price":0}
2. Yeni çiftçi ekleme: {"action":"add_farmer","name":"...","phone":"..."}
3. Ödeme veya avans verme: {"action":"payment","farmerName":"...","amount":0,"payType":"odeme"}  (avans ise payType:"avans")
4. Gider ekleme: {"action":"expense","category":"...","amount":0,"note":"..."}
5. Hatırlatma ekleme: {"action":"reminder","title":"...","date":"YYYY-MM-DD"}
6. Anlaşılamayan komut: {"action":"unknown","message":"kısa açıklama"}

Kurallar:
- farmerName alanı, kayıtlı çiftçiler listesindeki bir isimle en çok örtüşen ismi içermeli.
- variety alanı, kayıtlı zeytin türleri listesinden birini seçmeli (yoksa en yakınını tahmin et).
- Tarihi "yarın", "gelecek hafta" gibi göreli ifadelerden bugünün tarihine göre hesapla.
- Emin değilsen "unknown" döndür, asla veri uydurma.`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 400,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ action: 'error', message: `API hatasi: ${errText}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const textOut = data.choices?.[0]?.message?.content || '{}';
    const clean = textOut.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = { action: 'unknown', message: 'Yanit ayristirilamadi' };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ action: 'error', message: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
