import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'

export type Category = Schemas['CategoryResponse']
export type CreateCategory = Schemas['CreateCategoryRequest']
export type UpdateCategory = Schemas['UpdateCategoryRequest']

const categoryKeys = {
  all: ['categories'] as const,
}

/**
 * Sorted by name on the server. Inactive ones too: the list shows them, and a product can still
 * belong to one (it shows as inactive in the product form).
 */
export function useCategories() {
  return useQuery({
    queryKey: [...categoryKeys.all, 'with-inactive'],
    queryFn: () => unwrap(api.GET('/api/v1/categories', { params: { query: { includeInactive: true } } })),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCategory) => unwrap(api.POST('/api/v1/categories', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateCategory & { id: number }) =>
      unwrap(api.PUT('/api/v1/categories/{id}', { params: { path: { id } }, body })),
    // Also on failure, to reload a stale version; products show their category's name, so they reload too.
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ]),
  })
}
