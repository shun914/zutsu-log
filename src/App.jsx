import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ui/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import MedicinesPage from './pages/MedicinesPage'
import MedicineNewPage from './pages/MedicineNewPage'
import MedicineEditPage from './pages/MedicineEditPage'
import DiaryPage from './pages/DiaryPage'
import DiaryReportPage from './pages/DiaryReportPage'
import CalendarPage from './pages/CalendarPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 未認証でもアクセス可能なルート */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* 認証済みのみアクセス可能なルート（ProtectedRoute でラップ） */}
          <Route element={<ProtectedRoute />}>
            <Route path="/"                   element={<HomePage />} />
            <Route path="/calendar"           element={<CalendarPage />} />
            <Route path="/medicines"          element={<MedicinesPage />} />
            <Route path="/medicines/new"      element={<MedicineNewPage />} />
            <Route path="/medicines/:id/edit" element={<MedicineEditPage />} />
            <Route path="/diary"              element={<DiaryPage />} />
            <Route path="/diary/report"       element={<DiaryReportPage />} />
            <Route path="/settings"           element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
