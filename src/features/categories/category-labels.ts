import type { TFunction } from 'i18next'

import type { Category } from './queries'

// The categories the API seeds (V2 migration) are stored in English. They're shown in the chosen
// language while they keep their original name; categories people create show as typed.
const defaults = {
  Pantry: { key: 'pantry', description: 'Rice, beans, sugar, oil, pasta, canned food' },
  Dairy: { key: 'dairy', description: 'Milk, cheese, yogurt, eggs' },
  Bakery: { key: 'bakery', description: 'Bread, tortillas' },
  Beverages: { key: 'beverages', description: 'Soda, juice, water' },
  Snacks: { key: 'snacks', description: 'Chips, candy, cookies' },
  Cleaning: { key: 'cleaning', description: 'Detergent, bleach, cleaning supplies' },
  'Personal Care': { key: 'personalCare', description: 'Soap, shampoo, toothpaste, toilet paper' },
} as const

type DefaultName = keyof typeof defaults

function seeded(name: string | undefined) {
  return name && Object.hasOwn(defaults, name) ? defaults[name as DefaultName] : undefined
}

export function categoryName(name: string | undefined, t: TFunction): string {
  const seed = seeded(name)
  return seed ? t(`categories.defaults.${seed.key}.name`) : name ?? ''
}

// Translated only while it is still the seeded text; an edited description shows as typed.
export function categoryDescription(name: string | undefined, description: string | undefined, t: TFunction) {
  const seed = seeded(name)
  return seed && description === seed.description ? t(`categories.defaults.${seed.key}.description`) : description
}

export type LabeledCategory = Category & { label: string; descriptionLabel?: string }

// Shown names, sorted by them in the current language (the API sorts by the stored English name).
export function labelCategories(categories: Category[], t: TFunction, locale: string): LabeledCategory[] {
  return categories
    .map((category) => ({
      ...category,
      label: categoryName(category.name, t),
      descriptionLabel: categoryDescription(category.name, category.description, t),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
}
