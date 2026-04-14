import chromadb
# This will completely wipe the face collection so you can re-index
client = chromadb.PersistentClient(path="./face_database")
try:
    client.delete_collection(name="staff_faces")
    print("🗑️ Database wiped. Now run your INGESTION script again with only the correct photos.")
except:
    print("Database was already empty.")