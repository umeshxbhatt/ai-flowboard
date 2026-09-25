import { useState, useEffect } from "react";
import { taskApi, userApi } from "../lib/api";
import { useBoards } from "../context/BoardsContext";

/**
 * Aggregates workspace data (user's assigned tasks and teammate directory)
 * using dedicated, indexed backend endpoints rather than N+1 board queries.
 */
export const useWorkspace = () => {
  const { boards, loading: boardsLoading } = useBoards();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      taskApi.my().catch(() => []),
      userApi.workspace().catch(() => []),
    ]).then(([fetchedTasks, fetchedMembers]) => {
      if (cancelled) return;
      setTasks(fetchedTasks || []);
      setMembers(fetchedMembers || []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { tasks, members, boards, loading: loading || boardsLoading };
};
