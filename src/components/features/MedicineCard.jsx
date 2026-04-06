/**
 * 薬一覧に表示する1枚のカード
 * @param {{ medicine: object, onClick: function }} props
 */

// 曜日ラベル（1=月〜7=日）
const DAY_LABELS = { 1:'月', 2:'火', 3:'水', 4:'木', 5:'金', 6:'土', 7:'日' }

/**
 * 曜日配列を表示文字列に変換する
 * @param {number[]} days
 * @returns {string}
 */
function formatDays(days) {
  if (!days || days.length === 0) return ''
  if (days.length === 7) return '毎日'
  return days.map(d => DAY_LABELS[d]).join('・')
}

/**
 * 時刻文字列（HH:MM:SS）を HH:MM に変換する
 * @param {string} time
 * @returns {string}
 */
function formatTime(time) {
  return time ? time.slice(0, 5) : ''
}

export default function MedicineCard({ medicine, onClick }) {
  const { name, dose, note, photo_url, schedules = [] } = medicine

  // is_active=true のスケジュールのみ表示
  const activeSchedules = schedules.filter(s => s.is_active)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-primary-light rounded-3xl shadow-sm
                 p-4 flex gap-3 active:bg-primary-pale transition-colors duration-150"
    >
      {/* 写真サムネイル */}
      <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-primary-pale border border-primary-light
                      overflow-hidden flex items-center justify-center">
        {photo_url ? (
          <img src={photo_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">💊</span>
        )}
      </div>

      {/* テキスト情報 */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* 薬名・用量 */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-[#2c3e50] text-base leading-tight">{name}</span>
          {dose && (
            <span className="text-sm text-[#7f9aaa]">{dose}</span>
          )}
        </div>

        {/* メモ */}
        {note && (
          <p className="text-xs text-[#7f9aaa] truncate">{note}</p>
        )}

        {/* スケジュール一覧 */}
        {activeSchedules.length > 0 ? (
          <div className="flex flex-col gap-1 mt-1">
            {activeSchedules.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                {/* 時刻バッジ */}
                <span className="text-xs font-medium text-primary bg-primary-light
                                 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {formatTime(s.time)} {s.label}
                </span>
                {/* 曜日 */}
                <span className="text-xs text-[#7f9aaa]">{formatDays(s.days)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#b0bec5] mt-1">スケジュールなし</p>
        )}
      </div>

      {/* 右矢印 */}
      <div className="flex-shrink-0 self-center text-[#b0bec5] text-lg">›</div>
    </button>
  )
}
