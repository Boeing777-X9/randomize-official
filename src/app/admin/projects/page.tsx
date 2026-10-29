'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Search,
  Phone,
  Mail,
  BookOpen,
  Home,
  ExternalLink,
  X,
  Copy,
  CheckCircle2,
  RefreshCw,
  Download,
  FolderGit2,
  Cpu,
  Layers,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BuildApplication {
  id?: string | number;
  application_id: string;
  full_name: string;
  registration_number: string;
  outlook_email: string;
  personal_email: string;
  phone_number: string;
  role: string;
  preference_1: string;
  preference_2: string;
  tech_stack: string;
  github_link: string;
  why_project: string;
  created_at: string;
  // Optional merged directory fields
  randomize_id?: string;
  course?: string;
  accommodation?: string;
}

const PROJECT_OPTIONS = [
  'Campus Navigator',
  'Offline UPI',
  'GPS Tracker'
];

const ROLE_OPTIONS = [
  'Member',
  'JWT Tech',
  'JWT Editorial',
  'JWT Events & Operations',
  'JWT Social Media & Coverage',
  'JWT Finance & Registrations',
  'JWT Outreach',
  'JWT Graphic Design'
];

function formatTimestamp(dateStr?: string) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

export default function ProjectsFormAdminDashboard() {
  const router = useRouter();

  const [applications, setApplications] = useState<BuildApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedApp, setSelectedApp] = useState<BuildApplication | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchApplications = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      // 1. Try direct Supabase query first
      let appsData: any[] | null = null;
      const { data: directData, error: directError } = await supabase
        .from('build_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!directError && directData && directData.length > 0) {
        appsData = directData;
      } else {
        // 2. Fallback to server API route (uses service role key if configured)
        const res = await fetch('/api/build/submit');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            appsData = json.data;
          }
        } else if (directError) {
          throw directError;
        }
      }

      const rawApps = appsData || [];

      // 3. Enrich with directory data (randomize_id, course, accommodation) if available
      const regNumbers = Array.from(
        new Set(rawApps.map((a) => a.registration_number).filter(Boolean))
      );

      let dirData: any[] = [];
      if (regNumbers.length > 0) {
        const { data: fetchedDir } = await supabase
          .from('randomize_directory')
          .select('registration_number, randomize_id, course, accommodation')
          .in('registration_number', regNumbers);
        if (fetchedDir) dirData = fetchedDir;
      }

      const mergedData: BuildApplication[] = rawApps.map((app) => {
        const dirMatch =
          dirData.find(
            (d) =>
              String(d.registration_number).toUpperCase() ===
              String(app.registration_number).toUpperCase()
          ) || {};
        return {
          ...dirMatch,
          ...app
        };
      });

      setApplications(mergedData);
    } catch (err: any) {
      setError(err.message || 'Failed to load project applications.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const verifyAdminAndLoad = async () => {
      try {
        setAuthChecking(true);
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user || !user.email) {
          setIsAuthorizedAdmin(false);
          setAuthChecking(false);
          router.push('/admin');
          return;
        }

        const emailNormalized = user.email.trim().toLowerCase();
        setAdminEmail(emailNormalized);

        const { data: adminRecord, error: adminErr } = await supabase
          .from('admins')
          .select('*')
          .ilike('email', emailNormalized)
          .maybeSingle();

        if (adminErr || !adminRecord) {
          setIsAuthorizedAdmin(false);
          setAuthChecking(false);
          router.push('/admin');
          return;
        }

        setIsAuthorizedAdmin(true);
        setAuthChecking(false);
        await fetchApplications(false);
      } catch {
        setError('Authentication failure.');
        setAuthChecking(false);
        setLoading(false);
      }
    };

    verifyAdminAndLoad();
  }, [router, fetchApplications]);

  useEffect(() => {
    if (!isAuthorizedAdmin) return;

    const channel = supabase
      .channel('build_applications_admin_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'build_applications' },
        () => fetchApplications(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthorizedAdmin, fetchApplications]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        app.full_name?.toLowerCase().includes(term) ||
        app.registration_number?.toLowerCase().includes(term) ||
        app.application_id?.toLowerCase().includes(term) ||
        app.randomize_id?.toLowerCase().includes(term) ||
        app.outlook_email?.toLowerCase().includes(term) ||
        app.personal_email?.toLowerCase().includes(term) ||
        app.phone_number?.toLowerCase().includes(term) ||
        app.tech_stack?.toLowerCase().includes(term);

      const matchesProject =
        projectFilter === 'All' ||
        app.preference_1 === projectFilter ||
        app.preference_2 === projectFilter;

      const matchesRole = roleFilter === 'All' || app.role === roleFilter;

      return matchesSearch && matchesProject && matchesRole;
    });
  }, [applications, searchTerm, projectFilter, roleFilter]);

  const exportToCSV = () => {
    if (filteredApps.length === 0) return;

    const headers = [
      'Application ID',
      'Randomize ID',
      'Full Name',
      'Registration Number',
      'Role',
      'Preference 1',
      'Preference 2',
      'Phone Number',
      'Outlook Email',
      'Personal Email',
      'Tech Stack',
      'GitHub Link',
      'Why Project',
      'Submitted At'
    ];

    const escapeCsv = (val?: string | null) =>
      `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = filteredApps.map((a) => [
      escapeCsv(a.application_id),
      escapeCsv(a.randomize_id),
      escapeCsv(a.full_name),
      escapeCsv(a.registration_number),
      escapeCsv(a.role),
      escapeCsv(a.preference_1),
      escapeCsv(a.preference_2),
      escapeCsv(a.phone_number),
      escapeCsv(a.outlook_email),
      escapeCsv(a.personal_email),
      escapeCsv(a.tech_stack),
      escapeCsv(a.github_link),
      escapeCsv(a.why_project),
      escapeCsv(formatTimestamp(a.created_at))
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `projects_form_applications_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (authChecking || (loading && applications.length === 0)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" />
          <p className="text-xs font-mono text-gray-400">Loading Projects Form Submissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <main className="min-h-screen bg-[#07050e] text-white flex items-center justify-center p-4">
        <div className="bg-[#0f0b1c] border border-red-500/40 rounded-3xl p-8 text-center space-y-5 shadow-2xl max-w-md w-full">
          <ShieldAlert className="w-14 h-14 text-red-400 mx-auto" />
          <h1 className="text-2xl font-black">Access Denied</h1>
          <p className="text-sm text-zinc-300 leading-relaxed">
            You must be logged in with an authorized Admin account to view Projects form submissions.
          </p>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> Go to Admin Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-[#050505] text-white p-4 sm:p-8 pt-32 sm:pt-40 font-sans overflow-x-hidden">
      {/* Matrix Background & Glow Effects */}
      <div className="fixed inset-0 pointer-events-none -z-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div className="fixed top-[10%] left-[20%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[20%] right-[20%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                title="Back to Admin Portal"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-3xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500">
                Projects Form Admin
              </h1>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              Review Build with Us project applications, preferences, tech stacks, and GitHub repositories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportToCSV}
              disabled={filteredApps.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 rounded-lg text-xs font-bold text-gray-200 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" /> Export CSV
            </button>

            <button
              onClick={() => fetchApplications(false)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-gray-200 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} /> Refresh
            </button>

            <button
              onClick={() => router.push('/admin')}
              className="text-gray-400 hover:text-white transition-colors text-xs font-bold border border-white/10 px-4 py-2 rounded-lg bg-white/5 cursor-pointer"
            >
              Back to Portal
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Total Applications
            </p>
            <p className="text-2xl font-black text-white mt-1">{applications.length}</p>
          </div>
          {PROJECT_OPTIONS.map((proj) => {
            const pref1Count = applications.filter((a) => a.preference_1 === proj).length;
            const pref2Count = applications.filter((a) => a.preference_2 === proj).length;
            return (
              <div
                key={proj}
                className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 backdrop-blur-md"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 truncate">
                  {proj}
                </p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-2xl font-black text-white">
                    {pref1Count + pref2Count}
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono">
                    (P1: {pref1Count} • P2: {pref2Count})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl backdrop-blur-md text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search name, reg no, email, tech stack..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-cyan-500 transition-colors backdrop-blur-md text-white"
            />
          </div>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer backdrop-blur-md text-white"
          >
            <option value="All" className="bg-[#0c0812]">
              All Projects
            </option>
            {PROJECT_OPTIONS.map((proj) => (
              <option key={proj} value={proj} className="bg-[#0c0812]">
                {proj}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer backdrop-blur-md text-white"
          >
            <option value="All" className="bg-[#0c0812]">
              All Roles
            </option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r} className="bg-[#0c0812]">
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Data Table */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/5 border-b border-white/10 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-4">Applicant</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Project Preferences</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredApps.map((app) => (
                  <tr
                    key={app.application_id || app.id}
                    className="hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{app.full_name}</div>
                      <div className="text-gray-400 font-mono text-xs mt-0.5">
                        {app.registration_number}
                        {app.randomize_id ? ` • ${app.randomize_id}` : ''}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {formatTimestamp(app.created_at)}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-300 text-xs">
                        <Phone className="w-3 h-3 text-cyan-400 shrink-0" /> {app.phone_number}
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 mt-1 text-xs">
                        <Mail className="w-3 h-3 text-purple-400 shrink-0" /> {app.outlook_email}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-pink-500/10 text-pink-300 text-xs font-bold border border-pink-500/20">
                        {app.role || 'N/A'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-normal min-w-[220px]">
                      <div className="flex flex-col gap-1.5 items-start">
                        {app.preference_1 && (
                          <span className="text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-md text-xs font-bold border border-cyan-500/20">
                            1. {app.preference_1}
                          </span>
                        )}
                        {app.preference_2 && (
                          <span className="text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-md text-xs font-bold border border-purple-500/20">
                            2. {app.preference_2}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors border border-white/10 cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredApps.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                No project applications found matching your filters.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApp(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0a10] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedApp.full_name}</h2>
                  <p className="text-xs font-mono text-cyan-400 mt-1">
                    {selectedApp.registration_number} • {selectedApp.application_id}
                    {selectedApp.randomize_id ? ` • ${selectedApp.randomize_id}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                {/* Contact & Role Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3.5">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                      Contact Details
                    </h3>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-cyan-400" /> {selectedApp.phone_number}
                      </div>
                      <button
                        onClick={() => handleCopy(selectedApp.phone_number, 'phone')}
                        className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {copied === 'phone' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 text-sm break-all">
                        <Mail className="w-4 h-4 text-purple-400 shrink-0" />{' '}
                        {selectedApp.outlook_email || 'N/A'}
                      </div>
                      {selectedApp.outlook_email && (
                        <button
                          onClick={() => handleCopy(selectedApp.outlook_email, 'outlook')}
                          className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {copied === 'outlook' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    {selectedApp.personal_email && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 text-sm text-gray-400 break-all">
                          <Mail className="w-4 h-4 text-pink-400 shrink-0" />{' '}
                          {selectedApp.personal_email}
                        </div>
                        <button
                          onClick={() => handleCopy(selectedApp.personal_email, 'personal')}
                          className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {copied === 'personal' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3.5">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                      Role & Submission Metadata
                    </h3>

                    <div className="flex items-center gap-3 text-sm">
                      <Layers className="w-4 h-4 text-pink-400" /> Role:{' '}
                      <span className="font-bold text-pink-300">{selectedApp.role}</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-cyan-400" /> Submitted:{' '}
                      <span className="font-mono text-gray-300 text-xs">
                        {formatTimestamp(selectedApp.created_at)}
                      </span>
                    </div>

                    {selectedApp.course && (
                      <div className="flex items-center gap-3 text-sm">
                        <BookOpen className="w-4 h-4 text-purple-400" /> {selectedApp.course}
                      </div>
                    )}

                    {selectedApp.accommodation && (
                      <div className="flex items-center gap-3 text-sm">
                        <Home className="w-4 h-4 text-purple-400" /> {selectedApp.accommodation}
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Preferences */}
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                    Project Preferences
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/25 rounded-xl">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 block mb-1">
                        Preference 1
                      </span>
                      <span className="text-base font-bold text-white">
                        {selectedApp.preference_1 || 'N/A'}
                      </span>
                    </div>
                    <div className="p-4 bg-purple-500/10 border border-purple-500/25 rounded-xl">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 block mb-1">
                        Preference 2
                      </span>
                      <span className="text-base font-bold text-white">
                        {selectedApp.preference_2 || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Technical Profile & Motivation */}
                <div className="p-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                      <Cpu className="w-4 h-4" /> Technical Profile & Motivation
                    </h3>

                    {selectedApp.github_link && (
                      <a
                        href={
                          selectedApp.github_link.startsWith('http')
                            ? selectedApp.github_link
                            : `https://${selectedApp.github_link}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-bold text-cyan-200 hover:text-white bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 px-3.5 py-2 rounded-lg transition-colors"
                      >
                        <FolderGit2 className="w-4 h-4" /> Open GitHub Link
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1.5 font-semibold">
                      GitHub Profile / Links:
                    </p>
                    <p className="text-sm bg-black/40 p-3.5 rounded-lg border border-white/5 whitespace-pre-wrap break-all font-mono text-gray-200">
                      {selectedApp.github_link || 'None provided'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1.5 font-semibold">
                      Tech Stack & Skills:
                    </p>
                    <p className="text-sm bg-black/40 p-3.5 rounded-lg border border-white/5 whitespace-pre-wrap leading-relaxed text-gray-200">
                      {selectedApp.tech_stack || 'None provided'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1.5 font-semibold">
                      Why do you want to work on this project?
                    </p>
                    <p className="text-sm bg-black/40 p-3.5 rounded-lg border border-white/5 whitespace-pre-wrap leading-relaxed text-gray-200">
                      {selectedApp.why_project || 'None provided'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
