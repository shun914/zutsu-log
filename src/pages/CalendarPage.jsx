import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/ui/BottomNav'

// ---- 定数 -------------------------------------------------------

// 曜日ヘッダー（日曜始まり）
const WEEK_HEADERS = ['日', '月', '火', '水', '木', '金', '土']

// 頭痛強度の定義
const SEVERITY_MAP = {
  0: { label: 'なし',   emoji: '😊', color: 'text-[#22c55e]' },
  1: { label: '中程度', emoji: '😐', color: 'text-[#f59e0b]' },
  2: { label: '強い',   emoji: '😣', color: 'text-[#ef4444]' },
}

// 服薬ステータスの定義
const STATUS_MAP = {
  taken:      { label: '服用済み',   dot: 'bg-[#22c55e]', text: 'text-[#22c55e]', bg: 'bg-[#e6f5eb]' },
  taken_late: { label: '遅れて服用', dot: 'bg-[#f59e0b]', text: 'text-[#f59e0b]', bg: 'bg-[#fdf6e3]' },
  skipped:    { label: 'スキップ',   dot: 'bg-[#9ca3af]', text: 'text-[#9ca3af]', bg: 'bg-[#f1f5f9]' },
  missed:     { label: '飲み忘れ',   dot: 'bg-[#ef4444]', text: 'text-[#ef4444]', bg: 'bg-[#fdeaea]' },
}

// ---- ユーティリティ ---------------------------------------------

/**
 * 達成率（0〜1）から色クラスを返す
 * @param {number} rate
 * @returns {{ dot: string, ring: string } | null}
 */
function rateToColor(rate) {
  if (rate === null) return null
  if (rate >= 1.0) return { dot: 'bg-pastel-green',  ring: 'ring-pastel-green' }
  if (rate >= 0.5) return { dot: 'bg-pastel-yellow', ring: 'ring-pastel-yellow' }
  return              { dot: 'bg-pastel-red',    ring: 'ring-pastel-red' }
}

/**
 * 月のカレンダーグリッド用セル配列を生成する（日曜始まり）
 * @param {dayjs.Dayjs} month
 * @returns {Array<{ date: dayjs.Dayjs | null }>}
 */
function buildCalendarCells(month) {
  const firstDay  = month.startOf('month')
  const daysInMonth = month.daysInMonth()
  const startWeekday = firstDay.day() // 0=日〜6=土

  const cells = []
  // 月初前の空白セル
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  // 日付セル
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(firstDay.date(d))
  }
  // 末尾を7の倍数に揃える
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// ---- スケルトンUI -----------------------------------------------

function SkeletonCalendar() {
  return (
    <div className="bg-white border border-primary-light rounded-3xl p-4 animate-pulse">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-primary-light" />
        ))}
      </div>
    </div>
  )
}

// ================================================================
// メインコンポーネント
// ================================================================

export default function CalendarPage() {
  // 表示中の月（dayjsオブジェクト）
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'))

  // { 'YYYY-MM-DD': rate(0〜1) } 達成率マップ
  const [rateMap, setRateMap]         = useState({})
  // { 'YYYY-MM-DD': headache_log } 頭痛ログマップ
  const [headacheMap, setHeadacheMap] = useState({})

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // 選択中の日付（モーダル用）
  const [selectedDate, setSelectedDate] = useState(null)
  // 選択日の服薬ログ詳細
  const [dayLogs, setDayLogs]     = useState([])
  const [dayLogLoading, setDayLogLoading] = useState(false)

  // ----- 月データ取得 ------------------------------------------

  const fetchMonthData = useCallback(async (month) => {
    setLoading(true)
    setError(null)
    try {
      const monthStart = month.startOf('month').toISOString()
      const monthEnd   = month.endOf('month').toISOString()

      // 服薬ログを取得
      const { data: logs, error: logsErr } = await supabase
        .from('medication_logs')
        .select('scheduled_at, status')
        .gte('scheduled_at', monthStart)
        .lte('scheduled_at', monthEnd)

      if (logsErr) throw logsErr

      // 頭痛ログを取得
      const { data: headacheLogs, error: headacheErr } = await supabase
        .from('headache_logs')
        .select('date, severity, memo')
        .gte('date', month.format('YYYY-MM-01'))
        .lte('date', month.endOf('month').format('YYYY-MM-DD'))

      if (headacheErr) throw headacheErr

      // 日付ごとの達成率を計算する
      const dayTotals = {}  // { 'YYYY-MM-DD': { total, done } }
      ;(logs || []).forEach(log => {
        const dateKey = dayjs(log.scheduled_at).format('YYYY-MM-DD')
        if (!dayTotals[dateKey]) dayTotals[dateKey] = { total: 0, done: 0 }
        dayTotals[dateKey].total++
        if (log.status === 'taken' || log.status === 'taken_late') {
          dayTotals[dateKey].done++
        }
      })

      const newRateMap = {}
      Object.entries(dayTotals).forEach(([date, { total, done }]) => {
        newRateMap[date] = total > 0 ? done / total : null
      })
      setRateMap(newRateMap)

      // 頭痛ログをマップ化する
      const newHeadacheMap = {}
      ;(headacheLogs || []).forEach(h => {
        newHeadacheMap[h.date] = h
      })
      setHeadacheMap(newHeadacheMap)

    } catch (err) {
      console.error('カレンダーデータ取得エラー:', err)
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMonthData(currentMonth)
  }, [currentMonth, fetchMonthData])

  // ----- 月移動 ------------------------------------------------

  const goPrevMonth = () => setCurrentMonth(m => m.subtract(1, 'month'))
  const goNextMonth = () => setCurrentMonth(m => m.add(1, 'month'))

  // 未来月には進めない
  const isNextDisabled = currentMonth.isSame(dayjs().startOf('month'), 'month')

  // ----- 日付タップ → モーダル ---------------------------------

  const handleDayTap = async (date) => {
    setSelectedDate(date)
    setDayLogLoading(true)
    setDayLogs([])

    try {
      const dayStart = date.startOf('day').toISOString()
      const dayEnd   = date.endOf('day').toISOString()

      const { data, error } = await supabase
        .from('medication_logs')
        .select('*, medicines(name, dose), schedules(label, time)')
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd)
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      setDayLogs(data || [])
    } catch (err) {
      console.error('日別ログ取得エラー:', err)
    } finally {
      setDayLogLoading(false)
    }
  }

  const closeModal = () => setSelectedDate(null)

  // ----- カレンダーグリッド ------------------------------------

  const cells = buildCalendarCells(currentMonth)
  const today = dayjs().format('YYYY-MM-DD')

  // =============================================================

  return (
    <div className="min-h-screen bg-primary-pale pb-24">

      {/* ヘッダー */}
      <div className="bg-white border-b border-primary-light sticky top-0 z-10">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#2c3e50]">カレンダー</h1>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-4">

        {/* エラー */}
        {error && (
          <div className="bg-[#fdeaea] border border-[#e07070] text-[#c0392b] rounded-2xl
                          px-4 py-3 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchMonthData(currentMonth)}
              className="text-primary underline text-sm ml-3 whitespace-nowrap"
            >
              再読み込み
            </button>
          </div>
        )}

        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={goPrevMonth}
            className="w-10 h-10 rounded-2xl bg-white border border-primary-light
                       text-primary font-bold active:bg-primary-pale transition-colors"
          >
            ‹
          </button>
          <h2 className="text-base font-bold text-[#2c3e50]">
            {currentMonth.format('YYYY年M月')}
          </h2>
          <button
            type="button"
            onClick={goNextMonth}
            disabled={isNextDisabled}
            className={`w-10 h-10 rounded-2xl border font-bold transition-colors
                        ${isNextDisabled
                          ? 'border-[#e2e8f0] text-[#b0bec5] bg-white cursor-not-allowed'
                          : 'bg-white border-primary-light text-primary active:bg-primary-pale'
                        }`}
          >
            ›
          </button>
        </div>

        {/* カレンダー本体 */}
        {loading ? (
          <SkeletonCalendar />
        ) : (
          <div className="bg-white border border-primary-light rounded-3xl p-3 shadow-sm">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 mb-1">
              {WEEK_HEADERS.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-xs font-medium py-1
                    ${i === 0 ? 'text-[#e07070]' : i === 6 ? 'text-primary' : 'text-[#7f9aaa]'}`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 日付グリッド */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, idx) => {
                if (!date) {
                  return <div key={`blank-${idx}`} />
                }

                const dateKey  = date.format('YYYY-MM-DD')
                const rate     = rateMap[dateKey] ?? null
                const color    = rateToColor(rate)
                const isToday  = dateKey === today
                const headache = headacheMap[dateKey]
                const dayOfWeek = date.day() // 0=日, 6=土

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => handleDayTap(date)}
                    className={`relative aspect-square flex flex-col items-center justify-center
                                rounded-2xl transition-colors duration-150 active:bg-primary-pale
                                ${isToday ? 'ring-2 ring-primary' : ''}`}
                  >
                    {/* 達成率の色丸（背景） */}
                    {color && (
                      <div className={`absolute inset-0 rounded-2xl opacity-20 ${color.dot}`} />
                    )}

                    {/* 日付数字 */}
                    <span className={`relative text-sm font-medium leading-none
                      ${isToday
                        ? 'text-primary font-bold'
                        : dayOfWeek === 0
                        ? 'text-[#e07070]'
                        : dayOfWeek === 6
                        ? 'text-primary'
                        : 'text-[#2c3e50]'
                      }`}>
                      {date.date()}
                    </span>

                    {/* 達成率ドット */}
                    {color && (
                      <div className={`relative w-1.5 h-1.5 rounded-full mt-0.5 ${color.dot}`} />
                    )}

                    {/* 頭痛マーク */}
                    {headache && headache.severity > 0 && (
                      <span className="relative text-[8px] leading-none mt-0.5">
                        {headache.severity === 2 ? '😣' : '😐'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 凡例 */}
        <div className="flex items-center justify-center gap-4 text-xs text-[#7f9aaa]">
          {[
            { color: 'bg-pastel-green',  label: '100%' },
            { color: 'bg-pastel-yellow', label: '50〜99%' },
            { color: 'bg-pastel-red',    label: '1〜49%' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 日別詳細モーダル */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          logs={dayLogs}
          headache={headacheMap[selectedDate.format('YYYY-MM-DD')] || null}
          loading={dayLogLoading}
          onClose={closeModal}
        />
      )}

      <BottomNav />
    </div>
  )
}

// ================================================================
// 日別詳細モーダル
// ================================================================

/**
 * @param {{
 *   date: dayjs.Dayjs,
 *   logs: object[],
 *   headache: object | null,
 *   loading: boolean,
 *   onClose: function
 * }} props
 */
function DayDetailModal({ date, logs, headache, loading, onClose }) {
  const dateLabel = date.format('M月D日（ddd）')

  // 達成率を計算する
  const total = logs.length
  const done  = logs.filter(l => l.status === 'taken' || l.status === 'taken_late').length
  const rate  = total > 0 ? Math.round((done / total) * 100) : null

  return (
    // オーバーレイ
    <div
      className="fixed inset-0 z-30 bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      {/* モーダル本体（下からスライド） */}
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ハンドルバー */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#e2e8f0] rounded-full" />
        </div>

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-primary-light">
          <h3 className="font-bold text-[#2c3e50] text-base">{dateLabel}</h3>
          {rate !== null && (
            <span className="text-sm font-bold text-primary">{done}/{total} 完了</span>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">

          {/* ローディング */}
          {loading && (
            <div className="flex flex-col gap-2 animate-pulse">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 bg-primary-light rounded-2xl" />
              ))}
            </div>
          )}

          {/* 服薬ログ */}
          {!loading && (
            <section>
              <h4 className="text-sm font-bold text-[#7f9aaa] mb-2">服薬記録</h4>
              {logs.length === 0 ? (
                <p className="text-sm text-[#b0bec5] text-center py-3">記録がありません</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {logs.map(log => {
                    const st = STATUS_MAP[log.status] ?? STATUS_MAP.missed
                    return (
                      <div key={log.id}
                           className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${st.bg}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#2c3e50] truncate">
                            {log.medicines?.name ?? '不明'}
                            {log.medicines?.dose && (
                              <span className="font-normal text-[#7f9aaa] ml-1">
                                {log.medicines.dose}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[#7f9aaa]">
                            {log.schedules?.time?.slice(0,5) ?? ''}
                            {log.schedules?.label ? `　${log.schedules.label}` : ''}
                          </p>
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap ${st.text}`}>
                          {st.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* 頭痛記録 */}
          {!loading && (
            <section>
              <h4 className="text-sm font-bold text-[#7f9aaa] mb-2">頭痛記録</h4>
              {headache ? (
                <div className="bg-primary-pale border border-primary-light rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{SEVERITY_MAP[headache.severity]?.emoji}</span>
                    <span className={`font-bold text-sm ${SEVERITY_MAP[headache.severity]?.color}`}>
                      {SEVERITY_MAP[headache.severity]?.label}
                    </span>
                  </div>
                  {headache.memo && (
                    <p className="text-sm text-[#7f9aaa] mt-2 leading-relaxed">{headache.memo}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#b0bec5] text-center py-3">記録がありません</p>
              )}
            </section>
          )}

          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-2xl border border-primary-light text-[#7f9aaa]
                       text-sm font-medium active:bg-primary-pale transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
