import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import { type SortState, sortParam } from '@/lib/sort'

export type Product = Schemas['ProductResponse']
export type CreateProduct = Schemas['CreateProductRequest']
export type UpdateProduct = Schemas['UpdateProductRequest']

export const PAGE_SIZE = 20

export interface ProductFilters {
  search: string
  categoryId: number | null
  active: boolean
  lowStock: boolean
}

// Every product query key starts with 'products', so invalidating productKeys.all also refreshes pickers and details.
export const productKeys = {
  all: ['products'] as const,
  page: (filters: ProductFilters, page: number, size: number, sort: SortState | null) =>
    ['products', 'page', filters, page, size, sort] as const,
}

/** Sorted by name on the server unless sort says otherwise; blank search and no category mean "all". */
export function useProducts(filters: ProductFilters, page: number, size = PAGE_SIZE, sort: SortState | null = null) {
  return useQuery({
    queryKey: productKeys.page(filters, page, size, sort),
    queryFn: () => unwrap(api.GET('/api/v1/products', {
      params: {
        query: {
          search: filters.search || undefined,
          categoryId: filters.categoryId ?? undefined,
          active: filters.active,
          lowStock: filters.lowStock,
          page,
          size,
          sort: sortParam(sort),
        },
      },
    })),
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateProduct) => unwrap(api.POST('/api/v1/products', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateProduct & { id: number }) =>
      unwrap(api.PUT('/api/v1/products/{id}', { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
    // Someone else saved first: reload the list so reopening the product shows their version.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: productKeys.all })
      }
    },
  })
}

/** Uploading or removing the photo changes the product's version, so it runs after any form save. */
export function useUploadProductImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      unwrap(api.PUT('/api/v1/products/{id}/image', {
        params: { path: { id } },
        // The schema types the part as a string; FormData sends the File with its own boundary.
        body: { file: file as unknown as string },
        bodySerializer: () => {
          const form = new FormData()
          form.append('file', file)
          return form
        },
      })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

export function useRemoveProductImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE('/api/v1/products/{id}/image', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

export type StockAdjustment = Schemas['CreateStockAdjustmentRequest']

// Same limit as the API (CreateStockAdjustmentRequest).
export const MAX_ADJUSTMENT = 100_000

/**
 * Positive quantity adds units, negative removes them (never below 0). The key is created once per
 * adjustment and reused on retries, so a double click or a lost response doesn't apply it twice.
 */
export function useAdjustStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idempotencyKey, ...body }: StockAdjustment & { idempotencyKey: string }) =>
      unwrap(api.POST('/api/v1/stock-adjustments', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body,
      })),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-reports'] })
    },
  })
}

/** Only products never purchased, sold or adjusted can be deleted; others answer 409 (deactivate them). */
export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE('/api/v1/products/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

/**
 * The product with exactly this barcode, active first and then inactive (the search also matches
 * names and SKUs, so only an exact barcode counts); null when none has it.
 */
export async function findProductByBarcode(barcode: string): Promise<Product | null> {
  for (const active of [true, false]) {
    const page = await unwrap(api.GET('/api/v1/products', { params: { query: { search: barcode, active, size: 5 } } }))
    const match = page.content?.find((product) => product.barcode === barcode)
    if (match) {
      return match
    }
  }
  return null
}

/** How many matches a product picker shows; a longer list means the search needs more letters. */
export const PRODUCT_MATCHES = 8

/**
 * Products by name, SKU (contains) or barcode (exact) for pickers; nothing is requested until
 * something is typed.
 */
export function useProductSearch(search: string, active = true) {
  return useQuery({
    queryKey: [...productKeys.all, 'picker', search, active] as const,
    queryFn: () => unwrap(api.GET('/api/v1/products', {
      params: { query: { search, active, page: 0, size: PRODUCT_MATCHES } },
    })),
    enabled: search !== '',
    placeholderData: keepPreviousData,
  })
}

/** One product in full; idle while id is null. */
export function useProduct(id: number | null) {
  return useQuery({
    queryKey: [...productKeys.all, 'detail', id] as const,
    enabled: id !== null,
    queryFn: () => unwrap(api.GET('/api/v1/products/{id}', { params: { path: { id: id! } } })),
  })
}
