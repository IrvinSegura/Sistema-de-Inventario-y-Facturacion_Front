import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'

export type Seller = Schemas['UserResponse']
export type CreateSeller = Schemas['CreateUserRequest']
export type UpdateSeller = Schemas['UpdateUserRequest']

export const PAGE_SIZE = 20

export const sellerKeys = {
  all: ['users'] as const,
  page: (page: number) => ['users', 'page', page] as const,
}

// Every account (sellers, supervisors and admins) comes from the users API (ADMIN only), sorted by name on the server.
export function useSellers(page: number) {
  return useQuery({
    queryKey: sellerKeys.page(page),
    queryFn: () => unwrap(api.GET('/api/v1/users', { params: { query: { page, size: PAGE_SIZE } } })),
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export function useCreateSeller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSeller) => unwrap(api.POST('/api/v1/users', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sellerKeys.all }),
  })
}

export function useUpdateSeller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSeller & { id: number }) =>
      unwrap(api.PUT('/api/v1/users/{id}', { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sellerKeys.all }),
  })
}
