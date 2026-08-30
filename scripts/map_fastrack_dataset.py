import json
import os

# Curated High-Definition Photographic URLs for 15 Fastrack Watch Models
fastrack_photo_map = {
    # WATCH 01: Fastrack Stunners White Dial Metal Strap
    0: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=85",
    # WATCH 02: Fastrack Stunners X Beige Dial Leather Strap
    1: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&auto=format&fit=crop&q=85",
    # WATCH 03: Fastrack Fastfit Grey Dial Grey Silicone Strap
    2: "https://images.unsplash.com/photo-1544117519-31a4b719223d?w=800&auto=format&fit=crop&q=85",
    # WATCH 04: Fastrack Vyb Maverick Brown Dial Metal Strap
    3: "https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=800&auto=format&fit=crop&q=85",
    # WATCH 05: Fastrack Hype Adventure Green Dial Green Silicone Strap
    4: "https://images.unsplash.com/photo-1549482199-bc1ca6f58502?w=800&auto=format&fit=crop&q=85",
    # WATCH 06: Fastrack UFO Multifunction Green Dial Silver Stainless Steel
    5: "https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=800&auto=format&fit=crop&q=85",
    # WATCH 07: Fastrack Thor Multifunction Red Dial Metal Strap
    6: "https://images.unsplash.com/photo-1548171915-e79a380a2a4b?w=800&auto=format&fit=crop&q=85",
    # WATCH 08: Fastrack Groove Multifunction Anthracite Dial Metal Strap
    7: "https://images.unsplash.com/photo-1539874754764-5a96559165b0?w=800&auto=format&fit=crop&q=85",
    # WATCH 09: Fastrack Kronos Chronograph Black Dial Brown Leather Strap
    8: "https://images.unsplash.com/photo-1535747790212-30c585ab4867?w=800&auto=format&fit=crop&q=85",
    # WATCH 10: Fastrack Pulse IV Dual Time Teal Green Sunray Dial Silver Metal Strap
    9: "https://images.unsplash.com/photo-1609587312208-cea54be969e7?w=800&auto=format&fit=crop&q=85",
    # WATCH 11: Fastrack StreetStyle Analog Digital Black Dial Translucent Green Strap
    10: "https://images.unsplash.com/photo-1510017803434-a899398421b3?w=800&auto=format&fit=crop&q=85",
    # WATCH 12: Fastrack Overdrive Round Dial Watch
    11: "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&auto=format&fit=crop&q=85",
    # WATCH 13: Fastrack Men Tik Tok 5.0 Brown Shaped Dial Watch
    12: "https://images.unsplash.com/photo-1622434641406-a158123450f9?w=800&auto=format&fit=crop&q=85",
    # WATCH 14: Fastrack Men Automatics Dial Metal Strap Automatic Watch
    13: "https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?w=800&auto=format&fit=crop&q=85",
    # WATCH 15: Fastrack Stunners Green Dial Silver Stainless Steel Strap
    14: "https://images.unsplash.com/photo-1594576722512-582bcd46fba3?w=800&auto=format&fit=crop&q=85",
}

with open('src/data/chronovaCatalog.ts', 'r') as f:
    text = f.read()

json_part = text.split("export const CHRONOVA_CATALOG: ChronovaProduct[] = ")[1].split("\n\nexport const ALL_BRANDS")[0]
catalog = json.loads(json_part)

fastrack_index = 0
for p in catalog:
    if p['brand'] == 'Fastrack':
        photo_url = fastrack_photo_map.get(fastrack_index, "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&auto=format&fit=crop&q=85")
        p['images']['primary'] = photo_url
        p['images']['gallery'] = [photo_url]
        fastrack_index += 1

# Update chronovaCatalog.ts
new_ts = f"""import {{ ChronovaProduct, WatchBrand, WatchCategory, WatchVibe }} from '../components/Chronova/types'

export const CHRONOVA_CATALOG: ChronovaProduct[] = {json.dumps(catalog, indent=2)}

export const ALL_BRANDS: WatchBrand[] = [
  'Titan',
  'Fastrack',
  'Casio',
  'Timex',
  'Fossil',
  'Sonata',
  'Seiko',
  'Citizen',
  'Chronova Signature',
  'Garmin',
  'Amazfit',
  'Noise',
  'boAt',
  'Samsung',
  'Apple Watch',
]

export const ALL_CATEGORIES: WatchCategory[] = [
  'Analog Watches',
  'Digital Watches',
  'Smart Watches',
  'Automatic Watches',
  'Chronograph',
  'Sports Watches',
  'Dress Watches',
  'Casual Watches',
  'Luxury Watches',
  'Fitness Watches',
  'Outdoor Watches',
  'Minimal Watches',
]

export const ALL_VIBES: WatchVibe[] = [
  'Everyday',
  'Office',
  'Street',
  'Sport',
  'Party',
  'Travel',
  'Minimal',
  'Premium',
]
"""

with open('src/data/chronovaCatalog.ts', 'w') as f:
    f.write(new_ts)

print(f"✓ Successfully mapped {fastrack_index} Fastrack watches in chronovaCatalog.ts!")
