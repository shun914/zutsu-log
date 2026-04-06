import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'

// ---- 定数 -------------------------------------------------------

const SEVERITY_LABELS = ['なし', '中程度', '強い']
const SEVERITY_COLORS = ['#72c08a', '#f0b942', '#e07070']
const SEVERITY_BG     = ['#e6f5eb', '#fdf6e3', '#fdeaea']

// ---- ユーティリティ ---------------------------------------------

/**
 * 過去30日分の日付配列を生成する（新しい順）
 * @returns {string[]} YYYY-MM-DD形式
 */
function getLast30Days() {
  const days = []
  for (let i = 29; i >= 0; i--) {
    days.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  }
  return days
}

/**
 * 服薬ログを日付ごとに集計して折れ線グラフ用データを生成する
 * @param {object[]} medLogs
 * @param {string[]} days
 * @returns {object[]} { date, label, rate }[]
 */
function buildLineData(medLogs, days) {
  // 日付ごとに taken/total を集計
  const byDate = {}
  medLogs.forEach(log => {
    const date = dayjs(log.scheduled_at).format('YYYY-MM-DD')
    if (!byDate[date]) byDate[date] = { taken: 0, total: 0 }
    byDate[date].total++
    if (log.status === 'taken' || log.status === 'taken_late') byDate[date].taken++
  })

  return days.map(date => {
    const rec = byDate[date]
    const rate = rec && rec.total > 0
      ? Math.round((rec.taken / rec.total) * 100)
      : null // 記録なし
    return {
      date,
      label: dayjs(date).format('M/D'),
      rate,
    }
  })
}

/**
 * 頭痛ログを強度別に集計して棒グラフ用データを生成する
 * @param {object[]} headacheLogs
 * @returns {object[]} { label, count, color, bg }[]
 */
function buildBarData(headacheLogs) {
  const counts = [0, 0, 0] // [なし, 中程度, 強い]
  headacheLogs.forEach(log => {
    if (log.severity >= 0 && log.severity <= 2) counts[log.severity]++
  })
  return counts.map((count, i) => ({
    label: SEVERITY_LABELS[i],
    count,
    color: SEVERITY_COLORS[i],
    bg: SEVERITY_BG[i],
  }))
}

// ---- スケルトンUI -----------------------------------------------

function SkeletonBlock({ className = '' }) {
  return (
    <div className={`bg-primary-light rounded-2xl animate-pulse ${className}`} />
  )
}

// ---- カスタムTooltip（折れ線グラフ）----------------------------

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rate = payload[0]?.value
  return (
    <div className="bg-white border border-primary-light rounded-2xl px-3 py-2 shadow-sm text-sm">
      <p className="text-[#7f9aaa] font-medium">{label}</p>
      {rate !== null && rate !== undefined
        ? <p className="text-primary font-bold">{rate}%</p>
        : <p className="text-[#b0bec5]">記録なし</p>
      }
    </div>
  )
}

// ---- カスタムTooltip（棒グラフ）--------------------------------

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { label, count } = payload[0]?.payload ?? {}
  return (
    <div className="bg-white border border-primary-light rounded-2xl px-3 py-2 shadow-sm text-sm">
      <p className="text-[#7f9aaa] font-medium">{label}</p>
      <p className="text-[#2c3e50] font-bold">{count}日</p>
    </div>
  )
}

// ---- メインコンポーネント ----------------------------------------

export default function DiaryReportPage() {
  const navigate = useNavigate()

  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // 集計結果
  const [lineData, setLineData]   = useState([])
  const [barData, setBarData]     = useState([])
  const [overallRate, setOverallRate] = useState(null)  // 30日全体の達成率
  const [headacheSummary, setHeadacheSummary] = useState(null) // { total, byLevel }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const today   = dayjs().format('YYYY-MM-DD')
        const from30  = dayjs().subtract(29, 'day').format('YYYY-MM-DD')
        const fromISO = dayjs().subtract(29, 'day').startOf('day').toISOString()
        const toISO   = dayjs().endOf('day').toISOString()
        const days    = getLast30Days()

        // 服薬ログと頭痛ログを並行取得
        const [medRes, headRes] = await Promise.all([
          supabase
            .from('medication_logs')
            .select('scheduled_at, status')
            .gte('scheduled_at', fromISO)
            .lte('scheduled_at', toISO),
          supabase
            .from('headache_logs')
            .select('date, severity')
            .gte('date', from30)
            .lte('date', today),
        ])

        if (medRes.error) throw medRes.error
        if (headRes.error) throw headRes.error

        const medLogs     = medRes.data || []
        const headacheLogs = headRes.data || []

        // 折れ線グラフ用データ
        const line = buildLineData(medLogs, days)
        setLineData(line)

        // 棒グラフ用データ
        const bar = buildBarData(headacheLogs)
        setBarData(bar)

        // 全体の服薬達成率
        const totalTaken = medLogs.filter(
          l => l.status === 'taken' || l.status === 'taken_late'
        ).length
        const totalAll = medLogs.length
        setOverallRate(totalAll > 0 ? Math.round((totalTaken / totalAll) * 100) : null)

        // 頭痛サマリー
        const headacheWithPain = headacheLogs.filter(l => l.severity > 0)
        setHeadacheSummary({
          total: headacheWithPain.length,
          moderate: headacheLogs.filter(l => l.severity === 1).length,
          severe:   headacheLogs.filter(l => l.severity === 2).length,
        })

      } catch (err) {
        console.error('受診モード取得エラー:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // ---- レンダリング -----------------------------------------------

  return (
    <div className="min-h-screen bg-primary-pale pb-12 print:bg-white print:pb-0">

      {/* ヘッダー */}
      <div className="bg-white border-b border-primary-light sticky top-0 z-10 print:static print:border-b-2 print:border-[#4da6d9]">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-primary text-2xl leading-none print:hidden"
            >
              ←
            </button>
            <h1 className="text-lg font-bold text-[#2c3e50]">受診モード</h1>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-4 rounded-2xl bg-primary text-white text-sm font-medium
                       active:bg-primary-dark transition-colors duration-150 print:hidden"
          >
            印刷する
          </button>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-4">

        {/* 期間ラベル */}
        <p className="text-sm text-[#7f9aaa] px-1">
          {dayjs().subtract(29, 'day').format('YYYY年M月D日')} 〜 {dayjs().format('M月D日')}（過去30日間）
        </p>

        {/* エラー */}
        {error && (
          <div className="bg-[#fdeaea] border border-[#e07070] text-[#c0392b] rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ---- サマリーカード ---- */}
        <div className="grid grid-cols-2 gap-3">

          {/* 服薬達成率 */}
          <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-1">
            <p className="text-xs text-[#7f9aaa] font-medium">服薬達成率</p>
            {loading
              ? <SkeletonBlock className="h-10 w-20 mt-1" />
              : overallRate !== null
                ? (
                  <p className="text-3xl font-bold text-primary leading-none mt-1">
                    {overallRate}
                    <span className="text-base font-medium text-[#7f9aaa] ml-0.5">%</span>
                  </p>
                )
                : <p className="text-sm text-[#b0bec5] mt-1">記録なし</p>
            }
            <p className="text-xs text-[#b0bec5]">30日間の平均</p>
          </div>

          {/* 頭痛発生日数 */}
          <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-1">
            <p className="text-xs text-[#7f9aaa] font-medium">頭痛発生日数</p>
            {loading
              ? <SkeletonBlock className="h-10 w-16 mt-1" />
              : headacheSummary !== null
                ? (
                  <>
                    <p className="text-3xl font-bold text-[#e07070] leading-none mt-1">
                      {headacheSummary.total}
                      <span className="text-base font-medium text-[#7f9aaa] ml-0.5">日</span>
                    </p>
                    <p className="text-xs text-[#b0bec5]">
                      中程度 {headacheSummary.moderate}日 / 強い {headacheSummary.severe}日
                    </p>
                  </>
                )
                : <p className="text-sm text-[#b0bec5] mt-1">記録なし</p>
            }
          </div>
        </div>

        {/* ---- 服薬達成率 折れ線グラフ ---- */}
        <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-3">
          <h2 className="font-bold text-[#2c3e50]">服薬達成率の推移</h2>

          {loading ? (
            <SkeletonBlock className="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={lineData}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cce8f4" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#7f9aaa' }}
                  interval={4}
                  tickLine={false}
                  axisLine={{ stroke: '#cce8f4' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 10, fill: '#7f9aaa' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<LineTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#4da6d9"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#4da6d9', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#2e86c1' }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ---- 頭痛強度 棒グラフ ---- */}
        <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-3">
          <h2 className="font-bold text-[#2c3e50]">頭痛の強さ（日数）</h2>

          {loading ? (
            <SkeletonBlock className="h-40" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={barData}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cce8f4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#7f9aaa' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cce8f4' }}
                />
                <YAxis
                  allowDecimals={false}
                  tickFormatter={v => `${v}日`}
                  tick={{ fontSize: 10, fill: '#7f9aaa' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={64}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* 凡例 */}
          {!loading && (
            <div className="flex gap-3 justify-center">
              {barData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-[#7f9aaa]">
                    {entry.label} {entry.count}日
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 印刷ボタン（ページ下部にも） */}
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full h-12 rounded-2xl border border-primary bg-white text-primary
                     font-medium text-base active:bg-primary-pale transition-colors duration-150
                     print:hidden"
        >
          この画面を印刷する
        </button>

        {/* 印刷時のフッター */}
        <div className="hidden print:block text-xs text-[#b0bec5] text-center pt-4">
          頭痛ログ（Zutsu Log）— 印刷日：{dayjs().format('YYYY年M月D日')}
        </div>

      </div>
    </div>
  )
}
