import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/ui/BottomNav'

// ---- 定数 -------------------------------------------------------

const APP_VERSION = '0.0.1'

// ローカルストレージのキー
const LS_NOTIF_ENABLED = 'zutsu_notif_enabled'
const LS_NOTIF_MORNING = 'zutsu_notif_morning'
const LS_NOTIF_NOON    = 'zutsu_notif_noon'
const LS_NOTIF_EVENING = 'zutsu_notif_evening'
const LS_NOTIF_BEDTIME = 'zutsu_notif_bedtime'

// ---- ユーティリティ ---------------------------------------------

/**
 * Web Pushが利用可能な環境かどうかを判定する
 * iOSはSafari 16.4以降のみ対応
 * @returns {boolean}
 */
function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/**
 * ローカルストレージから通知設定を読み込む
 * 値が空文字の場合は「通知しない」（null）として扱う
 * @returns {object}
 */
function loadNotifSettings() {
  const read = (key, fallback) => {
    const v = localStorage.getItem(key)
    if (v === null) return fallback  // 未設定 → デフォルト値
    if (v === '')   return null      // 空文字 → 通知しない
    return v
  }
  return {
    enabled: localStorage.getItem(LS_NOTIF_ENABLED) === 'true',
    morning: read(LS_NOTIF_MORNING, '08:00'),
    noon:    read(LS_NOTIF_NOON,    '12:00'),
    evening: read(LS_NOTIF_EVENING, '18:00'),
    bedtime: read(LS_NOTIF_BEDTIME, null),   // 就寝前はデフォルト「通知しない」
  }
}

// ---- サブコンポーネント -----------------------------------------

/**
 * セクションのヘッダーラベル
 */
function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold text-[#7f9aaa] uppercase tracking-wide px-1 mt-2">
      {children}
    </p>
  )
}

/**
 * 設定項目の行（ラベル + 右側コンテンツ）
 */
function SettingRow({ label, sub, right, border = true }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3.5
                     ${border ? 'border-b border-primary-light' : ''}`}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-[#2c3e50] leading-snug">{label}</span>
        {sub && <span className="text-xs text-[#b0bec5] leading-snug">{sub}</span>}
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
  )
}

/**
 * トグルスイッチ
 */
function Toggle({ enabled, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 items-center rounded-full
                  transition-colors duration-200 focus:outline-none
                  ${enabled ? 'bg-primary' : 'bg-[#b0bec5]'}
                  ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow
                    transition-transform duration-200
                    ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  )
}

/**
 * 通知時刻の1行（「通知しない」ボタン + 時刻ピッカー）
 * @param {{ label: string, value: string|null, onChange: function, disabled: boolean, border: boolean }} props
 * value === null のとき「通知しない」が選択された状態
 */
function NotifTimeRow({ label, value, onChange, disabled, border = true }) {
  const isSkipped = value === null

  return (
    <div className={`py-3 flex items-center justify-between gap-3
                     ${border ? 'border-b border-primary-light' : ''}`}>
      {/* 左：タイミング名 */}
      <span className="text-sm font-medium text-[#2c3e50] w-16 flex-shrink-0">{label}</span>

      {/* 右：「通知しない」ボタン + 時刻ピッカー */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* 通知しないトグルボタン */}
        <button
          type="button"
          onClick={() => !disabled && onChange(isSkipped ? '08:00' : null)}
          disabled={disabled}
          className={`text-xs font-medium px-3 py-1.5 rounded-2xl border
                      transition-colors duration-150 whitespace-nowrap
                      ${isSkipped
                        ? 'bg-[#b0bec5] text-white border-[#b0bec5]'
                        : 'bg-primary-pale text-[#7f9aaa] border-primary-light'
                      }
                      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isSkipped ? '✓ 通知しない' : '通知しない'}
        </button>

        {/* 時刻ピッカー（通知しない選択時は非表示） */}
        {!isSkipped && (
          <input
            type="time"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className={`rounded-xl border border-primary-light px-2 py-1.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-primary-light
                        text-[#2c3e50] w-28
                        ${disabled ? 'opacity-40 cursor-not-allowed bg-primary-pale' : 'bg-white'}`}
          />
        )}
      </div>
    </div>
  )
}

// ---- メインコンポーネント ----------------------------------------

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const pushSupported = isPushSupported()

  // 通知設定（ローカルストレージ）
  // 時刻は string（HH:MM）または null（通知しない）
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifPermission, setNotifPermission] = useState('default') // 'default'|'granted'|'denied'
  const [morning, setMorning] = useState('08:00')
  const [noon,    setNoon]    = useState('12:00')
  const [evening, setEvening] = useState('18:00')
  const [bedtime, setBedtime] = useState(null)

  // UI状態
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting]   = useState(false)
  const [toast, setToast]           = useState(null) // { type: 'success'|'error', text }

  // 初期化：ローカルストレージから読み込む
  useEffect(() => {
    const saved = loadNotifSettings()
    setNotifEnabled(saved.enabled)
    setMorning(saved.morning)
    setNoon(saved.noon)
    setEvening(saved.evening)
    setBedtime(saved.bedtime)

    if (pushSupported) {
      setNotifPermission(Notification.permission)
    }
  }, [pushSupported])

  // ---- 通知トグル -----------------------------------------------

  const handleNotifToggle = async (next) => {
    if (next && pushSupported && notifPermission !== 'granted') {
      // 許可をリクエスト
      setRequestingPermission(true)
      try {
        const result = await Notification.requestPermission()
        setNotifPermission(result)
        if (result !== 'granted') {
          showToast('error', '通知の許可が得られませんでした')
          setRequestingPermission(false)
          return
        }
      } catch {
        showToast('error', '通知の許可リクエストに失敗しました')
        setRequestingPermission(false)
        return
      }
      setRequestingPermission(false)
    }

    setNotifEnabled(next)
    localStorage.setItem(LS_NOTIF_ENABLED, String(next))
    showToast('success', next ? '通知をオンにしました' : '通知をオフにしました')
  }

  // ---- 時刻変更（value は string または null）------------------

  const handleTimeChange = (key, value) => {
    // null（通知しない）は空文字でlocalStorageに保存する
    const stored = value ?? ''
    if (key === 'morning') { setMorning(value); localStorage.setItem(LS_NOTIF_MORNING, stored) }
    if (key === 'noon')    { setNoon(value);    localStorage.setItem(LS_NOTIF_NOON,    stored) }
    if (key === 'evening') { setEvening(value); localStorage.setItem(LS_NOTIF_EVENING, stored) }
    if (key === 'bedtime') { setBedtime(value); localStorage.setItem(LS_NOTIF_BEDTIME, stored) }
  }

  // ---- データリセット -------------------------------------------

  const handleReset = async () => {
    setResetting(true)
    try {
      // medication_logs と headache_logs を全削除（薬・スケジュールは残す）
      const [medRes, headRes] = await Promise.all([
        supabase.from('medication_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('headache_logs').delete().neq('id',  '00000000-0000-0000-0000-000000000000'),
      ])

      if (medRes.error) throw medRes.error
      if (headRes.error) throw headRes.error

      showToast('success', '記録をすべて削除しました')
    } catch (err) {
      console.error('リセットエラー:', err)
      showToast('error', '削除に失敗しました。もう一度お試しください。')
    } finally {
      setResetting(false)
      setShowResetConfirm(false)
    }
  }

  // ---- トースト -------------------------------------------------

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }

  // ---- レンダリング ---------------------------------------------

  return (
    <div className="min-h-screen bg-primary-pale pb-24">

      {/* ヘッダー */}
      <div className="bg-white border-b border-primary-light sticky top-0 z-10">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center">
          <h1 className="text-lg font-bold text-[#2c3e50]">設定</h1>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50
                         max-w-[440px] w-[calc(100%-2rem)]
                         rounded-2xl px-4 py-3 text-sm font-medium shadow-md
                         transition-all duration-300
                         ${toast.type === 'success'
                           ? 'bg-[#e6f5eb] border border-[#72c08a] text-[#22c55e]'
                           : 'bg-[#fdeaea] border border-[#e07070] text-[#c0392b]'
                         }`}>
          {toast.text}
        </div>
      )}

      <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-4">

        {/* ---- 通知設定 ---- */}
        <div>
          <SectionLabel>通知</SectionLabel>
          <div className="bg-white border border-primary-light rounded-3xl px-4 mt-2">

            {/* 非対応環境の案内 */}
            {!pushSupported && (
              <div className="py-4 text-sm text-[#b0bec5] text-center leading-relaxed">
                通知はご利用の環境では使えません。<br />
                <span className="text-xs">
                  iOS 16.4以降のSafari、またはChrome/Edgeが必要です。
                </span>
              </div>
            )}

            {/* 対応環境の通知設定 */}
            {pushSupported && (
              <>
                {/* 通知許可が拒否されている場合の案内 */}
                {notifPermission === 'denied' && (
                  <div className="py-3 text-xs text-[#e07070] bg-[#fdeaea] rounded-2xl px-3 mt-3 mb-1">
                    通知がブロックされています。ブラウザの設定から許可してください。
                  </div>
                )}

                <SettingRow
                  label="通知をオンにする"
                  sub={notifPermission === 'granted' ? '許可済み' : '許可が必要です'}
                  right={
                    <Toggle
                      enabled={notifEnabled}
                      onChange={handleNotifToggle}
                      disabled={requestingPermission || notifPermission === 'denied'}
                    />
                  }
                />

                <NotifTimeRow
                  label="朝"
                  value={morning}
                  onChange={v => handleTimeChange('morning', v)}
                  disabled={!notifEnabled}
                />

                <NotifTimeRow
                  label="昼"
                  value={noon}
                  onChange={v => handleTimeChange('noon', v)}
                  disabled={!notifEnabled}
                />

                <NotifTimeRow
                  label="夕"
                  value={evening}
                  onChange={v => handleTimeChange('evening', v)}
                  disabled={!notifEnabled}
                />

                <NotifTimeRow
                  label="就寝前"
                  value={bedtime}
                  onChange={v => handleTimeChange('bedtime', v)}
                  disabled={!notifEnabled}
                  border={false}
                />
              </>
            )}
          </div>
        </div>

        {/* ---- データ管理 ---- */}
        <div>
          <SectionLabel>データ管理</SectionLabel>
          <div className="bg-white border border-primary-light rounded-3xl px-4 mt-2">
            <SettingRow
              label="記録をすべて削除する"
              sub="服薬記録・頭痛日記を削除します（薬の登録は残ります）"
              border={false}
              right={
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="h-9 px-4 rounded-2xl border border-[#e07070] text-[#e07070]
                             text-sm font-medium active:bg-[#fdeaea] transition-colors duration-150
                             whitespace-nowrap"
                >
                  削除
                </button>
              }
            />
          </div>
        </div>

        {/* ---- アカウント ---- */}
        <div>
          <SectionLabel>アカウント</SectionLabel>
          <div className="bg-white border border-primary-light rounded-3xl px-4 mt-2">
            <SettingRow
              label="メールアドレス"
              border={true}
              right={
                <span className="text-sm text-[#7f9aaa] max-w-[180px] truncate block">
                  {user?.email}
                </span>
              }
            />
            <SettingRow
              label="ログアウト"
              border={false}
              right={
                <button
                  type="button"
                  onClick={signOut}
                  className="h-9 px-4 rounded-2xl border border-primary-light text-[#7f9aaa]
                             text-sm font-medium active:bg-primary-pale transition-colors duration-150"
                >
                  ログアウト
                </button>
              }
            />
          </div>
        </div>

        {/* ---- アプリ情報 ---- */}
        <div>
          <SectionLabel>アプリについて</SectionLabel>
          <div className="bg-white border border-primary-light rounded-3xl px-4 mt-2">
            <SettingRow
              label="アプリ名"
              border={true}
              right={<span className="text-sm text-[#7f9aaa]">頭痛ログ（Zutsu Log）</span>}
            />
            <SettingRow
              label="バージョン"
              border={false}
              right={<span className="text-sm text-[#7f9aaa]">v{APP_VERSION}</span>}
            />
          </div>
        </div>

      </div>

      {/* ---- リセット確認ダイアログ ---- */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-8">
          <div className="w-full max-w-[480px] bg-white rounded-3xl p-6 flex flex-col gap-4 shadow-lg">
            <h3 className="text-lg font-bold text-[#2c3e50] text-center">
              記録を全て削除しますか？
            </h3>
            <p className="text-sm text-[#7f9aaa] text-center leading-relaxed">
              服薬記録と頭痛日記のデータがすべて削除されます。<br />
              この操作は元に戻せません。<br />
              <span className="text-xs">※ 薬の登録・スケジュールは残ります</span>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="flex-1 h-12 rounded-2xl border border-primary-light bg-white text-[#7f9aaa]
                           font-medium active:bg-primary-pale transition-colors duration-150"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className={`flex-1 h-12 rounded-2xl font-medium text-white transition-colors duration-150
                            ${resetting
                              ? 'bg-[#b0bec5] cursor-not-allowed'
                              : 'bg-[#e07070] active:bg-[#c0392b]'
                            }`}
              >
                {resetting ? '削除中...' : '全て削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
