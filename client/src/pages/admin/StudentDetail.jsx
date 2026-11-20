import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import StudentAttempts from "../../components/StudentAttempts";

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
            <Link to="/admin/students" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
                ← All students
            </Link>

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

                    <StudentAttempts studentId={id} />

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
