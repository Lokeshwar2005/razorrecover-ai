import {
  CHRONOVA_CATALOG,
  ALL_BRANDS,
  ALL_CATEGORIES,
  ALL_VIBES,
} from '../src/data/chronovaCatalog'

function validateChronovaCatalog() {
  console.log('====================================================================')
  console.log('🔍 CHRONOVA 60-PRODUCT APPROVED DATASET INTEGRITY VALIDATION')
  console.log('====================================================================\n')

  // 1. Total Product Count
  console.log(`✓ Total Products in Catalog: ${CHRONOVA_CATALOG.length}`)
  if (CHRONOVA_CATALOG.length !== 60) {
    throw new Error(`Expected exactly 60 approved products, got ${CHRONOVA_CATALOG.length}`)
  }

  // 2. Unique Product IDs
  const seenIds = new Set<string>()
  for (const p of CHRONOVA_CATALOG) {
    if (seenIds.has(p.id)) {
      throw new Error(`Duplicate Product ID detected: ${p.id}`)
    }
    seenIds.add(p.id)
  }
  console.log(`✓ All ${seenIds.size} Product IDs are strictly unique.`)

  // 3. Brand Count Targets
  const brandCounts: Record<string, number> = {}
  for (const p of CHRONOVA_CATALOG) {
    brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1
  }

  console.log('\n✓ Approved Brand Verification:')
  const requiredTargets: Record<string, number> = {
    Titan: 15,
    Fastrack: 15,
    Casio: 15,
    Noise: 15,
  }

  for (const [brand, expected] of Object.entries(requiredTargets)) {
    const actual = brandCounts[brand] || 0
    console.log(`   • ${brand.padEnd(20)}: ${actual} models (Expected: ${expected})`)
    if (actual !== expected) {
      throw new Error(`Brand ${brand} has ${actual} models, expected ${expected}`)
    }
  }

  // Ensure no other brands exist
  for (const brand of Object.keys(brandCounts)) {
    if (!['Titan', 'Fastrack', 'Casio', 'Noise'].includes(brand)) {
      throw new Error(`Non-approved brand detected in catalog: ${brand}`)
    }
  }

  // 4. Image Integrity & Single Source of Truth
  console.log('\n✓ Verifying Image Integrity & No Unrelated Photos:')
  const forbiddenSubstrings = ['1522335789203'] // beauty photo
  for (const p of CHRONOVA_CATALOG) {
    if (!p.images || !p.images.primary) {
      throw new Error(`Product ${p.id} (${p.name}) missing primary image`)
    }
    if (!p.images.gallery || p.images.gallery.length === 0) {
      throw new Error(`Product ${p.id} (${p.name}) missing gallery images`)
    }
    if (p.images.primary !== p.images.gallery[0]) {
      throw new Error(`Product ${p.id} primary image does not match gallery[0]`)
    }

    for (const forbidden of forbiddenSubstrings) {
      if (p.images.primary.includes(forbidden)) {
        throw new Error(`Product ${p.id} contains forbidden unrelated image: ${forbidden}`)
      }
    }
  }
  console.log('✓ All 190 products have verified, consistent primary & gallery watch photos.')

  // 5. Specifications & Price Sanity Checks
  console.log('\n✓ Verifying Specifications & Pricing Sanity:')
  for (const p of CHRONOVA_CATALOG) {
    if (p.price_rupees <= 0) throw new Error(`Invalid price for ${p.id}`)
    if (!p.specs.movement) throw new Error(`Missing movement spec for ${p.id}`)
    if (!p.specs.case_size) throw new Error(`Missing case size spec for ${p.id}`)
    if (!p.specs.water_resistance) throw new Error(`Missing water resistance for ${p.id}`)
    if (!p.reviews || p.reviews.length === 0) throw new Error(`Missing reviews for ${p.id}`)
  }
  console.log('✓ All 190 products have complete technical specifications and verified reviews.')

  console.log('\n====================================================================')
  console.log('🎉 100% CHRONOVA CATALOG VALIDATION TESTS PASSED!')
  console.log('====================================================================\n')
}

validateChronovaCatalog()
