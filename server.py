import os
import re
import uuid
import base64
import logging
from collections import defaultdict

import asyncio
import edge_tts

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq

# --------------------------------------------------
# AYARLAR
# --------------------------------------------------

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roastling")

API_KEY = os.getenv("GROQ_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY bulunamadi. .env dosyanizi kontrol edin."
    )

client = Groq(api_key=API_KEY, timeout=30.0)


def aktif_model_sec():
    yasakli = ("whisper", "guard", "tts", "orpheus", "vision", "embed")
    modeller = [
        m.id for m in client.models.list().data
        if not any(k in m.id.lower() for k in yasakli)
    ]
    # En dusuk gecikmeli hizli modeller en basta
    tercihler = [
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "openai/gpt-oss-20b",
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "llama-3.3-70b-versatile",
        "openai/gpt-oss-120b",
    ]
    for t in tercihler:
        if t in modeller:
            return t
    return modeller[0]


MODEL = aktif_model_sec()
logger.info("Secilen hizli Groq modeli: %s", MODEL)

app = FastAPI(title="RoastLing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_histories = defaultdict(list)

ILK_MESAJLAR = {
    "roast": "Selam! Hazırsan başlayalım. 'Benimle evlenir misin?' cümlesini İngilizce söyle bakalım!",
    "roleplay": "Welcome! I'm your barista today. What would you like to order?",
    "fix": "Bakalım dikkatli misin! 'I am go to cinema yesterday.' Cümlesindeki hatayı bul!",
    "freetalk": "Hey! How are you doing today? Tell me about your day!",
}

# --------------------------------------------------
# MOD TALIMATLARI (KISA, VURUCU VE BOL ROAST)
# --------------------------------------------------

PROMPTS = {
    "roast": """
Sen RoastLing adında çok zeki, acımasız derecede komik, yanlış yapınca kahkaha atarak tatlı-sert zorbalayan (roast eden) ama gerçekten İngilizce öğreten bir Türk kankasın.
Modun: Çeviri & Roast.
- Kullanıcı yanlış İngilizce cümle kurarsa yeni soruya GEÇME. Önce gülerek dalga geç ('Hahaha Google Translate bile istifa etti şu an!'), doğrusunu söyle ve 'Hadi şimdi tekrar et!' de.
- Doğru çevirdiyse veya doğrusunu tekrar ettiyse 'Hah şöyle, sonunda!' deyip günlük hayattan yepyeni ve eğlenceli bir Türkçe cümle sor. ASLA daha önce sorduğun cümleyi tekrar sorma.
- Emoji veya yıldız kullanma, düz konuşma metni yaz. En fazla 2 kısa cümle kur.
""",

    "roleplay": """
Sen RoastLing adında bir kafede çalışan esprili ve hafif zorba bir baristasın, kullanıcı da İngilizce kahve sipariş eden müşteri.
- Karakterde kalarak kısa ve doğal İngilizce yanıt ver.
- Kullanıcı sipariş verirken gramer hatası yaparsa gülerek tatlı-sert Türkçe zorbalık yap, doğrusunu söyle ve tekrarlat.
- Emoji veya yıldız kullanma, en fazla 2 kısa cümle kur.
""",

    "fix": """
Sen RoastLing adında çok esprili ve hafif zorba bir İngilizce gramer koçusun.
- Kullanıcının düzeltmesini değerlendir. Hata yaptıysa kahkaha atarak zorbalayıp doğrusunu söyle ve 'Hadi şimdi tekrar et!' de.
- Doğru düzelttiyse tebrik edip yepyeni bozuk bir İngilizce cümle sor. ASLA aynı cümleyi tekrar sorma.
- Emoji veya yıldız kullanma, en fazla 2 kısa cümle kur.
""",

    "freetalk": """
Sen RoastLing adında samimi, komik ve ana dili İngilizce seviyesinde bir sohbet kankasısın.
- Günlük hayat hakkında doğal İngilizce sohbet et, her seferinde farklı konular aç.
- Önemli bir hata yaparsa kahkaha atarak tatlı-sert Türkçe zorbalayıp doğrusunu söyle ve sohbeti ilerlet.
- Emoji veya yıldız kullanma, en fazla 2 kısa cümle kur.
"""
}


def get_prompt(mode):
    return PROMPTS.get(mode, PROMPTS["freetalk"])


# --------------------------------------------------
# YAPAY ZEKA CEVABI
# --------------------------------------------------

def generate_ai_response(user_text, session_id, mode):

    history = chat_histories[session_id]

    if len(history) == 0 and mode in ILK_MESAJLAR:
        history.append({
            "role": "assistant",
            "content": ILK_MESAJLAR[mode]
        })

    messages = [
        {
            "role": "system",
            "content": get_prompt(mode)
        }
    ]

    messages.extend(history[-6:])

    messages.append({
        "role": "user",
        "content": user_text
    })

    ekstra_ayar = {}
    if "gpt-oss" in MODEL:
        ekstra_ayar["reasoning_effort"] = "low"

    result = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.8,
        max_completion_tokens=115,
        **ekstra_ayar
    )

    answer = (result.choices[0].message.content or "").strip()
    answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.DOTALL).strip()

    if not answer:
        raise ValueError("Yapay zeka bos cevap dondurdu.")

    history.append({
        "role": "user",
        "content": user_text
    })

    history.append({
        "role": "assistant",
        "content": answer
    })

    chat_histories[session_id] = history[-12:]

    return answer


# --------------------------------------------------
# SESI YAZIYA CEVIRME
# --------------------------------------------------

def transcribe_audio(audio_bytes, filename):

    result = client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model="whisper-large-v3-turbo",
        language="en",
        response_format="json"
    )

    return result.text.strip()


# --------------------------------------------------
# YAZIYI SESE CEVIRME (DISKSIZ / RAM UZERINDEN HIZLI)
# --------------------------------------------------

async def generate_audio(text):

    voice = "en-US-AndrewMultilingualNeural"

    temiz_metin = re.sub(r"[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s.,!?'\"-]", "", text)
    temiz_metin = re.sub(r"\s+", " ", temiz_metin).strip()

    communicate = edge_tts.Communicate(
        temiz_metin,
        voice,
        rate="+14%"
    )

    audio_buffer = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_buffer.extend(chunk["data"])

    return base64.b64encode(bytes(audio_buffer)).decode("utf-8")


# --------------------------------------------------
# ANA SAYFA
# --------------------------------------------------

@app.get("/")
async def home():
    return {
        "status": "active",
        "message": "RoastLing API calisiyor!",
        "model": MODEL
    }


# --------------------------------------------------
# SESLI SOHBET
# --------------------------------------------------

@app.post("/sesli-sohbet")
async def voice_chat(request: Request):

    try:
        form = await request.form()

        session_id = str(
            form.get("session_id") or uuid.uuid4()
        )

        mode = str(
            form.get("mode") or "freetalk"
        ).lower()

        audio_file = None

        for field_name in [
            "audio",
            "file",
            "audio_file",
            "recording"
        ]:
            candidate = form.get(field_name)

            if hasattr(candidate, "read"):
                audio_file = candidate
                break

        user_text = str(
            form.get("message")
            or form.get("text")
            or form.get("user_text")
            or ""
        ).strip()

        if audio_file is not None:
            audio_bytes = await audio_file.read()

            if not audio_bytes:
                raise HTTPException(
                    status_code=400,
                    detail="Ses dosyasi bos."
                )

            filename = audio_file.filename or "recording.webm"

            user_text = await asyncio.to_thread(
                transcribe_audio,
                audio_bytes,
                filename
            )

        if not user_text:
            raise HTTPException(
                status_code=400,
                detail="Konusma algilanamadi. Tekrar deneyin."
            )

        logger.info("Kullanici mesaji: %s", user_text)

        answer = await asyncio.to_thread(
            generate_ai_response,
            user_text,
            session_id,
            mode
        )

        logger.info("AI cevabi olusturuldu: %s", answer)

        audio_b64 = await generate_audio(answer)

        return {
            "success": True,
            "session_id": session_id,
            "transcription": user_text,
            "user_text": user_text,
            "response": answer,
            "ai_response": answer,
            "reply": answer,
            "audio_b64": audio_b64,
            "audio": "data:audio/mpeg;base64," + audio_b64,
            "audio_url": "data:audio/mpeg;base64," + audio_b64
        }

    except HTTPException:
        raise

    except Exception as error:
        logger.exception("SESLI SOHBET HATASI")

        raise HTTPException(
            status_code=502,
            detail=f"Sunucu hatasi: {str(error)}"
        )


# --------------------------------------------------
# SOHBETI SIFIRLAMA
# --------------------------------------------------

@app.post("/sohbeti-sifirla")
async def reset_chat(request: Request):

    try:
        data = await request.json()
    except Exception:
        data = {}

    session_id = data.get("session_id")

    if session_id:
        chat_histories.pop(session_id, None)

    return {
        "success": True,
        "message": "Sohbet gecmisi sifirlandi."
    }