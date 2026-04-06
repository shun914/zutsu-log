import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ScheduleEditor from '../components/features/ScheduleEditor'

/**
 * 新しいスケジュールのデフォルト値を生成する（ローカル追加用）
 * @returns {object}
 */
function createDefaultSchedule() {
  return {
    _key: crypto.randomUUID(),
    id: null, // DBに未保存のものはnull
    label: '朝',
    time: '08:00',
    days: [1, 2, 3, 4, 5, 6, 7],
    _deleted: false,
  }
}

/**
 * DBから取得したスケジュールをローカル形式に変換する
 * @param {object} s
 * @returns {object}
 */
function toLocalSchedule(s) {
  return {
    _key: s.id, // DBのIDをkeyとして使う
    id: s.id,
    label: s.label,
    time: s.time,
    days: s.days,
    _deleted: false,
  }
}

export default function MedicineEditPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  // フォームの状態
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [note, setNote] = useState('')
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null) // DB保存済みの写真URL
  const [photoFile, setPhotoFile] = useState(null)               // 新しく選んだ写真ファイル
  const [photoPreview, setPhotoPreview] = useState(null)         // プレビュー表示用

  // スケジュール（_deleted=true のものは保存時にis_active=falseにする）
  const [schedules, setSchedules] = useState([])

  // UI状態
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 既存データの読み込み
  useEffect(() => {
    const fetchMedicine = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('medicines')
          .select('*, schedules(*)')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError
        if (!data) throw new Error('薬が見つかりませんでした')

        setName(data.name)
        setDose(data.dose || '')
        setNote(data.note || '')
        setExistingPhotoUrl(data.photo_url || null)
        setPhotoPreview(data.photo_url || null)

        // is_active=true のスケジュールのみ表示
        const activeSchedules = (data.schedules || [])
          .filter(s => s.is_active)
          .map(toLocalSchedule)

        // スケジュールがない場合はデフォルトを1件追加
        setSchedules(activeSchedules.length > 0 ? activeSchedules : [createDefaultSchedule()])
      } catch (err) {
        console.error('薬データ取得エラー:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchMedicine()
  }, [id])

  // 写真選択
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // 写真を削除（プレビューをクリア）
  const handlePhotoClear = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setExistingPhotoUrl(null)
  }

  // スケジュール変更
  const handleScheduleChange = (key, updated) => {
    setSchedules(prev => prev.map(s => s._key === key ? updated : s))
  }

  // スケジュール削除（論理削除フラグ）
  const handleScheduleRemove = (key) => {
    setSchedules(prev => {
      const next = prev.map(s => s._key === key ? { ...s, _deleted: true } : s)
      // 表示中（_deleted=false）のスケジュールが0件になる場合は1件だけ残す
      const visible = next.filter(s => !s._deleted)
      return visible.length > 0 ? next : prev
    })
  }

  // スケジュール追加
  const addSchedule = () => {
    setSchedules(prev => [...prev, createDefaultSchedule()])
  }

  // バリデーション
  const validate = () => {
    if (!name.trim()) return '薬の名前を入力してください'
    const visibleSchedules = schedules.filter(s => !s._deleted)
    for (const s of visibleSchedules) {
      if (!s.label.trim()) return 'タイミング名を入力してください'
      if (!s.time) return '服用時刻を選択してください'
      if (s.days.length === 0) return '曜日を1日以上選択してください'
    }
    return null
  }

  // 保存処理
  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      // 1. 写真の処理
      let photoUrl = existingPhotoUrl // 既存URLを維持

      if (photoFile) {
        // 新しい写真をアップロード
        const ext = photoFile.name.split('.').pop()
        const filePath = `medicines/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('medicine-photos')
          .upload(filePath, photoFile)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('medicine-photos')
          .getPublicUrl(filePath)
        photoUrl = urlData.publicUrl
      } else if (existingPhotoUrl === null) {
        // 写真が削除された
        photoUrl = null
      }

      // 2. medicines テーブルを更新
      const { error: medicineError } = await supabase
        .from('medicines')
        .update({
          name: name.trim(),
          dose: dose.trim() || null,
          note: note.trim() || null,
          photo_url: photoUrl,
        })
        .eq('id', id)

      if (medicineError) throw medicineError

      // 3. スケジュールの処理
      const deletedSchedules = schedules.filter(s => s._deleted && s.id)
      const visibleSchedules = schedules.filter(s => !s._deleted)
      const existingSchedules = visibleSchedules.filter(s => s.id)
      const newSchedules = visibleSchedules.filter(s => !s.id)

      // 3a. 削除されたスケジュールをis_active=falseに更新
      if (deletedSchedules.length > 0) {
        const { error: deleteError } = await supabase
          .from('schedules')
          .update({ is_active: false })
          .in('id', deletedSchedules.map(s => s.id))

        if (deleteError) throw deleteError
      }

      // 3b. 既存スケジュールを更新
      for (const s of existingSchedules) {
        const { error: updateError } = await supabase
          .from('schedules')
          .update({
            label: s.label.trim(),
            time: s.time,
            days: s.days,
          })
          .eq('id', s.id)

        if (updateError) throw updateError
      }

      // 3c. 新しいスケジュールを挿入
      if (newSchedules.length > 0) {
        const inserts = newSchedules.map(s => ({
          user_id:     user.id,
          medicine_id: id,
          label:       s.label.trim(),
          time:        s.time,
          days:        s.days,
        }))
        const { error: insertError } = await supabase
          .from('schedules')
          .insert(inserts)

        if (insertError) throw insertError
      }

      // 保存成功 → 薬一覧へ戻る
      navigate('/medicines')

    } catch (err) {
      console.error('保存エラー:', err)
      setError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  // 薬を論理削除する（is_active=false）
  const handleDeactivate = async () => {
    setDeactivating(true)
    setError(null)
    try {
      const { error: deactivateError } = await supabase
        .from('medicines')
        .update({ is_active: false })
        .eq('id', id)

      if (deactivateError) throw deactivateError

      navigate('/medicines')
    } catch (err) {
      console.error('削除エラー:', err)
      setError('削除に失敗しました。もう一度お試しください。')
    } finally {
      setDeactivating(false)
      setShowDeleteConfirm(false)
    }
  }

  // ローディング中
  if (loading) {
    return (
      <div className="min-h-screen bg-primary-pale">
        <div className="bg-white border-b border-primary-light sticky top-0 z-10">
          <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center gap-3">
            <div className="w-6 h-6 bg-primary-light rounded-full animate-pulse" />
            <div className="h-5 bg-primary-light rounded-full w-32 animate-pulse" />
          </div>
        </div>
        <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-4">
          <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-4 animate-pulse">
            <div className="h-4 bg-primary-light rounded-full w-1/4" />
            <div className="h-12 bg-primary-light rounded-2xl" />
            <div className="h-12 bg-primary-light rounded-2xl" />
            <div className="h-24 bg-primary-light rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // 表示するスケジュール（削除フラグがないもの）
  const visibleSchedules = schedules.filter(s => !s._deleted)

  return (
    <div className="min-h-screen bg-primary-pale pb-8">
      {/* ヘッダー */}
      <div className="bg-white border-b border-primary-light sticky top-0 z-10">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-primary text-2xl leading-none"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-[#2c3e50]">薬を編集する</h1>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-4">

        {/* エラートースト */}
        {error && (
          <div className="bg-[#fdeaea] border border-[#e07070] text-[#c0392b] rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* 基本情報カード */}
        <div className="bg-white border border-primary-light rounded-3xl p-4 flex flex-col gap-4">
          <h2 className="font-bold text-[#2c3e50]">基本情報</h2>

          {/* 薬の名前 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#7f9aaa] font-medium">
              薬の名前 <span className="text-[#e07070]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例：ロキソプロフェン"
              className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-light
                         text-[#2c3e50] placeholder:text-[#b0bec5]"
            />
          </div>

          {/* 用量 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#7f9aaa] font-medium">用量</label>
            <input
              type="text"
              value={dose}
              onChange={e => setDose(e.target.value)}
              placeholder="例：1錠、60mg"
              className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-light
                         text-[#2c3e50] placeholder:text-[#b0bec5]"
            />
          </div>

          {/* メモ */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#7f9aaa] font-medium">メモ</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="例：白い丸錠・食後に服用"
              rows={3}
              className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-light
                         text-[#2c3e50] placeholder:text-[#b0bec5] resize-none"
            />
          </div>

          {/* 写真 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-[#7f9aaa] font-medium">写真</label>
            {photoPreview && (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="薬のプレビュー"
                  className="w-full max-h-48 object-cover rounded-2xl border border-primary-light"
                />
                <button
                  type="button"
                  onClick={handlePhotoClear}
                  className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center
                             text-[#7f9aaa] border border-primary-light text-sm shadow-sm"
                >
                  ✕
                </button>
              </div>
            )}
            <label
              className="flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed
                         border-primary-light bg-primary-pale text-primary text-sm font-medium cursor-pointer
                         active:bg-primary-light transition-colors duration-150"
            >
              📷 {photoPreview ? '写真を変更する' : 'カメラ撮影 / ファイル選択'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 服薬スケジュールカード */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold text-[#2c3e50]">服薬スケジュール</h2>
            <span className="text-sm text-[#7f9aaa]">複数追加できます</span>
          </div>

          {visibleSchedules.map((schedule) => (
            <ScheduleEditor
              key={schedule._key}
              schedule={schedule}
              onChange={(updated) => handleScheduleChange(schedule._key, updated)}
              onRemove={() => handleScheduleRemove(schedule._key)}
              showRemove={visibleSchedules.length > 1}
            />
          ))}

          {/* スケジュール追加ボタン */}
          <button
            type="button"
            onClick={addSchedule}
            className="w-full h-12 rounded-2xl border-2 border-dashed border-primary-light
                       bg-primary-pale text-primary text-sm font-medium
                       active:bg-primary-light transition-colors duration-150"
          >
            ＋ スケジュールを追加
          </button>
        </div>

        {/* 保存ボタン */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`w-full h-14 rounded-2xl font-bold text-base text-white shadow-sm
                      transition-colors duration-150
                      ${saving
                        ? 'bg-[#b0bec5] cursor-not-allowed'
                        : 'bg-primary active:bg-primary-dark'
                      }`}
        >
          {saving ? '保存中...' : '変更を保存する'}
        </button>

        {/* 削除ボタン */}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full h-12 rounded-2xl border border-[#e07070] bg-white text-[#e07070]
                     font-medium text-base active:bg-[#fdeaea] transition-colors duration-150"
        >
          この薬を削除する
        </button>

        <p className="text-xs text-[#b0bec5] text-center pb-2">
          削除すると薬一覧から非表示になります（服薬記録は残ります）
        </p>

      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-8">
          <div className="w-full max-w-[480px] bg-white rounded-3xl p-6 flex flex-col gap-4 shadow-lg">
            <h3 className="text-lg font-bold text-[#2c3e50] text-center">
              {name} を削除しますか？
            </h3>
            <p className="text-sm text-[#7f9aaa] text-center">
              削除すると薬一覧から非表示になります。<br />
              これまでの服薬記録は残ります。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deactivating}
                className="flex-1 h-12 rounded-2xl border border-primary-light bg-white text-[#7f9aaa]
                           font-medium active:bg-primary-pale transition-colors duration-150"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className={`flex-1 h-12 rounded-2xl font-medium text-white transition-colors duration-150
                            ${deactivating
                              ? 'bg-[#b0bec5] cursor-not-allowed'
                              : 'bg-[#e07070] active:bg-[#c0392b]'
                            }`}
              >
                {deactivating ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
