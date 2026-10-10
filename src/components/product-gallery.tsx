"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { cardImage } from "@/lib/image-url"
import { cn } from "@/lib/utils"

/** How much the hover pane magnifies the photo. */
const ZOOM = 2.5

interface Props {
  /** First photo is the cover. A single photo still gets the zoom and the full-screen view. */
  images: string[]
  alt: string
  /** Drawn over the top-left corner of the main photo (the discount badge). */
  badge?: ReactNode
}

/**
 * Product photos like Mercado Livre: thumbnails on the left (desktop) or a swipe strip with dots
 * (phone), a magnifier pane while the mouse is over the main photo, and a click opens the whole
 * photo full screen with arrows, counter and keyboard. The zoom only exists where there is a real
 * hover (mouse); touch screens go straight to the full-screen view.
 */
export function ProductGallery({ images, alt, badge }: Props) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const many = images.length > 1
  const current = images[index] ?? images[0]

  const step = useCallback((by: number) => setIndex((i) => (i + by + images.length) % images.length), [images.length])

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-4">
      {many && (
        <ul className="hidden max-h-[34rem] flex-col gap-2 overflow-y-auto md:flex" aria-label="Fotos do produto">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                aria-current={i === index}
                onMouseEnter={() => setIndex(i)}
                onFocus={() => setIndex(i)}
                onClick={() => setIndex(i)}
                className={cn(
                  "block h-14 w-14 cursor-pointer overflow-hidden rounded-lg border-2 bg-white transition-colors",
                  i === index ? "border-primary" : "border-border hover:border-muted-foreground",
                )}
              >
                {/* A 56px thumbnail gets the store's small copy, not the full photo (8 of them were ~5 MB). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cardImage(src)}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    if (e.currentTarget.src !== src) e.currentTarget.src = src
                  }}
                  className="h-full w-full object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="min-w-0 flex-1">
        <Strip images={images} alt={alt} badge={badge} onOpen={(i) => { setIndex(i); setOpen(true) }} />
        <Magnifier src={current} alt={alt} badge={badge} onOpen={() => setOpen(true)} />
      </div>

      <Lightbox
        images={images}
        alt={alt}
        index={index}
        open={open}
        onOpenChange={setOpen}
        onStep={step}
      />
    </div>
  )
}

/** Phone: photos side by side, swipe to change, dots below. Hidden on desktop. */
function Strip({ images, alt, badge, onOpen }: { images: string[]; alt: string; badge?: ReactNode; onOpen: (i: number) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)

  return (
    <div className="md:hidden">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-white">
        <div
          ref={track}
          onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Ampliar foto ${i + 1} de ${images.length}`}
              className="aspect-square w-full shrink-0 snap-center cursor-zoom-in"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={i === 0 ? alt : ""}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
        {badge && <div className="pointer-events-none absolute left-3 top-3">{badge}</div>}
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {images.map((src, i) => (
            <span key={src} className={cn("h-1.5 rounded-full transition-all", i === at ? "w-4 bg-primary" : "w-1.5 bg-border")} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Desktop: the main photo, a square lens that follows the mouse, and a pane at the right with the
 * lens area magnified. The photo is shown whole (contain), so the pointer is mapped onto the
 * photo's real rectangle, not onto the square around it.
 */
function Magnifier({ src, alt, badge, onOpen }: { src: string; alt: string; badge?: ReactNode; onOpen: () => void }) {
  const box = useRef<HTMLButtonElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  const pane = useRef<HTMLDivElement>(null)

  const move = (event: React.PointerEvent) => {
    const frame = box.current
    const photo = img.current
    if (!frame || !photo || event.pointerType !== "mouse") return
    const rect = frame.getBoundingClientRect()
    const size = rect.width
    const ratio = photo.naturalWidth && photo.naturalHeight ? photo.naturalWidth / photo.naturalHeight : 1
    // The photo as drawn inside the square (object-contain).
    const w = ratio >= 1 ? size : size * ratio
    const h = ratio >= 1 ? size / ratio : size
    const ox = (size - w) / 2
    const oy = (size - h) / 2
    const side = size / ZOOM // lens side
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))
    const left = clamp(event.clientX - rect.left - side / 2, ox, ox + w - side)
    const top = clamp(event.clientY - rect.top - side / 2, oy, oy + h - side)

    if (lens.current) {
      lens.current.style.width = lens.current.style.height = `${side}px`
      lens.current.style.transform = `translate(${left}px, ${top}px)`
    }
    if (pane.current) {
      pane.current.style.backgroundSize = `${w * ZOOM}px ${h * ZOOM}px`
      pane.current.style.backgroundPosition = `${-(left - ox) * ZOOM}px ${-(top - oy) * ZOOM}px`
    }
  }

  return (
    <div className="group/zoom relative hidden md:block">
      <button
        ref={box}
        type="button"
        onClick={onOpen}
        onPointerMove={move}
        onPointerEnter={move}
        aria-label="Ampliar foto"
        className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={img}
          src={src}
          alt={alt}
          fetchPriority="high"
          draggable={false}
          className="h-full w-full object-contain"
        />
        <span
          ref={lens}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 hidden border border-primary/60 bg-primary/10 group-hover/zoom:block"
        />
        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          Clique para ampliar
        </span>
        {badge && <span className="pointer-events-none absolute left-3 top-3">{badge}</span>}
      </button>
      {/* Opens over the right column, like the marketplace does; only while the mouse is on the photo. */}
      <div
        ref={pane}
        aria-hidden
        style={{ backgroundImage: `url("${src}")`, backgroundRepeat: "no-repeat" }}
        className="pointer-events-none absolute left-[calc(100%+1.25rem)] top-0 z-30 hidden aspect-square w-full rounded-2xl border border-border bg-white shadow-2xl group-hover/zoom:block"
      />
    </div>
  )
}

/** The whole photo over the page: arrows, counter, swipe, Esc and ← → on the keyboard. */
function Lightbox({
  images,
  alt,
  index,
  open,
  onOpenChange,
  onStep,
}: {
  images: string[]
  alt: string
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onStep: (by: number) => void
}) {
  const touchX = useRef<number | null>(null)
  const many = images.length > 1

  // Warm the neighbours so the arrows feel instant.
  useEffect(() => {
    if (!open || !many) return
    for (const i of [index + 1, index - 1]) {
      const src = images[(i + images.length) % images.length]
      new Image().src = src
    }
  }, [open, many, index, images])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/90 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (!many) return
            if (e.key === "ArrowLeft") onStep(-1)
            if (e.key === "ArrowRight") onStep(1)
          }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null || !many) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (Math.abs(dx) > 50) onStep(dx < 0 ? 1 : -1)
          }}
          className="fixed inset-0 z-[101] flex items-center justify-center outline-none"
        >
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>

          {/* A white square as big as the screen allows, like the marketplace; the photo fits inside it. */}
          <div className="aspect-square w-[min(94vw,92dvh)] overflow-hidden rounded-lg bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[index]}
              alt={`${alt} — foto ${index + 1} de ${images.length}`}
              draggable={false}
              className="h-full w-full select-none object-contain"
            />
          </div>

          {many && (
            <>
              <p className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white" aria-live="polite">
                {index + 1} / {images.length}
              </p>
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={() => onStep(-1)}
                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Próxima foto"
                onClick={() => onStep(1)}
                className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            </>
          )}

          <Dialog.Close
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <X className="h-6 w-6" aria-hidden />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
