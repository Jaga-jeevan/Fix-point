import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-ink-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
