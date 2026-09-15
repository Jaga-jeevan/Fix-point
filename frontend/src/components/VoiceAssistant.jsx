import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  processVoiceMessage,
  processVoiceAudio,
  confirmVoiceAction,
  parseVoiceRepairParagraph,
  submitVoiceRepairRequest,
} from "../services/voiceService";
import { getErrorMessage } from "../services/api";

// Helper to encode raw PCM Float32 samples into standard 16-bit PCM WAV Blob
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /* RIFF identifier */
  writeString(0, "RIFF");
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(8, "WAVE");
  /* format chunk identifier */
  writeString(12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (1 for mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 2) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(36, "data");
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

function parseSpokenFieldMentions(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  const fields = {};

  // 1. Device / Category mention e.g. "device mobile", "category laptop"
  const devMatch = lower.match(/\b(?:device|device type|category)\s+([a-z0-9\s]+?)(?:\s+(?:brand|model|problem|issue|date|time|address)|$)/i);
  if (devMatch) {
    const rawDev = devMatch[1].trim().toLowerCase();
    if (rawDev.includes("laptop")) fields.device_type = "Laptop";
    else if (rawDev.includes("desktop") || rawDev.includes("computer")) fields.device_type = "Desktop";
    else if (rawDev.includes("tablet") || rawDev.includes("ipad")) fields.device_type = "Tablet";
    else if (rawDev.includes("tv") || rawDev.includes("television")) fields.device_type = "TV";
    else if (rawDev.includes("other")) fields.device_type = "Other";
    else fields.device_type = "Mobile";
  }

  // 2. Brand mention e.g. "brand redmi", "brand samsung"
  const brandMatch = lower.match(/\b(?:brand|company|make)\s+([a-z0-9\s\-]+?)(?:\s+(?:model|problem|issue|date|time|address|device)|$)/i);
  if (brandMatch) {
    fields.brand = brandMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // 3. Model mention e.g. "model 14", "model galaxy s21"
  const modelMatch = lower.match(/\b(?:model|model number|model name)\s+([a-z0-9\s\-]+?)(?:\s+(?:problem|issue|date|time|address|brand|device)|$)/i);
  if (modelMatch) {
    fields.model = modelMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // 4. Problem / Issue mention e.g. "problem display cracked", "issue heating"
  const probMatch = lower.match(/\b(?:problem|issue|description|defect)\s+(.+?)(?:\s+(?:address|location|date|time|brand|model|device)|$)/i);
  if (probMatch) {
    fields.problem_description = probMatch[1].trim();
  }

  // 5. Date mention e.g. "date tomorrow", "preferred date 2026-09-20"
  const dateMatch = lower.match(/\b(?:date|preferred date|visit date)\s+([a-z0-9\s\-/.]+?)(?:\s+(?:time|problem|issue|address|brand|model|device)|$)/i);
  if (dateMatch) {
    fields.preferred_date = dateMatch[1].trim();
  }

  // 6. Time mention e.g. "time 10 am", "visit time 2 pm"
  const timeMatch = lower.match(/\b(?:time|preferred time|visit time|slot)\s+([0-9]{1,2}(?:[\s:]?[0-9]{2})?\s*(?:am|pm)?|[a-z\s]+)(?:\s+(?:date|problem|issue|address|brand|model|device)|$)/i);
  if (timeMatch) {
    fields.preferred_time = timeMatch[1].trim();
  }

  // 7. Address mention e.g. "address 123 main st", "location anna nagar"
  const addrMatch = lower.match(/\b(?:address|location|place|visit address)\s+(.+?)(?:\s+(?:date|time|problem|issue|brand|model|device)|$)/i);
  if (addrMatch) {
    fields.address = addrMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

function cleanTamilFromText(text) {
  if (!text) return "";
  let s = text;
  const mappings = [
    [/(?:ஓகே|ஒகே|ஓகேயா|சரி|சரியா)/g, "okay"],
    [/(?:ஆம்|ஆமா|ஆமாம்|கண்டிப்பா)/g, "yes"],
    [/(?:வேண்டாம்|இல்லை|இல்ல)/g, "no"],
    [/(?:நன்றி)/g, "thank you"],
    [/(?:வணக்கம்|ஹலோ)/g, "hello"],
    [/(?:ரத்து)/g, "cancel"],
    [/(?:முடி|முடிந்தது)/g, "complete"],
  ];
  for (const [pattern, replacement] of mappings) {
    s = s.replace(pattern, replacement);
  }
  const stripped = s.replace(/[\u0B80-\u0BFF]+/g, "").replace(/\s+/g, " ").trim();
  return stripped || "okay";
}

export default function VoiceAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  // Assistant UI States: 'idle' | 'listening' | 'processing' | 'review' | 'editing' | 'submitted' | 'speaking'
  const [state, setState] = useState("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [interimText, setInterimText] = useState("");
  const [textInput, setTextInput] = useState("");
  const [errorBanner, setErrorBanner] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  // Voice Repair Creation State
  const [extractedData, setExtractedData] = useState(null);
  const [editForm, setEditForm] = useState({
    device_type: "Mobile",
    brand: "",
    model: "",
    problem_description: "",
    preferred_date: "",
    preferred_time: "10:00 AM",
    address: "",
    original_transcript: "",
  });
  const [pendingFollowupData, setPendingFollowupData] = useState(null);
  const [submittedRepairId, setSubmittedRepairId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Multi-turn context & conversation history
  const [context, setContext] = useState({});
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "assistant",
      text:
        user?.role === "CUSTOMER"
          ? `Hello ${user.name?.split(" ")[0] || "there"}! I'm your FixPoint voice assistant. Press the microphone and describe your repair request naturally, or ask any repair question.`
          : user?.role === "TECHNICIAN"
          ? `Hello ${user.name?.split(" ")[0] || "Technician"}! Ready for tasks. Ask for pending jobs, start travel, complete a job, or verify OTP.`
          : `Hello Admin! Ask me for system statistics, pending repair requests, or active technicians.`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  // Audio recording & Speech recognition refs
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const webSpeechResultRef = useRef("");
  const silenceTimerRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis || null);
  const messagesEndRef = useRef(null);
  const requestInProgressRef = useRef(false);
  const hasProcessedCurrentSpeechRef = useRef(false);
  const recordingStartTimeRef = useRef(0);
  const vadIntervalRef = useRef(null);
  const lastSpeechTimeRef = useRef(0);
  const hasSpokenRef = useRef(false);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, interimText, isOpen, state]);

  // Broadcast state changes to top navbar / header button
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("voice-assistant-state-change", {
        detail: { state, isOpen },
      })
    );
  }, [state, isOpen]);

  // Listen for trigger events from header button
  useEffect(() => {
    const handleToggle = () => {
      if (!isOpen) {
        setIsOpen(true);
        startRecording();
      } else {
        toggleListening();
      }
    };
    window.addEventListener("toggle-voice-assistant", handleToggle);
    return () => window.removeEventListener("toggle-voice-assistant", handleToggle);
  }, [isOpen, state]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Stop active microphone recording & audio context
  const cleanupAudio = () => {
    isRecordingRef.current = false;
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {}
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
  };

  // Text-To-Speech function
  const speakResponse = (text) => {
    if (!text || isMuted || !synthRef.current) {
      setState((prev) => (["review", "editing", "submitted"].includes(prev) ? prev : "idle"));
      return;
    }

    try {
      synthRef.current.cancel();

      const cleanText = cleanTamilFromText(text.replace(/[*_#`~[\]()]/g, ""));
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = speechRate;
      utterance.pitch = 1.0;

      const targetLangCode = "en-IN";
      const voices = synthRef.current.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang === targetLangCode) ||
        voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("natural")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        null;

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.lang = targetLangCode;

      let started = false;
      utterance.onstart = () => {
        started = true;
        setState((prev) => (["review", "editing", "submitted"].includes(prev) ? prev : "speaking"));
      };

      utterance.onend = () => {
        setState((prev) => (prev === "speaking" ? "idle" : prev));
      };

      utterance.onerror = () => {
        setState((prev) => (["review", "editing", "submitted"].includes(prev) ? prev : "idle"));
      };

      setTimeout(() => {
        if (synthRef.current) {
          synthRef.current.speak(utterance);
        }
      }, 100);

      // Fallback timer: if browser TTS onstart does not fire within 400ms, reset state to idle
      setTimeout(() => {
        if (!started) {
          setState((prev) => (prev === "processing" || prev === "speaking" ? "idle" : prev));
        }
      }, 400);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
      setState((prev) => (["review", "editing", "submitted"].includes(prev) ? prev : "idle"));
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setState((prev) => (prev === "speaking" ? "idle" : prev));
  };

  // START RECORDING
  const startRecording = async () => {
    if (isRecordingRef.current || requestInProgressRef.current) return;

    cleanupAudio();
    stopSpeaking();
    setErrorBanner("");
    setInterimText("");
    webSpeechResultRef.current = "";
    audioChunksRef.current = [];
    hasProcessedCurrentSpeechRef.current = false;
    recordingStartTimeRef.current = Date.now();
    lastSpeechTimeRef.current = Date.now();
    hasSpokenRef.current = false;

    // Start silence detection VAD interval (Auto-off after 2 seconds of no voice)
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
    }
    vadIntervalRef.current = setInterval(() => {
      if (!isRecordingRef.current || hasProcessedCurrentSpeechRef.current) return;
      const silenceDuration = Date.now() - lastSpeechTimeRef.current;
      if (silenceDuration >= 2000) {
        console.log("[VAD] Auto-stopping: 2 seconds of no voice detected.");
        hasProcessedCurrentSpeechRef.current = true;
        stopRecording();
      }
    }, 250);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      isRecordingRef.current = true;
      setState("listening");

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData.length);
        chunk.set(inputData);
        audioChunksRef.current.push(chunk);

        let sum = 0;
        for (let i = 0; i < inputData.length; i += 8) {
          sum += Math.abs(inputData[i]);
        }
        const avg = sum / (inputData.length / 8);
        setAudioLevel(Math.min(100, Math.round(avg * 400)));

        if (avg >= 0.003) {
          hasSpokenRef.current = true;
          lastSpeechTimeRef.current = Date.now();
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-IN";

          recognition.onresult = (event) => {
            let currentInterim = "";
            let finalTranscript = "";

            for (let i = 0; i < event.results.length; ++i) {
              const resItem = event.results[i];
              if (resItem && resItem[0] && typeof resItem[0].transcript === "string") {
                const textChunk = resItem[0].transcript;
                if (resItem.isFinal) {
                  finalTranscript += textChunk + " ";
                } else {
                  currentInterim += textChunk;
                }
              }
            }

            const combined = (finalTranscript + currentInterim).trim();
            if (combined) {
              hasSpokenRef.current = true;
              lastSpeechTimeRef.current = Date.now();
              setInterimText(combined);
              setTextInput(combined);
              webSpeechResultRef.current = combined;
            }
          };

          recognition.onerror = (event) => {
            console.log("[WebSpeechAPI] Note:", event.error);
          };

          recognition.onend = () => {
            if (!isRecordingRef.current || hasProcessedCurrentSpeechRef.current) return;
            const elapsed = Date.now() - recordingStartTimeRef.current;
            if (elapsed < 20000 && isRecordingRef.current) {
              try {
                recognition.start();
              } catch (e) {}
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (err) {
          console.log("[WebSpeechAPI] Start note:", err);
        }
      }

      silenceTimerRef.current = setTimeout(() => {
        if (isRecordingRef.current && !hasProcessedCurrentSpeechRef.current) {
          stopRecording();
        }
      }, 25000);

    } catch (err) {
      console.warn("Microphone access error:", err);
      cleanupAudio();
      setState("idle");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorBanner("Microphone permission was denied. Please allow microphone access in your browser settings.");
      } else {
        setErrorBanner("Could not access microphone: " + (err.message || "Unknown device error"));
      }
    }
  };

  // STOP RECORDING AND PROCESS SPEECH
  const stopRecording = async () => {
    if (requestInProgressRef.current) return;
    if (!isRecordingRef.current && state !== "listening") return;

    isRecordingRef.current = false;
    hasProcessedCurrentSpeechRef.current = true;

    const chunks = audioChunksRef.current;
    const sampleRate = audioContextRef.current ? audioContextRef.current.sampleRate : 16000;
    const fastTranscript = (webSpeechResultRef.current || interimText || textInput || "").trim();

    cleanupAudio();
    setAudioLevel(0);

    // If Web Speech API gave a transcript
    if (fastTranscript && fastTranscript.length > 0) {
      setInterimText("");
      handleUserQuery(fastTranscript);
      return;
    }

    // Check if audio was spoken
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }

    if (totalLength < sampleRate * 0.1) {
      setState("idle");
      setInterimText("");
      const botMsgText = "I didn't hear anything. Please tap the microphone and describe your repair issue.";
      setErrorBanner(botMsgText);
      speakResponse(botMsgText);
      return;
    }

    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBlob = encodeWAV(mergedSamples, sampleRate);
    processVoiceAudioFallback(wavBlob);
  };

  const processVoiceAudioFallback = async (wavBlob) => {
    if (requestInProgressRef.current) return;
    requestInProgressRef.current = true;
    setState("processing");

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        text: m.text,
      }));

      const res = await processVoiceAudio(wavBlob, context, historyPayload);
      const userText = (res.transcript || "").trim();
      setInterimText("");

      if (!userText) {
        const botMsgText = "I couldn't clearly understand your repair details. Please try speaking again and mention the device, model, and problem.";
        setErrorBanner(botMsgText);
        speakResponse(botMsgText);
        setState("idle");
        return;
      }

      requestInProgressRef.current = false;
      handleUserQuery(userText);
    } catch (err) {
      console.error("Audio processing error:", err);
      const botMsgText = "I couldn't clearly understand your repair details. Please try speaking again and mention the device, model, and problem.";
      setErrorBanner(botMsgText);
      speakResponse(botMsgText);
      setState("idle");
    } finally {
      requestInProgressRef.current = false;
    }
  };

  const isRepairDescriptionQuery = (text) => {
    if (pendingFollowupData) return true;
    if (user?.role !== "CUSTOMER") return false;
    const lower = text ? text.toLowerCase().trim() : "";
    if (["clear all", "clear form", "reset form", "reset all", "clear fields", "reset fields", "clear details", "erase all", "start over"].some(cmd => lower === cmd || lower.includes("clear all") || lower.includes("reset form") || lower.includes("clear form") || lower.includes("reset all") || lower.includes("clear fields"))) {
      return false;
    }

    // Direct navigation commands are NOT repair descriptions
    const navTriggers = ["go to", "goto", "go", "open", "navigate to", "navigate", "show me", "take me to", "view"];
    if (navTriggers.some((trig) => lower === trig || lower.startsWith(trig + " ") || lower.startsWith(trig))) {
      return false;
    }
    if (["my repair", "my repairs", "repairs", "new repair", "new repair request", "create repair", "dashboard", "home"].includes(lower)) {
      return false;
    }

    const repairKeywords = [
      "repair", "fix", "screen", "display", "mobile", "phone", "tv", "laptop", "desktop",
      "cracked", "broken", "heated", "heating", "battery", "charging", "speaker", "sound",
      "redmi", "samsung", "dell", "sony", "apple", "lg", "hp", "lenovo", "xiaomi", "realme", "asus",
      "inspect", "estimate", "service", "want to repair", "need to repair", "have a", "device", "model"
    ];
    return repairKeywords.some((kw) => lower.includes(kw));
  };

  const handleRepairParagraph = async (queryText) => {
    try {
      const rawText = queryText.trim();
      let textToParse = rawText;
      if (pendingFollowupData && pendingFollowupData.original_text) {
        textToParse = `${pendingFollowupData.original_text} ${rawText}`;
      }

      const res = await parseVoiceRepairParagraph(textToParse);

      if (res.needs_followup && res.followup_question) {
        setPendingFollowupData(res.extracted);
        const botMsg = {
          id: "a-" + Date.now(),
          sender: "assistant",
          text: res.followup_question,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
        speakResponse(res.followup_question);
        setState("idle");
        return;
      }

      setPendingFollowupData(null);
      const extracted = res.extracted || {};
      setExtractedData(extracted);

      const defaultDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const formFields = {
        device_type: extracted.device_type || "Mobile",
        brand: extracted.brand || "",
        model: extracted.model || "",
        problem_description: extracted.issue
          ? `${extracted.issue}${extracted.additional_details ? " " + extracted.additional_details : ""}`
          : extracted.original_text,
        preferred_date: extracted.preferred_date || defaultDate,
        preferred_time: extracted.preferred_time || "10:00 AM",
        address: user?.address || extracted.address || "",
        original_transcript: extracted.original_text,
      };

      setEditForm(formFields);

      // Save to sessionStorage and dispatch custom event to prefill CreateRepair form directly
      sessionStorage.setItem("pending_voice_form_fields", JSON.stringify(formFields));
      window.dispatchEvent(new CustomEvent("voice-fill-repair-form", { detail: formFields }));

      const route = "/customer/repairs/new";
      if (location.pathname !== route) {
        navigate(route);
      }

      const botMsgText = "I've entered your repair details into the form. Please review the details on screen and click submit when ready.";
      const botMsg = {
        id: "a-" + Date.now(),
        sender: "assistant",
        text: botMsgText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setState("idle");
      speakResponse(botMsgText);
    } catch (err) {
      console.error("Error parsing repair paragraph:", err);
      const errorMsg = "I couldn't clearly understand your repair details. Please try speaking again and mention the device, model, and problem.";
      setErrorBanner(errorMsg);
      speakResponse(errorMsg);
      setState("idle");
    } finally {
      requestInProgressRef.current = false;
    }
  };

  const handleConfirmSubmitRepair = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await submitVoiceRepairRequest(editForm);
      if (res.success && res.repair_id) {
        setSubmittedRepairId(res.repair_id);
        setState("submitted");

        const botMsg = {
          id: "a-" + Date.now(),
          sender: "assistant",
          text: `✓ Repair Request Submitted Successfully (Request ID #${res.repair_id})`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
        speakResponse(`Your repair request number ${res.repair_id} has been submitted successfully.`);
      } else {
        const errorText = res.message || "Failed to submit repair request.";
        setErrorBanner(errorText);
        const botMsg = {
          id: "err-" + Date.now(),
          sender: "assistant",
          text: errorText,
          isError: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
        speakResponse(errorText);
        setState("idle");
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setErrorBanner(errorMsg);
      const botMsg = {
        id: "err-" + Date.now(),
        sender: "assistant",
        text: `Submission failed: ${errorMsg}`,
        isError: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      speakResponse(`Submission failed: ${errorMsg}`);
      setState("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookRepair = () => {
    const route = "/customer/repairs/new";
    if (location.pathname !== route) {
      navigate(route);
    }
  };

  const toggleListening = () => {
    if (state === "speaking") {
      stopSpeaking();
    }

    if (state === "listening" || isRecordingRef.current) {
      stopRecording();
    } else {
      setIsOpen(true);
      startRecording();
    }
  };

  const handleUserQuery = async (queryText) => {
    const rawText = (queryText || "").strip ? queryText.strip() : (queryText || "").trim();
    if (!rawText) return;
    if (requestInProgressRef.current) return;

    requestInProgressRef.current = true;
    setState("processing");
    setTextInput("");
    setInterimText("");

    const displayUserText = cleanTamilFromText(rawText.replace(/\bfree\s*fire\b/gi, "").trim());

    if (displayUserText) {
      const userMsg = {
        id: "u-" + Date.now(),
        sender: "user",
        text: displayUserText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    // Check if user issued a CLEAR / RESET command
    const lowerDisplay = displayUserText.toLowerCase().trim();
    const isClearCmd = [
      "clear all", "clear form", "reset form", "reset all", "clear fields",
      "reset fields", "clear details", "erase all", "erase form", "start over", "clear"
    ].some((cmd) => lowerDisplay === cmd || lowerDisplay.includes("clear all") || lowerDisplay.includes("reset form") || lowerDisplay.includes("clear form") || lowerDisplay.includes("reset all") || lowerDisplay.includes("clear fields"));

    if (isClearCmd) {
      sessionStorage.removeItem("pending_voice_form_fields");
      window.dispatchEvent(new CustomEvent("voice-clear-repair-form"));
      setPendingFollowupData(null);
      setExtractedData(null);

      const clearMsgText = "I have cleared all fields in your repair request form.";
      const assistantMsg = {
        id: "a-" + Date.now(),
        sender: "assistant",
        text: clearMsgText,
        intent: "CLEAR_FORM",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setState("idle");
      speakResponse(clearMsgText);
      requestInProgressRef.current = false;
      return;
    }

    // Check if user issued a SUBMIT command
    const isSubmitCmd = [
      "submit", "submit request", "submit the request", "submit my request",
      "submit repair", "submit my repair", "submit my repair request",
      "submit form", "confirm submit", "confirm repair", "send request",
      "submit the form", "submit new request"
    ].some((cmd) => lowerDisplay === cmd || lowerDisplay.includes("submit request") || lowerDisplay.includes("submit the request") || lowerDisplay.includes("submit repair"));

    if (isSubmitCmd && user?.role === "CUSTOMER") {
      window.dispatchEvent(new CustomEvent("voice-submit-repair-form"));
      if (editForm && editForm.brand && editForm.model && location.pathname !== "/customer/repairs/new") {
        requestInProgressRef.current = false;
        await handleConfirmSubmitRepair();
        return;
      }
    }

    // Check if individual field names were mentioned e.g. "Brand Redmi", "Model 14", "Date tomorrow"
    const fieldMentions = parseSpokenFieldMentions(displayUserText);
    if (fieldMentions && user?.role === "CUSTOMER") {
      sessionStorage.setItem("pending_voice_form_fields", JSON.stringify(fieldMentions));
      window.dispatchEvent(new CustomEvent("voice-fill-repair-form", { detail: fieldMentions }));

      const route = "/customer/repairs/new";
      if (location.pathname !== route) {
        navigate(route);
      }

      const updatedNames = Object.keys(fieldMentions).map((k) => k.replace("_", " ")).join(", ");
      const botMsgText = `Entered ${updatedNames} into your repair request form. Please review on screen and click submit when ready.`;

      const assistantMsg = {
        id: "a-" + Date.now(),
        sender: "assistant",
        text: botMsgText,
        intent: "FILL_REPAIR_FORM",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setState("idle");
      speakResponse(botMsgText);
      requestInProgressRef.current = false;
      return;
    }

    // Direct Voice Navigation for All Roles (Customer, Technician, Admin)
    const lowerNav = displayUserText.toLowerCase().trim();
    const isDetailOrQueryWord = ["recent", "latest", "detail", "details", "status", "info", "otp", "track"].some((w) => lowerNav.includes(w));
    const isNavWord =
      !isDetailOrQueryWord &&
      (lowerNav === "go" ||
      lowerNav.startsWith("go to") ||
      lowerNav.startsWith("goto") ||
      lowerNav.startsWith("go ") ||
      lowerNav.startsWith("open ") ||
      lowerNav.startsWith("navigate to") ||
      lowerNav.startsWith("show ") ||
      lowerNav.startsWith("take me to") ||
      lowerNav.startsWith("view ") ||
      ["my repair", "my repairs", "repairs", "new repair", "new repair request", "create repair", "dashboard", "home"].includes(lowerNav));

    if (isNavWord) {
      const defaultDashboard = user?.role === "TECHNICIAN" ? "/technician/dashboard" : user?.role === "ADMIN" ? "/admin/dashboard" : "/customer/dashboard";
      const navRoutes = {
        // Customer routes
        "my repair": "/customer/repairs",
        "my repairs": "/customer/repairs",
        "repairs": "/customer/repairs",
        "repair list": "/customer/repairs",
        "all repairs": "/customer/repairs",
        "my repair requests": "/customer/repairs",
        "new repair": "/customer/repairs/new",
        "new repair request": "/customer/repairs/new",
        "create repair": "/customer/repairs/new",
        "create new repair": "/customer/repairs/new",
        "book repair": "/customer/repairs/new",
        "new request": "/customer/repairs/new",
        "customer dashboard": "/customer/dashboard",
        
        // General / Shared
        "dashboard": defaultDashboard,
        "home": defaultDashboard,
        "go": defaultDashboard,

        // Technician routes
        "jobs hub": "/technician/jobs",
        "jobs": "/technician/jobs",
        "available jobs": "/technician/jobs",
        "job progress": "/technician/progress",
        "progress": "/technician/progress",
        "my schedule": "/technician/schedule",
        "schedule": "/technician/schedule",
        "messages": "/technician/messages",
        "my profile": "/technician/profile",
        "profile": "/technician/profile",

        // Admin routes
        "requests": "/admin/requests",
        "repair requests": "/admin/requests",
        "technicians": "/admin/technicians",
        "customers": "/admin/customers",
      };

      const navTitles = {
        "/customer/repairs": "My Repairs",
        "/customer/repairs/new": "New Repair Request",
        "/customer/dashboard": "Customer Dashboard",
        "/technician/dashboard": "Technician Dashboard",
        "/technician/jobs": "Jobs Hub",
        "/technician/progress": "Job Progress",
        "/technician/messages": "Messages",
        "/technician/profile": "Technician Profile",
        "/admin/dashboard": "Admin Dashboard",
        "/admin/requests": "Repair Requests",
        "/admin/technicians": "Technicians",
        "/admin/customers": "Customers",
      };

      let matchedRoute = null;
      let matchedKw = "";

      for (const [kw, route] of Object.entries(navRoutes)) {
        if (
          lowerNav === kw ||
          lowerNav === `go to ${kw}` ||
          lowerNav === `go ${kw}` ||
          lowerNav === `open ${kw}` ||
          lowerNav === `navigate to ${kw}` ||
          lowerNav === `show ${kw}` ||
          lowerNav === `take me to ${kw}` ||
          lowerNav === `view ${kw}` ||
          lowerNav.startsWith(`go to ${kw}`) ||
          lowerNav.startsWith(`go ${kw}`) ||
          lowerNav.startsWith(`open ${kw}`) ||
          lowerNav.startsWith(`navigate to ${kw}`) ||
          lowerNav.startsWith(`show ${kw}`) ||
          lowerNav.startsWith(`take me to ${kw}`)
        ) {
          matchedRoute = route;
          matchedKw = kw;
          break;
        }
      }

      if (matchedRoute) {
        if (location.pathname !== matchedRoute) {
          navigate(matchedRoute);
        }
        const navTitle = navTitles[matchedRoute] || matchedKw.replace(/\b\w/g, (c) => c.toUpperCase());
        const navText = `Navigating to ${navTitle}.`;
        const assistantMsg = {
          id: "a-" + Date.now(),
          sender: "assistant",
          text: navText,
          intent: "NAVIGATE_PAGE",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setState("idle");
        speakResponse(navText);
        requestInProgressRef.current = false;
        return;
      }
    }

    // Route to Repair Paragraph Handler if describing a repair request
    if (user?.role === "CUSTOMER" && isRepairDescriptionQuery(displayUserText)) {
      requestInProgressRef.current = false;
      await handleRepairParagraph(displayUserText);
      return;
    }

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        text: m.text,
      }));

      const res = await processVoiceMessage(rawText, context, historyPayload);

      if (res.context) setContext(res.context);
      if (res.requires_confirmation && res.confirmation_data) {
        setPendingConfirmation(res.confirmation_data);
      } else {
        setPendingConfirmation(null);
      }

      if (res.intent === "CLEAR_FORM" || res.data?.action === "clear_form") {
        sessionStorage.removeItem("pending_voice_form_fields");
        window.dispatchEvent(new CustomEvent("voice-clear-repair-form"));
        setPendingFollowupData(null);
        setExtractedData(null);
      }

      if (res.data && res.data.form_fields) {
        const formFields = { ...res.data.form_fields };
        const isSubmitRequested = !!formFields.submit_form;
        delete formFields.submit_form;

        if (Object.keys(formFields).length > 0) {
          sessionStorage.setItem("pending_voice_form_fields", JSON.stringify(formFields));
          window.dispatchEvent(new CustomEvent("voice-fill-repair-form", { detail: formFields }));
        }

        if (isSubmitRequested) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("voice-submit-repair-form"));
          }, 150);
        }
      }

      let respText = res.response || "I processed your request.";
      if ((res.intent === "FILL_REPAIR_FORM" || res.intent === "CREATE_REPAIR_REQUEST") && !res.data?.form_fields?.submit_form) {
        if (!respText.includes("submit when ready") && !respText.includes("Submitting")) {
          respText = `${respText} Please review the details on screen and click submit when ready.`;
        }
      }

      const assistantMsg = {
        id: "a-" + Date.now(),
        sender: "assistant",
        text: respText,
        intent: res.intent,
        data: res.data,
        requiresConfirmation: res.requires_confirmation,
        confirmationData: res.confirmation_data,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setState("idle");
      speakResponse(respText);

      if (res.navigate_to && res.navigate_to !== location.pathname) {
        navigate(res.navigate_to);
      }
    } catch (err) {
      console.error("Voice processing error:", err);
      const errorMsg = getErrorMessage(err);
      const fallbackMsg = {
        id: "err-" + Date.now(),
        sender: "assistant",
        text: `Sorry, could not process voice request: ${errorMsg}`,
        isError: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setState("idle");
    } finally {
      requestInProgressRef.current = false;
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "welcome-reset",
        sender: "assistant",
        text: "Conversation cleared. How can I assist you?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setContext({});
    setPendingConfirmation(null);
    setExtractedData(null);
    setPendingFollowupData(null);
    setState("idle");
    stopSpeaking();
  };

  const roleSuggestions = {
    CUSTOMER: [
      { label: "🎙️ Describe Your Repair", action: "describe_repair", prompt: "I want to repair my Redmi 14 mobile phone. The screen is cracked and the display is not working properly." },
      { label: "📋 My Repairs", prompt: "Go to my repairs" },
      { label: "➕ New Repair Request", prompt: "Go to new repair request" },
      { label: "🏠 Dashboard", prompt: "Go to dashboard" },
      { label: "Show technician details", prompt: "Show technician details" },
      { label: "Show my quotation", prompt: "Show my quotation" },
      { label: "Payment status", prompt: "Show payment status" },
    ],
    TECHNICIAN: [
      { label: "🏠 Dashboard", prompt: "Go to dashboard" },
      { label: "💼 Jobs Hub", prompt: "Open jobs hub" },
      { label: "📊 Job Progress", prompt: "Open job progress" },
      { label: "📅 My Schedule", prompt: "Open my schedule" },
      { label: "💬 Messages", prompt: "Open messages" },
      { label: "👤 My Profile", prompt: "Open my profile" },
    ],
    ADMIN: [
      { label: "Today's statistics", prompt: "Show today's system statistics" },
      { label: "Active technicians", prompt: "How many technicians are active?" },
    ],
  };

  const suggestions = roleSuggestions[user?.role] || roleSuggestions.CUSTOMER;

  if (!user || !isOpen) return null;

  return (
    <div className="fixed top-16 right-4 sm:right-24 md:right-32 z-50 flex flex-col items-end font-sans">
      {/* POPOVER CONTAINER */}
      <div className="w-[92vw] sm:w-[380px] max-h-[460px] rounded-2xl bg-white border border-slate-200/90 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2">
        
        {/* HEADER BAR */}
        <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xs">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {state === "listening" && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold tracking-tight text-white flex items-center gap-1">
                {t("voice.assistant_title")}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                {state === "listening"
                  ? "🔴 Listening..."
                  : state === "processing"
                  ? "⏳ Understanding your repair request..."
                  : state === "review"
                  ? "📋 Review Your Repair Request"
                  : state === "editing"
                  ? "✏️ Edit Repair Request"
                  : state === "submitted"
                  ? "✓ Repair Request Submitted"
                  : state === "speaking"
                  ? t("voice.speaking")
                  : "🎙️ Tap to describe your repair"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`rounded-lg p-1 transition-colors ${isMuted ? "text-rose-400 bg-rose-500/10" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
              title={isMuted ? "Unmute Assistant" : "Mute Assistant"}
            >
              {isMuted ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleClearHistory}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Clear Conversation"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ml-0.5"
              title="Close Voice Assistant"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ERROR BANNER */}
        {errorBanner && (
          <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 text-rose-700 text-[11px] font-medium flex items-center justify-between">
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner("")} className="font-bold text-rose-800 text-xs ml-2">
              ×
            </button>
          </div>
        )}

        {/* STATE A: REVIEW REPAIR REQUEST CARD */}
        {state === "review" && extractedData && (
          <div className="p-4 bg-slate-50/60 overflow-y-auto max-h-[360px] space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  📋 Review Your Repair Request
                </h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-100/60 pb-1.5">
                  <span className="text-slate-400 font-medium">Device</span>
                  <span className="font-bold text-slate-900">
                    {extractedData.device_name || `${extractedData.brand} ${extractedData.model}`.trim() || "Not provided"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100/60 pb-1.5">
                  <span className="text-slate-400 font-medium">Category</span>
                  <span className="font-semibold text-slate-800">
                    {extractedData.category_label || extractedData.device_type || "Not provided"}
                  </span>
                </div>
                <div className="border-b border-slate-100/60 pb-1.5">
                  <span className="text-slate-400 font-medium block mb-0.5">Issue</span>
                  <span className="font-medium text-slate-800 block bg-slate-50 p-2 rounded-xl border border-slate-100">
                    {extractedData.issue || "Not provided"}
                  </span>
                </div>
                {extractedData.additional_details && (
                  <div className="border-b border-slate-100/60 pb-1.5">
                    <span className="text-slate-400 font-medium block mb-0.5">Additional Details</span>
                    <span className="text-slate-700 block bg-slate-50 p-2 rounded-xl border border-slate-100">
                      {extractedData.additional_details}
                    </span>
                  </div>
                )}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-medium block mb-0.5">Original Voice Request</span>
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-3">
                    "{extractedData.original_text}"
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setState("editing")}
                  className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                >
                  Edit Request
                </button>
                <button
                  onClick={handleConfirmSubmitRepair}
                  disabled={submitting}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors text-center"
                >
                  {submitting ? "Submitting..." : "Confirm & Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STATE B: EDIT REPAIR DETAILS FORM */}
        {state === "editing" && (
          <div className="p-4 bg-slate-50/60 overflow-y-auto max-h-[360px] space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  ✏️ Edit Repair Request Details
                </h4>
                <button onClick={() => setState("review")} className="text-[11px] text-blue-600 font-semibold hover:underline">
                  Back to Review
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Device Category</label>
                  <select
                    value={editForm.device_type}
                    onChange={(e) => setEditForm({ ...editForm, device_type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-800 bg-slate-50"
                  >
                    <option value="Mobile">Mobile Phone</option>
                    <option value="Laptop">Laptop Computer</option>
                    <option value="Desktop">Desktop PC</option>
                    <option value="Tablet">Tablet</option>
                    <option value="TV">Television (TV)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Brand</label>
                    <input
                      type="text"
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      placeholder="e.g. Redmi"
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-800 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Model</label>
                    <input
                      type="text"
                      value={editForm.model}
                      onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                      placeholder="e.g. Redmi 14"
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-800 bg-slate-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Issue / Problem Description</label>
                  <textarea
                    rows={2}
                    value={editForm.problem_description}
                    onChange={(e) => setEditForm({ ...editForm, problem_description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-800 bg-slate-50 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Preferred Visit Date</label>
                    <input
                      type="date"
                      value={editForm.preferred_date}
                      onChange={(e) => setEditForm({ ...editForm, preferred_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-800 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Preferred Time</label>
                    <input
                      type="text"
                      value={editForm.preferred_time}
                      onChange={(e) => setEditForm({ ...editForm, preferred_time: e.target.value })}
                      placeholder="10:00 AM"
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-800 bg-slate-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Visit Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Enter technician visit address"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-800 bg-slate-50"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block mb-0.5">Original Voice Request</span>
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                    "{editForm.original_transcript}"
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setState("review")}
                  className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                >
                  Save & Review
                </button>
                <button
                  onClick={handleConfirmSubmitRepair}
                  disabled={submitting}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors text-center"
                >
                  {submitting ? "Submitting..." : "Confirm & Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STATE C: SUBMITTED SUCCESS CARD */}
        {state === "submitted" && (
          <div className="p-4 bg-slate-50/60 flex items-center justify-center min-h-[220px]">
            <div className="w-full bg-emerald-50/90 border border-emerald-200 rounded-2xl p-5 text-center space-y-3 shadow-2xs">
              <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg mx-auto shadow-xs font-bold">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">Repair Request Submitted Successfully</h4>
                <p className="text-xs text-emerald-800 mt-1 font-bold">
                  Request ID #{submittedRepairId}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate(`/customer/repairs/${submittedRepairId}`);
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-xl shadow-xs transition-colors"
              >
                View Repair Request →
              </button>
            </div>
          </div>
        )}

        {/* STATE DEFAULT: MESSAGES CHAT STREAM */}
        {state !== "review" && state !== "editing" && state !== "submitted" && (
          <>
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 max-h-[240px] min-h-[140px] bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end text-right" : "items-start text-left"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-[11px] shadow-2xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-tr-none font-medium"
                        : msg.isError
                        ? "bg-rose-100 text-rose-800 border border-rose-200 rounded-tl-none font-medium"
                        : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none font-medium"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                  <span className="mt-0.5 px-1 text-[9px] text-slate-400 font-normal">{msg.time}</span>
                </div>
              ))}

              {interimText && (
                <div className="flex flex-col items-end text-right animate-pulse">
                  <div className="max-w-[88%] rounded-2xl rounded-tr-none bg-blue-500/90 text-white px-3 py-1.5 text-[11px] shadow-2xs leading-relaxed italic">
                    {interimText}...
                  </div>
                  <span className="mt-0.5 px-1 text-[9px] text-slate-400">Listening...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* SUGGESTIONS */}
            <div className="px-2.5 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (s.action === "describe_repair") {
                      startRecording();
                    } else {
                      handleUserQuery(s.prompt);
                    }
                  }}
                  className="shrink-0 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 px-2.5 py-0.5 text-[10px] font-medium border border-slate-200/60 transition-colors cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* INPUT & MICROPHONE CONTROLS */}
            <div className="p-2 bg-white border-t border-slate-200/80 flex items-center gap-1.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUserQuery(textInput);
                }}
                className="flex-1 flex items-center gap-1 bg-slate-100 rounded-xl px-2.5 py-1 border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={state === "listening" ? "Listening..." : "Describe your repair or type..."}
                  className="flex-1 bg-transparent text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none"
                  disabled={state === "processing"}
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || state === "processing"}
                  className="text-blue-600 hover:text-blue-700 disabled:opacity-30 text-[11px] font-bold px-1"
                >
                  Send
                </button>
              </form>

              <button
                onClick={toggleListening}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  state === "listening"
                    ? "bg-rose-600 text-white animate-pulse shadow-xs"
                    : state === "processing"
                    ? "bg-amber-500 text-white"
                    : "bg-slate-900 text-white hover:bg-blue-600"
                }`}
                title={state === "listening" ? "Stop recording" : "Click to speak"}
              >
                {state === "listening" ? (
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
