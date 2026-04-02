from PIL import Image
import os

source_path = r"../Logos/FLARE AI OS/Logo FLARE AI OS 4K.png"

def analyze_logo():
    try:
        abs_source = os.path.abspath(source_path)
        with Image.open(abs_source) as img:
            img = img.convert("RGBA")
            alpha = img.getchannel('A')
            mask = alpha.point(lambda p: 255 if p > 30 else 0)
            bbox = mask.getbbox()
            if bbox:
                img = img.crop(bbox)
            
            width, height = img.size
            print(f"Cropped size: {width}x{height}")
            
            # Count non-transparent pixels per column
            cols = []
            for x in range(width):
                count = 0
                for y in range(height):
                    if img.getpixel((x, y))[3] > 30:
                        count += 1
                cols.append(count)
            
            # Print a rough profile
            print("Alpha Density Profile (normalized):")
            step = max(1, width // 100)
            for i in range(0, width, step):
                density = cols[i] / height
                bar = "#" * int(density * 20)
                print(f"{i:4d}: {bar}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_logo()
