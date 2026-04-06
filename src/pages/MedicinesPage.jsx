import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import MedicineCard from '../components/features/MedicineCard'
import BottomNav from '../components/ui/BottomNav'

// ---- スケルトンUI ------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-white border border-primary-light rounded-3xl p-4 flex gap-3 animate-pulse">
      {/* サムネイル */}
      <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-primary-light" />
      {/* テキスト */}
      <div className="flex-1 flex flex-col gap-2 justify-center">
        <div className="h-4 bg-primary-light rounded-full w-2/3" />
        <div className="h-3 bg-primary-light rounded-full w-1/2" />
        <div className="h-5 bg-primary-light rounded-full w-1/3 mt-1" />
      </div>
    </div>
  )
}

// -----------------------------------------------------------------

export default function MedicinesPage() {
  const navigate = useNavigate()

  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 薬一覧をスケジュールごと取得する
  const fetchMedicines = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('medicines')
        .select('*, schedules(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setMedicines(data || [])
    } catch (err) {
      console.error('薬一覧取得エラー:', err)
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMedicines()
  }, [])

  return (
    <div className="min-h-screen bg-primary-pale pb-24">
      {/* ヘッダー */}
      <div className="bg-white border-b border-primary-light sticky top-0 z-10">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#2c3e50]">薬の管理</h1>
          <button
            type="button"
            onClick={() => navigate('/medicines/new')}
            className="h-10 px-4 rounded-2xl bg-primary text-white text-sm font-medium
                       active:bg-primary-dark transition-colors duration-150"
          >
            ＋ 追加
          </button>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 flex flex-col gap-3">

        {/* エラー表示 */}
        {error && (
          <div className="bg-[#fdeaea] border border-[#e07070] text-[#c0392b] rounded-2xl px-4 py-3 text-sm
                          flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchMedicines}
              className="text-primary underline text-sm ml-3 whitespace-nowrap"
            >
              再読み込み
            </button>
          </div>
        )}

        {/* ローディング：スケルトンUI */}
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* 薬カード一覧 */}
        {!loading && !error && medicines.length > 0 && (
          <>
            {/* 件数表示 */}
            <p className="text-sm text-[#7f9aaa] px-1">
              {medicines.length}件の薬が登録されています
            </p>
            {medicines.map(medicine => (
              <MedicineCard
                key={medicine.id}
                medicine={medicine}
                onClick={() => navigate(`/medicines/${medicine.id}/edit`)}
              />
            ))}
          </>
        )}

        {/* 空状態 */}
        {!loading && !error && medicines.length === 0 && (
          <div className="pt-16 text-center text-[#7f9aaa] flex flex-col items-center gap-3">
            <p className="text-5xl">💊</p>
            <p className="text-base font-medium">まだ薬が登録されていません</p>
            <p className="text-sm">右上の「＋ 追加」から登録してください</p>
            <button
              type="button"
              onClick={() => navigate('/medicines/new')}
              className="mt-2 h-12 px-8 rounded-2xl bg-primary text-white font-medium
                         active:bg-primary-dark transition-colors duration-150"
            >
              ＋ 最初の薬を追加する
            </button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
