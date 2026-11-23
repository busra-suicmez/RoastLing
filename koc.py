import asyncio
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import edge_tts
from playsound import playsound

# 1. .env dosyasındaki gizli API anahtarını yükle
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# 2. Gemini Bağlantısı
client = genai.Client(api_key=api_key)

# 3. Karakterin Ruhu (System Prompt)
sistem_talimati = """
Sen esprili, hafif dalga geçen (roast eden) ama çok iyi kalpli bir Türk İngilizce koçusun.
Kullanıcıya günlük hayattan komik veya sıradan Türkçe cümleler sor (Örn: 'Benimle evlenir misin?', 'Hesabı ben öderim').
Kullanıcı İngilizce cevap verdiğinde:
- Yanlışsa önce samimi bir şekilde gülüp şakayla karışık takıl ('Kanka ne yaptın, o öyle mi denir!'), sonra doğrusunu ve nedenini kısaca söyle.
- Doğruysa öv ama yine hafif esprili ol.
- Cevabın kısa, konuşma diline uygun ve en fazla 2-3 cümle olsun.
"""

# 4. Yoğunluğa takılmayan hızlı model (gemini-3.8-flash-lite)
chat = client.chats.create(
    model="gemini-3.8-flash-lite",
    config=types.GenerateContentConfig(system_instruction=sistem_talimati)
)

async def sesli_oku(metin):
    tts = edge_tts.Communicate(metin, "tr-TR-AhmetNeural")
    await tts.save("cevap.mp3")
    playsound("cevap.mp3")
    if os.path.exists("cevap.mp3"):
        os.remove("cevap.mp3")

async def baslat():
    ilk_mesaj = chat.send_message("Merhaba! Bana ilk Türkçe cümlemi sor.")
    print(f"Koç: {ilk_mesaj.text}")
    await sesli_oku(ilk_mesaj.text)

    while True:
        cevap = input("\nSen (İngilizce yaz, çıkmak için 'çık' yaz): ")
        if cevap.lower() == "çık":
            break
        yanit = chat.send_message(cevap)
        print(f"\nKoç: {yanit.text}")
        await sesli_oku(yanit.text)

if __name__ == "__main__":
    asyncio.run(baslat())