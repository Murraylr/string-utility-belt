import { registry } from './registry'

type Group = { label: string; options: Array<{ label: string; value: string }> }

/** `<Select>` options for every utility, grouped by category and sorted by name. */
export function utilityOptionGroups(): Group[] {
  return registry.categories().map(cat => ({
    label: cat,
    options: registry.byCategory(cat)
      .map(m => ({ label: m.name, value: m.id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  }))
}
