import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/ui/BottomNav'

// ---- 定数 -------------------------------------------------------

const APP_VERSION = '0.0.1'

// ローカルストレージのキー
const LS_NOTIF_ENABLED = 'zutsu_notif_enabled'

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

// ---- メインコンポーネント ----------------------------------------

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const pushSupported = isPushSupported()

  // 通知設定（ローカルストレージ）
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifPermission, setNotifPermission] = useState('default') // 'default'|'granted'|'denied'

  // UI状態
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting]   = useState(false)
  const [toast, setToast]           = useState(null) // { type: 'success'|'error', text }

  // 初期化：ローカルストレージから読み込む
  useEffect(() => {
    setNotifEnabled(localStorage.getItem(LS_NOTIF_ENABLED) === 'true')
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
                  sub={
                    notifPermission === 'granted'
                      ? '薬ごとのスケジュール時刻に通知します'
                      : '許可が必要です'
                  }
                  border={false}
                  right={
                    <Toggle
                      enabled={notifEnabled}
                      onChange={handleNotifToggle}
                      disabled={requestingPermission || notifPermission === 'denied'}
                    />
                  }
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
