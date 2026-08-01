import requests
import time

BASE_URL = "http://127.0.0.1:5000"

def test_full_parent_flow():
    print("=== Testing Secure Parent Request & OTP Verification Flow ===")
    
    # 1. Create Pass Request (backend pulls parent details from university_details)
    payload = {
        "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "student_name": "Hashim Malik",
        "registration_number": "IUST0123016837",
        "leave_type": "Weekend Home Pass",
        "reason": "Family function visit",
        "leave_date": "2026-08-05",
        "leave_time": "09:00 AM",
        "return_date": "2026-08-07",
        "return_time": "06:00 PM",
        "origin": "http://localhost:5173"
    }

    print("\n1. Creating pass request...")
    res = requests.post(f"{BASE_URL}/create-pass-request", json=payload)
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print(f"Response: {data}")
    assert res.ok and data.get("success"), "Pass creation failed!"

    approval_url = data.get("approval_url")
    token = approval_url.split("/")[-1]
    print(f"[SUCCESS] Pass created! Token: {token}")

    # 2. Parent opens link and verifies token
    print("\n2. Verifying parent link token...")
    res = requests.post(f"{BASE_URL}/api/parent/verify-token", json={"token": token})
    print(f"Status Code: {res.status_code}")
    t_data = res.json()
    print(f"Token Verification Response: {t_data}")
    assert res.ok and t_data.get("valid"), "Token verification failed!"

    # 3. Request OTP to registered parent phone
    print("\n3. Requesting OTP via Twilio service...")
    res = requests.post(f"{BASE_URL}/api/parent/send-otp", json={"token": token})
    print(f"Status Code: {res.status_code}")
    otp_data = res.json()
    print(f"Send OTP Response: {otp_data}")
    assert res.ok and otp_data.get("success"), "Send OTP failed!"
    
    otp_code = otp_data.get("simulated_otp")
    print(f"Generated OTP Code: {otp_code}")

    # 3b. Test Rate Limiting on Send OTP (Immediate resend should fail with 429)
    print("\n3b. Testing rate limit on immediate OTP resend (< 60s)...")
    res_rate = requests.post(f"{BASE_URL}/api/parent/send-otp", json={"token": token})
    print(f"Rate Limit Status Code: {res_rate.status_code} (Expected 429)")
    print(f"Rate Limit Response: {res_rate.json()}")
    assert res_rate.status_code == 429, "Rate limit failed!"

    # 4. Verify Invalid OTP Code
    print("\n4. Testing invalid OTP code...")
    res_bad = requests.post(f"{BASE_URL}/api/parent/verify-otp", json={"token": token, "otp": "000000"})
    print(f"Invalid OTP Status Code: {res_bad.status_code} (Expected 400)")
    print(f"Invalid OTP Response: {res_bad.json()}")

    # 5. Verify Correct OTP Code
    print("\n5. Verifying correct OTP code...")
    res_good = requests.post(f"{BASE_URL}/api/parent/verify-otp", json={"token": token, "otp": otp_code})
    print(f"Verify OTP Status Code: {res_good.status_code}")
    print(f"Verify OTP Response: {res_good.json()}")
    assert res_good.ok and res_good.json().get("success"), "Verify OTP failed!"

    # 6. Submit Parent Approval Decision
    print("\n6. Submitting parent approval decision ('APPROVED')...")
    res_dec = requests.post(f"{BASE_URL}/api/parent/submit-decision", json={"token": token, "decision": "APPROVED"})
    print(f"Decision Status Code: {res_dec.status_code}")
    print(f"Decision Response: {res_dec.json()}")
    assert res_dec.ok and res_dec.json().get("success"), "Decision submission failed!"

    # 7. Test Single-Use Token Invalidation
    print("\n7. Testing token invalidation after decision...")
    res_reused = requests.post(f"{BASE_URL}/api/parent/verify-token", json={"token": token})
    print(f"Reused Token Verification Response: {res_reused.json()}")
    assert res_reused.json().get("expired") == True, "Token invalidation failed!"

    print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_full_parent_flow()
