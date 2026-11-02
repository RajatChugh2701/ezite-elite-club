import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useApp } from './data/store'
import { AppLayout } from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Apply from './pages/Apply'
import Checkout from './pages/Checkout'
import Legal from './pages/Legal'
import NotFound from './pages/NotFound'
import Home from './pages/Home'
import Membership from './pages/Membership'
import CancelMembership from './pages/CancelMembership'
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
import RequestWizard from './pages/RequestWizard'
import Requests from './pages/Requests'
import RequestDetail from './pages/RequestDetail'
import VisitTracking from './pages/VisitTracking'
import Appointments from './pages/Appointments'
import AppointmentDetail from './pages/AppointmentDetail'
import Consultations from './pages/Consultations'
import Family from './pages/Family'
import Team from './pages/Team'
import Messages from './pages/Messages'
import Documents from './pages/Documents'
import Payments from './pages/Payments'
import InvoiceDetail from './pages/InvoiceDetail'
import Financial from './pages/Financial'
import FinanceCaseDetail from './pages/FinanceCaseDetail'
import Assistant from './pages/Assistant'
import Support from './pages/Support'
import SupportCaseDetail from './pages/SupportCaseDetail'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'

function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useApp()
  const loc = useLocation()
  if (!state.session.loggedIn) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/apply" element={<Apply />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/legal/:doc" element={<Legal />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/home" element={<Home />} />
        <Route path="/membership" element={<Membership />} />
        <Route path="/membership/cancel" element={<CancelMembership />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/request/new" element={<RequestWizard />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/requests/:id/visit" element={<VisitTracking />} />
        <Route path="/approvals" element={<Navigate to="/requests?status=awaiting_approval" replace />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/:id" element={<AppointmentDetail />} />
        <Route path="/consultations" element={<Consultations />} />
        <Route path="/family" element={<Family />} />
        <Route path="/team" element={<Team />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/payments/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/financial/:id" element={<FinanceCaseDetail />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/support" element={<Support />} />
        <Route path="/support/:id" element={<SupportCaseDetail />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound inApp />} />
      </Route>
    </Routes>
  )
}
