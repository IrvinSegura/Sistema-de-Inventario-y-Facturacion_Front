import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Textarea } from '@/components/Textarea'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { REASON_MAX_LENGTH } from '@/lib/text-rules'

/** The part of a cancel mutation (TanStack Query) the dialog drives. */
export interface CancelMutation {
  mutate: (variables: { id: number; reason: string }, options: { onSuccess: () => void }) => void
  reset: () => void
  isPending: boolean
  error: Error | null
}

export interface CancelReasonTexts {
  title: string
  description: string
  reason: string
  reasonRequired: string
  keep: string
  confirm: string
  cancelling: string
}

/**
 * Asks why a document is cancelled and cancels it; open while `id` is set. `onCancelled` runs once it
 * succeeded and the dialog closed.
 */
export function CancelReasonDialog({ id, mutation, texts, errorText = errorMessage, onOpenChange, onCancelled }: {
  id: number | null
  mutation: CancelMutation
  texts: CancelReasonTexts
  /** The message for a failed request; the API's own by default. */
  errorText?: (error: Error) => string
  onOpenChange: (open: boolean) => void
  onCancelled: () => void
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const schema = useMemo(() => z.object({
    reason: z.string().trim()
      .min(1, texts.reasonRequired)
      .max(REASON_MAX_LENGTH, t('validation.maxChars', { count: REASON_MAX_LENGTH })),
  }), [t, texts.reasonRequired])
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })

  // The form and mutation outlive each document, so clear the reason and the last error for the next one.
  function finish() {
    reset()
    mutation.reset()
    onOpenChange(false)
  }

  // Blocked while the request runs: the cancellation would still happen, without its confirmation.
  function close() {
    if (!mutation.isPending) {
      finish()
    }
  }

  const onSubmit = handleSubmit(({ reason }) =>
    mutation.mutate({ id: id!, reason }, {
      onSuccess: () => {
        finish()
        onCancelled()
      },
    }))

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        {id !== null && (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{texts.title}</DialogTitle>
              <DialogDescription>{texts.description}</DialogDescription>
            </DialogHeader>
            {mutation.error && <ErrorAlert message={errorText(mutation.error)} />}
            <div className="grid gap-2">
              <Label htmlFor={fieldId}>{texts.reason}</Label>
              <Textarea id={fieldId} rows={3} maxLength={REASON_MAX_LENGTH} autoFocus
                aria-invalid={!!errors.reason} {...register('reason')} />
              {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={mutation.isPending} />}>{texts.keep}</DialogClose>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending ? texts.cancelling : texts.confirm}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
