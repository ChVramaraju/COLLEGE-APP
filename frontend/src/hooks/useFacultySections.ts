// ============================================================
// hooks/useFacultySections.ts — Faculty Sections Dashboard Data
// ============================================================
// Powers FacultySectionsPage.
//
// STRATEGY:
//   1. Fetch all assignments → getMyFacultyAssignments()
//   2. Group by section_id to build SectionCard data
//   3. Each card shows: section info, subjects taught, student count
//      from attendance stats (attendanceService)
//
// DERIVED STATE:
//   sectionCards  — one card per unique section with subjects array
//   totalSubjects — across all assignments
//   totalSections — unique sections
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AssignedSectionBrief } from '@/types/facultyAssignment';
import { getMyFacultyAssignments } from '@/services/facultyAssignmentService';


export interface SectionCard {
  section_id:    number;
  section_name:  string;
  department:    string;
  semester:      number;
  academic_year: string;
  subjects:      string[];
}

export interface UseFacultySectionsReturn {
  sectionCards:   SectionCard[];
  assignments:    AssignedSectionBrief[];
  totalSections:  number;
  totalSubjects:  number;
  isLoading:      boolean;
  error:          string | null;
  refetch:        () => void;
}

export function useFacultySections(): UseFacultySectionsReturn {
  const [assignments, setAssignments] = useState<AssignedSectionBrief[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [fetchKey,    setFetchKey]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getMyFacultyAssignments()
      .then(data => { if (!cancelled) setAssignments(data); })
      .catch(e  => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load assignments.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const sectionCards = useMemo<SectionCard[]>(() => {
    const map = new Map<number, SectionCard>();
    for (const a of assignments) {
      if (!map.has(a.section_id)) {
        map.set(a.section_id, {
          section_id:    a.section_id,
          section_name:  a.section_name,
          department:    a.department,
          semester:      a.semester,
          academic_year: a.academic_year,
          subjects:      [],
        });
      }
      map.get(a.section_id)!.subjects.push(a.subject);
    }
    return Array.from(map.values()).sort(
      (x, y) => x.semester - y.semester || x.section_name.localeCompare(y.section_name),
    );
  }, [assignments]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  return {
    sectionCards,
    assignments,
    totalSections: sectionCards.length,
    totalSubjects: assignments.length,
    isLoading,
    error,
    refetch,
  };
}
