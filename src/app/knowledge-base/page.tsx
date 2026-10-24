// src/app/knowledge-base/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Plus,
  RefreshCw,
  Terminal,
  ChevronRight,
  Archive,
  Layers,
  Sparkles,
  X,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/NotificationToast';
import { KnowledgeArticleDTO, DiagnosticStepItem } from '@/types/knowledgeBase';

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticleDTO[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assetTypeFilter, setAssetTypeFilter] = useState('ALL');

  // Modals
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticleDTO | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newErrorCode, setNewErrorCode] = useState('');
  const [newCategory, setNewCategory] = useState('INFRASTRUCTURE');
  const [newAssetType, setNewAssetType] = useState('SERVER');
  const [newOS, setNewOS] = useState('Windows Server 2022');
  const [newProduct, setNewProduct] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSymptoms, setNewSymptoms] = useState('');
  const [newSolution, setNewSolution] = useState('');
  const [newPrevention, setNewPrevention] = useState('');
  const [newStatus, setNewStatus] = useState<'DRAFT' | 'VERIFIED'>('VERIFIED');
  const [newSteps, setNewSteps] = useState<DiagnosticStepItem[]>([
    {
      title: 'Inspect Service / Port State',
      command: 'Test-NetConnection -ComputerName <Target> -Port <Port>',
      purpose: 'Verify service daemon port is reachable over TCP.',
      expectedResult: 'TcpTestSucceeded: True',
      riskRating: 'SAFE_READ_ONLY',
    },
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (assetTypeFilter !== 'ALL') params.set('assetType', assetTypeFilter);

      const [articlesRes, statsRes] = await Promise.all([
        fetch(`/api/knowledge-base?${params.toString()}`),
        fetch('/api/knowledge-base/stats'),
      ]);

      if (articlesRes.ok) {
        const data = await articlesRes.json();
        setArticles(data.articles || []);
      }

      if (statsRes.ok) {
        const sData = await statsRes.json();
        setStats(sData.stats || null);
      }
    } catch (err) {
      console.error('Error fetching knowledge base data:', err);
      toast({ title: 'Error', message: 'Failed to load knowledge base articles', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, statusFilter, assetTypeFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Verify Article
  const handleVerifyArticle = async (articleId: string) => {
    try {
      const res = await fetch(`/api/knowledge-base/${articleId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifiedBy: 'Senior Systems Administrator' }),
      });

      if (!res.ok) throw new Error('Verification failed');
      const data = await res.json();

      toast({ title: 'Article Verified', message: 'Article verified and promoted to active recommendations', type: 'success' });
      setSelectedArticle(data.article);
      loadData();
    } catch (err: any) {
      toast({ title: 'Verification Failed', message: err.message || 'Failed to verify article', type: 'error' });
    }
  };

  // Handle Archive Article
  const handleArchiveArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to archive this knowledge article?')) return;
    try {
      const res = await fetch(`/api/knowledge-base/${articleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Archive failed');
      toast({ title: 'Article Archived', message: 'Article archived successfully', type: 'info' });
      setIsDetailModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Archive Failed', message: err.message || 'Failed to archive article', type: 'error' });
    }
  };

  // Simulate Outcome Feedback
  const handleRecordFeedback = async (articleId: string, outcome: 'ACCEPTED' | 'UNSUCCESSFUL') => {
    try {
      const res = await fetch('/api/knowledge-base/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          outcome,
          incidentId: 'INC-FEEDBACK-DEMO',
        }),
      });

      if (!res.ok) throw new Error('Feedback submission failed');
      const data = await res.json();

      toast({
        title: outcome === 'ACCEPTED' ? 'Solution Accepted' : 'Solution Marked Unsuccessful',
        message: outcome === 'ACCEPTED' ? 'Solution marked as accepted (+1 Success Count)' : 'Solution marked as unsuccessful (+1 Failure Count)',
        type: outcome === 'ACCEPTED' ? 'success' : 'warning',
      });

      setSelectedArticle(data.data.article);
      loadData();
    } catch (err: any) {
      toast({ title: 'Feedback Error', message: err.message || 'Failed to record feedback', type: 'error' });
    }
  };

  // Check Duplicate
  const handleCheckDuplicate = async () => {
    if (!newTitle.trim() && !newDescription.trim() && !newErrorCode.trim()) return;
    setIsDuplicateChecking(true);
    setDuplicateWarning(null);
    try {
      const symptomsList = newSymptoms.split('\n').filter(s => s.trim().length > 0);
      const res = await fetch('/api/knowledge-base/duplicate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          originalErrorDescription: newDescription || newTitle,
          errorCode: newErrorCode || null,
          symptoms: symptomsList,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result.hasDuplicate) {
          setDuplicateWarning(
            `Duplicate Warning (${data.result.similarityScore}% match): "${data.result.matchedArticle.title}". ${data.result.reason}`
          );
        } else {
          toast({ title: 'No Duplicates', message: 'No duplicate articles found. Safe to create.', type: 'success' });
        }
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
    } finally {
      setIsDuplicateChecking(false);
    }
  };

  // Add Step to Create Form
  const addStep = () => {
    setNewSteps(prev => [
      ...prev,
      {
        title: `Diagnostic Step ${prev.length + 1}`,
        command: '',
        purpose: '',
        expectedResult: '',
        riskRating: 'SAFE_READ_ONLY',
      },
    ]);
  };

  // Remove Step from Create Form
  const removeStep = (index: number) => {
    setNewSteps(prev => prev.filter((_, i) => i !== index));
  };

  // Create Article
  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim() || !newSolution.trim()) {
      toast({ title: 'Missing Fields', message: 'Please provide a title, error description, and verified solution.', type: 'warning' });
      return;
    }

    setIsCreating(true);
    try {
      const symptomsList = newSymptoms
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          errorCode: newErrorCode.trim() || null,
          category: newCategory,
          assetType: newAssetType || null,
          operatingSystem: newOS.trim() || null,
          productOrService: newProduct.trim() || null,
          originalErrorDescription: newDescription.trim(),
          symptoms: symptomsList.length > 0 ? symptomsList : [newTitle.trim()],
          diagnosticSteps: newSteps.filter(s => s.title.trim().length > 0),
          verifiedSolution: newSolution.trim(),
          preventionNotes: newPrevention.trim() || null,
          status: newStatus,
          confidenceBasis: newStatus === 'VERIFIED' ? 'ADMIN_VERIFIED' : 'USER_CONFIRMED',
          createdBy: 'Incident Technician',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create article');
      }

      toast({ title: 'Article Created', message: 'Knowledge article created successfully!', type: 'success' });
      setIsCreateModalOpen(false);
      // Reset form
      setNewTitle('');
      setNewErrorCode('');
      setNewDescription('');
      setNewSymptoms('');
      setNewSolution('');
      setNewPrevention('');
      setDuplicateWarning(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Creation Failed', message: err.message || 'Creation failed', type: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Error & Solution Knowledge Base
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Local-first repository of verified diagnostic steps and solutions. Evaluated before AI intake for instant, deterministic recovery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            className="border-slate-700 bg-slate-900/60 hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Knowledge Article
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/70 border-slate-800">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Total Articles
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {stats ? stats.totalArticles : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Across all categories</span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/70 border-slate-800">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Verified Solutions
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
            <span>{stats ? stats.verifiedCount : '—'}</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats ? `${stats.draftCount} draft pending verification` : 'Verified by lead admin'}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/70 border-slate-800">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Successful Reuses
          </div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            {stats ? stats.totalSuccessReuses : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Instant resolutions without Gemini calls
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/70 border-slate-800">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Global Success Rate
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {stats?.globalSuccessRate !== null && stats?.globalSuccessRate !== undefined
              ? `${stats.globalSuccessRate}%`
              : '—'}
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified technician satisfaction</span>
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-slate-900/70 border-slate-800">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by error code (e.g. 0x80070035, NXDOMAIN), symptom, or keyword..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Categories</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="NETWORK">Network</option>
              <option value="HARDWARE">Hardware</option>
              <option value="STORAGE">Storage</option>
              <option value="APPLICATION">Application</option>
              <option value="SECURITY">Security</option>
              <option value="DATABASE">Database</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified Only</option>
              <option value="DRAFT">Drafts (Pending)</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            {/* Asset Type Filter */}
            <select
              value={assetTypeFilter}
              onChange={e => setAssetTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Asset Types</option>
              <option value="SERVER">Server</option>
              <option value="WORKSTATION">Workstation</option>
              <option value="ROUTER">Router</option>
              <option value="SWITCH">Switch</option>
              <option value="FIREWALL">Firewall</option>
              <option value="PRINTER">Printer</option>
              <option value="DATABASE">Database</option>
              <option value="APPLICATION">Application</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Article List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500/60" />
          <span>Searching local knowledge articles...</span>
        </div>
      ) : articles.length === 0 ? (
        <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-300">No knowledge articles found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Try adjusting your search query or filters, or add a new verified troubleshooting solution.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setCategoryFilter('ALL');
              setStatusFilter('ALL');
              setAssetTypeFilter('ALL');
            }}
            className="mt-4 border-slate-700"
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map(article => {
            const totalUses = article.successCount + article.failureCount;
            const successRate = totalUses > 0 ? Math.round((article.successCount / totalUses) * 100) : null;

            return (
              <div
                key={article.id}
                onClick={() => {
                  setSelectedArticle(article);
                  setIsDetailModalOpen(true);
                }}
                className="group p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  {/* Tags Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    {article.status === 'VERIFIED' && (
                      <Badge variant="emerald" icon={<ShieldCheck className="w-3 h-3" />}>
                        Verified Solution
                      </Badge>
                    )}
                    {article.status === 'DRAFT' && (
                      <Badge variant="amber" icon={<Clock className="w-3 h-3" />}>
                        Draft (Needs Review)
                      </Badge>
                    )}
                    {article.status === 'ARCHIVED' && (
                      <Badge variant="slate" icon={<Archive className="w-3 h-3" />}>
                        Archived
                      </Badge>
                    )}

                    {/* Error Code */}
                    {article.errorCode && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-semibold">
                        {article.errorCode}
                      </span>
                    )}

                    {/* Category */}
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      {article.category}
                    </span>

                    {/* Asset Type */}
                    {article.assetType && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-cyan-800/30">
                        {article.assetType}
                      </span>
                    )}

                    {/* OS */}
                    {article.operatingSystem && (
                      <span className="text-[11px] text-slate-400">
                        • {article.operatingSystem}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {article.originalErrorDescription}
                    </p>
                  </div>

                  {/* Symptoms previews */}
                  {article.symptoms && article.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {article.symptoms.slice(0, 3).map((sym, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-950/80 text-slate-400 border border-slate-800"
                        >
                          {sym}
                        </span>
                      ))}
                      {article.symptoms.length > 3 && (
                        <span className="text-[11px] text-slate-500 self-center">
                          +{article.symptoms.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right stats & action */}
                <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800/60 min-w-[160px]">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-300">
                      {article.successCount} Solved / {totalUses} Uses
                    </div>
                    {successRate !== null ? (
                      <div className="text-[11px] font-medium text-emerald-400">
                        {successRate}% Success Rate
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">Not yet tested</div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Inspect Steps</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ARTICLE DETAIL MODAL */}
      {selectedArticle && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedArticle.title}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {selectedArticle.status === 'DRAFT' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleVerifyArticle(selectedArticle.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    Verify Article (Admin)
                  </Button>
                )}
                {selectedArticle.status !== 'ARCHIVED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchiveArticle(selectedArticle.id)}
                    className="border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-900/40"
                  >
                    <Archive className="w-4 h-4 mr-1.5" />
                    Archive
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-5 text-sm">
            {/* Meta tags bar */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/80 rounded-lg border border-slate-800">
              {selectedArticle.status === 'VERIFIED' ? (
                <Badge variant="emerald" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                  Verified Solution
                </Badge>
              ) : selectedArticle.status === 'DRAFT' ? (
                <Badge variant="amber" icon={<Clock className="w-3.5 h-3.5" />}>
                  Draft (Technician Submitted)
                </Badge>
              ) : (
                <Badge variant="slate">Archived</Badge>
              )}

              {selectedArticle.errorCode && (
                <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 font-bold">
                  {selectedArticle.errorCode}
                </span>
              )}

              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {selectedArticle.category}
              </span>

              {selectedArticle.assetType && (
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/50 text-cyan-300 border border-cyan-800/40">
                  Target: {selectedArticle.assetType}
                </span>
              )}

              {selectedArticle.operatingSystem && (
                <span className="text-xs text-slate-400">
                  OS: {selectedArticle.operatingSystem}
                </span>
              )}
            </div>

            {/* Error Description & Symptoms */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Observed Problem Description & Symptoms
              </h4>
              <p className="text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs leading-relaxed">
                {selectedArticle.originalErrorDescription}
              </p>
              {selectedArticle.symptoms && selectedArticle.symptoms.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {selectedArticle.symptoms.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Diagnostic Steps */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Diagnostic Verification Steps ({selectedArticle.diagnosticSteps?.length || 0})</span>
                <span className="text-[11px] text-slate-500">Run locally by technician</span>
              </h4>

              <div className="space-y-2.5">
                {selectedArticle.diagnosticSteps?.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-slate-200">
                        {idx + 1}. {step.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {step.riskRating === 'ELEVATED_AUDIT_WARNING' ? 'Elevated Warning' : 'Safe Read-Only'}
                      </span>
                    </div>

                    {step.command && (
                      <div className="flex items-center gap-2 p-2 bg-slate-900 rounded font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto">
                        <Terminal className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <code>{step.command}</code>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-500">Purpose: </span>
                        <span className="text-slate-400">{step.purpose}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Expected Result: </span>
                        <span className="text-cyan-400 font-mono">{step.expectedResult}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Fix / Solution */}
            <div>
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified Solution Implementation</span>
              </h4>
              <div className="p-3 bg-emerald-950/20 rounded-lg border border-emerald-900/40 text-xs text-emerald-200 whitespace-pre-line leading-relaxed font-mono">
                {selectedArticle.verifiedSolution}
              </div>
            </div>

            {/* Prevention Notes */}
            {selectedArticle.preventionNotes && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Root Cause & Long-Term Prevention
                </h4>
                <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  {selectedArticle.preventionNotes}
                </p>
              </div>
            )}

            {/* Interactive Feedback & Solution Test Simulation */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Technician Outcome Validation
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Did this verified solution resolve the incident on this asset?
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRecordFeedback(selectedArticle.id, 'ACCEPTED')}
                    className="border-emerald-800/60 text-emerald-400 hover:bg-emerald-950/40"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Issue Resolved (+1)
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRecordFeedback(selectedArticle.id, 'UNSUCCESSFUL')}
                    className="border-rose-800/60 text-rose-400 hover:bg-rose-950/40"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 mr-1 text-rose-400" />
                    Unsuccessful (+1)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE KNOWLEDGE ARTICLE MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Knowledge Base Article"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateArticle} className="space-y-4 text-xs">
          {/* Title & Error Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-slate-300 font-medium">Article Title *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. SMB Share Path Not Found (0x80070035)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Error Code (Optional)</label>
              <input
                type="text"
                value={newErrorCode}
                onChange={e => setNewErrorCode(e.target.value)}
                placeholder="e.g. 0x80070035"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category, Asset Type, OS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Category *</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="INFRASTRUCTURE">Infrastructure</option>
                <option value="NETWORK">Network</option>
                <option value="HARDWARE">Hardware</option>
                <option value="STORAGE">Storage</option>
                <option value="APPLICATION">Application</option>
                <option value="SECURITY">Security</option>
                <option value="DATABASE">Database</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Asset Type</label>
              <select
                value={newAssetType}
                onChange={e => setNewAssetType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="SERVER">Server</option>
                <option value="WORKSTATION">Workstation</option>
                <option value="LAPTOP">Laptop</option>
                <option value="ROUTER">Router</option>
                <option value="SWITCH">Switch</option>
                <option value="FIREWALL">Firewall</option>
                <option value="PRINTER">Printer</option>
                <option value="DATABASE">Database</option>
                <option value="APPLICATION">Application</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Operating System</label>
              <input
                type="text"
                value={newOS}
                onChange={e => setNewOS(e.target.value)}
                placeholder="e.g. Windows Server 2022"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Product / Subsystem Service */}
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Product or Subsystem Service (Optional)</label>
            <input
              type="text"
              value={newProduct}
              onChange={e => setNewProduct(e.target.value)}
              placeholder="e.g. Microsoft SMB 3.0 / Active Directory Integrated DNS"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Original Problem & Duplicate check */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-medium">Problem Description / Error Text *</label>
              <button
                type="button"
                onClick={handleCheckDuplicate}
                disabled={isDuplicateChecking}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isDuplicateChecking ? 'Checking duplicates...' : 'Check for Duplicates'}</span>
              </button>
            </div>
            <textarea
              required
              rows={2}
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Exact error message observed or problem report..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Duplicate warning banner */}
          {duplicateWarning && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">{duplicateWarning}</div>
            </div>
          )}

          {/* Symptoms list */}
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Symptoms (One per line)</label>
            <textarea
              rows={2}
              value={newSymptoms}
              onChange={e => setNewSymptoms(e.target.value)}
              placeholder="Network share unreachable&#10;Error 0x80070035 returned"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Diagnostic Steps Section */}
          <div className="space-y-2 border-t border-slate-800/80 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-slate-200 font-semibold">Diagnostic Steps</label>
              <button
                type="button"
                onClick={addStep}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {newSteps.map((step, idx) => (
                <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Step Title"
                      value={step.title}
                      onChange={e => {
                        const copy = [...newSteps];
                        copy[idx].title = e.target.value;
                        setNewSteps(copy);
                      }}
                      className="flex-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs"
                    />
                    {newSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Command / Tool to execute"
                    value={step.command}
                    onChange={e => {
                      const copy = [...newSteps];
                      copy[idx].command = e.target.value;
                      setNewSteps(copy);
                    }}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-emerald-400 font-mono text-xs"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Purpose"
                      value={step.purpose}
                      onChange={e => {
                        const copy = [...newSteps];
                        copy[idx].purpose = e.target.value;
                        setNewSteps(copy);
                      }}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Expected Result"
                      value={step.expectedResult}
                      onChange={e => {
                        const copy = [...newSteps];
                        copy[idx].expectedResult = e.target.value;
                        setNewSteps(copy);
                      }}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-cyan-300 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verified Solution */}
          <div className="space-y-1 border-t border-slate-800/80 pt-3">
            <label className="text-slate-200 font-semibold">Verified Solution (Instructions) *</label>
            <textarea
              required
              rows={3}
              value={newSolution}
              onChange={e => setNewSolution(e.target.value)}
              placeholder="Step-by-step remediation procedure..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Prevention */}
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Prevention & Root Cause Notes</label>
            <textarea
              rows={2}
              value={newPrevention}
              onChange={e => setNewPrevention(e.target.value)}
              placeholder="Root cause explanation and preventive measures..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Status selection */}
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-200">Publication Status</div>
              <div className="text-[11px] text-slate-400">
                Verified articles are immediately eligible for automated troubleshooting recommendations.
              </div>
            </div>

            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs"
            >
              <option value="VERIFIED">Verified (Ready for First-Line Use)</option>
              <option value="DRAFT">Draft (Requires Review)</option>
            </select>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Save Article
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
