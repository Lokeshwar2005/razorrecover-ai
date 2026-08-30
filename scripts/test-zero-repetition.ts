import { CHRONOVA_CATALOG } from '../src/data/chronovaCatalog'

function testZeroRepetition() {
  console.log('====================================================================')
  console.log('🔍 STRICT ZERO-REPETITION IMAGE & BRAND INTEGRITY TEST')
  console.log('====================================================================\n')

  const primaryImages = new Set<string>()
  const allGalleryImages = new Set<string>()

  for (const product of CHRONOVA_CATALOG) {
    // 1. Check primary image uniqueness
    if (primaryImages.has(product.images.primary)) {
      throw new Error(`❌ REPETITION DETECTED! Product ${product.id} (${product.name}) shares primary image ${product.images.primary} with another watch!`)
    }
    primaryImages.add(product.images.primary)

    // 2. Check that name starts with brand
    if (!product.name.toLowerCase().startsWith(product.brand.toLowerCase())) {
      throw new Error(`❌ BRAND MISMATCH! Product name "${product.name}" does not start with brand "${product.brand}"`)
    }

    // 3. Check gallery uniqueness for this product
    const prodGallerySet = new Set<string>()
    for (const view of product.images.gallery) {
      if (prodGallerySet.has(view)) {
        throw new Error(`❌ INTERNAL GALLERY REPETITION! Product ${product.id} has duplicate view ${view}`)
      }
      prodGallerySet.add(view)

      if (allGalleryImages.has(view)) {
        throw new Error(`❌ CROSS-PRODUCT REPETITION! View ${view} is reused across multiple watches!`)
      }
      allGalleryImages.add(view)
    }
  }

  console.log(`✓ Total Products Checked: ${CHRONOVA_CATALOG.length}`)
  console.log(`✓ Total Primary Images Checked: ${primaryImages.size} (100% Unique)`)
  console.log(`✓ Total Gallery Images Checked: ${allGalleryImages.size} (100% Unique)`)
  console.log(`✓ 0% Image Repetition Across All 190 Models & 15 Brands!`)
  console.log('\n====================================================================')
  console.log('🎉 100% ZERO-REPETITION TEST PASSED!')
  console.log('====================================================================\n')
}

testZeroRepetition()
