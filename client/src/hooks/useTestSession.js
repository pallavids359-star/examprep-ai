import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api/axios";

export const pad = (n) => String(n).padStart(2, "0");
export const formatClock = (seconds) => {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

// Answers in the shape the server expects
const buildPayload = (questions, answers, marked, times, visited = {}) =>
  questions.map((q) => {
    const given = answers[q._id] || [];
    // Numerical questions: the typed number is kept as the only item in the list
    const numerical = q.type === "numerical" || !(q.options || []).length;
    const value = numerical && given.length ? parseFloat((String(given[0]).match(/-?\d*\.?\d+/) || [""])[0]) : NaN;
    return {
    questionId: q._id,
    selectedOptionIds: numerical ? [] : given,
    ...(Number.isFinite(value) ? { numericalValue: value } : {}),
    markedForReview: Boolean(marked[q._id]),
    timeSpentSec: times[q._id] || 0,
    visited: Boolean(visited[q._id]),
    };
  });

// Everything the test screen needs: loading, answers, timer, autosave and submitting
export default function useTestSession(id) {
  const navigate = useNavigate();
  const storageKey = `attempt-${id}`;

  const [info, setInfo] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [visited, setVisited] = useState({});
  const [times, setTimes] = useState({});
  const [openedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [clockOffset, setClockOffset] = useState(0); // server clock minus computer clock
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [error, setError] = useState("");

  const startedAt = useRef(Date.now()); // when the current question was opened
  const dirty = useRef(false); // something changed since the last autosave
  const submitted = useRef(false);
  const latest = useRef({ questions: [], answers: {}, marked: {}, times: {} });

  // 1. Load the attempt and restore saved answers (server first, then this browser's copy)
  useEffect(() => {
    api
      .get(`/attempts/${id}`)
      .then((res) => {
        const d = res.data;
        if (d.status !== "in_progress") {
          navigate(`/result/${id}`, { replace: true });
          return;
        }
        setInfo({ mode: d.mode, title: d.testTitle || "Practice", markingScheme: d.markingScheme, expiresAt: d.expiresAt });
        setQuestions(d.questions);
        if (d.expiresAt) setClockOffset(new Date(d.serverNow).getTime() - Date.now());

        const a = {};
        const m = {};
        const t = {};
        (d.savedAnswers || []).forEach((s) => {
          if (s.selectedOptionIds?.length) a[s.questionId] = s.selectedOptionIds;
          else if (typeof s.numericalValue === "number") a[s.questionId] = [String(s.numericalValue)];
          if (s.markedForReview) m[s.questionId] = true;
          if (s.timeSpentSec) t[s.questionId] = s.timeSpentSec;
        });
        const local = JSON.parse(localStorage.getItem(storageKey) || "null");
        setAnswers({ ...a, ...local?.answers });
        setMarked({ ...m, ...local?.marked });
        setTimes({ ...t, ...local?.times });
        const v = {};
        Object.keys({ ...a, ...m, ...t }).forEach((qid) => (v[qid] = true));
        setVisited({ ...v, ...local?.visited });
        startedAt.current = Date.now();
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, navigate, storageKey]);

  // 2. Tick every second (drives the clock)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Keep a copy in this browser and note that something changed
  useEffect(() => {
    latest.current = { questions, answers, marked, times, visited };
    if (questions.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify({ answers, marked, times, visited }));
    dirty.current = true;
  }, [questions, answers, marked, times, visited, storageKey]);

  // The question on screen counts as visited
  const currentId = questions[current]?._id;
  useEffect(() => {
    if (currentId) setVisited((v) => (v[currentId] ? v : { ...v, [currentId]: true }));
  }, [currentId]);

  // 4. Mock tests: autosave to the server every 10 seconds if something changed
  // Mock and live tests are timed, autosaved and run under exam rules
  const isMock = info?.mode === "mock" || info?.mode === "live";
  useEffect(() => {
    if (!isMock) return;
    const timer = setInterval(() => {
      if (!dirty.current || submitted.current) return;
      dirty.current = false;
      const l = latest.current;
      setSaveState("saving");
      api
        .put(`/attempts/${id}/answers`, { answers: buildPayload(l.questions, l.answers, l.marked, l.times, l.visited) })
        .then(() => setSaveState("saved"))
        .catch((err) => {
          if (err.response?.status === 409) navigate(`/result/${id}`, { replace: true }); // time already up
          else {
            dirty.current = true;
            setSaveState("error");
          }
        });
    }, 10000);
    return () => clearInterval(timer);
  }, [isMock, id, navigate]);

  // Adds time spent on the current question; returns the updated totals
  const recordTime = () => {
    const q = questions[current];
    const spent = Math.round((Date.now() - startedAt.current) / 1000);
    startedAt.current = Date.now();
    if (!q) return times;
    const updated = { ...times, [q._id]: (times[q._id] || 0) + spent };
    setTimes(updated);
    return updated;
  };

  const goTo = (index) => {
    if (index < 0 || index >= questions.length || index === current) return;
    recordTime();
    setCurrent(index);
  };

  const chooseOption = (question, optionId) => {
    setAnswers((prev) => {
      const selected = prev[question._id] || [];
      const next =
        question.type === "mcq_multi"
          ? selected.includes(optionId)
            ? selected.filter((x) => x !== optionId)
            : [...selected, optionId]
          : selected[0] === optionId
            ? []
            : [optionId];
      return { ...prev, [question._id]: next };
    });
  };

  // Sends everything to the server. auto = time is up.
  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    const finalTimes = recordTime();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/attempts/${id}/submit`, { answers: buildPayload(questions, answers, marked, finalTimes, visited) });
      localStorage.removeItem(storageKey);
      navigate(`/result/${id}`, { replace: true });
    } catch (err) {
      if (err.response?.status === 400) {
        // already submitted (for example, automatically by the server)
        localStorage.removeItem(storageKey);
        navigate(`/result/${id}`, { replace: true });
        return;
      }
      submitted.current = false;
      setSubmitting(false);
      setSummaryOpen(false);
      setError(getErrorMessage(err));
    }
  };

  const remaining = info?.expiresAt ? Math.floor((new Date(info.expiresAt).getTime() - (now + clockOffset)) / 1000) : null;

  // 5. Time is up: submit automatically
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !submitted.current) submit();
  });

  return {
    info, questions, current, answers, setAnswers, marked, setMarked, visited, error, loading, submitting,
    summaryOpen, setSummaryOpen, saveState, isMock, remaining, openedAt, now, goTo, chooseOption, submit,
  };
}