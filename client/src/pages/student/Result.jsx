import { useParams } from "react-router-dom";
import LiveReport from "./LiveReport";

// Result of any finished test or practice: the same page as the live test report
export default function Result() {
  const { id } = useParams();
  return <LiveReport attemptId={id} />;
}
