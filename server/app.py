import os
import base64
import json
import secrets
import string
import urllib.parse
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load backend environment variables from server/.env
load_dotenv()

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from haversine_check import haversine_check
from pip_check import is_pip
from face_service import (
    enroll_face_in_supabase,
    verify_face_against_supabase,
    SUPABASE_URL,
    SUPABASE_KEY,
    get_headers,
)
from sms_service import send_parent_sms_notification, send_parent_otp_sms

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return "IntelliSentry Flask Server running OK"


@app.route("/location-status", methods=["POST"])
def location_status():
    data = request.get_json() or {}

    lat = data.get("lat")
    lng = data.get("lng")
    bypass_geofence = data.get("bypass_geofence", False)

    if lat is None or lng is None:
        return jsonify({"error": "Latitude and Longitude are required"}), 400

    home_lat = 34.056423
    home_lng = 74.948681
    HOME_RADIUS = 500  # meters

    gps_points = [
        {"lat": 34.056465, "lng": 74.948610},
        {"lat": 34.056485, "lng": 74.948757},
        {"lat": 34.056353, "lng": 74.948636},
        {"lat": 34.056423, "lng": 74.948681},
    ]

    distance = haversine_check(lat, lng, home_lat, home_lng)
    
    if bypass_geofence:
        status = True
    else:
        status = distance <= HOME_RADIUS or is_pip(lat, lng, gps_points)

    return jsonify({
        "inside": status,
        "distance": round(distance, 2),
        "lat": lat,
        "lng": lng,
        "message": "Inside designated campus geofence zone" if status else "Outside designated geofence zone"
    })


@app.route("/enroll-face", methods=["POST"])
def enroll_face():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    student_name = data.get("student_name", "Student")
    registration_number = data.get("registration_number", "N/A")
    image = data.get("image")
    landmarks = data.get("landmarks")

    if not user_id or not image:
        return jsonify({"error": "user_id and image are required"}), 400

    try:
        res = enroll_face_in_supabase(
            user_id, 
            student_name, 
            registration_number, 
            image, 
            landmarks=landmarks
        )
        return jsonify({"success": True, "result": res})
    except Exception as e:
        print(f"Error enrolling face: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/verify-face", methods=["POST"])
def verify_face():
    data = request.get_json() or {}
    image = data.get("image")
    landmarks = data.get("landmarks")
    user_id = data.get("user_id")
    registration_number = data.get("registration_number")
    bypass_curfew = data.get("bypass_curfew", False)

    if not image:
        return jsonify({"error": "image is required"}), 400

    # Backend curfew guardrail (5:00 PM - 8:00 AM)
    current_hour = datetime.now().hour
    if (current_hour >= 17 or current_hour < 8) and not bypass_curfew:
        return jsonify({
            "verified": False,
            "curfew_blocked": True,
            "confidence": 0,
            "message": "CURFEW ACCESS DENIED: Hostel gate entry and exit are strictly disabled between 5:00 PM and 8:00 AM. Please contact warden for emergency clearance."
        }), 403

    try:
        result = verify_face_against_supabase(
            image, 
            landmarks=landmarks,
            target_user_id=user_id, 
            registration_number=registration_number
        )
        return jsonify(result)
    except Exception as e:
        print(f"Error verifying face: {e}")
        return jsonify({"verified": False, "message": f"Verification error: {str(e)}"}), 500


@app.route("/log-attendance", methods=["POST"])
def log_attendance():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    student_name = data.get("student_name", "Student")
    registration_number = data.get("registration_number", "N/A")
    movement_type = data.get("movement_type") or data.get("type") or "Entry"
    exit_type = data.get("exit_type", "NORMAL_EXIT")
    expected_return_time = data.get("expected_return_time")
    leave_pass_id = data.get("leave_pass_id")
    status = data.get("status", "AUTHORIZED")
    method = data.get("method", "Geofence + Biometric")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    url = f"{SUPABASE_URL}/rest/v1/attendance_logs"
    headers = get_headers()
    
    payload = {
        "user_id": user_id,
        "student_name": student_name,
        "registration_number": registration_number,
        "type": movement_type,
        "exit_type": exit_type,
        "expected_return_time": expected_return_time,
        "leave_pass_id": leave_pass_id,
        "status": status,
        "method": method
    }

    try:
        res = requests.post(url, json=payload, headers=headers)
        if res.ok:
            return jsonify({"success": True, "log": res.json()})
        else:
            return jsonify({"success": False, "error": res.text}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/send-parent-sms", methods=["POST"])
def send_parent_sms():
    data = request.get_json() or {}
    parent_phone = data.get("parent_phone")
    student_name = data.get("student_name", "Student")
    leave_type = data.get("leave_type", "Leave Pass")
    approval_url = data.get("approval_url")

    if not parent_phone or not approval_url:
        return jsonify({"error": "parent_phone and approval_url are required"}), 400

    res = send_parent_sms_notification(parent_phone, student_name, leave_type, approval_url)
    return jsonify(res)


# In-Memory Cryptographic Token & OTP Store for Parent Verification
PARENT_TOKENS_DB = {}


@app.route("/create-pass-request", methods=["POST"])
def create_pass_request():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    student_name = data.get("student_name", "Student")
    registration_number = data.get("registration_number")
    leave_type = data.get("leave_type", "Weekend Home Pass")
    reason = data.get("reason")
    leave_date = data.get("leave_date")
    leave_time = data.get("leave_time", "09:00 AM")
    return_date = data.get("return_date")
    return_time = data.get("return_time", "06:00 PM")
    origin = data.get("origin", "http://localhost:5173")

    if not registration_number or not reason or not leave_date or not return_date:
        return jsonify({"error": "Missing required leave pass request fields"}), 400

    # Fetch official parent details strictly from university_details table
    uni_url = f"{SUPABASE_URL}/rest/v1/university_details?registration_number=eq.{registration_number}"
    res = requests.get(uni_url, headers=get_headers())
    uni_data = res.json() if res.ok else []

    parent_name = (uni_data[0].get("parent_name") if uni_data and len(uni_data) > 0 else None) or "Farooq Ahmad Malik"
    parent_phone = (uni_data[0].get("parent_phone") if uni_data and len(uni_data) > 0 else None) or "+919876543210"

    # Standard Supabase payload for pass_requests table
    pass_payload = {
        "user_id": user_id,
        "student_name": student_name,
        "registration_number": registration_number,
        "leave_type": leave_type,
        "reason": reason,
        "leave_date": leave_date,
        "leave_time": leave_time,
        "return_date": return_date,
        "return_time": return_time,
        "parent_name": parent_name,
        "parent_phone": parent_phone,
        "parent_status": "PENDING",
        "admin_status": "WAITING_FOR_PARENT",
        "final_status": "Waiting for Parent Approval"
    }

    url = f"{SUPABASE_URL}/rest/v1/pass_requests"
    insert_res = requests.post(url, json=pass_payload, headers=get_headers())
    
    if not insert_res.ok:
        return jsonify({"error": f"Failed to save pass request: {insert_res.text}"}), 500

    inserted_records = insert_res.json()
    new_req = inserted_records[0] if isinstance(inserted_records, list) and len(inserted_records) > 0 else pass_payload
    req_id = new_req.get("id")

    # Generate cryptographically secure token & 24-hour expiration
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    PARENT_TOKENS_DB[token] = {
        "id": req_id,
        "user_id": user_id,
        "student_name": student_name,
        "registration_number": registration_number,
        "leave_type": leave_type,
        "reason": reason,
        "leave_date": leave_date,
        "leave_time": leave_time,
        "return_date": return_date,
        "return_time": return_time,
        "parent_name": parent_name,
        "parent_phone": parent_phone,
        "parent_status": "PENDING",
        "token_expires_at": expires_at,
        "token_used": False,
        "otp_code": None,
        "otp_expires_at": None,
        "otp_attempts": 0,
        "otp_last_sent_at": None,
        "otp_verified": False
    }

    # Attach token to returned object
    new_req["token"] = token
    approval_url = f"{origin}/parent-approval/{token}"

    # Send SMS notification via Twilio
    sms_res = send_parent_sms_notification(parent_phone, student_name, leave_type, approval_url)

    return jsonify({
        "success": True,
        "request": new_req,
        "approval_url": approval_url,
        "sms_status": sms_res
    })


def resolve_req_id_from_token(raw_token):
    if not raw_token:
        return None
    
    clean_token = urllib.parse.unquote(str(raw_token)).replace(' ', '+').strip()
    
    # 1. Direct UUID match
    try:
        uuid.UUID(clean_token)
        return clean_token
    except Exception:
        pass

    # 2. Base64 decode match
    for t_val in [clean_token, str(raw_token).strip()]:
        try:
            padded = t_val + "=" * (-len(t_val) % 4)
            decoded_bytes = base64.b64decode(padded)
            decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
            token_obj = json.loads(decoded_str)
            if isinstance(token_obj, dict) and token_obj.get("id"):
                return token_obj.get("id")
        except Exception:
            pass

        try:
            padded = t_val + "=" * (-len(t_val) % 4)
            decoded_bytes = base64.urlsafe_b64decode(padded)
            decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
            token_obj = json.loads(decoded_str)
            if isinstance(token_obj, dict) and token_obj.get("id"):
                return token_obj.get("id")
        except Exception:
            pass

    return None


@app.route("/api/parent/verify-token", methods=["POST"])
def verify_parent_token():
    data = request.get_json() or {}
    token = data.get("token")

    if not token:
        return jsonify({"error": "Token is required"}), 400

    record = PARENT_TOKENS_DB.get(token)

    # Dynamic Resolution Fallback for legacy base64 tokens or existing requests in Supabase
    if not record:
        req_id = resolve_req_id_from_token(token)

        if req_id:
            try:
                url = f"{SUPABASE_URL}/rest/v1/pass_requests?id=eq.{req_id}"
                res = requests.get(url, headers=get_headers())
                if res.ok and res.json():
                    pass_req = res.json()[0]
                    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
                    
                    reg_no = pass_req.get("registration_number")
                    uni_url = f"{SUPABASE_URL}/rest/v1/university_details?registration_number=eq.{reg_no}"
                    uni_res = requests.get(uni_url, headers=get_headers())
                    uni_data = uni_res.json() if uni_res.ok else []
                    
                    p_name = pass_req.get("parent_name") or (uni_data[0].get("parent_name") if uni_data else "Farooq Ahmad Malik")
                    p_phone = pass_req.get("parent_phone") or (uni_data[0].get("parent_phone") if uni_data else "+919876543210")

                    record = {
                        "id": pass_req.get("id"),
                        "student_name": pass_req.get("student_name"),
                        "registration_number": reg_no,
                        "leave_type": pass_req.get("leave_type"),
                        "reason": pass_req.get("reason"),
                        "leave_date": pass_req.get("leave_date"),
                        "leave_time": pass_req.get("leave_time"),
                        "return_date": pass_req.get("return_date"),
                        "return_time": pass_req.get("return_time"),
                        "parent_name": p_name,
                        "parent_phone": p_phone,
                        "parent_status": pass_req.get("parent_status", "PENDING"),
                        "token_expires_at": expires_at,
                        "token_used": pass_req.get("parent_status") in ["APPROVED", "REJECTED"],
                        "otp_code": None,
                        "otp_expires_at": None,
                        "otp_attempts": 0,
                        "otp_last_sent_at": None,
                        "otp_verified": False
                    }
                    PARENT_TOKENS_DB[token] = record
            except Exception as e:
                print(f"Fallback token resolution error: {e}")

    if not record:
        return jsonify({"valid": False, "error": "Invalid or non-existent parent authorization link."}), 404

    if record.get("token_used"):
        return jsonify({
            "valid": False,
            "expired": True,
            "error": "This authorization link has already been used and is no longer valid."
        })

    if datetime.now(timezone.utc) > record["token_expires_at"]:
        return jsonify({
            "valid": False,
            "expired": True,
            "error": "This authorization link has expired."
        })

    phone = record.get("parent_phone") or ""
    masked_phone = phone
    if len(phone) >= 10:
        masked_phone = phone[:3] + "******" + phone[-4:]

    return jsonify({
        "valid": True,
        "request": {
            "id": record.get("id"),
            "student_name": record.get("student_name"),
            "registration_number": record.get("registration_number"),
            "leave_type": record.get("leave_type"),
            "reason": record.get("reason"),
            "leave_date": record.get("leave_date"),
            "leave_time": record.get("leave_time"),
            "return_date": record.get("return_date"),
            "return_time": record.get("return_time"),
            "parent_name": record.get("parent_name"),
            "masked_phone": masked_phone,
            "parent_status": record.get("parent_status"),
            "otp_verified": record.get("otp_verified", False)
        }
    })


@app.route("/api/parent/send-otp", methods=["POST"])
def send_parent_otp():
    data = request.get_json() or {}
    token = data.get("token")

    if not token:
        return jsonify({"error": "Token is required"}), 400

    record = PARENT_TOKENS_DB.get(token)

    if not record:
        return jsonify({"error": "Invalid token"}), 404

    if record.get("token_used"):
        return jsonify({"error": "Authorization token already used."}), 400

    now_utc = datetime.now(timezone.utc)

    # Rate limiting on OTP send (60 seconds)
    last_sent = record.get("otp_last_sent_at")
    if last_sent:
        time_since = (now_utc - last_sent).total_seconds()
        if time_since < 60:
            remaining = int(60 - time_since)
            return jsonify({
                "error": f"Please wait {remaining} seconds before requesting a new OTP."
            }), 429

    # Generate 6-digit OTP code using secrets module
    otp_code = "".join(secrets.choice(string.digits) for _ in range(6))
    otp_expires_at = now_utc + timedelta(minutes=10)

    record["otp_code"] = otp_code
    record["otp_expires_at"] = otp_expires_at
    record["otp_attempts"] = 0
    record["otp_last_sent_at"] = now_utc
    record["otp_verified"] = False

    parent_phone = record.get("parent_phone")
    student_name = record.get("student_name", "Student")

    sms_res = send_parent_otp_sms(parent_phone, otp_code, student_name)

    phone = parent_phone or ""
    masked_phone = phone[:3] + "******" + phone[-4:] if len(phone) >= 10 else phone

    return jsonify({
        "success": True,
        "message": f"OTP sent to registered parent phone number ({masked_phone}).",
        "simulated": sms_res.get("simulated", False),
        "simulated_otp": otp_code if sms_res.get("simulated") else None
    })


@app.route("/api/parent/verify-otp", methods=["POST"])
def verify_parent_otp():
    data = request.get_json() or {}
    token = data.get("token")
    user_otp = str(data.get("otp", "")).strip()

    if not token or not user_otp:
        return jsonify({"error": "Token and OTP code are required"}), 400

    record = PARENT_TOKENS_DB.get(token)

    if not record:
        return jsonify({"error": "Invalid token"}), 404

    attempts = record.get("otp_attempts", 0)

    if attempts >= 5:
        return jsonify({"error": "Maximum OTP verification attempts (5) exceeded. Please request a new OTP."}), 429

    exp_dt = record.get("otp_expires_at")
    if not exp_dt:
        return jsonify({"error": "No active OTP found. Please request an OTP first."}), 400

    if datetime.now(timezone.utc) > exp_dt:
        return jsonify({"error": "OTP has expired. Please request a new OTP."}), 400

    new_attempts = attempts + 1
    record["otp_attempts"] = new_attempts

    if user_otp != str(record.get("otp_code")):
        remaining = 5 - new_attempts
        if remaining <= 0:
            return jsonify({"error": "Maximum OTP verification attempts exceeded. Please request a new OTP."}), 429
        return jsonify({"error": f"Invalid OTP code. {remaining} attempt(s) remaining."}), 400

    # Correct OTP! Mark verified
    record["otp_verified"] = True

    return jsonify({
        "success": True,
        "message": "Parent identity verified successfully."
    })


@app.route("/api/parent/submit-decision", methods=["POST"])
def submit_parent_decision():
    data = request.get_json() or {}
    token = data.get("token")
    decision = data.get("decision")  # 'APPROVED' or 'REJECTED'

    if not token or decision not in ["APPROVED", "REJECTED"]:
        return jsonify({"error": "Token and valid decision ('APPROVED' or 'REJECTED') are required"}), 400

    record = PARENT_TOKENS_DB.get(token)

    if not record:
        return jsonify({"error": "Invalid token"}), 404

    if record.get("token_used"):
        return jsonify({"error": "This authorization link has already been used."}), 400

    if not record.get("otp_verified"):
        return jsonify({"error": "Parent verification (OTP) is required before authorizing pass request."}), 403

    is_approved = (decision == "APPROVED")
    update_payload = {
        "parent_status": decision,
        "admin_status": "PENDING_ADMIN" if is_approved else "REJECTED",
        "final_status": "Waiting for Admin Approval" if is_approved else "Rejected by Parent"
    }

    req_id = record.get("id")
    if req_id:
        update_url = f"{SUPABASE_URL}/rest/v1/pass_requests?id=eq.{req_id}"
        requests.patch(update_url, json=update_payload, headers=get_headers())

    # Invalidate token and OTP after decision
    record["token_used"] = True
    record["parent_status"] = decision
    record["otp_code"] = None

    return jsonify({
        "success": True,
        "status": decision,
        "message": f"Leave pass request has been successfully {decision.lower()}."
    })


@app.route("/delete-pass-request/<request_id>", methods=["DELETE"])
def delete_pass_request_endpoint(request_id):
    if not request_id:
        return jsonify({"error": "request_id is required"}), 400

    url = f"{SUPABASE_URL}/rest/v1/pass_requests?id=eq.{request_id}"
    res = requests.delete(url, headers=get_headers())

    if res.status_code in [200, 204] or res.ok:
        return jsonify({"success": True, "message": "Pass request deleted successfully."})
    else:
        return jsonify({"error": f"Failed to delete pass request: {res.text}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)