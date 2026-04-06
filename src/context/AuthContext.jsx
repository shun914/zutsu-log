import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

/**
 * 認証状態をアプリ全体で共有するプロバイダー
 */
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true) // 初回セッション確認中

  useEffect(() => {
    // 初回：現在のセッションを確認する
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 以降：ログイン・ログアウトの変化を監視する
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  /** メール+パスワードでログイン */
  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  /** メール+パスワードでサインアップ */
  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password })

  /** ログアウト */
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * 認証情報を取得するカスタムフック
 * @returns {{ user: object|null, loading: boolean, signIn: function, signUp: function, signOut: function }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth は AuthProvider の内側で使用してください')
  return ctx
}
