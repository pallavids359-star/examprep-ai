import { useParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import LiveReport from "../student/LiveReport";

// Admin: one student's result, in exactly the page the student sees
export default function AttemptDetail() {
  const { id } = useParams();
  return (
    <AdminLayout>
      <AdminReport id={id} />
    </AdminLayout>
  );
}

function AdminReport({ id }) {
  return <LiveReport attemptId={id} asAdmin backTo={null} backLabel={null} />;
}
