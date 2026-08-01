import os
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
from sms_service import send_parent_sms_notification

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

    if not image:
        return jsonify({"error": "image is required"}), 400

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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)