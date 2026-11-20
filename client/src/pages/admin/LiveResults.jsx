import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import ClassLeaderboard from "../../components/ClassLeaderboard";

// Head lecturer: leaderboard of a live test
export default function LiveResults() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/admin/live-tests/${id}/results`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  const download = () => {
    const head = ["Rank", "Name", "Email", "Score", "Out of", "Percent", "Correct", "Wrong", "Unanswered", "Time (min)", "Submitted"];
    const lines = data.rows.map((r) =>
      [r.rank, r.student?.name || "", r.student?.email || "", r.score, r.maxScore, r.percentage, r.correct, r.incorrect, r.unanswered, Math.round(r.timeTakenSec / 60), new Date(r.submittedAt).toLocaleString("en-IN")]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.test.title.replace(/[^\w]+/g, "-")}-results.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) {
    return (
      <AdminLayout title="Results">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </AdminLayout>
    );
  }
  if (!data) {
    return (
      <AdminLayout title="Results">
        <p className="text-sm text-slate-500">Loading...</p>
      </AdminLayout>
    );
  }
  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={`/admin/live-tests/${id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← {data.test.title}
        </Link>
        {data.rows.length > 0 && (
          <button type="button" onClick={download} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Download CSV
          </button>
        )}
      </div>
      <div className="mt-3">
        <ClassLeaderboard test={data.test} rows={data.rows} />
      </div>
    </AdminLayout>
  );
}
