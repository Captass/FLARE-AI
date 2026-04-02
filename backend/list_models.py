import google.generativeai as genai
import os

api_key = "AIzaSyCXJ7nKNtiD5MfgAKryuGp957jJJGPXNOQ"
genai.configure(api_key=api_key)

try:
    print("Listing models with GenerativeAI SDK:")
    for m in genai.list_models():
        if "generateImages" in m.supported_generation_methods or "image" in m.name or "banana" in m.name:
            print(f"- {m.name} (Methods: {m.supported_generation_methods})")
except Exception as e:
    print(f"Error: {e}")

try:
    print("\nTrying with new GenAI SDK:")
    from google import genai as ggenai
    client = ggenai.Client(api_key=api_key)
    for m in client.models.list():
        if "generate_images" in m.supported_actions or "image" in m.name or "banana" in m.name:
            print(f"- {m.name} (Actions: {m.supported_actions})")
except Exception as e:
    print(f"Error GenAI SDK: {e}")
