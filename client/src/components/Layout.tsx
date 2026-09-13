import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { LayoutDashboard, LogOut, User, Wifi, WifiOff } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <LayoutDashboard className="h-6 w-6 text-primary-600" />
                <span className="text-xl font-bold text-gray-900">Developer Dashboard</span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-gray-600">Disconnected</span>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">{user?.name}</span>
                {user?.role === 'admin' && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary-100 text-primary-800">
                    Admin
                  </span>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
