// ============================================================
// hooks/useFacultyAssignments.ts — Admin Assignment Manager
// ============================================================
// Manages the full CRUD lifecycle for the admin assignments page.
//
// STATE:
//   assignments   — full list from GET /admin/faculty-assignments
//   filters       — { facultyId, sectionId } for server-side filtering
//   isLoading     — initial fetch
//   isSubmitting  — create/delete in progress
//   error         — fetch error message
//
// OPTIMISTIC DELETE:
//   The row is removed from local state immediately on delete click.
//   If the API call fails, the row is restored.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { FacultyAssignment, FacultyAssignmentCreate } from '@/types/facultyAssignment';
import {
  listFacultyAssignments,
  createFacultyAssignment,
  deleteFacultyAssignment,
} from '@/services/facultyAssignmentService';


export interface AssignmentFilters {
  facultyId?: number;
  sectionId?: number;
}

export interface UseFacultyAssignmentsReturn {
  assignments:   FacultyAssignment[];
  isLoading:     boolean;
  isSubmitting:  boolean;
  error:         string | null;
  filters:       AssignmentFilters;
  setFilters:    (f: AssignmentFilters) => void;
  create:        (data: FacultyAssignmentCreate) => Promise<void>;
  remove:        (id: number) => Promise<void>;
  refetch:       () => void;
}

export function useFacultyAssignments(): UseFacultyAssignmentsReturn {
  const [assignments,  setAssignments]  = useState<FacultyAssignment[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [filters,      setFilters]      = useState<AssignmentFilters>({});
  const [fetchKey,     setFetchKey]     = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listFacultyAssignments({
      faculty_id: filters.facultyId,
      section_id: filters.sectionId,
    })
      .then(data => { if (!cancelled) setAssignments(data); })
      .catch(e  => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load assignments.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey, filters.facultyId, filters.sectionId]);

  const create = useCallback(async (data: FacultyAssignmentCreate) => {
    setIsSubmitting(true);
    try {
      const created = await createFacultyAssignment(data);
      setAssignments(prev => [created, ...prev]);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    const snapshot = [...assignments];
    setAssignments(prev => prev.filter(a => a.id !== id));
    try {
      await deleteFacultyAssignment(id);
    } catch {
      setAssignments(snapshot);
      throw new Error('Failed to delete assignment. Please try again.');
    }
  }, [assignments]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  return {
    assignments,
    isLoading,
    isSubmitting,
    error,
    filters,
    setFilters,
    create,
    remove,
    refetch,
  };
}
