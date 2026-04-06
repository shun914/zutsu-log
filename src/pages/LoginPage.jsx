import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('メールアドレスとパスワードを入力してください')
      return
    }

    setLoading(true)
    setError(null)

    const { error: signInError } = await signIn(email.trim(), password)

    if (signInError) {
      // Supabaseのエラーメッセージを日本語に変換
      if (signInError.message.includes('Invalid login credentials')) {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else if (signInError.message.includes('Email not confirmed')) {
        setError('メールアドレスの確認が完了していません。届いたメールのリンクをクリックしてください')
      } else {
        setError('ログインに失敗しました。もう一度お試しください')
      }
      setLoading(false)
      return
    }

    // ログイン成功 → ホームへ
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-primary-pale flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] flex flex-col gap-6">

        {/* ロゴ・タイトル */}
        <div className="text-center flex flex-col gap-1">
          <p className="text-5xl">💊</p>
          <h1 className="text-2xl font-bold text-[#2c3e50] mt-2">頭痛ログ</h1>
          <p className="text-sm text-[#7f9aaa]">服薬管理アプリ</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-white border border-primary-light rounded-3xl p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#2c3e50]">ログイン</h2>

          {/* エラー */}
          {error && (
            <div className="bg-[#fdeaea] border border-[#e07070] text-[#c0392b]
                            rounded-2xl px-4 py-3 text-sm leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* メールアドレス */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#7f9aaa] font-medium">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-light
                           text-[#2c3e50] placeholder:text-[#b0bec5]"
              />
            </div>

            {/* パスワード */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#7f9aaa] font-medium">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-light
                           text-[#2c3e50] placeholder:text-[#b0bec5]"
              />
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full h-14 rounded-2xl font-bold text-base text-white
                          transition-colors duration-150 mt-1
                          ${loading
                            ? 'bg-[#b0bec5] cursor-not-allowed'
                            : 'bg-primary active:bg-primary-dark'
                          }`}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>

        {/* サインアップへのリンク */}
        <p className="text-sm text-[#7f9aaa] text-center">
          アカウントをお持ちでない方は
          <Link to="/signup" className="text-primary font-medium ml-1 underline">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  )
}
