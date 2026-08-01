import os

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

def send_parent_sms_notification(parent_phone, student_name, leave_type, approval_url):
    """
    Sends automated SMS to parent phone number via Twilio with encrypted approval link.
    If Twilio keys are not set, prints mock notification for local testing.
    """
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
            print(f"[TWILIO SMS ERROR] Could not send real SMS: {e}")
            return {"success": False, "error": str(e), "sms_body": sms_body}
    else:
        print(f"[SIMULATED SMS SENT TO {parent_phone}]: {sms_body}")
        return {
            "success": True, 
            "simulated": True, 
            "sms_body": sms_body,
            "message": "Twilio keys not configured. Simulated SMS printed to console."
        }
