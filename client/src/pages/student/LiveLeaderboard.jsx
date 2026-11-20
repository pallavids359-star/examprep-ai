import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import ClassLeaderboard from "../../components/ClassLeaderboard";

// Students: every student's rank in a live test (once results are out)
export default function LiveLeaderboard() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/live-tests/${id}/leaderboard`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <div className="mb-3 flex flex-wrap gap-4 text-sm print:hidden">
        <Link to="/live-tests" className="text-slate-500 hover:text-slate-900">
          ← Live tests
        </Link>
        <Link to={`/live-tests/${id}/report`} className="text-slate-500 hover:text-slate-900">
          My report
        </Link>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data && !error && <p className="py-10 text-center text-sm text-slate-400">Loading...</p>}
      {data && <ClassLeaderboard test={data.test} rows={data.rows} canOpen={false} />}
    </main>
  );
}
