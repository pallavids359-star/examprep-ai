import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api, { getErrorMessage } from "../api/axios";
import Scorecard, { scorecardRows } from "./Scorecard";
import { toast } from "./Toaster";

// Prints one or many attempt reports (one scorecard page each) as a single PDF.
//   const { printReports, busy, node } = useReportPrinter();
//   printReports([attemptId, ...], "key", "Asha_Mock_tests")   and render {node} somewhere on the page
export function useReportPrinter() {
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");
  const [fileName, setFileName] = useState("");

  const printReports = async (ids, key, name = "Reports") => {
    if (!ids.length || busy) return;
    setBusy(key);
    try {
      const list = [];
      for (let i = 0; i < ids.length; i++) {
        setProgress(ids.length > 1 ? `${i + 1}/${ids.length}` : "");
        const res = await api.get(`/admin/attempts/${ids[i]}`);
        list.push(res.data);
      }
      setFileName(name);
      setCards(list);
    } catch (err) {
      toast(getErrorMessage(err), "error");
      setBusy("");
    } finally {
      setProgress("");
    }
  };

  // Once the pages are on screen, open the print dialog (Save as PDF)
  useEffect(() => {
    if (!cards) return;
    const oldTitle = document.title;
    document.title = fileName.replace(/[^\w-]+/g, "_"); // becomes the PDF file name
    document.body.classList.add("gp-printing-batch");
    const done = () => {
      document.body.classList.remove("gp-printing-batch");
      document.title = oldTitle;
      window.removeEventListener("afterprint", done);
      setCards(null);
      setBusy("");
    };
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [cards, fileName]);

  const node = cards ? createPortal(
    <div className="gp-print-batch" aria-hidden="true">
      {cards.map((d) => (
        <Scorecard
          key={d.attemptId}
          title={d.title}
          exam={[d.exam, d.modeLabel].filter(Boolean).join(" · ")}
          date={d.submittedAt || d.startedAt}
          name={d.student?.name}
          idLabel="Email"
          idValue={d.student?.email}
          rank={d.rank?.rank}
          totalCandidates={d.rank?.total}
          score={d.summary?.score ?? 0}
          maxScore={d.summary?.maxScore ?? 0}
          rows={scorecardRows(d.questions || [])}
        />
      ))}
    </div>,
    document.body
  ) : null;

  return { printReports, busy, progress, node };
}
