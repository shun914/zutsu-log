import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  todayAppDay,
  buildScheduledAt,
  isOver40Min,
  todayRange,
  formatDateJa,
} from '../utils/dateUtils'
import MedicationCard from '../components/features/MedicationCard'
import BottomNav from '../components/ui/BottomNav'

// ---- スケルトンUI ----------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-white border border-primary-light rounded-3xl p-4
                    flex gap-3 items-center animate-pulse">
      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary-light" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 bg-primary-light rounded-full w-3/4" />
        <div className="h-3 bg-primary-light rounded-full w-1/2" />
      </div>
      <div className="flex-shrink-0 w-20 h-11 rounded-2xl bg-primary-light" />
    </div>
  )
}

// ---------------------------------------------------------

export default function HomePage() {
  const { user } = useAuth()

  /** @type {[Array<{schedule, medicine, log, scheduledAt}>, Function]} */
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ----- データ取得 ----------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const appDay = todayAppDay()
      const { start, end } = todayRange()

      // 今日の曜日に一致するアクティブなスケジュールを薬情報ごと取得
      const { data: schedules, error: schedErr } = await supabase
        .from('schedules')
        .select('*, medicines(*)')
        .eq('is_active', true)
        .eq('medicines.is_active', true)
        .contains('days', [appDay])
        .order('time', { ascending: true })

      if (schedErr) throw schedErr

      // 薬が論理削除済みのものを除外（joinsはnullになる）
      const validSchedules = (schedules || []).filter(s => s.medicines !== null)

      if (validSchedules.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      // 今日の服薬ログを取得
      const { data: logs, error: logsErr } = await supabase
        .from('medication_logs')
        .select('*')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)

      if (logsErr) throw logsErr

      const logsMap = {}
      ;(logs || []).forEach(log => {
        logsMap[log.schedule_id] = log
      })

      // 飲み忘れを自動判定してDBに記録する
      const missedInserts = []
      validSchedules.forEach(s => {
        const scheduledAt = buildScheduledAt(s.time)
        if (!logsMap[s.id] && isOver40Min(scheduledAt)) {
          missedInserts.push({
            medicine_id:  s.medicine_id,
            schedule_id:  s.id,
            scheduled_at: scheduledAt,
            status:       'missed',
          })
        }
      })

      if (missedInserts.length > 0) {
        // RLS対応：user_id を付与してから挿入
        const insertsWithUser = missedInserts.map(r => ({ ...r, user_id: user.id }))
        const { data: inserted, error: missedErr } = await supabase
          .from('medication_logs')
          .insert(insertsWithUser)
          .select()
        if (missedErr) throw missedErr
        // logsMapに反映
        ;(inserted || []).forEach(log => {
          logsMap[log.schedule_id] = log
        })
      }

      // items配列を組み立てる
      const builtItems = validSchedules.map(s => ({
        schedule:    s,
        medicine:    s.medicines,
        log:         logsMap[s.id] || null,
        scheduledAt: buildScheduledAt(s.time),
      }))

      setItems(builtItems)
    } catch (err) {
      console.error('ホームデータ取得エラー:', err)
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ----- 飲んだボタン処理 ----------------------------------

  const handleTaken = async (item) => {
    const { schedule, scheduledAt, log: existingLog } = item

    // 40分以上経過していれば taken_late（missed からの服用も必ず taken_late）
    const status = isOver40Min(scheduledAt) ? 'taken_late' : 'taken'
    const takenAt = new Date().toISOString()

    // UIを即時更新（楽観的更新）
    const prevLog = existingLog
    const tempLog = { ...existingLog, schedule_id: schedule.id, status, taken_at: takenAt }
    setItems(prev => prev.map(i =>
      i.schedule.id === schedule.id ? { ...i, log: tempLog } : i
    ))

    try {
      if (existingLog?.id) {
        // missed ログが既に存在する → UPDATE
        const { error } = await supabase
          .from('medication_logs')
          .update({ status, taken_at: takenAt })
          .eq('id', existingLog.id)
        if (error) throw error
      } else {
        // ログなし → INSERT
        const { error } = await supabase
          .from('medication_logs')
          .insert({
            user_id:      user.id,
            medicine_id:  schedule.medicine_id,
            schedule_id:  schedule.id,
            scheduled_at: scheduledAt,
            taken_at:     takenAt,
            status,
          })
        if (error) throw error
      }
    } catch (err) {
      console.error('服薬記録エラー:', err)
      // 失敗時はUIを元に戻す
      setItems(prev => prev.map(i =>
        i.schedule.id === schedule.id ? { ...i, log: prevLog } : i
      ))
      setError('記録に失敗しました。もう一度お試しください。')
    }
  }

  // ----- スキップ処理 --------------------------------------

  const handleSkip = async (item) => {
    const { schedule, scheduledAt } = item

    // UIを即時更新（楽観的更新）
    const tempLog = { schedule_id: schedule.id, status: 'skipped' }
    setItems(prev => prev.map(i =>
      i.schedule.id === schedule.id ? { ...i, log: tempLog } : i
    ))

    try {
      const { error } = await supabase
        .from('medication_logs')
        .insert({
          user_id:      user.id,
          medicine_id:  schedule.medicine_id,
          schedule_id:  schedule.id,
          scheduled_at: scheduledAt,
          status:       'skipped',
        })
      if (error) throw error
    } catch (err) {
      console.error('スキップ記録エラー:', err)
      setItems(prev => prev.map(i =>
        i.schedule.id === schedule.id ? { ...i, log: null } : i
      ))
      setError('記録に失敗しました。もう一度お試しください。')
    }
  }

  // ----- 達成率の計算 --------------------------------------

  const total = items.length
  const done  = items.filter(i =>
    i.log?.status === 'taken' || i.log?.status === 'taken_late'
  ).length
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0

  // ---------------------------------------------------------

  return (
    <div className="min-h-screen bg-primary-pale pb-24">

      {/* ヘッダー */}
      <div className="bg-white border-b border-primary-light">
        <div className="max-w-[480px] mx-auto px-4 pt-5 pb-4">
          {/* 日付 */}
          <p className="text-sm text-[#7f9aaa]">{formatDateJa()}</p>
          <h1 className="text-xl font-bold text-[#2c3e50] mt-0.5">今日の服薬</h1>

          {/* 達成率バー */}
          {!loading && total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[#7f9aaa]">
                  {done} / {total} 完了
                </span>
                <span className="text-sm font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="w-full h-3 bg-primary-light rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-3">

        {/* エラートースト */}
        {error && (
          <div className="bg-[#fdeaea] border border-[#e07070] text-[#c0392b] rounded-2xl
                          px-4 py-3 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => { setError(null); fetchData() }}
              className="text-primary underline text-sm ml-3 whitespace-nowrap"
            >
              再読み込み
            </button>
          </div>
        )}

        {/* ローディング：スケルトン */}
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* 服薬カード一覧 */}
        {!loading && items.map(item => (
          <MedicationCard
            key={item.schedule.id}
            item={item}
            onTaken={() => handleTaken(item)}
            onSkip={() => handleSkip(item)}
          />
        ))}

        {/* スケジュールなし */}
        {!loading && !error && items.length === 0 && (
          <div className="pt-16 text-center text-[#7f9aaa] flex flex-col items-center gap-3">
            <p className="text-5xl">🎉</p>
            <p className="text-base font-medium">今日の服薬はありません</p>
            <p className="text-sm">スケジュールを追加するには「薬」タブへ</p>
          </div>
        )}

        {/* 全完了メッセージ */}
        {!loading && total > 0 && done === total && (
          <div className="bg-[#e6f5eb] border border-[#72c08a] rounded-3xl px-4 py-4
                          text-center text-[#22c55e] font-bold mt-2">
            🎉 今日の服薬はすべて完了しました！
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
