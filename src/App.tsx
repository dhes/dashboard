// src/App.tsx
// import React from "react";
import Dashboard from "./Dashboard";
import SmokingStatusForm from "./SmokingStatusForm";

function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-4">
      <h1 className="text-3xl font-bold mb-4">📋 Personal Health Dashboard</h1>
      <SmokingStatusForm />
      <Dashboard />
    </main>
  );
}

export default App;