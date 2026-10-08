/** The actions menu of a branch, macro or "run on each" card, dispatched on the store. */
import type { PipelineStep } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import type { StepMenuProps } from './StepMenu'

export interface ContainerMoves {
  /** StepList passes these so a move is announced; without them the card dispatches directly. */
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function useContainerMenu(step: PipelineStep, { onMoveUp, onMoveDown }: ContainerMoves, { rename = true } = {}):
  Omit<StepMenuProps, 'index' | 'total' | 'onDelete'> {
  const { dispatch } = useTool()
  return {
    label: step.label,
    onDuplicate: () => dispatch({ type: 'DUPLICATE_STEP', id: step.id }),
    onSolo: () => dispatch({ type: 'SOLO_STEP', id: step.id }),
    onRename: rename
      ? (label: string) => dispatch({ type: 'UPDATE_STEP', id: step.id, patch: { label: label.trim() || undefined } })
      : undefined,
    onMoveUp: onMoveUp ?? (() => dispatch({ type: 'MOVE_STEP', id: step.id, direction: 'up' })),
    onMoveDown: onMoveDown ?? (() => dispatch({ type: 'MOVE_STEP', id: step.id, direction: 'down' })),
  }
}

/** The title row of a container card: its icon and name. */
export const CONTAINER_TITLE = 'inline-flex items-center gap-[7px] min-w-0 font-semibold'
