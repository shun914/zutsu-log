/**
 * 服薬スケジュールの1件分を編集するコンポーネント
 * @param {{ schedule: object, onChange: function, onRemove: function }} props
 */

// 曜日ラベル（1=月〜7=日）
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

// タイミングのプリセット
const LABEL_PRESETS = ['朝', '昼', '夕', '就寝前']

export default function ScheduleEditor({ schedule, onChange, onRemove, showRemove }) {
  // 曜日トグル
  const toggleDay = (day) => {
    const current = schedule.days
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort()
    onChange({ ...schedule, days: next })
  }

  // 全曜日チェック済みか
  const isAllDays = schedule.days.length === 7

  // 全選択 / 全解除
  const toggleAllDays = () => {
    onChange({ ...schedule, days: isAllDays ? [] : [1,2,3,4,5,6,7] })
  }

  return (
    <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-3">
      {/* タイミング名 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm text-[#7f9aaa] font-medium">タイミング名</label>
        {/* プリセットボタン */}
        <div className="flex gap-2 flex-wrap mb-1">
          {LABEL_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ ...schedule, label: preset })}
              className={`px-3 py-1 rounded-2xl text-sm border transition-colors duration-150
                ${schedule.label === preset
                  ? 'bg-primary text-white border-primary'
                  : 'bg-primary-pale text-primary border-primary-light'
                }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={schedule.label}
          onChange={e => onChange({ ...schedule, label: e.target.value })}
          placeholder="カスタム入力"
          className="w-full rounded-2xl border border-primary-light px-3 py-2 text-base
                     focus:outline-none focus:ring-2 focus:ring-primary-light
                     text-[#2c3e50] placeholder:text-[#b0bec5]"
        />
      </div>

      {/* 服用時刻 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm text-[#7f9aaa] font-medium">服用時刻</label>
        <input
          type="time"
          value={schedule.time}
          onChange={e => onChange({ ...schedule, time: e.target.value })}
          className="w-full rounded-2xl border border-primary-light px-3 py-2 text-base
                     focus:outline-none focus:ring-2 focus:ring-primary-light
                     text-[#2c3e50]"
        />
      </div>

      {/* 曜日選択 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-[#7f9aaa] font-medium">曜日</label>
          <button
            type="button"
            onClick={toggleAllDays}
            className="text-xs text-primary underline"
          >
            {isAllDays ? '全解除' : '毎日'}
          </button>
        </div>
        <div className="flex gap-1 justify-between">
          {DAY_LABELS.map((label, i) => {
            const day = i + 1
            const selected = schedule.days.includes(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`flex-1 h-9 rounded-2xl text-sm font-medium border transition-colors duration-150
                  ${selected
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-pale text-[#7f9aaa] border-primary-light'
                  }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 削除ボタン */}
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="self-end text-sm text-pastel-red underline mt-1"
        >
          このスケジュールを削除
        </button>
      )}
    </div>
  )
}
