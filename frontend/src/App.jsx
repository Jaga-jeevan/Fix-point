import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import CustomerDashboard from "./pages/customer/Dashboard";
import CreateRepair from "./pages/customer/CreateRepair";
import MyRepairs from "./pages/customer/MyRepairs";
import CustomerRepairDetails from "./pages/customer/RepairDetails";

import TechnicianDashboard from "./pages/technician/Dashboard";
import JobsHub from "./pages/technician/JobsHub";
import JobProgress from "./pages/technician/JobProgress";
import JobDetails from "./pages/technician/JobDetails";
import TechnicianMessages from "./pages/technician/TechnicianMessages";

import AdminDashboard from "./pages/admin/Dashboard";
import Requests from "./pages/admin/Requests";
import RequestDetails from "./pages/admin/RequestDetails";
import Technicians from "./pages/admin/Technicians";
import Customers from "./pages/admin/Customers";
import CustomerDetails from "./pages/admin/CustomerDetails";
import VoiceAssistant from "./components/VoiceAssistant";

const HOME_BY_ROLE = {
  CUSTOMER: "/customer/dashboard",
  TECHNICIAN: "/technician/dashboard",
  ADMIN: "/admin/dashboard",
};

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[user.role] || "/login"} replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

      {/* Customer */}
      <Route
        path="/customer/dashboard"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/repairs"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <MyRepairs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/repairs/new"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CreateRepair />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/repairs/:id"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CustomerRepairDetails />
          </ProtectedRoute>
        }
      />

      {/* Technician */}
      <Route
        path="/technician/dashboard"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/jobs"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <JobsHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/progress"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <JobProgress />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/messages"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianMessages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/jobs/:id"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <JobDetails />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/requests"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <Requests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/requests/:id"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <RequestDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/technicians"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <Technicians />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customers"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customers/:id"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <CustomerDetails />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

    {user && <VoiceAssistant />}
  </>
  );
}
