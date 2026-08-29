import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

export const getStatusColor = (status) => {
  const colors = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-primary/20 text-primary',
    blocked: 'bg-destructive/20 text-destructive',
    completed: 'bg-success/20 text-success',
    planning: 'bg-muted text-muted-foreground',
    active: 'bg-primary/20 text-primary',
    on_hold: 'bg-warning/20 text-warning',
    archived: 'bg-muted text-muted-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getPriorityColor = (priority) => {
  const colors = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-primary/20 text-primary',
    high: 'bg-warning/20 text-warning',
    critical: 'bg-destructive/20 text-destructive',
  };
  return colors[priority] || 'bg-muted text-muted-foreground';
};

export const getRiskColor = (risk) => {
  const colors = {
    low: 'bg-success/20 text-success border-success/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    high: 'bg-destructive/20 text-destructive border-destructive/30',
  };
  return colors[risk] || 'bg-muted text-muted-foreground';
};

