import api from "./api";

export async function processVoiceMessage(message, context = {}, history = []) {
  const res = await api.post("/voice/process", { message, context, history });
  return res.data;
}

export async function processVoiceAudio(audioBlob, context = {}, history = []) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");
  formData.append("context", JSON.stringify(context || {}));
  formData.append("history", JSON.stringify(history || []));

  const res = await api.post("/voice/process-audio", formData);
  return res.data;
}

export async function transcribeVoiceAudio(audioBlob) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");

  const res = await api.post("/voice/transcribe", formData);
  return res.data;
}

export async function confirmVoiceAction(confirmationData, confirmed = true, context = {}) {
  const res = await api.post("/voice/confirm", {
    confirmation_data: confirmationData,
    confirmed,
    context,
  });
  return res.data;
}

export async function parseVoiceRepairParagraph(text) {
  const res = await api.post("/voice/parse-repair", { text });
  return res.data;
}

export async function submitVoiceRepairRequest(repairData) {
  const res = await api.post("/voice/submit-repair", repairData);
  return res.data;
}

