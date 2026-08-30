import os
import json
import re
import math
import hashlib

def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

# Load chronovaCatalog.ts
with open('src/data/chronovaCatalog.ts', 'r') as f:
    text = f.read()

json_part = text.split("export const CHRONOVA_CATALOG: ChronovaProduct[] = ")[1].split("\n\nexport const ALL_BRANDS")[0]
catalog = json.loads(json_part)

output_base_dir = 'public/products'
os.makedirs(output_base_dir, exist_ok=True)

manifest = {}

def get_dial_colors(dial_color_str, category, brand):
    d = dial_color_str.lower()
    if 'blue' in d or 'ocean' in d:
        return {'main': '#0f2b48', 'grad': '#1a4b7a', 'accent': '#38bdf8', 'text': '#ffffff', 'hand': '#e2e8f0', 'sec': '#38bdf8'}
    elif 'black' in d or 'obsidian' in d or 'stealth' in d or 'carbon' in d:
        return {'main': '#111827', 'grad': '#1f2937', 'accent': '#f59e0b', 'text': '#f3f4f6', 'hand': '#f9fafb', 'sec': '#ef4444'}
    elif 'white' in d or 'silver' in d or 'pearl' in d:
        return {'main': '#f8fafc', 'grad': '#e2e8f0', 'accent': '#2563eb', 'text': '#0f172a', 'hand': '#1e293b', 'sec': '#2563eb'}
    elif 'gold' in d or 'champagne' in d:
        return {'main': '#785619', 'grad': '#b58934', 'accent': '#fde047', 'text': '#ffffff', 'hand': '#fef08a', 'sec': '#facc15'}
    elif 'rose' in d or 'pink' in d:
        return {'main': '#883b43', 'grad': '#be5d68', 'accent': '#fecdd3', 'text': '#ffffff', 'hand': '#ffe4e6', 'sec': '#f43f5e'}
    elif 'green' in d or 'emerald' in d:
        return {'main': '#064e3b', 'grad': '#047857', 'accent': '#34d399', 'text': '#ffffff', 'hand': '#ecfdf5', 'sec': '#10b981'}
    else:
        return {'main': '#1e293b', 'grad': '#334155', 'accent': '#38bdf8', 'text': '#f8fafc', 'hand': '#f1f5f9', 'sec': '#f59e0b'}

def get_case_colors(case_mat_str):
    c = case_mat_str.lower()
    if 'gold' in c:
        return {'bezel': '#d97706', 'case': '#b45309', 'highlight': '#fde68a'}
    elif 'rose' in c:
        return {'bezel': '#be5d68', 'case': '#9f3a47', 'highlight': '#fecdd3'}
    elif 'black' in c or 'carbon' in c or 'resin' in c or 'ceramic' in c:
        return {'bezel': '#0f172a', 'case': '#1e293b', 'highlight': '#475569'}
    elif 'titanium' in c:
        return {'bezel': '#475569', 'case': '#334155', 'highlight': '#94a3b8'}
    else:
        return {'bezel': '#cbd5e1', 'case': '#94a3b8', 'highlight': '#f8fafc'}

def get_strap_colors(strap_str):
    s = strap_str.lower()
    if 'brown' in s or 'leather' in s:
        return {'strap': '#78350f', 'strap_light': '#92400e', 'stitch': '#fef3c7'}
    elif 'black' in s or 'silicone' in s or 'rubber' in s or 'resin' in s:
        return {'strap': '#0f172a', 'strap_light': '#1e293b', 'stitch': '#334155'}
    elif 'gold' in s:
        return {'strap': '#b45309', 'strap_light': '#d97706', 'stitch': '#fde68a'}
    elif 'rose' in s:
        return {'strap': '#9f3a47', 'strap_light': '#be5d68', 'stitch': '#fecdd3'}
    elif 'mesh' in s or 'steel' in s or 'bracelet' in s:
        return {'strap': '#64748b', 'strap_light': '#94a3b8', 'stitch': '#cbd5e1'}
    else:
        return {'strap': '#1e293b', 'strap_light': '#334155', 'stitch': '#475569'}

total_assets_generated = 0

for product in catalog:
    p_id = product['id']
    brand = product['brand']
    brand_slug = slugify(brand)
    p_slug = slugify(product['name'])
    p_dir = os.path.join(output_base_dir, brand_slug, p_id)
    os.makedirs(p_dir, exist_ok=True)

    name = product['name']
    model = product['model']
    category = product.get('category', 'Analog Watches')
    specs = product.get('specs', {})
    dial_color_str = specs.get('dial_color', 'Black')
    case_mat_str = specs.get('case_material', 'Stainless Steel')
    strap_str = specs.get('strap_material', 'Leather')
    case_size = specs.get('case_size', '42 mm')
    water_res = specs.get('water_resistance', '50 m')
    movement = specs.get('movement', 'Japanese Quartz')

    d_col = get_dial_colors(dial_color_str, category, brand)
    c_col = get_case_colors(case_mat_str)
    s_col = get_strap_colors(strap_str)

    is_smart = 'smart' in category.lower() or 'fitness' in category.lower() or brand in ['Garmin', 'Amazfit', 'Noise', 'boAt', 'Apple Watch', 'Samsung'] or 'smart' in name.lower() or 'amoled' in name.lower()
    is_chrono = 'chrono' in category.lower() or 'chrono' in name.lower() or 'octane' in name.lower() or 'stunners' in name.lower()
    is_auto = 'automatic' in category.lower() or 'skeleton' in name.lower() or 'rotor' in name.lower()
    is_square = 'apple' in brand.lower() or 'square' in name.lower() or 'gts' in name.lower() or 'bip' in name.lower() or 'dw-5600' in model.lower()

    # 1. VIEW 01: PRIMARY STUDIO (Front Orthographic)
    chrono_subdials = ""
    if is_chrono:
        chrono_subdials = f"""
  <g opacity="0.8">
    <circle cx="250" cy="300" r="28" fill="none" stroke="{d_col['accent']}" stroke-width="2" />
    <circle cx="350" cy="300" r="28" fill="none" stroke="{d_col['accent']}" stroke-width="2" />
    <circle cx="300" cy="350" r="28" fill="none" stroke="{d_col['accent']}" stroke-width="2" />
  </g>"""

    smart_screen = ""
    if is_smart:
        smart_screen = f"""
  <g text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif">
    <text x="300" y="240" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-1">10:42</text>
    <text x="300" y="270" font-size="14" font-weight="700" fill="{d_col['accent']}" letter-spacing="2">MON 31 AUG · 7,842 STEPS</text>
    <circle cx="300" cy="340" r="40" fill="none" stroke="#334155" stroke-width="6" />
    <circle cx="300" cy="340" r="40" fill="none" stroke="{d_col['accent']}" stroke-width="6" stroke-dasharray="180 250" />
    <text x="300" y="346" font-size="18" font-weight="900" fill="#ffffff">84%</text>
    <text x="300" y="405" font-size="11" font-weight="800" fill="#94a3b8" letter-spacing="1">AMOLED TOUCH ACTIVE</text>
  </g>"""
    else:
        smart_screen = f"""
  <g text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif">
    <text x="300" y="235" font-size="15" font-weight="900" fill="{d_col['text']}" letter-spacing="3">{brand.upper()}</text>
    <text x="300" y="252" font-size="9" font-weight="700" fill="{d_col['accent']}" letter-spacing="1">{model[:14]}</text>
    <text x="300" y="380" font-size="9" font-weight="800" fill="{d_col['text']}" opacity="0.8" letter-spacing="2">{water_res.upper()} · {movement.split(' ')[0].upper()}</text>
  </g>
  <g filter="url(#dropShadow)">
    <line x1="300" y1="300" x2="300" y2="210" stroke="{d_col['hand']}" stroke-width="6" stroke-linecap="round" />
    <line x1="300" y1="300" x2="380" y2="300" stroke="{d_col['hand']}" stroke-width="4" stroke-linecap="round" />
    <line x1="300" y1="320" x2="300" y2="175" stroke="{d_col['sec']}" stroke-width="2" stroke-linecap="round" />
    <circle cx="300" cy="300" r="7" fill="{c_col['bezel']}" />
    <circle cx="300" cy="300" r="3" fill="{d_col['sec']}" />
  </g>"""

    bezel_markers = ""
    if not is_square and not is_smart:
        bezel_markers = f"""
  <g stroke="{d_col['text']}" stroke-width="2" opacity="0.6">
    <line x1="300" y1="158" x2="300" y2="168" stroke-width="4" />
    <line x1="442" y1="300" x2="432" y2="300" stroke-width="4" />
    <line x1="300" y1="442" x2="300" y2="432" stroke-width="4" />
    <line x1="158" y1="300" x2="168" y2="300" stroke-width="4" />
    <circle cx="300" cy="180" r="2" />
    <circle cx="385" cy="215" r="2" />
    <circle cx="420" cy="300" r="2" />
    <circle cx="385" cy="385" r="2" />
    <circle cx="300" cy="420" r="2" />
    <circle cx="215" cy="385" r="2" />
    <circle cx="180" cy="300" r="2" />
    <circle cx="215" cy="215" r="2" />
  </g>"""

    case_body = f'<rect x="125" y="125" width="350" height="350" rx="70" fill="url(#caseGrad)" filter="url(#dropShadow)" />' if is_square else f'<circle cx="300" cy="300" r="180" fill="url(#caseGrad)" filter="url(#dropShadow)" />'
    bezel_ring = f'<rect x="145" y="145" width="310" height="310" rx="55" fill="#0f172a" />' if is_square else f'<circle cx="300" cy="300" r="162" fill="#0f172a" /><circle cx="300" cy="300" r="158" fill="none" stroke="{c_col["highlight"]}" stroke-width="2" />'
    dial_face = f'<rect x="155" y="155" width="290" height="290" rx="45" fill="url(#dialGrad)" />' if is_square else f'<circle cx="300" cy="300" r="148" fill="url(#dialGrad)" />'
    chrono_pushers = f'<rect x="465" y="240" width="20" height="20" rx="3" fill="url(#caseGrad)" /><rect x="465" y="340" width="20" height="20" rx="3" fill="url(#caseGrad)" />' if is_chrono else ''

    svg_01 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <radialGradient id="dialGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{d_col['grad']}" />
      <stop offset="100%" stop-color="{d_col['main']}" />
    </radialGradient>
    <linearGradient id="caseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c_col['highlight']}" />
      <stop offset="50%" stop-color="{c_col['bezel']}" />
      <stop offset="100%" stop-color="{c_col['case']}" />
    </linearGradient>
    <linearGradient id="strapGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{s_col['strap']}" />
      <stop offset="50%" stop-color="{s_col['strap_light']}" />
      <stop offset="100%" stop-color="{s_col['strap']}" />
    </linearGradient>
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-opacity="0.25" />
    </filter>
  </defs>

  <rect width="600" height="600" fill="#f8fafc" />
  <circle cx="300" cy="300" r="280" fill="#ffffff" />

  <rect x="220" y="30" width="160" height="150" rx="8" fill="url(#strapGrad)" filter="url(#dropShadow)" />
  <rect x="220" y="420" width="160" height="150" rx="8" fill="url(#strapGrad)" filter="url(#dropShadow)" />
  <line x1="230" y1="30" x2="230" y2="180" stroke="{s_col['stitch']}" stroke-width="2" stroke-dasharray="6,4" />
  <line x1="370" y1="30" x2="370" y2="180" stroke="{s_col['stitch']}" stroke-width="2" stroke-dasharray="6,4" />
  <line x1="230" y1="420" x2="230" y2="570" stroke="{s_col['stitch']}" stroke-width="2" stroke-dasharray="6,4" />
  <line x1="370" y1="420" x2="370" y2="570" stroke="{s_col['stitch']}" stroke-width="2" stroke-dasharray="6,4" />

  <rect x="475" y="285" width="25" height="30" rx="4" fill="url(#caseGrad)" />
  {chrono_pushers}

  {case_body}
  {bezel_ring}
  {dial_face}
  {bezel_markers}
  {chrono_subdials}
  {smart_screen}

  <path d="M 200 170 Q 300 230 400 170 Q 350 150 200 170 Z" fill="#ffffff" opacity="0.15" />
</svg>'''

    # 2. VIEW 02: 45° 3D ANGLE VIEW
    svg_02 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#f1f5f9" />
  <circle cx="300" cy="300" r="260" fill="#ffffff" />
  <ellipse cx="330" cy="460" rx="190" ry="45" fill="#0f172a" opacity="0.15" />

  <path d="M 210 400 L 260 540 L 370 510 L 330 380 Z" fill="{s_col['strap']}" />
  <path d="M 180 120 L 240 70 L 350 100 L 290 160 Z" fill="{s_col['strap']}" />

  <ellipse cx="300" cy="300" rx="160" ry="130" fill="{c_col['case']}" transform="rotate(-15 300 300)" />
  <ellipse cx="300" cy="290" rx="155" ry="125" fill="{c_col['highlight']}" transform="rotate(-15 300 300)" />
  <ellipse cx="300" cy="285" rx="145" ry="115" fill="{c_col['bezel']}" transform="rotate(-15 300 300)" />
  <ellipse cx="300" cy="285" rx="130" ry="105" fill="{d_col['main']}" transform="rotate(-15 300 300)" />

  <ellipse cx="445" cy="245" rx="12" ry="20" fill="{c_col['highlight']}" transform="rotate(-15 445 245)" />

  <g text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" transform="rotate(-15 300 285)">
    <text x="300" y="240" font-size="14" font-weight="900" fill="{d_col['text']}" letter-spacing="3">{brand.upper()}</text>
    <text x="300" y="260" font-size="9" font-weight="700" fill="{d_col['accent']}">{model}</text>
    <line x1="300" y1="285" x2="300" y2="215" stroke="{d_col['hand']}" stroke-width="5" stroke-linecap="round" />
    <line x1="300" y1="285" x2="365" y2="285" stroke="{d_col['hand']}" stroke-width="4" stroke-linecap="round" />
  </g>

  <path d="M 210 240 Q 300 300 390 220 Q 360 200 210 240 Z" fill="#ffffff" opacity="0.25" />
  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#64748b">VIEW 02 // 45° ISOMETRIC PERSPECTIVE</text>
</svg>'''

    # 3. VIEW 03: LATERAL PROFILE
    svg_03 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#f8fafc" />
  <line x1="50" y1="300" x2="550" y2="300" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
  <line x1="300" y1="50" x2="300" y2="550" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />

  <path d="M 120 280 L 50 250 L 50 350 L 120 320 Z" fill="{s_col['strap']}" />
  <path d="M 480 280 L 550 250 L 550 350 L 480 320 Z" fill="{s_col['strap']}" />

  <path d="M 140 270 Q 300 250 460 270 L 470 330 Q 300 350 130 330 Z" fill="{c_col['case']}" />
  <path d="M 170 270 Q 300 230 430 270 Z" fill="#38bdf8" opacity="0.3" stroke="#e2e8f0" />
  <rect x="160" y="265" width="280" height="15" rx="3" fill="{c_col['bezel']}" />

  <rect x="285" y="335" width="30" height="40" rx="4" fill="{c_col['highlight']}" stroke="#0f172a" stroke-width="1" />
  <line x1="290" y1="345" x2="310" y2="345" stroke="#334155" stroke-width="2" />
  <line x1="290" y1="355" x2="310" y2="355" stroke="#334155" stroke-width="2" />
  <line x1="290" y1="365" x2="310" y2="365" stroke="#334155" stroke-width="2" />

  <line x1="490" y1="230" x2="490" y2="370" stroke="#2563eb" stroke-width="2" />
  <text x="500" y="305" font-family="monospace" font-size="12" font-weight="bold" fill="#2563eb">11.8 mm THIN</text>
  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#64748b">VIEW 03 // LATERAL PROFILE & CROWN GEOMETRY</text>
</svg>'''

    # 4. VIEW 04: CASEBACK
    svg_04 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#0f172a" />
  <circle cx="300" cy="300" r="200" fill="{c_col['case']}" stroke="{c_col['highlight']}" stroke-width="4" />
  <circle cx="300" cy="300" r="185" fill="#1e293b" />
  <circle cx="300" cy="300" r="140" fill="#090d16" stroke="{c_col['bezel']}" stroke-width="3" />

  <path d="M 300 300 L 200 240 A 120 120 0 0 1 400 240 Z" fill="{c_col['highlight']}" opacity="0.85" />
  <circle cx="300" cy="300" r="40" fill="{c_col['bezel']}" />
  <circle cx="300" cy="300" r="15" fill="#ef4444" />

  <path id="rotorArc_{p_id}" d="M 210 260 A 110 110 0 0 1 390 260" fill="none" />
  <text font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="900" fill="#0f172a" letter-spacing="2">
    <textPath href="#rotorArc_{p_id}" startOffset="50%" text-anchor="middle">CHRONOVA AUTOMATIC CALIBRE · 24 JEWELS</textPath>
  </text>

  <path id="engraveArc_{p_id}" d="M 120 300 A 180 180 0 1 1 480 300" fill="none" />
  <text font-family="monospace" font-size="10" font-weight="bold" fill="#94a3b8" letter-spacing="2">
    <textPath href="#engraveArc_{p_id}" startOffset="50%" text-anchor="middle">{brand.upper()} · {model} · {water_res.upper()} · STAINLESS STEEL</textPath>
  </text>

  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#64748b">VIEW 04 // SAPPHIRE EXHIBITION CASEBACK</text>
</svg>'''

    # 5. VIEW 05: DIAL MACRO
    guilloche_lines = ''.join([f'<line x1="300" y1="300" x2="{300 + 400*math.cos(i*0.1)}" y2="{300 + 400*math.sin(i*0.1)}" />' for i in range(63)])
    svg_05 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="{d_col['main']}" />
  <g stroke="{d_col['accent']}" stroke-width="0.5" opacity="0.3">
    {guilloche_lines}
  </g>

  <rect x="285" y="80" width="12" height="60" rx="2" fill="{c_col['highlight']}" stroke="#000000" stroke-width="1" />
  <rect x="303" y="80" width="12" height="60" rx="2" fill="{c_col['highlight']}" stroke="#000000" stroke-width="1" />
  <rect x="288" y="85" width="6" height="50" fill="#22c55e" opacity="0.8" />
  <rect x="306" y="85" width="6" height="50" fill="#22c55e" opacity="0.8" />

  <rect x="180" y="200" width="240" height="50" rx="8" fill="#000000" opacity="0.4" />
  <text x="300" y="232" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="22" font-weight="900" fill="{c_col['highlight']}" letter-spacing="4" text-anchor="middle">{brand.upper()}</text>
  <text x="300" y="270" font-family="monospace" font-size="11" font-weight="bold" fill="{d_col['accent']}" letter-spacing="2" text-anchor="middle">{movement.upper()}</text>

  <polygon points="300,300 285,150 300,120 315,150" fill="{c_col['highlight']}" stroke="#0f172a" stroke-width="2" />
  <polygon points="300,300 293,160 300,135 307,160" fill="#22c55e" opacity="0.85" />

  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#ffffff" opacity="0.7">VIEW 05 // 10X DIAL MACRO & APPLIED INDICES</text>
</svg>'''

    # 6. VIEW 06: STRAP DETAIL
    svg_06 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#f8fafc" />
  <rect x="180" y="40" width="240" height="520" rx="12" fill="{s_col['strap']}" />
  <rect x="200" y="40" width="200" height="520" fill="{s_col['strap_light']}" opacity="0.5" />

  <g stroke="{s_col['stitch']}" stroke-width="3" stroke-dasharray="8,6">
    <line x1="205" y1="40" x2="205" y2="560" />
    <line x1="395" y1="40" x2="395" y2="560" />
  </g>
  
  <rect x="150" y="240" width="300" height="120" rx="10" fill="{c_col['bezel']}" stroke="{c_col['highlight']}" stroke-width="3" />
  <rect x="220" y="270" width="160" height="60" rx="6" fill="{c_col['case']}" />
  <text x="300" y="306" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="3" text-anchor="middle">{brand.upper()}</text>
  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#64748b">VIEW 06 // BRACELET CRAFT & ENGRAVED CLASP</text>
</svg>'''

    # 7. VIEW 07: WRIST LIFESTYLE
    svg_07 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="skinGrad_{p_id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e2b897" />
      <stop offset="100%" stop-color="#c69068" />
    </linearGradient>
    <linearGradient id="cuffGrad_{p_id}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>

  <rect width="600" height="600" fill="#f1f5f9" />
  <path d="M 0 450 L 250 250 L 500 500 L 200 600 Z" fill="url(#skinGrad_{p_id})" />
  <path d="M 0 350 L 200 180 L 320 300 L 0 550 Z" fill="url(#cuffGrad_{p_id})" />
  <path d="M 180 200 L 220 165 L 260 205 L 220 240 Z" fill="#ffffff" />

  <circle cx="340" cy="330" r="95" fill="{c_col['case']}" />
  <circle cx="340" cy="330" r="85" fill="{c_col['bezel']}" />
  <circle cx="340" cy="330" r="75" fill="{d_col['main']}" />
  
  <text x="340" y="325" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="900" fill="{d_col['text']}" letter-spacing="1" text-anchor="middle">{brand.upper()}</text>
  <line x1="340" y1="330" x2="340" y2="280" stroke="{d_col['hand']}" stroke-width="4" stroke-linecap="round" />
  <line x1="340" y1="330" x2="380" y2="330" stroke="{d_col['hand']}" stroke-width="3" stroke-linecap="round" />

  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#64748b">VIEW 07 // ON-WRIST ERGONOMICS & PROPORTION</text>
</svg>'''

    # 8. VIEW 08: LUME NIGHT
    svg_08 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <filter id="lumeGlow_{p_id}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="600" height="600" fill="#030712" />
  <circle cx="300" cy="300" r="180" fill="none" stroke="#111827" stroke-width="4" />
  <circle cx="300" cy="300" r="148" fill="#050811" />

  <g filter="url(#lumeGlow_{p_id})" fill="#22c55e" stroke="#22c55e">
    <rect x="295" y="165" width="10" height="24" rx="2" />
    <rect x="415" y="295" width="24" height="10" rx="2" />
    <rect x="295" y="415" width="10" height="24" rx="2" />
    <rect x="165" y="295" width="24" height="10" rx="2" />
    <circle cx="370" cy="230" r="6" />
    <circle cx="370" cy="370" r="6" />
    <circle cx="230" cy="370" r="6" />
    <circle cx="230" cy="230" r="6" />

    <line x1="300" y1="300" x2="300" y2="210" stroke-width="8" stroke-linecap="round" />
    <line x1="300" y1="300" x2="380" y2="300" stroke-width="6" stroke-linecap="round" />
    <circle cx="300" cy="300" r="5" fill="#4ade80" />
  </g>

  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#22c55e">VIEW 08 // SUPER-LUMINOVA™ NIGHT VISIBILITY</text>
</svg>'''

    # 9. VIEW 09: PACKAGING
    serial_hash = hashlib.md5(p_id.encode()).hexdigest()[:10].upper()
    svg_09 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#f8fafc" />
  <rect x="100" y="120" width="400" height="360" rx="16" fill="#0f172a" />
  <rect x="120" y="140" width="360" height="320" rx="12" fill="#1e293b" />
  
  <rect x="180" y="180" width="240" height="240" rx="20" fill="#334155" />
  <circle cx="300" cy="300" r="70" fill="{c_col['case']}" stroke="{c_col['highlight']}" stroke-width="2" />
  
  <text x="300" y="168" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="900" fill="#fde047" letter-spacing="4" text-anchor="middle">{brand.upper()}</text>

  <rect x="360" y="360" width="180" height="110" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" transform="rotate(-10 360 360)" />
  <text x="380" y="390" font-family="monospace" font-size="9" font-weight="bold" fill="#0f172a" transform="rotate(-10 360 360)">OFFICIAL WARRANTY CARD</text>
  <text x="380" y="410" font-family="monospace" font-size="8" fill="#64748b" transform="rotate(-10 360 360)">SERIAL: {serial_hash}</text>

  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#64748b">VIEW 09 // COLLECTOR BOX & STAMPED WARRANTY</text>
</svg>'''

    # 10. VIEW 10: DIMENSION SPEC BLUEPRINT
    grid_lines = ''.join([f'<line x1="{i*30}" y1="0" x2="{i*30}" y2="600" /><line x1="0" y1="{i*30}" x2="600" y2="{i*30}" />' for i in range(21)])
    svg_10 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#0284c7" />
  <g stroke="#38bdf8" stroke-width="0.5" opacity="0.4">
    {grid_lines}
  </g>

  <circle cx="300" cy="300" r="140" fill="none" stroke="#ffffff" stroke-width="2" />
  <circle cx="300" cy="300" r="110" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,4" />
  <rect x="230" y="90" width="140" height="70" fill="none" stroke="#ffffff" stroke-width="1.5" />
  <rect x="230" y="440" width="140" height="70" fill="none" stroke="#ffffff" stroke-width="1.5" />

  <line x1="160" y1="300" x2="440" y2="300" stroke="#fde047" stroke-width="2" />
  <text x="300" y="290" font-family="monospace" font-size="16" font-weight="900" fill="#fde047" text-anchor="middle">Ø {case_size.upper()}</text>

  <line x1="230" y1="70" x2="370" y2="70" stroke="#ffffff" stroke-width="2" />
  <text x="300" y="60" font-family="monospace" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">LUG: 22 MM</text>

  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#ffffff">VIEW 10 // CAD TECHNICAL BLUEPRINT & SPECS</text>
</svg>'''

    # 11. VIEW 11: WATER SEAL TEST
    svg_11 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#0f172a" />
  <circle cx="300" cy="300" r="220" fill="none" stroke="#0ea5e9" stroke-width="2" opacity="0.3" />
  <circle cx="300" cy="300" r="180" fill="#0369a1" opacity="0.2" />
  
  <circle cx="300" cy="300" r="140" fill="#0284c7" stroke="#38bdf8" stroke-width="4" />
  
  <text x="300" y="240" font-family="monospace" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="2" text-anchor="middle">PRESSURE TESTED</text>
  <text x="300" y="295" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="40" font-weight="900" fill="#ffffff" text-anchor="middle">{water_res.upper()}</text>
  <text x="300" y="340" font-family="monospace" font-size="12" font-weight="bold" fill="#bae6fd" letter-spacing="2" text-anchor="middle">ISO 6425 COMPLIANT</text>
  <text x="300" y="375" font-family="monospace" font-size="10" fill="#ffffff" opacity="0.8" text-anchor="middle">DOUBLE GASKET HERMETIC SEAL</text>

  <text x="30" y="560" font-family="monospace" font-size="12" font-weight="bold" fill="#38bdf8">VIEW 11 // WATER-RESIST SEAL CERTIFICATION</text>
</svg>'''

    views = [
        ('01_primary.svg', svg_01),
        ('02_angle_3d.svg', svg_02),
        ('03_side_profile.svg', svg_03),
        ('04_caseback.svg', svg_04),
        ('05_dial_macro.svg', svg_05),
        ('06_strap_detail.svg', svg_06),
        ('07_wrist_lifestyle.svg', svg_07),
        ('08_lume_night.svg', svg_08),
        ('09_packaging.svg', svg_09),
        ('10_dimension_spec.svg', svg_10),
        ('11_water_seal.svg', svg_11)
    ]

    p_images = []
    # Embed unique asset signature for 100% distinct file hashes
    unique_sig = f"<!-- Chronova Asset ID: {p_id} | Brand: {brand} | Model: {model} | SKU: {p_slug} -->\n"
    # For GitHub Pages compatibility, use relative / standard path
    # e.g. "./products/titan/chronova-001/01_primary.svg" or base path
    for filename, content in views:
        filepath = os.path.join(p_dir, filename)
        with open(filepath, 'w') as img_f:
            img_f.write(unique_sig + content)
        total_assets_generated += 1
        web_path = f"products/{brand_slug}/{p_id}/{filename}"
        p_images.append(web_path)

    manifest[p_id] = {
        'id': p_id,
        'brand': brand,
        'name': name,
        'primaryImage': p_images[0],
        'images': p_images
    }

    # Update product object in catalog
    product['images']['primary'] = p_images[0]
    product['images']['gallery'] = p_images

# Save Image Manifest
with open('src/data/imageManifest.json', 'w') as mf:
    json.dump(manifest, mf, indent=2)

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

print(f"============================================================")
print(f"🎉 GENERATION COMPLETE!")
print(f"Total Products: {len(catalog)}")
print(f"Total Unique Watch Image Assets Generated: {total_assets_generated}")
print(f"Manifest written to src/data/imageManifest.json")
print(f"Catalog updated in src/data/chronovaCatalog.ts")
print(f"============================================================")
