"use client"

import { motion } from "framer-motion"
import Link from "next/link"

import { ProductCard } from "@/components/product-card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import type { Product } from "@/lib/types"

export function DealsCarousel({
  products,
  title = "Ofertas recém-encontradas",
  href,
  tone = "navy",
}: {
  products: Product[]
  title?: string
  /** Optional "see all" link shown beside the title. */
  href?: string
  /** "navy" is the dark highlight band; "light" sits on the page background. */
  tone?: "navy" | "light"
}) {
  const navy = tone === "navy"
  return (
    <section className={navy ? "bg-band py-12" : "section-y"}>
      <div className="page-container">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className={`text-2xl font-bold sm:text-3xl ${navy ? "text-band-foreground" : "text-foreground"}`}>
            {title}
          </h2>
          {href && (
            <Link href={href} className={`shrink-0 text-sm font-semibold hover:underline ${navy ? "text-band-foreground" : "text-foreground"}`}>
              Ver todas
            </Link>
          )}
        </div>

        <Carousel
          opts={{ align: "start", loop: products.length > 7 }}
          className="w-full"
          aria-label={title ?? "Ofertas"}
        >
          <CarouselContent>
            {products.map((product, index) => (
              <CarouselItem
                key={product.id}
                className="basis-[60%] min-[375px]:basis-[50%] min-[480px]:basis-[40%] md:basis-[28.57%] lg:basis-[22.22%] xl:basis-[18.18%] 2xl:basis-[15.38%]"
              >
                <motion.div
                  initial={index < 2 ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.06,
                    ease: "easeOut",
                  }}
                  className="h-full"
                >
                  <ProductCard product={product} className={navy ? "bg-background" : undefined} compact />
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-2 active:scale-90 sm:-left-4" />
          <CarouselNext className="-right-2 active:scale-90 sm:-right-4" />
        </Carousel>
      </div>
    </section>
  )
}
