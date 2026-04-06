import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * 認証済みユーザーのみ通過させるレイアウトルート
 * 未認証の場合は /login にリダイレクトする
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  // 初回セッション確認中はローディング画面を表示
  if (loading) {
    return (
      <div className="min-h-screen bg-primary-pale flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* スケルトン風のローディング表示 */}
          <div className="w-16 h-16 rounded-full bg-primary-light animate-pulse" />
          <div className="h-4 w-24 rounded-full bg-primary-light animate-pulse" />
        </div>
      </div>
    )
  }

  // 未認証 → ログイン画面へ
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 認証済み → 子ルートを描画
  return <Outlet />
}
