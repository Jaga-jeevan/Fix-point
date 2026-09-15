import re
import os
import io
import json
import base64
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional, List

import speech_recognition as sr
import requests

from app import db
from app.models.user import User
from app.models.technician import Technician
from app.models.device import Device
from app.models.repair_request import RepairRequest
from app.models.quotation import Quotation, QuotationItem
from app.models.status_history import RepairStatusHistory
from app.models.repair_otp import RepairOTP
from app.services.repair_service import change_status, InvalidTransitionError
from app.services.assignment_service import (
    claim_repair_request,
    release_technician,
    get_available_repair_requests,
    get_available_technicians,
    announce_new_request,
    AlreadyClaimedError,
    TechnicianUnavailableError,
)
from app.services.otp_service import generate_otp_on_start_travel, verify_otp_for_job
from app.services.notification_service import notify


STATUS_DESCRIPTIONS = {
    "REQUESTED": "Your repair request has been submitted and is waiting for technician pickup.",
    "APPROVED": "Your repair request has been approved by admin.",
    "ASSIGNED": "A technician has been assigned to your repair.",
    "ACCEPTED": "A technician has accepted your repair job.",
    "ON_THE_WAY": "The technician is currently on the way to your location.",
    "DEVICE_RECEIVED": "The technician has received your device and verified the inspection OTP.",
    "REPAIRING": "Your device is currently undergoing repair.",
    "COMPLETED": "Your repair has been successfully completed.",
    "REJECTED": "This repair request was rejected.",
}


class VoiceService:
    @staticmethod
    def parse_repair_paragraph(text: str, user: User) -> Dict[str, Any]:
        """
        Parses a customer's spoken paragraph to extract repair details:
        device_type, brand, model, issue, additional_details, customer_request, etc.
        """
        raw_text = (text or "").strip()
        if not raw_text:
            return {
                "success": False,
                "message": "No text provided to parse.",
            }

        gemini_key = os.environ.get("GEMINI_API_KEY")
        extracted = None

        if gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                prompt = f"""
You are an expert repair request parser for an electronics repair service.
Extract the structured repair request details from the following customer spoken paragraph:

Customer Spoken Paragraph:
"{raw_text}"

Return ONLY a valid JSON object with the following fields:
- device_type: One of ["Mobile", "Laptop", "Desktop", "Tablet", "TV", "Other"]
- category_label: Human readable name (e.g. "Mobile Phone", "Laptop Computer", "Television")
- brand: Brand name mentioned (e.g. "Redmi", "Dell", "Samsung", "Sony", "Apple"). Empty string if not mentioned.
- model: Model name/number mentioned (e.g. "Redmi 14", "Galaxy S21", "Inspiron 15"). Empty string if not mentioned.
- device_name: Combined brand and model string (e.g. "Redmi 14").
- issue: Main problem or defect described (e.g. "Screen is cracked and display is not working properly.").
- additional_details: Secondary symptoms or additional issues (e.g. "Phone gets heated while charging.").
- customer_request: Requested service (e.g. "Inspect device and provide repair estimate.").
"""
                payload = {
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {"response_mime_type": "application/json"}
                }
                resp = requests.post(url, json=payload, timeout=2.5)
                if resp.status_code == 200:
                    data = resp.json()
                    res_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    extracted = json.loads(res_text)
            except Exception as e:
                print(f"[VoiceService] Gemini parse_repair exception: {e}")

        if not extracted or not isinstance(extracted, dict):
            extracted = VoiceService._rule_based_paragraph_parser(raw_text)

        extracted["original_text"] = raw_text

        if not extracted.get("device_type"):
            extracted["device_type"] = "Mobile"
        if not extracted.get("category_label"):
            cat_map = {"Mobile": "Mobile Phone", "Laptop": "Laptop Computer", "Desktop": "Desktop PC", "Tablet": "Tablet", "TV": "Television (TV)", "Other": "Electronics"}
            extracted["category_label"] = cat_map.get(extracted["device_type"], "Electronics")
        if not extracted.get("device_name"):
            b = extracted.get("brand", "")
            m = extracted.get("model", "")
            extracted["device_name"] = f"{b} {m}".strip() or "Device"

        brand = (extracted.get("brand") or "").strip()
        model = (extracted.get("model") or "").strip()

        needs_followup = False
        followup_question = ""
        if not brand and not model:
            needs_followup = True
            dev_cat = extracted.get("category_label", "device").lower()
            followup_question = f"I can help create the repair request. What is the {dev_cat} brand and model?"

        return {
            "success": True,
            "extracted": extracted,
            "needs_followup": needs_followup,
            "followup_question": followup_question,
        }

    @staticmethod
    def _rule_based_paragraph_parser(text: str) -> Dict[str, Any]:
        lower = text.lower().strip()
        
        device_type = "Other"
        category_label = "Electronics"
        
        if any(w in lower for w in ["mobile", "phone", "smartphone", "cellphone"]):
            device_type = "Mobile"
            category_label = "Mobile Phone"
        elif any(w in lower for w in ["laptop", "notebook", "macbook"]):
            device_type = "Laptop"
            category_label = "Laptop Computer"
        elif any(w in lower for w in ["desktop", "pc", "computer"]):
            device_type = "Desktop"
            category_label = "Desktop PC"
        elif any(w in lower for w in ["tablet", "ipad"]):
            device_type = "Tablet"
            category_label = "Tablet"
        elif any(w in lower for w in ["tv", "television"]):
            device_type = "TV"
            category_label = "Television (TV)"

        brand = ""
        model = ""

        brands_list = [
            ("redmi", "Redmi"), ("xiaomi", "Xiaomi"), ("samsung", "Samsung"),
            ("apple", "Apple"), ("iphone", "Apple"), ("macbook", "Apple"),
            ("dell", "Dell"), ("hp", "HP"), ("lenovo", "Lenovo"), ("thinkpad", "Lenovo"),
            ("sony", "Sony"), ("asus", "Asus"), ("acer", "Acer"), ("realme", "Realme"),
            ("oneplus", "OnePlus"), ("vivo", "Vivo"), ("oppo", "Oppo"), ("google", "Google"), ("lg", "LG")
        ]

        for key, name in brands_list:
            if key in lower:
                brand = name
                match = re.search(r'\b' + re.escape(key) + r'\s+([a-zA-Z0-9\s\-]{1,20})\b', lower)
                if match:
                    raw_model = match.group(1).strip()
                    clean_m = re.split(r'\b(mobile|phone|tv|television|laptop|screen|display|problem|issue|is|was|has|getting|please|and)\b', raw_model)[0].strip()
                    if clean_m:
                        model = f"{name} {clean_m}".title()
                    else:
                        model = name
                else:
                    model = name
                break

        customer_request = "Inspect the device and provide a repair estimate."
        sentences = [s.strip() for s in re.split(r'[.!?\n]', text) if s.strip()]
        issues = []
        additionals = []

        for s in sentences:
            s_lower = s.lower()
            if any(w in s_lower for w in ["screen", "display", "broken", "cracked", "damage", "working", "battery", "charging", "heated", "heating", "speaker", "sound", "lines", "black", "water", "not working", "fault"]):
                if "heated" in s_lower or "heating" in s_lower or "battery" in s_lower or "charging" in s_lower:
                    additionals.append(s)
                else:
                    issues.append(s)
            elif "estimate" in s_lower or "check" in s_lower or "inspect" in s_lower:
                customer_request = s

        issue = " ".join(issues) if issues else (sentences[1] if len(sentences) > 1 else text)
        additional_details = " ".join(additionals) if additionals else ""

        return {
            "device_type": device_type,
            "category_label": category_label,
            "brand": brand,
            "model": model,
            "device_name": f"{brand} {model}".strip() if (brand or model) else "",
            "issue": issue,
            "additional_details": additional_details,
            "customer_request": customer_request,
        }

    @staticmethod
    def submit_voice_repair(user: User, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a repair request from confirmed/edited voice data.
        """
        if not user or user.role != "CUSTOMER":
            return {"success": False, "message": "Only customers can submit repair requests."}

        device_type = (data.get("device_type") or "Mobile").strip()
        brand = (data.get("brand") or "").strip()
        model = (data.get("model") or "").strip()
        problem_description = (data.get("problem_description") or data.get("issue") or "").strip()
        preferred_date = (data.get("preferred_date") or "").strip()
        preferred_time = (data.get("preferred_time") or "10:00 AM").strip()
        address = (data.get("address") or getattr(user, "address", "") or "Customer Visit Address").strip()
        original_transcript = (data.get("original_transcript") or "").strip()

        if not brand or not model:
            return {"success": False, "message": "Brand and Model details are required."}
        if not problem_description:
            return {"success": False, "message": "Problem description is required."}

        if not preferred_date:
            preferred_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        active_statuses = (
            "REQUESTED", "APPROVED", "ASSIGNED", "ACCEPTED", "ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING", "PENDING_PARTS", "REPAIRED"
        )
        active_repair = RepairRequest.query.filter_by(customer_id=user.id).filter(RepairRequest.status.in_(active_statuses)).first()
        if active_repair:
            dev_name = f"{active_repair.device.brand} {active_repair.device.model}" if active_repair.device else "Device"
            return {
                "success": False,
                "message": f"You already have an active repair request (#{active_repair.id} for {dev_name}) currently in '{active_repair.status}' status. Only one active repair request is permitted at a time.",
                "active_repair_id": active_repair.id
            }

        device = Device(
            customer_id=user.id,
            device_type=device_type,
            brand=brand,
            model=model,
        )
        db.session.add(device)
        db.session.flush()

        full_description = problem_description
        if original_transcript and original_transcript not in full_description:
            full_description = f"{problem_description}\n\n[Original Voice Request]: \"{original_transcript}\""

        repair = RepairRequest(
            customer_id=user.id,
            device_id=device.id,
            problem_description=full_description,
            preferred_date=preferred_date,
            preferred_time=preferred_time,
            address=address,
            status="REQUESTED",
        )
        db.session.add(repair)
        db.session.flush()

        history = RepairStatusHistory(
            repair_request_id=repair.id,
            status="REQUESTED",
            changed_by=user.id,
            remarks=f"Repair request created via Voice Assistant (Voice Request: \"{original_transcript[:100]}\")",
        )
        db.session.add(history)

        announce_new_request(repair)
        db.session.commit()

        return {
            "success": True,
            "message": "Repair Request Submitted Successfully",
            "repair_id": repair.id,
        }
    @staticmethod
    def transcribe_audio(audio_bytes: bytes, language: str = "en-IN") -> str:
        """
        Converts WAV audio bytes into text.
        Tries Gemini multimodal audio if GEMINI_API_KEY exists, otherwise uses SpeechRecognition engine.
        """
        if not audio_bytes or len(audio_bytes) < 100:
            return ""

        # 1. Try Gemini Audio API if key is available
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            try:
                transcript = VoiceService._gemini_audio_transcription(gemini_key, audio_bytes)
                if transcript and transcript.strip():
                    return transcript.strip()
            except Exception as e:
                print(f"[STT] Gemini transcription error: {e}")

        # 2. Use SpeechRecognition with Google Speech API
        r = sr.Recognizer()
        try:
            audio_file = io.BytesIO(audio_bytes)
            with sr.AudioFile(audio_file) as source:
                audio_data = r.record(source)

                recognize_fn = getattr(r, "recognize_google", None)
                if recognize_fn:
                    langs = ["en-IN", "en-US"]
                    seen = set()
                    for lang in langs:
                        if not lang or lang in seen:
                            continue
                        seen.add(lang)
                        try:
                            text = recognize_fn(audio_data, language=lang)
                            if text and text.strip():
                                return text.strip()
                        except sr.UnknownValueError:
                            pass
                        except Exception as e:
                            print(f"[STT] Recognition error for {lang}: {e}")

        except Exception as e:
            print(f"[STT] Audio file loading/transcription error: {e}")

        return ""

    @staticmethod
    def _gemini_audio_transcription(api_key: str, audio_bytes: bytes) -> Optional[str]:
        """Transcribe audio using Gemini 1.5 Flash."""
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": "Transcribe the following spoken audio verbatim into plain English text. Output ONLY in English language without any Tamil script or Tamil words."},
                            {
                                "inline_data": {
                                    "mime_type": "audio/wav",
                                    "data": b64_audio
                                }
                            }
                        ]
                    }
                ]
            }
            resp = requests.post(url, json=payload, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return text
        except Exception as e:
            print(f"[STT] Gemini API request exception: {e}")
        return None

    @staticmethod
    def process_audio(user: User, audio_bytes: bytes, context: Optional[Dict[str, Any]] = None, history: Optional[List[Dict[str, Any]]] = None, language: str = "en-IN") -> Dict[str, Any]:
        """
        Receives raw audio, transcribes it, and routes to process_query.
        """
        transcript = VoiceService.transcribe_audio(audio_bytes, language=language)
        if not transcript:
            return {
                "success": True,
                "transcript": "",
                "response": "I couldn't hear any clear speech. Please try speaking again or click the microphone to record.",
                "intent": "NO_SPEECH_DETECTED",
                "requires_confirmation": False,
                "context": context or {},
            }

        result = VoiceService.process_query(user, transcript, context, history)
        result["transcript"] = transcript
        return result

    @staticmethod
    def _normalize_spoken_numbers(text: str) -> str:
        if not text:
            return ""

        word_to_digit = {
            "zero": "0", "oh": "0", "null": "0",
            "one": "1", "won": "1", "wan": "1", "une": "1", "1st": "1", "first": "1",
            "two": "2", "to": "2", "too": "2", "tu": "2", "do": "2", "2nd": "2", "second": "2", "pwo": "2",
            "three": "3", "tree": "3", "tri": "3", "3rd": "3", "third": "3",
            "four": "4", "for": "4", "fore": "4", "4th": "4", "fourth": "4",
            "five": "5", "5th": "5", "fifth": "5",
            "six": "6", "6th": "6", "sixth": "6",
            "seven": "7", "7th": "7", "seventh": "7",
            "eight": "8", "ate": "8", "8th": "8", "eighth": "8",
            "nine": "9", "9th": "9", "ninth": "9",
            "ten": "10", "10th": "10", "tenth": "10",
        }

        clean = text.lower().strip()
        clean = re.sub(r'\bfree\s*fire\b', '', clean, flags=re.IGNORECASE).strip()
        tokens = [t.strip() for t in re.split(r'[\s,\-]+', clean) if t.strip()]

        converted = []
        is_all_numbers = True
        for t in tokens:
            if t.isdigit():
                converted.append(t)
            elif t in word_to_digit:
                converted.append(word_to_digit[t])
            else:
                is_all_numbers = False
                break

        if is_all_numbers and converted:
            return "".join(converted)

        def replace_num_words(match):
            prefix = match.group(1)
            raw_nums = match.group(2).strip()
            num_tokens = [t.strip() for t in re.split(r'[\s,\-]+', raw_nums) if t.strip()]
            num_digits = []
            for nt in num_tokens:
                if nt.isdigit():
                    num_digits.append(nt)
                elif nt in word_to_digit:
                    num_digits.append(word_to_digit[nt])
                else:
                    return match.group(0)
            return f"{prefix} {''.join(num_digits)}"

        prefix_pat = r'\b(repair|job|request|option|number|choice|item|id|#)\s+((?:[a-z0-9]+\s*)+)'
        clean_normalized = re.sub(prefix_pat, replace_num_words, clean)
        return clean_normalized

    @staticmethod
    def _clean_tamil_from_text(text: str) -> str:
        if not text:
            return ""
        tamil_map = [
            (r"(?:ஓகே|ஒகே|ஓகேயா|சரி|சரியா)", "okay"),
            (r"(?:ஆம்|ஆமா|ஆமாம்|கண்டிப்பா)", "yes"),
            (r"(?:வேண்டாம்|இல்லை|இல்ல)", "no"),
            (r"(?:நன்றி)", "thank you"),
            (r"(?:வணக்கம்|ஹலோ)", "hello"),
            (r"(?:ரத்து)", "cancel"),
            (r"(?:முடி|முடிந்தது)", "complete"),
        ]
        res = text
        for pattern, repl in tamil_map:
            res = re.sub(pattern, repl, res, flags=re.IGNORECASE)
        res = re.sub(r'[\u0B80-\u0BFF]+', '', res)
        res = re.sub(r'\s+', ' ', res).strip()
        return res

    @staticmethod
    def process_query(user: User, raw_text: str, context: Optional[Dict[str, Any]] = None, history: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Main entry point for processing a voice or text command from an authenticated user.
        """
        if context is None:
            context = {}
        if history is None:
            history = []

        raw_text_str = (raw_text or "").strip()
        cleaned_tamil = VoiceService._clean_tamil_from_text(raw_text_str)
        if cleaned_tamil:
            raw_text_str = cleaned_tamil

        # Silently strip "freefire" / "free fire" from input text without showing or mentioning it
        if re.search(r'\bfree\s*fire\b', raw_text_str, re.IGNORECASE):
            cleaned_ff = re.sub(r'\bfree\s*fire\b', '', raw_text_str, flags=re.IGNORECASE).strip()
            if not cleaned_ff or re.match(r'^[0-9]+$', cleaned_ff):
                return {
                    "success": True,
                    "transcript": "",
                    "response": "I didn't catch that. Please speak or type your request.",
                    "intent": "UNKNOWN",
                    "requires_confirmation": False,
                    "context": context,
                }
            raw_text_str = cleaned_ff

        text = VoiceService._normalize_spoken_numbers(raw_text_str)
        if not text:
            return {
                "success": True,
                "transcript": "",
                "response": "I didn't catch that. Please speak or type your request.",
                "intent": "UNKNOWN",
                "requires_confirmation": False,
                "context": context,
            }

        # Check for confirmation responses if there is an active pending action
        pending_action = context.get("pending_action")
        if pending_action:
            confirm_match = VoiceService._check_confirmation_response(text)
            if confirm_match is True:
                return VoiceService.execute_confirmed_action(user, pending_action, context)
            elif confirm_match is False:
                context["pending_action"] = None
                return {
                    "success": True,
                    "transcript": text,
                    "response": "Cancelled. What else can I help you with?",
                    "intent": "CANCEL_ACTION",
                    "requires_confirmation": False,
                    "context": context,
                }

        # Check for job selection response if last_mentioned_repairs exists
        last_repairs = context.get("last_mentioned_repairs", [])
        pending_selection_intent = context.get("pending_selection_intent")

        if last_repairs and user.role == "CUSTOMER":
            real_repair_id, selection_err = VoiceService._extract_selection_index(text, last_repairs)
            if selection_err and pending_selection_intent:
                return {
                    "success": True,
                    "transcript": text,
                    "response": selection_err,
                    "intent": "INVALID_SELECTION",
                    "requires_confirmation": False,
                    "context": context,
                }
            elif real_repair_id is not None:
                intent = context.pop("pending_selection_intent", None) or "GET_REPAIR_DETAILS"
                context.pop("last_mentioned_repairs", None)
                extracted_slots = {"repair_id": real_repair_id}
                context["current_repair_id"] = real_repair_id

                selected_repair = RepairRequest.query.get(real_repair_id)
                dev_str = f"{selected_repair.device.brand} {selected_repair.device.model}" if (selected_repair and selected_repair.device and selected_repair.device.brand) else "Device"
                ack = f"Selected Repair #{real_repair_id} — {dev_str}.\n"

                result = VoiceService._handle_customer_intent(user, intent, extracted_slots, text, context)
                result["transcript"] = raw_text_str
                if result.get("response"):
                    result["response"] = ack + result["response"]
                else:
                    result["response"] = ack.strip()
                return result
            else:
                context.pop("pending_selection_intent", None)
                context.pop("last_mentioned_repairs", None)

        # Attempt Intent Detection (LLM if API key provided, otherwise Rule-Based Semantic NLU)
        intent, extracted_slots = VoiceService._detect_intent_and_slots(user.role, text, context, history)

        # Dispatch intent based on role
        if user.role == "CUSTOMER":
            result = VoiceService._handle_customer_intent(user, intent, extracted_slots, text, context)
        elif user.role == "TECHNICIAN":
            result = VoiceService._handle_technician_intent(user, intent, extracted_slots, text, context)
        elif user.role == "ADMIN":
            result = VoiceService._handle_admin_intent(user, intent, extracted_slots, text, context)
        else:
            result = {
                "success": False,
                "response": "Unauthorized role.",
                "intent": "UNAUTHORIZED",
                "requires_confirmation": False,
                "context": context,
            }

        result["transcript"] = text
        return result

    @staticmethod
    def _extract_selection_index(text: str, last_repairs: List[int]) -> Tuple[Optional[int], Optional[str]]:
        if not text or not last_repairs:
            return None, None

        lower = text.lower().strip()
        lower = re.sub(r'^[^\w\s]+|[^\w\s]+$', '', lower).strip()
        num_items = len(last_repairs)

        if re.search(r'\bfree\s*fire\b', lower):
            return None, None

        word_to_num = {
            "1": 1, "one": 1, "first": 1, "1st": 1, "won": 1, "wan": 1, "une": 1,
            "2": 2, "two": 2, "second": 2, "2nd": 2, "to": 2, "too": 2, "tu": 2, "do": 2,
            "3": 3, "three": 3, "third": 3, "3rd": 3, "tree": 3, "tri": 3,
            "4": 4, "four": 4, "fourth": 4, "4th": 4, "for": 4, "fore": 4,
            "5": 5, "five": 5, "fifth": 5, "5th": 5,
            "6": 6, "six": 6, "sixth": 6, "6th": 6,
            "7": 7, "seven": 7, "seventh": 7, "7th": 7,
            "8": 8, "eight": 8, "eighth": 8, "8th": 8, "ate": 8,
            "9": 9, "nine": 9, "ninth": 9, "9th": 9,
            "10": 10, "ten": 10, "tenth": 10, "10th": 10,
        }

        # 1. Direct word or single digit match (e.g. "1", "one", "first", "1st")
        if lower in word_to_num:
            sel_num = word_to_num[lower]
            if 1 <= sel_num <= num_items:
                return last_repairs[sel_num - 1], None
            else:
                return None, f"Please choose a repair from 1 to {num_items}."

        # 2. Check prefixed expressions: "job 1", "job one", "repair 2", "repair two", "number 3", "number three", "option 1", "request 2", "#2"
        match = re.search(
            r'(?:job|repair|option|number|request|id|#)\s*([0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|won|to|too|tree|for)',
            lower
        )
        if match:
            val = match.group(1)
            if val in word_to_num:
                sel_num = word_to_num[val]
                if 1 <= sel_num <= num_items:
                    return last_repairs[sel_num - 1], None
                else:
                    return None, f"Please choose a repair from 1 to {num_items}."
            elif val.isdigit():
                parsed_num = int(val)
                if parsed_num in last_repairs:
                    return parsed_num, None
                if 1 <= parsed_num <= num_items:
                    return last_repairs[parsed_num - 1], None
                return None, f"Please choose a repair from 1 to {num_items}."

        # 3. Check any standalone digits in text
        digits = re.findall(r'\b([0-9]+)\b', lower)
        if digits:
            parsed_num = int(digits[0])
            if parsed_num in last_repairs:
                return parsed_num, None
            if 1 <= parsed_num <= num_items:
                return last_repairs[parsed_num - 1], None
            return None, f"Please choose a repair from 1 to {num_items}."

        return None, None

    @staticmethod
    def _format_numbered_job_list(repairs: List[RepairRequest], action_text: str) -> str:
        lines = [f"Which repair would you like {action_text} for?\n"]
        for idx, r in enumerate(repairs, start=1):
            brand_model = f"{r.device.brand} {r.device.model}" if (r.device and r.device.brand) else "Device"
            problem = r.problem_description or "Repair issue"
            lines.append(f"{idx}. Repair #{r.id} — {brand_model}\n   {problem}\n")
        return "\n".join(lines).strip()

    @staticmethod
    def _check_confirmation_response(text: str) -> Optional[bool]:
        lower = text.lower().strip()
        negative_words = ("no", "nope", "cancel", "stop", "nevermind", "never mind", "don't", "dont", "vendaam", "vendam", "naa", "nahi", "abort")
        if any(w in lower for w in negative_words):
            return False

        positive_keywords = (
            "yes", "yeah", "yep", "sure", "proceed", "confirm", "ok", "okay", "do it",
            "go ahead", "fine", "yup", "aam", "sari", "kandippa", "correct", "haan", "ha",
            "accept", "claim", "take", "please"
        )
        if any(re.search(r"\b" + re.escape(w) + r"\b", lower) for w in positive_keywords):
            return True

        return None

    @staticmethod
    def _detect_intent_and_slots(role: str, text: str, context: Dict[str, Any], history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            try:
                llm_result = VoiceService._gemini_intent_extraction(gemini_key, role, text, context, history)
                if llm_result:
                    return llm_result
            except Exception:
                pass

        return VoiceService._rule_based_nlu(role, text, context)

    @staticmethod
    def _gemini_intent_extraction(api_key: str, role: str, text: str, context: Dict[str, Any], history: List[Dict[str, Any]]) -> Optional[Tuple[str, Dict[str, Any]]]:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            system_prompt = f"""
You are an intent and entity extractor for an electronic repair system voice assistant.
The logged in user role is: {role}.
Current conversation context: {json.dumps(context)}
Supported intents by role:
CUSTOMER: CREATE_REPAIR_REQUEST, GET_REPAIR_STATUS, GET_REPAIR_DETAILS, GET_TECHNICIAN_LOCATION, GET_QUOTATION, APPROVE_QUOTATION, REJECT_QUOTATION, GET_PAYMENT_STATUS, MAKE_PAYMENT, GET_OTP, GET_PARTS_USED, GET_DASHBOARD_STATS, LIST_MY_REPAIRS, NAVIGATE_PAGE, HELP, UNKNOWN_REQUEST
TECHNICIAN: GET_PENDING_JOBS, GET_AVAILABLE_JOBS, ACCEPT_JOB, START_TRAVEL, RECEIVE_DEVICE, START_REPAIR, COMPLETE_JOB, VERIFY_OTP, GET_CUSTOMER_DETAILS, GET_QUOTATION, SEND_QUOTATION, VERIFY_PAYMENT, SET_AVAILABILITY, NAVIGATE_PAGE, HELP, UNKNOWN_REQUEST
ADMIN: GET_ADMIN_STATISTICS, LIST_ALL_REPAIRS, GET_REPAIR_DETAILS, APPROVE_REPAIR, REJECT_REPAIR, LIST_TECHNICIANS, NAVIGATE_PAGE, HELP, UNKNOWN_REQUEST

Given the user's input, return ONLY a JSON object with:
{{
  "intent": "<INTENT_NAME>",
  "slots": {{ ... }}
}}
"""
            payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": f"{system_prompt}\n\nUser input: \"{text}\""}]}
                ],
                "generationConfig": {"response_mime_type": "application/json"}
            }
            resp = requests.post(url, json=payload, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                content_text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(content_text)
                return parsed.get("intent", "UNKNOWN_REQUEST"), parsed.get("slots", {})
        except Exception:
            pass
        return None

    @staticmethod
    def _rule_based_nlu(role: str, text: str, context: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        lower = text.lower().strip()
        slots: Dict[str, Any] = {}

        # 0. Pure digit or number input (e.g. "123", "2", "123456")
        clean_digits = re.sub(r'[\s,\-]+', '', lower)
        if clean_digits.isdigit():
            val = int(clean_digits)
            if len(clean_digits) == 6:
                slots["otp"] = clean_digits
                if role == "TECHNICIAN":
                    return "VERIFY_OTP", slots
                else:
                    return "GET_OTP", slots
            else:
                slots["repair_id"] = val
                if role == "CUSTOMER":
                    return "GET_REPAIR_STATUS", slots
                elif role == "TECHNICIAN":
                    return "GET_CUSTOMER_DETAILS", slots
                elif role == "ADMIN":
                    return "GET_REPAIR_DETAILS", slots

        # 1. Extract potential Repair ID or contextual reference
        id_match = re.search(r'(?:repair|job|request|id|#)\s*([0-9]+)', lower)
        if id_match:
            slots["repair_id"] = int(id_match.group(1))
        elif re.search(r'\b(first|1st)\b', lower):
            last_repairs = context.get("last_mentioned_repairs", [])
            if last_repairs and len(last_repairs) >= 1:
                slots["repair_id"] = last_repairs[0]
        elif re.search(r'\b(second|2nd)\b', lower):
            last_repairs = context.get("last_mentioned_repairs", [])
            if last_repairs and len(last_repairs) >= 2:
                slots["repair_id"] = last_repairs[1]
        elif re.search(r'\b(third|3rd)\b', lower):
            last_repairs = context.get("last_mentioned_repairs", [])
            if last_repairs and len(last_repairs) >= 3:
                slots["repair_id"] = last_repairs[2]
        elif re.search(r'\b(last|latest|current|this one|this repair|this job)\b', lower):
            if context.get("current_repair_id"):
                slots["repair_id"] = context["current_repair_id"]

        if "repair_id" not in slots and context.get("current_repair_id"):
            if re.search(r'\b(he|him|it|this|that|the job|the repair|technician)\b', lower):
                slots["repair_id"] = context["current_repair_id"]

        # Extract 6-digit OTP if mentioned
        otp_match = re.search(r'\b([0-9]{6})\b', lower)
        if otp_match:
            slots["otp"] = otp_match.group(1)

        # Extract device brand and type for repair creation
        # 1. Device Type
        for dev, canonical in [
            ("laptop", "Laptop"), ("notebook", "Laptop"), ("macbook", "Laptop"),
            ("desktop", "Desktop"), ("pc", "Desktop"), ("computer", "Desktop"),
            ("mobile", "Mobile"), ("phone", "Mobile"), ("smartphone", "Mobile"), ("cellphone", "Mobile"),
            ("tablet", "Tablet"), ("ipad", "Tablet"),
            ("tv", "TV"), ("television", "TV"),
            ("other", "Other")
        ]:
            if dev in lower:
                slots["device_type"] = canonical
                break

        # 2. Brand & Model Extraction
        brands_map = {
            "apple": "Apple", "iphone": "Apple", "macbook": "Apple",
            "samsung": "Samsung", "galaxy": "Samsung",
            "sony": "Sony",
            "dell": "Dell",
            "hp": "HP",
            "lenovo": "Lenovo", "thinkpad": "Lenovo",
            "asus": "Asus",
            "acer": "Acer",
            "oneplus": "OnePlus",
            "xiaomi": "Xiaomi",
            "redmi": "Redmi",
            "realme": "Realme",
            "vivo": "Vivo",
            "oppo": "Oppo",
            "google": "Google", "pixel": "Google",
            "lg": "LG"
        }

        # Check explicit "brand <X>" or "model <Y>" first
        b_match = re.search(r'\bbrand\s+([a-zA-Z0-9]+)\b', lower)
        m_match = re.search(r'\bmodel\s+([a-zA-Z0-9\s\-]+?)(?:\s+(?:problem|issue|date|time|address|submit)|$)', lower)

        if b_match:
            slots["brand"] = b_match.group(1).capitalize()
        if m_match:
            slots["model"] = m_match.group(1).strip().title()

        # Extract brand and auto-extract trailing model string if not explicitly set
        if "brand" not in slots:
            for b_token, b_name in brands_map.items():
                pattern = r'\b' + re.escape(b_token) + r'\b'
                b_found = re.search(pattern, lower)
                if b_found:
                    slots["brand"] = b_name
                    after_brand = lower[b_found.end():].strip()
                    after_brand = re.sub(r'\b(problem|issue|broken|display|screen|battery|charging|water|damage|venum|date|time|address|submit|request|repair|service)\b.*$', '', after_brand).strip()
                    after_brand = re.sub(r'^[^\w]+|[^\w]+$', '', after_brand).strip()
                    if after_brand and "model" not in slots:
                        slots["model"] = after_brand.title()
                    break

        # 3. Date & Time Extraction
        date_match = re.search(r'\b(?:date|preferred date|visit date)\s+([a-zA-Z0-9\s\-/.]+?)(?:\s+(?:time|problem|issue|address|brand|model|submit)|$)', lower)
        if date_match:
            slots["preferred_date"] = date_match.group(1).strip()
        elif "tomorrow" in lower:
            slots["preferred_date"] = "tomorrow"
        elif "today" in lower:
            slots["preferred_date"] = "today"
        elif "day after tomorrow" in lower:
            slots["preferred_date"] = "day after tomorrow"

        time_match = re.search(r'\b(?:time|preferred time)\s+([0-9]{1,2}(?:[\s:]?[0-9]{2})?\s*(?:am|pm)?)\b', lower)
        if time_match:
            slots["preferred_time"] = time_match.group(1).strip()
        else:
            am_pm_match = re.search(r'\b([0-9]{1,2}(?::[0-9]{2})?)\s*(am|pm)\b', lower)
            if am_pm_match:
                slots["preferred_time"] = f"{am_pm_match.group(1)} {am_pm_match.group(2).upper()}"

        # 4. Address Extraction
        addr_match = re.search(r'\b(?:address|location|place)\s+(.+?)(?:\s+(?:submit|date|time|problem|issue|brand|model)|$)', lower)
        if addr_match:
            slots["address"] = addr_match.group(1).strip().title()

        # 5. Problem Description Extraction
        prob_match = re.search(r'\b(?:problem|issue|description)\s+(.+?)(?:\s+(?:address|location|date|time|brand|model|submit)|$)', lower)
        if prob_match:
            slots["problem_description"] = prob_match.group(1).strip().capitalize()

        # Common problem descriptions
        problem_keywords = [
            ("screen broken", "Broken display screen"),
            ("display broken", "Broken display screen"),
            ("display gone", "Display not working"),
            ("display is gone", "Display not working"),
            ("broken screen", "Broken screen"),
            ("battery", "Battery draining fast / replacement needed"),
            ("charging", "Device not charging"),
            ("water damage", "Water damage repair"),
            ("motherboard", "Motherboard issue"),
            ("overheating", "Overheating problem"),
            ("speaker", "Speaker not working"),
            ("camera", "Camera not functioning"),
        ]
        for kw, desc in problem_keywords:
            if kw in lower:
                slots["problem_description"] = desc
                break

        # 6. Submit Form Trigger Extraction
        if re.search(r'\b(submit|submit request|submit the request|submit my request|submit repair|submit form|send request|confirm submit|confirm repair|submit now|submit button|request submit|post repair)\b', lower) or lower in ("submit", "submit request", "submit the request", "submit form", "submit repair"):
            slots["submit_form"] = True

        # Check navigation intents
        is_nav_trigger = bool(re.search(r'\b(go to|goto|go|open|navigate to|navigate|show|show me|take me to|view)\b', lower))

        # Direct submit form intent if submit_form slot present
        if slots.get("submit_form"):
            return "FILL_REPAIR_FORM", slots

        # 0. Direct Repair ID Navigation e.g. "open repair 13", "go to repair 13", "view repair 12"
        if slots.get("repair_id") and is_nav_trigger:
            return "NAVIGATE_PAGE", {"page": f"repairs/{slots['repair_id']}", "repair_id": slots["repair_id"]}

        # 1. New Repair Request (check before general "my repair" / "repair")
        if ("new repair" in lower) or ("create repair" in lower) or ("book repair" in lower) or ("new request" in lower) or (is_nav_trigger and "new" in lower):
            return "NAVIGATE_PAGE", {"page": "new"}

        # 2. My Repair / My Repairs / Repairs
        if ("my repair" in lower) or ("my repairs" in lower) or (is_nav_trigger and ("repair" in lower or "repairs" in lower)):
            return "NAVIGATE_PAGE", {"page": "repairs"}

        # 3. Dashboard / Home
        if ("dashboard" in lower) or ("home" in lower) or (is_nav_trigger and "dashboard" in lower):
            return "NAVIGATE_PAGE", {"page": "dashboard"}

        # 4. Jobs / Job Hub
        if ("jobs" in lower) or ("job hub" in lower) or (is_nav_trigger and "job" in lower):
            return "NAVIGATE_PAGE", {"page": "jobs"}

        # 5. Progress
        if ("progress" in lower) or (is_nav_trigger and "progress" in lower):
            return "NAVIGATE_PAGE", {"page": "progress"}

        # 6. Technicians
        if ("technicians" in lower) or (is_nav_trigger and "technician" in lower):
            return "NAVIGATE_PAGE", {"page": "technicians"}

        # 7. Requests (Admin)
        if ("requests" in lower) or (is_nav_trigger and "request" in lower):
            return "NAVIGATE_PAGE", {"page": "requests"}

        # Help
        if re.search(r'\b(help|what can you do|commands|options|assist me)\b', lower):
            return "HELP", slots

        # CUSTOMER INTENTS
        if role == "CUSTOMER":
            if re.search(r'\b(clear all|clear form|reset form|reset all|clear fields|reset fields|clear details|erase form|erase all|start over)\b', lower):
                return "CLEAR_FORM", slots

            form_keys = ("device_type", "brand", "model", "preferred_date", "preferred_time", "problem_description", "address", "submit_form")
            has_form_slot = any(k in slots for k in form_keys)
            has_form_keyword = bool(re.search(r'\b(select|device type|device|brand|model|date|time|problem|issue|address|submit)\b', lower))

            if has_form_slot or (has_form_keyword and not re.search(r'\b(status|technician|quotation|quote|payment|otp|my repairs|list repairs)\b', lower)):
                return "FILL_REPAIR_FORM", slots

            if re.search(r'\b(parts|parts used|replaced parts|part details|parts cost|what parts|parts breakdown)\b', lower):
                return "GET_PARTS_USED", slots

            if re.search(r'\b(dashboard stats|summary|how many repairs|total repairs|active repairs count|my summary)\b', lower):
                return "GET_DASHBOARD_STATS", slots

            if re.search(r'(where is|track|find|enga|irukanga|location of)\s*(my\s*)?(technician|ravi|tech|driver|person)', lower) or \
               re.search(r'technician\s*(enga|where|location|status)', lower) or \
               (lower in ("where is he", "where is he?", "where is technician", "track technician", "technician enga irukanga")):
                return "GET_TECHNICIAN_LOCATION", slots

            if re.search(r'\b(status|status enna|sollunga|what is the status|check status|track|how is my repair|my repair status)\b', lower) or \
               re.search(r'repair\s*status', lower):
                return "GET_REPAIR_STATUS", slots

            if re.search(r'\b(how much|cost|price|estimate|quotation|quote|bill|repair cost|rate|evvalavu|amount)\b', lower):
                return "GET_QUOTATION", slots

            if re.search(r'\b(pay|payment|make payment|upi|pay bill|pay money|i want to pay|settle)\b', lower):
                slots["payment_method"] = "CASH" if "cash" in lower else "UPI"
                return "MAKE_PAYMENT", slots

            if re.search(r'payment\s*status', lower):
                return "GET_PAYMENT_STATUS", slots

            if re.search(r'\b(otp|verification code|pin|my otp|show otp|get otp)\b', lower):
                return "GET_OTP", slots

            if re.search(r'\b(approve quotation|accept quotation|approve quote|confirm quotation)\b', lower):
                return "APPROVE_QUOTATION", slots
            if re.search(r'\b(reject quotation|decline quotation|reject quote)\b', lower):
                return "REJECT_QUOTATION", slots

            if re.search(r'\b(details|show repair|view repair|open repair|repair info|recent repair|latest repair|show recent|view details|show details|open recent|recent details|latest repair details)\b', lower) or \
               re.search(r'\b(show|view|open|get|details)\b.*\b(recent|latest|details|info)\b', lower):
                return "GET_REPAIR_DETAILS", slots

            if re.search(r'\b(my repairs|list repairs|show repairs|my requests|pending repairs|all repairs|active repairs)\b', lower):
                return "LIST_MY_REPAIRS", slots

            if re.search(r'\b(broken|damage|book repair|create repair|service repair|need a repair|want a repair|screen gone|display gone|display is gone|battery drain|repair venum|book service|new repair|create request|book request)\b', lower) or \
               re.search(r'\b(book|create)\b.*\b(repair|service|request)\b', lower):
                return "CREATE_REPAIR_REQUEST", slots

        # TECHNICIAN INTENTS
        elif role == "TECHNICIAN":
            if re.search(r'\b(verify otp|submit otp|enter otp|otp verify|check otp)\b', lower) or ("otp" in lower and slots.get("otp")):
                return "VERIFY_OTP", slots

            if re.search(r'\b(accept|claim|take job|accept job|accept this|take this repair|i will take|accept request)\b', lower):
                return "ACCEPT_JOB", slots

            if re.search(r'\b(start travel|on the way|start journey|going to customer|travel start|start driving|head over)\b', lower):
                return "START_TRAVEL", slots

            if re.search(r'\b(receive device|device received|collected device|got device|received the phone|device collect)\b', lower):
                return "RECEIVE_DEVICE", slots

            if re.search(r'\b(start repair|begin repair|start fixing|repairing now|started repair)\b', lower):
                return "START_REPAIR", slots

            if re.search(r'\b(complete|completed|finish|mark as completed|done repair|repair done|finished job)\b', lower):
                return "COMPLETE_JOB", slots

            if re.search(r'\b(available jobs|available requests|new jobs|unassigned|which repair should i handle next|next job|new requests)\b', lower):
                return "GET_AVAILABLE_JOBS", slots

            if re.search(r'\b(my jobs|pending jobs|assigned jobs|active jobs|my tasks|show jobs|list jobs|what jobs do i have)\b', lower):
                return "GET_PENDING_JOBS", slots

            if re.search(r'\b(customer address|customer details|customer location|where is customer|address|customer phone|contact customer)\b', lower):
                return "GET_CUSTOMER_DETAILS", slots

            if re.search(r'\b(available|set available|go online|online|offline|go offline|set offline)\b', lower):
                slots["availability_status"] = "OFFLINE" if "offline" in lower else "AVAILABLE"
                return "SET_AVAILABILITY", slots

            if re.search(r'\b(details|show job|job details|show repair|repair details)\b', lower):
                return "GET_CUSTOMER_DETAILS", slots

            if re.search(r'\b(quotation|quote|send quote|send quotation)\b', lower):
                return "SEND_QUOTATION", slots

            if re.search(r'\b(verify payment|check payment|confirm cash|cash received)\b', lower):
                return "VERIFY_PAYMENT", slots

        # ADMIN INTENTS
        elif role == "ADMIN":
            if re.search(r'\b(stats|statistics|overview|how many|active technicians|counts|metrics|dashboard stats|summary)\b', lower):
                return "GET_ADMIN_STATISTICS", slots

            if re.search(r'\b(technicians|active technicians|list technicians|show technicians|available technicians)\b', lower):
                if "available" in lower or "active" in lower:
                    slots["available_only"] = True
                return "LIST_TECHNICIANS", slots

            if re.search(r'\b(approve|approve request|approve repair)\b', lower):
                return "APPROVE_REPAIR", slots

            if re.search(r'\b(reject|reject request|reject repair|decline)\b', lower):
                return "REJECT_REPAIR", slots

            if re.search(r'\b(requests|repairs|list all|pending requests|today\'s requests|all requests|completed repairs)\b', lower):
                if "pending" in lower or "requested" in lower:
                    slots["status_filter"] = "REQUESTED"
                elif "completed" in lower:
                    slots["status_filter"] = "COMPLETED"
                elif "active" in lower:
                    slots["status_filter"] = "ACTIVE"
                return "LIST_ALL_REPAIRS", slots

            if re.search(r'\b(details|show repair|view request)\b', lower):
                return "GET_REPAIR_DETAILS", slots

        return "UNKNOWN_REQUEST", slots

    # =========================================================================
    # CUSTOMER INTENT HANDLERS
    # =========================================================================
    @staticmethod
    def _handle_customer_intent(user: User, intent: str, slots: Dict[str, Any], text: str, context: Dict[str, Any]) -> Dict[str, Any]:
        customer_id = user.id

        if intent == "HELP":
            return {
                "success": True,
                "response": "I can help you check your repair status, track your technician, view and pay quotations, check your handover OTP, create new repair requests, or list your active repairs.",
                "intent": intent,
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "NAVIGATE_PAGE":
            page = str(slots.get("page", "dashboard")).lower().strip()
            repair_id = slots.get("repair_id")
            if repair_id:
                target_route = f"/customer/repairs/{repair_id}"
                page_title = f"Repair #{repair_id}"
            elif page.startswith("repairs/"):
                target_route = f"/customer/{page}"
                page_title = f"Repair #{page.split('/')[-1]}"
            else:
                route_map = {
                    "dashboard": "/customer/dashboard",
                    "home": "/customer/dashboard",
                    "repairs": "/customer/repairs",
                    "my repairs": "/customer/repairs",
                    "my repair": "/customer/repairs",
                    "repair": "/customer/repairs",
                    "new": "/customer/repairs/new",
                    "new repair": "/customer/repairs/new",
                    "book repair": "/customer/repairs/new",
                    "create repair": "/customer/repairs/new",
                }
                title_map = {
                    "dashboard": "Dashboard",
                    "home": "Dashboard",
                    "repairs": "My Repairs",
                    "my repairs": "My Repairs",
                    "my repair": "My Repairs",
                    "repair": "My Repairs",
                    "new": "New Repair Request",
                    "new repair": "New Repair Request",
                    "book repair": "New Repair Request",
                    "create repair": "New Repair Request",
                }
                target_route = route_map.get(page, "/customer/dashboard")
                page_title = title_map.get(page, "Dashboard")

            return {
                "success": True,
                "response": f"Navigating to {page_title}.",
                "intent": intent,
                "navigate_to": target_route,
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "GET_DASHBOARD_STATS":
            repairs = RepairRequest.query.filter_by(customer_id=customer_id).all()
            total = len(repairs)
            active = [r for r in repairs if r.status not in ("COMPLETED", "REJECTED")]
            completed = [r for r in repairs if r.status == "COMPLETED"]
            pending_quotes = [r for r in repairs if r.quotation and r.quotation.status == "SENT"]

            response = f"Dashboard Summary: You have {total} total repair request{'s' if total != 1 else ''} ({len(active)} active, {len(completed)} completed)."
            if pending_quotes:
                response += f" You have {len(pending_quotes)} quotation awaiting your approval."

            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {"total": total, "active": len(active), "completed": len(completed), "pending_quotations": len(pending_quotes)},
                "navigate_to": "/customer/dashboard",
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "GET_PARTS_USED":
            repair_id = slots.get("repair_id")
            repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first() if repair_id else None
            if not repair:
                repairs = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.updated_at.desc()).all()
                if len(repairs) > 1 and not slots.get("repair_id"):
                    context["last_mentioned_repairs"] = [r.id for r in repairs]
                    context["pending_selection_intent"] = intent
                    response_text = VoiceService._format_numbered_job_list(repairs, "the parts used details")
                    return {
                        "success": True,
                        "response": response_text,
                        "intent": intent,
                        "context": context,
                    }
                repair = repairs[0] if repairs else None

            if not repair:
                return {"success": True, "response": "No repair request found.", "intent": intent, "context": context}

            context["current_repair_id"] = repair.id
            parts = repair.parts_used
            device_str = f" — {repair.device.brand} {repair.device.model}" if repair.device else ""
            if not parts:
                return {
                    "success": True,
                    "response": f"No parts have been added to Repair #{repair.id}{device_str} yet.",
                    "intent": intent,
                    "data": {"parts": []},
                    "navigate_to": f"/customer/repairs/{repair.id}",
                    "requires_confirmation": False,
                    "context": context,
                }

            total_cost = sum(p.line_total for p in parts)
            part_items = [f"{p.part.name if p.part else 'Part'} (Qty: {p.quantity}, ₹{p.line_total:,.2f})" for p in parts]
            response = f"Parts used for Repair #{repair.id}{device_str}: {', '.join(part_items)}. Total parts cost: ₹{total_cost:,.2f}."
            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {"parts": [p.to_dict() for p in parts], "total_parts_cost": total_cost},
                "navigate_to": f"/customer/repairs/{repair.id}",
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "LIST_MY_REPAIRS":
            repairs = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.created_at.desc()).limit(5).all()
            if not repairs:
                return {
                    "success": True,
                    "response": "You don't have any repair requests yet. Would you like to create one?",
                    "intent": intent,
                    "requires_confirmation": False,
                    "context": context,
                }
            active = [r for r in repairs if r.status not in ("COMPLETED", "REJECTED")]
            context["last_mentioned_repairs"] = [r.id for r in repairs]
            if repairs:
                context["current_repair_id"] = repairs[0].id

            summary_parts = [f"#{r.id} ({r.device.brand} {r.device.model} - {r.status})" for r in repairs[:3]]
            return {
                "success": True,
                "response": f"You have {len(active)} active repair{'s' if len(active) != 1 else ''}: {', '.join(summary_parts)}. Which one would you like details on?",
                "intent": intent,
                "data": {"repairs": [r.to_dict(include_relations=False) for r in repairs]},
                "requires_confirmation": False,
                "context": context,
            }

        if intent in ("GET_REPAIR_STATUS", "GET_REPAIR_DETAILS"):
            repair_id = slots.get("repair_id")
            repair = None
            if repair_id:
                repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first()
                if not repair:
                    all_repairs = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.updated_at.desc()).all()
                    if all_repairs:
                        context["last_mentioned_repairs"] = [r.id for r in all_repairs]
                        context["pending_selection_intent"] = intent
                        job_list = ", ".join([f"Repair #{r.id} ({r.device.brand} {r.device.model})" for r in all_repairs[:3]])
                        return {
                            "success": True,
                            "response": f"I couldn't find Repair #{repair_id} in your account. You have {len(all_repairs)} active repair request{'s' if len(all_repairs) != 1 else ''}: {job_list}. Which one would you like details on?",
                            "intent": intent,
                            "context": context,
                        }
                    else:
                        return {
                            "success": True,
                            "response": f"I couldn't find Repair #{repair_id} in your account, and you don't have any active repair requests yet. You can ask me to book a repair anytime.",
                            "intent": intent,
                            "context": context,
                        }
            else:
                repairs = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.id.desc()).all()
                is_recent = any(w in text.lower() for w in ("recent", "latest", "last", "most recent", "view details", "show details", "details"))
                if len(repairs) > 1 and not is_recent:
                    context["last_mentioned_repairs"] = [r.id for r in repairs]
                    context["pending_selection_intent"] = intent
                    response_text = VoiceService._format_numbered_job_list(repairs, "the status" if intent == "GET_REPAIR_STATUS" else "the details")
                    return {
                        "success": True,
                        "response": response_text,
                        "intent": intent,
                        "context": context,
                    }
                repair = repairs[0] if repairs else None

            if not repair:
                return {
                    "success": True,
                    "response": "You don't have any repair requests. You can ask me to create a new repair request anytime.",
                    "intent": intent,
                    "requires_confirmation": False,
                    "context": context,
                }

            context["current_repair_id"] = repair.id
            status_text = STATUS_DESCRIPTIONS.get(repair.status, f"Status is {repair.status}")
            tech_name = None
            if repair.current_assignment and repair.current_assignment.technician and repair.current_assignment.technician.user:
                tech_name = repair.current_assignment.technician.user.name

            extra = f" Assigned technician: {tech_name}." if tech_name else ""
            response = f"Repair #{repair.id} for your {repair.device.brand} {repair.device.model} is {repair.status}. {status_text}{extra}"

            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {"repair": repair.to_dict()},
                "navigate_to": f"/customer/repairs/{repair.id}",
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "GET_TECHNICIAN_LOCATION":
            repair_id = slots.get("repair_id")
            repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first() if repair_id else None
            if not repair:
                repairs = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.updated_at.desc()).all()
                if len(repairs) > 1 and not slots.get("repair_id"):
                    context["last_mentioned_repairs"] = [r.id for r in repairs]
                    context["pending_selection_intent"] = intent
                    response_text = VoiceService._format_numbered_job_list(repairs, "the technician details")
                    return {
                        "success": True,
                        "response": response_text,
                        "intent": intent,
                        "context": context,
                    }
                repair = repairs[0] if repairs else None

            if not repair:
                return {"success": True, "response": "No repair request found.", "intent": intent, "context": context}

            context["current_repair_id"] = repair.id
            tech = repair.current_assignment.technician if repair.current_assignment else None
            tech_name = tech.user.name if (tech and tech.user) else None

            device_str = f" — {repair.device.brand} {repair.device.model}" if repair.device else ""
            if not tech_name:
                response = f"No technician has been assigned to Repair #{repair.id}{device_str} yet."
            else:
                response = f"{tech_name} is assigned to Repair #{repair.id}{device_str}."

            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {"technician": tech.to_dict() if tech else None, "repair_id": repair.id},
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "GET_QUOTATION":
            repair_id = slots.get("repair_id")
            repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first() if repair_id else None
            if not repair:
                repairs = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.updated_at.desc()).all()
                if len(repairs) > 1 and not slots.get("repair_id"):
                    context["last_mentioned_repairs"] = [r.id for r in repairs]
                    context["pending_selection_intent"] = intent
                    response_text = VoiceService._format_numbered_job_list(repairs, "the quotation")
                    return {
                        "success": True,
                        "response": response_text,
                        "intent": intent,
                        "context": context,
                    }
                repair = repairs[0] if repairs else None

            if not repair:
                return {"success": True, "response": "No repair request found.", "intent": intent, "context": context}

            context["current_repair_id"] = repair.id
            quotation = repair.quotation
            device_str = f" — {repair.device.brand} {repair.device.model}" if repair.device else ""
            if not quotation or quotation.status == "DRAFT":
                return {
                    "success": True,
                    "response": f"Repair #{repair.id}{device_str} does not have a final quotation yet.",
                    "intent": intent,
                    "context": context,
                }

            response = f"Repair #{repair.id}{device_str} has a quotation of ₹{quotation.total_amount:,.2f}."
            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {"quotation": quotation.to_dict()},
                "navigate_to": f"/customer/repairs/{repair.id}",
                "requires_confirmation": False,
                "context": context,
            }

        if intent in ("APPROVE_QUOTATION", "REJECT_QUOTATION"):
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first() if repair_id else None
            if not repair or not repair.quotation or repair.quotation.status != "SENT":
                return {"success": True, "response": "No pending quotation found awaiting approval.", "intent": intent, "context": context}

            action_type = "APPROVE" if intent == "APPROVE_QUOTATION" else "REJECT"
            context["pending_action"] = {
                "action": "QUOTATION_DECISION",
                "repair_id": repair.id,
                "decision": action_type,
                "amount": repair.quotation.total_amount,
            }
            return {
                "success": True,
                "response": f"You are about to {action_type.lower()} the quotation of ₹{repair.quotation.total_amount:.2f} for repair #{repair.id}. Should I proceed?",
                "intent": intent,
                "requires_confirmation": True,
                "confirmation_data": context["pending_action"],
                "context": context,
            }

        if intent == "GET_OTP":
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first() if repair_id else None
            if not repair:
                repair = RepairRequest.query.filter_by(customer_id=customer_id).filter(RepairRequest.status.in_(("ON_THE_WAY", "ACCEPTED"))).first()

            if not repair or not repair.otp:
                return {"success": True, "response": "Your handover OTP will be generated automatically once your technician starts travel.", "intent": intent, "context": context}

            context["current_repair_id"] = repair.id
            if repair.otp.is_verified:
                return {"success": True, "response": f"Your device handover OTP for repair #{repair.id} was already verified by the technician.", "intent": intent, "context": context}

            return {
                "success": True,
                "response": f"Your device handover OTP for repair #{repair.id} is {repair.otp.otp_code}. Please share this with your technician when they arrive.",
                "intent": intent,
                "data": {"otp": repair.otp.to_customer_dict()},
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "MAKE_PAYMENT":
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first() if repair_id else None
            if not repair:
                repair = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.updated_at.desc()).first()

            if not repair or not repair.quotation:
                return {"success": True, "response": "No quotation found to pay for.", "intent": intent, "context": context}

            quotation = repair.quotation
            if quotation.status != "APPROVED":
                return {"success": True, "response": f"Quotation for repair #{repair.id} is in '{quotation.status}' status and cannot be paid until approved.", "intent": intent, "context": context}
            if quotation.payment_status == "PAID":
                return {"success": True, "response": f"Quotation for repair #{repair.id} is already paid.", "intent": intent, "context": context}

            payment_method = slots.get("payment_method", "UPI")
            utr = slots.get("utr", f"VOICE-{int(datetime.now().timestamp())}")

            context["pending_action"] = {
                "action": "SUBMIT_PAYMENT",
                "repair_id": repair.id,
                "payment_method": payment_method,
                "utr": utr,
                "amount": quotation.total_amount,
            }
            return {
                "success": True,
                "response": f"You are about to submit a payment of ₹{quotation.total_amount:.2f} via {payment_method} for repair #{repair.id}. Should I proceed?",
                "intent": intent,
                "requires_confirmation": True,
                "confirmation_data": context["pending_action"],
                "context": context,
            }

        if intent == "GET_PAYMENT_STATUS":
            repair_id = slots.get("repair_id")
            repair = RepairRequest.query.filter_by(id=repair_id, customer_id=customer_id).first() if repair_id else None
            if not repair:
                repairs = RepairRequest.query.filter_by(customer_id=customer_id).order_by(RepairRequest.updated_at.desc()).all()
                if len(repairs) > 1 and not slots.get("repair_id"):
                    context["last_mentioned_repairs"] = [r.id for r in repairs]
                    context["pending_selection_intent"] = intent
                    response_text = VoiceService._format_numbered_job_list(repairs, "the payment status")
                    return {
                        "success": True,
                        "response": response_text,
                        "intent": intent,
                        "context": context,
                    }
                repair = repairs[0] if repairs else None

            if not repair:
                return {"success": True, "response": "No repair request found.", "intent": intent, "context": context}

            context["current_repair_id"] = repair.id
            quotation = repair.quotation
            device_str = f" — {repair.device.brand} {repair.device.model}" if repair.device else ""
            pay_status = (quotation.payment_status if quotation else None) or "Unpaid"
            if pay_status.upper() == "PAID":
                pay_status = "Paid"
            elif pay_status.upper() == "UNPAID":
                pay_status = "Unpaid"

            response = f"Repair #{repair.id}{device_str} has a payment status of {pay_status}."
            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {"quotation": quotation.to_dict() if quotation else None, "payment_status": pay_status},
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "CLEAR_FORM":
            return {
                "success": True,
                "response": "I have cleared all fields in your repair request form.",
                "intent": "CLEAR_FORM",
                "data": {"action": "clear_form"},
                "requires_confirmation": False,
                "context": context,
            }

        if intent in ("CREATE_REPAIR_REQUEST", "FILL_REPAIR_FORM"):
            active_statuses = (
                "REQUESTED",
                "APPROVED",
                "ASSIGNED",
                "ACCEPTED",
                "ON_THE_WAY",
                "DEVICE_RECEIVED",
                "REPAIRING",
                "PENDING_PARTS",
                "REPAIRED",
            )
            active_repair = (
                RepairRequest.query.filter_by(customer_id=customer_id)
                .filter(RepairRequest.status.in_(active_statuses))
                .first()
            )
            if active_repair:
                dev_name = f"{active_repair.device.brand} {active_repair.device.model}" if active_repair.device else "Device"
                return {
                    "success": True,
                    "response": f"You already have an active repair request (#{active_repair.id} for {dev_name}) currently in '{active_repair.status}' status. Only one active repair request is permitted from acceptance to completion.",
                    "intent": intent,
                    "navigate_to": f"/customer/repairs/{active_repair.id}",
                    "requires_confirmation": False,
                    "context": context,
                }

            form_fields = {}
            if slots.get("device_type"): form_fields["device_type"] = slots["device_type"]
            if slots.get("brand"): form_fields["brand"] = slots["brand"]
            if slots.get("model"): form_fields["model"] = slots["model"]
            if slots.get("preferred_date"): form_fields["preferred_date"] = slots["preferred_date"]
            if slots.get("preferred_time"): form_fields["preferred_time"] = slots["preferred_time"]
            if slots.get("problem_description"): form_fields["problem_description"] = slots["problem_description"]
            if slots.get("address"): form_fields["address"] = slots["address"]
            if slots.get("submit_form"): form_fields["submit_form"] = True

            updates = []
            if "device_type" in form_fields: updates.append(f"Device: {form_fields['device_type']}")
            if "brand" in form_fields: updates.append(f"Brand: {form_fields['brand']}")
            if "model" in form_fields: updates.append(f"Model: {form_fields['model']}")
            if "preferred_date" in form_fields: updates.append(f"Date: {form_fields['preferred_date']}")
            if "preferred_time" in form_fields: updates.append(f"Time: {form_fields['preferred_time']}")
            if "problem_description" in form_fields: updates.append(f"Problem: {form_fields['problem_description']}")
            if "address" in form_fields: updates.append(f"Address: {form_fields['address']}")

            if slots.get("submit_form"):
                if updates:
                    resp_text = f"Entered into form: {', '.join(updates)}. Submitting your repair request..."
                else:
                    resp_text = "Submitting your repair request..."
            elif updates:
                resp_text = f"Entered into form: {', '.join(updates)}. Please review all details on screen and click submit when ready."
            else:
                resp_text = "Opening the new repair request page. You can speak to select device type, brand, model, date, time, and problem."

            return {
                "success": True,
                "response": resp_text,
                "intent": "FILL_REPAIR_FORM" if form_fields else intent,
                "data": {"form_fields": form_fields} if form_fields else {},
                "navigate_to": "/customer/repairs/new",
                "requires_confirmation": False,
                "context": context,
            }

        return {
            "success": True,
            "response": "I didn't quite understand that. You can ask me about your repair status, technician location, quotation, OTP, or ask to book a repair.",
            "intent": "UNKNOWN_REQUEST",
            "requires_confirmation": False,
            "context": context,
        }

    # =========================================================================
    # TECHNICIAN INTENT HANDLERS
    # =========================================================================
    @staticmethod
    def _handle_technician_intent(user: User, intent: str, slots: Dict[str, Any], text: str, context: Dict[str, Any]) -> Dict[str, Any]:
        technician = Technician.query.filter_by(user_id=user.id).first()
        if not technician:
            return {"success": False, "response": "Technician profile not found.", "intent": "ERROR", "context": context}

        if intent == "HELP":
            return {
                "success": True,
                "response": "You can ask to view pending jobs, available requests to accept, start travel, complete repairs, verify customer OTP, or toggle your availability.",
                "intent": intent,
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "NAVIGATE_PAGE":
            page = slots.get("page", "dashboard")
            route_map = {"dashboard": "/technician/dashboard", "jobs": "/technician/jobs", "progress": "/technician/progress"}
            return {
                "success": True,
                "response": f"Opening {page}.",
                "intent": intent,
                "navigate_to": route_map.get(page, "/technician/dashboard"),
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "GET_PENDING_JOBS":
            repair_ids = [a.repair_request_id for a in technician.assignments]
            repairs = RepairRequest.query.filter(RepairRequest.id.in_(repair_ids)).order_by(RepairRequest.updated_at.desc()).all() if repair_ids else []
            active_jobs = [r for r in repairs if r.status not in ("COMPLETED", "REJECTED")]
            context["last_mentioned_repairs"] = [r.id for r in active_jobs]
            if active_jobs:
                context["current_repair_id"] = active_jobs[0].id

            if not active_jobs:
                return {
                    "success": True,
                    "response": "You have no active assigned jobs right now. You can check available requests to accept a new job.",
                    "intent": intent,
                    "requires_confirmation": False,
                    "context": context,
                }

            job_summaries = [f"Job #{r.id} ({r.device.brand} {r.device.model} - {r.status})" for r in active_jobs[:3]]
            return {
                "success": True,
                "response": f"You have {len(active_jobs)} active job{'s' if len(active_jobs) != 1 else ''}: {', '.join(job_summaries)}.",
                "intent": intent,
                "data": {"jobs": [r.to_dict(include_relations=False) for r in active_jobs]},
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "GET_AVAILABLE_JOBS":
            avail = get_available_repair_requests()
            context["last_mentioned_repairs"] = [r.id for r in avail]
            if avail:
                context["current_repair_id"] = avail[0].id
                job_list = ", ".join([f"Job #{r.id} for {r.device.brand} ({r.problem_description[:25]})" for r in avail[:3]])
                return {
                    "success": True,
                    "response": f"There are {len(avail)} available jobs waiting: {job_list}. Would you like to accept one?",
                    "intent": intent,
                    "data": {"available_jobs": [r.to_dict(include_relations=False) for r in avail]},
                    "requires_confirmation": False,
                    "context": context,
                }
            else:
                return {"success": True, "response": "There are no unassigned repair requests waiting right now.", "intent": intent, "requires_confirmation": False, "context": context}

        if intent == "ACCEPT_JOB":
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            if not repair_id:
                avail = get_available_repair_requests()
                if avail:
                    repair_id = avail[0].id

            if not repair_id:
                return {"success": True, "response": "Please specify the job ID you would like to accept.", "intent": intent, "context": context}

            repair = db.session.get(RepairRequest, repair_id)
            if not repair or repair.status not in ("REQUESTED", "APPROVED", "ASSIGNED"):
                return {"success": True, "response": f"Repair #{repair_id} is not available to be accepted.", "intent": intent, "context": context}

            context["pending_action"] = {"action": "ACCEPT_JOB", "repair_id": repair.id, "technician_id": technician.id}
            return {
                "success": True,
                "response": f"You are about to accept job #{repair.id} ({repair.device.brand} {repair.device.model}). Should I proceed?",
                "intent": intent,
                "requires_confirmation": True,
                "confirmation_data": context["pending_action"],
                "context": context,
            }

        if intent == "START_TRAVEL":
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            owned = [a.repair_request for a in technician.assignments if a.repair_request.status in ("ASSIGNED", "ACCEPTED")]
            repair = next((r for r in owned if r.id == repair_id), None) if repair_id else (owned[0] if owned else None)

            if not repair:
                return {"success": True, "response": "No accepted jobs found ready for travel.", "intent": intent, "context": context}

            context["pending_action"] = {"action": "START_TRAVEL", "repair_id": repair.id}
            return {
                "success": True,
                "response": f"You are about to start travel for repair #{repair.id} to {repair.address}. This will generate customer handover OTP. Should I proceed?",
                "intent": intent,
                "requires_confirmation": True,
                "confirmation_data": context["pending_action"],
                "context": context,
            }

        if intent == "COMPLETE_JOB":
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            owned = [a.repair_request for a in technician.assignments if a.repair_request.status == "REPAIRING"]
            repair = next((r for r in owned if r.id == repair_id), None) if repair_id else (owned[0] if owned else None)

            if not repair:
                return {"success": True, "response": "No active repair in 'REPAIRING' status found to complete.", "intent": intent, "context": context}

            context["pending_action"] = {"action": "COMPLETE_JOB", "repair_id": repair.id}
            return {
                "success": True,
                "response": f"You are about to mark repair #{repair.id} as COMPLETED. Should I proceed?",
                "intent": intent,
                "requires_confirmation": True,
                "confirmation_data": context["pending_action"],
                "context": context,
            }

        if intent == "VERIFY_OTP":
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            otp_code = slots.get("otp")
            if not repair_id or not otp_code:
                return {"success": True, "response": "Please provide the 6-digit OTP received from the customer.", "intent": intent, "context": context}

            result = verify_otp_for_job(repair_id, otp_code)
            if result.get("success"):
                return {
                    "success": True,
                    "response": f"OTP verified successfully for repair #{repair_id}. You may now collect the device and begin service.",
                    "intent": intent,
                    "data": result,
                    "context": context,
                }
            else:
                return {"success": False, "response": f"OTP verification failed: {result.get('message', 'Invalid code')}.", "intent": intent, "context": context}

        if intent == "GET_CUSTOMER_DETAILS":
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            repair = db.session.get(RepairRequest, repair_id) if repair_id else (technician.assignments[-1].repair_request if technician.assignments else None)

            if not repair:
                return {"success": True, "response": "No assigned job found.", "intent": intent, "context": context}

            cust = repair.customer
            response = f"Job #{repair.id} Customer is {cust.name}. Phone: {cust.phone or 'Not listed'}. Address: {repair.address}. Preferred slot: {repair.preferred_date} {repair.preferred_time}."
            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {"customer": cust.to_dict(), "repair": repair.to_dict()},
                "navigate_to": f"/technician/jobs/{repair.id}",
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "SET_AVAILABILITY":
            target = slots.get("availability_status", "AVAILABLE")
            technician.availability_status = target
            db.session.commit()
            return {"success": True, "response": f"Your availability status is now set to {target}.", "intent": intent, "requires_confirmation": False, "context": context}

        return {
            "success": True,
            "response": "I didn't understand that command. You can ask for pending jobs, start travel, complete a repair, or verify customer OTP.",
            "intent": "UNKNOWN_REQUEST",
            "requires_confirmation": False,
            "context": context,
        }

    # =========================================================================
    # ADMIN INTENT HANDLERS
    # =========================================================================
    @staticmethod
    def _handle_admin_intent(user: User, intent: str, slots: Dict[str, Any], text: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if intent == "HELP":
            return {
                "success": True,
                "response": "As an admin, you can ask for today's statistics, list active or pending repair requests, check technician availability, or approve/reject requests.",
                "intent": intent,
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "NAVIGATE_PAGE":
            page = slots.get("page", "dashboard")
            route_map = {"dashboard": "/admin/dashboard", "requests": "/admin/requests", "technicians": "/admin/technicians"}
            return {
                "success": True,
                "response": f"Opening {page}.",
                "intent": intent,
                "navigate_to": route_map.get(page, "/admin/dashboard"),
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "GET_ADMIN_STATISTICS":
            total_customers = User.query.filter_by(role="CUSTOMER").count()
            total_technicians = User.query.filter_by(role="TECHNICIAN").count()
            pending_requests = RepairRequest.query.filter_by(status="REQUESTED").count()
            active_repairs = RepairRequest.query.filter(
                RepairRequest.status.in_(("ASSIGNED", "ACCEPTED", "ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING"))
            ).count()
            completed_repairs = RepairRequest.query.filter_by(status="COMPLETED").count()
            available_techs = len(get_available_technicians())

            response = f"System Overview: {pending_requests} pending requests, {active_repairs} active repairs, {completed_repairs} completed. {available_techs} of {total_technicians} technicians are currently available."
            return {
                "success": True,
                "response": response,
                "intent": intent,
                "data": {
                    "pending": pending_requests,
                    "active": active_repairs,
                    "completed": completed_repairs,
                    "technicians_available": available_techs,
                    "total_technicians": total_technicians,
                    "total_customers": total_customers,
                },
                "requires_confirmation": False,
                "context": context,
            }

        if intent == "LIST_ALL_REPAIRS":
            filter_status = slots.get("status_filter")
            query = RepairRequest.query
            if filter_status:
                if filter_status == "ACTIVE":
                    query = query.filter(RepairRequest.status.in_(("ASSIGNED", "ACCEPTED", "ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING")))
                else:
                    query = query.filter_by(status=filter_status)

            repairs = query.order_by(RepairRequest.created_at.desc()).limit(5).all()
            context["last_mentioned_repairs"] = [r.id for r in repairs]
            if repairs:
                context["current_repair_id"] = repairs[0].id
                summary = ", ".join([f"#{r.id} ({r.device.brand} {r.status})" for r in repairs[:3]])
                return {
                    "success": True,
                    "response": f"Found {len(repairs)} recent repair requests: {summary}.",
                    "intent": intent,
                    "data": {"repairs": [r.to_dict(include_relations=False) for r in repairs]},
                    "navigate_to": "/admin/requests",
                    "requires_confirmation": False,
                    "context": context,
                }
            else:
                return {"success": True, "response": "No repair requests found matching the criteria.", "intent": intent, "requires_confirmation": False, "context": context}

        if intent == "LIST_TECHNICIANS":
            avail_only = slots.get("available_only", False)
            if avail_only:
                techs = get_available_technicians()
                desc = f"{len(techs)} technicians currently available."
            else:
                techs = Technician.query.all()
                desc = f"Total {len(techs)} registered technicians."

            names = ", ".join([t.user.name if t.user else f"Technician #{t.id}" for t in techs[:4]])
            return {
                "success": True,
                "response": f"{desc} {f'Including: {names}' if names else ''}",
                "intent": intent,
                "data": {"technicians": [t.to_dict() for t in techs]},
                "navigate_to": "/admin/technicians",
                "requires_confirmation": False,
                "context": context,
            }

        if intent in ("APPROVE_REPAIR", "REJECT_REPAIR"):
            repair_id = slots.get("repair_id") or context.get("current_repair_id")
            if not repair_id:
                return {"success": True, "response": "Please specify which repair request ID to process.", "intent": intent, "context": context}
            repair = db.session.get(RepairRequest, repair_id)
            if not repair:
                return {"success": False, "response": f"Repair #{repair_id} not found.", "intent": intent, "context": context}

            action_type = "APPROVE" if intent == "APPROVE_REPAIR" else "REJECT"
            context["pending_action"] = {"action": "ADMIN_REPAIR_DECISION", "repair_id": repair.id, "decision": action_type}
            return {
                "success": True,
                "response": f"You are about to {action_type.lower()} repair #{repair.id}. Should I proceed?",
                "intent": intent,
                "requires_confirmation": True,
                "confirmation_data": context["pending_action"],
                "context": context,
            }

        return {
            "success": True,
            "response": "Command not recognized. You can ask for statistics, list repair requests, or view technician status.",
            "intent": "UNKNOWN_REQUEST",
            "requires_confirmation": False,
            "context": context,
        }

    # =========================================================================
    # CONFIRMED ACTION EXECUTION ENGINE
    # =========================================================================
    @staticmethod
    def execute_confirmed_action(user: User, pending_action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        action_name = pending_action.get("action")
        context["pending_action"] = None

        if action_name == "CREATE_REPAIR":
            if user.role != "CUSTOMER":
                return {"success": False, "response": "Only customers can create repairs.", "context": context}

            device = Device()  # type: ignore
            device.customer_id = user.id
            device.device_type = pending_action.get("device_type", "Smartphone")
            device.brand = pending_action.get("brand", "Samsung")
            device.model = pending_action.get("model", "Galaxy")
            db.session.add(device)
            db.session.flush()

            user_address = getattr(user, "address", None) or "Customer Address"
            repair = RepairRequest()  # type: ignore
            repair.customer_id = user.id
            repair.device_id = device.id
            repair.problem_description = pending_action.get("problem_description", "Diagnostic and repair")
            repair.preferred_date = pending_action.get("preferred_date", datetime.now().strftime("%Y-%m-%d"))
            repair.preferred_time = pending_action.get("preferred_time", "10:00 AM - 01:00 PM")
            repair.address = pending_action.get("address", user_address)
            repair.status = "REQUESTED"
            db.session.add(repair)
            db.session.flush()

            history = RepairStatusHistory()  # type: ignore
            history.repair_request_id = repair.id
            history.status = "REQUESTED"
            history.changed_by = user.id
            history.remarks = "Created via Voice Assistant"
            db.session.add(history)

            announce_new_request(repair)
            db.session.commit()

            context["current_repair_id"] = repair.id
            return {
                "success": True,
                "response": f"Your repair request #{repair.id} for {device.brand} {device.model} has been created successfully! Available technicians have been notified.",
                "intent": "CREATE_REPAIR_CONFIRMED",
                "data": {"repair": repair.to_dict()},
                "navigate_to": f"/customer/repairs/{repair.id}",
                "context": context,
            }

        if action_name == "ACCEPT_JOB":
            if user.role != "TECHNICIAN":
                return {"success": False, "response": "Only technicians can accept jobs.", "context": context}

            technician = Technician.query.filter_by(user_id=user.id).first()
            if not technician:
                return {"success": False, "response": "Technician profile not found.", "context": context}

            repair_id = pending_action.get("repair_id")
            repair = db.session.get(RepairRequest, repair_id)
            if not repair:
                return {"success": False, "response": f"Repair #{repair_id} not found.", "context": context}

            try:
                if repair.status == "ASSIGNED":
                    change_status(repair, "ACCEPTED", user.id, remarks="Technician accepted job via Voice Assistant")
                    if repair.current_assignment:
                        repair.current_assignment.accepted_at = datetime.now(timezone.utc)
                    technician.availability_status = "BUSY"
                    db.session.commit()
                else:
                    if technician.availability_status != "AVAILABLE":
                        technician.availability_status = "AVAILABLE"
                        db.session.flush()
                    claim_repair_request(repair_id, technician)
                    db.session.commit()

                context["current_repair_id"] = repair_id
                context["pending_action"] = None
                dev_brand = repair.device.brand if (repair.device and repair.device.brand) else "device"
                dev_model = repair.device.model if (repair.device and repair.device.model) else ""
                dev_info = f"{dev_brand} {dev_model}".strip()

                return {
                    "success": True,
                    "response": f"Job #{repair_id} ({dev_info}) has been successfully accepted and added to your active jobs list.",
                    "intent": "ACCEPT_JOB_CONFIRMED",
                    "data": {"job": repair.to_dict() if repair else {}},
                    "navigate_to": f"/technician/jobs/{repair_id}",
                    "context": context,
                }
            except Exception as e:
                db.session.rollback()
                return {"success": False, "response": f"Could not accept job: {str(e)}", "context": context}

        if action_name == "START_TRAVEL":
            if user.role != "TECHNICIAN":
                return {"success": False, "response": "Unauthorized action.", "context": context}

            technician = Technician.query.filter_by(user_id=user.id).first()
            repair_id = pending_action.get("repair_id")
            repair = db.session.get(RepairRequest, repair_id)
            if not repair:
                return {"success": False, "response": "Repair not found.", "context": context}

            otp_record, _ = generate_otp_on_start_travel(repair_id)
            try:
                change_status(repair, "ON_THE_WAY", user.id, remarks="Technician on the way (Voice Assistant)")
                db.session.commit()
                context["current_repair_id"] = repair_id
                return {
                    "success": True,
                    "response": f"Travel started for repair #{repair_id}. Customer handover OTP has been generated.",
                    "intent": "START_TRAVEL_CONFIRMED",
                    "data": {"repair": repair.to_dict(), "otp_status": otp_record.to_technician_dict()},
                    "navigate_to": f"/technician/jobs/{repair_id}",
                    "context": context,
                }
            except InvalidTransitionError as e:
                db.session.rollback()
                return {"success": False, "response": str(e), "context": context}

        if action_name == "COMPLETE_JOB":
            if user.role != "TECHNICIAN":
                return {"success": False, "response": "Unauthorized action.", "context": context}

            technician = Technician.query.filter_by(user_id=user.id).first()
            repair_id = pending_action.get("repair_id")
            repair = db.session.get(RepairRequest, repair_id)
            if not repair:
                return {"success": False, "response": "Repair not found.", "context": context}

            try:
                change_status(repair, "COMPLETED", user.id, remarks="Repair completed (Voice Assistant)")
                if repair.current_assignment:
                    repair.current_assignment.completed_at = datetime.now(timezone.utc)
                release_technician(technician)
                db.session.commit()
                context["current_repair_id"] = repair_id
                return {
                    "success": True,
                    "response": f"Repair #{repair_id} has been marked as COMPLETED. Great job!",
                    "intent": "COMPLETE_JOB_CONFIRMED",
                    "data": {"repair": repair.to_dict()},
                    "navigate_to": "/technician/dashboard",
                    "context": context,
                }
            except InvalidTransitionError as e:
                db.session.rollback()
                return {"success": False, "response": str(e), "context": context}

        if action_name == "SUBMIT_PAYMENT":
            if user.role != "CUSTOMER":
                return {"success": False, "response": "Unauthorized action.", "context": context}

            repair_id = pending_action.get("repair_id")
            repair = db.session.get(RepairRequest, repair_id)
            if not repair or not repair.quotation:
                return {"success": False, "response": "Quotation not found.", "context": context}

            quotation: Any = repair.quotation
            payment_method = pending_action.get("payment_method", "UPI")
            utr = pending_action.get("utr")

            quotation.payment_method = payment_method
            quotation.utr = utr if payment_method != "CASH" else None
            quotation.payment_status = "PENDING_VERIFICATION"
            quotation.payment_date = datetime.now(timezone.utc)

            if quotation.technician and quotation.technician.user_id:
                notify(
                    user_id=quotation.technician.user_id,
                    title="Payment Submitted",
                    message=f"Customer submitted payment for repair #{repair.id} via {payment_method}.",
                    notif_type="PAYMENT",
                    repair_id=repair.id,
                )

            db.session.commit()
            return {
                "success": True,
                "response": f"Your payment of ₹{quotation.total_amount:.2f} has been submitted and is pending verification.",
                "intent": "PAYMENT_CONFIRMED",
                "data": {"quotation": quotation.to_dict()},
                "navigate_to": f"/customer/repairs/{repair.id}",
                "context": context,
            }

        if action_name == "QUOTATION_DECISION":
            repair_id = pending_action.get("repair_id")
            decision = pending_action.get("decision")
            repair = db.session.get(RepairRequest, repair_id)
            if not repair or not repair.quotation:
                return {"success": False, "response": "Quotation not found.", "context": context}

            quotation: Any = repair.quotation
            new_status = "APPROVED" if decision == "APPROVE" else "REJECTED"
            quotation.status = new_status
            if quotation.technician and quotation.technician.user_id:
                notify(
                    user_id=quotation.technician.user_id,
                    title=f"Quotation {new_status.lower()}",
                    message=f"Customer {new_status.lower()} your quotation for repair #{repair.id}.",
                    notif_type="QUOTATION",
                    repair_id=repair.id,
                )
            db.session.commit()
            return {
                "success": True,
                "response": f"Quotation for repair #{repair.id} has been {new_status.lower()}.",
                "intent": "QUOTATION_DECISION_CONFIRMED",
                "data": {"quotation": repair.quotation.to_dict()},
                "context": context,
            }

        if action_name == "ADMIN_REPAIR_DECISION":
            repair_id = pending_action.get("repair_id")
            decision = pending_action.get("decision")
            repair = db.session.get(RepairRequest, repair_id)
            if not repair:
                return {"success": False, "response": "Repair not found.", "context": context}

            new_status = "APPROVED" if decision == "APPROVE" else "REJECTED"
            try:
                change_status(repair, new_status, user.id, remarks=f"Admin {new_status.lower()} via Voice")
                db.session.commit()
                return {
                    "success": True,
                    "response": f"Repair request #{repair_id} has been {new_status.lower()}.",
                    "intent": "ADMIN_DECISION_CONFIRMED",
                    "data": {"repair": repair.to_dict()},
                    "context": context,
                }
            except InvalidTransitionError as e:
                db.session.rollback()
                return {"success": False, "response": str(e), "context": context}

        return {"success": False, "response": "Unrecognized action.", "context": context}
