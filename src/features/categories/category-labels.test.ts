import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { es } from '@/i18n/locales/es'

import { categoryDescription, categoryName, labelCategories } from './category-labels'

// Resolves keys against the Spanish messages, like i18next would with Spanish selected.
const t = ((key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], es)) as TFunction

describe('category labels', () => {
  it('translates the seeded categories while they keep their original text', () => {
    expect(categoryName('Pantry', t)).toBe('Abarrotes')
    expect(categoryName('Personal Care', t)).toBe('Cuidado personal')
    expect(categoryDescription('Dairy', 'Milk, cheese, yogurt, eggs', t)).toBe('Leche, queso, yogur, huevo')
  })

  it('shows categories people created or edited as typed', () => {
    expect(categoryName('Frutas', t)).toBe('Frutas')
    expect(categoryName('toString', t)).toBe('toString')
    expect(categoryDescription('Dairy', 'Solo quesos', t)).toBe('Solo quesos')
  })

  it('sorts by the shown name', () => {
    const labels = labelCategories([{ name: 'Snacks' }, { name: 'Pantry' }, { name: 'Dairy' }], t, 'es-MX')
      .map((category) => category.label)
    expect(labels).toEqual(['Abarrotes', 'Botanas y dulces', 'Lácteos'])
  })
})
