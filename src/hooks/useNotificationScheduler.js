import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import dayjs from 'dayjs'

// ローカルストレージキー（SettingsPage と共有）
const LS_NOTIF_ENABLED = 'zutsu_notif_enabled'

/**
 * Service Worker 経由で通知を表示する
 * Notification API を直接使うと iOS Safari PWA では動作しないため、
 * registration.showNotification() を使う必要がある
 * @param {object} medicine - { name, dose }
 * @param {object} schedule - { label, id }
 */
async function showMedicationNotification(medicine, schedule) {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(`💊 ${schedule.label}の薬を飲む時間です`, {
      body:     `${medicine.name}${medicine.dose ? `（${medicine.dose}）` : ''}`,
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      tag:      `medication-${schedule.id}`,
      renotify: true,
      data:     { url: '/' },
    })
  } catch (err) {
    console.warn('通知の表示に失敗しました:', err)
  }
}

/**
 * 今日の服薬スケジュールをもとに、各服薬時刻に通知を表示する
 * - サーバー不要、クライアントサイドのみで動作
 * - setTimeout で各時刻をスケジューリングし、時刻になったら showNotification() を呼ぶ
 * - アプリが開いている（PWA バックグラウンド含む）間のみ動作する
 * @param {object|null} user - ログイン済みユーザー。null のときは何もしない
 */
export function useNotificationScheduler(user) {
  // タイマーIDをまとめて管理する
  const timersRef = useRef([])

  useEffect(() => {
    // 未ログイン・通知非対応環境はスキップ
    if (!user) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    const setup = async () => {
      // 通知が許可されていない、または設定でOFFの場合はスキップ
      if (Notification.permission !== 'granted') return
      if (localStorage.getItem(LS_NOTIF_ENABLED) !== 'true') return

      // 今日の曜日を取得（DBは 1=月〜7=日）
      // dayjs の day() は 0=日〜6=土 なので変換する
      const todayDow = dayjs().day() === 0 ? 7 : dayjs().day()

      // 今日有効なアクティブスケジュールを薬情報つきで取得する
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select('id, label, time, medicine_id, medicines(name, dose)')
        .eq('is_active', true)
        .contains('days', [todayDow])

      if (error) {
        console.warn('スケジュール取得エラー:', error)
        return
      }
      if (!schedules || schedules.length === 0) return

      // 既存タイマーをすべてクリアしてから再スケジュール
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []

      const now = dayjs()

      for (const schedule of schedules) {
        const medicine = schedule.medicines
        if (!medicine) continue

        // schedule.time は "HH:MM" または "HH:MM:SS" 形式で返る
        const [hour, minute] = schedule.time.split(':').map(Number)
        const scheduledTime = now
          .hour(hour)
          .minute(minute)
          .second(0)
          .millisecond(0)

        // 既に過ぎた時刻はスキップ
        const msUntil = scheduledTime.diff(now)
        if (msUntil <= 0) continue

        // 服薬時刻にタイマーをセット
        const timerId = setTimeout(async () => {
          // 発火時点で通知ONのままか再確認する
          if (Notification.permission !== 'granted') return
          if (localStorage.getItem(LS_NOTIF_ENABLED) !== 'true') return
          await showMedicationNotification(medicine, schedule)
        }, msUntil)

        timersRef.current.push(timerId)
      }
    }

    setup()

    // アンマウント時にタイマーをすべてクリアする
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  // user が変わったとき（ログイン直後など）に再実行する
  // 日付変更は対応しない（アプリ再起動で再スケジュールされる）
  }, [user])
}
