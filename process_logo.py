from PIL import Image
import sys

img_path = r'C:\Users\fahad\.gemini\antigravity\brain\55bdd355-1f1e-449b-89ac-0bb228ec5b60\media__1782726791954.png'
out_path = r'public\logo.png'

try:
    img = Image.open(img_path).convert('RGBA')
    data = img.getdata()
    
    new_data = []
    for item in data:
        r, g, b, a = item
        # Calculate perceived luminance
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        
        # The background is black with faint green waves. The faint green waves have low R and B, and maybe G around 20-50.
        # The green circle is very bright green (e.g. #20C997 -> R=32, G=201, B=151, Lum ~ 160)
        # The text 'Arabic Talent' is bright green.
        # The text '??????? ???????' is grayish (e.g. R=100, G=110, B=120, Lum ~ 110).
        # So if lum < 40 and G < 80, we can confidently say it's background.
        
        if lum < 50 and g < 70:
            # Set to transparent
            new_data.append((r, g, b, 0))
        else:
            # We also might want to apply partial transparency for anti-aliasing if it's close to the threshold
            if lum < 70 and g < 90:
                alpha = int(((lum - 50) / 20) * 255)
                alpha = max(0, min(255, alpha))
                new_data.append((r, g, b, alpha))
            else:
                new_data.append(item)
                
    img.putdata(new_data)
    
    # Let's crop it tightly to the visible pixels
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(out_path, 'PNG')
    print('Successfully processed logo.')
except Exception as e:
    print('Error:', e)
