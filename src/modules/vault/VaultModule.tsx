import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Segmented } from '@/components/ui/Segmented'
import { DocumentVault } from './DocumentVault'
import { ExpenseTracker } from './ExpenseTracker'

type Section = 'docs' | 'expenses'

export function VaultModule() {
  const { t } = useTranslation()
  const [section, setSection] = useState<Section>('docs')
  return (
    <div className="space-y-4">
      <Segmented
        stretch
        value={section}
        onChange={setSection}
        options={[
          { value: 'docs', label: t('vault.docs') },
          { value: 'expenses', label: t('vault.expenses') },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          {section === 'docs' ? <DocumentVault /> : <ExpenseTracker />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
