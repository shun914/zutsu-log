import { useRef, useState } from 'react'
import { formatTime } from '../../utils/dateUtils'

/**
 * ホーム画面の服薬カード
 *
 * @param {{
 *   item: { schedule: object, medicine: object, log: object|null, scheduledAt: string },
 *   onTaken: function,
 *   onSkip: function,
 * }} props
 */
export default function MedicationCard({ item, onTaken, onSkip }) {
  const { schedule, medicine, log, scheduledAt } = item

  // 長押し用タイマー
  const longPressTimer = useRef(null)
  // スキップ確認インジケーター
  const [confirmSkip, setConfirmSkip] = useState(false)

  // ステータスに応じたスタイル
  const isDone    = log?.status === 'taken' || log?.status === 'taken_late'
  const isSkipped = log?.status === 'skipped'
  const isMissed  = log?.status === 'missed'

  // 長押し開始
  const handlePressStart = () => {
    if (isDone || isSkipped) return
    longPressTimer.current = setTimeout(() => {
      setConfirmSkip(true)
    }, 600)
  }

  // 長押しキャンセル（指を離した/動かした）
  const handlePressEnd = () => {
    clearTimeout(longPressTimer.current)
  }

  // スキップ確定
  const handleConfirmSkip = (e) => {
    e.stopPropagation()
    setConfirmSkip(false)
    onSkip()
  }

  // スキップキャンセル
  const handleCancelSkip = (e) => {
    e.stopPropagation()
    setConfirmSkip(false)
  }

  return (
    <div
      className={`relative bg-white border rounded-3xl shadow-sm p-4
                  transition-colors duration-300 select-none
                  ${isDone || isSkipped
                    ? 'border-[#e2e8f0] opacity-60'
                    : isMissed
                    ? 'border-[#fca5a5] bg-[#fdeaea]'
                    : 'border-primary-light'
                  }`}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
    >
      {/* スキップ確認オーバーレイ */}
      {confirmSkip && (
        <div className="absolute inset-0 bg-white/95 rounded-3xl flex flex-col items-center justify-center gap-3 z-10">
          <p className="text-sm text-[#2c3e50] font-medium">スキップしますか？</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirmSkip}
              className="px-5 h-10 rounded-2xl bg-[#b0bec5] text-white text-sm font-medium"
            >
              スキップ
            </button>
            <button
              type="button"
              onClick={handleCancelSkip}
              className="px-5 h-10 rounded-2xl bg-primary text-white text-sm font-medium"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* 時刻・ラベル */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center
                        w-14 h-14 rounded-2xl bg-primary-pale border border-primary-light">
          <span className="text-xs text-[#7f9aaa]">{formatTime(schedule.time)}</span>
          <span className="text-xs font-bold text-primary mt-0.5">{schedule.label}</span>
        </div>

        {/* 薬情報 */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#2c3e50] text-base leading-tight truncate">
            {medicine.name}
          </p>
          {medicine.dose && (
            <p className="text-sm text-[#7f9aaa] mt-0.5">{medicine.dose}</p>
          )}
          {/* ステータスバッジ */}
          {log && (
            <StatusBadge status={log.status} />
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex-shrink-0">
          {!log && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTaken() }}
              className="h-11 px-4 rounded-2xl bg-primary text-white text-sm font-bold
                         active:bg-primary-dark transition-colors duration-150 whitespace-nowrap"
            >
              飲んだ ✓
            </button>
          )}
          {isMissed && (
            // missed でも遅れて服用できる
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTaken() }}
              className="h-11 px-3 rounded-2xl bg-[#f0b942] text-white text-xs font-bold
                         active:opacity-80 transition-colors duration-150 whitespace-nowrap"
            >
              遅れて<br />飲む
            </button>
          )}
          {isDone && (
            <span className="text-2xl">✅</span>
          )}
          {isSkipped && (
            <span className="text-2xl">⏭</span>
          )}
        </div>
      </div>

      {/* 長押しのヒント（未記録またはmissedかつ確認前） */}
      {(!log || isMissed) && (
        <p className="text-[10px] text-[#b0bec5] text-right mt-2 pr-1">
          長押しでスキップ
        </p>
      )}
    </div>
  )
}

// ---- ステータスバッジ ----------------------------------------

function StatusBadge({ status }) {
  const MAP = {
    taken:      { label: '服用済み',   bg: 'bg-[#e6f5eb]', text: 'text-[#22c55e]' },
    taken_late: { label: '遅れて服用', bg: 'bg-[#fdf6e3]', text: 'text-[#f59e0b]' },
    skipped:    { label: 'スキップ',   bg: 'bg-[#f1f5f9]', text: 'text-[#9ca3af]' },
    missed:     { label: '飲み忘れ',   bg: 'bg-[#fdeaea]', text: 'text-[#ef4444]' },
  }
  const s = MAP[status]
  if (!s) return null
  return (
    <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}
