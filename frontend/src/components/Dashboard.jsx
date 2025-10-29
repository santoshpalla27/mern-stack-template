import { useState, useEffect } from 'react';
import { fetchDetailedStatus } from '../services/api';

const Dashboard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    
    const result = await fetchDetailedStatus();
    
    if (result.success) {
      setStatus(result.data);
      setLastUpdate(new Date());
      setError(null);
    } else {
      setError(result.error);
      setStatus(null);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const StatusBadge = ({ connected, label }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className={`font-semibold ${connected ? 'text-green-700' : 'text-red-700'}`}>
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );

  const ServiceCard = ({ title, service, icon }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <span className="text-2xl mr-2">{icon}</span>
          {title}
        </h3>
        <StatusBadge connected={service?.connected} />
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span className="text-gray-900 font-medium">{service?.message || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Last Checked:</span>
          <span className="text-gray-900">{service?.lastChecked ? new Date(service.lastChecked).toLocaleTimeString() : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Configuration:</span>
          <span className="text-gray-900">{service?.uri || 'N/A'}</span>
        </div>
      </div>
    </div>
  );

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <span className="text-6xl">⚠️</span>
            <h2 className="mt-4 text-2xl font-bold text-red-600">Backend Unreachable</h2>
            <p className="mt-2 text-gray-600">{error}</p>
            <button
              onClick={fetchStatus}
              className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                <span className="text-4xl mr-3">🚀</span>
                MERN DevOps Demo
              </h1>
              <p className="text-gray-600 mt-1">Infrastructure Connectivity Monitor</p>
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span>{loading ? '🔄' : '🔃'}</span>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
          
          {lastUpdate && (
            <div className="mt-4 text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleString()}
            </div>
          )}
        </div>

        {/* Application Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="text-2xl mr-2">📊</span>
            Application Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
              <p className="text-sm text-gray-600">Application</p>
              <p className="text-lg font-semibold text-gray-900">{status?.application?.name}</p>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
              <p className="text-sm text-gray-600">Version</p>
              <p className="text-lg font-semibold text-gray-900">{status?.application?.version}</p>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
              <p className="text-sm text-gray-600">Environment</p>
              <p className="text-lg font-semibold text-gray-900 uppercase">{status?.application?.environment}</p>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="text-2xl mr-2">⏱️</span>
            System Uptime
          </h2>
          <div className="bg-gradient-to-r from-indigo-50 to-purple-100 rounded-lg p-6">
            <p className="text-3xl font-bold text-indigo-600 text-center">
              {status?.uptime?.formatted}
            </p>
            <p className="text-center text-gray-600 mt-2">
              {status?.uptime?.seconds?.toLocaleString()} seconds
            </p>
          </div>
        </div>

        {/* Services Status */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="text-2xl mr-2">🔌</span>
            Services Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ServiceCard
              title="MongoDB"
              service={status?.services?.mongodb}
              icon="🍃"
            />
            <ServiceCard
              title="Redis"
              service={status?.services?.redis}
              icon="📦"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-lg shadow-md p-4 text-center text-sm text-gray-600">
          <p>
            Purpose: DevOps Infrastructure Testing & Connectivity Monitoring
          </p>
          <p className="mt-1">
            Timestamp: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;