export const CITIZEN_STORAGE_KEY = 'kolonie-workplace-citizen'

export interface CitizenStorage {
  read(): string | null
  write(id: string): void
  clear(): void
}

function sessionStore(): Storage | null {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

export function createSessionCitizenStorage(): CitizenStorage {
  return {
    read(): string | null {
      const value = sessionStore()?.getItem(CITIZEN_STORAGE_KEY)
      if (value === null || value === undefined) {
        return null
      }

      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    write(id: string): void {
      sessionStore()?.setItem(CITIZEN_STORAGE_KEY, id)
    },
    clear(): void {
      sessionStore()?.removeItem(CITIZEN_STORAGE_KEY)
    },
  }
}
