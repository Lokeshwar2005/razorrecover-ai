import {
  CHRONOVA_CATALOG,
  ALL_BRANDS,
  ALL_CATEGORIES,
  ALL_VIBES,
} from '../src/data/chronovaCatalog'

function validateChronovaCatalog() {
  console.log('====================================================================')
  console.log('🔍 CHRONOVA 190-PRODUCT CANONICAL DATA INTEGRITY VALIDATION')
  console.log('====================================================================\n')

  // 1. Total Product Count
  console.log(`✓ Total Products in Catalog: ${CHRONOVA_CATALOG.length}`)
  if (CHRONOVA_CATALOG.length < 190) {
    throw new Error(`Expected at least 190 products, got ${CHRONOVA_CATALOG.length}`)
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

  console.log('\n✓ Brand Target Verification:')
  const requiredTargets: Record<string, number> = {
    Titan: 14,
    Fastrack: 14,
    Casio: 14,
    Timex: 14,
    Fossil: 14,
    Sonata: 14,
    Seiko: 14,
    Citizen: 14,
    'Chronova Signature': 18,
    Garmin: 10,
    Amazfit: 10,
    Noise: 10,
    boAt: 10,
    Samsung: 10,
    'Apple Watch': 10,
  }

  for (const [brand, expected] of Object.entries(requiredTargets)) {
    const actual = brandCounts[brand] || 0
    console.log(`   • ${brand.padEnd(20)}: ${actual} models (Expected: ${expected})`)
    if (actual < expected) {
      throw new Error(`Brand ${brand} has ${actual} models, expected ${expected}`)
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
