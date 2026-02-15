import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useIsMobile } from './hooks/useMediaQuery';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PredictionDetail from './pages/PredictionDetail';
import CreatePrediction from './pages/CreatePrediction';
import Clans from './pages/Clans';
import ClanDetail from './pages/ClanDetail';
import Challenges from './pages/Challenges';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Transactions from './pages/Transactions';

export default function App() {
  const { initialize, isLoading } = useAuthStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0B1120',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 56, color: '#FFD60A', letterSpacing: 3 }}>
            PlotTwist
          </h1>
          <div style={{
            margin: '16px auto 0', width: 40, height: 40,
            border: '4px solid #FFD60A', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
          }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{
        minHeight: '100vh',
        paddingTop: isMobile ? 52 : 60,
        paddingBottom: isMobile ? 72 : 0,
        background: '#0B1120',
      }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/prediction/:id" element={<PredictionDetail />} />
          <Route path="/create" element={<CreatePrediction />} />
          <Route path="/clans" element={<Clans />} />
          <Route path="/clan/:id" element={<ClanDetail />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </>
  );
}
