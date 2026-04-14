import os
import cv2
from pathlib import Path
from deepface import DeepFace
import chromadb

# 1. Setup Paths
base_dir = Path(__file__).parent.resolve() 
target_path = base_dir / "target_images" / "brad_test.jpeg"

# 2. Database Connection
client = chromadb.PersistentClient(path="./face_database")
collection = client.get_collection(name="staff_faces")

if not target_path.exists():
    print(f"❌ File not found at: {target_path}")
else:
    try:
        # 3. Extract Face Vector
        print("🔍 IntelliSentry: Scanning target face...")
        target_results = DeepFace.represent(
            img_path=str(target_path), 
            model_name="ArcFace",
            enforce_detection=True
        )
        target_embedding = target_results[0]["embedding"]

        # 4. Query Database
        results = collection.query(
            query_embeddings=[target_embedding],
            n_results=1 # For security, we usually only care about the top match
        )

        print("\n" + "="*45)
        print("        INTELLISENTRY SECURITY REPORT        ")
        print("="*45)

        if not results['ids'][0]:
            print("DATABASE EMPTY: No staff records found.")
        else:
            # Grab the best match
            best_id = results['ids'][0][0]
            best_distance = results['distances'][0][0]
            best_metadata = results['metadatas'][0][0]

            # --- Modified Security Logic ---
            if best_distance < 0.22:
                status = "✅ ACCESS GRANTED"
                detail = f"Verified: {best_id} (Secure match)"
                color_code = (0, 255, 0) # Green for OpenCV
            elif best_distance < 0.42:
                status = "⚠️ WARNING: VERIFICATION REQUIRED"
                detail = f"Partial Match: {best_id} (Possible lighting issue)"
                color_code = (0, 255, 255) # Yellow
            else:
                status = "🚨 ALERT: UNAUTHORIZED ACCESS"
                detail = "Unknown person detected. No match in staff database."
                color_code = (0, 0, 255) # Red

            print(f"RESULT: {status}")
            print(f"DETAIL: {detail}")
            print(f"CONFIDENCE SCORE: {100 * (1 - best_distance):.2f}%")
            print("="*45)

            # 5. Visual Verification (OpenCV Window)
            if best_distance < 0.42:
                img = cv2.imread(best_metadata['filepath'])
                # Overlay the name on the image
                cv2.putText(img, f"{best_id} - {status}", (20, 40), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color_code, 2)
                cv2.imshow("IntelliSentry Verification", img)
                cv2.waitKey(2000) # Show for 2 seconds
                cv2.destroyAllWindows()

    except Exception as e:
        # Check if the error is a detection failure
        if "Face could not be detected" in str(e):
            print("🚨 ALERT: Face obscured or no face visible in frame.")
        else:
            print(f"System Error: {e}")