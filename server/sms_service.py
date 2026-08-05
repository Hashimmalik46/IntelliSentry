import os

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

def format_phone_number(phone):
    if not phone:
        return ""
    phone = str(phone).strip()
    if not phone.startswith("+"):
        if len(phone) == 10 and phone.isdigit():
            phone = "+91" + phone
        else:
            phone = "+" + phone
    return phone

def send_parent_sms_notification(parent_phone, student_name, leave_type, approval_url):
    """
    Sends automated SMS to parent phone number via Twilio with encrypted approval link.
    If Twilio keys are not set, prints mock notification for local testing.
    """
    parent_phone = format_phone_number(parent_phone)
    sms_body = f"INTELLISENTRY SECURITY NOTICE: Student {student_name} has requested {leave_type}. Review details & authorize: {approval_url}"
    
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=sms_body,
                from_=TWILIO_PHONE_NUMBER,
                to=parent_phone
            )
            print(f"[TWILIO SMS SUCCESS] Message SID: {message.sid} sent to {parent_phone}")
            return {"success": True, "sid": message.sid, "sms_body": sms_body}
        except Exception as e:
            print(f"[TWILIO SMS ERROR] Could not send real SMS to {parent_phone}: {e}")
            return {"success": False, "error": str(e), "sms_body": sms_body}
    else:
        print(f"[SIMULATED SMS SENT TO {parent_phone}]: {sms_body}")
        return {
            "success": True, 
            "simulated": True, 
            "sms_body": sms_body,
            "message": "Twilio keys not configured. Simulated SMS printed to console."
        }

def send_parent_otp_sms(parent_phone, otp_code, student_name="Student"):
    """
    Sends automated OTP SMS to parent phone number via Twilio for parent verification.
    If Twilio keys are not set, prints mock notification with OTP code for local testing.
    """
    parent_phone = format_phone_number(parent_phone)
    sms_body = f"INTELLISENTRY VERIFICATION CODE: Your one-time OTP for authorizing student {student_name}'s leave request is: {otp_code}. Valid for 10 minutes. Do not share this code."
    
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=sms_body,
                from_=TWILIO_PHONE_NUMBER,
                to=parent_phone
            )
            print(f"[TWILIO OTP SMS SUCCESS] Message SID: {message.sid} sent to {parent_phone}")
            return {"success": True, "sid": message.sid, "sms_body": sms_body}
        except Exception as e:
            print(f"[TWILIO OTP SMS ERROR] Could not send real SMS to {parent_phone}: {e}")
            return {"success": False, "error": str(e), "sms_body": sms_body}
    else:
        print(f"[SIMULATED OTP SMS SENT TO {parent_phone}]: {sms_body}")
        return {
            "success": True, 
            "simulated": True, 
            "sms_body": sms_body,
            "otp_code": otp_code,
            "message": f"Twilio keys not configured. Simulated OTP {otp_code} printed to console."
        }


