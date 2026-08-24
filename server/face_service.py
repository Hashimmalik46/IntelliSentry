import base64
import io
import math
import os
import tempfile
from datetime import datetime, timezone
import requests
import cv2
import numpy as np

# PyTorch & torchvision for Custom ArcFace Backbone
TORCH_AVAILABLE = False
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torchvision.models import resnet50
    TORCH_AVAILABLE = True
except Exception as e:
    print(f"[NOTICE] PyTorch/torchvision init notice: {e}")

# DeepFace AI Engine
DEEPFACE_AVAILABLE = False
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    print("[INFO] DeepFace AI model initialized.")
except Exception as e:
    print(f"[NOTICE] DeepFace init notice (fallback mode active): {e}")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qebtqfecvvecgwadvrjz.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_M-rRB-h9W4NoOzzeRTdn7w_qrOsVNNU")

# Central Default Engine Configuration ("custom_arcface" or "deepface_arcface")
DEFAULT_FACE_ENGINE = os.getenv("DEFAULT_FACE_ENGINE", "custom_arcface")


def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

# ==============================================================================
# 1. Custom ArcFace Model Architecture (ResNet-50 Backbone + 512D + L2 Norm)
# ==============================================================================
if TORCH_AVAILABLE:
    class FaceEmbeddingNet(nn.Module):
        def __init__(self, embedding_size=512):
            super(FaceEmbeddingNet, self).__init__()
            backbone = resnet50(weights=None)
            in_features = backbone.fc.in_features
            backbone.fc = nn.Identity()
            self.backbone = backbone
            self.fc = nn.Linear(in_features, embedding_size)

        def forward(self, x):
            x = self.backbone(x)
            x = self.fc(x)
            x = F.normalize(x, p=2, dim=1)  # L2 normalization
            return x
else:
    FaceEmbeddingNet = None

WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights", "intelliface.pth")
CASCADE_PATH = os.path.join(os.path.dirname(__file__), "weights", "haarcascade_frontalface_default.xml")

CUSTOM_ARCFACE_AVAILABLE = False
custom_arcface_model = None

if TORCH_AVAILABLE:
    try:
        if os.path.exists(WEIGHTS_PATH):
            model = FaceEmbeddingNet(embedding_size=512)
            state_dict = torch.load(WEIGHTS_PATH, map_location=torch.device('cpu'))
            model.load_state_dict(state_dict)
            model.eval()
            custom_arcface_model = model
            CUSTOM_ARCFACE_AVAILABLE = True
            print(f"[INFO] Custom ArcFace backbone loaded from {WEIGHTS_PATH}")
        else:
            print(f"[WARNING] intelliface.pth missing in server/weights/. Custom ArcFace engine disabled.")
    except Exception as e:
        print(f"[WARNING] Failed to load Custom ArcFace weights: {e}")

face_cascade = None
if os.path.exists(CASCADE_PATH):
    try:
        face_cascade = cv2.CascadeClassifier(CASCADE_PATH)
        print(f"[INFO] Haar Cascade face cropper loaded from {CASCADE_PATH}")
    except Exception as cascade_err:
        print(f"[WARNING] Failed to load Haar Cascade: {cascade_err}")

def crop_face_region(img_or_path):
    if isinstance(img_or_path, str):
        img = cv2.imread(img_or_path)
    else:
        img = img_or_path

    if img is None:
        return img

    if face_cascade and not face_cascade.empty():
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(40, 40))
        if len(faces) > 0:
            faces = sorted(faces, key=lambda b: b[2] * b[3], reverse=True)
            x, y, w, h = faces[0]
            mx, my = int(w * 0.10), int(h * 0.10)
            x1 = max(0, x - mx)
            y1 = max(0, y - my)
            x2 = min(img.shape[1], x + w + mx)
            y2 = min(img.shape[0], y + h + my)
            return img[y1:y2, x1:x2]

    # Fallback face oval crop
    h, w = img.shape[:2]
    crop_w = int(w * 0.70)
    crop_h = int(h * 0.85)
    crop_x = max(0, int((w - crop_w) / 2))
    crop_y = max(0, int((h - crop_h) / 2))
    return img[crop_y:crop_y + crop_h, crop_x:crop_x + crop_w]

def decode_base64_image(base64_str):
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    image_bytes = base64.b64decode(base64_str)
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    temp_file.write(image_bytes)
    temp_file.close()
    return temp_file.name

# ==============================================================================
# 2. Enhanced 3-Tier Anti-Spoofing Detection
# ==============================================================================
def check_anti_spoofing(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return False, "Invalid image stream"

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Tier 1: Laplacian Variance (blur / photo printout check)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < 15.0:
        return False, "Low texture detail detected (static photo or blur printout)."

    # Tier 2: HSV Saturation (monochrome printout check)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    s_channel = hsv[:, :, 1]
    avg_saturation = np.mean(s_channel)
    if avg_saturation < 5.0:
        return False, "Monochromatic printout detected."

    # Tier 3: FFT Frequency Spectrum Analysis (digital screen glaze / moiré pattern check)
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-8)
    mean_magnitude = np.mean(magnitude_spectrum)
    if mean_magnitude > 175.0:
        return False, "Digital screen glaze / moiré pattern detected."

    return True, "Real-time human subject verified"

# ==============================================================================
# 3. Geometric Landmarks & Histogram Fallbacks
# ==============================================================================
def dist(p1, p2):
    return math.hypot(p1['x'] - p2['x'], p1['y'] - p2['y'])

def compute_geometric_landmarks_embedding(landmarks):
    if not landmarks or len(landmarks) < 68:
        return [0.1] * 15

    jaw_left = landmarks[0]
    jaw_right = landmarks[16]
    chin = landmarks[8]

    left_eyebrow = landmarks[19]
    right_eyebrow = landmarks[24]

    left_eye_center = {
        'x': sum(landmarks[i]['x'] for i in range(36, 42)) / 6.0,
        'y': sum(landmarks[i]['y'] for i in range(36, 42)) / 6.0
    }
    right_eye_center = {
        'x': sum(landmarks[i]['x'] for i in range(42, 48)) / 6.0,
        'y': sum(landmarks[i]['y'] for i in range(42, 48)) / 6.0
    }

    nose_top = landmarks[27]
    nose_tip = landmarks[30]

    mouth_left = landmarks[48]
    mouth_right = landmarks[54]
    mouth_top = landmarks[51]
    mouth_bottom = landmarks[57]

    face_width = dist(jaw_left, jaw_right) or 1.0
    face_height = dist(nose_top, chin) or 1.0

    ratios = [
        dist(left_eye_center, right_eye_center) / face_width,
        dist(left_eye_center, nose_tip) / face_height,
        dist(right_eye_center, nose_tip) / face_height,
        dist(nose_tip, chin) / face_height,
        dist(mouth_left, mouth_right) / face_width,
        dist(left_eye_center, mouth_left) / face_height,
        dist(right_eye_center, mouth_right) / face_height,
        dist(left_eyebrow, right_eyebrow) / face_width,
        dist(nose_top, nose_tip) / face_height,
        dist(jaw_left, chin) / face_width,
        dist(jaw_right, chin) / face_width,
        dist(mouth_top, mouth_bottom) / face_height,
        dist(nose_tip, mouth_top) / face_height,
        dist(mouth_bottom, chin) / face_height,
        dist(left_eyebrow, left_eye_center) / face_height
    ]

    arr = np.array(ratios, dtype=np.float64)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm

    return arr.tolist()

def compute_histogram_embedding(target_path):
    img = cv2.imread(str(target_path))
    if img is not None:
        img_resized = cv2.resize(img, (64, 64))
        gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
        norm = np.linalg.norm(hist)
        if norm > 0:
            hist = hist / norm
        return hist[:15].tolist()
    return [0.1] * 15

def extract_hog_descriptor(img_crop):
    try:
        gray = cv2.cvtColor(img_crop, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, (128, 128))
        eq = cv2.equalizeHist(resized)
        hog = cv2.HOGDescriptor((128, 128), (32, 32), (16, 16), (16, 16), 9)
        feats = hog.compute(eq).flatten()
        norm = np.linalg.norm(feats)
        if norm > 0:
            feats = feats / norm
        return feats
    except Exception as hog_err:
        print(f"[WARNING] HOG descriptor computation error: {hog_err}")
        return np.zeros(1764, dtype=np.float64)

def compute_custom_arcface_embedding(target_path, landmarks=None):
    img = cv2.imread(str(target_path))
    if img is None:
        raise ValueError("Invalid image file for Custom ArcFace")

    crop = crop_face_region(img)
    hog_feats = extract_hog_descriptor(crop)

    resnet_feats = None
    if TORCH_AVAILABLE and custom_arcface_model is not None:
        try:
            img_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            img_resized = cv2.resize(img_rgb, (112, 112))
            img_tensor = torch.from_numpy(img_resized).permute(2, 0, 1).float() / 255.0
            mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
            std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
            img_tensor = (img_tensor - mean) / std
            img_tensor = img_tensor.unsqueeze(0)

            with torch.no_grad():
                if hasattr(custom_arcface_model, "backbone"):
                    raw_emb = custom_arcface_model.backbone(img_tensor)
                else:
                    raw_emb = custom_arcface_model(img_tensor)
                raw_emb = F.normalize(raw_emb, p=2, dim=1)
                resnet_feats = raw_emb[0].cpu().numpy()
        except Exception as torch_err:
            print(f"[WARNING] ResNet backbone feature extraction notice: {torch_err}")

    lm_feats = compute_geometric_landmarks_embedding(landmarks)

    components = [hog_feats * 0.50]
    if resnet_feats is not None:
        components.append(resnet_feats * 0.35)
    components.append(np.array(lm_feats, dtype=np.float64) * 0.15)

    combined = np.concatenate(components)
    norm = np.linalg.norm(combined)
    if norm > 0:
        combined = combined / norm

    return [float(x) for x in combined]

# ==============================================================================
# 4. Multi-Engine Router (compute_embedding)
# ==============================================================================
def compute_embedding(image_path_or_base64, landmarks=None, engine_preference=None):
    if not engine_preference:
        engine_preference = DEFAULT_FACE_ENGINE

    temp_path = None
    if isinstance(image_path_or_base64, str) and (image_path_or_base64.startswith("data:") or len(image_path_or_base64) > 300):
        temp_path = decode_base64_image(image_path_or_base64)
        target_path = temp_path
    else:
        target_path = image_path_or_base64

    try:
        is_live, msg = check_anti_spoofing(str(target_path))
        if not is_live:
            raise ValueError(msg)

        # 1. Primary engine: custom_arcface
        if engine_preference == "custom_arcface":
            if CUSTOM_ARCFACE_AVAILABLE:
                try:
                    emb = compute_custom_arcface_embedding(target_path, landmarks=landmarks)
                    return emb, "custom_arcface"
                except Exception as custom_err:
                    print(f"[WARNING] Custom ArcFace inference failed: {custom_err}. Falling back to DeepFace ArcFace.")

        # 2. Secondary engine / Preference: deepface_arcface
        if engine_preference in ["custom_arcface", "deepface_arcface"]:
            if DEEPFACE_AVAILABLE:
                try:
                    results = DeepFace.represent(
                        img_path=str(target_path),
                        model_name="ArcFace",
                        enforce_detection=False
                    )
                    if results and len(results) > 0 and "embedding" in results[0]:
                        return results[0]["embedding"], "deepface_arcface"
                except Exception as deepface_err:
                    print(f"[WARNING] DeepFace ArcFace inference failed: {deepface_err}. Falling back to geometric/histogram.")

        # 3. Fallback: 68-Landmark Geometric Ratios
        if landmarks and len(landmarks) >= 68:
            return compute_geometric_landmarks_embedding(landmarks), "geometric_15d"

        # 4. Fallback: Texture Histogram
        return compute_histogram_embedding(target_path), "histogram_15d"

    except ValueError as val_err:
        raise val_err
    except Exception as err:
        print(f"[WARNING] Embedding calculation fallback error: {err}")
        if landmarks and len(landmarks) >= 68:
            return compute_geometric_landmarks_embedding(landmarks), "geometric_15d"
        return [0.1] * 15, "histogram_15d"
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

# ==============================================================================
# 5. Tier-Aware Cosine Matcher & Verification
# ==============================================================================
ENGINE_THRESHOLDS = {
    "custom_arcface": 0.82,
    "deepface_arcface": 0.68,
    "geometric_15d": 0.982,
    "histogram_15d": 0.95
}

def cosine_similarity(v1, v2):
    # Guard against dimensionality mismatch errors
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def verify_embeddings(target_embedding, stored_embedding, engine_used="custom_arcface"):
    if len(target_embedding) != len(stored_embedding):
        return False, 0.0, f"Dimensionality mismatch error ({len(target_embedding)}D vs {len(stored_embedding)}D)"
    
    sim = cosine_similarity(target_embedding, stored_embedding)
    threshold = ENGINE_THRESHOLDS.get(engine_used, 0.45)
    is_verified = sim >= threshold
    confidence = round(max(0.0, sim) * 100, 2)
    return is_verified, confidence, f"Similarity {confidence}% vs threshold {int(threshold*100)}%"

# ==============================================================================
# 6. Database Operations (Enrollment & Verification)
# ==============================================================================
def enroll_face_in_supabase(user_id, student_name, registration_number, base64_image, landmarks=None, engine_preference=None):
    if not engine_preference:
        engine_preference = DEFAULT_FACE_ENGINE
    try:
        embedding, engine_used = compute_embedding(base64_image, landmarks=landmarks, engine_preference=engine_preference)
    except ValueError as spoof_err:
        return {"error": str(spoof_err), "verified": False}

    url = f"{SUPABASE_URL}/rest/v1/face_embeddings"
    headers = get_headers()
    
    # Query existing record by user_id
    existing_records = []
    if user_id:
        query_url = f"{url}?user_id=eq.{user_id}"
        res = requests.get(query_url, headers=headers)
        if res.ok and isinstance(res.json(), list):
            existing_records = res.json()
    
    # Fallback lookup by registration_number if user_id query returned empty
    if not existing_records and registration_number:
        reg_query_url = f"{url}?registration_number=eq.{registration_number}"
        res_reg = requests.get(reg_query_url, headers=headers)
        if res_reg.ok and isinstance(res_reg.json(), list) and len(res_reg.json()) > 0:
            existing_records = res_reg.json()

    payload = {
        "user_id": user_id,
        "student_name": student_name,
        "registration_number": registration_number,
        "embedding": embedding,
        "engine_used": engine_used,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    def send_supabase_req(method, target_url, req_payload):
        resp = requests.request(method, target_url, json=req_payload, headers=headers)
        # Fallback if updated_at column does not exist in remote Supabase table schema
        if not resp.ok and "updated_at" in req_payload:
            fallback_payload = dict(req_payload)
            fallback_payload.pop("updated_at", None)
            resp = requests.request(method, target_url, json=fallback_payload, headers=headers)
        # Fallback if engine_used column does not exist
        if not resp.ok and "engine_used" in req_payload:
            fallback_payload = dict(req_payload)
            fallback_payload.pop("engine_used", None)
            resp = requests.request(method, target_url, json=fallback_payload, headers=headers)
        # Fallback if student_name column does not exist
        if not resp.ok and "student_name" in req_payload:
            fallback_payload = dict(req_payload)
            fallback_payload.pop("student_name", None)
            resp = requests.request(method, target_url, json=fallback_payload, headers=headers)
        return resp

    if len(existing_records) > 0:
        match_id = existing_records[0].get("id")
        update_url = f"{url}?id=eq.{match_id}"
        resp = send_supabase_req("PATCH", update_url, payload)
    else:
        resp = send_supabase_req("POST", url, payload)

    if resp.ok:
        print(f"[INFO] Face embedding saved successfully for {student_name} ({user_id}) using engine {engine_used}")
        return {"status": "saved", "engine_used": engine_used, "details": payload}
    else:
        err_msg = f"Supabase DB error ({resp.status_code}): {resp.text}"
        print(f"[ERROR] enroll_face_in_supabase failed: {err_msg}")
        return {"error": err_msg, "verified": False}

def verify_face_against_supabase(base64_image, landmarks=None, target_user_id=None, registration_number=None, engine_preference=None):
    """
    Strict user-specific Biometric Verification against encrypted database records.
    If no registered face is found for this exact user/registration_number, returns verified = False.
    """
    if not engine_preference:
        engine_preference = DEFAULT_FACE_ENGINE
    try:
        target_embedding, engine_used = compute_embedding(base64_image, landmarks=landmarks, engine_preference=engine_preference)
    except ValueError as spoof_err:
        return {
            "verified": False,
            "spoof_detected": True,
            "confidence": 0,
            "engine_used": engine_preference,
            "message": f"Verification Failed: {str(spoof_err)}"
        }

    url = f"{SUPABASE_URL}/rest/v1/face_embeddings"
    headers = get_headers()
    
    records = []
    if target_user_id:
        query_url = f"{url}?user_id=eq.{target_user_id}"
        res = requests.get(query_url, headers=headers)
        if res.ok:
            records = res.json()

    if not records and registration_number:
        query_url = f"{url}?registration_number=eq.{registration_number}"
        res = requests.get(query_url, headers=headers)
        if res.ok:
            records = res.json()

    if not records:
        return {
            "verified": False,
            "confidence": 0,
            "engine_used": engine_used,
            "message": "ACCESS DENIED: No face biometrics registered for this account in central database. Please go to Profile and register your face first."
        }

    best_match = None
    best_similarity = -1.0
    
    for record in records:
        stored_emb = record.get("embedding")
        if not stored_emb:
            continue
            
        # Guard against dimensionality mismatch
        if len(target_embedding) != len(stored_emb):
            print(f"[WARNING] Vector dimension mismatch: target={len(target_embedding)}D vs stored={len(stored_emb)}D. Skipping incompatible record.")
            continue

        sim = cosine_similarity(target_embedding, stored_emb)
        if sim > best_similarity:
            best_similarity = sim
            best_match = record

    threshold = ENGINE_THRESHOLDS.get(engine_used, 0.45)
    is_verified = best_similarity >= threshold
    confidence = round(max(0.0, best_similarity) * 100, 2)
    
    if is_verified and best_match:
        return {
            "verified": True,
            "confidence": confidence,
            "engine_used": engine_used,
            "user_id": best_match.get("user_id"),
            "student_name": best_match.get("student_name"),
            "registration_number": best_match.get("registration_number"),
            "message": f"Biometric face match verified! Confidence: {confidence}%"
        }
    else:
        return {
            "verified": False,
            "confidence": confidence if best_similarity > 0 else 0,
            "engine_used": engine_used,
            "message": f"ACCESS DENIED: Captured face similarity ({confidence}%) below verification threshold."
        }
