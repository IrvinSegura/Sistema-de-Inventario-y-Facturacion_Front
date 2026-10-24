import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { type SortState, sortParam } from '@/lib/sort'

export type UserAccount = Schemas['UserResponse']
export type CreateUserAccount = Schemas['CreateUserRequest']
export type UpdateUserAccount = Schemas['UpdateUserRequest']
export type AccountEvent = Schemas['AccountEventResponse']

export const PAGE_SIZE = 20

// Under 'users', so creating, editing or resetting an account refreshes them all.
export const userKeys = {
  all: ['users'] as const,
  page: (page: number, size: number, sort: SortState | null) => ['users', 'page', page, size, sort] as const,
  sellers: ['users', 'sellers'] as const,
  events: (id: number, page: number) => ['users', 'events', id, page] as const,
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

/**
 * Sets a temporary password the user must change at their next login; their sessions end. Not for the
 * admin's own account (400).
 */
export function useResetUserPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, temporaryPassword }: { id: number; temporaryPassword: string }) =>
      unwrap(api.PUT('/api/v1/users/{id}/password', { params: { path: { id } }, body: { temporaryPassword } })),
    // The list shows who still has to change it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

/** Every seller account by name, inactive ones too, for seller filters; admins and supervisors. */
export function useSellers(enabled: boolean) {
  return useQuery({
    queryKey: userKeys.sellers,
    enabled,
    queryFn: () => unwrap(api.GET('/api/v1/sellers')),
  })
}

/** An account's history (who changed what, newest first); ADMIN only, idle while id is null. */
export function useAccountEvents(id: number | null, page: number, size = PAGE_SIZE) {
  return useQuery({
    queryKey: userKeys.events(id ?? 0, page),
    enabled: id !== null,
    queryFn: () => unwrap(api.GET('/api/v1/users/{id}/events', {
      params: { path: { id: id! }, query: { page, size } },
    })),
    placeholderData: keepPreviousData,
  })
}
