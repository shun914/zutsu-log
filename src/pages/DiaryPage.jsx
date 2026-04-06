import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/ui/BottomNav'

// ---- 定数 -------------------------------------------------------

// 頭痛の強さ定義（severity: 0=なし 1=中程度 2=強い）
const SEVERITY_OPTIONS = [
  {
    value: 0,
    label: 'なし',
    emoji: '😊',
    bg:        'bg-[#e6f5eb]',
    activeBg:  'bg-pastel-green',
    text:      'text-[#22c55e]',
    activeText:'text-white',
    border:    'border-[#72c08a]',
  },
  {
    value: 1,
    label: '中程度',
    emoji: '😐',
    bg:        'bg-[#fdf6e3]',
    activeBg:  'bg-pastel-yellow',
    text:      'text-[#f59e0b]',
    activeText:'text-white',
    border:    'border-[#f0b942]',
  },
  {
    value: 2,
    label: '強い',
    emoji: '😣',
    bg:        'bg-[#fdeaea]',
    activeBg:  'bg-pastel-red',
    text:      'text-[#ef4444]',
    activeText:'text-white',
    border:    'border-[#e07070]',
  },
]

// ---- ユーティリティ ---------------------------------------------

/**
 * 日付文字列（YYYY-MM-DD）を「4月5日（土）」形式にフォーマットする
 * @param {string} dateStr
 * @returns {string}
 */
function formatDateLabel(dateStr) {
  return dayjs(dateStr).format('M月D日（ddd）')
}

// ---- スケルトンUI -----------------------------------------------

function SkeletonItem() {
  return (
    <div className="bg-white border border-primary-light rounded-3xl p-4 flex gap-3 animate-pulse">
      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary-light" />
      <div className="flex-1 flex flex-col gap-2 justify-center">
        <div className="h-3 bg-primary-light rounded-full w-1/3" />
        <div className="h-4 bg-primary-light rounded-full w-1/2" />
        <div className="h-3 bg-primary-light rounded-full w-2/3" />
      </div>
    </div>
  )
}

// ---- メインコンポーネント ----------------------------------------

export default function DiaryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // 今日の日付（YYYY-MM-DD）
  const today = dayjs().format('YYYY-MM-DD')

  // フォーム状態
  const [severity, setSeverity] = useState(null)   // null=未選択
  const [memo, setMemo]         = useState('')
  const [todayLog, setTodayLog] = useState(null)   // 既存の今日のログ
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState(null)   // { type: 'success'|'error', text }

  // 過去7日分
  const [pastLogs, setPastLogs]   = useState([])
  const [loading, setLoading]     = useState(true)

  // ----- データ取得 --------------------------------------------

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      // 今日 + 過去6日 = 計7日分を取得
      const from = dayjs().subtract(6, 'day').format('YYYY-MM-DD')

      const { data, error } = await supabase
        .from('headache_logs')
        .select('*')
        .gte('date', from)
        .lte('date', today)
        .order('date', { ascending: false })

      if (error) throw error

      const allLogs = data || []
      const todayRec = allLogs.find(l => l.date === today) || null
      const pastRecs  = allLogs.filter(l => l.date !== today)

      setTodayLog(todayRec)
      setPastLogs(pastRecs)

      // 今日のログが既にある場合はフォームに反映
      if (todayRec) {
        setSeverity(todayRec.severity)
        setMemo(todayRec.memo || '')
      }
    } catch (err) {
      console.error('日記取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // ----- 保存処理 ----------------------------------------------

  const handleSave = async () => {
    if (severity === null) {
      setSaveMsg({ type: 'error', text: '頭痛の強さを選択してください' })
      return
    }

    setSaving(true)
    setSaveMsg(null)

    try {
      if (todayLog) {
        // 既存レコードを更新
        const { error } = await supabase
          .from('headache_logs')
          .update({ severity, memo: memo.trim() || null })
          .eq('id', todayLog.id)
        if (error) throw error
      } else {
        // 新規作成
        const { error } = await supabase
          .from('headache_logs')
          .insert({ user_id: user.id, date: today, severity, memo: memo.trim() || null })
        if (error) throw error
      }

      setSaveMsg({ type: 'success', text: '記録を保存しました' })
      // 最新データを再取得
      await fetchLogs()
    } catch (err) {
      console.error('日記保存エラー:', err)
      setSaveMsg({ type: 'error', text: '保存に失敗しました。もう一度お試しください。' })
    } finally {
      setSaving(false)
      // 3秒後にメッセージを消す
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  // ---------------------------------------------------------

  return (
    <div className="min-h-screen bg-primary-pale pb-24">

      {/* ヘッダー */}
      <div className="bg-white border-b border-primary-light sticky top-0 z-10">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#2c3e50]">頭痛日記</h1>
          <button
            type="button"
            onClick={() => navigate('/diary/report')}
            className="h-9 px-3 rounded-2xl border border-primary text-primary text-xs font-medium
                       active:bg-primary-pale transition-colors duration-150"
          >
            受診モードで見る →
          </button>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-4">

        {/* トーストメッセージ */}
        {saveMsg && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-medium
            ${saveMsg.type === 'success'
              ? 'bg-[#e6f5eb] border border-[#72c08a] text-[#22c55e]'
              : 'bg-[#fdeaea] border border-[#e07070] text-[#c0392b]'
            }`}>
            {saveMsg.text}
          </div>
        )}

        {/* ---- 今日の記録フォーム ---- */}
        <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#2c3e50]">今日の記録</h2>
            <span className="text-sm text-[#7f9aaa]">{formatDateLabel(today)}</span>
          </div>

          {/* 頭痛の強さ選択 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-[#7f9aaa] font-medium">頭痛の強さ</label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map(opt => {
                const isSelected = severity === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSeverity(opt.value)}
                    className={`flex-1 flex flex-col items-center justify-center gap-1
                                h-20 rounded-2xl border-2 font-medium text-sm
                                transition-colors duration-150
                                ${isSelected
                                  ? `${opt.activeBg} ${opt.activeText} ${opt.border}`
                                  : `${opt.bg} ${opt.text} border-transparent`
                                }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* メモ */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#7f9aaa] font-medium">メモ（任意）</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="例：午後から痛み始めた、天気が悪かった…"
              rows={3}
              className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-light
                         text-[#2c3e50] placeholder:text-[#b0bec5] resize-none"
            />
          </div>

          {/* 保存ボタン */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`w-full h-12 rounded-2xl font-bold text-base text-white
                        transition-colors duration-150
                        ${saving
                          ? 'bg-[#b0bec5] cursor-not-allowed'
                          : 'bg-primary active:bg-primary-dark'
                        }`}
          >
            {saving ? '保存中...' : todayLog ? '更新する' : '保存する'}
          </button>
        </div>

        {/* ---- 過去7日の記録リスト ---- */}
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-[#2c3e50] px-1">過去の記録</h2>

          {/* ローディング */}
          {loading && (
            <>
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </>
          )}

          {/* 記録リスト */}
          {!loading && pastLogs.map(log => (
            <PastLogItem key={log.id} log={log} />
          ))}

          {/* 記録なし */}
          {!loading && pastLogs.length === 0 && (
            <div className="bg-white border border-primary-light rounded-3xl px-4 py-6
                            text-center text-[#b0bec5] text-sm">
              過去の記録はありません
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

// ---- 過去ログの1件表示 ------------------------------------------

/**
 * @param {{ log: { date, severity, memo } }} props
 */
function PastLogItem({ log }) {
  const opt = SEVERITY_OPTIONS[log.severity] ?? SEVERITY_OPTIONS[0]

  return (
    <div className="bg-white border border-primary-light rounded-3xl p-4 flex items-start gap-3">
      {/* 強度バッジ */}
      <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center
                       justify-center gap-0.5 ${opt.bg} border ${opt.border}`}>
        <span className="text-xl">{opt.emoji}</span>
        <span className={`text-xs font-bold ${opt.text}`}>{opt.label}</span>
      </div>

      {/* テキスト情報 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#2c3e50]">{formatDateLabel(log.date)}</p>
        {log.memo ? (
          <p className="text-sm text-[#7f9aaa] mt-1 leading-relaxed">{log.memo}</p>
        ) : (
          <p className="text-xs text-[#b0bec5] mt-1">メモなし</p>
        )}
      </div>
    </div>
  )
}
