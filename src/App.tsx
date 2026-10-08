import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import "./styles/variables.css";
import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login/Login";
import Register from "./pages/Login/Register";
import ForgotPassword from "./pages/Login/ForgotPassword";
import ResetPassword from "./pages/Login/ResetPassword";
import Welcome from "./pages/Welcome/Welcome";
import DashboardPage from "./pages/Dashboard/Dashboard";
import Movements from "./pages/Treasury/Movements/Movements";
import MovementDetail from "./pages/Treasury/Movements/MovementDetail";
import NewMovement from "./pages/Treasury/NewMovement/NewMovement";

import NewExpense from "./pages/Treasury/NewExpense/NewExpense";
import Cementerio from "./pages/Treasury/Cementerio/Cementerio";
import CementerioDetalle from "./pages/Treasury/Cementerio/CementerioDetalle";
import ServiceHistory from "./pages/Treasury/ServiceHistory/ServiceHistory";
import ExternalServicesGrid from "./pages/Treasury/ExternalServices/ExternalServicesGrid";
import Members from "./pages/Members/Members";
import NewMember from "./pages/Members/NewMember/NewMember";
import DetalleSocio from "./pages/Members/Detalle/Detalle";
import Persons from "./pages/Persons/Persons";
import DetallePersona from "./pages/Persons/Detalle/Detalle";
import NewPerson from "./pages/Persons/NewPerson/NewPerson";
import Config from "./pages/Config/Config";
import Variables from "./pages/Config/Variables";
import Calendario from "./pages/Calendario/Calendario";
import Reportes from "./pages/Reportes/Reportes";
import Usuarios from "./pages/Usuarios/Usuarios";
import NotFound from "./pages/NotFound/NotFound";

const OWNER_OR_ADMIN: Array<"owner" | "admin"> = ["owner", "admin"];
const MEMBERS_EDITOR: Array<"owner" | "admin" | "secretario"> = ["owner", "admin", "secretario"];

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/recuperar-contrasena" element={<ForgotPassword />} />
        <Route path="/restablecer-contrasena" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Welcome />} />
          <Route path="tesoreria/dashboard" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/movimientos" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <Movements />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/movimientos/detalle/:id" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <MovementDetail />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/nuevo-movimiento" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <NewMovement />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/nuevo-movimiento/:id" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <NewMovement />
            </ProtectedRoute>
          } />

          <Route path="tesoreria/egresos/nuevo-egreso" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <NewExpense />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/cementerio" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <Cementerio />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/cementerio/:nicho" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <CementerioDetalle />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/historial-servicios" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <ServiceHistory />
            </ProtectedRoute>
          } />
          <Route path="tesoreria/servicios-externos" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <ExternalServicesGrid />
            </ProtectedRoute>
          } />
          <Route path="socios" element={<Members />} />
          <Route path="socios/nuevo" element={
            <ProtectedRoute allowedRoles={MEMBERS_EDITOR}>
              <NewMember />
            </ProtectedRoute>
          } />
          <Route path="socios/editar/:id" element={
            <ProtectedRoute allowedRoles={MEMBERS_EDITOR}>
              <NewMember />
            </ProtectedRoute>
          } />
          <Route path="socios/detalle/:id" element={<DetalleSocio />} />
          <Route path="terceros" element={<Persons />} />
          <Route path="terceros/nuevo" element={
            <ProtectedRoute allowedRoles={MEMBERS_EDITOR}>
              <NewPerson />
            </ProtectedRoute>
          } />
          <Route path="terceros/editar/:id" element={
            <ProtectedRoute allowedRoles={MEMBERS_EDITOR}>
              <NewPerson />
            </ProtectedRoute>
          } />
          <Route path="terceros/detalle/:id" element={<DetallePersona />} />
          <Route path="configuracion" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <Config />
            </ProtectedRoute>
          } />
          <Route path="configuracion/variables" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <Variables />
            </ProtectedRoute>
          } />
          <Route path="reportes" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <Reportes />
            </ProtectedRoute>
          } />
          <Route path="calendario" element={<Calendario />} />
          <Route path="usuarios" element={
            <ProtectedRoute allowedRoles={OWNER_OR_ADMIN}>
              <Usuarios />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
