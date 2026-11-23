
import React, { useState, useRef, useEffect } from "react";

import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

// --------------------------------------------------
// 1. SUNUCU VE OTURUM AYARLARI
// --------------------------------------------------

const BACKEND_URL = "http://localhost:8000";

const SESSION_ID =
  Date.now().toString() +
  "-" +
  Math.random().toString(36).substring(2, 10);

// --------------------------------------------------
// 2. ÇALIŞMA MODLARI
// --------------------------------------------------

const MODLAR = [
  {
    id: "roast",
    baslik: "🔥 Roast & Çeviri",
    aciklama: "Türkçe cümleleri İngilizceye çevir!",
    ilkMesaj:
      "Selam! Hazırsan başlayalım. 'Benimle evlenir misin?' cümlesini İngilizce söyle bakalım!",
  },
  {
    id: "roleplay",
    baslik: "☕ Kafe Rol Yapma",
    aciklama: "Bir kafede İngilizce sipariş ver!",
    ilkMesaj:
      "Welcome! I'm your barista today. What would you like to order?",
  },
  {
    id: "fix",
    baslik: "🕵️ Yanlışımı Bul",
    aciklama: "İngilizce gramer hatalarını yakala!",
    ilkMesaj:
      "Bakalım dikkatli misin! 'I am go to cinema yesterday.' Cümlesindeki hatayı bul!",
  },
  {
    id: "freetalk",
    baslik: "💬 Serbest Sohbet",
    aciklama: "İngilizce sohbet ederek pratik yap!",
    ilkMesaj:
      "Hey! How are you doing today? Tell me about your day!",
  },
];

// --------------------------------------------------
// 3. ANA UYGULAMA
// --------------------------------------------------

export default function App() {

  const [seciliMod, setSeciliMod] = useState(MODLAR[0]);

  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "ai",
      text: MODLAR[0].ilkMesaj,
      audioB64: null,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState("Practice");
  const [errorText, setErrorText] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const flatListRef = useRef(null);

  // --------------------------------------------------
  // 4. SESİ DURDUR
  // --------------------------------------------------

  const sesiDurdur = () => {

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setSpeaking(false);
  };

  // --------------------------------------------------
  // 5. YAPAY ZEKA SESİNİ ÇAL
  // --------------------------------------------------

  const base64SesCal = async (audioB64) => {

    if (!audioB64) return;

    sesiDurdur();

    try {

      const audio = new Audio(
        `data:audio/mpeg;base64,${audioB64}`
      );

      audioRef.current = audio;

      audio.onended = () => {
        setSpeaking(false);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setSpeaking(false);
        audioRef.current = null;
      };

      setSpeaking(true);

      await audio.play();

    } catch (error) {

      console.error("Ses oynatma hatası:", error);
      setSpeaking(false);
    }
  };

  // --------------------------------------------------
  // 6. MOD DEĞİŞTİRME
  // --------------------------------------------------

  const modDegistir = (mod) => {

    if (loading || recording) return;

    sesiDurdur();

    setSeciliMod(mod);
    setErrorText("");

    setMessages([
      {
        id: Date.now().toString(),
        sender: "ai",
        text: mod.ilkMesaj,
        audioB64: null,
      },
    ]);
  };

  // --------------------------------------------------
  // 7. MİKROFONU AÇ / KAPAT
  // --------------------------------------------------

  const toggleRecording = async () => {

    if (loading) return;

    if (recording) {

      setRecording(false);

      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }

      return;
    }

    sesiDurdur();
    setErrorText("");

    try {

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Tarayıcınız mikrofon kullanımını desteklemiyor."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {

        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {

        stream.getTracks().forEach((track) => {
          track.stop();
        });

        const audioBlob = new Blob(
          audioChunksRef.current,
          { type: mediaRecorder.mimeType || "audio/webm" }
        );

        if (audioBlob.size > 0) {
          await sendAudioToServer(audioBlob);
        }
      };

      mediaRecorder.start();

      setRecording(true);

    } catch (error) {

      console.error(error);

      setErrorText(
        "Mikrofon açılamadı. Tarayıcıdan mikrofon izni vermelisin."
      );
    }
  };

  // --------------------------------------------------
  // 8. SESİ SUNUCUYA GÖNDER
  // --------------------------------------------------

  const sendAudioToServer = async (audioBlob) => {

    setLoading(true);
    setErrorText("");

    try {

      const formData = new FormData();

      formData.append(
        "file",
        audioBlob,
        "kayit.webm"
      );

      formData.append("mode", seciliMod.id);

      // Her kullanıcının her modu ayrı hafızaya sahip.
      formData.append(
        "session_id",
        `${SESSION_ID}-${seciliMod.id}`
      );

      const response = await fetch(
        `${BACKEND_URL}/sesli-sohbet`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {

        const hata = await response.json();

        throw new Error(
          hata.detail || `Sunucu hatası: ${response.status}`
        );
      }

      const data = await response.json();

      // Kullanıcı mesajı
      const userMessage = {
        id: `${Date.now()}-user`,
        sender: "user",
        text: `🎙️ ${data.user_text}`,
      };

      // Yapay zeka mesajı
      const aiMessage = {
        id: `${Date.now()}-ai`,
        sender: "ai",
        text: data.reply,
        audioB64: data.audio_b64,
      };

      setMessages((current) => [
        ...current,
        userMessage,
        aiMessage,
      ]);

      // Ses oluşturulmuşsa otomatik oynat.
      if (data.audio_b64) {
        await base64SesCal(data.audio_b64);
      }

    } catch (error) {

      console.error("Sunucu bağlantı hatası:", error);

      setErrorText(error.message);

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          sender: "ai",
          text: `Bağlantıda bir sorun oluştu: ${error.message}`,
        },
      ]);

    } finally {

      setLoading(false);
    }
  };

  // --------------------------------------------------
  // 9. YENİ MESAJ GELİNCE AŞAĞI KAYDIR
  // --------------------------------------------------

  useEffect(() => {

    if (messages.length > 0) {

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);

    }

  }, [messages, loading]);

  // --------------------------------------------------
  // 10. MESAJ TASARIMI
  // --------------------------------------------------

  const renderMessage = ({ item }) => (

    <TouchableOpacity
      disabled={
        item.sender !== "ai" || !item.audioB64
      }
      onPress={() => base64SesCal(item.audioB64)}
      style={[
        styles.messageBubble,
        item.sender === "user"
          ? styles.userMessage
          : styles.aiMessage,
      ]}
    >

      <Text
        style={[
          styles.messageText,
          item.sender === "user" &&
            styles.userMessageText,
        ]}
      >
        {item.text}
      </Text>

      {item.audioB64 && (
        <Text style={styles.playText}>
          🔊 Tekrar dinle
        </Text>
      )}

    </TouchableOpacity>
  );

  // --------------------------------------------------
  // 11. EKRAN
  // --------------------------------------------------

  return (

    <SafeAreaView style={styles.safeArea}>

      <View style={styles.container}>

        {/* HEADER */}

        <View style={styles.header}>

          <View>
            <Text style={styles.logo}>
              RoastLing
            </Text>

            <Text style={styles.subtitle}>
              Your Personal AI English Coach
            </Text>
          </View>

          <View style={styles.streak}>
            <Text style={styles.streakIcon}>
              🔥
            </Text>

            <Text style={styles.streakText}>
              Let's Learn
            </Text>
          </View>

        </View>

        {/* MODLAR */}

        <View style={styles.modeWrapper}>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >

            {MODLAR.map((mod) => {

              const aktif =
                mod.id === seciliMod.id;

              return (

                <TouchableOpacity
                  key={mod.id}
                  onPress={() => modDegistir(mod)}
                  disabled={loading || recording}
                  style={[
                    styles.modeChip,
                    aktif && styles.modeChipActive,
                  ]}
                >

                  <Text
                    style={[
                      styles.modeChipText,
                      aktif && styles.modeChipTextActive,
                    ]}
                  >
                    {mod.baslik}
                  </Text>

                </TouchableOpacity>
              );

            })}

          </ScrollView>

        </View>

        {/* DURUM KARTI */}

        <View
          style={[
            styles.progressCard,
            speaking && styles.speakingCard,
            recording && styles.recordingCard,
          ]}
        >

          <View>

            <Text style={styles.progressTitle}>

              {speaking
                ? "🗣️ RoastLing Konuşuyor"
                : recording
                ? "🎙️ Seni Dinliyorum"
                : loading
                ? "🧠 Cevabını Hazırlıyorum"
                : seciliMod.baslik}

            </Text>

            <Text style={styles.progressSubtitle}>

              {speaking
                ? "İngilizce telaffuzunu dinle!"
                : recording
                ? "Cümleni bitirince tekrar bas."
                : loading
                ? "Birazdan seninleyim!"
                : seciliMod.aciklama}

            </Text>

          </View>

          <Text style={styles.avatarEmoji}>
            {speaking
              ? "😂"
              : recording
              ? "👂"
              : loading
              ? "🤔"
              : "😎"}
          </Text>

        </View>

        {/* SOHBET */}

        <View style={styles.chatCard}>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatContent}
          />

          {loading && (

            <View style={styles.loadingRow}>

              <ActivityIndicator
                size="small"
                color="#5C50D8"
              />

              <Text style={styles.loadingText}>
                RoastLing düşünüyor...
              </Text>

            </View>

          )}

        </View>

        {/* HATA MESAJI */}

        {!!errorText && (

          <Text style={styles.errorText}>
            ⚠️ {errorText}
          </Text>

        )}

        {/* MİKROFON */}

        <TouchableOpacity
          style={[
            styles.micButton,
            recording && styles.micButtonRecording,
            loading && styles.disabledButton,
          ]}
          onPress={toggleRecording}
          disabled={loading}
        >

          <Text style={styles.micIcon}>
            {recording ? "⏹️" : "🎙️"}
          </Text>

          <Text style={styles.micText}>

            {loading
              ? "Please Wait..."
              : recording
              ? "Bitince Tekrar Bas"
              : "Tap to Speak"}

          </Text>

        </TouchableOpacity>

        {/* SESİ DURDUR */}

        {speaking && (

          <TouchableOpacity
            style={styles.stopButton}
            onPress={sesiDurdur}
          >

            <Text style={styles.stopButtonText}>
              🔇 Sesi Durdur
            </Text>

          </TouchableOpacity>

        )}

        {/* ALT MENÜ */}

        <View style={styles.bottomNav}>

          <NavItem
            icon="💬"
            label="Practice"
            active={activeTab === "Practice"}
            onPress={() => setActiveTab("Practice")}
          />

          <NavItem
            icon="📚"
            label="Lessons"
            active={activeTab === "Lessons"}
            onPress={() => setActiveTab("Lessons")}
          />

          <NavItem
            icon="📈"
            label="Progress"
            active={activeTab === "Progress"}
            onPress={() => setActiveTab("Progress")}
          />

          <NavItem
            icon="👤"
            label="Profile"
            active={activeTab === "Profile"}
            onPress={() => setActiveTab("Profile")}
          />

        </View>

      </View>

    </SafeAreaView>
  );
}

// --------------------------------------------------
// 12. ALT MENÜ BİLEŞENİ
// --------------------------------------------------

function NavItem({ icon, label, active, onPress }) {

  return (

    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
    >

      <Text
        style={[
          styles.navIcon,
          active && styles.activeNavIcon,
        ]}
      >
        {icon}
      </Text>

      <Text
        style={[
          styles.navLabel,
          active && styles.activeNavLabel,
        ]}
      >
        {label}
      </Text>

    </TouchableOpacity>
  );
}

// --------------------------------------------------
// 13. TASARIM
// --------------------------------------------------

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FC",
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 15,
  },

  logo: {
    fontSize: 29,
    fontWeight: "800",
    color: "#24213A",
  },

  subtitle: {
    color: "#8A8FA3",
    fontSize: 12,
    marginTop: 3,
  },

  streak: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF0D8",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  streakIcon: {
    fontSize: 16,
    marginRight: 5,
  },

  streakText: {
    color: "#A96719",
    fontWeight: "700",
    fontSize: 12,
  },

  modeWrapper: {
    marginBottom: 14,
    height: 40,
  },

  modeChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7F0",
  },

  modeChipActive: {
    backgroundColor: "#24213A",
    borderColor: "#24213A",
  },

  modeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4A4D65",
  },

  modeChipTextActive: {
    color: "#FFFFFF",
  },

  progressCard: {
    backgroundColor: "#5C50D8",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  speakingCard: {
    backgroundColor: "#28B66B",
  },

  recordingCard: {
    backgroundColor: "#E11D48",
  },

  progressTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  progressSubtitle: {
    color: "#E8E6FF",
    fontSize: 12,
    marginTop: 5,
    maxWidth: 240,
  },

  avatarEmoji: {
    fontSize: 34,
  },

  chatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    shadowColor: "#222",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  chatContent: {
    paddingVertical: 5,
    flexGrow: 1,
  },

  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 17,
    marginBottom: 10,
  },

  aiMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#F0F0FF",
    borderBottomLeftRadius: 5,
  },

  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#5C50D8",
    borderBottomRightRadius: 5,
  },

  messageText: {
    color: "#34344A",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },

  userMessageText: {
    color: "#FFFFFF",
  },

  playText: {
    color: "#7770CE",
    fontSize: 11,
    marginTop: 8,
    fontWeight: "700",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  loadingText: {
    marginLeft: 8,
    color: "#5C50D8",
    fontSize: 13,
    fontWeight: "600",
  },

  errorText: {
    color: "#D92D45",
    fontSize: 12,
    paddingVertical: 5,
  },

  micButton: {
    backgroundColor: "#24213A",
    height: 58,
    borderRadius: 18,
    marginVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  micButtonRecording: {
    backgroundColor: "#E11D48",
  },

  disabledButton: {
    opacity: 0.6,
  },

  micIcon: {
    fontSize: 20,
    marginRight: 9,
  },

  micText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  stopButton: {
    alignItems: "center",
    paddingBottom: 10,
  },

  stopButtonText: {
    color: "#E11D48",
    fontSize: 12,
    fontWeight: "700",
  },

  bottomNav: {
    height: 64,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
  },

  navIcon: {
    fontSize: 20,
    opacity: 0.45,
  },

  activeNavIcon: {
    opacity: 1,
  },

  navLabel: {
    fontSize: 10,
    color: "#999DAE",
    marginTop: 4,
  },

  activeNavLabel: {
    color: "#5C50D8",
    fontWeight: "700",
  },

});
