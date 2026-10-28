import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { DocumentVault } from './DocumentVault'
import { ExpenseTracker } from './ExpenseTracker'
import { PackingList } from './PackingList'
import { SettingsPanel } from './SettingsPanel'

type Section = 'docs' | 'expenses' | 'packing' | 'settings'

export function VaultModule() {
  const [section, setSection] = useState<Section>('docs')
  return (
    <div className="space-y-4">
      <Segmented
        stretch
        value={section}
        onChange={setSection}
        options={[
          { value: 'docs', label: 'Docs' },
          { value: 'expenses', label: 'Expenses' },
          { value: 'packing', label: 'Packing' },
          { value: 'settings', label: 'Settings' },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          {section === 'docs' && <DocumentVault />}
          {section === 'expenses' && <ExpenseTracker />}
          {section === 'packing' && <PackingList />}
          {section === 'settings' && <SettingsPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
