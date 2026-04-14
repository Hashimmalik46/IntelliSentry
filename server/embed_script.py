import os
import chromadb
from deepface import DeepFace

# 1. Initialize ChromaDB (Local storage)
client = chromadb.PersistentClient(path="./face_database")
collection = client.get_or_create_collection(
    name="staff_faces", 
    metadata={"hnsw:space": "cosine"}
)

# 2. Setup your folder
image_folder = "./stored_images"
valid_extensions = ('.jpg', '.jpeg', '.png')

print("Starting facial embedding process...")

for filename in os.listdir(image_folder):
    if filename.lower().endswith(valid_extensions):
        img_path = os.path.join(image_folder, filename)
        
        try:
            # represent() finds, aligns, and embeds the face
            # ArcFace is the current gold standard for accuracy
            results = DeepFace.represent(
                img_path=img_path, 
                model_name="ArcFace",
                enforce_detection=True 
            )
            
            # DeepFace returns a list of detected faces. 
            # We'll store the embedding for the primary face found.
            embedding = results[0]["embedding"]
            
            collection.add(
                embeddings=[embedding],
                ids=[filename],
                metadatas=[{"filepath": img_path}]
            )
            print(f"✅ Indexed: {filename}")
            
        except ValueError:
            print(f"⚠️ Skipped: No face detected in {filename}")
        except Exception as e:
            print(f"❌ Error processing {filename}: {e}")

print("\nDatabase build complete.")