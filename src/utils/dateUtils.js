import dayjs from 'dayjs'
import 'dayjs/locale/ja'

dayjs.locale('ja')

// 曜日ラベル（アプリ定義: 1=月〜7=日）
const DAY_LABELS = { 1:'月', 2:'火', 3:'水', 4:'木', 5:'金', 6:'土', 7:'日' }

/**
 * dayjs の曜日番号（0=日〜6=土）をアプリの曜日番号（1=月〜7=日）に変換する
 * @param {number} jsDay
 * @returns {number}
 */
export function jsWeekdayToAppDay(jsDay) {
  return jsDay === 0 ? 7 : jsDay
}

/**
 * 今日のアプリ曜日番号を返す
 * @returns {number}
 */
export function todayAppDay() {
  return jsWeekdayToAppDay(dayjs().day())
}

/**
 * 今日の日付 + スケジュール時刻 から scheduled_at (ISO文字列) を生成する
 * @param {string} time - "HH:MM" or "HH:MM:SS"
 * @returns {string} ISO文字列
 */
export function buildScheduledAt(time) {
  const today = dayjs().format('YYYY-MM-DD')
  return dayjs(`${today}T${time.slice(0, 5)}`).toISOString()
}

/**
 * scheduled_at から40分以上経過しているか判定する
 * @param {string} scheduledAt - ISO文字列
 * @returns {boolean}
 */
export function isOver40Min(scheduledAt) {
  return dayjs().diff(dayjs(scheduledAt), 'minute') >= 40
}

/**
 * 今日の開始・終了タイムスタンプを返す（ログ検索用）
 * @returns {{ start: string, end: string }}
 */
export function todayRange() {
  return {
    start: dayjs().startOf('day').toISOString(),
    end:   dayjs().endOf('day').toISOString(),
  }
}

/**
 * 日付を「4月5日 土曜日」形式にフォーマットする
 * @param {dayjs.Dayjs} [date]
 * @returns {string}
 */
export function formatDateJa(date = dayjs()) {
  return date.format('M月D日 dddd')
}

/**
 * 時刻文字列（HH:MM:SS）を HH:MM に短縮する
 * @param {string} time
 * @returns {string}
 */
export function formatTime(time) {
  return time ? time.slice(0, 5) : ''
}

/**
 * 曜日配列を表示文字列に変換する
 * @param {number[]} days
 * @returns {string}
 */
export function formatDays(days) {
  if (!days || days.length === 0) return ''
  if (days.length === 7) return '毎日'
  return days.map(d => DAY_LABELS[d]).join('・')
}
