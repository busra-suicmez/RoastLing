# 🎙️ RoastLing — Voice-First AI English Coach

**RoastLing**, İngilizce konuşma pratiği yaparken hataları esprili ve tatlı-sert bir dille düzelten (roast eden), ses odaklı bir yapay zeka dil koçudur.

---

## ✨ Özellikler

- **🔥 Roast & Çeviri:** Verilen Türkçe cümleleri İngilizceye çevir; hata yaparsan koç kahkaha atarak esprili şekilde takılsın, doğrusunu söylesin ve tekrarlatarak öğretsin.
- **☕ Kafe Rol Yapma:** Barista rolündeki yapay zeka ile gerçek zamanlı İngilizce kahve siparişi diyaloğu kur.
- **🕵️ Yanlışımı Bul:** Grameri bilerek bozulmuş İngilizce cümlelerdeki hataları yakala ve doğrusunu seslendir.
- **💬 Serbest Sohbet:** Soru-cevap kalıbı olmadan günlük konularda akıcı İngilizce sohbet et.
- **⚡ Düşük Gecikmeli Ses Mimarisi:** Groq Whisper ses tanıma, hızlı LLM çıkarımı ve RAM üzerinden çok dilli doğal ses sentezi.

---

## 🛠️ Teknoloji Yığını

- **Frontend:** React Native, Expo Web, Web Audio / MediaRecorder API
- **Backend:** Python, FastAPI, Uvicorn
- **Yapay Zeka & Ses:** Groq API (`whisper-large-v3-turbo`, Llama / GPT-OSS modelleri), `edge-tts`

---

## 🚀 Kurulum ve Çalıştırma

### 1. Backend Kurulumu
```bash
pip install fastapi uvicorn groq edge-tts python-dotenv python-multipart
