from google.cloud import storage
import os

project_id = "flare-ai-os-490023"
client = storage.Client(project=project_id)

buckets_to_test = [
    f"{project_id}.firebasestorage.app",
    f"{project_id}.appspot.com",
    "flare-ai-os-490023-knowledge-base" # just in case
]

for b in buckets_to_test:
    try:
        bucket = client.bucket(b)
        blobs = list(bucket.list_blobs(max_results=5))
        print(f"Bucket {b}: FOUND ({len(blobs)} files)")
    except Exception as e:
        print(f"Bucket {b}: FAILED - {e}")
