import React, { useEffect, useState, useCallback } from 'react';
import { projects as projectsAPI, ai as aiAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sparkles, TrendingUp, AlertTriangle, Target, Users } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

const AIInsightsPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await projectsAPI.getAll();
      setProjects(res.data);
      if (res.data.length > 0) {
        setSelectedProject(res.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load projects');
    }
  }, []);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiAPI.getInsights(selectedProject);
      setInsights(res.data);
    } catch (error) {
      toast.error('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      loadInsights();
    }
  }, [selectedProject, loadInsights]);

  const generateInsight = async (type) => {
    setGenerating(true);
    try {
      let res;
      switch (type) {
        case 'health':
          res = await aiAPI.generateProjectHealth(selectedProject);
          break;
        case 'risks':
          res = await aiAPI.generateTopRisks(selectedProject);
          break;
        case 'recommendations':
          res = await aiAPI.generateRecommendations(selectedProject);
          break;
        case 'stakeholder':
          res = await aiAPI.generateStakeholderSummary(selectedProject);
          break;
        default:
          return;
      }
      toast.success('AI insight generated!');
      loadInsights();
    } catch (error) {
      toast.error('Failed to generate insight');
    } finally {
      setGenerating(false);
    }
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'project_health': return <TrendingUp className="w-5 h-5" />;
      case 'top_risks': return <AlertTriangle className="w-5 h-5" />;
      case 'recommendations': return <Target className="w-5 h-5" />;
      case 'stakeholder_summary': return <Users className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="ai-insights-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">AI Insights</h1>
          <p className="text-muted-foreground">Intelligent analysis and recommendations powered by AI</p>
        </div>
        {projects.length > 0 && (
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64" data-testid="project-select">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button
          onClick={() => generateInsight('health')}
          disabled={generating || !selectedProject}
          className="h-auto py-6 flex flex-col items-center gap-2"
          data-testid="generate-health-button"
        >
          <TrendingUp className="w-6 h-6" />
          <span>Project Health</span>
        </Button>
        <Button
          onClick={() => generateInsight('risks')}
          disabled={generating || !selectedProject}
          className="h-auto py-6 flex flex-col items-center gap-2"
          data-testid="generate-risks-button"
        >
          <AlertTriangle className="w-6 h-6" />
          <span>Top Risks</span>
        </Button>
        <Button
          onClick={() => generateInsight('recommendations')}
          disabled={generating || !selectedProject}
          className="h-auto py-6 flex flex-col items-center gap-2"
          data-testid="generate-recommendations-button"
        >
          <Target className="w-6 h-6" />
          <span>Recommendations</span>
        </Button>
        <Button
          onClick={() => generateInsight('stakeholder')}
          disabled={generating || !selectedProject}
          className="h-auto py-6 flex flex-col items-center gap-2"
          data-testid="generate-stakeholder-button"
        >
          <Users className="w-6 h-6" />
          <span>Stakeholder Summary</span>
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-muted-foreground">Loading insights...</div>
        ) : insights.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="p-12 text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No insights yet</h3>
              <p className="text-muted-foreground">Generate your first AI insight using the buttons above</p>
            </CardContent>
          </Card>
        ) : (
          insights.map((insight) => (
            <Card key={insight.id} className="border-l-4 border-primary bg-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  {getInsightIcon(insight.insight_type)}
                  {insight.insight_type.replace('_', ' ').toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line mb-2">{insight.content}</p>
                <p className="text-xs text-muted-foreground">Generated: {formatDate(insight.created_at)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AIInsightsPage;

