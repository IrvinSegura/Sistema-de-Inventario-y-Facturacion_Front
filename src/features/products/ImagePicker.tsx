import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { type DragEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Same formats and limit as the API (it checks the file's content; this only catches mistakes early).
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const IMAGE_MAX_BYTES = 5 * 1024 * 1024

// What the product's photo will be after saving: unchanged, a new file (with a data: URL to preview it), or none.
export type ImageChoice = { kind: 'current'; url: string } | { kind: 'new'; file: File; preview: string } | { kind: 'none' }

export function ImagePicker({ value, onChange }: { value: ImageChoice; onChange: (value: ImageChoice) => void }) {
  const { t } = useTranslation()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const preview = value.kind === 'current' ? value.url : value.kind === 'new' ? value.preview : null

  const choose = (file: File | undefined) => {
    if (!file) {
      return
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      setError(t('products.form.imageInvalidType'))
    } else if (file.size > IMAGE_MAX_BYTES) {
      setError(t('products.form.imageTooLarge'))
    } else {
      // A data: URL needs no cleanup, unlike URL.createObjectURL.
      const reader = new FileReader()
      reader.onload = () => {
        setError(null)
        onChange({ kind: 'new', file, preview: reader.result as string })
      }
      reader.onerror = () => setError(t('products.form.imageInvalidType'))
      reader.readAsDataURL(file)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{t('products.form.image')}</span>
      <label htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'group relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 p-4 text-center transition-colors',
          'hover:border-primary/60 hover:bg-muted/70 has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
          dragging && 'border-primary bg-primary/5',
          preview && 'border-solid',
          error && 'border-destructive',
        )}>
        {preview ? (
          <img src={preview} alt={t('products.form.imagePreview')} className="absolute inset-0 size-full object-contain p-2" />
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
              <ImagePlus className="size-6 text-muted-foreground" />
            </span>
            <span className="text-sm font-medium">{t('products.form.imageDrop')}</span>
            <span className="text-xs text-muted-foreground">{t('products.form.imageFormats')}</span>
          </>
        )}
        <input ref={input} id={inputId} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only"
          onChange={(event) => {
            choose(event.target.files?.[0])
            // Lets the same file be picked again after removing it.
            event.target.value = ''
          }} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {preview && (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <RefreshCw />
            {t('products.form.imageChange')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setError(null)
            onChange({ kind: 'none' })
          }}>
            <Trash2 />
            {t('products.form.imageRemove')}
          </Button>
        </div>
      )}
    </div>
  )
}

