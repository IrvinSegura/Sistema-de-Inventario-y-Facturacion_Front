import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import { type SortState, sortParam } from '@/lib/sort'

export type Customer = Schemas['CustomerResponse']
export type CreateCustomer = Schemas['CreateCustomerRequest']
export type UpdateCustomer = Schemas['UpdateCustomerRequest']

export const PAGE_SIZE = 20

export interface CustomerFilters {
  search: string
  active: boolean
}

export const customerKeys = {
  all: ['customers'] as const,
  page: (filters: CustomerFilters, page: number, size: number, sort: SortState | null) =>
    ['customers', 'page', filters, page, size, sort] as const,
}

// Sorted by name on the server; the search matches the name or the tax ID, blank means "all".
export function useCustomers(filters: CustomerFilters, page: number, size = PAGE_SIZE, sort: SortState | null = null) {
  return useQuery({
    queryKey: customerKeys.page(filters, page, size, sort),
    queryFn: () => unwrap(api.GET('/api/v1/customers', {
      params: { query: { search: filters.search || undefined, active: filters.active, page, size, sort: sortParam(sort) } },
    })),
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCustomer) => unwrap(api.POST('/api/v1/customers', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateCustomer & { id: number }) =>
      unwrap(api.PUT('/api/v1/customers/{id}', { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
    // Someone else saved first: reload the list so reopening the customer shows their version.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: customerKeys.all })
      }
    },
  })
}

// Only customers without sales can be deleted; others answer 409 (deactivate them).
export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE('/api/v1/customers/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
