import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [completed, setCompleted]   = useState(false) // メール送信完了状態

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email.trim() || !password || !confirm) {
      setError('すべての項目を入力してください')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await signUp(email.trim(), password)

    if (signUpError) {
      if (signUpError.message.includes('User already registered')) {
        setError('このメールアドレスはすでに登録されています')
      } else {
        setError('登録に失敗しました。もう一度お試しください')
      }
      setLoading(false)
      return
    }

    // Supabaseのメール確認が有効な場合は identities が空になる
    const needsConfirmation = data.user?.identities?.length === 0 ||
                              !data.session

    if (needsConfirmation) {
      // 確認メール送信済み → 案内を表示
      setCompleted(true)
    } else {
      // メール確認なしで即ログイン完了
      navigate('/', { replace: true })
    }

    setLoading(false)
  }

  // ---- メール確認待ち画面 ------------------------------------

  if (completed) {
    return (
      <div className="min-h-screen bg-primary-pale flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] bg-white border border-primary-light rounded-3xl p-8
                        flex flex-col items-center gap-4 text-center">
          <p className="text-5xl">📩</p>
          <h2 className="text-xl font-bold text-[#2c3e50]">確認メールを送信しました</h2>
          <p className="text-sm text-[#7f9aaa] leading-relaxed">
            <span className="font-medium text-[#2c3e50]">{email}</span> に<br />
            確認メールを送信しました。<br />
            メール内のリンクをクリックしてから<br />
            ログインしてください。
          </p>
          <Link
            to="/login"
            className="mt-2 w-full h-12 rounded-2xl bg-primary text-white font-bold
                       flex items-center justify-center active:bg-primary-dark
                       transition-colors duration-150"
          >
            ログイン画面へ
          </Link>
        </div>
      </div>
    )
  }

  // ---- サインアップフォーム ----------------------------------

  return (
    <div className="min-h-screen bg-primary-pale flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] flex flex-col gap-6">

        {/* タイトル */}
        <div className="text-center flex flex-col gap-1">
          <p className="text-5xl">💊</p>
          <h1 className="text-2xl font-bold text-[#2c3e50] mt-2">頭痛ログ</h1>
          <p className="text-sm text-[#7f9aaa]">新規アカウント登録</p>
        </div>

        {/* フォーム */}
        <div className="bg-white border border-primary-light rounded-3xl p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#2c3e50]">アカウントを作成</h2>

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
                <span className="text-[#b0bec5] font-normal ml-1">（6文字以上）</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-light
                           text-[#2c3e50] placeholder:text-[#b0bec5]"
              />
            </div>

            {/* パスワード確認 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#7f9aaa] font-medium">
                パスワード（確認）
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="もう一度入力してください"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-primary-light px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-light
                           text-[#2c3e50] placeholder:text-[#b0bec5]"
              />
            </div>

            {/* 登録ボタン */}
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
              {loading ? '登録中...' : 'アカウントを作成'}
            </button>
          </form>
        </div>

        {/* ログインへのリンク */}
        <p className="text-sm text-[#7f9aaa] text-center">
          すでにアカウントをお持ちの方は
          <Link to="/login" className="text-primary font-medium ml-1 underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
