import React, { useEffect } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'
import { useT } from '@/app/i18n/useT'
import { useTheme, TOGGLE_THEME_EVENT, type ThemeMode } from './useTheme'

const ICON: Record<ThemeMode, typeof Monitor> = { system: Monitor, light: Sun, dark: Moon }
const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

/**
 * Icon button that cycles `system` → `light` → `dark` → `system`. Its
 * aria-label (and title, for a mouse tooltip) states both the current and the
 * next mode so the control is understandable without seeing the icon change.
 * Also cycles in response to a global `sub:toggle-theme` window event, so a
 * keyboard shortcut or menu item owned elsewhere can trigger it without a ref.
 */
export default function ThemeToggle() {
  const { theme, cycle } = useTheme()
  const { t } = useT()
  const Icon = ICON[theme]
  const label = t('theme.toggleAria', { current: t(`theme.${theme}`), next: t(`theme.${NEXT[theme]}`) })

  useEffect(() => {
    window.addEventListener(TOGGLE_THEME_EVENT, cycle)
    return () => window.removeEventListener(TOGGLE_THEME_EVENT, cycle)
  }, [cycle])

  return (
    <button type="button" onClick={cycle} className="icon-btn" aria-label={label} title={label}>
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}
