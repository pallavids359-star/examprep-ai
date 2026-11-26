import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import LiveResultsBrowser from "../../components/LiveResultsBrowser";
import Loading from "../../components/Loading";

// Student: my live test results, by exam
export default function MyResults() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/live-tests/my-results")
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 md:py-8">
      <h1 className="text-3xl font-extrabold text-slate-900">My results</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Your live tests: rank, marks, and every question with the right answer.</p>
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data && !error && <Loading />}
      {data && <LiveResultsBrowser data={data} reportLink={(t) => `/live-tests/${t.testId}/report`} empty="You haven't taken a live test for this exam yet." />}
    </main>
  );
}
