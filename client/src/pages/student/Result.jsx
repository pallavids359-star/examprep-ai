import { useParams } from "react-router-dom";
import AttemptReport from "../../components/AttemptReport";

// Result of any finished test or practice: the same page as the live test report
export default function Result() {
  const { id } = useParams();
  return <AttemptReport attemptId={id} />;
}
