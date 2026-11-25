'use client'

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface FaqItem {
  id: string
  question: string
  answer: string
}

interface HelpFaqAccordionProps {
  items: FaqItem[]
}

export function HelpFaqAccordion({ items }: HelpFaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null)

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] overflow-hidden divide-y divide-gray-100">
      {items.map((item) => {
        const isOpen = openId === item.id
        const panelId = `faq-panel-${item.id}`
        const buttonId = `faq-button-${item.id}`

        return (
          <div key={item.id} className="transition-colors">
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleItem(item.id)}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8F9FF] active:bg-[#EFF4FF] transition-colors cursor-pointer"
            >
              <span className="text-xs sm:text-sm font-bold text-[#0B1C30] leading-snug">
                {item.question}
              </span>
              <ChevronDown
                className={`w-4.5 h-4.5 text-[#FF6B00] shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="px-4 pb-4 pt-0.5 text-xs text-gray-600 leading-relaxed"
              >
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
