import { Suspense, lazy } from "react";
import { AppLoading } from "./components/Skeleton";
import NotFound from "./pages/NotFound";
import Profile from "./pages/student/Profile";
import Analytics from "./pages/student/Analytics";
import Welcome from "./pages/student/Welcome";
import { ExamProvider } from "./context/ExamContext";
import Landing from "./pages/Landing";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import LecturerRoute from "./components/LecturerRoute";
import StudentLayout from "./components/StudentLayout";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Dashboard from "./pages/student/Dashboard";
import PracticeSetup from "./pages/student/PracticeSetup";
import TestScreen from "./pages/student/TestScreen";
import Result from "./pages/student/Result";
import Revise from "./pages/student/Revise";
import MockTests from "./pages/student/MockTests";

// Admin pages load only when an admin opens them (keeps the student app fast)
const BulkUpload = lazy(() => import("./pages/admin/BulkUpload"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ManageSyllabus = lazy(() => import("./pages/admin/ManageSyllabus"));
const ManageQuestions = lazy(() => import("./pages/admin/ManageQuestions"));
const QuestionForm = lazy(() => import("./pages/admin/QuestionForm"));
const ManageTests = lazy(() => import("./pages/admin/ManageTests"));
const ManageStudents = lazy(() => import("./pages/admin/ManageStudents"));
const StudentDetail = lazy(() => import("./pages/admin/StudentDetail"));
const AttemptDetail = lazy(() => import("./pages/admin/AttemptDetail"));
const Results = lazy(() => import("./pages/admin/Results"));
const Lecturers = lazy(() => import("./pages/admin/Lecturers"));
const LiveTestsAdmin = lazy(() => import("./pages/admin/LiveTests"));
const LiveTestForm = lazy(() => import("./pages/admin/LiveTestForm"));
const LiveTestReview = lazy(() => import("./pages/admin/LiveTestReview"));
const LiveResults = lazy(() => import("./pages/admin/LiveResults"));
const LecturerHome = lazy(() => import("./pages/lecturer/LecturerHome"));
const PickQuestions = lazy(() => import("./pages/lecturer/PickQuestions"));
const LiveTests = lazy(() => import("./pages/student/LiveTests"));
const LiveReport = lazy(() => import("./pages/student/LiveReport"));

const protect = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
const adminOnly = (page) => <AdminRoute>{page}</AdminRoute>;
const lecturerOnly = (page) => <LecturerRoute>{page}</LecturerRoute>;

// Sends admins to the admin area and students to their dashboard
function Home() {
  const { user } = useAuth();
  const home = user?.role === "admin" ? "/admin" : user?.role === "lecturer" ? "/lecturer" : "/dashboard";
  return <Navigate to={home} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<AppLoading />}>
    <Routes>
      <Route path="/" element={<Landing loggedIn={protect(<Home />)} />} />

      {/* Public pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Student pages share one navigation bar */}
      <Route element={protect(<StudentLayout />)}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/practice" element={<PracticeSetup />} />
        <Route path="/mock-tests" element={<MockTests />} />
        <Route path="/live-tests" element={<LiveTests />} />
        <Route path="/live-tests/:id/report" element={<LiveReport />} />
        <Route path="/revise" element={<Revise />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/result/:id" element={<Result />} />
      </Route>

      {/* The test screen is full-screen, without the menu */}
      <Route path="/attempt/:id" element={protect(<TestScreen />)} />
      <Route path="/welcome" element={protect(<ExamProvider><Welcome /></ExamProvider>)} />

      {/* Admin pages */}
      <Route path="/admin" element={adminOnly(<AdminDashboard />)} />
      <Route path="/admin/syllabus" element={adminOnly(<ManageSyllabus />)} />
      <Route path="/admin/questions" element={adminOnly(<ManageQuestions />)} />
      <Route path="/admin/questions/bulk" element={adminOnly(<BulkUpload />)} />
      <Route path="/admin/questions/:id" element={adminOnly(<QuestionForm />)} />
      <Route path="/admin/tests" element={adminOnly(<ManageTests />)} />
      <Route path="/admin/students" element={adminOnly(<ManageStudents />)} />
      <Route path="/admin/students/:id" element={adminOnly(<StudentDetail />)} />
      <Route path="/admin/attempts/:id" element={adminOnly(<AttemptDetail />)} />
      <Route path="/admin/results" element={adminOnly(<Results />)} />
      <Route path="/admin/lecturers" element={adminOnly(<Lecturers />)} />
      <Route path="/admin/live-tests" element={adminOnly(<LiveTestsAdmin />)} />
      <Route path="/admin/live-tests/new" element={adminOnly(<LiveTestForm />)} />
      <Route path="/admin/live-tests/:id" element={adminOnly(<LiveTestReview />)} />
      <Route path="/admin/live-tests/:id/edit" element={adminOnly(<LiveTestForm />)} />
      <Route path="/admin/live-tests/:id/results" element={adminOnly(<LiveResults />)} />

      {/* Lecturers (and head lecturers) pick questions for live tests */}
      <Route path="/lecturer" element={lecturerOnly(<LecturerHome />)} />
      <Route path="/lecturer/tests/:id/:key" element={lecturerOnly(<PickQuestions />)} />

      {/* Any unknown URL goes back to the start */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}