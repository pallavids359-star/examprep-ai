import { useEffect, useState } from "react";
import BackLink from "../../components/BackLink";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import LiveResultsBrowser from "../../components/LiveResultsBrowser";


// Admin view of one student: details plus the same Analytics the student sees
const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never");

export default function StudentDetail() {
    const { id } = useParams();
    const [info, setInfo] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api
            .get(`/admin/students/${id}`)
            .then((res) => {
                setInfo(res.data);
            })
            .catch((err) => setError(getErrorMessage(err)));
    }, [id]);

    const student = info?.student;

    return (
        <AdminLayout title={student ? student.name : "Student"}>
            <BackLink to="/admin/students">All students</BackLink>

            {error && <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
            {!info && !error && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

            {student && (
                <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <Info label="Email" value={student.email} />
                        <Info label="Joined" value={formatDate(student.createdAt)} />
                        <Info label="Last login" value={formatDate(student.lastLoginAt)} />
                        <Info
                            label="Status"
                            value={
                                <span
                                    className={`px-2 py-0.5 rounded-md text-xs font-medium ${student.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                                >
                                    {student.status}
                                </span>
                            }
                        />
                    </div>

                    <div className="mt-8">
                        <h2 className="mb-4 text-xl font-extrabold text-slate-900">Live test results</h2>
                        <StudentLive id={id} />
                    </div>

                </>
            )}
        </AdminLayout>
    );
}

function Info({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-medium text-slate-900 break-all">{value}</p>
        </div>
    );
}

function StudentLive({ id }) {
    const [data, setData] = useState(null);
    useEffect(() => {
        api.get(`/admin/students/${id}/live-results`).then((res) => setData(res.data)).catch(() => setData({ exams: [], tests: [] }));
    }, [id]);
    if (!data) return <p className="py-6 text-sm text-slate-400">Loading...</p>;
    return <LiveResultsBrowser data={data} reportLink={(t) => `/admin/attempts/${t.attemptId}`} empty="No live tests taken for this exam." />;
}
