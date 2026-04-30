import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { 
  Activity, 
  ImageIcon, 
  Target, 
  CheckCircle2,
  Upload,
  BookOpen,
  FileText,
  Clock,
  RefreshCw,
  CalendarDays,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const pageVariants = { initial: { opacity: 0, y: 15 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -15 }};
const cardVariants = { initial: { opacity: 0, scale: 0.95 }, in: { opacity: 1, scale: 1 }};
const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444'];

const recentActivity = [
  { id: 1, type: 'prediction', text: 'Cavity detected in Patient A scan', time: '10 mins ago', status: 'positive' },
  { id: 2, type: 'upload', text: 'Batch of 5 X-Rays uploaded', time: '1 hour ago', status: 'neutral' },
  { id: 3, type: 'prediction', text: 'No cavity detected in Patient B scan', time: '3 hours ago', status: 'negative' },
  { id: 4, type: 'model', text: 'Model weights updated to v1.2', time: '1 day ago', status: 'info' },
];

const AnimatedCounter = ({ value, suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseFloat(value);
    if (isNaN(end)) {
      setDisplayValue(value);
      return;
    }
    const duration = 1000;
    const incrementTime = 30;
    const step = end / (duration / incrementTime);
    
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value]);

  const isFloat = !Number.isInteger(parseFloat(value));
  return <span>{isFloat ? displayValue.toFixed(1) : Math.floor(displayValue)}{suffix}</span>;
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const [statsRes, chartsRes] = await Promise.all([
        fetch('http://localhost:8000/api/dashboard/stats'),
        fetch('http://localhost:8000/api/dashboard/charts')
      ]);
      const statsData = await statsRes.json();
      const chartsData = await chartsRes.json();
      setStats(statsData);
      setCharts(chartsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
        <div className="w-16 h-6 bg-slate-200 rounded-md"></div>
      </div>
      <div className="w-24 h-4 bg-slate-200 rounded mb-2"></div>
      <div className="w-16 h-8 bg-slate-200 rounded"></div>
    </div>
  );

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
          <p className="text-slate-500 mt-1">DentalVision AI performance and real-time analytics.</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={fetchData}
            disabled={isLoading || isRefreshing}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <NavLink to="/cavity-detection" className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center shadow-sm shadow-sky-200">
            <Upload className="w-4 h-4 mr-2" />
            New Scan
          </NavLink>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <motion.div variants={cardVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white to-sky-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-sky-100/50 text-sky-600 rounded-xl">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Total Predictions</h3>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                <AnimatedCounter value={stats?.total_predictions || 0} />
              </p>
            </motion.div>

            <motion.div variants={cardVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white to-indigo-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-100/50 text-indigo-600 rounded-xl">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-indigo-500 text-xs font-medium bg-indigo-50 px-2 py-1 rounded-md">Today</span>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Images Processed</h3>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                <AnimatedCounter value={stats?.today_processed || 0} />
              </p>
            </motion.div>

            <motion.div variants={cardVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white to-violet-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-violet-100/50 text-violet-600 rounded-xl">
                  <Target className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Avg Confidence</h3>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                <AnimatedCounter value={stats?.average_confidence || 0} suffix="%" />
              </p>
            </motion.div>

            <motion.div variants={cardVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white to-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-100/50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Success Rate</h3>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                <AnimatedCounter value={stats?.success_rate || 0} suffix="%" />
              </p>
            </motion.div>
          </>
        )}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <motion.div variants={cardVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all flex items-center">
              <div className="p-3 bg-amber-100/50 text-amber-600 rounded-xl mr-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-500 text-sm font-medium">Total Cavities Detected</h3>
                <p className="text-2xl font-bold text-slate-800 mt-1"><AnimatedCounter value={stats?.total_cavities || 0} /></p>
              </div>
            </motion.div>

            <motion.div variants={cardVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all flex items-center">
              <div className="p-3 bg-sky-100/50 text-sky-600 rounded-xl mr-4">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-500 text-sm font-medium">This Week Predictions</h3>
                <p className="text-2xl font-bold text-slate-800 mt-1"><AnimatedCounter value={stats?.week_predictions || 0} /></p>
              </div>
            </motion.div>

            <motion.div variants={cardVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all flex items-center">
              <div className="p-3 bg-indigo-100/50 text-indigo-600 rounded-xl mr-4">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-500 text-sm font-medium">This Month Predictions</h3>
                <p className="text-2xl font-bold text-slate-800 mt-1"><AnimatedCounter value={stats?.month_predictions || 0} /></p>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Main Content Grid : Charts & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Charts Section (Takes 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Predictions Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Weekly Predictions</h3>
                <p className="text-sm text-slate-500">Number of scans analyzed over the last 7 days</p>
              </div>
            </div>
            <div className="h-72 w-full">
              {isLoading ? (
                <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl"></div>
              ) : charts?.weekly_trend?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.weekly_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPredictions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="predictions" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorPredictions)" activeDot={{r: 6, strokeWidth: 0, fill: '#0284c7'}} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Confidence Score Trends */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800">Confidence Trend</h3>
                <p className="text-sm text-slate-500">Average model confidence (last 7 days)</p>
              </div>
              <div className="h-64 w-full">
                {isLoading ? (
                  <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl"></div>
                ) : charts?.confidence_trend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.confidence_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <RechartsTooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="avgConfidence" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
                )}
              </div>
            </div>

            {/* Cavities Distribution */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-800">Cavities Distribution</h3>
                <p className="text-sm text-slate-500">Total historical distribution</p>
              </div>
              <div className="h-64 w-full relative">
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-48 h-48 rounded-full border-8 border-slate-100 animate-pulse"></div>
                  </div>
                ) : charts?.cavities_distribution?.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.cavities_distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.cavities_distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
                )}
              </div>
            </div>
          </div>
          
          {/* Monthly Activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-800">Monthly Activity</h3>
              <p className="text-sm text-slate-500">Daily predictions for the current month</p>
            </div>
            <div className="h-64 w-full">
              {isLoading ? (
                <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl"></div>
              ) : charts?.monthly_activity?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.monthly_activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <RechartsTooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="predictions" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side Stack: Quick Actions & Recent Activity (Takes 1 Column) */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <NavLink to="/cavity-detection" className="flex items-center p-3 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors group">
                <div className="bg-sky-100 text-sky-600 p-2 rounded-lg mr-4 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Upload New Scan</h4>
                  <p className="text-xs text-slate-500">Run model inference</p>
                </div>
              </NavLink>
              
              <NavLink to="/learning-lab" className="flex items-center p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group">
                <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-4 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Open CV Lab</h4>
                  <p className="text-xs text-slate-500">View pipeline internals</p>
                </div>
              </NavLink>

              <NavLink to="/reports" className="flex items-center p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors group">
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg mr-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">View Reports</h4>
                  <p className="text-xs text-slate-500">Check historical data</p>
                </div>
              </NavLink>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-800">Recent System Logs</h3>
            </div>
            <div className="space-y-5">
              {recentActivity.map((activity, idx) => (
                <div key={activity.id} className="relative flex gap-4">
                  {/* Timeline connecting line */}
                  {idx !== recentActivity.length - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-[-16px] w-[2px] bg-slate-100"></div>
                  )}
                  
                  <div className="relative mt-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10
                      ${activity.status === 'positive' ? 'bg-amber-100 text-amber-500' : 
                        activity.status === 'negative' ? 'bg-emerald-100 text-emerald-500' : 
                        activity.status === 'info' ? 'bg-violet-100 text-violet-500' : 'bg-sky-100 text-sky-500'}`}>
                      <div className={`w-2 h-2 rounded-full 
                      ${activity.status === 'positive' ? 'bg-amber-500' : 
                        activity.status === 'negative' ? 'bg-emerald-500' : 
                        activity.status === 'info' ? 'bg-violet-500' : 'bg-sky-500'}`}></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 leading-tight">{activity.text}</p>
                    <div className="flex items-center text-xs text-slate-400 mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {activity.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
