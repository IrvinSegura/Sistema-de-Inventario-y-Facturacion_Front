import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { type SortState, sortParam } from '@/lib/sort'

export type UserAccount = Schemas['UserResponse']
export type CreateUserAccount = Schemas['CreateUserRequest']
export type UpdateUserAccount = Schemas['UpdateUserRequest']

export const PAGE_SIZE = 20

// The API pages at most 100 items: enough for a store's accounts.
const MAX_PAGE_SIZE = 100

export const userKeys = {
  all: ['users'] as const,
  page: (page: number, size: number, sort: SortState | null) => ['users', 'page', page, size, sort] as const,
  list: ['users', 'list'] as const,
}

/**
 * Every account (sellers, supervisors and admins) comes from the users API (ADMIN only), sorted by name
 * on the server unless sort says otherwise.
 */
export function useUserAccounts(page: number, size = PAGE_SIZE, sort: SortState | null = null) {
  return useQuery({
    queryKey: userKeys.page(page, size, sort),
    queryFn: () => unwrap(api.GET('/api/v1/users', { params: { query: { page, size, sort: sortParam(sort) } } })),
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export function useCreateUserAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserAccount) => unwrap(api.POST('/api/v1/users', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useUpdateUserAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserAccount & { id: number }) =>
      unwrap(api.PUT('/api/v1/users/{id}', { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

/** Every account on one page, for seller filters elsewhere (e.g. the cash drawer history); ADMIN only. */
export function useAllUserAccounts(enabled: boolean) {
  return useQuery({
    queryKey: userKeys.list,
    enabled,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/users', { params: { query: { size: MAX_PAGE_SIZE } } }))
      return page.content ?? []
    },
  })
}
