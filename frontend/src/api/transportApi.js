import api from './axios';

/**
 * Central wrapper for all Transport module endpoints.
 * Backend blueprints (all already registered in app/__init__.py):
 *   routes/transport.py          -> /api/transport/... (vehicles, drivers, conductors, stops, routes, maintenance)
 *   routes/transport_student.py  -> /api/transport/students..., /fee-structures, /fee-records
 *   routes/transport_gps.py      -> /api/transport/driver/..., /live, /trips, /parent/child/<id>/trip
 *   routes/transport_reports.py  -> /api/transport/dashboard..., /reports/...
 *
 * Every page (Vehicles.jsx, Drivers.jsx, TransportFees.jsx, DriverMobileApp.jsx, etc.)
 * should call these instead of hitting `api.get(...)` with hardcoded strings, so the
 * URL is defined in exactly one place.
 */

const qs = (params = {}) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
};

const transportApi = {
  // ── Vehicles ────────────────────────────────────────────────────────────
  vehicles: {
    list:        (params) => api.get(`/transport/vehicles${qs(params)}`),
    get:         (id)      => api.get(`/transport/vehicles/${id}`),
    getStudents: (id)      => api.get(`/transport/vehicles/${id}/students`),
    create:      (data)     => api.post('/transport/vehicles', data),
    update:      (id, data) => api.put(`/transport/vehicles/${id}`, data),
    remove:      (id)       => api.delete(`/transport/vehicles/${id}`),
  },

  // ── Drivers ─────────────────────────────────────────────────────────────
  drivers: {
    list:   (params) => api.get(`/transport/drivers${qs(params)}`),
    get:    (id)      => api.get(`/transport/drivers/${id}`),
    create: (data)     => api.post('/transport/drivers', data),
    update: (id, data) => api.put(`/transport/drivers/${id}`, data),
    remove: (id)       => api.delete(`/transport/drivers/${id}`),
  },

  // ── Conductors ──────────────────────────────────────────────────────────
  conductors: {
    list:   (params) => api.get(`/transport/conductors${qs(params)}`),
    create: (data)     => api.post('/transport/conductors', data),
    update: (id, data) => api.put(`/transport/conductors/${id}`, data),
    remove: (id)       => api.delete(`/transport/conductors/${id}`),
  },

  // ── Stops ───────────────────────────────────────────────────────────────
  stops: {
    list:   (params) => api.get(`/transport/stops${qs(params)}`),
    create: (data)     => api.post('/transport/stops', data),
    update: (id, data) => api.put(`/transport/stops/${id}`, data),
    remove: (id)       => api.delete(`/transport/stops/${id}`),
  },

  // ── Routes (School -> Stop1 -> Stop2 -> ... -> School) ─────────────────
  routes: {
    list:         (params) => api.get(`/transport/routes${qs(params)}`),
    get:          (id)      => api.get(`/transport/routes/${id}`),
    create:       (data)     => api.post('/transport/routes', data),
    update:       (id, data) => api.put(`/transport/routes/${id}`, data),
    replaceStops: (id, stops) => api.put(`/transport/routes/${id}/stops`, { stops }),
    remove:       (id)       => api.delete(`/transport/routes/${id}`),
  },

  // ── Vehicle Maintenance ─────────────────────────────────────────────────
  maintenance: {
    list:   (params) => api.get(`/transport/maintenance${qs(params)}`),
    create: (data)     => api.post('/transport/maintenance', data),
    update: (id, data) => api.put(`/transport/maintenance/${id}`, data),
    remove: (id)       => api.delete(`/transport/maintenance/${id}`),
  },

  // ── Student Transport (assign / transfer / remove / history) ───────────
  students: {
    browse:  (params) => api.get(`/transport/students${qs(params)}`),
    assign:  (data)     => api.post('/transport/students/assign', data),
    transfer: (studentId, data) => api.post(`/transport/students/${studentId}/transfer`, data),
    remove:  (studentId, data)  => api.post(`/transport/students/${studentId}/remove`, data),
    getTransport: (studentId) => api.get(`/transport/students/${studentId}/transport`),
    history: (studentId)      => api.get(`/transport/students/${studentId}/history`),
  },

  // ── Transport Fees & Fines ──────────────────────────────────────────────
  fees: {
    listStructures:   (params) => api.get(`/transport/fee-structures${qs(params)}`),
    createStructure:  (data)     => api.post('/transport/fee-structures', data),
    updateStructure:  (id, data) => api.put(`/transport/fee-structures/${id}`, data),
    removeStructure:  (id)       => api.delete(`/transport/fee-structures/${id}`),

    listRecords:    (params) => api.get(`/transport/fee-records${qs(params)}`),
    generateRecords: (data)   => api.post('/transport/fee-records/generate', data),
    collect:        (recordId, data) => api.post(`/transport/fee-records/${recordId}/collect`, data),
    waive:          (recordId, data) => api.post(`/transport/fee-records/${recordId}/waive`, data),
    transactions:   (recordId) => api.get(`/transport/fee-records/${recordId}/transactions`),
  },

  fines: {
    list:    (params) => api.get(`/transport/fines${qs(params)}`),
    create:  (data)     => api.post('/transport/fines', data),
    collect: (id, data) => api.post(`/transport/fines/${id}/collect`, data),
    waive:   (id, data) => api.post(`/transport/fines/${id}/waive`, data),
  },

  // ── Driver Mobile App ────────────────────────────────────────────────────
  driver: {
    today:              () => api.get('/transport/driver/today'),
    startTrip:          (data) => api.post('/transport/driver/trip/start', data),
    pingGps:            (tripId, data) => api.post(`/transport/driver/trip/${tripId}/gps`, data),
    getStops:           (tripId) => api.get(`/transport/driver/trip/${tripId}/stops`),
    detectStop:         (tripId, data) => api.post(`/transport/driver/trip/${tripId}/detect-stop`, data),
    recordStudentEvent: (tripId, data) => api.post(`/transport/driver/trip/${tripId}/student-event`, data),
    getAttendance:      (tripId) => api.get(`/transport/driver/trip/${tripId}/attendance`),
    pauseTrip:          (tripId) => api.post(`/transport/driver/trip/${tripId}/pause`),
    resumeTrip:         (tripId) => api.post(`/transport/driver/trip/${tripId}/resume`),
    endTrip:            (tripId) => api.post(`/transport/driver/trip/${tripId}/end`),
    sos:                (tripId) => api.post(`/transport/driver/trip/${tripId}/sos`),
    breakdown:          (tripId, data) => api.post(`/transport/driver/trip/${tripId}/breakdown`, data),
  },

  // ── Live Tracking (Principal view) ──────────────────────────────────────
  live: {
    vehicles:   ()      => api.get('/transport/live'),
    tripDetail: (tripId, params) => api.get(`/transport/trips/${tripId}${qs(params)}`),
    trips:      (params) => api.get(`/transport/trips${qs(params)}`),
  },

  // ── Parent View ──────────────────────────────────────────────────────────
  parent: {
    childTrip: (studentId) => api.get(`/transport/parent/child/${studentId}/trip`),
    childHistory: (studentId) => api.get(`/transport/parent/child/${studentId}/history`),
  },

  // ── Dashboard ────────────────────────────────────────────────────────────
  dashboard: {
    summary:                () => api.get('/transport/dashboard'),
    monthlyCollection:      () => api.get('/transport/dashboard/monthly-collection'),
    vehicleDistribution:    () => api.get('/transport/dashboard/vehicle-distribution'),
    studentsByVehicle:      () => api.get('/transport/dashboard/students-by-vehicle'),
    routeWiseStudents:      () => api.get('/transport/dashboard/route-wise-students'),
    classWiseTransportUsers: () => api.get('/transport/dashboard/class-wise-transport-users'),
    recentActivities:       () => api.get('/transport/dashboard/recent-activities'),
    upcomingMaintenance:    () => api.get('/transport/dashboard/upcoming-maintenance'),
  },

  // ── Reports ──────────────────────────────────────────────────────────────
  reports: {
    vehicleWiseStudents:      (params) => api.get(`/transport/reports/vehicle-wise-students${qs(params)}`),
    driverWiseStudents:       (params) => api.get(`/transport/reports/driver-wise-students${qs(params)}`),
    routeWiseStudents:        (params) => api.get(`/transport/reports/route-wise-students${qs(params)}`),
    stopWiseStudents:         (params) => api.get(`/transport/reports/stop-wise-students${qs(params)}`),
    studentsWithoutTransport: (params) => api.get(`/transport/reports/students-without-transport${qs(params)}`),
    transportFee:             (params) => api.get(`/transport/reports/transport-fee${qs(params)}`),
    collection:               (params) => api.get(`/transport/reports/collection${qs(params)}`),
    maintenance:              (params) => api.get(`/transport/reports/maintenance${qs(params)}`),
    vehicleUtilization:       (params) => api.get(`/transport/reports/vehicle-utilization${qs(params)}`),
    transferHistory:          (params) => api.get(`/transport/reports/transfer-history${qs(params)}`),
  },
};

export default transportApi;
