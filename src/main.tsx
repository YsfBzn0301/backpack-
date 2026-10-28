import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { createStore, del, get, set } from 'idb-keyval'
import { MotionConfig } from 'framer-motion'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 24 * 3600_000, refetchOnWindowFocus: false, networkMode: 'offlineFirst' },
  },
})

// Persist the query cache (weather, places) to IndexedDB for offline starts.
const idb = createStore('backpack-query', 'cache')
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get<string>(k, idb).then((v) => v ?? null),
    setItem: (k, v) => set(k, v, idb),
    removeItem: (k) => del(k, idb),
  },
  throttleTime: 2000,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 3 * 24 * 3600_000, buster: 'v1' }}>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </PersistQueryClientProvider>
  </StrictMode>,
)
