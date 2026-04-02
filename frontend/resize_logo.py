from PIL import Image, ImageFilter, ImageOps
import os

source_path = r"../Logos/FLARE AI OS/Logo FLARE AI OS 4K.png"
target_dir = r"./public"

# Renewing filenames to v4 to ensure hard refresh again
sizes = {
    "logo.png": (1024, 1024),
    "br-symbol-v4-192.png": (192, 192),
    "br-symbol-v4-512.png": (512, 512),
}

def resize_logo():
    try:
        abs_source = os.path.abspath(source_path)
        abs_target_dir = os.path.abspath(target_dir)
        
        with Image.open(abs_source) as img:
            img = img.convert("RGBA")
            
            # --- Better Symbol Extraction ---
            # 1. Broad crop to find center of gravity of the logo
            alpha = img.getchannel('A')
            mask = alpha.point(lambda p: 255 if p > 30 else 0)
            bbox_full = mask.getbbox()
            if bbox_full:
                img_full_content = img.crop(bbox_full)
            else:
                img_full_content = img
            
            # 2. Extract the "F" symbol CORE
            # We use a high threshold to find the core area, but we'll crop the ORIGINAL image
            # to keep anti-aliasing edges.
            s_mask = alpha.point(lambda p: 255 if p > 150 else 0)
            s_bbox = s_mask.getbbox()
            
            # The symbol is on the left. Let's force a split around pixel 850 in the CROPPED FULL content
            # or just use the s_bbox if it looks reasonable.
            # From density analysis, the symbol is roughly 0 to 850.
            symbol_core_bbox = (0, 0, min(850, img_full_content.width), img_full_content.height)
            symbol_img = img_full_content.crop(symbol_core_bbox)
            
            # Tight crop the symbol now
            s_alpha = symbol_img.getchannel('A')
            s_tight_mask = s_alpha.point(lambda p: 255 if p > 30 else 0)
            s_tight_bbox = s_tight_mask.getbbox()
            if s_tight_bbox:
                symbol_img = symbol_img.crop(s_tight_bbox)
            
            print(f"Branding Symbol size: {symbol_img.size}")
            
            # --- Asset Generation ---
            for name, size in sizes.items():
                target_path = os.path.join(abs_target_dir, name)
                current_src = img_full_content if name == "logo.png" else symbol_img
                
                w, h = current_src.size
                scale = min(size[0] / w, size[1] / h)
                new_w, new_h = int(w * scale), int(h * scale)
                
                # Keep original anti-aliasing with Lanczos
                resized_content = current_src.resize((new_w, new_h), Image.Resampling.LANCZOS)
                
                final_icon = Image.new("RGBA", size, (0, 0, 0, 0))
                paste_x = (size[0] - new_w) // 2
                paste_y = (size[1] - new_h) // 2
                final_icon.paste(resized_content, (paste_x, paste_y))
                
                final_icon.save(target_path, "PNG", optimize=True)
                print(f"Created {name}")

            # --- Favicon-v4.ico (High Quality & Thicker) ---
            ico_path = os.path.join(abs_target_dir, "favicon-v4.ico")
            fav_sizes = [(16, 16), (32, 32), (48, 48)]
            favs = []
            
            for s in fav_sizes:
                # For favicons, if the symbol is too thin, we "fatten" it slightly
                # by applying a tiny blur and then re-sharpening or just boosting alpha
                
                w, h = symbol_img.size
                scale = min(s[0] / w, s[1] / h)
                new_w, new_h = int(w * scale), int(h * scale)
                
                # Resize first
                resized = symbol_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                
                # "Fattening" process:
                # 1. Split to RGBA
                r, g, b, a = resized.split()
                # 2. Blur the alpha channel slightly
                a_blurred = a.filter(ImageFilter.GaussianBlur(radius=0.3))
                # 3. Apply a threshold-like boost to the alpha to make it "thicker"
                a_bold = a_blurred.point(lambda p: min(255, int(p * 2.5)))
                # 4. Merge back
                resized_bold = Image.merge("RGBA", (r, g, b, a_bold))
                
                temp = Image.new("RGBA", s, (0,0,0,0))
                temp.paste(resized_bold, ((s[0]-new_w)//2, (s[1]-new_h)//2))
                favs.append(temp)
            
            favs[0].save(ico_path, format='ICO', append_images=favs[1:], sizes=fav_sizes)
            print("Created favicon-v4.ico (optimized for small scales)")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    resize_logo()
