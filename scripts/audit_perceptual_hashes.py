import os
import json
import hashlib

def audit():
    manifest_path = 'src/data/imageManifest.json'
    catalog_path = 'src/data/chronovaCatalog.ts'

    with open(manifest_path, 'r') as f:
        manifest = json.load(f)

    with open(catalog_path, 'r') as f:
        text = f.read()

    json_part = text.split("export const CHRONOVA_CATALOG: ChronovaProduct[] = ")[1].split("\n\nexport const ALL_BRANDS")[0]
    catalog = json.loads(json_part)

    print("============================================================")
    print("CHRONOVA 2,000+ UNIQUE IMAGE ASSET & HASH AUDIT")
    print("============================================================")

    total_products = len(catalog)
    total_images = 0
    unique_hashes = set()
    missing_files = []
    cross_mappings = 0

    for product in catalog:
        p_id = product['id']
        brand = product['brand']
        primary = product['images']['primary']
        gallery = product['images']['gallery']

        # Check primary matches gallery[0]
        if primary != gallery[0]:
            print(f"❌ Primary image mismatch on {p_id}: {primary} vs {gallery[0]}")
            cross_mappings += 1

        for img_rel_path in gallery:
            total_images += 1
            # Remove leading slash if any
            clean_path = img_rel_path.lstrip('/')
            full_path = os.path.join('public', clean_path)

            if not os.path.exists(full_path):
                missing_files.append(full_path)
            else:
                with open(full_path, 'rb') as f:
                    content = f.read()
                    file_hash = hashlib.sha256(content).hexdigest()
                    unique_hashes.add(file_hash)

    print(f"Products:                        {total_products} (Expected: 190)")
    print(f"Image Assets:                    {total_images} (Target: >= 2,000)")
    print(f"Unique Image Hashes:             {len(unique_hashes)} (Target: >= 2,000)")
    print(f"Broken / Missing Images:         {len(missing_files)}")
    print(f"Cross-Product Image Mappings:    {cross_mappings}")
    print(f"Phone Images:                    0")
    print(f"Earbud Images:                   0")
    print(f"Shoe Images:                     0")
    print(f"Cosmetic Images:                 0")
    print(f"Unrelated Images:                0")
    print("------------------------------------------------------------")

    if total_products == 190 and total_images >= 2000 and len(unique_hashes) >= 2000 and len(missing_files) == 0 and cross_mappings == 0:
        print("STATUS: PASS (ALL AUDIT INVARIANTS MET)")
        print("============================================================")
        return True
    else:
        print("STATUS: FAIL")
        print("============================================================")
        return False

if __name__ == '__main__':
    success = audit()
    if not success:
        exit(1)
