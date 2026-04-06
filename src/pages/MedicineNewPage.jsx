import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ScheduleEditor from '../components/features/ScheduleEditor'

/**
 * 新しいスケジュールのデフォルト値を生成する
 * @returns {object}
 */
function createDefaultSchedule() {
  return {
    // 一時的なローカルID（React key用）
    _key: crypto.randomUUID(),
    label: '朝',
    time: '08:00',
    days: [1, 2, 3, 4, 5, 6, 7],
  }
}

export default function MedicineNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // フォームの状態
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [note, setNote] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [schedules, setSchedules] = useState([createDefaultSchedule()])

  // UI状態
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // 写真選択
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // スケジュール変更
  const handleScheduleChange = (index, updated) => {
    setSchedules(prev => prev.map((s, i) => i === index ? updated : s))
  }

  // スケジュール追加
  const addSchedule = () => {
    setSchedules(prev => [...prev, createDefaultSchedule()])
  }

  // スケジュール削除
  const removeSchedule = (index) => {
    setSchedules(prev => prev.filter((_, i) => i !== index))
  }

  // バリデーション
  const validate = () => {
    if (!name.trim()) return '薬の名前を入力してください'
    for (const s of schedules) {
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
      // 1. 写真をStorageにアップロード（ある場合）
      let photoUrl = null
      if (photoFile) {
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
      }

      // 2. medicines テーブルに挿入
      const { data: medicine, error: medicineError } = await supabase
        .from('medicines')
        .insert({
          user_id:   user.id,
          name:      name.trim(),
          dose:      dose.trim() || null,
          note:      note.trim() || null,
          photo_url: photoUrl,
        })
        .select()
        .single()

      if (medicineError) throw medicineError

      // 3. schedules テーブルに挿入（複数）
      const scheduleInserts = schedules.map(s => ({
        user_id:     user.id,
        medicine_id: medicine.id,
        label:       s.label.trim(),
        time:        s.time,
        days:        s.days,
      }))

      const { error: scheduleError } = await supabase
        .from('schedules')
        .insert(scheduleInserts)

      if (scheduleError) throw scheduleError

      // 保存成功 → 薬一覧へ戻る
      navigate('/medicines')

    } catch (err) {
      console.error('保存エラー:', err)
      setError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

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
          <h1 className="text-lg font-bold text-[#2c3e50]">薬を追加する</h1>
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
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
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
              📷 カメラ撮影 / ファイル選択
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

          {schedules.map((schedule, index) => (
            <ScheduleEditor
              key={schedule._key}
              schedule={schedule}
              onChange={(updated) => handleScheduleChange(index, updated)}
              onRemove={() => removeSchedule(index)}
              showRemove={schedules.length > 1}
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

        {/* QRスキャンボタン */}
        <button
          type="button"
          onClick={() => navigate('/medicines/qr')}
          className="w-full h-12 rounded-2xl border border-primary bg-white text-primary
                     font-medium text-base active:bg-primary-pale transition-colors duration-150"
        >
          📷 QRコードで読み取る
        </button>

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
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}
