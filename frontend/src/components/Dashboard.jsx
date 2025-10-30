import { useState, useEffect } from 'react';
import { fetchDetailedStatus, fetchArchitecture } from '../services/api';
import ArchitectureDiagram from './ArchitectureDiagram';

const Dashboard = () => {
  const [status, setStatus] = useState(null);
  const [architecture, setArchitecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    const [statusResult, archResult] = await Promise.all([
      fetchDetailedStatus(),
      fetchArchitecture()
    ]);
    
    if (statusResult.success) {
      setStatus(statusResult.data);
      setLastUpdate(new Date());
      setError(null);
      
      // Track connection history
      setConnectionHistory(prev => {
        const newEntry = {
          timestamp: new Date().toISOString(),
          backend: true,
          mongodb: statusResult.data.services?.mongodb?.connected || false,
          redis: statusResult.data.services?.redis?.connected || false
        };
        return [...prev.slice(-20), newEntry]; // Keep last 20 entries
      });
    } else {
      setError(statusResult.error);
      setStatus(null);
      
      // Track disconnection
      setConnectionHistory(prev => {
        const newEntry = {
          timestamp: new Date().toISOString(),
          backend: false,
          mongodb: false,
          redis: false,
          error: true
        };
        return [...prev.slice(-20), newEntry];
      });
    }

    if (archResult.success) {
      setArchitecture(archResult.data);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const StatusBadge = ({ connected, label }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className={`font-semibold ${connected ? 'text-green-700' : 'text-red-700'}`}>
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );

  const TopologyBadge = ({ topology }) => {
    if (!topology) return null;
    
    const colors = {
      standalone: 'bg-blue-100 text-blue-800',
      replicaSet: 'bg-purple-100 text-purple-800',
      sharded: 'bg-orange-100 text-orange-800',
      cluster: 'bg-indigo-100 text-indigo-800',
      replication: 'bg-pink-100 text-pink-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[topology] || 'bg-gray-100 text-gray-800'}`}>
        {topology.toUpperCase()}
      </span>
    );
  };

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
        
        {service?.connectionAttempts !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600">Attempts:</span>
            <span className="text-gray-900">{service.connectionAttempts || 0}</span>
          </div>
        )}

        {service?.port && (
          <div className="flex justify-between">
            <span className="text-gray-600">Port:</span>
            <span className="text-gray-900">{service.port}</span>
          </div>
        )}

        {service?.lastError && (
          <div className="text-sm text-red-600">
            Error: {service.lastError}
          </div>
        )}

        {service?.readyState !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600">Ready State:</span>
            <span className="text-gray-900">{service.readyStateLabel || service.readyState || 'N/A'}</span>
          </div>
        )}

        {service?.architecture && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Architecture:</span>
              <span><TopologyBadge topology={service.architecture.topology || service.architecture.mode} /></span>
            </div>
            
            {service.architecture.replicaSet && (
              <div className="text-sm">
                Replica Set: <span className="font-medium">{service.architecture.replicaSet}</span>
              </div>
            )}

            {service.architecture.role && (
              <div className="text-sm">
                Role: <span className="font-medium">{service.architecture.role}</span>
              </div>
            )}

            {service.architecture.nodes && service.architecture.nodes.length > 0 && (
              <div className="mt-2">
                <span className="text-gray-600 text-sm">Nodes:</span>
                <div className="mt-1 space-y-1">
                  {service.architecture.nodes.map((node, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-700">
                        {node.host || node.address}
                      </span>
                      <span className="font-medium">
                        {node.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {service.architecture.clusterNodes && service.architecture.clusterNodes.length > 0 && (
              <div className="mt-2">
                <span className="text-gray-600 text-sm">Cluster Nodes:</span>
                <div className="mt-1 space-y-1">
                  {service.architecture.clusterNodes.map((node, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-700">
                        {node.address}
                      </span>
                      <span className="font-medium">
                        {node.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {service?.ping && (
          <div className="mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Ping:</span>
              <span className={`font-medium ${service.ping.success ? 'text-green-600' : 'text-red-600'}`}>
                {service.ping.success ? `${service.ping.latency}ms` : 'Failed'}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-600">Last Checked:</span>
          <span className="text-gray-900">
            {service?.lastChecked ? new Date(service.lastChecked).toLocaleTimeString() : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );

  const ConnectionHistoryChart = () => {
    if (connectionHistory.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="text-2xl mr-2">📊</span>
            Connection History
          </h3>
          <div className="text-center py-8">
            <p className="text-gray-600">No connection history data yet.</p>
            <p className="text-sm text-gray-500">Data will appear after the first status check.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="text-2xl mr-2">📊</span>
          Connection History (Last {connectionHistory.length} checks)
        </h3>
        
        <div className="flex items-end justify-between h-32 mb-4 border-b border-l border-gray-200 pb-2 pl-2 relative">
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-6">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <div className="flex items-end space-x-1 h-32 flex-grow">
            {connectionHistory.map((entry, idx) => {
              const backendHeight = entry.backend ? 'h-full' : 'h-2';
              const mongoHeight = entry.mongodb ? 'h-full' : 'h-2';
              const redisHeight = entry.redis ? 'h-full' : 'h-2';
              
              return (
                <div key={idx} className="flex items-end space-x-0.5 w-4">
                  <div
                    className={`w-2 ${entry.backend ? 'bg-blue-500' : 'bg-gray-300'} rounded-t hover:opacity-75 transition-opacity ${
                      backendHeight.includes('full') ? 'h-full' : 'h-2'
                    }`}
                    style={{ height: entry.backend ? '100%' : '10%' }}
                    title={`Backend: ${entry.backend ? 'Connected' : 'Disconnected'} at ${new Date(entry.timestamp).toLocaleTimeString()}`}
                  />
                  <div
                    className={`w-2 ${entry.mongodb ? 'bg-green-500' : 'bg-gray-300'} rounded-t hover:opacity-75 transition-opacity ${
                      mongoHeight.includes('full') ? 'h-full' : 'h-2'
                    }`}
                    style={{ height: entry.mongodb ? '100%' : '10%' }}
                    title={`MongoDB: ${entry.mongodb ? 'Connected' : 'Disconnected'} at ${new Date(entry.timestamp).toLocaleTimeString()}`}
                  />
                  <div
                    className={`w-2 ${entry.redis ? 'bg-red-500' : 'bg-gray-300'} rounded-t hover:opacity-75 transition-opacity ${
                      redisHeight.includes('full') ? 'h-full' : 'h-2'
                    }`}
                    style={{ height: entry.redis ? '100%' : '10%' }}
                    title={`Redis: ${entry.redis ? 'Connected' : 'Disconnected'} at ${new Date(entry.timestamp).toLocaleTimeString()}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-600 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 mr-1"></div>
              <span>Backend</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 mr-1"></div>
              <span>MongoDB</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 mr-1"></div>
              <span>Redis</span>
            </div>
          </div>
          <span>{connectionHistory.length} samples</span>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600">Backend Uptime</p>
            <p className="text-lg font-bold text-blue-600">
              {((connectionHistory.filter(e => e.backend).length / connectionHistory.length) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600">MongoDB Uptime</p>
            <p className="text-lg font-bold text-green-600">
              {((connectionHistory.filter(e => e.mongodb).length / connectionHistory.length) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600">Redis Uptime</p>
            <p className="text-lg font-bold text-red-600">
              {((connectionHistory.filter(e => e.redis).length / connectionHistory.length) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading status...</p>
          <p className="text-sm text-gray-500">Initializing connections with retry logic...</p>
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
            <div className="mt-4 text-left text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <p>Connection attempts made with:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Exponential backoff retry (3 attempts)</li>
                <li>10-second timeout per request</li>
                <li>Network error handling</li>
              </ul>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
            >
              {loading ? 'Retrying...' : 'Retry Connection'}
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
              <p className="text-gray-600 mt-1">Infrastructure Connectivity Monitor v2.0</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600"
                />
                <label className="text-sm text-gray-700">
                  Auto-refresh
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="ml-2 text-sm border-gray-300 rounded"
                  disabled={!autoRefresh}
                >
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>60s</option>
                </select>
              </div>
              
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>{loading ? '🔄' : '🔃'}</span>
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
          
          {lastUpdate && (
            <div className="mt-4 flex justify-between text-sm text-gray-500">
              <span>
                Last updated: {lastUpdate.toLocaleString()}
              </span>
              <span>
                Next refresh in: {autoRefresh ? `${refreshInterval / 1000}s` : 'Manual'}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b border-gray-200">
            {['overview', 'architecture', 'monitoring'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Application Info */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">📊</span>
                Application Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Node Version</p>
                  <p className="text-lg font-semibold text-gray-900">{status?.application?.nodeVersion}</p>
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">⏱️</span>
                System Uptime & Memory
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-100 rounded-lg p-6 text-center">
                  <p>Application Uptime</p>
                  <p className="text-3xl font-bold text-indigo-600">
                    {status?.uptime?.formatted}
                  </p>
                  <p className="text-gray-600 mt-2">
                    {status?.uptime?.seconds?.toLocaleString()} seconds
                  </p>
                </div>
                <div className="bg-gradient-to-r from-cyan-50 to-blue-100 rounded-lg p-6">
                  <p className="font-semibold text-gray-800 mb-3">Memory Usage</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Heap Used:</span>
                      <span className="text-gray-900">{status?.memory?.heapUsed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Heap Total:</span>
                      <span className="text-gray-900">{status?.memory?.heapTotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">RSS:</span>
                      <span className="text-gray-900">{status?.memory?.rss}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Services Status */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🔌</span>
                Services Status
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ServiceCard
                  title="Backend"
                  service={status?.services?.backend}
                  icon="⚙️"
                />
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
          </>
        )}

        {/* Architecture Tab */}
        {activeTab === 'architecture' && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🏗️</span>
                System Architecture
              </h2>
              <ArchitectureDiagram architecture={architecture} status={status} />
            </div>

            {architecture && (
              <>
                {/* Components */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Components</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {architecture.components.map((component) => (
                      <div key={component.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-800">{component.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            component.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {component.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{component.description}</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Technology:</span>
                            <span className="text-gray-800">{component.technology}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Port:</span>
                            <span className="text-gray-800">{component.port}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Type:</span>
                            <span className="text-gray-800">{component.type}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deployment Info */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Deployment Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Platform</p>
                      <p className="text-lg font-semibold text-gray-900">{architecture.deployment.platform}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Orchestration</p>
                      <p className="text-lg font-semibold text-gray-900">{architecture.deployment.orchestration}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Environment</p>
                      <p className="text-lg font-semibold text-gray-900">{architecture.deployment.environment}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Monitoring Tab */}
        {activeTab === 'monitoring' && (
          <>
            <ConnectionHistoryChart />
            
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🔍</span>
                Connection Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Backend Details */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">⚙️</span>
                    Backend Connection
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="text-gray-900">{status?.services?.backend?.message || 'Running'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Port:</span>
                      <span className="text-gray-900">{status?.services?.backend?.port || 5000}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime:</span>
                      <span className="text-gray-900">{status?.services?.backend?.uptime || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* MongoDB Details */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">🍃</span>
                    MongoDB Connection
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ready State:</span>
                      <span className="text-gray-900">{status?.services?.mongodb?.readyStateLabel || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Attempts:</span>
                      <span className="text-gray-900">{status?.services?.mongodb?.connectionAttempts || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Topology:</span>
                      <span className="text-gray-900">{status?.services?.mongodb?.architecture?.topology || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Redis Details */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">📦</span>
                    Redis Connection
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="text-gray-900">{status?.services?.redis?.message || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Attempts:</span>
                      <span className="text-gray-900">{status?.services?.redis?.connectionAttempts || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mode:</span>
                      <span className="text-gray-900">{status?.services?.redis?.architecture?.mode || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="bg-white rounded-lg shadow-md p-4 text-center text-sm text-gray-600">
          <p className="mb-1">
            🛠️ Purpose: DevOps Infrastructure Testing & Connectivity Monitoring with Production-Grade Retry Logic
          </p>
          <p className="mb-1">
            ⚡ Features: Exponential Backoff • Graceful Reconnection • Architecture Detection • Real-time Monitoring
          </p>
          <p>
            Timestamp: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;