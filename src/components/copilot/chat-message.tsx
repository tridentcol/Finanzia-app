import type { AnswerBlock, AnswerPayload } from '@/lib/copilot/render/answer-ast'
import type { Turn } from './turn'
import { AmountBlock } from './blocks/amount-block'
import { BreakdownBlock } from './blocks/breakdown-block'
import { BarsBlock } from './blocks/bars-block'
import { ListBlock } from './blocks/list-block'
import { GaugeBlock } from './blocks/gauge-block'
import { MiniChartBlock } from './blocks/mini-chart-block'
import { EventListBlock } from './blocks/event-list-block'
import { AdviceBlock } from './blocks/advice-block'
import { CopilotStatus } from './copilot-status'
import { FollowUpChips } from './follow-up-chips'
import { AnswerActions } from './answer-actions'

function BlockView({ block }: { block: AnswerBlock }) {
  switch (block.type) {
    case 'amount':
      return (
        <AmountBlock
          label={block.label}
          value={block.value}
          tone={block.tone}
          delta={block.delta}
          note={block.note}
        />
      )
    case 'breakdown':
      return <BreakdownBlock title={block.title} rows={block.rows} total={block.total} />
    case 'bars':
      return <BarsBlock title={block.title} max={block.max} rows={block.rows} />
    case 'list':
      return <ListBlock title={block.title} items={block.items} />
    case 'gauge':
      return (
        <GaugeBlock
          label={block.label}
          spent={block.spent}
          limit={block.limit}
          percent={block.percent}
          status={block.status}
        />
      )
    case 'mini-chart':
      return <MiniChartBlock points={block.points} annotation={block.annotation} />
    case 'event-list':
      return <EventListBlock items={block.items} />
    case 'advice':
      return <AdviceBlock tone={block.tone} title={block.title} body={block.body} />
    case 'text':
      return <p className="text-text-secondary text-[14px] leading-relaxed">{block.body}</p>
    default:
      return null
  }
}

function AssistantMessage({
  payload,
  onFollowUp,
  onConfirm,
}: {
  payload: AnswerPayload
  onFollowUp: (utterance: string) => void
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {payload.intro && (
        <p className="text-text text-[14px] leading-relaxed">{payload.intro}</p>
      )}
      {payload.blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
      {payload.actions && payload.actions.length > 0 && (
        <AnswerActions actions={payload.actions} onConfirm={onConfirm} onFollowUp={onFollowUp} />
      )}
      {payload.followUps && payload.followUps.length > 0 && (
        <FollowUpChips chips={payload.followUps} onPick={onFollowUp} />
      )}
    </div>
  )
}

export function ChatMessage({
  turn,
  onFollowUp,
  onConfirm,
}: {
  turn: Turn
  onFollowUp: (utterance: string) => void
  onConfirm: () => void
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-surface-elevated text-text max-w-[80%] rounded-[12px] px-3.5 py-2 text-[14px] leading-relaxed">
          {turn.text}
        </div>
      </div>
    )
  }

  if ('pending' in turn) {
    return (
      <div className="flex justify-start">
        <CopilotStatus label={turn.phase} idle={turn.idle} />
      </div>
    )
  }

  return (
    <AssistantMessage payload={turn.payload} onFollowUp={onFollowUp} onConfirm={onConfirm} />
  )
}
